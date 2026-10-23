// replay-smart.mjs ticks.csv book.csv tradesJSON -> warnings and what exiting there would have given
import fs from 'node:fs'; import readline from 'node:readline'
import { SmartWarn } from './smart-warn.mjs'
const [tf, bf, trf] = process.argv.slice(2)
const trades = JSON.parse(fs.readFileSync(trf, 'utf8'))
const syms = new Set([...trades.map((t) => t.sym), 'NIFTY'])
const book = new Map()
for (const line of fs.readFileSync(bf, 'utf8').split('\n').slice(1)) { const p = line.split(','); if (syms.has(p[1])) book.set(p[1] + p[0].slice(0, 5), [+p[8], +p[9]]) }
const sw = new SmartWarn(); const out = []
const rl = readline.createInterface({ input: fs.createReadStream(tf) }); let first = true
for await (const line of rl) {
  if (first) { first = false; continue }
  const p = line.split(','); if (!syms.has(p[1])) continue
  const m = p[0].slice(0, 5)
  const closed = sw.onTick(p[1], m, +p[2], p[3] === '' ? NaN : +p[3])
  const bk = book.get(p[1] + m); if (bk) sw.onBook(p[1], bk[0], bk[1])
  if (!closed || p[1] === 'NIFTY') continue
  for (const t of trades) {
    if (t.sym !== p[1] || m <= t.inMin || m > t.outMin) continue
    if (t.bookAtEntry == null) { const b0 = book.get(t.sym + t.inMin); t.bookAtEntry = b0 ? b0[0] / b0[1] : null }
    const w = sw.evaluate(t, m); if (w) out.push(w)
  }
}
const COST = 0.10628, SLIP = 0.02
let tot = 0, totW = 0
for (const t of trades) {
  const ws = out.filter((w) => w.sym === t.sym), w = ws[0]
  const sg = t.dir === 'BUY' ? 1 : -1
  const net = w ? Math.round(t.qty * (w.price * (1 - sg * SLIP / 100) - t.entry) * sg - t.qty * t.entry * COST / 100) : t.actual
  tot += t.actual; totW += net
  console.log(`${t.sym.padEnd(10)} ${t.dir} actual ${String(t.actual).padStart(6)} | ${w ? `first warning ${w.minute} at ${w.price} (${w.R}R, ${w.score} signs: ${w.signs.join('+')}) -> if exited ${net} (${net - t.actual >= 0 ? '+' : ''}${net - t.actual})` : 'no warning'}${ws.length > 1 ? ` [+${ws.length - 1} more]` : ''}`)
}
console.log('TOTAL actual', tot, '| if exited at first smart warning', totW, '| difference', totW - tot)
