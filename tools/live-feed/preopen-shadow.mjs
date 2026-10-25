// preopen-shadow.mjs - VIRTUAL trades from the PRE-OPEN (owner 25 Oct 17:57 "do it"; MONITORING ONLY - no paper trades, no alerts;
// decide next weekend). Question: can the pre-open alone (09:00-09:15 order book) pick winners at 09:15, 5 minutes before our 09:20 picks?
//  SNAPSHOT : the last pre-open values of every stock before 09:15 - indicated open price, total buy qty, total sell qty, prev close.
//  PICK     : liquid stocks (median turnover >= Rs25 cr) with buyers >= 2x sellers (BUY) or sellers >= 2x buyers (SELL);
//             top 10 by imbalance strength. Every candidate >= 1.5x is written to data\preopen-picks-DATE.csv for the study.
//  ENTRY    : virtual, at the stock's first tick from 09:15:00 (offer/bid + 0.02%). Stop 1% (no opening range exists yet). Rs1,000 risk.
//  EXIT     : today's exit rule, same code as the later-entry shadow (trail 1R, smart warning 0.3R, trend back, in-loss 0.3R, 15:15).
// Files: data\preopen-picks-DATE.csv, data\preopen-shadow-DATE.csv, preopen-shadow-state-DATE.json. Never touches live trades.
import fs from 'node:fs'
import { LateShadow, LATE } from './late-shadow.mjs'

export const PRE = { ...LATE, minImb: 2, logImb: 1.5, topK: 10, stopPct: 1, orStart: 9 * 3600 + 15 * 60 }
const istClock = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 19)
const median = (a) => { if (!a?.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

export class PreopenShadow extends LateShadow {
  constructor(o) { super({ ...o, rules: o.rules ?? PRE }); this.snap = new Map() }
  save() { try { fs.writeFileSync(this.file('preopen-shadow-state') + '.json', JSON.stringify({ trades: [...this.trades.values()], picks: this.picks ?? null })) } catch {} }
  restore() { try { const s = JSON.parse(fs.readFileSync(this.file('preopen-shadow-state') + '.json', 'utf8')); for (const t of s.trades ?? []) this.trades.set(t.sym, t); this.picks = s.picks ?? null } catch {} }
  // pre-open ticks (09:00-09:15); fields can arrive in separate messages, so keep the last known value of each
  onPre(sym, tick) {
    const s = this.snap.get(sym) ?? {}
    for (const k of ['price', 'totBuy', 'totSell', 'prevClose', 'cum']) if (tick[k] > 0) s[k] = tick[k]
    this.snap.set(sym, s)
  }
  select() {
    this.picks = []; const cand = []
    for (const [sym, s] of this.snap) {
      if (sym.startsWith('NIFTY') || !(s.totBuy > 0 && s.totSell > 0 && s.price > 0)) continue
      if (!(median(this.baseline?.turnover?.[sym]) >= this.r.minTurnoverCr)) continue
      const imb = s.totBuy / s.totSell, pc = s.prevClose > 0 ? s.prevClose : this.baseline?.lastClose?.[sym]
      const gap = pc > 0 ? +((s.price / pc - 1) * 100).toFixed(2) : null
      const dir = imb >= this.r.logImb ? 'BUY' : imb <= 1 / this.r.logImb ? 'SELL' : null
      if (!dir) continue
      cand.push({ sym, dir, imb: +imb.toFixed(2), strength: Math.abs(Math.log(imb)), gap, price: s.price, totBuy: s.totBuy, totSell: s.totSell })
    }
    cand.sort((a, b) => b.strength - a.strength)
    const strong = cand.filter((c) => c.strength >= Math.log(this.r.minImb))
    this.picks = strong.slice(0, this.r.topK).map((c) => ({ ...c, gapAgree: c.gap == null ? null : (c.gap > 0) === (c.dir === 'BUY') }))
    const chosen = new Set(this.picks.map((p) => p.sym))
    for (const c of cand) this.csv('preopen-picks', 'day,symbol,dir,buy_sell_ratio,indicated_gap_pct,indicated_price,total_buy,total_sell,virtual_trade',
      [this.day, c.sym, c.dir, c.imb, c.gap ?? '', c.price, c.totBuy, c.totSell, chosen.has(c.sym) ? 'yes' : 'no'])
    if (!this.snap.size) this.csv('preopen-picks', 'day,symbol,dir,buy_sell_ratio,indicated_gap_pct,indicated_price,total_buy,total_sell,virtual_trade', [this.day, 'NO PRE-OPEN DATA RECEIVED', '', '', '', '', '', '', ''])
    this.save()
  }
  onTick(sym, tick, ts, m, squareOff) {
    if (this.picks == null) this.select()
    if (sym.startsWith('NIFTY')) return
    const t = this.trades.get(sym)
    if (squareOff) { if (t && !t.exit) this.close(t, tick.price, 'squareoff', ts); return }
    if (!t) {
      const pk = this.picks.find((p) => p.sym === sym)
      if (pk && !this.entered?.has(sym)) { (this.entered ??= new Set()).add(sym); this.open(pk, tick, ts) }
      return
    }
    if (t.exit) return
    const x = this.sw.sym.get(sym); if (!x) { this.manage(t, tick, ts); return }
    const n = x.bars.length, newBar = n !== (this.seen.get(sym) ?? 0)
    this.seen.set(sym, n)
    this.manage(t, tick, ts); if (newBar && !t.exit) this.smart(t, x, m)
  }
  open(pk, tick, ts) {
    const B = pk.dir === 'BUY', sg = B ? 1 : -1
    const quote = B ? (tick.ask > 0 ? tick.ask : tick.price) : (tick.bid > 0 ? tick.bid : tick.price)
    const entry = +(quote * (1 + sg * this.r.slipPct / 100)).toFixed(2), risk = entry * this.r.stopPct / 100
    const t = { sym: pk.sym, dir: pk.dir, imb: pk.imb, gap: pk.gap, gapAgree: pk.gapAgree, entry, stop: +(entry - sg * risk).toFixed(2), stop0: +(entry - sg * risk).toFixed(2),
      risk, riskPct: this.r.stopPct, qty: Math.max(1, Math.floor(this.r.riskRs / risk)), best: 0, inTs: ts, inMin: new Date(ts + 330 * 60_000).toISOString().slice(11, 16),
      bookAtEntry: pk.totBuy / pk.totSell, lastPrice: tick.price, tight: false, warns: 0, signs: [], score: 0, ruleOk: true }
    this.trades.set(pk.sym, t); this.save()
  }
  close(t, quote, reason, ts) {
    const sg = t.dir === 'BUY' ? 1 : -1
    const exit = +(quote * (1 - sg * this.r.slipPct / 100)).toFixed(2)
    const gross = (exit - t.entry) * sg * t.qty, cost = t.entry * t.qty * this.r.costPct / 100
    Object.assign(t, { exit, reason, outTs: ts, netRs: Math.round(gross - cost), R: +((gross - cost) / (t.risk * t.qty)).toFixed(2) })
    this.save()
    this.csv('preopen-shadow', 'day,symbol,dir,buy_sell_ratio,indicated_gap_pct,gap_agrees,entry_time,entry,stop0,qty,exit_time,exit,reason,best_R,warnings,net_rs,R',
      [this.day, t.sym, t.dir, t.imb, t.gap ?? '', t.gapAgree == null ? '' : t.gapAgree ? 'yes' : 'no', istClock(t.inTs), t.entry, t.stop0, t.qty, istClock(ts), t.exit, reason, t.best.toFixed(2), t.warns, t.netRs, t.R])
  }
  summary() {
    const c = [...this.trades.values()].filter((t) => t.exit)
    return { picks: this.picks?.length ?? 0, n: c.length, wins: c.filter((t) => t.netRs > 0).length, net: c.reduce((a, t) => a + t.netRs, 0), gotData: this.snap.size > 0 || (this.picks?.length ?? 0) > 0 }
  }
}
