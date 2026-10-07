// backtest.mjs - replays past candles (5-, 15-, 30- or 60-minute) through the SAME scout rules
// (supabase/functions/_shared/indicators.ts + scoring.ts) and simulates the trades
// a person would take from the Signals page, with Indian intraday costs.
//
// Run with:  node --experimental-strip-types tools/backtest/run.mjs <history.json>
//
// What is simulated (baseline = how the live scout behaves today):
//  - Decisions after each 5-minute candle closes. Indicators use earlier days + today's
//    candles up to that point (never future candles).
//  - Score x time-of-day multiplier (market multiplier 1.0, as live: market-conditions is
//    not scheduled), direction rule, minimum final score 60, rank by uncapped score, top 10.
//  - A signal is taken at the NEXT candle's open (+ slippage). Stoploss and target are the
//    levels the Signals page would show. If one candle touches both, the STOP is assumed
//    to come first (conservative). Positions still open are squared off at 15:15.
//  - At most `maxOpen` positions at once, one per stock, `cooldownMin` before re-entering.
// Known gaps: no bid/offer spread history (slippage is an estimate); the live scout also
// reads the still-forming candle every minute, the back-test only uses closed candles.

import { computeIndicators } from '../../supabase/functions/_shared/indicators.ts'
import {
  calculateRawScore, calculateScoreUncapped, decideDirection, getTimeMultiplier,
} from '../../supabase/functions/_shared/scoring.ts'

export const DEFAULTS = {
  minScore: 60,
  maxOpen: 10,
  cooldownMin: 30,
  historyWindow: 300,      // earlier candles kept for indicators (EMA/Wilder converge well before this)
  minHistory: 40,          // skip a stock-day without this many earlier candles
  lastEntry: '15:10',      // no new entries at or after this candle start
  squareOff: '15:15',      // exit everything at the open of this candle (= close of 15:10 candle)
  noEntryBefore: null,     // e.g. '09:30' (switch)
  noEntryAfter: null,      // e.g. '14:45' (switch)
  marketFilter: false,     // switch: BUY only if the average stock is up on the day, SELL only if down
  prevCloseFilter: false,  // switch: BUY only above yesterday's close, SELL only below
  topN: null,              // switch: open at most N new positions per decision (null = up to maxOpen)
  maxTradesPerDay: null,   // switch: stop opening new positions after N entries in a day
  onePerStockPerDay: false,// switch: each stock traded at most once a day
  relStrength: false,      // switch: BUY only if the stock is up MORE than the average stock today, SELL only if down more
  minRelVolume: null,      // switch: require relative volume >= this (e.g. 1.2) [last 2 candles vs previous 20 - biased by time of day]
  // Time-of-day volume (fairer: compares with the SAME time slot on earlier days, because volume is
  // always high at the open/close and low at midday). Needs >= volDays earlier days with that slot.
  volDays: 5,              // how many earlier days to average
  todRvolMin: null,        // switch: the candle that just closed traded >= X times its usual volume for that time slot
  dayRvolMin: null,        // switch: today's volume SO FAR >= X times the usual volume by this time of day
  volRising: false,        // switch: participation rising: the last candle's slot-relative volume > the one before
  volRankWeight: null,     // switch: no filtering; rank higher-volume stocks first: rank x (1 + w x (min(dayRvol,3) - 1))
  dailyTrendDays: null,    // switch: BUY only if yesterday's close is above its N-day average of daily closes, SELL below
  maxGapPct: null,         // switch: skip a stock for the day if it opened more than X% away from yesterday's close
  openingRangeMin: null,   // switch: no entries until the first N minutes are over; BUY only above that range's high, SELL only below its low
  prevDayLevels: false,    // switch: BUY only above yesterday's high, SELL only below yesterday's low
  breakevenAtR: null,      // switch: once the trade gains R x the stop distance, move the stop to the entry price
  timeStopMin: null,
  timeStopLosersOnly: false, // with timeStopMin: only exit trades that are not in profit at that time
  aboveDayOpen: false,     // switch: BUY only above today's opening price, SELL only below (intraday strength / gap held)
  levelsEither: false,     // with openingRangeMin + prevDayLevels: accept a break of EITHER level instead of requiring both       // switch: exit at the candle close if neither stop nor target is hit within N minutes
  dailyLossLimitRs: null,  // switch: no new entries once the day's closed trades lost this many rupees (e.g. 5000)
  stopAtrMult: 1.5,        // live: STOP_ATR_MULT
  minStopPct: 0.25,        // live: MIN_STOP_PCT
  rewardRisk: 1.5,         // live: REWARD_RISK
  slippagePct: 0.02,       // per side, on market fills (entry, stop, square-off)
  notional: 100000,        // rupees per trade (only for the rupee figures)
  costs: {
    brokeragePct: 0.03,    // per side; CHECK your Sharekhan plan (sources quote 0.02%-0.10% intraday)
    sttSellPct: 0.025,
    exchangePct: 0.00307,
    sebiPct: 0.0001,
    stampBuyPct: 0.003,
    gstPct: 18,
  },
}

// ---------- time helpers (timestamps carry +05:30, so slices are IST) ----------
const dayOf = (ts) => ts.slice(0, 10)
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const fromMin = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const OPEN_MIN = 9 * 60 + 15
// Candle start, counted from the 09:15 open in steps of the candle size. Works whether the
// timestamp is the candle start or the last trade inside it (Sharekhan REST uses the latter).
function bucketOf(ts, step) {
  const m = Number(ts.slice(11, 13)) * 60 + Number(ts.slice(14, 16))
  return fromMin(OPEN_MIN + Math.floor((m - OPEN_MIN) / step) * step)
}
export const STEP_MINUTES = { '1minute': 1, '3minute': 3, '5minute': 5, '15minute': 15, '30minute': 30, '60minute': 60 }
const istDate = (day, hhmm) => new Date(`${day}T${hhmm}:00+05:30`)

// Round-trip cost as a percent of the trade value.
export function roundTripCostPct(c) {
  const brokerage = 2 * c.brokeragePct
  const exchange = 2 * c.exchangePct
  const sebi = 2 * c.sebiPct
  const gst = (brokerage + exchange + sebi) * (c.gstPct / 100)
  return brokerage + exchange + sebi + gst + c.sttSellPct + c.stampBuyPct
}

// data: { results: { SYMBOL: { candles: [[iso, o, h, l, c, v], ...] } } }
export function prepare(data) {
  const step = STEP_MINUTES[data.interval ?? '5minute']
  if (!step) throw new Error(`unsupported interval ${data.interval}`)
  const lastStart = fromMin(OPEN_MIN + Math.floor((15 * 60 + 30 - 1 - OPEN_MIN) / step) * step)
  const stocks = {}
  let collisions = 0
  for (const [symbol, v] of Object.entries(data.results ?? {})) {
    if (!v || !Array.isArray(v.candles)) continue
    const rows = v.candles
      .map((r) => ({ timestamp: String(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] || 0 }))
      .filter((c) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(c.timestamp) && c.close > 0 && c.high >= c.low)
      .map((c) => ({ ...c, day: dayOf(c.timestamp), bucket: bucketOf(c.timestamp, step) }))
      .filter((c) => c.bucket >= '09:15' && c.bucket <= lastStart)
      .sort((a, b) => (a.day + a.bucket).localeCompare(b.day + b.bucket))
    // de-duplicate by day+bucket (keep the last)
    const seen = new Map()
    for (const c of rows) { if (seen.has(c.day + c.bucket)) collisions++; seen.set(c.day + c.bucket, c) }
    stocks[symbol] = [...seen.values()]
  }
  const days = [...new Set(Object.values(stocks).flatMap((s) => s.map((c) => c.day)))].sort()
  return { stocks, days, step, lastStart, collisions }
}

function levelsFor(direction, close, atr, o) {
  const stopDist = Math.max(atr * o.stopAtrMult, close * (o.minStopPct / 100))
  const tgt = stopDist * o.rewardRisk
  return direction === 'BUY'
    ? { stop: close - stopDist, target: close + tgt }
    : { stop: close + stopDist, target: close - tgt }
}

export function runBacktest(data, options = {}) {
  const o = { ...DEFAULTS, ...options, costs: { ...DEFAULTS.costs, ...(options.costs ?? {}) } }
  const { stocks, days, step, lastStart, collisions } = prepare(data)
  const symbols = Object.keys(stocks)
  const costPct = roundTripCostPct(o.costs)
  const trades = []
  const skippedDays = []

  // index: symbol -> day -> { idxFirst, candles of that day } ; and global index for history slicing
  const byDay = {}
  for (const s of symbols) {
    byDay[s] = {}
    stocks[s].forEach((c, i) => {
      if (!byDay[s][c.day]) byDay[s][c.day] = { first: i, list: [] }
      byDay[s][c.day].list.push(c)
    })
  }

  // daily bars per stock (from the intraday candles) for the daily-trend and previous-day rules
  const daily = {}
  for (const s of symbols) {
    daily[s] = {}
    for (const [d, v] of Object.entries(byDay[s])) {
      daily[s][d] = { high: Math.max(...v.list.map((c) => c.high)), low: Math.min(...v.list.map((c) => c.low)), close: v.list[v.list.length - 1].close }
    }
  }
  const dayIndex = new Map(days.map((d, i) => [d, i]))

  // volume by time slot per stock: vol[s][day][bucket] and cumulative-by-slot cum[s][day][bucket]
  const vol = {}, cum = {}
  for (const s of symbols) {
    vol[s] = {}; cum[s] = {}
    for (const [d, v] of Object.entries(byDay[s])) {
      vol[s][d] = {}; cum[s][d] = {}
      let run = 0
      for (const c of v.list) { vol[s][d][c.bucket] = c.volume; run += c.volume; cum[s][d][c.bucket] = run }
    }
  }
  // average over the previous volDays days that have this slot; null if fewer than 2 such days
  function slotAvg(table, s, day, bucket) {
    const prior = days.slice(0, dayIndex.get(day)).reverse()
    const vals = []
    for (const d of prior) { const x = table[s][d]?.[bucket]; if (x !== undefined) vals.push(x); if (vals.length >= o.volDays) break }
    return vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  function volStats(s, day, bucket, prevBucket) {
    const a = slotAvg(vol, s, day, bucket), ac = slotAvg(cum, s, day, bucket)
    const tod = a ? vol[s][day][bucket] / a : null
    const dayR = ac ? cum[s][day][bucket] / ac : null
    let prevTod = null
    if (prevBucket && vol[s][day][prevBucket] !== undefined) { const ap = slotAvg(vol, s, day, prevBucket); prevTod = ap ? vol[s][day][prevBucket] / ap : null }
    return { tod, dayR, prevTod }
  }

  for (const day of days) {
    const open = new Map()       // symbol -> position
    const cooldownUntil = new Map()
    const tradedToday = new Set()
    let entriesToday = 0
    const dayStartTrades = trades.length
    let anyTradable = false

    // per-stock day data
    const ctx = {}
    for (const s of symbols) {
      const d = byDay[s][day]
      if (!d || d.first < o.minHistory) continue
      const prevDayCandle = stocks[s][d.first - 1]
      ctx[s] = {
        list: d.list,
        byBucket: new Map(d.list.map((c, j) => [c.bucket, j])),
        first: d.first,
        dayOpen: d.list[0].open,
        prevClose: prevDayCandle ? prevDayCandle.close : null,
        prevDay: prevDayCandle ? daily[s][prevDayCandle.day] : null,
        trendAvg: null,
      }
      if (o.dailyTrendDays) {
        const past = days.slice(0, dayIndex.get(day)).map((d) => daily[s][d]?.close).filter((x) => x !== undefined)
        if (past.length >= o.dailyTrendDays) ctx[s].trendAvg = past.slice(-o.dailyTrendDays).reduce((a, b) => a + b, 0) / o.dailyTrendDays
      }
      if (o.maxGapPct !== null && ctx[s].prevClose && Math.abs(ctx[s].dayOpen / ctx[s].prevClose - 1) * 100 > o.maxGapPct) { delete ctx[s]; continue }
      if (o.openingRangeMin) {
        const orEnd = fromMin(OPEN_MIN + o.openingRangeMin)
        const orC = d.list.filter((c) => c.bucket < orEnd)
        ctx[s].orEnd = orEnd
        ctx[s].orHigh = Math.max(...orC.map((c) => c.high))
        ctx[s].orLow = Math.min(...orC.map((c) => c.low))
      }
      anyTradable = true
    }
    if (!anyTradable) { skippedDays.push(day); continue }

    for (let t = OPEN_MIN; t <= toMin(lastStart); t += step) {
      const bucket = fromMin(t)
      // 1) manage open positions on this candle
      for (const [s, p] of open) {
        const j = ctx[s].byBucket.get(bucket)
        if (j === undefined) continue
        const c = ctx[s].list[j]
        if (bucket >= o.squareOff) {
          close(p, c.open, 'squareoff', bucket, true)
          open.delete(s); cooldownUntil.set(s, t + o.cooldownMin)
          continue
        }
        const hitStop = p.direction === 'BUY' ? c.low <= p.stop : c.high >= p.stop
        const hitTarget = p.direction === 'BUY' ? c.high >= p.target : c.low <= p.target
        if (hitStop) {
          // gap through the stop fills at the open
          const px = p.direction === 'BUY' ? Math.min(c.open, p.stop) : Math.max(c.open, p.stop)
          close(p, px, p.atBreakeven ? 'breakeven' : 'stop', bucket, true)
        } else if (hitTarget) {
          close(p, p.target, 'target', bucket, false)
        } else if (o.timeStopMin && t + step - toMin(p.entryTime) >= o.timeStopMin &&
          (!o.timeStopLosersOnly || (p.direction === 'BUY' ? c.close <= p.entry : c.close >= p.entry))) {
          close(p, c.close, 'timestop', bucket, true)
        } else {
          if (o.breakevenAtR && !p.atBreakeven) {
            const gain = p.direction === 'BUY' ? c.high - p.entry : p.entry - c.low
            if (gain >= o.breakevenAtR * p.stopDist) { p.stop = p.entry; p.atBreakeven = true }
          }
          continue
        }
        open.delete(s); cooldownUntil.set(s, t + step + o.cooldownMin)
      }

      // 2) decide after this candle closes; entry at the next candle's open
      const nextBucket = fromMin(t + step)
      if (nextBucket >= o.lastEntry) continue
      if (o.noEntryBefore && nextBucket < o.noEntryBefore) continue
      if (o.noEntryAfter && nextBucket > o.noEntryAfter) continue

      // market breadth: average % change from the day's open, over stocks with this candle
      let breadth = 0, nb = 0
      if (o.marketFilter || o.relStrength) {
        for (const s of Object.keys(ctx)) {
          const j = ctx[s].byBucket.get(bucket)
          if (j === undefined) continue
          breadth += (ctx[s].list[j].close / ctx[s].dayOpen - 1) * 100; nb++
        }
        breadth = nb ? breadth / nb : 0
      }

      const timeMult = getTimeMultiplier(istDate(day, nextBucket))
      if (timeMult <= 0) continue
      const candidates = []
      for (const s of Object.keys(ctx)) {
        if (open.has(s) || (cooldownUntil.get(s) ?? -1) > t + step) continue
        if (o.onePerStockPerDay && tradedToday.has(s)) continue
        const j = ctx[s].byBucket.get(bucket)
        if (j === undefined) continue
        const nextJ = ctx[s].byBucket.get(nextBucket)
        if (nextJ === undefined) continue
        const gi = ctx[s].first + j // global index of the candle that just closed
        const start = Math.max(0, gi + 1 - (o.historyWindow + j + 1))
        const series = stocks[s].slice(start, gi + 1)
        const ind = computeIndicators(series)
        const dir = decideDirection(ind)
        if (!dir.direction || ind.atr === null || ind.lastClose === null) continue
        const finalScore = Math.round(calculateRawScore(ind) * timeMult)
        if (finalScore < o.minScore) continue
        if (o.marketFilter && ((dir.direction === 'BUY' && breadth <= 0) || (dir.direction === 'SELL' && breadth >= 0))) continue
        if (o.minRelVolume !== null && !(ind.relativeVolume !== null && ind.relativeVolume >= o.minRelVolume)) continue
        if (o.relStrength) {
          const chg = (ind.lastClose / ctx[s].dayOpen - 1) * 100
          if ((dir.direction === 'BUY' && chg <= breadth) || (dir.direction === 'SELL' && chg >= breadth)) continue
        }
        const B = dir.direction === 'BUY'
        if (o.dailyTrendDays && ctx[s].trendAvg !== null && ctx[s].prevClose !== null &&
          (B ? ctx[s].prevClose <= ctx[s].trendAvg : ctx[s].prevClose >= ctx[s].trendAvg)) continue
        if (o.aboveDayOpen && (B ? ind.lastClose <= ctx[s].dayOpen : ind.lastClose >= ctx[s].dayOpen)) continue
        const beyondOR = o.openingRangeMin ? nextBucket >= ctx[s].orEnd && (B ? ind.lastClose > ctx[s].orHigh : ind.lastClose < ctx[s].orLow) : true
        const beyondPrev = o.prevDayLevels && ctx[s].prevDay ? (B ? ind.lastClose > ctx[s].prevDay.high : ind.lastClose < ctx[s].prevDay.low) : true
        if (o.levelsEither && o.openingRangeMin && o.prevDayLevels) {
          if (!((nextBucket >= ctx[s].orEnd && beyondOR) || (ctx[s].prevDay && beyondPrev))) continue
        } else {
          if (!beyondOR || !beyondPrev) continue
        }
        const pc = ctx[s].prevClose
        if (o.prevCloseFilter && pc && ((dir.direction === 'BUY' && ind.lastClose <= pc) || (dir.direction === 'SELL' && ind.lastClose >= pc))) continue
        let rankScore = calculateScoreUncapped(ind) * timeMult
        if (o.todRvolMin !== null || o.dayRvolMin !== null || o.volRising || o.volRankWeight !== null) {
          const vs = volStats(s, day, bucket, j > 0 ? ctx[s].list[j - 1].bucket : null)
          if (o.todRvolMin !== null && !(vs.tod !== null && vs.tod >= o.todRvolMin)) continue
          if (o.dayRvolMin !== null && !(vs.dayR !== null && vs.dayR >= o.dayRvolMin)) continue
          if (o.volRising && !(vs.tod !== null && vs.prevTod !== null && vs.tod > vs.prevTod)) continue
          if (o.volRankWeight !== null && vs.dayR !== null) rankScore *= 1 + o.volRankWeight * (Math.min(vs.dayR, 3) - 1)
        }
        candidates.push({ s, dir: dir.direction, ind, rankScore, finalScore, nextJ })
      }
      candidates.sort((a, b) => b.rankScore - a.rankScore || b.finalScore - a.finalScore)
      if (o.maxTradesPerDay !== null && entriesToday >= o.maxTradesPerDay) continue
      if (o.dailyLossLimitRs !== null) {
        const realised = trades.slice(dayStartTrades).reduce((a, x) => a + (x.netPct / 100) * o.notional, 0)
        if (realised <= -o.dailyLossLimitRs) continue
      }
      for (const cand of candidates.slice(0, o.topN ?? o.maxOpen)) {
        if (open.size >= o.maxOpen) break
        if (o.maxTradesPerDay !== null && entriesToday >= o.maxTradesPerDay) break
        entriesToday++
        tradedToday.add(cand.s)
        const lv = levelsFor(cand.dir, cand.ind.lastClose, cand.ind.atr, o)
        const nextOpen = ctx[cand.s].list[cand.nextJ].open
        const slip = nextOpen * (o.slippagePct / 100)
        const entry = cand.dir === 'BUY' ? nextOpen + slip : nextOpen - slip
        open.set(cand.s, {
          symbol: cand.s, day, direction: cand.dir, signalTime: bucket, entryTime: nextBucket,
          signalPrice: cand.ind.lastClose, entry, stop: lv.stop, target: lv.target, stopDist: Math.abs(cand.ind.lastClose - lv.stop),
          rankScore: Math.round(cand.rankScore * 10) / 10,
        })
      }
    }
    // anything still open (missing late candles): exit at that stock's last close of the day
    for (const [s, p] of open) {
      const last = ctx[s].list[ctx[s].list.length - 1]
      close(p, last.close, 'squareoff', last.bucket, true)
    }
  }

  function close(p, rawPx, reason, bucket, slipped) {
    const slip = slipped ? rawPx * (o.slippagePct / 100) : 0
    const exit = p.direction === 'BUY' ? rawPx - slip : rawPx + slip
    const grossPct = p.direction === 'BUY' ? (exit / p.entry - 1) * 100 : (1 - exit / p.entry) * 100
    trades.push({ ...p, exit, exitTime: bucket, reason, grossPct, netPct: grossPct - costPct })
  }

  return { options: o, costPct, trades, days, skippedDays, step, collisions, symbols: symbols.length, summary: summarize(trades, o) }
}

export function summarize(trades, o = DEFAULTS) {
  const n = trades.length
  const r2 = (x) => Math.round(x * 100) / 100
  const r3 = (x) => Math.round(x * 1000) / 1000
  if (n === 0) return { trades: 0 }
  const wins = trades.filter((t) => t.netPct > 0)
  const losses = trades.filter((t) => t.netPct <= 0)
  const sum = (a, f) => a.reduce((x, t) => x + f(t), 0)
  const rupees = (pct) => (pct / 100) * o.notional
  // equity curve in rupees, trade order = exit order within days
  let eq = 0, peak = 0, maxDD = 0
  const ordered = [...trades].sort((a, b) => (a.day + a.exitTime).localeCompare(b.day + b.exitTime))
  for (const t of ordered) { eq += rupees(t.netPct); peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq - peak) }
  const byDay = {}
  for (const t of trades) byDay[t.day] = (byDay[t.day] ?? 0) + rupees(t.netPct)
  const dayVals = Object.values(byDay)
  return {
    trades: n,
    winRatePct: r2((wins.length / n) * 100),
    avgWinPct: wins.length ? r3(sum(wins, (t) => t.netPct) / wins.length) : 0,
    avgLossPct: losses.length ? r3(sum(losses, (t) => t.netPct) / losses.length) : 0,
    grossExpectancyPct: r3(sum(trades, (t) => t.grossPct) / n),
    netExpectancyPct: r3(sum(trades, (t) => t.netPct) / n),
    totalNetRupees: Math.round(rupees(sum(trades, (t) => t.netPct))),
    maxDrawdownRupees: Math.round(maxDD),
    daysTraded: dayVals.length,
    greenDays: dayVals.filter((v) => v > 0).length,
    worstDayRupees: Math.round(Math.min(...dayVals)),
    bestDayRupees: Math.round(Math.max(...dayVals)),
    exits: {
      target: trades.filter((t) => t.reason === 'target').length,
      stop: trades.filter((t) => t.reason === 'stop').length,
      squareoff: trades.filter((t) => t.reason === 'squareoff').length,
      timestop: trades.filter((t) => t.reason === 'timestop').length,
      breakeven: trades.filter((t) => t.reason === 'breakeven').length,
    },
    buy: trades.filter((t) => t.direction === 'BUY').length,
    sell: trades.filter((t) => t.direction === 'SELL').length,
  }
}

export function breakdown(trades, keyFn, o = DEFAULTS) {
  const groups = {}
  for (const t of trades) (groups[keyFn(t)] ??= []).push(t)
  return Object.fromEntries(Object.entries(groups).sort().map(([k, v]) => [k, summarize(v, o)]))
}
