// Offline test of supabase/functions/history-export with a fake DB, fake auth and fake Sharekhan REST.
// Run from the repo root: node --experimental-strip-types --import ./tools/backtest/e2e/register.mjs tools/backtest/e2e/test-history-export.mjs
import assert from 'node:assert/strict'
let handler
const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'S'.repeat(40), SUPABASE_ANON_KEY: 'A'.repeat(40),
  SHAREKHAN_API_KEY: 'apikey', AUTH_ENCRYPTION_KEY: 'k'.repeat(32) }
globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { handler = h } }
let tokenPresent = true
globalThis.__DB = { calls: [], answer(q) {
  if (q.table === 'user_settings') return tokenPresent
    ? { data: { user_id: 'u1', sharekhan_access_token: 'enc', sharekhan_token_expiry: new Date(Date.now() + 3600e3).toISOString() }, error: null }
    : { data: null, error: null }
  if (q.table === 'scripcodes') return { data: [{ symbol: 'RELIANCE', scrip_code: 2885 }, { symbol: 'TCS', scrip_code: 11536 }, { symbol: 'M&M', scrip_code: 2031 }], error: null }
  return { data: null, error: null }
} }
// patch fake auth: a token "USER" is a valid user
const fake = await import('./fake-supabase.mjs')
const origCreate = fake.createClient
let restCalls = []
globalThis.fetch = async (url) => {
  const m = String(url).match(/historical\/NC\/(\d+)\/(\w+)$/); assert.ok(m, 'unexpected fetch ' + url)
  restCalls.push(m[1] + '/' + m[2])
  const rows = [{ open: 10, high: 11, low: 9, close: 10.5, qty: 100, tradeTime: '09:19:52', tradeDate: '5/10/2026' },
                { open: 10.5, high: 12, low: 10, close: 11, qty: 200, tradeTime: '09:24:52', tradeDate: '5/10/2026' }]
  return new Response(JSON.stringify({ status: 200, data: rows }), { status: 200 })
}
await import('../../../supabase/functions/history-export/index.ts')
const call = async (body, auth) => {
  const r = await handler(new Request('https://x/', { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body) }))
  return { status: r.status, body: await r.json() }
}
let passed = 0
const check = async (name, fn) => { await fn(); passed++; console.log('  ok  ' + name) }
await check('no auth -> 401', async () => assert.equal((await call({}, null)).status, 401))
await check('anon key is not a user session -> 401', async () => assert.equal((await call({}, ENV.SUPABASE_ANON_KEY)).status, 401))
globalThis.__VALID_USER_TOKEN = 'USERJWT'
await check('signed-in user gets compact candles for allowed symbols only', async () => {
  restCalls = []
  const r = await call({ symbols: ['RELIANCE', 'TCS', 'NOTINUNIVERSE'] }, 'USERJWT')
  assert.equal(r.status, 200)
  assert.deepEqual(Object.keys(r.body.results).sort(), ['RELIANCE', 'TCS'])
  assert.deepEqual(r.body.results.RELIANCE.candles[0], ['2026-10-05T09:19:52+05:30', 10, 11, 9, 10.5, 100])
  assert.equal(r.body.interval, '5minute')
  assert.deepEqual(restCalls, ['2885/5minute', '11536/5minute'])
  assert.ok(!JSON.stringify(r.body).includes('enc'), 'token must never be returned')
})
await check('symbols with & work (M&M), interval whitelist enforced', async () => {
  restCalls = []
  const r = await call({ symbols: ['M&M'], interval: 'hacker' }, 'USERJWT')
  assert.equal(r.status, 200); assert.deepEqual(restCalls, ['2031/5minute'])
  const d = await call({ symbols: ['TCS'], interval: 'daily' }, 'USERJWT')
  assert.equal(d.body.interval, 'daily')
})
await check('more than 10 symbols are capped at 10', async () => {
  const many = ['RELIANCE','TCS','HDFCBANK','ICICIBANK','INFY','HINDUNILVR','ITC','SBIN','BHARTIARTL','KOTAKBANK','LT','AXISBANK']
  restCalls = []
  const r = await call({ symbols: many }, 'USERJWT')
  assert.equal(r.status, 200)
  assert.ok(Object.keys(r.body.results).length <= 10)
  assert.ok(r.body.unresolved.length + Object.keys(r.body.results).length === 10)
})
await check('no Sharekhan token -> 409 with a hint', async () => {
  tokenPresent = false
  const r = await call({ symbols: ['TCS'] }, 'USERJWT')
  assert.equal(r.status, 409); assert.equal(r.body.error, 'NO_VALID_SHAREKHAN_TOKEN')
  tokenPresent = true
})
console.log(`\nAll ${passed} checks passed.`)
