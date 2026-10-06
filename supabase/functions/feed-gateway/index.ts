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
//
// The Sharekhan token is only ever returned to a caller holding the feed token,
// over HTTPS, and is never written to logs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/auth.ts'
import { loadStoredSharekhanToken, resolveScripCodes } from '../_shared/sharekhan.ts'
import { STARTER_UNIVERSE } from '../_shared/universe.ts'

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

  return json({ error: 'Unknown action' }, 400)
})
