// news-live.mjs - owner 23 Nov 14:27 "News is always yes, do it without any delay, live news". RECORD ONLY - no trading decision uses it yet.
// Every 60 s: NSE corporate announcements of TODAY (all equities). Every 10 min: today's block + bulk deals.
// Every 3 min: market-wide news (RBI, SEBI, PIB, ET + Moneycontrol market/economy headlines) - added 24 Nov.
// Each NEW item -> data\news-live-DAY.csv (time seen, symbol, kind, NSE time, subject) + data\news-live-DAY.jsonl (full raw item, all fields)
// + one line in logs\news-live-DAY.log. Items for stocks in today's paper picks/trades are marked OURS (from data\sip-state-DAY.json).
// Runs until 15:40 IST, then stops. Separate process: it never touches the price feed. Usage: node news-live.mjs   (or news-live.bat)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const ist = () => new Date(Date.now() + 330 * 60_000)
const DAY = process.env.NEWS_DAY ?? ist().toISOString().slice(0, 10)
const hm = () => ist().toISOString().slice(11, 19)
const dmy = (d) => d.split('-').reverse().join('-')
const dataDir = path.join(here, 'data'), logDir = path.join(here, 'logs')
fs.mkdirSync(dataDir, { recursive: true }); fs.mkdirSync(logDir, { recursive: true })
const csvF = path.join(dataDir, `news-live-${DAY}.csv`), rawF = path.join(dataDir, `news-live-${DAY}.jsonl`), logF = path.join(logDir, `news-live-${DAY}.log`)
const say = (s) => { const l = `[${hm()}] ${s}`; console.log(l); fs.appendFileSync(logF, l + '\n') }
if (!fs.existsSync(csvF)) fs.writeFileSync(csvF, 'seen,symbol,kind,nse_time,ours,subject\n')
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', Accept: '*/*' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fetchFn = globalThis.__newsFetch ?? fetch                  // tests inject a fake
let cookie = '', calls = 0
async function refresh() {
  try { const r = await fetchFn('https://www.nseindia.com/', { headers: UA, signal: AbortSignal.timeout(30_000) }); cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ') } catch (e) { say(`! cookie refresh failed: ${e.message}`) }
  calls = 0
}
async function api(url) {
  for (let a = 1; a <= 3; a++) {
    if (!cookie || calls >= 40) await refresh()
    calls++
    try {
      const r = await fetchFn(url, { headers: { ...UA, Cookie: cookie, Referer: 'https://www.nseindia.com/' }, signal: AbortSignal.timeout(30_000) })
      if (r.status === 401 || r.status === 403) { cookie = ''; await sleep(2000 * a); continue }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return JSON.parse(await r.text())
    } catch (e) { if (a === 3) throw e; await sleep(2000 * a) }
  }
  throw new Error('no access (401/403)')
}
const N = 'https://www.nseindia.com/api'
const seen = new Set()
// resume after a restart: everything already written today counts as seen
if (fs.existsSync(rawF)) for (const l of fs.readFileSync(rawF, 'utf8').split('\n')) { try { const o = JSON.parse(l); if (o.key) seen.add(o.key) } catch {} }
function ourSymbols() {
  try { const s = JSON.parse(fs.readFileSync(path.join(dataDir, `sip-state-${DAY}.json`), 'utf8')); return new Set([...(s.picks ?? []), ...(s.trades ?? []), ...(s.closed ?? [])].map((x) => x.sym)) } catch { return new Set() }
}
const clean = (t) => String(t ?? '').replace(/[\r\n,]+/g, ' ').trim().slice(0, 300)
function record(kind, sym, nseTime, subject, raw, key) {
  if (seen.has(key)) return false
  seen.add(key)
  const ours = ourSymbols().has(sym) ? 'OURS' : ''
  fs.appendFileSync(csvF, `${hm()},${sym},${kind},${clean(nseTime)},${ours},${clean(subject)}\n`)
  fs.appendFileSync(rawF, JSON.stringify({ key, kind, seen: `${DAY} ${hm()}`, item: raw }) + '\n')
  say(`${ours ? '!! OUR STOCK ' : ''}${kind} ${sym}: ${clean(subject).slice(0, 140)}`)
  return true
}
const asList = (j) => (Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [])
async function pollAnnouncements() {
  const j = await api(`${N}/corporate-announcements?index=equities&from_date=${dmy(DAY)}&to_date=${dmy(DAY)}`)
  let n = 0
  for (const a of asList(j)) {
    const key = `ann|${a.seq_id ?? ''}|${a.symbol}|${a.an_dt ?? a.sort_date ?? ''}|${a.desc ?? ''}`
    if (record('announcement', a.symbol, a.an_dt ?? a.sort_date, `${a.desc ?? ''} - ${a.attchmntText ?? ''}`, a, key)) n++
  }
  return n
}
async function pollDeals(kind) {
  const j = await api(`${N}/historical/${kind}-deals?from=${dmy(DAY)}&to=${dmy(DAY)}`)
  let n = 0
  for (const d of asList(j)) {
    const sym = d.BD_SYMBOL ?? d.symbol ?? d.SYMBOL ?? '?'
    const key = `${kind}|${sym}|${d.BD_CLIENT_NAME ?? d.clientName ?? ''}|${d.BD_BUY_SELL ?? d.buySell ?? ''}|${d.BD_QTY_TRD ?? d.qty ?? ''}|${d.BD_TP_WATP ?? d.watp ?? ''}`
    const subj = `${d.BD_BUY_SELL ?? d.buySell ?? ''} ${d.BD_QTY_TRD ?? d.qty ?? ''} @ ${d.BD_TP_WATP ?? d.watp ?? ''} by ${d.BD_CLIENT_NAME ?? d.clientName ?? ''}`
    if (record(`${kind} deal`, sym, d.BD_DT_DATE ?? d.date ?? DAY, subj, d, key)) n++
  }
  return n
}
// MARKET-WIDE NEWS (owner 23 Nov 14:32: government policy, global markets, RBI): RSS feeds polled every 3 min, record only.
// Item -> kind 'market news', symbol = source name. Items older than 2 days are ignored (first poll of the day would replay old ones).
export const RSS = [
  ['RBI', 'https://www.rbi.org.in/pressreleases_rss.xml'],
  ['SEBI', 'https://www.sebi.gov.in/sebirss.xml'],
  ['PIB-FINANCE', 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3'],
  ['ET-MARKETS', 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms'],
  ['ET-ECONOMY', 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms'],
  ['MC-MARKETS', 'https://www.moneycontrol.com/rss/marketreports.xml'],
  ['MC-BUSINESS', 'https://www.moneycontrol.com/rss/business.xml'],
]
const unx = (t) => String(t ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim()
export function parseRss(xml) {
  const items = []
  for (const m of String(xml).matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)) {
    const b = m[0], tag = (n) => { const x = b.match(new RegExp(`<${n}\\b[^>]*>([\\s\\S]*?)<\\/${n}>`)); return x ? unx(x[1]) : '' }
    const link = tag('link') || (b.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? '')
    items.push({ title: tag('title'), link, date: tag('pubDate') || tag('updated') || tag('dc:date') || tag('published'), desc: tag('description').slice(0, 500) })
  }
  return items
}
async function pollRss(src, url) {
  const r = await fetchFn(url, { headers: UA, signal: AbortSignal.timeout(30_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  let n = 0
  for (const it of parseRss(await r.text())) {
    if (!it.title) continue
    const d = Date.parse(it.date); if (d > 0 && Date.now() - d > 2 * 86_400_000) continue
    if (record('market news', src, it.date, it.title, { src, ...it }, `rss|${src}|${it.link || it.title}`)) n++
  }
  return n
}
export async function runRss() {
  const out = {}
  for (const [src, url] of RSS) { try { out[src] = await pollRss(src, url) } catch (e) { out[src] = -1; if (!rssWarned.has(src)) { rssWarned.add(src); say(`! ${src} news feed failed: ${e.message} (will keep trying)`) } } }
  return out
}
const rssWarned = new Set()
export async function runOnce(withDeals) {
  const out = {}
  try { out.ann = await pollAnnouncements() } catch (e) { say(`! announcements failed: ${e.message}`) }
  if (withDeals) for (const k of ['block', 'bulk']) { try { out[k] = await pollDeals(k) } catch (e) { say(`! ${k} deals failed: ${e.message}`) } }
  return out
}
function holidayToday() {
  const wd = ist().getUTCDay(); if (wd === 0 || wd === 6) return true
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'nse-holidays.json'), 'utf8')).includes(DAY) } catch { return false }
}
if (!globalThis.__newsTest && holidayToday() && !process.env.NEWS_FORCE) { say(`market holiday/weekend ${DAY} - news recorder not needed today.`); process.exit(0) }
if (!globalThis.__newsTest) {
  say(`News recorder started for ${DAY} (record only). Announcements every 60 s, block/bulk deals every 10 min, market news (RBI/SEBI/PIB/ET/Moneycontrol) every 3 min, until 15:40.`)
  let i = 0, lastBeat = 0
  while (true) {
    const t = ist().toISOString().slice(11, 16)
    if (t >= '15:40') { say('15:40 - news recorder stopped for today.'); break }
    const r = await runOnce(i % 10 === 0)
    if (i % 3 === 0) await runRss()
    if (Date.now() - lastBeat > 30 * 60_000) { say(`status: ${seen.size} items recorded today`); lastBeat = Date.now() }
    i++; await sleep(60_000)
  }
}
