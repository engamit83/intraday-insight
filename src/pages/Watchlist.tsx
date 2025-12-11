import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Star,
  Search,
  Trash2,
  Bell,
  BarChart3
} from "lucide-react";

interface WatchlistStock {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  dayHigh: number;
  dayLow: number;
  hasAlert: boolean;
}

const initialWatchlist: WatchlistStock[] = [
  {
    id: "1",
    symbol: "RELIANCE",
    name: "Reliance Industries",
    price: 2845.50,
    change: 23.40,
    changePercent: 0.83,
    volume: "12.5M",
    dayHigh: 2868.00,
    dayLow: 2815.30,
    hasAlert: true
  },
  {
    id: "2",
    symbol: "TCS",
    name: "Tata Consultancy Services",
    price: 4125.30,
    change: -15.20,
    changePercent: -0.37,
    volume: "3.2M",
    dayHigh: 4165.00,
    dayLow: 4098.50,
    hasAlert: false
  },
  {
    id: "3",
    symbol: "INFY",
    name: "Infosys Ltd",
    price: 1892.40,
    change: 28.60,
    changePercent: 1.53,
    volume: "8.7M",
    dayHigh: 1905.00,
    dayLow: 1858.20,
    hasAlert: true
  },
  {
    id: "4",
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    price: 1685.75,
    change: 12.50,
    changePercent: 0.75,
    volume: "15.3M",
    dayHigh: 1698.00,
    dayLow: 1668.40,
    hasAlert: false
  },
  {
    id: "5",
    symbol: "TATAMOTORS",
    name: "Tata Motors Ltd",
    price: 985.50,
    change: 18.90,
    changePercent: 1.96,
    volume: "22.1M",
    dayHigh: 992.00,
    dayLow: 962.30,
    hasAlert: true
  },
  {
    id: "6",
    symbol: "SBIN",
    name: "State Bank of India",
    price: 825.30,
    change: -8.70,
    changePercent: -1.04,
    volume: "28.9M",
    dayHigh: 842.00,
    dayLow: 818.50,
    hasAlert: false
  },
];

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistStock[]>(initialWatchlist);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");

  const filteredWatchlist = watchlist.filter((stock) =>
    stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const gainers = watchlist.filter(s => s.changePercent > 0).length;
  const losers = watchlist.filter(s => s.changePercent < 0).length;

  const handleAddStock = () => {
    if (!newSymbol) return;
    
    // In a real app, you'd fetch stock data here
    const newStock: WatchlistStock = {
      id: Date.now().toString(),
      symbol: newSymbol.toUpperCase(),
      name: `${newSymbol.toUpperCase()} Ltd`,
      price: Math.random() * 5000 + 100,
      change: (Math.random() - 0.5) * 100,
      changePercent: (Math.random() - 0.5) * 5,
      volume: `${(Math.random() * 20 + 1).toFixed(1)}M`,
      dayHigh: Math.random() * 5000 + 100,
      dayLow: Math.random() * 5000 + 100,
      hasAlert: false
    };

    setWatchlist([newStock, ...watchlist]);
    setNewSymbol("");
    setIsDialogOpen(false);
  };

  const handleRemoveStock = (id: string) => {
    setWatchlist(watchlist.filter(s => s.id !== id));
  };

  const toggleAlert = (id: string) => {
    setWatchlist(watchlist.map(s => 
      s.id === id ? { ...s, hasAlert: !s.hasAlert } : s
    ));
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
              <Button className="w-full" onClick={handleAddStock}>
                Add to Watchlist
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
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Gainers</p>
          <p className="text-2xl font-bold font-mono text-bullish">{gainers}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Losers</p>
          <p className="text-2xl font-bold font-mono text-bearish">{losers}</p>
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
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Price</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Change</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Volume</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Day Range</th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWatchlist.map((stock) => {
              const isPositive = stock.changePercent >= 0;
              return (
                <tr key={stock.id} className="border-t border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        isPositive ? "bg-bullish/10" : "bg-bearish/10"
                      )}>
                        {isPositive ? (
                          <TrendingUp className="h-5 w-5 text-bullish" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-bearish" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{stock.symbol}</p>
                        <p className="text-xs text-muted-foreground">{stock.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono font-semibold text-foreground">
                    ₹{stock.price.toFixed(2)}
                  </td>
                  <td className="p-4 text-right">
                    <div className={cn(
                      "font-mono",
                      isPositive ? "text-bullish" : "text-bearish"
                    )}>
                      <p className="font-semibold">
                        {isPositive ? "+" : ""}₹{stock.change.toFixed(2)}
                      </p>
                      <p className="text-sm">
                        ({isPositive ? "+" : ""}{stock.changePercent.toFixed(2)}%)
                      </p>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-muted-foreground hidden md:table-cell">
                    {stock.volume}
                  </td>
                  <td className="p-4 text-right hidden lg:table-cell">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-bearish">L: ₹{stock.dayLow.toFixed(0)}</span>
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary"
                          style={{ 
                            width: `${((stock.price - stock.dayLow) / (stock.dayHigh - stock.dayLow)) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-xs text-bullish">H: ₹{stock.dayHigh.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn("h-8 w-8", stock.hasAlert && "text-warning")}
                        onClick={() => toggleAlert(stock.id)}
                      >
                        <Bell className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
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
              );
            })}
          </tbody>
        </table>

        {filteredWatchlist.length === 0 && (
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
