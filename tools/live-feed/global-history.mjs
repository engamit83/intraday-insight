// global-history.mjs - owner 9 Nov 23:36: download GLOBAL market history (US, Asia, crude, USD/INR, US yields, gold, US VIX) for the direction study (RECORD ONLY).
// Usage: node global-history.mjs   -> data\global\NAME.csv (date,open,high,low,close,volume), daily since 2015. Safe to re-run (refreshes all files).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'global'); fs.mkdirSync(dir, { recursive: true })
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }
const S = { SP500: '^GSPC', NASDAQ: '^IXIC', DOW: '^DJI', USVIX: '^VIX', NIKKEI: '^N225', HANGSENG: '^HSI', KOSPI: '^KS11', SHANGHAI: '000001.SS', TAIWAN: '^TWII',
  FTSE: '^FTSE', DAX: '^GDAXI', CRUDE_WTI: 'CL=F', CRUDE_BRENT: 'BZ=F', GOLD: 'GC=F', USDINR: 'INR=X', DOLLAR_INDEX: 'DX-Y.NYB', US10Y: '^TNX', NIFTY_CHECK: '^NSEI' }
const p1 = Math.floor(Date.parse('2015-01-01') / 1000), p2 = Math.floor(Date.now() / 1000)
const out = []
for (const [name, sym] of Object.entries(S)) {
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${p1}&period2=${p2}&interval=1d`, { headers: UA, signal: AbortSignal.timeout(60_000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = (await r.json()).chart.result[0], q = j.indicators.quote[0], tz = j.meta.gmtoffset ?? 0
    const rows = j.timestamp.map((t, i) => [new Date((t + tz) * 1000).toISOString().slice(0, 10), q.open[i], q.high[i], q.low[i], q.close[i], q.volume[i] ?? 0]).filter((r) => r[4] != null)
    fs.writeFileSync(path.join(dir, `${name}.csv`), 'date,open,high,low,close,volume\n' + rows.map((r) => r.join(',')).join('\n') + '\n')
    out.push(`${name} ${rows.length} days (${rows[0][0]}..${rows.at(-1)[0]})`)
  } catch (e) { out.push(`${name} FAILED (${e.message})`) }
  await new Promise((r) => setTimeout(r, 800))
}
const line = `[${new Date().toISOString()}] global history: ${out.join(' | ')}`
console.log(line); fs.appendFileSync(path.join(dir, 'log.txt'), line + '\n')
