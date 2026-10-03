// Scheduler Job - Update Prices and Indicators for the symbols the app already
// tracks (watchlists + active signals). Sharekhan is the only data source.
// (Discovering NEW candidates across the market is the job of scout-signals.)
//
// Fixes vs. the previous version:
//  - Token: if the caller doesn't pass one, the stored Sharekhan token is read
//    server-side (scheduled runs previously had no way to authenticate).
//  - Auth: exact service-role match (the old prefix check passed for anyone
//    holding the public anon key).
//  - Scrip codes: resolved from the scripcodes table instead of a hardcoded map
//    that contained duplicate codes (INFY/ICICIBANK, TATAMOTORS/TATACONSUM).
//  - Indicators: shared, corrected implementation (RSI/ATR now use the latest
//    candles, MACD is actually computed).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyAuth, corsHeaders, isServiceRoleRequest } from '../_shared/auth.ts'
import { computeIndicators } from '../_shared/indicators.ts'
import { loadStoredSharekhanToken, resolveScripCodes, fetchCandles, delay } from '../_shared/sharekhan.ts'

interface UpdateResult {
  symbol: string
  success: boolean
  source: string
  error?: string
  indicators?: Record<string, unknown>
}

const cleanSymbol = (symbol: string) => symbol.replace(/\.(NS|NSE|BSE|BO)$/i, '').toUpperCase()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Service role (scheduled job) OR a signed-in user.
  if (!isServiceRoleRequest(req)) {
    const authResult = await verifyAuth(req)
    if (!authResult.authenticated) {
      return new Response(
        JSON.stringify({ error: 'Authentication required. Use service role for cron or JWT for manual triggers.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    console.log(`[Scheduler] Manual trigger by user: ${authResult.userId}`)
  } else {
    console.log('[Scheduler] Service role request (cron job)')
  }

  const startTime = Date.now()
  const results: UpdateResult[] = []

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey)
    const sharekhanApiKey = Deno.env.get('SHAREKHAN_API_KEY')

    // Token: explicit body value wins, otherwise the stored (decrypted) one.
    const body = await req.json().catch(() => ({}))
    let accessToken: string | undefined = body.accessToken || body.sharekhanAccessToken
    if (!accessToken) {
      accessToken = (await loadStoredSharekhanToken(supabase))?.accessToken
    }

    console.log('[Scheduler] Starting market data update job')
    console.log(`[Scheduler] Sharekhan configured: ${!!sharekhanApiKey && !!accessToken}`)

    // Symbols the app already tracks: watchlists + active signals.
    const { data: watchlistItems } = await supabase.from('watchlist').select('symbol')
    const { data: activeSignals } = await supabase.from('signals').select('symbol').eq('is_active', true)

    const symbolSet = new Set<string>()
    watchlistItems?.forEach((item: any) => symbolSet.add(cleanSymbol(item.symbol)))
    activeSignals?.forEach((s: any) => symbolSet.add(cleanSymbol(s.symbol)))
    if (symbolSet.size === 0) {
      ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'].forEach((s) => symbolSet.add(s))
    }

    const symbols = Array.from(symbolSet)
    const { codes } = await resolveScripCodes(supabase, symbols)
    console.log(`[Scheduler] Processing ${symbols.length} symbols: ${symbols.join(', ')}`)

    for (const symbol of symbols) {
      let error: string | null = null
      let updated = false

      if (!sharekhanApiKey || !accessToken) {
        error = 'Sharekhan not configured or not connected'
      } else if (!codes[symbol]) {
        error = `No scrip code for ${symbol} in scripcodes table (run scrip-master-sync)`
      } else {
        const fetched = await fetchCandles(codes[symbol], sharekhanApiKey, accessToken)
        if (!fetched.candles) {
          error = fetched.error
          console.log(`[Scheduler] ${symbol}: Sharekhan failed - ${fetched.error}`)
        } else {
          const ind = computeIndicators(fetched.candles)
          if (ind.lastClose) {
            await supabase.from('stocks').upsert(
              { symbol, last_price: ind.lastClose, updated_at: new Date().toISOString() },
              { onConflict: 'symbol' },
            )
            await supabase.from('indicator_cache').upsert({
              symbol, timeframe: '5min', vwap: ind.vwap, rsi: ind.rsi, macd: ind.macd, macd_signal: ind.macdSignal,
              macd_histogram: ind.macdHistogram, atr: ind.atr, relative_volume: ind.relativeVolume,
              trend_strength: ind.trendStrength, pattern_detected: ind.patternDetected,
              raw_data: fetched.candles.slice(0, 40), computed_at: new Date().toISOString(),
            }, { onConflict: 'symbol,timeframe' })
            results.push({
              symbol, success: true, source: 'sharekhan',
              indicators: { price: ind.lastClose, vwap: ind.vwap, rsi: ind.rsi, trend: ind.trendStrength },
            })
            updated = true
            console.log(`[Scheduler] ${symbol}: Updated price=${ind.lastClose}, RSI=${ind.rsi}`)
          } else {
            error = 'candles had no usable close price'
          }
        }
      }

      if (!updated) {
        results.push({ symbol, success: false, source: 'none', error: error || 'No data available' })
        await supabase.from('system_logs').insert({
          level: 'WARN', source: 'update-market-data', message: `Failed to update ${symbol}`, metadata: { symbol, error },
        })
      }

      await delay(400)
    }

    const duration = Date.now() - startTime
    const successCount = results.filter((r) => r.success).length

    await supabase.from('system_logs').insert({
      level: 'INFO', source: 'update-market-data',
      message: `Job completed: ${successCount}/${symbols.length} symbols (Sharekhan: ${successCount})`,
      metadata: { duration, totalSymbols: symbols.length, successCount, sharekhanCount: successCount },
    })

    return new Response(
      JSON.stringify({
        success: true, processed: symbols.length, successful: successCount,
        sources: { sharekhan: successCount }, duration: `${duration}ms`, results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[Scheduler] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
