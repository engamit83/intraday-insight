import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SimulatorStatus {
  simulatorEnabled: boolean;
  openTrades: number;
  todayPnl: number;
  todayTrades: number;
  winRate: number;
  trades: any[];
}

export function useSimulatorStatus() {
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('simulate-trade', {
        body: { action: 'get_status' }
      });

      if (fnError) throw fnError;
      setStatus(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch simulator status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, loading, error, refetch: fetchStatus };
}
