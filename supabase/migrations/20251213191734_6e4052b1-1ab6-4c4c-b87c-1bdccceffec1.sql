-- Phase-2: Trading Intelligence Tables

-- Market conditions tracking
CREATE TABLE public.market_conditions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condition text NOT NULL CHECK (condition IN ('TRENDING', 'RANGE', 'HIGH_VOLATILITY', 'NO_TRADE')),
  index_direction text,
  volatility_level numeric,
  volume_behavior text,
  time_of_day text,
  confidence numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.market_conditions ENABLE ROW LEVEL SECURITY;

-- Public read access for market conditions
CREATE POLICY "Market conditions are viewable by everyone" 
ON public.market_conditions FOR SELECT USING (true);

CREATE POLICY "Service role can manage market_conditions" 
ON public.market_conditions FOR ALL USING (true);

-- Trading rules for adaptive scoring
CREATE TABLE public.trading_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name text NOT NULL UNIQUE,
  market_multiplier numeric DEFAULT 1.0,
  risk_multiplier numeric DEFAULT 1.0,
  time_multiplier numeric DEFAULT 1.0,
  min_score_threshold numeric DEFAULT 60,
  max_daily_trades integer DEFAULT 10,
  max_daily_loss numeric DEFAULT 5000,
  consecutive_loss_limit integer DEFAULT 3,
  is_active boolean DEFAULT true,
  last_updated timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.trading_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trading rules are viewable by everyone" 
ON public.trading_rules FOR SELECT USING (true);

CREATE POLICY "Service role can manage trading_rules" 
ON public.trading_rules FOR ALL USING (true);

-- Insert default trading rules
INSERT INTO public.trading_rules (rule_name, market_multiplier, risk_multiplier, time_multiplier, min_score_threshold, max_daily_trades, max_daily_loss, consecutive_loss_limit)
VALUES ('default', 1.0, 1.0, 1.0, 60, 10, 5000, 3);

-- Trading state for capital protection
CREATE TABLE public.trading_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  trades_today integer DEFAULT 0,
  daily_pnl numeric DEFAULT 0,
  consecutive_losses integer DEFAULT 0,
  auto_mode_active boolean DEFAULT true,
  stop_reason text,
  last_trade_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.trading_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trading state" 
ON public.trading_state FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own trading state" 
ON public.trading_state FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own trading state" 
ON public.trading_state FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can manage trading_state" 
ON public.trading_state FOR ALL USING (true);

-- Trade exits tracking with reasons
CREATE TABLE public.trade_exits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id uuid REFERENCES public.trades(id),
  exit_reason text NOT NULL,
  exit_type text CHECK (exit_type IN ('TARGET_HIT', 'STOPLOSS_HIT', 'EARLY_EXIT', 'MANUAL', 'AUTO_STOP')),
  momentum_at_exit numeric,
  volume_at_exit numeric,
  vwap_position text,
  market_condition text,
  time_held_minutes integer,
  pnl_at_exit numeric,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_exits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trade exits are viewable by everyone" 
ON public.trade_exits FOR SELECT USING (true);

CREATE POLICY "Service role can manage trade_exits" 
ON public.trade_exits FOR ALL USING (true);

-- Learning adjustments table
CREATE TABLE public.learning_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condition_type text NOT NULL,
  original_value numeric,
  adjusted_value numeric,
  adjustment_reason text,
  trade_count integer DEFAULT 0,
  success_rate numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  last_updated timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.learning_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learning adjustments are viewable by everyone" 
ON public.learning_adjustments FOR SELECT USING (true);

CREATE POLICY "Service role can manage learning_adjustments" 
ON public.learning_adjustments FOR ALL USING (true);

-- Add new columns to signals table for adaptive scoring
ALTER TABLE public.signals 
ADD COLUMN IF NOT EXISTS raw_score numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_score numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS market_condition text,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS is_tradable boolean DEFAULT true;

-- Add exit tracking columns to trades table
ALTER TABLE public.trades
ADD COLUMN IF NOT EXISTS exit_reason text,
ADD COLUMN IF NOT EXISTS time_held_minutes integer,
ADD COLUMN IF NOT EXISTS momentum_at_entry numeric,
ADD COLUMN IF NOT EXISTS momentum_at_exit numeric;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_conditions_created ON public.market_conditions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trading_state_date ON public.trading_state(date);
CREATE INDEX IF NOT EXISTS idx_trade_exits_trade_id ON public.trade_exits(trade_id);
CREATE INDEX IF NOT EXISTS idx_signals_final_score ON public.signals(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_is_tradable ON public.signals(is_tradable);

-- Trigger to update trading_state.updated_at
CREATE TRIGGER update_trading_state_updated_at
BEFORE UPDATE ON public.trading_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();