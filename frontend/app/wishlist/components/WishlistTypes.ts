export type WatchlistItem = {
  id: number;
  watchlist_id: number;
  symbol: string;
  name: string | null;
  current_price: number | null;
  target_buy_price: number | null;
  target_sell_price: number | null;
  notes: string | null;
  tags: string | null;
  alert_active: boolean;
  created_at: string;
};

export type Watchlist = {
  id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  items_count: number;
  created_at: string;
};

export type DeepAnalysis = {
  symbol: string;
  name: string;
  current_price: number;
  day_change_pct: number;
  recommendation: "BUY" | "HOLD" | "SELL";
  recommendation_sub: string;
  recommendation_color: string;
  composite_score: number;
  phase_a_score?: number;
  phase_b_score?: number;
  phase_c_score?: number;
  veto_triggered?: boolean;
  forensic_status?: string;
  management_tone?: string;
  catalyst_probability_pct?: number;
  summary_reason: string;
  ai_support_price: number;
  recommended_stop_loss: number;
  diff_from_wishlist_avg?: number;
  diff_label?: string;
  valuation_band: {
    current_pe: number;
    median_2y_pe: number;
    min_2y_pe: number;
    max_2y_pe: number;
    pe_percentile: number;
    pb_ratio: number;
    peg_ratio: number;
    earnings_yield: number;
    gsec_spread: number;
  };
  financial_quality: {
    piotroski_f_score: number;
    roce_pct: number;
    roe_pct: number;
    operating_margin_pct: number;
    debt_to_equity: number;
    current_ratio: number;
    dividend_yield: number;
  };
  price_action_2y: {
    high_2y: number;
    low_2y: number;
    drawdown_pct: number;
    return_2y_pct: number;
    ema50: number;
    ema200: number;
    trend_status: string;
    rsi: number;
  };
  institutional_footprint: {
    promoters_pct: number;
    institutions_fii_dii_pct: number;
    public_pct: number;
    volume_ratio: number;
  };
  veteran_verdict: string;
  analyzed_at: string;
};

export type WishlistSummary = {
  average_score: number;
  overall_verdict: string;
  overall_color: string;
  overall_thesis: string;
  average_pe: number;
  average_f_score: number;
  average_drawdown: number;
  buy_count: number;
  hold_count: number;
  sell_count: number;
  top_stock?: string;
  top_score?: number;
};

export type WishlistDeepAudit = {
  watchlist_id: number;
  watchlist_name: string;
  total_stocks: number;
  summary: WishlistSummary;
  items: {
    item_id: number;
    symbol: string;
    target_buy_price: number | null;
    analysis: DeepAnalysis;
  }[];
  updated_at: string;
};
