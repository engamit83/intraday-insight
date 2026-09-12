import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, RefreshCw, Zap, Play } from "lucide-react";
import type { StockSignal } from "@/types/trading";
import { useSimulatorStatus } from "@/hooks/useSimulatorStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Signals() {
  const [allSignals, setAllSignals] = useState<StockSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tradingSymbol, setTradingSymbol] = useState<string | null>(null);
  const { status, refetch } = useSimulatorStatus();

  const fetchSignals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("signals")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load signals");
      setAllSignals([]);
    } else {
      const mapped: StockSignal[] = (data || []).map((s) => ({
        id: s.id,
        symbol: s.symbol,
        company_name: s.symbol, // signals table has no company-name column
        signal_type: s.signal_type as "BUY" | "SELL",
        entry_price: s.entry_price,
        target_price: s.target_price,
        stoploss_price: s.stoploss_price,
        confidence_score: Math.round(s.confidence),
        signal_strength: s.confidence >= 80 ? "STRONG" : s.confidence >= 60 ? "MODERATE" : "WEAK",
        analysis: {
          vwap_analysis: (s.indicators as any)?.vwap_analysis ?? "No VWAP data available",
          volume_analysis: (s.indicators as any)?.volume_analysis ?? "No volume data available",
          trend_analysis: (s.indicators as any)?.trend_analysis ?? "No trend data available",
          pattern_detected: (s.indicators as any)?.pattern_detected ?? "N/A",
          risk_reward_ratio:
            Math.abs(s.target_price - s.entry_price) /
            (Math.abs(s.entry_price - s.stoploss_price) || 1),
        },
        created_at: s.created_at,
        expires_at: s.expires_at ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        is_active: s.is_active ?? true,
      }));
      setAllSignals(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  const openTradeSymbols = new Set(status?.trades?.map((t: any) => t.symbol) || []);

  const filteredSignals = allSignals.filter((signal) => {
    const matchesFilter = filter === "all" || signal.signal_type === filter;
    const matchesSearch = signal.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          signal.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const buyCount = allSignals.filter(s => s.signal_type === "BUY").length;
  const sellCount = allSignals.filter(s => s.signal_type === "SELL").length;

  const handleTrade = async (signal: StockSignal) => {
    if (!status?.simulatorEnabled) {
      toast.info("Enable Simulator mode in Settings to create virtual trades");
      return;
    }

    setTradingSymbol(signal.symbol);
    const { data, error } = await supabase.functions.invoke("simulate-trade", {
      body: { action: "execute_signal", signalId: signal.id },
    });
    setTradingSymbol(null);

    if (error || data?.success === false) {
      console.error(error || data?.message);
      toast.error(data?.message || "Failed to create simulated trade");
      return;
    }

    toast.success(`Simulated ${signal.signal_type} created for ${signal.symbol}`);
    refetch();
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trading Signals</h1>
          <p className="text-muted-foreground">AI-powered intraday trading opportunities</p>
        </div>
        <div className="flex items-center gap-3">
          {status?.simulatorEnabled && (
            <Badge className="bg-bullish/20 text-bullish px-3 py-1.5">
              <Play className="h-4 w-4 mr-1" />
              Simulator Active
            </Badge>
          )}
          <Badge variant="outline" className="px-3 py-1.5">
            <Zap className="h-4 w-4 mr-1 text-primary" />
            {allSignals.length} Active
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchSignals} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search signals..."
                className="pl-10 bg-secondary/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 bg-secondary/50">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Signals</SelectItem>
                <SelectItem value="BUY">Buy Only</SelectItem>
                <SelectItem value="SELL">Sell Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-bullish" />
              <span className="text-sm text-muted-foreground">{buyCount} Buy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-bearish" />
              <span className="text-sm text-muted-foreground">{sellCount} Sell</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signals Grid */}
      {loading ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <RefreshCw className="h-8 w-8 mx-auto mb-4 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading signals...</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSignals.map((signal) => (
              <div key={signal.id} className="relative">
                {openTradeSymbols.has(signal.symbol) && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <Badge className="bg-primary text-primary-foreground shadow-lg">
                      TRADE OPEN
                    </Badge>
                  </div>
                )}
                <SignalCard
                  signal={signal}
                  onTrade={handleTrade}
                  isTrading={tradingSymbol === signal.symbol}
                />
              </div>
            ))}
          </div>

          {filteredSignals.length === 0 && (
            <div className="glass-card rounded-xl p-12 text-center">
              <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Signals Found</h3>
              <p className="text-muted-foreground">
                {allSignals.length === 0
                  ? "No active signals right now. Check back once the signal engine generates new ones."
                  : "No signals match your current filters."}
              </p>
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}
