import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarketStatus } from "@/hooks/useMarketStatus";

// Real status only: market open/closed by the clock, feed live/off from the latest saved candle.
// (The old always-green "LIVE", the fixed "3" notifications and the search box that did nothing were removed.)
export function Header() {
  const { marketOpen, feedLive, lastPriceAt } = useMarketStatus();
  const last = lastPriceAt ? new Date(Date.parse(lastPriceAt) + 5.5 * 3600_000).toISOString().slice(11, 16) : null;
  const feedText = feedLive ? "Feed live" : feedLive === null ? "Feed …" : marketOpen ? "Feed OFF" : "Feed off";
  const feedClass = feedLive
    ? "bg-bullish/10 text-bullish"
    : marketOpen && feedLive === false
      ? "bg-bearish/10 text-bearish"
      : "bg-secondary/50 text-muted-foreground";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
      <div className="text-sm text-muted-foreground">
        {marketOpen ? "Market open" : "Market closed"}
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${feedClass}`}
          title={last ? `Last price saved at ${last} IST` : "No prices saved yet"}
        >
          <div className={`h-2 w-2 rounded-full ${feedLive ? "bg-bullish animate-pulse" : marketOpen && feedLive === false ? "bg-bearish" : "bg-muted-foreground"}`} />
          <span className="text-xs font-medium">{feedText}{!feedLive && last ? ` (last ${last})` : ""}</span>
        </div>

        <Button variant="ghost" size="icon" className="rounded-full">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
        </Button>
      </div>
    </header>
  );
}
