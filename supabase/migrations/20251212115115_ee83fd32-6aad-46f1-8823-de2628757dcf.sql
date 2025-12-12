-- TASK 1+2: Database Schema for Intraday Trading App

-- Stocks table
CREATE TABLE public.stocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT,
  sector TEXT,
  last_price DECIMAL(12,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signals table (AI-generated trading signals)
CREATE TABLE public.signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY', 'SELL')),
  entry_price DECIMAL(12,2) NOT NULL,
  target_price DECIMAL(12,2) NOT NULL,
  stoploss_price DECIMAL(12,2) NOT NULL,
  confidence DECIMAL(5,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  timeframe TEXT DEFAULT '1min',
  indicators JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Trades table (virtual and manual trades)
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES public.signals(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
  entry_price DECIMAL(12,2) NOT NULL,
  exit_price DECIMAL(12,2),
  quantity INTEGER NOT NULL DEFAULT 1,
  pnl DECIMAL(12,2),
  pnl_percentage DECIMAL(8,4),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
  trade_mode TEXT NOT NULL DEFAULT 'MANUAL' CHECK (trade_mode IN ('AUTO', 'MANUAL')),
  notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- Watchlist table
CREATE TABLE public.watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  company_name TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

-- Daily performance table
CREATE TABLE public.daily_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_pnl DECIMAL(12,2) DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  best_stock TEXT,
  worst_stock TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- User settings table
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  alpha_vantage_api_key TEXT,
  max_trades_per_day INTEGER DEFAULT 10,
  auto_mode_enabled BOOLEAN DEFAULT false,
  risk_level TEXT DEFAULT 'MEDIUM' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  default_stoploss_percent DECIMAL(5,2) DEFAULT 2.00,
  notification_enabled BOOLEAN DEFAULT true,
  preferred_sectors TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indicator cache table (stores computed indicators)
CREATE TABLE public.indicator_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '1min',
  vwap DECIMAL(12,4),
  rsi DECIMAL(8,4),
  macd DECIMAL(12,6),
  macd_signal DECIMAL(12,6),
  macd_histogram DECIMAL(12,6),
  atr DECIMAL(12,4),
  relative_volume DECIMAL(8,4),
  trend_strength DECIMAL(5,2),
  pattern_detected TEXT,
  raw_data JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(symbol, timeframe)
);

-- Logs table for error tracking
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'INFO' CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicator_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for stocks and signals (market data is public)
CREATE POLICY "Stocks are viewable by everyone" ON public.stocks FOR SELECT USING (true);
CREATE POLICY "Signals are viewable by everyone" ON public.signals FOR SELECT USING (true);
CREATE POLICY "Indicator cache is viewable by everyone" ON public.indicator_cache FOR SELECT USING (true);

-- Service role can manage stocks, signals, indicators, and logs
CREATE POLICY "Service role can manage stocks" ON public.stocks FOR ALL USING (true);
CREATE POLICY "Service role can manage signals" ON public.signals FOR ALL USING (true);
CREATE POLICY "Service role can manage indicator_cache" ON public.indicator_cache FOR ALL USING (true);
CREATE POLICY "Service role can manage logs" ON public.system_logs FOR ALL USING (true);

-- User-specific RLS policies for trades
CREATE POLICY "Users can view their own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

-- User-specific RLS policies for watchlist
CREATE POLICY "Users can view their own watchlist" ON public.watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to their own watchlist" ON public.watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from their own watchlist" ON public.watchlist FOR DELETE USING (auth.uid() = user_id);

-- User-specific RLS policies for daily_performance
CREATE POLICY "Users can view their own performance" ON public.daily_performance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own performance" ON public.daily_performance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own performance" ON public.daily_performance FOR UPDATE USING (auth.uid() = user_id);

-- User-specific RLS policies for settings
CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_signals_symbol ON public.signals(symbol);
CREATE INDEX idx_signals_active ON public.signals(is_active) WHERE is_active = true;
CREATE INDEX idx_trades_user ON public.trades(user_id);
CREATE INDEX idx_trades_status ON public.trades(status);
CREATE INDEX idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX idx_indicator_cache_symbol ON public.indicator_cache(symbol);
CREATE INDEX idx_system_logs_level ON public.system_logs(level);
CREATE INDEX idx_system_logs_created ON public.system_logs(created_at DESC);

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_stocks_updated_at
  BEFORE UPDATE ON public.stocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();