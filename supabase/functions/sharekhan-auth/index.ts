// supabase/functions/sharekhan-auth/index.ts
//
// REWRITTEN based on Sharekhan's own official Python client library
// (https://github.com/Sharekhan-API/shareconnectpython), read directly from
// source. Two separate real bugs were found and fixed here, confirmed by
// live testing and system_logs entries:
//
// BUG A: The old code POSTed to "https://api.sharekhan.com/skapi/auth/access-token"
// using a SHA256(requestToken + secret) checksum, form-urlencoded. That is
// Zerodha Kite Connect's protocol, not Sharekhan's — Sharekhan's server
// returned a real 404 "No endpoint POST /skapi/auth/access-token" for this.
// The real endpoint is "https://api.sharekhan.com/skapi/services/access/token",
// and the real request format is a JSON body with camelCase fields
// (apiKey, requestToken, state) — no checksum involved at all.
//
// BUG B: Sharekhan's request_token must be decrypted, its two pipe-separated
// parts swapped, and the result re-encrypted with AES-256-GCM using your API
// secret as the raw key (fixed 16-zero-byte IV, no AAD) before it can be sent
// to the access-token endpoint. The old code sent the raw token untouched.
//
// Also fixed: identifying which app-user is completing the OAuth login.
// Sharekhan's callback only ever returns `request_token` — it never echoes
// back a `state` parameter, no matter what's sent in the login URL. So this
// function no longer tries to verify identity from the callback itself.
// Instead, the frontend (src/pages/SharekhanCallback.tsx) calls this
// function's "complete_login" action using the user's real logged-in
// Supabase session, which reliably identifies them.

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
// Registered manually on Sharekhan's developer portal (Modify App > Redirect URL),
// NOT sent as a query parameter — Sharekhan rejects unrecognized params.
const APP_CALLBACK_URL_FOR_REFERENCE =
  "https://id-preview--0b7f6ea9-fd3b-48da-b4ea-ee41af1cab07.lovable.app/sharekhan-callback";

const SHAREKHAN_ROOT_URL = "https://api.sharekhan.com";
const SHAREKHAN_LOGIN_URL = `${SHAREKHAN_ROOT_URL}/skapi/auth/login.html`;
const SHAREKHAN_ACCESS_TOKEN_URL = `${SHAREKHAN_ROOT_URL}/skapi/services/access/token`;

// Sharekhan's own reference SDK sends a fixed literal "12345" as state and
// never validates it against anything on the callback — it's a required
// field on the request, not a real identity mechanism. Real user identity
// comes from the Supabase auth token instead (see complete_login below).
const SHAREKHAN_STATE = "12345";

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

// ========= BASE64URL (no padding) HELPERS =========
function base64UrlDecode(input: string): Uint8Array {
  // Accept both standard (+/) and urlsafe (-_) alphabets, with or without
  // padding — matches Python's base64.urlsafe_b64decode tolerance.
  let normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncodeNoPad(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ========= AES-256-GCM (matches Sharekhan's reference implementation) =========
// Fixed 16-zero-byte IV, no AAD, 128-bit (16-byte) auth tag appended to
// ciphertext — exactly as Sharekhan's own Python SDK does it.
const ZERO_IV = new Uint8Array(16);

async function importAesKey(secret: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(secret);
  if (keyBytes.length !== 32) {
    throw new Error(
      `SHAREKHAN_API_SECRET must be exactly 32 bytes for AES-256-GCM, got ${keyBytes.length}`
    );
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "decrypt",
    "encrypt",
  ]);
}

async function aesGcmDecrypt(secret: string, base64Ciphertext: string): Promise<string> {
  const key = await importAesKey(secret);
  const data = base64UrlDecode(base64Ciphertext);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ZERO_IV, tagLength: 128 },
    key,
    data
  );
  return new TextDecoder().decode(plainBuf);
}

async function aesGcmEncrypt(secret: string, plaintext: string): Promise<string> {
  const key = await importAesKey(secret);
  const plainBytes = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ZERO_IV, tagLength: 128 },
    key,
    plainBytes
  );
  return base64UrlEncodeNoPad(new Uint8Array(cipherBuf));
}

// ========= SHAREKHAN'S generate_session() EQUIVALENT =========
// Decrypt the raw request_token, swap its two pipe-separated parts, then
// re-encrypt — this exact transformed value (not the original token) is
// what Sharekhan's access-token endpoint expects.
async function generateSession(requestToken: string): Promise<string> {
  const decrypted = await aesGcmDecrypt(SHAREKHAN_API_SECRET, requestToken);
  const parts = decrypted.split("|");
  if (parts.length !== 2) {
    throw new Error(`Unexpected decrypted request_token format: ${parts.length} parts`);
  }
  const swapped = `${parts[1]}|${parts[0]}`;
  return aesGcmEncrypt(SHAREKHAN_API_SECRET, swapped);
}

// ========= TOKEN EXCHANGE =========
async function exchangeToken(requestToken: string) {
  const encStr = await generateSession(requestToken);

  const payload = {
    apiKey: SHAREKHAN_API_KEY,
    requestToken: encStr,
    state: SHAREKHAN_STATE,
  };

  await log("sharekhan-auth", "token-exchange-request", {
    endpoint: SHAREKHAN_ACCESS_TOKEN_URL,
  });

  const resp = await fetch(SHAREKHAN_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();

  await log("sharekhan-auth", "token-exchange-response", {
    status: resp.status,
    body: text.slice(0, 500),
  });

  if (!resp.ok) {
    throw new Error(`Sharekhan token exchange failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(text);

  // Sharekhan's response shape can vary by account/version; check the
  // documented common field names defensively.
  const accessToken = data.accessToken || data.access_token || data.sessionToken;
  if (!accessToken) {
    throw new Error(`No access token in Sharekhan response: ${text.slice(0, 200)}`);
  }

  return {
    accessToken: accessToken as string,
    refreshToken: (data.refreshToken || data.refresh_token || null) as string | null,
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

        try {
          const { accessToken, refreshToken } = await exchangeToken(requestToken);
          await storeTokens(userId, accessToken, refreshToken);
          await log("sharekhan-auth", "login-completed", { userId });

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (err) {
          await log("sharekhan-auth", "complete-login-failed", {
            userId,
            message: String(err),
          }, "ERROR");

          return new Response(
            JSON.stringify({ error: String(err) }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // ===== LOGIN URL =====
      const userId = await getUserIdFromAuth(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const params = new URLSearchParams({
        api_key: SHAREKHAN_API_KEY,
        state: SHAREKHAN_STATE,
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
