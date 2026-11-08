// kite-history.mjs - owner 8 Nov: download Zerodha 1-minute history for our stocks + Nifty/sector indices (RECORD ONLY, no orders).
// Needs today's login (kite-login.bat). Newest year first (2026 -> 2015), so the most useful data arrives first.
// Files: data\kite\minute\YEAR\SYMBOL.csv.gz  (time,open,high,low,close,volume). Already-finished files are skipped -> can be stopped and re-run.
// Kite limits: 60 days of 1-minute data per request, 3 requests/second -> we wait 0.4 s between requests. Progress: data\kite\progress.log
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '.env')
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const KEY = process.env.KITE_API_KEY
const tok = JSON.parse(fs.readFileSync(path.join(here, 'data', 'kite-token.json'), 'utf8')).access_token
const H = { 'X-Kite-Version': '3', Authorization: `token ${KEY}:${tok}` }
const root = path.join(here, 'data', 'kite'); fs.mkdirSync(root, { recursive: true })
const logf = path.join(root, 'progress.log')
const say = (m) => { const l = `[${new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 19).replace('T', ' ')}] ${m}`; console.log(l); fs.appendFileSync(logf, l + '\n') }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const FIRST_YEAR = +(process.argv[2] ?? 2015), LAST_YEAR = new Date().getFullYear()

// 1) our symbols = the feed's stock list (sip-baseline turnover keys) + extras file (indices)
const base = JSON.parse(fs.readFileSync(path.join(here, 'data', 'sip-baseline.json'), 'utf8'))
const ours = new Set(Object.keys(base.turnover ?? {}))
const IDX = { 'NIFTY 50': 'NIFTY', 'NIFTY BANK': 'NIFTYBANK', 'NIFTY IT': 'NIFTYIT', 'NIFTY FMCG': 'NIFTYFMCG', 'NIFTY PHARMA': 'NIFTYPHARMA', 'NIFTY AUTO': 'NIFTYAUTO',
  'NIFTY METAL': 'NIFTYMETAL', 'NIFTY ENERGY': 'NIFTYENERGY', 'NIFTY REALTY': 'NIFTYREALTY', 'NIFTY PSU BANK': 'NIFTYPSUBANK', 'NIFTY PVT BANK': 'NIFTYPVTBANK',
  'NIFTY FIN SERVICE': 'NIFTYFINSERV', 'NIFTY INFRA': 'NIFTYINFRA', 'NIFTY MEDIA': 'NIFTYMEDIA', 'NIFTY 500': 'NIFTY500', 'INDIA VIX': 'INDIAVIX',
  'NIFTY MIDCAP 150': 'NIFTYMIDCAP150', 'NIFTY SMLCAP 250': 'NIFTYSMALLCAP250' }

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(60_000) })
      if (r.status === 429) { await sleep(2000 * (i + 1)); continue }
      if (r.status === 403) throw new Error('403 - login expired or no data permission (Connect plan needed). Run kite-login.bat again.')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r
    } catch (e) { if (String(e.message).startsWith('403') || i === tries - 1) throw e; await sleep(1500 * (i + 1)) }
  }
}
const ymd = (d) => d.toISOString().slice(0, 10)

const inst = await (await get('https://api.kite.trade/instruments/NSE')).text()
fs.writeFileSync(path.join(root, 'instruments-NSE.csv'), inst)
const csvSplit = (l) => { const o = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = '' } else cur += ch } o.push(cur); return o }
const head = csvSplit(inst.split('\n')[0].trim()), ix = (n) => head.indexOf(n)
const list = []
for (const l of inst.split('\n').slice(1)) {
  const p = csvSplit(l.trim()); if (p.length < 5) continue
  const ts = p[ix('tradingsymbol')]?.replace(/"/g, ''), seg = p[ix('segment')], itype = p[ix('instrument_type')], token = p[ix('instrument_token')]
  if (seg === 'INDICES' && IDX[ts]) list.push({ sym: IDX[ts], token })
  else if (seg === 'NSE' && itype === 'EQ' && ours.has(ts)) list.push({ sym: ts, token })
}
say(`Zerodha history: ${list.length} instruments (${ours.size} our stocks + indices), years ${LAST_YEAR} -> ${FIRST_YEAR}`)
const missing = [...ours].filter((s) => !list.some((x) => x.sym === s)); if (missing.length) say(`not found on Zerodha (skipped): ${missing.slice(0, 30).join(' ')}${missing.length > 30 ? ' ...' : ''}`)

let req = 0
for (let year = LAST_YEAR; year >= FIRST_YEAR; year--) {
  const dir = path.join(root, 'minute', String(year)); fs.mkdirSync(dir, { recursive: true })
  let done = 0
  for (const { sym, token } of list) {
    const f = path.join(dir, `${sym}.csv.gz`)
    if (fs.existsSync(f)) { done++; continue }
    const rows = []
    let from = new Date(Date.UTC(year, 0, 1)); const end = new Date(Math.min(Date.UTC(year, 11, 31), Date.now()))
    try {
      while (from <= end) {
        const to = new Date(Math.min(from.getTime() + 59 * 86400_000, end.getTime()))
        const url = `https://api.kite.trade/instruments/historical/${token}/minute?from=${ymd(from)}+09:00:00&to=${ymd(to)}+15:35:00`
        const j = await (await get(url)).json(); req++
        for (const c of j.data?.candles ?? []) rows.push(`${c[0].slice(0, 16)},${c[1]},${c[2]},${c[3]},${c[4]},${c[5]}`)
        from = new Date(to.getTime() + 86400_000)
        await sleep(400)
      }
      fs.writeFileSync(f + '.part', zlib.gzipSync('time,open,high,low,close,volume\n' + rows.join('\n'))); fs.renameSync(f + '.part', f); done++
    } catch (e) { say(`${year} ${sym}: FAILED (${e.message})`); if (String(e.message).startsWith('403')) process.exit(1) }
    if (done % 50 === 0) say(`${year}: ${done}/${list.length} done (requests so far ${req})`)
  }
  say(`YEAR ${year} finished: ${done}/${list.length}`)
}
say('ALL DONE')
