// test-offline.mjs - checks the candle builder and the price reader with made-up data.
// Run:  node test-offline.mjs
import assert from 'node:assert/strict'
import { CandleBuilder, inMarketHours, istMinuteOfDay } from './candles.mjs'
import { extractTicks } from './parse.mjs'

let passed = 0
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name) }

// A Monday at a chosen IST clock time -> epoch ms
const ist = (h, m, s = 0) => Date.UTC(2026, 9, 5, h, m, s) - 330 * 60_000

console.log('Market hours')
check('09:14:59 is closed', () => assert.equal(inMarketHours(ist(9, 14, 59)), false))
check('09:15:00 is open', () => assert.equal(inMarketHours(ist(9, 15, 0)), true))
check('15:29:59 is open', () => assert.equal(inMarketHours(ist(15, 29, 59)), true))
check('15:30:00 is closed', () => assert.equal(inMarketHours(ist(15, 30, 0)), false))
check('IST minute-of-day', () => assert.equal(istMinuteOfDay(ist(10, 20)), 620))

console.log('1-minute candles')
check('open/high/low/close and volume', () => {
  const b = new CandleBuilder()
  b.addTick({ symbol: 'TCS', price: 100, volume: 10, ts: ist(9, 15, 5) })
  b.addTick({ symbol: 'TCS', price: 103, volume: 5, ts: ist(9, 15, 20) })
  b.addTick({ symbol: 'TCS', price: 99, volume: 7, ts: ist(9, 15, 40) })
  b.addTick({ symbol: 'TCS', price: 101, volume: 3, ts: ist(9, 15, 59) })
  const { rows } = b.collectDirty()
  const one = rows.find((r) => r.timeframe === '1min')
  assert.deepEqual([one.open, one.high, one.low, one.close, one.volume, one.tick_count], [100, 103, 99, 101, 25, 4])
  assert.equal(one.bucket_start, new Date(ist(9, 15)).toISOString())
})
check('a new minute starts a new candle', () => {
  const b = new CandleBuilder()
  b.addTick({ symbol: 'TCS', price: 100, ts: ist(9, 15, 30) })
  b.addTick({ symbol: 'TCS', price: 105, ts: ist(9, 16, 2) })
  const ones = b.collectDirty().rows.filter((r) => r.timeframe === '1min')
  assert.equal(ones.length, 2)
})
check('ticks outside market hours are ignored', () => {
  const b = new CandleBuilder()
  assert.equal(b.addTick({ symbol: 'TCS', price: 100, ts: ist(9, 10) }), false)
  assert.equal(b.addTick({ symbol: 'TCS', price: 100, ts: ist(15, 31) }), false)
  assert.equal(b.collectDirty().rows.length, 0)
  assert.equal(b.rejected, 2)
})
check('bad prices are ignored', () => {
  const b = new CandleBuilder()
  assert.equal(b.addTick({ symbol: 'TCS', price: 0, ts: ist(9, 20) }), false)
  assert.equal(b.addTick({ symbol: 'TCS', price: NaN, ts: ist(9, 20) }), false)
  assert.equal(b.addTick({ symbol: '', price: 5, ts: ist(9, 20) }), false)
})

console.log('5-minute candles')
check('5-minute candle is built from five 1-minute candles', () => {
  const b = new CandleBuilder()
  const prices = [100, 104, 98, 101, 102] // one tick per minute 09:15..09:19
  prices.forEach((p, i) => b.addTick({ symbol: 'INFY', price: p, volume: 10, ts: ist(9, 15 + i, 30) }))
  const five = b.collectDirty().rows.filter((r) => r.timeframe === '5min')
  assert.equal(five.length, 1)
  assert.deepEqual([five[0].open, five[0].high, five[0].low, five[0].close, five[0].volume], [100, 104, 98, 102, 50])
  assert.equal(five[0].bucket_start, new Date(ist(9, 15)).toISOString())
})
check('09:20 starts the next 5-minute candle', () => {
  const b = new CandleBuilder()
  b.addTick({ symbol: 'INFY', price: 100, ts: ist(9, 19, 59) })
  b.addTick({ symbol: 'INFY', price: 110, ts: ist(9, 20, 0) })
  const five = b.collectDirty().rows.filter((r) => r.timeframe === '5min')
  assert.equal(five.length, 2)
})

console.log('Volume handling')
check('running-total volume becomes per-minute volume', () => {
  const b = new CandleBuilder()
  b.addTick({ symbol: 'ITC', price: 50, cumulativeVolume: 1000, ts: ist(9, 15, 5) })  // first tick: no earlier total
  b.addTick({ symbol: 'ITC', price: 51, cumulativeVolume: 1300, ts: ist(9, 15, 30) }) // +300
  b.addTick({ symbol: 'ITC', price: 52, cumulativeVolume: 1500, ts: ist(9, 16, 10) }) // +200 in next minute
  const ones = b.collectDirty().rows.filter((r) => r.timeframe === '1min').sort((a, c) => a.bucket_start.localeCompare(c.bucket_start))
  assert.deepEqual(ones.map((r) => r.volume), [300, 200])
})
check('a running total that goes backwards never gives negative volume', () => {
  const b = new CandleBuilder()
  b.addTick({ symbol: 'ITC', price: 50, cumulativeVolume: 1000, ts: ist(9, 15, 5) })
  b.addTick({ symbol: 'ITC', price: 50, cumulativeVolume: 400, ts: ist(9, 15, 6) })
  assert.equal(b.collectDirty().rows[0].volume, 0)
})

console.log('Saving bookkeeping')
check('committed rows are not sent again', () => {
  const b = new CandleBuilder()
  b.addTick({ symbol: 'SBIN', price: 10, ts: ist(9, 30) })
  const first = b.collectDirty()
  b.commit(first.pending)
  assert.equal(b.collectDirty().rows.length, 0)
})
check('a failed save is retried', () => {
  const b = new CandleBuilder()
  b.addTick({ symbol: 'SBIN', price: 10, ts: ist(9, 30) })
  b.collectDirty() // pretend the send failed: never committed
  assert.equal(b.collectDirty().rows.length, 2) // 1min + 5min again
})
check('a tick that arrives while saving keeps the candle marked unsaved', () => {
  const b = new CandleBuilder()
  b.addTick({ symbol: 'SBIN', price: 10, ts: ist(9, 30, 1) })
  const sending = b.collectDirty()
  b.addTick({ symbol: 'SBIN', price: 11, ts: ist(9, 30, 2) }) // arrives mid-send
  b.commit(sending.pending)
  const again = b.collectDirty().rows.find((r) => r.timeframe === '1min')
  assert.equal(again.close, 11)
})

console.log('Price reader (layouts are GUESSES until we see real Sharekhan messages)')
check('flat object', () => {
  const t = extractTicks('{"scripCode":"NC2885","ltp":"1234.5","volume":100}')
  assert.deepEqual(t, [{ exchange: 'NC', code: 2885, price: 1234.5, cumulativeVolume: 100 }])
})
check('wrapped list', () => {
  const t = extractTicks('{"action":"feed","data":[{"key":"NC22","ltp":10},{"key":"NC23","ltp":20,"ltq":5}]}')
  assert.equal(t.length, 2)
  assert.deepEqual(t[1], { exchange: 'NC', code: 23, price: 20, volume: 5 })
})
check('map keyed by stock id', () => {
  const t = extractTicks('{"NC2885":{"ltp":1234.5},"NC22":99.5}')
  assert.deepEqual(t.map((x) => [x.code, x.price]), [[2885, 1234.5], [22, 99.5]])
})
check('REAL Sharekhan message: qty is the running day total, ltq is ignored', () => {
  const real = '{"status":100,"message":"feed","timestamp":"2026-10-07T09:19:49+05:30","data":{"exchangeCode":"NC","scripCode":2885,"ltt":"10/07/2026 09:19:49","ltp":1208.4,"qty":636486,"ltq":1,"preltq":67}}'
  assert.deepEqual(extractTicks(real), [{ exchange: null, code: 2885, price: 1208.4, cumulativeVolume: 636486 }])
})
check('REAL Sharekhan message: data as a list', () => {
  const real = '{"status":100,"message":"feed","data":[{"exchangeCode":"NC","scripCode":2885,"ltp":1208.0,"qty":636419,"ltq":137},{"exchangeCode":"NC","scripCode":11536,"ltp":2085.0,"qty":9000,"ltq":3}]}'
  assert.deepEqual(extractTicks(real).map((t) => [t.code, t.price, t.cumulativeVolume]), [[2885, 1208, 636419], [11536, 2085, 9000]])
})
check('REAL Sharekhan connect/subscribe replies are ignored', () => {
  assert.deepEqual(extractTicks('{"status":100,"message":"connect","data":"Connected c47342a3-1df4"}'), [])
  assert.deepEqual(extractTicks('{"status":100,"message":"subscribe","data":"success FEED"}'), [])
})
check('non-price messages are ignored', () => {
  assert.deepEqual(extractTicks('pong'), [])
  assert.deepEqual(extractTicks('{"action":"ack","status":"subscribed"}'), [])
  assert.deepEqual(extractTicks('not json {'), [])
  assert.deepEqual(extractTicks('{"scripCode":"NC22","ltp":0}'), [])
})

console.log(`\nAll ${passed} checks passed.`)
