// fade-shadow.mjs - SHADOW TRACK "R3" (step 2 of THE PLAN v2, research z/s2rules.py + s2stop.py, 10 Nov 2026).
// MONITORING ONLY: virtual trades, no alerts, no orders; can never change the BASE paper trades.
// RULE: at 09:20, for each stock in play (top 10 by opening rvol, BEFORE the gap filter = replay S-RAW picks) whose 5-day rise
//       (product of the last 5 daily returns) is >= 7.6% -> virtual SELL at the price then. Exit: 15:14 at the price then, or a stop
//       3% above entry. Rs 1 lakh per trade, costs 0.10628% + 0.02% slippage per side (same as the engine).
// Research (2022-26 replay, 1 lakh/trade, hold to 15:14, no stop): build 2022-24 right 59%, +0.29%/trade after costs (n 1,056);
//       check 2025-26 right 60%, +0.37% (n 660). With the 3% stop all 5 years positive.
// Daily returns: own file data\fade-dret.json (seeded from NSE official close/prev_close; updated after each close). Replay passes
//       baseline.fadeDret instead. Files: data\fade-shadow-DATE.csv + fade-shadow-state-DATE.json (restarts).
import fs from 'node:fs'
import path from 'node:path'

export const FADE = { ret5Min: 7.6, stopPct: 3, exitSec: 15 * 3600 + 14 * 60, notional: 100000, slipPct: 0.02, costPct: 0.10628, days: 5 }
const istClock = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 19)

export class FadeShadow {
  constructor({ dataDir, day, baseline, rules = FADE }) {
    this.r = rules; this.dataDir = dataDir; this.day = day; this.trades = new Map()
    this.dret = baseline?.fadeDret ?? null; this.replay = !!this.dret
    if (!this.dret) { try { this.dret = JSON.parse(fs.readFileSync(path.join(dataDir, 'fade-dret.json'), 'utf8')) } catch { this.dret = { ret: {}, lastClose: {}, lastDay: null } } }
    this.restore()
  }
  file(n) { return path.join(this.dataDir, `${n}-${this.day}`) }
  save() { if (this.replay) return; try { fs.writeFileSync(this.file('fade-shadow-state') + '.json', JSON.stringify([...this.trades.values()])) } catch {} }
  restore() { if (this.replay) return; try { for (const t of JSON.parse(fs.readFileSync(this.file('fade-shadow-state') + '.json', 'utf8'))) this.trades.set(t.sym, t) } catch {} }
  ret5(sym) { const a = this.dret.ret?.[sym]; if (!a || a.length < this.r.days) return null; return (a.slice(-this.r.days).reduce((x, r) => x * (1 + r), 1) - 1) * 100 }
  // picks: [{sym, rvol, price}] at 09:20
  onPicks(picks, ts) {
    if (this.trades.size) return // already done today (restart)
    for (const p of picks) {
      const r5 = this.ret5(p.sym)
      if (r5 == null || r5 < this.r.ret5Min || !(p.price > 0)) continue
      const entry = +(p.price * (1 - this.r.slipPct / 100)).toFixed(2), qty = Math.floor(this.r.notional / entry)
      this.trades.set(p.sym, { sym: p.sym, dir: 'SELL', rvol: p.rvol, ret5: +r5.toFixed(2), entry, qty, stop: +(entry * (1 + this.r.stopPct / 100)).toFixed(2), inTs: ts })
    }
    this.save()
  }
  onTick(sym, price, ts, sec) {
    const t = this.trades.get(sym); if (!t || t.exit || !(price > 0)) return
    if (price >= t.stop) this.close(t, price, 'stop', ts)
    else if (sec >= this.r.exitSec) this.close(t, price, 'time', ts)
  }
  close(t, price, reason, ts) {
    const exit = +(price * (1 + this.r.slipPct / 100)).toFixed(2)
    const net = Math.round((t.entry - exit) * t.qty - t.entry * t.qty * this.r.costPct / 100)
    Object.assign(t, { exit, reason, outTs: ts, net }); this.save()
    if (this.replay) return
    try {
      const f = this.file('fade-shadow') + '.csv', head = fs.existsSync(f) ? '' : 'day,symbol,dir,ret5_pct,rvol,entry_time,entry,exit_time,exit,reason,qty,net_rs\n'
      fs.appendFileSync(f, head + [this.day, t.sym, t.dir, t.ret5, t.rvol, istClock(t.inTs), t.entry, istClock(ts), exit, reason, t.qty, net].join(',') + '\n')
    } catch {}
  }
  // squareoff fallback (e.g. no tick after 15:14 for that stock)
  closeAll(lastPx, ts) { for (const t of this.trades.values()) if (!t.exit) { const p = lastPx(t.sym); if (p > 0) this.close(t, p, 'time', ts) } }
  summary() { const v = [...this.trades.values()], d = v.filter((t) => t.exit); return { n: v.length, closed: d.length, net: d.reduce((a, t) => a + t.net, 0), wins: d.filter((t) => t.net > 0).length, trades: v } }
  // after the close (live only): add today's return per stock to data\fade-dret.json
  endDay(cum) {
    if (this.replay || this.dret.lastDay === this.day) return false
    const d = this.dret; d.ret ??= {}; d.lastClose ??= {}
    for (const [sym, c] of cum) {
      const pc = d.lastClose[sym]
      if (pc > 0 && c.price > 0) { (d.ret[sym] ??= []).push(+(c.price / pc - 1).toFixed(5)); d.ret[sym] = d.ret[sym].slice(-10) }
      if (c.price > 0) d.lastClose[sym] = c.price
    }
    d.lastDay = this.day
    try { fs.writeFileSync(path.join(this.dataDir, 'fade-dret.json'), JSON.stringify(d)); return true } catch { return false }
  }
}
