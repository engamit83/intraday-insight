// run-daily-filters.mjs - 16 Oct: do DAILY-chart conditions (known before the day starts) separate good and bad
// v4.1 trades? Uses years of daily candles for context only. Read the result as a hint: few trades, 10 days.
// Usage: node --experimental-strip-types tools/backtest/run-daily-filters.mjs <history-5minute.json> <history-daily.json>
import { readFileSync } from 'node:fs'
import { runBacktest, summarize } from './backtest.mjs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const daily = JSON.parse(readFileSync(process.argv[3], 'utf8'))
const v41 = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1, volMode: 'either', lockProfit: true, trailAtrMult: 1.5, trailAfterR: 1, maxPerSector: 1, dailyLossLimitRs: 2000 }
const r = runBacktest(data, v41)
const tested = r.days.slice(3)
const trades = r.trades.filter((t) => tested.includes(t.day))
// daily bars per stock, sorted
const D = {}
for (const [s, v] of Object.entries(daily.results)) D[s] = (v.candles ?? []).map((c) => ({ day: String(c[0]).slice(0, 10), o: +c[1], h: +c[2], l: +c[3], c: +c[4], v: +c[5] })).sort((a, b) => a.day.localeCompare(b.day))
const sma = (arr, n) => arr.length >= n ? arr.slice(-n).reduce((a, b) => a + b, 0) / n : null
function ctx(sym, day) {
  const bars = (D[sym] ?? []).filter((b) => b.day < day) // only days BEFORE the trade day
  if (bars.length < 60) return null
  const closes = bars.map((b) => b.c), last = bars.at(-1)
  const s20 = sma(closes, 20), s50 = sma(closes, 50)
  const hi20 = Math.max(...bars.slice(-20).map((b) => b.h)), lo20 = Math.min(...bars.slice(-20).map((b) => b.l))
  const ret5 = (last.c / bars.at(-6).c - 1) * 100
  const atr14 = bars.slice(-14).reduce((a, b, i, arr) => a + (b.h - b.l), 0) / 14 / last.c * 100
  const nr = (last.h - last.l) / last.c * 100 < atr14 * 0.7 // yesterday was a narrow day
  return { aboveS20: last.c > s20, aboveS50: last.c > s50, s20up: s20 > sma(closes.slice(0, -5), 20), nearHigh: last.c >= hi20 * 0.98, nearLow: last.c <= lo20 * 1.02, ret5, atr14, nr }
}
const rows = trades.map((t) => ({ t, x: ctx(t.symbol, t.day) })).filter((r) => r.x)
const B = (t) => t.direction === 'BUY'
const tests = [
  ['daily trend agrees (price above 20-day avg for BUY / below for SELL)', (t, x) => (B(t) ? x.aboveS20 : !x.aboveS20)],
  ['bigger trend agrees (50-day avg)', (t, x) => (B(t) ? x.aboveS50 : !x.aboveS50)],
  ['20-day avg itself rising for BUY / falling for SELL', (t, x) => (B(t) ? x.s20up : !x.s20up)],
  ['stock near its 20-day high (BUY) / low (SELL)', (t, x) => (B(t) ? x.nearHigh : x.nearLow)],
  ['last 5 days moved in the trade direction', (t, x) => (B(t) ? x.ret5 > 0 : x.ret5 < 0)],
  ['yesterday was a narrow (quiet) day', (t, x) => x.nr],
  ['stock usually moves > 2% a day (volatile)', (t, x) => x.atr14 > 2],
]
const firstNew = '2026-10-08'
const fmt = (list) => { const s = summarize(list.map((r) => r.t), r.options); return s.trades ? `${s.trades} trades, win ${s.winRatePct}%, net Rs ${s.totalNetRupees}, per trade ${s.netExpectancyPct}%` : '0 trades' }
console.log(`v4.1 trades with daily history: ${rows.length} of ${trades.length} (${tested[0]}..${tested.at(-1)})`)
console.log(`ALL: ${fmt(rows)}`)
for (const [name, f] of tests) {
  const yes = rows.filter((r) => f(r.t, r.x)), no = rows.filter((r) => !f(r.t, r.x))
  const yN = summarize(yes.filter((r) => r.t.day >= firstNew).map((r) => r.t), r.options).totalNetRupees ?? 0
  const yO = summarize(yes.filter((r) => r.t.day < firstNew).map((r) => r.t), r.options).totalNetRupees ?? 0
  console.log(`\n${name}\n   YES: ${fmt(yes)} | old days Rs ${yO}, new days Rs ${yN}\n   NO : ${fmt(no)}`)
}
