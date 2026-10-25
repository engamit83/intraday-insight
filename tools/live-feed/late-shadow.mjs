// late-shadow.mjs - SHADOW MONITOR for "later entries" (owner 25 Oct 17:13 idea, 17:19 "do it"; MONITORING ONLY - not a rule,
// no paper trades, no alerts; decide next weekend). Research: tools/backtest/v5/late4.py (best: spike + break + >= 4 favour signs).
// After the morning window (closed 1-min bars 10:15-14:30) every liquid stock is watched:
//  SPIKE  : volume of the last 5 closed minutes >= 3x the stock's normal 5-min volume (normal = median day turnover / price / 375 * 5)
//           and the price moved >= 0.3% in those 5 minutes -> direction = that move. Level = the 5-min high (BUY) / low (SELL).
//  BREAK  : within 15 minutes the price goes beyond the level -> the 6 base favour signs are read at that moment (smart-warn favourFor,
//           order book vs the book at the spike). A VIRTUAL trade is recorded for EVERY break with its sign score, so the weekend review
//           can compare "signs agreed" vs "signs did not". rule_ok = spike >= 5x AND >= 4 of 6 signs (the owner's idea, research best).
//  EXIT   : exactly today's exit rule (stop other side of the 5-min range clamped 0.5-1.5%, trail 1R after +1R, smart warning -> 0.3R
//           behind best, trend back -> 1R, warning before +1R -> stop 0.3R from price, never down, 15:15 square-off). Rs1,000 risk.
// Files: data\late-spikes-DATE.csv, data\late-shadow-DATE.csv (+ late-shadow-state-DATE.json for restarts).
// SAFETY: read-only use of the engine's SmartWarn (own warning throttle), everything wrapped by the caller in try/catch.
import fs from 'node:fs'
import path from 'node:path'

export const LATE = { fromMin: '10:15', toMin: '14:30', spikeX: 3, ruleX: 5, minMovePct: 0.3, waitMin: 15, ruleSigns: 4, minTurnoverCr: 25,
  stopMinPct: 0.5, stopMaxPct: 1.5, riskRs: 1000, warnTightR: 0.3, lossTightR: 0.3, slipPct: 0.02, costPct: 0.10628, maxTrades: 400 }

const istClock = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 19)
const median = (a) => { if (!a?.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const mins = (m) => +m.slice(0, 2) * 60 + +m.slice(3, 5)

export class LateShadow {
  constructor({ dataDir, sw, baseline, day, rules = LATE }) {
    this.r = rules; this.dataDir = dataDir; this.sw = sw; this.baseline = baseline; this.day = day
    this.seen = new Map()    // sym -> bars length already processed
    this.armed = new Map()   // sym -> spike waiting for a break
    this.trades = new Map()  // sym -> virtual trade (one per stock per day)
    this.lastWarn = new Map()
    this.spikes = 0
    this.restore()
  }
  file(n) { return path.join(this.dataDir, `${n}-${this.day}`) }
  save() { try { fs.writeFileSync(this.file('late-shadow-state') + '.json', JSON.stringify({ trades: [...this.trades.values()], spikes: this.spikes })) } catch {} }
  restore() { try { const s = JSON.parse(fs.readFileSync(this.file('late-shadow-state') + '.json', 'utf8')); for (const t of s.trades ?? []) this.trades.set(t.sym, t); this.spikes = s.spikes ?? 0 } catch {} }
  normal5(sym) {
    const turn = median(this.baseline?.turnover?.[sym]), pc = this.baseline?.lastClose?.[sym]
    if (!(turn >= this.r.minTurnoverCr) || !(pc > 0)) return 0
    return turn * 1e7 / pc / 375 * 5
  }
  // called on every tick after the engine's own work. tick: { price, bid, ask, totBuy, totSell }, m = 'HH:MM', squareOff = bool
  onTick(sym, tick, ts, m, squareOff) {
    if (sym.startsWith('NIFTY')) return
    const p = tick.price, t = this.trades.get(sym)
    if (squareOff) { if (t && !t.exit) this.close(t, p, 'squareoff', ts); return }
    const x = this.sw.sym.get(sym); if (!x) return
    const n = x.bars.length, newBar = n !== (this.seen.get(sym) ?? 0)
    this.seen.set(sym, n)
    if (t && !t.exit) { this.manage(t, tick, ts); if (newBar && !t.exit) this.smart(t, x, m); return }
    if (t) return
    if (newBar && n >= 6) this.spike(sym, x, ts)
    const a = this.armed.get(sym)
    if (!a) return
    if (mins(m) > mins(a.m) + this.r.waitMin) { this.armed.delete(sym); return }
    const B = a.dir === 'BUY'
    if (B ? p > a.lvl : p < a.lvl) this.enter(sym, a, tick, ts)
  }
  spike(sym, x, ts) {
    const last = x.bars.at(-1)
    if (last.m < this.r.fromMin || last.m > this.r.toMin) return
    const nm = this.normal5(sym); if (!nm) return
    const l5 = x.bars.slice(-5), w = l5.reduce((a, b) => a + b.v, 0), ratio = w / nm
    const mv = (last.c / l5[0].o - 1) * 100
    if (ratio < this.r.spikeX || Math.abs(mv) < this.r.minMovePct) return
    const dir = mv > 0 ? 'BUY' : 'SELL'
    const prev = this.armed.get(sym); if (prev && prev.dir === dir) return
    const hi = Math.max(...l5.map((b) => b.h)), lo = Math.min(...l5.map((b) => b.l))
    const a = { m: last.m, dir, ratio: +ratio.toFixed(1), mv: +mv.toFixed(2), lvl: dir === 'BUY' ? hi : lo, opp: dir === 'BUY' ? lo : hi, book0: x.book ?? null }
    this.armed.set(sym, a); this.spikes++
    this.csv('late-spikes', 'day,minute,symbol,dir,spike_x,move_pct,level,other_side', [this.day, a.m, sym, dir, a.ratio, a.mv, a.lvl, a.opp])
  }
  enter(sym, a, tick, ts) {
    this.armed.delete(sym)
    if (this.trades.size >= this.r.maxTrades) return
    const B = a.dir === 'BUY', sg = B ? 1 : -1
    const f = this.sw.favourFor(sym, a.dir, tick.price, a.book0)
    const signs = f ? Object.keys(f.signs).filter((k) => f.signs[k]) : [], score = f ? f.score : 0
    const quote = B ? (tick.ask > 0 ? tick.ask : tick.price) : (tick.bid > 0 ? tick.bid : tick.price)
    const entry = +(quote * (1 + sg * this.r.slipPct / 100)).toFixed(2)
    const riskPct = Math.min(Math.max(Math.abs(entry - a.opp) / entry * 100, this.r.stopMinPct), this.r.stopMaxPct)
    const risk = entry * riskPct / 100, qty = Math.max(1, Math.floor(this.r.riskRs / risk))
    const t = { sym, dir: a.dir, spikeMin: a.m, spikeX: a.ratio, move: a.mv, score, signs, ruleOk: a.ratio >= this.r.ruleX && score >= this.r.ruleSigns,
      entry, stop: +(entry - sg * risk).toFixed(2), stop0: +(entry - sg * risk).toFixed(2), risk, riskPct: +riskPct.toFixed(2), qty, best: 0, inTs: ts,
      inMin: new Date(ts + 330 * 60_000).toISOString().slice(11, 16), bookAtEntry: this.sw.sym.get(sym)?.book ?? null, lastPrice: tick.price, tight: false, warns: 0 }
    this.trades.set(sym, t); this.save()
  }
  manage(t, tick, ts) {
    const B = t.dir === 'BUY', sg = B ? 1 : -1, p = tick.price
    t.lastPrice = p
    if (B ? p <= t.stop : p >= t.stop) {
      const q = B ? (tick.bid > 0 ? Math.min(tick.bid, p) : p) : (tick.ask > 0 ? Math.max(tick.ask, p) : p)
      return this.close(t, q, t.best >= 1 ? 'trail' : 'stop', ts)
    }
    const r = (p - t.entry) * sg / t.risk
    if (r > t.best) {
      t.best = r
      if (t.best >= 1) { const ns = +(t.entry + sg * (t.best - (t.tight ? this.r.warnTightR : 1)) * t.risk).toFixed(2); if ((ns - t.stop) * sg > 0) t.stop = ns }
    }
  }
  // same exit warning logic as the live trades (smart-warn thresholds), with its own throttle so live warnings are never affected
  smart(t, x, m) {
    const tr = { sym: t.sym, dir: t.dir, entry: t.entry, risk: t.risk, inMin: t.inMin, bookAtEntry: t.bookAtEntry }
    const s = this.sw.signsFor(tr); if (!s) return
    const sg = t.dir === 'BUY' ? 1 : -1, R = this.sw.r
    if (t.tight && s.score === 0) t.tight = false
    if (s.last.m <= t.inMin) return
    const inProfit = t.best >= 1
    if (inProfit ? s.score < R.minScore : (s.score < R.minScoreEarly || !(s.signs.flow || s.signs.book))) return
    const lw = this.lastWarn.get(t.sym); if (lw && mins(m) - mins(lw) < R.repeatMin) return
    this.lastWarn.set(t.sym, m); t.warns++
    if (!inProfit) { const ns = +(s.last.c - sg * this.r.lossTightR * t.risk).toFixed(2); if ((ns - t.stop) * sg > 0) t.stop = ns }
    else { t.tight = true; const ns = +(t.entry + sg * (t.best - this.r.warnTightR) * t.risk).toFixed(2); if ((ns - t.stop) * sg > 0) t.stop = ns }
  }
  close(t, quote, reason, ts) {
    const sg = t.dir === 'BUY' ? 1 : -1
    const exit = +(quote * (1 - sg * this.r.slipPct / 100)).toFixed(2)
    const gross = (exit - t.entry) * sg * t.qty, cost = t.entry * t.qty * this.r.costPct / 100
    Object.assign(t, { exit, reason, outTs: ts, netRs: Math.round(gross - cost), R: +((gross - cost) / (t.risk * t.qty)).toFixed(2) })
    this.save()
    this.csv('late-shadow', 'day,symbol,dir,spike_min,spike_x,move_pct,signs_score,signs,rule_ok,entry_time,entry,stop0,risk_pct,qty,exit_time,exit,reason,best_R,warnings,net_rs,R',
      [this.day, t.sym, t.dir, t.spikeMin, t.spikeX, t.move, t.score, t.signs.join('+'), t.ruleOk ? 'yes' : 'no', istClock(t.inTs), t.entry, t.stop0, t.riskPct, t.qty, istClock(ts), t.exit, reason, t.best.toFixed(2), t.warns, t.netRs, t.R])
  }
  closeAll(ts) { for (const t of this.trades.values()) if (!t.exit) this.close(t, t.lastPrice ?? t.entry, 'squareoff', ts) }
  csv(name, head, row) {
    try { const f = this.file(name) + '.csv'; fs.appendFileSync(f, (fs.existsSync(f) ? '' : head + '\n') + row.join(',') + '\n') } catch {}
  }
  summary() {
    const c = [...this.trades.values()].filter((t) => t.exit), ok = c.filter((t) => t.ruleOk)
    const sum = (a) => a.reduce((x, t) => x + t.netRs, 0)
    return { spikes: this.spikes, n: c.length, net: sum(c), okN: ok.length, okNet: sum(ok), okWins: ok.filter((t) => t.netRs > 0).length }
  }
}
