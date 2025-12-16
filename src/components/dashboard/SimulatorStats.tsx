import { useSimulatorStatus } from '@/hooks/useSimulatorStatus';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';

export function SimulatorStats() {
  const { status, loading } = useSimulatorStatus();

  if (loading || !status) {
    return null;
  }

  if (!status.simulatorEnabled) {
    return (
      <Card className="glass-card p-4 mb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span className="text-sm">Simulator Mode: OFF</span>
          <Badge variant="outline" className="ml-auto">Signal Only</Badge>
        </div>
      </Card>
    );
  }

  const pnlColor = status.todayPnl >= 0 ? 'text-bullish' : 'text-bearish';
  const PnlIcon = status.todayPnl >= 0 ? TrendingUp : TrendingDown;

  return (
    <Card className="glass-card p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Simulator Active</span>
            <Badge className="bg-primary/20 text-primary">PAPER</Badge>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Open Trades:</span>
            <span className="font-semibold">{status.openTrades}</span>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Today's P&L:</span>
            <span className={`font-semibold flex items-center gap-1 ${pnlColor}`}>
              <PnlIcon className="h-3 w-3" />
              ₹{status.todayPnl.toLocaleString()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Win Rate:</span>
            <span className="font-semibold">{status.winRate}%</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
