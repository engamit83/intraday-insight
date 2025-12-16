import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHAREKHAN_API_KEY = Deno.env.get('SHAREKHAN_API_KEY') || '';
const SHAREKHAN_API_SECURE_KEY = Deno.env.get('SHAREKHAN_API_SECURE_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Sharekhan API endpoints
const SHAREKHAN_LOGIN_URL = 'https://api.sharekhan.com/skapi/auth/login.html';
const SHAREKHAN_TOKEN_URL = 'https://api.sharekhan.com/skapi/auth/getAccess';
const SHAREKHAN_PROFILE_URL = 'https://api.sharekhan.com/skapi/services/profile';

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
  level: string = 'INFO',
  metadata: Record<string, unknown> = {}
) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_logs').insert({
      source,
      message,
      level,
      metadata,
    });
  } catch (error) {
    console.error('Failed to log to system_logs:', error);
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
async function exchangeToken(requestToken: string): Promise<TokenResponse> {
  console.log('Exchanging request_token for access_token...');
  
  // Generate checksum: SHA256(api_key + request_token + api_secret)
  const checksumData = SHAREKHAN_API_KEY + requestToken + SHAREKHAN_API_SECURE_KEY;
  const encoder = new TextEncoder();
  const data = encoder.encode(checksumData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const requestBody = {
    api_key: SHAREKHAN_API_KEY,
    request_token: requestToken,
    checksum: checksum,
  };

  console.log('Token exchange request prepared');

  const response = await fetch(SHAREKHAN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log('Token exchange response status:', response.status);

  if (!response.ok) {
    console.error('Token exchange failed:', responseText);
    throw new Error(`Token exchange failed: ${response.status} - ${responseText}`);
  }

  let result: TokenResponse;
  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid token response: ${responseText}`);
  }

  return result;
}

// Store tokens securely in user_settings
async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number | null
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const now = new Date();
  const expiryDate = expiresIn 
    ? new Date(now.getTime() + expiresIn * 1000)
    : new Date(now.getTime() + 8 * 60 * 60 * 1000); // Default 8 hours if not specified

  const updateData = {
    sharekhan_access_token: accessToken,
    sharekhan_refresh_token: refreshToken,
    sharekhan_token_generated_at: now.toISOString(),
    sharekhan_token_expiry: expiryDate.toISOString(),
    updated_at: now.toISOString(),
  };

  // Check if user_settings exists for this user
  const { data: existing } = await supabase
    .from('user_settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('user_settings')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update tokens:', error);
      throw new Error(`Failed to store tokens: ${error.message}`);
    }
  } else {
    const { error } = await supabase
      .from('user_settings')
      .insert({
        user_id: userId,
        ...updateData,
      });

    if (error) {
      console.error('Failed to insert tokens:', error);
      throw new Error(`Failed to store tokens: ${error.message}`);
    }
  }

  await logToSystem('sharekhan-auth', `Tokens stored successfully for user ${userId}`, 'INFO', {
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
    .from('user_settings')
    .select('sharekhan_access_token, sharekhan_refresh_token, sharekhan_token_expiry')
    .eq('user_id', userId)
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
    console.log('Verifying Sharekhan access token...');
    
    const response = await fetch(SHAREKHAN_PROFILE_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Token verification response status:', response.status);
    return response.ok;
  } catch (error) {
    console.error('Token verification failed:', error);
    return false;
  }
}

// Health check handler
async function handleHealthCheck(userId: string): Promise<Response> {
  console.log(`Health check for user: ${userId}`);
  
  const tokenInfo = await getStoredToken(userId);

  if (!tokenInfo.accessToken) {
    await logToSystem('sharekhan-auth', `Health check: No token found for user ${userId}`, 'WARN');
    return new Response(
      JSON.stringify({
        status: 'AUTH_REQUIRED',
        message: 'No Sharekhan access token found. Please authenticate.',
        tokenExpiry: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (tokenInfo.isExpired) {
    await logToSystem('sharekhan-auth', `Health check: Token expired for user ${userId}`, 'WARN', {
      expiredAt: tokenInfo.tokenExpiry,
    });
    return new Response(
      JSON.stringify({
        status: 'AUTH_REQUIRED',
        message: 'Sharekhan access token has expired. Please re-authenticate.',
        tokenExpiry: tokenInfo.tokenExpiry,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify token with Sharekhan API
  const isValid = await verifyToken(tokenInfo.accessToken);

  if (!isValid) {
    await logToSystem('sharekhan-auth', `Health check: Token invalid for user ${userId}`, 'WARN');
    return new Response(
      JSON.stringify({
        status: 'AUTH_REQUIRED',
        message: 'Sharekhan access token is invalid. Please re-authenticate.',
        tokenExpiry: tokenInfo.tokenExpiry,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await logToSystem('sharekhan-auth', `Health check: Token valid for user ${userId}`, 'INFO', {
    tokenExpiry: tokenInfo.tokenExpiry,
  });

  return new Response(
    JSON.stringify({
      status: 'AUTH_OK',
      message: 'Sharekhan authentication is valid.',
      tokenExpiry: tokenInfo.tokenExpiry,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    console.log(`Sharekhan Auth - Action: ${action}`);

    // Validate API keys are configured
    if (!SHAREKHAN_API_KEY || !SHAREKHAN_API_SECURE_KEY) {
      console.error('Sharekhan API keys not configured');
      return new Response(
        JSON.stringify({
          error: 'Sharekhan API keys not configured',
          status: 'CONFIG_ERROR',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Generate login URL
    if (action === 'login-url') {
      const redirectUri = url.searchParams.get('redirect_uri');
      
      if (!redirectUri) {
        return new Response(
          JSON.stringify({ error: 'redirect_uri is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const loginUrl = generateLoginUrl(redirectUri);
      
      await logToSystem('sharekhan-auth', 'Login URL generated', 'INFO', { redirectUri });

      return new Response(
        JSON.stringify({
          loginUrl,
          message: 'Open this URL in browser to authenticate with Sharekhan',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Exchange request_token for access_token
    if (action === 'exchange-token') {
      const body = await req.json();
      const { request_token, user_id } = body;

      if (!request_token) {
        return new Response(
          JSON.stringify({ error: 'request_token is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'user_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Exchanging token for user: ${user_id}`);

      try {
        const tokenResponse = await exchangeToken(request_token);

        if (!tokenResponse.accessToken) {
          await logToSystem('sharekhan-auth', 'Token exchange failed - no access token returned', 'ERROR', {
            response: tokenResponse,
          });
          return new Response(
            JSON.stringify({
              error: 'Token exchange failed',
              details: tokenResponse.message || 'No access token in response',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Store tokens securely
        await storeTokens(
          user_id,
          tokenResponse.accessToken,
          tokenResponse.refreshToken || null,
          tokenResponse.expiresIn || null
        );

        await logToSystem('sharekhan-auth', 'Token exchange successful', 'INFO', { userId: user_id });

        return new Response(
          JSON.stringify({
            status: 'SUCCESS',
            message: 'Sharekhan authentication successful. Tokens stored securely.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Token exchange error:', errorMessage);
        
        await logToSystem('sharekhan-auth', `Token exchange failed: ${errorMessage}`, 'ERROR');

        return new Response(
          JSON.stringify({
            error: 'Token exchange failed',
            details: errorMessage,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Action: Health check
    if (action === 'health') {
      const userId = url.searchParams.get('user_id');

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'user_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return await handleHealthCheck(userId);
    }

    // Action: Get token for internal use (backend only - returns token for edge functions)
    if (action === 'get-token') {
      const userId = url.searchParams.get('user_id');

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'user_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenInfo = await getStoredToken(userId);

      if (!tokenInfo.accessToken || tokenInfo.isExpired) {
        return new Response(
          JSON.stringify({
            status: 'AUTH_REQUIRED',
            accessToken: null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Note: This endpoint should only be called by other edge functions
      return new Response(
        JSON.stringify({
          status: 'AUTH_OK',
          accessToken: tokenInfo.accessToken,
          tokenExpiry: tokenInfo.tokenExpiry,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({
        error: 'Invalid action',
        validActions: ['login-url', 'exchange-token', 'health', 'get-token'],
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sharekhan Auth error:', errorMessage);
    
    await logToSystem('sharekhan-auth', `Unexpected error: ${errorMessage}`, 'ERROR');

    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
