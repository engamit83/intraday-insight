// sharekhan-auth Edge Function - V2 Protocol with Token Swap
// Handles Sharekhan OAuth flow: login redirect + token exchange

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import CryptoJS from "https://esm.sh/crypto-js@4.1.1";
import Hex from "https://esm.sh/crypto-js@4.1.1/enc-hex";
import Utf8 from "https://esm.sh/crypto-js@4.1.1/enc-utf8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ========= ENV ==========
const SHAREKHAN_API_KEY = Deno.env.get("SHAREKHAN_API_KEY") || "";
const SHAREKHAN_API_SECRET = Deno.env.get("SHAREKHAN_API_SECRET") || "";
const AUTH_ENCRYPTION_KEY = Deno.env.get("AUTH_ENCRYPTION_KEY") || "default-key";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ========= HARDCODED REDIRECT URI ==========
const SHAREKHAN_REDIRECT_URI = "https://emxhhxvtbjsjtjacbike.supabase.co/functions/v1/sharekhan-auth";

// ========= ENDPOINTS ==========
const SHAREKHAN_LOGIN_URL = "https://api.sharekhan.com/skapi/auth/login.html";
const SHAREKHAN_TOKEN_URL = "https://api.sharekhan.com/skapi/auth/access-token";
const SHAREKHAN_PROFILE_URL = "https://api.sharekhan.com/skapi/services/profile";

// ========= HELPERS ==========
function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, AUTH_ENCRYPTION_KEY).toString();
}

function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, AUTH_ENCRYPTION_KEY);
  return bytes.toString(Utf8);
}

async function log(source: string, message: string, metadata: Record<string, unknown> = {}, level = "INFO") {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("system_logs").insert({
      source,
      message,
      metadata,
      level,
    });
  } catch (e) {
    console.error("[sharekhan-auth] Failed to write log:", e);
  }
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ========= GENERATE LOGIN URL ==========
async function generateLoginUrl(state: string): Promise<string> {
  const params = new URLSearchParams({
    api_key: SHAREKHAN_API_KEY,
    redirect_uri: SHAREKHAN_REDIRECT_URI,
    state,
  });
  
  const loginUrl = `${SHAREKHAN_LOGIN_URL}?${params.toString()}`;
  
  console.log("[sharekhan-auth] GENERATED LOGIN URL:", {
    baseUrl: SHAREKHAN_LOGIN_URL,
    redirect_uri: SHAREKHAN_REDIRECT_URI,
    state_preview: state.substring(0, 20) + '...',
    fullUrl: loginUrl.substring(0, 100) + '...'
  });
  
  await log("sharekhan-auth", "generate-login-url", {
    redirect_uri: SHAREKHAN_REDIRECT_URI,
    state_preview: state.substring(0, 20),
  });
  
  return loginUrl;
}

// ========= EXCHANGE TOKEN ==========
async function exchangeToken(requestToken: string): Promise<{ 
  success: boolean; 
  access_token?: string; 
  refresh_token?: string; 
  error?: string;
  message?: string;
}> {
  console.log("[sharekhan-auth] EXCHANGE TOKEN STARTED:", {
    apiKeyPreview: SHAREKHAN_API_KEY ? SHAREKHAN_API_KEY.substring(0, 8) + '...' : 'MISSING',
    secretPreview: SHAREKHAN_API_SECRET ? '***SET***' : 'MISSING',
    requestTokenPreview: requestToken ? requestToken.substring(0, 20) + '...' : 'NONE'
  });

  // TOKEN SWAP LOGIC: If request_token contains "|", split and swap parts (A|B → B|A)
  let processedToken = requestToken;
  if (requestToken.includes('|')) {
    const parts = requestToken.split('|');
    if (parts.length === 2) {
      processedToken = parts[1] + '|' + parts[0]; // Swap: B|A
      console.log("[sharekhan-auth] TOKEN SWAP APPLIED:", {
        original: requestToken.substring(0, 30) + '...',
        swapped: processedToken.substring(0, 30) + '...'
      });
    }
  } else {
    console.log("[sharekhan-auth] NO PIPE IN TOKEN - using as-is");
  }

  // Generate checksum = HEX(SHA256(swapped_token + api_key + api_secret))
  const checksumInput = processedToken + SHAREKHAN_API_KEY + SHAREKHAN_API_SECRET;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(checksumInput));
  const checksum = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // Use camelCase keys as per V2 spec
  const requestBody = {
    apiKey: SHAREKHAN_API_KEY,
    requestToken: processedToken,
    checksum,
  };

  console.log("[sharekhan-auth] REQUEST DETAILS:", {
    endpoint: SHAREKHAN_TOKEN_URL,
    method: "POST",
    bodyKeys: Object.keys(requestBody),
    apiKey: SHAREKHAN_API_KEY.substring(0, 8) + '***',
    requestToken: processedToken.substring(0, 20) + '***',
    checksum: checksum.substring(0, 16) + '***',
    secretUsed: SHAREKHAN_API_SECRET ? 'YES (masked)' : 'NO - MISSING!',
    timeout: '15 seconds'
  });

  await log("sharekhan-auth", "exchange-token-calling-api", { 
    endpoint: SHAREKHAN_TOKEN_URL,
    apiKeyLength: SHAREKHAN_API_KEY.length,
    secretLength: SHAREKHAN_API_SECRET.length,
    checksumLength: checksum.length,
    tokenSwapped: requestToken.includes('|'),
    message: "REQUEST STARTED with 15s timeout"
  });

  let resp: Response;
  try {
    console.log("[sharekhan-auth] FETCH STARTING NOW...");
    resp = await fetchWithTimeout(SHAREKHAN_TOKEN_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "api-key": SHAREKHAN_API_KEY,
      },
      body: JSON.stringify(requestBody),
    }, 15000);
    console.log("[sharekhan-auth] FETCH COMPLETED - Status:", resp.status);
  } catch (fetchErr) {
    const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.log("[sharekhan-auth] FETCH FAILED:", errMsg);
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
  console.log("[sharekhan-auth] RAW RESPONSE BODY:", respText);

  await log("sharekhan-auth", "exchange-token-raw-response", { 
    status: resp.status, 
    ok: resp.ok,
    rawBody: respText.substring(0, 1000),
    contentType: resp.headers.get("content-type")
  });

  // Parse response
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(respText);
  } catch {
    console.log("[sharekhan-auth] JSON PARSE FAILED - response is not valid JSON");
    await log("sharekhan-auth", "exchange-token-json-parse-failed", { 
      rawBody: respText.substring(0, 500) 
    }, "ERROR");
    return { 
      success: false, 
      error: "INVALID_JSON_RESPONSE",
      message: respText.substring(0, 200)
    };
  }

  console.log("[sharekhan-auth] PARSED RESPONSE:", JSON.stringify(data, null, 2));

  // Check for success indicators
  if (data.access_token || data.accessToken) {
    const accessToken = (data.access_token || data.accessToken) as string;
    const refreshToken = (data.refresh_token || data.refreshToken || null) as string | null;
    
    console.log("[sharekhan-auth] SUCCESS - Got access token");
    await log("sharekhan-auth", "exchange-token-success", { 
      hasAccessToken: true,
      hasRefreshToken: !!refreshToken
    });
    
    return { 
      success: true, 
      access_token: accessToken,
      refresh_token: refreshToken || undefined
    };
  }

  // Handle error responses
  const errorMsg = (data.message || data.error || data.status || "UNKNOWN_ERROR") as string;
  console.log("[sharekhan-auth] API ERROR RESPONSE:", errorMsg);
  
  await log("sharekhan-auth", "exchange-token-api-error", { 
    data,
    errorMsg
  }, "ERROR");

  return { 
    success: false, 
    error: "API_ERROR",
    message: errorMsg
  };
}

// ========= STORE TOKENS ==========
async function storeTokens(userId: string, access: string, refresh?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const expiry = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours

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
    console.error("[sharekhan-auth] Failed to store tokens:", error);
    await log("sharekhan-auth", "store-tokens-failed", { error: error.message }, "ERROR");
    return false;
  }

  console.log("[sharekhan-auth] Tokens stored successfully");
  await log("sharekhan-auth", "store-tokens-success", { userId });
  return true;
}

// ========= GET USER FROM AUTH HEADER ==========
async function getUserFromAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  
  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.log("[sharekhan-auth] Auth failed:", error?.message);
    return null;
  }
  
  return data.user.id;
}

// ========= MAIN HANDLER ==========
serve(async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  console.log("[sharekhan-auth] INCOMING REQUEST:", {
    method,
    path: url.pathname,
    searchParams: Object.fromEntries(url.searchParams)
  });

  try {
    // CORS - ensure all responses have proper headers
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Config check
    if (!SHAREKHAN_API_KEY || !SHAREKHAN_API_SECRET) {
      console.error("[sharekhan-auth] MISSING CONFIG:", {
        hasApiKey: !!SHAREKHAN_API_KEY,
        hasSecret: !!SHAREKHAN_API_SECRET
      });
      return new Response(
        JSON.stringify({ error: "Sharekhan API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========= OAUTH CALLBACK (GET with request_token) ==========
    const requestToken = url.searchParams.get("request_token");
    const state = url.searchParams.get("state");
    
    if (method === "GET" && requestToken) {
      console.log("[sharekhan-auth] OAUTH CALLBACK received:", {
        hasRequestToken: true,
        hasState: !!state,
        tokenPreview: requestToken.substring(0, 20) + '...'
      });

      await log("sharekhan-auth", "oauth-callback-received", {
        hasState: !!state,
        requestTokenLength: requestToken.length
      });

      // Exchange token
      const result = await exchangeToken(requestToken);
      
      if (!result.success) {
        console.log("[sharekhan-auth] Token exchange failed:", result.error);
        // Redirect to frontend with error
        const errorUrl = `${url.origin}/settings?sharekhan_error=${encodeURIComponent(result.message || result.error || 'unknown')}`;
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: errorUrl }
        });
      }

      // If we have state, it should contain the user_id
      let userId = state;
      
      if (userId && result.access_token) {
        await storeTokens(userId, result.access_token, result.refresh_token);
      }

      // Redirect to frontend with success
      const successUrl = `${url.origin}/settings?sharekhan_connected=true`;
      console.log("[sharekhan-auth] Redirecting to success URL:", successUrl);
      
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: successUrl }
      });
    }

    // ========= GENERATE LOGIN URL (POST) ==========
    if (method === "POST") {
      const authHeader = req.headers.get("authorization");
      const userId = await getUserFromAuth(authHeader);
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use userId as state for callback
      const fullUrl = await generateLoginUrl(userId);
      
      console.log("[sharekhan-auth] Returning fullUrl for user:", userId, "URL:", fullUrl.substring(0, 80) + '...');
      
      // Return as JSON with fullUrl key for frontend compatibility
      return new Response(
        JSON.stringify({ login_url: fullUrl, fullUrl: fullUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========= UNKNOWN REQUEST ==========
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[sharekhan-auth] UNHANDLED ERROR:", errMsg);
    
    await log("sharekhan-auth", "unhandled-error", { error: errMsg }, "ERROR");
    
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
