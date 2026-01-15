-- Drop the overly permissive public read policy on signals table
DROP POLICY IF EXISTS "Signals are viewable by everyone" ON public.signals;

-- Create a new policy that restricts signals to authenticated users only
CREATE POLICY "Authenticated users can view signals" 
ON public.signals 
FOR SELECT 
USING (auth.uid() IS NOT NULL);