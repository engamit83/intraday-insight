// Starter universe for the scout: liquid large-cap NSE stocks.
//
// This is a STARTING POINT, not an authoritative index list. Index membership
// and tickers change over time (mergers, demergers, renames). The scout
// reports any symbol it can't find in the scripcodes table as "unresolved",
// so stale entries show up in its output — edit this list as needed.
//
// Why a modest list and not "all NSE stocks": Sharekhan's REST historical
// endpoint is one request per symbol and its quote-rate limits are not
// published, so scanning thousands of symbols over REST is not workable.
// A WebSocket feed is the path to scanning more (up to 1,000 symbols per
// connection) — planned as a later phase.

export const STARTER_UNIVERSE: string[] = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'INFY', 'HINDUNILVR', 'ITC', 'SBIN',
  'BHARTIARTL', 'KOTAKBANK', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA',
  'TITAN', 'ULTRACEMCO', 'BAJFINANCE', 'NESTLEIND', 'WIPRO', 'HCLTECH', 'ONGC',
  'NTPC', 'POWERGRID', 'M&M', 'TATAMOTORS', 'TATASTEEL', 'JSWSTEEL', 'ADANIENT',
  'ADANIPORTS', 'COALINDIA', 'BAJAJFINSV', 'TECHM', 'INDUSINDBK', 'HINDALCO',
  'GRASIM', 'CIPLA', 'DRREDDY', 'EICHERMOT', 'APOLLOHOSP', 'DIVISLAB', 'BPCL',
  'BRITANNIA', 'HEROMOTOCO', 'SBILIFE', 'HDFCLIFE', 'TATACONSUM', 'BAJAJ-AUTO',
]
