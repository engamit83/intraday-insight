// Learning Engine Edge Function
// Analyzes trade outcomes and adjusts multipliers (rule-based, not ML)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TradeAnalysis {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
  bestCondition: string
  worstCondition: string
}

interface ConditionPerformance {
  condition: string
  trades: number
  wins: number
  winRate: number
  avgPnl: number
}

// Analyze trades by market condition
async function analyzeByCondition(supabase: any): Promise<ConditionPerformance[]> {
  const { data: trades } = await supabase
    .from('trades')
    .select('*, signals(market_condition)')
    .eq('status', 'CLOSED')
    .gte('closed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
  
  if (!trades || trades.length === 0) return []
  
  const conditionStats: Record<string, { trades: number; wins: number; totalPnl: number }> = {}
  
  for (const trade of trades) {
    const condition = trade.signals?.market_condition || 'UNKNOWN'
    
    if (!conditionStats[condition]) {
      conditionStats[condition] = { trades: 0, wins: 0, totalPnl: 0 }
    }
    
    conditionStats[condition].trades++
    conditionStats[condition].totalPnl += trade.pnl || 0
    if ((trade.pnl || 0) > 0) {
      conditionStats[condition].wins++
    }
  }
  
  return Object.entries(conditionStats).map(([condition, stats]) => ({
    condition,
    trades: stats.trades,
    wins: stats.wins,
    winRate: stats.trades > 0 ? Math.round((stats.wins / stats.trades) * 100) : 0,
    avgPnl: stats.trades > 0 ? Math.round((stats.totalPnl / stats.trades) * 100) / 100 : 0
  }))
}

// Calculate score effectiveness
async function analyzeScoreEffectiveness(supabase: any): Promise<{ scoreBucket: string; winRate: number }[]> {
  const { data: signals } = await supabase
    .from('signals')
    .select('raw_score, final_score, id')
    .not('raw_score', 'is', null)
  
  if (!signals || signals.length === 0) return []
  
  const buckets: Record<string, { total: number; wins: number }> = {
    '0-40': { total: 0, wins: 0 },
    '40-60': { total: 0, wins: 0 },
    '60-80': { total: 0, wins: 0 },
    '80-100': { total: 0, wins: 0 }
  }
  
  for (const signal of signals) {
    const score = signal.final_score || signal.raw_score || 0
    let bucket = '0-40'
    if (score >= 80) bucket = '80-100'
    else if (score >= 60) bucket = '60-80'
    else if (score >= 40) bucket = '40-60'
    
    // Check if signal resulted in winning trade
    const { data: trade } = await supabase
      .from('trades')
      .select('pnl')
      .eq('signal_id', signal.id)
      .eq('status', 'CLOSED')
      .maybeSingle()
    
    if (trade) {
      buckets[bucket].total++
      if ((trade.pnl || 0) > 0) buckets[bucket].wins++
    }
  }
  
  return Object.entries(buckets).map(([scoreBucket, stats]) => ({
    scoreBucket,
    winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0
  }))
}

// Calculate exit reason effectiveness
async function analyzeExitReasons(supabase: any): Promise<{ exitType: string; count: number; avgPnl: number }[]> {
  const { data: exits } = await supabase
    .from('trade_exits')
    .select('exit_type, pnl_at_exit')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  
  if (!exits || exits.length === 0) return []
  
  const exitStats: Record<string, { count: number; totalPnl: number }> = {}
  
  for (const exit of exits) {
    const type = exit.exit_type || 'UNKNOWN'
    if (!exitStats[type]) {
      exitStats[type] = { count: 0, totalPnl: 0 }
    }
    exitStats[type].count++
    exitStats[type].totalPnl += exit.pnl_at_exit || 0
  }
  
  return Object.entries(exitStats).map(([exitType, stats]) => ({
    exitType,
    count: stats.count,
    avgPnl: stats.count > 0 ? Math.round((stats.totalPnl / stats.count) * 100) / 100 : 0
  }))
}

// Suggest multiplier adjustments based on analysis
function suggestAdjustments(
  conditionPerf: ConditionPerformance[],
  scoreEffectiveness: { scoreBucket: string; winRate: number }[]
): { adjustmentType: string; currentValue: number; suggestedValue: number; reason: string }[] {
  const adjustments: { adjustmentType: string; currentValue: number; suggestedValue: number; reason: string }[] = []
  
  // Analyze condition performance
  for (const perf of conditionPerf) {
    if (perf.trades >= 5) { // Minimum sample size
      if (perf.condition === 'TRENDING' && perf.winRate < 50) {
        adjustments.push({
          adjustmentType: 'market_multiplier_trending',
          currentValue: 1.2,
          suggestedValue: 1.0,
          reason: `TRENDING condition has ${perf.winRate}% win rate, reduce multiplier`
        })
      }
      if (perf.condition === 'RANGE' && perf.winRate > 60) {
        adjustments.push({
          adjustmentType: 'market_multiplier_range',
          currentValue: 0.8,
          suggestedValue: 0.9,
          reason: `RANGE condition performing well (${perf.winRate}% win rate), increase multiplier`
        })
      }
      if (perf.condition === 'HIGH_VOLATILITY' && perf.winRate < 40) {
        adjustments.push({
          adjustmentType: 'market_multiplier_volatility',
          currentValue: 0.6,
          suggestedValue: 0.4,
          reason: `HIGH_VOLATILITY has poor ${perf.winRate}% win rate, reduce exposure`
        })
      }
    }
  }
  
  // Analyze score effectiveness
  for (const se of scoreEffectiveness) {
    if (se.scoreBucket === '60-80' && se.winRate < 50) {
      adjustments.push({
        adjustmentType: 'min_score_threshold',
        currentValue: 60,
        suggestedValue: 70,
        reason: `Scores 60-80 have ${se.winRate}% win rate, raise threshold`
      })
    }
    if (se.scoreBucket === '80-100' && se.winRate > 70) {
      adjustments.push({
        adjustmentType: 'high_confidence_bonus',
        currentValue: 1.0,
        suggestedValue: 1.1,
        reason: `High score trades have ${se.winRate}% win rate, consider bonus`
      })
    }
  }
  
  return adjustments
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { action, applyAdjustments } = await req.json()
    
    console.log(`[LearningEngine] Action: ${action}`)
    
    if (action === 'analyze') {
      // Perform comprehensive analysis
      const conditionPerformance = await analyzeByCondition(supabase)
      const scoreEffectiveness = await analyzeScoreEffectiveness(supabase)
      const exitAnalysis = await analyzeExitReasons(supabase)
      const suggestedAdjustments = suggestAdjustments(conditionPerformance, scoreEffectiveness)
      
      // Overall stats
      const { data: allTrades } = await supabase
        .from('trades')
        .select('pnl')
        .eq('status', 'CLOSED')
        .gte('closed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      
      const totalTrades = allTrades?.length || 0
      const winningTrades = allTrades?.filter(t => (t.pnl || 0) > 0).length || 0
      const losingTrades = allTrades?.filter(t => (t.pnl || 0) < 0).length || 0
      const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0
      
      const wins = allTrades?.filter(t => (t.pnl || 0) > 0) || []
      const losses = allTrades?.filter(t => (t.pnl || 0) < 0) || []
      const avgWin = wins.length > 0 ? Math.round(wins.reduce((a, b) => a + (b.pnl || 0), 0) / wins.length * 100) / 100 : 0
      const avgLoss = losses.length > 0 ? Math.round(losses.reduce((a, b) => a + Math.abs(b.pnl || 0), 0) / losses.length * 100) / 100 : 0
      
      // Store analysis in learning_adjustments
      for (const adj of suggestedAdjustments) {
        await supabase
          .from('learning_adjustments')
          .upsert({
            condition_type: adj.adjustmentType,
            original_value: adj.currentValue,
            adjusted_value: adj.suggestedValue,
            adjustment_reason: adj.reason,
            trade_count: totalTrades,
            success_rate: winRate,
            last_updated: new Date().toISOString()
          }, { onConflict: 'condition_type' })
      }
      
      // Log analysis
      await supabase.from('system_logs').insert({
        level: 'INFO',
        source: 'learning-engine',
        message: `Analysis complete: ${totalTrades} trades, ${winRate}% win rate`,
        metadata: {
          totalTrades,
          winRate,
          adjustmentsSuggested: suggestedAdjustments.length
        }
      })
      
      return new Response(
        JSON.stringify({
          success: true,
          analysis: {
            period: '7 days',
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            avgWin,
            avgLoss,
            riskRewardRatio: avgLoss > 0 ? Math.round((avgWin / avgLoss) * 100) / 100 : 0
          },
          conditionPerformance,
          scoreEffectiveness,
          exitAnalysis,
          suggestedAdjustments
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (action === 'apply_adjustments' && applyAdjustments) {
      // Fetch current rules
      const { data: rules } = await supabase
        .from('trading_rules')
        .select('*')
        .eq('rule_name', 'default')
        .maybeSingle()
      
      if (!rules) {
        throw new Error('Default trading rules not found')
      }
      
      // Fetch pending adjustments
      const { data: adjustments } = await supabase
        .from('learning_adjustments')
        .select('*')
        .gte('last_updated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      
      if (!adjustments || adjustments.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No recent adjustments to apply' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Apply adjustments conservatively (gradual changes)
      const newRules = { ...rules }
      const appliedChanges: string[] = []
      
      for (const adj of adjustments) {
        if (adj.condition_type === 'min_score_threshold') {
          // Gradual change - move 20% toward suggested value
          const delta = (adj.adjusted_value - rules.min_score_threshold) * 0.2
          newRules.min_score_threshold = Math.round(rules.min_score_threshold + delta)
          appliedChanges.push(`min_score_threshold: ${rules.min_score_threshold} -> ${newRules.min_score_threshold}`)
        }
      }
      
      if (appliedChanges.length > 0) {
        await supabase
          .from('trading_rules')
          .update({
            ...newRules,
            last_updated: new Date().toISOString(),
            metadata: {
              ...rules.metadata,
              lastAdjustment: new Date().toISOString(),
              appliedChanges
            }
          })
          .eq('rule_name', 'default')
        
        await supabase.from('system_logs').insert({
          level: 'INFO',
          source: 'learning-engine',
          message: `Applied ${appliedChanges.length} rule adjustments`,
          metadata: { appliedChanges }
        })
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          appliedChanges,
          message: `Applied ${appliedChanges.length} adjustments`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[LearningEngine] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
