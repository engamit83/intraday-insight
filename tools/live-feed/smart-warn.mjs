// smart-warn.mjs - SMART EXIT WARNING for stocks-in-play trades (owner 23 Oct 12:05: "do it now, keep as warning, test live").
// ALERT ONLY - never closes a trade. Separate from the trailing stop (which stays). Judged on closed 1-minute bars built from ticks,
// plus the order book. For a SELL trade it looks for evidence that BUYERS have taken over (BUY trade = mirror):
//  1 flow   : last 5 min, volume on up-ticks >= 1.5x volume on down-ticks (aggressive buyers)
//  2 book   : total buy qty / total sell qty now >= 1.3x what it was at entry, and > 1 (more buyers waiting)
//  3 volume : last 3 closed bars moved against us on higher average volume than the trade's bars so far
//  4 vwap   : price closed back on the wrong side of the day's VWAP
//  5 lows   : higher lows on the last 3 bars (SELL) / lower highs (BUY) - structure turning
//  6 market : Nifty moved >= 0.15% against us over the last 5 minutes
// WARN: once the trade has been >= +1R, 3 signs are enough (protect profit). Before that, early dips are normal: need 4 signs AND real
// order-flow evidence (flow or book). Never in the first 3 minutes. At most once per trade per 10 minutes.
export const SMART = { minScore: 3, minScoreEarly: 4, graceMin: 3, flowX: 1.5, bookX: 1.3, niftyPct: 0.15, repeatMin: 10 }

export class SmartWarn {
  constructor(rules = SMART) { this.r = rules; this.sym = new Map(); this.lastWarn = new Map() }
  st(s) { let x = this.sym.get(s); if (!x) { x = { bars: [], cur: null, lastPrice: null, lastCum: null, pv: 0, v: 0, upV: [], dnV: [], book: null }; this.sym.set(s, x) } return x }
  // tick: minute 'HH:MM', price, cum (day volume)
  onTick(s, minute, price, cum) {
    const x = this.st(s)
    const dv = Number.isFinite(cum) && x.lastCum != null ? Math.max(0, cum - x.lastCum) : 0
    if (Number.isFinite(cum)) x.lastCum = cum
    const closed = []
    if (!x.cur || x.cur.m !== minute) { if (x.cur) { x.bars.push(x.cur); closed.push(x.cur) } x.cur = { m: minute, o: price, h: price, l: price, c: price, v: 0, up: 0, dn: 0 } }
    const b = x.cur
    b.h = Math.max(b.h, price); b.l = Math.min(b.l, price); b.c = price; b.v += dv
    if (x.lastPrice != null) { if (price > x.lastPrice) b.up += dv; else if (price < x.lastPrice) b.dn += dv }
    x.lastPrice = price; x.pv += price * dv; x.v += dv
    b.vwap = x.v > 0 ? x.pv / x.v : price
    return closed.length
  }
  onBook(s, totBuy, totSell) { if (totBuy > 0 && totSell > 0) this.st(s).book = totBuy / totSell }
  // trade: { sym, dir, entry, risk, inMin:'HH:MM', bookAtEntry }
  evaluate(t, minute) {
    const x = this.sym.get(t.sym); if (!x) return null
    const sg = t.dir === 'BUY' ? 1 : -1
    const bars = x.bars.filter((b) => b.m >= t.inMin)
    if (bars.length < this.r.graceMin) return null
    const last = bars.at(-1), l5 = bars.slice(-5), l3 = bars.slice(-3)
    const upV = l5.reduce((a, b) => a + b.up, 0), dnV = l5.reduce((a, b) => a + b.dn, 0)
    const against = sg > 0 ? dnV : upV, withUs = sg > 0 ? upV : dnV
    const avgV = bars.reduce((a, b) => a + b.v, 0) / bars.length
    const l3move = (l3.at(-1).c - l3[0].o) * sg
    const signs = {
      flow: against >= this.r.flowX * Math.max(withUs, 1),
      book: t.bookAtEntry && x.book ? (sg < 0 ? x.book >= this.r.bookX * t.bookAtEntry && x.book > 1 : x.book <= t.bookAtEntry / this.r.bookX && x.book < 1) : false,
      volume: l3.length === 3 && l3move < 0 && l3.reduce((a, b) => a + b.v, 0) / 3 > avgV,
      vwap: (last.c - last.vwap) * sg < 0,
      lows: l3.length === 3 && (sg < 0 ? l3[0].l < l3[1].l && l3[1].l < l3[2].l : l3[0].h > l3[1].h && l3[1].h > l3[2].h),
      market: false,
    }
    const n = this.sym.get('NIFTY')
    if (n && n.bars.length >= 6) { const nb = n.bars.slice(-6); const ch = (nb.at(-1).c / nb[0].c - 1) * 100; signs.market = ch * sg <= -this.r.niftyPct }
    const score = Object.values(signs).filter(Boolean).length
    const R = (last.c - t.entry) * sg / t.risk
    const best = Math.max(0, ...bars.map((b) => ((sg > 0 ? b.h : b.l) - t.entry) * sg / t.risk))
    const inProfit = best >= 1
    if (inProfit ? score < this.r.minScore : (score < this.r.minScoreEarly || !(signs.flow || signs.book))) return null
    const lw = this.lastWarn.get(t.sym)
    const mins = (m) => +m.slice(0, 2) * 60 + +m.slice(3, 5)
    if (lw && mins(minute) - mins(lw) < this.r.repeatMin) return null
    this.lastWarn.set(t.sym, minute)
    return { sym: t.sym, dir: t.dir, minute: last.m, price: last.c, R: +R.toFixed(2), best: +best.toFixed(2), mode: inProfit ? 'protect profit' : 'early danger', score, signs: Object.keys(signs).filter((k) => signs[k]) }
  }
}
export const SIGN_TXT = { flow: 'aggressive counter-trades', book: 'order book turned against us', volume: 'counter-move on rising volume', vwap: 'back through VWAP', lows: 'structure turning', market: 'Nifty turning against us' }
