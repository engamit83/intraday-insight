// sectors.ts - NSE sector of each scout stock, for the 'one stock per sector at a time' rule (v4.1).
// Used by the back-tester and the live scout, so both apply the SAME grouping. A stock not listed is its own sector.
export const SECTOR: Record<string, string> = {
  HDFCBANK: 'bank', ICICIBANK: 'bank', SBIN: 'bank', KOTAKBANK: 'bank', AXISBANK: 'bank', INDUSINDBK: 'bank',
  BAJFINANCE: 'finance', BAJAJFINSV: 'finance', SBILIFE: 'insurance', HDFCLIFE: 'insurance',
  TCS: 'it', INFY: 'it', WIPRO: 'it', HCLTECH: 'it', TECHM: 'it',
  RELIANCE: 'energy', ONGC: 'energy', BPCL: 'energy', COALINDIA: 'energy', NTPC: 'power', POWERGRID: 'power',
  HINDUNILVR: 'fmcg', ITC: 'fmcg', NESTLEIND: 'fmcg', BRITANNIA: 'fmcg', TATACONSUM: 'fmcg',
  MARUTI: 'auto', 'M&M': 'auto', TMPV: 'auto', TMCV: 'auto', EICHERMOT: 'auto', HEROMOTOCO: 'auto', 'BAJAJ-AUTO': 'auto',
  TATASTEEL: 'metal', JSWSTEEL: 'metal', HINDALCO: 'metal',
  ULTRACEMCO: 'cement', GRASIM: 'cement',
  SUNPHARMA: 'pharma', CIPLA: 'pharma', DRREDDY: 'pharma', DIVISLAB: 'pharma', APOLLOHOSP: 'health',
  ASIANPAINT: 'consumer', TITAN: 'consumer', BHARTIARTL: 'telecom', LT: 'infra', ADANIENT: 'adani', ADANIPORTS: 'adani',
}

export const sectorOf = (symbol: string): string => SECTOR[symbol] ?? symbol
