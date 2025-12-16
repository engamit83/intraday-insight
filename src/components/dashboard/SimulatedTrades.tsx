import { useSimulatorStatus } from '@/hooks/useSimulatorStatus';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function SimulatedTrades() {
  const { status, loading } = useSimulatorStatus();

  if (loading || !status?.simulatorEnabled || status.trades.length === 0) {
    return null;
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Open Simulated Trades
          <Badge variant="outline" className="ml-auto">
            {status.trades.length} Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.trades.map((trade: any) => {
          const direction = trade.direction === 'BUY' ? 1 : -1;
          const currentPnl = trade.pnl || 0;
          const pnlColor = currentPnl >= 0 ? 'text-bullish' : 'text-bearish';
          const Icon = trade.direction === 'BUY' ? TrendingUp : TrendingDown;
          const directionColor = trade.direction === 'BUY' ? 'bg-bullish/20 text-bullish' : 'bg-bearish/20 text-bearish';
          
          return (
            <div 
              key={trade.id} 
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${directionColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{trade.symbol}</span>
                    <Badge variant="outline" className={directionColor}>
                      {trade.direction}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(trade.entry_time), { addSuffix: true })}
                    <span>• Entry: ₹{trade.entry_price.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`font-semibold ${pnlColor}`}>
                  {currentPnl >= 0 ? '+' : ''}₹{currentPnl.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {trade.market_condition || 'RANGE'}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
