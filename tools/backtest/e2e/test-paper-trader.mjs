// Offline smoke test of supabase/functions/paper-trader with a fake DB.
import assert from 'node:assert/strict'
const RealDate = Date
let NOW = RealDate.parse('2026-10-16T05:12:30Z') // 10:42:30 IST
globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(NOW); else super(...a) } static now() { return NOW } }
let handler
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'S'.repeat(40), SUPABASE_ANON_KEY: 'A'.repeat(40) }
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { handler = h } }
const iso = (hhmm) => new RealDate(RealDate.parse(`2026-10-16T${hhmm}:00+05:30`)).toISOString()
// 5-min candles for ABC: signal at 10:31 (forming candle 10:30), price rises then falls
const bars5 = [['10:30', 100, 100.4, 99.9, 100.3], ['10:35', 100.3, 101.2, 100.2, 101.0], ['10:40', 101.0, 101.3, 100.6, 100.7], ['10:45', 100.7, 100.8, 99.0, 99.2]]
const DB = { trades: [], logs: [], calls: [],
  answer(q) {
    const f = (op, col) => q.filters.find((x) => x[0] === op && x[1] === col)?.[2]
    if (q.table === 'user_settings') return { data: { user_id: 'owner' }, error: null }
    if (q.table === 'simulated_trades' && q.op === 'select') return { data: DB.trades.filter((t) => t.rules === 'v4'), error: null }
    if (q.table === 'simulated_trades' && q.op === 'insert') { const row = { id: 't' + (DB.trades.length + 1), last_bucket: null, at_breakeven: false, locked: false, best_exc: null, best_close: null, ...q.payload }; DB.trades.push(row); return { data: row, error: null } }
    if (q.table === 'simulated_trades' && q.op === 'update') { const t = DB.trades.find((x) => x.id === f('eq', 'id')); Object.assign(t, q.payload); return { data: null, error: null } }
    if (q.table === 'signals') return { data: [{ id: 's1', symbol: 'ABC', signal_type: 'BUY', entry_price: 100, stoploss_price: 99, target_price: 102, created_at: iso('10:31'), indicators: { rules: 'v4', stop_dist: 1, atr: 0.5, reasons: ['test'] } }], error: null }
    if (q.table === 'live_candles') {
      const tf = f('eq', 'timeframe'); const exact = f('eq', 'bucket_start'); const from = f('gte', 'bucket_start')
      const rows = bars5.map(([b, o, h, l, c]) => ({ bucket_start: iso(b), open: o, high: h, low: l, close: c }))
        .filter((r) => RealDate.parse(r.bucket_start) <= NOW) // only candles that have started
      if (tf === '5min' && exact) return { data: rows.find((r) => r.bucket_start === exact) ?? null, error: null }
      if (tf === '5min') return { data: rows.filter((r) => r.bucket_start >= from), error: null }
      return { data: null, error: null }
    }
    if (q.table === 'system_logs' && q.op === 'insert') { DB.logs.push(q.payload); return { data: null, error: null } }
    if (q.table === 'system_logs') return { data: [], error: null }
    return { data: null, error: null }
  } }
globalThis.__DB = DB
await import('../../../supabase/functions/paper-trader/index.ts')
const call = async (body = {}, auth = 'service') => {
  const h = { 'content-type': 'application/json' }
  if (auth === 'service') h.authorization = 'Bearer ' + ENV.SUPABASE_SERVICE_ROLE_KEY
  if (auth === 'user') h.authorization = 'Bearer USERJWT'
  const r = await handler(new Request('https://x/', { method: 'POST', headers: h, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }
}
let passed = 0; const check = (n, fn) => { fn(); passed++; console.log('  ok  ' + n) }
const r1 = await call()
check('opens a paper trade for the v4 signal at the 10:30 candle open + slippage', () => {
  assert.equal(r1.status, 200); assert.equal(DB.trades.length, 1)
  const t = DB.trades[0]; assert.equal(t.direction, 'BUY'); assert.equal(t.entry_price, 100.02); assert.equal(t.quantity, 999); assert.equal(t.user_id, 'owner')
})
check('managed the closed 10:30 and 10:35 candles: +1R reached -> stop moved to breakeven/lock', () => {
  const t = DB.trades[0]; assert.equal(t.status, 'OPEN'); assert.ok(t.stoploss >= 100.02, `stop ${t.stoploss}`); assert.ok(t.locked || t.at_breakeven)
})
const r2 = await call()
check('running again does not open the same signal twice', () => assert.equal(DB.trades.length, 1))
NOW = RealDate.parse('2026-10-16T05:20:30Z') // 10:50:30 IST, the 10:45 candle (low 99.0) has closed
const r3 = await call()
check('price fell through the raised stop -> closed with a small result, not the full loss', () => {
  const t = DB.trades[0]; assert.equal(t.status, 'CLOSED'); assert.ok(['lockedstop', 'breakeven'].includes(t.exit_reason), t.exit_reason)
  assert.ok(t.pnl > -400, `pnl ${t.pnl}`)
})
const u = await call({}, 'none')
check('no auth -> 401', () => assert.equal(u.status, 401))
NOW = RealDate.parse('2026-10-16T10:05:00Z') // 15:35 IST
await call()
check('daily summary written once after 15:30', () => { assert.equal(DB.logs.filter((l) => String(l.message).startsWith('Paper day summary')).length, 1) })
console.log(`\nAll ${passed} checks passed.`, JSON.stringify(r3.body.log))
