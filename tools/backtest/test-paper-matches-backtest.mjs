// Checks that the paper trader's exit rules (supabase/functions/_shared/paper.ts) give the SAME exits as the back-tester.
// Usage: node --experimental-strip-types tools/backtest/test-paper-matches-backtest.mjs <history-5minute.json> [<history-30minute.json>]
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { runBacktest } from './backtest.mjs'
import { manageOnCandle, entryFill, settle, quantityFor } from '../../supabase/functions/_shared/paper.ts'

const v4 = { marketFilter: true, relStrength: true, onePerStockPerDay: true, maxTradesPerDay: 10, topN: 3, noEntryBefore: '10:00', noEntryAfter: '14:00',
  stopAtrMult: 2, rewardRisk: 2, prevDayLevels: true, volMode: 'either', dailyLossLimitRs: 2000, breakevenAtR: 1, lockProfit: true, trailAtrMult: 1.5, trailAfterR: 1 }
for (const file of process.argv.slice(2)) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  if (data.interval !== '5minute') { console.log(`(skipping ${data.interval}: paper trader manages on 5-minute candles)`); continue }
  const bt = runBacktest(data, v4)
  const step = 5
  const bucketOf = (ts) => { const m = +ts.slice(11, 13) * 60 + +ts.slice(14, 16); const b = 555 + Math.floor((m - 555) / step) * step; return String(Math.floor(b / 60)).padStart(2, '0') + ':' + String(b % 60).padStart(2, '0') }
  let same = 0
  const diffs = []
  for (const t of bt.trades) {
    const bars = data.results[t.symbol].candles.filter((r) => r[0].startsWith(t.day)).map((r) => ({ bucket: bucketOf(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4] }))
      .filter((b) => b.bucket >= t.entryTime).sort((a, b) => a.bucket.localeCompare(b.bucket))
    const entryBar = bars[0]
    const p = { direction: t.direction, entry: entryFill(t.direction, entryBar.open), stop: t.stop0 ?? null, target: t.target, stopDist: t.stopDist, atr: t.atr }
    // initial stop = signal price -/+ stopDist
    p.stop = t.direction === 'BUY' ? t.signalPrice - t.stopDist : t.signalPrice + t.stopDist
    let out = null
    for (const b of bars) { const s = manageOnCandle(p, b); if (s.action === 'close') { out = { s, bucket: b.bucket }; break } }
    if (!out) { const last = bars.at(-1); out = { s: { action: 'close', rawPx: last.close, reason: 'squareoff', slipped: true }, bucket: last.bucket } }
    const st = settle(p, out.s, quantityFor(p.entry))
    const ok = Math.abs(st.exit - t.exit) < 1e-6 && out.s.reason === t.reason && out.bucket === t.exitTime && Math.abs(p.entry - t.entry) < 1e-9
    if (ok) same++; else diffs.push(`${t.day} ${t.symbol} ${t.direction} bt:${t.reason}@${t.exitTime} ${t.exit.toFixed(2)} paper:${out.s.reason}@${out.bucket} ${st.exit.toFixed(2)}`)
  }
  console.log(`${data.interval}: back-test trades ${bt.trades.length}, identical exits in paper trader ${same}`)
  if (diffs.length) console.log(diffs.slice(0, 10).join('\n'))
  assert.equal(same, bt.trades.length, 'paper trader exits must equal the back-test exits')
}
console.log('OK: paper trader exits match the back-tester')
