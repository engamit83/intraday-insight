// eod-nse.mjs - owner 8 Nov "i want all of them": save NSE's free end-of-day / calendar data next to our tick data (RECORD ONLY, no trading).
// Usage: node eod-nse.mjs [YYYY-MM-DD]   (default: today IST). Files go to data\nse\YYYY-MM-DD\. Run by pull-nse.bat (and after the feed closes).
//   bhavdata  : sec_bhavdata_full - every stock's OHLC, volume, DELIVERY % (how much was really bought to keep)
//   secban    : F&O ban list (stocks where new F&O positions are not allowed)
//   bands     : price band / circuit limit of every stock
//   bulk/block: big single deals of the day
//   results   : board meetings calendar (results days) - next 30 days, from NSE's website API
//   fiidii    : FII / DII buy-sell money of the day
// Each download is independent: one failing does not stop the others; a summary line says what was saved.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// default day: today after 18:00 IST on a weekday, else the previous weekday (NSE posts the files in the evening)
function defaultDay() { const n = new Date(Date.now() + 330 * 60_000); if (n.getUTCHours() < 18) n.setUTCDate(n.getUTCDate() - 1); while ([0, 6].includes(n.getUTCDay())) n.setUTCDate(n.getUTCDate() - 1); return n.toISOString().slice(0, 10) }
const day = process.argv[2] ?? defaultDay()
const [Y, M, D] = day.split('-'); const ddmmyyyy = `${D}${M}${Y}`
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'nse', day)
fs.mkdirSync(dir, { recursive: true })
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', Accept: '*/*' }
const ARCH = 'https://nsearchives.nseindia.com'
const files = [
  ['bhavdata.csv', `${ARCH}/products/content/sec_bhavdata_full_${ddmmyyyy}.csv`],
  ['secban.csv', `${ARCH}/archives/fo/sec_ban/fo_secban_${ddmmyyyy}.csv`],
  ['bands.csv', `${ARCH}/content/equities/sec_list_${ddmmyyyy}.csv`],
  ['bulk.csv', `${ARCH}/content/equities/bulk.csv`],
  ['block.csv', `${ARCH}/content/equities/block.csv`],
]
const out = []
async function get(url, headers = {}) {
  const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(30_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r
}
for (const [name, url] of files) {
  try { const t = await (await get(url)).text(); if (t.length < 20 || /<html/i.test(t.slice(0, 200))) throw new Error('empty/not a file'); fs.writeFileSync(path.join(dir, name), t); out.push(`${name} ok`) }
  catch (e) { out.push(`${name} FAILED (${e.message})`) }
}
// website APIs need the cookies NSE sets on its home page
let cookie = ''
try { const r = await get('https://www.nseindia.com/'); cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ') } catch (e) { out.push(`nse cookies FAILED (${e.message})`) }
const to = new Date(Date.parse(day) + 30 * 86400_000).toISOString().slice(0, 10).split('-').reverse().join('-')
const api = [
  ['results.json', `https://www.nseindia.com/api/event-calendar?index=equities&from_date=${D}-${M}-${Y}&to_date=${to}`],
  ['board-meetings.json', `https://www.nseindia.com/api/corporate-board-meetings?index=equities&from_date=${D}-${M}-${Y}&to_date=${to}`],
  ['fiidii.json', 'https://www.nseindia.com/api/fiidiiTradeReact'],
]
for (const [name, url] of api) {
  try { const t = await (await get(url, { Cookie: cookie, Referer: 'https://www.nseindia.com/' })).text(); JSON.parse(t); fs.writeFileSync(path.join(dir, name), t); out.push(`${name} ok`) }
  catch (e) { out.push(`${name} FAILED (${e.message})`) }
}
const line = `[${new Date().toISOString()}] NSE end-of-day ${day}: ${out.join(' | ')}`
console.log(line)
fs.appendFileSync(path.join(dir, '..', 'nse-log.txt'), line + '\n')
