// test-tick-exits.mjs - offline checks of the tick-level exit engine (T2, 21 Oct). Run: node --experimental-strip-types test-tick-exits.mjs
import assert from 'node:assert/strict'
import { TickExitEngine, TICK_RULES } from './tick-exits.mjs'
let passed = 0; const check = (n, f) => { f(); passed++; console.log('  ok  ' + n) }
const T0 = Date.parse('2026-10-22T05:00:00Z') // 10:30 IST
const buy = () => ({ id: 'a', symbol: 'XYZ', direction: 'BUY', entry: 100, stop: 99, target: 102, stopDist: 1, atr: 0.4 })
let paperCost = null
try { paperCost = (await import('../../supabase/functions/_shared/paper.ts')).roundTripCostPct() } catch { /* run with --experimental-strip-types to compare */ }
if (paperCost !== null) check('costs match paper.ts', () => assert.ok(Math.abs(paperCost - TICK_RULES.costPct) < 0.0001))
check('stop: a BUY is closed on the FIRST tick at/below the stop, filled at the bid minus slippage', () => {
  const e = new TickExitEngine(); e.setTrades([buy()])
  assert.deepEqual(e.onTick('XYZ', { price: 99.5, bid: 99.45, ask: 99.55 }, T0), [])
  const ev = e.onTick('XYZ', { price: 98.98, bid: 98.95, ask: 99.0 }, T0 + 1000)
  assert.equal(ev[0].kind, 'close'); assert.equal(ev[0].reason, 'stop')
  assert.ok(Math.abs(ev[0].price - 98.95 * (1 - 0.0002)) < 0.01)
  assert.deepEqual(e.onTick('XYZ', { price: 98, bid: 97.9, ask: 98.1 }, T0 + 2000), [], 'no second close')
})
check('target fills at the target (limit order)', () => {
  const e = new TickExitEngine(); e.setTrades([buy()])
  const ev = e.onTick('XYZ', { price: 102.05, bid: 102, ask: 102.1 }, T0); assert.equal(ev[0].reason, 'target'); assert.equal(ev[0].price, 102)
})
check('no-loss at +1R happens on the tick, then a fall closes at ~0 (breakeven/lock), not at the old stop', () => {
  const e = new TickExitEngine(); e.setTrades([buy()])
  const m = e.onTick('XYZ', { price: 101.0, bid: 100.95, ask: 101.05 }, T0); assert.equal(m[0].kind, 'stopMoved'); assert.ok(m[0].to > 100)
  const ev = e.onTick('XYZ', { price: 100.1, bid: 100.05, ask: 100.15 }, T0 + 1000)
  assert.equal(ev[0].kind, 'close'); assert.ok(['lockedstop', 'breakeven'].includes(ev[0].reason)); assert.ok(ev[0].price > 99.9)
})
check('SELL mirror: stop above, bought back at the offer', () => {
  const e = new TickExitEngine(); e.setTrades([{ id: 's', symbol: 'ABC', direction: 'SELL', entry: 100, stop: 101, target: 98, stopDist: 1, atr: 0.4 }])
  const ev = e.onTick('ABC', { price: 101.02, bid: 101.0, ask: 101.05 }, T0); assert.equal(ev[0].reason, 'stop'); assert.ok(ev[0].price > 101.05)
})
check('15:15 close at the live price', () => {
  const e = new TickExitEngine(); e.setTrades([buy()])
  const ev = e.onTick('XYZ', { price: 100.5, bid: 100.45, ask: 100.55 }, Date.parse('2026-10-22T09:45:01Z')); assert.equal(ev[0].reason, 'squareoff')
})
check('ticks of other stocks are ignored; new trade list keeps the better (higher) stop already reached', () => {
  const e = new TickExitEngine(); e.setTrades([buy()])
  assert.deepEqual(e.onTick('OTHER', { price: 1 }, T0), [])
  e.onTick('XYZ', { price: 101.6, bid: 101.55, ask: 101.65 }, T0)
  const raised = [...e.trades.values()][0].stop
  e.setTrades([buy()]) // app sends the old stop 99 again
  assert.equal([...e.trades.values()][0].stop, raised)
})
console.log(`All ${passed} tick-exit checks passed.`)
