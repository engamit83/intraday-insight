// bhav-history.mjs - owner 10 Nov 00:23 "before all this fix replay": NSE official daily file per trading day (every stock's official CLOSE, traded value,
// delivery %) - needed for a replay with the SAME inputs as live (official previous close + liquidity), no look-ahead. RECORD ONLY.
// Usage: node bhav-history.mjs [fromYYYY-MM-DD] [toYYYY-MM-DD]  default 2022-01-01..today. Files: data\history-news\bhav\DAY.csv. Safe to re-run.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const from = process.argv[2] ?? '2022-01-01'
const to = process.argv[3] ?? new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'history-news', 'bhav'); fs.mkdirSync(dir, { recursive: true })
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', Accept: '*/*' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const add = (d, n) => new Date(Date.parse(d) + n * 86400_000).toISOString().slice(0, 10)
let ok = 0, none = 0, skip = 0, bad = 0
for (let d = from; d <= to; d = add(d, 1)) {
  if ([0, 6].includes(new Date(d).getUTCDay())) continue
  const f = path.join(dir, `${d}.csv`), fn = path.join(dir, `${d}.none`)
  if (fs.existsSync(f) || fs.existsSync(fn)) { skip++; continue }
  const [Y, M, D] = d.split('-'); let done = false
  for (let a = 1; a <= 3 && !done; a++) {
    try {
      const r = await fetch(`https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${D}${M}${Y}.csv`, { headers: UA, signal: AbortSignal.timeout(30_000) })
      if (r.status === 404) { fs.writeFileSync(fn, ''); none++; done = true; break }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const t = await r.text(); if (/<html/i.test(t.slice(0, 200))) { fs.writeFileSync(fn, ''); none++; done = true; break }
      fs.writeFileSync(f, t); ok++; done = true
    } catch (e) { if (a === 3) { bad++; console.log(`${d} FAILED: ${e.message}`) } else await sleep(3000 * a) }
  }
  if ((ok + none) % 50 === 0) console.log(`${d}: ${ok} saved, ${none} holidays, ${bad} failed`)
  await sleep(300)
}
const line = `[${new Date().toISOString()}] bhav ${from}..${to}: ${ok} saved, ${none} holidays/no file, ${skip} already there, ${bad} failed`
console.log(line); fs.appendFileSync(path.join(dir, '..', 'log.txt'), line + '\n')
