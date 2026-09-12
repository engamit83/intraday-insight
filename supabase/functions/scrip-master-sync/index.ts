// Scrip Master Sync - Requires authenticated access
// Syncs Sharekhan master list to scripcodes table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

// Allowed actions
const ALLOWED_ACTIONS = ['sync_master'];

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Admin-only function: syncing the master list rewrites the shared scripcodes
    // table and triggers expensive broker API calls, so only internal
    // (service-role) callers may invoke it.
    const authHeader = req.headers.get('authorization') ?? ''
    const bearerToken = authHeader.replace('Bearer ', '')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const isServiceRole = bearerToken.length > 0 && bearerToken === serviceRoleKey

    if (!isServiceRole) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: this action is restricted to internal jobs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const body = await req.json().catch(() => ({}))
    const action = body.action
    const accessToken = body.accessToken
    const apiKey = Deno.env.get("SHAREKHAN_API_KEY")

    // Validate action
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Allowed: ${ALLOWED_ACTIONS.join(', ')}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (action === "sync_master") {
      if (!apiKey || !accessToken) {
        return new Response(
          JSON.stringify({ error: "Sharekhan API key or access token missing" }),
          { status: 400, headers: corsHeaders }
        )
      }

      console.log("Starting Sharekhan Master Sync...")

      const response = await fetch(
        "https://api.sharekhan.com/skapi/services/master/NC",
        {
          headers: {
            "api-key": apiKey,
            "access-token": accessToken,
          },
        }
      )

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: "Could not fetch Sharekhan master list" }),
          { status: 500, headers: corsHeaders }
        )
      }

      const result = await response.json()
      const list = result.data || []

      const total = list.length
      let processed = 0

      for (let i = 0; i < total; i += 50) {
        const chunk = list.slice(i, i + 50).map((item: { tradingSymbol: string; scripCode: number }) => ({
          symbol: item.tradingSymbol,
          scrip_code: item.scripCode,
          exchange: "NC",
          updated_at: new Date().toISOString(),
        }))

        const { error } = await supabase
          .from("scripcodes")
          .upsert(chunk, { onConflict: "symbol" })

        if (error) console.error("Chunk error:", error)
        processed += chunk.length

        await new Promise((r) => setTimeout(r, 120))
      }

      return new Response(
        JSON.stringify({
          message: "Master Sync Complete",
          total,
          processed,
        }),
        { headers: corsHeaders }
      )
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: corsHeaders,
    })

  } catch (err) {
    console.error('[scrip-master-sync] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
