// daily-report.mjs - nightly research summary on the laptop (owner 21 Oct: "do it", so Claude only reads a short page).
// Runs when the feed stops for the day (or by hand: node daily-report.mjs [YYYY-MM-DD]). Uses only the laptop's own
// recordings (data\candles-DATE.csv) - no network, no AI. Writes logs\report-DATE.txt and returns the text (the feed sends it on ntfy).
// Numbers: Nifty day move; for every stock, does the price go +1% in the direction of its 09:15-10:00 move before -1% (by side);
// gap held (open >= 0.5% beyond the previous recorded day's close and still beyond the open at 10:00) - same 1% test.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function readCandles(file) {
  const by = new Map()
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (const l of lines.slice(1)) {
    const [time, sym, o, h, lo, c] = l.split(',')
    if (!sym) continue
    if (!by.has(sym)) by.set(sym, [])
    by.get(sym).push({ time, o: +o, h: +h, l: +lo, c: +c })
  }
  for (const v of by.values()) v.sort((a, b) => (a.time < b.time ? -1 : 1))
  return by
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) : '-')

export function dailyReport(dataDir, day) {
  const files = fs.readdirSync(dataDir).filter((f) => /^candles-\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort()
  const today = `candles-${day}.csv`
  if (!files.includes(today)) return null
  const prevFile = files.filter((f) => f < today).at(-1)
  const T = readCandles(path.join(dataDir, today))
  const P = prevFile ? readCandles(path.join(dataDir, prevFile)) : new Map()
  const nifty = T.get('NIFTY')
  const niftyChg = nifty?.length ? ((nifty.at(-1).c / nifty[0].o - 1) * 100).toFixed(2) : '?'
  const res = { BUY: [0, 0], SELL: [0, 0], gap: [0, 0], neither: 0 }
  for (const [sym, bars] of T) {
    if (sym.startsWith('NIFTY') || bars.length < 200) continue
    const open = bars[0].o, morning = bars.filter((b) => b.time < '10:00')
    if (!morning.length) continue
    const p10 = morning.at(-1).c, side = p10 > open ? 'BUY' : 'SELL', B = side === 'BUY'
    const up = p10 * 1.01, dn = p10 * 0.99
    let r = null
    for (const b of bars) {
      if (b.time < '10:00' || b.time >= '15:15') continue
      if (b.h >= up && b.l <= dn) { r = 0; break }
      if (b.h >= up) { r = B ? 1 : 0; break }
      if (b.l <= dn) { r = B ? 0 : 1; break }
    }
    if (r === null) { res.neither++; continue }
    res[side][0] += r; res[side][1]++
    const prevClose = P.get(sym)?.at(-1)?.c
    if (prevClose) {
      const gap = (open / prevClose - 1) * 100
      if (B ? gap >= 0.5 && p10 > open : gap <= -0.5 && p10 < open) { res.gap[0] += r; res.gap[1]++ }
    }
  }
  const all = [res.BUY[0] + res.SELL[0], res.BUY[1] + res.SELL[1]]
  const text = `📊 Research ${day} (laptop, all stocks): Nifty ${niftyChg}% · morning direction +1% before -1%: ${pct(...all)}% of ${all[1]} ` +
    `(BUY ${pct(...res.BUY)}% of ${res.BUY[1]}, SELL ${pct(...res.SELL)}% of ${res.SELL[1]}) · gap held ${pct(...res.gap)}% of ${res.gap[1]}` +
    `${prevFile ? '' : ' (no earlier day recorded)'} · neither ${res.neither} · break-even ~57%`
  try { fs.mkdirSync(path.join(dataDir, '..', 'logs'), { recursive: true }); fs.writeFileSync(path.join(dataDir, '..', 'logs', `report-${day}.txt`), text + '\n') } catch { /* never fail */ }
  return text
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const day = process.argv[2] ?? new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
  console.log(dailyReport(path.join(here, 'data'), day) ?? `no candles file for ${day}`)
}
