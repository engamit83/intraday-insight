-- Paper trader setup (16 Oct). Safe to run more than once. Adds columns only; changes no existing data.
ALTER TABLE public.simulated_trades
  ADD COLUMN IF NOT EXISTS rules text,
  ADD COLUMN IF NOT EXISTS stoploss numeric,
  ADD COLUMN IF NOT EXISTS initial_stop numeric,
  ADD COLUMN IF NOT EXISTS target numeric,
  ADD COLUMN IF NOT EXISTS stop_dist numeric,
  ADD COLUMN IF NOT EXISTS atr numeric,
  ADD COLUMN IF NOT EXISTS at_breakeven boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS best_exc numeric,
  ADD COLUMN IF NOT EXISTS best_close numeric,
  ADD COLUMN IF NOT EXISTS last_bucket timestamptz,
  ADD COLUMN IF NOT EXISTS gross_pct numeric,
  ADD COLUMN IF NOT EXISTS net_pct numeric,
  ADD COLUMN IF NOT EXISTS costs_rs numeric,
  ADD COLUMN IF NOT EXISTS details jsonb;
CREATE INDEX IF NOT EXISTS simulated_trades_rules_entry_idx ON public.simulated_trades (rules, entry_time);
