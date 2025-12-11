import { MainLayout } from "@/components/layout/MainLayout";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { ActiveSignals } from "@/components/dashboard/ActiveSignals";
import { 
  TrendingUp, 
  Zap, 
  Target, 
  BarChart3 
} from "lucide-react";

export default function Dashboard() {
  return (
    <MainLayout>
      {/* Market Ticker */}
      <div className="-mx-6 -mt-6 mb-6">
        <MarketTicker />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatsCard
          title="Today's P&L"
          value="₹5,800"
          change={5.8}
          changeLabel="vs yesterday"
          icon={<TrendingUp className="h-6 w-6" />}
          variant="success"
        />
        <StatsCard
          title="Active Signals"
          value="8"
          icon={<Zap className="h-6 w-6" />}
          variant="default"
        />
        <StatsCard
          title="Win Rate"
          value="73%"
          change={2.5}
          changeLabel="this week"
          icon={<Target className="h-6 w-6" />}
          variant="success"
        />
        <StatsCard
          title="Virtual Trades"
          value="12"
          icon={<BarChart3 className="h-6 w-6" />}
          variant="default"
        />
      </div>

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
