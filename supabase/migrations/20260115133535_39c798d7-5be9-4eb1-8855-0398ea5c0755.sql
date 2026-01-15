-- Restrict system_logs access to service role only
-- Drop the overly permissive policy that allows public read access
DROP POLICY IF EXISTS "Service role can manage logs" ON public.system_logs;

-- Create a restrictive policy - only service role can access (no authenticated user policy)
-- This effectively makes the table service-role only since RLS is enabled with no user-accessible policy
-- Note: Service role bypasses RLS by default, so no explicit policy needed for service role access