// run-volume-strength.mjs <history.json> [fromDay] - how strict should the volume rule be? (on top of rule set v3)
import { readFileSync } from 'node:fs'
import { runBacktest, summarize } from './backtest.mjs'
const v3 = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1 }
const V = [['no volume rule', {}], ['day vol >= 1.0x', { dayRvolMin: 1.0 }], ['day vol >= 1.2x (v3)', { dayRvolMin: 1.2 }], ['day vol >= 1.5x', { dayRvolMin: 1.5 }], ['day vol >= 2.0x', { dayRvolMin: 2.0 }], ['day >= 1.2x AND this candle >= 1.0x', { dayRvolMin: 1.2, todRvolMin: 1.0 }], ['day >= 1.2x AND this candle >= 1.5x', { dayRvolMin: 1.2, todRvolMin: 1.5 }]]
for (const [f, from] of [[process.argv[2], process.argv[3] ?? '']]) {
  const d = JSON.parse(readFileSync(f, 'utf8'))
  for (const [n, x] of V) { const r = runBacktest(d, { ...v3, ...x }); const t = r.trades.filter((t) => t.day >= from); const s = summarize(t, r.options)
    console.log(d.interval, '|', n, '| trades', s.trades, '| win', s.winRatePct, '| exp', s.netExpectancyPct, '| net Rs', s.totalNetRupees, '| DD', s.maxDrawdownRupees) }
}
