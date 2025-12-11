import { useState } from "react";
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
import { Search, Filter, RefreshCw, Zap } from "lucide-react";
import type { StockSignal } from "@/types/trading";

const allSignals: StockSignal[] = [
  {
    id: "1",
    symbol: "TATAMOTORS",
    company_name: "Tata Motors Ltd",
    signal_type: "BUY",
    entry_price: 985.50,
    target_price: 1015.00,
    stoploss_price: 968.00,
    confidence_score: 87,
    signal_strength: "STRONG",
    analysis: {
      vwap_analysis: "Price above VWAP, bullish momentum",
      volume_analysis: "Volume spike detected, 2.5x average",
      trend_analysis: "Uptrend with higher highs",
      pattern_detected: "Breakout",
      risk_reward_ratio: 1.68,
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    is_active: true,
  },
  {
    id: "2",
    symbol: "BHARTIARTL",
    company_name: "Bharti Airtel Ltd",
    signal_type: "SELL",
    entry_price: 1685.20,
    target_price: 1645.00,
    stoploss_price: 1705.00,
    confidence_score: 72,
    signal_strength: "MODERATE",
    analysis: {
      vwap_analysis: "Price below VWAP, bearish pressure",
      volume_analysis: "Selling volume increasing",
      trend_analysis: "Resistance rejection",
      pattern_detected: "Reversal",
      risk_reward_ratio: 2.03,
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    is_active: true,
  },
  {
    id: "3",
    symbol: "HDFCBANK",
    company_name: "HDFC Bank Ltd",
    signal_type: "BUY",
    entry_price: 1685.75,
    target_price: 1720.00,
    stoploss_price: 1665.00,
    confidence_score: 81,
    signal_strength: "STRONG",
    analysis: {
      vwap_analysis: "Crossing above VWAP",
      volume_analysis: "Above average volume",
      trend_analysis: "Bullish flag pattern",
      pattern_detected: "Flag Breakout",
      risk_reward_ratio: 1.65,
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    is_active: true,
  },
  {
    id: "4",
    symbol: "INFY",
    company_name: "Infosys Ltd",
    signal_type: "BUY",
    entry_price: 1892.40,
    target_price: 1935.00,
    stoploss_price: 1870.00,
    confidence_score: 68,
    signal_strength: "MODERATE",
    analysis: {
      vwap_analysis: "Hovering near VWAP",
      volume_analysis: "Moderate volume",
      trend_analysis: "Support bounce",
      pattern_detected: "Double Bottom",
      risk_reward_ratio: 1.90,
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    is_active: true,
  },
  {
    id: "5",
    symbol: "SBIN",
    company_name: "State Bank of India",
    signal_type: "SELL",
    entry_price: 825.30,
    target_price: 805.00,
    stoploss_price: 838.00,
    confidence_score: 75,
    signal_strength: "MODERATE",
    analysis: {
      vwap_analysis: "Below VWAP with rejection",
      volume_analysis: "High selling volume",
      trend_analysis: "Lower high formation",
      pattern_detected: "Head & Shoulders",
      risk_reward_ratio: 1.60,
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    is_active: true,
  },
  {
    id: "6",
    symbol: "RELIANCE",
    company_name: "Reliance Industries",
    signal_type: "BUY",
    entry_price: 2845.50,
    target_price: 2905.00,
    stoploss_price: 2815.00,
    confidence_score: 92,
    signal_strength: "STRONG",
    analysis: {
      vwap_analysis: "Strong above VWAP",
      volume_analysis: "Institutional buying detected",
      trend_analysis: "Strong uptrend",
      pattern_detected: "Cup & Handle",
      risk_reward_ratio: 1.95,
    },
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    is_active: true,
  },
];

export default function Signals() {
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSignals = allSignals.filter((signal) => {
    const matchesFilter = filter === "all" || signal.signal_type === filter;
    const matchesSearch = signal.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          signal.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const buyCount = allSignals.filter(s => s.signal_type === "BUY").length;
  const sellCount = allSignals.filter(s => s.signal_type === "SELL").length;

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trading Signals</h1>
          <p className="text-muted-foreground">AI-powered intraday trading opportunities</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1.5">
            <Zap className="h-4 w-4 mr-1 text-primary" />
            {allSignals.length} Active
          </Badge>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredSignals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>

      {filteredSignals.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Signals Found</h3>
          <p className="text-muted-foreground">No signals match your current filters.</p>
        </div>
      )}
    </MainLayout>
  );
}
