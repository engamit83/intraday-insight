// master-search.mjs - 8 Nov: find Sharekhan scrip codes (India VIX etc.) via the gateway's read-only 'master_search'.
// Usage: node master-search.mjs VIX   -> writes data\master-search-VIX.json (all exchanges tried). Needs today's Sharekhan login.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, '.env')
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { GATEWAY_URL, FEED_TOKEN } = process.env
const q = process.argv[2] ?? 'VIX', out = {}
for (const exchange of ['NC', 'BC', 'NF']) {
  try {
    const r = await fetch(GATEWAY_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-job-token': FEED_TOKEN },
      body: JSON.stringify({ action: 'master_search', query: q, exchange }), signal: AbortSignal.timeout(120_000) })
    out[exchange] = { status: r.status, ...(await r.json().catch(() => ({}))) }
  } catch (e) { out[exchange] = { error: e.message } }
}
fs.writeFileSync(path.join(here, 'data', `master-search-${q}.json`), JSON.stringify(out, null, 1))
console.log(`saved data\\master-search-${q}.json:`, Object.entries(out).map(([k, v]) => `${k} ${v.status ?? v.error} matches ${v.matches?.length ?? 0}`).join(' | '))
