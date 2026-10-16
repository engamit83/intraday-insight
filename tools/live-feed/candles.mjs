// candles.mjs - turns live price ticks into 1-minute and 5-minute candles.
//
// - Only ticks inside NSE market hours (09:15:00 - 15:29:59 IST) are used, so
//   pre-open and closing-session prices never pollute the candles.
// - A candle's timestamp is the START of its minute / 5-minute window.
// - 5-minute candles are built from the 1-minute candles, so the two always agree.

export const IST_OFFSET_MS = 330 * 60_000
const MIN = 60_000
const FIVE_MIN = 5 * MIN

export function istMinuteOfDay(ms) {
  const d = new Date(ms + IST_OFFSET_MS)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export function inMarketHours(ms) {
  const m = istMinuteOfDay(ms)
  return m >= 9 * 60 + 15 && m < 15 * 60 + 30
}

const round4 = (x) => Math.round(x * 10000) / 10000

export class CandleBuilder {
  // opts.ignoreMarketHours is for offline tests only.
  constructor(opts = {}) {
    this.ignoreMarketHours = opts.ignoreMarketHours === true
    this.minutes = new Map()   // symbol -> Map(bucketStartMs -> candle)
    this.dirty = new Set()     // "symbol|bucketStartMs" keys not yet saved
    this.lastCumulative = new Map()
    this.accepted = 0
    this.rejected = 0
  }

  // tick: { symbol, price, ts, volume?, cumulativeVolume? }
  //   volume            = quantity traded in this one tick (added up)
  //   cumulativeVolume  = day's running total (we take the difference between ticks)
  addTick(tick) {
    const { symbol, price, ts } = tick
    if (!symbol || !(price > 0) || !Number.isFinite(ts)) { this.rejected++; return false }
    if (!this.ignoreMarketHours && !inMarketHours(ts)) { this.rejected++; return false }

    let vol = Number.isFinite(tick.volume) && tick.volume > 0 ? tick.volume : 0
    if (Number.isFinite(tick.cumulativeVolume)) {
      const prev = this.lastCumulative.get(symbol)
      vol = prev == null ? 0 : Math.max(0, tick.cumulativeVolume - prev)
      this.lastCumulative.set(symbol, tick.cumulativeVolume)
    }

    const start = Math.floor(ts / MIN) * MIN
    let bySymbol = this.minutes.get(symbol)
    if (!bySymbol) { bySymbol = new Map(); this.minutes.set(symbol, bySymbol) }

    let c = bySymbol.get(start)
    if (!c) {
      c = { open: price, high: price, low: price, close: price, volume: 0, ticks: 0, v: 0 }
      bySymbol.set(start, c)
    }
    if (price > c.high) c.high = price
    if (price < c.low) c.low = price
    c.close = price
    c.volume += vol
    c.ticks += 1
    c.v += 1

    this.dirty.add(`${symbol}|${start}`)
    this.accepted++
    return true
  }

  // Build a 5-minute candle from the 1-minute candles inside its window.
  fiveMinute(symbol, windowStart) {
    const bySymbol = this.minutes.get(symbol)
    if (!bySymbol) return null
    let out = null
    for (let t = windowStart; t < windowStart + FIVE_MIN; t += MIN) {
      const c = bySymbol.get(t)
      if (!c) continue
      if (!out) out = { open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, ticks: c.ticks }
      else {
        out.high = Math.max(out.high, c.high)
        out.low = Math.min(out.low, c.low)
        out.close = c.close
        out.volume += c.volume
        out.ticks += c.ticks
      }
    }
    return out
  }

  // Returns { rows, pending }. Send `rows`; once they are saved, call commit(pending).
  collectDirty() {
    const rows = []
    const pending = []
    const windows = new Set()

    for (const key of this.dirty) {
      const [symbol, startStr] = key.split('|')
      const start = Number(startStr)
      const c = this.minutes.get(symbol)?.get(start)
      if (!c) continue
      pending.push({ key, v: c.v })
      rows.push(toRow(symbol, '1min', start, c))
      windows.add(`${symbol}|${Math.floor(start / FIVE_MIN) * FIVE_MIN}`)
    }
    for (const w of windows) {
      const [symbol, startStr] = w.split('|')
      const start = Number(startStr)
      const c = this.fiveMinute(symbol, start)
      if (c) rows.push(toRow(symbol, '5min', start, c))
    }
    return { rows, pending }
  }

  // Mark rows as saved - but only if no newer tick arrived while they were being sent.
  commit(pending) {
    for (const { key, v } of pending) {
      const [symbol, startStr] = key.split('|')
      const c = this.minutes.get(symbol)?.get(Number(startStr))
      if (c && c.v === v) this.dirty.delete(key)
    }
  }

  symbolsSeen() {
    return this.minutes.size
  }
}

function toRow(symbol, timeframe, startMs, c) {
  return {
    symbol,
    timeframe,
    bucket_start: new Date(startMs).toISOString(),
    open: round4(c.open),
    high: round4(c.high),
    low: round4(c.low),
    close: round4(c.close),
    volume: Math.round(c.volume),
    tick_count: c.ticks,
  }
}
