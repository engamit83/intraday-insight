# Intraday Insight — Progress Tracker

**Repo:** github.com/engamit83/intraday-insight (branch: `main`)
**Backend:** Lovable Cloud (Supabase-based), project `emxhhxvtbjsjtjacbike`
**Last updated:** 2026-09-27

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

With Sharekhan now connected, the remaining gap back to the original bigger goal:

1. **No scheduler exists yet** for the signal-generation pipeline (`scrip-master-sync`, `update-market-data`, `indicators`, `market-conditions`, `trading-intelligence`) — confirmed earlier that Lovable Cloud's "Jobs" page was empty. Without this, the Signals page will stay empty even with a working broker connection, since nothing automatically calls these functions.
2. **Debug logging cleanup** — the `debug-*` log statements added to `sharekhan-auth/index.ts` during troubleshooting are harmless but no longer necessary; can be removed for tidiness (optional, low priority).
3. **Multi-user support** — user's stated long-term goal is to let other people connect their own broker accounts. Current Sharekhan flow is "Self App" (single customer per API key) — supporting multiple different users' Sharekhan accounts, or other brokers entirely, will need further architecture work (likely a "vendor" API key from Sharekhan, or per-user API key storage, rather than one fixed `SHAREKHAN_API_KEY`/`SHAREKHAN_API_SECRET` pair for everyone).
4. **Preview URL dependency** — the app is still running on a temporary Lovable preview URL, not a published permanent one. The Sharekhan redirect URL registered on their portal currently points to this temporary URL and will break if it changes. Publish when ready for more permanent stability.

## 📌 Rule for this file going forward

**Every time we test something, fix something, or confirm something with evidence, add an entry here before moving on.** This file is the single source of truth for "where we are" — if the conversation resets or context is lost, read this file first to know exactly what's been tried, what's confirmed, and what's next. Update the Experiment Log table for anything related to Bug 3.4, and add new numbered bugs/phases as new issues are found.
