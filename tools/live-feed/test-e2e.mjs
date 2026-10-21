// test-e2e.mjs - runs the whole program against FAKE servers on this computer:
//   - a fake Sharekhan stream that sends made-up prices
//   - a fake gateway that hands out a made-up token and collects saved candles
// Nothing real is contacted. Run:  node test-e2e.mjs
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { WebSocketServer } from 'ws'

const here = path.dirname(fileURLToPath(import.meta.url))
const FEED_TOKEN = 'f'.repeat(64)
const ACCESS_TOKEN = 'FAKE-ACCESS-TOKEN-123'

const received = { wsPath: null, messages: [], saved: new Map(), gatewayCalls: [], badAuth: 0 }

// ---- fake Sharekhan stream ----
const wss = new WebSocketServer({ port: 0 })
await new Promise((r) => wss.on('listening', r))
const wsPort = wss.address().port
wss.on('connection', (sock, req) => {
  received.wsPath = req.url
  sock.on('message', (m) => received.messages.push(m.toString()))
  let n = 0
  const timer = setInterval(() => {
    n++
    sock.send(JSON.stringify({ action: 'feed', data: [
      { key: 'NC2885', ltp: 1200 + n, volume: 1000 + n * 10 },
      { key: 'NC11536', ltp: 3000 - n, volume: 500 + n * 5 },
      { key: 'NC99999', ltp: 5 },          // a stock we did not ask for: must be ignored
    ] }))
    sock.send('pong')
  }, 100)
  sock.on('close', () => clearInterval(timer))
})

// ---- fake gateway ----
const gw = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const reply = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }
    if (req.headers['x-job-token'] !== FEED_TOKEN) { received.badAuth++; return reply(401, { error: 'Unauthorized' }) }
    const b = JSON.parse(body || '{}')
    received.gatewayCalls.push(b.action)
    if (b.action === 'token') {
      return reply(200, { accessToken: ACCESS_TOKEN, expiresAt: new Date(Date.now() + 3600e3).toISOString(),
        symbols: { RELIANCE: 2885, TCS: 11536 }, unresolved: [] })
    }
    if (b.action === 'candles') {
      for (const r of b.rows) received.saved.set(`${r.symbol}|${r.timeframe}|${r.bucket_start}`, r)
      return reply(200, { ok: true, saved: b.rows.length })
    }
    reply(400, { error: 'Unknown action' })
  })
})
await new Promise((r) => gw.listen(0, r))
const gwPort = gw.address().port

// ---- run the real program against them ----
try { fs.unlinkSync(path.join(here, 'raw_ticks.log')) } catch { /* none yet */ }
const child = spawn(process.execPath, ['feed.mjs'], {
  cwd: here,
  env: {
    ...process.env,
    GATEWAY_URL: `http://127.0.0.1:${gwPort}`,
    FEED_TOKEN,
    SHAREKHAN_WS_URL: `ws://127.0.0.1:${wsPort}`,
    TEST_IGNORE_MARKET_HOURS: '1',
  },
})
let output = ''
child.stdout.on('data', (d) => (output += d))
child.stderr.on('data', (d) => (output += d))

await new Promise((r) => setTimeout(r, 7500))
child.kill('SIGINT')
await new Promise((r) => child.on('exit', r))
await new Promise((r) => setTimeout(r, 200))

let passed = 0
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name) }

check('connects with the access token in the URL', () => assert.equal(received.wsPath, `/?ACCESS_TOKEN=${ACCESS_TOKEN}`))
check('sends subscribe then feed request with NC-prefixed codes', () => {
  assert.deepEqual(JSON.parse(received.messages[0]), { action: 'subscribe', key: ['feed'], value: [''] })
  const feed = JSON.parse(received.messages[1])
  assert.equal(feed.action, 'feed')
  assert.deepEqual(feed.key, ['ltp'])
  assert.deepEqual(feed.value[0].split(',').sort(), ['NC11536', 'NC2885'])
})
check('fetched the token from the gateway first', () => assert.equal(received.gatewayCalls[0], 'token'))
check('saved candles to the gateway', () => assert.ok(received.gatewayCalls.includes('candles')))
check('candles exist for both stocks, 1min and 5min', () => {
  const keys = [...received.saved.keys()]
  for (const sym of ['RELIANCE', 'TCS']) for (const tf of ['1min', '5min']) {
    assert.ok(keys.some((k) => k.startsWith(`${sym}|${tf}|`)), `missing ${sym} ${tf}`)
  }
})
check('the unrequested stock was ignored', () => assert.ok(![...received.saved.keys()].some((k) => k.includes('99999'))))
check('candle numbers make sense', () => {
  const r = [...received.saved.values()].find((x) => x.symbol === 'RELIANCE' && x.timeframe === '1min')
  assert.ok(r.high >= r.low && r.high >= r.open && r.high >= r.close && r.low <= r.open && r.low <= r.close)
  assert.ok(r.tick_count > 3 && r.open >= 1201 && r.close <= 1300)
  assert.ok(r.volume > 0, 'volume should come from the running total')
})
check('no wrong-token calls', () => assert.equal(received.badAuth, 0))
check('raw messages were saved for inspection', () => {
  const raw = fs.readFileSync(path.join(here, 'raw_ticks.log'), 'utf8')
  assert.ok(raw.includes('NC2885'))
})
check('the access token never appears in the console output', () => assert.ok(!output.includes(ACCESS_TOKEN) && !output.includes(FEED_TOKEN)))
if (process.platform !== 'win32') check('shut down cleanly on Ctrl+C', () => assert.ok(output.includes('Stopping')))

console.log(`\nAll ${passed} checks passed.\n--- program output ---\n${output}`)
wss.close(); gw.close()
process.exit(0)
