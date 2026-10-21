// test-reversal.mjs - offline checks of the alert-only reversal warning (21 Oct). Run: node --experimental-strip-types tools/backtest/test-reversal.mjs
import assert from 'node:assert/strict'
import { reversalCheck, describeSigns } from '../../supabase/functions/_shared/reversal.ts'
let passed = 0; const check = (n, f) => { f(); passed++; console.log('  ok  ' + n) }
const bar = (m, o, h, l, c, v = 1000) => ({ startIso: `2026-10-21T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00.000Z`, open: o, high: h, low: l, close: c, volume: v })
// BUY at 100 at 04:30Z; price runs to 101 (+1%), then falls back
const up = []; for (let i = 0; i < 30; i++) up.push(bar(240 + i, 100 + i * 0.03, 100 + i * 0.03 + 0.05, 100 + i * 0.03 - 0.05, 100 + (i + 1) * 0.03))
const E = '2026-10-21T04:30:00.000Z'
check('no warning while the trade runs our way', () => assert.equal(reversalCheck('BUY', 100, E, up, 99.5).warn, false))
check('big heavy candle against us alone is NOT enough (needs 2 signs)', () => {
  const r = reversalCheck('BUY', 100, E, [...up, bar(270, 100.98, 100.98, 100.55, 100.57, 5000)], 99.5)
  assert.equal(r.signs.bigCandleAgainst, true); assert.equal(r.warn, false)
})
check('heavy candle against + gave back half the profit -> WARNING', () => {
  const r = reversalCheck('BUY', 100, E, [...up, bar(270, 100.8, 100.8, 100.3, 100.35, 5000)], 99.5)
  assert.equal(r.warn, true); assert.ok(r.signs.bigCandleAgainst && r.signs.gaveBackHalf, JSON.stringify(r.signs))
  assert.ok(describeSigns(r.signs).includes('big candle'))
})
check('SELL is the mirror image', () => {
  const dn = up.map((b) => ({ ...b, open: 200 - b.open, high: 200 - b.low, low: 200 - b.high, close: 200 - b.close }))
  const r = reversalCheck('SELL', 100, E, [...dn, bar(270, 99.2, 99.7, 99.2, 99.65, 5000)], 100.5)
  assert.equal(r.warn, true)
})
check('VWAP / give-back signs stay off until the trade was +0.5% in profit', () => {
  const flat = [bar(240, 100, 100.2, 99.9, 100.1), bar(241, 100.1, 100.2, 99.8, 99.85)]
  const r = reversalCheck('BUY', 100, E, flat, 99.5); assert.equal(r.signs.vwapLost, false); assert.equal(r.signs.gaveBackHalf, false)
})
console.log(`All ${passed} reversal checks passed.`)
