// sip-engine.mjs - STOCKS IN PLAY paper strategy on live ticks (owner "do it from tomorrow", 22 Oct 2026; research: tools/backtest/v5/sip.py,
// 13-22 Oct x 494 stocks: 47 trades, 64% winners, +16.9R after costs). PAPER ONLY - no orders are ever placed.
// Rules (fixed, same as the research):
//  1. Opening range = 09:15:00-09:19:59. For every stock: open, high, low, last price, volume traded in those 5 minutes.
//  2. At 09:20 rank liquid stocks (median turnover >= Rs25 cr/day) by RELATIVE VOLUME = OR volume / its own average OR volume
//     (baseline file data\sip-baseline.json, last 10 days). Keep the top 10 with rvol >= 3. Direction = OR close vs open.
//  3. Entry until 10:15 when the price breaks the OR high (BUY) / OR low (SELL): fill at the offer (BUY) / bid (SELL) + 0.02% slippage.
//  4. Stop = other side of the opening range, clamped to 0.5%-1.5% of the entry (owner "do it" 23 Oct 08:49; was 2%). Top 15 (was 10). Size = Rs1,000 risk (1R).
//  5. After +1R the stop trails 1R behind the best price. Otherwise exit at 15:15. Costs 0.10628% + slippage counted.
import fs from 'node:fs'
import path from 'node:path'

export const SIP_RULES = { orStart: 9 * 3600 + 15 * 60, orEnd: 9 * 3600 + 20 * 60, lastEntry: 10 * 3600 + 15 * 60, squareOff: 15 * 3600 + 15 * 60,
  topK: 15, minRvol: 3, minTurnoverCr: 25, stopMinPct: 0.5, stopMaxPct: 1.5, riskRs: 1000, slipPct: 0.02, costPct: 0.10628, baselineDays: 10, lateStartSec: 20 }

const istSec = (ms) => { const d = new Date(ms + 330 * 60_000); return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds() }
const istDay = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10)
const istClock = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 19)
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

export class SipEngine {
  constructor({ dataDir, rules = SIP_RULES, baseline = null, day = null }) {
    this.r = rules; this.dataDir = dataDir; this.day = day
    this.baseline = baseline ?? SipEngine.loadBaseline(dataDir)
    this.or = new Map()        // sym -> { open, high, low, last, v0, v1 }
    this.cum = new Map()       // sym -> latest cumulative volume and price (for the nightly baseline update)
    this.picks = null          // [{ sym, dir, rvol, high, low }]
    this.trades = new Map()    // sym -> trade
    this.closed = []
    this.firstTickSec = null
    this.status = 'waiting'
  }
  static loadBaseline(dataDir) {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'sip-baseline.json'), 'utf8')) } catch { return { first5: {}, turnover: {}, days: [] } }
  }
  stateFile() { return path.join(this.dataDir, `sip-state-${this.day}.json`) }
  save() {
    try { fs.writeFileSync(this.stateFile(), JSON.stringify({ picks: this.picks, trades: [...this.trades.values()], closed: this.closed, status: this.status, or: [...this.or] })) } catch {}
  }
  restore() { // after a restart in the middle of the day: keep the picks and open trades
    try {
      const s = JSON.parse(fs.readFileSync(this.stateFile(), 'utf8'))
      this.picks = s.picks; this.closed = s.closed ?? []; this.status = s.status ?? 'waiting'
      for (const t of s.trades ?? []) this.trades.set(t.sym, t)
      for (const [k, v] of s.or ?? []) this.or.set(k, v)
      if (this.picks) this.firstTickSec = this.r.orStart
      return true
    } catch { return false }
  }

  // tick: { price, bid, ask, cum } ; returns events [{kind:'picks'|'entry'|'exit'|'note', ...}]
  onTick(sym, tick, ts) {
    const ev = []
    if (!this.day) { this.day = istDay(ts); this.restore() }
    const sec = istSec(ts), p = tick.price
    if (!(p > 0)) return ev
    if (Number.isFinite(tick.cum)) this.cum.set(sym, { cum: tick.cum, price: p })
    if (sec >= this.r.orStart && sec < this.r.orEnd) {
      if (this.firstTickSec === null) this.firstTickSec = sec
      let o = this.or.get(sym)
      if (!o) { o = { open: p, high: p, low: p, last: p, v0: Number.isFinite(tick.cum) ? tick.cum : null, v1: null }; this.or.set(sym, o) }
      o.high = Math.max(o.high, p); o.low = Math.min(o.low, p); o.last = p
      if (Number.isFinite(tick.cum)) { if (o.v0 === null) o.v0 = tick.cum; o.v1 = tick.cum }
      return ev
    }
    ev.push(...this.onTimer(ts))
    const t = this.trades.get(sym)
    if (t && !t.exit) ev.push(...this.manage(t, tick, ts, sec))
    else if (!t && this.picks && sec < this.r.lastEntry) {
      const pk = this.picks.find((x) => x.sym === sym)
      if (pk) ev.push(...this.tryEntry(pk, tick, ts))
    }
    return ev
  }
  // called every second by the feed (and from onTick): selection at 09:20, square-off at 15:15
  onTimer(ts) {
    const ev = [], sec = istSec(ts)
    if (!this.day) { this.day = istDay(ts); this.restore() }
    if (this.picks === null && sec >= this.r.orEnd && sec < this.r.squareOff) ev.push(...this.select(ts))
    if (sec >= this.r.squareOff) for (const t of this.trades.values()) if (!t.exit) ev.push(this.close(t, t.lastPrice ?? t.entry, 'squareoff', ts))
    if (this.dirty && ts - (this.savedAt ?? 0) >= 10_000) { this.dirty = false; this.savedAt = ts; this.save() } // trailing-stop moves saved at most every 10 s
    return ev
  }
  select(ts) {
    this.picks = []
    if (this.firstTickSec === null || this.firstTickSec > this.r.orStart + this.r.lateStartSec) {
      this.status = 'skipped: feed started after 09:15 (no full opening range)'; this.save()
      return [{ kind: 'note', text: `SIP: no picks today - ${this.status}` }]
    }
    const cand = []
    for (const [sym, o] of this.or) {
      const hist = this.baseline.first5?.[sym] ?? []
      const avg = mean(hist.slice(-this.r.baselineDays)), turn = median(this.baseline.turnover?.[sym] ?? [])
      if (!(avg > 0) || turn < this.r.minTurnoverCr || o.v0 === null || o.v1 === null || o.last === o.open) continue
      const rvol = (o.v1 - o.v0) / avg
      if (rvol >= this.r.minRvol) cand.push({ sym, dir: o.last > o.open ? 'BUY' : 'SELL', rvol: +rvol.toFixed(1), high: o.high, low: o.low })
    }
    cand.sort((a, b) => b.rvol - a.rvol)
    this.picks = cand.slice(0, this.r.topK); this.status = 'picked'; this.save()
    return [{ kind: 'picks', picks: this.picks, ts }]
  }
  tryEntry(pk, tick, ts) {
    const B = pk.dir === 'BUY', sg = B ? 1 : -1, lvl = B ? pk.high : pk.low
    if (B ? tick.price <= lvl : tick.price >= lvl) return []   // strictly beyond the range
    const quote = B ? (tick.ask > 0 ? tick.ask : tick.price) : (tick.bid > 0 ? tick.bid : tick.price)
    const entry = +(quote * (1 + sg * this.r.slipPct / 100)).toFixed(2)
    const opp = B ? pk.low : pk.high
    const riskPct = Math.min(Math.max(Math.abs(entry - opp) / entry * 100, this.r.stopMinPct), this.r.stopMaxPct)
    const risk = entry * riskPct / 100
    const qty = Math.max(1, Math.floor(this.r.riskRs / risk))
    const t = { sym: pk.sym, dir: pk.dir, rvol: pk.rvol, entry, stop: +(entry - sg * risk).toFixed(2), stop0: +(entry - sg * risk).toFixed(2), risk, riskPct: +riskPct.toFixed(2), qty, best: 0, inTs: ts, lastPrice: tick.price }
    this.trades.set(pk.sym, t); this.save()
    return [{ kind: 'entry', trade: t, ts }]
  }
  manage(t, tick, ts, sec) {
    const B = t.dir === 'BUY', sg = B ? 1 : -1, p = tick.price
    t.lastPrice = p
    if (sec >= this.r.squareOff) return [this.close(t, B ? (tick.bid > 0 ? tick.bid : p) : (tick.ask > 0 ? tick.ask : p), 'squareoff', ts)]
    if (B ? p <= t.stop : p >= t.stop) {
      const q = B ? (tick.bid > 0 ? Math.min(tick.bid, p) : p) : (tick.ask > 0 ? Math.max(tick.ask, p) : p)
      return [this.close(t, q, t.best >= 1 ? 'trail' : 'stop', ts)]
    }
    const r = (p - t.entry) * sg / t.risk
    if (r > t.best) {
      t.best = r
      if (t.best >= 1) {
        const ns = +(t.entry + sg * (t.best - 1) * t.risk).toFixed(2)
        if ((ns - t.stop) * sg > 0) { t.stop = ns; this.dirty = true }
      }
    }
    return []
  }
  close(t, quote, reason, ts) {
    const sg = t.dir === 'BUY' ? 1 : -1
    const exit = +(quote * (1 - sg * this.r.slipPct / 100)).toFixed(2)
    const gross = (exit - t.entry) * sg * t.qty
    const cost = t.entry * t.qty * this.r.costPct / 100
    Object.assign(t, { exit, reason, outTs: ts, netRs: Math.round(gross - cost), R: +((gross - cost) / (t.risk * t.qty)).toFixed(2) })
    this.closed.push({ ...t }); this.save(); this.logTrade(t)
    return { kind: 'exit', trade: t, ts }
  }
  logTrade(t) {
    try {
      const f = path.join(this.dataDir, `sip-trades-${this.day}.csv`)
      const head = fs.existsSync(f) ? '' : 'day,symbol,dir,rvol,entry_time,entry,stop0,risk_pct,qty,exit_time,exit,reason,best_R,net_rs,R\n'
      fs.appendFileSync(f, head + [this.day, t.sym, t.dir, t.rvol, istClock(t.inTs), t.entry, t.stop0, t.riskPct, t.qty, istClock(t.outTs), t.exit, t.reason, t.best.toFixed(2), t.netRs, t.R].join(',') + '\n')
    } catch {}
  }
  summary() {
    const n = this.closed.length, net = this.closed.reduce((a, t) => a + t.netRs, 0), w = this.closed.filter((t) => t.netRs > 0).length
    return { n, net, wins: w, picks: this.picks?.length ?? 0, status: this.status }
  }
  // after the close: add today's opening-range volume and turnover to the baseline (keeps the last 10 days)
  updateBaseline() {
    if (!this.or.size || this.baseline.days?.includes(this.day)) return false
    const b = this.baseline; b.first5 ??= {}; b.turnover ??= {}; b.days ??= []
    for (const [sym, o] of this.or) {
      if (o.v0 !== null && o.v1 !== null && o.v1 > o.v0) (b.first5[sym] ??= []).push(o.v1 - o.v0)
      b.first5[sym] = (b.first5[sym] ?? []).slice(-this.r.baselineDays)
    }
    for (const [sym, c] of this.cum) { (b.turnover[sym] ??= []).push(+(c.cum * c.price / 1e7).toFixed(2)); b.turnover[sym] = b.turnover[sym].slice(-this.r.baselineDays) }
    b.days.push(this.day); b.days = b.days.slice(-this.r.baselineDays); b.updated = new Date().toISOString()
    try { fs.writeFileSync(path.join(this.dataDir, 'sip-baseline.json'), JSON.stringify(b)); return true } catch { return false }
  }
}
