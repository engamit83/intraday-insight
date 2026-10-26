// pull-run.mjs - runs the weekly history pull as its OWN program (22 Oct fix): the laptop's 15:40 "stop feed" task closes
// the INTRADAY-FEED window, which would cut off a pull started inside feed.mjs. feed.mjs starts this in a separate window
// ("INTRADAY-HISTORY") so the stop does not touch it. Can also be run by hand: node pull-run.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pullHistory } from './pull-history.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '.env')
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { GATEWAY_URL, FEED_TOKEN } = process.env
const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
const scrub = (t) => String(t).split(FEED_TOKEN || '\u0000').join('***')
function say(msg) {
  const line = `[${new Date(Date.now() + 330 * 60_000).toISOString().slice(11, 19)}] ${scrub(msg)}`
  console.log(line)
  try { fs.mkdirSync(path.join(here, 'logs'), { recursive: true }); fs.appendFileSync(path.join(here, 'logs', `feed-${day}.log`), line + '\n') } catch {}
}
async function gateway(action, payload = {}) {
  const r = await fetch(GATEWAY_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-job-token': FEED_TOKEN },
    body: JSON.stringify({ action, ...payload }), signal: AbortSignal.timeout(60_000) })
  const text = await r.text(); let j = null; try { j = JSON.parse(text) } catch {}
  if (!r.ok) throw new Error(`${r.status} ${j?.error || ''}`)
  return j
}
try {
  if (!GATEWAY_URL || !FEED_TOKEN) throw new Error('settings missing in .env')
  say('history pull started (separate window)')
  const info = await gateway('token')
  const args = process.argv.slice(2), indices = args.includes('indices') // node pull-run.mjs indices daily 60minute -> index history (27 Oct)
  const INDICES = ['NIFTY', 'NIFTYBANK', 'NIFTYIT', 'NIFTYFMCG', 'NIFTYENERGY', 'NIFTYPHARMA', 'NIFTYAUTO', 'NIFTYMETAL', 'NIFTYREALTY', 'NIFTYPSUBANK', 'NIFTYPVTBANK',
    'NIFTYFINSERV', 'NIFTYINFRA', 'NIFTYMEDIA', 'NIFTYCONSUMPTION', 'NIFTYOILGAS', 'NIFTYHEALTHCARE', 'NIFTYCONSDURABLE', 'NIFTYCHEMICALS', 'NIFTYCEMENT', 'NIFTYPOWER',
    'NIFTY500', 'NIFTYMIDCAP150', 'NIFTYSMALLCAP250', 'INDIAVIX']
  const symbols = indices ? INDICES : Object.keys(info.symbols || {})
  const iv = args.filter((a) => a !== 'indices')
  await pullHistory(gateway, symbols, path.join(here, 'data'), day, say, iv.length ? iv : undefined, indices ? 'idx' : 'hist')
} catch (e) { say(`! history pull failed: ${e.message}`) }
