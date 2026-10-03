# Intraday Insight — Progress Tracker

**Repo:** github.com/engamit83/intraday-insight (branch: `main`)
**Backend:** Lovable Cloud (Supabase-based), project `emxhhxvtbjsjtjacbike`
**Last updated:** 2026-10-03

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

## 🗺 MASTER PLAN & FEATURE BACKLOG (single source of truth — read this first)

**Intent (never lose sight of this):** an app that scans many stocks, decides which to BUY/SELL using technical analysis (later news and wider market context too), exits fast to cut losses and lock profit, learns from its own results, and — if the evidence supports it — earns money for the owner, and later for other users with their own brokers. **Honest limits:** no system avoids all losses; most retail intraday traders lose money (SEBI: 71% in FY23); costs matter; not a financial advisor.

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
| Scout: scan ~48 stocks → score → BUY/SELL + ATR levels → write `signals` | 🟡 | Dry run on real data is the next step |
| Corrected indicators (RSI/ATR/MACD/trend/efficiency), IST time fix, auth hole fix | 🟡 | Verified offline; not yet seen on live data |
| Rule-based scoring + direction rule (agreement of 3 votes, chop filter, RSI guard) | 🟡 | v1, never back-tested, no evidence of profit |

### What is NOT built yet (ordered; each phase has a gate before the next)
**Phase A — Finish and verify the data pipeline** ⬜
1. Dry-run scan of 5 stocks; check prices match the Sharekhan app and the indicators look sane.
2. First real (non-dry) run when the market opens; inspect `signals`.
3. Schedule the scout every 1 minute during market hours (function also self-gates to 09:15–15:30 IST, Mon–Fri).
4. Token expiry handling: confirm real token lifetime, add a "Sharekhan disconnected" alert/banner so scheduled jobs don't silently fail; explore refresh if Sharekhan supports it.
5. Schedule `market-conditions` (nothing calls it today, so the market multiplier is always "UNKNOWN").
6. Validate the starter universe (stale/renamed tickers show up as "unresolved"); filter the 7,551 master rows to ordinary equities.
7. A monitoring view for `system_logs` (errors, last run, signals created).
*Gate:* signals appear on their own during market hours and prices match Sharekhan.

**Phase B — Prove it earns, on paper (the real test)** ⬜
1. Cost model in the simulator: brokerage, STT, exchange charges, GST, stamp duty, slippage (currently none, so simulated profit is overstated).
2. Schedule the automatic paper loop (`process_new_signals` + `monitor_trades`).
3. Store a snapshot of indicators/score/market state with every signal and trade (this becomes the ML training data).
4. Results dashboard: win rate, average win/loss, expectancy NET of costs, max drawdown, by time of day / market condition.
5. Run 3–4+ weeks (enough trades to mean something).
*Gate:* net-positive expectancy after costs over a meaningful number of trades. If not, fix the strategy; do not go live.

**Phase C — Strategy upgrades, each tested on paper as an on/off switch** ⬜
Daily-trend filter (e.g. above 20-day average; daily candles confirmed available back to 2000) · yesterday's high/low and support/resistance · NIFTY/sector context · no-trade filters (illiquid, circuit-limit, results days) · position sizing and risk per trade · daily trade/loss limits · time-of-day rules. Keep a change only if paper results improve.

**Phase D — Exits and risk control** ⬜
Trailing stop-loss · reversal-based exit (the same indicators that triggered entry flip) · time exit before the close (intraday positions must be squared off) · partial profit booking · daily loss limit enforcement · kill switch.

**Phase E — Live tick-by-tick data at scale** ⬜
Always-on server (~$5–10/month, e.g. Fly.io/Render — Lovable edge functions cannot hold a persistent connection) holding Sharekhan's WebSocket (up to 1,000 symbols per connection) → writes prices to the database → scale the universe (e.g. Nifty 500) → tick-driven exits. Needs reconnect logic and monitoring. *Only after Phase B shows an edge.*

**Phase F — Smarter decisions (ML + news)** ⬜
News/sentiment source (new cost and integration) · ML model trained on the collected paper/real outcomes (needs hundreds to thousands of trades; walk-forward validation to avoid overfitting) · scheduled retraining and monitoring for drift · post-trade analysis of losing trades. "Learning from mistakes" means statistically refitting on results — it will never reach zero mistakes.

**Phase G — Real-money trading** ⬜
Order placement through Sharekhan's API (order, modify, cancel, status) · rejections/partial fills/duplicate-order protection · manual-confirm mode before full auto · start with an amount whose total loss would not hurt · **check current SEBI/exchange rules for algorithmic trading through a retail broker API (e.g. registration and static-IP requirements) and Sharekhan's API terms — not yet verified.**

**Phase H — Turn it into a product for other people** ⬜
Per-user broker connection and settings · more brokers behind a common adapter · permanent published URL (then update Sharekhan's registered redirect URL) · security hardening · error alerts and backups · **legal check: giving buy/sell signals to other people may count as investment advice or research under SEBI rules and may require registration — get proper advice before sharing or charging.**

### Tech debt / cleanup (do alongside, not instead)
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

## 📌 Rule for this file going forward

**Every time we test something, fix something, or confirm something with evidence, add an entry here before moving on.** This file is the single source of truth for "where we are" — if the conversation resets or context is lost, read this file first to know exactly what's been tried, what's confirmed, and what's next. Update the Experiment Log table for anything related to Bug 3.4, and add new numbered bugs/phases as new issues are found.
