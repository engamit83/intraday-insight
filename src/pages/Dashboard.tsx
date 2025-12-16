import { MainLayout } from "@/components/layout/MainLayout";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { ActiveSignals } from "@/components/dashboard/ActiveSignals";
import { SimulatorStats } from "@/components/dashboard/SimulatorStats";
import { SimulatedTrades } from "@/components/dashboard/SimulatedTrades";
import { useSimulatorStatus } from "@/hooks/useSimulatorStatus";
import { 
  TrendingUp, 
  Zap, 
  Target, 
  BarChart3 
} from "lucide-react";

export default function Dashboard() {
  const { status } = useSimulatorStatus();
  
  // Use simulator data when available
  const todayPnl = status?.simulatorEnabled ? status.todayPnl : 5800;
  const winRate = status?.simulatorEnabled ? status.winRate : 73;
  const virtualTrades = status?.simulatorEnabled ? status.todayTrades : 12;

  return (
    <MainLayout>
      {/* Market Ticker */}
      <div className="-mx-6 -mt-6 mb-6">
        <MarketTicker />
      </div>

      {/* Simulator Status Bar */}
      <SimulatorStats />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Today's P&L"
          value={`₹${todayPnl.toLocaleString()}`}
          change={todayPnl > 0 ? Math.abs(todayPnl / 100) : -Math.abs(todayPnl / 100)}
          changeLabel="vs yesterday"
          icon={<TrendingUp className="h-6 w-6" />}
          variant={todayPnl >= 0 ? "success" : "danger"}
        />
        <StatsCard
          title="Active Signals"
          value="8"
          icon={<Zap className="h-6 w-6" />}
          variant="default"
        />
        <StatsCard
          title="Win Rate"
          value={`${winRate}%`}
          change={winRate > 70 ? 2.5 : -1.5}
          changeLabel="this week"
          icon={<Target className="h-6 w-6" />}
          variant={winRate > 60 ? "success" : "warning"}
        />
        <StatsCard
          title={status?.simulatorEnabled ? "Simulated Trades" : "Virtual Trades"}
          value={virtualTrades.toString()}
          icon={<BarChart3 className="h-6 w-6" />}
          variant="default"
        />
      </div>

      {/* Simulated Trades (when simulator active) */}
      {status?.simulatorEnabled && status.trades.length > 0 && (
        <div className="mb-6">
          <SimulatedTrades />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2">
          <PortfolioChart />
        </div>
        <div>
          <RecentTrades />
        </div>
      </div>

      {/* Active Signals */}
      <ActiveSignals />
    </MainLayout>
  );
}
