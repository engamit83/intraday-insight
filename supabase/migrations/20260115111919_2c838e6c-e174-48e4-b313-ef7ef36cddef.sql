-- Remove public read access from trading_rules
-- Trading algorithm parameters should not be publicly readable

DROP POLICY IF EXISTS "Trading rules are viewable by everyone" ON public.trading_rules;

-- Create policy for authenticated users only
CREATE POLICY "Authenticated users can view active rules" 
  ON public.trading_rules 
  FOR SELECT 
  USING (is_active = true AND auth.uid() IS NOT NULL);