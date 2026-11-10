// news-compact.mjs - pack all downloaded NSE company news into ONE small file for Claude's direction study (RECORD ONLY).
// Output: data\history-news\news-compact.csv  kind,date,time,symbol,text   (text cut to 160 chars, commas removed)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'history-news')
const clean = (x) => String(x ?? '').replace(/[\r\n,"]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
const pick = (o, ks) => { for (const k of ks) if (o[k] != null && o[k] !== '') return o[k]; return '' }
const out = ['kind,date,time,symbol,text']; const counts = {}; const keysSeen = {}
for (const kind of ['announcements', 'board', 'results', 'actions', 'bulk', 'block']) {
  const dir = path.join(root, kind); if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { continue }
    const arr = Array.isArray(j) ? j : (j.data ?? j.rows ?? [])
    for (const o of arr) {
      if (!keysSeen[kind]) keysSeen[kind] = Object.keys(o).slice(0, 25)
      const sym = pick(o, ['symbol', 'bm_symbol', 'sm_symbol', 'BD_SYMBOL', 'bdSymbol'])
      const dt = String(pick(o, ['an_dt', 'sort_date', 'bm_date', 'exDate', 'ex_dt', 'filingDate', 'broadcastDate', 'BD_DT_DATE', 'date', 're_broadcastDt', 'creation_Date']))
      const txt = pick(o, ['desc', 'subject', 'bm_purpose', 'purpose', 'attchmntText', 'sm_name', 'BD_BUY_SELL', 'buySell', 'relatingTo'])
      const extra = kind === 'bulk' || kind === 'block' ? ' ' + clean(pick(o, ['BD_CLIENT_NAME', 'clientName'])) + ' qty ' + clean(pick(o, ['BD_QTY_TRD', 'qty'])) + ' @ ' + clean(pick(o, ['BD_TP_WATP', 'watp'])) : ''
      out.push([kind, clean(dt.slice(0, 11)), clean(dt.slice(12, 20)), clean(sym), clean(txt) + extra].join(','))
      counts[kind] = (counts[kind] ?? 0) + 1
    }
  }
}
// ban list: one file per day, symbols listed
const bdir = path.join(root, 'secban')
if (fs.existsSync(bdir)) for (const f of fs.readdirSync(bdir).filter((x) => x.endsWith('.csv'))) {
  for (const line of fs.readFileSync(path.join(bdir, f), 'utf8').split(/\r?\n/).slice(1)) { const s = line.split(',').map((x) => x.trim()).filter(Boolean).pop(); if (s && /^[A-Z0-9&-]+$/.test(s)) { out.push(['secban', f.slice(0, 10), '', s, 'F&O ban'].join(',')); counts.secban = (counts.secban ?? 0) + 1 } }
}
fs.writeFileSync(path.join(root, 'news-compact.csv'), out.join('\n') + '\n')
fs.writeFileSync(path.join(root, 'news-keys.json'), JSON.stringify(keysSeen, null, 1))
console.log('packed', JSON.stringify(counts))
