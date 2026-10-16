// test-track.mjs - unit checks of the learning record (owner, 16 Oct). Run: node --experimental-strip-types tools/backtest/test-track.mjs
import assert from 'node:assert/strict'
import { newTrack, trackOnCandle, trackDone } from '../../supabase/functions/_shared/paper.ts'
let ok = 0; const check = (n, f) => { f(); ok++; console.log('  ok  ' + n) }
check('BUY: target reached before the normal stop -> reached', () => {
  const tr = newTrack('BUY', 100, 99, 102, 1, 0.5)
  trackOnCandle(tr, { bucket: '10:35', open: 100, high: 100.8, low: 99.6, close: 100.7 }, 1000)
  trackOnCandle(tr, { bucket: '10:40', open: 100.7, high: 102.1, low: 100.6, close: 102 }, 1000)
  assert.equal(tr.pred.reached, true); assert.equal(tr.pred.done, true); assert.ok(tr.pred.best >= 1)
})
check('BUY: normal stop first -> failed, even if target comes later', () => {
  const tr = newTrack('BUY', 100, 99, 102, 1, 0.5)
  trackOnCandle(tr, { bucket: '10:35', open: 100, high: 100.2, low: 98.9, close: 99.2 }, 1000)
  trackOnCandle(tr, { bucket: '10:40', open: 99.2, high: 102.5, low: 99.1, close: 102.4 }, 1000)
  assert.equal(tr.pred.failed, true); assert.equal(tr.pred.reached, false)
})
check('SELL mirror: target reached', () => {
  const tr = newTrack('SELL', 100, 101, 98, 1, 0.5)
  trackOnCandle(tr, { bucket: '11:00', open: 100, high: 100.4, low: 97.9, close: 98 }, 1000)
  assert.equal(tr.pred.reached, true)
})
check('neither by 15:15 -> done, not reached; best move recorded', () => {
  const tr = newTrack('BUY', 100, 99, 102, 1, 0.5)
  trackOnCandle(tr, { bucket: '14:00', open: 100, high: 101.5, low: 99.8, close: 101 }, 1000)
  trackOnCandle(tr, { bucket: '15:15', open: 101, high: 101.2, low: 100.9, close: 101 }, 1000)
  assert.equal(tr.pred.done, true); assert.equal(tr.pred.reached, false); assert.ok(Math.abs(tr.pred.best - 0.75) < 1e-9)
  assert.equal(tr.shadow.closed, true); assert.equal(tr.shadow.reason, 'squareoff'); assert.ok(trackDone(tr))
})
console.log(`\nAll ${ok} learning-record checks passed.`)
