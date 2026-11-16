export type ArenaSandboxSummary = {
  id: number;
  name: string;
  category: string;
  horizon: string;
  initial_capital: number;
  current_cash: number;
  invested_capital?: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  win_rate_pct: number;
  position_count: number;
  trade_count: number;
  auto_execute: boolean;
  position_order: number;
  created_at: string;
};

export type ArenaPosition = {
  id: number;
  sandbox_id: number;
  symbol: string;
  name: string | null;
  quantity: number;
  avg_buy_price: number;
  current_price: number | null;
  invested_amount: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  target_sell_price: number | null;
  ai_target_price: number | null;
  custom_target_price: number | null;
  stop_loss_price: number | null;
  distance_to_target_pct: number | null;
  distance_to_stop_pct: number | null;
  horizon: string;
  rationale: string | null;
  ai_score: number | null;
  created_at: string;
};

export type ArenaTrade = {
  id: number;
  sandbox_id: number;
  symbol: string;
  trade_type: string;
  quantity: number;
  price: number;
  total_amount: number;
  realized_pnl: number;
  realized_pnl_pct: number;
  notes: string | null;
  executed_at: string;
};

export type ArenaSandboxDetail = ArenaSandboxSummary & {
  description: string | null;
  invested_capital: number;
  realized_pnl: number;
  unrealized_pnl: number;
  positions: ArenaPosition[];
  trades: ArenaTrade[];
};

export type StockOptionItem = {
  symbol: string;
  name: string;
  tab: string;
  strategy_id?: string;
  strategy_title?: string;
  score: number;
  verdict: string;
  current_price: number;
  target_buy_price: number;
  target_sell_price: number;
  stop_loss_price: number;
  rationale: string;
  is_top?: boolean;
  upside_pct?: number;
  horizon_label?: string;
};
