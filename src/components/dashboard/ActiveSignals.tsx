import { useEffect, useState } from "react";
import { SignalCard } from "./SignalCard";
import type { StockSignal } from "@/types/trading";
import { Button } from "@/components/ui/button";
import { ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function ActiveSignals() {
  const [signals, setSignals] = useState<StockSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignals = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("is_active", true)
        .order("confidence", { ascending: false })
        .limit(2);

      if (!error) {
        const mapped: StockSignal[] = (data || []).map((s) => ({
          id: s.id,
          symbol: s.symbol,
          company_name: s.symbol,
          signal_type: s.signal_type as "BUY" | "SELL",
          entry_price: s.entry_price,
          target_price: s.target_price,
          stoploss_price: s.stoploss_price,
          confidence_score: Math.round(s.confidence),
          signal_strength: s.confidence >= 80 ? "STRONG" : s.confidence >= 60 ? "MODERATE" : "WEAK",
          analysis: {
            vwap_analysis: (s.indicators as any)?.vwap_analysis ?? "No VWAP data available",
            volume_analysis: (s.indicators as any)?.volume_analysis ?? "No volume data available",
            trend_analysis: (s.indicators as any)?.trend_analysis ?? "No trend data available",
            pattern_detected: (s.indicators as any)?.pattern_detected ?? "N/A",
            risk_reward_ratio:
              Math.abs(s.target_price - s.entry_price) /
              (Math.abs(s.entry_price - s.stoploss_price) || 1),
          },
          created_at: s.created_at,
          expires_at: s.expires_at ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          is_active: s.is_active ?? true,
        }));
        setSignals(mapped);
      }
      setLoading(false);
    };
    fetchSignals();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Active Signals</h3>
          <p className="text-sm text-muted-foreground">AI-generated trading opportunities</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/signals" className="text-primary">
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading signals...
        </div>
      ) : signals.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No active signals right now.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}
