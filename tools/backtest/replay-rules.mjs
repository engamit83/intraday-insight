// replay with rule overrides: node rp.mjs ticks baseline day book '{"maxGapWithPct":null}' [engine]
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import readline from 'node:readline'
const [file, baseFile, day, bookFile, over, eng0] = process.argv.slice(2)
const { SipEngine, SIP_RULES } = await import(eng0 ?? '/home/claude/intraday-insight/tools/live-feed/sip-engine.mjs')
const book = new Map(); for (const l of fs.readFileSync(bookFile, 'utf8').split('\n').slice(1)) { const p = l.split(','); if (p[8]) book.set(p[1] + p[0].slice(0, 5), [+p[8], +p[9]]) }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-'))
const eng = new SipEngine({ dataDir: dir, baseline: JSON.parse(fs.readFileSync(baseFile, 'utf8')), day, rules: { ...SIP_RULES, lateShadow: false, preopenShadow: false, ...JSON.parse(over || '{}') } })
if (process.env.SW) eng.sw.r = { ...eng.sw.r, ...JSON.parse(process.env.SW) }
const base = Date.parse(`${day}T00:00:00+05:30`); let first = true
for await (const line of readline.createInterface({ input: fs.createReadStream(file) })) {
  if (first) { first = false; continue }
  const [t, sym, price, cum, bid, , ask] = line.split(','); const [hh, mm, ss] = t.split(':'); const ts = base + ((+hh) * 3600 + (+mm) * 60 + (+ss)) * 1000
  const bk = book.get(sym + t.slice(0, 5)); eng.onTick(sym, { price: +price, bid: +bid, ask: +ask, cum: +cum, totBuy: bk?.[0], totSell: bk?.[1] }, ts)
}
eng.onTimer(base + (15 * 3600 + 15 * 60) * 1000)
console.log(JSON.stringify({ sum: eng.summary(), trades: eng.closed.map((t) => ({ sym: t.sym, dir: t.dir, rvol: t.rvol, gap: t.gapWith, mult: t.sizeMult, best: +t.best.toFixed(2), reason: t.reason, tight: !!t.tight, net: t.netRs, R: t.R, re: t.re ?? 0 })) }))
