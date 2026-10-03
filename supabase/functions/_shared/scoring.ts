// Shared scoring logic for the scout.
//
// The POINT RULES in calculateRawScore are a faithful port of the ones in
// trading-intelligence/index.ts (same thresholds, same weights), adapted to
// the camelCase Indicators shape. That formula measures how CLEAR a setup is,
// not which way to trade — it has no BUY/SELL direction. So this file adds:
//   - decideDirection(): a simple, transparent agreement rule + a chop filter
//   - buildLevels():     ATR-based entry / stoploss / target
//
// IMPORTANT: this is a rule-based v1. It has NOT been back-tested and carries
// no evidence of profitability. Treat its output as candidates to review,
// not as proven trades.

import type { Indicators } from './indicators.ts'

// ---------- tunable constants ----------
export const STOP_ATR_MULT = 1.5      // stoploss distance = 1.5 x ATR ...
export const MIN_STOP_PCT = 0.25      // ... but never tighter than 0.25% of price
export const REWARD_RISK = 1.5        // target distance = 1.5 x stoploss distance
export const RSI_BUY_MAX = 75         // don't BUY when already overbought
export const RSI_SELL_MIN = 25        // don't SELL when already oversold
export const MIN_EFFICIENCY = 0.3     // skip choppy markets (efficiency ratio below this)

// ---------- time (IST) ----------
export function istParts(now = new Date()) {
  // IST = UTC+5:30 (no DST). Shift the clock, then read UTC fields.
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  return {
    day: ist.getUTCDay(), // 0 = Sunday ... 6 = Saturday
    hour: ist.getUTCHours() + ist.getUTCMinutes() / 60,
  }
}

export function isMarketOpenIST(now = new Date()): boolean {
  const { day, hour } = istParts(now)
  if (day === 0 || day === 6) return false // weekend (holidays are not detectable here)
  return hour >= 9.25 && hour < 15.5
}

export function getTimeMultiplier(now = new Date()): number {
  const { day, hour } = istParts(now)
  if (day === 0 || day === 6) return 0
  if (hour < 9.25 || hour >= 15.5) return 0 // closed
  if (hour < 10) return 0.7                 // opening volatility
  if (hour < 11.5) return 1.0               // morning optimal
  if (hour < 14) return 0.8                 // midday lull
  if (hour < 15) return 1.0                 // afternoon optimal
  return 0.6                                // closing hour
}

export function getMarketMultiplier(marketCondition: string): number {
  switch (marketCondition) {
    case 'TRENDING': return 1.2
    case 'RANGE': return 0.8
    case 'HIGH_VOLATILITY': return 0.6
    case 'NO_TRADE': return 0
    default: return 1.0
  }
}

// ---------- raw score (ported point rules) ----------
export function calculateRawScore(ind: Indicators): number {
  let score = 50

  // Trend strength (0-25)
  if (ind.trendStrength !== null) {
    score += Math.min(25, Math.abs(ind.trendStrength) / 4)
  }

  // RSI zones (0-15)
  if (ind.rsi !== null) {
    const r = ind.rsi
    if ((r >= 30 && r <= 40) || (r >= 60 && r <= 70)) score += 15
    else if ((r >= 25 && r <= 45) || (r >= 55 && r <= 75)) score += 10
    else if (r < 20 || r > 80) score += 5
  }

  // VWAP proximity (0-15)
  if (ind.vwap !== null && ind.lastClose !== null && ind.vwap > 0) {
    const diffPct = Math.abs(((ind.lastClose - ind.vwap) / ind.vwap) * 100)
    if (diffPct < 0.5) score += 15
    else if (diffPct < 1) score += 10
  }

  // Volume (0-15)
  if (ind.relativeVolume !== null) {
    if (ind.relativeVolume > 1.5) score += 15
    else if (ind.relativeVolume > 1.2) score += 10
    else if (ind.relativeVolume > 0.8) score += 5
  }

  // Pattern (0-10)
  if (ind.patternDetected) {
    const strong = ['HAMMER', 'BULLISH_ENGULFING', 'INVERTED_HAMMER', 'SHOOTING_STAR', 'BEARISH_ENGULFING']
    if (strong.includes(ind.patternDetected)) score += 10
    else if (ind.patternDetected === 'DOJI') score += 3
  }

  // MACD momentum (0-10)
  if (ind.macdHistogram !== null && Math.abs(ind.macdHistogram) > 0.001) {
    score += ind.macdHistogram > 0 ? 10 : 8
  }

  return Math.min(100, Math.round(score))
}

// ---------- direction ----------
export interface DirectionDecision {
  direction: 'BUY' | 'SELL' | null
  reason: string
}

export function decideDirection(ind: Indicators): DirectionDecision {
  if (ind.lastClose === null || ind.atr === null || ind.atr <= 0) {
    return { direction: null, reason: 'insufficient data (no price/ATR)' }
  }

  // Chop filter: only trade when price is actually trending, not zig-zagging.
  if (ind.efficiencyRatio !== null && ind.efficiencyRatio < MIN_EFFICIENCY) {
    return { direction: null, reason: `choppy (efficiency ${ind.efficiencyRatio} < ${MIN_EFFICIENCY})` }
  }

  // Three independent votes, each +1 (bullish) or -1 (bearish); 0 if unknown.
  // A direction needs AGREEMENT: at least two votes the same way and none against.
  const trendVote = ind.trendStrength === null ? 0 : ind.trendStrength > 0 ? 1 : -1
  // MACD *line* sign (fast EMA - slow EMA) gives trend direction. The histogram
  // (MACD vs its signal) measures acceleration, hovers near zero in steady
  // trends, and is used by the score instead — not as a direction vote.
  const macdVote = ind.macd === null ? 0 : ind.macd > 0 ? 1 : ind.macd < 0 ? -1 : 0
  const vwapVote = ind.vwap === null ? 0 : ind.lastClose > ind.vwap ? 1 : -1
  const total = trendVote + macdVote + vwapVote

  if (total >= 2) {
    if (ind.rsi !== null && ind.rsi > RSI_BUY_MAX) {
      return { direction: null, reason: `bullish but RSI ${ind.rsi} > ${RSI_BUY_MAX} (overbought)` }
    }
    return { direction: 'BUY', reason: `votes trend=${trendVote} macd=${macdVote} vwap=${vwapVote}` }
  }
  if (total <= -2) {
    if (ind.rsi !== null && ind.rsi < RSI_SELL_MIN) {
      return { direction: null, reason: `bearish but RSI ${ind.rsi} < ${RSI_SELL_MIN} (oversold)` }
    }
    return { direction: 'SELL', reason: `votes trend=${trendVote} macd=${macdVote} vwap=${vwapVote}` }
  }
  return { direction: null, reason: `no agreement (trend=${trendVote} macd=${macdVote} vwap=${vwapVote})` }
}

// ---------- levels ----------
export interface Levels {
  entry: number
  stoploss: number
  target: number
}

export function buildLevels(direction: 'BUY' | 'SELL', ind: Indicators): Levels | null {
  if (ind.lastClose === null || ind.atr === null || ind.atr <= 0) return null
  const entry = ind.lastClose
  const stopDist = Math.max(ind.atr * STOP_ATR_MULT, entry * (MIN_STOP_PCT / 100))
  const targetDist = stopDist * REWARD_RISK
  const r2 = (n: number) => Math.round(n * 100) / 100
  return direction === 'BUY'
    ? { entry: r2(entry), stoploss: r2(entry - stopDist), target: r2(entry + targetDist) }
    : { entry: r2(entry), stoploss: r2(entry + stopDist), target: r2(entry - targetDist) }
}

// ---------- human-readable analysis (shown on the Signals page) ----------
export function describeAnalysis(ind: Indicators) {
  const vwapAnalysis =
    ind.vwap === null || ind.lastClose === null
      ? 'No VWAP data available'
      : ind.lastClose > ind.vwap
        ? `Price ${ind.lastClose} above VWAP ${ind.vwap}`
        : `Price ${ind.lastClose} below VWAP ${ind.vwap}`
  const volumeAnalysis =
    ind.relativeVolume === null ? 'No volume data available' : `Volume ${ind.relativeVolume}x recent average`
  const trendAnalysis =
    ind.trendStrength === null
      ? 'No trend data available'
      : `${ind.trendStrength > 0 ? 'Uptrend' : 'Downtrend'} (strength ${Math.abs(ind.trendStrength)}/100)` +
        (ind.rsi !== null ? `, RSI ${ind.rsi}` : '')
  return {
    vwap_analysis: vwapAnalysis,
    volume_analysis: volumeAnalysis,
    trend_analysis: trendAnalysis,
    pattern_detected: ind.patternDetected ?? 'N/A',
  }
}
