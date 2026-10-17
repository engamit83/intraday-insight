// Offline test of PHONE ALERTS (Telegram) on top of the owner's exit rule. Telegram is faked. Original header:
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
const SENT = []
const NTFY = []
let FEED_STALE = false
globalThis.fetch = async (url, init) => {
  const u = String(url)
  if (u.startsWith('https://ntfy.sh/')) { NTFY.push({ topic: u.slice(16), text: init.body }); return new Response('{}') }
  if (u.includes('/getUpdates')) return new Response(JSON.stringify({ ok: true, result: [{ message: { chat: { id: 777 } } }] }))
  if (u.includes('/sendMessage')) { SENT.push(JSON.parse(init.body)); return new Response('{"ok":true}') }
  throw new Error('unexpected fetch ' + u)
}
const NOTIFY = { telegram_bot_token: 'TESTTOKEN', telegram_chat_id: null, ntfy_topic: 'trd-test-topic', channel: 'both', enabled: true }
const DB = { trades: [], logs: [], calls: [],
  answer(q) {
    const f = (op, col) => q.filters.find((x) => x[0] === op && x[1] === col)?.[2]
    if (q.table === 'user_settings' && q.filters.some((x) => x[0] === 'gt')) return { data: [{ sharekhan_token_expiry: 'x' }], error: null }
    if (q.table === 'user_settings') return { data: { user_id: 'owner' }, error: null }
    if (q.table === 'simulated_trades' && q.op === 'select') return { data: [...DB.trades], error: null }
    if (q.table === 'simulated_trades' && q.op === 'insert') { const row = { id: 't' + (DB.trades.length + 1), last_bucket: null, at_breakeven: false, locked: false, best_exc: null, best_close: null, ...q.payload }; DB.trades.push(row); return { data: row, error: null } }
    if (q.table === 'simulated_trades' && q.op === 'update') { Object.assign(DB.trades.find((x) => x.id === f('eq', 'id')), q.payload); return { data: null, error: null } }
    if (q.table === 'signals') return { data: [{ id: 's1', symbol: 'ABC', signal_type: 'BUY', entry_price: 100.4, stoploss_price: 99, target_price: 102.8, created_at: '2026-10-16T05:01:20Z', indicators: { rules: 'v4', version: 'v4.1', stop_dist: 1.4, atr: 0.7, reasons: ['test'] } }], error: null }
    if (q.table === 'live_candles' && q.filters.some((x) => x[0] === 'order' && x[1] === 'updated_at')) return { data: { updated_at: new RealDate(NOW - (FEED_STALE ? 10 * 60_000 : 30_000)).toISOString() }, error: null }
    if (q.table === 'live_candles') {
      const rows = rowsOf(f('eq', 'timeframe') === '1min' ? bars1 : bars5)
      if (f('eq', 'bucket_start')) return { data: rows.find((r) => r.bucket_start === f('eq', 'bucket_start')) ?? null, error: null }
      const from = f('gte', 'bucket_start'), to = f('lt', 'bucket_start')
      return { data: rows.filter((r) => r.bucket_start >= from && (!to || r.bucket_start < to)), error: null }
    }
    if (q.table === 'notify_settings' && q.op === 'select') return { data: NOTIFY, error: null }
    if (q.table === 'notify_settings' && q.op === 'update') { Object.assign(NOTIFY, q.payload); return { data: null, error: null } }
    if (q.table === 'system_logs' && q.op === 'insert') { DB.logs.push(q.payload); return { data: null, error: null } }
    if (q.table === 'system_logs') { const k = q.filters.find((x) => x[0] === 'eq' && x[1] === 'message')?.[2]; return { data: k ? DB.logs.filter((l) => l.message === k) : [], error: null } }
    return { data: null, error: null }
  } }
globalThis.__DB = DB
const { PAPER } = await import('../../../supabase/functions/_shared/paper.ts')
PAPER.exitMode = 'buyPrice' // owner's rule (16 Oct)
await import('../../../supabase/functions/paper-trader/index.ts')
const call = async () => { const r = await handler(new Request('https://x/', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ENV.SUPABASE_SERVICE_ROLE_KEY }, body: '{}' })); return r.json() }
let passed = 0; const check = (n, fn) => { fn(); passed++; console.log('  ok  ' + n) }

await call()
check('first alert links the chat automatically (getUpdates) and sends a welcome + the OPEN alert with stop and why', () => {
  assert.equal(NOTIFY.telegram_chat_id, '777')
  assert.ok(SENT[0].text.includes('linked')); assert.equal(SENT[0].chat_id, 777)
  const open = SENT.find((m) => m.text.startsWith('📈')); assert.ok(open, JSON.stringify(SENT))
  assert.ok(open.text.includes('ABC') && open.text.includes('(buy price)'), open.text); assert.equal(open.chat_id, '777')
})
NOW = RealDate.parse('2026-10-16T05:05:30Z')
await call()
check('CLOSE alert when the trade exits at the buy price', () => assert.ok(SENT.some((m) => m.text.includes('closed: at buy price')), JSON.stringify(SENT.map((m) => m.text))))
check('no Sharekhan / feed alerts while connected and prices are fresh', () => assert.ok(!SENT.some((m) => m.text.includes('Sharekhan is NOT') || m.text.includes('feed is OFF'))))
FEED_STALE = true
NOW = RealDate.parse('2026-10-16T05:30:30Z')
await call(); await call()
check('feed OFF alert when no prices for > 3 minutes, sent only once per 30 minutes', () => assert.equal(SENT.filter((m) => m.text.includes('feed is OFF')).length, 1))
check('ntfy gets the same alerts (both channels on)', () => {
  assert.ok(NTFY.length >= 3 && NTFY.every((m) => m.topic === 'trd-test-topic'), JSON.stringify(NTFY))
  assert.ok(NTFY.some((m) => m.text.startsWith('📈')) && NTFY.filter((m) => m.text.includes('feed is OFF')).length === 1)
})
NOTIFY.channel = 'ntfy'; const tgBefore = SENT.length, nBefore = NTFY.length
const { notify } = await import('../../../supabase/functions/_shared/notify.ts')
const { createClient } = await import('./fake-supabase.mjs')
await notify(createClient(), 'switch test')
check("channel='ntfy' sends to ntfy only (switch works)", () => { assert.equal(SENT.length, tgBefore); assert.ok(NTFY.length > nBefore) })
console.log(`\nAll ${passed} alert checks passed. Messages:\n- ` + SENT.map((m) => m.text.replace(/\n/g, ' | ')).join('\n- '))
