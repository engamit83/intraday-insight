import { useState, useEffect } from "react";
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
  Trash2,
  Loader2,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Maps 1:1 to the real `trades` table (trade_mode = 'MANUAL').
// Note: the schema has no dedicated target/stoploss columns, so those are
// appended into `notes` on insert rather than fabricated as separate fields.
interface ManualTrade {
  id: string;
  symbol: string;
  trade_type: "BUY" | "SELL";
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  notes: string | null;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  pnl: number | null;
  opened_at: string;
  closed_at: string | null;
}

export default function ManualTrades() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<ManualTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [closingTrade, setClosingTrade] = useState<ManualTrade | null>(null);
  const [exitPrice, setExitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [newTrade, setNewTrade] = useState({
    symbol: "",
    type: "BUY" as "BUY" | "SELL",
    entry: "",
    target: "",
    stoploss: "",
    quantity: "",
    notes: "",
  });

  const fetchTrades = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("trade_mode", "MANUAL")
      .order("opened_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load trades");
    } else {
      setTrades((data || []) as ManualTrade[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrades();
  }, [user]);

  const openTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status === "CLOSED");
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

  const handleAddTrade = async () => {
    if (!user || !newTrade.symbol || !newTrade.entry || !newTrade.quantity) return;
    setSubmitting(true);

    const noteParts: string[] = [];
    if (newTrade.target) noteParts.push(`Target: ₹${newTrade.target}`);
    if (newTrade.stoploss) noteParts.push(`Stoploss: ₹${newTrade.stoploss}`);
    if (newTrade.notes) noteParts.push(newTrade.notes);

    const { error } = await supabase.from("trades").insert({
      user_id: user.id,
      symbol: newTrade.symbol.toUpperCase().trim(),
      trade_type: newTrade.type,
      entry_price: parseFloat(newTrade.entry),
      quantity: parseInt(newTrade.quantity, 10),
      notes: noteParts.length > 0 ? noteParts.join(" | ") : null,
      status: "OPEN",
      trade_mode: "MANUAL",
    });

    setSubmitting(false);
    if (error) {
      console.error(error);
      toast.error("Failed to add trade");
      return;
    }

    toast.success("Trade added");
    setNewTrade({ symbol: "", type: "BUY", entry: "", target: "", stoploss: "", quantity: "", notes: "" });
    setIsDialogOpen(false);
    fetchTrades();
  };

  const handleCloseTrade = async () => {
    if (!closingTrade || !exitPrice) return;
    setSubmitting(true);

    const exit = parseFloat(exitPrice);
    const direction = closingTrade.trade_type === "BUY" ? 1 : -1;
    const pnl = (exit - closingTrade.entry_price) * direction * closingTrade.quantity;
    const pnlPercentage = ((exit - closingTrade.entry_price) * direction / closingTrade.entry_price) * 100;

    const { error } = await supabase
      .from("trades")
      .update({
        exit_price: exit,
        pnl,
        pnl_percentage: pnlPercentage,
        status: "CLOSED",
        closed_at: new Date().toISOString(),
      })
      .eq("id", closingTrade.id);

    setSubmitting(false);
    if (error) {
      console.error(error);
      toast.error("Failed to close trade");
      return;
    }

    toast.success("Trade closed");
    setClosingTrade(null);
    setExitPrice("");
    fetchTrades();
  };

  const handleDeleteTrade = async (id: string) => {
    const { error } = await supabase.from("trades").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Failed to delete trade");
      return;
    }
    setTrades(trades.filter((t) => t.id !== id));
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
              <p className="text-xs text-muted-foreground -mt-2">
                Target/stoploss aren't separate columns in the database yet — they're saved into the notes field.
              </p>
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Input
                  placeholder="Add notes about this trade..."
                  value={newTrade.notes}
                  onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
              <Button className="w-full" onClick={handleAddTrade} disabled={submitting}>
                {submitting ? "Adding..." : "Add Trade"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Close trade dialog */}
      <Dialog open={!!closingTrade} onOpenChange={(open) => !open && setClosingTrade(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Close Trade — {closingTrade?.symbol}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Exit Price</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="bg-secondary/50"
              />
            </div>
            <Button className="w-full" onClick={handleCloseTrade} disabled={submitting || !exitPrice}>
              {submitting ? "Closing..." : "Close Trade"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Open Trades</p>
          <p className="text-2xl font-bold font-mono text-foreground">{openTrades.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Closed</p>
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

      {loading ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading trades...</p>
        </div>
      ) : (
        <>
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
                        trade.trade_type === "BUY" ? "bg-bullish/10" : "bg-bearish/10"
                      )}>
                        {trade.trade_type === "BUY" ? (
                          <TrendingUp className="h-5 w-5 text-bullish" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-bearish" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{trade.symbol}</h3>
                          <Badge variant="outline" className={cn(
                            trade.trade_type === "BUY" ? "border-bullish text-bullish" : "border-bearish text-bearish"
                          )}>
                            {trade.trade_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(trade.opened_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} • Qty: {trade.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-mono font-semibold text-foreground">₹{trade.entry_price.toFixed(2)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setClosingTrade(trade)}
                          title="Close trade"
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-bearish hover:text-bearish"
                          onClick={() => handleDeleteTrade(trade.id)}
                          title="Delete trade"
                        >
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
                          trade.trade_type === "BUY" ? "border-bullish text-bullish" : "border-bearish text-bearish"
                        )}>
                          {trade.trade_type}
                        </Badge>
                      </td>
                      <td className="p-4 text-right font-mono text-foreground">₹{trade.entry_price.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono text-foreground">
                        {trade.exit_price != null ? `₹${trade.exit_price.toFixed(2)}` : "-"}
                      </td>
                      <td className={cn(
                        "p-4 text-right font-mono font-semibold",
                        (trade.pnl || 0) >= 0 ? "text-bullish" : "text-bearish"
                      )}>
                        {trade.pnl != null ? `${trade.pnl >= 0 ? "+" : ""}₹${trade.pnl.toFixed(2)}` : "-"}
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

              {closedTrades.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No closed trades yet.</div>
              )}
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
