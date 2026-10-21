// resample.mjs - builds N-minute candles (e.g. 2 or 5) from Sharekhan 1-minute history. Sharekhan has no 2-minute candles
// (21 Oct 2026); 1-minute history covers ~9 trading days, more than its 5-minute history (~6 days).
// Usage: node tools/backtest/resample.mjs <hist-1minute.json> <minutes> <out.json>
import { readFileSync, writeFileSync } from 'node:fs'
const [inFile, mins, outFile] = process.argv.slice(2)
const N = Number(mins)
const d = JSON.parse(readFileSync(inFile, 'utf8'))
const out = { interval: `${N}minute`, builtFrom: '1minute', fetchedAt: d.fetchedAt, results: {} }
for (const [s, v] of Object.entries(d.results)) {
  if (!v.candles) { out.results[s] = v; continue }
  const rows = [...v.candles].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const map = new Map()
  for (const [t, o, h, l, c, vol] of rows) {
    const day = t.slice(0, 10), hh = +t.slice(11, 13), mm = +t.slice(14, 16)
    const m = hh * 60 + mm - (9 * 60 + 15)
    if (m < 0) continue
    const b = Math.floor(m / N) * N + 9 * 60 + 15
    const key = `${day}T${String(Math.floor(b / 60)).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}:00+05:30`
    const x = map.get(key)
    if (!x) map.set(key, [key, o, h, l, c, vol])
    else { x[2] = Math.max(x[2], h); x[3] = Math.min(x[3], l); x[4] = c; x[5] += vol }
  }
  out.results[s] = { candles: [...map.values()] }
}
writeFileSync(outFile, JSON.stringify(out))
console.log(`${Object.keys(out.results).length} stocks -> ${outFile}`)
