// run.mjs - back-test report.
// Usage: node --experimental-strip-types tools/backtest/run.mjs <history.json> [--brokerage=0.03] [--slippage=0.02]
import { readFileSync, writeFileSync } from 'node:fs'
import { runBacktest, summarize, breakdown, roundTripCostPct, DEFAULTS } from './backtest.mjs'

const file = process.argv[2]
if (!file) { console.error('Usage: node --experimental-strip-types tools/backtest/run.mjs <history.json>'); process.exit(1) }
const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? Number(a.split('=')[1]) : undefined }
const brokerage = arg('brokerage') ?? DEFAULTS.costs.brokeragePct
const slippage = arg('slippage') ?? DEFAULTS.slippagePct
const data = JSON.parse(readFileSync(file, 'utf8'))
const common = { costs: { brokeragePct: brokerage }, slippagePct: slippage }

const variants = [
  ['A baseline (live rules today)', {}],
  ['B + entry window 09:30-14:45', { noEntryBefore: '09:30', noEntryAfter: '14:45' }],
  ['C + market filter', { marketFilter: true }],
  ['D + yesterday-close filter', { prevCloseFilter: true }],
  ['E wider levels (2xATR, 2R)', { stopAtrMult: 2, rewardRisk: 2 }],
  ['F = B + C + D', { noEntryBefore: '09:30', noEntryAfter: '14:45', marketFilter: true, prevCloseFilter: true }],
  ['G = F + wider levels', { noEntryBefore: '09:30', noEntryAfter: '14:45', marketFilter: true, prevCloseFilter: true, stopAtrMult: 2, rewardRisk: 2 }],
]

const runs = variants.map(([name, opts]) => ({ name, r: runBacktest(data, { ...common, ...opts }) }))
const base = runs[0].r
const days = base.days.filter((d) => !base.skippedDays.includes(d))
if (base.collisions) console.log(`WARNING: ${base.collisions} candles fell into the same time slot as another (candle timing differs from what the back-tester expects)`)
console.log(`Data: ${data.interval} candles, ${base.symbols} stocks, ${base.days.length} days (${base.days[0]} to ${base.days.at(-1)}); back-tested days: ${days.length} (first days skipped for indicator warm-up: ${base.skippedDays.length})`)
console.log(`Costs per round trip: ${roundTripCostPct({ ...DEFAULTS.costs, brokeragePct: brokerage }).toFixed(3)}% + slippage ${slippage}% per side (brokerage ${brokerage}% per side). Rupees assume Rs ${DEFAULTS.notional.toLocaleString('en-IN')} per trade.\n`)

const half = Math.floor(days.length / 2)
const firstHalf = new Set(days.slice(0, half))
const head = ['variant', 'trades', 'win%', 'avg win%', 'avg loss%', 'gross exp%', 'NET exp%', 'net Rs', 'max DD Rs', 'green days', 'net Rs 1st half', 'net Rs 2nd half']
const rows = runs.map(({ name, r }) => {
  const s = r.summary
  if (!s.trades) return [name, 0]
  const h1 = summarize(r.trades.filter((t) => firstHalf.has(t.day)), r.options)
  const h2 = summarize(r.trades.filter((t) => !firstHalf.has(t.day)), r.options)
  return [name, s.trades, s.winRatePct, s.avgWinPct, s.avgLossPct, s.grossExpectancyPct, s.netExpectancyPct, s.totalNetRupees, s.maxDrawdownRupees, `${s.greenDays}/${s.daysTraded}`, h1.totalNetRupees ?? 0, h2.totalNetRupees ?? 0]
})
console.log(head.join(' | '))
for (const r of rows) console.log(r.join(' | '))

const b = base.summary
console.log(`\nBaseline exits: target ${b.exits?.target}, stop ${b.exits?.stop}, square-off ${b.exits?.squareoff}; BUY ${b.buy}, SELL ${b.sell}`)
const show = (title, obj) => {
  console.log(`\n${title}`)
  for (const [k, s] of Object.entries(obj)) console.log(`  ${k}: trades ${s.trades}, win ${s.winRatePct}%, net exp ${s.netExpectancyPct}%, net Rs ${s.totalNetRupees}`)
}
show('Baseline by direction:', breakdown(base.trades, (t) => t.direction, base.options))
show('Baseline by entry hour:', breakdown(base.trades, (t) => t.entryTime.slice(0, 2) + ':00', base.options))
show('Baseline by day:', breakdown(base.trades, (t) => t.day, base.options))

const csv = ['variant,symbol,day,direction,signalTime,entryTime,exitTime,reason,signalPrice,entry,stop,target,exit,grossPct,netPct']
for (const { name, r } of runs) for (const t of r.trades) {
  csv.push([name.split(' ')[0], t.symbol, t.day, t.direction, t.signalTime, t.entryTime, t.exitTime, t.reason,
    t.signalPrice, t.entry.toFixed(2), t.stop.toFixed(2), t.target.toFixed(2), t.exit.toFixed(2), t.grossPct.toFixed(3), t.netPct.toFixed(3)].join(','))
}
writeFileSync('backtest-trades.csv', csv.join('\n'))
console.log('\nAll trades written to backtest-trades.csv')
