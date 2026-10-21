// run-r21b.mjs - 21 Oct 2026, owner's "do it": the 5 prediction improvements tested on all ~494 stocks.
// Judge (intent 5): target reached before 15:15 and before the normal stop; plus net Rs after costs, per day.
// Usage: node --experimental-strip-types tools/backtest/run-r21b.mjs <hist500 5-min json> [ALL=1 env for every candidate]
import { readFileSync } from 'node:fs'
import { runBacktest } from './backtest.mjs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
for (const v of Object.values(data.results)) if (v.candles) v.candles = v.candles.filter((c) => c[0].slice(0, 10) >= '2026-10-12')
const byDay = {}
for (const [s, v] of Object.entries(data.results)) {
  if (!v.candles) continue
  byDay[s] = {}
  for (const [t, , h, l] of v.candles) (byDay[s][t.slice(0, 10)] ??= []).push({ b: t.slice(11, 16), h, l })
  for (const d of Object.values(byDay[s])) d.sort((a, b) => (a.b < b.b ? -1 : 1))
}
const b5 = (b) => { const m = +b.slice(0, 2) * 60 + +b.slice(3, 5) - 555; const k = Math.floor(m / 5) * 5 + 555; return `${String(Math.floor(k / 60)).padStart(2, '0')}:${String(k % 60).padStart(2, '0')}` }
function reached(t) {
  const init = t.direction === 'BUY' ? t.signalPrice - t.stopDist : t.signalPrice + t.stopDist
  for (const c of byDay[t.symbol]?.[t.day] ?? []) {
    const b = b5(c.b)
    if (b < t.entryTime || b >= '15:15') continue
    if (t.direction === 'BUY' ? c.l <= init : c.h >= init) return false
    if (t.direction === 'BUY' ? c.h >= t.target : c.l <= t.target) return true
  }
  return false
}
const live = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1, volMode: 'either', lockProfit: true, trailAtrMult: 1.5, maxPerSector: 1, trailAfterR: 1, volDays: 2 }
const T1 = { trendDayPct: 0.3 }, G2 = { minGapPct: 0.5 }, S3 = { sectorRS: true }, P4 = { setup: 'vwapPullback' }, X5 = { targetPct: 1, stopPct: 0.65, lockAtPct: 0.5, lockToPct: 0.25, lockProfit: false, trailAtrMult: null }
const V0 = [
  ['Q0 live rules today (v4.1)', live],
  ['Q1 + market trend day (avg stock >=0.3% our way and still going)', { ...live, ...T1 }],
  ['Q2 + gap >=0.5% our way and held', { ...live, ...G2 }],
  ['Q3 + stronger/weaker than its sector', { ...live, ...S3 }],
  ['Q4 pullback entry (dip to VWAP and bounce) instead of breakout', { ...live, ...P4 }],
  ['Q5 target 1% / stop 0.65% / lock +0.25% after +0.5%', { ...live, ...X5 }],
  ['Q6 = Q1+Q3+Q5', { ...live, ...T1, ...S3, ...X5 }],
  ['Q7 = Q1+Q2+Q3+Q5', { ...live, ...T1, ...G2, ...S3, ...X5 }],
  ['Q8 = Q1+Q4+Q5 (trend day + pullback)', { ...live, ...T1, ...P4, ...X5 }],
  ['Q9 = Q1+Q3+Q4+Q5 + no chase', { ...live, ...T1, ...S3, ...P4, ...X5, maxChaseAtr: 0.5 }],
  ['Q10 = Q2+Q5 (gap held + 1% target, 0.65% stop, lock)', { ...live, ...G2, ...X5 }],
  ['Q11 = Q2 + gap >=1%', { ...live, minGapPct: 1 }],
  ['Q12 = Q2 + no chase', { ...live, ...G2, maxChaseAtr: 0.5 }],
]
const ALL = process.env.ALL === '1'
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null
const V1 = ALL ? V0.map(([n, o]) => [n, { ...o, maxTradesPerDay: null, topN: 1000, maxOpen: 1000, maxPerSector: null }]) : V0
console.log(`${ALL ? 'EVERY candidate' : 'LIVE picking (top 3, max 10/day, 1 per sector)'} | judged days 14,15,16,19 Oct | 494 stocks`)
console.log('rule | picks | target reached % | winners % | net Rs (Rs 1 lakh per trade, after costs) | per day: reached%/picks')
const V = ONLY ? V1.filter(([n]) => ONLY.test(n)) : V1
for (const [name, o] of V) {
  const r = runBacktest(data, o)
  const days = r.days.slice(2)
  const tr = r.trades.filter((t) => days.includes(t.day))
  const rc = tr.map(reached)
  const net = Math.round(tr.reduce((a, t) => a + (t.netPct / 100) * (t.notional ?? 100000), 0))
  const per = days.map((d) => { const x = tr.map((t, i) => [t, rc[i]]).filter(([t]) => t.day === d); return `${d.slice(8)}: ${x.length ? Math.round(x.filter((y) => y[1]).length / x.length * 100) + '%' : '-'}/${x.length}` }).join('  ')
  console.log(`${name} | ${tr.length} | ${tr.length ? Math.round(rc.filter(Boolean).length / tr.length * 100) : '-'}% | ${tr.length ? Math.round(tr.filter((t) => t.netPct > 0).length / tr.length * 100) : '-'}% | ${net} | ${per}`)
}
