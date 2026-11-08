// kite-bundle.mjs - pack one year of data\kite\minute\YEAR\*.csv.gz into 2 bundle files (data\kite\bundle-YEAR-1.bin / -2.bin) so the analysis
// side can copy a whole year in 2 transfers. Format per file: "NAME<TAB>BYTES\n" then the raw gz bytes. Read-only on the source files.
// Usage: node kite-bundle.mjs 2026   (or no argument = every finished year that has no bundle yet)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'kite')
// only years the downloader has marked finished (progress.log 'YEAR x finished'), so a half-downloaded year is never bundled
const finished = new Set([...(fs.existsSync(path.join(root, 'progress.log')) ? fs.readFileSync(path.join(root, 'progress.log'), 'utf8') : '').matchAll(/YEAR (\d{4}) finished/g)].map((m) => m[1]))
const years = process.argv[2] ? [process.argv[2]] : [...finished].filter((y) => !fs.existsSync(path.join(root, `bundle-${y}-2.bin`)))
for (const y of years) {
  const dir = path.join(root, 'minute', y); if (!fs.existsSync(dir)) continue
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv.gz')).sort()
  const half = Math.ceil(files.length / 2)
  for (const [part, list] of [[1, files.slice(0, half)], [2, files.slice(half)]]) {
    const out = path.join(root, `bundle-${y}-${part}.bin`), fd = fs.openSync(out + '.part', 'w')
    for (const f of list) { const b = fs.readFileSync(path.join(dir, f)); fs.writeSync(fd, `${f.replace('.csv.gz', '')}\t${b.length}\n`); fs.writeSync(fd, b) }
    fs.closeSync(fd); fs.renameSync(out + '.part', out)
    console.log(`bundle ${y} part ${part}: ${list.length} files -> ${out}`)
  }
}
