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
import { TickExitEngine, TICK_RULES } from './tick-exits.mjs'
import { SipEngine } from './sip-engine.mjs'
import { dailyReport } from './daily-report.mjs'
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
const STATUS_EVERY_MS = Number(process.env.STATUS_EVERY_MS || 30_000)
const PING_EVERY_MS = 30_000
const SILENCE_WARN_MS = 60_000
const NO_PRICE_RECONNECT_MS = Number(process.env.NO_PRICE_RECONNECT_MS || 120_000) // 21 Oct watchdog: connected but no prices for 2 min in market hours -> reconnect
const RAW_LOG_LIMIT = 400
const STOP_AT_MINUTE = 15 * 60 + 35 // 15:35 IST

// ---------- small helpers ----------
const builder = new CandleBuilder({ ignoreMarketHours: TEST_IGNORE_MARKET_HOURS })
// our own day files (data folder): every 1-minute candle + a once-a-minute order-book snapshot
const recorder = new DayRecorder(process.env.RECORD_DIR || path.join(here, 'data'))
const BOOK_EVERY_MS = 60_000
const CANDLE_FILE_EVERY_MS = 5 * 60_000
// Extra stocks/indices to RECORD ONLY (file record-extra.csv: "SYMBOL,scripcode" per line). Their candles go to the
// data folder only, never to the database, so signals and paper trades are unaffected. If subscribing to them
// makes the trading stocks stop arriving, the feed drops the extras for the rest of the session (safety switch).
const EXTRA_FILE = path.join(here, 'record-extra.csv')
const EXTRA_CHECK_MS = Number(process.env.EXTRA_CHECK_MS || 90_000)
function loadExtras() {
  const out = new Map()
  try {
    if (!fs.existsSync(EXTRA_FILE)) return out
    for (const line of fs.readFileSync(EXTRA_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.trim().match(/^([^,#\s][^,]*),\s*(\d{1,9})\s*$/)
      if (m) out.set(Number(m[2]), m[1].trim())
    }
  } catch { /* a bad file must never stop the feed */ }
  return out
}
function saveDayFiles() {
  recorder.flushTicks(Date.now())
  const n = recorder.writeCandles(builder, Date.now())
  if (n) say(`saved ${n} one-minute candles to the data folder`)
}
const rawLogFile = path.join(here, 'raw_ticks.log')
let rawLogged = 0
let accessTokenInUse = ''

const istClock = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(11, 19)
// 21 Oct: every message also goes to logs\feed-YYYY-MM-DD.log so problems can be read remotely (no tokens: scrub()).
const logDir = path.join(here, 'logs')
function say(msg) {
  const line = `[${istClock()}] ${msg}`
  console.log(line)
  try {
    fs.mkdirSync(logDir, { recursive: true })
    const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
    fs.appendFileSync(path.join(logDir, `feed-${day}.log`), scrub(line) + '\n')
  } catch { /* logging must never stop the feed */ }
}
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
let uploadSymbols = null // only these go to the database (the app's stock list); extras are recorded locally only
let saveFailures = 0
let savedRows = 0
let lastSaveErrorAt = 0

async function flush() {
  const collected = builder.collectDirty()
  const pending = collected.pending
  const rows = uploadSymbols ? collected.rows.filter((r) => uploadSymbols.has(r.symbol)) : collected.rows
  if (rows.length === 0) { builder.commit(pending); return }
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
// ---- T2 tick-level exits (owner 21 Oct): exit rules on every tick, closes reported to the app, ntfy straight from here ----
const tickExits = new TickExitEngine(TEST_IGNORE_MARKET_HOURS ? { ...TICK_RULES, squareOff: '99:99' } : TICK_RULES)
let ntfyTopic = null
let tradesFetchedAt = 0
const pendingMoves = new Map() // trade id -> latest stop move
const TICK_EXITS = process.env.TICK_EXITS !== '0' // switch off with TICK_EXITS=0 in .env if ever needed
async function refreshOpenTrades() {
  if (!TICK_EXITS) return
  try {
    const r = await gateway('open_trades')
    tickExits.setTrades(r.trades ?? [])
    ntfyTopic = r.ntfyTopic ?? null
    tradesFetchedAt = Date.now()
  } catch (e) { say(`! could not load open paper trades for tick exits: ${scrub(e.message)}`) }
}
async function ntfy(text) {
  if (!ntfyTopic) return
  try { await fetch(`https://ntfy.sh/${encodeURIComponent(ntfyTopic)}`, { method: 'POST', body: text, headers: { Title: 'TRD App' }, signal: AbortSignal.timeout(8000) }) } catch { /* alerts must never stop the feed */ }
}
const REASON_TXT = { stop: 'stop loss', breakeven: 'at buy price', lockedstop: 'raised stop', target: 'TARGET hit', squareoff: '15:15 close' }
async function onTickExit(ev) {
  const clock = new Date(ev.ts + 330 * 60_000).toISOString().slice(11, 19)
  let pnl = null
  try {
    const r = await gateway('tick_close', { id: ev.id, reason: ev.reason, price: ev.price, ts: ev.ts })
    if (r.alreadyClosed) return // the app closed it first
    pnl = r.pnlRs
  } catch (e) { say(`! tick close not saved (the app's 1-minute check will close it): ${scrub(e.message)}`) }
  const icon = pnl === null ? (ev.netPct >= 0 ? '✅' : '🔻') : pnl >= 0 ? '✅' : '🔻'
  say(`tick exit ${ev.symbol} ${ev.direction} ${ev.reason} at ${ev.price} (${clock})${pnl !== null ? ` net Rs ${pnl}` : ''}`)
  await ntfy(`${icon} Paper ${ev.direction} ${ev.symbol} closed: ${REASON_TXT[ev.reason] ?? ev.reason} at ₹${ev.price} (${clock})${pnl !== null ? `, net ₹${pnl}` : ''} (paper money)`)
}
// ---- STOCKS IN PLAY paper strategy (owner "do it from tomorrow" 22 Oct; sip-engine.mjs). Laptop only, paper only. SIP=0 in .env switches it off.
// Any error inside it is caught and logged - it can never stop the price feed.
const SIP_ON = process.env.SIP !== '0' && (!TEST_IGNORE_MARKET_HOURS || process.env.SIP_TEST === '1') // off in feed tests (they run at any clock time)
let sip = null
try { if (SIP_ON) sip = new SipEngine({ dataDir: path.join(here, 'data') }) } catch (e) { say(`! stocks-in-play engine could not start: ${e.message}`) }
const sipClock = (ts) => new Date(ts + 330 * 60_000).toISOString().slice(11, 19)
async function onSipEvent(ev) {
  try {
    let text = null
    if (ev.kind === 'picks') {
      text = ev.picks.length
        ? `🟢 STOCKS IN PLAY ${sipClock(ev.ts)} - watching ${ev.picks.length}: ` + ev.picks.map((p) => `${p.sym} ${p.dir} ${p.dir === 'BUY' ? 'above' : 'below'} ₹${p.dir === 'BUY' ? p.high : p.low}`).join(', ') + ' (paper, entry until 10:15)'
        : '🟢 STOCKS IN PLAY: no stock qualified today (no paper trades)'
    } else if (ev.kind === 'entry') {
      const t = ev.trade
      text = `🟢 NEW ${t.dir} ${t.sym} at ₹${t.entry} (${sipClock(ev.ts)}), stop ₹${t.stop} (${t.riskPct}%), qty ${t.qty}, risk ₹1,000 - stocks in play (paper money)`
    } else if (ev.kind === 'exit') {
      const t = ev.trade, why = { stop: 'stop loss', trail: 'trailing stop (profit kept)', squareoff: '15:15 close' }[t.reason] ?? t.reason
      text = `${t.netRs >= 0 ? '✅' : '🔻'} NEW ${t.dir} ${t.sym} closed: ${why} at ₹${t.exit} (${sipClock(ev.ts)}), net ₹${t.netRs} (${t.R}R) - stocks in play (paper money)`
    } else if (ev.kind === 'warn') {
      const t = ev.trade, w = ev.w, SIGN = { flow: 'aggressive counter-trades', book: 'order book turned against us', volume: 'counter-move on rising volume', vwap: 'through VWAP', lows: 'structure turning', market: 'Nifty turning against us' }
      text = ev.tightened
        ? `⚠️ SMART EXIT: NEW ${t.dir} ${t.sym} at ₹${w.price} - ${w.signs.map((k) => SIGN[k]).join(', ')}. Stop TIGHTENED to ₹${t.stop} (${w.best >= 1 ? `0.3R behind best +${w.best}R` : `0.3R from price, now ${w.R}R - check entry`}) - stocks in play (paper)`
        : `⚠️ SMART WARNING (alert only, trade kept): NEW ${t.dir} ${t.sym} at ₹${w.price}, now ${w.R >= 0 ? '+' : ''}${w.R}R - ${w.signs.map((k) => SIGN[k]).join(', ')}`
    } else if (ev.kind === 'untight') {
      const t = ev.trade
      text = `🟢 TREND BACK in our favour: NEW ${t.dir} ${t.sym} - trailing 1R again, stop stays at ₹${t.stop} (stocks in play, paper)`
    } else if (ev.kind === 'note') text = `🟢 ${ev.text}`
    if (!text) return
    say(`SIP ${text}`)
    if (!ntfyTopic) await refreshOpenTrades()
    await ntfy(text)
  } catch (e) { say(`! stocks-in-play alert failed: ${e.message}`) }
}
function sipTick(symbol, t, now) {
  if (!sip) return
  try { for (const ev of sip.onTick(symbol, { price: t.price, bid: t.bid, ask: t.ask, cum: t.cumulativeVolume, totBuy: t.totBuy, totSell: t.totSell }, now)) onSipEvent(ev) }
  catch (e) { say(`! stocks-in-play error (feed continues): ${e.message}`); sip = null }
}
function sipTimer() {
  if (!sip) return
  try { for (const ev of sip.onTimer(Date.now())) onSipEvent(ev) } catch (e) { say(`! stocks-in-play timer error (feed continues): ${e.message}`); sip = null }
}
async function flushMoves() {
  if (!pendingMoves.size) return
  const moves = [...pendingMoves.values()]; pendingMoves.clear()
  try { await gateway('tick_stop', { moves }) } catch { /* the next move is sent again */ }
}

const stats = { messages: 0, unreadable: 0, lastMessageAt: 0, lastPriceAt: 0, sessionStartAt: 0, symbolLastTick: new Map() }

async function runSession() {
  say('Getting today\'s Sharekhan login from your database...')
  const info = await gateway('token')
  accessTokenInUse = info.accessToken
  const codeToSymbol = new Map()
  for (const [symbol, code] of Object.entries(info.symbols || {})) codeToSymbol.set(Number(code), symbol)
  const codes = [...codeToSymbol.keys()]
  if (codes.length === 0) throw new Error('No stocks to watch (scripcodes table empty?)')
  say(`Watching ${codes.length} stocks.${info.unresolved?.length ? ` Not found in scripcodes: ${info.unresolved.join(', ')}` : ''}`)
  uploadSymbols = new Set(codeToSymbol.values())
  const extraCodes = []
  for (const [code, sym] of loadExtras()) if (!codeToSymbol.has(code)) { codeToSymbol.set(code, sym); extraCodes.push(code) }
  if (extraCodes.length) say(`Also recording ${extraCodes.length} extra stocks/indices to the data folder (record-extra.csv).`)
  let extrasSentAt = 0

  const url = `${WS_BASE}?ACCESS_TOKEN=${encodeURIComponent(info.accessToken)}`
  const ws = new WebSocket(url)

  await new Promise((resolve) => {
    let timers = []
    let opened = false

    const stopTimers = () => { timers.forEach(clearInterval); timers = [] }

    ws.on('open', () => {
      stats.sessionStartAt = Date.now()
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
      if (extraCodes.length) {
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) return
          ws.send(JSON.stringify({ action: 'feed', key: ['ltp'], value: [extraCodes.map((c) => `NC${c}`).join(',')] }))
          extrasSentAt = Date.now()
          say(`Asked for prices of the ${extraCodes.length} extras.`)
          // safety switch: if the trading stocks stop arriving after asking for the extras, ask for the trading stocks
          // again and leave the extras out for this session
          setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) return
            const fresh = [...uploadSymbols].filter((sym) => (stats.symbolLastTick.get(sym) ?? 0) > extrasSentAt).length
            const extrasArriving = extraCodes.some((c) => (stats.symbolLastTick.get(codeToSymbol.get(c)) ?? 0) > extrasSentAt)
            if (extrasArriving && fresh < uploadSymbols.size * 0.5) {
              say(`! After adding the extras only ${fresh}/${uploadSymbols.size} trading stocks are arriving. Dropping the extras for today.`)
              for (const c of extraCodes) codeToSymbol.delete(c)
              ws.send(JSON.stringify({ action: 'feed', key: ['ltp'], value: [codes.map((c) => `NC${c}`).join(',')] }))
            }
          }, EXTRA_CHECK_MS)
        }, 2_000)
      }

      timers.push(setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.ping('ping') }, PING_EVERY_MS))
      timers.push(setInterval(flush, FLUSH_EVERY_MS))
      timers.push(setInterval(() => { if (TEST_IGNORE_MARKET_HOURS || inMarketHours(Date.now())) recorder.writeBook(Date.now()) }, BOOK_EVERY_MS))
      timers.push(setInterval(saveDayFiles, CANDLE_FILE_EVERY_MS))
      timers.push(setInterval(() => recorder.flushTicks(Date.now()), 2_000))
      refreshOpenTrades()
      timers.push(setInterval(refreshOpenTrades, Number(process.env.OPEN_TRADES_EVERY_MS || 60_000))) // T2: new paper trades reach the tick engine within a minute
      timers.push(setInterval(sipTimer, 1_000)) // stocks in play: 09:20 selection + 15:15 close even without ticks
      timers.push(setInterval(flushMoves, 5_000)) // T2: raised stops reported to the app every 5 s // 21 Oct: every tick to data\\ticks-DATE.csv
      timers.push(setInterval(() => {
        const seen = builder.symbolsSeen()
        const ago = stats.lastMessageAt ? Math.round((Date.now() - stats.lastMessageAt) / 1000) : '?'
        say(`status: ${stats.messages} messages, ${builder.accepted} prices used, ${seen}/${codes.length} stocks seen, ${savedRows} candle saves, last message ${ago}s ago`)
        if (stats.messages > 200 && builder.accepted === 0 && istMinuteOfDay(Date.now()) >= 9 * 60 + 16) { // 23 Oct: from 09:16 (at 09:15:00 trading has not started yet)
          say('! Messages are arriving but none could be read as prices. Send me the file raw_ticks.log and I will fix the reader.')
        }
        if (Date.now() - stats.lastMessageAt > SILENCE_WARN_MS && istMinuteOfDay(Date.now()) >= 9 * 60 + 15) {
          say('! Nothing received from Sharekhan for over a minute.')
        }
        // watchdog (21 Oct): on 20 Oct the connection stayed open (heartbeats only) but sent no prices all day
        const m = istMinuteOfDay(Date.now())
        const since = Date.now() - Math.max(stats.lastPriceAt, stats.sessionStartAt)
        if ((TEST_IGNORE_MARKET_HOURS || (m >= 9 * 60 + 16 && m < 15 * 60 + 30)) && since > NO_PRICE_RECONNECT_MS) {
          say(`! No prices for ${Math.round(since / 1000)}s while the market is open - reconnecting.`)
          try { ws.close() } catch { /* ignore */ }
          return
        }
        if (istMinuteOfDay(Date.now()) >= STOP_AT_MINUTE && !TEST_IGNORE_MARKET_HOURS) ws.close()
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
        if (TEST_IGNORE_MARKET_HOURS || inMarketHours(now)) sipTick(symbol, t, now)
        stats.lastPriceAt = now
        if (TICK_EXITS && tickExits.trades.size && (TEST_IGNORE_MARKET_HOURS || inMarketHours(now))) {
          for (const ev of tickExits.onTick(symbol, { price: t.price, bid: t.bid, ask: t.ask }, now)) {
            if (ev.kind === 'close') onTickExit(ev)
            else if (ev.kind === 'stopMoved') {
              const tr = tickExits.trades.get(ev.id)
              pendingMoves.set(ev.id, { id: ev.id, stop: ev.to, atBreakeven: !!tr?.atBreakeven, locked: !!tr?.locked, bestExc: tr?.bestExc })
            }
          }
        }
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
  // 23 Oct: start the smart exit warning (alert only, smart-watch.mjs) in its own window every market day, so it runs without a click.
  // Its own window title (INTRADAY-SMARTWARN) - the 15:40 stop task closes only the feed window; smart-watch stops itself at 15:31.
  try {
    const nowIst = new Date(Date.now() + 330 * 60_000), wd = nowIst.getUTCDay(), hm = nowIst.toISOString().slice(11, 16)
    if (!TEST_IGNORE_MARKET_HOURS && process.env.SMART_WARN === '1' && wd >= 1 && wd <= 5 && hm < '15:30') { // 25 Oct: off by default - the warning now runs INSIDE the stocks-in-play engine (exit rule)
      const { spawn } = await import('node:child_process')
      const child = process.platform === 'win32'
        ? spawn('cmd.exe', ['/c', 'start', '"INTRADAY-SMARTWARN"', '/min', 'cmd', '/c', 'node', 'smart-watch.mjs'], { cwd: here, detached: true, stdio: 'ignore', windowsVerbatimArguments: true })
        : spawn(process.execPath, ['smart-watch.mjs'], { cwd: here, detached: true, stdio: 'ignore' })
      child.unref()
      say('smart exit warning started in its own window (INTRADAY-SMARTWARN)')
    }
  } catch (e) { say(`! smart exit warning could not start: ${e.message}`) }
  let wait = 3_000

  while (true) {
    if (istMinuteOfDay(Date.now()) >= STOP_AT_MINUTE && !TEST_IGNORE_MARKET_HOURS) {
      await flush()
      saveDayFiles()
      // nightly research summary (21 Oct): computed from today's recording, saved in logs\report-DATE.txt and sent on ntfy
      try {
        const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
        const done = path.join(here, 'logs', `report-${day}.txt`)
        if (!fs.existsSync(done)) {
          const text = dailyReport(path.join(here, 'data'), day)
          if (text) { say(text); if (!ntfyTopic) await refreshOpenTrades(); await ntfy(text) }
        }
      } catch (e) { say(`! daily report failed: ${e.message}`) }
      // stocks in play: day summary on ntfy + add today's opening volume / turnover to the baseline (once a day)
      try {
        if (sip) {
          for (const ev of sip.onTimer(Date.now())) await onSipEvent(ev)
          const sm = sip.summary()
          if (sip.updateBaseline()) {
            const txt = `🟢 STOCKS IN PLAY day: ${sm.n} paper trades, ${sm.wins} winners, net ₹${sm.net}${sm.status.startsWith('skipped') ? ` (${sm.status})` : ''}`
            say(txt); if (!ntfyTopic) await refreshOpenTrades(); await ntfy(txt)
          }
        }
      } catch (e) { say(`! stocks-in-play day summary failed: ${e.message}`) }
      // weekly history pull (Fridays after the market, or PULL_HISTORY=1): runs as its OWN program in its own window
      // (22 Oct fix) so the laptop's 15:40 stop task, which closes the feed window, cannot cut it off
      try {
        const nowIst = new Date(Date.now() + 330 * 60_000)
        if ((nowIst.getUTCDay() === 5 || process.env.PULL_HISTORY === '1') && !TEST_IGNORE_MARKET_HOURS) {
          const { spawn } = await import('node:child_process')
          const child = process.platform === 'win32'
            ? spawn('cmd.exe', ['/c', 'start', '"INTRADAY-HISTORY"', '/min', 'node', 'pull-run.mjs'], { cwd: here, detached: true, stdio: 'ignore', windowsVerbatimArguments: true })
            : spawn(process.execPath, ['pull-run.mjs'], { cwd: here, detached: true, stdio: 'ignore' })
          child.unref()
          say('history pull started in its own window (INTRADAY-HISTORY)')
        }
      } catch (e) { say(`! history pull could not start: ${scrub(e.message)}`) }
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
