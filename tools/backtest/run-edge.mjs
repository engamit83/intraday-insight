// run-edge.mjs - 21 Oct R&D: does our DIRECTION prediction have an edge? For every candidate the rules accept, which comes
// first after entry: +X% (our way) or -X% (against)? 50% = coin flip; to profit after ~0.15% costs a symmetric X% trade
// needs hit rate > 50% + costs/(2X). Grouped by feature so we see WHICH conditions predict.
import { readFileSync } from 'node:fs'
import { runBacktest } from './backtest.mjs'
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'))
for (const v of Object.values(data.results)) if (v.candles) v.candles = v.candles.filter((c) => c[0].slice(0, 10) >= '2026-10-12')
const min1 = JSON.parse(readFileSync(process.argv[3], 'utf8')) // 1-minute candles for exact first-touch
const one = {}
for (const [s, v] of Object.entries(min1.results)) { if (!v.candles) continue; one[s] = {}; for (const [t, , h, l] of v.candles) (one[s][t.slice(0, 10)] ??= []).push([t.slice(11, 16), h, l]); for (const d of Object.values(one[s])) d.sort() }
const base = { marketFilter: true, relStrength: true, onePerStockPerDay: true, noEntryBefore: '10:00', noEntryAfter: '14:00', stopAtrMult: 2, rewardRisk: 2,
  prevDayLevels: true, volMode: 'either', maxTradesPerDay: null, topN: 1000, maxOpen: 1000, rankBy: 'inPlay' }
const loose = { ...base, prevDayLevels: false, volMode: null, marketFilter: false, relStrength: false }
function first(t, X) {
  const up = t.entry * (1 + X / 100), dn = t.entry * (1 - X / 100)
  for (const [b, h, l] of one[t.symbol]?.[t.day] ?? []) {
    if (b < t.entryTime || b >= '15:15') continue
    const hu = h >= up, hd = l <= dn
    if (hu && hd) return 0 // same minute: unknown -> count as loss
    if (hu) return t.direction === 'BUY' ? 1 : 0
    if (hd) return t.direction === 'SELL' ? 1 : 0
  }
  return null // neither touched before 15:15
}
for (const [label, opts] of [['our rules (v4 entry conditions)', base], ['any momentum signal (no market/level/volume rules)', loose]]) {
  const r = runBacktest(data, opts)
  const days = r.days.slice(3)
  const tr = r.trades.filter((t) => days.includes(t.day))
  const rs = [...tr].sort((a, b) => b.rankScore - a.rankScore)
  const top = new Set(rs.slice(0, Math.ceil(rs.length / 5)))
  console.log(`\n== ${label}: ${tr.length} candidates on ${days.join(', ')}`)
  for (const X of [0.3, 0.5, 0.75, 1.0]) {
    const g = (name, f) => { const x = tr.filter(f).map((t) => first(t, X)).filter((v) => v !== null); return `${name} ${x.length ? Math.round(x.reduce((a, b) => a + b, 0) / x.length * 100) : '-'}% (${x.length})` }
    console.log(`  +/-${X}%: ` + [g('all', () => true), g('BUY', (t) => t.direction === 'BUY'), g('SELL', (t) => t.direction === 'SELL'),
      g('top-20% in play', (t) => top.has(t)), g('10:00-11:30', (t) => t.entryTime < '11:30'), g('11:30-14:00', (t) => t.entryTime >= '11:30')].join(' | ') +
      `   (break-even after costs: ${Math.round((0.5 + 0.15 / (2 * X)) * 100)}%)`)
  }
}
