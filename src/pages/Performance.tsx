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
  TrendingDown, 
  Target, 
  Award,
  Calendar,
  Percent
} from "lucide-react";

const performanceData = [
  { date: 'Mon', pnl: 2500, trades: 5 },
  { date: 'Tue', pnl: -1200, trades: 4 },
  { date: 'Wed', pnl: 3800, trades: 6 },
  { date: 'Thu', pnl: 1500, trades: 3 },
  { date: 'Fri', pnl: 4200, trades: 7 },
];

const monthlyData = [
  { month: 'Jan', profit: 15000, loss: 5000 },
  { month: 'Feb', profit: 22000, loss: 8000 },
  { month: 'Mar', profit: 18000, loss: 12000 },
  { month: 'Apr', profit: 28000, loss: 6000 },
  { month: 'May', profit: 35000, loss: 9000 },
  { month: 'Jun', profit: 25000, loss: 7000 },
];

const strategyData = [
  { name: 'Breakout', value: 45, color: 'hsl(217, 91%, 60%)' },
  { name: 'Reversal', value: 25, color: 'hsl(142, 71%, 45%)' },
  { name: 'Momentum', value: 20, color: 'hsl(38, 92%, 50%)' },
  { name: 'VWAP', value: 10, color: 'hsl(270, 67%, 60%)' },
];

const topPerformers = [
  { symbol: 'RELIANCE', trades: 15, winRate: 80, totalPnl: 28500 },
  { symbol: 'TATAMOTORS', trades: 12, winRate: 75, totalPnl: 22300 },
  { symbol: 'HDFCBANK', trades: 18, winRate: 72, totalPnl: 19800 },
  { symbol: 'INFY', trades: 10, winRate: 70, totalPnl: 15600 },
  { symbol: 'TCS', trades: 8, winRate: 62, totalPnl: 8900 },
];

export default function Performance() {
  const totalPnl = performanceData.reduce((sum, d) => sum + d.pnl, 0);
  const totalTrades = performanceData.reduce((sum, d) => sum + d.trades, 0);
  const winRate = 73;
  const avgProfit = totalPnl / totalTrades;

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
          This Week
        </Badge>
      </div>

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
            <p className="text-sm text-muted-foreground">Avg. Profit</p>
            <Percent className="h-5 w-5 text-bullish" />
          </div>
          <p className="text-2xl font-bold font-mono text-bullish">
            ₹{avgProfit.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Daily P&L Chart */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Daily P&L</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
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
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
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
                  dataKey="pnl" 
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  fill="url(#colorPnl)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Performance */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Performance</h3>
          <div className="h-64">
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
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
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
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Strategy Distribution */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">Strategy Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={strategyData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {strategyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(222, 47%, 11%)',
                    border: '1px solid hsl(222, 47%, 18%)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            {strategyData.map((item) => (
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
                    <p className="font-mono font-semibold text-bullish">
                      +₹{stock.totalPnl.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground">Total P&L</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
