export type TelecastRow = {
  horizon: string;
  low_range: number;
  target: number;
  high_range: number;
  upside_pct: number;
  downside_pct: number;
  confidence_pct: number;
};

export type TechnicalData = {
  trend: string;
  rsi_14: number;
  ema_20: number;
  ema_50: number;
  ema_200: number;
  macd_signal: string;
  volume_trend: string;
  support_1: number;
  support_2: number;
  resistance_1: number;
  resistance_2: number;
};

export type FundamentalData = {
  pe_ratio: number;
  sector_pe: number;
  pb_ratio: number;
  roce_pct: number;
  roe_pct: number;
  operating_margin_pct: number;
  debt_to_equity: number;
  moat_strength: string;
};

export type DiscoveredStock = {
  rank: number;
  overall_rank?: number;
  symbol: string;
  name: string;
  sector: string;
  cap_category: string;
  current_price: number;
  action: string;
  conviction_pct: number;
  total_score?: number;
  phase_a_score?: number;
  phase_b_score?: number;
  phase_c_score?: number;
  veto_triggered?: boolean;
  forensic_status?: string;
  management_tone?: string;
  catalyst_probability_pct?: number;
  risk_reward_ratio: string;
  catalyst_summary: string;
  horizon_target: number;
  horizon_upside_pct: number;
  stop_loss: number;
  strategy_id?: string;
  strategy_title?: string;
  strategy_icon?: string;
  strategy_badge?: string;
  strategy_color?: string;
  horizon_label?: string;
  technical: TechnicalData;
  fundamentals: FundamentalData;
  telecast_table: TelecastRow[];
};

export type StrategySection = {
  strategy_id: string;
  title: string;
  badge: string;
  icon: string;
  color: string;
  tagline: string;
  horizon_label: string;
  stocks: DiscoveredStock[];
};

export type VaultItem = {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  cap_category: string;
  current_price: number;
  initial_ai_score: number;
  current_ai_score: number;
  score_change: number;
  action: string;
  target_price: number;
  stop_loss: number;
  catalyst_summary: string;
  horizon_label: string;
  horizon_upside_pct: number;
  is_top_setup: boolean;
};

export type ScanRunRecord = {
  run_id: number;
  batch_number: number;
  batch_name: string;
  stock_range: string;
  total_screened: number;
  top_winners_count: number;
  top_symbol: string | null;
  top_score: number | null;
  executed_at: string;
  stocks: VaultItem[];
};

export type DiscoveryResponse = {
  timestamp: string;
  user_id: number;
  excluded_count: number;
  total_strategies: number;
  top_overall_stocks?: DiscoveredStock[];
  top_day_stocks?: DiscoveredStock[];
  top_week_stocks?: DiscoveredStock[];
  sections: StrategySection[];
};
