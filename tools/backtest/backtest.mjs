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

  for (const day of days) {
    const open = new Map()       // symbol -> position
    const cooldownUntil = new Map()
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
          close(p, px, 'stop', bucket, true)
        } else if (hitTarget) {
          close(p, p.target, 'target', bucket, false)
        } else continue
        open.delete(s); cooldownUntil.set(s, t + step + o.cooldownMin)
      }

      // 2) decide after this candle closes; entry at the next candle's open
      const nextBucket = fromMin(t + step)
      if (nextBucket >= o.lastEntry) continue
      if (o.noEntryBefore && nextBucket < o.noEntryBefore) continue
      if (o.noEntryAfter && nextBucket > o.noEntryAfter) continue

      // market breadth: average % change from the day's open, over stocks with this candle
      let breadth = 0, nb = 0
      if (o.marketFilter) {
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
        const pc = ctx[s].prevClose
        if (o.prevCloseFilter && pc && ((dir.direction === 'BUY' && ind.lastClose <= pc) || (dir.direction === 'SELL' && ind.lastClose >= pc))) continue
        const rankScore = calculateScoreUncapped(ind) * timeMult
        candidates.push({ s, dir: dir.direction, ind, rankScore, finalScore, nextJ })
      }
      candidates.sort((a, b) => b.rankScore - a.rankScore || b.finalScore - a.finalScore)
      for (const cand of candidates.slice(0, o.maxOpen)) {
        if (open.size >= o.maxOpen) break
        const lv = levelsFor(cand.dir, cand.ind.lastClose, cand.ind.atr, o)
        const nextOpen = ctx[cand.s].list[cand.nextJ].open
        const slip = nextOpen * (o.slippagePct / 100)
        const entry = cand.dir === 'BUY' ? nextOpen + slip : nextOpen - slip
        open.set(cand.s, {
          symbol: cand.s, day, direction: cand.dir, signalTime: bucket, entryTime: nextBucket,
          signalPrice: cand.ind.lastClose, entry, stop: lv.stop, target: lv.target,
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
