// Paper-trade management — the SAME exit rules as the back-tester (tools/backtest/backtest.mjs, rule set v4):
// initial stop / target, breakeven at +1R, profit lock (+1R -> no-loss, +1.5R -> +0.75R), trailing stop
// 1.5 x ATR from the best close (v4.1: only once the trade has gained +1R), square-off at the 15:15 candle's open. Applied once per CLOSED 5-minute candle.
// Pure functions only (no network) so they can be tested offline.

export const PAPER = {
  notionalRs: 100_000,      // rupees per paper trade (same as the back-test)
  slippagePct: 0.02,        // per side, on market fills (entry, stop, square-off)
  brokeragePct: 0.03,       // per side (owner confirmed 8 Oct)
  sttSellPct: 0.025, exchangePct: 0.00307, sebiPct: 0.0001, stampBuyPct: 0.003, gstPct: 18,
  breakevenAtR: 1, lockAtR: 1, lock2AtR: 1.5, lock2KeepR: 0.75, trailAtrMult: 1.5,
  trailAfterR: 1,           // v4.1 (16 Oct): the trailing stop starts only after +1R (an earlier trail choked trades)
  squareOff: '15:15', maxOpen: 10, dailyLossLimitRs: 2000,
}

export function roundTripCostPct(): number {
  const b = 2 * PAPER.brokeragePct, e = 2 * PAPER.exchangePct, s = 2 * PAPER.sebiPct
  return b + e + s + (b + e + s) * (PAPER.gstPct / 100) + PAPER.sttSellPct + PAPER.stampBuyPct
}

export interface PaperPos {
  direction: 'BUY' | 'SELL'
  entry: number          // filled entry price (incl. slippage)
  stop: number
  target: number
  stopDist: number       // distance from the SIGNAL price to the initial stop
  atr: number
  atBreakeven?: boolean
  locked?: boolean
  bestExc?: number
  bestClose?: number
}
export interface Bar { bucket: string; open: number; high: number; low: number; close: number } // bucket = 'HH:MM' IST candle start

export type Step =
  | { action: 'hold' }
  | { action: 'close'; rawPx: number; reason: 'stop' | 'breakeven' | 'lockedstop' | 'target' | 'squareoff'; slipped: boolean }

/** Fill price for an entry at a candle's open. */
export function entryFill(direction: 'BUY' | 'SELL', open: number): number {
  const slip = open * (PAPER.slippagePct / 100)
  return direction === 'BUY' ? open + slip : open - slip
}

/** Apply one closed candle to an open position. Mutates p (stop / flags) when it holds. */
export function manageOnCandle(p: PaperPos, c: Bar): Step {
  const B = p.direction === 'BUY'
  if (c.bucket >= PAPER.squareOff) return { action: 'close', rawPx: c.open, reason: 'squareoff', slipped: true }
  const hitStop = B ? c.low <= p.stop : c.high >= p.stop
  const hitTarget = B ? c.high >= p.target : c.low <= p.target
  if (hitStop) {
    const px = B ? Math.min(c.open, p.stop) : Math.max(c.open, p.stop) // a gap through the stop fills at the open
    return { action: 'close', rawPx: px, reason: p.locked ? 'lockedstop' : p.atBreakeven ? 'breakeven' : 'stop', slipped: true }
  }
  if (hitTarget) return { action: 'close', rawPx: p.target, reason: 'target', slipped: false }
  const better = (a: number, b: number) => (B ? Math.max(a, b) : Math.min(a, b))
  if (!p.atBreakeven) {
    const gain = B ? c.high - p.entry : p.entry - c.low
    if (gain >= PAPER.breakevenAtR * p.stopDist) { p.stop = better(p.stop, p.entry); p.atBreakeven = true }
  }
  p.bestExc = Math.max(p.bestExc ?? 0, B ? c.high - p.entry : p.entry - c.low)
  p.bestClose = p.bestClose === undefined ? c.close : B ? Math.max(p.bestClose, c.close) : Math.min(p.bestClose, c.close)
  const r = p.bestExc / p.stopDist
  const noLoss = p.entry * (roundTripCostPct() / 100 + 2 * PAPER.slippagePct / 100)
  if (r >= PAPER.lock2AtR) { p.stop = better(p.stop, B ? p.entry + PAPER.lock2KeepR * p.stopDist : p.entry - PAPER.lock2KeepR * p.stopDist); p.locked = true }
  else if (r >= PAPER.lockAtR) { p.stop = better(p.stop, B ? p.entry + noLoss : p.entry - noLoss); p.locked = true }
  if (p.atr && p.bestExc >= PAPER.trailAfterR * p.stopDist) {
    const trail = B ? p.bestClose - PAPER.trailAtrMult * p.atr : p.bestClose + PAPER.trailAtrMult * p.atr
    const before = p.stop
    p.stop = better(p.stop, trail)
    if (p.stop !== before && (B ? p.stop > p.entry : p.stop < p.entry)) p.locked = true
  }
  return { action: 'hold' }
}

/** Exit price after slippage, and P&L. */
export function settle(p: PaperPos, step: Extract<Step, { action: 'close' }>, quantity: number) {
  const slip = step.slipped ? step.rawPx * (PAPER.slippagePct / 100) : 0
  const exit = p.direction === 'BUY' ? step.rawPx - slip : step.rawPx + slip
  const grossPct = p.direction === 'BUY' ? (exit / p.entry - 1) * 100 : (1 - exit / p.entry) * 100
  const netPct = grossPct - roundTripCostPct()
  const value = p.entry * quantity
  return { exit, grossPct, netPct, pnlRs: (netPct / 100) * value, costsRs: (roundTripCostPct() / 100) * value }
}

export const quantityFor = (entry: number) => Math.max(1, Math.floor(PAPER.notionalRs / entry))
