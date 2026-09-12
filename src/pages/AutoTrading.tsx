import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  TrendingDown,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Reality check (see chat): no code path in this project ever creates a
// trade_mode='AUTO' row, and there's no scheduler invoking trading-intelligence
// automatically. So this page shows the real `trading_state` flag and daily
// counters (both genuinely wired to the backend), but does NOT show a fake
// "open positions" list, because there is no real data source for one yet.
interface TradingState {
  trades_today: number;
  daily_pnl: number;
  consecutive_losses: number;
  auto_mode_active: boolean;
  stop_reason: string | null;
}

export default function AutoTrading() {
  const [state, setState] = useState<TradingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("trading-intelligence", {
      body: { action: "get_status" },
    });

    if (error || data?.success === false) {
      console.error(error);
      toast.error("Failed to load trading state");
      setLoading(false);
      return;
    }

    setState(data.tradingState);
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    const { data, error } = await supabase.functions.invoke("trading-intelligence", {
      body: { action: "update_state", autoModeActive: checked },
    });
    setToggling(false);

    if (error || data?.success === false) {
      console.error(error);
      toast.error("Failed to update auto-mode flag");
      return;
    }

    setState((prev) => (prev ? { ...prev, auto_mode_active: checked } : prev));
    toast.success(`Auto-mode flag set to ${checked ? "ON" : "OFF"}`);
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auto Trading</h1>
          <p className="text-muted-foreground">Automated entry-control flag &amp; daily risk state</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 glass-card rounded-lg px-4 py-2">
            <span className="text-sm font-medium text-foreground">Auto-Mode Flag</span>
            <Switch
              checked={state?.auto_mode_active ?? false}
              onCheckedChange={handleToggle}
              disabled={loading || toggling}
            />
            {state?.auto_mode_active ? (
              <Badge className="bg-bullish text-bullish-foreground">
                <Play className="h-3 w-3 mr-1" /> ON
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Pause className="h-3 w-3 mr-1" /> OFF
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Honesty banner */}
      <div className="glass-card rounded-xl p-4 mb-6 border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">No automatic execution exists yet.</span> This
            toggle writes a real flag (<code>trading_state.auto_mode_active</code>) that the
            signal-scoring backend checks, but nothing in this project currently runs on a
            schedule to actually place trades using it. Use the Signals page + Simulator mode
            in Settings to place trades manually for now.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading trading state...</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Trades Today</p>
            <p className="text-2xl font-bold font-mono text-foreground">{state?.trades_today ?? 0}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Daily P&L</p>
            <p className={cn(
              "text-2xl font-bold font-mono",
              (state?.daily_pnl ?? 0) >= 0 ? "text-bullish" : "text-bearish"
            )}>
              {(state?.daily_pnl ?? 0) >= 0 ? "+" : ""}₹{(state?.daily_pnl ?? 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Consecutive Losses</p>
            <p className="text-2xl font-bold font-mono text-foreground">{state?.consecutive_losses ?? 0}</p>
          </div>
          {state?.stop_reason && (
            <div className="glass-card rounded-xl p-4 md:col-span-3 border-bearish/30 bg-bearish/5">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-bearish" />
                <p className="text-sm text-bearish font-medium">Stopped: {state.stop_reason}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
