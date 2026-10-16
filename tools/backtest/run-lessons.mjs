// run-lessons.mjs - 16 Oct: lessons from the first paper day + v5 setups, compared with live rule set v4.
// Variants were fixed BEFORE running. Judged on days the v4 rules were NOT tuned on ("new days", from 8 Oct)
// and on all tested days; a change is only worth keeping if it helps on the new days too.
// Usage: node --experimental-strip-types tools/backtest/run-lessons.mjs <history.json> [firstNewDay=2026-10-08]
import { readFileSync } from 'node:fs'
import { runBacktest, summarize } from './backtest.mjs'

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const firstNew = process.argv[3] ?? '2026-10-08'

// live rule set v4 (the same options the live/paper match tests use)
const v4 = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1, volMode: 'either', lockProfit: true, trailAtrMult: 1.5, dailyLossLimitRs: 2000 }

const variants = [
  ['L0 v4 (live today)', v4],
  // lessons from 16 Oct
  ['L1 one stock per sector', { ...v4, maxPerSector: 1 }],
  ['L2 entries 09:45-13:30', { ...v4, noEntryBefore: '09:45', noEntryAfter: '13:30' }],
  ['L3 trail only after +1R (stop above entry always covers costs)', { ...v4, trailAfterR: 1 }],
  ['L4 skip choppy market (avg stock within +/-0.2% of open)', { ...v4, minBreadthAbs: 0.2 }],
  ['L5 book half at +1R, trail the rest', { ...v4, partialAtR: 1 }],
  ['L6 equal risk Rs 500 per trade', { ...v4, riskRs: 500 }],
  ['L7 = L1+L2+L3', { ...v4, maxPerSector: 1, noEntryBefore: '09:45', noEntryAfter: '13:30', trailAfterR: 1 }],
  ['L8 = L1+L3+L4', { ...v4, maxPerSector: 1, trailAfterR: 1, minBreadthAbs: 0.2 }],
  // v5 setups (same market filter, relative strength, volume, exits and limits as v4)
  ['S1 VWAP pullback in trend', { ...v4, setup: 'vwapPullback', prevDayLevels: false }],
  ['S2 VWAP pullback + beyond yesterday high/low', { ...v4, setup: 'vwapPullback' }],
  ['S3 opening-range (30 min) breakout', { ...v4, setup: 'orb', openingRangeMin: 30, prevDayLevels: false, noEntryBefore: '09:45' }],
  ['S4 opening-range (15 min) breakout', { ...v4, setup: 'orb', openingRangeMin: 15, prevDayLevels: false, noEntryBefore: '09:30' }],
  ['S5 30-min ORB + beyond yesterday high/low', { ...v4, setup: 'orb', openingRangeMin: 30, noEntryBefore: '09:45' }],
]

const all = runBacktest(data, v4).days
const tested = all.slice(3) // the first days only warm up the volume averages
const isNew = (d) => d >= firstNew
console.log(`${data.interval}: ${tested.length} tested days ${tested[0]}..${tested.at(-1)}; new days (not used to build v4): ${tested.filter(isNew).length}`)
console.log('variant | trades | win% | avg win% | avg loss% | NET exp%/trade | net Rs ALL | max DD Rs | green days | net Rs OLD days | net Rs NEW days | trades NEW | exits T/S/BE/L/sq')
for (const [name, opts] of variants) {
  const r = runBacktest(data, opts)
  const t = r.trades.filter((x) => tested.includes(x.day))
  const s = summarize(t, r.options)
  if (!s.trades) { console.log(`${name} | 0`); continue }
  const tn = t.filter((x) => isNew(x.day)), to = t.filter((x) => !isNew(x.day))
  const sn = summarize(tn, r.options), so = summarize(to, r.options)
  const e = s.exits
  console.log([name, s.trades, s.winRatePct, s.avgWinPct, s.avgLossPct, s.netExpectancyPct, s.totalNetRupees, s.maxDrawdownRupees, `${s.greenDays}/${s.daysTraded}`,
    so.totalNetRupees ?? 0, sn.totalNetRupees ?? 0, sn.trades ?? 0, `${e.target}/${e.stop}/${e.breakeven}/${e.lockedstop}/${e.squareoff}`].join(' | '))
}
