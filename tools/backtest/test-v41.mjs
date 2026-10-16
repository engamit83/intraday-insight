// test-v41.mjs - offline checks for the v4.1 additions (16 Oct). Run:
//   node --experimental-strip-types tools/backtest/test-v41.mjs <history-5minute.json>
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { runBacktest } from './backtest.mjs'
import { prepareStock, evaluateV4, pickV4, V4 } from '../../supabase/functions/_shared/v4.ts'
import { manageOnCandle } from '../../supabase/functions/_shared/paper.ts'
let ok = 0
const check = (name, fn) => { fn(); ok++; console.log('  ok  ' + name) }
const cand = (symbol, rankScore) => ({ symbol, direction: 'BUY', entry: 100, stoploss: 99, target: 102, stopDist: 1, atr: 0.5, rawScore: 70, finalScore: 70, rankScore, reasons: [] })

check('one stock per sector: second cement stock in the same run is skipped', () => {
  const p = pickV4([cand('ULTRACEMCO', 90), cand('GRASIM', 85), cand('HEROMOTOCO', 80)], new Set(), 10, [])
  assert.deepEqual(p.map((c) => c.symbol), ['ULTRACEMCO', 'HEROMOTOCO'])
})
check('one stock per sector: an OPEN trade blocks its sector', () => {
  const p = pickV4([cand('GRASIM', 85), cand('TCS', 80)], new Set(), 10, ['ULTRACEMCO'])
  assert.deepEqual(p.map((c) => c.symbol), ['TCS'])
})
check('top 3 per run and the daily room still apply; stocks already used today are skipped', () => {
  const list = [cand('TCS', 99), cand('SBIN', 98), cand('ITC', 97), cand('LT', 96), cand('NTPC', 95)]
  assert.deepEqual(pickV4(list, new Set(['SBIN']), 10, []).map((c) => c.symbol), ['TCS', 'ITC', 'LT'])
  assert.deepEqual(pickV4(list, new Set(), 1, []).map((c) => c.symbol), ['TCS'])
})
check('trailing stop does NOT move before +1R (16 Oct GRASIM case)', () => {
  const p = { direction: 'BUY', entry: 2912.68, stop: 2901.03, target: 2936.64, stopDist: 11.8688, atr: 5.9344 }
  manageOnCandle(p, { bucket: '13:50', open: 2912, high: 2915, low: 2911, close: 2915 })
  manageOnCandle(p, { bucket: '14:05', open: 2916, high: 2921.8, low: 2915.6, close: 2921.8 }) // +9.1 = 0.77R
  assert.equal(p.stop, 2901.03)
})
check('trailing stop does move after +1R', () => {
  const p = { direction: 'BUY', entry: 100, stop: 98, target: 104, stopDist: 2, atr: 0.5 }
  manageOnCandle(p, { bucket: '11:00', open: 100, high: 102.5, low: 100, close: 102.4 })
  assert.ok(p.stop > 100.1, `stop ${p.stop}`)
})

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const candles = Object.fromEntries(Object.entries(data.results).map(([s, v]) => [s, v.candles.map((r) => ({ timestamp: r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] || 0 }))]))
const lastDay = [...new Set(candles.RELIANCE.map((c) => c.timestamp.slice(0, 10)))].sort().at(-1)
check('late-start guard: a day whose data begins at 12:00 is not traded (16 Oct case)', () => {
  const nowMs = Date.parse(`${lastDay}T13:41:00+05:30`)
  const cut = candles.RELIANCE.filter((c) => !c.timestamp.startsWith(lastDay) || c.timestamp.slice(11, 16) >= '12:00')
  const st = prepareStock('RELIANCE', cut, nowMs)
  assert.equal(st.ok, false); assert.match(st.reason, /starts late/)
  assert.equal(prepareStock('RELIANCE', candles.RELIANCE, nowMs).ok, true)
})

// v4.1 live selection reproduces the v4.1 back-test, run by run
const opts = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, breakevenAtR: 1, volMode: 'either', lockProfit: true, trailAtrMult: 1.5, trailAfterR: 1, maxPerSector: 1, dailyLossLimitRs: null }
const bt = runBacktest(data, opts)
const byRun = new Map()
for (const t of bt.trades) { const k = t.day + ' ' + t.signalTime; (byRun.get(k) ?? byRun.set(k, []).get(k)).push(t) }
let runs = 0, same = 0
const diffs = []
for (const [k, trades] of byRun) {
  const [day, time] = k.split(' ')
  const nowMs = Date.parse(`${day}T${time}:00+05:30`) + 5 * 60_000 + 1000
  const states = Object.entries(candles).map(([s, cs]) => prepareStock(s, cs.filter((c) => Date.parse(c.timestamp) < nowMs + 5 * 60_000), nowMs))
  const ev = evaluateV4(states, nowMs)
  const earlier = bt.trades.filter((t) => t.day === day && t.signalTime < time)
  const used = new Set(earlier.map((t) => t.symbol))
  const openSyms = earlier.filter((t) => t.exitTime > time).map((t) => t.symbol) // still open when this candle closed
  const picks = pickV4(ev.candidates, used, 10 - earlier.length, openSyms).map((c) => c.symbol).sort()
  runs++
  if (JSON.stringify(picks) === JSON.stringify(trades.map((t) => t.symbol).sort())) same++
  else diffs.push(`${k} bt:${trades.map((t) => t.symbol)} live:${picks}`)
}
console.log(`  v4.1 runs with trades: ${runs}; live picks identical: ${same}`)
if (diffs.length) console.log('  ' + diffs.slice(0, 8).join('\n  '))
check('v4.1 live picks match the back-test in (almost) every run', () => assert.ok(same / runs >= 0.95))
console.log(`\nAll ${ok} v4.1 checks passed.`)
