// fade-shadow.mjs - SHADOW TRACK "R3" (step 2 of THE PLAN v2, research z/s2rules.py + s2stop.py, 10 Nov 2026).
// MONITORING ONLY: virtual trades, no alerts, no orders; can never change the BASE paper trades.
// RULE: at 09:20, for each stock in play (top 10 by opening rvol, BEFORE the gap filter = replay S-RAW picks) whose 5-day rise
//       (product of the last 5 daily returns) is >= 7.6% -> virtual SELL at the price then. Exit: 15:14 at the price then, or a stop
//       3% above entry. Rs 1 lakh per trade, costs 0.10628% + 0.02% slippage per side (same as the engine).
// Research (2022-26 replay, 1 lakh/trade, hold to 15:14, no stop): build 2022-24 right 59%, +0.29%/trade after costs (n 1,056);
//       check 2025-26 right 60%, +0.37% (n 660). With the 3% stop all 5 years positive.
// Each trade also logs rng5 (first-5-min range %) and r3b = rng5 >= 2.84 (candidate R3b, 10 Nov 15:35).
// Daily returns: own file data\fade-dret.json (seeded from NSE official close/prev_close; updated after each close). Replay passes
//       baseline.fadeDret instead. Files: data\fade-shadow-DATE.csv + fade-shadow-state-DATE.json (restarts).
import fs from 'node:fs'
import path from 'node:path'

// SCENARIO S1 (owner 11 Nov 23:31, "make it a rule for both sides, check on live; one entry scenario among others"): recorded separately.
//   Stock: 09:20 pick with 5-day move >= 7.6% (up -> SELL, down -> BUY). Entry: first 1-min bar close from 09:20 to 10:25 where the day's
//   extreme (high for a sell / low for a buy) was made within the last 30 min and price is >= 0.3% off it. Stop 0.1% beyond that extreme.
//   Exit: stop or 15:14. Rs 1 lakh, same costs. Old data 2022-26 (z/s1.py, hint only): sell +0.23%/trade in both periods, all 5 years positive;
//   buy +0.38% (2022-24) / -0.01% (2025-26). Wins ~40% of trades (big winners, small losers); about 55% of its trade-days lose.
//   File data\s1-shadow-DATE.csv. Virtual only - never touches the BASE paper trades.
export const S1 = { buySide: false, /* owner 11 Nov 23:41: SELL only (buy side removed; set true to bring it back) */ ret5Min: 7.6, fromBar: 560, toBar: 625, extMaxAge: 30, offMin: 0.3, stopBeyond: 0.1 }
export const FADE = { ret5Min: 7.6, stopPct: 3, exitSec: 15 * 3600 + 14 * 60, notional: 100000, slipPct: 0.02, costPct: 0.10628, days: 5 }
const istClock = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 19)

export class FadeShadow {
  constructor({ dataDir, day, baseline, rules = FADE }) {
    this.r = rules; this.dataDir = dataDir; this.day = day; this.trades = new Map(); this.s1 = new Map()
    this.dret = baseline?.fadeDret ?? null; this.replay = !!this.dret
    if (!this.dret) { try { this.dret = JSON.parse(fs.readFileSync(path.join(dataDir, 'fade-dret.json'), 'utf8')) } catch { this.dret = { ret: {}, lastClose: {}, lastDay: null } } }
    this.restore(); this.restoreS1()
  }
  file(n) { return path.join(this.dataDir, `${n}-${this.day}`) }
  save() { if (this.replay) return; try { fs.writeFileSync(this.file('fade-shadow-state') + '.json', JSON.stringify([...this.trades.values()])); fs.writeFileSync(this.file('s1-shadow-state') + '.json', JSON.stringify([...this.s1.values()])) } catch {} }
  restore() { if (this.replay) return; try { for (const t of JSON.parse(fs.readFileSync(this.file('fade-shadow-state') + '.json', 'utf8'))) this.trades.set(t.sym, t) } catch {} }
  restoreS1() { if (this.replay) return; try { for (const t of JSON.parse(fs.readFileSync(this.file('s1-shadow-state') + '.json', 'utf8'))) this.s1.set(t.sym, t) } catch {} }
  ret5(sym) { const a = this.dret.ret?.[sym]; if (!a || a.length < this.r.days) return null; return (a.slice(-this.r.days).reduce((x, r) => x * (1 + r), 1) - 1) * 100 }
  // picks: [{sym, rvol, price}] at 09:20
  onPicks(picks, ts) {
    if (!this.s1.size) for (const p of picks) { // S1 candidates (both sides)
      const r5 = this.ret5(p.sym); if (r5 == null || Math.abs(r5) < S1.ret5Min || !(p.price > 0) || (r5 < 0 && !S1.buySide)) continue
      const dir = r5 > 0 ? 'SELL' : 'BUY', ext = dir === 'SELL' ? (p.high ?? p.price) : (p.low ?? p.price)
      this.s1.set(p.sym, { sym: p.sym, dir, ret5: +r5.toFixed(2), rvol: p.rvol, ext, extBar: 555, lastPx: p.price, lastBar: 559 })
    }
    if (this.trades.size) return // already done today (restart)
    for (const p of picks) {
      const r5 = this.ret5(p.sym)
      if (r5 == null || r5 < this.r.ret5Min || !(p.price > 0)) continue
      const entry = +(p.price * (1 - this.r.slipPct / 100)).toFixed(2), qty = Math.floor(this.r.notional / entry)
      this.trades.set(p.sym, { sym: p.sym, dir: 'SELL', rvol: p.rvol, ret5: +r5.toFixed(2), rng5: p.rng5 ?? null, r3b: (p.rng5 ?? 0) >= 2.84, entry, qty, stop: +(entry * (1 + this.r.stopPct / 100)).toFixed(2), inTs: ts })
    }
    this.save()
  }
  onTick(sym, price, ts, sec) {
    const c = this.s1.get(sym)
    if (c && !c.exit && price > 0) {
      const bar = Math.floor(sec / 60)
      if (c.entry) { // open S1 trade: stop or 15:14
        if (c.dir === 'SELL' ? price >= c.stop : price <= c.stop) this.closeS1(c, price, 'stop', ts)
        else if (sec >= this.r.exitSec) this.closeS1(c, price, 'time', ts)
      } else if (!c.done) {
        if (bar > c.lastBar) { // bar c.lastBar just closed at c.lastPx -> evaluate the entry
          const b = c.lastBar, off = c.dir === 'SELL' ? (c.ext / c.lastPx - 1) * 100 : (c.lastPx / c.ext - 1) * 100
          if (b >= S1.fromBar && b <= S1.toBar && b - c.extBar <= S1.extMaxAge && off >= S1.offMin) {
            const k = c.dir === 'SELL' ? 1 - this.r.slipPct / 100 : 1 + this.r.slipPct / 100
            c.entry = +(price * k).toFixed(2); c.qty = Math.floor(this.r.notional / c.entry); c.inTs = ts; c.offPct = +off.toFixed(2)
            c.stop = +(c.ext * (c.dir === 'SELL' ? 1 + S1.stopBeyond / 100 : 1 - S1.stopBeyond / 100)).toFixed(2); this.save()
          } else if (b > S1.toBar) { c.done = true; this.save() }
        }
        if (!c.entry) { if (c.dir === 'SELL' ? price > c.ext : price < c.ext) { c.ext = price; c.extBar = bar } }
      }
      c.lastPx = price; c.lastBar = bar
    }
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
      const f = this.file('fade-shadow') + '.csv', head = fs.existsSync(f) ? '' : 'day,symbol,dir,ret5_pct,rng5_pct,r3b,rvol,entry_time,entry,exit_time,exit,reason,qty,net_rs\n'
      fs.appendFileSync(f, head + [this.day, t.sym, t.dir, t.ret5, t.rng5, t.r3b ? 1 : 0, t.rvol, istClock(t.inTs), t.entry, istClock(ts), exit, reason, t.qty, net].join(',') + '\n')
    } catch {}
  }
  closeS1(t, price, reason, ts) {
    const sell = t.dir === 'SELL', exit = +(price * (sell ? 1 + this.r.slipPct / 100 : 1 - this.r.slipPct / 100)).toFixed(2)
    const net = Math.round((sell ? t.entry - exit : exit - t.entry) * t.qty - t.entry * t.qty * this.r.costPct / 100)
    Object.assign(t, { exit, reason, outTs: ts, net }); this.save()
    if (this.replay) return
    try {
      const f = this.file('s1-shadow') + '.csv', head = fs.existsSync(f) ? '' : 'day,symbol,dir,ret5_pct,off_extreme_pct,entry_time,entry,stop,exit_time,exit,reason,qty,net_rs\n'
      fs.appendFileSync(f, head + [this.day, t.sym, t.dir, t.ret5, t.offPct, istClock(t.inTs), t.entry, t.stop, istClock(ts), exit, reason, t.qty, net].join(',') + '\n')
    } catch {}
  }
  // squareoff fallback (e.g. no tick after 15:14 for that stock)
  closeAll(lastPx, ts) { for (const t of this.trades.values()) if (!t.exit) { const p = lastPx(t.sym); if (p > 0) this.close(t, p, 'time', ts) }; for (const t of this.s1.values()) if (t.entry && !t.exit) { const p = lastPx(t.sym); if (p > 0) this.closeS1(t, p, 'time', ts) } }
  summary() {
    const v = [...this.trades.values()], d = v.filter((t) => t.exit)
    const s = [...this.s1.values()].filter((t) => t.entry), sd = s.filter((t) => t.exit)
    return { n: v.length, closed: d.length, net: d.reduce((a, t) => a + t.net, 0), wins: d.filter((t) => t.net > 0).length, trades: v,
      s1: { candidates: this.s1.size, n: s.length, closed: sd.length, net: sd.reduce((a, t) => a + t.net, 0), wins: sd.filter((t) => t.net > 0).length, trades: s } }
  }
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
