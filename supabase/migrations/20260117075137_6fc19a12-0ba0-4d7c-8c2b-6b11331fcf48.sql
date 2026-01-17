-- Fix PUBLIC_DATA_EXPOSURE: trade_exits table has public read policy
-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Trade exits are viewable by everyone" ON public.trade_exits;

-- Create user-scoped SELECT policy - users can only see exits for their own trades
CREATE POLICY "Users can view their own trade exits"
  ON public.trade_exits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trades
      WHERE trades.id = trade_exits.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- Create INSERT policy - users can only create exits for their own trades
CREATE POLICY "Users can create their own trade exits"
  ON public.trade_exits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trades
      WHERE trades.id = trade_exits.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- Create UPDATE policy - users can only update exits for their own trades
CREATE POLICY "Users can update their own trade exits"
  ON public.trade_exits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trades
      WHERE trades.id = trade_exits.trade_id
      AND trades.user_id = auth.uid()
    )
  );

-- Create DELETE policy - users can only delete exits for their own trades
CREATE POLICY "Users can delete their own trade exits"
  ON public.trade_exits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trades
      WHERE trades.id = trade_exits.trade_id
      AND trades.user_id = auth.uid()
    )
  );