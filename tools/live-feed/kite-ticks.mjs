// kite-ticks.mjs - Zerodha (Kite Connect) live prices for the feed (12 Nov 2026, owner: "now all things on zerodha", Sharekhan = backup).
// The feed uses this when a Zerodha login for TODAY exists on this laptop (data\kite-token.json, made by kite-login.bat each morning).
// Nothing here trades or places orders: it only READS prices. Keys stay in .env / data\kite-token.json and are never printed.
import fs from 'node:fs'
import path from 'node:path'

// Kite index names -> our names (same as kite-history.mjs, plus the extra indices of record-extra.csv where Kite has them)
export const KITE_IDX = { 'NIFTY 50': 'NIFTY', 'NIFTY BANK': 'NIFTYBANK', 'NIFTY IT': 'NIFTYIT', 'NIFTY FMCG': 'NIFTYFMCG', 'NIFTY PHARMA': 'NIFTYPHARMA',
  'NIFTY AUTO': 'NIFTYAUTO', 'NIFTY METAL': 'NIFTYMETAL', 'NIFTY ENERGY': 'NIFTYENERGY', 'NIFTY REALTY': 'NIFTYREALTY', 'NIFTY PSU BANK': 'NIFTYPSUBANK',
  'NIFTY PVT BANK': 'NIFTYPVTBANK', 'NIFTY FIN SERVICE': 'NIFTYFINSERV', 'NIFTY INFRA': 'NIFTYINFRA', 'NIFTY MEDIA': 'NIFTYMEDIA', 'NIFTY 500': 'NIFTY500',
  'INDIA VIX': 'INDIAVIX', 'NIFTY MIDCAP 150': 'NIFTYMIDCAP150', 'NIFTY SMLCAP 250': 'NIFTYSMALLCAP250', 'NIFTY CONSUMPTION': 'NIFTYCONSUMPTION',
  'NIFTY OIL AND GAS': 'NIFTYOILGAS', 'NIFTY HEALTHCARE': 'NIFTYHEALTHCARE', 'NIFTY CONSR DURBL': 'NIFTYCONSDURABLE' }

const istDay = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10)

// Today's Zerodha login, or null. A Kite token is valid from the login until about 06:00 IST the next morning.
export function kiteLogin(here, now = Date.now()) {
  try {
    const key = process.env.KITE_API_KEY; if (!key) return null
    const j = JSON.parse(fs.readFileSync(process.env.KITE_TOKEN_FILE || path.join(here, 'data', 'kite-token.json'), 'utf8')) // KITE_TOKEN_FILE: tests only
    const saved = Date.parse(j.saved); if (!j.access_token || !Number.isFinite(saved)) return null
    const sixToday = Date.parse(`${istDay(now)}T06:00:00+05:30`)
    const validFrom = now >= sixToday ? sixToday : sixToday - 24 * 3600_000 // before 06:00 yesterday's login still works
    return saved >= validFrom ? { key, token: j.access_token } : null
  } catch { return null }
}

const csvSplit = (l) => { const o = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = '' } else cur += ch } o.push(cur); return o }

// instrument_token -> our symbol, for the wanted stock names (NSE EQ) and the indices. One download per day (cached in data\kite-instruments-DAY.csv).
export async function kiteInstruments(here, login, wanted, { apiBase = 'https://api.kite.trade', now = Date.now() } = {}) {
  const file = path.join(process.env.RECORD_DIR || path.join(here, 'data'), `kite-instruments-${istDay(now)}.csv`)
  let text = null
  try { text = fs.readFileSync(file, 'utf8') } catch { /* not cached yet */ }
  if (!text || text.length < 10_000) {
    const r = await fetch(`${apiBase}/instruments/NSE`, { headers: { 'X-Kite-Version': '3', Authorization: `token ${login.key}:${login.token}` }, signal: AbortSignal.timeout(60_000) })
    if (r.status === 403) { const e = new Error('Zerodha refused the login (403)'); e.kite403 = true; throw e }
    if (!r.ok) throw new Error(`Zerodha instruments list: HTTP ${r.status}`)
    text = await r.text()
    try { fs.writeFileSync(file, text) } catch { /* cache only */ }
  }
  const lines = text.split('\n'), head = csvSplit(lines[0].trim()), ix = (n) => head.indexOf(n)
  const iTs = ix('tradingsymbol'), iSeg = ix('segment'), iType = ix('instrument_type'), iTok = ix('instrument_token')
  const map = new Map()
  for (const l of lines.slice(1)) {
    const p = csvSplit(l.trim()); if (p.length < 5) continue
    const ts = p[iTs]?.replace(/"/g, ''), tok = Number(p[iTok]); if (!(tok > 0)) continue
    if (p[iSeg] === 'INDICES' && KITE_IDX[ts] && wanted.has(KITE_IDX[ts])) map.set(tok, KITE_IDX[ts])
    else if (p[iSeg] === 'NSE' && p[iType] === 'EQ' && wanted.has(ts)) map.set(tok, ts)
  }
  return map
}

// One binary websocket message -> ticks in the feed's own shape (same field names the Sharekhan reader produces).
// Kite layout (big-endian int32, prices in paise): [int16 count] then per packet [int16 length][packet].
//   8 bytes  = last price only | 28/32 = index (ltp, high, low, open, close, change[, time]) | 44 = quote | 184 = full (quote + 5 bids + 5 offers)
export function parseKiteBinary(buf) {
  const out = []
  if (!buf || buf.length < 4) return out // 1-byte heartbeat
  const n = buf.readInt16BE(0); let o = 2
  for (let k = 0; k < n && o + 2 <= buf.length; k++) {
    const len = buf.readInt16BE(o); o += 2
    if (len < 8 || o + len > buf.length) break
    const p = buf.subarray(o, o + len); o += len
    const token = p.readInt32BE(0), t = { token, price: p.readInt32BE(4) / 100 }
    if (!(t.price > 0)) continue
    const index = (token & 0xff) === 9
    if (index) {
      if (len >= 28) t.prevClose = p.readInt32BE(20) / 100
      // 14 Nov (owner rule 0r: take ALL Zerodha data): every index field -> t.kf (recorded in kite-full-DAY.csv.gz)
      if (len >= 28) t.kf = { kind: 'I', high: p.readInt32BE(8) / 100, low: p.readInt32BE(12) / 100, open: p.readInt32BE(16) / 100, close: p.readInt32BE(20) / 100, change: p.readInt32BE(24) / 100, exTs: len >= 32 ? p.readInt32BE(28) : '' }
    } else if (len >= 44) {
      // 14 Nov (rule 0r): every quote/full field -> t.kf. Full packet: +LTT, OI, OI day high/low, exchange time, 5 bids + 5 offers (qty, price, orders)
      const kf = { kind: len >= 184 ? 'F' : 'Q', ltq: p.readInt32BE(8), atp: p.readInt32BE(12) / 100, vol: p.readInt32BE(16), tb: p.readInt32BE(20), ts: p.readInt32BE(24),
        open: p.readInt32BE(28) / 100, high: p.readInt32BE(32) / 100, low: p.readInt32BE(36) / 100, close: p.readInt32BE(40) / 100 }
      if (len >= 64) { kf.ltt = p.readInt32BE(44); kf.oi = p.readInt32BE(48); kf.oiH = p.readInt32BE(52); kf.oiL = p.readInt32BE(56); kf.exTs = p.readInt32BE(60) }
      if (len >= 184) { kf.depth = []; for (let d = 0; d < 10; d++) { const q = 64 + d * 12; kf.depth.push([p.readInt32BE(q), p.readInt32BE(q + 4) / 100, p.readInt16BE(q + 8)]) } }
      t.kf = kf
      t.cumulativeVolume = p.readInt32BE(16); t.totBuy = p.readInt32BE(20); t.totSell = p.readInt32BE(24); t.prevClose = p.readInt32BE(40) / 100
      if (len >= 184) {
        const bq = p.readInt32BE(64), bp = p.readInt32BE(68) / 100, aq = p.readInt32BE(124), ap = p.readInt32BE(128) / 100
        if (bp > 0) { t.bid = bp; t.bidQty = bq }
        if (ap > 0) { t.ask = ap; t.askQty = aq }
      }
    }
    out.push(t)
  }
  return out
}
