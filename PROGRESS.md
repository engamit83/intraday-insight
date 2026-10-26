# Intraday Insight — Progress Tracker

> ## ⭐ RULE 0 — BASE INTENT (owner, 22 Oct 2026): MAXIMUM PROFIT WITH ALMOST NO LOSS.
> Keep it in mind ALL the time, in every task, review and proposal. Claude = the market expert: analyse every day with ALL our data,
> self-improve towards this goal without being reminded, test every idea on data (must beat costs), owner approves live changes.

> **Owner's definition (22 Oct 20:50):** this is a DIRECTION, not a fixed target — always move towards ZERO loss and towards UNLIMITED profit. Never answer with "it doesn't exist"; every day push further: fewer/smaller losing trades, bigger/more winning trades. Measure the direction daily: losing-trade %, average and biggest loss, losing days, net profit after costs — each must improve over time.
> **Owner (22 Oct 21:18):** do NOT limit the app to what human traders could do. Use what AI can do that people cannot: watch all stocks on every tick, test thousands of rule variants on all days every night, learn from every trade, combine all data at once. Aim beyond human limits, step by step, proven on data.
> **RULE 0b — HOW Claude works, ALWAYS (owner 22 Oct 21:21, "make it your rule, keep improving for the best result"):**
> 1. Watch EVERYTHING at once: all stocks, every tick, buyers/sellers, volume, Nifty + sectors, our trades.
> 2. Test THOUSANDS of ideas: every night run large rule-variation tests on ALL days (walk-forward: build on earlier days, check on later days), keep only what holds on unseen days and beats costs.
> 3. Learn from EVERY trade: each win, loss and missed move analysed daily.
> 4. Act exactly and without emotion: entries/exits on live ticks, precise timing.
> 5. KEEP what is good (owner 21:21): whatever works stays; change only the parts that data proves can be better.
> 6. NOT mechanical (owner 21:30): think like an expert every day - read what the market did, ask WHY trades won/lost, change the approach when needed, never just repeat the same routine. Heavy testing now; testing decreases as the app matures and the rules settle.
> 7. LEAD AS THE MARKET EXPERT (owner 25 Oct 16:38): "our rules were basic and weak; you are not acting as a market expert". Claude must PROACTIVELY audit all rules from every angle, mix/match/test, and bring improvements - the owner should not have to give the angles.
> Keep improving every day towards Rule 0. The owner decides; live changes only with his "do it".
**Repo:** github.com/engamit83/intraday-insight (branch: `main`)
**Backend:** Lovable Cloud (Supabase-based), project `emxhhxvtbjsjtjacbike`
**Last updated:** 2026-10-16

---

## 🎯 The Bigger Goal

An intraday trading assistant for Indian (NSE) stocks, integrated with the **Sharekhan** broker. Intended pipeline:

```
stock list sync → real price data (Sharekhan primary / Alpha Vantage fallback)
→ technical indicators → market condition classification → scored trade signals
→ user acts (view-only / simulated paper trade / eventually auto-trade)
→ exit monitoring → learning engine adjusts future scoring
```

**Long-term intent:** support multiple users, each connecting their own broker account (not just personal use).

---

## 🧡 OWNER'S TRADING INTENT (agreed 16 Oct 2026) — READ THIS FIRST, EVERY SESSION
> **Claude: at the START of every task (incl. scheduled check-ins) read this section first — the owner noticed on 21 Oct that it was not being followed. Always read this section and the AGREED PLAN + RULEBOOK below before suggesting or changing anything. The owner should never have to repeat these points. When a discussion adds or changes intent, update this section the same day.**

0. **BASE INTENT (owner, 22 Oct 20:35) — MAXIMUM PROFIT WITH ALMOST NO LOSS.** Claude is the market expert and must SELF-IMPROVE DAILY: every trading day, analyse thoroughly with ALL the data we have (1-min candles, ticks, order book/buyers-sellers, volume, Nifty + sector indices, our trades, missed moves), extract what matters, and find how to move towards max profit / almost no loss — without the owner having to remind. Findings + proposals go to the owner with full numbers; only his "do it" changes live rules. No "foolish rules": every rule must be tested on data first and must beat costs.
0a. **STOCKS IN PLAY = new main paper strategy from Fri 23 Oct (owner "lets do it from tomorrow").** Runs on the laptop on live ticks (see 22 Oct night research). Old v4.2 keeps running in the app for comparison (~2 weeks), then off.
1. **Strong trends only.** Enter only where our rules predict a strong up-trend (BUY) or strong down-trend (SELL), using as many factors as needed. We assume a selected stock should move our way.
2. **Earn both sides.** BUY in rising markets; SELL first and buy back in falling markets (intraday short). Range stocks: buy near the bottom, sell near the top, repeatedly (rule C7).
3. **Liquidity.** Only trade where others take the other side: enough buyers when we sell, enough sellers when we buy (bid/offer gap, waiting quantity — order book recorded from 19 Oct).
4. **Exit = the NORMAL stop (owner, 21 Oct — buy-price stop REMOVED).** ~~Stop at the buy price from the start~~ was only a safety idea, never a decision rule; Claude misread it as a rule (16–21 Oct, 2 trading days: all 10 trades of 19 Oct exited at buy price in 1–4 min). Since 21 Oct paper trades use the rules' own stop (2×ATR, above resistance for SELL / below support for BUY), stop to break-even after +1R, trail after +1R, square-off 15:15. Losers lose more per trade (~Rs 500–900 vs ~Rs 145) — accepted, it is paper money and lets each prediction be tested properly.
5. **THE decision rule = did our predicted TARGET get reached** (before 15:15 and before the normal stop). Every rule change is decided only on this (see 7c) — NOT on how a stop behaves, NOT on exit tweaks. "Came close" (best %) is extra info only.
6. **If a pick goes against us with no outside reason, our rules were weak** → study it, improve the rules (learning loop F). Every change must work on days it was not built from (no over-fitting).
7. **Real money stays manual** until paper trading proves the rules (100+ trades, positive after costs).
   **Owner's decision (17 Oct):** paper trading only until the owner is satisfied. Real money, when it starts, = the OWNER places trades by hand from the app's alerts — **never automatic** — until he has made hundreds of successful manual trades. Even manual trades get a stop-loss order placed with Sharekhan at entry (L11). Track manual results next to paper results (same signal → compare fills and outcome).
7z. **Path to real money (owner's decision 17 Oct, Claude agrees):** (1) paper trading only — **manual real trades start only after HUNDREDS of paper trades have passed**: the rules improved until our picks are proven correct (target-reached rate meets the agreed level, see 7c) and the results are clearly profitable after all costs, and the owner is satisfied; (2) then real money **only MANUALLY** — the owner places each trade himself from the phone alerts (exact stock, entry, stop, target, quantity in the alert), starting very small, stop-loss order placed with Sharekhan immediately after buying, and every manual trade logged next to its paper twin; (3) **NO automatic real-money trading until the owner has made 100s of successful manual trades** — and even then only if he deliberately switches it on. Practical: during office hours some alerts will be missed — that is fine; only take A+/clear signals, never chase a price that already ran away.
7a. **Stocks with higher % movement (owner + Claude, 16 Oct):** look for stocks that move more % per day (e.g. 2–4% vs ~1% for the biggest stocks), at any price — cheaper stocks (incl. ₹200–500) often move more, but the price itself does not add profit (₹1 lakh in a ₹400 or a ₹4,000 stock earns the same per 1% move). Conditions: price ≥ ₹50, enough buyers/sellers (narrow bid-offer gap), not on exchange watch lists (ASM/GSM) or price-band locked, the move backed by real volume; same rupee risk per trade (fewer shares when the stock moves more). **Test on the 500-stock recordings (from 19 Oct): compare results by daily movement % and price band (₹50–200, 200–500, 500–2,000, 2,000+); give priority only to what earns more after costs.**
7a2. **Selection weight = expected profit ÷ risk (owner, 16 Oct):** when choosing between candidates, prefer the stock with more expected profit and less risk — expected profit = realistic move today (usual daily movement %) × chance our rules are right (its "target reached" record); risk = stop distance % and how easily we can exit (buyers/sellers). Price itself is not a factor (often the active ₹200–500 stocks win; a big stock moving strongly today can still win). **Every signal states why it was chosen** (e.g. "chosen over RELIANCE: usual move 2.8% vs 1.1%, target 2× risk, enough buyers/sellers, sector strong"). Explanation first (now); the new ranking becomes the rule only after it beats the current ranking on 2–3 weeks of 500-stock data.
7b. **Intraday only (owner reminder 16 Oct):** we are NOT long-term investors here — every position is closed the same day (square-off 15:15), nothing is held overnight, and intraday rules (tight risk, quick exits, same-day targets) apply, not long-term "wait and recover" thinking.
7c. **Decision B (16 Oct; updated 21 Oct: paper trades now use the normal stop, item 4).** For every trade the app records (1) **did the price reach our target** before 15:15 and before the normal (signal) stop — this is how we judge a prediction ("came close" is extra info only); (2) what the **normal stop** would have earned. After ~30 decided trades: **≥ 50% reached → predictions strong** · **< 40% → predictions weak → improve the selection rules** · 40–50% → both. Back-test baseline (10 days, 88 v4.1 picks): 32 reached the target = 36%.
8a. **Which stocks (owner 21 Oct, updated):** from 22 Oct the app scans ALL ~494 Nifty 500 stocks (owner: more stocks = we learn faster how well the rules predict). Sharekhan gave 6 days of 1-min/5-min history for all 494 (12-19 Oct) + own daily recordings. Liquidity / watch-list filter (L2) still to add before real money.
8b. **Daily routine (owner):** Sharekhan login before 09:00 (link: https://id-preview--0b7f6ea9-fd3b-48da-b4ea-ee41af1cab07.lovable.app/settings → Connect Sharekhan); laptop on, plugged in, signed in, Claude desktop app OPEN (otherwise Claude cannot reach the laptop). Claude: daily 15:45 review, Saturday weekly review, check-ins via scheduled tasks; phone alerts on ntfy (topic in chat only).
8c. **Laptop service is SEPARATE from this app** (owner, 18 Oct) — notes in /home/claude/laptop-service/NOTES.md / skill "laptop-service"; only when the owner says "laptop service".
8d. **Quality over quantity (owner, 21 Oct 09:50):** the goal is ~10 HIGH-CONVICTION picks a day that should give sure profits — picking 30–50 would mean we cannot predict properly. More picks only when the market is very good (strong trend day, many stocks moving with volume); fewer or none on flat days. Prefer stocks with high % move potential and volume (lower price is fine — % gain matters). Live max stays 10; the wider "all candidates" scoring is done OFFLINE (R&D) to learn what predicts, not to trade more.
8f. **How many picks (owner 21 Oct, clarified):** each time we predict, choose only the BEST stocks that pass every rule — fewer or more than 10 is fine; never "pick everything" (that means weak logic). Implementation: top 3 per scan, one per stock per day, safety cap 30 per day (not a fixed 10).
8g. **Rule v4.2 GAP HELD — ON TRIAL from 22 Oct** (owner "do it" 21 Oct 12:15): BUY only if today opened >= 0.5% above yesterday's close and the price is still above today's open (SELL mirror). Based on 4 days (14-19 Oct, 494 stocks): live picking +Rs5,765 / 23% target reached; all candidates +Rs16,286 / 29%. Review after ~10 trading days with full numbers -> owner decides keep/remove.
8h. **When the owner asks for the rules, give the 📋 CURRENT RULES quick list immediately** (owner, 21 Oct). Update that list whenever a rule changes.
8i. **Precise timing (owner 21 Oct 14:33):** ntfy alerts must come at the exact time things happen; if the owner trades manually, any delay is his responsibility; when automation is switched on later it must act precisely. => exits detected on 1-minute candles (from 22 Oct), next: tick-level instant alerts from the laptop feed; real money: stop/target orders at the exchange (L11).
8j. **EVERYTHING AT TICK LEVEL (owner 21 Oct 14:47):** "we are making it for real money, so the paper test must replicate the real trade". Target design: the laptop feed (ticks) runs the live entry triggers and exit rules on every tick with the SAME rule code; paper fills at the real bid/offer of the tick (BUY at offer, SELL at bid) + slippage; the app (cloud) stays the boss for stock selection, rules, records and screens; cloud 1-minute engine = fallback. **Owner's main aim (15:05):** decisions on LIVE data so we buy and sell at the RIGHT price; Claude, as the market expert, decides where candles are needed (prediction/selection) and corrects the owner's ideas when they have a downside. Agreed split: stock SELECTION on candles (incl. the live forming candle); TRIGGERS, FILLS and EXITS on live ticks. Plan T1 record all ticks daily -> T2 tick exit engine -> T3 tick entry triggers (app pre-qualifies candidates + trigger prices each minute, laptop fires on the tick) -> T4 validate on 1-min history + recorded ticks -> T5 before real money: always-on host (L12) + broker orders (L11).
8k. **Owner's goal (21 Oct 15:20):** very serious — build the app to make money for himself first; monetising the app for others is a far-future idea (needs a legal check first: SEBI rules for selling trading signals/advice (research analyst / investment adviser registration) and SEBI's retail algo-trading framework via brokers). Because he is serious: get years of 1-minute history (Zerodha Kite Connect, L5) soon for reliable proof.
8e. **Owner decides with ALL the data (21 Oct):** every rule decision goes to the owner with the full numbers — which days, how many stocks/trades, target-reached %, net after costs, results per day, what was left out and why, and how sure we are (sample size). No rule change without his "do it".
8. **Working style:** Claude acts as the market expert and says openly when the owner may be wrong; owner approves every live change ("do it"); credits used wisely (prepare in GitHub, one bundled Lovable message); every task given to the owner states its purpose; speed — don't wait where waiting isn't needed.

9. **TWO-PHASE STRATEGY — core intent (owner + Claude, 21 Oct 13:12).** We improve the app in two SEPARATE parts, each with its own scorecard:
   - **ENTRY (priority, ~70% of effort):** pick trades where the price really moves our way. Measured with ONE fixed exit: target reached %, best move our way vs worst move against (before the stop). Strong entry = context (market/sector with us) + strength (in play: gap held, volume, stronger than market) + location (near the level, no chasing) + confirmation (buyers/sellers) + timing.
   - **EXIT (protect what we earned):** keep most of the profit, keep losses small. Measured on the SAME fixed entries: % of the best move kept, average loss, how often a winner turned into a loser. Plan: (1) starting stop just beyond the level that proves us wrong, position SIZED so a stop-out loses only a small fixed Rs amount; (2) no-loss step at ~+0.5%; (3) profit-lock ladder; (4) trailing on structure; (5) reversal exit (alert trial from 22 Oct); (6) market-turn exit; (7) book half at +1R; (8) time exit (re-test).
   - Truths agreed: exits cannot create profit from a weak entry; "almost no loss" comes from SIZING + no-loss step, not from a stop at the buy price (19 Oct); small controlled losses are normal; keep rules simple; every rule must work on NEW days; owner approves with full data.

**Range trading — how we find and use it (owner's question 16 Oct, detail in C7):**
- *Before the day (multi-day):* each morning list stocks that ranged on recent days (price crossed VWAP many times, low efficiency, day's high-low mostly within a band, no news) — candidates, not trades.
- *Same day (confirmation):* from ~10:30, a stock that touched the top ≥ 2 times and the bottom ≥ 2 times, flat VWAP, band ≥ ~0.8% (to beat costs) = live range. BUY near the bottom on a rejection candle / SELL near the top, exits just inside the other edge, repeat (max 2 round trips).
- *Break of the range:* a 5-min close outside the band by more than a small buffer with volume ≥ 2× usual → exit range trades immediately and, if the break is in the market's direction, switch to the breakout setup.
- Test first on the 5-min history (13 days now, growing weekly + own recordings).

---

## 📋 CURRENT RULES — quick list (give this to the owner IMMEDIATELY whenever he asks for the rules; keep it up to date)

### 🟢 MAIN STRATEGY from 23 Oct: STOCKS IN PLAY (laptop, live ticks, paper)
**ENTRY**
E1. 09:15:00-09:19:59 = opening range (OR) of every stock: open, high, low, last price, volume traded.
E2. Liquidity: only stocks with median turnover >= Rs25 crore/day.
E3. Relative volume (rvol) = OR volume / the stock's own average OR volume (last 10 days). Must be >= 3x.
E4. At 09:20 rank by rvol, keep the TOP 10 (owner 25 Oct: Proposal B; was 15). Direction = OR close above open -> BUY; below -> SELL.
E5b. **RE-ENTRY with base-sign confirmation (owner 25 Oct 16:23 "do it"):** after a losing exit (trade never reached +1R), the stock re-arms when the price is back inside the opening range; if it breaks the level again before 10:15 AND at least 3 of the 6 base favour signs agree, (owner 25 Oct 16:35: 3 of 6 is enough - aggressive buyers NOT a must, after Claude's advice; to be re-checked with data), enter once more (same stop/size rules). Max 1 re-entry per stock. Phone: "🟢 NEW RE-ENTRY ...". Test 22-23 Oct (with B): no re-entry +Rs5,722, re-entry +Rs6,592; requiring aggressive buyers/sellers blocked the best re-entry in the no-B test (SWIGGY +Rs3,265) and gave WELCORP +724 instead of +870 - Claude's note; owner first made it a must, then chose 3 of 6 on Claude's advice (16:35). Only 2 re-entry cases so far - judge daily.
E4b. **PROPOSAL B (owner 25 Oct 15:59): skip gap-chasers** - a stock that opened > 1% beyond yesterday's close IN the trade direction is not traded (9 days: those 32 trades made ~0). Skipped gap stocks go to a SHADOW LIST (sip-state gapSkipped) - every review tests checks on them (owner: gap-up can still be strong; find the extra check that proves a good gap trade). Tested so far (32 trades): gap held, gap size, 10x volume, Nifty/yesterday direction - none clearly separates; best hint "yesterday closed near its high/low" (+2.5R vs -2.6R) - not proven. Yesterday's close per stock is stored in sip-baseline.json lastClose every evening. Direction = OR close above open -> BUY; below -> SELL.
E5. Entry window 09:20-10:15: BUY when the price trades ABOVE the OR high; SELL when it trades BELOW the OR low. Fill on the tick at the offer (BUY) / bid (SELL) + 0.02%. One trade per stock per day.
**EXIT**
X1. Stop loss = other side of the OR, kept between 0.5% and 1.5% (was 2%; owner "do it" 23 Oct 08:49) of entry. Size = Rs1,000 risk per trade (1R).
X2. No fixed target - winners run.
X3. Trailing stop: once the trade is +1R, the stop follows 1R behind the best price (at +2R the stop is at +1R, etc.).
X3b. **EXIT RULE "TRAILING STOP + SMART WARNING" (owner 25 Oct 14:11, live from Mon 26 Oct):** the smart warning runs inside the engine on 1-minute bars. If it fires on a trade that has been >= +1R, the trailing stop TIGHTENS from 1R to **0.3R behind the best price** (phone alert "⚠️ SMART EXIT ... stop tightened"). If it fires before +1R: phone alert only, the stop does not move. Signs (SELL; BUY = mirror): aggressive counter-trades, order book turned against us, counter-move on rising volume, through VWAP, structure turning, Nifty turning; 3 signs once in profit, 4 incl. flow/book before; not in the first 3 minutes; max once per 10 min. Replay 22+23 Oct: +Rs4,527 vs +Rs3,685 with the trailing stop alone (16 trades - keep checking daily).
X3c. **RULE (owner 25 Oct 14:43): trend back in our favour -> 1R again.** After a warning tightened the trail to 0.3R, the tightened stop is the REFERENCE (floor). When a closed 1-minute bar shows NO warning sign at all, trailing goes back to 1R behind the best price. The stop NEVER moves down: it stays at the reference until 1R behind the new best is higher. Phone: "🟢 TREND BACK in our favour ... trailing 1R again".
X3d. **RULE (owner 25 Oct 14:55): warning before +1R (e.g. in loss) -> stop moves to 0.3R from the CURRENT price** (never down), so if the move continues we exit with a small loss. Owner's reasoning: a warning built on volume + Nifty is genuine; such an exit means the entry decision was weak (or a rare sudden market turn) -> each case is reviewed daily and classified ENTRY FAULT / MARKET TURNED / FALSE ALARM (data\sip-warnings-DATE.csv). Claude advised 0.5R (22-23 Oct replay: 0.3R = +Rs1,390, 0.5R = +Rs5,438, no change = +Rs4,527); owner chose 0.3R. Watch it live.
X3e. Owner 25 Oct 14:57: ENTRY and EXIT rules stay SEPARATE. Re-entry after an exit is an ENTRY rule (proposal A) - parked until "let's do entry"; NOT in the engine.
X4. Everything still open is closed at 15:15.
X5. Costs 0.106% + slippage counted on every trade. Alerts on ntfy for picks, entries, exits, day summary.
*(The v4.2 rules below keep running in the app for comparison only.)*
*Rule set v4.2, live from 22 Oct 2026 (paper trading only, no real money). "ON TRIAL" = being tested, owner reviews with full numbers.*

**A. Which stocks are scanned**
1. All ~494 Nifty 500 stocks (from 22 Oct; before that 49 big stocks). Scanned in 5 groups, each stock checked every 5 minutes on 5-minute candles.
2. Indices (Nifty, Bank Nifty, sector indices) are recorded on the laptop for research.

**B. Prediction rules — a stock is picked only if ALL pass**
1. Time: new picks only 10:00–14:00.
2. Market direction: BUY only when the market (average stock) is up today; SELL only when it is down.
3. Relative strength: BUY only if the stock is up MORE than the market; SELL only if down more.
4. Key level: BUY only above yesterday's high; SELL only below yesterday's low.
5. Volume (any one): today's volume so far ≥ 1.2× usual for this time, OR the last candle ≥ 2× usual, OR volume rising 3 candles in a row.
6. Trend votes: trend + MACD + VWAP agree (≥ 2 for, none against); not choppy; no BUY when RSI > 75 / SELL when RSI < 25; score ≥ 60.
7. **GAP HELD — ON TRIAL (from 22 Oct):** today opened ≥ 0.5% beyond yesterday's close in the trade direction AND the price is still beyond today's open.
8. Today's data must start by 09:20 (else no picks that day).

**C. How many**
1. Each scan: only the best 3 that pass every rule (ranked by score). None pass → no pick. Best stocks only — fewer or more than 10 a day is fine, never "everything".
2. One pick per stock per day; one open trade per sector at a time (a waiting signal also holds its sector).
3. Safety cap 30 picks per day.

**D. Paper trade (automatic, no real money)**
1. Entry: first 1-minute price after the signal (+ slippage); full costs counted.
2. Stop: the rules' normal stop = 2 × ATR (min 0.25%) beyond entry. (Buy-price stop REMOVED 21 Oct.)
3. Target: 2 × the stop distance.
4. At +1R: stop to entry + costs (no loss); at +1.5R: lock +0.75R; trailing stop (1.5 × ATR) only after +1R.
5. Everything closed at 15:15 — nothing overnight.
6. Paper only: no daily loss stop, up to 30 open trades (research phase, 21 Oct).
7. **REVERSAL WARNING — ON TRIAL, ALERT ONLY (from 22 Oct):** on every closed 1-minute candle of an open trade, if 2+ signs appear — big candle against us (≥ 0.4%) on ≥ 2× volume / price back through VWAP after being ≥ +0.5% / gave back half the profit after ≥ +0.5% / lost the breakout level — send "⚠️ Reversal warning" on ntfy and record it. The trade is NOT closed; after ~2 weeks we check what happened after each warning.

**E0. Two phases (intent 9):** entry rules and exit rules are built and judged separately (entry: target reached %, best vs worst move; exit: % of profit kept, average loss, winners turned losers).

**E. How we judge (the owner's decision rule)**
1. A prediction is RIGHT if the price reached the target before 15:15 and before the normal stop.
2. After ~30 decided trades: ≥ 50% right = strong; < 40% = improve the selection rules; 40–50% = both.
3. Every rule change goes to the owner with ALL the data (days, trades, target-reached %, net after costs, per day, what was left out) → only his "do it" makes it live.

**D8. Fast exit (from 22 Oct):** a touch of the current stop/target is detected on every closed 1-minute candle (alert ~1 min after it happens); stop/lock/trail levels still move on closed 5-minute candles.

**F. Alerts on the phone (ntfy)**: trade opened / closed, reversal warning (trial), day summary, Sharekhan not connected (from 08:50), price feed off > 3 min, Claude's check-ins.

---

## ⚡ TICK-LEVEL LIST — to REVISIT with the owner (marked 21 Oct 15:12; owner says "tick list" or "revisit tick level")
Stock choosing (which stock, direction, trigger price) = candles incl. the live forming candle. Everything below = live ticks:
1. Entry: buy/sell the instant the price reaches the candidate's trigger price.
2. Fill price: the real price at that tick (BUY at the seller's price/offer, SELL at the buyer's price/bid) + slippage.
3. Stop loss: exit the instant the stop price trades.
4. Target: exit the instant the target price trades.
5. No-loss step and profit lock: stop moves up the instant the trade reaches +0.5% / the lock levels.
6. Trailing stop: follows the best price tick by tick.
7. Reversal warning: checked continuously, alert within seconds.
8. 15:15 close: at the exact time, at the live price.
9. ntfy alerts for all of the above within 1-2 seconds.
Status: T1 (record ticks) installed 21 Oct 15:40; T2 step 1 DONE 21 Oct evening: tools/live-feed/tick-exits.mjs (same exit rules on every tick, fills at bid/offer + slippage, target = limit) + test-tick-exits.mjs 7/7 - NOT yet wired; T2 step 2 BUILT 21 Oct 19:10 (owner 'ok do it' 19:04): feed-gateway actions open_trades / tick_stop / tick_close; paper-trader closes only if still OPEN (no double close/alert); feed.mjs runs the engine on every tick (TICK_EXITS=0 switches it off), ntfy straight from the laptop; tests: test-tick-exits 7/7, test-tick-e2e 4/4, e2e 11/11, watchdog 3/3, offline 23/23, paper-trader e2e all pass. DEPLOYED 21 Oct 19:25 (owner 'do it now'): feed-gateway + paper-trader redeployed (1 credit), laptop feed.mjs + tick-exits.mjs installed and verified identical (backup feed.mjs.bak-22oct). LIVE from Thu 22 Oct 09:00; T3 (tick entries) after entry rules show an edge (test tick vs candle entry first).

---

## 📦 WEEKLY HISTORY PULL — built 21 Oct night (owner "do it now")
- Every **Friday after the market closes**, the laptop feed pulls Sharekhan's last ~6 days of 1-min and 5-min candles for all stocks through the app (feed-gateway action `history`; the Sharekhan key stays in the app). Saved on the laptop as `data\history\hist-1minute-DATE.json.gz` and `hist-5minute-DATE.json.gz`. Fills gaps in our own recording (like 20 Oct). Force it any day with PULL_HISTORY=1.
- Needs Sharekhan connected that day; if not, it stops and logs "Sharekhan is not connected". Pulled once per day only. Code: tools/live-feed/pull-history.mjs (+ test, 4/4). Laptop files installed 21 Oct; backup feed.mjs.bak-hist. Lovable redeployed feed-gateway (1 credit, 21 Oct ~20:15).
- Claude's weekly job: copy the Friday files into the workspace and re-run the scorecards (no browser downloads needed any more).

## 🔎 22 Oct (evening) — Did the reversal warning work? (owner asked) — one day, 30 trades
Script: scratchpad rev.py (recomputed warnings from the laptop's 1-min candles; matched the app's recorded warnings exactly).
- Warning (2 signs) fired on 7/30 trades. Closing at the warning: total -Rs20,621 vs actual -Rs16,473 (**worse by Rs4,148**): it cut 2 winners (ABCAPITAL +1041 -> -312, SUZLON +308 -> -437) and closed 2 square-offs at worse prices; saved only Rs135-251 on 3 losers.
- 1-sign version: 13 warnings, total -Rs16,657 (about the same as actual, -Rs184): saves on 9, but cuts AARTIIND/ABCAPITAL winners to ~0.
- Market-turn exit (Nifty 0.3% off its extreme + stock back through VWAP): -Rs17,803 (worse by Rs1,330): saved ~Rs3,000 on the 10:00 batch of shorts, lost it on ABCAPITAL, ACMESOLAR, INDHOTEL, SUZLON.
- 20 of 22 stop-outs got NO warning (only CANHLIFE, PARADEEP did): most went against us within 3-15 min. No exit rule helps those -> the problem is ENTRY (yesterday-based direction, entering at the market low).
- Verdict: keep the warning as an alert only; do NOT make it an exit rule. Retest on more days. Fix entry first ("today only" direction).

## 🧪 22 Oct (night) — Owner: "use everything we have, act as the expert" → full re-think, tested on 8 days / 494 stocks (1-min)
Code: tools/backtest/v5/ (load.py builds 1-min data 12-22 Oct; sim.py = textbook pullback rules; sip.py = STOCKS IN PLAY). Costs 0.106% + slippage 0.02%/side, Rs1,000 risk per trade (1R).
**1. Textbook "today-only" pullback rules (day type from Nifty, strength since open, sector, VWAP pullback, candle + volume check, structure stop, half at 1R, time stop):** -16.6R (58 trades). Each ingredient helped (no market filter -29.5R, chasing -24.2R, no candle check -26R) but BEFORE costs only +3.4R: costs ate 20R because stops were tiny (median 0.47%). Lesson: with ~0.15% round-trip cost, small-move setups cannot win.
**2. STOCKS IN PLAY (what day-trading desks do; Zarattini & Aziz ORB research):** each morning rank liquid stocks (>= Rs25 cr/day) by RELATIVE VOLUME of the first 5 minutes vs their own normal; take the top 10 with rvol >= 3; direction = first 5-min candle; enter on the break of the 5-min opening range (until 10:15); stop = other side of the range (0.5-2%); after +1R trail 1R behind the best price; else exit 15:15.
   Result 13-22 Oct (7 days): **47 trades, 64% winners, +16.9R (~+Rs16,900), +0.36R per trade; build days 13-16 +10.7R, check days 19-22 +6.2R; 5 of 7 days positive, worst day -0.9R.** Still positive with slippage 0.10%/side (+12.7R). Market filter HURT (in-play stocks move on their own news). Spot-checked HINDZINC 21 Oct against raw candles: correct.
   Same days, live app: 21 Oct +Rs4,794, 22 Oct -Rs16,475; stocks-in-play: 21 Oct +6.5R, 22 Oct -0.9R.
   Caveats: 7 days / 47 trades = promising, not proof; entries 09:20-09:45 need tick-level speed; order-book filter not yet tested (only 3 days of book data).
**Claude's recommendation:** run STOCKS IN PLAY as the new paper strategy alongside (not mixed with) v4.2 for 3-4 weeks, then decide on numbers. Owner decides.

## 🟢 STOCKS IN PLAY — LIVE ON PAPER from Fri 23 Oct (built 22 Oct night, owner "do it from tomorrow")
- Laptop only (no app change, no Lovable credit): tools/live-feed/sip-engine.mjs wired into feed.mjs (errors caught - can never stop the price feed; SIP=0 in .env switches it off).
- 09:20 picks (ntfy "🟢 STOCKS IN PLAY ... watching N"), entries on ticks until 10:15 (ntfy "🟢 NEW BUY/SELL ..."), exits stop / trailing / 15:15 (ntfy "✅/🔻 NEW ... closed"), day summary on ntfy at the close.
- Files on the laptop: data\sip-baseline.json (relative-volume + turnover baseline, last 10 days, updated every evening), data\sip-state-DATE.json (restart-safe), data\sip-trades-DATE.csv.
- Tested: 17 offline checks (test-sip.mjs, also on GitHub), replay of 22 Oct's 3.07 million real ticks (replay-sip.mjs) = same 7 trades as the research. If the feed starts after 09:15:20 the day is skipped (no full opening range).
- The old v4.2 app paper trades + alerts continue for comparison (~2 weeks).

## 🔬 22 Oct night — first big variation test of STOCKS IN PLAY (62,208 versions, 13-22 Oct, 494 stocks, costs incl.)
Code: tools/backtest/v5/search.py + analyse.py. Build days 13-16, check days 19-22.
- The family is broadly profitable: 78% of all 62,208 versions made money overall (88% on build days, 51% on check days).
- KEEP (good): 5-min opening range (3 min alone worse on 19 Oct; 10 min worse), rvol >= 3, trailing stop 1R behind after +1R (no trail: check days +0.2R vs +6.1R), exit 15:15, no market filter.
- HURTS (reject): max stop 1.0% (-6.5R day), skipping gap-against stocks, 30-min time stop, top 5 only, 10-min range.
- No effect: no-loss step at 1R, last entry 9:45 vs 10:15 (all entries come before 9:45).
- BEST SMALL CHANGES (each improves BOTH halves): max stop 1.5% instead of 2% -> +21.3R, ZERO losing days; top 15 instead of 10 -> +21.0R. Both together -> 68 trades, 63% winners, +27.4R (vs +16.8R now), 0 losing days, worst day +0.3R, build +15.0 / check +12.4.
- Warning seen: versions picked only by the best build-day result (e.g. OR3/K15/stop1%) fell from +35R to +2-7R on check days = over-fitting. So only small, consistent changes are proposed.
- PROPOSAL to owner: stopMaxPct 2 -> 1.5 and topK 10 -> 15 (laptop only, sip-engine.mjs SIP_RULES). Needs "do it".

## 🎯 23 Oct 11:59 — Owner: build a SMART EXIT (separate from the trailing stop, which is good and stays)
Exit when the evidence says the move has turned against our trade (e.g. SELL trade but buying pressure rising). Factors to build + test on ticks/book:
1. Order flow: total buy vs sell quantity waiting (book) turning against us; best bid/offer quantities; upticks vs downticks weighted by volume (who is aggressive).
2. Counter-move volume: the move against us on rising volume vs our move on falling volume.
3. Momentum fading: no new extreme for N minutes, smaller swings in our direction, longer pullbacks.
4. Price structure: back inside the opening range, VWAP reclaimed against us, higher lows (SELL) / lower highs (BUY).
5. Market + sector: Nifty / sector index turning against us at the same time.
6. Combine into an exit-evidence score; exit only when several agree. Judge on ALL trades: loss saved on losers vs profit cut on winners (today the simple warning cut J&KBANK/NAM-INDIA -> must avoid early-wobble exits).
Data: ticks 22-23 Oct (+ every new day), per-minute book 19/21/22/23 Oct.

## ⚠️ SMART EXIT WARNING — live from 23 Oct 12:33 (owner "do it now, keep as warning, remove old warning")
- tools/live-feed/smart-warn.mjs (logic) + smart-watch.mjs (live watcher, own window INTRADAY-SMARTWARN, follows ticks/book/sip-state files; ALERT ONLY).
- 6 signs: aggressive counter-trades (tick flow), order book turned, counter-move on rising volume, back through VWAP, structure turning, Nifty turning. Before +1R: needs 4 signs incl. flow/book; after +1R: 3 signs (protect profit). Not in the first 3 minutes; once per 10 min per trade.
- Replay 23 Oct morning: total about equal to actual (-Rs66) vs old warning -Rs4,853; tuned on these 9 trades -> must be verified on more days.
- Old app reversal warning: phone alert OFF (paper-trader OLD_REVERSAL_ALERTS=false, deployed 12:31), still recorded.
- 23 Oct: started by hand (Claude via File Explorer). From 26 Oct the feed starts it every morning by itself (feed.mjs, one copy per day via logs\smart-warn-DATE.alive).
- Test on both tick days (live SIP trades 22 + 23 Oct, 16 trades): 9 warnings, 5 helped (+317, +1453, +199, +431, +200), 3 hurt (-344, -1418, -728). Net if exited at first warning: +Rs110 = NO real edge yet. Verdict: stays ALERT ONLY; re-test as tick days accumulate (needs ~50+ warnings).

## 📅 WEEKLY REVIEW Sat 24 Oct (stocks in play, 9 days 12-23 Oct, 76 research trades with live rules; laptop offline -> 20 Oct history not added yet)
Winners vs losers (R per trade):
- GAP is the strongest factor: stocks that GAPPED AGAINST our trade direction and then turned (with 3x+ volume) = 30 trades, ~80% winners, +25.7R. Stocks that gapped >1% IN our direction = 32 trades, ~0R (no edge) in BOTH halves (build +1.0R, check -1.2R). Expert reading: the edge is the opening REVERSAL after a gap (trapped traders), not chasing a gap.
- Against Nifty's first 5 min: 37 trades +27.2R; with Nifty: 39 trades +1.4R (same story - reversal stocks). A "trade with Nifty" filter is wrong (-7.5R).
- rvol 5-10x best (+0.49R/trade); entry 9:21-9:24 best; opening-range width: no clear pattern.
- Order book (4 days, 39 trades): when MORE buyers waiting in our favour (>1.25) trades LOST (-0.16R avg, 33% win) - crowd already positioned; small sample, watch.
Tests (filter applied before the top-K ranking):
- skip gap >1% with us + top 10: 46 trades, 74% winners, +31.7R (vs live 76 trades, 62%, +28.6R), build +18.0 / check +13.7, but 1 small losing day (-1.2R on 22 Oct). Fewer losing trades (12 vs 29).
- skip gap >1% with us, top 15: +26.2R (slots refilled with weaker stocks) - so K10 + gap filter go together.
- re-entry once after a stop (Fri): +35.3R vs +28.6R. Combination with the gap filter: test next.
Proposals to owner (needs "do it"): (1) one re-entry after a stop; (2) skip stocks gapped >1% in the trade direction + top 10.
Old v4.2 this week (app): 21 Oct +Rs4,794, 22 Oct -Rs16,475, 23 Oct -Rs9,306.

## 🧭 ENTRY DIRECTION (owner 25 Oct 15:14) - step by step, one change at a time
Owner: the 6 "favour signs" are the BASE for ENTRY and RE-ENTRY ("they tell us the market and our stock may go up"):
1 aggressive buyers (more volume on upticks), 2 book: buyers not draining away, 3 move up on rising volume, 4 price above day VWAP,
5 higher lows, 6 Nifty not falling against us (BUY; SELL = mirror). Entry and exit rules stay SEPARATE (exit uses the warning signs).
Next step: mix these with the current stocks-in-play entry, test each change on all tick days + 1-min days, one at a time, owner approves each.
Claude's cautions from data: trading only WITH Nifty hurt first entries (-7.5R / 9 days); crowd already waiting in the book (>1.25) went with losers.

## 🔬 25 Oct — ENTRY BASE RULES (favour signs) tested as an entry gate
- Built in the engine (entryBase, smart-warn.mjs favourFor), OFF pending the owner's decision.
- 9 days (76 trades), the 4 signs measurable on 1-min data at the breakout: trades WITH >=3 of 4 signs = +6.7R (48 trades); trades with fewer = +21.8R (28 trades). "Higher lows" present: +0.21R/trade vs absent +0.72R. "Nifty not against" present +0.31R vs absent +0.89R. VWAP: always present at a breakout (no filter).
- Tick days 22-23 Oct (all 6 signs): 3 of 6 any = no change (+10); 3 of 6 incl. aggressive buyers = -Rs2,073 (late entries, CYIENT turned loser).
- Reading: at the breakout the favour signs are almost always already there; when strongly aligned the move is often already extended -> late entry. Our edge = fresh reversals (gap against, first 5 min turn). So the signs do NOT help as a gate for the first entry. Possible better use: confirming a RE-entry, or sizing.
- Fix found while testing: smart signs now use bars from 09:15 (true day VWAP). Exit rule replay 22+23 Oct now +Rs1,729 / +Rs3,788 = +Rs5,517 (was +Rs1,390 with VWAP from 09:20).

### PRE-OPEN STUDY (owner 25 Oct 17:45: "super important data - all data + analysis, compute past weeks, monitor next week, decide next weekend")
- LIVE from 26 Oct: recorder writes data\preopen-DATE.csv 09:00-09:15 (price = indicated open, day volume, bid/offer, TOTAL BUY / SELL qty, circuits, prev close).
  Mon 09:22 check: confirm the file exists and has rows (does Sharekhan stream in pre-open? if not -> fix).
- PAST days (never recorded) -> proxy study tools/backtest/v5/preopen_proxy.py on 9 days, using what the pre-open leaves behind (opening price = auction
  price -> gap; 09:15 first minute = auction qty + first trades):
  * EARLY LIST: top 30 stocks by opening-minute volume at 09:16 already contain 82% of the 09:20 picks (top 20: 72%, top 10: 46%).
  * Picks (Proposal B, trail-1R) 46 trades +31.7R: gap AGAINST 31 trades 81% won +25.7R vs gap 0-1% our way 15 trades 60% +5.9R (confirms quality sizing);
    opening minute moved against us 82% won (not a reason to skip); mid opening volume best (81%, +17.2R), very high (>=8.3x) weakest (67%, +5.6R);
    opening minute >= 34% of the 5-min volume 83% won +19.3R vs 65% +12.4R. NO group loses -> no skip rule from the proxy; possible SIZE ideas only.
  * Older weeks: only 5-min candles for 49 Nifty stocks (28 Sep-6 Oct) - no pre-open, no 1-min opening print -> not usable for this.
- PRE-OPEN VIRTUAL TRADES (owner 25 Oct 17:57 "do it", MONITORING ONLY): tools/live-feed/preopen-shadow.mjs, SIP_RULES.preopenShadow=true.
  At 09:15 from the last pre-open snapshot: liquid stocks with buyers >= 2x sellers (BUY) / sellers >= 2x buyers (SELL), top 10 by imbalance -> virtual
  entry at the first tick from 09:15, stop 1%, Rs1,000 risk, same exit rule as live. Files data\preopen-picks-DATE.csv (every candidate >= 1.5x, with
  indicated gap), data\preopen-shadow-DATE.csv; ntfy day-summary line (says 'NO pre-open data received' if Sharekhan sends nothing in pre-open).
  Live trades proven identical on/off (23 Oct replay). Review daily; compare with the 09:20 picks; owner decides next weekend.
- PRE-OPEN DAILY: 26 Oct - pre-open data ARRIVES with buy/sell totals (Sharekhan streams it); but the internet dropped 09:04-09:13, so the snapshot = 09:14 only. Virtual: 10 trades, 1 won (HSCL BUY +Rs503), -Rs9,759: 8 SELLs on extreme seller imbalance (sellers 10x+) at a gap-down open -> the market reversed up; extreme imbalance WITH the gap looked like exhaustion (fade?) - 1 day only, watch.
- NEXT WEEK (live pre-open, every day in the 15:45 review): for every stock at 09:14:59: indicated gap, buy/sell imbalance, pre-open volume vs normal,
  change 09:07 -> 09:14. Test: (a) does the imbalance predict the 09:15-09:20 direction? (b) predict which stocks are in play (watch list ready at 09:15)?
  (c) losers vs winners among picks (imbalance against our direction?). Candidate rules to test next weekend: skip/size-down a pick whose pre-open
  imbalance is strongly against; size-up when gap-against + imbalance agrees with the turn; earlier entry list at 09:15. Owner decides.

## 📅 DAY-TYPE STUDY (owner 26 Oct 19:14: "bifurcate days, find what else can be extracted, make a list, revisit for rules later; act as market expert all the time")
Tool: tools/backtest/v5/daytype.py (+ breadth_test.py). Terms: TREND UP/DOWN day (close in top/bottom 25% of range, |move| >= 0.5%), NORMAL/RANGE (stays in 1st-hour range),
NORMAL VARIATION (1st-hour range broken one side), NEUTRAL (both sides, closes middle), REVERSAL (V / inverted V), GAP-AND-GO / GAP-FILL, CHOPPY (many VWAP crosses), INSIDE day.
| Day | Type | Nifty open->close | 1st-hr range | breadth up 09:30 / 10:15 / close | VWAP crosses | Our SIP (sim; 26 = live) |
|---|---|---|---|---|---|---|
| 12 Oct | TREND DOWN | -0.98% | 0.59% | 73 / 60 / 42% | 4 | (no baseline) |
| 13 Oct | TREND UP | +1.85% | 1.18% | 48 / 64 / 76% | 18 | 4 tr, 100%, +3.8R |
| 14 Oct | NORMAL VARIATION (quiet, 0.82% range) | -0.06% | 0.40% | 45 / 54 / 49% | 18 | 5 tr, 80%, +2.5R |
| 15 Oct | NORMAL VARIATION up | +0.82% | 0.83% | 39 / 58 / 47% | 9 | 9 tr, 89%, +9.1R |
| 16 Oct | TREND UP (after weak open) | +0.60% | 0.74% | 27 / 46 / 45% | 13 | 7 tr, 57%, +2.5R (buys +3.0, sells -0.5) |
| 19 Oct | TREND DOWN | -1.09% | 0.83% | 21 / 40 / 19% | 10 | 7 tr, 71%, +4.2R (sells +4.9, buys -0.8) |
| 21 Oct | REVERSAL down (up 0.36% at 9:30 -> -0.88%) | -0.88% | 0.83% | 52 / 18 / 13% | 1 | 8 tr, 75%, +7.6R (sells +9.4, buys -1.9) |
| 22 Oct | NEUTRAL / CHOPPY (-0.8% then flat) | -0.01% | 0.50% | 20 / 51 / 48% | 22 | 1 tr, -1.2R |
| 23 Oct | down day (-1.08% by 10:15) | -0.65% | 1.21% | 15 / 1 / 7% | 11 | 5 tr, 60%, +3.1R (live +Rs3,968) |
| 26 Oct | GAP-DOWN V-REVERSAL -> TREND UP | +1.09% | 1.41% | 46 / 89 / 82% | 19 | live 9 tr, 33%, -4.9R (buys -4.8R) |
FINDINGS so far: (1) we make money on trend and normal-variation days; losses come on choppy/V-reversal days (22, 26 Oct). (2) trades in the direction the market turns
make the money (sells on down days +4.9/+9.4/+4.2R, buys lose there). (3) BREADTH CLUE (strongest so far): trade WITH the 09:20 breadth (share of liquid stocks above
their open; >=50% = buyers' market) 29 trades 83% won +29.4R vs AGAINST 17 trades 59% +2.3R; build days with +12.0 / against +6.0, check days with +17.4 / against -3.7R
(81-85% vs 38%). 26 Oct: breadth 46% at 09:20 -> our 5 buys were AGAINST it and lost. Candidate (test, not live): size 0.5x against breadth. NOTE the old Nifty-direction
filter (-7.5R) was a different, rejected rule - breadth must be proven separately. (4) breadth at 10:15 matches the close direction on most days (21: 18% -> down,
23: 1% -> down, 26: 89% -> up, 13: 64% -> up).
INFORMATION LIST to extract (daily, for rules later): day type label; gap (median N50 stock gap); Nifty move at 09:20/09:30/10:15; breadth at 09:20/09:30/10:15 (all
liquid stocks, also by sector); 1st-15-min reversal flag; first-hour range size; VWAP crosses (choppiness); pre-open market-wide buy/sell imbalance; India VIX if in the
extras; our result by day type and by direction vs breadth; best/worst stocks of the day and whether we had them (missed moves).
RULE CANDIDATES to test when we revisit: R1 size 0.5x (or skip) trades against 09:20 breadth; R2 manage open trades with 10:15 breadth (let with-breadth winners trail
wider, tighten against-breadth trades); R3 re-entry only in breadth direction; R4 later entries only on trend days in the trend direction (late shadow data);
R5 pre-open market-wide imbalance -> gap-fill vs gap-and-go day; R6 choppy-day detector (VWAP crosses / opening reversal) -> trade smaller.
DAILY: add each new day to the table in the 15:45 review.

## 🔁 REVISIT LIST — "GAP-UP STOCK X" (owner 25 Oct 16:12: "this needs a different rule, remember it and we will revisit it")
Stock X type = opened > 1% beyond yesterday's close IN the trade direction + first 5 min continue that way on high volume (gap-and-go).
Now: skipped (Proposal B) and recorded daily in the shadow list (sip-state gapSkipped). Owner wants a SEPARATE rule for these later.
Stock Y type (gap against, then turns on high volume, break of the 5-min level) = KEPT, current entry.
When the owner says "revisit gap stocks" / "stock X": bring the shadow-list results + tests (so far 32 trades ~0R; hint: yesterday closed near its high/low).
Owner 25 Oct 16:18 - DAILY in the 15:45 review, for every X stock: simulate the trade our rules would have made; for the ones that WORKED, list everything that was in their favour (gap held, yesterday's close position + trend, volume 5-min/10x, Nifty + sector direction, aggressive buyers/sellers at the breakout, order book, VWAP, time of breakout, news-like volume) and compare with the X stocks that failed -> build the X rule from that.
### Stock X shadow results (daily; simulated with our rules, size 0.5x as quality sizing would give)
| Day | X stocks (gap with, rvol) | Traded | Won | Net | What was in favour (winners) vs failed |
|---|---|---|---|---|---|
| 26 Oct | 9: CASTROLIND S 1.6% 38.9x, AUBANK S 4.5% 10.6x, KEC B 5.0% 8x, SBICARD S 1.4% 6.9x, TORNTPHARM B 1.3% 6.6x, KOTAKBANK B 2.0% 5.1x, SHRIRAMFIN S 3.8% 5x, BANKINDIA S 2.2% 5x, INFY S 3.1% 3.3x | 5 (CASTROLIND, AUBANK, SHRIRAMFIN, BANKINDIA, INFY - all SELL gap-downs) | 0 | -Rs2,717 (0.5x) | all 5 gap-down SELLs failed: the market reversed UP after 09:25 (V-day). Best R: CASTROLIND 0.96, SHRIRAMFIN 0.39, AUBANK 0.36. No winners yet to compare. |
NEXT WEEK (26-30 Oct) focus: (1) run Proposal B live on paper; (2) monitor WHERE B FAILS (every losing B trade: why - entry fault / market turned / false alarm) to prune it further; (3) the X-stock study above. Report both in every daily review and the Saturday review.

## 🧠 EXPERT AUDIT (Claude, 25 Oct 16:40) - standing work list (status updated in reviews)
1. DATA: only 9 days of 1-min -> results uncertain. Get months of history (Zerodha Kite Connect), keep daily recording. [todo: sign-up steps]
2. PRE-OPEN 09:00-09:15 [DONE 25 Oct: recorder writes data\preopen-DATE.csv from Mon 26 Oct - price, volume, bid/offer, buy/sell waiting, circuits, yesterday close]. Study once a few days are recorded.
3. POSITION SIZE by setup quality. [LIVE from 26 Oct, owner "yes" 16:51; TESTED 25 Oct, tools/backtest/v5/audit.py, 9 days, live entry B+top10, trail 1R] base +31.7R (46 trades, worst day -1.2R). 1.5x risk for gap-reversal stocks with rvol>=5x, 0.5x for stocks gapped 0-1% our way, 1x others: +39.9R, per-R-risked +0.79 vs +0.69, worst day -0.6R; better on build days (+20.6 vs +17.9) AND check days (+19.3 vs +13.7). -> PROPOSED. (1.5x all reversals: +44.5R but more risk.)
4. EXPOSURE CAP per direction. [TESTED] max 3 open same direction: +27.0R (worse); max 5: no change. -> rejected for now.
5. AFTERNOON setups [TESTED 25 Oct, afternoon.py]: day high/low break after 13:30 -1.6R, 11:30-13:30 range break -3.1R, VWAP reclaim -7.2R (all lose, 33-43% winners) -> rejected; stay morning-only.
6. PARTIAL PROFIT booking. [TESTED] half at +1.5R: +27.3R, +2R: +30.6R, +3R: +32.0R vs +31.7R -> no gain, rejected.
7. SAFETY: circuit limits now read from the feed (parse.mjs upCkt/loCkt/prevClose). Engine rule circuitSafety (skip entry if the circuit in our direction is < 2% away) LIVE from 26 Oct (owner yes 16:51). ASM/GSM/F&O-ban lists: need a daily NSE source - todo. Spread/depth check: todo.
8. Old v4.2 paper trading SWITCHED OFF (owner yes 16:51; paper-trader V42_PAPER=false, redeployed by Lovable 25 Oct 16:55 from 18fff76, 1 credit; verify Mon 26 Oct: no new v4.2 paper trades). Feed/Sharekhan health alerts stay.
9. LATE STOCK IN PLAY (owner question 16:51): a stock whose 5-min volume suddenly spikes to 5-10x at any time of day (news) - not caught now (picks only at 09:20). TESTED 25 Oct (tools/backtest/v5/late*.py, 9 days, 1-min, costs in): REJECTED for now. 576 variants of spike from 10:15: only 24% profitable, median -6.7R (early spikes = noise). Spikes from 11:15-13:15 only: 180 variants, 38% profitable, median -2.5R; good only in a narrow 12:00-13:00 window (best cell +12.7R on 24 trades, but the neighbours lose) = luck, not a rule. Compare SIP morning: 78% of variants profitable. Next: shadow-record afternoon spikes live (no trades) and retest when we have 20+ days. OWNER IDEA 25 Oct 17:13: later entries only when entry rule (spike + break) AND base favour signs agree, exits unchanged. Tested (late4.py, 5 of 6 signs - book not in 1-min data): no gate 53% of variants profitable, median +0.9R; >=3 signs 50%, +0.2R; >=4 signs 67%, +1.7R (best); all 5 39%, -4.0R. Win rate stays ~48%: the signs help a little, not enough for a rule. OWNER 17:14: MONITORING ONLY, not a rule; analyse and decide next weekend (31 Oct/1 Nov). Plan: shadow log on laptop = virtual trades (spike + break + all 6 live signs incl. book/flow), same exit rules, no paper trades. BUILT + INSTALLED 25 Oct 17:30 (owner 'do it' 17:19): tools/live-feed/late-shadow.mjs, SIP_RULES.lateShadow=true. Spike from 10:15-14:30 bars = 5-min volume >= 3x normal (median turnover/price/375*5) + move >= 0.3%; break within 15 min; virtual trade for EVERY break with its sign score; rule_ok = spike >= 5x AND >= 4 of 6 signs. Files data\late-spikes-DATE.csv, data\late-shadow-DATE.csv; day summary line on ntfy. Proven harmless: replay 22+23 Oct live trades identical with shadow on/off. Replay of the shadow itself 22+23 Oct: 204 virtual trades, 28% won, -Rs105.9k; rule_ok 49, 35% won, -Rs23.6k; rule_ok after 11:00: 24, 33% won, -Rs9.3k (early evidence AGAINST later entries). LATE SHADOW DAILY: 26 Oct live: 87 virtual, 39 won, -Rs12,126; rule_ok 15, 5 won, -Rs8,146; by spike time 10:15-11 -Rs14,463 (36), 11-12 -Rs903 (16), 12-13 -Rs1,858 (16), 13-14:30 +Rs5,098 (19); by signs 3: -Rs1,404 (12), 4: -Rs9,404 (22), 5: -Rs4,484 (29), 6: +Rs3,142 (23). DAILY REVIEW 26-30 Oct ALSO: stage data\late-shadow-DATE.csv + late-spikes-DATE.csv, add a row per day (n, rule_ok n/won/net, by time bucket, by sign score); WEEKEND 31 Oct/1 Nov: owner decides later entries with these numbers.

### E5b RE-ENTRY RULE v2 (owner 26 Oct 18:05 + 'do it' 18:28, LIVE from 27 Oct)
One re-entry per stock after a losing exit (best < 1R), re-armed when the price is back inside the opening range, break again before 10:15 AND SIGN 3 ON TIME is a MUST (volume of the last 60 s incl. the minute in progress >= 1.5x the stock's median minute volume since 09:20, price moved our way over the last ~2 min; checked on every tick) + at least 3 of the other 5 signs (flow, book, VWAP, lows/highs, Nifty). Old sign 3 (3 closed minutes vs whole-day average, up to 2 min late) kept only as 'slowVolume' for comparison. Replay 22/23/26 Oct: 0 / -Rs365 (WELCORP waited 12 min) / 0 vs old rule. ENTRY MONITOR: every first entry records sign3_burst_plus3 (would it pass this rule?) in sip-trades CSV -> decide for entries next week.

### EXIT TEST 26 Oct (owner option 2: 'volume faded' sign) - tools/live-feed/smart-warn.mjs fadeOn/fadeAlone (OFF by default), tools/backtest/replay-rules.mjs
fade = last 3 closed minutes average volume < 0.6x the stock's median minute volume since 09:20 AND no progress our way in those 3 minutes.
Replay 22/23/26 Oct (17 trades): now +Rs3,658 | fade as 7th sign +Rs4,157 | fade counts as order-flow: same | FADE ALONE while in loss (R<=0) -> stop 0.3R from price: +Rs5,122 (+Rs1,463; 26 Oct -4,067 vs -5,508; avg loss -848 vs -969; biggest -1,652 vs -1,702; no day worse) | fadeX 0.5 same | only below -0.3R: +Rs4,258. Trades changed: J&KBANK re -1,702 -> -861, INDUSINDBK -544 -> -314, SWIGGY re +492 -> +862. OWNER 'do it' 26 Oct 18:48 -> LIVE from 27 Oct (SMART fadeOn/fadeAlone true, fadeX 0.6, fadeAloneR 0); replay with it on: 22 -86, 23 +9,274, 26 -4,067. Exit rule X3f. Review every fade exit daily (did the trade recover after?). OWNER IDEA 26 Oct 18:58: fade ALONE also on winners -> trail 0.3R. TESTED (fadeAloneProfit, off): 3 days +Rs2,782 vs +Rs5,121 (-Rs2,339): cut J&KBANK 23 Oct at 2.06R (+Rs2,325) instead of 4.2R (+Rs4,622), HAVELLS 3,454->3,120; quiet pauses on winners are normal. Claude advised NO; not live.

## 🔍 SIGNS-AT-ENTRY STUDY (owner 25 Oct 16:35) - for pruning entry + re-entry
Every trade (first entry AND re-entry) now records the 6 favour signs present at entry (data\sip-trades-DATE.csv: signs_at_entry, reentry, gap_with_pct, tightened). Daily review: compare trades that went UP (winners, best R) with those that went DOWN - which signs (or other factors: gap, rvol, time, range width, market, sector) were present in each group; especially re-entries that matched 3 signs and still failed. Goal: prune the rule (which signs must be present). Weekly review: the table across all days.

Day table (signs at entry -> result):
| Day | Winners (signs) | Losers (signs) | Note |
|---|---|---|---|
| 26 Oct | IDFCFIRSTB S flow+book+vwap+market; SWIGGY B(re) flow+book+vwap+lows+market; CGPOWER S book+vwap+lows+market | J&KBANK B ALL 6; SWIGGY B flow+book+vwap+lows; BELRISE S 5 (no volume); BPCL B 5 (no lows); INDUSINDBK B 5 (no volume); J&KBANK B(re) 5 | losers had MORE signs (avg 5.2) than winners (4.3) - the opening dip hit all BUYs; signs do not protect against a market turn. |

## ⏸ ENTRY WORK PARKED (owner 25 Oct 14:26): "first let me complete the EXIT, then we work on ENTRY - when I say let's do entry, remind me"
When the owner says "let's do entry": remind him of the pending entry proposals from the 24 Oct weekly review:
A = one re-entry after a stop-out (+Rs35,300 vs +Rs28,600 on 9 days); B = skip stocks gapped >1% in the trade direction + top 10 + re-entry (47 trades, 74% winners, +Rs32,200, 12 losing trades vs 29) - Claude recommends B. Also the order-book finding (crowd already on our side -> trades lost).
Until then: no entry changes; focus = exit rule "trailing stop + smart warning".

## 📝 LATER WORK LIST — Claude must remind the owner of these (added 17 Oct)
| # | Item | When / trigger |
|---|---|---|
| L1 | **Delivery / trade-to-trade (T2T) stocks** — owner wants to look at this later: T2T stocks allow no intraday (full payment, shares arrive T+1, sell from next day, no short selling, same-day sell = short-delivery auction penalty). Possible separate "short-term delivery" strategy, NOT intraday. For now our intraday rule skips them (C2). | After the intraday rules are proven (stage 5) — remind the owner |
| L2 | **Watch-list filter** (ASM/GSM, T2T, F&O ban, Sharekhan intraday-blocked) — build when scanning the 500 stocks | Before the 500-stock scan goes live |
| L3 | **Range trading v2** (multi-day range list, ranges held ≥ 2 h, bands ≥ 1.2%, flat-market days only) | When 2–3 weeks of 500-stock recordings exist |
| L4 | **Ranking by expected profit ÷ risk** (intent 7a2) + compare by daily movement % and price band (7a) | After 2–3 weeks of 500-stock data |
| L5 | **Years of 1-minute history** (Zerodha Kite Connect ~₹500/month, or Angel One) — owner prefers no hassle for now | If the rules look promising and we want faster proof |
| L6 | **Sharekhan support questions** (longer history? date range? max stocks per stream? Nifty code?) — owner to send | Any time |
| L7 | **Lovable support**: GitHub-push builds fail since 6 Oct though the code builds cleanly on GitHub Actions (4 ways) | Optional; screens now on GitHub Pages |
| L8 | **~200 F&O stocks for signals** (past-candle store + scout change; one Lovable message) | After v4.1 is live and stable |
| L9 | **Nifty / sector index prices**: verify they arrive via "NC<code>" (Mon 19 Oct check), then use Nifty for the market filter and as a market-fall exit | Mon 19 Oct, then build |
| L11 | **MUST before real money — stop order at the broker:** right after every real entry, place a stop-loss order with Sharekhan (sits at the exchange, works even if laptop/app/internet fail); our app only MOVES it up (break-even, profit lock, trailing). | Before stage 6 (first real trade) |
| L12 | **MUST before real money — reliable feed:** move the price feed from the laptop to an always-on cloud computer (or add a backup); 16 Oct showed a laptop restart stops everything. | Before stage 6 |
| L13 | **MUST before real money — risk guards:** block watch-list stocks (L2), stop all trading after the daily loss limit, max open trades / money at risk, warning before risky orders (like Zerodha's Nudge). | Before stage 6 |
| L14 | Nice to have: tax and P&L reports (like Zerodha Console); buyers/sellers (order-book) view per signal. | Later |
| L15 | **Tick-level list (⚡ section above)** — owner marked it to revisit | When the owner says "tick list"; T1 tonight, T2 next |
| L10 | Small fixes: `start-feed.bat` uses `>/dev/null` (old start-feed only); old `stocks` price strip is stale (fed by an old job); clean up old `live_candles` rows monthly (database size) | Low priority |

---

## 🧭 AGREED PLAN — strategy & build order (agreed 2026-10-08, READ THIS FIRST)

**Goal:** maximum money = highest profit per rupee risked, with a worst case small enough to keep trading through bad weeks. Real money only after paper trading proves it.
**Standing rules:** (1) no rule goes live unless it improved BOTH back-test data sets and both halves; (2) the owner approves every change to live rules; (3) re-run the back-test weekly as live days accumulate; (4) every stage ends with a gate — don't start the next stage until it passes; (5) update this section when a stage finishes.

| Stage | When | What gets built / done | Gate to pass |
|---|---|---|---|
| **0 — Plumbing check** | Thu 8 Oct, market hours | Reconnect Sharekhan before 09:00, ONE feed from ~09:00, dry run ~09:30 (current scout, no rule changes). Owner: tell Claude the real Sharekhan intraday brokerage rate | Live prices match the app; scout reads live candles without errors |
| **1 — Rule set v4 live (watch/paper only)** | Thu 8 Oct evening – Fri 9 Oct | **Also Thu evening (agreed 8 Oct):** expand the scout universe + feed from 49 to ~200 liquid F&O stocks (feed-gateway allowlist, scrip codes, scout batch cap, history) so Friday's feed records 200 stocks — only if Thursday's dry run passes. Build v4 into `scout-signals` as switches (same code as the back-tester): market filter, relative strength, beyond yesterday's high/low, volume (day ≥1.2× OR burst ≥2× OR rising 3), entries 10:00–14:00, top 3, 1 trade/stock/day, max 10/day, −Rs 2,000 day stop, stop 2×ATR / target 2R, profit lock (no-loss at +1R, +0.75R at +1.5R), trailing 1.5×ATR, square-off 15:15. Lovable deploys; create the every-minute job. **Feed:** start SAVING order-book fields (total buy/sell qty, best bid/offer) and index prices (Nifty 50, Bank Nifty, sector indices, India VIX — Sharekhan codes to be verified) | Signals page fills by itself; signals match what the back-tester would pick on the same candles |
| **1b — AUTOMATIC paper trading (owner, 8 Oct)** | Fri 9 – Mon 12 Oct (moved forward from stage 4) | A `paper-trader` function run every minute 09:15–15:30 by a scheduled job, no human needed: opens a paper trade for every new signal (fill = next live price + slippage + full costs), manages it every minute with the SAME exit rules as the back-test (initial stop, profit lock, trailing, 15:15 square-off, daily loss stop, max open/per day), closes trades when signals change or exits trigger, and writes everything to the journal. **REAL-MONEY trading stays MANUAL** — the app never places a real order unless the owner deliberately switches that on later (stage 6). Owner only checks results (phone is fine) | Paper trades open/close by themselves through a whole day; journal and P&L match the rules |
| **2 — Whole-market funnel** | Weekend 10–11 Oct | Daily "tradeable list": scan ALL NSE stocks, keep liquid ones (avg turnover ≥ Rs 20–50 cr, price ≥ Rs 50), exclude ASM/GSM, trade-to-trade, F&O ban, non-intraday stocks (data sources to confirm) → ~300–600 stocks; feed expanded to that list (test Sharekhan's ~1,000-symbol cap); history download (30-min + daily) for the wide list; stock → sector map | Feed runs a full day on the wide list without gaps; tradeable list refreshes each morning |
| **3 — Strategy v5 rebuild (back-test)** | Week of 12 Oct | Replace the generic RSI/MACD vote with 3 explicit setups: (a) momentum breakout of stocks in play (yesterday's high/low, opening range, VWAP reclaim), (b) VWAP pullback in a trending stock, and (c) **range trading (owner's idea, 8 Oct): stocks that loop between price X and Y** — detect a range with ≥ 2 touches at the top and bottom, flat VWAP, low efficiency ratio; BUY near the bottom on a rejection candle with selling volume drying up, target just below the top; SELL near the top the reverse; stop just outside the range; only if the range is wide enough to beat costs (≥ ~0.8%); if the range breaks with volume, switch to the breakout setup. **Both directions (owner, 8 Oct):** at X buy → exit near Y; at Y, only on a rejection candle, also open a SHORT → cover near X, and repeat. Limits: max 2 round trips per stock per day (each touch makes a break more likely), stop the stock for the day after one stop-out, each flip must clear costs, short side only when the market filter is not strongly up (long side only when not strongly down), shorts only in stocks allowed for intraday shorting; the 'one trade per stock per day' rule does not apply to this setup. Used mainly on range days (day-type detection). NOTE: today's chop filter SKIPS exactly these stocks. Rank by setup quality (unusual volume × relative strength × stop distance). Thesis stops (exit when the level/VWAP/market breaks; ignore dips that hold). Book half at 1.5–2R, trail the rest. Risk-based position size (same rupee risk per trade). Sector rotation (strongest stock in strongest sector / weakest in weakest), max 2 trades per sector, day-type detection (trend vs range day), avoid first 15 min and lunch chop, daily trend from real daily candles. Walk-forward test vs v4 on the wide universe | v5 beats v4 on both data sets and both halves, with a smaller worst losing run |
| **4 — Paper trading + journal** | Week of 12–19 Oct (parallel to 3) | Paper-trade engine: next-price fills + slippage + full costs, trade journal (every signal/trade with its reasons and indicator snapshot), results screen (win rate, avg win/loss, net per trade, drawdown, by setup/hour/sector). Pre-market plan (Gift Nifty, pre-open data) and stocks-in-play scanner (gap, unusual volume, NSE announcements/results) — data sources to confirm | Paper results tracked automatically every day |
| **5 — Prove it** | 2–4 weeks of paper trading | Weekly re-test on the growing data; evaluate order-book pressure and index/sector/VIX context on the recorded data; keep only what helps | Positive net result after costs over 100+ paper trades, worst losing run acceptable |
| **6 — Real money, small** | After stage 5 passes | Order placement via Sharekhan with manual confirm, smallest size, daily and weekly loss limits; check SEBI/Sharekhan rules for API trading first | Live results match paper results |
| **7 — Scale** | Later | Move the feed to an always-on server; ML on the journal data; size up slowly; multi-user only after legal check | — |

**Decisions needed from the owner:** ~~brokerage rate~~ → 0.03% per side (decided 8 Oct) · trading capital and risk per trade (Stage 3) · short selling allowed? (assumed yes, intraday) · use intraday margin/leverage? (not before Stage 6).
**Ideas parked for later (agreed useful, not scheduled):** limit-order execution rules · weekly loss limit · bigger size for A+ setups · ML model.

---

## 📘 RULEBOOK — every trading rule we decided, by implementation stage (2026-10-08)

This is the single list of rules. Evidence for each tested rule is in the dated back-test sections further down. Earlier lists (the 19-item "strengthening plan", the phase backlog) are folded in here. Status: ✅ IN (tested, kept) · ❌ OUT (tested, dropped) · 🔜 TO BUILD/TEST (stage shown) · 👁 LIVE-ONLY (cannot be back-tested; judge on paper).

### A. Rule set v4 — tested, goes live in Stage 1 (watch/paper only)
Back-test v4 vs the original rules: 5-min (4 days) +Rs 5,452 vs −Rs 47,771 baseline · 30-min (20 days) +Rs 14,232 vs −Rs 43,366. Small sample, many variants tried → paper first.

| # | Rule | Exact setting | Status |
|---|---|---|---|
| A1 | Timeframe | 5-minute candles, scout re-runs every minute (includes the forming candle) | ✅ |
| A2 | Market filter | BUY only when the market (average of scanned stocks, later Nifty) is up on the day; SELL only when down | ✅ best single rule |
| A3 | Relative strength | BUY only if the stock is up more than the market; SELL only if down more | ✅ |
| A4 | Key level | BUY only above yesterday's high; SELL only below yesterday's low | ✅ |
| A5 | Volume (mandatory, any one) | today's volume so far ≥ 1.2× its usual by this time of day (5-day average) OR the last candle ≥ 2× usual for its slot (burst) OR slot volume rising 3 candles in a row with today ≥ 1.0× | ✅ |
| A6 | Direction votes | trend + MACD line + VWAP, ≥ 2 agree, none against; chop filter (efficiency ≥ 0.3); RSI guard (no BUY > 75, no SELL < 25) | ✅ kept for now — **weak on its own (zero edge before costs); replaced by setups in Stage 3** |
| A7 | Entry time | new entries only 10:00–14:00 | ✅ |
| A8 | How many | top 3 per decision · one trade per stock per day · max 10 trades per day · max 10 open | ✅ |
| A9 | Daily loss stop | no new trades after the day's closed trades lose Rs 2,000 | ✅ safety |
| A10 | Entry price | next candle's open (no chasing the signal candle) | ✅ |
| A11 | Initial stop / target | stop = max(2×ATR, 0.25%) ; target = 2× the stop distance | ✅ |
| A12 | Profit lock | at +1× stop distance → stop to entry + costs (no-loss); at +1.5× → lock +0.75× | ✅ owner's idea, raised win rate to ~60% |
| A13 | Trailing stop | stop follows the best close by 1.5×ATR, never loosens | ✅ |
| A14 | Square-off | everything closed at 15:15 | ✅ |
| A15 | Costs in every test | brokerage 0.03%/side (owner confirmed 8 Oct: use 0.03%), STT, exchange, SEBI, stamp, GST, slippage 0.02%/side | ✅ |

### B. Tested and dropped (can be revisited with more data)
| Rule | Why out |
|---|---|
| Old volume rule (last 2 candles vs previous 20 of the same day) | measured time of day, not interest → replaced by A5 |
| "Volume rising candle-to-candle" alone; ranking by volume | hurt / no effect |
| Time stop (all, 90/180 min; losers-only 60/120 min) | always worse — trades need time to reach target |
| Exit at first weakness (reversal candle / below VWAP; volume fade) | exited too early, price usually continues → replaced by A12 profit lock |
| Daily trend from a 5-day average | worse — too crude; **re-test with real daily candles in Stage 3** |
| Gap filter (skip >1.5% gaps) / trade only if gap holds | no effect |
| Opening-range breakout (as filter or as alternative level) | inconsistent between data sets → off |
| Yesterday's-close filter | inconsistent → replaced by A4 |
| Entry window starting 09:30 | no help; 10:00 start is better |

### C. To build / test, by stage
**Stage 1 (Thu 8 – Fri 9 Oct)** — put section A into `scout-signals` as switches (same logic as the back-tester); every-minute job; feed starts SAVING: total buy qty / total sell qty, best bid / offer, and index prices (Nifty 50, Bank Nifty, sector indices, India VIX — codes to verify). 👁 Alerts on the Signals page when the feed stops or the Sharekhan login expires.

**Stage 2 (weekend 10–11 Oct) — whole-market funnel**
| # | Rule |
|---|---|
| C1 | Scan ALL NSE stocks every morning; keep tradeable ones: average daily turnover ≥ Rs 20–50 crore, price ≥ Rs 50 |
| C2 | Exclude ASM/GSM lists, trade-to-trade series, F&O ban list, stocks Sharekhan does not allow for intraday (data sources to confirm) → ~300–600 stocks |
| C3 | Feed on the whole tradeable list (test the ~1,000-per-connection cap); history download (30-min + daily) for back-tests; stock → sector map |

**Stage 3 (week of 12 Oct) — strategy v5 (back-test against v4; keep only what wins on both data sets and both halves)**
| # | Rule |
|---|---|
| C4 | **Stocks in play first:** shortlist 20–40 stocks with unusual volume + gap / news / new high-low + strength vs market and sector; full analysis only on these, trade the top 3 |
| C5 | **Setup 1 — Momentum breakout:** stock in play breaks a key level (yesterday's high/low, opening range, VWAP reclaim) with volume, in the market's and sector's direction |
| C6 | **Setup 2 — VWAP pullback:** trending stock dips to VWAP on falling volume, bounces on rising volume |
| C7 | **Setup 3 — Range trading (owner's idea):** stock looping between X and Y (≥ 2 touches each side, flat VWAP, low efficiency). BUY near X on a rejection candle with selling volume drying up → exit just below Y; at Y, only on a rejection candle, SHORT → cover just above X. Max 2 round trips per stock per day; after one stop-out stop that stock for the day; stop just outside the range; range ≥ ~0.8–1% to beat costs; short side only if market not strongly up (long side only if not strongly down); shortable stocks only; if the range breaks with volume → switch to Setup 1 in that direction. "One trade per stock per day" does not apply |
| C8 | **Day type:** detect trend day vs range day (first hour range + how many stocks rise vs fall). Trend day → setups 1–2; range day → setup 3; unclear → trade less |
| C9 | **Ranking by setup quality:** unusual volume × relative strength × closeness of the logical stop (replaces the RSI/MACD points score A6) |
| C9b | **Confidence grade (owner asked 8 Oct for 'sure' stocks — nothing is sure, so show agreement):** A+ = every rule agrees (market, sector, volume burst, key level, in play); A = most agree; B = watch only. Trade A+/A; later slightly bigger size for A+. **Timing with ~600 stocks:** feed real-time; history fetched once pre-market (~08:45, ~5 min); signals within ~1 min of each 5-min candle; pre-market watchlist 09:00–09:15; first tradeable signals ~09:45–10:00 |
| C9c | **Early A+ list (owner, 8 Oct):** 09:20–09:45, flag the 2–3 stocks where rules already strongly agree (gap with market + sector, first-candle volume ≥ 3× usual, beyond yesterday's high/low, holding above open and VWAP). Entry only for A+, only on the first pullback that holds or the opening-range break, never the first candle. Back-test first (early entries lost most in v1–v3); if it doesn't earn, the early list stays watch-only |
| C10 | **Thesis stops:** stop where the idea is proven wrong (back below the breakout level / VWAP / range edge, or the market turns); dips that hold the level are ignored |
| C11 | **Let winners run:** book half at 1.5–2× the stop distance, stop to no-loss, trail the rest to the structure break or 15:15 |
| C12 | **Position size by risk:** same rupee risk per trade (0.5–1% of capital — owner to decide); tight stop = more shares |
| C13 | **Sector rotation:** BUY the strongest stock in the strongest sector, SELL the weakest in the weakest; max 2 open trades per sector |
| C14 | **Higher timeframe:** trade 5-min setups only in the direction of the hourly and daily trend (re-test daily trend with real daily candles, 20-day average) |
| C15 | **Avoid times:** first 5–15 minutes, lunch chop (~12:30–13:30, to test), results/news minutes for that stock |
| C16 | **Over-fitting guard:** tune on earlier days, judge on later unseen days (walk-forward); keep only rules that win in both halves |

**Stage 4 (week of 12–19 Oct) — paper trading + journal**
| # | Rule |
|---|---|
| C17 | Paper fills at the next real price + slippage + full costs — **automatic, runs all day without the owner (built in stage 1b)**; real money manual only |
| C18 | Journal: every signal and trade with its reasons and an indicator snapshot (training data for ML later) |
| C19 | Results screen: win rate, average win/loss, net per trade, worst losing run, by setup / hour / sector / day type |
| C20 | 👁 Pre-market plan 09:00–09:15: Gift Nifty, global cues, pre-open data → watchlist before the bell (data source to confirm) |
| C21 | 👁 News / results / announcements feed for "in play" (NSE announcements — source to confirm) |

**Stage 5 (2–4 weeks of paper) — prove it**
| # | Rule |
|---|---|
| C22 | 👁 Order-book pressure: buyers ≫ sellers + rising volume as confirmation (from data saved since Stage 1) |
| C23 | 👁 Real index context: Nifty / sector index / India VIX instead of the 49-stock average |
| C24 | 👁 Spread check: skip stocks whose bid-offer gap is wide |
| C25 | 👁 Special days: expiry, budget/policy days, big gap days → smaller size or no trade |
| C26 | Weekly re-test of every rule on the growing data; pass mark: positive net after costs over 100+ trades |

**Stage 6 (after Stage 5 passes) — real money, small**
| # | Rule |
|---|---|
| C27 | Orders via Sharekhan with manual confirm; limit orders near the price, not market orders |
| C28 | Smallest size; daily AND weekly loss limits; overall exposure cap (max open trades and max total money at risk) |
| C29 | Intraday margin/leverage only after real-money results match paper |
| C30 | Check SEBI / Sharekhan rules for API trading before going live |

**Stage 7 (later) — scale:** feed on an always-on server · ML model trained on the journal · bigger size for A+ setups · size up slowly (compounding) · multi-user only after a legal check.

### E. Trading playbook — what we do once the app gives signals (agreed 8 Oct)
- **Paper phase (stages 1–5): take EVERY signal** on paper, exactly as given. No picking favourites — honest statistics need all of them.
- **Real money (stage 6+): NOT every signal.** Only A+ (A later, if paper shows A also earns) · max 3 open trades · max 2 per sector · same rupee risk per trade (0.5% of capital to start) · position size = rupee risk ÷ stop distance · daily loss stop, then done for the day.
- **Follow the exits mechanically:** initial stop, profit lock, trailing, 15:15 square-off. Never widen a stop, never average down a loser, never re-enter in anger after a stop ("revenge trade"), never hold intraday positions overnight.
- **Journal + weekly review:** every trade's reason and result; change rules only through the back-test + owner approval.

### F. Learning loop — how the app learns from mistakes (agreed 8 Oct)
1. **Record:** every signal and trade with its reasons (which rules fired, setup, grade, market/sector state, volume, time) and its outcome.
2. **Classify every loss by cause** (weekly): fake breakout · against the market/sector · low volume · bad time of day · stop too tight · news shock · range day traded as trend day · rule bug.
3. **Find patterns:** a cause that repeats across many trades (not one bad day) becomes a candidate fix.
4. **Test the fix** in the back-tester on old AND new data (walk-forward); keep it only if it helps both.
5. **Owner approves → deploy → keep measuring.**
6. **Later (stage 7): ML** trained on the journal suggests weights/filters; same test-and-approve gate.
Guardrails: never change a rule because of 1–2 losses; minimum ~30 trades of a pattern before acting; the app never rewrites its own live rules without the test + approval (self-changing systems over-fit and blow up).

### D. Process rules (always)
00. **Owner's rule (16 Oct) — approval before every action:** when Claude has control of the owner's computer/browser, it first states the exact action and its purpose, then waits for the owner's "do it"; one action at a time; never logs in, never places real trades or moves money, never deletes files, never touches anything outside the project. 0. **Owner's request (8 Oct): every task Claude gives the owner states its PURPOSE — what it does and what we achieve by it.** 1. No rule goes live unless it improved BOTH back-test data sets and both halves. 2. The owner approves every change to live rules. 3. Re-test weekly. 4. One trading feed only. 5. Never paste tokens in chat. 6. Update this rulebook whenever a rule changes status.

---

## 🗺 MASTER PLAN & FEATURE BACKLOG (single source of truth — read this first)

**Intent (never lose sight of this):** an app that scans many stocks, decides which to BUY/SELL using technical analysis (later news and wider market context too), exits fast to cut losses and lock profit, learns from its own results, and — if the evidence supports it — earns money for the owner, and later for other users with their own brokers. **Loss avoidance (added 2026-10-07):** it comes mainly from risk rules, market context and tested filters, NOT from piling on more indicators. Every strengthening step below is added one at a time, as an on/off switch, and kept only if net-of-cost paper results improve.

**Honest limits:** no system avoids all losses; most retail intraday traders lose money (SEBI: 71% in FY23); costs matter; not a financial advisor.

**How we work (rules):** one step at a time · every claim backed by evidence (logs, code, test output) · validate before scaling (paper-trade before real money, real money before ML or WebSocket) · `git pull` before editing (Lovable's AI also edits the repo) · after pushing, tell Lovable to deploy the changed edge functions · never paste secrets/tokens in chat · update this file after every step.

**Status key:** ✅ done and verified live · 🟡 built, not yet verified live · ⬜ not started

### What exists today
| Capability | Status | Notes |
|---|---|---|
| Login, pages wired to the real database | ✅ | Signals/Watchlist/Manual Trades/Dashboard/Performance |
| Sharekhan connection (AES-256-GCM token exchange) | ✅ | Login expires ~8h; reconnect each morning before 09:15 IST |
| Simulator mode + Trade button → simulated trade | ✅ | Verified with a real INFY.NS trade |
| Stock master list (7,551 rows in `scripcodes`) + daily sync job (08:45 IST weekdays) | ✅ | Sync run confirmed; scheduled job created by Lovable |
| Sharekhan candle API access (labels, response shape) | ✅ | `5minute` etc. verified by live probe; parser fixed for `qty`, D/M/YYYY, oldest-first |
| Scout v2: scan 49 stocks → score → rank (uncapped score) → BUY/SELL + ATR levels → write `signals` | 🟡 | Dry runs verified on Thu 1 Oct data (5 prices match the Sharekhan app exactly). Never run on live intraday data; NOT scheduled (see 2026-10-05 finding) |
| Freshness / holiday guard (`asOf`, skips data not from today or >15 min old) | ✅ | Worked as designed on Mon 5 Oct: skipped every stock because Sharekhan's REST candles were stale |
| Live feed: laptop program + `feed-gateway` function + `live_candles` table | ✅ | Full day verified Wed 7 Oct: 49 stocks, 09:40–15:29, 3,429 five-min and 16,940 one-min rows (about 1% of minutes empty, spread evenly; one 5-min window missing for BAJAJFINSV). Volume bug fixed. Still to check: saved prices vs the Sharekhan app 5-min chart (owner could not read it from the daily chart); reconnects |
| Scout live path (`source:'live'`): REST history + today's `live_candles` → score → top 10 | 🟡 | Built 7 Oct, offline-tested (19 checks). **Deployed 7 Oct evening** (checked: refuses unauthenticated calls). NOT yet run on real data, NOT scheduled |
| Back-tester (`tools/backtest/`) + `history-export` function | 🟡 | Built 7 Oct night: replays past 5-min candles through the SAME scout rules with costs. 14 offline checks + 6 function checks; mutation-tested. NOT deployed, NOT yet run on real data |
| Corrected indicators (RSI/ATR/MACD/trend/efficiency), IST time fix, auth hole fix | 🟡 | Verified offline and on last-session candles; indicator values not cross-checked against a charting tool |
| Rule-based scoring + direction rule (agreement of 3 votes, chop filter, RSI guard) | 🟡 | v1, never back-tested, no evidence of profit |

### What is NOT built yet (ordered; each phase has a gate before the next)
**Phase A — Finish and verify the data pipeline** 🔶 IN PROGRESS — blocked on live data (see 2026-10-05 / 2026-10-06 entries)
1. ✅ DONE 2026-10-04 — Dry-run scan of 5 stocks; check prices match the Sharekhan app and the indicators look sane.
2. First real (non-dry) run when the market opens; inspect `signals`.
3. **BLOCKED (2026-10-05): do not schedule yet — the scout reads Sharekhan's REST candles, which are not live during the session. Needs the live feed first.** Schedule the scout every 1 minute during market hours (function also self-gates to 09:15–15:30 IST, Mon–Fri). The job authenticates with the `x-job-token` header (project convention in AGENTS.md); `scout-signals` and `update-market-data` now accept it via `isTrustedInternalRequest`.
4. Token expiry handling: confirm real token lifetime, add a "Sharekhan disconnected" alert/banner so scheduled jobs don't silently fail; explore refresh if Sharekhan supports it.
5. Schedule `market-conditions` (nothing calls it today, so the market multiplier is always "UNKNOWN").
6. ✅ DONE 2026-10-04 (TATAMOTORS → TMPV + TMCV) — Validate the starter universe (stale/renamed tickers show up as "unresolved" — TATAMOTORS is unresolved today; find its current symbol in `scripcodes`); filter the 7,551 master rows to ordinary equities.
7. A monitoring view for `system_logs` (errors, last run, signals created).
8. ✅ DONE 2026-10-04 — **MUST be done before scheduling the scout.** Add the latest candle's timestamp (`asOf`) to every result, and when not forced skip any stock whose latest candle is not from today or is older than ~15 min. Reason: the 09:15–15:30 gate cannot know exchange holidays, so on a weekday holiday (next: Tue 20 Oct Dussehra, Tue 10 Nov, Tue 24 Nov, Fri 25 Dec) the scout would otherwise create signals from the previous session's data.
9. ✅ DONE 2026-10-04 — Fix score saturation (see 2026-10-04 note): rank by an uncapped score or recalibrate, so the best stocks can actually be told apart.
*Gate:* signals appear on their own during market hours and prices match Sharekhan. *Status 2026-10-06: prices match (verified on last-session data); signals during market hours need the live feed.*

**Phase B — Prove it earns, on paper (the real test)** ⬜
1. Cost model in the simulator: brokerage, STT, exchange charges, GST, stamp duty, slippage (currently none, so simulated profit is overstated).
2. Schedule the automatic paper loop (`process_new_signals` + `monitor_trades`).
3. Store a snapshot of indicators/score/market state with every signal and trade (this becomes the ML training data).
4. Results dashboard: win rate, average win/loss, expectancy NET of costs, max drawdown, by time of day / market condition.
5. Run 3–4+ weeks (enough trades to mean something).
6. Test wider stop/target multiples (e.g. 2×/3× ATR) against the current tight levels — with costs, tight levels need a much higher win rate (see 2026-10-04 note).
*Gate:* net-positive expectancy after costs over a meaningful number of trades. If not, fix the strategy; do not go live.

**Phase C — Strategy upgrades, each tested on paper as an on/off switch** ⬜
Concentration limits (max signals per direction / per sector — the 48-stock scan produced 12 BUYs at once, all correlated) · Daily-trend filter (e.g. above 20-day average; daily candles confirmed available back to 2000) · yesterday's high/low and support/resistance · NIFTY/sector context · no-trade filters (illiquid, circuit-limit, results days) · position sizing and risk per trade · daily trade/loss limits · time-of-day rules. Keep a change only if paper results improve.

**Phase D — Exits and risk control** ⬜
Trailing stop-loss · reversal-based exit (the same indicators that triggered entry flip) · time exit before the close (intraday positions must be squared off) · partial profit booking · daily loss limit enforcement · kill switch.

**Phase E — Live tick-by-tick data at scale** 🔶 PULLED FORWARD (now required for Phase A). Laptop version built 2026-10-06; not yet run against the real stream
Always-on server (~$5–10/month, e.g. Fly.io/Render — Lovable edge functions cannot hold a persistent connection) holding Sharekhan's WebSocket (up to 1,000 symbols per connection) → writes prices to the database → scale the universe (e.g. Nifty 500) → tick-driven exits. Needs reconnect logic and monitoring. *(Superseded 2026-10-05: REST candles are not live during the session, so no live signal can exist without a live feed. Scaling the universe and tick-driven exits remain gated on Phase B.)*
*Verified from Sharekhan's official Python SDK source (read 2026-10-03), for when we build this:* connect to `wss://stream.sharekhan.com/skstream/api/stream?ACCESS_TOKEN=<token>`; send the text `ping` as a heartbeat; subscribe with `{"action":"subscribe","key":["feed"],"value":[""]}`, then request prices with `{"action":"feed","key":["ltp"],"value":["NC22,NC2885,..."]}` (instrument id = exchange code + scrip code, comma-separated; `unsubscribe` uses the same shape); the SDK re-subscribes after a reconnect. Cautions: the SDK turns TLS certificate checking OFF — do not copy that; the token travels in the URL, so the server must never log the connection URL. Only the `ltp` (last price) key appears in the example; richer feeds are not yet seen.

**Phase F — Smarter decisions (ML + news)** ⬜
News/sentiment source (new cost and integration) · ML model trained on the collected paper/real outcomes (needs hundreds to thousands of trades; walk-forward validation to avoid overfitting) · scheduled retraining and monitoring for drift · post-trade analysis of losing trades. "Learning from mistakes" means statistically refitting on results — it will never reach zero mistakes.

**Phase G — Real-money trading** ⬜
Order placement through Sharekhan's API (order, modify, cancel, status) · rejections/partial fills/duplicate-order protection · manual-confirm mode before full auto · start with an amount whose total loss would not hurt · **check current SEBI/exchange rules for algorithmic trading through a retail broker API (e.g. registration and static-IP requirements) and Sharekhan's API terms — not yet verified.**

**Phase H — Turn it into a product for other people** ⬜
Per-user broker connection and settings · more brokers behind a common adapter · permanent published URL (then update Sharekhan's registered redirect URL) · security hardening · error alerts and backups · **legal check: giving buy/sell signals to other people may count as investment advice or research under SEBI rules and may require registration — get proper advice before sharing or charging.**

### Tech debt / cleanup (do alongside, not instead)
- `live_candles` grows every day (49 stocks ≈ 37k rows/day; 1,000 stocks ≈ 400k) — add a scheduled clean-up of rows older than N days.
- Live feed restart mid-day: the candle being built at that moment is rebuilt from the restart only and can overwrite a fuller row (upsert). Fix by merging (max high / min low) or reloading today's rows at start.
- `feed-gateway` allowlist comes from `_shared/universe.ts`; growing the universe means editing that file and redeploying the gateway and scout.
- `sharekhan-market-data` is broken (calls a `get-token` endpoint that doesn't exist) — delete or fix.
- `alpha-vantage` function still deployed and in `config.toml` — remove.
- `indicators` and `market-conditions` functions are unscheduled and duplicate logic; `trading-intelligence` has its own copy of the scoring rules — consolidate onto `_shared/`.
- Stored-token encryption uses an older passphrase style — upgrade (requires one Sharekhan reconnect).
- Loose `any` typing on Signals/Dashboard/Watchlist screens.
- Lovable's two security notes (scheduling extension in the shared schema; table names visible to signed-in users) — review later.
- Per-user risk multiplier is not applied to global signals — apply at trade time.

### Decisions still needed from the owner
Capital to trade and maximum loss per trade/day · cash segment only, and is shorting allowed? · stock universe (large-caps only, or wider?) · manual confirm vs fully automatic execution · plan for sharing with other people (legal).

---

## ✅ Phase 1 — Frontend/Backend Disconnection Audit (COMPLETE)

Found the backend (12 edge functions, ~4,200 lines) was real and substantial, but 6 of 8 frontend pages were hardcoded mock data, fully disconnected from it. No scheduler (`pg_cron`/Jobs) existed to run the pipeline automatically.

## ✅ Phase 2 — Core Bug Fixes (COMPLETE, confirmed live)

All 9 bugs fixed and verified working in the live app:
1. `SHAREKHAN_API_SECURE_KEY` → `SHAREKHAN_API_SECRET` naming mismatch
2. Settings — real Simulator Mode toggle (`user_settings.simulator_mode`)
3. Signals page — real data from `signals` table
4. Trade button — calls `simulate-trade` → `execute_signal`
5. Dashboard widgets — real queries (`signals`, `stocks`, `daily_performance`, `trades`)
6. Watchlist — real CRUD on `watchlist` + `stocks` tables
7. Manual Trades — real persistence to `trades` table, with a working Close-trade flow
8. Auto Trading — rebuilt honestly around real `trading_state.auto_mode_active` flag (no fake positions)
9. Performance page — real aggregation from `trades` + `daily_performance`

**Live proof:** user completed a real `INFY.NS` simulated BUY trade end-to-end through the fixed Signals page.

**Key lesson learned:** Lovable Cloud edge functions do **NOT** auto-redeploy on `git push` — pushing to GitHub only updates the source file. You must separately tell Lovable's AI chat: `Deploy the [function-name] edge function`, or the old code keeps running. This caused significant confusion earlier (thought fixes weren't syncing when they just weren't deployed).

## 🔧 Phase 3 — Sharekhan Broker Connection (IN PROGRESS)

### Bug 3.1 — "Refused to connect" — ✅ FIXED
**Cause:** code sent a non-standard `redirect_uri` query parameter Sharekhan's API doesn't support.
**Fix:** removed it from the login URL parameters.

### Bug 3.2 — "Invalid or expired OAuth state" — ✅ FIXED
**Cause:** Sharekhan's OAuth callback only ever returns `request_token` — it never echoes back a `state` parameter, so the old code's identity-verification logic always failed.
**Fix:** built `src/pages/SharekhanCallback.tsx` — a new page that runs inside the user's own logged-in session and calls a new backend action (`complete_login`) using their real Supabase auth token to establish identity, instead of relying on `state`.
**Also required:** registering this new callback URL on Sharekhan's own developer portal (Modify App → Redirect URL) — done, confirmed via screenshot.
**Also required:** actually deploying the edge function in Lovable after pushing (see lesson above) — this step was missed multiple times, causing repeated false "still broken" reports.

### Bug 3.3 — Token exchange 404 — ✅ FIXED
**Cause:** code POSTed to `https://api.sharekhan.com/skapi/auth/access-token` (Zerodha Kite Connect's URL pattern, not Sharekhan's) with a SHA256 checksum, form-urlencoded. Sharekhan's server returned a real 404.
**Root cause found by:** reading Sharekhan's official Python SDK source directly (github.com/Sharekhan-API/shareconnectpython, file `SharekhanApi/sharekhanConnect.py`).
**Real endpoint:** `https://api.sharekhan.com/skapi/services/access/token`
**Real format:** JSON body, camelCase fields (`apiKey`, `requestToken`, `state`), plus an `api-key` HTTP header on every request.

### Bug 3.4 — request_token must be AES-256-GCM processed — ✅ IMPLEMENTED, ⏳ NOT YET WORKING
**Cause:** Sharekhan's real protocol requires:
1. Decrypt the raw `request_token` using AES-256-GCM (key = your 32-byte API secret, IV = 16 zero bytes, no AAD, 128-bit tag appended to ciphertext)
2. Split the decrypted string on `|` into 2 parts
3. Swap the two parts' order
4. Re-encrypt the swapped string with the same AES-256-GCM parameters
5. Base64url-encode the result → this is the real `requestToken` value to send

Implemented using Deno's native `crypto.subtle` Web Crypto API.

**Confirmed via diagnostic logging that decrypt is cryptographically correct:**
- `secretLength: 32` ✅ (correct AES-256 key size)
- Decrypt succeeds cleanly with a valid GCM auth tag (this is near-impossible with a wrong key — GCM's integrity check would fail loudly otherwise)
- `decryptedLength: 40`, `pipeCount: 1`, `part0Length: 32`, `part1Length: 7` — consistent across multiple attempts, structurally sensible

**Still failing at the final exchange:** Sharekhan responds `400 { "message": "Request token is invalid", "errorType": "input_error" }` every time, despite decrypt being provably correct.

### Also fixed along the way (Bug 3.5)
A separate real bug: JavaScript's `URLSearchParams` (used by both the old and initially-planned new frontend code) silently converts literal `+` characters into spaces, per the `application/x-www-form-urlencoded` spec. Sharekhan's tokens contain raw, non-percent-encoded `+` characters. Fixed by extracting `request_token` manually via regex + `decodeURIComponent` instead of `useSearchParams`/`URLSearchParams`.

---

## 🧪 Experiment Log (Bug 3.4 — narrowing down the last mismatch)

Testing one variable at a time since we can't test directly against Sharekhan's server ourselves — only the user's live app can.

| # | Change tested | Result | Conclusion |
|---|---|---|---|
| 1 | Added missing `api-key` HTTP header | Identical error | Ruled out — header wasn't the issue |
| 2 | Kept base64 padding (`=`) instead of stripping it | Identical error (only `encStrLength` +1) | Ruled out — padding doesn't matter |
| 3 | Reversed swap direction (`part0\|part1` instead of documented `part1\|part0`) | Identical error, byte-for-byte | Ruled out — swap direction (at least combined with URL-safe encoding) wasn't it |
| 4 | **Switched final encoding from URL-safe base64 to STANDARD base64** (`+/` with padding, not `-_` no padding) | 🎉 **SUCCESS — Sharekhan returned HTTP 200 with real account data** | Confirmed via `encStrLength: 76` (vs 75 before, proving padding kept) and a real response: `customerId: "1611730"`, `fullName: "MACWANA ARPITABEN M"`, `state: "12345"` echoed back, and a real JWT-style token. **The core AES-256-GCM + standard-base64 protocol is now proven correct.** |

### Bug 3.5 — Response parsing mismatch — ✅ FIXED
Sharekhan's real success response nests the token at `data.data.token`, with a `message: "access_token"` field that is NOT the token itself (confusingly named — it's just a label). Our code was checking top-level `data.accessToken`, so it never found the real token even on a successful 200 response. Fixed to read `data?.data?.token`.

**Status: ✅ CONFIRMED WORKING END-TO-END.** Settings page shows "Connected" live. Sharekhan broker integration is fully functional as of 2026-10-02.

## 🏁 Phase 3 — COMPLETE

Total bugs found and fixed in the Sharekhan integration, in order:
1. Non-standard `redirect_uri` parameter → "refused to connect"
2. Broken `state`-based identity check (Sharekhan never echoes `state` back) → "Invalid or expired OAuth state"
3. Wrong token-exchange endpoint (Zerodha-style URL, not Sharekhan's real one) → 404
4. Missing AES-256-GCM decrypt/swap/re-encrypt step entirely
5. Wrong base64 variant (URL-safe instead of standard, for the no-`versionId` flow) → "Request token is invalid"
6. Wrong response field parsing (token nested under `data.data.token`, not top-level)

All six root-caused with real evidence (SDK source code, live system_logs, byte-level diagnostic logging) rather than guesswork, after several dead ends along the way.

### Note on deployment gotcha (recurring theme this whole phase)
Multiple rounds were wasted because pushing to GitHub does NOT auto-redeploy Lovable Cloud edge functions — confirmed again this round (old `encStrLength: 75` persisted through one full test cycle despite a "yes I deployed" claim, until it was properly redeployed and the length correctly became `76`). **Always verify via a debug log value changing, not just by asking/assuming the deploy happened.**

---

## 🔜 Phase 4 — What's Next (not started yet)

### ⚠️ Important clarification of intent (changes the architecture plan)
The app's real goal is NOT just refreshing a small personal watchlist — it's meant to **scan across many/all NSE stocks and have the scoring algorithm pick the best opportunities**. This rules out REST-based polling entirely, regardless of interval: scanning 1,500+ stocks one-by-one via REST would take 25+ minutes per pass even at a generous rate limit, making it useless for intraday decisions.

**Confirmed via Sharekhan's own documentation:** their WebSocket feed is explicitly built for multi-symbol monitoring — feed requests include a "Count" field for multiple scrips, and up to 1,000 symbols are supported per single WebSocket connection (vs. their "Market Watch" UI feature capping at 500). This means the WebSocket approach (previously discussed as an optional future upgrade) is actually the **necessary, correct architecture** given the real intent — not a luxury.

**Revised Phase 4 plan:**
1. Build a small always-on service (separate hosting, ~$5-10/month — Fly.io/Render, outside Lovable's serverless model since Edge Functions can't hold a persistent connection open) that maintains one WebSocket connection to Sharekhan
2. Subscribe to a realistic symbol universe (up to 1,000 at once; if full NSE exceeds that, start with a curated list like Nifty 500)
3. Continuously write incoming price ticks into the `stocks` table
4. The rest of the already-built pipeline (indicators, market-conditions, trading-intelligence, signals) consumes this real-time data exactly as designed — no changes needed there

### Original scheduler note (superseded by the above for price data, still relevant for other jobs)
1. **No scheduler exists yet** for the signal-generation pipeline (`scrip-master-sync`, `update-market-data`, `indicators`, `market-conditions`, `trading-intelligence`) — confirmed earlier that Lovable Cloud's "Jobs" page was empty. The scoring/indicator functions can likely still run on a periodic Job (e.g., every 1 minute) since they process already-stored data rather than hitting Sharekhan directly — only the raw price feed needs to move to WebSocket.
2. **Debug logging cleanup** — the `debug-*` log statements added to `sharekhan-auth/index.ts` during troubleshooting are harmless but no longer necessary; can be removed for tidiness (optional, low priority).
3. **Multi-user support** — user's stated long-term goal is to let other people connect their own broker accounts. Current Sharekhan flow is "Self App" (single customer per API key) — supporting multiple different users' Sharekhan accounts, or other brokers entirely, will need further architecture work (likely a "vendor" API key from Sharekhan, or per-user API key storage, rather than one fixed `SHAREKHAN_API_KEY`/`SHAREKHAN_API_SECRET` pair for everyone).
4. **Preview URL dependency** — the app is still running on a temporary Lovable preview URL, not a published permanent one. The Sharekhan redirect URL registered on their portal currently points to this temporary URL and will break if it changes. Publish when ready for more permanent stability.

## 🔍 Phase 4 Findings — What the code actually does vs. what the app needs (2026-10-03)

**Verified by reading the code (not assumed):**
- Scoring "brain" is REAL: base 50 + trend/RSI/VWAP/volume/candle/MACD points, multiplied by time-of-day, market-condition and risk-state factors; tradable if final score ≥ 60 and safety checks pass. It is **rule-based, hand-weighted — not AI/ML** (code comment says so).
- `learning-engine` retunes multipliers from last-7-day win rates (rule-based, not ML).
- **GAP 1 — No "scout":** nothing scans the market to discover candidates. `update-market-data` only processes the user's watchlist, existing active signals, or a hardcoded fallback of 5 stocks (RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK).
- **GAP 2 — `scripcodes` (full exchange list) is written by `scrip-master-sync` but never read by anything.**
- **GAP 3 — Nothing ever INSERTs into the `signals` table.** `trading-intelligence` only returns a score; no code turns a good score into a signal row.
- Alpha Vantage fallback and dead `useSharekhanCallback` hook were removed (cleanup done; needs deploy of `update-market-data` — Lovable confirmed deployed).

**Realistic expectations agreed:**
- "No loss / no mistakes" is impossible for any trading system. Not a financial advisor; automated trading carries real loss risk.
- Achievable and valuable: faster loss-cutting and profit-locking — trailing stop-loss, reversal-based exits, tied to a fast live feed (builds on existing `exit-monitor`).
- Real ML/news-sentiment is a later phase: needs hundreds+ of real trade outcomes and a news data source first. Rule-based system runs first to accumulate data.
- True live ticks need Sharekhan WebSocket (up to 1,000 symbols/connection) on a small always-on server (~$5–10/month, e.g. Fly.io/Render). Edge Functions cannot hold persistent connections. REST polling cannot scan the whole market (1,500+ stocks).

**Proposed build order:**
1. Scout + signal writer (read `scripcodes`/curated universe e.g. Nifty 500 → score → rank → insert top signals into `signals`)
2. Live feed service (WebSocket → `stocks` table)
3. Trailing-stop / reversal exit logic (upgrade `exit-monitor`)
4. Later: ML model + news sentiment once real outcome data exists
5. Optional low-priority: upgrade stored-token encryption (will require reconnecting Sharekhan once); tighten `any` typing

## 🛠 Phase 5 — The Scout (BUILT, NOT YET TESTED LIVE) — 2026-10-03

**What was built:** `scout-signals` edge function + shared modules (`_shared/indicators.ts`, `scoring.ts`, `sharekhan.ts`, `universe.ts`). Each run: take a batch of the starter universe (~48 liquid large-caps, rotating by minute) → fetch 5-min candles from Sharekhan (400 ms between calls) → compute indicators → score with the existing point rules → decide BUY/SELL → ATR-based entry/stoploss/target → write the best into `signals` (first code in the project that ever inserts signals), keep top 10 active, expire after 30 min, refresh scores in place so entry/target stay stable.

**Direction rule (v1, new — the old scorer had none):** needs agreement among 3 votes (trend vs SMA20, MACD *line* sign, price vs VWAP) with none opposing; skips if RSI>75 for BUY / <25 for SELL; skips choppy markets (efficiency ratio < 0.3). Levels: stop = max(1.5×ATR, 0.25% of price), target = 1.5× stop distance. **Not back-tested. No evidence of profitability. Signals are candidates to review, not proven trades.**

**Bugs found in the existing pipeline and fixed along the way (all verified from code):**
1. RSI & ATR were computed from the OLDEST candles in the window, not the latest.
2. MACD was hardcoded null → MACD score component never fired.
3. Trend strength scaled ~100x too small → trend score ≈ 0.
4. Hardcoded scrip-code map had duplicates (INFY/ICICIBANK=1594, TATAMOTORS/TATACONSUM=3432) → now resolved from `scripcodes` table.
5. **Security:** "is this a cron job?" check in `update-market-data`, `market-conditions`, `health` matched only the first 20–30 chars of the service key — identical to the public anon key's prefix, so the anon key passed. Replaced with exact constant-time match (`isServiceRoleRequest` in `_shared/auth.ts`).
6. IST time-of-day logic ignored minutes (`trading-intelligence`, `market-conditions`) → e.g. 09:20 IST read as closed, 10:20 read as "opening". Fixed.
7. No backend function could obtain the stored Sharekhan token (`sharekhan-market-data` calls `sharekhan-auth?action=get-token`, which doesn't exist) → added server-side `loadStoredSharekhanToken` (reads + decrypts from DB, never exposed over HTTP). `update-market-data` and `scrip-master-sync` now use it as a fallback.
- Still broken, untouched: `sharekhan-market-data` (calls the nonexistent get-token). Nothing in the app/jobs uses it — delete or fix later.

**Verified offline (synthetic data, 30+ checks pass):** indicator math incl. the old-bug regression, direction rule (trend→BUY/SELL, chop→rejected), level ordering and R:R, IST time handling, syntax of all 11 touched files.
**NOT verified (market closed, no network from the build sandbox):** Sharekhan's real historical-candle response shape and interval parameter ("5" is assumed), real rate limits, whether `scripcodes` is populated and which symbol format it uses (`RELIANCE` vs `RELIANCE-EQ`; both are tried), whether some starter tickers are stale (reported as `unresolved`). The scout returns raw response samples on any failure so we can learn the real format on first contact.

**Test plan (market reopens Mon):**
1. Deploy: `scout-signals`, `update-market-data`, `scrip-master-sync`, `market-conditions`, `health`, `trading-intelligence`.
2. Run `scrip-master-sync` once ({"action":"sync_master"}); check `select count(*) from scripcodes;`.
3. Dry run (weekend OK): `scout-signals` with {"force":true,"dryRun":true,"symbols":["RELIANCE","TCS","INFY"]} — read the response; fix any format surprises.
4. Monday after 09:15 IST: one real run; inspect `signals`.
5. Then schedule a Job (cron `* 3-10 * * 1-5` UTC; function also self-gates to 09:15–15:30 IST).

**Known limits / decisions:** universe capped (REST-per-symbol); only the service-role caller may write signals (everyone else forced to dry run); uses the most recently connected account's token as the data source (single-owner phase); per-user risk multiplier is NOT baked into global signals (apply at trade time).

## 🧭 Decision — Roadmap is "prove it earns, then speed it up" (2026-10-03)

**User's goal:** a real app that earns money. **Decision:** validate the strategy with paper trading (with realistic costs) BEFORE building the live WebSocket feed or ML. Faster execution of a strategy with no proven edge only loses faster.

**Evidence behind this (SEBI study of individual intraday traders, equity cash, FY2022-23):**
- 71% of individual intraday traders incurred net losses (65% in FY19, 69% in FY22 — rising).
- 80% were loss-makers among traders with 500+ trades a year (over-trading hurts).
- Loss-makers spent an extra 57% of their losses on trading costs; profit-makers spent 19% of profits on costs.
- Not a financial advisor; no system can promise profit or "no loss".

**Verified in code:** the simulator (`simulate-trade`) has NO brokerage/tax/slippage modelling, so simulated profits would be overstated. The automatic paper-trade loop already exists as actions `process_new_signals` + `monitor_trades` — it just isn't scheduled, and had no signals to act on until the scout.

**Roadmap (in order):**
1. Deploy + test the scout on real data (dry run now, real run Mon after 09:15 IST).
2. Build cost model into the simulator (brokerage + STT + exchange/GST/stamp + slippage, ~0.1%+ round trip) and schedule the paper loop (`process_new_signals`, `monitor_trades`). Run 3–4+ weeks. Measure win rate, avg win/loss, expectancy NET of costs, max drawdown.
3. Decide from data. Net-positive over enough trades → live WebSocket feed (up to 1,000 symbols/connection, ~$5–10/mo always-on server), trailing stop / reversal exits, ML + news trained on the collected outcomes. Not positive → fix the strategy first.
4. Only then real money — an amount whose total loss would not hurt.
Paper-trade outcomes double as the training data ML needs.

**Not done yet (honest status):** tick-by-tick feed for all stocks; AI/ML decision-making; news input; trailing stop / fast reversal exits. The scout is a rule-based v1 over ~48 stocks.

**Current to-do for the user:** (a) add this file + scout files to the repo, (b) push, (c) deploy 6 functions in Lovable chat, (d) run scrip-master-sync, (e) run scout dry run and send the output.

**Update 2026-10-03 (deploy):** Lovable deployed all 6 functions. It made one fix to `scout-signals` (commit d3eee0c): a TypeScript typing change on the `symbols` line (`new Set<string>((body.symbols as unknown[])...`). Typing only, no behaviour change. Lesson: my offline check was syntax-only, so type errors can slip past it; Deno type-checks at deploy. Tests then stopped because `scripcodes` is empty — `scrip-master-sync` is service-role-only by design, so the chosen fix is a scheduled job (weekdays 08:45 IST = 03:15 UTC) plus one run now. Reminder: Sharekhan login expires (~8h); reconnect each trading morning before 09:15.

**Update 2026-10-03 (first real test):** `scrip-master-sync` job scheduled (weekdays 08:45 IST) and run once: 7,551 stocks in `scripcodes` (Sharekhan sent 7,601; duplicates collapsed). Scout dry-run for RELIANCE/TCS/INFY via browser console: auth OK, token loaded, all 3 scrip codes resolved, requests reached Sharekhan — which answered **HTTP 400 "Invalid Chart Period"** for interval "5". Cause: interval format wrong. Sharekhan's official Java/R/PHP samples use word labels (e.g. "daily"); the 5-minute label is not documented in anything found. **Fix in progress:** scout now accepts an `interval` param and has a read-only `probe` mode that tries 17 candidate labels (incl. "daily" as a control that also validates auth/endpoint/parsing) and reports which Sharekhan accepts. Default is now "5minute" — UNVERIFIED until the probe confirms. Also added a strict TypeScript type-check of all touched functions (stubs for remote modules): passes. (Earlier checks were syntax-only and missed a typing error Lovable fixed at deploy.)
**Next:** push 2 files (`_shared/sharekhan.ts`, `scout-signals/index.ts`), tell Lovable "Deploy the scout-signals edge function", run probe from the browser console (free), paste result, set the confirmed label as DEFAULT_INTERVAL.

**Update 2026-10-03 (probe result — Sharekhan's real candle API, VERIFIED):**
- Valid interval labels: `1minute`, `3minute`, `5minute`, `15minute`, `30minute`, `60minute`, `daily` (also `5Minute`). Rejected with HTTP 400 "Invalid Chart Period": `5`, `5min`, `5m`, `5MIN`, `05min`, `1min`, `1m`, `15min`, `30min`, `1hour`. `DEFAULT_INTERVAL = '5minute'` is now confirmed.
- Auth, endpoint, token loading, scripcodes lookup all confirmed working end-to-end (live call returned HTTP 200 with data).
- Row shape: `{open, high, low, close, qty, tradeTime:"09:19:52", tradeDate:"28/9/2026"}` — volume is **`qty`**, date is **D/M/YYYY** (unpadded), time HH:MM:SS IST, rows are **oldest-first** spanning many days (5-min: ~657 candles ≈ 9 sessions; 1-min: ~3,249; daily: ~6,652 back to year 2000).
- **Bug found by the probe:** the parser read blank timestamps and zero volume. Because Sharekhan returns oldest-first, the indicator code would have assumed newest-first and computed everything on a REVERSED series, with relative volume = 0 — plausible-looking but wrong scores. Fixed in `_shared/sharekhan.ts` (builds an ISO IST timestamp from tradeDate+tradeTime, reads `qty`), and it now fails loudly if <90% of candles have a parseable timestamp.
- Verified offline with mocked data in the exact live shape (10 checks): timestamps, D/M/YYYY, volume, ordering, latest-close, session-anchored VWAP, relative volume, full indicator set, loud failure on missing timestamps. Strict TypeScript check passes.
- Known limitation: the 5-min series spans ~9 sessions, so ATR / trend strength in the first ~50 minutes of a session include the overnight gap. Acceptable for v1; revisit if signals near the open look odd.
**Next:** push `_shared/sharekhan.ts`; deploy `scout-signals`, `update-market-data`, `scrip-master-sync` (all bundle that file); dry-run scan of 3 stocks from the console (free); read the real scores; then first real run when the market opens Mon.

**Update 2026-10-03 (repo snapshot reviewed):** The user uploaded a GitHub zip of the repo. Findings: (1) every file I sent landed (parser fix, probe mode, auth helper, PROGRESS.md). (2) Lovable's own edits since: `sharekhan-auth` typing fix (`Uint8Array<ArrayBuffer>`, harmless); `scrip-master-sync` now also trusts a private `x-job-token` header matched against table `internal_job_tokens` (row `cron`); migration `20261003123623_…sql` creates that table with RLS on and ALL access REVOKED from `anon`/`authenticated` — verified safe; `AGENTS.md` records the convention (service-role key isn't available to SQL). (3) The cron job definition and the token row were created outside migrations, so how the job passes the token isn't visible in the repo. Optional safe check in the SQL editor (masks long secrets): `select jobid, schedule, active, regexp_replace(command, '[A-Za-z0-9_-]{32,}', '***', 'g') as command from cron.job;`
**Change made:** added `isTrustedInternalRequest` to `_shared/auth.ts` (service-role key OR `x-job-token`, both constant-time compares) and switched `scout-signals` and `update-market-data` to it, so the scout can be scheduled the same way. Tested (11 auth checks incl. the anon-key prefix hole, wrong/short/missing token, empty table), strict TypeScript check passes, earlier suites still pass (18/6/10).
**Deploy now needs only:** `scout-signals` and `update-market-data` (already-deployed `scrip-master-sync` is unchanged). Dry-run console test is unchanged.

**Update 2026-10-04 — FIRST REAL SCAN (data = Thursday 1 Oct 2026, the last session — NSE/BSE were CLOSED Fri 2 Oct for Gandhi Jayanti; I had wrongly assumed Friday; market closed when run, `force` + `dryRun`), 5 stocks:** pipeline works end-to-end — 5 scanned, 5 scored, 0 errors, 0 unresolved, 3.8 s; `interval` = `5minute`; nothing written (dry run). Prices returned: RELIANCE 1167.7, TCS 2075.0, INFY 1035.0, HDFCBANK 721.2, SBIN 954.1 — **VERIFIED by the owner 2026-10-04: all 5 prices match the Sharekhan app's last close exactly** — confirms live fetch, candle parsing, ordering (latest candle = last price) and scrip-code mapping for these stocks. (Indicator values themselves not yet cross-checked against a charting tool — optional spot check of RSI on one stock.) Outcomes: TCS and HDFCBANK → BUY (3/3 votes); INFY skipped (RSI 81 > 75); RELIANCE skipped (choppy, efficiency 0.06); SBIN skipped (choppy, efficiency 0.26).
**Findings:**
1. **Score saturates.** Raw scores were 92–100 for all five. The point rules add up to a possible 140 (base 50 + 25 + 15 + 15 + 15 + 10 + 10) and are capped at 100, so most decent setups hit 100 and the score can't rank them. The 2 qualifiers were chosen by the direction/chop/RSI rules, not by score. Fix: rank by the uncapped total (or recalibrate base/weights). Check the distribution across the full universe first.
2. **Costs vs tight levels.** TCS: stop 0.31%, target 0.47% from entry (HDFCBANK similar). With an ASSUMED ~0.10% round-trip cost (actual depends on the Sharekhan plan — to be confirmed), break-even win rate rises from 40% (1.5:1, no costs) to about 53%. Needs the Phase B cost model and a test of wider ATR multiples.
3. `marketCondition` = UNKNOWN because `market-conditions` is not scheduled yet (Phase A item 5).
4. Results show no data timestamp, so freshness can't be seen — added as Phase A item 8.
**Next (free, no deploy):** dry-run both full batches (all ~48 stocks) from the console to see the real score distribution, then decide the score fix and bundle improvements into ONE deploy to save Lovable credits.

**Update 2026-10-04 — FULL 48-STOCK SCAN (owner-run from the browser console, dry run, last session = Thu 1 Oct):** 48 in universe → 47 scored, 1 unresolved (TATAMOTORS — stale ticker). **12 BUY, 0 SELL** (TCS, HDFCBANK, ASIANPAINT, BAJFINANCE, WIPRO, M&M, JSWSTEEL, BAJAJFINSV, HINDALCO, APOLLOHOSP, DIVISLAB, SBILIFE). Not signalled: 20 choppy, 14 no agreement among votes, 1 overbought (INFY, RSI 81). Whole universe took ~25 s over two batches, no errors, no rate-limit response.
**Confirmed problems:**
1. **Score saturation is real:** final scores ranged only 87–100; 32 of 47 were exactly 100, 46 of 47 ≥ 90, 47 of 47 ≥ 60 (the 60 threshold filters nothing). All 12 qualifiers scored exactly 100, so ranking/"top 10" would be arbitrary (2 of 12 dropped by chance). Selection is currently done entirely by the vote/chop/RSI rules. Fix: rank by an uncapped total (or recalibrate), then re-check the spread.
2. **One-sided and correlated:** every stock whose trend vote is visible (26 of 47; the rest were filtered earlier) was above its 20-candle average at the last candle. A same-day news item said the market had fallen four sessions in a row before the holiday, so this looks like a broad late-session bounce — but we can't yet rule out a bias in the rule; Monday's live run will show. 12 simultaneous longs would all be hit together if the market turns → needs concentration limits.
3. **Holiday blind spot** (see Phase A item 8) — would have generated signals from stale data on a holiday.
4. Universe has at least one stale ticker.
**Decision:** next code update (one deploy, to save credits) = `asOf` + staleness/holiday guard, uncapped rank score, universe fix. Then reconnect Sharekhan Mon 5 Oct before 09:15 IST, one real scan, then schedule.

**Update 2026-10-04 — scout v2 BUILT (not yet pushed/deployed):** (1) **Freshness/holiday guard** — `assessFreshness` in `_shared/scoring.ts`; scout skips any stock whose newest candle isn't from today (IST) or is >15 min old, enforced on any run that writes or any non-forced run (a forced dry run only reports it); every result now shows `asOf` and `ageMin`. Unit-tested incl. a replay of the 2 Oct holiday. (2) **Ranking** — new `calculateScoreUncapped` (50..140); scout ranks by uncapped×multipliers (`rankScore`), stores it in `signals.indicators.rank_score`, and the top-N cap now orders by it; display score/confidence stay 0–100 so the app is unaffected. Test: two setups that both capped at 100 now score 135 vs 110. (3) **Universe** — TATAMOTORS replaced by TMPV (code 3456) and TMCV (code 759782) after the Tata Motors split (confirmed in `scripcodes`); this also confirms the old hardcoded map was wrong (it had TATAMOTORS = 3432, which is TATACONSUM). Strict type check passes; all earlier suites pass (18/6/10/11) + 7 new checks. Files: `_shared/scoring.ts`, `_shared/universe.ts`, `scout-signals/index.ts`. Deploy only `scout-signals`.
**Correction to the plan:** a REAL (writing) scan cannot be started from the browser console — non-trusted callers are forced to dry run by design. Real runs happen only via the scheduled job (`x-job-token`) or Lovable's service role. So Monday: (a) ~09:30 IST, with Sharekhan reconnected, run the console dry run WITHOUT `force` and check `asOf` is minutes old; (b) then one Lovable message to create the every-minute job (cron `* 3-10 * * 1-5` UTC; the function self-gates to 09:15–15:30 IST), sending `x-job-token` like the stock-list sync job, empty body `{}`; (c) watch the Signals page and `system_logs`.

**Update 2026-10-04 — scout v2 DEPLOYED and VERIFIED (dry run, owner-run, data = Thu 1 Oct):** universe is now 49 (TATAMOTORS → TMPV + TMCV); all 49 resolved and scored, none unresolved. TMPV → BUY (rank 122), TMCV → choppy. `asOf` shows 2026-10-01T09:59 UTC (= 15:29 IST, Thursday's last candle) — correct, since Fri 2 Oct was a holiday. **Ranking works:** rank scores span 87–130 with 30 distinct values (before: 87–100, 32 tied at 100); the 13 BUY candidates now have 10 distinct rank scores. Order: HINDALCO 130, M&M 124, TMPV 122, SBILIFE 122, HDFCBANK 120, DIVISLAB 120, BAJFINANCE 119, APOLLOHOSP 119, TCS 118, BAJAJFINSV 117 | cut by the top-10 cap: ASIANPAINT 116, WIPRO 112, JSWSTEEL 111. **Observations:** (a) the top 10 contains 4 financials and 2 autos → sector concentration, still needs the Phase C limits; (b) rank orders by how many rule components fire — it is NOT proven to predict profit; Phase B must record `rank_score` with every trade so we can test whether higher rank = better outcomes; (c) still 13 BUY / 0 SELL — one-sided, Thursday-only data.
**MONDAY 5 OCT PLAYBOOK:**
1. Before 09:15 IST: app → Settings → **Connect Sharekhan**; confirm Connected (our stored session lasts ~8h, enough for the day).
2. ~09:30 IST, browser console on the app tab (free): same snippet as the 49-stock scan but with body `{ dryRun: true, batchIndex, batchSize: 25 }` (NO `force`). Expect `marketOpen` true and `asOf` only minutes old. Until the first 5-min candle forms (~09:20) stocks are skipped as stale — normal.
3. If fresh and sensible, ONE Lovable message: "Create a scheduled job that calls the scout-signals edge function every minute on weekdays, cron `* 3-10 * * 1-5` (UTC; the function itself ignores times outside 09:15–15:30 IST). Send the x-job-token header exactly like the stock-list sync job does, with body {}. Run it once now and show me the function's JSON response plus the job definition with the token hidden."
4. Watch the Signals page (max 10 active, 30-min expiry) and `system_logs` (source `scout-signals`).
5. Nothing trades automatically yet — signals are only displayed; paper trading is Phase B.

## 📡 2026-10-05 / 06 — Live-data finding and the live-feed build

**Finding (Mon 5 Oct ~10:35 IST, owner-run scan of 49 stocks, NOT forced):** `marketOpen` = true, but every stock was skipped as stale. Newest candle = Thu 1 Oct 15:29 IST (age ≈ 5,465 min). *Conclusion (inference from this result plus Sharekhan's FAQ and broker comparisons — not confirmed by Sharekhan):* the REST historical-candle endpoint does not return the current session's candles while the market is open. Live signals therefore need the WebSocket feed. The every-minute scout job is on hold. The freshness guard did its job: it refused to trade on old data.

**Probe + scan, Tue 6 Oct 21:46 IST (RELIANCE, after hours):** every valid label returned data. Candle counts: daily 6,653 · 5minute 365 · 1minute 1,805 · 3minute 605 · 15minute 125 · 30minute 299 · 60minute 161. Scan of RELIANCE/TCS/INFY: newest candle = Mon 5 Oct 15:29 IST (age ≈ 1,815 min).
- (a) Monday's full session is available after hours.
- (b) **UNRESOLVED:** nothing from Tue 6 Oct at 21:46 IST. Tue 6 Oct is not in the holiday list above, so either Sharekhan publishes the day's candles later, or it was a holiday. The owner has not confirmed. Re-check on Wed morning.
- (c) **UNEXPLAINED:** the counts and first-candle dates do not fit a simple "last N sessions ending Mon 5 Oct, oldest-first" picture (e.g. 5minute: 365 candles yet the first is already Mon 5 Oct 09:19; 1minute: 1,805 candles, first Mon 5 Oct 09:15; while the 30/60-minute series start on Thu 1 Oct). The earlier probe (Sat 3 Oct) had 657 five-minute candles starting 28 Sep, oldest-first. **Before using this API for back-testing, pull one series and tabulate candles per date and check the order.** My earlier remark that "about 5 days of 1-min and 5-min data" are available was an inference, not verified.

**Decision (owner, 6 Oct):** the intent is live signals during market hours, so the live feed comes first. Start on the owner's Windows laptop (free); move the same program to a small always-on server later. A phone cannot be the server (it pauses background programs).

**Built 2026-10-06** (pack `live-feed-pack.zip`):
- `D:\intraday\live-feed\` (deliberately OUTSIDE the repo because it holds `.env`):
  - `feed.mjs` — gets today's token + stock list from the gateway, connects to `wss://stream.sharekhan.com/skstream/api/stream`, sends the same two messages as Sharekhan's sample (`subscribe`, then `feed` with `ltp` and `NC<scripcode>` ids), builds candles, saves every 5 s, pings every 30 s, reconnects with back-off, stops at 15:35 IST.
  - `candles.mjs` — 1-min and 5-min candles from ticks. Only ticks 09:15:00–15:29:59 IST count. Candle time = start of its window. 5-min candles are built from the 1-min ones. Volume = per-tick quantity, or the difference of a running total.
  - `parse.mjs` — reads price messages. **This is a GUESS:** Sharekhan's SDK shows how to connect and subscribe, but its message parser is an empty stub, so the real tick layout is unknown.
  - `check-gateway.mjs`, `test-offline.mjs`, `test-e2e.mjs`. First 400 raw messages are saved to `raw_ticks.log` (token scrubbed) so the parser can be fixed from real data.
- Edge function `feed-gateway` (in repo, `verify_jwt = false`): auth = header `x-job-token` equal to `internal_job_tokens` row named `feed`. Actions: `token` (returns today's decrypted Sharekhan token + the 49 scrip codes) and `candles` (validates, then upserts into `live_candles`; symbols must be in the universe; max 600 rows per call). The laptop never holds the service-role key or the encryption key — only the revocable feed token.
- Table `live_candles` (symbol, timeframe `1min`/`5min`, bucket_start, OHLC, volume, tick_count; primary key symbol+timeframe+bucket_start; RLS: signed-in users read, service role writes). Created, with the feed token, by `setup.sql`. Re-running `setup.sql` makes a new FEED_TOKEN and kills the old one.
- Security notes: the Sharekhan token travels in the WebSocket URL, so the program never prints it (errors are scrubbed). TLS verification stays ON (Sharekhan's SDK turns it off — not copied). `.env` is git-ignored. Lovable offered to create the feed token itself and hand over a downloadable file; declined, so the secret never passes through Lovable's chat or files. Never paste FEED_TOKEN or `.env` into chat.

**Verified:**
- Offline: 20 candle/parser checks pass; whole-program test against fake servers passes; strict TypeScript check of the gateway passes.
- Owner's laptop (Node v22.20.0, 6 Oct 23:17 IST): `npm test` → 30 of 31 checks pass. The failing one ("shut down cleanly on Ctrl+C") is expected to be a Windows limitation of the test (killing a child process with SIGINT ends it without running its handler). That is my explanation, not verified; a real Ctrl+C is to be checked on the first run.
- Gateway deployed by Lovable; answers 401 without a token. `check-gateway.mjs` on the laptop at 23:12 IST: FEED_TOKEN accepted, Sharekhan login found (~6h27m left), 49 stocks ready.

**NOT verified:** that Sharekhan's stream accepts our subscribe as written · what a tick looks like (field names, whether it is last price only, whether it carries volume and what kind) · that `stream.sharekhan.com` passes normal TLS verification · reconnect behaviour on a real drop · how many connections one login may open · the ~1,000-symbols-per-connection cap (from reading Sharekhan's docs; untested).

**Not wired yet:** the scout still reads REST candles. Next, once real ticks are confirmed: add a live path to `scout-signals` that reads `live_candles`. Open design point: indicators like RSI/MACD need history, so the first ~15–20 minutes of a session are weak (plan: don't trust scores before ~09:30) and mixing in earlier REST history needs a decision.

**WED 7 OCT PLAYBOOK (first live test):**
1. Laptop plugged in, sleep set to Never, stable Wi-Fi.
2. Before 09:00: app → Settings → **Connect Sharekhan** (tonight's login expires ~05:40 IST).
3. ~09:00 in Git Bash: `cd /d/intraday/live-feed` then `node feed.mjs`.
4. Watch the status line every 30 s: messages, prices used, stocks seen (N/49), candle saves.
5. ~09:30: send a screenshot of the window and `raw_ticks.log` (never `.env` or the token).
6. Stop with Ctrl+C and look for "Stopping - saving the last candles...".
7. Optional: re-run the probe/scan to see whether Tue 6 Oct candles have appeared (item (b) above).

**Question asked 2026-10-06: "can we feed all stocks live?"** Not all in one connection: the cap is ~1,000 (untested) and NSE has 2,000+; extra connections per login are untested. The laptop is not the limit. Illiquid stocks give noisy, untradeable signals; the best day-trading picks are almost always the most liquid few hundred. Plan: 49 (Wed test) → ~200 → up to ~1,000 ranked by traded volume, once the feed is proven.

## 🟢 2026-10-07 — Live feed verified; scout live path built

**Live feed (first real run, Wed 7 Oct):** the laptop program connected to Sharekhan's stream at ~09:19–09:21 IST, subscribed, and received real ticks for all 49 stocks (status at 09:23: 865 messages, 904 prices used, 49/49 seen). Candles reached `live_candles`; RELIANCE 1-min candles checked in the database (09:40–09:42): prices consistent, high ≥ low, volume realistic.
**Real message layout (now known, from `raw_ticks.log`):** `{"status":100,"message":"feed","timestamp":…,"data":{…}}` where `data` is one object or a list; each has `exchangeCode`, `scripCode`, `ltt`, `ltp`, `qty`, `ltq`, `preltq`, `open/high/low/close` (day), `bidPrice/offPrice`, `totalBuyQty/totalSellQty`, `perChange`, circuit limits etc. Connect/subscribe replies are `{"status":100,"message":"connect"|"subscribe",…}`. About 10 messages/second across 49 stocks.
**Bug found and fixed (volume):** `qty` is the DAY'S RUNNING TOTAL volume (never decreases); `ltq` is only the last single trade. The first parser used `ltq`, so candle volume was ~50× too low (summed ltq = 38k vs summed qty increase = 2.0M over the same ticks). Fixed in `parse.mjs` (`qty` first in the cumulative fields); candles from the 09:40:41 restart onward have correct volume; earlier rows were deleted. Regression tests added from real messages (23 offline checks).
**Duplicate run found:** the log showed two connections (09:19:48 and 09:21:45) — two feed windows were open. Stopped with `taskkill //F //IM node.exe`. Lesson: run exactly ONE feed; check with `select max(updated_at) from live_candles` that nothing is writing before restarting.
**Windows note:** the test "shut down cleanly on Ctrl+C" cannot pass on Windows (the test kills the child, which then never runs its handler); a real Ctrl+C is expected to work.

**Scout live path (BUILT, offline-tested, NOT deployed):** `scout-signals` now takes `source` = `live` (default) or `rest`.
- `live`: for each stock, earlier-session candles from Sharekhan REST (only days BEFORE today IST; REST is not live) + today's 5-min rows from `live_candles` (converted to IST timestamps), merged oldest-first, then the same indicators/score/direction/levels as before. Whole universe scanned per run (cap 60). History is cached per stock per IST day while the function instance is warm (≈49 REST calls per day instead of per minute).
- Freshness for the live path = when the feed last WROTE that stock's newest candle (`updated_at`), not the candle's start time. A stock is skipped if the feed wrote nothing for >15 min, has no candles today, or isn't from today (the holiday guard stays on; forced dry runs only report it).
- New file `_shared/livecandles.ts` (pure helpers). Signals are tagged `source: scout-v2-live`.
- Tests (run on the real `index.ts` in Node with a fake database and fake REST, fixed clock 10:30 IST): 19 checks — uptrend → BUY, downtrend → SELL, today's REST candle excluded (history = 300), no-live-candles and stale-feed stocks skipped, only 2 signals inserted, levels ordered, history cache (no extra REST calls), market-closed gate, forced write run still refused on stale data, `source:'rest'` path unchanged, no-auth → 401. Two deliberate code breakages were caught by the tests (today's REST candles leaking in; stale feed treated as fresh). Strict TypeScript check passes.
**NOT verified:** behaviour on real data (indicator values with history joined to live candles; the overnight gap between the last history candle and the first live one — and the first ~hour of a session still uses yesterday's candles for SMA/RSI/MACD); REST history coverage in the live-session (REST may return fewer than ~35 earlier candles for some stocks); function run time on a cold start (~49 REST calls ≈ 35 s expected); real-money relevance — none. Rank score still unproven as a predictor of profit.
**Known limits:** a feed restart mid-session leaves the in-progress 5-min bucket partial (upsert overwrites it); the feed ignores pre-open and post-3:29 ticks; candle volume loses the first tick's delta per stock per session.

**NEXT (in order):**
1. ✅ DONE 2026-10-07 evening — pushed the scout files; Lovable deployed `scout-signals`.
2. After the feed ends (15:35 IST) run a forced dry run from the console (snippet in the hand-off note) and read: price vs the Sharekhan app, `liveCandles`/`historyCandles` counts, directions, rank spread, any `error`.
3. ✅ DONE 2026-10-07 — full-day gap check (see table above).
4. Thu 8 Oct ~09:30 IST: dry run WITHOUT `force`; if fresh and sensible, ONE Lovable message to create the every-minute job (cron `* 3-10 * * 1-5` UTC, `x-job-token`, body `{}`). Reconnect Sharekhan first; start exactly one feed ~09:00.
5. Then Phase B (paper trading with costs).

## 🧱 2026-10-07 — Expert review: what makes the app stronger (SUPERSEDED by the RULEBOOK at the top; kept for history)

**Verdict on the current rules:** a fair first version for finding *clear trends*, not strong enough to build money on. Honest limit: no factor set gives "max profit, almost no loss"; the realistic aim is small controlled losses and a small edge that survives costs.

**Weaknesses found in the current scout:**
1. It ignores the market (can show a BUY while the index falls).
2. The three direction votes (trend, MACD, VWAP) and the score's RSI/trend parts all come from the same price data, so they are correlated, not independent evidence.
3. No price levels (opening range, previous-day high/low, support/resistance); entry is at the last close, so it chases moves.
4. Volume only adds score points; it is not a requirement for an entry.
5. Costs (brokerage, STT, charges, slippage) are not modelled.
6. No risk layer: no position sizing, daily loss limit, trade-count limit, entry time windows or square-off rule.

**Decision on timeframe (2026-10-07):** the scout keeps 5-minute candles (standard intraday timeframe, less noisy than 1-minute, matches the history). It is re-run every minute and always includes the still-forming candle, so signals refresh each minute. 1-min and 15-min are compared later by replaying saved days (see step 10). Both 1-min and 5-min candles are already stored.

**What gets added, how, when (all on/off switches; each one starts only after the one before has a result):**

| # | Addition | How | When / stage | Phase |
|---|---|---|---|---|
| 0 | **Baseline** | No code change. Thu 8 Oct dry run, then the every-minute schedule if sensible. Record what the current rules pick. | Thu 8 Oct | A |
| 1 | **Paper trading with costs** | Cost model in the simulator, automatic paper loop, store indicators/score/market state with each signal and trade, results screen (win rate, average win/loss, net expectancy, max drawdown). | First build after the baseline works | B1–B4 |
| 2 | **Risk rules** | Risk about 0.5–1% of capital per trade; daily loss limit (stop at about −2%); max trades per day; no entries in the first 10–15 min or after about 14:45; square off before 15:15. Built into the paper loop first. | Same build as 1 | B / D |
| 3 | **Market filter** | BUY only when the market is not falling, SELL only when it is not rising. Proxy = average move of our 49 stocks (no new feed); later the Nifty index or sector data. | Right after 1–2 | C |
| 4 | **Price levels** | Opening range (first 15–30 min high/low), previous-day high/low, support/resistance; enter on a breakout or a pullback to VWAP, not at any price. Needs daily candles (available) and a few days of stored candles. | After about a week of paper data | C |
| 5 | **Volume requirement** | Make relative volume a gate (for example at least 1.2×) for entries instead of a score bonus. | With 4 | C |
| 6 | **Less correlated votes** | Replace or down-weight one overlapping price vote with independent evidence (market direction, sector, level breakout). | With 3–4 | C |
| 7 | **Smarter exits** | Move the stop to breakeven after a gain of one stop-distance, trailing stop, time stop for trades that go nowhere, reversal exit, partial profit. | After 1 has 2+ weeks of trades | D |
| 8 | **Event/no-trade calendar** | Skip results days, news days, circuit-limit and illiquid stocks; concentration limits (max signals per direction/sector). | After 3–5 | C / F |
| 9 | **Wider stop/target test** | Test 2×/3× ATR against the current tight levels, net of costs. | After 1 | B6 |
| 10 | **Timeframe test** | Replay the same stored days at 1-min, 5-min and 15-min and compare net expectancy. | After 1 has data | B / C |

**Second check (2026-10-07, same evening) — items the first list missed, now added:**

| # | Addition | How | When / stage | Phase |
|---|---|---|---|---|
| 11 | **Relative strength vs the market** | Prefer stocks moving more than the market in the trade's direction (stock % move minus the 49-stock average); one of the strongest intraday filters. | With 3 | C |
| 12 | **Daily-trend filter (higher timeframe)** | BUY only when the stock is above its 20-day average (or yesterday's close), SELL the reverse. Daily candles are already available. | With 3 | C |
| 13 | **Don't-chase / signal validity** | If the live price has already moved more than about a third of the way to the target, or past the stoploss, the signal is marked "missed", not shown as a fresh entry. A cooldown stops re-signalling the same stock right after its stop is hit. | With 1 (paper loop needs it) | B / D |
| 14 | **Realistic paper fills** | Paper entries/exits use the NEXT live price after the signal (plus slippage), never the signal's own price; otherwise paper profit is overstated. | With 1 | B |
| 15 | **Spread and liquidity check** | Skip a stock when the bid–offer gap is wide (the feed already sends bid/offer prices). | With 5 | C |
| 16 | **Volatility regime and special days** | Schedule the existing `market-conditions` function (step A5) and use it; add India VIX later; flag gap-up/gap-down opens, expiry days, budget/policy days and special sessions as reduced-size or no-trade. | With 3 and 8 | A / C |
| 17 | **Guard against over-fitting** | Tune rules on one block of days and judge them on later, unseen days (walk-forward). Never keep a change just because it looked good on the days it was tuned on. | From the first tuning onward | B / C |
| 18 | **Overall exposure limit** | Max open positions at once and max total capital at risk, on top of per-trade risk. | With 2 | D |
| 19 | **Feed and token alerts** | Warn on the Signals page when the feed has stopped writing or the Sharekhan login has expired, so an empty page is never mistaken for "no trades today". | Before the schedule runs unattended for long | A4 |

**Rule for every addition:** write down the baseline numbers first → add ONE change as a switch → run on paper long enough to mean something (100+ trades before judging) → keep it only if net-of-cost expectancy and drawdown improve → log the result here. Anything untested stays off.

**Operating notes (laptop phase):** the feed runs on the owner's laptop and needs the laptop awake, plugged in, online and not asleep (Windows Sleep set to Never; lid open) for 09:00–15:35; exactly ONE feed window. From the phone: Signals page, Sharekhan reconnect in Settings, and chatting all work; the browser-console dry run needs a desktop browser; restarting the feed needs the laptop. Moving the feed to a server (Phase E) removes this dependency. Signals-page expectation for 8 Oct: the page fills only after the every-minute schedule exists (about 10:00–10:30 if the 09:30 dry run looks right), and may show fewer than 10 on a quiet day because a signal needs a direction and a score of at least 60.

## 🧪 2026-10-07 (night) — Back-tester built (owner asked: "make it now and take the back-test")

**Why:** paper trading needs weeks; Sharekhan's REST history gives about a month of past 5-minute candles now. Replaying those days through the current rules gives a first answer much sooner. It can reject bad rules fast; a good back-test still needs paper trading before real money.
**What was built:**
- `supabase/functions/history-export` (new, READ-ONLY): signed-in users only; only stocks in the scout universe; max 10 per call; returns compact candles `[time, o, h, l, c, v]`; the Sharekhan token is read server-side and never returned. `config.toml`: `verify_jwt = false` (the function checks the session itself, like the others).
- `tools/backtest/download-snippet.js`: browser-console snippet; calls the function 5 times (10 stocks each) and saves `history-5minute-<date>.json`.
- `tools/backtest/backtest.mjs` + `run.mjs`: imports the live `indicators.ts`/`scoring.ts` (no copy, so the back-test always matches the scout). Decision after each closed 5-min candle; entry at the next candle's open + slippage; Signals-page stop/target; stop assumed first if one candle touches both; square-off 15:15; top 10, max 10 open, one per stock, 30-min cooldown; costs: brokerage 0.03%/side (CHECK the owner's Sharekhan plan — published figures range 0.02%–0.10%), STT 0.025% sell, exchange 0.00307%/side, SEBI 0.0001%/side, stamp 0.003% buy, GST 18% → 0.106% per round trip + 0.02%/side slippage. Reports baseline + switches (entry window 09:30–14:45, market filter = average move of the 49 stocks, yesterday-close filter, wider 2×ATR/2R levels, combinations), first-half vs second-half, by direction/hour/day, and a CSV of every trade.
- Tests: `tools/backtest/test-backtest.mjs` (14 checks: costs, warm-up, trend → direction, next-candle entry, level sides, target/stop fills, 15:15 square-off, net = gross − costs, one position per stock, maxOpen, no look-ahead across 15 cut points, stop-first rule, filters only remove trades, entry = next open + slippage). Mutation-tested: look-ahead leak, entry at the signal price, target over-fill, target-first, late square-off and maxOpen overflow are all caught. `tools/backtest/e2e/test-history-export.mjs` (6 checks: 401 without session, anon key rejected, only universe symbols, `M&M` works, interval whitelist, 10-symbol cap, 409 without Sharekhan token, token never returned).
- Sanity run on 24 days × 49 stocks of RANDOM made-up prices: gross expectancy ≈ −0.04% (= slippage) and net ≈ −0.15% per trade (= costs), as it should be for data with no edge. Run time ≈ 55 s.
**Limits:** about one month of data is a small sample; no historical bid/offer; closed candles only (the live scout also reads the forming candle); tuning on the same days over-fits — keep a change only if it helps in BOTH halves.
**To run it:** owner → Lovable: "Deploy the history-export edge function" → reconnect Sharekhan → paste `download-snippet.js` in the console → send the downloaded file to Claude → `node --experimental-strip-types tools/backtest/run.mjs <file>`.

## 📊 2026-10-07 (night) — First back-test on REAL data (5-minute, 6 days)

**History available from Sharekhan REST (checked 7 Oct, RELIANCE):** 5-min ≈ 6 days (438 candles, 28 Sep–6 Oct) · 15-min 6 days · 30-min and 60-min 24 days (1 Sep–6 Oct) · daily since 2000-01-03 (6,654 days). There is no date-range parameter (official SDK: `historicaldata(exchange, scripcode, interval)` only). Tue 6 Oct has candles → it was a trading day.
**Result, 49 stocks, 5 back-tested days (29 Sep–6 Oct), costs 0.106% + 0.02%/side slippage, Rs 1 lakh per trade:**

| variant | trades | win % | gross exp % | NET exp % | net Rs | max DD Rs |
|---|---|---|---|---|---|---|
| A baseline (live rules) | 365 | 40.8 | −0.025 | −0.131 | −47,771 | −47,771 |
| B entry window 09:30–14:45 | 327 | 37.9 | −0.044 | −0.151 | −49,238 | −50,262 |
| C market filter | 343 | 42.3 | −0.022 | −0.128 | −44,052 | −47,224 |
| D yesterday-close filter | 355 | 43.4 | +0.006 | −0.100 | −35,502 | −35,502 |
| E wider levels 2×ATR/2R | 188 | 39.4 | +0.004 | −0.102 | −19,261 | −21,036 |
| F = B+C+D | 289 | 45.7 | +0.022 | −0.085 | −24,492 | −26,481 |
| G = F + wider levels | 167 | 41.3 | +0.037 | −0.069 | −11,520 | −15,920 |

**Reading:** the current rules have NO edge before costs (gross ≈ 0) and lose after costs on every day tested. They also over-trade (~73 trades/day), so costs dominate. Filters and wider levels cut the loss but nothing is profitable. 5 days is far too few to pick a winner; this only says "do not trade the baseline with real money".
**Next:** 30-minute back-test over 24 days; add a max-trades-per-day / fewer-but-better selection (e.g. top 3 only, one entry per stock per day); keep collecting live days.

## 📊 2026-10-07 (night) — Back-test on 30-minute candles, 24 days

Same rules applied to 30-minute candles (1 Sep–6 Oct; first 4 days used to warm up indicators → 20 days tested; 1 duplicate-slot candle in INDUSINDBK on 18 Sep, negligible). NOTE: the live scout uses 5-minute candles; this tests the same rules on a slower timeframe over a longer period.

| variant | trades | win % | gross exp % | NET exp % | net Rs | max DD Rs | green days | 1st half Rs | 2nd half Rs |
|---|---|---|---|---|---|---|---|---|---|
| 21 Oct (Wed) | DOWN trend day: Nifty -0.88% (23,015 -> 22,811, range 22,650-23,121) | 10 (9 SELL, 1 BUY; old cap 10 reached 11:26) | **7/10 = 70%** (TMPV, COALINDIA, CIPLA, TATASTEEL, ADANIENT, NTPC targets; BAJFINANCE 82% then 15:15 close) | **+Rs4,794** (normal stop) | same (normal stop is live since 09:27) | misses: ITC BUY on a down day (stop), POWERGRID stop, BRITANNIA stop | strong SELL trend day confirms 'market day-type matters most'; feed OK all day; v4.2/494 stocks/fast exits/reversal deployed 15:34; feed watchdog + tick recording installed on laptop 15:40 (files verified identical) |
| 20 Oct (Tue) | n/a (no data) | 0 | - | Rs0 | - | system: FEED FAILURE - connected+subscribed 09:07 but no prices after 09:15 (no live_candles, no laptop day files); laptop at lock screen, cause unknown | owner out; fixed bugs (dedup + sector) went live 08:41 but untested |
| 19 Oct (Mon) | flat (breadth -0.26%..+0.21%) | 10 unique (+5 duplicates) | 0/10 (best 61% HDFCBANK) | -Rs1,426 (after dedup) | -Rs4,676 | market 10 (flat day) / rule: all 10 hit buy-price stop in 1-4 min / system: DUPLICATE trades bug, sector rule let MARUTI+EICHERMOT (auto) run together | owner rule lost less than normal stop today; Sharekhan+feed OK (517 symbols recorded); ntfy alerts not verifiable (system_logs not readable with app login) |
| A baseline | 382 | 42.4 | −0.007 | −0.114 | −43,366 | −48,980 | 7/20 | −21,105 | −22,261 |
| B entry window (no effect: first 30-min entry is 09:45 anyway) | 382 | 42.4 | −0.007 | −0.114 | −43,366 | −48,980 | 7/20 | | |
| C market filter | 360 | 47.8 | +0.053 | −0.053 | −19,059 | −23,347 | 10/20 | −14,497 | −4,563 |
| D yesterday-close filter | 382 | 40.6 | −0.024 | −0.130 | −49,636 | −53,472 | 8/20 | | |
| E wider levels | 280 | 40.4 | −0.024 | −0.131 | −36,617 | −46,548 | 8/20 | | |
| F = B+C+D | 357 | 45.7 | +0.035 | −0.072 | −25,592 | −33,075 | 11/20 | | |
| G = F + wider | 272 | 46.3 | +0.057 | −0.049 | −13,361 | −20,019 | 11/20 | −8,912 | −4,449 |

**Reading:** confirms the 5-minute result — baseline has no edge (gross ≈ 0) and loses after costs. The **market filter is the one change that helped in both tests and in both halves** (here: gross turns positive, loss cut by more than half). Half of all baseline trades (190 of 382) are entered at the first decision of the day (09:45) and those lose most (−Rs 29,347). The yesterday-close filter helped on 5-min but hurt on 30-min → not reliable. Nothing is profitable after costs yet.
**Next (proposed):** test "fewer but better" (top 2–3 only, one trade per stock per day, skip the first decision), market filter on by default; re-test as live days accumulate.

## 🧪 2026-10-07 (late night) — "Missing rules" tested in the back-tester

New back-test switches (all tested, 18 offline checks, mutation-tested): top-N per decision, max trades/day, one trade per stock per day, relative strength vs the 49-stock average, minimum relative volume, daily loss limit. `tools/backtest/run-rules.mjs` runs 12 variants fixed BEFORE seeing results; market filter (M) on in all except #0.

| variant | 5-min (5 days) net Rs | 30-min (20 days) net Rs | 30-min trades/day | 30-min NET exp % | 30-min green days |
|---|---|---|---|---|---|
| 0 old rules | −47,771 | −43,366 | 19.1 | −0.114 | 7/20 |
| 1 market filter M | −44,052 | −19,059 | 18.0 | −0.053 | 10/20 |
| 2 M + top 3 + 1/stock/day | −34,535 | −9,666 | 15.9 | −0.030 | 11/20 |
| 3 M + max 10/day + 1/stock/day | −11,376 | −11,218 | 10.0 | −0.056 | 6/20 |
| 4 M + skip opening | −35,079 | −26,856 | 16.9 | −0.079 | 8/20 |
| 5 M + relative strength | −40,024 | −23,158 | 17.8 | −0.065 | 11/20 |
| 6 M + volume ≥ 1.2× | −24,482 | −7,120 | 8.1 | −0.044 | 9/20 |
| 7 M + daily loss limit 5k | −32,486 | −14,888 | 16.9 | −0.044 | 10/20 |
| **8 FEWER BUT BETTER (M+2+3+4+5)** | −6,605 | **+1,430** | 9.8 | +0.007 | 12/20 |
| **9 = 8 + wider levels 2×ATR/2R** | −3,303 | **+6,934** | 9.8 | +0.035 | 11/20 |
| 10 = 8 + volume ≥ 1.2× | −6,332 | −196 | 0.8 | −0.013 | 4/20 |
| 11 = 8 + loss limit (never triggered) | −6,605 | +1,430 | 9.8 | +0.007 | 12/20 |

**Reading:** combining the rules works much better than any single rule: losses shrink about 90% and the 30-minute test turns slightly positive (#9: +Rs 6,934 over 20 days, max drawdown −Rs 10,238). BUT: +0.035% per trade on 197 trades is well inside noise; 12 variants were tried (some will look good by luck); #8/#9 lost in the FIRST half of both data sets and gained in the second. Verdict: a promising direction worth building into the scout and paper-trading, NOT evidence of profit. Real money stays off.

## 🧪 2026-10-07 (late night) — Batch 2: items 4, 7, 12, 16 tested (base = #9)

New switches (21 offline checks, mutation-tested): daily trend (N-day average of daily closes), skip gap opens, opening-range breakout, beyond yesterday's high/low, breakeven after R, time stop.

| variant | 5-min (5 days) net Rs | 30-min (20 days) net Rs | 30-min NET exp % | 30-min max DD Rs | 30-min 1st / 2nd half Rs |
|---|---|---|---|---|---|
| 9 fewer-but-better + wider (base) | −3,303 | +6,934 | +0.035 | −10,238 | −598 / +7,533 |
| 12 + daily trend (5-day) | −4,929 | −9,234 | −0.050 | −15,422 | −1,461 / −7,773 |
| 13 + skip gap opens > 1.5% | −2,927 | +259 | +0.001 | −13,174 | −1,638 / +1,898 |
| 14 + opening-range breakout | −6,301 | +11,400 | +0.058 | −10,412 | −2,610 / +14,010 |
| **15 + beyond yesterday high/low** | **−2,541** | **+12,627** | **+0.068** | **−7,030** | −4,191 / +16,818 |
| 16 + breakeven after 1R | −2,290 | +6,890 | +0.035 | −10,301 | −1,449 / +8,339 |
| 17 + time stop 90 min | −5,657 | −25,636 | −0.130 | −28,018 | −9,146 / −16,490 |

**Reading:** only #15 (trade only beyond yesterday's high/low) improved on BOTH data sets and lowered drawdown in both; #16 (breakeven) helped slightly on 5-min, neutral on 30-min. Daily trend and time stop hurt; gap filter neutral; opening range helped on 30-min but hurt on 5-min (inconsistent → off). 18 variants have now been tried on the same ~25 days, so the best ones are flattered by luck; the first half of every good variant is still negative.
**Candidate rule set "scout v3" (to build as switches, then paper-trade, NOT real money):** market filter + relative strength + no entries before 10:00 + top 3 per decision + one trade per stock per day + max 10 trades/day + stop 2×ATR / target 2R + only beyond yesterday's high/low (+ optional breakeven after 1R for the paper exits).
**Not testable on history:** spread check (no past bid/offer), alerts, exposure in rupees (needs capital), special days (too few in sample).

## 🔊 2026-10-07 (late night) — Volume, done properly (owner: "don't remove volume, look at increasing volume")

**Correction to the earlier volume rule:** it compared the last 2 candles with the previous 20 candles of the SAME day. Intraday volume is always high at the open and close and low at midday, so that rule mostly measured the time of day, not unusual interest. New switches compare like with like (earlier days, same time slot, up to 5 days, needs ≥ 2): slot volume (`todRvolMin`), today's volume so far vs usual by this time (`dayRvolMin`), rising slot-relative volume (`volRising`), and a ranking weight (`volRankWeight`). 23 offline checks incl. "a stock that is ALWAYS busy must not pass" (mutation-tested).
**Results on top of rule set v3** (v3 = #15 + breakeven 1R). 5-min compared from 30 Sep (first day lacks 2 earlier days of volume):

| variant | 5-min trades / net Rs / exp % | 30-min trades / net Rs / exp % / max DD |
|---|---|---|
| v3, no volume rule | 38 / +806 / +0.021 | 187 / +12,911 / +0.069 / −7,681 |
| old rule (last 2 vs previous 20 ≥ 1.2×) | 45 / −1,550 / −0.034 (all days) | 9 / +846 (kills almost every trade) |
| slot volume ≥ 1.5× usual | 36 / +6,202 / +0.172 | 159 / +4,815 / +0.030 / −11,564 |
| **today's volume so far ≥ 1.2× usual** | **32 / +3,279 / +0.102** | **128 / +11,975 / +0.094 / −8,812** |
| volume rising | 36 / +79 | 183 / −7,842 (hurts) |
| rank by volume (no filter) | ≈ no change | slightly worse |

**Decision:** add "today's volume so far ≥ 1.2× its usual by this time" to v3 — better profit per trade on BOTH data sets with ~30% fewer trades (lower cost and risk). Slot volume ≥ 1.5× was best on 5-min but weak on 30-min (inconsistent → not used). "Volume rising" hurts. Same caveats: few days, many variants tried.
**Rule set v3 (final candidate):** market filter · relative strength · beyond yesterday's high/low · today's volume ≥ 1.2× usual · no entries before 10:00 · top 3 per decision · one trade per stock per day · max 10/day · stop 2×ATR, target 2R · breakeven after 1R.

## 🔁 2026-10-07 (late night) — Second look at the ruled-out rules (reframed like a trader would use them)

Base = v3 incl. today's volume ≥ 1.2×. `tools/backtest/run-revisit.mjs`. New switches: time stop for LOSERS only, above/below today's open, levels "either", (25 offline checks, mutation-tested). 5-min compared on 30 Sep–6 Oct (4 days), 30-min on 20 days.

| reframed rule | 5-min net Rs | 30-min net Rs (max DD) | verdict |
|---|---|---|---|
| v3 | +3,279 | +11,975 (−8,812) | base |
| time stop, losers only, 60 min | +660 | −1,723 | worse → off |
| time stop, losers only, 120 min | +1,122 | +1,946 | worse → off |
| time stop (all), 180 min | +1,569 | +1,503 | worse → off. 2R targets need time; square-off at 15:15 is the only time exit |
| above/below today's open (gap held) | +3,279 | +11,975 | identical: already implied by market + relative strength + yesterday's levels |
| no entries after 14:30 | +3,745 | +11,543 (−8,496) | slightly better on 5-min |
| **no entries after 14:00** | **+3,652** | **+11,899 (−7,773)** | **better per trade on both, smaller drawdown → ADD** |
| yesterday's levels OR opening range | −910 | +15,222 | inconsistent → off |
| opening range as well | −2,262 | +8,680 | worse → off |
| **daily loss limit Rs 2,000** | +3,279 (never hit) | **+12,176 (−7,773)** | **safety rule, slightly better → ADD** |
| daily trend | — | — | NOT re-tested yet: needs real daily candles (20-day average); the 5-day average from 24 days was too crude. Daily data is available (since 2000) |

**Volume strictness (owner: volume is a must):** volume stays a MANDATORY gate — no unusual volume, no trade. `run-volume-strength.mjs`:
5-min / 30-min net Rs: none +806 / +12,911 · ≥1.0× +1,050 / +9,076 · **≥1.2× +3,279 / +11,975** · ≥1.5× +262 / +10,141 (30-min win 58%, DD −6,244) · ≥2.0× +2,168 / +4,396 (too few trades) · ≥1.2× AND current candle ≥1.0× +2,963 / +11,529 (DD −7,773). 1.2× is the best balance on both; 1.5× is a candidate for a "stricter" mode.
**Rule set v3 (updated):** market filter · relative strength · beyond yesterday's high/low · **today's volume ≥ 1.2× usual (mandatory)** · entries only 10:00–14:00 · top 3 per decision · one trade per stock per day · max 10/day · **stop new trades after −Rs 2,000 on the day** · stop 2×ATR, target 2R · breakeven after 1R · square-off 15:15.

## 🛡 2026-10-07/08 (night) — Owner's idea: softer volume entry + manage the trade after entry

**Owner's idea:** take a stock when volume is RISING or BURSTS (not only a big daily total); after entry keep watching — if price or volume weakens, tighten the stop so we exit with a small profit / no loss; if it stalls short of target and candles turn, exit early.
**Built (28 offline checks, mutation-tested):** `volMode` soft/either; exits: trailing stop (k×ATR from best close, never loosens), profit lock (+1R → stop at entry + costs = no-loss; +1.5R → lock +0.75R), reversal exit (in profit, close back below previous candle low or VWAP → exit next open), volume-fade exit (in profit, candle against us with below-usual and falling volume → exit next open). `tools/backtest/run-manage.mjs`. Base v3 now includes entries 10:00–14:00 and the Rs 2,000 daily loss limit.

| variant | 5-min (4 days) net Rs / win % / max DD | 30-min (20 days) net Rs / win % / max DD |
|---|---|---|
| M0 v3 | +3,652 / 37% / −3,607 | +11,061 / 53% / −7,773 |
| M1 soft volume (rising OR burst) | +6,554 / 44% / −3,332 | +2,302 / 51% / −10,668 (inconsistent) |
| M2 either volume (day 1.2× OR burst 2× OR rising) | +5,997 / 44% / −3,733 | +10,717 / 52% / −8,099 |
| M3 trailing stop 1.5 ATR | +3,719 / 45% / −2,838 | +13,108 / 54% / −7,012 |
| **M4 profit lock** | **+5,321 / 63% / −3,460** | **+12,094 / 58% / −7,481** |
| M5 reversal exit | +102 / 57% / −2,566 | +10,487 / 56% / −5,863 |
| M6 volume-fade exit | −42 | +2,868 (hurts) |
| M7 all smart exits | −660 | +7,621 |
| M11 v3 + lock + trail | +3,561 / 52% / −2,692 | +14,666 / 58% / −6,866 |
| M12 either volume + lock | +8,448 / 67% / −3,460 | +12,003 / 57% / −7,806 |
| **M13 either volume + lock + trail** | **+5,452 / 50% / −2,692** | **+14,232 / 56% / −7,020** |

**Reading:** the owner's idea works in its simple forms: the PROFIT LOCK (move the stop to no-loss at +1R, lock profit at +1.5R) improved both data sets and raised the win rate to ~60%; a trailing stop helped; the softer "either" volume rule helped. The "exit at the first sign of weakness" rules (reversal, volume fade) exited too early — the price often dips and continues — and reduced profit, so they are OFF. M13 improved both data sets AND lowered the worst losing run in both → becomes rule set v4. Same caveats: ~24 days, many variants tried; paper-trade before real money.
**Rule set v4:** market filter · relative strength · beyond yesterday's high/low · volume: today ≥ 1.2× usual OR a burst ≥ 2× usual in the last candle OR volume rising 3 candles in a row (with today ≥ 1.0×) · entries 10:00–14:00 · top 3 per decision · one trade per stock per day · max 10/day · stop for the day at −Rs 2,000 · stop 2×ATR, target 2R · at +1R stop moves to no-loss, at +1.5R locks +0.75R · trailing stop 1.5×ATR from the best close · square-off 15:15.

## ▶️ 2026-10-16 (Fri) — Resumed; Stage 0 in progress

Nothing was run between 8 and 15 Oct (owner busy) — the plan simply paused; no data from those days. Today (owner on holiday, market open) we resume Stage 0.
**New on the laptop (`D:\intraday\live-feed`):** `start-feed.bat` (double-click: closes any earlier feed window titled INTRADAY-FEED, then runs ONE `node feed.mjs`) and `stop-feed.bat`. Reason: the owner prefers not to type commands; Claude cannot type into terminals.
**Shifted dates:** Stage 1 (v4 + ~200 stocks) and Stage 1b (automatic paper trading) built over the weekend 17–18 Oct; first automatic paper-trading day **Mon 19 Oct**. Tue 20 Oct is a market holiday (Dussehra).

## ⚙️ 2026-10-16 (Fri, midday) — Stage 1 + 1b BUILT (v4 live scout + automatic paper trader)

- `_shared/v4.ts` + `scout-signals` (rules='v4' is now the default on the live path): closed 5-min candles only; market filter, relative strength, beyond yesterday's high/low, volume either-rule, entries 10:00–14:00, score ≥ 60, stop max(2×ATR, 0.25%), target 2R; top 3 per run, one signal per stock per day, max 10 per day; signals tagged `indicators.rules='v4'` with reasons + management settings. Old v2 path kept (`rules:'v2'`). **Verified: on the real 5-min history the live v4 code picks 36/36 of the back-tester's trades with identical stop/target** (`tools/backtest/test-v4-live-matches-backtest.mjs`). Scout e2e tests: 23 pass.
- `_shared/paper.ts` + new `paper-trader` function: every minute; enters each new v4 signal at the open of the candle forming at signal time (+0.02% slippage), ₹1 lakh per trade, manages on each closed 5-min candle with the v4 exits (stop, target, breakeven at 1R, lock no-loss at 1R / +0.75R at 1.5R, trail 1.5×ATR, square-off 15:15), daily loss stop −₹2,000, max 10 open, summary to `system_logs` after 15:30. Uses `simulated_trades` (+ new columns, `tools/sql/paper-trader-setup.sql`). **Verified: exits identical to the back-tester on all 36 trades** (`tools/backtest/test-paper-matches-backtest.mjs`); e2e 6 checks (e.g. a +1R trade that reverses closes at the locked stop with +₹104 instead of a loss). Signed-in users can call it read-only to see today's paper P&L. No real orders anywhere.
- **To go live (owner):** SQL + deploy `scout-signals` and `paper-trader` (Lovable), then the every-minute jobs.

## 🟢 2026-10-16 (Fri, afternoon) — LIVE: v4 signals + automatic paper trading running

- 13:15 Lovable (1 credit; 4 left): SQL applied (paper columns) + `scout-signals` and `paper-trader` deployed.
- 13:27 **Stage 0 dry run PASSED** on live data: 49/49 stocks, 0 errors, 18 live 5-min candles + 657 history candles each, ~37 s per run. v4 candidates at 13:27: GRASIM BUY, POWERGRID BUY; the other 47 skipped with clear reasons (mostly choppy).
- 13:43 Owner ran the job SQL in the SQL editor (free): `scout-v4-every-minute` and `paper-trader-every-minute`, cron `* 3-10 * * 1-5` UTC, x-job-token 'cron', pg_net timeout 120 s.
- 13:49 **First automatic paper trades:** HEROMOTOCO BUY 5,224.04 (13:40), ULTRACEMCO BUY 10,973.19 (13:40), GRASIM BUY 2,912.68 (13:45). Results after the 15:15 square-off / 15:30 summary.
- **Known issue:** Lovable shows "Build unsuccessful — Preview is out of date" for the web app since ~6 Oct (frontend build only; edge functions deploy fine). To investigate.
- **Owner rules today:** ask before any action that uses Lovable credits; SQL always via the free SQL editor.

## 📒 2026-10-16 (Fri, close) — First paper-trading day: result + learnings

| Stock | Dir | Entry (IST) | Entry ₹ | Exit (IST) | Exit ₹ | Why | Net % | Net ₹ |
|---|---|---|---|---|---|---|---|---|
| HEROMOTOCO | BUY | 13:40 | 5,224.04 | 14:05 | 5,208.71 | stop | −0.400 | −397 |
| ULTRACEMCO | BUY | 13:40 | 10,973.19 | 14:30 | 10,938.93 | stop | −0.418 | −413 |
| GRASIM | BUY | 13:45 | 2,912.68 | 14:25 | 2,912.32 | lockedstop | −0.119 | −118 |

**Day: 3 trades, 0 wins, net −₹928 after all costs** (daily loss limit −₹2,000 not reached). One day is far too small to judge; stage 5 needs 100+ trades.

Learnings (to test in the back-tester, NOT changed live yet):
1. **Same sector, same minute:** ULTRACEMCO + GRASIM are both cement (same group), and all three were BUYs within 5 minutes → really one bet, not three. Supports the planned v5 sector limit (max 1 per sector at a time).
2. **Late entries:** all came 13:40–13:45, near the 14:00 cut-off, with little time left to reach 2R. Test a later-entry penalty or an earlier cut-off (e.g. 13:30) for v5.
3. **"Locked" stop that still lost:** GRASIM's trailing stop moved to 2,912.90, just above the entry, and was marked "locked". But a stop that close to the entry doesn't cover costs and slippage (needed ~2,916.9), so the exit still lost ₹118. Test this rule: only count a stop as locked once it covers costs, or don't trail until 1R.
4. **Feed:** the laptop restarted in the afternoon and the feed did not come back on its own (all trades had already closed, so today's results are not affected). To do: auto-start the feed at login (Windows Task Scheduler), with the owner's approval.
5. **Owner can't see results in the app:** signals expire after 30 min and the Signals page shows active ones only; there is no Paper Trades screen. Fixes A/B pending.

Build: the "Build unsuccessful" cause was found. Lovable added drizzle-kit, drizzle-orm and postgres to package.json (commit 1c3618c) without updating package-lock.json. Lovable commit a0fc0d8 (15:23 IST) updated the lock file; it now matches package.json (checked). Owner to confirm the build turns green.

## ⏰ 2026-10-16 (Fri, 16:36) — Automatic feed + new screens
- Laptop: `auto-feed.bat` (runs the feed only Mon–Fri 08:55–15:35; restarts it after 30 s if it stops during market hours) and `setup-auto-feed.bat` (run once by the owner, OK). Created: task `IntradayFeed-Start-0900` (weekdays 09:00), task `IntradayFeed-Stop-1540` (weekdays 15:40), and Startup-folder `intraday-auto-feed.bat` (starts the feed 1 min after sign-in if it is market hours). First run Mon 19 Oct. The laptop must be on and signed in; Sharekhan must still be connected each morning. Undo: delete the 2 tasks + the Startup file.
- Known small bug (not fixed, owner not yet asked): `start-feed.bat` uses `>/dev/null` (not valid on Windows), so its "close an earlier feed first" step doesn't run.
- App (commit e1494ae, pushed free via GitHub): new **Paper Trades** page; Signals page shows all of today's signals (expired ones marked); tailwind plugin changed from require() to an ES import. **Still "Build unsuccessful" in Lovable for every GitHub push** (since 6 Oct). The lock file is in sync and there is no GitHub check, so Lovable's two suggested causes are not it. The real error is only visible to Lovable. Lovable's own edits build fine. Next: when a credit is available, send Lovable "Rebuild the preview from the latest GitHub main. If the build fails, show me the exact error text and fix only that error. Change nothing else."

## 🔬 2026-10-16 (Fri, evening) — Lessons back-tested, v5 setups tested, feed upgrade ready, why today lost

**Data:** fresh 5-min candles (49 stocks) fetched read-only and merged with the 7 Oct file: 13 days (28 Sep – 15 Oct). 10 tested days (first 3 warm up the volume averages); **6 of them (8–15 Oct) were never used to build v4** = honest out-of-sample test. Sharekhan's history did not contain 16 Oct yet.

`tools/backtest/run-lessons.mjs` (variants fixed before running; new back-tester switches maxPerSector, trailAfterR, partialAtR, minBreadthAbs, riskRs, setup='vwapPullback'|'orb'; old 28 checks + live/paper 36/36 matches still pass):

| Variant | Trades | Win% | Net ₹ all | Max DD ₹ | Net ₹ OLD days | Net ₹ NEW days |
|---|---|---|---|---|---|---|
| v4 (live today) | 94 | 46 | +2,963 | −6,126 | +3,315 | −352 |
| one per sector | 89 | 49 | +9,559 | −4,125 | +7,662 | +1,897 |
| entries 09:45–13:30 | 97 | 41 | −1,811 | −9,837 | +1,016 | −2,827 |
| trail only after +1R | 95 | 66 | +14,887 | −3,600 | +5,073 | +9,815 |
| skip choppy (±0.2%) | 80 | 46 | +1,635 | −5,508 | +1,648 | −13 |
| half at +1R | 95 | 46 | +1,573 | −6,249 | +1,944 | −370 |
| equal risk ₹500 | 95 | 48 | +2,692 | −4,565 | +1,942 | +750 |
| **sector + trail after 1R (L9)** | 88 | 69 | **+19,206** | **−2,970** | +9,177 | **+10,030** |
| L9 + ₹500 risk | 88 | 69 | +15,471 | −2,488 (9/10 green days) | +8,445 | +7,026 |
| VWAP pullback | 96 | 36 | −4,694 | | +189 | −4,883 |
| VWAP pullback + yesterday level | 72 | 40 | +2,803 | | +5,619 | −2,816 |
| ORB 30 min | 93 | 39 | −9,561 | | −1,118 | −8,444 |
| ORB 15 min | 93 | 46 | +6,244 | | −2,655 | +8,899 |

Robustness: trail-after 0.75R / 1.5R / no trailing all give similar results (+15.5k…+19.5k), so the gain is real: **the 1.5×ATR trail starting before +1R was choking trades.** Choppy filter: 0.1/0.2/0.3 inconsistent → not adopted yet. Earlier cut-off (owner's lesson 2) → worse, rejected. VWAP pullback / ORB → not consistent in both halves, not adopted. Range trading not yet tested.
**Recommendation: v4.1 = v4 + one stock per sector + trailing only after +1R** (needs a scout/paper-trader deploy = 1 credit). Equal-₹-risk sizing for the real-money stage.

**Why 16 Oct lost (checked from the database, read-only):**
- The feed only ran **12:00–15:08 IST** (it was started late; the laptop restarted at ~15:08). So for today the scout saw no candles 09:15–12:00: "stock up X% today", market direction, VWAP and day volume were all measured **from 12:00, not from the open** (e.g. ULTRACEMCO "day volume 0.23x"). The signals were based on half a day.
- The feed itself was fine while running: ~21 prices per stock per minute (one every ~3 s), only one 1-minute gap (12:22). It did not miss the moves that hit our stops.
- The market was nearly flat (+0.11%), with 2 of 3 trades in cement (same bet). GRASIM reached +0.99R, then the early trail moved its stop to just above entry → −₹118 (fixed by "trail after 1R").
- Paper entry uses the open of the candle that was forming when the signal came (13:40 open for a 13:44 signal), as in the back-test; real fills would be at the 13:44 price. Small difference (~₹1–2 per share today) but to fix: enter at the first price after the signal.
Fixes: feed now starts automatically at 09:00 (done); add a "complete data" guard (no trade unless today's candles start by 09:20) and the real-time entry price — both need a deploy.

**Feed upgrade (ready, NOT installed yet; owner approval needed):** `tools/live-feed/` = laptop files. New `recorder.mjs` keeps our own history in `D:\intraday\live-feed\data\`: `candles-YYYY-MM-DD.csv` (every 1-min candle, rewritten every 5 min) and `book-YYYY-MM-DD.csv` (once a minute per stock: price, best bid/offer + sizes, total buy/sell quantity waiting, from fields Sharekhan already sends). `parse.mjs` keeps the book fields. Tests: recorder 5/5, offline 23/23, end-to-end 11/11. The Nifty index is not recorded yet (needs Sharekhan's index code — to find).

## 📼 2026-10-16 (Fri, 18:00) — Feed upgrade installed on the laptop + records ~500 stocks and 24 indices
- Installed (owner approved): `feed.mjs`, `parse.mjs`, `recorder.mjs`, `test-recorder.mjs`, `check-feed.bat`, `record-extra.csv` in `D:\intraday\live-feed` (old copies: `feed.mjs.bak-16oct`, `parse.mjs.bak-16oct`). Owner ran `check-feed.bat` on the laptop: 28/28 checks passed.
- From Monday the feed writes `data\candles-YYYY-MM-DD.csv` (1-min candles) and `data\book-YYYY-MM-DD.csv` (order-book snapshot per minute).
- `record-extra.csv`: 494 Nifty 500 stocks (list from Wikipedia's NIFTY 500 page; HEG and JBCHEPHARM not in scripcodes) + 24 NSE indices (NIFTY 20000, NiftyBank 26009, IT 26008, FMCG 26024, Energy 26025, Pharma 26028, Auto 26033, Metal 26034, Realty 26021, PSU Bank 26027, Pvt Bank 26057, Fin Serv 26039, …). **Recorded only** — never sent to the database; the app still trades the 49 stocks. The feed asks for the 49 first, then the extras in a second message; **safety switch**: if after 90 s fewer than half of the 49 still arrive, it drops the extras for the day. Tests: extras 6/6 (incl. the safety switch), e2e 11/11, offline 23/23, recorder 5/5. To verify Monday: index prices arrive via "NC<code>" (unverified until the market is open), and Sharekhan's limit on stocks per connection.
- Sensex: Sharekhan's scrip list has no BSE codes; Sensex ≈ Nifty, so Nifty + sector indices are used instead.
- Data options checked: Sharekhan API has no date range (1–15 min = last 9 trading days, 30/60 min ≈ 1.5 months, daily = years). Zerodha Kite Connect ₹500/month includes historical candles (needs a Zerodha account; owner prefers no extra hassle for now). TrueData ≈ ₹1,440–2,796/month (live plans; history depth not published), Global Datafeeds = quote on request. Plan: free route (own recording + weekly Sharekhan pulls), revisit paid data later.

## 🧩 2026-10-16 (Fri, night) — Rule set v4.1 written and tested (NOT deployed; needs one Lovable deploy = 1 credit)
- `_shared/sectors.ts` (new, shared with the back-tester) + `_shared/v4.ts` v4.1: **one stock per sector** (`pickV4`, counting open paper trades), **late-start guard** (a stock is not traded if today's first candle starts after 09:20 → 16 Oct-type half-day data can't produce signals).
- `_shared/paper.ts`: **trailing stop only after +1R** (`trailAfterR: 1`).
- `paper-trader`: **entry at the first price after the signal** = open of the 1-minute candle after the signal minute (+slippage); the rest of that 5-minute window is managed from 1-minute candles, then 5-minute candles. Falls back to the old 5-minute entry if no 1-minute candle appears within 3 minutes. Trades record `details.entry_mode` and `details.version`.
- `scout-signals`: signals tagged `indicators.version = 'v4.1'`; response shows `openPaperTrades`.
- Tests: `test-v41.mjs` 7/7 (incl. **v4.1 live picks = back-test in 75/75 runs**), paper = back-test exits 105/105 (13-day file) and 36/36, live v4 picks 105/105, back-tester 28/28, paper-trader e2e 6/6 + new 1-minute-entry e2e 5/5, scout e2e 23/23.
- **To go live:** one Lovable message (when a credit is available) — deploy `scout-signals` and `paper-trader` from GitHub main AND fix the frontend build (Paper Trades screen).
- Monday check-ins scheduled: 09:20 IST (feed + extras) and 15:45 IST (paper results).

## 📅 2026-10-16 (Fri, night) — Daily-chart filters tested on v4.1 trades (`run-daily-filters.mjs`)
Daily candles fetched read-only (Sharekhan gives daily since 2000; kept 2026 in /home/claude/data/daily-2026.json, not in git). 88 v4.1 trades (1–15 Oct), split by conditions known before the day starts:
- trend agrees with 20-day avg: YES 0.175%/trade vs NO 0.275% → no help
- 50-day avg agrees: 0.208% vs 0.232% → no help
- 20-day avg rising in trade direction: 0.258% vs 0.175% (both halves +) → **small hint, re-test with more data**
- near 20-day high/low: 0.233% vs 0.211% → no real difference
- last 5 days in trade direction: 0.218% vs 0.219% → none
- yesterday narrow day: 0.123% vs 0.238% (15 trades) → too few
- volatile stock (>2%/day): 0.149% vs 0.298% → **hint: calmer stocks did better per trade; re-test**
Conclusion: no daily filter is adopted; v4.1 stays as is. Re-test the two hints when we have more days.

## 🌐 2026-10-16 (Fri, 20:50) — Screens published on GitHub Pages (free); Lovable unchanged
- Finding: the app builds cleanly on GitHub Actions in 4 ways (npm ci + build, build:dev, bun install --frozen-lockfile + build:dev, lint) → the "Build unsuccessful" on Lovable is inside Lovable's GitHub-sync builder, not our code. Workflow `.github/workflows/build-check.yml` builds every push.
- `.github/workflows/pages.yml` publishes the screens to **https://engamit83.github.io/intraday-insight/** on every push to main (owner switched Pages source to "GitHub Actions"). `vite.config.ts` base = env VITE_BASE_PATH (only set for Pages; Lovable still "/"), router basename = BASE_URL. Same database/login (email+password).
- Use the GitHub address to view signals/paper trades; keep using the Lovable address for "Connect Sharekhan" (Sharekhan returns to the Lovable address). Back-end deploys (v4.1) still need one Lovable message.

## 🧪 2026-10-16 (Fri, 22:30) — Owner's exit rule and range trading, first back-tests (10 days, 49 stocks)
`run-owner-exit.mjs` (same v4.1 signals, only the exit differs; back-tester switch `stopAtEntry`, record `laterHitTarget`):
| Exit rule | Trades | Win% | Net Rs | Note |
|---|---|---|---|---|
| v4.1 (stop 2×ATR) | 88 | 69 | **+19,206** | 9 of 62 non-target exits later reached target |
| Owner: stop at buy price | 95 | 0 | **−13,897** | **all 95 closed inside the first 5-min candle** (price almost always ticks below the entry right after buying); **41 of 95 later reached the target** |
| Owner + 0.1% room | 95 | 19 | −8,780 | 51 closed in the first candle; 31 of 87 later hit target |
| Owner + 0.2% room | 85 | 31 | −4,524 | 21 closed in the first candle; 23 of 72 later hit target |
Reading (per intent rule 5): many picks were right (43% reached the target after we were stopped out), but a stop exactly at the buy price is hit by the normal first-minutes wobble → exits too tight. Shown to the owner for a decision.

`run-range.mjs` (rule C7, same-day detection only: 1-hour band 0.8–2.5%, ≥2 touches each edge, flat VWAP, rejection candle at the edge, target near the other edge, exit on range break): **all versions lost** (best −Rs 11,599 on 58 trades; most exits were range breaks: 70 of 137). Large-cap stocks on these trending days broke their ranges more often than they held. Next tries: multi-day range candidates, longer-held ranges (≥ 2 h), wider bands (≥ 1.2%), only on flat-market days; test on the 500-stock recordings.

## 🛠 2026-10-16 (Fri, 23:10) — Owner's buy-price stop + learning record built (NOT deployed; goes with the v4.1 Lovable message)
- `_shared/paper.ts`: `PAPER.exitMode = 'buyPrice'` (stop at the fill price from the start; `'normal'` = back-tested stop). `newTrack/trackOnCandle/trackDone`: per trade, prediction (target reached before 15:15 and before the signal stop; best move in R) + shadow result with the normal v4.1 exits.
- `paper-trader`: opens trades with `stoploss` = buy price (`initial_stop` keeps the signal stop), `details.track` updated every minute — also after the trade itself has closed; report shows `targetReached` and `normalStopNetRs`.
- Paper Trades screen: columns "Target reached?" and "With normal stop", plus the running score "X of Y reached (Z%)" with the agreed decision rule.
- Tests: owner-rule e2e 5/5, learning-record unit 4/4, normal-mode e2e 6/6 and 1-min 5/5, paper = back-test exits 105/105.

## 📱 2026-10-17 (Sat, 01:00) — Charts per trade (live) + phone alerts via Telegram (built, not deployed)
- Paper Trades screen: click a trade → its day's 5-minute chart with buy point, exit point, stop, normal stop and target (`src/components/TradeChart.tsx`). Live on GitHub Pages.
- `_shared/notify.ts` + `paper-trader`: Telegram alerts — paper trade opened (with stop and "why chosen"), closed (reason, net ₹), day summary (incl. targets reached), **Sharekhan not connected** (from 08:50, hourly), **price feed off** > 3 min (from 09:20, every 30 min). The chat is linked automatically from the owner's first message to the bot. Token stored only in backend table `notify_settings` (RLS on, no policies) — `tools/sql/notify-setup.sql`, owner pastes the token himself. Alerts never block trading logic.
- Tests: alerts e2e 4/4 (fake Telegram), paper-trader e2e 6/6, 1-min 5/5, owner 5/5, scout 23/23.
- Goes live with the same single Lovable message (deploy scout-signals + paper-trader).

## 🚀 2026-10-17 (Sat, 14:22) — DEPLOYED: scout-signals + paper-trader from GitHub main f06589f (1 Lovable credit; 4 left)
Live from Monday 19 Oct: rule set **v4.1** (one stock per sector, late-start guard, trailing only after +1R, paper entry at the first price after the signal), **owner's buy-price stop** as the paper rule, learning record (target reached? / normal-stop shadow), "why chosen" on every signal, Telegram alert code (silent until `notify_settings` exists with a token — owner's bot setup pending: open the bot, send "hi", then run tools/sql/notify-setup.sql with the token). Lovable did not run a test call; first real check = Monday 09:20 / 15:45 check-ins (signals tagged version v4.1, trades with details.track).

## 📌 Rule for this file going forward

**Every time we test something, fix something, or confirm something with evidence, add an entry here before moving on.** This file is the single source of truth for "where we are" — if the conversation resets or context is lost, read this file first to know exactly what's been tried, what's confirmed, and what's next. Update the Experiment Log table for anything related to Bug 3.4, and add new numbered bugs/phases as new issues are found.

## 17 Oct 2026 (evening) - phone alerts: ntfy added next to Telegram (af6bcad)
- Owner could not log back in to Telegram (SMS code not arriving). Owner asked to keep BOTH so we can switch at once.
- `notify.ts` now sends to ntfy (free app, no account) and/or Telegram. `notify_settings.channel` = 'ntfy' | 'telegram' | 'both'
  (default 'both'; each channel is used only if its setting is filled). Test: test-notify.mjs 6/6.
- Private ntfy topic name was given to the owner in chat only (NOT stored in GitHub). Owner subscribes to it in the ntfy app
  and runs tools/sql/notify-setup.sql + the ntfy insert line in the Lovable SQL editor.
- Goes live with the next Lovable deploy (1 credit, needs owner approval; bundle with other changes).

## REVIEW ROUTINE (owner approved 17 Oct 2026, 22:38) - scheduled tasks deliver into this session
**Daily review, weekdays 15:45 IST (read-only):**
1. Today's paper trades (simulated_trades rules=v4) + signals: per pick - why chosen, target reached? (pred.reached / best %),
   owner buy-price result vs normal-stop result (track.shadow), net after costs; day total.
2. Reason for each miss: MARKET (Nifty flat/down, news) / RULE (weak stock, late entry, sector, direction) / SYSTEM (feed, Sharekhan).
3. Market mood: Nifty 50 day change % and intraday range (index rows NC20000 in live_candles or laptop book/candles CSV). Log it - after
   ~3 weeks test "skip flat days".
4. System health: feed from 09:15? day files written on laptop? Sharekhan connected? ntfy alerts sent (system_logs source=notify)?
5. Append a row to the REVIEW LOG below, push, send the owner a short plain-words report.
6. NO rule changes before ~30 decided trades, except clear bugs (and those only after the owner's "do it").
**Friday 16:15:** also pull Sharekhan's last 9 trading days of 1/5-min candles to grow the history (if Sharekhan connected today).
**Saturday 10:00 weekly review:** patterns across the week (BUY vs SELL, time of day, sector, price band, market mood), back-test any idea
on all recorded days, propose (never apply) changes with numbers. Running prediction score vs the 50%/40% rule.
**Decision point:** ~30 decided trades (around early Nov) -> apply the owner's 50/40 rule, propose changes for approval.

### 📈 IMPROVEMENT TRACKER (owner 22 Oct 21:22: "give me the report every day and how our app improved - it should improve exponentially")
Every daily review MUST add a row here AND report it to the owner: the app's numbers today vs before, so the improvement curve is visible.
Columns: Day | Strategy version | Trades | Winners % | Avg loss R | Biggest loss Rs | Losing day? | Net Rs (after costs) | Cumulative Rs | Research done today (variants tested, best robust finding) | Improvement proposed / applied
| Day | Version | Trades | Win% | Avg loss | Biggest loss | Losing day | Net | Cumulative | Research today | Improvement |
|---|---|---|---|---|---|---|---|---|---|---|
| 22 Oct (old v4.2, live) | v4.2 | 30 | 10% target | -0.9R | -Rs1,783 | yes | -Rs16,475 | - | 62,208 SIP variants started; textbook rules rejected (costs) | stocks in play built, live from 23 Oct |
| 23 Oct (STOCKS IN PLAY day 1, live ticks) | SIP K15 stop1.5 | 9 | 56% | -1.10R | -Rs1,133 | no | +Rs3,968 | +Rs3,968 | live = replay exactly; all days now +28.6R (76 trades, 0 losing days); tested market-direction filter (-7.5R, rejected), wider trail on big winners (no gain), no-loss at +0.5R (-10R), re-entry once after a stop (+35.3R, both halves better) | proposal: one re-entry after a stop-out (needs do it); smart warning live (alert only, net ~+Rs100 today) |
| 26 Oct (Proposal B + quality size + circuit safety + 3-of-6 re-entry + smart exit 0.3R, day 1) | SIP-B | 9 (2 re-entries) | 33% | -1.00R | -Rs1,702 (J&KBANK re-entry 1.5x) | YES | -Rs5,508 | -Rs1,540 (SIP since 23 Oct) | replay = live exactly; variants on today: no quality size -Rs4,935, no re-entry -Rs4,298, smart exit saved Rs630 (BELRISE -0.5R vs -1.1R), in-loss 0.5R worse (-Rs5,749); Stock X (gap-skipped) would have lost -Rs2,717 at 0.5x (5 trades, 0 won) -> B saved it | proposal for weekend test: re-entry at 1x size (no 1.5x) - today +Rs567; cloud 'feed OFF' alert false when cloud refuses saves |

### REVIEW LOG
| Day | Nifty mood | Picks | Target reached | Net (owner rule) | Net (normal stop) | Misses: market/rule/system | Notes |
|---|---|---|---|---|---|---|---|

**ntfy for my reports (owner, 19 Oct 08:54: "u can notify me on ntfy whatever"):** after each check/review, also send a 1-line
summary to the owner's ntfy channel via the laptop's built-in browser pane: navigate to
https://ntfy.sh/<topic>/publish?title=Claude&message=<url-encoded text> (topic is in chat history, not in GitHub). Needs the laptop
on + Claude app open; if ntfy.sh access is asked each time, ask the owner to allow it permanently.
| Thu 22 Oct (v4.2, 494 stocks, first tick-exit day) | Nifty fell to about -0.8% by ~10:07, then recovered to -0.01% (flat) | 30 (28 SELL / 2 BUY), all entered 10:01-12:18 - daily cap 30 used up by 12:18 | 3/30 = 10% (AARTIIND, ABCAPITAL, ZEEL) | - | -Rs16,475 (22 stops, 4 square-offs at 15:15, 1 profit lock, 3 targets) | MARKET+RULE: 15 SELLs in 10:01-10:11 at the market's low, then the market bounced -> 11 stopped 10:12-10:43; afternoon SELLs with market ~0% (filter lets SELL through when market is flat). SYSTEM ok: feed 09:00-15:35 all 494, tick exits 30/30 within 1 s, 16x HTTP 503 on candle saves (retried, nothing lost) | PROPOSALS (owner decides): (1) stricter market direction - SELL only if Nifty <= -0.3% AND still falling (below its VWAP / not 0.3% off its low), mirror for BUY; (2) max ~5 new trades in the same direction per 15 min (they all move with the market); (3) laptop report: morning direction BUY 75% / SELL 18% - today was a BUY day. Fix 22 Oct: Friday history pull now runs in its own window (15:40 stop task can't cut it). |
| Fri 23 Oct (STOCKS IN PLAY day 1) | Nifty -0.65%, SELL day (laptop: SELL 86% / BUY 7% worked) | SIP: 10 picks at 09:20:00, 9 trades (6 SELL / 3 BUY), entries 09:20-09:45 on ticks | 5 winners (trail), 4 stops | - | SIP +Rs3,968; old v4.2: 31 trades all SELL, 5 targets, -Rs9,306 | Losers: SWIGGY (+0.7R then stop in 4 min, then fell 14%!), WELCORP, SAGILITY, CHOLAFIN (BUYs on a down day). Winners: J&KBANK +3.1R (stock fell 17% - trail exited at -4.7%), HAVELLS +2.1R, NAM-INDIA +1.9R, COLPAL +1.2R. SYSTEM: feed ok all day; app candle saves refused (HTTP 503) ~20 times + open_trades 503 at 15:35 - app database under load, nothing lost; smart warning started 12:33 by hand | Missed: JUBLFOOD pick never broke out (correct). Big movers not in play by volume (NEWGEN, JINDALSAW rvol <1). Market-direction filter would have helped today but FAILS on all days (-7.5R). Re-entry once after a stop: +6.7R on all days (SWIGGY today) -> proposed. |
| Mon 26 Oct (Proposal B day 1) | Gap-down -0.53% (22,481), dip to 22,387 by ~09:25, then V-reversal up to 22,716 close (+0.5%; laptop research Nifty +1.09% from open) - BUY day after a falling open | 8 picks (DRREDDY never broke its level - stock then rallied +5.9% the other way), 9 trades (5 BUY incl. 2 re-entries / 4 SELL) | 3 winners (IDFCFIRSTB +0.56R, SWIGGY re-entry +0.49R, CGPOWER +0.04R) | - | SIP -Rs5,508 | MARKET: BUYs entered 09:20 at the top of the first bounce, stopped in the 09:20-09:40 dip (J&KBANK, SWIGGY, BPCL, INDUSINDBK), then all recovered (SWIGGY +6%, J&KBANK, BPCL back above entry) = MARKET TURNED (whipsaw), not entry fault; SELLs worked early then the market turned up. SYSTEM: internet drop 09:04 -> feed closed; Claude restarted 09:13:47 (picks OK); blip 10:13; cloud refused candle saves HTTP 502/503 11:20-14:37 -> false 'feed OFF' ntfy; laptop + SIP unaffected | B FAILS today: 6 losers = 4 market-turned (opening dip), 1 market-turned (BELRISE sell, market reversed up; smart exit cut it at -0.5R = correct), 1 repeat (J&KBANK re-entry, same failure as first). In-loss warnings J&KBANK/BPCL could not tighten (0.3R-from-price was below the stop = rule 'never down', correct). Winners gave back: SWIGGY re 1.58R->0.49R, CGPOWER 1.13R->0.04R (trail 1R). Signs at entry did NOT separate: losers J&KBANK had all 6 signs. |

## 19 Oct 2026 review findings (bugs - fixes need owner approval)
- DUPLICATE paper trades: HDFCBANK, MARUTI, ULTRACEMCO, RELIANCE, ITC opened twice from one signal (two paper-trader runs at the
  same time both saw the signal as unused). Proposed free fix (SQL): mark duplicates rules='v4-dup' (keep rows, no delete), then
  `create unique index ... on simulated_trades(signal_id) where rules='v4'` -> second insert fails harmlessly ("open failed" log).
- SECTOR rule gap: EICHERMOT (auto) signal at 10:07 while MARUTI (auto) paper trade was open (pickV4 saw only open trades, the
  MARUTI trade opened a minute after its signal). Fix: also count today's v4 signals not yet closed. Code change -> Lovable credit.
- Owner buy-price rule, day 1: all 10 exits at buy price within 1-4 minutes (~Rs145 costs each) - matches the back-test warning.
  Normal stop would have lost more today (-Rs4,676 vs -Rs1,413). No rule change before ~30 trades (owner rule).
- 20 Oct 08:41: FIXED via one Lovable message (1 credit, owner approved): dedup SQL applied (5 copies -> 'v4-dup', unique index
  simulated_trades_one_per_signal active) + scout-signals redeployed from b37dede (pending signal holds its sector).
  Verified: 19 Oct now 10 v4 trades, net -Rs1,426. Lovable also added drizzle/migrations records (harmless).

## 20 Oct 2026 - feed failure (open)
- 09:07 feed connected + "subscribe success FEED" (raw_ticks.log, which only keeps the first 25 messages per run), snapshot of
  yesterday's prices, heartbeats. From 09:15 NO prices: no live_candles rows today, no data\candles-2026-10-20.csv.
- Laptop was at the Windows lock screen (user list shows "Immanuel and Amit" and "Amit Engineer"). Console not visible.
- Next: owner photographs the INTRADAY-FEED window, then restarts auto-feed.bat. TODO (next Lovable bundle): alert "feed connected
  but no prices" (paper-trader already alerts when live_candles is stale > 3 min from 09:20 - check whether it fired today).
- TODO (laptop, free): make the feed log its own status lines to a file (feed-YYYY-MM-DD.log) so I can read errors remotely.

## 21 Oct 2026
- Feed OK today (prices from 09:15, 49 stocks in the app). 20 Oct cause found: Sharekhan socket froze silently (connected + heartbeats,
  no prices 09:15–15:32). Owner approved a WATCHDOG for feed.mjs (no prices for 2 min in market hours → reconnect) + a feed log file
  readable remotely — install after 15:30 today, test before 22 Oct.
- Owner removed the buy-price stop (intent 4/5 rewritten). PAPER.exitMode='normal' (c499bff); Lovable redeploy of paper-trader +
  scout-signals sent 09:28 (1 credit; ~3 left).
- 21 Oct ~10:30: owner asked to pull history NOW -> history-export redeployed alone (1 credit; 3 left today, 1 more planned 15:31).
  5-min history for all 494 stocks pulled (12-19 Oct, 6 days; stored in Claude's workspace /home/claude/data/h500/, not in GitHub).
  Browser downloads arrive as GUID .tmp files in the laptop's Downloads folder (complete; stage them by name).
  **First 500-stock prediction score (tools/backtest/run-predict.mjs, 4 tested days 14-19 Oct):** live picking (top 3, max 10/day,
  1/sector) 6/40 = 15% target reached; ALL accepted candidates 25% of 719. Top-ranked picks do WORSE than average -> the ranking
  is the main weakness. Hints (small samples): usual daily move 4%+ 35%, SELL 28% vs BUY 22%, Rs 200-500 27%.
  Per decision rule 7c (<40%) -> improve the selection rules. Next: test stocks-in-play ranking, realistic targets, no-chase, day-type.
- 21 Oct ~11:00 R&D on 494 stocks (6 days 5-min + 1-min, 12-19 Oct; only 3-5 judged days -> early evidence):
  * run-r21.mjs (live picking, 30 picks): v4.1 13% target reached; no-chase (<=0.5 ATR beyond yday level) 33%; in-play rank 20%;
    combo P8 36% and ~break-even; but on ALL candidates (513) none of these filters beat 25% except trend days (30%).
  * run-edge.mjs: our direction calls vs coin flip (+X% before -X%): 46% at 0.3%, 50% at 0.5%, 54% at 0.75-1% (break-even after
    costs 75/65/60/57%). => NO reliable edge yet; small quick profits (0.3-0.5%) cannot beat costs at this accuracy.
  * run-daycontext.py (2,439 stock-days): yesterday's close position/volume, gap, morning move/volume all ~47-55%. Weak hints:
    gap in the same direction >0.5% -> 58% (1% follow-through), morning volume 0.8-3x -> 54-55%, combo (morning move>=1%, morning
    vol>=1.5x, yesterday closed strong our way) 58% (90). Day-to-day swings (40%-60%) are bigger than any stock feature ->
    market day-type matters most.
  * Small moves: Rs 4-5 on a Rs 400 stock = ~1% (fine); on a Rs 4,000 stock 0.1% (below costs) -> think in %, need >= ~0.75-1%.
- 21 Oct ~10:50 early-exit test (run-earlyexit.py, 2,470 stock-days, every stock in the direction of its 09:15-10:00 move, entry 10:00):
  615 hit neither +1%/-1% (best move avg +0.58% our way, but only +0.05% at 15:15). Exit rules: hold -0.114%/trade; lock +0.25% after
  +0.5% -0.112% (winners 49%->64%); trail 0.3% -0.113%; target 0.6% -0.126%; time exits worse. => exits only reshape wins/losses;
  with no ENTRY edge every exit loses ~costs. Early exit is worth adding only on top of a selection that predicts (>57% at 1%).
- 21 Oct ~12:30 owner "do it" (build + test the 5 prediction improvements; research only). New back-tester switches: trendDayPct,
  minGapPct (gap our way, held), sectorRS, stopPct, lockAtPct/lockToPct (+ maxChaseAtr, rankBy, targetPct from earlier).
  run-r21b.mjs, 494 stocks, judged 14/15/16/19 Oct (volDays 2). LIVE picking (40 picks) | EVERY candidate:
  Q0 v4.1: 18% reached, -Rs4,602 | 26% of 735, -Rs39,861
  Q1 trend day >=0.3%: 20%, -3,761 (traded only 14+19 Oct) | 26%, -32,061
  Q2 gap >=0.5% our way & held: 23%, +5,765, winners 60% | 29% of 132, +16,286, winners 63%   <- only rule positive in both views
  Q3 sector strength: no change | Q4 pullback entry: worse (20%/-70k all)
  Q5 1% target/0.65% stop/lock +0.25% after +0.5%: 43%, -1,673 | 31%, -58,733 (more targets reached, still loses)
  Q10 Q2+Q5: 43%, -1,224 | 39%, -4,561 ; Q11 gap>=1%: +5,540 / +11,709 (28/49 picks) ; Q12 Q2+no chase: +4,461 / +5,492 (12/14 picks)
  => hint: GAP HELD is the strongest feature so far; profits come from winners running, not from many small targets. Tiny samples.
- 21 Oct ~13:30 TWO-PHASE scorecards (run-twophase.mjs, 494 stocks, judged 14/15/16/19 Oct; small sample):
  EXIT (same 132 gap-held entries): E0 live exits +0.123%/trade, +Rs16,286 (Rs1L) / +Rs9,665 (Rs500 risk sizing), winners 63%,
  kept 55% of best move, avg loss -0.83%, winners->losers 7 of 82, worst -1.95% | E2 no-loss at +0.5%: +Rs7,589, 4 of 82 |
  E3 lock ladder: +Rs4,574 | E4 half at 1R: +Rs15,267 | E6 no target + ladder: +Rs11,195 (kept 42%) | E7 ladder + 1.5xATR stop:
  +Rs1,458, avg loss -0.66%, worst -1.51%. => tighter protection saves a few winners but costs more profit; live exits best so far.
  ENTRY (fixed exit 2xATR/2R): v4.1 735 entries 26% reached, best +0.62% vs worst -0.42% (1.50); gap held 132, 29%, +0.81/-0.46
  (1.76); gap>=1% 49, 29%, +1.00/-0.49 (2.05); +trend day 40, 20%; +no chase 14, 43%. => gap held improves the entry quality.

- 21 Oct evening: morning-direction test on today's own recording (494 stocks, 1% before -1%): 74% overall (463), DOWN mornings
  (SELL) 90% of 360, UP mornings (BUY) 18% of 103 -> on a clear down day (Nifty -0.88%) direction with the market is almost
  everything. Strongest evidence so far for a market day-type / direction rule. (Scorecards with 21 Oct need 20 Oct's prices for
  "yesterday" levels -> pull Sharekhan history for 20 Oct next time Sharekhan is connected.)

- 21 Oct 19:50 (owner "do all 3 right away" - save Claude's usage by letting machines do the heavy work):
  1. NIGHTLY REPORT: tools/live-feed/daily-report.mjs runs inside the feed when the market closes (15:35): from the laptop's own
     recording -> Nifty move, morning-direction 1% test by side, gap-held test -> logs\report-DATE.txt + ntfy. No AI, no network
     except ntfy. Tested on 21 Oct: Nifty -0.88%, 74% of 463 (BUY 18%, SELL 90%), gap held 90% of 265 (vs 19 Oct close, 20 Oct missing).
  2. WEEKLY HISTORY PULL by the laptop: NOT possible without the app - Sharekhan's history needs the API key, which lives only in
     the app (correctly). Option for the next bundled Lovable message: a gateway action 'history' (feed token) so the feed can pull
     once a week by itself. Until then: Friday pull by Claude, or skip (own daily recording covers most).
  3. GitHub Actions tests.yml: all offline tests (back-tester, reversal, paper-trader e2e, history-export, feed: tick exits, offline,
     recorder, e2e, watchdog, tick e2e) run on every push.
  Installed on the laptop 21 Oct 19:56 (verified identical); GitHub tests.yml run: success.
