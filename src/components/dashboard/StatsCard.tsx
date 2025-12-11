import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  variant?: "default" | "success" | "danger" | "warning";
}

export function StatsCard({ 
  title, 
  value, 
  change, 
  changeLabel, 
  icon, 
  variant = "default" 
}: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="glass-card rounded-xl p-5 transition-all duration-300 hover:border-primary/30">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn(
            "text-2xl font-bold font-mono",
            variant === "success" && "text-bullish",
            variant === "danger" && "text-bearish",
            variant === "warning" && "text-warning",
            variant === "default" && "text-foreground"
          )}>
            {value}
          </p>
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-sm",
              isPositive ? "text-bullish" : "text-bearish"
            )}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span className="font-medium">
                {isPositive ? "+" : ""}{change.toFixed(2)}%
              </span>
              {changeLabel && (
                <span className="text-muted-foreground">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg",
          variant === "success" && "bg-bullish/10 text-bullish",
          variant === "danger" && "bg-bearish/10 text-bearish",
          variant === "warning" && "bg-warning/10 text-warning",
          variant === "default" && "bg-primary/10 text-primary"
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}
