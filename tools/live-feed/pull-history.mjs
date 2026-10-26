// pull-history.mjs - weekly history pull by the laptop (owner 21 Oct): every Friday after the market, Sharekhan's last ~6 trading
// days of 1-minute and 5-minute candles for all stocks, through the app's feed-gateway ('history' action; the Sharekhan API key
// stays in the app). Saved as data\history\hist-<interval>-DATE.json.gz (about 3 MB + 13 MB). Fills gaps like 20 Oct.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

export async function pullHistory(gateway, symbols, dataDir, day, say = console.log, intervals = ['5minute', '1minute'], prefix = 'hist') {
  const dir = path.join(dataDir, 'history')
  fs.mkdirSync(dir, { recursive: true })
  const summary = []
  for (const interval of intervals) {
    const file = path.join(dir, `${prefix}-${interval}-${day}.json.gz`)
    if (fs.existsSync(file)) { summary.push(`${interval}: already pulled`); continue }
    const out = { interval, fetchedAt: new Date().toISOString(), results: {} }
    let errors = 0
    for (let i = 0; i < symbols.length; i += 10) {
      try {
        const r = await gateway('history', { symbols: symbols.slice(i, i + 10), interval })
        Object.assign(out.results, r.results ?? {})
      } catch (e) {
        errors++
        if (/NO_VALID_SHAREKHAN_TOKEN|409/.test(e.message)) { say('! history pull stopped: Sharekhan is not connected'); break }
      }
    }
    const n = Object.values(out.results).filter((v) => v.candles).length
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(out)))
    summary.push(`${interval}: ${n}/${symbols.length} stocks${errors ? `, ${errors} failed calls` : ''}`)
  }
  say(`history pull ${day}: ${summary.join(' | ')}`)
  return summary
}
