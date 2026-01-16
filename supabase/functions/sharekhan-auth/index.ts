// =============================
//  SHAREKHAN AUTH – STABLE BUILD
//  UNCRASHABLE + ATOMIC UPSERT
// =============================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import AES from "https://esm.sh/crypto-js@4.1.1/aes";
import Utf8 from "https://esm.sh/crypto-js@4.1.1/enc-utf8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ========= ENV ==========
const SHAREKHAN_API_KEY = Deno.env.get("SHAREKHAN_API_KEY") || "";
const SHAREKHAN_API_SECRET = Deno.env.get("SHAREKHAN_API_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const AUTH_ENCRYPTION_KEY = Deno.env.get("AUTH_ENCRYPTION_KEY") || "DEFAULT_KEY_CHANGE_ME";

// ========= TIMEOUT HELPER ==========
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ========= ENDPOINTS ==========
const SHAREKHAN_LOGIN_URL = "https://api.sharekhan.com/skapi/auth/login.html";
const SHAREKHAN_TOKEN_URL = "https://api.sharekhan.com/skapi/auth/accessToken";
const SHAREKHAN_PROFILE_URL = "https://api.sharekhan.com/skapi/services/profile";

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

// ========= EXCHANGE TOKEN (UNCRASHABLE) ==========
interface ExchangeResult {
  success: boolean;
  error?: string;
  rawBody?: string;
  message?: string;
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresIn?: number;
  expires_in?: number;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  [key: string]: unknown;
}

async function exchangeToken(requestToken: string): Promise<ExchangeResult> {
  await log("sharekhan-auth", "exchange-token-start", { 
    hasRequestToken: !!requestToken,
    requestTokenLength: requestToken?.length || 0,
    requestTokenPreview: requestToken ? requestToken.substring(0, 20) + '...' : 'NONE'
  });

  // Generate checksum = HEX(SHA256(request_token + api_key + api_secret)) - V2 Protocol Order
  const text = requestToken + SHAREKHAN_API_KEY + SHAREKHAN_API_SECRET;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const checksum = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const requestBody = {
    api_key: SHAREKHAN_API_KEY,
    request_token: requestToken,
    checksum,
  };

  console.log("[sharekhan-auth] REQUEST STARTED - Calling getAccessToken with:", {
    endpoint: SHAREKHAN_TOKEN_URL,
    api_key_preview: SHAREKHAN_API_KEY.substring(0, 8) + '...',
    request_token_preview: requestToken.substring(0, 20) + '...',
    checksum_preview: checksum.substring(0, 16) + '...',
    timeout: '15 seconds'
  });

  await log("sharekhan-auth", "exchange-token-calling-api", { 
    endpoint: SHAREKHAN_TOKEN_URL,
    apiKeyLength: SHAREKHAN_API_KEY.length,
    secretLength: SHAREKHAN_API_SECRET.length,
    checksumLength: checksum.length,
    message: "REQUEST STARTED with 15s timeout"
  });

  // Make the API call with api-key in headers (V2 Gateway) + 15s timeout
  let resp: Response;
  try {
    resp = await fetchWithTimeout(SHAREKHAN_TOKEN_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "api-key": SHAREKHAN_API_KEY,
      },
      body: JSON.stringify(requestBody),
    }, 15000);
  } catch (fetchErr) {
    const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.log("[sharekhan-auth] FETCH FAILED (timeout or network):", errMsg);
    await log("sharekhan-auth", "exchange-token-fetch-failed", { 
      error: errMsg,
      isTimeout: errMsg.includes("abort")
    }, "ERROR");
    
    return { 
      success: false, 
      error: errMsg.includes("abort") ? "TIMEOUT_15S" : "FETCH_FAILED",
      message: errMsg
    };
  }

  // CRITICAL: Capture raw response text IMMEDIATELY
  const respText = await resp.text();
  
  console.log("[sharekhan-auth] RAW RESPONSE STATUS:", resp.status);
  console.log("[sharekhan-auth] CRITICAL RAW RESPONSE:", respText);

  await log("sharekhan-auth", "exchange-token-raw-response", { 
    status: resp.status, 
    ok: resp.ok,
    rawBody: respText.substring(0, 1000), // Store up to 1000 chars
    contentType: resp.headers.get("content-type")
  });

  // Try to parse JSON - catch parse errors specifically
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(respText);
  } catch (parseErr) {
    // Log as RAW_HTML_OR_TEXT so we can see the broker error
    console.log("[sharekhan-auth] RAW_HTML_OR_TEXT:", respText);
    await log("sharekhan-auth", "exchange-token-parse-error", { 
      error: "RAW_HTML_OR_TEXT",
      rawBody: respText.substring(0, 1000),
      parseError: String(parseErr)
    }, "ERROR");
    
    // Return a structured error that won't crash
    return { 
      success: false, 
      error: "PARSE_ERROR", 
      rawBody: respText.substring(0, 500),
      message: "Broker returned non-JSON response"
    };
  }

  console.log("[sharekhan-auth] PARSED RESPONSE KEYS:", Object.keys(parsed));
  
  // Check if the broker returned an error in the JSON
  // Log detailed Sharekhan error response fields: status, detail, instance
  if (!resp.ok || parsed.status === "error" || parsed.error) {
    await log("sharekhan-auth", "exchange-token-broker-error", { 
      httpStatus: resp.status,
      parsedStatus: parsed.status,
      parsedError: parsed.error,
      parsedDetail: parsed.detail,
      parsedInstance: parsed.instance,
      parsedMessage: parsed.message,
      rawBody: respText.substring(0, 500)
    }, "ERROR");
    
    console.log("[sharekhan-auth] BROKER ERROR DETAILS:", {
      httpStatus: resp.status,
      status: parsed.status,
      detail: parsed.detail,
      instance: parsed.instance,
      error: parsed.error,
      message: parsed.message
    });
    
    return {
      success: false,
      error: String(parsed.error || parsed.detail || parsed.message || "BROKER_ERROR"),
      rawBody: respText.substring(0, 500),
      message: String(parsed.message || parsed.detail || parsed.error || "Unknown broker error"),
      detail: parsed.detail,
      instance: parsed.instance
    };
  }

  await log("sharekhan-auth", "exchange-token-success", { 
    responseKeys: Object.keys(parsed),
    hasAccessToken: !!(parsed.accessToken || parsed.access_token || (parsed.data as any)?.accessToken),
    hasRefreshToken: !!(parsed.refreshToken || parsed.refresh_token || (parsed.data as any)?.refreshToken),
    hasData: !!parsed.data,
    hasStatus: !!parsed.status,
    statusValue: parsed.status
  });

  return { success: true, ...parsed } as ExchangeResult;
}

// ========= STORE TOKENS (ATOMIC UPSERT) ==========
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

  // ATOMIC UPSERT - No more race condition possible
  const upsertData = {
    user_id: userId,
    sharekhan_access_token: encrypt(access),
    sharekhan_refresh_token: refresh ? encrypt(refresh) : null,
    sharekhan_token_generated_at: now.toISOString(),
    sharekhan_token_expiry: expiry.toISOString(),
    updated_at: now.toISOString(),
  };

  console.log("[sharekhan-auth] UPSERTING tokens for user:", userId);

  const { error } = await supabase
    .from("user_settings")
    .upsert(upsertData, { onConflict: "user_id" });

  if (error) {
    console.log("[sharekhan-auth] UPSERT FAILED:", error.message);
    await log("sharekhan-auth", "store-tokens-upsert-failed", { 
      error: error.message,
      code: error.code,
      details: error.details 
    }, "ERROR");
    throw error;
  }

  console.log("[sharekhan-auth] UPSERT SUCCESS for user:", userId);
  await log("sharekhan-auth", "store-tokens-upserted", { userId });
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

// ========= VERIFY TOKEN ==========
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

  // Hit Sharekhan API to verify
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
    // CORS - ensure all responses have proper headers
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Config check
    if (!SHAREKHAN_API_KEY || !SHAREKHAN_API_SECRET) {
      await log("sharekhan-auth", "config-missing", { 
        hasApiKey: !!SHAREKHAN_API_KEY, 
        hasApiSecret: !!SHAREKHAN_API_SECRET 
      }, "ERROR");
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
        return new Response(JSON.stringify({ error: "request_token and user_id required", success: false }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenData = await exchangeToken(requestToken);
      
      // Check if exchange failed (uncrashable - returns structured error)
      if (tokenData.success === false) {
        await log("sharekhan-auth", "exchange-token-returned-error", { 
          error: tokenData.error,
          message: tokenData.message,
          rawBody: tokenData.rawBody
        }, "ERROR");
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: tokenData.error,
          message: tokenData.message,
          rawBody: tokenData.rawBody
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Handle different response formats from Sharekhan
      const accessToken = tokenData.accessToken || tokenData.access_token || (tokenData.data as any)?.accessToken;
      const refreshToken = tokenData.refreshToken || tokenData.refresh_token || (tokenData.data as any)?.refreshToken;
      const expiresIn = tokenData.expiresIn || tokenData.expires_in || (tokenData.data as any)?.expiresIn || 86400;

      if (!accessToken) {
        await log("sharekhan-auth", "exchange-token-no-access-token", { responseKeys: Object.keys(tokenData) }, "ERROR");
        return new Response(JSON.stringify({ 
          error: "No access token in response", 
          success: false,
          responseKeys: Object.keys(tokenData)
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await storeTokens(userId, accessToken as string, refreshToken as string | null, expiresIn as number);

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

    // Diagnostics (Enhanced with rawBody in logs)
    if (actionFromBody === "diagnose") {
      const userId = url.searchParams.get("user_id") || body.user_id;
      const supabase = getSupabaseClient();

      // Get recent logs including rawBody captured during failures
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
          hasApiSecret: !!SHAREKHAN_API_SECRET,
          hasEncryptionKey: AUTH_ENCRYPTION_KEY !== "DEFAULT_KEY_CHANGE_ME",
          apiKeyPreview: SHAREKHAN_API_KEY ? SHAREKHAN_API_KEY.substring(0, 8) + '...' : 'MISSING',
        },
        tokenStatus,
        hasToken,
        recentLogs: logs?.map(l => ({ 
          message: l.message, 
          level: l.level, 
          time: l.created_at,
          metadata: l.metadata  // Include full metadata with rawBody
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
    return new Response(JSON.stringify({ error: errorMessage, success: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
