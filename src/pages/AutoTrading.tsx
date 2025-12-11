import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { 
  Zap, 
  Play, 
  Pause, 
  TrendingUp, 
  TrendingDown,
  Target,
  Shield,
  Clock,
  AlertTriangle
} from "lucide-react";

interface VirtualTrade {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  entry: number;
  current: number;
  target: number;
  stoploss: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  status: "OPEN" | "TARGET_HIT" | "SL_HIT";
  entryTime: string;
}

const virtualTrades: VirtualTrade[] = [
  {
    id: "1",
    symbol: "RELIANCE",
    type: "BUY",
    entry: 2845.50,
    current: 2878.30,
    target: 2905.00,
    stoploss: 2815.00,
    quantity: 10,
    pnl: 328.00,
    pnlPercent: 1.15,
    status: "OPEN",
    entryTime: "09:32 AM"
  },
  {
    id: "2",
    symbol: "TATAMOTORS",
    type: "BUY",
    entry: 985.50,
    current: 1012.40,
    target: 1015.00,
    stoploss: 968.00,
    quantity: 50,
    pnl: 1345.00,
    pnlPercent: 2.73,
    status: "OPEN",
    entryTime: "10:15 AM"
  },
  {
    id: "3",
    symbol: "HDFCBANK",
    type: "BUY",
    entry: 1685.75,
    current: 1720.00,
    target: 1720.00,
    stoploss: 1665.00,
    quantity: 25,
    pnl: 856.25,
    pnlPercent: 2.03,
    status: "TARGET_HIT",
    entryTime: "11:45 AM"
  },
  {
    id: "4",
    symbol: "SBIN",
    type: "SELL",
    entry: 825.30,
    current: 838.00,
    target: 805.00,
    stoploss: 838.00,
    quantity: 100,
    pnl: -1270.00,
    pnlPercent: -1.54,
    status: "SL_HIT",
    entryTime: "12:30 PM"
  },
];

export default function AutoTrading() {
  const [isAutoEnabled, setIsAutoEnabled] = useState(true);

  const openTrades = virtualTrades.filter(t => t.status === "OPEN");
  const closedTrades = virtualTrades.filter(t => t.status !== "OPEN");
  const totalPnl = virtualTrades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = (closedTrades.filter(t => t.pnl > 0).length / closedTrades.length) * 100 || 0;

  const getProgressToTarget = (trade: VirtualTrade) => {
    const totalRange = trade.target - trade.entry;
    const currentProgress = trade.current - trade.entry;
    return Math.min(100, Math.max(0, (currentProgress / totalRange) * 100));
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auto Trading</h1>
          <p className="text-muted-foreground">Virtual trades executed by AI signals</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 glass-card rounded-lg px-4 py-2">
            <span className="text-sm font-medium text-foreground">Auto Mode</span>
            <Switch 
              checked={isAutoEnabled} 
              onCheckedChange={setIsAutoEnabled}
            />
            {isAutoEnabled ? (
              <Badge className="bg-bullish text-bullish-foreground">
                <Play className="h-3 w-3 mr-1" /> Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Pause className="h-3 w-3 mr-1" /> Paused
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Virtual P&L</p>
          <p className={cn(
            "text-2xl font-bold font-mono",
            totalPnl >= 0 ? "text-bullish" : "text-bearish"
          )}>
            {totalPnl >= 0 ? "+" : ""}₹{totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Open Positions</p>
          <p className="text-2xl font-bold font-mono text-foreground">{openTrades.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Closed Today</p>
          <p className="text-2xl font-bold font-mono text-foreground">{closedTrades.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Win Rate</p>
          <p className="text-2xl font-bold font-mono text-bullish">{winRate.toFixed(0)}%</p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="glass-card rounded-xl p-4 mb-6 border-warning/30 bg-warning/5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">Virtual Trading Mode:</span> These are simulated trades for learning and strategy validation. No real money is involved.
          </p>
        </div>
      </div>

      {/* Open Positions */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Open Positions</h2>
        <div className="space-y-3">
          {openTrades.map((trade) => (
            <div key={trade.id} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    trade.type === "BUY" ? "bg-bullish/10" : "bg-bearish/10"
                  )}>
                    {trade.type === "BUY" ? (
                      <TrendingUp className="h-5 w-5 text-bullish" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-bearish" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{trade.symbol}</h3>
                      <Badge variant="outline" className={cn(
                        trade.type === "BUY" ? "border-bullish text-bullish" : "border-bearish text-bearish"
                      )}>
                        {trade.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Entry: {trade.entryTime} • Qty: {trade.quantity}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-lg font-bold font-mono",
                    trade.pnl >= 0 ? "text-bullish" : "text-bearish"
                  )}>
                    {trade.pnl >= 0 ? "+" : ""}₹{trade.pnl.toFixed(2)}
                  </p>
                  <p className={cn(
                    "text-sm font-mono",
                    trade.pnl >= 0 ? "text-bullish" : "text-bearish"
                  )}>
                    ({trade.pnlPercent >= 0 ? "+" : ""}{trade.pnlPercent.toFixed(2)}%)
                  </p>
                </div>
              </div>

              {/* Price Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" /> SL: ₹{trade.stoploss}
                  </span>
                  <span>Current: ₹{trade.current}</span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" /> Target: ₹{trade.target}
                  </span>
                </div>
                <Progress value={getProgressToTarget(trade)} className="h-2" />
              </div>
            </div>
          ))}

          {openTrades.length === 0 && (
            <div className="glass-card rounded-xl p-8 text-center">
              <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No open positions. Waiting for signals...</p>
            </div>
          )}
        </div>
      </div>

      {/* Closed Trades */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Today's Closed Trades</h2>
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Symbol</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Entry</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Exit</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">P&L</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.map((trade) => (
                <tr key={trade.id} className="border-t border-border/50 hover:bg-secondary/30">
                  <td className="p-4 font-medium text-foreground">{trade.symbol}</td>
                  <td className="p-4">
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      trade.type === "BUY" ? "border-bullish text-bullish" : "border-bearish text-bearish"
                    )}>
                      {trade.type}
                    </Badge>
                  </td>
                  <td className="p-4 text-right font-mono text-foreground">₹{trade.entry.toFixed(2)}</td>
                  <td className="p-4 text-right font-mono text-foreground">₹{trade.current.toFixed(2)}</td>
                  <td className={cn(
                    "p-4 text-right font-mono font-semibold",
                    trade.pnl >= 0 ? "text-bullish" : "text-bearish"
                  )}>
                    {trade.pnl >= 0 ? "+" : ""}₹{trade.pnl.toFixed(2)}
                  </td>
                  <td className="p-4 text-center">
                    <Badge className={cn(
                      "text-xs",
                      trade.status === "TARGET_HIT" ? "bg-bullish" : "bg-bearish"
                    )}>
                      {trade.status === "TARGET_HIT" ? "Target Hit" : "SL Hit"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
