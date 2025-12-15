// TASK 5: Scheduler Job - Update Prices and Indicators
// Uses Sharekhan as primary data source with Alpha Vantage fallback
// This function is designed to be called on a schedule (every 5 minutes via pg_cron)

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

interface UpdateResult {
  symbol: string
  success: boolean
  source: string
  error?: string
  indicators?: any
}

// NSE Exchange code for Sharekhan API
const NSE_EXCHANGE = 'NC'
const SHAREKHAN_BASE_URL = 'https://api.sharekhan.com'

// Common NSE stock scripcode mappings
const SCRIP_CODES: Record<string, number> = {
  'RELIANCE': 2885, 'TCS': 11536, 'INFY': 1594, 'HDFCBANK': 1330,
  'ICICIBANK': 1594, 'SBIN': 3045, 'BHARTIARTL': 10604, 'ITC': 1660,
  'KOTAKBANK': 1922, 'LT': 11483, 'AXISBANK': 5900, 'ASIANPAINT': 236,
  'MARUTI': 10999, 'TITAN': 3506, 'WIPRO': 3787, 'ULTRACEMCO': 11532,
  'NESTLEIND': 17963, 'BAJFINANCE': 317, 'HCLTECH': 7229, 'SUNPHARMA': 3351,
  'TATAMOTORS': 3432, 'ONGC': 2475, 'NTPC': 11630, 'POWERGRID': 14977,
  'COALINDIA': 20374, 'TATASTEEL': 3499, 'ADANIENT': 25, 'ADANIPORTS': 15083,
  'HINDALCO': 1363, 'JSWSTEEL': 11723, 'TECHM': 13649, 'INDUSINDBK': 5258,
  'BAJAJ-AUTO': 16669, 'BAJAJFINSV': 16573, 'HDFC': 1244, 'M&M': 2031,
  'HEROMOTOCO': 1348, 'BRITANNIA': 547, 'DIVISLAB': 10940, 'EICHERMOT': 910,
  'CIPLA': 694, 'DRREDDY': 881, 'GRASIM': 1232, 'APOLLOHOSP': 157,
  'SBILIFE': 21808, 'HDFCLIFE': 467, 'BPCL': 526, 'UPL': 11287,
  'TATACONSUM': 3432
}

function getScripCode(symbol: string): number | null {
  const cleanSymbol = symbol.replace(/\.(NS|NSE|BSE|BO)$/i, '').toUpperCase()
  return SCRIP_CODES[cleanSymbol] || null
}

function cleanSymbol(symbol: string): string {
  return symbol.replace(/\.(NS|NSE|BSE|BO)$/i, '').toUpperCase()
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Fetch from Sharekhan API
async function fetchFromSharekhan(
  symbol: string,
  apiKey: string,
  accessToken: string
): Promise<{ data: OHLCVData[] | null; error: string | null }> {
  const scripCode = getScripCode(symbol)
  if (!scripCode) {
    return { data: null, error: `Unknown scripcode for ${symbol}` }
  }

  const url = `${SHAREKHAN_BASE_URL}/skapi/services/historical/${NSE_EXCHANGE}/${scripCode}/5`

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
      return { data: null, error: `Sharekhan HTTP ${response.status}` }
    }

    const result = await response.json()

    if (result.error_type || !result.data || !Array.isArray(result.data)) {
      return { data: null, error: result.message || 'No data from Sharekhan' }
    }

    const ohlcvData: OHLCVData[] = result.data.map((c: any) => ({
      timestamp: c.time || c.timestamp || new Date().toISOString(),
      open: parseFloat(String(c.open || 0)),
      high: parseFloat(String(c.high || 0)),
      low: parseFloat(String(c.low || 0)),
      close: parseFloat(String(c.close || c.ltp || 0)),
      volume: parseInt(String(c.volume || 0), 10)
    })).filter((d: OHLCVData) => d.close > 0)

    ohlcvData.sort((a: OHLCVData, b: OHLCVData) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return { data: ohlcvData, error: null }

  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Sharekhan fetch failed' }
  }
}

// Fallback to Alpha Vantage
async function fetchFromAlphaVantage(
  symbol: string,
  apiKey: string
): Promise<{ data: OHLCVData[] | null; error: string | null }> {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&outputsize=compact&apikey=${apiKey}`

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.Note || data['Error Message']) {
      return { data: null, error: data.Note || data['Error Message'] }
    }

    const timeSeries = data['Time Series (5min)']
    if (!timeSeries) {
      return { data: null, error: 'No time series data' }
    }

    const ohlcvData: OHLCVData[] = Object.entries(timeSeries).map(([ts, v]: [string, any]) => ({
      timestamp: ts,
      open: parseFloat(v['1. open']),
      high: parseFloat(v['2. high']),
      low: parseFloat(v['3. low']),
      close: parseFloat(v['4. close']),
      volume: parseInt(v['5. volume'], 10)
    }))

    ohlcvData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return { data: ohlcvData, error: null }

  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Alpha Vantage failed' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  const results: UpdateResult[] = []

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get API keys from environment
    const sharekhanApiKey = Deno.env.get('SHAREKHAN_API_KEY')
    const sharekhanSecretKey = Deno.env.get('SHAREKHAN_API_SECURE_KEY')
    const alphaVantageApiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY')

    // Get access token from request body (for Sharekhan)
    const body = await req.json().catch(() => ({}))
    const accessToken = body.accessToken || body.sharekhanAccessToken

    console.log('[Scheduler] Starting market data update job')
    console.log(`[Scheduler] Data sources: Sharekhan=${!!sharekhanApiKey && !!accessToken}, AlphaVantage=${!!alphaVantageApiKey}`)

    // Get all unique symbols from watchlist and active signals
    const { data: watchlistItems } = await supabase.from('watchlist').select('symbol')
    const { data: activeSignals } = await supabase.from('signals').select('symbol').eq('is_active', true)

    const symbolSet = new Set<string>()
    if (watchlistItems) watchlistItems.forEach(item => symbolSet.add(cleanSymbol(item.symbol)))
    if (activeSignals) activeSignals.forEach(signal => symbolSet.add(cleanSymbol(signal.symbol)))

    // Add default NSE stocks if watchlist is empty
    if (symbolSet.size === 0) {
      ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'].forEach(s => symbolSet.add(s))
    }

    const symbols = Array.from(symbolSet)
    console.log(`[Scheduler] Processing ${symbols.length} symbols: ${symbols.join(', ')}`)

    for (const symbol of symbols) {
      let ohlcvData: OHLCVData[] | null = null
      let source = 'none'
      let error: string | null = null

      // Try Sharekhan first (primary source)
      if (sharekhanApiKey && accessToken) {
        const sharekhanResult = await fetchFromSharekhan(symbol, sharekhanApiKey, accessToken)
        if (sharekhanResult.data) {
          ohlcvData = sharekhanResult.data
          source = 'sharekhan'
          console.log(`[Scheduler] ${symbol}: Got ${ohlcvData.length} candles from Sharekhan`)
        } else {
          console.log(`[Scheduler] ${symbol}: Sharekhan failed - ${sharekhanResult.error}`)
          error = sharekhanResult.error
        }
      }

      // Fallback to Alpha Vantage if Sharekhan failed
      if (!ohlcvData && alphaVantageApiKey) {
        // For Alpha Vantage, we need exchange suffix
        const avSymbol = `${symbol}.NS`
        const avResult = await fetchFromAlphaVantage(avSymbol, alphaVantageApiKey)
        if (avResult.data) {
          ohlcvData = avResult.data
          source = 'alpha_vantage'
          console.log(`[Scheduler] ${symbol}: Got ${ohlcvData.length} candles from Alpha Vantage (fallback)`)
        } else {
          console.log(`[Scheduler] ${symbol}: Alpha Vantage fallback failed - ${avResult.error}`)
          error = avResult.error || error
        }
      }

      if (ohlcvData && ohlcvData.length > 0) {
        const latestPrice = ohlcvData[0].close

        // Update stocks table
        await supabase.from('stocks').upsert({
          symbol: symbol,
          last_price: latestPrice,
          updated_at: new Date().toISOString()
        }, { onConflict: 'symbol' })

        // Compute indicators
        const indicators = computeIndicators(ohlcvData)

        // Store in indicator cache
        await supabase.from('indicator_cache').upsert({
          symbol: symbol,
          timeframe: '5min',
          vwap: indicators.vwap,
          rsi: indicators.rsi,
          macd: indicators.macd,
          macd_signal: indicators.macdSignal,
          macd_histogram: indicators.macdHistogram,
          atr: indicators.atr,
          relative_volume: indicators.relativeVolume,
          trend_strength: indicators.trendStrength,
          pattern_detected: indicators.patternDetected,
          raw_data: ohlcvData,
          computed_at: new Date().toISOString()
        }, { onConflict: 'symbol,timeframe' })

        results.push({
          symbol,
          success: true,
          source,
          indicators: { price: latestPrice, vwap: indicators.vwap, rsi: indicators.rsi, trend: indicators.trendStrength }
        })

        console.log(`[Scheduler] ${symbol}: Updated price=${latestPrice}, RSI=${indicators.rsi}, source=${source}`)
      } else {
        results.push({ symbol, success: false, source: 'none', error: error || 'No data available' })

        await supabase.from('system_logs').insert({
          level: 'WARN',
          source: 'update-market-data',
          message: `Failed to update ${symbol}`,
          metadata: { symbol, error }
        })
      }

      // Small delay between symbols
      await delay(300)
    }

    const duration = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    const sharekhanCount = results.filter(r => r.source === 'sharekhan').length
    const alphaCount = results.filter(r => r.source === 'alpha_vantage').length

    // Log job completion
    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'update-market-data',
      message: `Job completed: ${successCount}/${symbols.length} symbols (Sharekhan: ${sharekhanCount}, AlphaVantage: ${alphaCount})`,
      metadata: { duration, totalSymbols: symbols.length, successCount, sharekhanCount, alphaCount }
    })

    console.log(`[Scheduler] Job completed: ${successCount}/${symbols.length} symbols in ${duration}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: symbols.length,
        successful: successCount,
        sources: { sharekhan: sharekhanCount, alpha_vantage: alphaCount },
        duration: `${duration}ms`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Scheduler] Fatal error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return new Response(
      JSON.stringify({ error: errorMessage, results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Inline indicator computation
function computeIndicators(data: any[]) {
  let cumulativeTPV = 0, cumulativeVolume = 0
  for (const c of data) {
    const tp = (c.high + c.low + c.close) / 3
    cumulativeTPV += tp * c.volume
    cumulativeVolume += c.volume
  }
  const vwap = cumulativeVolume > 0 ? Math.round((cumulativeTPV / cumulativeVolume) * 100) / 100 : null

  let rsi = null
  if (data.length >= 15) {
    const sorted = [...data].reverse()
    let gains = 0, losses = 0
    for (let i = 1; i <= 14; i++) {
      const change = sorted[i].close - sorted[i - 1].close
      if (change > 0) gains += change; else losses += Math.abs(change)
    }
    const avgGain = gains / 14, avgLoss = losses / 14
    rsi = avgLoss > 0 ? Math.round((100 - (100 / (1 + avgGain / avgLoss))) * 100) / 100 : 100
  }

  let atr = null
  if (data.length >= 15) {
    const sorted = [...data].reverse()
    const trs: number[] = []
    for (let i = 1; i < sorted.length && i <= 14; i++) {
      const c = sorted[i], p = sorted[i - 1]
      trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
    }
    if (trs.length >= 14) atr = Math.round((trs.reduce((a, b) => a + b, 0) / 14) * 10000) / 10000
  }

  let relativeVolume = null
  if (data.length >= 21) {
    const avgVol = data.slice(1, 21).reduce((a, b) => a + b.volume, 0) / 20
    if (avgVol > 0) relativeVolume = Math.round((data[0].volume / avgVol) * 100) / 100
  }

  let trendStrength = null
  if (data.length >= 20) {
    const closes = [...data].reverse().map(d => d.close)
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
    const curr = closes[closes.length - 1]
    const change = (curr - closes[closes.length - 10]) / closes[closes.length - 10]
    trendStrength = Math.round(Math.min(100, Math.abs(change) * 200) * (curr > sma20 ? 1 : -1) * 100) / 100
  }

  let patternDetected = null
  if (data.length >= 2) {
    const c = data[0], p = data[1]
    const body = Math.abs(c.close - c.open)
    const upper = c.high - Math.max(c.open, c.close)
    const lower = Math.min(c.open, c.close) - c.low
    if (lower >= body * 2 && upper <= body * 0.5 && c.close > c.open) patternDetected = 'HAMMER'
    else if (upper >= body * 2 && lower <= body * 0.5 && c.close < c.open) patternDetected = 'SHOOTING_STAR'
    else if (p.close < p.open && c.close > c.open && c.open < p.close && c.close > p.open) patternDetected = 'BULLISH_ENGULFING'
    else if (p.close > p.open && c.close < c.open && c.open > p.close && c.close < p.open) patternDetected = 'BEARISH_ENGULFING'
  }

  return { vwap, rsi, macd: null, macdSignal: null, macdHistogram: null, atr, relativeVolume, trendStrength, patternDetected }
}
