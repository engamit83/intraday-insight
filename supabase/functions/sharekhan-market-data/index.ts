// ======================================================
//   SHAREKHAN MARKET DATA ENGINE — FINAL PRODUCTION
// ======================================================
// Uses:
//  - scripcodes table (synced via scrip-master-sync)
//  - Sharekhan auth (encrypted tokens)
//  - Sharekhan Historical API ONLY (no Alpha Vantage)
// ======================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ----------------------------------------------
// Fetch encrypted token from AUTH function
// ----------------------------------------------
async function loadSharekhanToken(userId: string) {
  const url =
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/sharekhan-auth?action=get-token&user_id=${userId}`;

  const resp = await fetch(url, { method: "GET" });
  const json = await resp.json();

  if (!json || json.status !== "AUTH_OK") {
    return null;
  }
  return json.accessToken;
}

// ----------------------------------------------
// Fetch candles from Sharekhan Historical API
// ----------------------------------------------
async function fetchOHLC(
  scripCode: number,
  interval: string,
  apiKey: string,
  accessToken: string
) {
  const SHAREKHAN_BASE_URL = "https://api.sharekhan.com";
  const NSE_EXCHANGE = "NC";

  const intervalMap: Record<string, string> = {
    "1min": "1",
    "3min": "3",
    "5min": "5",
    "15min": "15",
    "30min": "30",
    "60min": "60",
    "1hour": "60",
    "daily": "D",
    "1day": "D",
  };

  const mapped = intervalMap[interval] || "5";

  const url = `${SHAREKHAN_BASE_URL}/skapi/services/historical/${NSE_EXCHANGE}/${scripCode}/${mapped}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "api-key": apiKey,
      "access-token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    return { data: null, error: `HTTP ${resp.status}` };
  }

  const result = await resp.json();

  if (!result.data || !Array.isArray(result.data)) {
    return { data: null, error: "No data" };
  }

  const candles = result.data
    .map((c: any) => ({
      timestamp: c.time || c.timestamp,
      open: Number(c.open || 0),
      high: Number(c.high || 0),
      low: Number(c.low || 0),
      close: Number(c.close || c.ltp || 0),
      volume: Number(c.volume || 0),
    }))
    .filter((d: any) => d.close > 0)
    .sort(
      (a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  return { data: candles, error: null };
}

// ----------------------------------------------
// Indicator Engine
// ----------------------------------------------
function computeIndicators(data: any[]) {
  let cumulativeTPV = 0,
    cumulativeVolume = 0;
  for (const c of data) {
    const tp = (c.high + c.low + c.close) / 3;
    cumulativeTPV += tp * c.volume;
    cumulativeVolume += c.volume;
  }
  const vwap =
    cumulativeVolume > 0
      ? Math.round((cumulativeTPV / cumulativeVolume) * 100) / 100
      : null;

  let rsi = null;
  if (data.length >= 15) {
    const sorted = [...data].reverse();
    let gains = 0,
      losses = 0;
    for (let i = 1; i <= 14; i++) {
      const change = sorted[i].close - sorted[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    const avgGain = gains / 14,
      avgLoss = losses / 14;
    rsi =
      avgLoss > 0
        ? Math.round(
            (100 - 100 / (1 + avgGain / avgLoss)) * 100
          ) / 100
        : 100;
  }

  return { vwap, rsi };
}

// ----------------------------------------------
// MAIN EDGE FUNCTION
// ----------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { action, symbol, symbols, interval = "5min", userId } = body;

    const apiKey = Deno.env.get("SHAREKHAN_API_KEY");

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const accessToken = await loadSharekhanToken(userId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // ==========================================
    // 🔵 ACTION: SINGLE SYMBOL FETCH
    // ==========================================
    if (action === "fetch") {
      if (!symbol)
        return new Response(
          JSON.stringify({ error: "symbol required" }),
          { status: 400, headers: corsHeaders }
        );

      const sym = symbol.toUpperCase().replace(/\.(NS|NSE|BSE)$/i, "");

      // fetch scripcode
      const { data: scrip } = await supabase
        .from("scripcodes")
        .select("scrip_code")
        .eq("symbol", sym)
        .maybeSingle();

      if (!scrip)
        return new Response(
          JSON.stringify({ error: "Unknown symbol" }),
          { status: 400, headers: corsHeaders }
        );

      const res = await fetchOHLC(
        scrip.scrip_code,
        interval,
        apiKey!,
        accessToken
      );

      if (!res.data)
        return new Response(JSON.stringify(res), {
          status: 500,
          headers: corsHeaders,
        });

      // Indicators
      const indicators = computeIndicators(res.data);

      // Update DB
      await supabase.from("stocks").upsert(
        {
          symbol: sym,
          last_price: res.data[0].close,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "symbol" }
      );

      await supabase.from("indicator_cache").upsert(
        {
          symbol: sym,
          timeframe: interval,
          raw_data: res.data,
          vwap: indicators.vwap,
          rsi: indicators.rsi,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "symbol,timeframe" }
      );

      return new Response(
        JSON.stringify({
          ok: true,
          symbol: sym,
          candles: res.data.length,
          latestPrice: res.data[0].close,
          indicators,
        }),
        { headers: corsHeaders }
      );
    }

    // ==========================================
    // 🔵 ACTION: BATCH FETCH
    // ==========================================
    if (action === "batch") {
      if (!symbols || !Array.isArray(symbols))
        return new Response(
          JSON.stringify({ error: "symbols[] required" }),
          { status: 400, headers: corsHeaders }
        );

      const results: any = {};

      for (const symRaw of symbols) {
        const sym = symRaw.toUpperCase().replace(/\.(NS|NSE|BSE)$/i, "");

        const { data: scrip } = await supabase
          .from("scripcodes")
          .select("scrip_code")
          .eq("symbol", sym)
          .maybeSingle();

        if (!scrip) {
          results[sym] = { error: "Unknown symbol" };
          continue;
        }

        const res = await fetchOHLC(
          scrip.scrip_code,
          interval,
          apiKey!,
          accessToken
        );

        if (!res.data) {
          results[sym] = { error: res.error };
          continue;
        }

        const indicators = computeIndicators(res.data);

        await supabase.from("stocks").upsert(
          {
            symbol: sym,
            last_price: res.data[0].close,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "symbol" }
        );

        await supabase.from("indicator_cache").upsert(
          {
            symbol: sym,
            timeframe: interval,
            raw_data: res.data,
            vwap: indicators.vwap,
            rsi: indicators.rsi,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "symbol,timeframe" }
        );

        results[sym] = {
          ok: true,
          candles: res.data.length,
          latestPrice: res.data[0].close,
          indicators,
        };

        await new Promise((r) => setTimeout(r, 150)); // rate limiter
      }

      return new Response(
        JSON.stringify({
          ok: true,
          duration: Date.now() - start,
          results,
        }),
        { headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
