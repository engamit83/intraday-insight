import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Daily net P&L (after costs) of the automatic paper trades (simulated_trades, rule set v4), last 30 days.
// (Before 16 Oct this read `daily_performance`, which nothing fills any more.)
interface DayPoint {
  date: string;
  pnl: number;
}

export function PortfolioChart() {
  const { user } = useAuth();
  const [data, setData] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows, error } = await supabase
        .from("simulated_trades")
        .select("entry_time, pnl")
        .eq("rules", "v4")
        .eq("status", "CLOSED")
        .gte("entry_time", since)
        .order("entry_time", { ascending: true });

      if (!error) {
        const byDay = new Map<string, number>();
        for (const r of rows || []) {
          if (!r.entry_time) continue;
          const day = new Date(Date.parse(r.entry_time) + 5.5 * 3600_000).toISOString().slice(0, 10);
          byDay.set(day, (byDay.get(day) ?? 0) + Number(r.pnl ?? 0));
        }
        setData([...byDay.entries()].map(([date, pnl]) => ({ date, pnl: Math.round(pnl) })));
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const startValue = data[0]?.pnl ?? 0;
  const endValue = data[data.length - 1]?.pnl ?? 0;
  const isPositive = endValue >= startValue;
  const chartColor = isPositive ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)";

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Paper Trading: Daily Result</h3>
          <p className="text-sm text-muted-foreground">Net after all costs, per day (no real money)</p>
        </div>
        {data.length > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-foreground">
              ₹{endValue.toLocaleString('en-IN')}
            </p>
            <p className={`text-sm font-medium ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
              Latest day's P&L
            </p>
          </div>
        )}
      </div>
      <div className="h-64">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading...
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center px-6">
            No closed paper trades yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 18%)" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
                tickFormatter={(value) => `₹${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 47%, 11%)',
                  border: '1px solid hsl(222, 47%, 18%)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 24px hsl(222 47% 4% / 0.5)',
                }}
                labelStyle={{ color: 'hsl(210, 40%, 96%)' }}
                formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'P&L']}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={chartColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
