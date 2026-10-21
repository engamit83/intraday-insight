// run-r21.mjs - 21 Oct 2026 R&D: which PREDICTION rule changes raise the share of picks that reach their target
// (before 15:15 and before the normal stop) on all ~494 stocks? Also shows net Rs after costs. Variants fixed before running.
// Usage: node --experimental-strip-types tools/backtest/run-r21.mjs <hist500 5-min json>
import { readFileSync } from 'node:fs'
import { runBacktest } from './backtest.mjs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const minDay = process.argv[3] ?? '2026-10-12'
for (const v of Object.values(data.results)) if (v.candles) v.candles = v.candles.filter((c) => c[0].slice(0, 10) >= minDay)
const byDay = {}
for (const [s, v] of Object.entries(data.results)) {
  if (!v.candles) continue
  byDay[s] = {}
  for (const [t, , h, l] of v.candles) (byDay[s][t.slice(0, 10)] ??= []).push({ b: t.slice(11, 16), h, l })
  for (const d of Object.values(byDay[s])) d.sort((a, b) => (a.b < b.b ? -1 : 1))
}
const bucket5 = (b) => { const m = +b.slice(0, 2) * 60 + +b.slice(3, 5) - 555; const k = Math.floor(m / 5) * 5 + 555; return `${String(Math.floor(k / 60)).padStart(2, '0')}:${String(k % 60).padStart(2, '0')}` }
function reached(t) {
  const init = t.direction === 'BUY' ? t.signalPrice - t.stopDist : t.signalPrice + t.stopDist
  for (const c of byDay[t.symbol]?.[t.day] ?? []) {
    const b = bucket5(c.b)
    if (b < t.entryTime || b >= '15:15') continue
    if (t.direction === 'BUY' ? c.l <= init : c.h >= init) return false
    if (t.direction === 'BUY' ? c.h >= t.target : c.l <= t.target) return true
  }
  return false
}
const live = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1, volMode: 'either', lockProfit: true, trailAtrMult: 1.5,
  maxPerSector: 1, trailAfterR: 1 }
const ALLC = process.env.ALLC === '1'
const V0 = [
  ['P0 live rules today (v4.1)', live],
  ['P1 rank = stocks in play (volume x usual move x strength)', { ...live, rankBy: 'inPlay' }],
  ['P2 no chase: <= 0.5 ATR beyond yesterday level', { ...live, maxChaseAtr: 0.5 }],
  ['P3 not stretched: <= 1.5 ATR from VWAP', { ...live, maxVwapAtr: 1.5 }],
  ['P4 trend days only: market moved >= 0.3%', { ...live, minBreadthAbs: 0.3 }],
  ['P5 realistic target 1R (stop x1)', { ...live, rewardRisk: 1 }],
  ['P6 quick move target 0.5%', { ...live, targetPct: 0.5 }],
  ['P7 quick move target 0.75%', { ...live, targetPct: 0.75 }],
  ['P8 = P1+P2+P3', { ...live, rankBy: 'inPlay', maxChaseAtr: 0.5, maxVwapAtr: 1.5 }],
  ['P9 = P8 + quick target 0.75%', { ...live, rankBy: 'inPlay', maxChaseAtr: 0.5, maxVwapAtr: 1.5, targetPct: 0.75 }],
  ['P10 = P8 + trend days + 1R', { ...live, rankBy: 'inPlay', maxChaseAtr: 0.5, maxVwapAtr: 1.5, minBreadthAbs: 0.3, rewardRisk: 1 }],
]
const V = ALLC ? V0.map(([n, o]) => [n + ' [ALL candidates]', { ...o, maxTradesPerDay: null, topN: 1000, maxOpen: 1000, maxPerSector: null }]) : V0
console.log('variant | picks | target reached % | wins % | net Rs (Rs 1 lakh/trade, after costs) | by day reached%')
for (const [name, o] of V) {
  const r = runBacktest(data, o)
  const days = r.days.slice(3)
  const tr = r.trades.filter((t) => days.includes(t.day))
  const rc = tr.map(reached)
  const net = Math.round(tr.reduce((a, t) => a + (t.netPct / 100) * (t.notional ?? 100000), 0))
  const per = days.map((d) => { const x = tr.map((t, i) => [t, rc[i]]).filter(([t]) => t.day === d); return `${d.slice(5)} ${x.length ? Math.round(x.filter((y) => y[1]).length / x.length * 100) : '-'}%/${x.length}` }).join(' ')
  console.log(`${name} | ${tr.length} | ${tr.length ? Math.round(rc.filter(Boolean).length / tr.length * 100) : '-'}% | ${tr.length ? Math.round(tr.filter((t) => t.netPct > 0).length / tr.length * 100) : '-'}% | ${net} | ${per}`)
}
