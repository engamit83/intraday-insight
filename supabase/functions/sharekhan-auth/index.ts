// =============================
//  SHAREKHAN AUTH – FINAL BUILD
//  PRODUCTION-GRADE VERSION
// =============================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import AES from "https://esm.sh/crypto-js@4.1.1/aes";
import Utf8 from "https://esm.sh/crypto-js@4.1.1/enc-utf8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========= ENV ==========
const SHAREKHAN_API_KEY = Deno.env.get("SHAREKHAN_API_KEY") || "";
const SHAREKHAN_API_SECURE_KEY = Deno.env.get("SHAREKHAN_API_SECURE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const AUTH_ENCRYPTION_KEY = Deno.env.get("AUTH_ENCRYPTION_KEY") || "DEFAULT_KEY_CHANGE_ME";

// ========= ENDPOINTS (NEW OFFICIAL) ==========
const SHAREKHAN_LOGIN_URL = "https://api.sharekhan.com/skapi/auth/login.html";
const SHAREKHAN_TOKEN_URL = "https://api.sharekhan.com/skapi/auth/getAccessToken";
const SHAREKHAN_PROFILE_URL = "https://api.sharekhan.com/skapi/services/profile/getProfile";

// ========= HELPERS ==========
function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function encrypt(text: string): string {
  return AES.encrypt(text, AUTH_ENCRYPTION_KEY).toString();
}

function decrypt(cipher: string | null): string | null {
  if (!cipher) return null;
  try {
    return AES.decrypt(cipher, AUTH_ENCRYPTION_KEY).toString(Utf8);
  } catch {
    return null;
  }
}

async function log(source: string, stage: string, metadata: Record<string, unknown> = {}, level = "INFO") {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("system_logs").insert({ source, message: stage, level, metadata });
  } catch {
    // Silent fail for logging
  }
}

// ========= LOGIN URL ==========
function buildLoginUrl(redirect: string): string {
  const params = new URLSearchParams({
    api_key: SHAREKHAN_API_KEY,
    redirect_uri: redirect,
  });
  return `${SHAREKHAN_LOGIN_URL}?${params.toString()}`;
}

// ========= HARDCODED REDIRECT URI ==========
const REDIRECT_URI = 'https://id-preview--0b7f6ea9-fd3b-48da-b4ea-ee41af1cab07.lovable.app/';

// ========= EXCHANGE TOKEN ==========
async function exchangeToken(requestToken: string) {
  await log("sharekhan-auth", "exchange-token-start", { 
    hasRequestToken: !!requestToken,
    requestTokenLength: requestToken?.length || 0,
    requestTokenPreview: requestToken ? requestToken.substring(0, 20) + '...' : 'NONE'
  });

  try {
    // checksum = SHA256(api_key + request_token + api_secret)
    const text = SHAREKHAN_API_KEY + requestToken + SHAREKHAN_API_SECURE_KEY;
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    const checksum = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");

    const requestBody = {
      api_key: SHAREKHAN_API_KEY,
      request_token: requestToken,
      checksum,
    };

    console.log("[sharekhan-auth] Calling getAccessToken with:", {
      endpoint: SHAREKHAN_TOKEN_URL,
      api_key_preview: SHAREKHAN_API_KEY.substring(0, 8) + '...',
      request_token_preview: requestToken.substring(0, 20) + '...',
      checksum_preview: checksum.substring(0, 16) + '...',
    });

    await log("sharekhan-auth", "exchange-token-calling-api", { 
      endpoint: SHAREKHAN_TOKEN_URL,
      apiKeyLength: SHAREKHAN_API_KEY.length,
      checksumLength: checksum.length
    });

    const resp = await fetch(SHAREKHAN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    // CRITICAL: Log the raw response text for debugging
    const rawText = await resp.text();
    console.log("[sharekhan-auth] RAW RESPONSE STATUS:", resp.status);
    console.log("[sharekhan-auth] RAW RESPONSE BODY:", rawText);

    await log("sharekhan-auth", "exchange-token-raw-response", { 
      status: resp.status, 
      ok: resp.ok,
      rawBody: rawText.substring(0, 500), // First 500 chars for safety
      contentType: resp.headers.get("content-type")
    });

    if (!resp.ok) {
      await log("sharekhan-auth", "exchange-token-failed", { 
        status: resp.status,
        rawBody: rawText.substring(0, 1000)
      }, "ERROR");
      throw new Error(`Sharekhan rejected token: ${resp.status} - ${rawText}`);
    }

    // Try to parse as JSON
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.log("[sharekhan-auth] JSON PARSE ERROR:", parseErr);
      await log("sharekhan-auth", "exchange-token-parse-error", { 
        error: String(parseErr),
        rawBody: rawText.substring(0, 500)
      }, "ERROR");
      throw new Error(`Failed to parse Sharekhan response: ${rawText.substring(0, 200)}`);
    }

    console.log("[sharekhan-auth] PARSED RESPONSE KEYS:", Object.keys(parsed));
    
    await log("sharekhan-auth", "exchange-token-success", { 
      responseKeys: Object.keys(parsed),
      hasAccessToken: !!(parsed.accessToken || parsed.access_token || parsed.data?.accessToken),
      hasRefreshToken: !!(parsed.refreshToken || parsed.refresh_token || parsed.data?.refreshToken),
      hasData: !!parsed.data,
      hasStatus: !!parsed.status,
      statusValue: parsed.status
    });

    return parsed;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log("[sharekhan-auth] EXCHANGE TOKEN ERROR:", errorMessage);
    await log("sharekhan-auth", "exchange-token-exception", { error: errorMessage }, "ERROR");
    throw err;
  }
}

// ========= STORE TOKENS (Encrypted + Buffer) ==========
async function storeTokens(userId: string, access: string, refresh: string | null, expiresIn: number) {
  console.log("[sharekhan-auth] STORE TOKENS START for user:", userId);
  
  const supabase = getSupabaseClient();

  const now = new Date();
  const expiry = new Date(now.getTime() + expiresIn * 1000 - 15 * 60 * 1000); // 15 min buffer

  await log("sharekhan-auth", "store-tokens-start", { 
    userId, 
    expiresIn, 
    bufferApplied: true,
    accessTokenLength: access?.length || 0
  });

  const encrypted = {
    sharekhan_access_token: encrypt(access),
    sharekhan_refresh_token: refresh ? encrypt(refresh) : null,
    sharekhan_token_generated_at: now.toISOString(),
    sharekhan_token_expiry: expiry.toISOString(),
    updated_at: now.toISOString(),
  };

  console.log("[sharekhan-auth] Looking up existing row for user:", userId);

  const { data: row, error: lookupError } = await supabase
    .from("user_settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) {
    console.log("[sharekhan-auth] LOOKUP ERROR:", lookupError.message);
    await log("sharekhan-auth", "store-tokens-lookup-failed", { error: lookupError.message }, "ERROR");
  }

  console.log("[sharekhan-auth] Existing row found:", !!row);

  if (row) {
    console.log("[sharekhan-auth] UPDATING existing row for user:", userId);
    const { error } = await supabase.from("user_settings").update(encrypted).eq("user_id", userId);
    if (error) {
      console.log("[sharekhan-auth] UPDATE FAILED:", error.message);
      await log("sharekhan-auth", "store-tokens-update-failed", { error: error.message }, "ERROR");
      throw error;
    }
    console.log("[sharekhan-auth] UPDATE SUCCESS for user:", userId);
    await log("sharekhan-auth", "store-tokens-updated", { userId });
  } else {
    console.log("[sharekhan-auth] INSERTING new row for user:", userId);
    const { error } = await supabase.from("user_settings").insert({ user_id: userId, ...encrypted });
    if (error) {
      console.log("[sharekhan-auth] INSERT FAILED:", error.message);
      await log("sharekhan-auth", "store-tokens-insert-failed", { error: error.message }, "ERROR");
      throw error;
    }
    console.log("[sharekhan-auth] INSERT SUCCESS for user:", userId);
    await log("sharekhan-auth", "store-tokens-inserted", { userId });
  }
}

// ========= GET STORED TOKEN ==========
async function loadToken(userId: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  const access = decrypt(data.sharekhan_access_token);
  const refresh = decrypt(data.sharekhan_refresh_token);

  return {
    accessToken: access,
    refreshToken: refresh,
    expiry: data.sharekhan_token_expiry,
    generatedAt: data.sharekhan_token_generated_at,
  };
}

// ========= VERIFY TOKEN (Rate Limited) ==========
async function verifyToken(userId: string, tokenObj: any) {
  const now = new Date();
  const expiry = tokenObj.expiry ? new Date(tokenObj.expiry) : null;

  if (!expiry || expiry < now) {
    await log("sharekhan-auth", "verify-token-expired", { userId });
    return { status: "EXPIRED" };
  }

  // Check token freshness - if generated within last 10 minutes, trust it
  const generatedAt = tokenObj.generatedAt ? new Date(tokenObj.generatedAt) : null;
  const minutesSinceGenerated = generatedAt ? (now.getTime() - generatedAt.getTime()) / 60000 : 999;

  if (minutesSinceGenerated < 10) {
    await log("sharekhan-auth", "verify-token-fresh", { userId, minutesSinceGenerated });
    return { status: "VALID" };
  }

  // Hit Sharekhan API to verify (rate limited check)
  await log("sharekhan-auth", "verify-token-api-check", { userId });

  try {
    const resp = await fetch(SHAREKHAN_PROFILE_URL, {
      headers: { Authorization: `Bearer ${tokenObj.accessToken}` },
    });

    let newStatus = "VALID";

    if (resp.status === 401 || resp.status === 403) {
      newStatus = "DOUBLE_LOGIN";
      await log("sharekhan-auth", "verify-token-double-login", { userId, status: resp.status }, "ERROR");
    } else if (resp.status === 429) {
      newStatus = "RATE_LIMIT";
      await log("sharekhan-auth", "verify-token-rate-limit", { userId }, "ERROR");
    } else if (!resp.ok) {
      newStatus = "API_ERROR";
      await log("sharekhan-auth", "verify-token-api-error", { userId, status: resp.status }, "ERROR");
    }

    return { status: newStatus };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await log("sharekhan-auth", "verify-token-exception", { userId, error: errorMessage }, "ERROR");
    return { status: "API_UNREACHABLE" };
  }
}

// ========= ROUTER ==========
serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const method = req.method;

  try {
    // CORS
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Config check
    if (!SHAREKHAN_API_KEY || !SHAREKHAN_API_SECURE_KEY) {
      await log("sharekhan-auth", "config-missing", {}, "ERROR");
      return new Response(JSON.stringify({ error: "Sharekhan API keys not configured", status: "CONFIG_ERROR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle POST body for actions
    let body: any = {};
    if (method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const actionFromBody = body.action || action;

    await log("sharekhan-auth", "request-received", { action: actionFromBody, method });

    // Login-URL
    if (actionFromBody === "login-url") {
      const redirect = url.searchParams.get("redirect_uri") || body.redirect_uri;
      if (!redirect) {
        return new Response(JSON.stringify({ error: "redirect_uri required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const finalUrl = buildLoginUrl(redirect);
      await log("sharekhan-auth", "login-url-generated", { redirect });
      return new Response(JSON.stringify({ loginUrl: finalUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange Token
    if (actionFromBody === "exchange-token") {
      const requestToken = body.request_token;
      const userId = body.user_id;

      if (!requestToken || !userId) {
        await log("sharekhan-auth", "exchange-token-missing-params", { hasToken: !!requestToken, hasUserId: !!userId }, "ERROR");
        return new Response(JSON.stringify({ error: "request_token and user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenData = await exchangeToken(requestToken);
      
      // Handle different response formats from Sharekhan
      const accessToken = tokenData.accessToken || tokenData.access_token || tokenData.data?.accessToken;
      const refreshToken = tokenData.refreshToken || tokenData.refresh_token || tokenData.data?.refreshToken;
      const expiresIn = tokenData.expiresIn || tokenData.expires_in || tokenData.data?.expiresIn || 86400; // Default 24h

      if (!accessToken) {
        await log("sharekhan-auth", "exchange-token-no-access-token", { responseKeys: Object.keys(tokenData) }, "ERROR");
        return new Response(JSON.stringify({ error: "No access token in response", success: false }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await storeTokens(userId, accessToken, refreshToken, expiresIn);

      return new Response(JSON.stringify({ status: "SUCCESS", success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Health
    if (actionFromBody === "health") {
      const userId = url.searchParams.get("user_id") || body.user_id;
      
      if (!userId) {
        return new Response(JSON.stringify({ status: "AUTH_REQUIRED", reason: "No user_id provided" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenObj = await loadToken(userId);

      if (!tokenObj?.accessToken) {
        await log("sharekhan-auth", "health-no-token", { userId });
        return new Response(JSON.stringify({ status: "AUTH_REQUIRED" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const check = await verifyToken(userId, tokenObj);
      await log("sharekhan-auth", "health-check-result", { userId, status: check.status });

      return new Response(JSON.stringify({ status: check.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Token (For Market Engine)
    if (actionFromBody === "get-token") {
      const userId = url.searchParams.get("user_id") || body.user_id;

      if (!userId) {
        return new Response(JSON.stringify({ status: "AUTH_REQUIRED" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenObj = await loadToken(userId);

      if (!tokenObj?.accessToken) {
        return new Response(JSON.stringify({ status: "AUTH_REQUIRED" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          status: "AUTH_OK",
          accessToken: tokenObj.accessToken,
          expiry: tokenObj.expiry,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Diagnostics
    if (actionFromBody === "diagnose") {
      const userId = url.searchParams.get("user_id") || body.user_id;
      const supabase = getSupabaseClient();

      // Get recent logs
      const { data: logs } = await supabase
        .from("system_logs")
        .select("*")
        .eq("source", "sharekhan-auth")
        .order("created_at", { ascending: false })
        .limit(10);

      // Check token status
      let tokenStatus = "NO_USER_ID";
      let hasToken = false;

      if (userId) {
        const tokenObj = await loadToken(userId);
        hasToken = !!tokenObj?.accessToken;
        tokenStatus = hasToken ? "TOKEN_PRESENT" : "NO_TOKEN";
      }

      return new Response(JSON.stringify({ 
        ok: true,
        config: {
          hasApiKey: !!SHAREKHAN_API_KEY,
          hasSecureKey: !!SHAREKHAN_API_SECURE_KEY,
          hasEncryptionKey: AUTH_ENCRYPTION_KEY !== "DEFAULT_KEY_CHANGE_ME",
        },
        tokenStatus,
        hasToken,
        recentLogs: logs?.map(l => ({ 
          message: l.message, 
          level: l.level, 
          time: l.created_at 
        })) || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "INVALID_ACTION" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await log("sharekhan-auth", "unhandled-error", { error: errorMessage }, "ERROR");
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
