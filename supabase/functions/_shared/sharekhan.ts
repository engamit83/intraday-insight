// Shared Sharekhan data helpers (server-side only).
//
// WHY THIS EXISTS
//  - sharekhan-market-data fetched the user's token by calling
//    sharekhan-auth?action=get-token, but sharekhan-auth has no such handler,
//    so no backend function could ever obtain the stored token. Scheduled jobs
//    therefore had no way to authenticate to Sharekhan.
//  - A token-over-HTTP endpoint would be a security hole, so instead the token
//    is read straight from the database here, using the service-role client,
//    and never leaves the server or gets logged.
//  - update-market-data used a hardcoded scrip-code map containing duplicate
//    codes (e.g. INFY and ICICIBANK both 1594). Codes are resolved from the
//    scripcodes table (synced from Sharekhan's own master list) instead.

import CryptoJS from 'https://esm.sh/crypto-js@4.1.1'
import type { Candle } from './indicators.ts'

const SHAREKHAN_BASE_URL = 'https://api.sharekhan.com'
const NSE_CASH = 'NC'

// VERIFIED 2026-10-03 by probe against the live endpoint: Sharekhan accepts the
// word labels "1minute", "3minute", "5minute", "15minute", "30minute",
// "60minute" and "daily" (and "5Minute"). It rejects "5", "5min", "5m",
// "15min", "30min", "1hour" with HTTP 400 "Invalid Chart Period".
export const DEFAULT_INTERVAL = '5minute'

export interface StoredToken {
  accessToken: string
  userId: string
  expiresAt: string
}

// Decrypts the most recently generated, unexpired Sharekhan token.
// (Single-owner phase: signals are global, so any connected account can act
//  as the market-data source. Revisit for multi-user.)
export async function loadStoredSharekhanToken(supabase: any): Promise<StoredToken | null> {
  const key = Deno.env.get('AUTH_ENCRYPTION_KEY')
  if (!key) return null

  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id, sharekhan_access_token, sharekhan_token_expiry')
    .not('sharekhan_access_token', 'is', null)
    .gt('sharekhan_token_expiry', new Date().toISOString())
    .order('sharekhan_token_generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.sharekhan_access_token) return null

  try {
    const plain = CryptoJS.AES.decrypt(data.sharekhan_access_token, key).toString(CryptoJS.enc.Utf8)
    if (!plain) return null
    return { accessToken: plain, userId: data.user_id, expiresAt: data.sharekhan_token_expiry }
  } catch {
    return null
  }
}

// Resolve trading symbols -> Sharekhan scrip codes using the scripcodes table.
export async function resolveScripCodes(
  supabase: any,
  symbols: string[],
): Promise<{ codes: Record<string, number>; unresolved: string[] }> {
  const wanted = symbols.map((s) => s.toUpperCase())
  const candidates = [...wanted, ...wanted.map((s) => `${s}-EQ`)]

  const { data } = await supabase
    .from('scripcodes')
    .select('symbol, scrip_code')
    .eq('exchange', NSE_CASH)
    .in('symbol', candidates)

  const bySymbol: Record<string, number> = {}
  for (const row of data ?? []) bySymbol[String(row.symbol).toUpperCase()] = row.scrip_code

  const codes: Record<string, number> = {}
  const unresolved: string[] = []
  for (const s of wanted) {
    const code = bySymbol[s] ?? bySymbol[`${s}-EQ`]
    if (code) codes[s] = code
    else unresolved.push(s)
  }
  return { codes, unresolved }
}

export interface CandleFetchResult {
  candles: Candle[] | null
  status: number
  error: string | null
  sample?: string // first part of the raw response, for diagnosing format surprises
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : NaN
}


// Sharekhan candle rows look like (verified from a live response):
//   { open, high, low, close, qty, tradeTime: "09:19:52", tradeDate: "28/9/2026" }
// Date is D/M/YYYY (not zero-padded), time is HH:MM:SS in IST, volume is `qty`,
// and rows come back OLDEST-FIRST spanning many days. Other shapes are still
// accepted defensively.
function normalizeTime(t: unknown): string {
  const m = typeof t === 'string' ? t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/) : null
  if (!m) return '00:00:00'
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`
}

function buildTimestamp(r: Record<string, unknown>): string {
  const direct = r.timestamp ?? r.datetime ?? r.time
  if (typeof direct === 'string' && /^\d{4}-\d{2}-\d{2}/.test(direct)) return direct

  const d = r.tradeDate ?? r.date
  const t = r.tradeTime ?? r.time
  if (typeof d === 'string') {
    const dmy = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}T${normalizeTime(t)}+05:30`
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return `${d.slice(0, 10)}T${normalizeTime(t)}+05:30`
  }
  return ''
}

// Historical candles. Response shape is parsed defensively because it has not
// yet been verified against a live market response.
export async function fetchCandles(
  scripCode: number,
  apiKey: string,
  accessToken: string,
  interval: string = DEFAULT_INTERVAL,
): Promise<CandleFetchResult> {
  const url = `${SHAREKHAN_BASE_URL}/skapi/services/historical/${NSE_CASH}/${scripCode}/${interval}`

  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
        'access-token': accessToken,
        // Sharekhan's own SDK also sends the token as the Authorization header.
        'Authorization': accessToken,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
  } catch (e) {
    return { candles: null, status: 0, error: `network error: ${e instanceof Error ? e.message : String(e)}` }
  }

  const text = await resp.text()
  const sample = text.slice(0, 300)

  if (!resp.ok) {
    return { candles: null, status: resp.status, error: `HTTP ${resp.status}`, sample }
  }

  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    return { candles: null, status: resp.status, error: 'response was not JSON', sample }
  }

  const rows: any[] | null = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.data?.candles)
      ? json.data.candles
      : Array.isArray(json)
        ? json
        : null

  if (!rows || rows.length === 0) {
    return { candles: null, status: resp.status, error: json?.message || 'no candle rows in response', sample }
  }

  const candles: Candle[] = []
  for (const r of rows) {
    let c: Candle
    if (Array.isArray(r)) {
      // [timestamp, open, high, low, close, volume]
      c = { timestamp: String(r[0]), open: toNumber(r[1]), high: toNumber(r[2]), low: toNumber(r[3]), close: toNumber(r[4]), volume: toNumber(r[5]) }
    } else {
      c = {
        timestamp: buildTimestamp(r),
        open: toNumber(r.open),
        high: toNumber(r.high),
        low: toNumber(r.low),
        close: toNumber(r.close ?? r.ltp),
        volume: toNumber(r.qty ?? r.volume ?? r.vol ?? r.quantity ?? 0),
      }
    }
    if (c.close > 0 && c.high > 0 && c.low > 0 && !Number.isNaN(c.open)) {
      if (Number.isNaN(c.volume)) c.volume = 0
      candles.push(c)
    }
  }

  if (candles.length === 0) {
    return { candles: null, status: resp.status, error: 'rows present but none parsed as valid candles', sample }
  }

  // Without real timestamps we can't order candles, and indicators computed on
  // a wrongly-ordered series look plausible but are wrong. Fail loudly instead.
  const stamped = candles.filter((c) => c.timestamp !== '').length
  if (stamped < candles.length * 0.9) {
    return { candles: null, status: resp.status, error: 'could not parse candle timestamps', sample }
  }
  return { candles, status: resp.status, error: null, sample }
}

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
