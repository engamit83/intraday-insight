// supabase/functions/sharekhan-auth/index.ts
// FINAL – Fail-safe Sharekhan OAuth backend (Single Source of Truth)
//
// IMPORTANT ARCHITECTURE NOTE (fixed after live testing):
// Sharekhan's OAuth callback only ever returns `request_token` in the query
// string. It does NOT echo back a `state` parameter, no matter what you send
// in the login URL. The previous version of this file relied on `state` to
// identify which app user was completing the login — that never worked and
// always threw "Invalid or expired OAuth state", confirmed via real browser
// testing and system_logs entries.
//
// Fix: the frontend's own callback page (src/pages/SharekhanCallback.tsx)
// receives Sharekhan's redirect while the user is logged into the app, then
// calls this function's `complete_login` action using their real Supabase
// session. That gives us a reliable authenticated userId, without needing
// Sharekhan to round-trip anything. This function still does 100% of the
// actual token exchange and encryption — the frontend never touches
// Sharekhan's API directly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import CryptoJS from "https://esm.sh/crypto-js@4.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ========= ENV =========
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHAREKHAN_API_KEY = Deno.env.get("SHAREKHAN_API_KEY")!;
const SHAREKHAN_API_SECRET = Deno.env.get("SHAREKHAN_API_SECRET")!;
const AUTH_ENCRYPTION_KEY = Deno.env.get("AUTH_ENCRYPTION_KEY")!;

// ========= CONSTANTS =========
// This URL is NOT sent to Sharekhan (they reject unknown params like
// redirect_uri). It must instead be manually registered as the callback URL
// in Sharekhan's own developer portal for this API key.
const APP_CALLBACK_URL_FOR_REFERENCE =
  "https://id-preview--0b7f6ea9-fd3b-48da-b4ea-ee41af1cab07.lovable.app/sharekhan-callback";

const SHAREKHAN_LOGIN_URL =
  "https://api.sharekhan.com/skapi/auth/login.html";

const SHAREKHAN_TOKEN_URL =
  "https://api.sharekhan.com/skapi/auth/access-token";

// ========= HELPERS =========
function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function encrypt(value: string): string {
  return CryptoJS.AES.encrypt(value, AUTH_ENCRYPTION_KEY).toString();
}

async function log(
  source: string,
  message: string,
  metadata: Record<string, unknown> = {},
  level: "INFO" | "ERROR" = "INFO"
) {
  try {
    await supabaseAdmin().from("system_logs").insert({
      source,
      message,
      metadata,
      level,
    });
  } catch {
    // never throw from logger
  }
}

async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const token = auth.replace("Bearer ", "");
  const { data } = await supabaseAdmin().auth.getUser(token);
  return data?.user?.id ?? null;
}

// ========= TOKEN EXCHANGE =========
async function exchangeToken(requestToken: string) {
  const checksumSource = requestToken + SHAREKHAN_API_SECRET;
  const checksum = CryptoJS.SHA256(checksumSource).toString();

  const body = new URLSearchParams({
    api_key: SHAREKHAN_API_KEY,
    request_token: requestToken,
    checksum,
  });

  await log("sharekhan-auth", "token-exchange-request", {
    endpoint: SHAREKHAN_TOKEN_URL,
  });

  const resp = await fetch(SHAREKHAN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await resp.text();

  await log("sharekhan-auth", "token-exchange-response", {
    status: resp.status,
    body: text.slice(0, 500),
  });

  if (!resp.ok) {
    throw new Error(`Sharekhan token exchange failed (${resp.status})`);
  }

  const data = JSON.parse(text);

  if (!data.access_token) {
    throw new Error("No access_token in Sharekhan response");
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string | undefined) ?? null,
  };
}

// ========= STORE TOKENS =========
async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null
) {
  const now = new Date();
  const expiry = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8h

  const { error } = await supabaseAdmin()
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        sharekhan_access_token: encrypt(accessToken),
        sharekhan_refresh_token: refreshToken
          ? encrypt(refreshToken)
          : null,
        sharekhan_token_generated_at: now.toISOString(),
        sharekhan_token_expiry: expiry.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}

// ========= SERVER =========
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      // ===== HEALTH CHECK =====
      if (body?.action === "health") {
        const userId = await getUserIdFromAuth(req);
        if (!userId) {
          return new Response(JSON.stringify({ status: "NO_AUTH" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data } = await supabaseAdmin()
          .from("user_settings")
          .select("sharekhan_access_token, sharekhan_token_expiry")
          .eq("user_id", userId)
          .maybeSingle();

        const active =
          data?.sharekhan_access_token &&
          data?.sharekhan_token_expiry &&
          new Date(data.sharekhan_token_expiry) > new Date();

        return new Response(
          JSON.stringify({ status: active ? "AUTH_OK" : "AUTH_MISSING" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ===== COMPLETE LOGIN (called by SharekhanCallback.tsx) =====
      // Replaces the old GET callback + state verification, which never
      // worked since Sharekhan doesn't echo `state` back. The user's real
      // Supabase auth token (attached automatically by supabase.functions.invoke)
      // is now the source of truth for identity.
      if (body?.action === "complete_login") {
        const userId = await getUserIdFromAuth(req);
        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const requestToken = body?.requestToken;
        if (!requestToken || typeof requestToken !== "string") {
          return new Response(
            JSON.stringify({ error: "Missing requestToken" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { accessToken, refreshToken } = await exchangeToken(requestToken);
        await storeTokens(userId, accessToken, refreshToken);

        await log("sharekhan-auth", "login-completed", { userId });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ===== LOGIN URL =====
      const userId = await getUserIdFromAuth(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only api_key is sent — Sharekhan's documented customer-login flow
      // doesn't use redirect_uri or state as query parameters. The callback
      // destination (APP_CALLBACK_URL_FOR_REFERENCE) is configured on
      // Sharekhan's developer portal instead, not passed here.
      const params = new URLSearchParams({
        api_key: SHAREKHAN_API_KEY,
      });

      const loginUrl = `${SHAREKHAN_LOGIN_URL}?${params.toString()}`;

      return new Response(JSON.stringify({ fullUrl: loginUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    await log("sharekhan-auth", "unhandled-error", {
      message: String(err),
    }, "ERROR");

    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
