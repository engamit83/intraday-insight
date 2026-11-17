// gz-ticks.mjs DATE [DATE...] - compress data\ticks-DATE.csv to data\ticks-DATE.csv.gz (original kept) so Claude can
// copy a day's ticks off the laptop (copy limit 400 MB per file; a full Zerodha day is ~450 MB raw, ~80 MB gzipped).
// Record-only helper (17 Nov). Writes a log line to data\gz-ticks.log.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { pipeline } from 'node:stream/promises'; import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const log = (s) => { const l = `[${new Date().toISOString()}] ${s}`; console.log(l); fs.appendFileSync(path.join(here, 'data', 'gz-ticks.log'), l + '\n') }
const days = process.argv.slice(2)
if (!days.length) { const d = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10); days.push(d) }
for (const d of days) {
  const src = path.join(here, 'data', `ticks-${d}.csv`), dst = src + '.gz', tmp = dst + '.part'
  if (!fs.existsSync(src)) { log(`${d}: no ticks file`); continue }
  try {
    await pipeline(fs.createReadStream(src), zlib.createGzip({ level: 6 }), fs.createWriteStream(tmp))
    fs.renameSync(tmp, dst)
    log(`${d}: done ${fs.statSync(src).size} -> ${fs.statSync(dst).size} bytes`)
  } catch (e) { log(`${d}: FAILED ${e.message}`); try { fs.unlinkSync(tmp) } catch {} }
}
log('ALL DONE')
