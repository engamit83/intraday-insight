// breadth-shadow.mjs - VIRTUAL trades for picks SKIPPED by rule E6 "trade with breadth" (owner 26 Oct 23:45: go with breadth, monitor the
// skipped ones, learn which against-breadth stocks would have won -> build a filter to let them back in). No paper trades, no alerts.
// Entry/stop/size exactly as the real trade would have been; exit = the live exit rule (same code as the other shadows).
// File: data\breadth-skipped-DATE.csv (+ breadth-shadow-state-DATE.json).
import fs from 'node:fs'
import { LateShadow, LATE } from './late-shadow.mjs'

const istClock = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 19)

export class BreadthShadow extends LateShadow {
  constructor(o) { super({ ...o, rules: o.rules ?? LATE }) }
  save() { try { fs.writeFileSync(this.file('breadth-shadow-state') + '.json', JSON.stringify({ trades: [...this.trades.values()] })) } catch {} }
  restore() { try { const s = JSON.parse(fs.readFileSync(this.file('breadth-shadow-state') + '.json', 'utf8')); for (const t of s.trades ?? []) this.trades.set(t.sym, t) } catch {} }
  // t = the trade object the engine would have opened (entry, stop, risk, qty, dir, ...) + breadth at that moment
  add(t, breadth, ts) {
    if (this.trades.has(t.sym)) return
    this.trades.set(t.sym, { ...t, breadth, best: 0, inTs: ts, inMin: new Date(ts + 330 * 60_000).toISOString().slice(11, 16), tight: false, warns: 0, signs: [], score: 0, ruleOk: false })
    this.save()
  }
  onTick(sym, tick, ts, m, squareOff) {
    const t = this.trades.get(sym); if (!t || t.exit) return
    if (squareOff) return this.close(t, tick.price, 'squareoff', ts)
    const x = this.sw.sym.get(sym); if (!x) { this.manage(t, tick, ts); return }
    const n = x.bars.length, newBar = n !== (this.seen.get(sym) ?? 0)
    this.seen.set(sym, n)
    this.manage(t, tick, ts); if (newBar && !t.exit) this.smart(t, x, m)
  }
  close(t, quote, reason, ts) {
    const sg = t.dir === 'BUY' ? 1 : -1
    const exit = +(quote * (1 - sg * this.r.slipPct / 100)).toFixed(2)
    const gross = (exit - t.entry) * sg * t.qty, cost = t.entry * t.qty * this.r.costPct / 100
    Object.assign(t, { exit, reason, outTs: ts, netRs: Math.round(gross - cost), R: +((gross - cost) / (t.risk * t.qty)).toFixed(2) })
    this.save()
    this.csv('breadth-skipped', 'day,symbol,dir,rvol,gap_with_pct,breadth_at_entry,signs_at_entry,entry_time,entry,stop0,qty,exit_time,exit,reason,best_R,net_rs,R',
      [this.day, t.sym, t.dir, t.rvol, t.gapWith ?? '', t.breadth, (t.signsAtEntry ?? []).join('+'), istClock(t.inTs), t.entry, t.stop0, t.qty, istClock(ts), t.exit, reason, t.best.toFixed(2), t.netRs, t.R])
  }
  summary() {
    const c = [...this.trades.values()].filter((t) => t.exit)
    return { n: c.length, wins: c.filter((t) => t.netRs > 0).length, net: c.reduce((a, t) => a + t.netRs, 0) }
  }
}
