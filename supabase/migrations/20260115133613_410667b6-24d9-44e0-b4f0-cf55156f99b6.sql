-- Fix simulated_trades NULL user exposure - remove OR (user_id IS NULL) from all policies

DROP POLICY IF EXISTS "Users can view their own simulated trades" ON public.simulated_trades;
DROP POLICY IF EXISTS "Users can create their own simulated trades" ON public.simulated_trades;
DROP POLICY IF EXISTS "Users can update their own simulated trades" ON public.simulated_trades;
DROP POLICY IF EXISTS "Users can delete their own simulated trades" ON public.simulated_trades;

-- Recreate policies without NULL user access
CREATE POLICY "Users can view their own simulated trades" 
ON public.simulated_trades 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own simulated trades" 
ON public.simulated_trades 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own simulated trades" 
ON public.simulated_trades 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own simulated trades" 
ON public.simulated_trades 
FOR DELETE 
USING (auth.uid() = user_id);