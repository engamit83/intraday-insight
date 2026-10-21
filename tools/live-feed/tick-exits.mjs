// tick-exits.mjs - T2 (owner 21 Oct: "everything at tick level"): the paper EXIT rules applied on EVERY live tick.
// Same rules as supabase/functions/_shared/paper.ts (stop, target, no-loss at +1R, profit lock +1R/+1.5R, trailing 1.5 x ATR
// after +1R, close at 15:15) - but checked on each tick instead of each 5-minute candle, and filled at the REAL price of that
// moment: a BUY is sold at the best bid, a SELL is bought back at the best offer (if the tick has no bid/offer, the last price),
// plus slippage. The app (cloud) stays the boss: it hands over the open trades and records every close; this module only decides
// the exact moment and price. Pure logic, no network (so it can be tested offline).

export const TICK_RULES = {
  breakevenAtR: 1, lockAtR: 1, lock2AtR: 1.5, lock2KeepR: 0.75, trailAtrMult: 1.5, trailAfterR: 1,
  slippagePct: 0.02, squareOff: '15:15', costPct: 0.10628, // round trip, same as paper.ts roundTripCostPct() (test checks they match)
}

const istHHMM = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 16)

export class TickExitEngine {
  constructor(rules = TICK_RULES) { this.r = rules; this.trades = new Map() } // id -> trade state

  /** trades: [{ id, symbol, direction, entry, stop, target, stopDist, atr, atBreakeven, locked, bestExc, bestPx }] from the app */
  setTrades(list) {
    const keep = new Map()
    for (const t of list) keep.set(t.id, { ...t, ...(this.trades.get(t.id) ?? {}), stop: this.better(t, this.trades.get(t.id)?.stop, t.stop) })
    this.trades = keep
  }
  better(t, a, b) { if (a === undefined) return b; return t.direction === 'BUY' ? Math.max(a, b) : Math.min(a, b) }

  /** one live tick -> list of events: { kind: 'close'|'stopMoved', id, symbol, reason, price, ... } */
  onTick(symbol, tick, ts) {
    const out = []
    for (const t of this.trades.values()) {
      if (t.symbol !== symbol || t.closed) continue
      const B = t.direction === 'BUY'
      const last = tick.price
      // the price we would really get when closing now
      const exitPx = B ? (tick.bid > 0 ? tick.bid : last) : (tick.ask > 0 ? tick.ask : last)
      const slip = exitPx * (this.r.slippagePct / 100)
      const fill = (px, slipped = true) => (B ? px - (slipped ? slip : 0) : px + (slipped ? slip : 0))
      if (istHHMM(ts) >= this.r.squareOff) { out.push(this.close(t, 'squareoff', fill(exitPx), ts)); continue }
      if (B ? last <= t.stop : last >= t.stop) {
        out.push(this.close(t, t.locked ? 'lockedstop' : t.atBreakeven ? 'breakeven' : 'stop', fill(exitPx), ts)); continue
      }
      if (B ? last >= t.target : last <= t.target) { out.push(this.close(t, 'target', t.target, ts)); continue } // target = limit order: fills at the target
      // move the stop (same steps as paper.ts, on the tick price)
      const before = t.stop
      const exc = B ? last - t.entry : t.entry - last
      t.bestExc = Math.max(t.bestExc ?? 0, exc)
      t.bestPx = t.bestPx === undefined ? last : B ? Math.max(t.bestPx, last) : Math.min(t.bestPx, last)
      if (!t.atBreakeven && t.bestExc >= this.r.breakevenAtR * t.stopDist) { t.stop = this.better(t, t.stop, t.entry); t.atBreakeven = true }
      const rr = t.bestExc / t.stopDist
      const noLoss = t.entry * (this.r.costPct / 100 + 2 * this.r.slippagePct / 100)
      if (rr >= this.r.lock2AtR) { t.stop = this.better(t, t.stop, B ? t.entry + this.r.lock2KeepR * t.stopDist : t.entry - this.r.lock2KeepR * t.stopDist); t.locked = true }
      else if (rr >= this.r.lockAtR) { t.stop = this.better(t, t.stop, B ? t.entry + noLoss : t.entry - noLoss); t.locked = true }
      if (t.atr && t.bestExc >= this.r.trailAfterR * t.stopDist) {
        t.stop = this.better(t, t.stop, B ? t.bestPx - this.r.trailAtrMult * t.atr : t.bestPx + this.r.trailAtrMult * t.atr)
        if (B ? t.stop > t.entry : t.stop < t.entry) t.locked = true
      }
      if (t.stop !== before) out.push({ kind: 'stopMoved', id: t.id, symbol, from: before, to: t.stop, ts })
    }
    return out
  }

  close(t, reason, price, ts) {
    t.closed = true
    const B = t.direction === 'BUY'
    const grossPct = B ? (price / t.entry - 1) * 100 : (1 - price / t.entry) * 100
    return { kind: 'close', id: t.id, symbol: t.symbol, direction: t.direction, reason, price: Math.round(price * 100) / 100,
      grossPct, netPct: grossPct - this.r.costPct, ts }
  }
}
