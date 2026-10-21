// run-twophase.mjs - 21 Oct 2026 (intent 9): ENTRY and EXIT scored separately on all ~494 stocks.
// EXIT scorecard: the SAME entries (every gap-held candidate) with different exits -> avg net %, % of best move kept,
//   average loss, winners turned losers, worst loss, Rs with fixed risk sizing.
// ENTRY scorecard: different entry rules with ONE fixed exit -> target reached %, average best move our way vs worst against.
import { readFileSync } from 'node:fs'
import { runBacktest } from './backtest.mjs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
for (const v of Object.values(data.results)) if (v.candles) v.candles = v.candles.filter((c) => c[0].slice(0, 10) >= '2026-10-12')
const base = { marketFilter: true, relStrength: true, onePerStockPerDay: true, noEntryBefore: '10:00', noEntryAfter: '14:00', stopAtrMult: 2, rewardRisk: 2,
  prevDayLevels: true, volMode: 'either', volDays: 2, maxTradesPerDay: null, topN: 1000, maxOpen: 1000 }
const liveExit = { breakevenAtR: 1, lockProfit: true, trailAtrMult: 1.5, trailAfterR: 1 }
const ladder = [[0.5, 0.15], [0.75, 0.25], [1, 0.5], [1.5, 1]]
const pct = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : 0)
function score(opts) {
  const r = runBacktest(data, opts)
  const days = r.days.slice(2)
  return r.trades.filter((t) => days.includes(t.day))
}
console.log('EXIT scorecard - same entries (every candidate with GAP HELD, judged 14/15/16/19 Oct)')
console.log('exit rule | trades | avg net %/trade | Rs at Rs1L/trade | Rs at Rs500 risk/trade | winners % | % of best move kept (trades that were >=+0.5%) | avg loss % | winners turned losers | worst %')
const E = [
  ['E0 live exits (stop 2xATR, target 2R, no-loss at 1R, lock 1.5R, trail after 1R)', { ...liveExit }],
  ['E2 + no-loss step at +0.5%', { ...liveExit, lockSteps: [[0.5, 0.15]] }],
  ['E3 + profit-lock ladder (+0.5->0, +0.75->+0.25, +1->+0.5, +1.5->+1)', { ...liveExit, lockSteps: ladder }],
  ['E4 + book half at +1R', { ...liveExit, partialAtR: 1 }],
  ['E5 = ladder + half at +1R', { ...liveExit, lockSteps: ladder, partialAtR: 1 }],
  ['E6 ladder, no fixed target (let winners run, trail)', { ...liveExit, lockSteps: ladder, rewardRisk: 99 }],
  ['E7 ladder + stop 1.5xATR', { ...liveExit, lockSteps: ladder, stopAtrMult: 1.5 }],
]
for (const [name, ex] of (process.env.ONLY_ENTRY ? [] : E)) {
  const tr = score({ ...base, minGapPct: 0.5, ...ex })
  const tr500 = score({ ...base, minGapPct: 0.5, ...ex, riskRs: 500 })
  const rs = (x) => Math.round(x.reduce((a, t) => a + (t.netPct / 100) * (t.notional ?? 100000), 0))
  const ran = tr.filter((t) => (t.bestExc / t.entry) * 100 >= 0.5)
  const kept = pct(ran.map((t) => t.grossPct / ((t.bestExc / t.entry) * 100))) * 100
  const losers = tr.filter((t) => t.netPct < 0)
  console.log(`${name} | ${tr.length} | ${pct(tr.map((t) => t.netPct)).toFixed(3)} | ${rs(tr)} | ${rs(tr500)} | ${Math.round(tr.filter((t) => t.netPct > 0).length / tr.length * 100)} | ${kept.toFixed(0)}% | ${pct(losers.map((t) => t.netPct)).toFixed(2)} | ${ran.filter((t) => t.netPct < 0).length} of ${ran.length} | ${Math.min(...tr.map((t) => t.netPct)).toFixed(2)}`)
}
console.log('\nENTRY scorecard - one fixed exit (stop 2xATR, target 2R, nothing else)')
console.log('entry rule | entries | target reached % | avg best move our way % | avg worst move against % (before exit) | best/worst')
const fixedExit = { trailAtrMult: null, lockProfit: false, breakevenAtR: null }
const N = [
  ['N0 current entry rules (v4.1)', {}],
  ['N1 + gap held (v4.2 trial)', { minGapPct: 0.5 }],
  ['N2 + gap held + trend day', { minGapPct: 0.5, trendDayPct: 0.3 }],
  ['N3 + gap held + no chase', { minGapPct: 0.5, maxChaseAtr: 0.5 }],
  ['N4 + gap held >= 1%', { minGapPct: 1 }],
]
for (const [name, en] of N) {
  const tr = score({ ...base, ...en, ...fixedExit })
  const best = tr.map((t) => ((t.bestExc ?? 0) / t.entry) * 100)
  const worst = tr.map((t) => (t.worstExc ?? 0) / t.entry * 100)
  const reached = tr.filter((t) => t.reason === 'target').length
  console.log(`${name} | ${tr.length} | ${Math.round(reached / tr.length * 100)}% | ${pct(best).toFixed(2)} | ${pct(worst).toFixed(2)} | ${(pct(best) / (pct(worst) || 1)).toFixed(2)}`)
}
