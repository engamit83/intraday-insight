// Sharekhan Market Data Edge Function
// Primary source for live NSE intraday data with Alpha Vantage fallback

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

interface SharekhanHistoricalResponse {
  status?: string
  message?: string
  data?: Array<{
    time?: string
    timestamp?: string
    open?: number | string
    high?: number | string
    low?: number | string
    close?: number | string
    volume?: number | string
    ltp?: number | string
  }>
  error_type?: string
}

interface TokenCache {
  accessToken: string
  expiresAt: number
}

// In-memory token cache (per-instance)
let tokenCache: TokenCache | null = null

const SHAREKHAN_BASE_URL = 'https://api.sharekhan.com'

// NSE Exchange code for Sharekhan API
const NSE_EXCHANGE = 'NC' // NC = NSE Cash

// Common NSE stock scripcode mappings (expandable)
const SCRIP_CODES: Record<string, number> = {
  'RELIANCE': 2885,
  'TCS': 11536,
  'INFY': 1594,
  'HDFCBANK': 1330,
  'ICICIBANK': 1594,
  'SBIN': 3045,
  'BHARTIARTL': 10604,
  'ITC': 1660,
  'KOTAKBANK': 1922,
  'LT': 11483,
  'AXISBANK': 5900,
  'ASIANPAINT': 236,
  'MARUTI': 10999,
  'TITAN': 3506,
  'WIPRO': 3787,
  'ULTRACEMCO': 11532,
  'NESTLEIND': 17963,
  'BAJFINANCE': 317,
  'HCLTECH': 7229,
  'SUNPHARMA': 3351,
  'TATAMOTORS': 3432,
  'ONGC': 2475,
  'NTPC': 11630,
  'POWERGRID': 14977,
  'COALINDIA': 20374,
  'TATASTEEL': 3499,
  'ADANIENT': 25,
  'ADANIPORTS': 15083,
  'HINDALCO': 1363,
  'JSWSTEEL': 11723,
  'TECHM': 13649,
  'INDUSINDBK': 5258,
  'BAJAJ-AUTO': 16669,
  'BAJAJFINSV': 16573,
  'HDFC': 1244,
  'M&M': 2031,
  'HEROMOTOCO': 1348,
  'BRITANNIA': 547,
  'DIVISLAB': 10940,
  'EICHERMOT': 910,
  'CIPLA': 694,
  'DRREDDY': 881,
  'GRASIM': 1232,
  'APOLLOHOSP': 157,
  'SBILIFE': 21808,
  'HDFCLIFE': 467,
  'BPCL': 526,
  'UPL': 11287,
  'TATACONSUM': 3432,
}

// Helper to get scripcode from symbol
function getScripCode(symbol: string): number | null {
  // Clean symbol - remove exchange suffixes like .NS, .NSE, .BSE
  const cleanSymbol = symbol.replace(/\.(NS|NSE|BSE|BO)$/i, '').toUpperCase()
  return SCRIP_CODES[cleanSymbol] || null
}

// Check if token is valid
function isTokenValid(): boolean {
  if (!tokenCache) return false
  // Token valid if not expired (with 5 min buffer)
  return tokenCache.expiresAt > Date.now() + 5 * 60 * 1000
}

// Fetch market data from Sharekhan
async function fetchSharekhanData(
  symbol: string,
  apiKey: string,
  accessToken: string,
  interval: string = '5min'
): Promise<{ data: OHLCVData[] | null; error: string | null }> {
  
  const scripCode = getScripCode(symbol)
  if (!scripCode) {
    return { data: null, error: `Unknown symbol: ${symbol}. Scripcode mapping not found.` }
  }

  // Map interval to Sharekhan format
  // Sharekhan intervals: 1, 3, 5, 10, 15, 30, 60, D (daily), W (weekly), M (monthly)
  let sharekhanInterval = '5'
  if (interval === '1min') sharekhanInterval = '1'
  else if (interval === '5min') sharekhanInterval = '5'
  else if (interval === '15min') sharekhanInterval = '15'
  else if (interval === '30min') sharekhanInterval = '30'
  else if (interval === '60min' || interval === '1hour') sharekhanInterval = '60'
  else if (interval === '1day' || interval === 'daily') sharekhanInterval = 'D'

  const url = `${SHAREKHAN_BASE_URL}/skapi/services/historical/${NSE_EXCHANGE}/${scripCode}/${sharekhanInterval}`

  console.log(`[Sharekhan] Fetching ${symbol} (scripcode: ${scripCode}) with interval ${sharekhanInterval}`)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
        'access-token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Sharekhan] HTTP ${response.status}: ${errorText}`)
      return { data: null, error: `Sharekhan API error: HTTP ${response.status}` }
    }

    const result: SharekhanHistoricalResponse = await response.json()

    if (result.error_type) {
      console.error(`[Sharekhan] API Error: ${result.message || result.error_type}`)
      return { data: null, error: result.message || result.error_type }
    }

    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
      console.error('[Sharekhan] No historical data in response')
      return { data: null, error: 'No data available from Sharekhan' }
    }

    // Normalize to OHLCV format
    const ohlcvData: OHLCVData[] = result.data.map((candle: any) => ({
      timestamp: candle.time || candle.timestamp || new Date().toISOString(),
      open: parseFloat(String(candle.open || 0)),
      high: parseFloat(String(candle.high || 0)),
      low: parseFloat(String(candle.low || 0)),
      close: parseFloat(String(candle.close || candle.ltp || 0)),
      volume: parseInt(String(candle.volume || 0), 10)
    })).filter(d => d.close > 0) // Filter out invalid data

    // Sort by timestamp descending (newest first)
    ohlcvData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    console.log(`[Sharekhan] Fetched ${ohlcvData.length} candles for ${symbol}`)
    return { data: ohlcvData, error: null }

  } catch (error) {
    console.error('[Sharekhan] Fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { data: null, error: `Sharekhan fetch failed: ${errorMessage}` }
  }
}

// Fallback to Alpha Vantage
async function fetchAlphaVantageFallback(
  symbol: string,
  apiKey: string,
  interval: string = '5min'
): Promise<{ data: OHLCVData[] | null; error: string | null }> {
  
  console.log(`[Fallback] Using Alpha Vantage for ${symbol}`)
  
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&outputsize=compact&apikey=${apiKey}`

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.Note || data['Error Message']) {
      return { data: null, error: data.Note || data['Error Message'] }
    }

    const timeSeriesKey = `Time Series (${interval})`
    const timeSeries = data[timeSeriesKey]

    if (!timeSeries) {
      return { data: null, error: 'No time series data from Alpha Vantage' }
    }

    const ohlcvData: OHLCVData[] = Object.entries(timeSeries).map(([timestamp, values]: [string, any]) => ({
      timestamp,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume'], 10)
    }))

    ohlcvData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    console.log(`[Fallback] Alpha Vantage returned ${ohlcvData.length} data points`)
    return { data: ohlcvData, error: null }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { data: null, error: `Alpha Vantage fallback failed: ${errorMessage}` }
  }
}

// Fetch LTP (Last Traded Price) via WebSocket-style endpoint or quote
async function fetchSharekhanLTP(
  symbols: string[],
  apiKey: string,
  accessToken: string
): Promise<Record<string, { price: number; timestamp: string }>> {
  const results: Record<string, { price: number; timestamp: string }> = {}
  
  // For each symbol, get historical data and extract latest price
  for (const symbol of symbols) {
    const { data, error } = await fetchSharekhanData(symbol, apiKey, accessToken, '1min')
    if (data && data.length > 0) {
      results[symbol] = {
        price: data[0].close,
        timestamp: data[0].timestamp
      }
    }
  }
  
  return results
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get Sharekhan credentials from secrets
    const sharekhanApiKey = Deno.env.get('SHAREKHAN_API_KEY')
    const sharekhanSecretKey = Deno.env.get('SHAREKHAN_API_SECURE_KEY')
    const alphaVantageApiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY')

    // Parse request
    const body = await req.json().catch(() => ({}))
    const { 
      symbol, 
      symbols,
      interval = '5min', 
      action = 'fetch',
      accessToken: providedAccessToken 
    } = body

    // Log request
    console.log(`[Sharekhan] Request: action=${action}, symbol=${symbol || symbols?.join(',')}, interval=${interval}`)

    // Check if we have required credentials
    if (!sharekhanApiKey) {
      // Log and fallback
      console.warn('[Sharekhan] No API key configured, will use fallback')
    }

    // Handle different actions
    if (action === 'fetch' || action === 'historical') {
      // Fetch historical/intraday data for a single symbol
      if (!symbol) {
        return new Response(
          JSON.stringify({ error: 'Symbol is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let result: { data: OHLCVData[] | null; error: string | null } = { data: null, error: null }
      let source = 'unknown'

      // Try Sharekhan first if we have credentials
      if (sharekhanApiKey && providedAccessToken) {
        result = await fetchSharekhanData(symbol, sharekhanApiKey, providedAccessToken, interval)
        source = 'sharekhan'
        
        if (result.error) {
          console.log(`[Sharekhan] Primary source failed: ${result.error}, trying fallback...`)
        }
      } else if (sharekhanApiKey && sharekhanSecretKey) {
        // Note: Full OAuth flow requires browser-based login
        // For now, we'll log that access token is needed
        console.log('[Sharekhan] Access token required for API calls. Use stored token or complete OAuth flow.')
        result = { data: null, error: 'Sharekhan access token required' }
      }

      // Fallback to Alpha Vantage if Sharekhan fails
      if (!result.data && alphaVantageApiKey) {
        result = await fetchAlphaVantageFallback(symbol, alphaVantageApiKey, interval)
        source = 'alpha_vantage'
      }

      if (result.error && !result.data) {
        // Log error
        await supabase.from('system_logs').insert({
          level: 'ERROR',
          source: 'sharekhan-market-data',
          message: `Failed to fetch data for ${symbol}`,
          metadata: { symbol, interval, error: result.error, attemptedSources: [source] }
        })

        return new Response(
          JSON.stringify({ error: result.error, source }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (result.data && result.data.length > 0) {
        const latestPrice = result.data[0].close

        // Update stocks table
        await supabase
          .from('stocks')
          .upsert({
            symbol: symbol.toUpperCase().replace(/\.(NS|NSE|BSE|BO)$/i, ''),
            last_price: latestPrice,
            updated_at: new Date().toISOString()
          }, { onConflict: 'symbol' })

        // Update indicator cache with raw data
        await supabase
          .from('indicator_cache')
          .upsert({
            symbol: symbol.toUpperCase().replace(/\.(NS|NSE|BSE|BO)$/i, ''),
            timeframe: interval,
            raw_data: result.data,
            computed_at: new Date().toISOString()
          }, { onConflict: 'symbol,timeframe' })

        // Log success
        await supabase.from('system_logs').insert({
          level: 'INFO',
          source: 'sharekhan-market-data',
          message: `Fetched ${result.data.length} candles for ${symbol}`,
          metadata: { 
            symbol, 
            interval, 
            source, 
            latestPrice,
            duration: Date.now() - startTime 
          }
        })
      }

      return new Response(
        JSON.stringify({ 
          data: result.data, 
          source,
          latestPrice: result.data?.[0]?.close || null,
          count: result.data?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'batch') {
      // Fetch data for multiple symbols
      const symbolList = symbols || []
      if (symbolList.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Symbols array is required for batch action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const results: Record<string, { data: OHLCVData[] | null; error: string | null; source: string }> = {}

      for (const sym of symbolList) {
        let result: { data: OHLCVData[] | null; error: string | null } = { data: null, error: null }
        let source = 'none'

        // Try Sharekhan first
        if (sharekhanApiKey && providedAccessToken) {
          result = await fetchSharekhanData(sym, sharekhanApiKey, providedAccessToken, interval)
          source = 'sharekhan'
        }

        // Fallback to Alpha Vantage
        if (!result.data && alphaVantageApiKey) {
          result = await fetchAlphaVantageFallback(sym, alphaVantageApiKey, interval)
          source = 'alpha_vantage'
        }

        results[sym] = { ...result, source }

        // Update database if we got data
        if (result.data && result.data.length > 0) {
          const cleanSymbol = sym.toUpperCase().replace(/\.(NS|NSE|BSE|BO)$/i, '')
          
          await supabase.from('stocks').upsert({
            symbol: cleanSymbol,
            last_price: result.data[0].close,
            updated_at: new Date().toISOString()
          }, { onConflict: 'symbol' })

          await supabase.from('indicator_cache').upsert({
            symbol: cleanSymbol,
            timeframe: interval,
            raw_data: result.data,
            computed_at: new Date().toISOString()
          }, { onConflict: 'symbol,timeframe' })
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Log batch completion
      await supabase.from('system_logs').insert({
        level: 'INFO',
        source: 'sharekhan-market-data',
        message: `Batch fetch completed for ${symbolList.length} symbols`,
        metadata: { 
          symbols: symbolList, 
          interval,
          duration: Date.now() - startTime 
        }
      })

      return new Response(
        JSON.stringify({ results, count: symbolList.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'scripcode') {
      // Return scripcode for a symbol (utility)
      if (!symbol) {
        return new Response(
          JSON.stringify({ error: 'Symbol is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const scripCode = getScripCode(symbol)
      return new Response(
        JSON.stringify({ 
          symbol: symbol.toUpperCase().replace(/\.(NS|NSE|BSE|BO)$/i, ''),
          scripCode,
          found: scripCode !== null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (action === 'available_symbols') {
      // Return list of available symbols with scripcodes
      return new Response(
        JSON.stringify({ 
          symbols: Object.keys(SCRIP_CODES),
          count: Object.keys(SCRIP_CODES).length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('[Sharekhan] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
