// TASK 3: Alpha Vantage Integration Edge Function
// Fetches intraday stock data with rate limiting and caching

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OHLCVData {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface AlphaVantageResponse {
  'Meta Data'?: {
    '1. Information': string
    '2. Symbol': string
    '3. Last Refreshed': string
    '4. Interval': string
    '5. Output Size': string
    '6. Time Zone': string
  }
  'Time Series (1min)'?: Record<string, {
    '1. open': string
    '2. high': string
    '3. low': string
    '4. close': string
    '5. volume': string
  }>
  'Time Series (5min)'?: Record<string, {
    '1. open': string
    '2. high': string
    '3. low': string
    '4. close': string
    '5. volume': string
  }>
  Note?: string
  'Error Message'?: string
}

// Rate limit tracking (Alpha Vantage: 5 calls/min, 500/day on free tier)
const rateLimitCache: Map<string, { count: number; resetTime: number }> = new Map()

function checkRateLimit(): boolean {
  const now = Date.now()
  const key = 'alpha_vantage'
  const limit = rateLimitCache.get(key)
  
  if (!limit || now > limit.resetTime) {
    rateLimitCache.set(key, { count: 1, resetTime: now + 60000 }) // Reset every minute
    return true
  }
  
  if (limit.count >= 5) {
    return false
  }
  
  limit.count++
  return true
}

function normalizeOHLCV(rawData: Record<string, any>): OHLCVData[] {
  const normalized: OHLCVData[] = []
  
  for (const [timestamp, values] of Object.entries(rawData)) {
    normalized.push({
      timestamp,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume'], 10),
    })
  }
  
  // Sort by timestamp descending (newest first)
  normalized.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  
  return normalized
}

async function fetchIntraday(
  symbol: string,
  apiKey: string,
  interval: '1min' | '5min' = '5min'
): Promise<{ data: OHLCVData[] | null; error: string | null; cached: boolean }> {
  
  if (!checkRateLimit()) {
    return { data: null, error: 'Rate limit exceeded. Please wait 60 seconds.', cached: false }
  }
  
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&outputsize=compact&apikey=${apiKey}`
  
  console.log(`[Alpha Vantage] Fetching ${symbol} with interval ${interval}`)
  
  try {
    const response = await fetch(url)
    const data: AlphaVantageResponse = await response.json()
    
    // Check for API errors
    if (data.Note) {
      console.error('[Alpha Vantage] API Note:', data.Note)
      return { data: null, error: 'API rate limit reached. Please try again later.', cached: false }
    }
    
    if (data['Error Message']) {
      console.error('[Alpha Vantage] Error:', data['Error Message'])
      return { data: null, error: data['Error Message'], cached: false }
    }
    
    // Get time series data based on interval
    const timeSeriesKey = interval === '1min' ? 'Time Series (1min)' : 'Time Series (5min)'
    const timeSeries = data[timeSeriesKey]
    
    if (!timeSeries) {
      console.error('[Alpha Vantage] No time series data found')
      return { data: null, error: 'No data available for this symbol', cached: false }
    }
    
    const normalizedData = normalizeOHLCV(timeSeries)
    console.log(`[Alpha Vantage] Fetched ${normalizedData.length} data points for ${symbol}`)
    
    return { data: normalizedData, error: null, cached: false }
  } catch (error) {
    console.error('[Alpha Vantage] Fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { data: null, error: `Failed to fetch data: ${errorMessage}`, cached: false }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { symbol, interval = '5min', apiKey } = await req.json()
    
    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Get API key from request or fall back to stored settings
    let alphaVantageApiKey = apiKey
    
    if (!alphaVantageApiKey) {
      // Try to get from environment (for scheduled jobs)
      alphaVantageApiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY')
    }
    
    if (!alphaVantageApiKey) {
      return new Response(
        JSON.stringify({ error: 'Alpha Vantage API key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check cache first (data less than 5 minutes old)
    const { data: cachedData } = await supabase
      .from('indicator_cache')
      .select('raw_data, computed_at')
      .eq('symbol', symbol.toUpperCase())
      .eq('timeframe', interval)
      .maybeSingle()
    
    if (cachedData && cachedData.raw_data) {
      const cacheAge = Date.now() - new Date(cachedData.computed_at).getTime()
      if (cacheAge < 5 * 60 * 1000) { // 5 minutes
        console.log(`[Alpha Vantage] Using cached data for ${symbol}`)
        return new Response(
          JSON.stringify({ 
            data: cachedData.raw_data, 
            cached: true,
            cacheAge: Math.round(cacheAge / 1000)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    // Fetch fresh data
    const result = await fetchIntraday(symbol.toUpperCase(), alphaVantageApiKey, interval)
    
    if (result.error) {
      // Log error
      await supabase.from('system_logs').insert({
        level: 'ERROR',
        source: 'alpha-vantage',
        message: result.error,
        metadata: { symbol, interval }
      })
      
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (result.data && result.data.length > 0) {
      // Update stocks table with latest price
      const latestPrice = result.data[0].close
      await supabase
        .from('stocks')
        .upsert({
          symbol: symbol.toUpperCase(),
          last_price: latestPrice,
          updated_at: new Date().toISOString()
        }, { onConflict: 'symbol' })
      
      // Update cache
      await supabase
        .from('indicator_cache')
        .upsert({
          symbol: symbol.toUpperCase(),
          timeframe: interval,
          raw_data: result.data,
          computed_at: new Date().toISOString()
        }, { onConflict: 'symbol,timeframe' })
      
      // Log success
      await supabase.from('system_logs').insert({
        level: 'INFO',
        source: 'alpha-vantage',
        message: `Fetched ${result.data.length} data points`,
        metadata: { symbol, interval, latestPrice }
      })
    }
    
    return new Response(
      JSON.stringify({ data: result.data, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[Alpha Vantage] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
