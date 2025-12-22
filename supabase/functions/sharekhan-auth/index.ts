import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHAREKHAN_API_KEY = Deno.env.get("SHAREKHAN_API_KEY") || "";
const SHAREKHAN_API_SECURE_KEY = Deno.env.get("SHAREKHAN_API_SECURE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Sharekhan API endpoints
const SHAREKHAN_LOGIN_URL = "https://api.sharekhan.com/skapi/auth/login.html";
const SHAREKHAN_TOKEN_URL = "https://api.sharekhan.com/skapi/auth/getAccess";
const SHAREKHAN_PROFILE_URL = "https://api.sharekhan.com/skapi/services/profile";

interface TokenResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  status?: string;
  message?: string;
}

// Create Supabase client with service role for secure token storage
function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// Log to system_logs table
async function logToSystem(
  source: string,
  message: string,
  level: string = "INFO",
  metadata: Record<string, unknown> = {},
) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from("system_logs").insert({
      source,
      message,
      level,
      metadata,
    });
  } catch (error) {
    console.error("Failed to log to system_logs:", error);
  }
}

// Generate Sharekhan login URL for OAuth
function generateLoginUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    api_key: SHAREKHAN_API_KEY,
    redirect_uri: redirectUri,
  });
  return `${SHAREKHAN_LOGIN_URL}?${params.toString()}`;
}

// Exchange request_token for access_token
async function exchangeToken(requestToken: string, userId?: string): Promise<TokenResponse> {
  // NOTE: Never log raw tokens.
  await logToSystem("sharekhan-auth", "Exchange token: starting", "INFO", {
    stage: "exchange_token_start",
    userId: userId ?? null,
    requestTokenPresent: Boolean(requestToken),
    requestTokenLength: requestToken?.length ?? 0,
  });

  // Generate checksum: SHA256(api_key + request_token + api_secret)
  const checksumData = SHAREKHAN_API_KEY + requestToken + SHAREKHAN_API_SECURE_KEY;
  const encoder = new TextEncoder();
  const data = encoder.encode(checksumData);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const checksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const requestBody = {
    api_key: SHAREKHAN_API_KEY,
    request_token: requestToken,
    checksum,
  };

  await logToSystem("sharekhan-auth", "Exchange token: calling Sharekhan", "INFO", {
    stage: "sharekhan_exchange_request",
    userId: userId ?? null,
    endpoint: "getAccess",
  });

  const response = await fetch(SHAREKHAN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();

  await logToSystem(
    "sharekhan-auth",
    "Exchange token: Sharekhan responded",
    response.ok ? "INFO" : "ERROR",
    {
      stage: "sharekhan_exchange_response",
      userId: userId ?? null,
      status: response.status,
      ok: response.ok,
      responseLength: responseText?.length ?? 0,
    },
  );

  if (!response.ok) {
    // Avoid logging raw response body (may contain sensitive data)
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  let result: TokenResponse;
  try {
    result = JSON.parse(responseText);
  } catch {
    await logToSystem("sharekhan-auth", "Exchange token: invalid JSON from Sharekhan", "ERROR", {
      stage: "sharekhan_exchange_parse_error",
      userId: userId ?? null,
      responseLength: responseText?.length ?? 0,
    });
    throw new Error("Invalid token response");
  }

  await logToSystem("sharekhan-auth", "Exchange token: response parsed", "INFO", {
    stage: "sharekhan_exchange_parsed",
    userId: userId ?? null,
    accessTokenPresent: Boolean(result?.accessToken),
    refreshTokenPresent: Boolean(result?.refreshToken),
    expiresInPresent: typeof result?.expiresIn === "number",
    status: result?.status ?? null,
  });

  return result;
}

// Store tokens securely in user_settings
async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number | null,
): Promise<void> {
  const supabase = getSupabaseClient();

  const now = new Date();
  const expiryDate = expiresIn
    ? new Date(now.getTime() + expiresIn * 1000)
    : new Date(now.getTime() + 8 * 60 * 60 * 1000); // Default 8 hours if not specified

  await logToSystem("sharekhan-auth", "DB token save: starting", "INFO", {
    stage: "db_upsert_start",
    userId,
    refreshTokenPresent: Boolean(refreshToken),
    expiresIn,
  });

  const updateData = {
    sharekhan_access_token: accessToken,
    sharekhan_refresh_token: refreshToken,
    sharekhan_token_generated_at: now.toISOString(),
    sharekhan_token_expiry: expiryDate.toISOString(),
    updated_at: now.toISOString(),
  };

  // Check if user_settings exists for this user
  const { data: existing, error: existingError } = await supabase
    .from("user_settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    await logToSystem("sharekhan-auth", "DB token save: failed to read user_settings", "ERROR", {
      stage: "db_read_error",
      userId,
      error: existingError.message,
    });
    throw new Error(`Failed to read user_settings: ${existingError.message}`);
  }

  if (existing) {
    await logToSystem("sharekhan-auth", "DB token save: updating existing row", "INFO", {
      stage: "db_update",
      userId,
    });

    const { error } = await supabase.from("user_settings").update(updateData).eq("user_id", userId);

    if (error) {
      await logToSystem("sharekhan-auth", "DB token save: update failed", "ERROR", {
        stage: "db_upsert_error",
        userId,
        error: error.message,
      });
      throw new Error(`Failed to store tokens: ${error.message}`);
    }
  } else {
    await logToSystem("sharekhan-auth", "DB token save: inserting new row", "INFO", {
      stage: "db_insert",
      userId,
    });

    const { error } = await supabase.from("user_settings").insert({
      user_id: userId,
      ...updateData,
    });

    if (error) {
      await logToSystem("sharekhan-auth", "DB token save: insert failed", "ERROR", {
        stage: "db_upsert_error",
        userId,
        error: error.message,
      });
      throw new Error(`Failed to store tokens: ${error.message}`);
    }
  }

  await logToSystem("sharekhan-auth", "DB token save: success", "INFO", {
    stage: "db_upsert_ok",
    userId,
    tokenGeneratedAt: now.toISOString(),
    tokenExpiry: expiryDate.toISOString(),
  });
}

// Get stored access token
async function getStoredToken(userId: string): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: string | null;
  isExpired: boolean;
}> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("user_settings")
    .select("sharekhan_access_token, sharekhan_refresh_token, sharekhan_token_expiry")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { accessToken: null, refreshToken: null, tokenExpiry: null, isExpired: true };
  }

  const isExpired = data.sharekhan_token_expiry
    ? new Date(data.sharekhan_token_expiry) < new Date()
    : true;

  return {
    accessToken: data.sharekhan_access_token,
    refreshToken: data.sharekhan_refresh_token,
    tokenExpiry: data.sharekhan_token_expiry,
    isExpired,
  };
}

// Verify token by calling Sharekhan profile API
async function verifyToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(SHAREKHAN_PROFILE_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Health check handler
async function handleHealthCheck(userId: string): Promise<Response> {
  await logToSystem("sharekhan-auth", "Health check requested", "INFO", {
    stage: "health_check_start",
    userId,
  });

  const tokenInfo = await getStoredToken(userId);

  if (!tokenInfo.accessToken) {
    await logToSystem("sharekhan-auth", "Health check: no token found", "INFO", {
      stage: "health_check_no_token",
      userId,
    });

    return new Response(
      JSON.stringify({
        status: "AUTH_REQUIRED",
        message: "No Sharekhan access token found. Please authenticate.",
        tokenExpiry: null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (tokenInfo.isExpired) {
    await logToSystem("sharekhan-auth", "Health check: token expired", "WARN", {
      stage: "health_check_token_expired",
      userId,
      expiredAt: tokenInfo.tokenExpiry,
    });

    return new Response(
      JSON.stringify({
        status: "AUTH_REQUIRED",
        message: "Sharekhan access token has expired. Please re-authenticate.",
        tokenExpiry: tokenInfo.tokenExpiry,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const isValid = await verifyToken(tokenInfo.accessToken);

  if (!isValid) {
    await logToSystem("sharekhan-auth", "Health check: token invalid", "WARN", {
      stage: "health_check_token_invalid",
      userId,
    });

    return new Response(
      JSON.stringify({
        status: "AUTH_REQUIRED",
        message: "Sharekhan access token is invalid. Please re-authenticate.",
        tokenExpiry: tokenInfo.tokenExpiry,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  await logToSystem("sharekhan-auth", "Health check: token valid", "INFO", {
    stage: "health_check_ok",
    userId,
    tokenExpiry: tokenInfo.tokenExpiry,
  });

  return new Response(
    JSON.stringify({
      status: "AUTH_OK",
      message: "Sharekhan authentication is valid.",
      tokenExpiry: tokenInfo.tokenExpiry,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function handleDiagnose(req: Request): Promise<Response> {
  await logToSystem("sharekhan-auth", "Diagnose requested", "INFO", {
    stage: "diagnose_called",
    method: req.method,
  });

  const supabase = getSupabaseClient();
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: logs, error: logsError } = await supabase
    .from("system_logs")
    .select("created_at, level, message, metadata")
    .eq("source", "sharekhan-auth")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(100);

  const hasStage = (stage: string) =>
    (logs ?? []).some((l) => (l.metadata as Record<string, unknown> | null)?.stage === stage);

  const received_request_token = hasStage("request_token_received");
  const exchange_token_called = hasStage("exchange_token_called");

  const sharekhan_response_status = (() => {
    const entry = (logs ?? []).find((l) => {
      const m = l.metadata as Record<string, unknown> | null;
      return m?.stage === "sharekhan_exchange_response" && typeof m?.status === "number";
    });
    const m = entry?.metadata as Record<string, unknown> | null;
    return typeof m?.status === "number" ? (m.status as number) : null;
  })();

  const access_token_parsed = (logs ?? []).some((l) => {
    const m = l.metadata as Record<string, unknown> | null;
    return m?.stage === "sharekhan_exchange_parsed" && Boolean(m?.accessTokenPresent);
  });

  const access_token_saved = hasStage("db_upsert_ok");

  // Read-only check (does not expose token values)
  const { data: anyTokenRow } = await supabase
    .from("user_settings")
    .select("id")
    .not("sharekhan_access_token", "is", null)
    .limit(1);

  const db_token_value_present = Boolean(anyTokenRow && anyTokenRow.length > 0);

  let likely_cause = "No failure detected";

  if (!SHAREKHAN_API_KEY || !SHAREKHAN_API_SECURE_KEY) {
    likely_cause = "Sharekhan API keys not configured";
  } else if (!received_request_token) {
    likely_cause = "Missing request_token in redirect URL";
  } else if (typeof sharekhan_response_status === "number" && sharekhan_response_status >= 400) {
    likely_cause = "Sharekhan rejected token exchange";
  } else if (exchange_token_called && !access_token_parsed) {
    likely_cause = "Access token not returned by Sharekhan";
  } else if (exchange_token_called && !access_token_saved && !db_token_value_present) {
    likely_cause = "Unable to save token to database";
  } else if (exchange_token_called && sharekhan_response_status === null) {
    likely_cause = "Sharekhan API unreachable";
  }

  // If logs couldn't be read, return explicit info (still 200)
  if (logsError) {
    likely_cause = "Unable to read diagnostic logs";
  }

  return new Response(
    JSON.stringify({
      received_request_token,
      exchange_token_called,
      sharekhan_response_status,
      access_token_saved,
      db_token_value_present,
      likely_cause,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Support both query params and body for action/params
    let action = url.searchParams.get("action");
    let body: Record<string, unknown> = {};

    // Parse body if present (POST requests)
    if (req.method === "POST") {
      try {
        body = await req.json();
        if (!action && body.action) {
          action = body.action as string;
        }
      } catch {
        // Body parsing failed, continue with query params only
      }
    }

    await logToSystem("sharekhan-auth", "Request received", "INFO", {
      stage: "request_received",
      method: req.method,
      action,
      hasRequestToken: Boolean(body.request_token || url.searchParams.get("request_token")),
      hasUserId: Boolean(body.user_id || body.userId || url.searchParams.get("user_id")),
    });

    // Diagnose is read-only and should work even if Sharekhan keys are missing
    if (action === "diagnose") {
      return await handleDiagnose(req);
    }

    // Validate API keys are configured
    if (!SHAREKHAN_API_KEY || !SHAREKHAN_API_SECURE_KEY) {
      await logToSystem("sharekhan-auth", "Config error: Sharekhan API keys not configured", "ERROR", {
        stage: "config_error",
        sharekhanApiKeyPresent: Boolean(SHAREKHAN_API_KEY),
        sharekhanSecureKeyPresent: Boolean(SHAREKHAN_API_SECURE_KEY),
      });

      return new Response(
        JSON.stringify({
          error: "Sharekhan API keys not configured",
          status: "CONFIG_ERROR",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Action: Generate login URL
    if (action === "login-url") {
      const redirectUri = url.searchParams.get("redirect_uri") || (body.redirectUri as string);

      await logToSystem("sharekhan-auth", "Login URL requested", "INFO", {
        stage: "login_url_requested",
        redirectUriPresent: Boolean(redirectUri),
      });

      if (!redirectUri) {
        await logToSystem("sharekhan-auth", "Login URL request missing redirect_uri", "ERROR", {
          stage: "login_url_missing_redirect",
        });

        return new Response(
          JSON.stringify({ error: "redirect_uri is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const loginUrl = generateLoginUrl(redirectUri);

      await logToSystem("sharekhan-auth", "Login URL generated", "INFO", {
        stage: "login_url_generated",
        redirectUri,
      });

      return new Response(
        JSON.stringify({
          loginUrl,
          message: "Open this URL in browser to authenticate with Sharekhan",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Action: Exchange request_token for access_token
    if (action === "exchange-token") {
      const request_token = body.request_token as string;
      const user_id = body.user_id as string;

      await logToSystem(
        "sharekhan-auth",
        request_token ? "request_token received" : "request_token missing",
        request_token ? "INFO" : "ERROR",
        {
          stage: request_token ? "request_token_received" : "request_token_missing",
          userId: user_id || null,
          requestTokenPresent: Boolean(request_token),
          requestTokenLength: request_token?.length ?? 0,
        },
      );

      if (!request_token) {
        return new Response(
          JSON.stringify({ error: "request_token is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!user_id) {
        await logToSystem("sharekhan-auth", "Exchange token request missing user_id", "ERROR", {
          stage: "exchange_token_missing_user_id",
        });

        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      await logToSystem("sharekhan-auth", "exchange-token called", "INFO", {
        stage: "exchange_token_called",
        userId: user_id,
      });

      try {
        const tokenResponse = await exchangeToken(request_token, user_id);

        if (!tokenResponse.accessToken) {
          await logToSystem("sharekhan-auth", "Token exchange failed - no access token returned", "ERROR", {
            stage: "access_token_missing",
            userId: user_id,
            status: tokenResponse.status ?? null,
            message: tokenResponse.message ?? null,
          });

          return new Response(
            JSON.stringify({
              error: "Token exchange failed",
              details: tokenResponse.message || "No access token in response",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Store tokens securely
        await storeTokens(user_id, tokenResponse.accessToken, tokenResponse.refreshToken || null, tokenResponse.expiresIn || null);

        await logToSystem("sharekhan-auth", "Token exchange successful", "INFO", {
          stage: "exchange_token_success",
          userId: user_id,
        });

        return new Response(
          JSON.stringify({
            status: "SUCCESS",
            message: "Sharekhan authentication successful. Tokens stored securely.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await logToSystem("sharekhan-auth", "Token exchange error", "ERROR", {
          stage: "exchange_token_error",
          userId: user_id,
          error: errorMessage,
        });

        return new Response(
          JSON.stringify({
            error: "Token exchange failed",
            details: errorMessage,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Action: Health check
    if (action === "health") {
      const userId = url.searchParams.get("user_id") || (body.userId as string);

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return await handleHealthCheck(userId);
    }

    // Action: Get token for internal use (backend only - returns token for backend functions)
    if (action === "get-token") {
      const userId = url.searchParams.get("user_id") || (body.userId as string);

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "user_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const tokenInfo = await getStoredToken(userId);

      if (!tokenInfo.accessToken || tokenInfo.isExpired) {
        return new Response(
          JSON.stringify({
            status: "AUTH_REQUIRED",
            accessToken: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Note: This endpoint should only be called by other backend functions
      return new Response(
        JSON.stringify({
          status: "AUTH_OK",
          accessToken: tokenInfo.accessToken,
          tokenExpiry: tokenInfo.tokenExpiry,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({
        error: "Invalid action",
        validActions: ["login-url", "exchange-token", "health", "get-token", "diagnose"],
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logToSystem("sharekhan-auth", "Unexpected error", "ERROR", {
      stage: "unexpected_error",
      error: errorMessage,
    });

    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
