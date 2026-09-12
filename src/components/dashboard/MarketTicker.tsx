import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Honesty note: the `stocks` table only stores symbol/last_price/sector —
// there's no prior-close or index data, so change/% figures the old mock
// showed (and NIFTY/SENSEX index rows) can't be sourced for real. This shows
// whatever real rows exist in `stocks`, price-only.
interface TickerStock {
  symbol: string;
  last_price: number | null;
}

export function MarketTicker() {
  const [stocks, setStocks] = useState<TickerStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStocks = async () => {
      const { data, error } = await supabase
        .from("stocks")
        .select("symbol, last_price")
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
          No stock price data yet — the `stocks` table is empty. This fills in once the market-data pipeline runs.
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
          </div>
        ))}
      </div>
    </div>
  );
}
