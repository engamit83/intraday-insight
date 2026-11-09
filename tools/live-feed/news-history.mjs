// news-history.mjs - owner 9 Nov 23:36 "add now ... also get data": download NSE company-news HISTORY for the direction study (RECORD ONLY, no trading).
// Usage: node news-history.mjs [fromYYYY-MM-DD] [toYYYY-MM-DD]   default 2022-01-01 .. today. Files: data\history-news\KIND\... Safe to re-run: finished files are skipped.
//   announcements : every corporate announcement (orders, deals, results filed, management news) - weekly files
//   board         : board meetings (results days, dividend, buyback, fund raise) - monthly files
//   results       : financial results filed (quarterly) - monthly files
//   actions       : corporate actions (dividend, split, bonus) - monthly files
//   bulk / block  : big single deals - monthly files
//   secban        : F&O ban list - one small file per trading day
//   bhav          : every stock's day data incl. DELIVERY % - one file per trading day (largest part, ~0.5 MB/day)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const from = process.argv[2] ?? '2022-01-01'
const to = process.argv[3] ?? new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'history-news')
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', Accept: '*/*' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const dmy = (d) => d.split('-').reverse().join('-')            // 2022-01-31 -> 31-01-2022
const add = (d, n) => new Date(Date.parse(d) + n * 86400_000).toISOString().slice(0, 10)
const log = (s) => { console.log(s); fs.mkdirSync(root, { recursive: true }); fs.appendFileSync(path.join(root, 'log.txt'), `[${new Date().toISOString()}] ${s}\n`) }
let cookie = '', calls = 0
async function refresh() {
  try { const r = await fetch('https://www.nseindia.com/', { headers: UA, signal: AbortSignal.timeout(30_000) }); cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ') } catch (e) { log(`cookie refresh failed: ${e.message}`) }
  calls = 0
}
async function api(url) {
  for (let a = 1; a <= 4; a++) {
    if (!cookie || calls >= 40) await refresh()
    calls++
    try {
      const r = await fetch(url, { headers: { ...UA, Cookie: cookie, Referer: 'https://www.nseindia.com/' }, signal: AbortSignal.timeout(60_000) })
      if (r.status === 401 || r.status === 403) { cookie = ''; await sleep(3000 * a); continue }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const t = await r.text(); JSON.parse(t); return t
    } catch (e) { if (a === 4) throw e; await sleep(3000 * a) }
  }
  throw new Error('no access (401/403)')
}
async function file(url) {
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000) })
      if (r.status === 404) return null                       // holiday / weekend: no file
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const t = await r.text(); if (/<html/i.test(t.slice(0, 200))) return null; return t
    } catch (e) { if (a === 3) throw e; await sleep(2000 * a) }
  }
}
function chunks(stepDays) { const out = []; for (let d = from; d <= to; d = add(d, stepDays)) { const e = add(d, stepDays - 1); out.push([d, e > to ? to : e]) } return out }
const N = 'https://www.nseindia.com/api'
const kinds = [
  ['announcements', 7, (a, b) => `${N}/corporate-announcements?index=equities&from_date=${dmy(a)}&to_date=${dmy(b)}`],
  ['board', 30, (a, b) => `${N}/corporate-board-meetings?index=equities&from_date=${dmy(a)}&to_date=${dmy(b)}`],
  ['results', 30, (a, b) => `${N}/corporates-financial-results?index=equities&period=Quarterly&from_date=${dmy(a)}&to_date=${dmy(b)}`],
  ['actions', 30, (a, b) => `${N}/corporates-corporateActions?index=equities&from_date=${dmy(a)}&to_date=${dmy(b)}`],
  ['bulk', 30, (a, b) => `${N}/historical/bulk-deals?from=${dmy(a)}&to=${dmy(b)}`],
  ['block', 30, (a, b) => `${N}/historical/block-deals?from=${dmy(a)}&to=${dmy(b)}`],
]
log(`NSE news history ${from} .. ${to} - start`)
for (const [kind, step, url] of kinds) {
  const dir = path.join(root, kind); fs.mkdirSync(dir, { recursive: true }); let ok = 0, skip = 0, bad = 0
  for (const [a, b] of chunks(step)) {
    const f = path.join(dir, `${a}_${b}.json`); if (fs.existsSync(f) && b < to) { skip++; continue }
    try { fs.writeFileSync(f, await api(url(a, b))); ok++ } catch (e) { bad++; log(`${kind} ${a}..${b} FAILED: ${e.message}`) }
    await sleep(700)
  }
  log(`${kind}: ${ok} saved, ${skip} already there, ${bad} failed`)
}
// daily archive files (no cookie needed)
const ARCH = 'https://nsearchives.nseindia.com'
const daily = [
  ['secban', (k) => `${ARCH}/archives/fo/sec_ban/fo_secban_${k}.csv`],
  ['bhav', (k) => `${ARCH}/products/content/sec_bhavdata_full_${k}.csv`],
]
for (const [kind, url] of daily) {
  const dir = path.join(root, kind); fs.mkdirSync(dir, { recursive: true }); let ok = 0, skip = 0, none = 0, bad = 0
  for (let d = from; d <= to; d = add(d, 1)) {
    if ([0, 6].includes(new Date(d).getUTCDay())) continue
    const f = path.join(dir, `${d}.csv`), fn = path.join(dir, `${d}.none`)
    if (fs.existsSync(f) || fs.existsSync(fn)) { skip++; continue }
    const [Y, M, D] = d.split('-')
    try { const t = await file(url(`${D}${M}${Y}`)); if (t) { fs.writeFileSync(f, t); ok++ } else { fs.writeFileSync(fn, ''); none++ } } catch (e) { bad++; log(`${kind} ${d} FAILED: ${e.message}`) }
    await sleep(300)
  }
  log(`${kind}: ${ok} saved, ${none} holidays/no file, ${skip} already there, ${bad} failed`)
}
log('NSE news history - DONE')
