// kite-day-auto.mjs - owner 24 Nov 15:37 "make it automatic": after the close, save Zerodha 1-minute candles (backup for any minute the
// live feed missed) for TODAY + every trading day of the last 10 whose candle folder is missing or has < 500 files. Record only, no orders.
// Started by auto-feed.bat when the market closes (minimized window ZERODHA-DAY). Needs today's Zerodha login; without it, it only logs.
// Uses kite-day.mjs (already-saved files are skipped, so a half-done day is completed next time). Log: data\kite\progress.log
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const istNow = () => new Date(Date.now() + 330 * 60_000)
const root = path.join(here, 'data', 'kite'); fs.mkdirSync(root, { recursive: true })
const say = (m) => { const l = `[${istNow().toISOString().slice(0, 19).replace('T', ' ')}] AUTO: ${m}`; console.log(l); fs.appendFileSync(path.join(root, 'progress.log'), l + '\n') }
let hol = []
try { hol = JSON.parse(fs.readFileSync(path.join(here, 'data', 'nse-holidays.json'), 'utf8')) } catch { /* none */ }
const isTradingDay = (d) => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5 && !hol.includes(d) }
export function daysToPull(now = istNow(), countFiles = (d) => { try { return fs.readdirSync(path.join(root, 'day', d)).length } catch { return 0 } }, need = 500) { // 25 Nov: 400 let a day with 64 failed downloads (internet outage) count as complete; full day = ~508 files
  const today = now.toISOString().slice(0, 10), out = []
  const afterClose = now.toISOString().slice(11, 16) >= '15:31'
  let back = 0
  for (let i = 0; back < 10 && i < 30; i++) {
    const d = new Date(Date.parse(today + 'T12:00:00Z') - i * 86_400_000).toISOString().slice(0, 10)
    if (!isTradingDay(d)) continue
    if (d === today) { if (afterClose && countFiles(d) < need) out.push(d); continue }
    back++
    if (countFiles(d) < need) out.push(d)
  }
  return out.reverse()
}
if (!globalThis.__kdaTest) {
  const tokF = path.join(here, 'data', 'kite-token.json')
  let tokDay = ''
  try { tokDay = new Date(fs.statSync(tokF).mtimeMs + 330 * 60_000 - 6 * 3600_000).toISOString().slice(0, 10) } catch { /* no login file */ }
  const loginDay = new Date(istNow().getTime() - 6 * 3600_000).toISOString().slice(0, 10) // a Zerodha login lasts until ~06:00 next morning
  const days = daysToPull()
  if (!days.length) say('nothing to pull - all recent days complete')
  else if (tokDay !== loginDay) say(`no Zerodha login today - not pulled: ${days.join(' ')} (will retry after the next login)`)
  else {
    say(`pulling 1-minute candles for ${days.join(' ')}`)
    const r = spawnSync(process.execPath, [path.join(here, 'kite-day.mjs'), ...days], { cwd: here, stdio: 'inherit' })
    say(`finished (exit ${r.status})`)
  }
  // 25 Nov: also compress recent tick files (ticks-DAY.csv -> .gz, original kept) so Claude can copy them for exit research (copy limit 400 MB)
  const gz = []
  for (let i = 0, back = 0; back < 10 && i < 30; i++) {
    const d = new Date(Date.parse(istNow().toISOString().slice(0, 10) + 'T12:00:00Z') - i * 86_400_000).toISOString().slice(0, 10)
    if (!isTradingDay(d)) continue
    back++
    const f = path.join(here, 'data', `ticks-${d}.csv`)
    if (fs.existsSync(f) && !fs.existsSync(f + '.gz') && fs.statSync(f).size > 1e6 && (d !== istNow().toISOString().slice(0, 10) || istNow().toISOString().slice(11, 16) >= '15:31')) gz.push(d)
  }
  if (gz.length) { say(`compressing tick files ${gz.join(' ')}`); const g = spawnSync(process.execPath, [path.join(here, 'gz-ticks.mjs'), ...gz], { cwd: here, stdio: 'inherit' }); say(`compress finished (exit ${g.status})`) }
}
