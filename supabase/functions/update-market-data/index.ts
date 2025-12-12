// TASK 5: Scheduler Job - Update Prices and Indicators
// This function is designed to be called on a schedule (every 5 minutes via pg_cron)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WatchlistItem {
  symbol: string
  company_name?: string
}

interface UpdateResult {
  symbol: string
  success: boolean
  error?: string
  indicators?: any
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const startTime = Date.now()
  const results: UpdateResult[] = []
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get API key from request body or environment
    const body = await req.json().catch(() => ({}))
    const apiKey = body.apiKey || Deno.env.get('ALPHA_VANTAGE_API_KEY')
    
    if (!apiKey) {
      await supabase.from('system_logs').insert({
        level: 'ERROR',
        source: 'update-market-data',
        message: 'No Alpha Vantage API key configured',
        metadata: {}
      })
      
      return new Response(
        JSON.stringify({ error: 'Alpha Vantage API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('[Scheduler] Starting market data update job')
    
    // Get all unique symbols from watchlist and active signals
    const { data: watchlistItems } = await supabase
      .from('watchlist')
      .select('symbol')
    
    const { data: activeSignals } = await supabase
      .from('signals')
      .select('symbol')
      .eq('is_active', true)
    
    // Get unique symbols
    const symbolSet = new Set<string>()
    
    if (watchlistItems) {
      watchlistItems.forEach(item => symbolSet.add(item.symbol.toUpperCase()))
    }
    
    if (activeSignals) {
      activeSignals.forEach(signal => symbolSet.add(signal.symbol.toUpperCase()))
    }
    
    // Add some default stocks if watchlist is empty
    if (symbolSet.size === 0) {
      const defaultStocks = ['RELIANCE.BSE', 'TCS.BSE', 'INFY.BSE', 'HDFCBANK.BSE', 'ICICIBANK.BSE']
      defaultStocks.forEach(s => symbolSet.add(s))
    }
    
    const symbols = Array.from(symbolSet)
    console.log(`[Scheduler] Processing ${symbols.length} symbols: ${symbols.join(', ')}`)
    
    // Process symbols with rate limiting (max 5 per minute for free tier)
    const batchSize = 5
    const delayBetweenBatches = 61000 // 61 seconds to ensure rate limit reset
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      
      console.log(`[Scheduler] Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.join(', ')}`)
      
      for (const symbol of batch) {
        try {
          // Fetch data from Alpha Vantage
          const alphaVantageUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&outputsize=compact&apikey=${apiKey}`
          
          const response = await fetch(alphaVantageUrl)
          const data = await response.json()
          
          if (data.Note || data['Error Message']) {
            throw new Error(data.Note || data['Error Message'])
          }
          
          const timeSeries = data['Time Series (5min)']
          if (!timeSeries) {
            throw new Error('No time series data available')
          }
          
          // Normalize OHLCV data
          const ohlcvData = Object.entries(timeSeries).map(([timestamp, values]: [string, any]) => ({
            timestamp,
            open: parseFloat(values['1. open']),
            high: parseFloat(values['2. high']),
            low: parseFloat(values['3. low']),
            close: parseFloat(values['4. close']),
            volume: parseInt(values['5. volume'], 10)
          })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          
          const latestPrice = ohlcvData[0].close
          
          // Update stocks table
          await supabase
            .from('stocks')
            .upsert({
              symbol: symbol,
              last_price: latestPrice,
              updated_at: new Date().toISOString()
            }, { onConflict: 'symbol' })
          
          // Compute indicators inline (simplified version)
          const indicators = computeIndicators(ohlcvData)
          
          // Store in indicator cache
          await supabase
            .from('indicator_cache')
            .upsert({
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
            indicators: {
              price: latestPrice,
              vwap: indicators.vwap,
              rsi: indicators.rsi,
              trend: indicators.trendStrength
            }
          })
          
          console.log(`[Scheduler] Updated ${symbol}: price=${latestPrice}, RSI=${indicators.rsi}`)
          
          // Small delay between individual requests
          await delay(1000)
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(`[Scheduler] Error processing ${symbol}:`, errorMessage)
          
          results.push({
            symbol,
            success: false,
            error: errorMessage
          })
          
          // Log error
          await supabase.from('system_logs').insert({
            level: 'ERROR',
            source: 'update-market-data',
            message: `Failed to update ${symbol}`,
            metadata: { symbol, error: errorMessage }
          })
        }
      }
      
      // Wait between batches if more symbols to process
      if (i + batchSize < symbols.length) {
        console.log(`[Scheduler] Waiting ${delayBetweenBatches / 1000}s before next batch...`)
        await delay(delayBetweenBatches)
      }
    }
    
    const duration = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    
    // Log job completion
    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'update-market-data',
      message: `Job completed: ${successCount}/${symbols.length} symbols updated in ${duration}ms`,
      metadata: { 
        duration,
        totalSymbols: symbols.length,
        successCount,
        failedCount: symbols.length - successCount
      }
    })
    
    console.log(`[Scheduler] Job completed: ${successCount}/${symbols.length} symbols in ${duration}ms`)
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: symbols.length,
        successful: successCount,
        failed: symbols.length - successCount,
        duration: `${duration}ms`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[Scheduler] Fatal error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        results
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Inline indicator computation (simplified version from indicators function)
function computeIndicators(data: any[]) {
  // VWAP
  let cumulativeTPV = 0
  let cumulativeVolume = 0
  for (const candle of data) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3
    cumulativeTPV += typicalPrice * candle.volume
    cumulativeVolume += candle.volume
  }
  const vwap = cumulativeVolume > 0 ? Math.round((cumulativeTPV / cumulativeVolume) * 100) / 100 : null
  
  // RSI (14 period)
  let rsi = null
  if (data.length >= 15) {
    const sortedData = [...data].reverse()
    let gains = 0
    let losses = 0
    for (let i = 1; i <= 14; i++) {
      const change = sortedData[i].close - sortedData[i - 1].close
      if (change > 0) gains += change
      else losses += Math.abs(change)
    }
    const avgGain = gains / 14
    const avgLoss = losses / 14
    if (avgLoss > 0) {
      const rs = avgGain / avgLoss
      rsi = Math.round((100 - (100 / (1 + rs))) * 100) / 100
    } else {
      rsi = 100
    }
  }
  
  // Simplified MACD
  let macd = null
  let macdSignal = null
  let macdHistogram = null
  
  // ATR (14 period)
  let atr = null
  if (data.length >= 15) {
    const sortedData = [...data].reverse()
    const trueRanges: number[] = []
    for (let i = 1; i < sortedData.length && i <= 14; i++) {
      const current = sortedData[i]
      const previous = sortedData[i - 1]
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      )
      trueRanges.push(tr)
    }
    if (trueRanges.length >= 14) {
      atr = Math.round((trueRanges.reduce((a, b) => a + b, 0) / 14) * 10000) / 10000
    }
  }
  
  // Relative Volume
  let relativeVolume = null
  if (data.length >= 21) {
    const currentVolume = data[0].volume
    const avgVolume = data.slice(1, 21).reduce((a, b) => a + b.volume, 0) / 20
    if (avgVolume > 0) {
      relativeVolume = Math.round((currentVolume / avgVolume) * 100) / 100
    }
  }
  
  // Trend Strength
  let trendStrength = null
  if (data.length >= 20) {
    const closes = [...data].reverse().map(d => d.close)
    const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
    const currentPrice = closes[closes.length - 1]
    const priceChange = (currentPrice - closes[closes.length - 10]) / closes[closes.length - 10]
    const trendDirection = currentPrice > sma20 ? 1 : -1
    const momentum = Math.abs(priceChange) * 100
    trendStrength = Math.round(Math.min(100, momentum * 2) * trendDirection * 100) / 100
  }
  
  // Pattern Detection
  let patternDetected = null
  if (data.length >= 2) {
    const current = data[0]
    const previous = data[1]
    const bodySize = Math.abs(current.close - current.open)
    const upperWick = current.high - Math.max(current.open, current.close)
    const lowerWick = Math.min(current.open, current.close) - current.low
    
    if (lowerWick >= bodySize * 2 && upperWick <= bodySize * 0.5 && current.close > current.open) {
      patternDetected = 'HAMMER'
    } else if (upperWick >= bodySize * 2 && lowerWick <= bodySize * 0.5 && current.close < current.open) {
      patternDetected = 'SHOOTING_STAR'
    } else if (
      previous.close < previous.open &&
      current.close > current.open &&
      current.open < previous.close &&
      current.close > previous.open
    ) {
      patternDetected = 'BULLISH_ENGULFING'
    } else if (
      previous.close > previous.open &&
      current.close < current.open &&
      current.open > previous.close &&
      current.close < previous.open
    ) {
      patternDetected = 'BEARISH_ENGULFING'
    }
  }
  
  return {
    vwap,
    rsi,
    macd,
    macdSignal,
    macdHistogram,
    atr,
    relativeVolume,
    trendStrength,
    patternDetected
  }
}
