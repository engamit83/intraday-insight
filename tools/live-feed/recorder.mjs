// recorder.mjs - keeps our OWN history on this laptop (added 16 Oct), so we are not limited to the
// ~6 days of past candles Sharekhan gives. Two files per day in the "data" folder next to this program:
//   candles-YYYY-MM-DD.csv  every 1-minute candle of the day (rewritten every 5 minutes, so it is never lost)
//   book-YYYY-MM-DD.csv     once a minute per stock: price, best bid/offer and their sizes, total buy/sell
//                           quantity waiting (tells us whether buyers or sellers are stronger)
// Recording problems are reported but can never stop the feed.

import fs from 'node:fs'
import path from 'node:path'
import { IST_OFFSET_MS } from './candles.mjs'

const istDay = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10)
const istTime = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(11, 19)

export class DayRecorder {
  constructor(dir) {
    this.dir = dir
    this.book = new Map() // symbol -> latest { ts, price, cumVol, bid, bidQty, ask, askQty, totBuy, totSell }
    this.errors = 0
  }

  onTick(symbol, t, ts) {
    if (!symbol || !(t.price > 0)) return
    const prev = this.book.get(symbol) ?? {}
    this.book.set(symbol, {
      ts, price: t.price,
      cumVol: t.cumulativeVolume ?? prev.cumVol ?? '',
      bid: t.bid ?? prev.bid ?? '', bidQty: t.bidQty ?? prev.bidQty ?? '',
      ask: t.ask ?? prev.ask ?? '', askQty: t.askQty ?? prev.askQty ?? '',
      totBuy: t.totBuy ?? prev.totBuy ?? '', totSell: t.totSell ?? prev.totSell ?? '',
    })
  }

  // one line per stock with the latest snapshot; returns the number of lines written
  writeBook(nowMs) {
    if (this.book.size === 0) return 0
    try {
      fs.mkdirSync(this.dir, { recursive: true })
      const file = path.join(this.dir, `book-${istDay(nowMs)}.csv`)
      const header = fs.existsSync(file) ? '' : 'time,symbol,price,day_volume,bid,bid_qty,offer,offer_qty,total_buy_qty,total_sell_qty\n'
      const t = istTime(nowMs)
      const lines = [...this.book.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([s, b]) => [t, s, b.price, b.cumVol, b.bid, b.bidQty, b.ask, b.askQty, b.totBuy, b.totSell].join(','))
      fs.appendFileSync(file, header + lines.join('\n') + '\n')
      return lines.length
    } catch (e) { this.errors++; return 0 }
  }

  // rewrite today's 1-minute candle file from the candle builder; returns the number of candles written
  writeCandles(builder, nowMs) {
    try {
      const day = istDay(nowMs)
      const rows = []
      for (const [symbol, byStart] of builder.minutes) {
        for (const [start, c] of byStart) {
          if (istDay(start) !== day) continue
          rows.push([istTime(start).slice(0, 5), symbol, c.open, c.high, c.low, c.close, Math.round(c.volume), c.ticks])
        }
      }
      if (rows.length === 0) return 0
      rows.sort((a, b) => (a[1] + a[0]).localeCompare(b[1] + b[0]))
      fs.mkdirSync(this.dir, { recursive: true })
      const file = path.join(this.dir, `candles-${day}.csv`)
      fs.writeFileSync(file + '.tmp', 'time,symbol,open,high,low,close,volume,ticks\n' + rows.map((r) => r.join(',')).join('\n') + '\n')
      fs.renameSync(file + '.tmp', file)
      return rows.length
    } catch (e) { this.errors++; return 0 }
  }
}
