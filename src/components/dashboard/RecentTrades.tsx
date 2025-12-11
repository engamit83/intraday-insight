import { ArrowUpRight, ArrowDownRight, CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const recentTrades = [
  {
    id: 1,
    symbol: "RELIANCE",
    type: "BUY",
    entry: 2845.50,
    exit: 2892.30,
    pnl: 46.80,
    pnlPercent: 1.64,
    status: "CLOSED",
    time: "2h ago"
  },
  {
    id: 2,
    symbol: "TCS",
    type: "SELL",
    entry: 4150.00,
    exit: 4125.30,
    pnl: 24.70,
    pnlPercent: 0.60,
    status: "CLOSED",
    time: "3h ago"
  },
  {
    id: 3,
    symbol: "INFY",
    type: "BUY",
    entry: 1865.20,
    exit: null,
    pnl: 27.20,
    pnlPercent: 1.46,
    status: "OPEN",
    time: "1h ago"
  },
  {
    id: 4,
    symbol: "HDFC BANK",
    type: "BUY",
    entry: 1702.40,
    exit: 1685.75,
    pnl: -16.65,
    pnlPercent: -0.98,
    status: "CLOSED",
    time: "4h ago"
  },
];

export function RecentTrades() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-foreground">Recent Trades</h3>
        <Badge variant="outline" className="text-xs">
          Today
        </Badge>
      </div>
      
      <div className="space-y-3">
        {recentTrades.map((trade) => {
          const isPositive = trade.pnl >= 0;
          const isBuy = trade.type === "BUY";
          
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
                    ₹{trade.entry.toFixed(2)} → {trade.exit ? `₹${trade.exit.toFixed(2)}` : 'Open'}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className={cn(
                  "font-mono font-semibold",
                  isPositive ? "text-bullish" : "text-bearish"
                )}>
                  {isPositive ? "+" : ""}₹{trade.pnl.toFixed(2)}
                </p>
                <p className={cn(
                  "text-xs font-mono",
                  isPositive ? "text-bullish" : "text-bearish"
                )}>
                  {isPositive ? "+" : ""}{trade.pnlPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
