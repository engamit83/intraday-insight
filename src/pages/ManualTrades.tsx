import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2
} from "lucide-react";

interface ManualTrade {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  entry: number;
  target?: number;
  stoploss?: number;
  quantity: number;
  notes?: string;
  status: "OPEN" | "CLOSED";
  pnl?: number;
  entryTime: string;
  exitTime?: string;
  exitPrice?: number;
}

const initialTrades: ManualTrade[] = [
  {
    id: "1",
    symbol: "WIPRO",
    type: "BUY",
    entry: 485.50,
    target: 505.00,
    stoploss: 475.00,
    quantity: 100,
    notes: "Strong support at 480",
    status: "OPEN",
    entryTime: "10:30 AM"
  },
  {
    id: "2",
    symbol: "ICICIBANK",
    type: "BUY",
    entry: 1125.00,
    target: 1155.00,
    stoploss: 1110.00,
    quantity: 40,
    status: "CLOSED",
    pnl: 1200.00,
    entryTime: "09:45 AM",
    exitTime: "11:30 AM",
    exitPrice: 1155.00
  },
  {
    id: "3",
    symbol: "LT",
    type: "SELL",
    entry: 3450.00,
    target: 3380.00,
    stoploss: 3485.00,
    quantity: 15,
    notes: "Bearish engulfing pattern",
    status: "CLOSED",
    pnl: -525.00,
    entryTime: "11:15 AM",
    exitTime: "13:00 PM",
    exitPrice: 3485.00
  },
];

export default function ManualTrades() {
  const [trades, setTrades] = useState<ManualTrade[]>(initialTrades);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTrade, setNewTrade] = useState({
    symbol: "",
    type: "BUY" as "BUY" | "SELL",
    entry: "",
    target: "",
    stoploss: "",
    quantity: "",
    notes: ""
  });

  const openTrades = trades.filter(t => t.status === "OPEN");
  const closedTrades = trades.filter(t => t.status === "CLOSED");
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  const handleAddTrade = () => {
    if (!newTrade.symbol || !newTrade.entry || !newTrade.quantity) return;

    const trade: ManualTrade = {
      id: Date.now().toString(),
      symbol: newTrade.symbol.toUpperCase(),
      type: newTrade.type,
      entry: parseFloat(newTrade.entry),
      target: newTrade.target ? parseFloat(newTrade.target) : undefined,
      stoploss: newTrade.stoploss ? parseFloat(newTrade.stoploss) : undefined,
      quantity: parseInt(newTrade.quantity),
      notes: newTrade.notes || undefined,
      status: "OPEN",
      entryTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    setTrades([trade, ...trades]);
    setNewTrade({ symbol: "", type: "BUY", entry: "", target: "", stoploss: "", quantity: "", notes: "" });
    setIsDialogOpen(false);
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manual Trades</h1>
          <p className="text-muted-foreground">Track your own trading entries</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Trade
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Add New Trade</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input 
                    placeholder="e.g., RELIANCE"
                    value={newTrade.symbol}
                    onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newTrade.type} onValueChange={(v: "BUY" | "SELL") => setNewTrade({ ...newTrade, type: v })}>
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entry Price</Label>
                  <Input 
                    type="number"
                    placeholder="0.00"
                    value={newTrade.entry}
                    onChange={(e) => setNewTrade({ ...newTrade, entry: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input 
                    type="number"
                    placeholder="0"
                    value={newTrade.quantity}
                    onChange={(e) => setNewTrade({ ...newTrade, quantity: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target (Optional)</Label>
                  <Input 
                    type="number"
                    placeholder="0.00"
                    value={newTrade.target}
                    onChange={(e) => setNewTrade({ ...newTrade, target: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stoploss (Optional)</Label>
                  <Input 
                    type="number"
                    placeholder="0.00"
                    value={newTrade.stoploss}
                    onChange={(e) => setNewTrade({ ...newTrade, stoploss: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input 
                  placeholder="Add notes about this trade..."
                  value={newTrade.notes}
                  onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
              <Button className="w-full" onClick={handleAddTrade}>
                Add Trade
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Open Trades</p>
          <p className="text-2xl font-bold font-mono text-foreground">{openTrades.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Closed Today</p>
          <p className="text-2xl font-bold font-mono text-foreground">{closedTrades.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Realized P&L</p>
          <p className={cn(
            "text-2xl font-bold font-mono",
            totalPnl >= 0 ? "text-bullish" : "text-bearish"
          )}>
            {totalPnl >= 0 ? "+" : ""}₹{totalPnl.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Open Trades */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Open Trades</h2>
        <div className="space-y-3">
          {openTrades.map((trade) => (
            <div key={trade.id} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between">
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
                      {trade.entryTime} • Qty: {trade.quantity}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-mono font-semibold text-foreground">₹{trade.entry.toFixed(2)}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {trade.target && <span>T: ₹{trade.target}</span>}
                      {trade.stoploss && <span>SL: ₹{trade.stoploss}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-bearish hover:text-bearish">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {trade.notes && (
                <p className="mt-3 text-sm text-muted-foreground border-t border-border/50 pt-3">
                  📝 {trade.notes}
                </p>
              )}
            </div>
          ))}

          {openTrades.length === 0 && (
            <div className="glass-card rounded-xl p-8 text-center">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No open trades. Click "Add Trade" to start tracking.</p>
            </div>
          )}
        </div>
      </div>

      {/* Trade History */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Trade History</h2>
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Symbol</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Entry</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Exit</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">P&L</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Result</th>
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
                  <td className="p-4 text-right font-mono text-foreground">₹{trade.exitPrice?.toFixed(2)}</td>
                  <td className={cn(
                    "p-4 text-right font-mono font-semibold",
                    (trade.pnl || 0) >= 0 ? "text-bullish" : "text-bearish"
                  )}>
                    {(trade.pnl || 0) >= 0 ? "+" : ""}₹{trade.pnl?.toFixed(2)}
                  </td>
                  <td className="p-4 text-center">
                    {(trade.pnl || 0) >= 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-bullish inline" />
                    ) : (
                      <XCircle className="h-5 w-5 text-bearish inline" />
                    )}
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
