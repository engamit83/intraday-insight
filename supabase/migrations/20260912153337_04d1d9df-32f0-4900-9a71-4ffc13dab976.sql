-- 1) Fix mis-scoped "Service role can manage X" policies: scope them to the service_role only
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['stocks','signals','indicator_cache','system_logs','market_conditions','trading_rules','trading_state','trade_exits','learning_adjustments','scripcodes','simulated_trades'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role can manage %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role can manage all %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Service role can manage %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- 2) trading_state: remove the NULL user_id bypass; strict owner-only access for users
DROP POLICY IF EXISTS "Users can insert their own trading state" ON public.trading_state;
DROP POLICY IF EXISTS "Users can update their own trading state" ON public.trading_state;
DROP POLICY IF EXISTS "Users can view their own trading state" ON public.trading_state;

CREATE POLICY "Users can insert their own trading state"
  ON public.trading_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trading state"
  ON public.trading_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own trading state"
  ON public.trading_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3) user_settings: explicit service-role management policy (tokens/secrets server-managed)
DROP POLICY IF EXISTS "Service role can manage user_settings" ON public.user_settings;
CREATE POLICY "Service role can manage user_settings"
  ON public.user_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);