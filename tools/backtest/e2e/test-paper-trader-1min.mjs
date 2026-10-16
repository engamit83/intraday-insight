// Offline test of the v4.1 paper entry: first 1-minute candle after the signal, then the rest of that
// 5-minute window from 1-minute candles, then 5-minute candles. Fake DB, nothing real contacted.
// Run: node --import ./register.mjs test-paper-trader-1min.mjs
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
await import('../../../supabase/functions/paper-trader/index.ts')
const call = async () => { const r = await handler(new Request('https://x/', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ENV.SUPABASE_SERVICE_ROLE_KEY }, body: '{}' })); return r.json() }
let passed = 0; const check = (n, fn) => { fn(); passed++; console.log('  ok  ' + n) }

await call()
check('signal at 10:31:20 -> bought at the 10:32 one-minute open (100.5) + slippage, not the 10:30 candle open', () => {
  const t = DB.trades[0]; assert.equal(t.entry_price, 100.52); assert.equal(t.entry_time, iso('10:32')); assert.equal(t.details.entry_mode, '1min'); assert.equal(t.details.version, 'v4.1')
})
check('nothing is managed until the 10:30-10:35 window has closed', () => { assert.equal(DB.trades[0].status, 'OPEN'); assert.equal(DB.trades[0].last_bucket, null) })
NOW = RealDate.parse('2026-10-16T05:05:30Z') // 10:35:30
await call()
check('after 10:35 the rest of the entry window (10:32-10:34 one-minute candles) was managed', () => {
  const t = DB.trades[0]; assert.equal(t.status, 'OPEN'); assert.equal(t.last_bucket, iso('10:30')); assert.ok(Math.abs(t.best_exc - 0.48) < 1e-9, String(t.best_exc))
})
NOW = RealDate.parse('2026-10-16T05:20:30Z') // 10:50:30, the 10:45 candle (low 98.9) has closed
await call()
check('then 5-minute candles: the 10:45 candle hit the 99 stop -> closed at the stop', () => {
  const t = DB.trades[0]; assert.equal(t.status, 'CLOSED'); assert.equal(t.exit_reason, 'stop'); assert.equal(t.exit_time, iso('10:50')); assert.ok(Math.abs(t.exit_price - 98.98) < 0.01, String(t.exit_price))
})
check('only one trade was opened', () => assert.equal(DB.trades.length, 1))
console.log(`\nAll ${passed} one-minute-entry checks passed.`)
