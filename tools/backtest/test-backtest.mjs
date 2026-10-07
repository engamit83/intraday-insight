// Offline checks for the back-tester, on made-up data.
// Run: node --experimental-strip-types tools/backtest/test-backtest.mjs
import assert from 'node:assert/strict'
import { runBacktest, roundTripCostPct, DEFAULTS } from './backtest.mjs'

let passed = 0
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name) }

// Deterministic pseudo-random numbers
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) }

// Build fake Sharekhan-style data: tradeTime is the last trade inside the candle (e.g. 09:19:52).
function makeData({ days = 12, symbols = ['AAA', 'BBB', 'CCC', 'DDD'], drift = (d, s) => 0, seed = 7 } = {}) {
  const r = rng(seed)
  const results = {}
  const start = Date.UTC(2026, 8, 1)
  const dayList = []
  for (let i = 0, d = 0; dayList.length < days; i++) {
    const dt = new Date(start + i * 86400000)
    if (dt.getUTCDay() === 0 || dt.getUTCDay() === 6) continue
    dayList.push(dt.toISOString().slice(0, 10)); d++
  }
  symbols.forEach((sym, k) => {
    let px = 100 + k * 50
    const candles = []
    dayList.forEach((day, di) => {
      for (let m = 9 * 60 + 15; m <= 15 * 60 + 25; m += 5) {
        const o = px * (1 + (r() - 0.5) * 0.0006)
        const step = (r() - 0.5) * 0.004 * px + drift(di, k) * px
        const c = Math.max(1, o + step)
        const h = Math.max(o, c) + r() * 0.001 * px
        const l = Math.min(o, c) - r() * 0.001 * px
        const t = m + 4
        const ts = `${day}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:52+05:30`
        candles.push([ts, +o.toFixed(2), +h.toFixed(2), +l.toFixed(2), +c.toFixed(2), 1000 + Math.floor(r() * 5000)])
        px = c
      }
    })
    results[sym] = { candles }
  })
  return { interval: '5minute', results }
}

const trendy = makeData({ days: 14, drift: (d, k) => (k % 2 === 0 ? 0.0005 : -0.0005) })
const res = runBacktest(trendy)
const T = res.trades

check('cost of a round trip matches the formula', () => {
  const c = DEFAULTS.costs
  const expected = 2 * c.brokeragePct + 2 * c.exchangePct + 2 * c.sebiPct + (2 * c.brokeragePct + 2 * c.exchangePct + 2 * c.sebiPct) * 0.18 + c.sttSellPct + c.stampBuyPct
  assert.ok(Math.abs(roundTripCostPct(c) - expected) < 1e-12)
})
check('trending data produces trades, and the first days are skipped for warm-up', () => {
  assert.ok(T.length > 20, `only ${T.length} trades`)
  assert.ok(res.skippedDays.length >= 1)
})
check('up-trending stocks get BUYs, down-trending stocks get SELLs', () => {
  const up = T.filter((t) => t.symbol === 'AAA' || t.symbol === 'CCC')
  const dn = T.filter((t) => t.symbol === 'BBB' || t.symbol === 'DDD')
  assert.ok(up.filter((t) => t.direction === 'BUY').length > up.filter((t) => t.direction === 'SELL').length)
  assert.ok(dn.filter((t) => t.direction === 'SELL').length > dn.filter((t) => t.direction === 'BUY').length)
})
check('entry is the NEXT candle (never the signal candle) and before 15:10', () => {
  for (const t of T) { assert.ok(t.entryTime > t.signalTime); assert.ok(t.entryTime < '15:10') }
})
check('entry price = open of the entry candle plus slippage against us', () => {
  const bucket = (ts) => ts.slice(11, 13) + ':' + String(Math.floor(Number(ts.slice(14, 16)) / 5) * 5).padStart(2, '0')
  for (const t of T) {
    const c = trendy.results[t.symbol].candles.find((x) => x[0].startsWith(t.day) && bucket(x[0]) === t.entryTime)
    const expected = t.direction === 'BUY' ? c[1] * (1 + DEFAULTS.slippagePct / 100) : c[1] * (1 - DEFAULTS.slippagePct / 100)
    assert.ok(Math.abs(t.entry - expected) < 1e-9, `${t.symbol} ${t.day} ${t.entryTime}`)
  }
})
check('maxOpen is respected (run with maxOpen = 2)', () => {
  const min = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  const r2 = runBacktest(trendy, { maxOpen: 2 }).trades
  assert.ok(r2.length > 5)
  for (const day of new Set(r2.map((t) => t.day))) for (let m = 555; m <= 930; m += 5) {
    assert.ok(r2.filter((t) => t.day === day && min(t.entryTime) <= m && m < min(t.exitTime)).length <= 2)
  }
})
check('stops/targets are on the correct side of the entry signal price', () => {
  for (const t of T) {
    if (t.direction === 'BUY') assert.ok(t.stop < t.signalPrice && t.target > t.signalPrice)
    else assert.ok(t.stop > t.signalPrice && t.target < t.signalPrice)
  }
})
check('target exits fill exactly at the target; stop exits at or worse than the stop', () => {
  for (const t of T) {
    if (t.reason === 'target') assert.ok(Math.abs(t.exit - t.target) < 1e-9)
    if (t.reason === 'stop') assert.ok(t.direction === 'BUY' ? t.exit <= t.stop + 1e-9 : t.exit >= t.stop - 1e-9)
  }
})
check('square-offs happen at 15:15', () => {
  for (const t of T.filter((t) => t.reason === 'squareoff')) assert.equal(t.exitTime, '15:15')
})
check('net = gross - costs for every trade', () => {
  for (const t of T) assert.ok(Math.abs(t.grossPct - res.costPct - t.netPct) < 1e-9)
})
check('one position per stock at a time, never more than maxOpen together', () => {
  const min = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  for (const day of new Set(T.map((t) => t.day))) {
    const dayT = T.filter((t) => t.day === day)
    for (let m = 555; m <= 930; m += 5) {
      const openNow = dayT.filter((t) => min(t.entryTime) <= m && m < min(t.exitTime))
      assert.ok(openNow.length <= DEFAULTS.maxOpen)
      assert.equal(new Set(openNow.map((t) => t.symbol)).size, openNow.length)
    }
  }
})
check('no look-ahead: changing candles from a cut time onward never changes decisions made before it', () => {
  const lastDays = res.days.slice(-3)
  let compared = 0
  for (const day of lastDays) for (const cut of ['10:00', '11:00', '12:00', '13:00', '14:00']) {
    const altered = JSON.parse(JSON.stringify(trendy))
    for (const v of Object.values(altered.results)) {
      for (const c of v.candles) if (c[0].startsWith(day) && c[0].slice(11, 16) >= cut) { c[1] *= 0.9; c[2] *= 1.2; c[3] *= 0.8; c[4] *= 1.15 }
    }
    const key = (t) => t.symbol + t.signalTime + t.direction
    const a = runBacktest(altered).trades.filter((t) => t.day === day && t.signalTime < cut).map(key).sort()
    const b = T.filter((t) => t.day === day && t.signalTime < cut).map(key).sort()
    assert.deepEqual(a, b, `decisions before ${cut} on ${day} changed`)
    compared += b.length
  }
  assert.ok(compared > 20, `too few decisions compared (${compared})`)
})
check('a candle that touches both stop and target counts as a stop', () => {
  // one stock, flat history, then a giant candle right after an entry
  const d = makeData({ days: 6, symbols: ['AAA'], drift: () => 0.0005 })
  const base = runBacktest(d, { maxOpen: 1 })
  const first = base.trades[0]
  assert.ok(first, 'expected a trade')
  const bucket = (ts) => ts.slice(11, 13) + ':' + String(Math.floor(Number(ts.slice(14, 16)) / 5) * 5).padStart(2, '0')
  const c = d.results.AAA.candles.find((x) => x[0].startsWith(first.day) && bucket(x[0]) === first.entryTime)
  c[2] = c[1] * 1.05; c[3] = c[1] * 0.95
  const again = runBacktest(d, { maxOpen: 1 }).trades[0]
  assert.equal(again.reason, 'stop')
})
check('filters only ever remove trades (market filter, yesterday-close filter, entry window)', () => {
  for (const opts of [{ marketFilter: true }, { prevCloseFilter: true }, { noEntryBefore: '09:30', noEntryAfter: '14:45' }]) {
    const r = runBacktest(trendy, opts)
    assert.ok(r.trades.every((t) => !opts.noEntryBefore || (t.entryTime >= '09:30' && t.entryTime <= '14:45')))
    assert.ok(r.trades.length > 0)
  }
})

console.log(`\nAll ${passed} checks passed.`)
