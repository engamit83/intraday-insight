// run-volume.mjs - volume variants on top of rule set v3. (Copied from run-rules.mjs)
// run-rules.mjs - tests the "missing rules" from PROGRESS.md (strengthening plan) as switches.
// Variants were fixed BEFORE looking at results (to limit data-mining). The market filter is on
// in all of them because it was the only change that helped in both earlier tests.
// Usage: node --experimental-strip-types tools/backtest/run-rules.mjs <history.json> [--brokerage=0.03]
import { readFileSync } from 'node:fs'
import { runBacktest, summarize } from './backtest.mjs'

const file = process.argv[2]
const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? Number(a.split('=')[1]) : undefined }
const data = JSON.parse(readFileSync(file, 'utf8'))
const common = { costs: { brokeragePct: arg('brokerage') ?? 0.03 }, marketFilter: true }
const wide = { stopAtrMult: 2, rewardRisk: 2 }
const fewer = { relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00' }

const v3 = { relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1 }
// Volume variants, fixed before running. Base = candidate rule set v3.
const variants = [
  ['V0 v3 (no volume rule)', v3],
  ['V1 v3 + old volume rule (last 2 vs previous 20 >= 1.2x)', { ...v3, minRelVolume: 1.2 }],
  ['V2 v3 + slot volume >= 1.0x usual', { ...v3, todRvolMin: 1.0 }],
  ['V3 v3 + slot volume >= 1.5x usual', { ...v3, todRvolMin: 1.5 }],
  ['V4 v3 + day volume so far >= 1.0x usual', { ...v3, dayRvolMin: 1.0 }],
  ['V5 v3 + day volume so far >= 1.2x usual', { ...v3, dayRvolMin: 1.2 }],
  ['V6 v3 + volume rising (slot-relative)', { ...v3, volRising: true }],
  ['V7 v3 + rank by volume (weight 0.3)', { ...v3, volRankWeight: 0.3 }],
  ['V8 v3 + rank by volume (weight 1.0)', { ...v3, volRankWeight: 1.0 }],
]

const first = runBacktest(data, { ...common, ...variants[0][1] })
const days = first.days.filter((d) => !first.skippedDays.includes(d))
const half = new Set(days.slice(0, Math.floor(days.length / 2)))
console.log(`${data.interval}: ${first.symbols} stocks, ${days.length} tested days (${days[0]} to ${days.at(-1)}), cost ${first.costPct.toFixed(3)}% + slippage per side ${first.options.slippagePct}%`)
console.log(['variant', 'trades', 'trades/day', 'win%', 'gross exp%', 'NET exp%', 'net Rs', 'max DD Rs', 'green days', '1st half Rs', '2nd half Rs'].join(' | '))
for (const [name, opts] of variants) {
  const r = runBacktest(data, { ...common, ...opts })
  const s = r.summary
  if (!s.trades) { console.log(`${name} | 0`); continue }
  const h1 = summarize(r.trades.filter((t) => half.has(t.day)), r.options).totalNetRupees ?? 0
  const h2 = summarize(r.trades.filter((t) => !half.has(t.day)), r.options).totalNetRupees ?? 0
  console.log([name, s.trades, (s.trades / days.length).toFixed(1), s.winRatePct, s.grossExpectancyPct, s.netExpectancyPct, s.totalNetRupees, s.maxDrawdownRupees, `${s.greenDays}/${days.length}`, h1, h2].join(' | '))
}
