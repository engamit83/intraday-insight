// Exit Monitor Edge Function
// Monitors open trades and triggers early exits when conditions weaken

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ExitType = 'TARGET_HIT' | 'STOPLOSS_HIT' | 'EARLY_EXIT' | 'MANUAL' | 'AUTO_STOP'

interface ExitDecision {
  shouldExit: boolean
  exitType: ExitType | null
  reason: string
  confidence: number
}

interface OpenTrade {
  id: string
  symbol: string
  trade_type: string
  entry_price: number
  quantity: number
  opened_at: string
  signal_id?: string
}

// Check if price has stalled
function checkPriceStall(currentPrice: number, entryPrice: number, minutesOpen: number): boolean {
  const priceChange = Math.abs((currentPrice - entryPrice) / entryPrice) * 100
  
  // If less than 0.3% move after 30+ minutes, consider stalled
  if (minutesOpen > 30 && priceChange < 0.3) return true
  // If less than 0.5% move after 45+ minutes, consider stalled
  if (minutesOpen > 45 && priceChange < 0.5) return true
  
  return false
}

// Check momentum condition
function checkMomentumWeakening(indicators: any, tradeType: string): boolean {
  if (!indicators) return false
  
  const rsi = indicators.rsi
  const macdHistogram = indicators.macd_histogram
  const trendStrength = indicators.trend_strength
  
  if (tradeType === 'BUY') {
    // For long positions, check for bearish signals
    if (rsi && rsi > 75) return true // Overbought
    if (macdHistogram && macdHistogram < -0.001) return true // MACD bearish
    if (trendStrength && trendStrength < -30) return true // Trend reversed
  } else {
    // For short positions, check for bullish signals
    if (rsi && rsi < 25) return true // Oversold
    if (macdHistogram && macdHistogram > 0.001) return true // MACD bullish
    if (trendStrength && trendStrength > 30) return true // Trend reversed
  }
  
  return false
}

// Check volume condition
function checkVolumeDryUp(indicators: any): boolean {
  if (!indicators || !indicators.relative_volume) return false
  return indicators.relative_volume < 0.5 // Volume dropped to less than 50% of average
}

// Check VWAP position
function checkVwapLost(indicators: any, currentPrice: number, tradeType: string): boolean {
  if (!indicators || !indicators.vwap) return false
  
  const vwap = indicators.vwap
  const tolerance = vwap * 0.002 // 0.2% tolerance
  
  if (tradeType === 'BUY') {
    // For longs, price below VWAP is concerning
    return currentPrice < (vwap - tolerance)
  } else {
    // For shorts, price above VWAP is concerning
    return currentPrice > (vwap + tolerance)
  }
}

// Evaluate exit decision for a trade
function evaluateExit(
  trade: OpenTrade,
  currentPrice: number,
  indicators: any,
  marketCondition: string,
  targetPrice?: number,
  stoplossPrice?: number
): ExitDecision {
  const entryPrice = trade.entry_price
  const tradeType = trade.trade_type
  const openedAt = new Date(trade.opened_at)
  const minutesOpen = (Date.now() - openedAt.getTime()) / 60000
  
  // Check target hit
  if (targetPrice) {
    if (tradeType === 'BUY' && currentPrice >= targetPrice) {
      return { shouldExit: true, exitType: 'TARGET_HIT', reason: 'Target price reached', confidence: 100 }
    }
    if (tradeType === 'SELL' && currentPrice <= targetPrice) {
      return { shouldExit: true, exitType: 'TARGET_HIT', reason: 'Target price reached', confidence: 100 }
    }
  }
  
  // Check stoploss hit
  if (stoplossPrice) {
    if (tradeType === 'BUY' && currentPrice <= stoplossPrice) {
      return { shouldExit: true, exitType: 'STOPLOSS_HIT', reason: 'Stoploss triggered', confidence: 100 }
    }
    if (tradeType === 'SELL' && currentPrice >= stoplossPrice) {
      return { shouldExit: true, exitType: 'STOPLOSS_HIT', reason: 'Stoploss triggered', confidence: 100 }
    }
  }
  
  // Check market condition flip
  if (marketCondition === 'NO_TRADE' || marketCondition === 'HIGH_VOLATILITY') {
    return { 
      shouldExit: true, 
      exitType: 'EARLY_EXIT', 
      reason: `Market condition changed to ${marketCondition}`, 
      confidence: 85 
    }
  }
  
  // Early exit conditions
  const reasons: string[] = []
  let exitScore = 0
  
  // Price stall check
  if (checkPriceStall(currentPrice, entryPrice, minutesOpen)) {
    exitScore += 30
    reasons.push('Price stalled')
  }
  
  // Momentum weakening
  if (checkMomentumWeakening(indicators, tradeType)) {
    exitScore += 35
    reasons.push('Momentum weakening')
  }
  
  // Volume dry up
  if (checkVolumeDryUp(indicators)) {
    exitScore += 25
    reasons.push('Volume drying up')
  }
  
  // VWAP lost
  if (checkVwapLost(indicators, currentPrice, tradeType)) {
    exitScore += 30
    reasons.push('Lost VWAP support/resistance')
  }
  
  // Time decay - reduce tolerance over time
  if (minutesOpen > 60) {
    exitScore += 15
    reasons.push('Trade open too long')
  }
  
  // Decide on early exit if multiple conditions met
  if (exitScore >= 50) {
    return {
      shouldExit: true,
      exitType: 'EARLY_EXIT',
      reason: reasons.join(', '),
      confidence: Math.min(95, exitScore + 20)
    }
  }
  
  return {
    shouldExit: false,
    exitType: null,
    reason: 'Conditions still favorable',
    confidence: 100 - exitScore
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
    
    const { action, tradeId } = await req.json()
    
    console.log(`[ExitMonitor] Action: ${action}`)
    
    // Get current market condition
    const { data: marketData } = await supabase
      .from('market_conditions')
      .select('condition')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    const marketCondition = marketData?.condition || 'RANGE'
    
    if (action === 'monitor_all') {
      // Fetch all open trades
      const { data: openTrades, error: tradesError } = await supabase
        .from('trades')
        .select('*')
        .eq('status', 'OPEN')
      
      if (tradesError) {
        throw new Error(`Failed to fetch open trades: ${tradesError.message}`)
      }
      
      if (!openTrades || openTrades.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No open trades to monitor', trades: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const results = []
      
      for (const trade of openTrades) {
        // Fetch current indicators for this symbol
        const { data: indicators } = await supabase
          .from('indicator_cache')
          .select('*')
          .eq('symbol', trade.symbol)
          .order('computed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        // Get current price from stocks table
        const { data: stockData } = await supabase
          .from('stocks')
          .select('last_price')
          .eq('symbol', trade.symbol)
          .maybeSingle()
        
        const currentPrice = stockData?.last_price || trade.entry_price
        
        // Get signal data if linked
        let targetPrice: number | undefined
        let stoplossPrice: number | undefined
        
        if (trade.signal_id) {
          const { data: signal } = await supabase
            .from('signals')
            .select('target_price, stoploss_price')
            .eq('id', trade.signal_id)
            .maybeSingle()
          
          targetPrice = signal?.target_price
          stoplossPrice = signal?.stoploss_price
        }
        
        // Evaluate exit
        const exitDecision = evaluateExit(
          trade,
          currentPrice,
          indicators,
          marketCondition,
          targetPrice,
          stoplossPrice
        )
        
        results.push({
          tradeId: trade.id,
          symbol: trade.symbol,
          currentPrice,
          entryPrice: trade.entry_price,
          ...exitDecision
        })
        
        // If should exit, update trade and record exit
        if (exitDecision.shouldExit) {
          const openedAt = new Date(trade.opened_at)
          const timeHeld = Math.round((Date.now() - openedAt.getTime()) / 60000)
          const pnl = (currentPrice - trade.entry_price) * trade.quantity * (trade.trade_type === 'BUY' ? 1 : -1)
          const pnlPercent = ((currentPrice - trade.entry_price) / trade.entry_price) * 100 * (trade.trade_type === 'BUY' ? 1 : -1)
          
          // Update trade
          await supabase
            .from('trades')
            .update({
              status: 'CLOSED',
              exit_price: currentPrice,
              closed_at: new Date().toISOString(),
              pnl: Math.round(pnl * 100) / 100,
              pnl_percentage: Math.round(pnlPercent * 100) / 100,
              exit_reason: exitDecision.reason,
              time_held_minutes: timeHeld,
              momentum_at_exit: indicators?.trend_strength || null
            })
            .eq('id', trade.id)
          
          // Record exit details
          await supabase
            .from('trade_exits')
            .insert({
              trade_id: trade.id,
              exit_reason: exitDecision.reason,
              exit_type: exitDecision.exitType,
              momentum_at_exit: indicators?.trend_strength || null,
              volume_at_exit: indicators?.relative_volume || null,
              vwap_position: indicators?.vwap ? (currentPrice > indicators.vwap ? 'ABOVE' : 'BELOW') : null,
              market_condition: marketCondition,
              time_held_minutes: timeHeld,
              pnl_at_exit: Math.round(pnl * 100) / 100
            })
          
          // Update trading state
          const today = new Date().toISOString().split('T')[0]
          const { data: stateData } = await supabase
            .from('trading_state')
            .select('*')
            .eq('date', today)
            .maybeSingle()
          
          if (stateData) {
            const isLoss = pnl < 0
            await supabase
              .from('trading_state')
              .update({
                daily_pnl: (stateData.daily_pnl || 0) + pnl,
                consecutive_losses: isLoss ? (stateData.consecutive_losses || 0) + 1 : 0,
                updated_at: new Date().toISOString()
              })
              .eq('id', stateData.id)
          }
          
          console.log(`[ExitMonitor] Closed trade ${trade.id} - ${trade.symbol}: ${exitDecision.reason}`)
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          marketCondition,
          tradesMonitored: results.length,
          exitTriggered: results.filter(r => r.shouldExit).length,
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (action === 'check_single' && tradeId) {
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .maybeSingle()
      
      if (tradeError || !trade) {
        throw new Error('Trade not found')
      }
      
      const { data: indicators } = await supabase
        .from('indicator_cache')
        .select('*')
        .eq('symbol', trade.symbol)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      const { data: stockData } = await supabase
        .from('stocks')
        .select('last_price')
        .eq('symbol', trade.symbol)
        .maybeSingle()
      
      const currentPrice = stockData?.last_price || trade.entry_price
      
      const exitDecision = evaluateExit(trade, currentPrice, indicators, marketCondition)
      
      return new Response(
        JSON.stringify({
          success: true,
          tradeId: trade.id,
          symbol: trade.symbol,
          currentPrice,
          marketCondition,
          ...exitDecision
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid action or missing parameters' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[ExitMonitor] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
