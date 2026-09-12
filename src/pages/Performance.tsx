import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Target, 
  Award,
  Calendar,
  Percent,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ClosedTrade {
  symbol: string;
  trade_type: string;
  pnl: number | null;
  closed_at: string | null;
}

interface DailyPerf {
  date: string;
  total_pnl: number | null;
}

const TYPE_COLORS: Record<string, string> = {
  BUY: 'hsl(142, 71%, 45%)',
  SELL: 'hsl(0, 72%, 51%)',
};

export default function Performance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [dailyPerf, setDailyPerf] = useState<DailyPerf[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);

      const [tradesRes, perfRes] = await Promise.all([
        supabase
          .from("trades")
          .select("symbol, trade_type, pnl, closed_at")
          .eq("user_id", user.id)
          .eq("status", "CLOSED"),
        supabase
          .from("daily_performance")
          .select("date, total_pnl")
          .eq("user_id", user.id)
          .order("date", { ascending: true })
          .limit(30),
      ]);

      if (!tradesRes.error) setTrades(tradesRes.data || []);
      if (!perfRes.error) setDailyPerf(perfRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalTrades = trades.length;
  const winningTrades = trades.filter((t) => (t.pnl || 0) >= 0).length;
  const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 100) : 0;
  const avgProfit = totalTrades > 0 ? totalPnl / totalTrades : 0;

  // Real BUY vs SELL trade-type distribution (there's no "strategy" concept
  // stored anywhere in the schema, so this replaces the old fabricated
  // Breakout/Reversal/Momentum/VWAP pie chart with something actually real).
  const typeCounts = trades.reduce<Record<string, number>>((acc, t) => {
    acc[t.trade_type] = (acc[t.trade_type] || 0) + 1;
    return acc;
  }, {});
  const typeData = Object.entries(typeCounts).map(([name, value]) => ({
    name,
    value,
    color: TYPE_COLORS[name] || 'hsl(217, 91%, 60%)',
  }));

  // Monthly rollup, computed from real daily_performance rows.
  const monthlyMap = new Map<string, { profit: number; loss: number }>();
  dailyPerf.forEach((d) => {
    const month = new Date(d.date).toLocaleString('en-IN', { month: 'short' });
    const entry = monthlyMap.get(month) || { profit: 0, loss: 0 };
    const pnl = d.total_pnl || 0;
    if (pnl >= 0) entry.profit += pnl;
    else entry.loss += Math.abs(pnl);
    monthlyMap.set(month, entry);
  });
  const monthlyData = Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, ...v }));

  // Top performing stocks, aggregated from real closed trades.
  const bySymbol = new Map<string, { trades: number; wins: number; totalPnl: number }>();
  trades.forEach((t) => {
    const entry = bySymbol.get(t.symbol) || { trades: 0, wins: 0, totalPnl: 0 };
    entry.trades += 1;
    if ((t.pnl || 0) >= 0) entry.wins += 1;
    entry.totalPnl += t.pnl || 0;
    bySymbol.set(t.symbol, entry);
  });
  const topPerformers = Array.from(bySymbol.entries())
    .map(([symbol, v]) => ({
      symbol,
      trades: v.trades,
      winRate: Math.round((v.wins / v.trades) * 100),
      totalPnl: v.totalPnl,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .slice(0, 5);

  if (loading) {
    return (
      <MainLayout>
        <div className="glass-card rounded-xl p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground">Loading performance data...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance Analytics</h1>
          <p className="text-muted-foreground">Track your trading performance</p>
        </div>
        <Badge variant="outline" className="w-fit">
          <Calendar className="h-4 w-4 mr-2" />
          All Time
        </Badge>
      </div>

      {totalTrades === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Closed Trades Yet</h3>
          <p className="text-muted-foreground">
            Once you close some manual or simulated trades, real performance analytics will show up here.
          </p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Total P&L</p>
                <TrendingUp className="h-5 w-5 text-bullish" />
              </div>
              <p className={cn(
                "text-2xl font-bold font-mono",
                totalPnl >= 0 ? "text-bullish" : "text-bearish"
              )}>
                {totalPnl >= 0 ? "+" : ""}₹{totalPnl.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <Target className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">{winRate}%</p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Total Trades</p>
                <Award className="h-5 w-5 text-warning" />
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">{totalTrades}</p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">Avg. P&L / Trade</p>
                <Percent className="h-5 w-5 text-bullish" />
              </div>
              <p className={cn("text-2xl font-bold font-mono", avgProfit >= 0 ? "text-bullish" : "text-bearish")}>
                {avgProfit >= 0 ? "+" : ""}₹{avgProfit.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            {/* Daily P&L Chart */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Daily P&L</h3>
              <div className="h-64">
                {dailyPerf.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No daily_performance rows yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyPerf}>
                      <defs>
                        <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
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
                        }}
                        formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'P&L']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="total_pnl" 
                        stroke="hsl(217, 91%, 60%)"
                        strokeWidth={2}
                        fill="url(#colorPnl)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Monthly Performance */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Performance</h3>
              <div className="h-64">
                {monthlyData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Not enough daily_performance history yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 18%)" vertical={false} />
                      <XAxis 
                        dataKey="month" 
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
                        }}
                        formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`]}
                      />
                      <Bar dataKey="profit" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="loss" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Trade Type Distribution (real, replaces fabricated "strategy" chart) */}
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4">Trade Type Distribution</h3>
              <p className="text-xs text-muted-foreground -mt-3 mb-4">
                No "strategy" field exists in the schema, so this shows real BUY vs SELL counts instead.
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(222, 47%, 11%)',
                        border: '1px solid hsl(222, 47%, 18%)',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value} trades`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {typeData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Performing Stocks */}
            <div className="glass-card rounded-xl p-5 lg:col-span-2">
              <h3 className="text-lg font-semibold text-foreground mb-4">Top Performing Stocks</h3>
              <div className="space-y-3">
                {topPerformers.map((stock, index) => (
                  <div key={stock.symbol} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{stock.symbol}</p>
                        <p className="text-xs text-muted-foreground">{stock.trades} trades</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-sm font-semibold text-bullish">{stock.winRate}%</p>
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-mono font-semibold", stock.totalPnl >= 0 ? "text-bullish" : "text-bearish")}>
                          {stock.totalPnl >= 0 ? "+" : ""}₹{stock.totalPnl.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-muted-foreground">Total P&L</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
