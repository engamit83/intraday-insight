import { SignalCard } from "./SignalCard";
import type { StockSignal } from "@/types/trading";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const mockSignals: StockSignal[] = [
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
];

export function ActiveSignals() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Active Signals</h3>
          <p className="text-sm text-muted-foreground">AI-generated trading opportunities</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/signals" className="text-primary">
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {mockSignals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}
