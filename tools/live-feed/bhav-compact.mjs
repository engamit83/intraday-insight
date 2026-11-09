// bhav-compact.mjs - pack the NSE official daily files into ONE small file for Claude's replay (official close, turnover Rs cr, delivery %).
// Usage: node bhav-compact.mjs  -> data\history-news\bhav-compact.csv  (date,symbol,close,prev_close,turnover_cr,deliv_pct), EQ/BE/BZ series only.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'history-news', 'bhav')
const out = path.join(dir, '..', 'bhav-compact.csv')
const lines = ['date,symbol,close,prev_close,turnover_cr,deliv_pct']; let days = 0
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.csv')).sort()) {
  const rows = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/); const h = rows[0].split(',').map((x) => x.trim())
  const ix = (n) => h.indexOf(n), iS = ix('SYMBOL'), iE = ix('SERIES'), iC = ix('CLOSE_PRICE'), iP = ix('PREV_CLOSE'), iT = ix('TURNOVER_LACS'), iD = ix('DELIV_PER')
  for (const r of rows.slice(1)) { const c = r.split(',').map((x) => x.trim()); if (!['EQ', 'BE', 'BZ'].includes(c[iE])) continue
    lines.push([f.slice(0, 10), c[iS], c[iC], c[iP], (+c[iT] / 100).toFixed(2), c[iD]].join(',')) }
  days++
}
fs.writeFileSync(out, lines.join('\n') + '\n')
console.log(`packed ${days} days, ${lines.length - 1} rows -> ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`)
