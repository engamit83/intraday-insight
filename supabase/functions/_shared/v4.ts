// Rule set v4 (live) — the SAME rules that were back-tested in tools/backtest (see PROGRESS.md, RULEBOOK A).
// Pure functions only (no network), so they can be tested offline.
//
//  - Uses CLOSED 5-minute candles only (the back-test decided after each candle closed).
//  - Market filter: BUY only if the average scanned stock is up on the day, SELL only if down.
//  - Relative strength: BUY only if the stock is up more than that average, SELL only if down more.
//  - Key level: BUY only above yesterday's high, SELL only below yesterday's low.
//  - Volume (any one): today's volume so far >= 1.2x its usual by this time of day, OR the last
//    candle >= 2x usual for its slot, OR slot volume rising 3 candles in a row with today >= 1.0x.
//  - New entries only 10:00-14:00 IST, score >= 60 (time-of-day multiplier applied).
//  - Levels: stop = max(2 x ATR, 0.25%), target = 2 x stop distance.
//  - v4.2 (22 Oct, ON TRIAL): gap held - open >= 0.5% beyond yesterday's close in the trade direction and price still beyond today's open.
// Selection limits (top 3 best per run, one signal per stock per day, safety cap 30 per day) are applied by the caller,
// which knows today's existing signals.

import { computeIndicators, type Candle, type Indicators } from './indicators.ts'
import { calculateRawScore, calculateScoreUncapped, decideDirection, getTimeMultiplier } from './scoring.ts'
import { sectorOf } from './sectors.ts'

export const V4 = {
  version: 'v4.2',          // 22 Oct (owner 'do it' 21 Oct): + GAP HELD rule (on trial); daily cap 30 (quality decides, not a fixed 10)
  minGapPct: 0.5,           // v4.2 ON TRIAL: today's open >= 0.5% beyond yesterday's close in the trade direction AND price still beyond today's open
  minScore: 60,
  noEntryBefore: '10:00',
  noEntryAfter: '14:00',
  topN: 3,
  maxSignalsPerDay: 30,     // v4.2: safety cap only - each scan picks only the best (top 3) that pass every rule; owner: 'best stocks, fewer or more is OK, never everything'
  stopAtrMult: 2,
  minStopPct: 0.25,
  rewardRisk: 2,
  volDays: 5,
  historyWindow: 300,
  maxPerSector: 1,          // at most one open position / pick per sector (sectors.ts)
  latestFirstCandle: '09:20', // today's first closed candle must start by this time, else the day's numbers are wrong
  trailAfterR: 1,           // the trailing stop only starts once the trade has gained 1R (paper.ts)
  // management rules used by the paper trader
  lockAtR: 1, lock2AtR: 1.5, lock2KeepR: 0.75, trailAtrMult: 1.5, squareOff: '15:15', dailyLossLimitRs: 2000,
}

const IST = 5.5 * 3600_000
const OPEN_MIN = 9 * 60 + 15
const pad = (n: number) => String(n).padStart(2, '0')
const fromMin = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`
/** IST 'YYYY-MM-DD' and minutes since midnight of an instant */
export function istOf(ms: number) {
  const d = new Date(ms + IST)
  return { day: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }
}
/** 5-minute bucket (candle start, HH:MM IST) of a timestamp string carrying +05:30 or Z */
export function bucketOfMs(ms: number): { day: string; bucket: string } {
  const { day, min } = istOf(ms)
  return { day, bucket: fromMin(OPEN_MIN + Math.floor((min - OPEN_MIN) / 5) * 5) }
}

interface Keyed extends Candle { day: string; bucket: string }

function keyed(candles: Candle[]): Keyed[] {
  const out = new Map<string, Keyed>()
  for (const c of candles) {
    const t = Date.parse(c.timestamp)
    if (!Number.isFinite(t)) continue
    const k = bucketOfMs(t)
    if (k.bucket < '09:15' || k.bucket > '15:25') continue
    out.set(k.day + k.bucket, { ...c, ...k })
  }
  return [...out.values()].sort((a, b) => (a.day + a.bucket).localeCompare(b.day + b.bucket))
}

export interface StockState {
  symbol: string
  ok: boolean
  reason?: string
  ind?: Indicators
  today?: string
  lastBucket?: string
  dayOpen?: number
  lastClose?: number
  prevDay?: { high: number; low: number; close: number } | null
  vol?: { dayR: number | null; tod: number | null; prevTod: number | null; prev2Tod: number | null }
  closedToday?: number
}

/**
 * Build one stock's state from earlier-day history + today's live candles, using only candles
 * that have CLOSED by nowMs. `all` may contain any mix (history then live); duplicates by
 * 5-minute slot are merged (last wins).
 */
export function prepareStock(symbol: string, all: Candle[], nowMs: number): StockState {
  const { day: today, min: nowMin } = istOf(nowMs)
  const rows = keyed(all).filter((c) => {
    if (c.day !== today) return c.day < today
    const start = Number(c.bucket.slice(0, 2)) * 60 + Number(c.bucket.slice(3, 5))
    return start + 5 <= nowMin // closed candles only
  })
  const todayRows = rows.filter((c) => c.day === today)
  if (todayRows.length === 0) return { symbol, ok: false, reason: 'no closed candles today' }
  // v4.1 guard: if today's data starts late (feed started late), "% up today", VWAP, market direction and day
  // volume would be measured from the wrong point (16 Oct: feed from 12:00) - do not trade this stock today
  if (todayRows[0].bucket > V4.latestFirstCandle) return { symbol, ok: false, reason: `today's data starts late (${todayRows[0].bucket}), morning missing` }
  const past = rows.filter((c) => c.day < today)
  if (past.length < 40) return { symbol, ok: false, reason: `not enough history (${past.length} candles)` }

  const series = [...past.slice(-V4.historyWindow), ...todayRows]
  const ind = computeIndicators(series)

  const days = [...new Set(past.map((c) => c.day))].sort()
  const prevDayKey = days.at(-1)!
  const pd = past.filter((c) => c.day === prevDayKey)
  const prevDay = pd.length ? { high: Math.max(...pd.map((c) => c.high)), low: Math.min(...pd.map((c) => c.low)), close: pd.at(-1)!.close } : null

  // volume by slot on earlier days (up to volDays most recent days having the slot; need >= 2)
  const byDay = new Map<string, Map<string, number>>()
  const cumByDay = new Map<string, Map<string, number>>()
  for (const d of days) {
    const list = past.filter((c) => c.day === d)
    const v = new Map<string, number>(), cu = new Map<string, number>()
    let run = 0
    for (const c of list) { v.set(c.bucket, c.volume); run += c.volume; cu.set(c.bucket, run) }
    byDay.set(d, v); cumByDay.set(d, cu)
  }
  const avg = (table: Map<string, Map<string, number>>, bucket: string) => {
    const vals: number[] = []
    for (const d of [...days].reverse()) { const x = table.get(d)?.get(bucket); if (x !== undefined) vals.push(x); if (vals.length >= V4.volDays) break }
    return vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  let cum = 0
  const cumToday = new Map<string, number>()
  for (const c of todayRows) { cum += c.volume; cumToday.set(c.bucket, cum) }
  const tod = (i: number) => {
    const c = todayRows[i]; if (!c) return null
    const a = avg(byDay, c.bucket); return a ? c.volume / a : null
  }
  const last = todayRows.at(-1)!
  const ac = avg(cumByDay, last.bucket)
  const vol = {
    dayR: ac ? cumToday.get(last.bucket)! / ac : null,
    tod: tod(todayRows.length - 1), prevTod: tod(todayRows.length - 2), prev2Tod: tod(todayRows.length - 3),
  }
  return { symbol, ok: true, ind, today, lastBucket: last.bucket, dayOpen: todayRows[0].open, lastClose: last.close, prevDay, vol, closedToday: todayRows.length }
}

export interface V4Candidate {
  symbol: string
  direction: 'BUY' | 'SELL'
  entry: number
  stoploss: number
  target: number
  stopDist: number
  atr: number
  rawScore: number
  finalScore: number
  rankScore: number
  reasons: string[]
}

export interface V4Result {
  breadthPct: number | null
  timeMult: number
  entryWindowOpen: boolean
  candidates: V4Candidate[]
  rejected: { symbol: string; reason: string }[]
}

/** Apply the v4 entry rules to all prepared stocks. Candidates are sorted best first (not yet capped). */
export function evaluateV4(states: StockState[], nowMs: number): V4Result {
  const ok = states.filter((s) => s.ok)
  const chg = (s: StockState) => ((s.lastClose! / s.dayOpen!) - 1) * 100
  const breadthPct = ok.length ? ok.reduce((a, s) => a + chg(s), 0) / ok.length : null
  const { min } = istOf(nowMs)
  const current = fromMin(OPEN_MIN + Math.floor((min - OPEN_MIN) / 5) * 5) // the forming candle = next entry candle
  const entryWindowOpen = current >= V4.noEntryBefore && current <= V4.noEntryAfter
  const timeMult = getTimeMultiplier(new Date(nowMs))
  const rejected: { symbol: string; reason: string }[] = states.filter((s) => !s.ok).map((s) => ({ symbol: s.symbol, reason: s.reason ?? 'not ready' }))
  const candidates: V4Candidate[] = []
  for (const s of ok) {
    const ind = s.ind!
    const rej = (reason: string) => rejected.push({ symbol: s.symbol, reason })
    const dir = decideDirection(ind)
    if (!dir.direction || ind.atr === null || ind.lastClose === null) { rej(dir.reason); continue }
    const B = dir.direction === 'BUY'
    const finalScore = Math.round(calculateRawScore(ind) * timeMult)
    if (finalScore < V4.minScore) { rej(`score ${finalScore} < ${V4.minScore}`); continue }
    if (breadthPct === null || (B ? breadthPct <= 0 : breadthPct >= 0)) { rej(`market filter (market ${breadthPct?.toFixed(2)}%)`); continue }
    const c = chg(s)
    if (B ? c <= breadthPct : c >= breadthPct) { rej(`relative strength (stock ${c.toFixed(2)}% vs market ${breadthPct.toFixed(2)}%)`); continue }
    if (!s.prevDay || (B ? ind.lastClose <= s.prevDay.high : ind.lastClose >= s.prevDay.low)) { rej(`not beyond yesterday's ${B ? 'high' : 'low'}`); continue }
    // v4.2 (on trial): the overnight gap must be in our direction and still held
    const gapPct = s.prevDay.close ? (s.dayOpen! / s.prevDay.close - 1) * 100 : 0
    if (B ? !(gapPct >= V4.minGapPct && ind.lastClose > s.dayOpen!) : !(gapPct <= -V4.minGapPct && ind.lastClose < s.dayOpen!)) {
      rej(`gap not held (${gapPct.toFixed(2)}% at open, price ${B ? 'not above' : 'not below'} today's open)`); continue
    }
    const v = s.vol!
    const rising3 = v.tod !== null && v.prevTod !== null && v.prev2Tod !== null && v.prev2Tod < v.prevTod && v.prevTod < v.tod
    const volOk = (v.dayR !== null && v.dayR >= 1.2) || (v.tod !== null && v.tod >= 2) || (rising3 && v.dayR !== null && v.dayR >= 1.0)
    if (!volOk) { rej(`volume not unusual (day ${v.dayR?.toFixed(2) ?? '?'}x, candle ${v.tod?.toFixed(2) ?? '?'}x)`); continue }
    const entry = ind.lastClose
    const stopDist = Math.max(ind.atr * V4.stopAtrMult, entry * (V4.minStopPct / 100))
    const r2 = (n: number) => Math.round(n * 100) / 100
    candidates.push({
      symbol: s.symbol, direction: dir.direction, entry: r2(entry),
      stoploss: r2(B ? entry - stopDist : entry + stopDist), target: r2(B ? entry + stopDist * V4.rewardRisk : entry - stopDist * V4.rewardRisk),
      stopDist, atr: ind.atr, rawScore: calculateRawScore(ind), finalScore, rankScore: Math.round(calculateScoreUncapped(ind) * timeMult * 10) / 10,
      reasons: [`gap ${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(2)}% held ${B ? 'above' : 'below'} today's open ${s.dayOpen}`, `market ${breadthPct.toFixed(2)}%`, `stock ${c.toFixed(2)}%`, `beyond yesterday ${B ? 'high ' + s.prevDay.high : 'low ' + s.prevDay.low}`,
        `volume day ${v.dayR?.toFixed(2) ?? '?'}x / candle ${v.tod?.toFixed(2) ?? '?'}x${rising3 ? ' / rising' : ''}`, dir.reason],
    })
  }
  candidates.sort((a, b) => b.rankScore - a.rankScore || b.finalScore - a.finalScore)
  return { breadthPct, timeMult, entryWindowOpen, candidates, rejected }
}

/**
 * Choose which candidates become signals now (v4.1): skip stocks already signalled today, at most `topN` per run
 * and `room` left today, and at most V4.maxPerSector per sector counting the sectors of trades still open.
 * Same order and rules as the back-tester's selection (tools/backtest/backtest.mjs, maxPerSector).
 */
export function pickV4(candidates: V4Candidate[], usedToday: Set<string>, room: number, openSymbols: string[]): V4Candidate[] {
  const count = new Map<string, number>()
  for (const s of openSymbols) count.set(sectorOf(s), (count.get(sectorOf(s)) ?? 0) + 1)
  const out: V4Candidate[] = []
  for (const c of candidates) {
    if (out.length >= Math.min(V4.topN, room)) break
    if (usedToday.has(c.symbol)) continue
    const sec = sectorOf(c.symbol)
    if ((count.get(sec) ?? 0) >= V4.maxPerSector) continue
    out.push(c); count.set(sec, (count.get(sec) ?? 0) + 1)
  }
  return out
}
