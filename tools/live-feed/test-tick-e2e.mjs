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

const received = { wsPath: null, messages: [], saved: new Map(), gatewayCalls: [], badAuth: 0, closes: [], moves: [] }

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
    if (b.action === 'open_trades') return reply(200, { trades: [{ id: 'T1', symbol: 'RELIANCE', direction: 'BUY', entry: 1200, stop: 1190, target: 1230, stopDist: 10, atr: 4 }], ntfyTopic: null })
    if (b.action === 'tick_close') { received.closes.push(b); return reply(200, { ok: true, closed: true, pnlRs: 700 }) }
    if (b.action === 'tick_stop') { received.moves.push(...b.moves); return reply(200, { ok: true }) }
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

await new Promise((r) => setTimeout(r, 9000))
child.kill('SIGINT')
await new Promise((r) => child.on('exit', r))
await new Promise((r) => setTimeout(r, 200))

let passed = 0; if (process.env.SHOW) console.log(output)
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name) }

check('the tick engine loaded the open paper trade from the app', () => assert.ok(received.gatewayCalls.includes('open_trades')))
check('RELIANCE rose past 1210 (+1R): stop raised on the tick (no-loss at +1R) and reported to the app', () => {
  assert.ok(received.moves.some((m) => m.id === 'T1' && m.stop > 1190), JSON.stringify(received.moves))
})
check('target 1230 hit -> closed on THAT tick at the target and reported once (tick_close)', () => {
  assert.equal(received.closes.length, 1, JSON.stringify(received.closes))
  assert.equal(received.closes[0].id, 'T1'); assert.equal(received.closes[0].reason, 'target'); assert.equal(received.closes[0].price, 1230)
})
check('the console shows the tick exit with the app\'s net result', () => assert.ok(/tick exit RELIANCE BUY target at 1230 .*net Rs 700/.test(output), output))
console.log(`\nAll ${passed} checks passed.\n--- program output ---\n${output}`)
wss.close(); gw.close()
process.exit(0)
