export type SignalType = 'BUY' | 'SELL';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

export interface StockSignal {
  id: string;
  symbol: string;
  company_name: string;
  signal_type: SignalType;
  entry_price: number;
  target_price: number;
  stoploss_price: number;
  confidence_score: number;
  signal_strength: SignalStrength;
  analysis: {
    vwap_analysis: string;
    volume_analysis: string;
    trend_analysis: string;
    pattern_detected: string;
    risk_reward_ratio: number;
  };
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface VirtualTrade {
  id: string;
  signal_id: string;
  symbol: string;
  entry_price: number;
  current_price: number;
  target_price: number;
  stoploss_price: number;
  quantity: number;
  trade_type: SignalType;
  status: TradeStatus;
  pnl: number;
  pnl_percentage: number;
  entry_time: string;
  exit_time?: string;
  exit_price?: number;
}

export interface ManualTrade {
  id: string;
  user_id: string;
  symbol: string;
  entry_price: number;
  target_price?: number;
  stoploss_price?: number;
  quantity: number;
  trade_type: SignalType;
  status: TradeStatus;
  notes?: string;
  pnl?: number;
  entry_time: string;
  exit_time?: string;
  exit_price?: number;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  company_name: string;
  current_price: number;
  change_percent: number;
  volume: number;
  added_at: string;
}

export interface MarketOverview {
  nifty50: {
    value: number;
    change: number;
    changePercent: number;
  };
  sensex: {
    value: number;
    change: number;
    changePercent: number;
  };
  bankNifty: {
    value: number;
    change: number;
    changePercent: number;
  };
}

export interface UserSettings {
  id: string;
  user_id: string;
  risk_appetite: 'LOW' | 'MEDIUM' | 'HIGH';
  max_position_size: number;
  default_stoploss_percent: number;
  auto_trading_enabled: boolean;
  notification_enabled: boolean;
  preferred_sectors: string[];
}
