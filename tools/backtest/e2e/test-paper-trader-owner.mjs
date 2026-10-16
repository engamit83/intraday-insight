// Offline test of the OWNER'S exit rule (stop at the buy price from the start) + the learning record
// (did the price reach the target before the normal stop? what would the normal stop have earned?). Fake DB.
// Run: node --import ./register.mjs test-paper-trader-owner.mjs
import assert from 'node:assert/strict'
const RealDate = Date
let NOW = RealDate.parse('2026-10-16T05:03:00Z') // 10:33:00 IST
globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a) } static now() { return NOW } }
let handler
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'S'.repeat(40), SUPABASE_ANON_KEY: 'A'.repeat(40) }
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { handler = h } }
const iso = (hhmm) => new RealDate(RealDate.parse(`2026-10-16T${hhmm}:00+05:30`)).toISOString()
const bars1 = [['10:30', 100, 100.3, 99.95, 100.2], ['10:31', 100.2, 100.5, 100.1, 100.45], ['10:32', 100.5, 100.8, 100.4, 100.7], ['10:33', 100.7, 101.0, 100.6, 100.9], ['10:34', 100.9, 100.95, 100.7, 100.8]]
const bars5 = [['10:30', 100, 101.0, 99.95, 100.8], ['10:35', 100.8, 101.0, 100.3, 100.4], ['10:40', 100.4, 100.5, 99.8, 99.9], ['10:45', 99.9, 100, 98.9, 99.0]]
const rowsOf = (list) => list.map(([b, o, h, l, c]) => ({ bucket_start: iso(b), open: o, high: h, low: l, close: c })).filter((r) => RealDate.parse(r.bucket_start) <= NOW)
const DB = { trades: [], logs: [], calls: [],
  answer(q) {
    const f = (op, col) => q.filters.find((x) => x[0] === op && x[1] === col)?.[2]
    if (q.table === 'user_settings') return { data: { user_id: 'owner' }, error: null }
    if (q.table === 'simulated_trades' && q.op === 'select') return { data: [...DB.trades], error: null }
    if (q.table === 'simulated_trades' && q.op === 'insert') { const row = { id: 't' + (DB.trades.length + 1), last_bucket: null, at_breakeven: false, locked: false, best_exc: null, best_close: null, ...q.payload }; DB.trades.push(row); return { data: row, error: null } }
    if (q.table === 'simulated_trades' && q.op === 'update') { Object.assign(DB.trades.find((x) => x.id === f('eq', 'id')), q.payload); return { data: null, error: null } }
    if (q.table === 'signals') return { data: [{ id: 's1', symbol: 'ABC', signal_type: 'BUY', entry_price: 100.4, stoploss_price: 99, target_price: 102.8, created_at: '2026-10-16T05:01:20Z', indicators: { rules: 'v4', version: 'v4.1', stop_dist: 1.4, atr: 0.7, reasons: ['test'] } }], error: null }
    if (q.table === 'live_candles') {
      const rows = rowsOf(f('eq', 'timeframe') === '1min' ? bars1 : bars5)
      if (f('eq', 'bucket_start')) return { data: rows.find((r) => r.bucket_start === f('eq', 'bucket_start')) ?? null, error: null }
      const from = f('gte', 'bucket_start'), to = f('lt', 'bucket_start')
      return { data: rows.filter((r) => r.bucket_start >= from && (!to || r.bucket_start < to)), error: null }
    }
    if (q.table === 'system_logs') return { data: [], error: null }
    return { data: null, error: null }
  } }
globalThis.__DB = DB
const { PAPER } = await import('../../../supabase/functions/_shared/paper.ts')
PAPER.exitMode = 'buyPrice' // owner's rule (16 Oct)
await import('../../../supabase/functions/paper-trader/index.ts')
const call = async () => { const r = await handler(new Request('https://x/', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ENV.SUPABASE_SERVICE_ROLE_KEY }, body: '{}' })); return r.json() }
let passed = 0; const check = (n, fn) => { fn(); passed++; console.log('  ok  ' + n) }

await call()
check('owner rule: bought at 10:32 open + slippage with the stop AT THE BUY PRICE; normal stop kept as initial_stop', () => {
  const t = DB.trades[0]; assert.equal(t.entry_price, 100.52); assert.equal(t.stoploss, 100.52); assert.equal(t.initial_stop, 99); assert.equal(t.details.exit_mode, 'buyPrice')
  assert.equal(t.details.track.stop0, 99); assert.equal(t.details.track.pred.done, false)
})
NOW = RealDate.parse('2026-10-16T05:05:30Z') // 10:35:30: the rest of the 10:30 window (10:32-10:34, low 100.4) has closed
await call()
check('price dipped below the buy price -> closed at the buy price (reason "breakeven", only costs lost)', () => {
  const t = DB.trades[0]; assert.equal(t.status, 'CLOSED'); assert.equal(t.exit_reason, 'breakeven')
  assert.ok(t.pnl < 0 && t.pnl > -200, `pnl ${t.pnl}`)
})
check('learning record keeps running after the exit: not decided yet, normal-stop shadow still open', () => {
  const tr = DB.trades[0].details.track; assert.equal(tr.pred.done, false); assert.ok(!tr.shadow.closed); assert.equal(tr.cursor, iso('10:30'))
})
NOW = RealDate.parse('2026-10-16T05:20:30Z') // 10:50:30: the 10:45 candle fell to 98.9 (below the normal stop 99)
await call()
check('prediction judged FAILED (normal stop 99 reached before target 102.8); shadow closed at the normal stop', () => {
  const tr = DB.trades[0].details.track; assert.equal(tr.pred.done, true); assert.equal(tr.pred.failed, true); assert.equal(tr.pred.reached, false)
  assert.equal(tr.shadow.closed, true); assert.equal(tr.shadow.reason, 'stop'); assert.ok(tr.shadow.netRs < -1000, String(tr.shadow.netRs))
})
const rep = await (async () => { const r = await handler(new Request('https://x/', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ENV.SUPABASE_SERVICE_ROLE_KEY }, body: '{}' })); return r.json() })()
check('report shows targetReached=false and the normal-stop result', () => {
  const c = rep.closed[0]; assert.equal(c.targetReached, false); assert.ok(c.normalStopNetRs < -1000); assert.equal(rep.exitMode, 'buyPrice')
})
console.log(`\nAll ${passed} owner-rule checks passed. (owner rule lost Rs ${Math.round(-DB.trades[0].pnl)} in costs; the normal stop would have lost Rs ${Math.round(-DB.trades[0].details.track.shadow.netRs)})`)
