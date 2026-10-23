// test-smart-warn.mjs - offline checks of the smart exit warning
import { SmartWarn } from './smart-warn.mjs'
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)) }
const mm = (i) => { const t = 9 * 60 + 20 + i; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }
function feed(sw, sym, prices, vols, start = 0) { let cum = 1000; prices.forEach((p, i) => { for (const [k, q] of [[0, p], [1, p + 0.01], [2, p]]) { cum += vols[i] / 3; sw.onTick(sym, mm(start + i), q + 0 * k, cum) } }) }
{ // SELL trade going our way then buyers take over strongly after +1R -> protect-profit warning
  const sw = new SmartWarn(); const t = { sym: 'X', dir: 'SELL', entry: 100, risk: 1, inMin: mm(0), bookAtEntry: 1 }
  const down = [100, 99.6, 99.2, 98.8, 98.5, 98.4]; const up = [98.7, 99.0, 99.4, 99.8, 100.1]
  feed(sw, 'X', down, down.map(() => 1000))
  sw.onBook('X', 2000, 1000)
  let w = null
  const ps = up, vs = up.map(() => 4000)
  ps.forEach((p, i) => { sw.onTick('X', mm(6 + i), p - 0.05, 0 + 100000 + i * 5000); sw.onTick('X', mm(6 + i), p, 100000 + i * 5000 + 4000); sw.onTick('X', mm(7 + i), p, 100000 + i * 5000 + 4500); w = w || sw.evaluate(t, mm(7 + i)) })
  ok(w && w.mode === 'protect profit' && w.score >= 3, 'warns to protect profit when buyers take over a winning SELL')
}
{ // early small wobble right after entry -> no warning (grace + early needs 4 signs incl. flow/book)
  const sw = new SmartWarn(); const t = { sym: 'Y', dir: 'BUY', entry: 100, risk: 1, inMin: mm(0), bookAtEntry: 1 }
  feed(sw, 'Y', [100, 100.2, 100.1, 99.95], [1000, 1000, 1000, 1000]); sw.onTick('Y', mm(4), 100, 99999)
  ok(sw.evaluate(t, mm(4)) === null, 'no warning on an early wobble')
}
console.log(`${pass}/${pass + fail} smart-warning checks passed`); process.exit(fail ? 1 : 0)
