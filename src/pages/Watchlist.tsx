import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus, 
  TrendingUp, 
  Star,
  Search,
  Trash2,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Note: alerts, day-high/low and volume are not modeled in the current DB schema
// (watchlist table only has symbol/company_name/user_id/added_at, stocks table only
// has last_price). Price comes from `stocks.last_price` where available.
interface WatchlistStock {
  id: string;
  symbol: string;
  name: string;
  price: number | null;
}

export default function Watchlist() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchWatchlist = async () => {
    if (!user) return;
    setLoading(true);

    const { data: rows, error } = await supabase
      .from("watchlist")
      .select("id, symbol, company_name")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load watchlist");
      setLoading(false);
      return;
    }

    const symbols = (rows || []).map((r) => r.symbol);
    let priceBySymbol: Record<string, number | null> = {};
    if (symbols.length > 0) {
      const { data: stockRows } = await supabase
        .from("stocks")
        .select("symbol, last_price")
        .in("symbol", symbols);
      priceBySymbol = Object.fromEntries((stockRows || []).map((s) => [s.symbol, s.last_price]));
    }

    setWatchlist(
      (rows || []).map((r) => ({
        id: r.id,
        symbol: r.symbol,
        name: r.company_name || r.symbol,
        price: priceBySymbol[r.symbol] ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchWatchlist();
  }, [user]);

  const filteredWatchlist = watchlist.filter((stock) =>
    stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddStock = async () => {
    if (!newSymbol || !user) return;
    setAdding(true);

    const symbol = newSymbol.toUpperCase().trim();
    const { error } = await supabase.from("watchlist").insert({
      user_id: user.id,
      symbol,
    });

    setAdding(false);
    if (error) {
      console.error(error);
      toast.error(error.code === "23505" ? "Already in your watchlist" : "Failed to add stock");
      return;
    }

    setNewSymbol("");
    setIsDialogOpen(false);
    fetchWatchlist();
  };

  const handleRemoveStock = async (id: string) => {
    const { error } = await supabase.from("watchlist").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("Failed to remove stock");
      return;
    }
    setWatchlist(watchlist.filter((s) => s.id !== id));
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
          <p className="text-muted-foreground">Monitor your favorite stocks</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Stock
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Add to Watchlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input 
                placeholder="Enter stock symbol (e.g., RELIANCE)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="bg-secondary/50"
              />
              <Button className="w-full" onClick={handleAddStock} disabled={adding || !newSymbol}>
                {adding ? "Adding..." : "Add to Watchlist"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Stocks</p>
          <p className="text-2xl font-bold font-mono text-foreground">{watchlist.length}</p>
        </div>
        <div className="glass-card rounded-xl p-4 md:col-span-2">
          <p className="text-sm text-muted-foreground">
            Day change, volume and alerts aren't tracked yet — the current database schema
            only stores symbol and last price. Ask me to add those columns if you want them.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search watchlist..."
            className="pl-10 bg-secondary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Watchlist Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Stock</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Last Price</th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
                  Loading watchlist...
                </td>
              </tr>
            ) : (
              filteredWatchlist.map((stock) => (
                <tr key={stock.id} className="border-t border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{stock.symbol}</p>
                        <p className="text-xs text-muted-foreground">{stock.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono font-semibold text-foreground">
                    {stock.price != null ? `₹${stock.price.toFixed(2)}` : (
                      <span className="text-muted-foreground text-sm">No price data yet</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-bearish hover:text-bearish"
                        onClick={() => handleRemoveStock(stock.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && filteredWatchlist.length === 0 && (
          <div className="p-12 text-center">
            <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Stocks Found</h3>
            <p className="text-muted-foreground">Add stocks to your watchlist to monitor them.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
