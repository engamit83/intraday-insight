// Checks that the LIVE v4 rules (supabase/functions/_shared/v4.ts) pick the same trades as the back-tester.
// Usage: node --experimental-strip-types tools/backtest/test-v4-live-matches-backtest.mjs <history-5minute.json>
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { runBacktest } from './backtest.mjs'
import { prepareStock, evaluateV4 } from '../../supabase/functions/_shared/v4.ts'

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const v4opts = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, volMode: 'either', dailyLossLimitRs: null, maxOpen: 1000, cooldownMin: 0 }
const bt = runBacktest(data, v4opts)
const candles = Object.fromEntries(Object.entries(data.results).map(([s, v]) => [s, v.candles.map((r) => ({ timestamp: r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] || 0 }))]))
let checked = 0, found = 0, levelsEqual = 0
const misses = []
const cache = new Map()
for (const t of bt.trades) {
  const nowMs = Date.parse(`${t.day}T${t.signalTime}:00+05:30`) + 5 * 60_000 + 1000 // just after the signal candle closed
  let res = cache.get(nowMs)
  if (!res) {
    const states = Object.entries(candles).map(([s, cs]) => prepareStock(s, cs.filter((c) => Date.parse(c.timestamp) < nowMs + 5 * 60_000), nowMs))
    res = evaluateV4(states, nowMs); cache.set(nowMs, res)
  }
  checked++
  const c = res.candidates.find((x) => x.symbol === t.symbol && x.direction === t.direction)
  if (c) {
    found++
    if (Math.abs(c.stoploss - t.stop) < 0.02 && Math.abs(c.target - t.target) < 0.02) levelsEqual++
  } else misses.push(`${t.day} ${t.signalTime} ${t.symbol} ${t.direction}: ${JSON.stringify(res.rejected.find((r) => r.symbol === t.symbol))}`)
}
console.log(`back-test trades: ${checked}; also picked by live v4: ${found}; same stop/target: ${levelsEqual}`)
if (misses.length) console.log('misses:\n' + misses.slice(0, 10).join('\n'))
assert.ok(found / checked >= 0.95, 'live v4 should pick (almost) every back-test trade')
assert.ok(levelsEqual / found >= 0.95, 'stop/target should match')
console.log('OK: live v4 matches the back-tester')
