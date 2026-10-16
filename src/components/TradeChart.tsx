import { useEffect, useState } from "react";
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

// One paper trade on its day's 5-minute price chart: buy point, exit point, stop, normal stop and target.
// Purpose (owner, 17 Oct): see at a glance why a pick worked or failed.
export interface TradeForChart {
  symbol: string;
  direction: string | null;
  entry_price: number;
  exit_price: number | null;
  stoploss: number | null;
  initial_stop?: number | null;
  target: number | null;
  entry_time: string | null;
  exit_time: string | null;
}

const IST_MS = 5.5 * 60 * 60 * 1000;
const hhmm = (iso: string) => new Date(Date.parse(iso) + IST_MS).toISOString().slice(11, 16);

export function TradeChart({ t }: { t: TradeForChart }) {
  const [bars, setBars] = useState<{ time: string; close: number; range: [number, number] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!t.entry_time) { setLoading(false); return; }
      const day = new Date(Date.parse(t.entry_time) + IST_MS).toISOString().slice(0, 10);
      const from = new Date(Date.parse(`${day}T09:15:00+05:30`)).toISOString();
      const to = new Date(Date.parse(`${day}T15:30:00+05:30`)).toISOString();
      const { data } = await supabase
        .from("live_candles")
        .select("bucket_start, high, low, close")
        .eq("symbol", t.symbol)
        .eq("timeframe", "5min")
        .gte("bucket_start", from)
        .lt("bucket_start", to)
        .order("bucket_start", { ascending: true });
      setBars((data || []).map((c) => ({ time: hhmm(c.bucket_start), close: Number(c.close), range: [Number(c.low), Number(c.high)] as [number, number] })));
      setLoading(false);
    };
    load();
  }, [t.symbol, t.entry_time]);

  if (loading) return <div className="py-6 flex items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading chart…</div>;
  if (!bars.length) return <p className="py-6 text-center text-sm text-muted-foreground">No price candles saved for this day.</p>;

  const levels = [t.entry_price, t.exit_price, t.stoploss, t.initial_stop, t.target].filter((x): x is number => x != null).map(Number);
  const lows = bars.map((b) => b.range[0]), highs = bars.map((b) => b.range[1]);
  const lo = Math.min(...lows, ...levels), hi = Math.max(...highs, ...levels), pad = (hi - lo) * 0.05 || 1;
  const entryT = t.entry_time ? hhmm(t.entry_time) : null;
  const exitT = t.exit_time ? hhmm(t.exit_time) : null;
  const nearest = (time: string | null) => (time ? bars.reduce((a, b) => (Math.abs(+b.time.replace(":", "") - +time.replace(":", "")) < Math.abs(+a.time.replace(":", "") - +time.replace(":", "")) ? b : a)).time : null);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={bars} margin={{ top: 10, right: 70, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 18%)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} minTickGap={24} />
          <YAxis domain={[lo - pad, hi + pad]} tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }} width={70} tickFormatter={(v) => Number(v).toFixed(1)} />
          <Tooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 11%)", border: "1px solid hsl(222, 47%, 18%)" }}
            formatter={(v: number | number[], name: string) => (Array.isArray(v) ? [`${v[0]} – ${v[1]}`, "low – high"] : [v, name])} />
          <Bar dataKey="range" fill="hsl(215, 20%, 35%)" barSize={3} isAnimationActive={false} />
          <Line type="monotone" dataKey="close" stroke="hsl(210, 40%, 85%)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          {t.target != null && <ReferenceLine y={Number(t.target)} stroke="hsl(142, 71%, 45%)" strokeDasharray="4 4" label={{ value: "Target", position: "right", fill: "hsl(142, 71%, 45%)", fontSize: 11 }} />}
          <ReferenceLine y={Number(t.entry_price)} stroke="hsl(217, 91%, 60%)" label={{ value: "Buy/Sell", position: "right", fill: "hsl(217, 91%, 60%)", fontSize: 11 }} />
          {t.initial_stop != null && Number(t.initial_stop) !== Number(t.stoploss) && <ReferenceLine y={Number(t.initial_stop)} stroke="hsl(0, 72%, 51%)" strokeDasharray="2 4" label={{ value: "Normal stop", position: "right", fill: "hsl(0, 72%, 51%)", fontSize: 11 }} />}
          {t.stoploss != null && <ReferenceLine y={Number(t.stoploss)} stroke="hsl(0, 72%, 51%)" strokeDasharray="4 4" label={{ value: "Stop", position: "right", fill: "hsl(0, 72%, 51%)", fontSize: 11 }} />}
          {entryT && <ReferenceDot x={nearest(entryT)!} y={Number(t.entry_price)} r={5} fill="hsl(217, 91%, 60%)" stroke="none" />}
          {exitT && t.exit_price != null && <ReferenceDot x={nearest(exitT)!} y={Number(t.exit_price)} r={5} fill="hsl(38, 92%, 50%)" stroke="none" />}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-1">5-minute prices (bars = low–high, line = close). Blue dot = entry, orange dot = exit.</p>
    </div>
  );
}
