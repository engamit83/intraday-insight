-- Create simulated_trades table for paper trading
CREATE TABLE public.simulated_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  symbol text NOT NULL,
  signal_id uuid REFERENCES public.signals(id),
  direction text CHECK (direction IN ('BUY','SELL')),
  entry_price numeric NOT NULL,
  exit_price numeric,
  quantity integer DEFAULT 1,
  status text DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  pnl numeric,
  pnl_percent numeric,
  entry_time timestamptz DEFAULT now(),
  exit_time timestamptz,
  exit_reason text,
  market_condition text,
  confidence_at_entry numeric
);

-- Enable Row Level Security
ALTER TABLE public.simulated_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own simulated trades" 
ON public.simulated_trades 
FOR SELECT 
USING ((auth.uid() = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can create their own simulated trades" 
ON public.simulated_trades 
FOR INSERT 
WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can update their own simulated trades" 
ON public.simulated_trades 
FOR UPDATE 
USING ((auth.uid() = user_id) OR (user_id IS NULL));

CREATE POLICY "Users can delete their own simulated trades" 
ON public.simulated_trades 
FOR DELETE 
USING ((auth.uid() = user_id) OR (user_id IS NULL));

CREATE POLICY "Service role can manage all simulated_trades" 
ON public.simulated_trades 
FOR ALL 
USING (true);

-- Add simulator_mode column to user_settings if not exists
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS simulator_mode text DEFAULT 'SIGNAL_ONLY' CHECK (simulator_mode IN ('SIGNAL_ONLY', 'SIMULATOR', 'AUTO'));