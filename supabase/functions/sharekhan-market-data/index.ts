// ======================================================
//   SHAREKHAN MARKET DATA ENGINE — SECURED VERSION
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

// Allowed actions
const ALLOWED_ACTIONS = ['fetch', 'batch'];

// Allowed intervals
const ALLOWED_INTERVALS = ['1min', '3min', '5min', '15min', '30min', '60min', '1hour', 'daily', '1day'];

// Validate stock symbol format
function isValidSymbol(symbol: string): boolean {
  const symbolRegex = /^[A-Z0-9&-]{1,20}$/;
  return symbolRegex.test(symbol.toUpperCase());
}

// Sanitize symbol input
function sanitizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\.(NS|NSE|BSE)$/i, '').replace(/[^A-Z0-9&-]/g, '').substring(0, 20);
}

// Verify JWT and get user ID
async function verifyAuth(req: Request): Promise<{ authenticated: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return { authenticated: false, error: 'Invalid or expired token' };
    }

    return { authenticated: true, userId: data.user.id };
  } catch {
    return { authenticated: false, error: 'Token verification failed' };
  }
}

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
    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.authenticated || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: authResult.error || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const userId = authResult.userId;
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { action, symbol, symbols, interval = "5min" } = body;

    // Validate action
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Allowed: ${ALLOWED_ACTIONS.join(', ')}` }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Validate interval
    if (!ALLOWED_INTERVALS.includes(interval)) {
      return new Response(
        JSON.stringify({ error: `Invalid interval. Allowed: ${ALLOWED_INTERVALS.join(', ')}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiKey = Deno.env.get("SHAREKHAN_API_KEY");

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
      if (!symbol) {
        return new Response(
          JSON.stringify({ error: "symbol required" }),
          { status: 400, headers: corsHeaders }
        );
      }
      
      // Validate and sanitize symbol
      if (!isValidSymbol(symbol)) {
        return new Response(
          JSON.stringify({ error: "Invalid symbol format" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const sym = sanitizeSymbol(symbol);

      // fetch scripcode
      const { data: scrip } = await supabase
        .from("scripcodes")
        .select("scrip_code")
        .eq("symbol", sym)
        .maybeSingle();

      if (!scrip) {
        return new Response(
          JSON.stringify({ error: "Unknown symbol" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const res = await fetchOHLC(
        scrip.scrip_code,
        interval,
        apiKey!,
        accessToken
      );

      if (!res.data) {
        return new Response(JSON.stringify(res), {
          status: 500,
          headers: corsHeaders,
        });
      }

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
      if (!symbols || !Array.isArray(symbols)) {
        return new Response(
          JSON.stringify({ error: "symbols[] required" }),
          { status: 400, headers: corsHeaders }
        );
      }
      
      // Limit batch size to prevent DoS
      if (symbols.length > 50) {
        return new Response(
          JSON.stringify({ error: "Maximum 50 symbols per batch" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const results: any = {};

      for (const symRaw of symbols) {
        // Validate each symbol
        if (!isValidSymbol(symRaw)) {
          results[symRaw] = { error: "Invalid symbol format" };
          continue;
        }
        
        const sym = sanitizeSymbol(symRaw);

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
    console.error('[sharekhan-market-data] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
