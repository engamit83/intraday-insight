// Shared technical indicator calculations.
//
// Replaces the inline computeIndicators() that lived in update-market-data,
// which had these verified bugs:
//   1. RSI and ATR were computed from the OLDEST 15 candles in the window,
//      not the most recent ones (data was sorted newest-first, then reversed,
//      then only indexes 0..14 were read).
//   2. MACD / signal / histogram were hardcoded to null, so the MACD part of
//      the score could never fire.
//   3. trendStrength was `|change| * 200` where change is a FRACTION, so a 1%
//      move produced 2 on a 0-100 scale and the trend score was ~0.
//
// Input candles may be in any order; they are sorted internally.

export interface Candle {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Indicators {
  vwap: number | null
  rsi: number | null
  macd: number | null
  macdSignal: number | null
  macdHistogram: number | null
  atr: number | null
  relativeVolume: number | null
  trendStrength: number | null // signed: + above SMA20 (up), - below (down); 0..100 magnitude
  patternDetected: string | null
  // Kaufman efficiency ratio over the last 10 candles: net move / total path.
  // ~1 = clean trend, ~0 = choppy back-and-forth.
  efficiencyRatio: number | null
  lastClose: number | null
}

const round = (n: number, d = 2) => {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

function ema(values: number[], period: number): number[] {
  // Standard EMA seeded with the SMA of the first `period` values.
  // Returns an array aligned to `values`; indexes before period-1 are NaN.
  const out: number[] = new Array(values.length).fill(NaN)
  if (values.length < period) return out
  const k = 2 / (period + 1)
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

function sortAscending(candles: Candle[]): Candle[] {
  const parsed = candles.map((c, i) => ({ c, i, t: new Date(c.timestamp).getTime() }))
  const allValid = parsed.every((p) => !Number.isNaN(p.t))
  if (!allValid) {
    // Unknown timestamp format: assume input is newest-first (as the API
    // layer returns it) and flip to oldest-first.
    return [...candles].reverse()
  }
  return parsed.sort((a, b) => a.t - b.t || a.i - b.i).map((p) => p.c)
}

export function computeIndicators(candles: Candle[]): Indicators {
  const empty: Indicators = {
    vwap: null, rsi: null, macd: null, macdSignal: null, macdHistogram: null,
    atr: null, relativeVolume: null, trendStrength: null, patternDetected: null,
    efficiencyRatio: null, lastClose: null,
  }
  if (!candles || candles.length === 0) return empty

  const asc = sortAscending(candles)
  const closes = asc.map((c) => c.close)
  const last = asc[asc.length - 1]
  const prev = asc.length >= 2 ? asc[asc.length - 2] : null

  // ---- VWAP (anchored to the latest session day when timestamps allow) ----
  const dayOf = (ts: string) => (/^\d{4}-\d{2}-\d{2}/.test(ts) ? ts.slice(0, 10) : '')
  const lastDay = dayOf(last.timestamp)
  const session = lastDay ? asc.filter((c) => dayOf(c.timestamp) === lastDay) : asc
  let tpv = 0, vol = 0
  for (const c of session) {
    tpv += ((c.high + c.low + c.close) / 3) * c.volume
    vol += c.volume
  }
  const vwap = vol > 0 ? round(tpv / vol) : null

  // ---- RSI (Wilder, 14) on the most recent data ----
  let rsi: number | null = null
  if (closes.length >= 15) {
    let gain = 0, loss = 0
    for (let i = 1; i <= 14; i++) {
      const d = closes[i] - closes[i - 1]
      if (d > 0) gain += d; else loss -= d
    }
    let avgGain = gain / 14, avgLoss = loss / 14
    for (let i = 15; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1]
      avgGain = (avgGain * 13 + (d > 0 ? d : 0)) / 14
      avgLoss = (avgLoss * 13 + (d < 0 ? -d : 0)) / 14
    }
    rsi = avgLoss === 0 ? 100 : round(100 - 100 / (1 + avgGain / avgLoss))
  }

  // ---- ATR (Wilder, 14) on the most recent data ----
  let atr: number | null = null
  if (asc.length >= 15) {
    const trs: number[] = []
    for (let i = 1; i < asc.length; i++) {
      const c = asc[i], p = asc[i - 1]
      trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
    }
    let a = trs.slice(0, 14).reduce((x, y) => x + y, 0) / 14
    for (let i = 14; i < trs.length; i++) a = (a * 13 + trs[i]) / 14
    atr = round(a, 4)
  }

  // ---- MACD (12, 26, 9) ----
  let macd: number | null = null, macdSignal: number | null = null, macdHistogram: number | null = null
  if (closes.length >= 35) {
    const e12 = ema(closes, 12)
    const e26 = ema(closes, 26)
    const macdLine: number[] = []
    for (let i = 0; i < closes.length; i++) {
      if (!Number.isNaN(e12[i]) && !Number.isNaN(e26[i])) macdLine.push(e12[i] - e26[i])
    }
    const sig = ema(macdLine, 9)
    const m = macdLine[macdLine.length - 1]
    const s = sig[sig.length - 1]
    if (!Number.isNaN(m) && !Number.isNaN(s)) {
      macd = round(m, 4)
      macdSignal = round(s, 4)
      macdHistogram = round(m - s, 4)
    }
  }

  // ---- Relative volume: last 2 candles vs the 20 before them ----
  // (Using 2 candles instead of 1 so a still-forming latest candle doesn't
  //  make volume look artificially low.)
  let relativeVolume: number | null = null
  if (asc.length >= 22) {
    const recent = asc.slice(-2).reduce((a, c) => a + c.volume, 0) / 2
    const base = asc.slice(-22, -2).reduce((a, c) => a + c.volume, 0) / 20
    if (base > 0) relativeVolume = round(recent / base)
  }

  // ---- Trend strength: signed, 0..100 ----
  // Magnitude = % change over the last 10 candles * 100 (a 1% move = 100).
  // Sign = price above (+) or below (-) its 20-candle SMA.
  let trendStrength: number | null = null
  if (closes.length >= 20) {
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
    const curr = closes[closes.length - 1]
    const ref = closes[closes.length - 10]
    const pct = ref > 0 ? ((curr - ref) / ref) * 100 : 0
    trendStrength = round(Math.min(100, Math.abs(pct) * 100) * (curr >= sma20 ? 1 : -1))
  }

  // ---- Efficiency ratio (noise filter) ----
  let efficiencyRatio: number | null = null
  if (closes.length >= 11) {
    const w = closes.slice(-11)
    let path = 0
    for (let i = 1; i < w.length; i++) path += Math.abs(w[i] - w[i - 1])
    efficiencyRatio = path > 0 ? round(Math.abs(w[w.length - 1] - w[0]) / path) : 0
  }

  // ---- Candlestick pattern on the latest candle(s) ----
  let patternDetected: string | null = null
  if (prev) {
    const body = Math.abs(last.close - last.open)
    const range = last.high - last.low
    const upper = last.high - Math.max(last.open, last.close)
    const lower = Math.min(last.open, last.close) - last.low
    if (lower >= body * 2 && upper <= body * 0.5 && last.close > last.open) patternDetected = 'HAMMER'
    else if (upper >= body * 2 && lower <= body * 0.5 && last.close < last.open) patternDetected = 'SHOOTING_STAR'
    else if (prev.close < prev.open && last.close > last.open && last.open < prev.close && last.close > prev.open) patternDetected = 'BULLISH_ENGULFING'
    else if (prev.close > prev.open && last.close < last.open && last.open > prev.close && last.close < prev.open) patternDetected = 'BEARISH_ENGULFING'
    else if (range > 0 && body <= range * 0.1) patternDetected = 'DOJI'
  }

  return {
    vwap, rsi, macd, macdSignal, macdHistogram, atr,
    relativeVolume, trendStrength, patternDetected, efficiencyRatio,
    lastClose: last.close,
  }
}
