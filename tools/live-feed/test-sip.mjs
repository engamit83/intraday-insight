// test-sip.mjs - offline checks of the stocks-in-play engine (synthetic ticks)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
import { SipEngine, SIP_RULES } from './sip-engine.mjs'
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)) }
const day = '2026-10-23', at = (h, m, s = 0) => Date.parse(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}+05:30`)
const base = { first5: { UP: [1000, 1000], DN: [1000], LOW: [1000], ILLQ: [1000], NOHIST: [] }, turnover: { UP: [100], DN: [100], LOW: [100], ILLQ: [5], NOHIST: [100] }, days: ['2026-10-22'] }
function mk() { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sipt-')); return { dir, e: new SipEngine({ dataDir: dir, baseline: JSON.parse(JSON.stringify(base)) }) } }
function feedOR(e, sym, open, hi, lo, close, vol) {
  e.onTick(sym, { price: open, cum: 50000 }, at(9, 15, 1))
  e.onTick(sym, { price: hi, cum: 50000 + vol / 3 }, at(9, 16))
  e.onTick(sym, { price: lo, cum: 50000 + vol / 2 }, at(9, 17))
  e.onTick(sym, { price: close, cum: 50000 + vol }, at(9, 19, 50))
}
{ // selection: rvol, direction, liquidity, history, ranking
  const { e } = mk()
  feedOR(e, 'UP', 100, 102, 99.5, 101.5, 8000)   // rvol 8, BUY
  feedOR(e, 'DN', 200, 200.5, 196, 197, 5000)   // rvol 5, SELL
  feedOR(e, 'LOW', 50, 51, 49, 50.5, 2000)      // rvol 2 -> out
  feedOR(e, 'ILLQ', 50, 51, 49, 50.5, 9000)     // turnover 5 cr -> out
  feedOR(e, 'NOHIST', 50, 51, 49, 50.5, 9000)   // no baseline -> out
  const ev = e.onTimer(at(9, 20, 0))
  const pk = ev.find((x) => x.kind === 'picks')?.picks ?? []
  ok(pk.length === 2 && pk[0].sym === 'UP' && pk[0].dir === 'BUY' && pk[1].sym === 'DN' && pk[1].dir === 'SELL', 'picks UP BUY then DN SELL only')
  ok(Math.abs(pk[0].rvol - 8) < 0.01, 'rvol computed from opening-range volume')
  // entry: no entry at the level itself, entry beyond it at the offer + slippage
  ok(e.onTick('UP', { price: 102, bid: 101.95, ask: 102.05 }, at(9, 21)).length === 0, 'no entry at exactly the OR high')
  const en = e.onTick('UP', { price: 102.1, bid: 102.05, ask: 102.15 }, at(9, 22)).find((x) => x.kind === 'entry')
  ok(en && Math.abs(en.trade.entry - 102.15 * 1.0002) < 0.011, 'BUY fills at the offer + 0.02%')
  ok(en && en.trade.riskPct === 1.5, 'stop clamped to 1.5% when the range is wider')
  ok(en && en.trade.qty === Math.floor(1000 / (en.trade.entry * 0.015)), 'size = Rs1,000 risk')
  // trail: at +1.5R the stop moves to +0.5R
  const t = e.trades.get('UP'); const p15 = t.entry + 1.5 * t.risk
  e.onTick('UP', { price: p15, bid: p15, ask: p15 }, at(10, 0))
  ok(Math.abs(t.stop - (t.entry + 0.5 * t.risk)) < 0.02, 'trailing stop 1R behind the best price')
  const ex = e.onTick('UP', { price: t.stop - 0.01, bid: t.stop - 0.02, ask: t.stop }, at(10, 30)).find((x) => x.kind === 'exit')
  ok(ex && ex.trade.reason === 'trail' && ex.trade.netRs > 0, 'trail exit keeps profit')
  // SELL entry after 10:15 is not allowed
  ok(e.onTick('DN', { price: 195, bid: 194.9, ask: 195.1 }, at(10, 16)).length === 0, 'no new entry after 10:15')
}
{ // stop loss + 15:15 square-off + CSV + baseline update
  const { dir, e } = mk()
  feedOR(e, 'UP', 100, 100.6, 99.9, 100.5, 8000); feedOR(e, 'DN', 200, 200.5, 196, 197, 5000)
  e.onTimer(at(9, 20))
  const en = e.onTick('UP', { price: 100.7, bid: 100.69, ask: 100.71 }, at(9, 25)).find((x) => x.kind === 'entry')
  ok(en && en.trade.riskPct > 0.8 && en.trade.riskPct < 0.85, 'stop at the other side of the range when 0.5-2%')
  const st = e.onTick('UP', { price: 99.8, bid: 99.79, ask: 99.81 }, at(9, 40)).find((x) => x.kind === 'exit')
  ok(st && st.trade.reason === 'stop' && st.trade.R < -1 && st.trade.R > -1.4, 'stop loss about -1R after costs')
  e.onTick('DN', { price: 195.9, bid: 195.85, ask: 195.95 }, at(9, 50))
  const sq = e.onTimer(at(15, 15, 0)).find((x) => x.kind === 'exit')
  ok(sq && sq.trade.reason === 'squareoff', '15:15 square-off')
  ok(fs.readFileSync(path.join(dir, `sip-trades-${day}.csv`), 'utf8').trim().split('\n').length === 3, 'trades written to the CSV')
  ok(e.updateBaseline() && JSON.parse(fs.readFileSync(path.join(dir, 'sip-baseline.json'))).first5.UP.length === 3, 'baseline updated with today')
  ok(!e.updateBaseline(), 'baseline updated only once a day')
  // restart in the middle of the day keeps picks and trades
  const e2 = new SipEngine({ dataDir: dir, baseline: base })
  e2.onTimer(at(11, 0)); ok(e2.picks?.length === 2 && e2.closed.length === 2, 'restart restores picks and trades')
}
{ // late start -> skip the day
  const { e } = mk()
  e.onTick('UP', { price: 100, cum: 1 }, at(9, 17)); e.onTick('UP', { price: 101, cum: 9000 }, at(9, 19))
  const ev = e.onTimer(at(9, 20))
  ok(ev[0]?.kind === 'note' && /after 09:15/.test(ev[0].text) && e.picks.length === 0, 'feed started late -> no picks')
}
{ // EXIT RULE trailing stop + smart warning: a warning on a trade that has been >= +1R tightens the trail to 0.3R
  const { e } = mk()
  feedOR(e, 'DN', 200, 200.5, 196, 197, 5000); e.onTimer(at(9, 20))
  const en = e.onTick('DN', { price: 195.9, bid: 195.85, ask: 195.95, cum: 100000 }, at(9, 21)).find((x) => x.kind === 'entry')
  const t = e.trades.get('DN')
  // run down to +2R, then three 1-minute bars up on rising volume with higher lows (structure + volume) and aggressive buyers
  let cum = 100000, i = 22
  for (const p of [195, 194, 193, 192.5, 192.2, 192]) { cum += 1000; e.onTick('DN', { price: p, cum }, at(9, i)); e.onTick('DN', { price: p - 0.05, cum: cum + 500 }, at(9, i, 30)); i++ }
  const best = t.best
  let ev = []
  for (const p of [192.6, 193.4, 194.2, 195]) { cum += 30000; ev.push(...e.onTick('DN', { price: p - 0.1, cum }, at(9, i))); ev.push(...e.onTick('DN', { price: p, cum: cum + 20000 }, at(9, i, 30))); i++ }
  ev.push(...e.onTick('DN', { price: 195, cum: cum + 100 }, at(9, i)))
  const w = ev.find((x) => x.kind === 'warn')
  ok(en && best >= 1 && w && w.tightened, 'smart warning on a winner tightens the trailing stop')
  ok(t.exit || Math.abs(t.stop - (t.entry - (t.best - 0.3) * t.risk)) < 0.02, 'tightened stop sits 0.3R behind the best price (or the trade closed on it)')
}
{ // rule 7: trend back in our favour -> trail 1R again, stop never moves down
  const { e } = mk()
  feedOR(e, 'DN', 200, 200.5, 196, 197, 5000); e.onTimer(at(9, 20))
  e.onTick('DN', { price: 195.9, bid: 195.85, ask: 195.95, cum: 100000 }, at(9, 21))
  const t = e.trades.get('DN')
  t.best = 2; t.tight = true; t.stop = +(t.entry - 1.7 * t.risk).toFixed(2); const floor = t.stop
  e.sw.signsFor = () => ({ score: 0, signs: {}, R: 1.8, best: 2 })   // no warning signs on the next closed bar
  const ev = [...e.onTick('DN', { price: t.entry - 1.8 * t.risk, cum: 100100 }, at(9, 40)), ...e.onTick('DN', { price: t.entry - 1.8 * t.risk, cum: 100200 }, at(9, 41))]
  ok(ev.some((x) => x.kind === 'untight') && !t.tight, 'trend back in favour -> back to 1R trailing')
  ok(t.stop === floor, 'stop does not move down when switching back to 1R')
  e.onTick('DN', { price: t.entry - 3.5 * t.risk, cum: 100300 }, at(9, 41, 20))
  ok(Math.abs(t.stop - (t.entry - 2.5 * t.risk)) < 0.02, 'then trails 1R behind the new best')
}
console.log(`${pass}/${pass + fail} stocks-in-play checks passed`); process.exit(fail ? 1 : 0)
