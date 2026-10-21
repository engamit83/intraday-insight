// paper-trader: AUTOMATIC paper trading (no real money, ever). Owner's decision 8 Oct (PROGRESS.md stage 1b).
//
// Run every minute in market hours by a scheduled job (x-job-token, see AGENTS.md / auth.ts):
//   1. manages every open paper trade on each newly CLOSED 5-minute candle with the back-tested v4 exit rules
//      (stop, target, breakeven, profit lock, trailing stop, 15:15 square-off) — supabase/functions/_shared/paper.ts
//   2. opens a paper trade for every new rule-set-v4 signal at the FIRST PRICE AFTER THE SIGNAL (v4.1, 16 Oct): the
//      open of the 1-minute candle that starts right after the signal was created (+ slippage) - what a person
//      acting on the signal would get. Falls back to the open of the 5-minute candle forming at signal time (the
//      back-test's entry) if that 1-minute candle never appears. Skipped if the daily loss limit was hit or 10
//      trades are already open
//   3. after 15:30 writes one daily summary to system_logs
// A signed-in user may call it with {} to READ today's paper trades and P&L (nothing is changed).
// Real orders are never placed here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAuth, corsHeaders, isTrustedInternalRequest } from '../_shared/auth.ts'
import { reversalCheck, describeSigns, type MinBar } from '../_shared/reversal.ts'
import { PAPER, manageOnCandle, entryFill, settle, quantityFor, roundTripCostPct, newTrack, trackOnCandle, trackDone, type PaperPos, type Bar, type Track } from '../_shared/paper.ts'
import { istDayStartMs } from '../_shared/livecandles.ts'
import { istOf, bucketOfMs } from '../_shared/v4.ts'
import { notify } from '../_shared/notify.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  const trusted = await isTrustedInternalRequest(req)
  if (!trusted) {
    const auth = await verifyAuth(req)
    if (!auth.authenticated) return json({ error: 'Authentication required' }, 401)
  }
  const body = await req.json().catch(() => ({}))
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const nowMs = Date.now()
  const { day: today, min: nowMin } = istOf(nowMs)
  const dayStartIso = new Date(istDayStartMs(nowMs)).toISOString()

  const loadToday = async () => {
    const { data, error } = await supabase.from('simulated_trades').select('*').eq('rules', 'v4').gte('entry_time', dayStartIso).order('entry_time', { ascending: true })
    if (error) throw new Error(`simulated_trades read failed: ${error.message} (run the paper-trader SQL first)`)
    return (data ?? []) as Row[]
  }
  const report = (trades: Row[], extra: Record<string, unknown> = {}) => {
    const closed = trades.filter((t) => t.status === 'CLOSED')
    const net = closed.reduce((a, t) => a + Number(t.pnl ?? 0), 0)
    return {
      ok: true, day: today, rules: 'v4', costPctPerRoundTrip: Math.round(roundTripCostPct() * 1000) / 1000,
      open: trades.filter((t) => t.status === 'OPEN').map((t) => ({ symbol: t.symbol, direction: t.direction, entry: t.entry_price, stop: t.stoploss, target: t.target, since: t.entry_time })),
      closed: closed.map((t) => ({ symbol: t.symbol, direction: t.direction, entry: t.entry_price, exit: t.exit_price, reason: t.exit_reason, netRs: Math.round(Number(t.pnl ?? 0)), netPct: t.net_pct,
        targetReached: t.details?.track?.pred?.done ? !!t.details.track.pred.reached : null, normalStopNetRs: t.details?.track?.shadow?.closed ? t.details.track.shadow.netRs : null })),
      exitMode: PAPER.exitMode,
      closedCount: closed.length, wins: closed.filter((t) => Number(t.pnl) > 0).length, netRs: Math.round(net), ...extra,
    }
  }

  let trades: Row[]
  try { trades = await loadToday() } catch (e) { return json({ error: String(e instanceof Error ? e.message : e) }, 500) }
  if (!trusted) return json(report(trades, { readOnly: true }))

  const weekday = new Date(nowMs + 5.5 * 3600_000).getUTCDay()
  const inSession = weekday >= 1 && weekday <= 5 && nowMin >= 9 * 60 + 15 && nowMin <= 15 * 60 + 40
  // ---- phone alerts: morning checks (owner, 17 Oct) ----
  if (weekday >= 1 && weekday <= 5 && nowMin >= 8 * 60 + 50 && nowMin <= 15 * 60 + 25) {
    const { data: tok } = await supabase.from('user_settings').select('sharekhan_token_expiry')
      .not('sharekhan_access_token', 'is', null).gt('sharekhan_token_expiry', new Date(nowMs).toISOString()).limit(1)
    if (!tok?.length) await notify(supabase, '⚠️ Sharekhan is NOT connected. Open the app on the Lovable address → Settings → Connect Sharekhan.', { key: `sharekhan-off-${today}`, everyMin: 60 })
    if (nowMin >= 9 * 60 + 20) {
      const { data: lastC } = await supabase.from('live_candles').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      const ageMin = lastC?.updated_at ? (nowMs - Date.parse(lastC.updated_at)) / 60_000 : Infinity
      if (ageMin > 3) await notify(supabase, `⚠️ Price feed is OFF${Number.isFinite(ageMin) ? ` (no prices for ${Math.round(ageMin)} min)` : ''}. Check that the laptop is on, signed in and online.`, { key: `feed-off-${today}`, everyMin: 30 })
    }
  }
  if (!inSession && body.force !== true) return json({ skipped: 'market_closed' })

  const { data: owner } = await supabase.from('user_settings').select('user_id')
    .not('sharekhan_access_token', 'is', null).order('sharekhan_token_generated_at', { ascending: false }).limit(1).maybeSingle()

  // closed 5-minute candles of today for a symbol, from a bucket (inclusive)
  const barsFrom = async (symbol: string, fromIso: string): Promise<Bar[]> => {
    const { data } = await supabase.from('live_candles').select('bucket_start, open, high, low, close')
      .eq('symbol', symbol).eq('timeframe', '5min').gte('bucket_start', fromIso).order('bucket_start', { ascending: true }).limit(100)
    return ((data ?? []) as Row[])
      .filter((r) => Date.parse(r.bucket_start) + 5 * 60_000 <= nowMs)
      .map((r) => ({ bucket: bucketOfMs(Date.parse(r.bucket_start)).bucket, startIso: r.bucket_start, open: +r.open, high: +r.high, low: +r.low, close: +r.close }))
  }
  const log: string[] = []
  const FIVE = 5 * 60_000
  // the part of the entry's 5-minute window AFTER a 1-minute entry, as one bar (only once that window has closed)
  const partialBar = async (symbol: string, entryIso: string): Promise<(Bar & { startIso: string; endIso: string }) | null> => {
    const startMs = Date.parse(entryIso), bStart = Math.floor(startMs / FIVE) * FIVE, bEnd = bStart + FIVE
    if (bEnd > nowMs) return null
    const { data } = await supabase.from('live_candles').select('bucket_start, open, high, low, close')
      .eq('symbol', symbol).eq('timeframe', '1min').gte('bucket_start', entryIso).lt('bucket_start', new Date(bEnd).toISOString()).order('bucket_start', { ascending: true })
    const rows = (data ?? []) as Row[]
    const startIso = new Date(bStart).toISOString(), endIso = new Date(bEnd).toISOString()
    if (!rows.length) return { bucket: bucketOfMs(bStart).bucket, startIso, endIso, open: NaN, high: NaN, low: NaN, close: NaN }
    return { bucket: bucketOfMs(bStart).bucket, startIso, endIso, open: +rows[0].open, high: Math.max(...rows.map((r) => +r.high)),
      low: Math.min(...rows.map((r) => +r.low)), close: +rows[rows.length - 1].close }
  }

  // bars after a cursor (or from the entry) for the learning record; handles a 1-minute entry's partial window
  const barsAfter = async (t: Row, cursorIso: string | null): Promise<(Bar & { startIso: string })[]> => {
    const out: (Bar & { startIso: string })[] = []
    let from = cursorIso ? new Date(Date.parse(cursorIso) + 5 * 60_000).toISOString() : t.entry_time
    if (!cursorIso && t.details?.entry_mode === '1min') {
      const pb = await partialBar(t.symbol, t.entry_time)
      if (!pb) return out
      if (Number.isFinite(pb.open)) out.push(pb)
      from = pb.endIso
    }
    out.push(...await barsFrom(t.symbol, from) as (Bar & { startIso: string })[])
    return out
  }

  // ---- 1) manage open trades ----
  const manage = async (t: Row) => {
    let closedByUs = true
    let from = t.last_bucket ? new Date(Date.parse(t.last_bucket) + 5 * 60_000).toISOString() : t.entry_time
    const bars: (Bar & { startIso: string })[] = []
    if (!t.last_bucket && t.details?.entry_mode === '1min') {
      // entry inside a 5-minute window: manage the rest of that window from 1-minute candles first
      const pb = await partialBar(t.symbol, t.entry_time)
      if (!pb) return // that window has not closed yet
      if (Number.isFinite(pb.open)) bars.push(pb)
      from = pb.endIso
    }
    bars.push(...await barsFrom(t.symbol, from) as (Bar & { startIso: string })[])
    const p: PaperPos = {
      direction: t.direction, entry: +t.entry_price, stop: +t.stoploss, target: +t.target, stopDist: +t.stop_dist, atr: +t.atr,
      atBreakeven: !!t.at_breakeven, locked: !!t.locked, bestExc: t.best_exc === null ? undefined : +t.best_exc, bestClose: t.best_close === null ? undefined : +t.best_close,
    }
    let lastIso: string | null = null
    for (const b of bars) {
      const step = manageOnCandle(p, b)
      if (step.action === 'close') {
        const st = settle(p, step, +t.quantity)
        await supabase.from('simulated_trades').update({
          status: 'CLOSED', exit_price: Math.round(st.exit * 100) / 100, exit_time: new Date(Date.parse(b.startIso) + 5 * 60_000).toISOString(), exit_reason: step.reason,
          pnl: Math.round(st.pnlRs * 100) / 100, pnl_percent: Math.round(st.netPct * 1000) / 1000, gross_pct: Math.round(st.grossPct * 1000) / 1000,
          net_pct: Math.round(st.netPct * 1000) / 1000, costs_rs: Math.round(st.costsRs * 100) / 100, last_bucket: b.startIso, stoploss: p.stop,
        }).eq('id', t.id).eq('status', 'OPEN').select('id').then((r: { data: unknown[] | null }) => { closedByUs = !(Array.isArray(r.data) && r.data.length === 0) })
        t.status = 'CLOSED'; t.pnl = st.pnlRs
        log.push(`closed ${t.symbol} ${t.direction} ${step.reason} net Rs ${Math.round(st.pnlRs)}${closedByUs ? '' : ' (already closed on a tick by the laptop)'}`)
        if (closedByUs) await notify(supabase, `${st.pnlRs >= 0 ? '✅' : '🔻'} Paper ${t.direction} ${t.symbol} closed: ${({ stop: 'stop loss', breakeven: 'at buy price', lockedstop: 'raised stop', target: 'TARGET hit', squareoff: '15:15 close' } as Record<string, string>)[step.reason] ?? step.reason}, net ₹${Math.round(st.pnlRs)} (paper money)`)
        return
      }
      lastIso = b.startIso
    }
    // FAST EXIT (owner 21 Oct: alerts at the exact time): inside the 5-minute candle that is still forming, check every closed
    // 1-minute candle for a touch of the CURRENT stop or target. Levels (no-loss, locks, trailing) still move only on closed
    // 5-minute candles (same rules as the back-test); only the touch is detected ~1 minute after it happens instead of up to 5.
    if (t.status === 'OPEN' && nowMin < 15 * 60 + 15) {
      const winFrom = lastIso ? new Date(Date.parse(lastIso) + FIVE).toISOString() : (bars.length ? null : from)
      if (winFrom) {
        const { data: mins } = await supabase.from('live_candles').select('bucket_start, open, high, low, close').eq('symbol', t.symbol).eq('timeframe', '1min')
          .gte('bucket_start', winFrom).order('bucket_start', { ascending: true }).limit(10)
        const B = t.direction === 'BUY'
        for (const m of ((mins ?? []) as Row[]).filter((r) => Date.parse(r.bucket_start) + 60_000 <= nowMs && Date.parse(r.bucket_start) >= Date.parse(t.entry_time))) {
          const hitStop = B ? +m.low <= p.stop : +m.high >= p.stop
          const hitTarget = B ? +m.high >= p.target : +m.low <= p.target
          if (!hitStop && !hitTarget) continue
          const step = hitStop
            ? { action: 'close' as const, rawPx: B ? Math.min(+m.open, p.stop) : Math.max(+m.open, p.stop), reason: (p.locked ? 'lockedstop' : p.atBreakeven ? 'breakeven' : 'stop') as 'stop' | 'breakeven' | 'lockedstop', slipped: true }
            : { action: 'close' as const, rawPx: p.target, reason: 'target' as const, slipped: false }
          const st = settle(p, step, +t.quantity)
          await supabase.from('simulated_trades').update({
            status: 'CLOSED', exit_price: Math.round(st.exit * 100) / 100, exit_time: new Date(Date.parse(m.bucket_start) + 60_000).toISOString(), exit_reason: step.reason,
            pnl: Math.round(st.pnlRs * 100) / 100, pnl_percent: Math.round(st.netPct * 1000) / 1000, gross_pct: Math.round(st.grossPct * 1000) / 1000,
            net_pct: Math.round(st.netPct * 1000) / 1000, costs_rs: Math.round(st.costsRs * 100) / 100, stoploss: p.stop,
          }).eq('id', t.id).eq('status', 'OPEN').select('id').then((r: { data: unknown[] | null }) => { closedByUs = !(Array.isArray(r.data) && r.data.length === 0) })
          t.status = 'CLOSED'; t.pnl = st.pnlRs
          log.push(`closed ${t.symbol} ${t.direction} ${step.reason} (1-min touch) net Rs ${Math.round(st.pnlRs)}${closedByUs ? '' : ' (already closed on a tick by the laptop)'}`)
          if (closedByUs) await notify(supabase, `${st.pnlRs >= 0 ? '✅' : '🔻'} Paper ${t.direction} ${t.symbol} closed: ${({ stop: 'stop loss', breakeven: 'at buy price', lockedstop: 'raised stop', target: 'TARGET hit' } as Record<string, string>)[step.reason]} at ₹${Math.round(st.exit * 100) / 100}, net ₹${Math.round(st.pnlRs)} (paper money)`)
          return
        }
      }
    }
    // safety: if the feed stopped, close at the last known price after the square-off time
    if (nowMin >= 15 * 60 + 25 && t.status === 'OPEN') {
      const { data: last } = await supabase.from('live_candles').select('close, bucket_start').eq('symbol', t.symbol).eq('timeframe', '1min')
        .gte('bucket_start', dayStartIso).order('bucket_start', { ascending: false }).limit(1).maybeSingle()
      if (last) {
        const st = settle(p, { action: 'close', rawPx: +last.close, reason: 'squareoff', slipped: true }, +t.quantity)
        await supabase.from('simulated_trades').update({ status: 'CLOSED', exit_price: Math.round(st.exit * 100) / 100, exit_time: new Date(nowMs).toISOString(),
          exit_reason: 'squareoff', pnl: Math.round(st.pnlRs * 100) / 100, pnl_percent: Math.round(st.netPct * 1000) / 1000, gross_pct: Math.round(st.grossPct * 1000) / 1000,
          net_pct: Math.round(st.netPct * 1000) / 1000, costs_rs: Math.round(st.costsRs * 100) / 100 }).eq('id', t.id).eq('status', 'OPEN')
        t.status = 'CLOSED'; t.pnl = st.pnlRs
        log.push(`closed ${t.symbol} at last price (feed gap) net Rs ${Math.round(st.pnlRs)}`)
        return
      }
    }
    if (lastIso) {
      await supabase.from('simulated_trades').update({
        stoploss: p.stop, at_breakeven: !!p.atBreakeven, locked: !!p.locked, best_exc: p.bestExc ?? null, best_close: p.bestClose ?? null, last_bucket: lastIso,
      }).eq('id', t.id)
    }
  }
  for (const t of trades.filter((x) => x.status === 'OPEN')) await manage(t)

  // ---- 1b) learning record for every trade of today (keeps running after the trade itself closed) ----
  for (const t of trades) {
    const tr = t.details?.track as Track | undefined
    if (!tr || trackDone(tr)) continue
    const bars = await barsAfter(t, tr.cursor)
    if (!bars.length) continue
    for (const b of bars) { trackOnCandle(tr, b, +t.quantity); tr.cursor = b.startIso }
    if (nowMin >= 15 * 60 + 25 && !tr.pred.done) tr.pred.done = true
    t.details = { ...t.details, track: tr }
    await supabase.from('simulated_trades').update({ details: t.details }).eq('id', t.id)
  }

  // ---- 1c) REVERSAL WARNING (owner 21 Oct, ALERT-ONLY trial): 2+ signs on a closed 1-minute candle -> ntfy warning + record.
  //          The trade is NOT closed; after ~2 weeks we check what happened after each warning and the owner decides.
  for (const t of trades.filter((x) => x.status === 'OPEN')) {
    try {
      const { data: rows } = await supabase.from('live_candles').select('bucket_start, open, high, low, close, volume')
        .eq('symbol', t.symbol).eq('timeframe', '1min').gte('bucket_start', dayStartIso).order('bucket_start', { ascending: true }).limit(400)
      const closedBars: MinBar[] = ((rows ?? []) as Row[]).map((r) => ({ startIso: new Date(Date.parse(r.bucket_start)).toISOString(), open: +r.open, high: +r.high, low: +r.low, close: +r.close, volume: +r.volume || 0 }))
        .filter((b) => Date.parse(b.startIso) + 60_000 <= nowMs) // closed minutes only
      const rev = (t.details?.rev ?? { cursor: null, warnings: [] }) as { cursor: string | null; warnings: Record<string, unknown>[] }
      const reasonTxt = ((t.details?.reasons ?? []) as string[]).join(' ')
      const lv = reasonTxt.match(/beyond yesterday (?:high|low) ([0-9.]+)/)
      const level = lv ? +lv[1] : null
      let changed = false
      for (let i = 0; i < closedBars.length; i++) {
        const b = closedBars[i]
        if (b.startIso < new Date(Date.parse(t.entry_time)).toISOString() || (rev.cursor && b.startIso <= rev.cursor)) continue
        const r = reversalCheck(t.direction, +t.entry_price, new Date(Date.parse(t.entry_time)).toISOString(), closedBars.slice(0, i + 1), level)
        rev.cursor = b.startIso; changed = true
        if (!r.warn) continue
        const w = { at: b.startIso, price: b.close, signs: r.signs, profitPct: Math.round(r.profitPct * 100) / 100, bestPct: Math.round(r.bestPct * 100) / 100 }
        if (rev.warnings.length < 20) rev.warnings.push(w)
        await notify(supabase, `⚠️ Reversal warning (test only, trade NOT closed): paper ${t.direction} ${t.symbol} at ₹${b.close} - ${describeSigns(r.signs)}. Now ${r.profitPct >= 0 ? '+' : ''}${r.profitPct.toFixed(2)}% (best +${r.bestPct.toFixed(2)}%).`, { key: `rev-${t.id}`, everyMin: 15 })
      }
      if (changed) {
        t.details = { ...t.details, rev }
        await supabase.from('simulated_trades').update({ details: t.details }).eq('id', t.id)
      }
    } catch (e) { log.push(`reversal check failed ${t.symbol}: ${(e as Error).message}`) }
  }

  // ---- 2) open new paper trades from today's v4 signals ----
  const realised = trades.filter((t) => t.status === 'CLOSED').reduce((a, t) => a + Number(t.pnl ?? 0), 0)
  let openCount = trades.filter((t) => t.status === 'OPEN').length
  const used = new Set(trades.map((t) => t.signal_id))
  const { data: sigs } = await supabase.from('signals').select('id, symbol, signal_type, entry_price, stoploss_price, target_price, indicators, created_at')
    .gte('created_at', dayStartIso).order('created_at', { ascending: true })
  const fresh = ((sigs ?? []) as Row[]).filter((s) => s.indicators?.rules === 'v4' && !used.has(s.id))
  let opened = 0, skippedLoss = 0
  for (const s of fresh) {
    if (realised <= -PAPER.dailyLossLimitRs) { skippedLoss++; continue }
    if (openCount >= PAPER.maxOpen) break
    const k = bucketOfMs(Date.parse(s.created_at))
    if (k.day !== today || k.bucket >= PAPER.squareOff) continue
    const dir = s.signal_type as 'BUY' | 'SELL'
    // v4.1: first 1-minute candle after the signal; fall back to the 5-minute candle forming at signal time
    const minuteStartMs = Math.floor(Date.parse(s.created_at) / 60_000) * 60_000 + 60_000
    const minuteIso = new Date(minuteStartMs).toISOString()
    const { data: m1 } = await supabase.from('live_candles').select('open').eq('symbol', s.symbol).eq('timeframe', '1min').eq('bucket_start', minuteIso).maybeSingle()
    let entryStartIso: string, entryOpen: number, entryMode: '1min' | '5min'
    if (m1) { entryStartIso = minuteIso; entryOpen = +m1.open; entryMode = '1min' }
    else {
      if (nowMs - minuteStartMs < 3 * 60_000) continue // the 1-minute candle may still arrive; try again next minute
      entryStartIso = new Date(Date.parse(`${today}T${k.bucket}:00+05:30`)).toISOString()
      const { data: ec } = await supabase.from('live_candles').select('open').eq('symbol', s.symbol).eq('timeframe', '5min').eq('bucket_start', entryStartIso).maybeSingle()
      if (!ec) continue // the entry candle has no tick yet; try again next minute
      entryOpen = +ec.open; entryMode = '5min'
    }
    const fill = entryFill(dir, entryOpen)
    const stopDist = Number(s.indicators?.stop_dist ?? Math.abs(+s.entry_price - +s.stoploss_price))
    const entryR = Math.round(fill * 100) / 100
    // owner's rule: stop at the buy price from the start; the normal stop stays in initial_stop and in the learning record
    const startStop = PAPER.exitMode === 'buyPrice' ? entryR : +s.stoploss_price
    const track = newTrack(dir, entryR, +s.stoploss_price, +s.target_price, stopDist, Number(s.indicators?.atr ?? 0))
    const { data: ins, error } = await supabase.from('simulated_trades').insert({
      user_id: owner?.user_id ?? null, symbol: s.symbol, signal_id: s.id, direction: dir,
      entry_price: Math.round(fill * 100) / 100, quantity: quantityFor(fill), status: 'OPEN', entry_time: entryStartIso,
      market_condition: s.indicators?.market_breadth_pct != null ? `breadth ${Number(s.indicators.market_breadth_pct).toFixed(2)}%` : null,
      confidence_at_entry: s.indicators?.rank_score ?? null,
      rules: 'v4', stoploss: startStop, initial_stop: +s.stoploss_price, target: +s.target_price, stop_dist: stopDist, atr: Number(s.indicators?.atr ?? 0),
      at_breakeven: PAPER.exitMode === 'buyPrice',
      details: { signal_price: +s.entry_price, reasons: s.indicators?.reasons ?? [], signal_time: s.created_at, entry_mode: entryMode, version: s.indicators?.version ?? 'v4',
        exit_mode: PAPER.exitMode, track },
    }).select('*').single()
    if (error || !ins) { log.push(`open failed ${s.symbol}: ${error?.message}`); continue }
    // NOTE: the entry price is kept unrounded inside the trade logic via entry_price (2 decimals) — difference < 1 paisa.
    opened++; openCount++
    log.push(`opened ${s.symbol} ${dir} at ${ins.entry_price}`)
    await notify(supabase, `📈 Paper ${dir} ${s.symbol} at ₹${ins.entry_price} | target ₹${s.target_price} | stop ₹${startStop}${PAPER.exitMode === 'buyPrice' ? ' (buy price)' : ''}${s.indicators?.why ? `\nWhy: ${s.indicators.why}` : ''}`)
    trades.push(ins as Row)
    await manage(ins as Row) // the entry candle may already be closed
    const tr = (ins as Row).details?.track as Track | undefined
    if (tr) {
      const bars = await barsAfter(ins as Row, null)
      for (const b of bars) { trackOnCandle(tr, b, +(ins as Row).quantity); tr.cursor = b.startIso }
      if (bars.length) await supabase.from('simulated_trades').update({ details: { ...(ins as Row).details, track: tr } }).eq('id', (ins as Row).id)
    }
  }

  // ---- 3) one daily summary after 15:30 ----
  if (nowMin >= 15 * 60 + 30) {
    const { data: done } = await supabase.from('system_logs').select('id').eq('source', 'paper-trader').eq('level', 'INFO')
      .gte('created_at', dayStartIso).like('message', 'Paper day summary%').limit(1)
    if (!done?.length) {
      const r = report(trades)
      await supabase.from('system_logs').insert({ level: 'INFO', source: 'paper-trader',
        message: `Paper day summary ${today}: ${r.closedCount} trades, ${r.wins} wins, net Rs ${r.netRs}`, metadata: r })
      const reachedN = trades.filter((t) => t.details?.track?.pred?.reached).length
      await notify(supabase, `📊 Paper day ${today}: ${r.closedCount} trades, ${r.wins} wins, net ₹${r.netRs} (paper money). Target reached: ${reachedN} of ${r.closedCount}.`)
    }
  }

  return json(report(trades, { opened, skippedForDailyLoss: skippedLoss, realisedRs: Math.round(realised), log }))
})
