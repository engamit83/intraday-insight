// run-revisit.mjs - second look at the rules that were ruled out, reframed the way a trader would use them.
// Base = rule set v3 (incl. today's volume >= 1.2x usual). Variants fixed before running.
// Usage: node --experimental-strip-types tools/backtest/run-revisit.mjs <history.json>
import { readFileSync } from 'node:fs'
import { runBacktest, summarize } from './backtest.mjs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const v3 = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1, dayRvolMin: 1.2 }
const orMin = data.interval === '30minute' ? 30 : 15
const variants = [
  ['R0 v3', v3],
  ['R1 + time stop LOSERS ONLY after 60 min', { ...v3, timeStopMin: 60, timeStopLosersOnly: true }],
  ['R2 + time stop LOSERS ONLY after 120 min', { ...v3, timeStopMin: 120, timeStopLosersOnly: true }],
  ['R3 + time stop (all) after 180 min', { ...v3, timeStopMin: 180 }],
  ['R4 + above/below today\'s open (gap held)', { ...v3, aboveDayOpen: true }],
  ['R5 + no entries after 14:30', { ...v3, noEntryAfter: '14:30' }],
  ['R6 + no entries after 14:00', { ...v3, noEntryAfter: '14:00' }],
  [`R7 levels: yesterday high/low OR ${orMin}-min opening range`, { ...v3, openingRangeMin: orMin, levelsEither: true }],
  [`R8 + ${orMin}-min opening range as well`, { ...v3, openingRangeMin: orMin }],
  ['R9 + daily loss limit Rs 2,000', { ...v3, dailyLossLimitRs: 2000 }],
]
const days = runBacktest(data, v3).days
const tested = days.slice(days.length > 10 ? 4 : 2) // compare on days where volume history exists
const half = new Set(tested.slice(0, Math.floor(tested.length / 2)))
console.log(`${data.interval}: compared on ${tested.length} days (${tested[0]} to ${tested.at(-1)})`)
console.log('variant | trades | win% | NET exp% | net Rs | max DD Rs | green days | 1st half Rs | 2nd half Rs')
for (const [name, opts] of variants) {
  const r = runBacktest(data, opts)
  const t = r.trades.filter((x) => tested.includes(x.day))
  const s = summarize(t, r.options)
  if (!s.trades) { console.log(name + ' | 0'); continue }
  const h1 = summarize(t.filter((x) => half.has(x.day)), r.options).totalNetRupees ?? 0
  const h2 = summarize(t.filter((x) => !half.has(x.day)), r.options).totalNetRupees ?? 0
  console.log([name, s.trades, s.winRatePct, s.netExpectancyPct, s.totalNetRupees, s.maxDrawdownRupees, `${s.greenDays}/${tested.length}`, h1, h2].join(' | '))
}
