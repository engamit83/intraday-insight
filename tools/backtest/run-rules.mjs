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
const fewer = { relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00' }

const variants = [
  ['0 old rules (no filter)', { marketFilter: false }],
  ['1 market filter (M)', {}],
  ['2 M + top 3 per decision + 1 trade/stock/day', { topN: 3, onePerStockPerDay: true }],
  ['3 M + max 10 trades/day + 1/stock/day', { maxTradesPerDay: 10, onePerStockPerDay: true }],
  ['4 M + skip opening (entries from 10:00)', { noEntryBefore: '10:00' }],
  ['5 M + relative strength', { relStrength: true }],
  ['6 M + volume >= 1.2x', { minRelVolume: 1.2 }],
  ['7 M + daily loss limit Rs 5,000', { dailyLossLimitRs: 5000 }],
  ['8 FEWER BUT BETTER (M+2+3+4+5)', fewer],
  ['9 = 8 + wider levels (2xATR, 2R)', { ...fewer, stopAtrMult: 2, rewardRisk: 2 }],
  ['10 = 8 + volume >= 1.2x', { ...fewer, minRelVolume: 1.2 }],
  ['11 = 8 + daily loss limit Rs 5,000', { ...fewer, dailyLossLimitRs: 5000 }],
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
