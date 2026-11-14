import zlib from 'node:zlib'
// test-kite-only.mjs (14 Nov, owner: Zerodha ONLY, keep looking for Zerodha): no Zerodha login at start -> the feed must NOT use Sharekhan,
// must keep retrying, and must connect to Zerodha as soon as the login appears. Fake Zerodha + fake gateway, nothing real contacted.
// Nothing real is contacted. Run:  node test-kite.mjs
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { WebSocketServer } from 'ws'
import { parseKiteBinary, kiteLogin } from './kite-ticks.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kite-test-'))
const FEED_TOKEN = 'f'.repeat(64), KEY = 'testkey123', TOKEN = 'FAKE-KITE-TOKEN-XYZ'
const tokenFile = path.join(tmp, 'kite-token.json')
// no login file yet: it is written 4 s after the feed starts
fs.writeFileSync(path.join(tmp, 'app-symbols.json'), '[]')
const REL = 738561, TCS = 2953217, NIFTY = 256265 // real-looking Kite tokens (NIFTY 50: low byte 9 = index)

function full(token, ltp, vol, bid, bidQty, ask, askQty, close) {
  const p = Buffer.alloc(184); p.writeInt32BE(token, 0); p.writeInt32BE(Math.round(ltp * 100), 4); p.writeInt32BE(vol, 16); p.writeInt32BE(5000, 20); p.writeInt32BE(7000, 24)
  p.writeInt32BE(Math.round(close * 100), 40); p.writeInt32BE(bidQty, 64); p.writeInt32BE(Math.round(bid * 100), 68); p.writeInt32BE(askQty, 124); p.writeInt32BE(Math.round(ask * 100), 128); return p
}
function index(token, ltp, close) { const p = Buffer.alloc(32); p.writeInt32BE(token, 0); p.writeInt32BE(Math.round(ltp * 100), 4); p.writeInt32BE(Math.round(close * 100), 20); return p }
function frame(packets) { const h = Buffer.alloc(2); h.writeInt16BE(packets.length, 0); return Buffer.concat([h, ...packets.flatMap((p) => { const l = Buffer.alloc(2); l.writeInt16BE(p.length, 0); return [l, p] })]) }

const got = { wsPath: null, msgs: [], gateway: [], instAuth: null }
const wss = new WebSocketServer({ port: 0 }); await new Promise((r) => wss.on('listening', r))
wss.on('connection', (sock, req) => {
  got.wsPath = req.url
  sock.on('message', (m) => got.msgs.push(JSON.parse(m.toString())))
  let n = 0
  const t = setInterval(() => { n++
    sock.send(frame([full(REL, 1200 + n, 1000 + n * 10, 1199.9 + n, 50, 1200.1 + n, 60, 1190), full(TCS, 3000 - n, 500 + n * 5, 2999.5 - n, 10, 3000.5 - n, 20, 3010), index(NIFTY, 25000 + n, 24900), full(999999, 5, 1, 4.9, 1, 5.1, 1, 5)]))
    sock.send(Buffer.from([0])) // heartbeat
  }, 100)
  sock.on('close', () => clearInterval(t))
})
const api = http.createServer((req, res) => {
  got.instAuth = req.headers.authorization
  res.writeHead(200, { 'content-type': 'text/csv' })
  res.end('instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange\n' +
    `${REL},2885,RELIANCE,"RELIANCE INDUSTRIES",0,,0,0.1,1,EQ,NSE,NSE\n${TCS},11536,TCS,"TATA CONSULTANCY",0,,0,0.1,1,EQ,NSE,NSE\n${NIFTY},1001,NIFTY 50,"NIFTY 50",0,,0,0,0,EQ,INDICES,NSE\n` +
    '999999,1,ZZZNOTOURS,"X",0,,0,0.05,1,EQ,NSE,NSE\n' + 'x,'.repeat(12).repeat(900) + '\n')
})
await new Promise((r) => api.listen(0, r))
const gw = http.createServer((req, res) => { let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
  const b = JSON.parse(body || '{}'); got.gateway.push(b.action); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, trades: [] })) }) })
await new Promise((r) => gw.listen(0, r))

const child = spawn(process.execPath, ['feed.mjs'], { cwd: here, env: { ...process.env, GATEWAY_URL: `http://127.0.0.1:${gw.address().port}`, FEED_TOKEN, FEED_SOURCE: '',
  KITE_API_KEY: KEY, KITE_TOKEN_FILE: tokenFile, KITE_WS_URL: `ws://127.0.0.1:${wss.address().port}`, KITE_API_URL: `http://127.0.0.1:${api.address().port}`,
  RECORD_DIR: tmp, TEST_IGNORE_MARKET_HOURS: '1', STATUS_EVERY_MS: '2000' } })
let output = ''; child.stdout.on('data', (d) => (output += d)); child.stderr.on('data', (d) => (output += d))
await new Promise((r) => setTimeout(r, 4000)); const before = output
fs.writeFileSync(tokenFile, JSON.stringify({ access_token: TOKEN, user_id: 'AB1234', saved: new Date().toISOString() }))
await new Promise((r) => setTimeout(r, 12000)); child.kill('SIGINT'); await new Promise((r) => child.on('exit', r)); await new Promise((r) => setTimeout(r, 200))

let passed = 0; const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name) }
check('no login yet: the feed says so and does NOT fall back to Sharekhan', () => {
  assert.ok(before.includes('No Zerodha login for today'), before); assert.ok(!before.includes('Connected to Zerodha'), before)
  assert.ok(!got.gateway.includes('token'), 'asked the gateway for the Sharekhan login: ' + got.gateway.join(','))
  assert.ok(!output.includes('Sharekhan login'), output)
})
check('it kept retrying and connected to Zerodha once the login appeared', () => { assert.ok(output.includes('Connected to Zerodha live feed.'), output); assert.ok(/Reconnecting in \d+s/.test(before), before) })
check('ticks recorded after connecting', () => { assert.ok(fs.readdirSync(tmp).some((n) => n.startsWith('ticks-')), fs.readdirSync(tmp).join(' ')) })
check('never asked the gateway for the Sharekhan login at all', () => assert.ok(!got.gateway.includes('token'), got.gateway.join(',')))
console.log(`\n${passed} checks passed.`)
wss.close(); api.close(); gw.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0)
