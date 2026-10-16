import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RecentTrade {
  id: string;
  symbol: string;
  trade_type: string;
  entry_price: number;
  exit_price: number | null;
  pnl: number | null;
  pnl_percentage: number | null;
  status: string;
  opened_at: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentTrades() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchTrades = async () => {
      setLoading(true);
      // the automatic paper trades (rule set v4); real manual trades are on the Manual Trades page
      const { data, error } = await supabase
        .from("simulated_trades")
        .select("id, symbol, direction, entry_price, exit_price, pnl, net_pct, status, entry_time")
        .eq("rules", "v4")
        .order("entry_time", { ascending: false })
        .limit(5);

      if (!error) setTrades((data || []).map((t) => ({
        id: t.id, symbol: t.symbol, trade_type: t.direction ?? "BUY", entry_price: t.entry_price, exit_price: t.exit_price,
        pnl: t.pnl, pnl_percentage: t.net_pct, status: t.status ?? "OPEN", opened_at: t.entry_time ?? new Date().toISOString(),
      })));
      setLoading(false);
    };
    fetchTrades();
  }, [user]);

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-foreground">Recent Paper Trades</h3>
        <Badge variant="outline" className="text-xs">
          Paper
        </Badge>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      ) : trades.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No paper trades yet.</p>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => {
            const pnl = trade.pnl ?? 0;
            const isPositive = pnl >= 0;
            const isBuy = trade.trade_type === "BUY";

            return (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    isBuy ? "bg-bullish/10" : "bg-bearish/10"
                  )}>
                    {isBuy ? (
                      <ArrowUpRight className="h-5 w-5 text-bullish" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5 text-bearish" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{trade.symbol}</p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs px-1.5 py-0",
                          trade.status === "OPEN" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {trade.status === "OPEN" ? (
                          <Clock className="h-3 w-3 mr-1" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {trade.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ₹{trade.entry_price.toFixed(2)} → {trade.exit_price ? `₹${trade.exit_price.toFixed(2)}` : 'Open'} · {timeAgo(trade.opened_at)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={cn(
                    "font-mono font-semibold",
                    isPositive ? "text-bullish" : "text-bearish"
                  )}>
                    {trade.pnl != null ? `${isPositive ? "+" : ""}₹${trade.pnl.toFixed(2)}` : "-"}
                  </p>
                  {trade.pnl_percentage != null && (
                    <p className={cn(
                      "text-xs font-mono",
                      isPositive ? "text-bullish" : "text-bearish"
                    )}>
                      {isPositive ? "+" : ""}{trade.pnl_percentage.toFixed(2)}%
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
