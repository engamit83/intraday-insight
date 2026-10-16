// test-extras.mjs - checks the "record extra stocks" feature against FAKE servers (nothing real is contacted).
//  A) the stream ADDS the extras: extras are recorded in the data folder but never sent to the database
//  B) the stream REPLACES the trading stocks with the extras: the feed's safety switch drops the extras
// Run: node test-extras.mjs
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { WebSocketServer } from 'ws'

const here = path.dirname(fileURLToPath(import.meta.url))
const FEED_TOKEN = 'f'.repeat(64)
let passed = 0
const check = (name, fn) => { fn(); passed++; console.log('  ok  ' + name) }

async function scenario(mode) {
  // a private copy of the program with an extras file
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedx-'))
  for (const f of ['feed.mjs', 'candles.mjs', 'parse.mjs', 'recorder.mjs']) fs.copyFileSync(path.join(here, f), path.join(dir, f))
  fs.symlinkSync(path.join(here, 'node_modules'), path.join(dir, 'node_modules'), 'junction')
  fs.writeFileSync(path.join(dir, 'record-extra.csv'), '# extra stocks to record\nEXTRA,99999\nNIFTY,20000\n')
  const got = { messages: [], saved: new Set() }
  const wss = new WebSocketServer({ port: 0 })
  await new Promise((r) => wss.on('listening', r))
  wss.on('connection', (sock) => {
    let extrasAsked = false
    sock.on('message', (m) => { got.messages.push(m.toString()); if (m.toString().includes('NC99999')) extrasAsked = true })
    let n = 0
    const t = setInterval(() => {
      n++
      const trading = [{ key: 'NC2885', ltp: 1200 + n, volume: 1000 + n }, { key: 'NC11536', ltp: 3000 - n, volume: 500 + n }]
      const extra = [{ key: 'NC99999', ltp: 50 + n, volume: 10 + n }, { key: 'NC20000', ltp: 25000 + n }]
      const data = !extrasAsked ? trading : mode === 'replace' && !got.messages.at(-1).includes('NC2885') ? extra : mode === 'replace' ? trading : [...trading, ...extra]
      sock.send(JSON.stringify({ action: 'feed', data }))
    }, 100)
    sock.on('close', () => clearInterval(t))
  })
  const gw = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c))
    req.on('end', () => {
      const b = JSON.parse(body || '{}')
      res.writeHead(200, { 'content-type': 'application/json' })
      if (b.action === 'token') return res.end(JSON.stringify({ accessToken: 'X', symbols: { RELIANCE: 2885, TCS: 11536 }, unresolved: [] }))
      for (const r of b.rows ?? []) got.saved.add(r.symbol)
      res.end(JSON.stringify({ ok: true }))
    })
  })
  await new Promise((r) => gw.listen(0, r))
  const child = spawn(process.execPath, ['feed.mjs'], { cwd: dir, env: { ...process.env, GATEWAY_URL: `http://127.0.0.1:${gw.address().port}`, FEED_TOKEN,
    SHAREKHAN_WS_URL: `ws://127.0.0.1:${wss.address().port}`, TEST_IGNORE_MARKET_HOURS: '1', EXTRA_CHECK_MS: '1500' } })
  let out = ''; child.stdout.on('data', (d) => (out += d)); child.stderr.on('data', (d) => (out += d))
  await new Promise((r) => setTimeout(r, 7000))
  child.kill('SIGINT'); await new Promise((r) => child.on('exit', r))
  wss.close(); gw.close()
  const files = fs.existsSync(path.join(dir, 'data')) ? fs.readdirSync(path.join(dir, 'data')) : []
  const candles = files.filter((f) => f.startsWith('candles-')).map((f) => fs.readFileSync(path.join(dir, 'data', f), 'utf8')).join('')
  return { got, out, candles }
}

const A = await scenario('add')
check('A: asked for the trading stocks first, then the extras in a second message', () => {
  const feeds = A.got.messages.filter((m) => m.includes('"feed"') && m.includes('ltp'))
  assert.equal(feeds.length, 2); assert.ok(feeds[0].includes('NC2885') && !feeds[0].includes('NC99999')); assert.ok(feeds[1].includes('NC99999') && feeds[1].includes('NC20000'))
})
check('A: extras are recorded in the data folder (stock and index)', () => assert.ok(A.candles.includes(',EXTRA,') && A.candles.includes(',NIFTY,') && A.candles.includes(',RELIANCE,')))
check('A: extras are NEVER sent to the database', () => { assert.ok(A.got.saved.has('RELIANCE')); assert.ok(!A.got.saved.has('EXTRA') && !A.got.saved.has('NIFTY')) })
check('A: safety switch did not fire', () => assert.ok(!A.out.includes('Dropping the extras')))

const B = await scenario('replace')
check('B: when extras push out the trading stocks, the feed drops the extras and asks for the trading stocks again', () => {
  assert.ok(B.out.includes('Dropping the extras'))
  const last = B.got.messages.filter((m) => m.includes('ltp')).at(-1)
  assert.ok(last.includes('NC2885') && !last.includes('NC99999'))
})
check('B: trading stocks kept being saved to the database', () => assert.ok(B.got.saved.has('RELIANCE') && B.got.saved.has('TCS')))
console.log(`\nAll ${passed} extras checks passed.`)
process.exit(0)
