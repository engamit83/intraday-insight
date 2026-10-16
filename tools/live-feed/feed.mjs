// feed.mjs - live price feed for intraday-insight (runs on your laptop).
//
//   1. Asks your Supabase "feed-gateway" for today's Sharekhan login token
//      and the list of stocks to watch.
//   2. Connects to Sharekhan's live price stream and subscribes to those stocks.
//   3. Builds 1-minute and 5-minute candles from the prices.
//   4. Saves the candles to your database (table: live_candles) every few seconds.
//
// Start it with:  node feed.mjs        Stop it with:  Ctrl+C
// It stops by itself a few minutes after the market closes (15:35 IST).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'
import { CandleBuilder, istMinuteOfDay, inMarketHours } from './candles.mjs'
import { extractTicks } from './parse.mjs'
import { DayRecorder } from './recorder.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))

// ---------- settings (.env file next to this program) ----------
function loadEnvFile() {
  const file = path.join(here, '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m || line.trim().startsWith('#')) continue
    const value = m[2].replace(/^["']|["']$/g, '')
    if (!(m[1] in process.env)) process.env[m[1]] = value
  }
}
loadEnvFile()

const GATEWAY_URL = process.env.GATEWAY_URL
const FEED_TOKEN = process.env.FEED_TOKEN
// Defaults to Sharekhan's real stream. Only tests change this.
const WS_BASE = process.env.SHAREKHAN_WS_URL || 'wss://stream.sharekhan.com/skstream/api/stream'
// Tests only. Never set this for real trading days.
const TEST_IGNORE_MARKET_HOURS = process.env.TEST_IGNORE_MARKET_HOURS === '1'

if (!GATEWAY_URL || !FEED_TOKEN || FEED_TOKEN.includes('paste')) {
  console.error('\nMissing settings. Open the file named .env in this folder and fill in GATEWAY_URL and FEED_TOKEN.')
  console.error('(See STEPS.md, step 4.)\n')
  process.exit(1)
}

const FLUSH_EVERY_MS = 5_000
const STATUS_EVERY_MS = 30_000
const PING_EVERY_MS = 30_000
const SILENCE_WARN_MS = 60_000
const RAW_LOG_LIMIT = 400
const STOP_AT_MINUTE = 15 * 60 + 35 // 15:35 IST

// ---------- small helpers ----------
const builder = new CandleBuilder({ ignoreMarketHours: TEST_IGNORE_MARKET_HOURS })
// our own day files (data folder): every 1-minute candle + a once-a-minute order-book snapshot
const recorder = new DayRecorder(process.env.RECORD_DIR || path.join(here, 'data'))
const BOOK_EVERY_MS = 60_000
const CANDLE_FILE_EVERY_MS = 5 * 60_000
function saveDayFiles() {
  const n = recorder.writeCandles(builder, Date.now())
  if (n) say(`saved ${n} one-minute candles to the data folder`)
}
const rawLogFile = path.join(here, 'raw_ticks.log')
let rawLogged = 0
let accessTokenInUse = ''

const istClock = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(11, 19)
const say = (msg) => console.log(`[${istClock()}] ${msg}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function scrub(text) {
  let s = String(text)
  if (accessTokenInUse) s = s.split(accessTokenInUse).join('***')
  return s.split(FEED_TOKEN).join('***')
}

function rawLog(kind, body) {
  if (rawLogged >= RAW_LOG_LIMIT) return
  rawLogged++
  try {
    fs.appendFileSync(rawLogFile, `${new Date().toISOString()} ${kind} ${scrub(body).slice(0, 2000)}\n`)
  } catch { /* logging must never stop the feed */ }
}

async function gateway(action, payload = {}) {
  const resp = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-job-token': FEED_TOKEN },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(20_000),
  })
  const text = await resp.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  if (!resp.ok) {
    const err = new Error(json?.error || `HTTP ${resp.status}`)
    err.status = resp.status
    err.hint = json?.hint
    throw err
  }
  return json
}

// ---------- saving candles ----------
let saveFailures = 0
let savedRows = 0
let lastSaveErrorAt = 0

async function flush() {
  const { rows, pending } = builder.collectDirty()
  if (rows.length === 0) return
  try {
    for (let i = 0; i < rows.length; i += 400) {
      await gateway('candles', { rows: rows.slice(i, i + 400) })
    }
    builder.commit(pending)
    savedRows += rows.length
  } catch (e) {
    saveFailures++
    if (Date.now() - lastSaveErrorAt > 60_000) {
      lastSaveErrorAt = Date.now()
      say(`! Could not save candles (${scrub(e.message)}). Will keep trying; nothing is lost while the program stays open.`)
    }
  }
}

// ---------- one connection session ----------
const stats = { messages: 0, unreadable: 0, lastMessageAt: 0, symbolLastTick: new Map() }

async function runSession() {
  say('Getting today\'s Sharekhan login from your database...')
  const info = await gateway('token')
  accessTokenInUse = info.accessToken
  const codeToSymbol = new Map()
  for (const [symbol, code] of Object.entries(info.symbols || {})) codeToSymbol.set(Number(code), symbol)
  const codes = [...codeToSymbol.keys()]
  if (codes.length === 0) throw new Error('No stocks to watch (scripcodes table empty?)')
  say(`Watching ${codes.length} stocks.${info.unresolved?.length ? ` Not found in scripcodes: ${info.unresolved.join(', ')}` : ''}`)

  const url = `${WS_BASE}?ACCESS_TOKEN=${encodeURIComponent(info.accessToken)}`
  const ws = new WebSocket(url)

  await new Promise((resolve) => {
    let timers = []
    let opened = false

    const stopTimers = () => { timers.forEach(clearInterval); timers = [] }

    ws.on('open', () => {
      opened = true
      stats.lastMessageAt = Date.now()
      say('Connected to Sharekhan live feed.')
      // Same two messages Sharekhan's own sample code sends.
      ws.send(JSON.stringify({ action: 'subscribe', key: ['feed'], value: [''] }))
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'feed', key: ['ltp'], value: [codes.map((c) => `NC${c}`).join(',')] }))
          say('Asked for live prices.')
        }
      }, 400)

      timers.push(setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.ping('ping') }, PING_EVERY_MS))
      timers.push(setInterval(flush, FLUSH_EVERY_MS))
      timers.push(setInterval(() => { if (TEST_IGNORE_MARKET_HOURS || inMarketHours(Date.now())) recorder.writeBook(Date.now()) }, BOOK_EVERY_MS))
      timers.push(setInterval(saveDayFiles, CANDLE_FILE_EVERY_MS))
      timers.push(setInterval(() => {
        const seen = builder.symbolsSeen()
        const ago = stats.lastMessageAt ? Math.round((Date.now() - stats.lastMessageAt) / 1000) : '?'
        say(`status: ${stats.messages} messages, ${builder.accepted} prices used, ${seen}/${codes.length} stocks seen, ${savedRows} candle saves, last message ${ago}s ago`)
        if (stats.messages > 200 && builder.accepted === 0 && istMinuteOfDay(Date.now()) >= 9 * 60 + 15) {
          say('! Messages are arriving but none could be read as prices. Send me the file raw_ticks.log and I will fix the reader.')
        }
        if (Date.now() - stats.lastMessageAt > SILENCE_WARN_MS && istMinuteOfDay(Date.now()) >= 9 * 60 + 15) {
          say('! Nothing received from Sharekhan for over a minute.')
        }
        if (istMinuteOfDay(Date.now()) >= STOP_AT_MINUTE) ws.close()
      }, STATUS_EVERY_MS))
    })

    ws.on('message', (data, isBinary) => {
      stats.messages++
      stats.lastMessageAt = Date.now()
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
        rawLog('BINARY', `${buf.length} bytes: ${buf.subarray(0, 300).toString('hex')}`)
        stats.unreadable++
        return
      }
      const text = data.toString()
      rawLog('TEXT', text)
      const ticks = extractTicks(text)
      if (ticks.length === 0) return
      const now = Date.now()
      for (const t of ticks) {
        if (t.exchange && t.exchange !== 'NC') continue
        const symbol = codeToSymbol.get(t.code)
        if (!symbol) continue
        builder.addTick({ symbol, price: t.price, volume: t.volume, cumulativeVolume: t.cumulativeVolume, ts: now })
        if (TEST_IGNORE_MARKET_HOURS || inMarketHours(now)) recorder.onTick(symbol, t, now)
        stats.symbolLastTick.set(symbol, now)
      }
    })

    ws.on('unexpected-response', (_req, res) => {
      say(`! Sharekhan refused the connection (HTTP ${res.statusCode}).` +
        (res.statusCode === 401 || res.statusCode === 403
          ? ' Your Sharekhan login has probably expired: open the app, Settings, Connect Sharekhan, then this program will retry.'
          : ''))
    })

    ws.on('error', (e) => say(`! Connection problem: ${scrub(e.message)}`))

    ws.on('close', (code) => {
      stopTimers()
      say(opened ? `Disconnected (code ${code}).` : 'Could not connect.')
      resolve()
    })

    currentStop = () => { stopTimers(); try { ws.close() } catch { /* ignore */ } }
  })
}

// Ctrl+C: save what we have, then leave. Registered once, works across reconnects.
let currentStop = () => {}
process.once('SIGINT', async () => {
  say('Stopping - saving the last candles...')
  currentStop()
  await flush()
  saveDayFiles()
  process.exit(0)
})

// ---------- main loop ----------
async function main() {
  console.log('\n=== intraday-insight live feed ===')
  if (TEST_IGNORE_MARKET_HOURS) console.log('!!! TEST MODE: market-hours filter is OFF. Never use this on a real day. !!!')
  say('Starting. Press Ctrl+C to stop.')
  let wait = 3_000

  while (true) {
    if (istMinuteOfDay(Date.now()) >= STOP_AT_MINUTE && !TEST_IGNORE_MARKET_HOURS) {
      await flush()
      saveDayFiles()
      say('Market is closed. Final candles saved. Bye!')
      return
    }
    const startedAt = Date.now()
    try {
      await runSession()
    } catch (e) {
      say(`! ${scrub(e.message)}${e.hint ? ` - ${e.hint}` : ''}`)
      if (e.status === 401) {
        say('! The FEED_TOKEN in your .env was rejected. Check that you copied it exactly (STEPS.md, step 2).')
      }
    }
    await flush()
    // A session that lasted a while was healthy: reconnect quickly. Quick failures back off.
    wait = Date.now() - startedAt > 60_000 ? 3_000 : Math.min(wait * 2, 30_000)
    say(`Reconnecting in ${Math.round(wait / 1000)}s...`)
    await sleep(wait)
  }
}

main().then(() => process.exit(0))
