// run-predict.mjs - 21 Oct 2026, owner's R&D question: "how well do our rules PREDICT?" on all ~494 stocks.
// THE measure (intent 5/7c): after the entry, did the price reach the TARGET before 15:15 and before the NORMAL (initial) stop?
// Two views: LIVE = the live v4.1 picking (top 3 per decision, max 10/day, 1 per sector); ALL = every stock the rules accept
// (one per stock per day, no daily caps) - shows the rules' raw predictive power. Grouped by price band, usual move and sector.
// Usage: node --experimental-strip-types tools/backtest/run-predict.mjs <hist part files...>
import { readFileSync } from 'node:fs'
import { runBacktest } from './backtest.mjs'
import { SECTOR } from '../../supabase/functions/_shared/sectors.ts'

const files = process.argv.slice(2)
const data = { interval: null, results: {} }
for (const f of files) { const d = JSON.parse(readFileSync(f, 'utf8')); data.interval = d.interval; Object.assign(data.results, d.results) }

const v41 = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1, volMode: 'either', lockProfit: true, trailAtrMult: 1.5, dailyLossLimitRs: 2000,
  maxPerSector: 1, trailAfterR: 1 }
const all = { ...v41, maxTradesPerDay: null, topN: 1000, maxOpen: 1000, maxPerSector: null, dailyLossLimitRs: null }

// candles per symbol/day for the "target before normal stop" check
const byDay = {}
for (const [s, v] of Object.entries(data.results)) {
  if (!v.candles) continue
  byDay[s] = {}
  for (const [t, o, h, l, c] of v.candles) {
    const day = t.slice(0, 10), bucket = t.slice(11, 16)
    ;(byDay[s][day] ??= []).push({ bucket, h, l, c })
  }
  for (const d of Object.values(byDay[s])) d.sort((a, b) => (a.bucket < b.bucket ? -1 : 1))
}
// usual daily move % per stock (average high-low range of its days)
const usualMove = {}
for (const [s, days] of Object.entries(byDay)) {
  const r = Object.values(days).filter((d) => d.length > 30).map((d) => (Math.max(...d.map((x) => x.h)) / Math.min(...d.map((x) => x.l)) - 1) * 100)
  usualMove[s] = r.length ? r.reduce((a, b) => a + b, 0) / r.length : null
}
function judge(t) {
  const init = t.direction === 'BUY' ? t.signalPrice - t.stopDist : t.signalPrice + t.stopDist
  let best = 0
  for (const c of byDay[t.symbol]?.[t.day] ?? []) {
    if (c.bucket < t.entryTime || c.bucket >= '15:15') continue
    const hitStop = t.direction === 'BUY' ? c.l <= init : c.h >= init
    const hitTgt = t.direction === 'BUY' ? c.h >= t.target : c.l <= t.target
    const fav = t.direction === 'BUY' ? c.h - t.entry : t.entry - c.l
    best = Math.max(best, fav / Math.abs(t.target - t.entry))
    if (hitStop) return { reached: false, best } // same candle = stop first (conservative)
    if (hitTgt) return { reached: true, best: 1 }
  }
  return { reached: false, best }
}
const band = (p) => (p < 200 ? 'Rs <200' : p < 500 ? 'Rs 200-500' : p < 2000 ? 'Rs 500-2000' : 'Rs 2000+')
const moveBand = (m) => (m === null ? '?' : m < 1.5 ? 'usual move <1.5%' : m < 2.5 ? 'usual move 1.5-2.5%' : m < 4 ? 'usual move 2.5-4%' : 'usual move 4%+')
function report(name, opts) {
  const r = runBacktest(data, opts)
  const days = r.days.slice(3) // first days only warm up volume averages
  const tr = r.trades.filter((t) => days.includes(t.day)).map((t) => ({ ...t, ...judge(t) }))
  const pct = (a) => (a.length ? Math.round((a.filter((x) => x.reached).length / a.length) * 100) : '-')
  console.log(`\n=== ${name}: ${tr.length} predictions on ${days.length} days (${days[0]}..${days.at(-1)}) -> target reached ${pct(tr)}% ; net Rs ${Math.round(tr.reduce((a, t) => a + (t.netPct / 100) * (t.notional ?? 100000), 0))}`)
  const group = (label, key) => {
    const g = {}
    for (const t of tr) (g[key(t)] ??= []).push(t)
    console.log(`  by ${label}: ` + Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `${k} ${pct(v)}% (${v.length})`).join(' | '))
  }
  group('day', (t) => t.day)
  group('side', (t) => t.direction)
  group('price band', (t) => band(t.entry))
  group('usual daily move', (t) => moveBand(usualMove[t.symbol]))
  group('sector', (t) => SECTOR[t.symbol] ?? 'other')
  return tr
}
console.log(`${data.interval}: ${Object.keys(data.results).length} stocks`)
report('LIVE v4.1 picking (top 3, max 10/day, 1 per sector)', v41)
report('ALL candidates the rules accept (no caps)', all)
