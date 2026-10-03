// scout-signals — the missing "scout" step.
//
// What it does, each run:
//   1. Takes a batch of symbols (rotating through the starter universe, or an
//      explicit list for testing).
//   2. Fetches 5-minute candles from Sharekhan for each (REST, rate-limited).
//   3. Computes indicators and scores each stock with the existing point rules.
//   4. Decides BUY/SELL by a simple majority-vote rule, and builds ATR levels.
//   5. Writes the best candidates into the `signals` table (nothing in the
//      codebase did this before), keeps only the top N active, and expires
//      stale ones.
//
// Callers:
//   - Trusted internal caller (service-role key, or a scheduled job's x-job-token) -> may write signals.
//   - Any other authenticated user             -> forced to dryRun (read-only).
//
// Body (all optional):
//   dryRun     boolean  compute + return results, write nothing
//   force      boolean  run outside market hours (uses time multiplier 1.0 so
//                       scores are meaningful; for testing only)
//   symbols    string[] explicit symbols instead of the rotating batch (max 40)
//   batchSize  number   symbols per run (default 25, max 40)
//   batchIndex number   which batch of the universe (default: rotates by minute)
//   interval   string   candle interval label (default: see DEFAULT_INTERVAL)
//   probe      boolean  try many interval labels on ONE symbol and report which
//                       Sharekhan accepts (read-only; use to discover the right label)
//   minScore   number   minimum final score to become a signal (default 60)
//   maxActive  number   max simultaneously active signals (default 10)
//
// NOTE: rule-based v1, not back-tested. Candidates, not proven trades.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAuth, corsHeaders, isTrustedInternalRequest, isValidSymbol, sanitizeSymbol } from '../_shared/auth.ts'
import { computeIndicators, type Candle } from '../_shared/indicators.ts'
import {
  calculateRawScore, decideDirection, buildLevels, describeAnalysis,
  getTimeMultiplier, getMarketMultiplier, isMarketOpenIST,
} from '../_shared/scoring.ts'
import { loadStoredSharekhanToken, resolveScripCodes, fetchCandles, delay, DEFAULT_INTERVAL } from '../_shared/sharekhan.ts'
import { STARTER_UNIVERSE } from '../_shared/universe.ts'

const DEFAULT_BATCH_SIZE = 25
const MAX_BATCH_SIZE = 40
const DEFAULT_MIN_SCORE = 60
const DEFAULT_MAX_ACTIVE = 10
const SIGNAL_TTL_MINUTES = 30
const CALL_DELAY_MS = 400          // ~2 requests/second, deliberately conservative
const MAX_RUNTIME_MS = 110_000     // stop gracefully before the platform limit

// Candidate interval labels for probe mode. "daily" is the one label seen in
// Sharekhan's official SDK samples, so it doubles as a control: if it works,
// auth, endpoint and parsing are all confirmed correct.
const PROBE_INTERVALS = [
  'daily', '5minute', '5min', '5m', '5Minute', '5MIN', '05min',
  '1minute', '1min', '1m', '3minute', '15minute', '15min', '30minute', '30min',
  '60minute', '1hour',
]

interface SymbolResult {
  symbol: string
  status: 'scored' | 'skipped' | 'error'
  price?: number
  rawScore?: number
  finalScore?: number
  direction?: 'BUY' | 'SELL' | null
  reason?: string
  levels?: { entry: number; stoploss: number; target: number }
  indicators?: Record<string, unknown>
  analysis?: Record<string, unknown>
  httpStatus?: number
  sample?: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function newestFirst(candles: Candle[]): Candle[] {
  const t = candles.map((c) => new Date(c.timestamp).getTime())
  if (t.some((x) => Number.isNaN(x))) return candles // unknown format: leave as returned
  return [...candles].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // ---- auth ----
  const isService = await isTrustedInternalRequest(req)
  if (!isService) {
    const auth = await verifyAuth(req)
    if (!auth.authenticated) {
      return json({ error: 'Authentication required (service role for scheduled runs, or a signed-in user for dry runs)' }, 401)
    }
  }

  const started = Date.now()
  const body = await req.json().catch(() => ({}))
  const force = body.force === true
  // Only the trusted internal caller may write; everyone else is read-only.
  const dryRun = body.dryRun === true || !isService
  const minScore = Number.isFinite(body.minScore) ? Number(body.minScore) : DEFAULT_MIN_SCORE
  const maxActive = Number.isFinite(body.maxActive) ? Number(body.maxActive) : DEFAULT_MAX_ACTIVE
  const interval: string =
    typeof body.interval === 'string' && /^[A-Za-z0-9]{1,12}$/.test(body.interval) ? body.interval : DEFAULT_INTERVAL

  // ---- market-hours gate ----
  const marketOpen = isMarketOpenIST()
  if (!marketOpen && !force && body.probe !== true) {
    return json({ skipped: 'market_closed', note: 'Runs Mon-Fri 09:15-15:30 IST. Pass {"force":true,"dryRun":true} to test outside hours.' })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const apiKey = Deno.env.get('SHAREKHAN_API_KEY')
  if (!apiKey) return json({ error: 'SHAREKHAN_API_KEY is not configured' }, 500)

  // ---- token (read server-side from the DB; never returned or logged) ----
  const token = await loadStoredSharekhanToken(supabase)
  if (!token) {
    return json({
      error: 'NO_VALID_SHAREKHAN_TOKEN',
      hint: 'No unexpired Sharekhan token found. Open Settings and click Connect Sharekhan, then retry.',
    }, 409)
  }

  // ---- pick the symbols for this run ----
  let symbols: string[]
  let batchInfo: Record<string, unknown>
  if (Array.isArray(body.symbols) && body.symbols.length > 0) {
    symbols = [...new Set<string>((body.symbols as unknown[]).map((s) => String(s)).filter(isValidSymbol).map(sanitizeSymbol))].slice(0, MAX_BATCH_SIZE)
    batchInfo = { mode: 'explicit' }
  } else {
    const size = Math.min(MAX_BATCH_SIZE, Math.max(1, Number.isFinite(body.batchSize) ? Number(body.batchSize) : DEFAULT_BATCH_SIZE))
    const numBatches = Math.ceil(STARTER_UNIVERSE.length / size)
    const idx = Number.isFinite(body.batchIndex) ? Number(body.batchIndex) % numBatches : Math.floor(Date.now() / 60000) % numBatches
    symbols = STARTER_UNIVERSE.slice(idx * size, idx * size + size)
    batchInfo = { mode: 'rotating', batchIndex: idx, numBatches, batchSize: size, universeSize: STARTER_UNIVERSE.length }
  }
  if (symbols.length === 0) return json({ error: 'No valid symbols to scan' }, 400)

  const { codes, unresolved } = await resolveScripCodes(supabase, symbols)
  if (Object.keys(codes).length === 0) {
    return json({
      error: 'NO_SCRIP_CODES',
      hint: 'None of these symbols were found in the scripcodes table. Run scrip-master-sync first (it fills that table from Sharekhan).',
      unresolved,
    }, 409)
  }

  // ---- probe mode: discover which interval label Sharekhan accepts ----
  if (body.probe === true) {
    const probeSymbol = symbols[0]
    const probeCode = codes[probeSymbol]
    if (!probeCode) return json({ error: `No scrip code for ${probeSymbol}` }, 400)

    const probeResults: Record<string, unknown>[] = []
    let probeAbort: string | null = null
    for (const label of PROBE_INTERVALS) {
      const r = await fetchCandles(probeCode, apiKey, token.accessToken, label)
      const message = String(r.sample ?? r.error ?? '').slice(0, 220)
      probeResults.push({
        interval: label,
        httpStatus: r.status,
        candles: r.candles ? r.candles.length : 0,
        firstCandleTime: r.candles ? r.candles[0].timestamp : null,
        message,
      })
      if (r.status === 401 || r.status === 403) { probeAbort = `auth_rejected_http_${r.status}`; break }
      if (r.status === 429) { probeAbort = 'rate_limited_http_429'; break }
      await delay(CALL_DELAY_MS)
    }
    const likelyValid = probeResults
      .filter((x) => !/Invalid Chart Period/i.test(String(x.message)) && x.httpStatus !== 0)
      .map((x) => x.interval)
    return json({ probe: true, symbol: probeSymbol, probeAbort, likelyValid, results: probeResults })
  }

  // ---- market condition (latest row, if fresh) ----
  const { data: mc } = await supabase
    .from('market_conditions').select('condition, created_at, expires_at')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const mcFresh = mc && (mc.expires_at
    ? new Date(mc.expires_at) > new Date()
    : Date.now() - new Date(mc.created_at).getTime() < 30 * 60_000)
  const marketCondition: string = mcFresh ? mc!.condition : 'UNKNOWN'
  const marketMult = getMarketMultiplier(marketCondition)
  // When forced outside hours, use 1.0 so a test run shows meaningful scores.
  const timeMult = !marketOpen && force ? 1.0 : getTimeMultiplier()

  // ---- scan ----
  const results: SymbolResult[] = []
  let abortReason: string | null = null

  for (const symbol of symbols) {
    if (Date.now() - started > MAX_RUNTIME_MS) { abortReason = 'time_budget_reached'; break }
    const code = codes[symbol]
    if (!code) { results.push({ symbol, status: 'skipped', reason: 'unresolved scrip code' }); continue }

    const fetched = await fetchCandles(code, apiKey, token.accessToken, interval)
    if (fetched.status === 401 || fetched.status === 403) {
      abortReason = `auth_rejected_http_${fetched.status}: reconnect Sharekhan in Settings`
      results.push({ symbol, status: 'error', reason: fetched.error ?? 'auth', httpStatus: fetched.status, sample: fetched.sample })
      break
    }
    if (fetched.status === 429) {
      abortReason = 'rate_limited_http_429: slow down / reduce batch size'
      results.push({ symbol, status: 'error', reason: 'rate limited', httpStatus: 429 })
      break
    }
    if (!fetched.candles) {
      results.push({ symbol, status: 'error', reason: fetched.error ?? 'no data', httpStatus: fetched.status, sample: fetched.sample })
      await delay(CALL_DELAY_MS)
      continue
    }

    const candles = newestFirst(fetched.candles)
    const ind = computeIndicators(candles)
    const rawScore = calculateRawScore(ind)
    const finalScore = Math.round(rawScore * marketMult * timeMult)
    const dir = decideDirection(ind)
    const levels = dir.direction ? buildLevels(dir.direction, ind) : null

    results.push({
      symbol, status: 'scored', price: ind.lastClose ?? undefined, rawScore, finalScore,
      direction: dir.direction, reason: dir.reason, levels: levels ?? undefined,
      indicators: { rsi: ind.rsi, vwap: ind.vwap, atr: ind.atr, macdHistogram: ind.macdHistogram, relativeVolume: ind.relativeVolume, trendStrength: ind.trendStrength, efficiency: ind.efficiencyRatio, pattern: ind.patternDetected },
      analysis: describeAnalysis(ind),
    })

    if (!dryRun && ind.lastClose) {
      await supabase.from('stocks').upsert({ symbol, last_price: ind.lastClose, updated_at: new Date().toISOString() }, { onConflict: 'symbol' })
      await supabase.from('indicator_cache').upsert({
        symbol, timeframe: '5min', vwap: ind.vwap, rsi: ind.rsi, macd: ind.macd, macd_signal: ind.macdSignal,
        macd_histogram: ind.macdHistogram, atr: ind.atr, relative_volume: ind.relativeVolume,
        trend_strength: ind.trendStrength, pattern_detected: ind.patternDetected,
        raw_data: candles.slice(0, 40), computed_at: new Date().toISOString(),
      }, { onConflict: 'symbol,timeframe' })
    }
    await delay(CALL_DELAY_MS)
  }

  // ---- choose the best ----
  const scored = results.filter((r) => r.status === 'scored')
  const selected = scored
    .filter((r) => r.direction && r.levels && (r.finalScore ?? 0) >= minScore && marketMult > 0 && timeMult > 0)
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))

  const written = { inserted: 0, updated: 0, deactivated: 0, expired: 0, capped: 0 }

  if (!dryRun) {
    const nowIso = new Date().toISOString()
    const expiresAt = new Date(Date.now() + SIGNAL_TTL_MINUTES * 60_000).toISOString()

    const scannedSymbols = scored.map((r) => r.symbol)
    const { data: activeRows } = await supabase
      .from('signals').select('id, symbol, signal_type')
      .eq('is_active', true).in('symbol', scannedSymbols.length ? scannedSymbols : ['__none__'])
    const activeBySymbol = new Map<string, { id: string; signal_type: string }[]>()
    for (const row of activeRows ?? []) {
      const list = activeBySymbol.get(row.symbol) ?? []
      list.push({ id: row.id, signal_type: row.signal_type })
      activeBySymbol.set(row.symbol, list)
    }

    for (const r of selected) {
      const existing = activeBySymbol.get(r.symbol) ?? []
      const sameDir = existing.filter((e) => e.signal_type === r.direction)
      const otherDir = existing.filter((e) => e.signal_type !== r.direction)
      const indicatorsJson = { ...r.analysis, numeric: r.indicators, direction_reason: r.reason, source: 'scout-v1' }

      if (otherDir.length) {
        await supabase.from('signals').update({ is_active: false, rejection_reason: 'direction flipped' }).in('id', otherDir.map((e) => e.id))
        written.deactivated += otherDir.length
      }

      if (sameDir.length) {
        // Keep entry/target/stoploss/expiry stable for the user; refresh the scores only.
        await supabase.from('signals').update({
          raw_score: r.rawScore, final_score: r.finalScore, confidence: r.finalScore,
          market_condition: marketCondition, is_tradable: true, indicators: indicatorsJson,
        }).eq('id', sameDir[0].id)
        written.updated += 1
      } else {
        const { error } = await supabase.from('signals').insert({
          symbol: r.symbol, signal_type: r.direction, entry_price: r.levels!.entry,
          target_price: r.levels!.target, stoploss_price: r.levels!.stoploss,
          confidence: r.finalScore, timeframe: '5min', indicators: indicatorsJson,
          is_active: true, expires_at: expiresAt, raw_score: r.rawScore, final_score: r.finalScore,
          market_condition: marketCondition, is_tradable: true, rejection_reason: null,
        })
        if (!error) written.inserted += 1
      }
    }

    // Lapse setups that clearly no longer qualify (hysteresis avoids flapping).
    const selectedSet = new Set(selected.map((r) => r.symbol))
    for (const r of scored) {
      if (selectedSet.has(r.symbol)) continue
      const lapsed = r.direction === null || (r.finalScore ?? 0) < minScore - 10
      const existing = activeBySymbol.get(r.symbol) ?? []
      if (lapsed && existing.length) {
        await supabase.from('signals').update({ is_active: false, rejection_reason: 'setup no longer qualifies' }).in('id', existing.map((e) => e.id))
        written.deactivated += existing.length
      }
    }

    // Expire old signals.
    const { data: expiredRows } = await supabase.from('signals')
      .update({ is_active: false, rejection_reason: 'expired' })
      .eq('is_active', true).lt('expires_at', nowIso).select('id')
    written.expired = expiredRows?.length ?? 0

    // Keep only the top `maxActive` by score.
    const { data: allActive } = await supabase.from('signals')
      .select('id, final_score').eq('is_active', true).order('final_score', { ascending: false })
    if (allActive && allActive.length > maxActive) {
      const drop = allActive.slice(maxActive).map((s: { id: string }) => s.id)
      await supabase.from('signals').update({ is_active: false, rejection_reason: 'outranked' }).in('id', drop)
      written.capped = drop.length
    }
  }

  const summary = {
    ok: true,
    dryRun,
    forced: force && !marketOpen,
    marketOpen,
    marketCondition,
    multipliers: { market: marketMult, time: timeMult },
    batch: batchInfo,
    interval,
    scanned: symbols.length,
    scored: scored.length,
    errors: results.filter((r) => r.status === 'error').length,
    unresolved,
    abortReason,
    minScore,
    qualified: selected.length,
    written,
    durationMs: Date.now() - started,
    top: selected.slice(0, 10).map((r) => ({ symbol: r.symbol, direction: r.direction, finalScore: r.finalScore, ...r.levels })),
    results: results.map((r) => ({
      symbol: r.symbol, status: r.status, direction: r.direction, rawScore: r.rawScore, finalScore: r.finalScore,
      price: r.price, reason: r.reason, httpStatus: r.httpStatus, sample: r.status === 'error' ? r.sample : undefined,
    })),
  }

  await supabase.from('system_logs').insert({
    level: abortReason ? 'WARN' : 'INFO',
    source: 'scout-signals',
    message: `Scout run: scanned ${summary.scanned}, scored ${summary.scored}, qualified ${summary.qualified}${dryRun ? ' (dry run)' : ''}`,
    metadata: { batch: batchInfo, written, errors: summary.errors, unresolved, abortReason, marketCondition, durationMs: summary.durationMs },
  })

  return json(summary)
})
