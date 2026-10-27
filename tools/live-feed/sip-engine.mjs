// sip-engine.mjs - STOCKS IN PLAY paper strategy on live ticks (owner "do it from tomorrow", 22 Oct 2026; research: tools/backtest/v5/sip.py,
// 13-22 Oct x 494 stocks: 47 trades, 64% winners, +16.9R after costs). PAPER ONLY - no orders are ever placed.
// RE-ENTRY (owner 25 Oct 16:23 "do it"): after a losing exit (trade never reached +1R) the stock re-arms when the price is back inside the
// opening range; if it breaks the level again before 10:15 AND the base favour signs confirm (reMinSigns of 6, incl. aggressive
// buyers/sellers when reNeedFlow), enter once more with the same stop/size rules. Without confirmation: no re-entry.
// PROPOSAL B (owner 25 Oct 15:59): skip stocks that opened > 1% beyond yesterday's close IN the trade direction (gap-chasers),
// trade the top 10. Skipped gap stocks are kept in state.gapSkipped (shadow list) for the daily review.
// ENTRY BASE RULES (owner 25 Oct 15:33): a watch-list stock that breaks its level is entered only when the 6 favour signs agree
// (entryMinSigns of 6, incl. aggressive buyers/sellers when entryNeedFlow) - see smart-warn.mjs favourFor(). Otherwise wait.
// Rules (fixed, same as the research):
//  1. Opening range = 09:15:00-09:19:59. For every stock: open, high, low, last price, volume traded in those 5 minutes.
//  2. At 09:20 rank liquid stocks (median turnover >= Rs25 cr/day) by RELATIVE VOLUME = OR volume / its own average OR volume
//     (baseline file data\sip-baseline.json, last 10 days). Keep the top 10 with rvol >= 3. Direction = OR close vs open.
//  3. Entry until 10:15 when the price breaks the OR high (BUY) / OR low (SELL): fill at the offer (BUY) / bid (SELL) + 0.02% slippage.
//  4. Stop = other side of the opening range, clamped to 0.5%-1.5% of the entry (owner "do it" 23 Oct 08:49; was 2%). Top 15 (was 10). Size = Rs1,000 risk (1R).
//  5. After +1R the stop trails 1R behind the best price. Otherwise exit at 15:15. Costs 0.10628% + slippage counted.
//  6. EXIT RULE 'trailing stop + smart warning' (owner 25 Oct 14:11): when the smart warning (smart-warn.mjs) fires on a trade that
//     has been >= +1R, the trail tightens from 1R to 0.3R behind the best price. A warning before +1R = phone alert only.
//  7. (owner 25 Oct 14:43) When the trend turns back in our favour (NO warning sign on a closed 1-minute bar), a tightened trade goes
//     back to trailing 1R behind the best price. The stop NEVER moves down: the tightened stop stays as the floor until 1R behind the
//     new best is higher. Every warning is recorded in data\sip-warnings-DATE.csv for the daily review (in-loss warnings are classified
//     there: entry fault / market turned / false alarm).
//  8. (owner 25 Oct 14:55) Warning while the trade has NOT reached +1R (e.g. in loss): stop moves to 0.3R below/above the CURRENT price
//     (never down) -> if the move continues we exit with a small loss. (Claude advised 0.5R: on 22-23 Oct 0.5R = +Rs5,438, 0.3R = +Rs1,390;
//     owner chose 0.3R - each such exit is reviewed: entry fault vs sudden market turn.)
import fs from 'node:fs'
import path from 'node:path'
import { SmartWarn } from './smart-warn.mjs'
import { LateShadow } from './late-shadow.mjs'
import { PreopenShadow } from './preopen-shadow.mjs'
import { BreadthShadow } from './breadth-shadow.mjs'

export const SIP_RULES = { orStart: 9 * 3600 + 15 * 60, orEnd: 9 * 3600 + 20 * 60, lastEntry: 10 * 3600 + 15 * 60, squareOff: 15 * 3600 + 15 * 60,
  topK: 10, maxGapWithPct: 1, minRvol: 3, minTurnoverCr: 25, stopMinPct: 0.5, stopMaxPct: 1.5, riskRs: 1000, smartExit: true, warnTightR: 0.3, lossTightR: 0.3, entryBase: false, entryMinSigns: 3, entryNeedFlow: true, reentries: 1, reMinSigns: 3, reNeedFlow: false, reNeedVolume: true, circuitSafety: true, minCircuitRoomPct: 2, qualitySize: true, slipPct: 0.02, costPct: 0.10628, baselineDays: 10, lateStartSec: 20, lateShadow: true, preopenShadow: true, withBreadth: true, breadthBuyMin: 45, breadthSellMax: 55 }

const istSec = (ms) => { const d = new Date(ms + 330 * 60_000); return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds() }
const istDay = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10)
const istClock = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 19)
const istHM = (ms) => new Date(ms + 330 * 60_000).toISOString().slice(11, 16)
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

export class SipEngine {
  constructor({ dataDir, rules = SIP_RULES, baseline = null, day = null }) {
    this.r = rules; this.dataDir = dataDir; this.day = day
    this.baseline = baseline ?? SipEngine.loadBaseline(dataDir)
    this.or = new Map()        // sym -> { open, high, low, last, v0, v1 }
    this.cum = new Map()       // sym -> latest cumulative volume and price (for the nightly baseline update)
    this.picks = null          // [{ sym, dir, rvol, high, low }]
    this.trades = new Map()    // sym -> trade
    this.closed = []
    this.firstTickSec = null
    this.status = 'waiting'
    this.sw = new SmartWarn()
    this.bookNow = new Map()
    this.ckt = new Map() // circuit limits from the feed (25 Oct)
    this.bUp = new Map(); this.bN = 0; this.bCount = 0; this.liqCache = new Map() // live market breadth (rule E6, 27 Oct)
  }
  static loadBaseline(dataDir) {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'sip-baseline.json'), 'utf8')) } catch { return { first5: {}, turnover: {}, days: [] } }
  }
  stateFile() { return path.join(this.dataDir, `sip-state-${this.day}.json`) }
  save() {
    try { fs.writeFileSync(this.stateFile(), JSON.stringify({ picks: this.picks, gapSkipped: this.gapSkipped ?? [], trades: [...this.trades.values()], closed: this.closed, status: this.status, or: [...this.or] })) } catch {}
  }
  restore() { // after a restart in the middle of the day: keep the picks and open trades
    try {
      const s = JSON.parse(fs.readFileSync(this.stateFile(), 'utf8'))
      this.picks = s.picks; this.closed = s.closed ?? []; this.status = s.status ?? 'waiting'
      for (const t of s.trades ?? []) this.trades.set(t.sym, t)
      for (const [k, v] of s.or ?? []) this.or.set(k, v)
      if (this.picks) this.firstTickSec = this.r.orStart
      this.seedBreadth()
      return true
    } catch { return false }
  }

  // tick: { price, bid, ask, cum } ; returns events [{kind:'picks'|'entry'|'exit'|'note', ...}]
  onTick(sym, tick, ts) {
    const ev = []
    if (!this.day) { this.day = istDay(ts); this.restore() }
    if (this.r.lateShadow && this.shadow === undefined) { try { this.shadow = new LateShadow({ dataDir: this.dataDir, sw: this.sw, baseline: this.baseline, day: this.day }) } catch { this.shadow = null } }
    this.makePre()
    const sec = istSec(ts), p = tick.price
    if (!(p > 0)) return ev
    if (Number.isFinite(tick.cum)) this.cum.set(sym, { cum: tick.cum, price: p })
    if (sec >= this.r.orStart && sec < this.r.orEnd) {
      if (this.firstTickSec === null) this.firstTickSec = sec
      let o = this.or.get(sym)
      if (!o) { o = { open: p, high: p, low: p, last: p, v0: Number.isFinite(tick.cum) ? tick.cum : null, v1: null }; this.or.set(sym, o) }
      o.high = Math.max(o.high, p); o.low = Math.min(o.low, p); o.last = p
      if (Number.isFinite(tick.cum)) { if (o.v0 === null) o.v0 = tick.cum; o.v1 = tick.cum }
      if (this.r.smartExit || this.r.entryBase) { this.sw.onTick(sym, istHM(ts), p, tick.cum); if (tick.totBuy > 0 && tick.totSell > 0) { this.bookNow.set(sym, tick.totBuy / tick.totSell); this.sw.st(sym).book = tick.totBuy / tick.totSell } }
      this.preTick(sym, tick, ts, sec, ev)
      return ev
    }
    ev.push(...this.onTimer(ts))
    const t = this.trades.get(sym)
    if (tick.totBuy > 0 && tick.totSell > 0) this.bookNow.set(sym, tick.totBuy / tick.totSell)
    if (tick.upCkt > 0 || tick.loCkt > 0) this.ckt.set(sym, { up: tick.upCkt, lo: tick.loCkt })
    if (this.r.withBreadth) this.updBreadth(sym, p)
    if (this.r.withBreadth && this.bshadow === undefined) { try { this.bshadow = new BreadthShadow({ dataDir: this.dataDir, sw: this.sw, baseline: this.baseline, day: this.day }) } catch { this.bshadow = null } }
    if (this.bshadow) { try { this.bshadow.onTick(sym, tick, ts, istHM(ts), sec >= this.r.squareOff) } catch { this.bshadow = null } }
    if (this.r.smartExit && sec < this.r.squareOff) ev.push(...this.smart(sym, tick, ts, t))
    if (t && !t.exit) ev.push(...this.manage(t, tick, ts, sec))
    else if (this.picks && sec < this.r.lastEntry) {
      const pk = this.picks.find((x) => x.sym === sym)
      if (pk && !t && !pk.breadthSkip) ev.push(...this.tryEntry(pk, tick, ts))
      else if (pk && t && t.exit && t.best < 1 && (t.re ?? 0) < this.r.reentries) { // RE-ENTRY with base-sign confirmation
        const B = pk.dir === 'BUY', lvl = B ? pk.high : pk.low
        if (!t.rearmed) { if (B ? tick.price <= lvl : tick.price >= lvl) { t.rearmed = true; this.save() } }
        else if (B ? tick.price > lvl : tick.price < lvl) {
          const f = this.sw.favourFor(sym, pk.dir, tick.price, pk.book0, ts)
          // RE-ENTRY RULE (owner 26 Oct 18:05): sign 3 (volume burst, on time) is a MUST + at least reMinSigns of the other 5 signs
          const others = f ? f.score - (f.signs.volume ? 1 : 0) : 0
          if (f && (this.r.reNeedVolume ? f.signs.volume && others >= this.r.reMinSigns : f.score >= this.r.reMinSigns) && (!this.r.reNeedFlow || f.signs.flow)) {
            const signs = Object.keys(f.signs).filter((k) => f.signs[k])
            const e2 = this.tryEntry({ ...pk, waited: 0 }, tick, ts, true)
            if (e2.length) { const nt = this.trades.get(sym); nt.re = (t.re ?? 0) + 1; nt.entrySigns = signs; e2[0].reentry = true; e2[0].signs = signs; this.save(); ev.push(...e2) }
          }
        }
      }
    }
    this.preTick(sym, tick, ts, sec, ev)
    // SHADOW monitor for later entries (owner 25 Oct 17:19) - records virtual trades only; can never affect live trades
    if (this.shadow && sec >= this.r.lastEntry) { try { this.shadow.onTick(sym, tick, ts, istHM(ts), sec >= this.r.squareOff) } catch (e) { this.shadow = null; ev.push({ kind: 'note', text: `late-entry shadow monitor stopped (live trading unaffected): ${e.message}` }) } }
    return ev
  }
  // PRE-OPEN virtual trades (owner 25 Oct 17:57) - monitoring only, can never affect live trades
  makePre() { if (this.r.preopenShadow && this.pre === undefined && this.day) { try { this.pre = new PreopenShadow({ dataDir: this.dataDir, sw: this.sw, baseline: this.baseline, day: this.day }) } catch { this.pre = null } } }
  onPreOpen(sym, tick, ts) { // 09:00-09:15 ticks from the feed
    if (!this.day) { this.day = istDay(ts); this.restore() }
    this.makePre()
    if (this.pre) { try { this.pre.onPre(sym, tick) } catch { this.pre = null } }
  }
  preTick(sym, tick, ts, sec, ev) {
    if (!this.pre || sec < this.r.orStart) return
    try { this.pre.onTick(sym, tick, ts, istHM(ts), sec >= this.r.squareOff) } catch (e) { this.pre = null; ev.push({ kind: 'note', text: `pre-open shadow stopped (live trading unaffected): ${e.message}` }) }
  }
  // RULE E6 TRADE WITH BREADTH (owner 26 Oct 23:45 + 27 Oct): breadth = % of liquid stocks (median turnover >= Rs25 cr) trading above their
  // 09:15 open, kept live on every tick. BUY only if breadth >= breadthBuyMin (45), SELL only if <= breadthSellMax (55); 45-55 = mixed, both allowed.
  // 9 days (1-min sim): same profit (+31.8R vs +31.7R), losing trades 12 -> 6. Skipped first entries become virtual trades (breadth-shadow.mjs).
  updBreadth(sym, p) {
    const o = this.or.get(sym); if (!o || sym.startsWith('NIFTY')) return
    let liq = this.liqCache.get(sym)
    if (liq === undefined) { liq = median(this.baseline.turnover?.[sym] ?? []) >= this.r.minTurnoverCr; this.liqCache.set(sym, liq) }
    if (!liq) return
    const up = p > o.open, prev = this.bUp.get(sym)
    if (prev === undefined) { this.bN++; if (up) this.bCount++ } else if (prev !== up) this.bCount += up ? 1 : -1
    this.bUp.set(sym, up)
  }
  breadth() { return this.bN >= 50 ? +(this.bCount / this.bN * 100).toFixed(1) : null }
  seedBreadth() { if (this.r.withBreadth) { for (const [sym, o] of this.or) if (o && o.last > 0 && !this.bUp.has(sym)) this.updBreadth(sym, o.last); this.bSeeded = true } }
  // called every second by the feed (and from onTick): selection at 09:20, square-off at 15:15
  onTimer(ts) {
    const ev = [], sec = istSec(ts)
    if (!this.day) { this.day = istDay(ts); this.restore() }
    if (this.picks === null && sec >= this.r.orEnd && sec < this.r.squareOff) ev.push(...this.select(ts))
    if (sec >= this.r.squareOff) for (const t of this.trades.values()) if (!t.exit) ev.push(this.close(t, t.lastPrice ?? t.entry, 'squareoff', ts))
    if (sec >= this.r.squareOff && this.shadow) { try { this.shadow.closeAll(ts) } catch {} }
    if (sec >= this.r.squareOff && this.pre) { try { this.pre.closeAll(ts) } catch {} }
    if (sec >= this.r.squareOff && this.bshadow) { try { this.bshadow.closeAll(ts) } catch {} }
    if (this.dirty && ts - (this.savedAt ?? 0) >= 10_000) { this.dirty = false; this.savedAt = ts; this.save() } // trailing-stop moves saved at most every 10 s
    return ev
  }
  select(ts) {
    this.picks = []
    if (this.firstTickSec === null || this.firstTickSec > this.r.orStart + this.r.lateStartSec) {
      this.status = 'skipped: feed started after 09:15 (no full opening range)'; this.save()
      return [{ kind: 'note', text: `SIP: no picks today - ${this.status}` }]
    }
    const cand = [], gapSkipped = []
    for (const [sym, o] of this.or) {
      const hist = this.baseline.first5?.[sym] ?? []
      const avg = mean(hist.slice(-this.r.baselineDays)), turn = median(this.baseline.turnover?.[sym] ?? [])
      if (!(avg > 0) || turn < this.r.minTurnoverCr || o.v0 === null || o.v1 === null || o.last === o.open) continue
      const rvol = (o.v1 - o.v0) / avg
      if (rvol < this.r.minRvol) continue
      const dir = o.last > o.open ? 'BUY' : 'SELL', pc = this.baseline.lastClose?.[sym]
      const gapWith = pc > 0 ? +(((o.open / pc - 1) * 100) * (dir === 'BUY' ? 1 : -1)).toFixed(2) : null
      const c = { sym, dir, rvol: +rvol.toFixed(1), high: o.high, low: o.low, gapWith }
      if (this.r.maxGapWithPct != null && gapWith != null && gapWith > this.r.maxGapWithPct) { gapSkipped.push(c); continue }
      cand.push(c)
    }
    cand.sort((a, b) => b.rvol - a.rvol)
    this.gapSkipped = gapSkipped.sort((a, b) => b.rvol - a.rvol)
    this.picks = cand.slice(0, this.r.topK).map((p) => ({ ...p, book0: this.bookNow.get(p.sym) ?? null })); this.status = 'picked'; this.save()
    this.seedBreadth() // 27 Oct fix: breadth ready at 09:20:00 (RECLTD was entered at 09:20:00 before breadth existed)
    return [{ kind: 'picks', picks: this.picks, ts }]
  }
  tryEntry(pk, tick, ts, confirmed = false) {
    const B = pk.dir === 'BUY', sg = B ? 1 : -1, lvl = B ? pk.high : pk.low
    if (B ? tick.price <= lvl : tick.price >= lvl) return []   // strictly beyond the range
    if (this.r.entryBase && !confirmed) { // BASE RULES (owner 25 Oct): enter only if the favour signs agree; otherwise wait (price must still be beyond the level)
      const f = this.sw.favourFor(pk.sym, pk.dir, tick.price, pk.book0, ts)
      if (!f || f.score < this.r.entryMinSigns || (this.r.entryNeedFlow && !f.signs.flow)) { pk.waited = (pk.waited ?? 0) + 1; return [] }
      pk.entrySigns = Object.keys(f.signs).filter((k) => f.signs[k])
    }
    const quote = B ? (tick.ask > 0 ? tick.ask : tick.price) : (tick.bid > 0 ? tick.bid : tick.price)
    if (this.r.circuitSafety) { // CIRCUIT SAFETY (expert audit, proposal): skip if the circuit limit in our direction is too close (no room to profit / frozen exit)
      const c = this.ckt.get(pk.sym), lim = c ? (B ? c.up : c.lo) : 0
      if (lim > 0 && Math.abs(lim - quote) / quote * 100 < this.r.minCircuitRoomPct) { pk.circuitSkip = true; return [] }
    }
    const br = this.breadth()
    if (this.r.withBreadth && !this.bSeeded) return [] // 27 Oct fix: breadth not seeded yet -> wait, never enter blind
    const againstBreadth = this.r.withBreadth && br != null && (B ? br < this.r.breadthBuyMin : br > this.r.breadthSellMax)
    const entry = +(quote * (1 + sg * this.r.slipPct / 100)).toFixed(2)
    const opp = B ? pk.low : pk.high
    const riskPct = Math.min(Math.max(Math.abs(entry - opp) / entry * 100, this.r.stopMinPct), this.r.stopMaxPct)
    const risk = entry * riskPct / 100
    // SIZE BY QUALITY (owner 25 Oct "do it"): 1.5x risk for the strongest setup (gapped AGAINST us, then turned on >= 5x volume),
    // 0.5x for the weakest kept setup (gapped 0-1% our way), 1x otherwise. 9 days: +Rs39,900 vs +Rs31,700, worst day -600 vs -1,200.
    const mult = !this.r.qualitySize || pk.gapWith == null ? 1 : (pk.gapWith < 0 && pk.rvol >= 5 ? 1.5 : (pk.gapWith > 0 ? 0.5 : 1))
    const riskRs = this.r.riskRs * mult
    const qty = Math.max(1, Math.floor(riskRs / risk))
    // record the 6 favour signs at EVERY entry (owner 25 Oct 16:35: compare the trades that went up with the ones that went down)
    const fs6 = this.sw.favourFor(pk.sym, pk.dir, tick.price, pk.book0, ts)
    const signsAtEntry = fs6 ? Object.keys(fs6.signs).filter((k) => fs6.signs[k]) : []
    // ENTRY MONITOR (owner 26 Oct 18:05): would this entry pass the re-entry rule (sign 3 must + 3 of the other 5)? recorded only, not used
    const reRuleOk = !!(fs6 && fs6.signs.volume && fs6.score - 1 >= this.r.reMinSigns)
    const t = { sym: pk.sym, dir: pk.dir, rvol: pk.rvol, gapWith: pk.gapWith ?? null, riskRs, sizeMult: mult, signsAtEntry, reRuleOk, slowVolume: fs6 ? fs6.slowVolume : null, entrySigns: pk.entrySigns ?? null, waitedTicks: pk.waited ?? 0, bookAtEntry: this.bookNow.get(pk.sym) ?? null, entry, stop: +(entry - sg * risk).toFixed(2), stop0: +(entry - sg * risk).toFixed(2), risk, riskPct: +riskPct.toFixed(2), qty, best: 0, inTs: ts, lastPrice: tick.price }
    t.breadth = br
    if (againstBreadth) { // E6: not taken. First entry -> virtual trade for the monitoring list; re-entry attempt -> simply not taken now
      if (!confirmed) { pk.breadthSkip = true; try { this.bshadow?.add(t, br, ts) } catch {} this.save(); return [{ kind: 'note', text: `SIP: ${pk.dir} ${pk.sym} broke its level but NOT taken - against market breadth (${br}% of stocks up; rule: buy only >= ${this.r.breadthBuyMin}%, sell only <= ${this.r.breadthSellMax}%). Recorded as virtual trade.` }] }
      return []
    }
    this.trades.set(pk.sym, t); this.save()
    return [{ kind: 'entry', trade: t, ts }]
  }
  // smart warning on 1-minute bars (all stocks, so VWAP is the day's VWAP); on a closed bar of an open trade, evaluate
  smart(sym, tick, ts, t) {
    const m = istHM(ts)
    const closed = this.sw.onTick(sym, m, tick.price, tick.cum)
    const bk = this.bookNow.get(sym); if (bk) this.sw.st(sym).book = bk
    if (!closed || !t || t.exit) return []
    const ev = []
    if (t.tight) { // rule 7: trend back in our favour -> trail 1R again (stop stays where it is)
      const x = this.sw.signsFor({ sym, dir: t.dir, entry: t.entry, risk: t.risk, inMin: istHM(t.inTs), bookAtEntry: t.bookAtEntry ?? null })
      if (x && x.score === 0) { t.tight = false; this.save(); ev.push({ kind: 'untight', trade: t, ts }) }
    }
    const inMin = istHM(t.inTs)
    if (m <= inMin) return ev
    { // EXIT TESTS 27 Oct (off unless set): stall = no progress after stallMin minutes while in loss; absorb = heavy volume bar with no progress our way
      const sg = t.dir === 'BUY' ? 1 : -1, x = this.sw.sym.get(sym), last = x?.bars.at(-1), R = (tick.price - t.entry) * sg / t.risk
      const mins = (h) => +h.slice(0, 2) * 60 + +h.slice(3, 5)
      let cut = false
      if (this.r.stallMin && mins(m) - mins(inMin) >= this.r.stallMin && t.best < (this.r.stallBest ?? 0.5) && R < 0) cut = true
      if (this.r.absorbX && last && R < 0.3) {
        const pool = x.bars.filter((b) => b.m >= '09:20' && b.m < last.m).map((b) => b.v).sort((a, b) => a - b), normal = pool.length ? pool[Math.floor(pool.length / 2)] : 0
        if (normal > 0 && last.v >= this.r.absorbX * normal && (last.c - last.o) * sg <= 0 && last.m > inMin) cut = true
      }
      if (cut) { const ns = +(tick.price - sg * this.r.lossTightR * t.risk).toFixed(2); if ((ns - t.stop) * sg > 0) { t.stop = ns; t.testCut = true; this.save() } }
    }
    const w = this.sw.evaluate({ sym, dir: t.dir, entry: t.entry, risk: t.risk, inMin, bookAtEntry: t.bookAtEntry ?? null }, m)
    if (!w) return ev
    let tightened = false
    if (t.best < 1 && this.r.lossTightR) { // rule 8: warning before +1R -> stop 0.3R from the current price (never down)
      const sg = t.dir === 'BUY' ? 1 : -1
      const ns = +(w.price - sg * this.r.lossTightR * t.risk).toFixed(2)
      if ((ns - t.stop) * sg > 0) { t.stop = ns; tightened = true; this.save() }
    }
    if (t.best >= 1) {
      const sg = t.dir === 'BUY' ? 1 : -1
      t.tight = true
      const ns = +(t.entry + sg * (t.best - this.r.warnTightR) * t.risk).toFixed(2)
      if ((ns - t.stop) * sg > 0) { t.stop = ns; tightened = true }
      this.save()
    }
    this.logWarn(t, w, tightened)
    return [...ev, { kind: 'warn', trade: t, w, tightened, ts }]
  }
  logWarn(t, w, tightened) {
    try {
      const f = path.join(this.dataDir, `sip-warnings-${this.day}.csv`)
      const head = fs.existsSync(f) ? '' : 'day,minute,symbol,dir,price,R,best,mode,score,signs,action\n'
      fs.appendFileSync(f, head + [this.day, w.minute, t.sym, t.dir, w.price, w.R, w.best, w.mode, w.score, w.signs.join('+'), tightened ? (t.best >= 1 ? 'stop tightened 0.3R behind best' : (w.R < 0 ? 'IN LOSS: stop 0.3R from price' : 'early: stop 0.3R from price')) : 'no change'].join(',') + '\n')
    } catch {}
  }
  manage(t, tick, ts, sec) {
    const B = t.dir === 'BUY', sg = B ? 1 : -1, p = tick.price
    t.lastPrice = p
    if (sec >= this.r.squareOff) return [this.close(t, B ? (tick.bid > 0 ? tick.bid : p) : (tick.ask > 0 ? tick.ask : p), 'squareoff', ts)]
    if (B ? p <= t.stop : p >= t.stop) {
      const q = B ? (tick.bid > 0 ? Math.min(tick.bid, p) : p) : (tick.ask > 0 ? Math.max(tick.ask, p) : p)
      return [this.close(t, q, t.best >= 1 ? 'trail' : 'stop', ts)]
    }
    const r = (p - t.entry) * sg / t.risk
    // EXIT TESTS 27 Oct (owner: exit closer to 0 loss) - all OFF unless the rule is set
    if (this.r.fastDropR) { // tick-level: price fell fastDropR R within fastSec seconds while in loss -> stop 0.3R from price
      (t.win ??= []).push([ts, p]); while (t.win.length && ts - t.win[0][0] > (this.r.fastSec ?? 60) * 1000) t.win.shift()
      const ext = sg > 0 ? Math.max(...t.win.map((x) => x[1])) : Math.min(...t.win.map((x) => x[1]))
      if (r < 0 && (ext - p) * sg >= this.r.fastDropR * t.risk) { const ns = +(p - sg * this.r.lossTightR * t.risk).toFixed(2); if ((ns - t.stop) * sg > 0) { t.stop = ns; t.fastCut = true } }
    }
    if (this.r.beAt && r >= this.r.beAt) { const be = +(t.entry * (1 + sg * (this.r.costPct + 2 * this.r.slipPct) / 100)).toFixed(2); if ((be - t.stop) * sg > 0) t.stop = be }
    if (r > t.best) {
      t.best = r
      if (t.best >= 1) {
        const ns = +(t.entry + sg * (t.best - (t.tight ? this.r.warnTightR : 1)) * t.risk).toFixed(2)
        if ((ns - t.stop) * sg > 0) { t.stop = ns; this.dirty = true }
      }
    }
    return []
  }
  close(t, quote, reason, ts) {
    const sg = t.dir === 'BUY' ? 1 : -1
    const exit = +(quote * (1 - sg * this.r.slipPct / 100)).toFixed(2)
    const gross = (exit - t.entry) * sg * t.qty
    const cost = t.entry * t.qty * this.r.costPct / 100
    Object.assign(t, { exit, reason, outTs: ts, netRs: Math.round(gross - cost), R: +((gross - cost) / (t.risk * t.qty)).toFixed(2) })
    this.closed.push({ ...t }); this.save(); this.logTrade(t)
    return { kind: 'exit', trade: t, ts }
  }
  logTrade(t) {
    try {
      const f = path.join(this.dataDir, `sip-trades-${this.day}.csv`)
      const head = fs.existsSync(f) ? '' : 'day,symbol,dir,rvol,gap_with_pct,reentry,signs_at_entry,entry_time,entry,stop0,risk_pct,qty,exit_time,exit,reason,best_R,net_rs,R,tightened,sign3_burst_plus3,breadth_at_entry\n'
      fs.appendFileSync(f, head + [this.day, t.sym, t.dir, t.rvol, t.gapWith ?? '', t.re ? 'yes' : 'no', (t.signsAtEntry ?? []).join('+'), istClock(t.inTs), t.entry, t.stop0, t.riskPct, t.qty, istClock(t.outTs), t.exit, t.reason, t.best.toFixed(2), t.netRs, t.R, t.tight ? 'yes' : 'no', t.reRuleOk ? 'yes' : 'no', t.breadth ?? ''].join(',') + '\n')
    } catch {}
  }
  summary() {
    const n = this.closed.length, net = this.closed.reduce((a, t) => a + t.netRs, 0), w = this.closed.filter((t) => t.netRs > 0).length
    let late = null, pre = null; try { late = this.shadow ? this.shadow.summary() : null } catch {}
    try { pre = this.pre ? this.pre.summary() : null } catch {}
    let bsk = null; try { bsk = this.bshadow ? this.bshadow.summary() : null } catch {}
    return { n, net, wins: w, picks: this.picks?.length ?? 0, status: this.status, late, pre, breadthSkipped: bsk }
  }
  // after the close: add today's opening-range volume and turnover to the baseline (keeps the last 10 days)
  updateBaseline() {
    if (!this.or.size || this.baseline.days?.includes(this.day)) return false
    const b = this.baseline; b.first5 ??= {}; b.turnover ??= {}; b.days ??= []
    for (const [sym, o] of this.or) {
      if (o.v0 !== null && o.v1 !== null && o.v1 > o.v0) (b.first5[sym] ??= []).push(o.v1 - o.v0)
      b.first5[sym] = (b.first5[sym] ?? []).slice(-this.r.baselineDays)
    }
    for (const [sym, c] of this.cum) { (b.turnover[sym] ??= []).push(+(c.cum * c.price / 1e7).toFixed(2)); b.turnover[sym] = b.turnover[sym].slice(-this.r.baselineDays) }
    b.lastClose ??= {}
    for (const [sym, c] of this.cum) b.lastClose[sym] = c.price // yesterday's close for tomorrow's gap check (Proposal B)
    b.days.push(this.day); b.days = b.days.slice(-this.r.baselineDays); b.updated = new Date().toISOString()
    try { fs.writeFileSync(path.join(this.dataDir, 'sip-baseline.json'), JSON.stringify(b)); return true } catch { return false }
  }
}
