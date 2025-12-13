// Market Condition Classification Edge Function
// Classifies market into: TRENDING, RANGE, HIGH_VOLATILITY, NO_TRADE

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type MarketCondition = 'TRENDING' | 'RANGE' | 'HIGH_VOLATILITY' | 'NO_TRADE'

interface MarketAnalysis {
  condition: MarketCondition
  indexDirection: string
  volatilityLevel: number
  volumeBehavior: string
  timeOfDay: string
  confidence: number
  reasoning: string
}

// Get current time of day classification (IST for Indian markets)
function getTimeOfDay(): { period: string; isOptimal: boolean } {
  const now = new Date()
  const istHour = (now.getUTCHours() + 5.5) % 24
  
  if (istHour < 9.25 || istHour >= 15.5) {
    return { period: 'MARKET_CLOSED', isOptimal: false }
  } else if (istHour >= 9.25 && istHour < 10) {
    return { period: 'OPENING_VOLATILITY', isOptimal: false }
  } else if (istHour >= 10 && istHour < 11.5) {
    return { period: 'MORNING_SESSION', isOptimal: true }
  } else if (istHour >= 11.5 && istHour < 14) {
    return { period: 'MIDDAY_LULL', isOptimal: false }
  } else if (istHour >= 14 && istHour < 15) {
    return { period: 'AFTERNOON_SESSION', isOptimal: true }
  } else {
    return { period: 'CLOSING_HOUR', isOptimal: false }
  }
}

// Analyze volatility level
function analyzeVolatility(atr: number | null, avgPrice: number): { level: number; category: string } {
  if (!atr || avgPrice === 0) return { level: 0, category: 'UNKNOWN' }
  
  const volatilityPercent = (atr / avgPrice) * 100
  
  if (volatilityPercent > 3) {
    return { level: volatilityPercent, category: 'EXTREME' }
  } else if (volatilityPercent > 2) {
    return { level: volatilityPercent, category: 'HIGH' }
  } else if (volatilityPercent > 1) {
    return { level: volatilityPercent, category: 'NORMAL' }
  } else {
    return { level: volatilityPercent, category: 'LOW' }
  }
}

// Analyze volume behavior
function analyzeVolume(relativeVolume: number | null): { behavior: string; isHealthy: boolean } {
  if (!relativeVolume) return { behavior: 'UNKNOWN', isHealthy: false }
  
  if (relativeVolume > 2) {
    return { behavior: 'SURGE', isHealthy: true }
  } else if (relativeVolume > 1.2) {
    return { behavior: 'ABOVE_AVERAGE', isHealthy: true }
  } else if (relativeVolume > 0.8) {
    return { behavior: 'NORMAL', isHealthy: true }
  } else if (relativeVolume > 0.5) {
    return { behavior: 'BELOW_AVERAGE', isHealthy: false }
  } else {
    return { behavior: 'DRY', isHealthy: false }
  }
}

// Analyze trend direction
function analyzeTrend(trendStrength: number | null): { direction: string; isTrending: boolean } {
  if (!trendStrength) return { direction: 'UNKNOWN', isTrending: false }
  
  if (trendStrength > 50) {
    return { direction: 'STRONG_BULLISH', isTrending: true }
  } else if (trendStrength > 20) {
    return { direction: 'BULLISH', isTrending: true }
  } else if (trendStrength < -50) {
    return { direction: 'STRONG_BEARISH', isTrending: true }
  } else if (trendStrength < -20) {
    return { direction: 'BEARISH', isTrending: true }
  } else {
    return { direction: 'SIDEWAYS', isTrending: false }
  }
}

// Main classification function
function classifyMarket(indicators: any[], timeInfo: { period: string; isOptimal: boolean }): MarketAnalysis {
  // If market is closed, no trading
  if (timeInfo.period === 'MARKET_CLOSED') {
    return {
      condition: 'NO_TRADE',
      indexDirection: 'CLOSED',
      volatilityLevel: 0,
      volumeBehavior: 'NONE',
      timeOfDay: timeInfo.period,
      confidence: 100,
      reasoning: 'Market is closed. No trading activity.'
    }
  }
  
  // Aggregate indicators from multiple symbols
  let totalTrend = 0
  let totalVolatility = 0
  let totalVolume = 0
  let count = 0
  let avgPrice = 0
  
  for (const ind of indicators) {
    if (ind.trend_strength !== null) totalTrend += ind.trend_strength
    if (ind.atr !== null) totalVolatility += ind.atr
    if (ind.relative_volume !== null) totalVolume += ind.relative_volume
    count++
  }
  
  if (count === 0) {
    return {
      condition: 'NO_TRADE',
      indexDirection: 'UNKNOWN',
      volatilityLevel: 0,
      volumeBehavior: 'UNKNOWN',
      timeOfDay: timeInfo.period,
      confidence: 50,
      reasoning: 'Insufficient data to classify market conditions.'
    }
  }
  
  const avgTrend = totalTrend / count
  const avgVolatilityRaw = totalVolatility / count
  const avgRelativeVolume = totalVolume / count
  
  const trendAnalysis = analyzeTrend(avgTrend)
  const volatilityAnalysis = analyzeVolatility(avgVolatilityRaw, 1000) // Normalized
  const volumeAnalysis = analyzeVolume(avgRelativeVolume)
  
  let condition: MarketCondition = 'RANGE'
  let confidence = 50
  const reasons: string[] = []
  
  // Classification logic
  if (volatilityAnalysis.category === 'EXTREME') {
    condition = 'HIGH_VOLATILITY'
    confidence = 85
    reasons.push('Extreme volatility detected')
  } else if (!timeInfo.isOptimal && volumeAnalysis.behavior === 'DRY') {
    condition = 'NO_TRADE'
    confidence = 75
    reasons.push('Poor trading conditions: low volume during non-optimal hours')
  } else if (trendAnalysis.isTrending && volumeAnalysis.isHealthy) {
    condition = 'TRENDING'
    confidence = Math.min(90, 60 + Math.abs(avgTrend) / 2)
    reasons.push(`Clear ${trendAnalysis.direction} trend with healthy volume`)
  } else if (!trendAnalysis.isTrending) {
    condition = 'RANGE'
    confidence = 70
    reasons.push('No clear trend direction, range-bound market')
  }
  
  // Reduce confidence during opening/closing volatility
  if (timeInfo.period === 'OPENING_VOLATILITY' || timeInfo.period === 'CLOSING_HOUR') {
    confidence *= 0.8
    reasons.push(`Caution: ${timeInfo.period} period`)
  }
  
  return {
    condition,
    indexDirection: trendAnalysis.direction,
    volatilityLevel: volatilityAnalysis.level,
    volumeBehavior: volumeAnalysis.behavior,
    timeOfDay: timeInfo.period,
    confidence: Math.round(confidence),
    reasoning: reasons.join('. ')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log('[MarketConditions] Analyzing market conditions')
    
    // Get time of day
    const timeInfo = getTimeOfDay()
    
    // Fetch recent indicators for analysis
    const { data: indicators, error: indicatorError } = await supabase
      .from('indicator_cache')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(10)
    
    if (indicatorError) {
      throw new Error(`Failed to fetch indicators: ${indicatorError.message}`)
    }
    
    // Classify market
    const analysis = classifyMarket(indicators || [], timeInfo)
    
    // Store current market condition
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 5) // Valid for 5 minutes
    
    const { error: insertError } = await supabase
      .from('market_conditions')
      .insert({
        condition: analysis.condition,
        index_direction: analysis.indexDirection,
        volatility_level: analysis.volatilityLevel,
        volume_behavior: analysis.volumeBehavior,
        time_of_day: analysis.timeOfDay,
        confidence: analysis.confidence,
        expires_at: expiresAt.toISOString()
      })
    
    if (insertError) {
      console.error('[MarketConditions] Error storing condition:', insertError)
    }
    
    // Log analysis
    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'market-conditions',
      message: `Market classified as ${analysis.condition}`,
      metadata: analysis
    })
    
    console.log(`[MarketConditions] Result: ${analysis.condition} (${analysis.confidence}% confidence)`)
    
    return new Response(
      JSON.stringify({
        success: true,
        ...analysis,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[MarketConditions] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
