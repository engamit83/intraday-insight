// Helpers for the scout's LIVE path: join earlier sessions' history (from
// Sharekhan's REST candles) with today's candles built from the live tick feed
// (table `live_candles`, written by the laptop feed program via feed-gateway).
//
// WHY JOIN: RSI(14), ATR(14) and MACD(12,26,9) need dozens of candles. Today's
// live candles alone would leave them blank for the first few hours. REST history
// (previous sessions) fills that. REST is NOT live during the session, so only
// candles from BEFORE today (IST) are taken from it; today comes only from the feed.
//
// Pure functions only (no network) so they can be tested offline.

import type { Candle } from './indicators.ts'

const IST_MS = 5.5 * 60 * 60 * 1000

/** 'YYYY-MM-DD' of an instant, in IST. */
export const istDateKey = (ms: number): string => new Date(ms + IST_MS).toISOString().slice(0, 10)

/** The instant of 00:00 IST on the IST day containing `ms`. */
export const istDayStartMs = (ms: number): number => Date.parse(`${istDateKey(ms)}T00:00:00+05:30`)

/** ISO string with an explicit +05:30 offset, matching what the REST candle parser produces. */
export function toIstIso(ms: number): string {
  return `${new Date(ms + IST_MS).toISOString().slice(0, 19)}+05:30`
}

export interface LiveRow {
  bucket_start: string
  open: number | string
  high: number | string
  low: number | string
  close: number | string
  volume: number | string
  updated_at?: string | null
}

export interface LiveConversion {
  candles: Candle[]
  /** Newest time the feed wrote any of these rows (ms), or null. Used for the freshness check. */
  newestWriteMs: number | null
  dropped: number
}

/** Convert rows from `live_candles` into Candles (IST timestamps, oldest-first). Invalid rows are dropped. */
export function liveRowsToCandles(rows: LiveRow[] | null | undefined): LiveConversion {
  const out: Candle[] = []
  let dropped = 0
  let newestWriteMs: number | null = null
  for (const r of rows ?? []) {
    const t = Date.parse(r.bucket_start)
    const open = Number(r.open), high = Number(r.high), low = Number(r.low), close = Number(r.close)
    const volume = Number(r.volume)
    const ok =
      Number.isFinite(t) && [open, high, low, close].every((x) => Number.isFinite(x) && x > 0) &&
      high >= low && Number.isFinite(volume) && volume >= 0
    if (!ok) { dropped++; continue }
    out.push({ timestamp: toIstIso(t), open, high, low, close, volume })
    const w = r.updated_at ? Date.parse(r.updated_at) : NaN
    if (Number.isFinite(w) && (newestWriteMs === null || w > newestWriteMs)) newestWriteMs = w
  }
  out.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  return { candles: out, newestWriteMs, dropped }
}

/** Keep only history candles from days BEFORE today (IST). Candles with unreadable timestamps are dropped. */
export function historyBeforeToday(history: Candle[], nowMs: number): Candle[] {
  const todayStart = istDayStartMs(nowMs)
  return history.filter((c) => {
    const t = Date.parse(c.timestamp)
    return Number.isFinite(t) && t < todayStart
  })
}

/** history (before today) followed by today's live candles, oldest-first. */
export function mergeHistoryAndLive(history: Candle[], live: Candle[], nowMs: number): Candle[] {
  const past = historyBeforeToday(history, nowMs).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  return [...past, ...live]
}
