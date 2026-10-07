// Paste into the browser Console (F12) on your signed-in app tab, then press Enter.
// READ-ONLY: downloads Sharekhan's past candles for the 49 scout stocks and saves
// them as a file (history-5minute-<date>.json) in your Downloads folder.
// Needs a fresh Sharekhan connection (app -> Settings -> Connect Sharekhan).
// Takes about 30 seconds. Send the downloaded file to Claude for the back-test.
(async () => {
  const INTERVAL = '5minute'
  const UNIVERSE = ['RELIANCE','TCS','HDFCBANK','ICICIBANK','INFY','HINDUNILVR','ITC','SBIN',
    'BHARTIARTL','KOTAKBANK','LT','AXISBANK','ASIANPAINT','MARUTI','SUNPHARMA',
    'TITAN','ULTRACEMCO','BAJFINANCE','NESTLEIND','WIPRO','HCLTECH','ONGC',
    'NTPC','POWERGRID','M&M','TMPV','TMCV','TATASTEEL','JSWSTEEL','ADANIENT',
    'ADANIPORTS','COALINDIA','BAJAJFINSV','TECHM','INDUSINDBK','HINDALCO',
    'GRASIM','CIPLA','DRREDDY','EICHERMOT','APOLLOHOSP','DIVISLAB','BPCL',
    'BRITANNIA','HEROMOTOCO','SBILIFE','HDFCLIFE','TATACONSUM','BAJAJ-AUTO']
  const k = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  const t = JSON.parse(localStorage.getItem(k)).access_token
  const all = { interval: INTERVAL, fetchedAt: new Date().toISOString(), results: {}, unresolved: [] }
  for (let i = 0; i < UNIVERSE.length; i += 10) {
    const batch = UNIVERSE.slice(i, i + 10)
    console.log('Fetching ' + batch.join(', ') + ' ...')
    const r = await fetch('https://emxhhxvtbjsjtjacbike.supabase.co/functions/v1/history-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
      body: JSON.stringify({ symbols: batch, interval: INTERVAL })
    }).then(r => r.json())
    if (r.error) { console.log('ERROR: ' + r.error + ' ' + (r.hint || '')); return }
    Object.assign(all.results, r.results)
    all.unresolved.push(...(r.unresolved || []))
  }
  const lines = Object.entries(all.results).map(([s, v]) =>
    v.candles ? `${s}: ${v.candles.length} candles, ${v.candles[0][0].slice(0, 10)} to ${v.candles[v.candles.length - 1][0].slice(0, 10)}` : `${s}: ERROR ${v.error}`)
  console.log(lines.join('\n') + '\nUnresolved: ' + (all.unresolved.join(', ') || 'none'))
  const blob = new Blob([JSON.stringify(all)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `history-${INTERVAL}-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a); a.click(); a.remove()
  console.log('Saved ' + a.download + ' to your Downloads folder. Send it to Claude.')
})()
