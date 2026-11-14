import zlib from 'node:zlib'
// test-kite.mjs - runs the whole feed against a FAKE Zerodha (price stream + instruments list) and a fake gateway.
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
fs.writeFileSync(tokenFile, JSON.stringify({ access_token: TOKEN, user_id: 'AB1234', saved: new Date().toISOString() }))
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

const child = spawn(process.execPath, ['feed.mjs'], { cwd: here, env: { ...process.env, GATEWAY_URL: `http://127.0.0.1:${gw.address().port}`, FEED_TOKEN, FEED_SOURCE: 'kite',
  KITE_API_KEY: KEY, KITE_TOKEN_FILE: tokenFile, KITE_WS_URL: `ws://127.0.0.1:${wss.address().port}`, KITE_API_URL: `http://127.0.0.1:${api.address().port}`,
  RECORD_DIR: tmp, TEST_IGNORE_MARKET_HOURS: '1', STATUS_EVERY_MS: '2000' } })
let output = ''; child.stdout.on('data', (d) => (output += d)); child.stderr.on('data', (d) => (output += d))
await new Promise((r) => setTimeout(r, 7000)); child.kill('SIGINT'); await new Promise((r) => child.on('exit', r)); await new Promise((r) => setTimeout(r, 200))

let passed = 0; const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name) }
check('binary reader: full packet -> price, volume, bid/offer, prev close', () => {
  const [{ kf, ...t }] = parseKiteBinary(frame([full(REL, 1234.55, 4321, 1234.5, 11, 1234.6, 22, 1200)]))
  assert.ok(kf && kf.kind === 'F')
  assert.deepEqual(t, { token: REL, price: 1234.55, cumulativeVolume: 4321, totBuy: 5000, totSell: 7000, prevClose: 1200, bid: 1234.5, bidQty: 11, ask: 1234.6, askQty: 22 })
})
check('binary reader: index packet and heartbeat', () => { const [{ kf, ...t }] = parseKiteBinary(frame([index(NIFTY, 25001.5, 24900)])); assert.deepEqual(t, { token: NIFTY, price: 25001.5, prevClose: 24900 }); assert.equal(kf.kind, 'I'); assert.deepEqual(parseKiteBinary(Buffer.from([0])), []) })
check('binary reader: EVERY full-packet field kept (14 Nov, rule 0r)', () => {
  const p = Buffer.alloc(184); const w = (o, v) => p.writeInt32BE(v, o)
  w(0, REL); w(4, 123455); w(8, 7); w(12, 123300); w(16, 4321); w(20, 5000); w(24, 7000); w(28, 120000); w(32, 124000); w(36, 119500); w(40, 120000)
  w(44, 1794500000); w(48, 0); w(52, 0); w(56, 0); w(60, 1794500001)
  for (let d = 0; d < 10; d++) { const q = 64 + d * 12; w(q, 100 + d); w(q + 4, 123400 + d * 10); p.writeInt16BE(3 + d, q + 8) }
  const [t] = parseKiteBinary(frame([p]))
  assert.deepEqual(t.kf, { kind: 'F', ltq: 7, atp: 1233, vol: 4321, tb: 5000, ts: 7000, open: 1200, high: 1240, low: 1195, close: 1200, ltt: 1794500000, oi: 0, oiH: 0, oiL: 0, exTs: 1794500001,
    depth: [...Array(10).keys()].map((d) => [100 + d, (123400 + d * 10) / 100, 3 + d]) })
  const ix = Buffer.alloc(32); ix.writeInt32BE(NIFTY, 0); ix.writeInt32BE(2500150, 4); ix.writeInt32BE(2510000, 8); ix.writeInt32BE(2490000, 12); ix.writeInt32BE(2495000, 16); ix.writeInt32BE(2490000, 20); ix.writeInt32BE(1150, 24); ix.writeInt32BE(1794500002, 28)
  assert.deepEqual(parseKiteBinary(frame([ix]))[0].kf, { kind: 'I', high: 25100, low: 24900, open: 24950, close: 24900, change: 11.5, exTs: 1794500002 })
})
check('login file: today counts, an old one does not', () => {
  process.env.KITE_API_KEY = KEY; process.env.KITE_TOKEN_FILE = tokenFile
  assert.ok(kiteLogin(here)); assert.equal(kiteLogin(here, Date.now() + 2 * 24 * 3600_000), null)
})
check('connected to Zerodha with key and token', () => assert.equal(got.wsPath, `/?api_key=${KEY}&access_token=${TOKEN}`))
check('instruments list asked with the login', () => assert.equal(got.instAuth, `token ${KEY}:${TOKEN}`))
check('subscribed our tokens in full mode, not the foreign one', () => {
  const sub = got.msgs.find((m) => m.a === 'subscribe'), mode = got.msgs.find((m) => m.a === 'mode')
  assert.deepEqual([...sub.v].sort(), [NIFTY, REL, TCS].sort()); assert.equal(mode.v[0], 'full')
})
check('prices were used and recorded as ticks', () => {
  const f = fs.readdirSync(tmp).find((n) => n.startsWith('ticks-')); assert.ok(f, 'no tick file: ' + fs.readdirSync(tmp).join(' ') + '\n' + output)
  const txt = fs.readFileSync(path.join(tmp, f), 'utf8')
  assert.ok(/RELIANCE,12\d\d,\d+,1\d{3}\.9,50,1\d{3}\.1,60/.test(txt), txt.slice(0, 400)); assert.ok(txt.includes(',TCS,') && txt.includes(',NIFTY,')); assert.ok(!txt.includes('ZZZNOTOURS'))
})
check('every Zerodha field recorded in kite-full-DAY.csv.gz (50 columns, depth included)', () => {
  const f = fs.readdirSync(tmp).find((n) => n.startsWith('kite-full-')); assert.ok(f, 'no kite-full file: ' + fs.readdirSync(tmp).join(' '))
  const lines = zlib.gunzipSync(fs.readFileSync(path.join(tmp, f))).toString().trim().split('\n')
  assert.equal(lines[0].split(',').length, 50); assert.ok(lines[0].startsWith('time,symbol,token,kind,ltp,last_qty'))
  const rel = lines.find((l) => l.split(',')[1] === 'RELIANCE'); assert.ok(rel); const c = rel.split(','); assert.equal(c.length, 50); assert.equal(c[3], 'F'); assert.equal(c[20], '50'); assert.equal(c[35], '60')
  const nf = lines.find((l) => l.split(',')[1] === 'NIFTY'); assert.ok(nf); assert.equal(nf.split(',').length, 50); assert.equal(nf.split(',')[3], 'I')
  assert.ok(!lines.some((l) => l.includes('ZZZNOTOURS')))
})
check('the log never shows the key or the token', () => { assert.ok(!output.includes(KEY)); assert.ok(!output.includes(TOKEN)) })
check('said it is on Zerodha', () => assert.ok(output.includes('Connected to Zerodha live feed.'), output))
console.log(`\n${passed} checks passed.`); wss.close(); api.close(); gw.close(); process.exit(0)
