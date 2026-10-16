// test-recorder.mjs - offline checks for the day files (16 Oct). Run: node test-recorder.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CandleBuilder } from './candles.mjs'
import { extractTicks } from './parse.mjs'
import { DayRecorder } from './recorder.mjs'
let ok = 0
const check = (name, fn) => { fn(); ok++; console.log('  ok  ' + name) }
const ist = (h, m, s = 0) => Date.parse(`2026-10-19T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}+05:30`)

// a real Sharekhan message shape (7 Oct), trimmed
const real = '{"status":100,"message":"feed","data":[{"exchangeCode":"NC","scripCode":2885,"ltp":1208.0,"qty":636419,"bidPrice":1207.9,"bidQty":4180,"offPrice":1208.4,"offQty":887,"totalBuyQty":422027,"totalSellQty":463667,"ltq":137}]}'
check('parser keeps the order-book fields', () => {
  const [t] = extractTicks(real)
  assert.deepEqual([t.code, t.price, t.cumulativeVolume, t.bid, t.bidQty, t.ask, t.askQty, t.totBuy, t.totSell], [2885, 1208, 636419, 1207.9, 4180, 1208.4, 887, 422027, 463667])
})
check('messages without book fields still parse as before', () => {
  const [t] = extractTicks('{"data":[{"key":"NC2885","ltp":1201,"volume":1010}]}')
  assert.equal(t.price, 1201); assert.equal(t.bid, undefined)
})
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'))
const rec = new DayRecorder(dir)
const b = new CandleBuilder()
const [t1] = extractTicks(real)
b.addTick({ symbol: 'RELIANCE', price: 1208, cumulativeVolume: 636419, ts: ist(10, 0, 5) })
b.addTick({ symbol: 'RELIANCE', price: 1210, cumulativeVolume: 636519, ts: ist(10, 0, 30) })
b.addTick({ symbol: 'RELIANCE', price: 1209, cumulativeVolume: 636619, ts: ist(10, 1, 10) })
rec.onTick('RELIANCE', t1, ist(10, 0, 5))
check('book snapshot file has header + one line per stock', () => {
  assert.equal(rec.writeBook(ist(10, 1)), 1)
  assert.equal(rec.writeBook(ist(10, 2)), 1)
  const lines = fs.readFileSync(path.join(dir, 'book-2026-10-19.csv'), 'utf8').trim().split('\n')
  assert.equal(lines.length, 3)
  assert.equal(lines[0], 'time,symbol,price,day_volume,bid,bid_qty,offer,offer_qty,total_buy_qty,total_sell_qty')
  assert.equal(lines[1], '10:01:00,RELIANCE,1208,636419,1207.9,4180,1208.4,887,422027,463667')
})
check('candle file holds every 1-minute candle and is rewritten, not appended', () => {
  assert.equal(rec.writeCandles(b, ist(10, 2)), 2)
  assert.equal(rec.writeCandles(b, ist(10, 3)), 2)
  const lines = fs.readFileSync(path.join(dir, 'candles-2026-10-19.csv'), 'utf8').trim().split('\n')
  assert.deepEqual(lines, ['time,symbol,open,high,low,close,volume,ticks', '10:00,RELIANCE,1208,1210,1208,1210,100,2', '10:01,RELIANCE,1209,1209,1209,1209,100,1'])
})
check('a recording error never throws (bad folder)', () => {
  const bad = new DayRecorder(path.join(dir, 'candles-2026-10-19.csv', 'x')) // a FILE used as a folder
  bad.onTick('TCS', { price: 1 }, ist(10, 0))
  assert.equal(bad.writeBook(ist(10, 1)), 0); assert.equal(bad.writeCandles(b, ist(10, 1)), 0); assert.equal(bad.errors, 2)
})
console.log(`\nAll ${ok} recorder checks passed.`)
