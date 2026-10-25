// replay-sip.mjs - replay a recorded tick file (data\ticks-DATE.csv) through the stocks-in-play engine.
// Usage: node replay-sip.mjs ticks.csv baseline.json DATE [book.csv]  (book.csv gives the buyers/sellers totals for the smart warning)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { SipEngine } from './sip-engine.mjs'
const [file, baseFile, day, bookFile] = process.argv.slice(2)
const book = new Map()
if (bookFile) for (const l of fs.readFileSync(bookFile, 'utf8').split('\n').slice(1)) { const p = l.split(','); if (p[8]) book.set(p[1] + p[0].slice(0, 5), [+p[8], +p[9]]) }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sip-'))
const eng = new SipEngine({ dataDir: dir, baseline: JSON.parse(fs.readFileSync(baseFile, 'utf8')), day })
const base = Date.parse(`${day}T00:00:00+05:30`)
const rl = readline.createInterface({ input: fs.createReadStream(file) })
let first = true, n = 0, lastTs = 0
for await (const line of rl) {
  if (first) { first = false; continue }
  const [t, sym, price, cum, bid, , ask] = line.split(',')
  const [hh, mm, ss] = t.split(':'); const ts = base + ((+hh) * 3600 + (+mm) * 60 + (+ss)) * 1000
  lastTs = ts; n++
  const bk = book.get(sym + t.slice(0, 5))
  for (const ev of eng.onTick(sym, { price: +price, bid: +bid, ask: +ask, cum: +cum, totBuy: bk?.[0], totSell: bk?.[1] }, ts)) {
    if (ev.kind === 'picks') console.log('PICKS', ev.picks.map((p) => `${p.sym} ${p.dir} rvol ${p.rvol}`).join(' | '))
    else if (ev.kind === 'entry') console.log('ENTRY', t, ev.trade.sym, ev.trade.dir, ev.trade.entry, 'stop', ev.trade.stop, 'risk%', ev.trade.riskPct, 'qty', ev.trade.qty)
    else if (ev.kind === 'exit') console.log('EXIT ', t, ev.trade.sym, ev.trade.reason, ev.trade.exit, 'net Rs', ev.trade.netRs, `${ev.trade.R}R`)
    else if (ev.kind === 'warn') console.log('WARN ', t, ev.trade.sym, `${ev.w.R}R best ${ev.w.best}R`, ev.w.signs.join('+'), ev.tightened ? `-> stop tightened to ${ev.trade.stop}` : '(alert only)')
    else console.log('NOTE', ev.text)
  }
}
for (const ev of eng.onTimer(base + (15 * 3600 + 15 * 60) * 1000)) if (ev.kind === 'exit') console.log('EXIT  15:15', ev.trade.sym, ev.trade.reason, ev.trade.exit, 'net Rs', ev.trade.netRs, `${ev.trade.R}R`)
console.log('ticks', n, 'summary', JSON.stringify(eng.summary()))
