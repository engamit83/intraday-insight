import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Real status for the header/sidebar (replaces the always-on "LIVE" / "Market Open" labels):
//  - marketOpen: Mon-Fri 09:15-15:30 India time by the clock (NSE holidays are not known here)
//  - feedLive:   the laptop feed saved a 1-minute candle in the last 3 minutes
const IST_MS = 5.5 * 60 * 60 * 1000;

export function isMarketOpenNow(now = Date.now()): boolean {
  const d = new Date(now + IST_MS);
  const day = d.getUTCDay();
  const min = d.getUTCHours() * 60 + d.getUTCMinutes();
  return day >= 1 && day <= 5 && min >= 9 * 60 + 15 && min < 15 * 60 + 30;
}

export function useMarketStatus() {
  const [marketOpen, setMarketOpen] = useState(isMarketOpenNow());
  const [feedLive, setFeedLive] = useState<boolean | null>(null);
  const [lastPriceAt, setLastPriceAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      setMarketOpen(isMarketOpenNow());
      const { data } = await supabase
        .from("live_candles")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      const at = (data as { updated_at?: string } | null)?.updated_at ?? null;
      setLastPriceAt(at);
      setFeedLive(at ? Date.now() - Date.parse(at) < 3 * 60 * 1000 : false);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return { marketOpen, feedLive, lastPriceAt };
}
