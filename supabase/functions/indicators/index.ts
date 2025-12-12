// TASK 4: Indicator Engine Edge Function
// Computes technical indicators: VWAP, RSI, MACD, ATR, Volume patterns, Candle patterns

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

interface IndicatorResult {
  vwap: number | null
  rsi: number | null
  macd: number | null
  macdSignal: number | null
  macdHistogram: number | null
  atr: number | null
  relativeVolume: number | null
  trendStrength: number | null
  patternDetected: string | null
}

// Calculate VWAP (Volume Weighted Average Price)
function calculateVWAP(data: OHLCVData[]): number | null {
  if (data.length === 0) return null
  
  let cumulativeTPV = 0 // Typical Price * Volume
  let cumulativeVolume = 0
  
  for (const candle of data) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3
    cumulativeTPV += typicalPrice * candle.volume
    cumulativeVolume += candle.volume
  }
  
  if (cumulativeVolume === 0) return null
  return Math.round((cumulativeTPV / cumulativeVolume) * 100) / 100
}

// Calculate RSI (Relative Strength Index) - 14 period default
function calculateRSI(data: OHLCVData[], period: number = 14): number | null {
  if (data.length < period + 1) return null
  
  // Need data in chronological order for RSI
  const sortedData = [...data].reverse()
  
  let gains = 0
  let losses = 0
  
  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = sortedData[i].close - sortedData[i - 1].close
    if (change > 0) {
      gains += change
    } else {
      losses += Math.abs(change)
    }
  }
  
  let avgGain = gains / period
  let avgLoss = losses / period
  
  // Calculate smoothed RSI using remaining data
  for (let i = period + 1; i < sortedData.length; i++) {
    const change = sortedData[i].close - sortedData[i - 1].close
    const currentGain = change > 0 ? change : 0
    const currentLoss = change < 0 ? Math.abs(change) : 0
    
    avgGain = (avgGain * (period - 1) + currentGain) / period
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period
  }
  
  if (avgLoss === 0) return 100
  
  const rs = avgGain / avgLoss
  const rsi = 100 - (100 / (1 + rs))
  
  return Math.round(rsi * 100) / 100
}

// Calculate EMA (Exponential Moving Average)
function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = []
  const multiplier = 2 / (period + 1)
  
  // Start with SMA for first EMA value
  let sum = 0
  for (let i = 0; i < period && i < prices.length; i++) {
    sum += prices[i]
  }
  ema.push(sum / Math.min(period, prices.length))
  
  // Calculate remaining EMA values
  for (let i = period; i < prices.length; i++) {
    const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]
    ema.push(currentEMA)
  }
  
  return ema
}

// Calculate MACD (12/26/9)
function calculateMACD(data: OHLCVData[]): { macd: number | null; signal: number | null; histogram: number | null } {
  if (data.length < 26) return { macd: null, signal: null, histogram: null }
  
  // Get closing prices in chronological order
  const closes = [...data].reverse().map(d => d.close)
  
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  
  // MACD line = EMA12 - EMA26
  const macdLine: number[] = []
  const startIdx = ema26.length - ema12.length
  
  for (let i = 0; i < ema26.length; i++) {
    if (i >= startIdx) {
      macdLine.push(ema12[i - startIdx] - ema26[i])
    }
  }
  
  if (macdLine.length < 9) return { macd: null, signal: null, histogram: null }
  
  // Signal line = 9-period EMA of MACD line
  const signalLine = calculateEMA(macdLine, 9)
  
  const latestMACD = macdLine[macdLine.length - 1]
  const latestSignal = signalLine[signalLine.length - 1]
  const histogram = latestMACD - latestSignal
  
  return {
    macd: Math.round(latestMACD * 1000000) / 1000000,
    signal: Math.round(latestSignal * 1000000) / 1000000,
    histogram: Math.round(histogram * 1000000) / 1000000
  }
}

// Calculate ATR (Average True Range) - 14 period default
function calculateATR(data: OHLCVData[], period: number = 14): number | null {
  if (data.length < period + 1) return null
  
  // Need data in chronological order
  const sortedData = [...data].reverse()
  
  const trueRanges: number[] = []
  
  for (let i = 1; i < sortedData.length; i++) {
    const current = sortedData[i]
    const previous = sortedData[i - 1]
    
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    )
    trueRanges.push(tr)
  }
  
  if (trueRanges.length < period) return null
  
  // Calculate initial ATR as simple average
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  // Smooth ATR using Wilder's method
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period
  }
  
  return Math.round(atr * 10000) / 10000
}

// Calculate Relative Volume (current volume vs average)
function calculateRelativeVolume(data: OHLCVData[], period: number = 20): number | null {
  if (data.length < period) return null
  
  const currentVolume = data[0].volume
  const avgVolume = data.slice(1, period + 1).reduce((a, b) => a + b.volume, 0) / period
  
  if (avgVolume === 0) return null
  
  return Math.round((currentVolume / avgVolume) * 100) / 100
}

// Calculate Trend Strength (0-100)
function calculateTrendStrength(data: OHLCVData[]): number | null {
  if (data.length < 20) return null
  
  // Get closing prices in chronological order
  const closes = [...data].reverse().map(d => d.close)
  
  // Calculate 20-period SMA
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const currentPrice = closes[closes.length - 1]
  
  // Calculate price momentum
  const priceChange = (currentPrice - closes[closes.length - 10]) / closes[closes.length - 10]
  
  // Count bullish vs bearish candles
  let bullishCount = 0
  for (let i = Math.max(0, data.length - 10); i < data.length; i++) {
    if (data[i].close > data[i].open) bullishCount++
  }
  
  // Combine factors
  const trendDirection = currentPrice > sma20 ? 1 : -1
  const momentum = Math.abs(priceChange) * 100
  const consistency = (bullishCount / 10) * 100
  
  // Weighted score (0-100)
  const strength = Math.min(100, Math.abs(momentum * 2 + consistency * 0.5))
  
  return Math.round(strength * trendDirection * 100) / 100
}

// Detect candle patterns
function detectCandlePattern(data: OHLCVData[]): string | null {
  if (data.length < 3) return null
  
  const current = data[0]
  const previous = data[1]
  
  const bodySize = Math.abs(current.close - current.open)
  const upperWick = current.high - Math.max(current.open, current.close)
  const lowerWick = Math.min(current.open, current.close) - current.low
  const range = current.high - current.low
  
  // Hammer pattern (bullish reversal)
  if (
    lowerWick >= bodySize * 2 &&
    upperWick <= bodySize * 0.5 &&
    current.close > current.open
  ) {
    return 'HAMMER'
  }
  
  // Inverted Hammer (bullish)
  if (
    upperWick >= bodySize * 2 &&
    lowerWick <= bodySize * 0.5 &&
    current.close > current.open
  ) {
    return 'INVERTED_HAMMER'
  }
  
  // Shooting Star (bearish reversal)
  if (
    upperWick >= bodySize * 2 &&
    lowerWick <= bodySize * 0.5 &&
    current.close < current.open
  ) {
    return 'SHOOTING_STAR'
  }
  
  // Bullish Engulfing
  if (
    previous.close < previous.open && // Previous is bearish
    current.close > current.open && // Current is bullish
    current.open < previous.close && // Opens below previous close
    current.close > previous.open // Closes above previous open
  ) {
    return 'BULLISH_ENGULFING'
  }
  
  // Bearish Engulfing
  if (
    previous.close > previous.open && // Previous is bullish
    current.close < current.open && // Current is bearish
    current.open > previous.close && // Opens above previous close
    current.close < previous.open // Closes below previous open
  ) {
    return 'BEARISH_ENGULFING'
  }
  
  // Doji (indecision)
  if (bodySize / range < 0.1) {
    return 'DOJI'
  }
  
  return null
}

// Main indicator calculation function
function computeAllIndicators(data: OHLCVData[]): IndicatorResult {
  const macdResult = calculateMACD(data)
  
  return {
    vwap: calculateVWAP(data),
    rsi: calculateRSI(data),
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
    atr: calculateATR(data),
    relativeVolume: calculateRelativeVolume(data),
    trendStrength: calculateTrendStrength(data),
    patternDetected: detectCandlePattern(data)
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
    
    const { symbol, data: rawData, timeframe = '5min' } = await req.json()
    
    if (!symbol) {
      return new Response(
        JSON.stringify({ error: 'Symbol is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    let ohlcvData: OHLCVData[] = rawData
    
    // If no data provided, fetch from cache
    if (!ohlcvData || ohlcvData.length === 0) {
      const { data: cachedData } = await supabase
        .from('indicator_cache')
        .select('raw_data')
        .eq('symbol', symbol.toUpperCase())
        .eq('timeframe', timeframe)
        .maybeSingle()
      
      if (!cachedData?.raw_data) {
        return new Response(
          JSON.stringify({ error: 'No data available. Fetch data first using alpha-vantage endpoint.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      ohlcvData = cachedData.raw_data
    }
    
    console.log(`[Indicators] Computing indicators for ${symbol} with ${ohlcvData.length} data points`)
    
    // Compute all indicators
    const indicators = computeAllIndicators(ohlcvData)
    
    // Store computed indicators
    const { error: upsertError } = await supabase
      .from('indicator_cache')
      .upsert({
        symbol: symbol.toUpperCase(),
        timeframe,
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
    
    if (upsertError) {
      console.error('[Indicators] Error storing indicators:', upsertError)
    }
    
    // Log success
    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'indicators',
      message: `Computed indicators for ${symbol}`,
      metadata: { symbol, timeframe, indicators }
    })
    
    return new Response(
      JSON.stringify({ 
        symbol: symbol.toUpperCase(),
        timeframe,
        indicators,
        dataPoints: ohlcvData.length,
        computedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[Indicators] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
