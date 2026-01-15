// Trading Intelligence Edge Function
// Handles: Adaptive Scoring, Entry Control, Exit Intelligence, Capital Protection

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Allowed actions for input validation
const ALLOWED_ACTIONS = ['score_signal', 'check_entry', 'get_status', 'update_state']

interface TradingRules {
  market_multiplier: number
  risk_multiplier: number
  time_multiplier: number
  min_score_threshold: number
  max_daily_trades: number
  max_daily_loss: number
  consecutive_loss_limit: number
}

interface TradingState {
  trades_today: number
  daily_pnl: number
  consecutive_losses: number
  auto_mode_active: boolean
  stop_reason: string | null
}

interface SignalScore {
  rawScore: number
  finalScore: number
  isTradable: boolean
  rejectionReason: string | null
}

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

// Validate stock symbol format
function isValidSymbol(symbol: string): boolean {
  const symbolRegex = /^[A-Z0-9&-]{1,20}$/
  return symbolRegex.test(symbol.toUpperCase())
}

// Sanitize symbol input
function sanitizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\.(NS|NSE|BSE)$/i, '').replace(/[^A-Z0-9&-]/g, '').substring(0, 20)
}

// Verify JWT and get user ID
async function verifyAuth(req: Request): Promise<{ authenticated: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing or invalid Authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  try {
    const { data, error } = await supabase.auth.getUser(token)
    
    if (error || !data.user) {
      return { authenticated: false, error: 'Invalid or expired token' }
    }

    return { authenticated: true, userId: data.user.id }
  } catch {
    return { authenticated: false, error: 'Token verification failed' }
  }
}

// Calculate raw technical score from indicators
function calculateRawScore(indicators: any): number {
  let score = 50 // Base score
  
  // Trend strength contribution (0-25 points)
  if (indicators.trend_strength !== null) {
    const trendScore = Math.min(25, Math.abs(indicators.trend_strength) / 4)
    score += trendScore
  }
  
  // RSI contribution (0-15 points)
  if (indicators.rsi !== null) {
    // Optimal RSI zones: 30-40 for buy, 60-70 for sell
    const rsi = indicators.rsi
    if ((rsi >= 30 && rsi <= 40) || (rsi >= 60 && rsi <= 70)) {
      score += 15
    } else if ((rsi >= 25 && rsi <= 45) || (rsi >= 55 && rsi <= 75)) {
      score += 10
    } else if (rsi < 20 || rsi > 80) {
      score += 5 // Extreme zones
    }
  }
  
  // VWAP alignment contribution (0-15 points)
  if (indicators.vwap !== null && indicators.raw_data?.length > 0) {
    const currentPrice = indicators.raw_data[0]?.close
    if (currentPrice) {
      const vwapDiff = ((currentPrice - indicators.vwap) / indicators.vwap) * 100
      if (Math.abs(vwapDiff) < 0.5) {
        score += 15 // Near VWAP
      } else if (Math.abs(vwapDiff) < 1) {
        score += 10
      }
    }
  }
  
  // Volume contribution (0-15 points)
  if (indicators.relative_volume !== null) {
    if (indicators.relative_volume > 1.5) {
      score += 15
    } else if (indicators.relative_volume > 1.2) {
      score += 10
    } else if (indicators.relative_volume > 0.8) {
      score += 5
    }
  }
  
  // Pattern contribution (0-10 points)
  if (indicators.pattern_detected) {
    const bullishPatterns = ['HAMMER', 'BULLISH_ENGULFING', 'INVERTED_HAMMER']
    const bearishPatterns = ['SHOOTING_STAR', 'BEARISH_ENGULFING']
    if (bullishPatterns.includes(indicators.pattern_detected) || bearishPatterns.includes(indicators.pattern_detected)) {
      score += 10
    } else if (indicators.pattern_detected === 'DOJI') {
      score += 3 // Indecision
    }
  }
  
  // MACD contribution (0-10 points)
  if (indicators.macd_histogram !== null) {
    if (Math.abs(indicators.macd_histogram) > 0.001) {
      score += indicators.macd_histogram > 0 ? 10 : 8
    }
  }
  
  return Math.min(100, Math.round(score))
}

// Get time-based multiplier
function getTimeMultiplier(): number {
  const now = new Date()
  const istHour = (now.getUTCHours() + 5.5) % 24
  
  if (istHour < 9.25 || istHour >= 15.5) {
    return 0 // Market closed
  } else if (istHour >= 9.25 && istHour < 10) {
    return 0.7 // Opening volatility
  } else if (istHour >= 10 && istHour < 11.5) {
    return 1.0 // Morning optimal
  } else if (istHour >= 11.5 && istHour < 14) {
    return 0.8 // Midday lull
  } else if (istHour >= 14 && istHour < 15) {
    return 1.0 // Afternoon optimal
  } else {
    return 0.6 // Closing hour
  }
}

// Get market-based multiplier
function getMarketMultiplier(marketCondition: string): number {
  switch (marketCondition) {
    case 'TRENDING': return 1.2
    case 'RANGE': return 0.8
    case 'HIGH_VOLATILITY': return 0.6
    case 'NO_TRADE': return 0
    default: return 1.0
  }
}

// Get risk-based multiplier from trading state
function getRiskMultiplier(state: TradingState, rules: TradingRules): number {
  let multiplier = 1.0
  
  // Reduce after consecutive losses
  if (state.consecutive_losses >= rules.consecutive_loss_limit) {
    return 0 // Stop trading
  } else if (state.consecutive_losses >= 2) {
    multiplier *= 0.7
  } else if (state.consecutive_losses >= 1) {
    multiplier *= 0.85
  }
  
  // Reduce based on daily loss
  const lossPercent = Math.abs(state.daily_pnl) / rules.max_daily_loss
  if (lossPercent > 0.8) {
    multiplier *= 0.3
  } else if (lossPercent > 0.5) {
    multiplier *= 0.6
  } else if (lossPercent > 0.3) {
    multiplier *= 0.8
  }
  
  return multiplier
}

// Calculate final score and determine tradability
function calculateFinalScore(
  rawScore: number,
  marketCondition: string,
  state: TradingState,
  rules: TradingRules
): SignalScore {
  const marketMultiplier = getMarketMultiplier(marketCondition)
  const timeMultiplier = getTimeMultiplier()
  const riskMultiplier = getRiskMultiplier(state, rules)
  
  const finalScore = Math.round(rawScore * marketMultiplier * timeMultiplier * riskMultiplier)
  
  // Determine tradability
  let isTradable = true
  let rejectionReason: string | null = null
  
  if (marketCondition === 'NO_TRADE') {
    isTradable = false
    rejectionReason = 'Market conditions not suitable for trading'
  } else if (!state.auto_mode_active) {
    isTradable = false
    rejectionReason = state.stop_reason || 'Auto-mode disabled'
  } else if (state.trades_today >= rules.max_daily_trades) {
    isTradable = false
    rejectionReason = `Daily trade limit reached (${rules.max_daily_trades})`
  } else if (state.daily_pnl <= -rules.max_daily_loss) {
    isTradable = false
    rejectionReason = `Daily loss limit reached`
  } else if (state.consecutive_losses >= rules.consecutive_loss_limit) {
    isTradable = false
    rejectionReason = `Consecutive loss limit reached (${rules.consecutive_loss_limit})`
  } else if (finalScore < rules.min_score_threshold) {
    isTradable = false
    rejectionReason = `Score below threshold`
  } else if (timeMultiplier === 0) {
    isTradable = false
    rejectionReason = 'Market is closed'
  }
  
  return { rawScore, finalScore, isTradable, rejectionReason }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // Verify authentication
    const authResult = await verifyAuth(req)
    if (!authResult.authenticated || !authResult.userId) {
      return new Response(
        JSON.stringify({ error: authResult.error || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const userId = authResult.userId
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const body = await req.json().catch(() => ({}))
    const { action, symbol, signalId } = body
    
    // Validate action
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Allowed: ${ALLOWED_ACTIONS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate signalId if provided
    if (signalId && !isValidUUID(signalId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid signalId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`[TradingIntelligence] Action: ${action}, Symbol: ${symbol || 'N/A'}, User: ${userId}`)
    
    // Fetch current market condition
    const { data: marketData } = await supabase
      .from('market_conditions')
      .select('condition')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    const marketCondition = marketData?.condition || 'RANGE'
    
    // Fetch trading rules
    const { data: rulesData } = await supabase
      .from('trading_rules')
      .select('*')
      .eq('rule_name', 'default')
      .eq('is_active', true)
      .maybeSingle()
    
    const rules: TradingRules = rulesData || {
      market_multiplier: 1.0,
      risk_multiplier: 1.0,
      time_multiplier: 1.0,
      min_score_threshold: 60,
      max_daily_trades: 10,
      max_daily_loss: 5000,
      consecutive_loss_limit: 3
    }
    
    // Fetch or create trading state for today for this user
    const today = new Date().toISOString().split('T')[0]
    let { data: stateData } = await supabase
      .from('trading_state')
      .select('*')
      .eq('date', today)
      .eq('user_id', userId)
      .maybeSingle()
    
    if (!stateData) {
      const { data: newState } = await supabase
        .from('trading_state')
        .insert({
          user_id: userId,
          date: today,
          trades_today: 0,
          daily_pnl: 0,
          consecutive_losses: 0,
          auto_mode_active: true
        })
        .select()
        .single()
      stateData = newState
    }
    
    const state: TradingState = {
      trades_today: stateData?.trades_today || 0,
      daily_pnl: stateData?.daily_pnl || 0,
      consecutive_losses: stateData?.consecutive_losses || 0,
      auto_mode_active: stateData?.auto_mode_active ?? true,
      stop_reason: stateData?.stop_reason || null
    }
    
    // Handle different actions
    switch (action) {
      case 'score_signal': {
        if (!symbol) {
          return new Response(
            JSON.stringify({ error: 'Symbol is required for scoring' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Validate and sanitize symbol
        if (!isValidSymbol(symbol)) {
          return new Response(
            JSON.stringify({ error: 'Invalid symbol format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const sanitizedSymbol = sanitizeSymbol(symbol)
        
        // Fetch indicators for this symbol
        const { data: indicators } = await supabase
          .from('indicator_cache')
          .select('*')
          .eq('symbol', sanitizedSymbol)
          .order('computed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (!indicators) {
          return new Response(
            JSON.stringify({ error: 'No indicator data available for this symbol' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const rawScore = calculateRawScore(indicators)
        const scoreResult = calculateFinalScore(rawScore, marketCondition, state, rules)
        
        // Update signal if signalId provided
        if (signalId) {
          await supabase
            .from('signals')
            .update({
              raw_score: scoreResult.rawScore,
              final_score: scoreResult.finalScore,
              market_condition: marketCondition,
              is_tradable: scoreResult.isTradable,
              rejection_reason: scoreResult.rejectionReason
            })
            .eq('id', signalId)
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            symbol: sanitizedSymbol,
            marketCondition,
            ...scoreResult,
            multipliers: {
              market: getMarketMultiplier(marketCondition),
              time: getTimeMultiplier(),
              risk: getRiskMultiplier(state, rules)
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'check_entry': {
        const scoreResult = calculateFinalScore(0, marketCondition, state, rules)
        
        return new Response(
          JSON.stringify({
            success: true,
            canEnter: scoreResult.isTradable && marketCondition !== 'NO_TRADE',
            marketCondition,
            tradingState: state,
            rejectionReason: scoreResult.rejectionReason
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'get_status': {
        return new Response(
          JSON.stringify({
            success: true,
            marketCondition,
            tradingState: state,
            rules,
            timeMultiplier: getTimeMultiplier(),
            timestamp: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'update_state': {
        const { tradesToday, dailyPnl, consecutiveLosses, autoModeActive, stopReason } = body
        
        // Validate numeric inputs
        if (tradesToday !== undefined && (typeof tradesToday !== 'number' || tradesToday < 0 || tradesToday > 100)) {
          return new Response(
            JSON.stringify({ error: 'Invalid tradesToday value' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (dailyPnl !== undefined && (typeof dailyPnl !== 'number' || dailyPnl < -1000000 || dailyPnl > 1000000)) {
          return new Response(
            JSON.stringify({ error: 'Invalid dailyPnl value' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (consecutiveLosses !== undefined && (typeof consecutiveLosses !== 'number' || consecutiveLosses < 0 || consecutiveLosses > 20)) {
          return new Response(
            JSON.stringify({ error: 'Invalid consecutiveLosses value' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const { error: updateError } = await supabase
          .from('trading_state')
          .update({
            trades_today: tradesToday ?? state.trades_today,
            daily_pnl: dailyPnl ?? state.daily_pnl,
            consecutive_losses: consecutiveLosses ?? state.consecutive_losses,
            auto_mode_active: autoModeActive ?? state.auto_mode_active,
            stop_reason: stopReason ?? state.stop_reason,
            updated_at: new Date().toISOString()
          })
          .eq('date', today)
          .eq('user_id', userId)
        
        if (updateError) {
          throw updateError
        }
        
        return new Response(
          JSON.stringify({ success: true, message: 'Trading state updated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
    
  } catch (error) {
    console.error('[TradingIntelligence] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
