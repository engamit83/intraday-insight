# Back-tester

Replays past 5-minute candles through the **same** scout rules (`supabase/functions/_shared/indicators.ts` and `scoring.ts`) and simulates the trades a person would take from the Signals page, with Indian intraday costs.

## 1. Get the data (browser, signed in, Sharekhan connected)
1. Lovable must have deployed the `history-export` edge function (read-only; signed-in users only; only scout-universe stocks; max 10 per call).
2. Paste `download-snippet.js` into the browser Console on the app tab. It saves `history-5minute-<date>.json` to Downloads (about 49 calls to Sharekhan, ~30 s).

## 2. Run
```
node --experimental-strip-types tools/backtest/run.mjs history-5minute-<date>.json [--brokerage=0.03] [--slippage=0.02]
node --experimental-strip-types tools/backtest/test-backtest.mjs   # 14 offline checks
```
Prints a comparison table (baseline + switches), breakdowns by direction / entry hour / day, and writes `backtest-trades.csv`.

## Rules simulated
- Decision after each 5-min candle closes, using only earlier candles (tested: changing later candles never changes earlier decisions).
- Score x time-of-day multiplier, market multiplier 1.0, minimum final score 60, rank by uncapped score, top 10, max 10 open, one per stock, 30-min cooldown.
- Entry at the NEXT candle's open + slippage. Stop/target = the levels the Signals page shows. Both touched in one candle = stop (conservative). Square-off at 15:15.
- Costs per round trip: brokerage (default 0.03%/side — check your Sharekhan plan), STT 0.025% sell, exchange 0.00307%/side, SEBI 0.0001%/side, stamp 0.003% buy, GST 18% on brokerage+exchange+SEBI. Slippage 0.02%/side on market fills.

## Limits (read before trusting a number)
- Sharekhan's REST endpoint returns a fixed window (~1 month of 5-min candles). One month is a small sample; one market mood can dominate.
- No historical bid/offer, so slippage is an estimate. The live scout also reads the still-forming candle every minute; this uses closed candles only.
- Tuning on the same days you judge on over-fits. Compare first half vs second half; keep a change only if it helps in both.
