# Intraday Insight — Progress Tracker

**Repo:** github.com/engamit83/intraday-insight (branch: `main`)
**Backend:** Lovable Cloud (Supabase-based), project `emxhhxvtbjsjtjacbike`
**Last updated:** 2026-10-07

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

## 🧱 2026-10-07 — Expert review: what makes the app stronger (added to the plan)

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

## 📌 Rule for this file going forward

**Every time we test something, fix something, or confirm something with evidence, add an entry here before moving on.** This file is the single source of truth for "where we are" — if the conversation resets or context is lost, read this file first to know exactly what's been tried, what's confirmed, and what's next. Update the Experiment Log table for anything related to Bug 3.4, and add new numbered bugs/phases as new issues are found.
