// Health check endpoint for testing backend connectivity

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test database connectivity
    const { count, error } = await supabase
      .from('stocks')
      .select('*', { count: 'exact', head: true })
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    // Get table counts
    const tables = ['stocks', 'signals', 'trades', 'watchlist', 'indicator_cache', 'system_logs']
    const tableCounts: Record<string, number> = {}
    
    for (const table of tables) {
      const { count: tableCount } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
      tableCounts[table] = tableCount || 0
    }
    
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        tables: tableCounts,
        version: '1.0.0'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[Health] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
