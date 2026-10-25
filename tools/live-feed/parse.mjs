// parse.mjs - reads one message from Sharekhan's live stream and pulls out prices.
//
// IMPORTANT - READ THIS:
// Sharekhan's public code samples show how to CONNECT and SUBSCRIBE, but they do
// NOT show what a price message looks like (their own parser is an empty stub).
// So this parser is a careful GUESS that understands common JSON layouts.
// The first live run saves the raw messages to raw_ticks.log. If the guess is
// wrong, that file tells us the real layout and we fix this one file.
//
// Returns a list of { exchange, code, price, volume?, cumulativeVolume? }.

const ID_FIELDS = ['scripCode', 'scripcode', 'scrip_code', 'token', 'tk', 'instrumentToken', 'exchangeToken', 'symbolToken', 'key', 'k', 'id']
const PRICE_FIELDS = ['ltp', 'LTP', 'ltP', 'lastPrice', 'last_price', 'lastTradedPrice', 'lp', 'tradePrice', 'price']
// VERIFIED on real Sharekhan ticks 2026-10-07: `qty` is the day's running total volume (never decreases);
// `ltq` is only the last single trade, so summing it undercounts volume ~50x.
const CUMULATIVE_VOLUME_FIELDS = ['qty', 'volume', 'vol', 'totalVolume', 'totalTradedVolume', 'tradedVolume', 'totalQty', 'totalTradedQty', 'v']
const TICK_VOLUME_FIELDS = ['ltq', 'lastQty', 'lastTradedQty', 'lastTradeQty', 'lastTradedQuantity']

const KEY_RE = /^(NC|BC|NF|BF|MX|RN|NX)?(\d{1,9})$/i

function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

function firstNumber(obj, fields) {
  for (const f of fields) {
    if (f in obj) {
      const n = num(obj[f])
      if (Number.isFinite(n)) return n
    }
  }
  return NaN
}

function parseId(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const m = String(v).trim().match(KEY_RE)
  if (!m) return null
  return { exchange: m[1] ? m[1].toUpperCase() : null, code: Number(m[2]) }
}

function walk(node, out, depth) {
  if (depth > 5 || node === null || typeof node !== 'object') return

  if (Array.isArray(node)) {
    for (const item of node) walk(item, out, depth + 1)
    return
  }

  // Layout A: this object itself describes one stock (has an id and a price).
  let id = null
  for (const f of ID_FIELDS) {
    if (f in node) {
      id = parseId(node[f])
      if (id) break
    }
  }
  const price = firstNumber(node, PRICE_FIELDS)
  if (id && price > 0) {
    const tick = { exchange: id.exchange, code: id.code, price }
    const cum = firstNumber(node, CUMULATIVE_VOLUME_FIELDS)
    const per = firstNumber(node, TICK_VOLUME_FIELDS)
    if (Number.isFinite(cum)) tick.cumulativeVolume = cum
    else if (Number.isFinite(per)) tick.volume = per
    addBook(tick, node)
    out.push(tick)
    return
  }

  // Layout B: a map keyed by stock id, e.g. { "NC2885": { ltp: 1234.5 } } or { "NC2885": 1234.5 }.
  let consumed = false
  for (const [k, v] of Object.entries(node)) {
    const keyId = /^(NC|BC|NF|BF|MX|RN|NX)\d{1,9}$/i.test(k) ? parseId(k) : null
    if (!keyId) continue
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const p = firstNumber(v, PRICE_FIELDS)
      if (p > 0) {
        const tick = { exchange: keyId.exchange, code: keyId.code, price: p }
        const cum = firstNumber(v, CUMULATIVE_VOLUME_FIELDS)
        const per = firstNumber(v, TICK_VOLUME_FIELDS)
        if (Number.isFinite(cum)) tick.cumulativeVolume = cum
        else if (Number.isFinite(per)) tick.volume = per
        out.push(tick)
        consumed = true
      }
    } else {
      const p = num(v)
      if (p > 0) { out.push({ exchange: keyId.exchange, code: keyId.code, price: p }); consumed = true }
    }
  }
  if (consumed) return

  // Otherwise keep looking inside nested values (e.g. { data: [...] }).
  for (const v of Object.values(node)) walk(v, out, depth + 1)
}

// Order-book summary that Sharekhan sends with every price (verified on real ticks 7 Oct):
// best bid / offer price and quantity, and the total quantity waiting to buy / sell.
const BOOK_FIELDS = { bid: 'bidPrice', bidQty: 'bidQty', ask: 'offPrice', askQty: 'offQty', totBuy: 'totalBuyQty', totSell: 'totalSellQty',
  // 25 Oct (expert audit): circuit limits and yesterday's close, sent by Sharekhan with every price but not read before
  upCkt: 'upperCkt', loCkt: 'lowerCkt', prevClose: 'close' }
function addBook(tick, node) {
  for (const [k, f] of Object.entries(BOOK_FIELDS)) {
    if (f in node) { const n = num(node[f]); if (Number.isFinite(n) && n >= 0) tick[k] = n }
  }
}

// text: the message as a string. Returns [] if it is not JSON or holds no prices.
export function extractTicks(text) {
  if (typeof text !== 'string') return []
  const t = text.trim()
  if (!t || (t[0] !== '{' && t[0] !== '[')) return []
  let json
  try { json = JSON.parse(t) } catch { return [] }
  const out = []
  walk(json, out, 0)
  return out
}
