import { ArrowUpRight, ArrowDownRight, Target, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { StockSignal } from "@/types/trading";

interface SignalCardProps {
  signal: StockSignal;
  onTrade?: (signal: StockSignal) => void;
}

export function SignalCard({ signal, onTrade }: SignalCardProps) {
  const isBuy = signal.signal_type === "BUY";
  const riskReward = signal.analysis.risk_reward_ratio;

  return (
    <div className="glass-card rounded-xl overflow-hidden transition-all duration-300 hover:border-primary/30 group">
      {/* Header */}
      <div className={cn(
        "px-5 py-3 flex items-center justify-between",
        isBuy ? "bg-bullish/10" : "bg-bearish/10"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            isBuy ? "bg-bullish/20" : "bg-bearish/20"
          )}>
            {isBuy ? (
              <ArrowUpRight className="h-5 w-5 text-bullish" />
            ) : (
              <ArrowDownRight className="h-5 w-5 text-bearish" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-foreground">{signal.symbol}</h3>
            <p className="text-xs text-muted-foreground">{signal.company_name}</p>
          </div>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "font-semibold",
            isBuy ? "border-bullish text-bullish" : "border-bearish text-bearish"
          )}
        >
          {signal.signal_type}
        </Badge>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Price Levels */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Entry</p>
            <p className="font-mono font-semibold text-foreground">₹{signal.entry_price.toFixed(2)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-bullish/10">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <Target className="h-3 w-3" /> Target
            </p>
            <p className="font-mono font-semibold text-bullish">₹{signal.target_price.toFixed(2)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-bearish/10">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <Shield className="h-3 w-3" /> Stoploss
            </p>
            <p className="font-mono font-semibold text-bearish">₹{signal.stoploss_price.toFixed(2)}</p>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">AI Confidence</span>
            <span className="text-sm font-semibold text-foreground">{signal.confidence_score}%</span>
          </div>
          <Progress 
            value={signal.confidence_score} 
            className="h-2 bg-secondary"
          />
        </div>

        {/* Analysis Tags */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs">
            {signal.analysis.pattern_detected}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            R:R {riskReward.toFixed(1)}
          </Badge>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs",
              signal.signal_strength === "STRONG" && "bg-bullish/20 text-bullish",
              signal.signal_strength === "MODERATE" && "bg-warning/20 text-warning",
              signal.signal_strength === "WEAK" && "bg-muted text-muted-foreground"
            )}
          >
            {signal.signal_strength}
          </Badge>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Expires in 4h 30m</span>
          </div>
          <Button 
            size="sm"
            variant={isBuy ? "default" : "destructive"}
            className={cn(
              "font-semibold",
              isBuy && "bg-bullish hover:bg-bullish/90"
            )}
            onClick={() => onTrade?.(signal)}
          >
            Trade Now
          </Button>
        </div>
      </div>
    </div>
  );
}
