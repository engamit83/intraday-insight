import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { time: '09:15', value: 100000 },
  { time: '09:45', value: 100850 },
  { time: '10:15', value: 101200 },
  { time: '10:45', value: 100950 },
  { time: '11:15', value: 102300 },
  { time: '11:45', value: 103150 },
  { time: '12:15', value: 102800 },
  { time: '12:45', value: 103500 },
  { time: '13:15', value: 104200 },
  { time: '13:45', value: 103900 },
  { time: '14:15', value: 105100 },
  { time: '14:45', value: 106250 },
  { time: '15:15', value: 105800 },
];

export function PortfolioChart() {
  const startValue = data[0].value;
  const endValue = data[data.length - 1].value;
  const isPositive = endValue >= startValue;
  const chartColor = isPositive ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)";

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Portfolio Value</h3>
          <p className="text-sm text-muted-foreground">Today's performance</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono text-foreground">
            ₹{endValue.toLocaleString('en-IN')}
          </p>
          <p className={`text-sm font-medium ${isPositive ? 'text-bullish' : 'text-bearish'}`}>
            {isPositive ? '+' : ''}₹{(endValue - startValue).toLocaleString('en-IN')} ({isPositive ? '+' : ''}{(((endValue - startValue) / startValue) * 100).toFixed(2)}%)
          </p>
        </div>
      </div>
      <div className="h-64">
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
              dataKey="time" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              domain={['dataMin - 1000', 'dataMax + 1000']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 11%)',
                border: '1px solid hsl(222, 47%, 18%)',
                borderRadius: '8px',
                boxShadow: '0 4px 24px hsl(222 47% 4% / 0.5)',
              }}
              labelStyle={{ color: 'hsl(210, 40%, 96%)' }}
              formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Value']}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={chartColor}
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorValue)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
