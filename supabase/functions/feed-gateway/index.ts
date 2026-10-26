// feed-gateway - the only door the laptop live-feed program uses.
//
// WHY: the laptop program needs (a) today's Sharekhan access token and (b) a way
// to save candles. Rather than putting your powerful database keys on a laptop,
// it holds ONE small secret (the "feed" token) that can do only these two things
// and can be revoked at any time by re-running the setup SQL.
//
// Auth: header  x-job-token: <value of internal_job_tokens row named 'feed'>
//
// Actions (POST JSON):
//   { action: 'token' }                 -> { accessToken, expiresAt, symbols: {SYMBOL: scripCode}, unresolved: [] }
//   { action: 'candles', rows: [...] }  -> { ok: true, saved: n }
//   T2 tick-level exits (owner 21 Oct): the laptop runs the exit rules on every tick; the app stays the record keeper.
//   { action: 'open_trades' }           -> { trades: [today's OPEN paper trades with their current stop/target], ntfyTopic }
//   { action: 'tick_stop', moves: [{ id, stop, atBreakeven, locked, bestExc }] } -> stop raised on the tick (never loosened)
//   { action: 'tick_close', id, reason, price, ts } -> closes the trade at that tick price (only if still OPEN)
//   { action: 'history', symbols: [<=10], interval: '1minute'|'3minute'|'5minute'|'15minute'|'30minute'|'60minute'|'daily' } -> Sharekhan's past candles (weekly pull by the laptop, 21 Oct);
//     the Sharekhan API key stays here on the server, only candles are returned
//
// The Sharekhan token is only ever returned to a caller holding the feed token,
// over HTTPS, and is never written to logs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/auth.ts'
import { loadStoredSharekhanToken, resolveScripCodes, fetchCandles, delay } from '../_shared/sharekhan.ts'
import { settle, type PaperPos } from '../_shared/paper.ts'
import { FULL_UNIVERSE as STARTER_UNIVERSE } from '../_shared/universe.ts' // 21 Oct: all ~494 stocks

const MAX_ROWS = 600
const TIMEFRAMES = new Set(['1min', '5min'])
const ALLOWED_SYMBOLS = new Set(STARTER_UNIVERSE)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const isPrice = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 10_000_000
const isCount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e12

interface CandleRow {
  symbol: string
  timeframe: string
  bucket_start: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  tick_count: number
}

function validateRow(r: any): CandleRow | null {
  if (!r || typeof r !== 'object') return null
  if (typeof r.symbol !== 'string' || !ALLOWED_SYMBOLS.has(r.symbol)) return null
  if (typeof r.timeframe !== 'string' || !TIMEFRAMES.has(r.timeframe)) return null
  if (typeof r.bucket_start !== 'string') return null
  const t = new Date(r.bucket_start).getTime()
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > 2 * 24 * 3600_000) return null
  if (![r.open, r.high, r.low, r.close].every(isPrice)) return null
  if (r.high < Math.max(r.open, r.close, r.low) || r.low > Math.min(r.open, r.close, r.high)) return null
  if (!isCount(r.volume) || !isCount(r.tick_count)) return null
  return {
    symbol: r.symbol,
    timeframe: r.timeframe,
    bucket_start: new Date(t).toISOString(),
    open: r.open, high: r.high, low: r.low, close: r.close,
    volume: Math.round(r.volume),
    tick_count: Math.round(r.tick_count),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Server is not configured' }, 500)
  const supabase = createClient(url, serviceKey)

  // ---- auth: the feed token ----
  const provided = req.headers.get('x-job-token') ?? ''
  if (provided.length < 32) return json({ error: 'Unauthorized' }, 401)
  const { data: row } = await supabase.from('internal_job_tokens').select('token').eq('name', 'feed').maybeSingle()
  const expected = (row as { token?: string } | null)?.token
  if (typeof expected !== 'string' || !timingSafeEqual(provided, expected)) return json({ error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))

  // ---- action: token ----
  if (body.action === 'token') {
    const token = await loadStoredSharekhanToken(supabase)
    if (!token) {
      return json({
        error: 'NO_VALID_SHAREKHAN_TOKEN',
        hint: 'No unexpired Sharekhan login found. Open the app, go to Settings, click Connect Sharekhan, then try again.',
      }, 409)
    }
    const { codes, unresolved } = await resolveScripCodes(supabase, STARTER_UNIVERSE)
    if (Object.keys(codes).length === 0) {
      return json({ error: 'NO_SCRIP_CODES', hint: 'The scripcodes table is empty. Run scrip-master-sync first.' }, 409)
    }
    return json({ accessToken: token.accessToken, expiresAt: token.expiresAt, symbols: codes, unresolved })
  }

  // ---- action: candles ----
  if (body.action === 'candles') {
    if (!Array.isArray(body.rows) || body.rows.length === 0) return json({ error: 'rows must be a non-empty array' }, 400)
    if (body.rows.length > MAX_ROWS) return json({ error: `max ${MAX_ROWS} rows per call` }, 400)

    const clean: CandleRow[] = []
    let rejected = 0
    for (const r of body.rows) {
      const v = validateRow(r)
      if (v) clean.push(v)
      else rejected++
    }
    if (clean.length === 0) return json({ error: 'No valid rows', rejected }, 400)

    const stamped = clean.map((c) => ({ ...c, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('live_candles').upsert(stamped, { onConflict: 'symbol,timeframe,bucket_start' })
    if (error) return json({ error: 'Database write failed', detail: error.message }, 500)
    return json({ ok: true, saved: clean.length, rejected })
  }

  // ---- T2: tick-level exits ----
  const dayStartIso = new Date(Math.floor((Date.now() + 19_800_000) / 86_400_000) * 86_400_000 - 19_800_000).toISOString()
  if (body.action === 'open_trades') {
    const { data, error } = await supabase.from('simulated_trades')
      .select('id, symbol, direction, entry_price, stoploss, target, stop_dist, atr, at_breakeven, locked, best_exc, quantity')
      .eq('rules', 'v4').eq('status', 'OPEN').gte('entry_time', dayStartIso)
    if (error) return json({ error: 'Database read failed', detail: error.message }, 500)
    const { data: ns } = await supabase.from('notify_settings').select('ntfy_topic, channel, enabled').eq('id', 1).maybeSingle()
    const topic = ns && ns.enabled !== false && (ns.channel ?? 'both') !== 'telegram' ? ns.ntfy_topic ?? null : null
    return json({ trades: (data ?? []).map((t: any) => ({ id: t.id, symbol: t.symbol, direction: t.direction, entry: +t.entry_price, stop: +t.stoploss,
      target: +t.target, stopDist: +t.stop_dist, atr: +t.atr, atBreakeven: !!t.at_breakeven, locked: !!t.locked, bestExc: t.best_exc === null ? undefined : +t.best_exc })),
      ntfyTopic: topic })
  }
  if (body.action === 'tick_stop') {
    const moves = Array.isArray(body.moves) ? body.moves.slice(0, 100) : []
    let saved = 0
    for (const m of moves) {
      if (typeof m?.id !== 'string' || !isPrice(m.stop)) continue
      const { data: t } = await supabase.from('simulated_trades').select('direction, stoploss, status').eq('id', m.id).maybeSingle()
      if (!t || t.status !== 'OPEN') continue
      const better = t.direction === 'BUY' ? m.stop > +t.stoploss : m.stop < +t.stoploss // never loosen
      if (!better) continue
      await supabase.from('simulated_trades').update({ stoploss: m.stop, at_breakeven: !!m.atBreakeven, locked: !!m.locked,
        best_exc: isCount(m.bestExc) ? m.bestExc : null }).eq('id', m.id).eq('status', 'OPEN')
      saved++
    }
    return json({ ok: true, saved })
  }
  if (body.action === 'tick_close') {
    const reasons = new Set(['stop', 'breakeven', 'lockedstop', 'target', 'squareoff'])
    if (typeof body.id !== 'string' || !reasons.has(body.reason) || !isPrice(body.price)) return json({ error: 'bad tick_close' }, 400)
    const ts = Number.isFinite(body.ts) && Math.abs(Date.now() - body.ts) < 3600_000 ? body.ts : Date.now()
    const { data: t } = await supabase.from('simulated_trades').select('*').eq('id', body.id).maybeSingle()
    if (!t) return json({ error: 'unknown trade' }, 404)
    if (t.status !== 'OPEN') return json({ ok: true, alreadyClosed: true })
    const p: PaperPos = { direction: t.direction, entry: +t.entry_price, stop: +t.stoploss, target: +t.target, stopDist: +t.stop_dist, atr: +t.atr }
    // the laptop's price already includes slippage (bid/offer +/- slippage; target = limit), so no extra slippage here
    const st = settle(p, { action: 'close', rawPx: body.price, reason: body.reason, slipped: false }, +t.quantity)
    const { data: upd } = await supabase.from('simulated_trades').update({
      status: 'CLOSED', exit_price: Math.round(st.exit * 100) / 100, exit_time: new Date(ts).toISOString(), exit_reason: body.reason,
      pnl: Math.round(st.pnlRs * 100) / 100, pnl_percent: Math.round(st.netPct * 1000) / 1000, gross_pct: Math.round(st.grossPct * 1000) / 1000,
      net_pct: Math.round(st.netPct * 1000) / 1000, costs_rs: Math.round(st.costsRs * 100) / 100,
      details: { ...(t.details ?? {}), exit_source: 'tick' },
    }).eq('id', body.id).eq('status', 'OPEN').select('id')
    return json({ ok: true, closed: (upd ?? []).length === 1, pnlRs: Math.round(st.pnlRs), netPct: Math.round(st.netPct * 1000) / 1000 })
  }

  // ---- weekly history pull by the laptop (owner 21 Oct): Sharekhan's past 1/5-minute candles, 10 stocks per call ----
  if (body.action === 'history') {
    // 26 Oct (owner 'do it'): also longer intervals - Sharekhan keeps intraday ~7 days but daily candles since listing
    const interval = ['1minute', '3minute', '5minute', '15minute', '30minute', '60minute', 'daily'].includes(body.interval) ? body.interval : '5minute'
    const symbols = [...new Set((Array.isArray(body.symbols) ? body.symbols : []).filter((x: unknown) => typeof x === 'string' && ALLOWED_SYMBOLS.has(x as string)))].slice(0, 10) as string[]
    if (!symbols.length) return json({ error: 'No valid symbols' }, 400)
    const apiKey = Deno.env.get('SHAREKHAN_API_KEY')
    if (!apiKey) return json({ error: 'SHAREKHAN_API_KEY is not configured' }, 500)
    const token = await loadStoredSharekhanToken(supabase)
    if (!token) return json({ error: 'NO_VALID_SHAREKHAN_TOKEN' }, 409)
    const { codes } = await resolveScripCodes(supabase, symbols)
    const results: Record<string, unknown> = {}
    for (const sym of symbols) {
      if (!codes[sym]) continue
      const r = await fetchCandles(codes[sym], apiKey, token.accessToken, interval)
      if (r.candles) results[sym] = { candles: r.candles.map((c) => [c.timestamp, c.open, c.high, c.low, c.close, c.volume]) }
      else { results[sym] = { error: r.error, status: r.status }; if (r.status === 401 || r.status === 403 || r.status === 429) break }
      await delay(400)
    }
    return json({ interval, fetchedAt: new Date().toISOString(), results })
  }

  return json({ error: 'Unknown action' }, 400)
})
