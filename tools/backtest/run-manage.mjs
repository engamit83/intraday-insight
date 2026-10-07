// run-manage.mjs - owner's idea (7 Oct): softer volume entry + manage the trade after entry
// (tighten the stop / exit early when price or volume weakens). Base = rule set v3. Variants fixed before running.
// Usage: node --experimental-strip-types tools/backtest/run-manage.mjs <history.json>
import { readFileSync } from 'node:fs'
import { runBacktest, summarize } from './backtest.mjs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const v3 = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1, dayRvolMin: 1.2, dailyLossLimitRs: 2000 }
const soft = { ...v3, dayRvolMin: null, volMode: 'soft' }
const either = { ...v3, dayRvolMin: null, volMode: 'either' }
const smart = { lockProfit: true, reversalExit: true, volFadeExit: true }
const variants = [
  ['M0 v3', v3],
  ['M1 volume: rising OR burst (soft)', soft],
  ['M2 volume: day 1.2x OR burst 2x OR rising (either)', either],
  ['M3 v3 + trailing stop 1.5 ATR', { ...v3, trailAtrMult: 1.5 }],
  ['M4 v3 + profit lock (no-loss at +1R, +0.75R at +1.5R)', { ...v3, lockProfit: true }],
  ['M5 v3 + reversal exit (in profit)', { ...v3, reversalExit: true }],
  ['M6 v3 + volume-fade exit (in profit)', { ...v3, volFadeExit: true }],
  ['M7 v3 + all smart exits (M4+M5+M6)', { ...v3, ...smart }],
  ['M8 soft volume + all smart exits', { ...soft, ...smart }],
  ['M9 either volume + all smart exits', { ...either, ...smart }],
  ['M10 v3 + smart exits + target 3R (let winners run, exits protect)', { ...v3, ...smart, rewardRisk: 3 }],
  // batch 2 (combinations of the parts that helped in batch 1)
  ['M11 v3 + profit lock + trailing 1.5 ATR', { ...v3, lockProfit: true, trailAtrMult: 1.5 }],
  ['M12 either volume + profit lock', { ...either, lockProfit: true }],
  ['M13 either volume + profit lock + trailing 1.5 ATR', { ...either, lockProfit: true, trailAtrMult: 1.5 }],
]
const days = runBacktest(data, v3).days
const tested = days.slice(days.length > 10 ? 4 : 2)
const half = new Set(tested.slice(0, Math.floor(tested.length / 2)))
console.log(`${data.interval}: compared on ${tested.length} days (${tested[0]} to ${tested.at(-1)})`)
console.log('variant | trades | win% | avg win% | avg loss% | NET exp% | net Rs | max DD Rs | green days | 1st half | 2nd half | exits target/stop/BE/locked/reversal/volfade/sq')
for (const [name, opts] of variants) {
  const r = runBacktest(data, opts)
  const t = r.trades.filter((x) => tested.includes(x.day))
  const s = summarize(t, r.options)
  if (!s.trades) { console.log(name + ' | 0'); continue }
  const h1 = summarize(t.filter((x) => half.has(x.day)), r.options).totalNetRupees ?? 0
  const h2 = summarize(t.filter((x) => !half.has(x.day)), r.options).totalNetRupees ?? 0
  const e = s.exits
  console.log([name, s.trades, s.winRatePct, s.avgWinPct, s.avgLossPct, s.netExpectancyPct, s.totalNetRupees, s.maxDrawdownRupees, `${s.greenDays}/${tested.length}`, h1, h2,
    `${e.target}/${e.stop}/${e.breakeven}/${e.lockedstop}/${e.reversal}/${e.volfade}/${e.squareoff}`].join(' | '))
}
