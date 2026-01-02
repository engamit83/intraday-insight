export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      daily_performance: {
        Row: {
          best_stock: string | null
          created_at: string
          date: string
          id: string
          total_pnl: number | null
          total_trades: number | null
          user_id: string | null
          win_rate: number | null
          winning_trades: number | null
          worst_stock: string | null
        }
        Insert: {
          best_stock?: string | null
          created_at?: string
          date: string
          id?: string
          total_pnl?: number | null
          total_trades?: number | null
          user_id?: string | null
          win_rate?: number | null
          winning_trades?: number | null
          worst_stock?: string | null
        }
        Update: {
          best_stock?: string | null
          created_at?: string
          date?: string
          id?: string
          total_pnl?: number | null
          total_trades?: number | null
          user_id?: string | null
          win_rate?: number | null
          winning_trades?: number | null
          worst_stock?: string | null
        }
        Relationships: []
      }
      indicator_cache: {
        Row: {
          atr: number | null
          computed_at: string
          id: string
          macd: number | null
          macd_histogram: number | null
          macd_signal: number | null
          pattern_detected: string | null
          raw_data: Json | null
          relative_volume: number | null
          rsi: number | null
          symbol: string
          timeframe: string
          trend_strength: number | null
          vwap: number | null
        }
        Insert: {
          atr?: number | null
          computed_at?: string
          id?: string
          macd?: number | null
          macd_histogram?: number | null
          macd_signal?: number | null
          pattern_detected?: string | null
          raw_data?: Json | null
          relative_volume?: number | null
          rsi?: number | null
          symbol: string
          timeframe?: string
          trend_strength?: number | null
          vwap?: number | null
        }
        Update: {
          atr?: number | null
          computed_at?: string
          id?: string
          macd?: number | null
          macd_histogram?: number | null
          macd_signal?: number | null
          pattern_detected?: string | null
          raw_data?: Json | null
          relative_volume?: number | null
          rsi?: number | null
          symbol?: string
          timeframe?: string
          trend_strength?: number | null
          vwap?: number | null
        }
        Relationships: []
      }
      learning_adjustments: {
        Row: {
          adjusted_value: number | null
          adjustment_reason: string | null
          condition_type: string
          created_at: string | null
          id: string
          last_updated: string | null
          original_value: number | null
          success_rate: number | null
          trade_count: number | null
        }
        Insert: {
          adjusted_value?: number | null
          adjustment_reason?: string | null
          condition_type: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          original_value?: number | null
          success_rate?: number | null
          trade_count?: number | null
        }
        Update: {
          adjusted_value?: number | null
          adjustment_reason?: string | null
          condition_type?: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          original_value?: number | null
          success_rate?: number | null
          trade_count?: number | null
        }
        Relationships: []
      }
      market_conditions: {
        Row: {
          condition: string
          confidence: number | null
          created_at: string
          expires_at: string | null
          id: string
          index_direction: string | null
          time_of_day: string | null
          volatility_level: number | null
          volume_behavior: string | null
        }
        Insert: {
          condition: string
          confidence?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          index_direction?: string | null
          time_of_day?: string | null
          volatility_level?: number | null
          volume_behavior?: string | null
        }
        Update: {
          condition?: string
          confidence?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          index_direction?: string | null
          time_of_day?: string | null
          volatility_level?: number | null
          volume_behavior?: string | null
        }
        Relationships: []
      }
      scripcodes: {
        Row: {
          exchange: string
          id: string
          scrip_code: number
          symbol: string
          updated_at: string
        }
        Insert: {
          exchange?: string
          id?: string
          scrip_code: number
          symbol: string
          updated_at?: string
        }
        Update: {
          exchange?: string
          id?: string
          scrip_code?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          confidence: number
          created_at: string
          entry_price: number
          expires_at: string | null
          final_score: number | null
          id: string
          indicators: Json | null
          is_active: boolean | null
          is_tradable: boolean | null
          market_condition: string | null
          raw_score: number | null
          rejection_reason: string | null
          signal_type: string
          stoploss_price: number
          symbol: string
          target_price: number
          timeframe: string | null
        }
        Insert: {
          confidence: number
          created_at?: string
          entry_price: number
          expires_at?: string | null
          final_score?: number | null
          id?: string
          indicators?: Json | null
          is_active?: boolean | null
          is_tradable?: boolean | null
          market_condition?: string | null
          raw_score?: number | null
          rejection_reason?: string | null
          signal_type: string
          stoploss_price: number
          symbol: string
          target_price: number
          timeframe?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          entry_price?: number
          expires_at?: string | null
          final_score?: number | null
          id?: string
          indicators?: Json | null
          is_active?: boolean | null
          is_tradable?: boolean | null
          market_condition?: string | null
          raw_score?: number | null
          rejection_reason?: string | null
          signal_type?: string
          stoploss_price?: number
          symbol?: string
          target_price?: number
          timeframe?: string | null
        }
        Relationships: []
      }
      simulated_trades: {
        Row: {
          confidence_at_entry: number | null
          direction: string | null
          entry_price: number
          entry_time: string | null
          exit_price: number | null
          exit_reason: string | null
          exit_time: string | null
          id: string
          market_condition: string | null
          pnl: number | null
          pnl_percent: number | null
          quantity: number | null
          signal_id: string | null
          status: string | null
          symbol: string
          user_id: string | null
        }
        Insert: {
          confidence_at_entry?: number | null
          direction?: string | null
          entry_price: number
          entry_time?: string | null
          exit_price?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          id?: string
          market_condition?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          quantity?: number | null
          signal_id?: string | null
          status?: string | null
          symbol: string
          user_id?: string | null
        }
        Update: {
          confidence_at_entry?: number | null
          direction?: string | null
          entry_price?: number
          entry_time?: string | null
          exit_price?: number | null
          exit_reason?: string | null
          exit_time?: string | null
          id?: string
          market_condition?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          quantity?: number | null
          signal_id?: string | null
          status?: string | null
          symbol?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulated_trades_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      stocks: {
        Row: {
          id: string
          last_price: number | null
          name: string | null
          sector: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          id?: string
          last_price?: number | null
          name?: string | null
          sector?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          id?: string
          last_price?: number | null
          name?: string | null
          sector?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
          source: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          source?: string
        }
        Relationships: []
      }
      trade_exits: {
        Row: {
          created_at: string | null
          exit_reason: string
          exit_type: string | null
          id: string
          market_condition: string | null
          momentum_at_exit: number | null
          notes: string | null
          pnl_at_exit: number | null
          time_held_minutes: number | null
          trade_id: string | null
          volume_at_exit: number | null
          vwap_position: string | null
        }
        Insert: {
          created_at?: string | null
          exit_reason: string
          exit_type?: string | null
          id?: string
          market_condition?: string | null
          momentum_at_exit?: number | null
          notes?: string | null
          pnl_at_exit?: number | null
          time_held_minutes?: number | null
          trade_id?: string | null
          volume_at_exit?: number | null
          vwap_position?: string | null
        }
        Update: {
          created_at?: string | null
          exit_reason?: string
          exit_type?: string | null
          id?: string
          market_condition?: string | null
          momentum_at_exit?: number | null
          notes?: string | null
          pnl_at_exit?: number | null
          time_held_minutes?: number | null
          trade_id?: string | null
          volume_at_exit?: number | null
          vwap_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_exits_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          closed_at: string | null
          entry_price: number
          exit_price: number | null
          exit_reason: string | null
          id: string
          momentum_at_entry: number | null
          momentum_at_exit: number | null
          notes: string | null
          opened_at: string
          pnl: number | null
          pnl_percentage: number | null
          quantity: number
          signal_id: string | null
          status: string
          symbol: string
          time_held_minutes: number | null
          trade_mode: string
          trade_type: string
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          entry_price: number
          exit_price?: number | null
          exit_reason?: string | null
          id?: string
          momentum_at_entry?: number | null
          momentum_at_exit?: number | null
          notes?: string | null
          opened_at?: string
          pnl?: number | null
          pnl_percentage?: number | null
          quantity?: number
          signal_id?: string | null
          status?: string
          symbol: string
          time_held_minutes?: number | null
          trade_mode?: string
          trade_type: string
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          entry_price?: number
          exit_price?: number | null
          exit_reason?: string | null
          id?: string
          momentum_at_entry?: number | null
          momentum_at_exit?: number | null
          notes?: string | null
          opened_at?: string
          pnl?: number | null
          pnl_percentage?: number | null
          quantity?: number
          signal_id?: string | null
          status?: string
          symbol?: string
          time_held_minutes?: number | null
          trade_mode?: string
          trade_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_rules: {
        Row: {
          consecutive_loss_limit: number | null
          id: string
          is_active: boolean | null
          last_updated: string | null
          market_multiplier: number | null
          max_daily_loss: number | null
          max_daily_trades: number | null
          metadata: Json | null
          min_score_threshold: number | null
          risk_multiplier: number | null
          rule_name: string
          time_multiplier: number | null
        }
        Insert: {
          consecutive_loss_limit?: number | null
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          market_multiplier?: number | null
          max_daily_loss?: number | null
          max_daily_trades?: number | null
          metadata?: Json | null
          min_score_threshold?: number | null
          risk_multiplier?: number | null
          rule_name: string
          time_multiplier?: number | null
        }
        Update: {
          consecutive_loss_limit?: number | null
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          market_multiplier?: number | null
          max_daily_loss?: number | null
          max_daily_trades?: number | null
          metadata?: Json | null
          min_score_threshold?: number | null
          risk_multiplier?: number | null
          rule_name?: string
          time_multiplier?: number | null
        }
        Relationships: []
      }
      trading_state: {
        Row: {
          auto_mode_active: boolean | null
          consecutive_losses: number | null
          created_at: string | null
          daily_pnl: number | null
          date: string
          id: string
          last_trade_time: string | null
          stop_reason: string | null
          trades_today: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_mode_active?: boolean | null
          consecutive_losses?: number | null
          created_at?: string | null
          daily_pnl?: number | null
          date?: string
          id?: string
          last_trade_time?: string | null
          stop_reason?: string | null
          trades_today?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_mode_active?: boolean | null
          consecutive_losses?: number | null
          created_at?: string | null
          daily_pnl?: number | null
          date?: string
          id?: string
          last_trade_time?: string | null
          stop_reason?: string | null
          trades_today?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          alpha_vantage_api_key: string | null
          auto_mode_enabled: boolean | null
          created_at: string
          default_stoploss_percent: number | null
          id: string
          max_trades_per_day: number | null
          notification_enabled: boolean | null
          preferred_sectors: string[] | null
          risk_level: string | null
          sharekhan_access_token: string | null
          sharekhan_refresh_token: string | null
          sharekhan_token_expiry: string | null
          sharekhan_token_generated_at: string | null
          simulator_mode: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alpha_vantage_api_key?: string | null
          auto_mode_enabled?: boolean | null
          created_at?: string
          default_stoploss_percent?: number | null
          id?: string
          max_trades_per_day?: number | null
          notification_enabled?: boolean | null
          preferred_sectors?: string[] | null
          risk_level?: string | null
          sharekhan_access_token?: string | null
          sharekhan_refresh_token?: string | null
          sharekhan_token_expiry?: string | null
          sharekhan_token_generated_at?: string | null
          simulator_mode?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alpha_vantage_api_key?: string | null
          auto_mode_enabled?: boolean | null
          created_at?: string
          default_stoploss_percent?: number | null
          id?: string
          max_trades_per_day?: number | null
          notification_enabled?: boolean | null
          preferred_sectors?: string[] | null
          risk_level?: string | null
          sharekhan_access_token?: string | null
          sharekhan_refresh_token?: string | null
          sharekhan_token_expiry?: string | null
          sharekhan_token_generated_at?: string | null
          simulator_mode?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          added_at: string
          company_name: string | null
          id: string
          symbol: string
          user_id: string | null
        }
        Insert: {
          added_at?: string
          company_name?: string | null
          id?: string
          symbol: string
          user_id?: string | null
        }
        Update: {
          added_at?: string
          company_name?: string | null
          id?: string
          symbol?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
