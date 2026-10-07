// history-export: READ-ONLY download of Sharekhan's historical candles, for back-testing.
//
// Who can call it: a signed-in user (browser session JWT). Nothing is written anywhere.
// The Sharekhan token is read server-side from the database and never returned.
//
// Request  (POST JSON): { symbols?: string[] (max 10, default = first 10 of the universe),
//                         interval?: '1minute'|'3minute'|'5minute'|'15minute'|'30minute'|'60minute'|'daily' }
// Response: { interval, fetchedAt, results: { [symbol]: { candles: [[isoTime, o, h, l, c, v], ...] } | { error } }, unresolved }
//
// Sharekhan's historical endpoint takes no date range: it returns a fixed window
// (for 5-minute candles roughly the last month). One call per symbol.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAuth, corsHeaders, isValidSymbol, sanitizeSymbol } from '../_shared/auth.ts'
import { loadStoredSharekhanToken, resolveScripCodes, fetchCandles, delay } from '../_shared/sharekhan.ts'
import { STARTER_UNIVERSE } from '../_shared/universe.ts'

const MAX_SYMBOLS = 10
const CALL_DELAY_MS = 400
const INTERVALS = ['1minute', '3minute', '5minute', '15minute', '30minute', '60minute', 'daily']

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const auth = await verifyAuth(req)
  if (!auth.authenticated) return json({ error: 'Authentication required (signed-in user)' }, 401)

  const body = await req.json().catch(() => ({}))
  const interval = INTERVALS.includes(body.interval) ? body.interval : '5minute'
  const requested: string[] = Array.isArray(body.symbols) && body.symbols.length > 0
    ? (body.symbols as unknown[]).map((s) => String(s)).filter(isValidSymbol).map(sanitizeSymbol)
    : STARTER_UNIVERSE.slice(0, MAX_SYMBOLS)
  // Only stocks in our universe, so this cannot be used as a general data pump.
  const allowed = new Set(STARTER_UNIVERSE)
  const symbols = [...new Set(requested)].filter((s) => allowed.has(s)).slice(0, MAX_SYMBOLS)
  if (symbols.length === 0) return json({ error: 'No valid symbols (must be in the scout universe)' }, 400)

  const apiKey = Deno.env.get('SHAREKHAN_API_KEY')
  if (!apiKey) return json({ error: 'SHAREKHAN_API_KEY is not configured' }, 500)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = await loadStoredSharekhanToken(supabase)
  if (!token) {
    return json({ error: 'NO_VALID_SHAREKHAN_TOKEN', hint: 'Open Settings and click Connect Sharekhan, then retry.' }, 409)
  }

  const { codes, unresolved } = await resolveScripCodes(supabase, symbols)
  const results: Record<string, unknown> = {}
  for (const symbol of symbols) {
    const code = codes[symbol]
    if (!code) continue
    const r = await fetchCandles(code, apiKey, token.accessToken, interval)
    if (r.candles) {
      results[symbol] = {
        candles: r.candles.map((c) => [c.timestamp, c.open, c.high, c.low, c.close, c.volume]),
      }
    } else {
      results[symbol] = { error: r.error, status: r.status }
      if (r.status === 401 || r.status === 403 || r.status === 429) break
    }
    await delay(CALL_DELAY_MS)
  }

  return json({ interval, fetchedAt: new Date().toISOString(), results, unresolved })
})
