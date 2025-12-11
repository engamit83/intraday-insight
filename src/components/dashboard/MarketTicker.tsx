import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const tickerData = [
  { symbol: "NIFTY 50", value: 24850.45, change: 125.30, changePercent: 0.51 },
  { symbol: "SENSEX", value: 81523.16, change: 312.45, changePercent: 0.38 },
  { symbol: "BANK NIFTY", value: 52145.80, change: -89.20, changePercent: -0.17 },
  { symbol: "NIFTY IT", value: 41235.60, change: 256.80, changePercent: 0.63 },
  { symbol: "RELIANCE", value: 2845.50, change: 23.40, changePercent: 0.83 },
  { symbol: "TCS", value: 4125.30, change: -15.20, changePercent: -0.37 },
  { symbol: "HDFC BANK", value: 1685.75, change: 12.50, changePercent: 0.75 },
  { symbol: "INFY", value: 1892.40, change: 28.60, changePercent: 1.53 },
];

export function MarketTicker() {
  const duplicatedData = [...tickerData, ...tickerData];

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
              ₹{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <div className={cn(
              "flex items-center gap-1 font-mono text-sm",
              item.change >= 0 ? "text-bullish" : "text-bearish"
            )}>
              {item.change >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)} ({item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
