// run-owner-exit.mjs - 16 Oct: owner's exit rule (stop at the buy price from the start) vs v4.1, on the same signals.
// Also: for every exit before target, did the stock reach the target LATER that day? (tells "weak pick" vs "exit too tight")
// Usage: node --experimental-strip-types tools/backtest/run-owner-exit.mjs <history-5minute.json>
import { readFileSync } from 'node:fs'
import { runBacktest, summarize } from './backtest.mjs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const v41 = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1, volMode: 'either', lockProfit: true, trailAtrMult: 1.5, trailAfterR: 1, maxPerSector: 1, dailyLossLimitRs: 2000 }
const variants = [
  ['v4.1 (normal stop 2xATR)', v41],
  ["OWNER: stop at buy price from the start", { ...v41, stopAtEntry: true }],
  ['owner + 0.1% room', { ...v41, stopAtEntry: true, stopAtEntryBufferPct: 0.1 }],
  ['owner + 0.2% room', { ...v41, stopAtEntry: true, stopAtEntryBufferPct: 0.2 }],
]
const tested = runBacktest(data, v41).days.slice(3)
for (const [name, o] of variants) {
  const r = runBacktest(data, o)
  const t = r.trades.filter((x) => tested.includes(x.day))
  const s = summarize(t, r.options)
  const notTarget = t.filter((x) => x.reason !== 'target')
  const later = notTarget.filter((x) => x.laterHitTarget).length
  const quick = t.filter((x) => x.reason !== 'target' && x.exitTime <= x.entryTime).length
  const newDays = summarize(t.filter((x) => x.day >= '2026-10-08'), r.options).totalNetRupees
  console.log(`\n${name}\n  trades ${s.trades}, win ${s.winRatePct}%, net Rs ${s.totalNetRupees} (new days Rs ${newDays}), per trade ${s.netExpectancyPct}%, worst drop Rs ${s.maxDrawdownRupees}`)
  console.log(`  exits: target ${s.exits.target}, stop ${s.exits.stop}, at-buy-price ${s.exits.breakeven}, raised stop ${s.exits.lockedstop}, 15:15 ${s.exits.squareoff}`)
  console.log(`  closed in the very first candle: ${quick} | exited before target but the stock reached the target LATER: ${later} of ${notTarget.length}`)
}
