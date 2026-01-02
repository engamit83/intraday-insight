import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const body = await req.json().catch(() => ({}))
    const action = body.action
    const accessToken = body.accessToken
    const apiKey = Deno.env.get("SHAREKHAN_API_KEY")

    if (!action) {
      return new Response(JSON.stringify({ error: "action missing" }), {
        status: 400,
        headers: corsHeaders,
      })
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
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
