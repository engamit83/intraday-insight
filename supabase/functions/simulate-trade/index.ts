// Simulate Trade Edge Function
// Paper trading engine - creates virtual trades from signals

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SimulatedTrade {
  id: string
  symbol: string
  signal_id: string
  direction: string
  entry_price: number
  exit_price?: number
  quantity: number
  status: string
  pnl?: number
  pnl_percent?: number
  entry_time: string
  exit_time?: string
  exit_reason?: string
  market_condition?: string
  confidence_at_entry?: number
}

// Check if simulator mode is enabled
async function isSimulatorEnabled(supabase: any): Promise<boolean> {
  const { data: settings } = await supabase
    .from('user_settings')
    .select('simulator_mode')
    .maybeSingle()
  
  return settings?.simulator_mode === 'SIMULATOR'
}

// Get current market condition
async function getMarketCondition(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('market_conditions')
    .select('condition')
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  return data?.condition || 'RANGE'
}

// Get current price for a symbol
async function getCurrentPrice(supabase: any, symbol: string): Promise<number | null> {
  const { data } = await supabase
    .from('stocks')
    .select('last_price')
    .eq('symbol', symbol)
    .maybeSingle()
  
  return data?.last_price || null
}

// Get indicators for a symbol
async function getIndicators(supabase: any, symbol: string): Promise<any> {
  const { data } = await supabase
    .from('indicator_cache')
    .select('*')
    .eq('symbol', symbol)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  return data
}

// Create a simulated trade from a signal
async function createSimulatedTrade(
  supabase: any,
  signal: any,
  marketCondition: string
): Promise<SimulatedTrade | null> {
  const { data, error } = await supabase
    .from('simulated_trades')
    .insert({
      symbol: signal.symbol,
      signal_id: signal.id,
      direction: signal.signal_type,
      entry_price: signal.entry_price,
      quantity: 1,
      status: 'OPEN',
      market_condition: marketCondition,
      confidence_at_entry: signal.confidence || signal.final_score
    })
    .select()
    .single()
  
  if (error) {
    console.error('[SimulateTrade] Create error:', error)
    return null
  }
  
  return data
}

// Close a simulated trade
async function closeSimulatedTrade(
  supabase: any,
  trade: SimulatedTrade,
  exitPrice: number,
  exitReason: string
): Promise<void> {
  const direction = trade.direction === 'BUY' ? 1 : -1
  const pnl = (exitPrice - trade.entry_price) * trade.quantity * direction
  const pnlPercent = ((exitPrice - trade.entry_price) / trade.entry_price) * 100 * direction
  
  await supabase
    .from('simulated_trades')
    .update({
      status: 'CLOSED',
      exit_price: exitPrice,
      exit_time: new Date().toISOString(),
      exit_reason: exitReason,
      pnl: Math.round(pnl * 100) / 100,
      pnl_percent: Math.round(pnlPercent * 100) / 100
    })
    .eq('id', trade.id)
  
  // Record in trade_exits for learning
  const entryTime = new Date(trade.entry_time)
  const timeHeld = Math.round((Date.now() - entryTime.getTime()) / 60000)
  
  await supabase
    .from('trade_exits')
    .insert({
      trade_id: trade.id,
      exit_reason: exitReason,
      exit_type: exitReason.includes('TARGET') ? 'TARGET_HIT' : 
                 exitReason.includes('STOPLOSS') ? 'STOPLOSS_HIT' : 'EARLY_EXIT',
      market_condition: trade.market_condition,
      time_held_minutes: timeHeld,
      pnl_at_exit: Math.round(pnl * 100) / 100
    })
  
  console.log(`[SimulateTrade] Closed trade ${trade.id}: ${exitReason}, PnL: ${pnl}`)
}

// Check early exit conditions (reuses exit-monitor logic)
function checkEarlyExit(
  trade: SimulatedTrade,
  currentPrice: number,
  indicators: any,
  marketCondition: string,
  signal: any
): { shouldExit: boolean; reason: string } {
  // Check target hit
  if (signal?.target_price) {
    if (trade.direction === 'BUY' && currentPrice >= signal.target_price) {
      return { shouldExit: true, reason: 'TARGET_HIT: Price reached target' }
    }
    if (trade.direction === 'SELL' && currentPrice <= signal.target_price) {
      return { shouldExit: true, reason: 'TARGET_HIT: Price reached target' }
    }
  }
  
  // Check stoploss hit
  if (signal?.stoploss_price) {
    if (trade.direction === 'BUY' && currentPrice <= signal.stoploss_price) {
      return { shouldExit: true, reason: 'STOPLOSS_HIT: Stoploss triggered' }
    }
    if (trade.direction === 'SELL' && currentPrice >= signal.stoploss_price) {
      return { shouldExit: true, reason: 'STOPLOSS_HIT: Stoploss triggered' }
    }
  }
  
  // Check market condition flip
  if (marketCondition === 'NO_TRADE') {
    return { shouldExit: true, reason: 'MARKET_CONDITION: Market turned NO_TRADE' }
  }
  
  if (!indicators) return { shouldExit: false, reason: '' }
  
  const entryTime = new Date(trade.entry_time)
  const minutesOpen = (Date.now() - entryTime.getTime()) / 60000
  
  // Early exit checks
  let exitScore = 0
  const reasons: string[] = []
  
  // Price stall check
  const priceChange = Math.abs((currentPrice - trade.entry_price) / trade.entry_price) * 100
  if (minutesOpen > 30 && priceChange < 0.3) {
    exitScore += 30
    reasons.push('Price stalled')
  }
  
  // Momentum weakening
  const rsi = indicators.rsi
  const macdHistogram = indicators.macd_histogram
  const trendStrength = indicators.trend_strength
  
  if (trade.direction === 'BUY') {
    if (rsi && rsi > 75) { exitScore += 25; reasons.push('Overbought') }
    if (macdHistogram && macdHistogram < -0.001) { exitScore += 25; reasons.push('MACD bearish') }
    if (trendStrength && trendStrength < -30) { exitScore += 30; reasons.push('Trend reversed') }
  } else {
    if (rsi && rsi < 25) { exitScore += 25; reasons.push('Oversold') }
    if (macdHistogram && macdHistogram > 0.001) { exitScore += 25; reasons.push('MACD bullish') }
    if (trendStrength && trendStrength > 30) { exitScore += 30; reasons.push('Trend reversed') }
  }
  
  // Volume dry up
  if (indicators.relative_volume && indicators.relative_volume < 0.5) {
    exitScore += 25
    reasons.push('Volume dried up')
  }
  
  // VWAP lost
  if (indicators.vwap) {
    const vwap = indicators.vwap
    if (trade.direction === 'BUY' && currentPrice < vwap * 0.998) {
      exitScore += 30
      reasons.push('Lost VWAP support')
    }
    if (trade.direction === 'SELL' && currentPrice > vwap * 1.002) {
      exitScore += 30
      reasons.push('Lost VWAP resistance')
    }
  }
  
  // Time decay
  if (minutesOpen > 60) {
    exitScore += 15
    reasons.push('Trade open too long')
  }
  
  if (exitScore >= 50) {
    return { shouldExit: true, reason: `EARLY_EXIT: ${reasons.join(', ')}` }
  }
  
  return { shouldExit: false, reason: '' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { action, signalId } = await req.json()
    
    console.log(`[SimulateTrade] Action: ${action}`)
    
    // Check if simulator is enabled
    const simulatorEnabled = await isSimulatorEnabled(supabase)
    
    if (action === 'get_status') {
      // Return simulator status and stats
      const { data: openTrades } = await supabase
        .from('simulated_trades')
        .select('*')
        .eq('status', 'OPEN')
      
      const today = new Date().toISOString().split('T')[0]
      const { data: todayTrades } = await supabase
        .from('simulated_trades')
        .select('pnl, status')
        .gte('entry_time', today)
      
      const todayPnl = todayTrades?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0
      const winCount = todayTrades?.filter(t => t.status === 'CLOSED' && (t.pnl || 0) > 0).length || 0
      const closedCount = todayTrades?.filter(t => t.status === 'CLOSED').length || 0
      
      return new Response(
        JSON.stringify({
          success: true,
          simulatorEnabled,
          openTrades: openTrades?.length || 0,
          todayPnl: Math.round(todayPnl * 100) / 100,
          todayTrades: todayTrades?.length || 0,
          winRate: closedCount > 0 ? Math.round((winCount / closedCount) * 100) : 0,
          trades: openTrades || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (action === 'execute_signal' && signalId) {
      if (!simulatorEnabled) {
        return new Response(
          JSON.stringify({ success: false, message: 'Simulator mode is not enabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Get the signal
      const { data: signal, error: signalError } = await supabase
        .from('signals')
        .select('*')
        .eq('id', signalId)
        .eq('is_active', true)
        .maybeSingle()
      
      if (signalError || !signal) {
        return new Response(
          JSON.stringify({ success: false, message: 'Signal not found or inactive' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Check if already has an open trade for this signal
      const { data: existingTrade } = await supabase
        .from('simulated_trades')
        .select('id')
        .eq('signal_id', signalId)
        .eq('status', 'OPEN')
        .maybeSingle()
      
      if (existingTrade) {
        return new Response(
          JSON.stringify({ success: false, message: 'Trade already exists for this signal' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const marketCondition = await getMarketCondition(supabase)
      
      // Don't execute in NO_TRADE condition
      if (marketCondition === 'NO_TRADE') {
        return new Response(
          JSON.stringify({ success: false, message: 'Market condition is NO_TRADE' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const trade = await createSimulatedTrade(supabase, signal, marketCondition)
      
      if (trade) {
        await supabase.from('system_logs').insert({
          level: 'INFO',
          source: 'simulate-trade',
          message: `Created simulated ${signal.signal_type} trade for ${signal.symbol}`,
          metadata: { tradeId: trade.id, signalId, marketCondition }
        })
      }
      
      return new Response(
        JSON.stringify({ success: !!trade, trade }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (action === 'monitor_trades') {
      // Monitor all open simulated trades for exit conditions
      const { data: openTrades, error: tradesError } = await supabase
        .from('simulated_trades')
        .select('*')
        .eq('status', 'OPEN')
      
      if (tradesError || !openTrades || openTrades.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No open trades to monitor', exited: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const marketCondition = await getMarketCondition(supabase)
      const results = []
      let exitedCount = 0
      
      for (const trade of openTrades) {
        const currentPrice = await getCurrentPrice(supabase, trade.symbol)
        const indicators = await getIndicators(supabase, trade.symbol)
        
        if (!currentPrice) {
          results.push({ tradeId: trade.id, symbol: trade.symbol, status: 'NO_PRICE' })
          continue
        }
        
        // Get signal for target/stoploss
        let signal = null
        if (trade.signal_id) {
          const { data } = await supabase
            .from('signals')
            .select('target_price, stoploss_price')
            .eq('id', trade.signal_id)
            .maybeSingle()
          signal = data
        }
        
        const exitCheck = checkEarlyExit(trade, currentPrice, indicators, marketCondition, signal)
        
        if (exitCheck.shouldExit) {
          await closeSimulatedTrade(supabase, trade, currentPrice, exitCheck.reason)
          exitedCount++
          results.push({ 
            tradeId: trade.id, 
            symbol: trade.symbol, 
            exited: true, 
            reason: exitCheck.reason,
            pnl: Math.round((currentPrice - trade.entry_price) * trade.quantity * (trade.direction === 'BUY' ? 1 : -1) * 100) / 100
          })
        } else {
          const unrealizedPnl = (currentPrice - trade.entry_price) * trade.quantity * (trade.direction === 'BUY' ? 1 : -1)
          results.push({ 
            tradeId: trade.id, 
            symbol: trade.symbol, 
            exited: false, 
            currentPrice,
            unrealizedPnl: Math.round(unrealizedPnl * 100) / 100
          })
        }
      }
      
      if (exitedCount > 0) {
        // Trigger learning engine
        try {
          await supabase.functions.invoke('learning-engine', {
            body: { action: 'analyze' }
          })
        } catch (e) {
          console.log('[SimulateTrade] Learning engine trigger skipped')
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          marketCondition,
          monitored: openTrades.length,
          exited: exitedCount,
          results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (action === 'process_new_signals') {
      // Auto-execute trades for new active signals (when simulator is on)
      if (!simulatorEnabled) {
        return new Response(
          JSON.stringify({ success: true, message: 'Simulator not enabled', tradesCreated: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const marketCondition = await getMarketCondition(supabase)
      
      if (marketCondition === 'NO_TRADE') {
        return new Response(
          JSON.stringify({ success: true, message: 'Market condition NO_TRADE', tradesCreated: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Get active signals without simulated trades
      const { data: activeSignals } = await supabase
        .from('signals')
        .select('*')
        .eq('is_active', true)
        .eq('is_tradable', true)
        .gte('expires_at', new Date().toISOString())
      
      if (!activeSignals || activeSignals.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No active signals', tradesCreated: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Check which signals don't have open trades
      const { data: existingTrades } = await supabase
        .from('simulated_trades')
        .select('signal_id')
        .in('signal_id', activeSignals.map(s => s.id))
      
      const existingSignalIds = new Set(existingTrades?.map(t => t.signal_id) || [])
      const newSignals = activeSignals.filter(s => !existingSignalIds.has(s.id))
      
      const created = []
      for (const signal of newSignals) {
        const trade = await createSimulatedTrade(supabase, signal, marketCondition)
        if (trade) {
          created.push({ symbol: signal.symbol, direction: signal.signal_type, tradeId: trade.id })
        }
      }
      
      if (created.length > 0) {
        await supabase.from('system_logs').insert({
          level: 'INFO',
          source: 'simulate-trade',
          message: `Auto-created ${created.length} simulated trades`,
          metadata: { trades: created, marketCondition }
        })
      }
      
      return new Response(
        JSON.stringify({ success: true, tradesCreated: created.length, trades: created }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[SimulateTrade] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
