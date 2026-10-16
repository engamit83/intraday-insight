import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Honesty note: the `stocks` table only stores symbol/last_price/sector —
// there's no prior-close or index data, so change/% figures the old mock
// showed (and NIFTY/SENSEX index rows) can't be sourced for real. This shows
// whatever real rows exist in `stocks`, price-only.
interface TickerStock {
  symbol: string;
  last_price: number | null;
  updated_at: string;
}
const istTime = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().replace("T", " ").slice(5, 16)

export function MarketTicker() {
  const [stocks, setStocks] = useState<TickerStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStocks = async () => {
      const { data, error } = await supabase
        .from("stocks")
        .select("symbol, last_price, updated_at")
        .order("updated_at", { ascending: false })
        .limit(20);

      if (!error) setStocks(data || []);
      setLoading(false);
    };
    fetchStocks();
  }, []);

  if (loading) {
    return (
      <div className="overflow-hidden border-b border-border bg-secondary/30 py-2 px-6">
        <span className="text-sm text-muted-foreground">Loading market data...</span>
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="overflow-hidden border-b border-border bg-secondary/30 py-2 px-6">
        <span className="text-sm text-muted-foreground">
          No saved stock prices yet.
        </span>
      </div>
    );
  }

  // prices older than 1 day are not shown as if they were current
  const newest = Math.max(...stocks.map((s) => Date.parse(s.updated_at)))
  if (Date.now() - newest > 24 * 60 * 60 * 1000) {
    return (
      <div className="overflow-hidden border-b border-border bg-secondary/30 py-2 px-6">
        <span className="text-sm text-muted-foreground">
          Price strip paused: the saved prices are old (last update {istTime(new Date(newest).toISOString())} IST).
        </span>
      </div>
    );
  }
  const duplicatedData = [...stocks, ...stocks];

  return (
    <div className="overflow-hidden border-b border-border bg-secondary/30">
      <div className="flex animate-[ticker_40s_linear_infinite] whitespace-nowrap py-2">
        {duplicatedData.map((item, index) => (
          <div
            key={`${item.symbol}-${index}`}
            className="flex items-center gap-4 px-6 border-r border-border/30"
          >
            <span className="font-mono text-sm font-semibold text-foreground">
              {item.symbol}
            </span>
            <span className="font-mono text-sm text-foreground">
              {item.last_price != null
                ? `₹${item.last_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                : "No price yet"}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{istTime(item.updated_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
