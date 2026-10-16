// run-range.mjs - 16 Oct: owner's RANGE idea (rule C7): stocks that move between X and Y many times a day; buy near X,
// sell near Y, both directions, until the range breaks. Same-day detection only (no multi-day list yet).
// Detection at each 5-min close from 10:30: the last `lookback` candles form a band [lo, hi] with width between
// minW% and maxW%, >= 2 touches near the top and >= 2 near the bottom, and VWAP inside the middle half (flat-ish).
// Entry: BUY when the candle closed in the bottom `zone` of the band and was green (rejection); SELL mirror at the top.
// Exit: target = other edge minus `zone` of the band; stop = band edge -/+ `stopOut` of the band; breakout close outside
// the band -> exit next open; 15:15 square-off. Max `maxTrips` entries per stock per day; stop trading the stock after a stop-out.
// Fill at the next candle's open + slippage; full costs. Usage: node --experimental-strip-types tools/backtest/run-range.mjs <5min.json>
import { readFileSync } from 'node:fs'
import { prepare, roundTripCostPct, DEFAULTS } from './backtest.mjs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const { stocks, days } = prepare(data)
const cost = roundTripCostPct(DEFAULTS.costs), slip = DEFAULTS.slippagePct / 100
function run(p) {
  const trades = []
  for (const day of days.slice(3)) {
    for (const [sym, all] of Object.entries(stocks)) {
      const list = all.filter((c) => c.day === day)
      if (list.length < 40) continue
      let pv = 0, vv = 0
      const vwap = list.map((c) => { pv += ((c.high + c.low + c.close) / 3) * c.volume; vv += c.volume; return vv ? pv / vv : c.close })
      let pos = null, trips = 0, stopped = false
      for (let j = 0; j < list.length - 1; j++) {
        const c = list[j], nx = list[j + 1]
        if (pos) {
          // manage on this candle
          const B = pos.dir === 'BUY'
          let px = null, why = null
          if (c.bucket >= '15:15') { px = c.open; why = 'squareoff' }
          else if (B ? c.low <= pos.stop : c.high >= pos.stop) { px = B ? Math.min(c.open, pos.stop) : Math.max(c.open, pos.stop); why = 'stop' }
          else if (B ? c.high >= pos.target : c.low <= pos.target) { px = pos.target; why = 'target' }
          else if (B ? c.close < pos.lo * (1 - p.breakBuf / 100) : c.close > pos.hi * (1 + p.breakBuf / 100)) { px = nx.open; why = 'rangebreak' }
          if (px !== null) {
            const exit = why === 'target' ? px : B ? px * (1 - slip) : px * (1 + slip)
            const g = B ? (exit / pos.entry - 1) * 100 : (1 - exit / pos.entry) * 100
            trades.push({ day, sym, dir: pos.dir, why, net: g - cost, bandPct: pos.bandPct })
            if (why === 'stop') stopped = true
            pos = null
          }
          continue
        }
        if (stopped || trips >= p.maxTrips || c.bucket < '10:30' || nx.bucket > '14:30' || j < p.lookback) continue
        const win = list.slice(j - p.lookback + 1, j + 1)
        const hi = Math.max(...win.map((x) => x.high)), lo = Math.min(...win.map((x) => x.low)), band = hi - lo, bandPct = band / lo * 100
        if (bandPct < p.minW || bandPct > p.maxW) continue
        const zone = band * p.zone
        const topT = win.filter((x) => x.high >= hi - zone).length, botT = win.filter((x) => x.low <= lo + zone).length
        if (topT < 2 || botT < 2) continue
        if (vwap[j] < lo + band * 0.25 || vwap[j] > hi - band * 0.25) continue
        let dir = null
        if (c.close <= lo + zone && c.close > c.open) dir = 'BUY'
        if (c.close >= hi - zone && c.close < c.open) dir = 'SELL'
        if (!dir) continue
        const B = dir === 'BUY'
        const entry = B ? nx.open * (1 + slip) : nx.open * (1 - slip)
        pos = { dir, entry, lo, hi, bandPct, target: B ? hi - zone : lo + zone, stop: B ? lo - band * p.stopOut : hi + band * p.stopOut }
        trips++
      }
    }
  }
  return trades
}
const base = { lookback: 12, minW: 0.8, maxW: 2.5, zone: 0.15, stopOut: 0.25, breakBuf: 0.1, maxTrips: 2 }
const variants = [
  ['range: 1-hour band 0.8-2.5%, 2 trips', base],
  ['range: band >= 1.0%', { ...base, minW: 1.0 }],
  ['range: 1.5-hour band', { ...base, lookback: 18 }],
  ['range: tighter entry zone (10%)', { ...base, zone: 0.10 }],
  ['range: 1 trip only', { ...base, maxTrips: 1 }],
]
for (const [n, p] of variants) {
  const t = run(p)
  const sum = (a) => a.reduce((x, y) => x + y.net, 0)
  const wins = t.filter((x) => x.net > 0).length
  const newD = t.filter((x) => x.day >= '2026-10-08'), oldD = t.filter((x) => x.day < '2026-10-08')
  const by = (w) => t.filter((x) => x.why === w).length
  console.log(`${n}: ${t.length} trades, win ${t.length ? Math.round(wins / t.length * 100) : 0}%, per trade ${t.length ? (sum(t) / t.length).toFixed(3) : 0}%, net Rs ${Math.round(sum(t) * 1000)} (old Rs ${Math.round(sum(oldD) * 1000)}, new Rs ${Math.round(sum(newD) * 1000)}) | target ${by('target')} stop ${by('stop')} break ${by('rangebreak')} 15:15 ${by('squareoff')}`)
}
