// smart-watch.mjs - runs the SMART EXIT WARNING live next to the feed (own window "INTRADAY-SMARTWARN"; the feed is not touched).
// Follows data\ticks-DATE.csv + data\book-DATE.csv (written by the feed) and the open stocks-in-play trades in data\sip-state-DATE.json.
// ALERT ONLY: sends "⚠️ SMART WARNING" on ntfy, never closes a trade. Logs to logs\smart-warn-DATE.log and data\smart-warn-DATE.csv.
// Stops by itself at 15:31. Start: start-smart-warn.bat (or node smart-watch.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SmartWarn, SIGN_TXT } from './smart-warn.mjs'
const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '.env')
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const ist = () => new Date(Date.now() + 330 * 60_000)
const day = process.env.SMART_DAY || ist().toISOString().slice(0, 10)
const dataDir = path.join(here, 'data'), logDir = path.join(here, 'logs')
fs.mkdirSync(logDir, { recursive: true })
const scrub = (t) => (process.env.FEED_TOKEN || '').length > 8 ? String(t).split(process.env.FEED_TOKEN).join('***') : String(t)
function say(msg) { const line = `[${ist().toISOString().slice(11, 19)}] ${scrub(msg)}`; console.log(line); try { fs.appendFileSync(path.join(logDir, `smart-warn-${day}.log`), line + '\n') } catch {} }
let topic = null
async function getTopic() {
  try {
    const r = await fetch(process.env.GATEWAY_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-job-token': process.env.FEED_TOKEN }, body: JSON.stringify({ action: 'open_trades' }), signal: AbortSignal.timeout(20_000) })
    topic = (await r.json()).ntfyTopic ?? null
  } catch (e) { say(`! could not get the alert channel: ${e.message}`) }
}
async function ntfy(text) { if (!topic) await getTopic(); if (!topic) return; try { await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: 'POST', body: text, headers: { Title: 'TRD App' }, signal: AbortSignal.timeout(8000) }) } catch {} }

const sw = new SmartWarn()
let trades = []
function loadTrades() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(dataDir, `sip-state-${day}.json`), 'utf8'))
    const clock = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 16)
    trades = (s.trades ?? []).filter((t) => !t.exit).map((t) => {
      const old = trades.find((x) => x.sym === t.sym)
      return { sym: t.sym, dir: t.dir, entry: t.entry, risk: t.risk, qty: t.qty, inMin: clock(t.inTs), bookAtEntry: old?.bookAtEntry ?? null }
    })
  } catch { /* no trades yet */ }
}
// follow a growing CSV file; calls fn(fields) for every complete new line
function follower(file, fn) {
  let pos = 0, rest = '', header = true
  return () => {
    let fd; try { fd = fs.openSync(file, 'r') } catch { return }
    try {
      const size = fs.fstatSync(fd).size; if (size <= pos) return
      const buf = Buffer.alloc(size - pos); fs.readSync(fd, buf, 0, buf.length, pos); pos = size
      const lines = (rest + buf.toString('utf8')).split('\n'); rest = lines.pop()
      for (const l of lines) { if (header) { header = false; continue } if (l) fn(l.split(',')) }
    } finally { fs.closeSync(fd) }
  }
}
const nowMin = () => ist().toISOString().slice(11, 16)
const csvFile = path.join(dataDir, `smart-warn-${day}.csv`)
const bookNow = new Map()
const followBook = follower(path.join(dataDir, `book-${day}.csv`), (p) => {
  const tb = +p[8], ts = +p[9]; if (!(tb > 0 && ts > 0)) return
  sw.onBook(p[1], tb, ts); bookNow.set(p[1], tb / ts)
})
const followTicks = follower(path.join(dataDir, `ticks-${day}.csv`), (p) => {
  const sym = p[1], m = p[0].slice(0, 5)
  if (sym !== 'NIFTY' && !trades.some((t) => t.sym === sym)) return
  const closed = sw.onTick(sym, m, +p[2], p[3] === '' ? NaN : +p[3])
  if (!closed || sym === 'NIFTY') return
  for (const t of trades) {
    if (t.sym !== sym || m <= t.inMin) continue
    if (t.bookAtEntry == null) t.bookAtEntry = bookNow.get(sym) ?? null
    const w = sw.evaluate(t, m); if (!w) continue
    const toMin = (x) => +x.slice(0, 2) * 60 + +x.slice(3, 5)
    const live = toMin(nowMin()) - toMin(w.minute) <= 3 // catching up from the file start: only alert on the last few minutes
    const txt = `⚠️ SMART WARNING (alert only, trade NOT closed): NEW ${t.dir} ${t.sym} at ₹${w.price} (${w.minute}) - ${w.mode}: ${w.signs.map((k) => SIGN_TXT[k]).join(', ')}. Now ${w.R >= 0 ? '+' : ''}${w.R}R (best +${w.best}R)`
    say(txt)
    try { fs.appendFileSync(csvFile, (fs.existsSync(csvFile) ? '' : 'day,minute,symbol,dir,price,R,best,mode,score,signs\n') + [day, w.minute, t.sym, t.dir, w.price, w.R, w.best, w.mode, w.score, w.signs.join('+')].join(',') + '\n') } catch {}
    if (live || process.env.SMART_ALERT_PAST === '1') ntfy(txt)
  }
})
say(`smart exit warning started for ${day} (alert only)`)
await getTopic()
loadTrades()
setInterval(loadTrades, 10_000)
setInterval(() => { try { followBook(); followTicks() } catch (e) { say(`! ${e.message}`) } }, 3_000)
setInterval(() => { if (ist().toISOString().slice(11, 16) >= '15:31' && !process.env.SMART_DAY) { say('market closed - smart warning stops'); process.exit(0) } }, 30_000)
