import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import zlib from 'node:zlib'
import { pullHistory } from './pull-history.mjs'
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)) }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-')); const calls = []
const gw = async (a, b) => { calls.push(b); return { results: Object.fromEntries(b.symbols.map((s) => [s, { candles: [[1, 1, 1, 1, 1, 1]] }])) } }
const syms = Array.from({ length: 23 }, (_, i) => 'S' + i)
await pullHistory(gw, syms, dir, '2026-10-23', () => {})
ok(calls.length === 6, 'batches of 10 for 2 intervals')
const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'history', 'hist-1minute-2026-10-23.json.gz'))))
ok(Object.keys(j.results).length === 23, 'all symbols saved')
await pullHistory(gw, syms, dir, '2026-10-23', () => {}); ok(calls.length === 6, 'no repeat pull same day')
let msg = ''; await pullHistory(async () => { throw new Error('409 NO_VALID_SHAREKHAN_TOKEN') }, syms, dir, '2026-10-30', (m) => (msg += m))
ok(/not connected/.test(msg), 'stops when Sharekhan off')
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0)
