// reversal.ts - REVERSAL WARNING (owner 21 Oct, ALERT-ONLY trial): while a paper trade runs, watch for signs the stock is turning
// against us. When 2 or more signs appear on the same closed 1-minute candle, send an ntfy "⚠️ reversal warning" and record it.
// The trade is NOT closed (trial ~2 weeks); afterwards we check what happened after each warning, then the owner decides.
// Pure function (no network) so it can be tested offline.

export interface MinBar { startIso: string; open: number; high: number; low: number; close: number; volume: number }
export interface RevSigns { bigCandleAgainst: boolean; vwapLost: boolean; gaveBackHalf: boolean; levelLost: boolean }
export interface RevResult { signs: RevSigns; count: number; warn: boolean; profitPct: number; bestPct: number; vwap: number | null }

export const REVERSAL = {
  minSigns: 2,
  bigCandlePct: 0.4,      // 1-minute candle moving >= 0.4% against us ...
  bigCandleVolX: 2,       // ... on >= 2x today's average 1-minute volume
  armedAtPct: 0.5,        // VWAP / give-back signs only count once the trade has been >= +0.5% in profit
  giveBackFrac: 0.5,      // gave back >= half of the best profit
}

/**
 * dayBars: today's 1-minute candles of the stock from 09:15 (ascending), last one = the candle just closed.
 * entryIso: when the trade started (best profit is measured from there). level: the breakout level (yesterday's high for BUY / low for SELL).
 */
export function reversalCheck(direction: 'BUY' | 'SELL', entry: number, entryIso: string, dayBars: MinBar[], level: number | null): RevResult {
  const B = direction === 'BUY'
  const last = dayBars[dayBars.length - 1]
  const empty = { bigCandleAgainst: false, vwapLost: false, gaveBackHalf: false, levelLost: false }
  if (!last) return { signs: empty, count: 0, warn: false, profitPct: 0, bestPct: 0, vwap: null }
  let pv = 0, v = 0, volSum = 0, n = 0, best = 0
  for (const b of dayBars) {
    pv += ((b.high + b.low + b.close) / 3) * b.volume; v += b.volume
    volSum += b.volume; n++
    if (b.startIso >= entryIso) best = Math.max(best, B ? (b.high / entry - 1) * 100 : (1 - b.low / entry) * 100)
  }
  const vwap = v > 0 ? pv / v : null
  const avgVol = n ? volSum / n : 0
  const profitPct = B ? (last.close / entry - 1) * 100 : (1 - last.close / entry) * 100
  const movePct = ((last.close - last.open) / last.open) * 100 * (B ? -1 : 1) // positive = against us
  const signs: RevSigns = {
    bigCandleAgainst: movePct >= REVERSAL.bigCandlePct && avgVol > 0 && last.volume >= REVERSAL.bigCandleVolX * avgVol,
    vwapLost: best >= REVERSAL.armedAtPct && vwap !== null && (B ? last.close < vwap : last.close > vwap),
    gaveBackHalf: best >= REVERSAL.armedAtPct && profitPct <= best * (1 - REVERSAL.giveBackFrac),
    levelLost: level !== null && (B ? last.close < level : last.close > level),
  }
  const count = Object.values(signs).filter(Boolean).length
  return { signs, count, warn: count >= REVERSAL.minSigns, profitPct, bestPct: best, vwap }
}

export const describeSigns = (s: RevSigns): string => [
  s.bigCandleAgainst && 'big candle against us on heavy volume',
  s.vwapLost && 'price fell back through VWAP',
  s.gaveBackHalf && 'gave back half of the profit',
  s.levelLost && 'lost the breakout level',
].filter(Boolean).join(', ')
