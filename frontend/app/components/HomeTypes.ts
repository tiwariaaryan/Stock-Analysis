export type MarketIndex = {
  id: number;
  symbol: string;
  name: string;
  value: string;
  change: string | null;
  change_pct: number | null;
};

export type DailySnapshot = {
  macro_regime: string;
  regime_color: string;
  cash_guidance: string;
  macro_advice: string;
  portfolio_action_points: string[];
  wishlist_buy_triggers: string[];
  sector_inflows: string[];
};

export type RecommendationItem = {
  rank: number;
  symbol: string;
  name: string;
  asset_type: string;
  category: string;
  action: string;
  action_color: string;
  overall_score: number;
  conviction_pct?: number;
  total_score?: number;
  phase_a_score?: number;
  phase_b_score?: number;
  phase_c_score?: number;
  veto_triggered?: boolean;
  forensic_status?: string;
  management_tone?: string;
  catalyst_probability_pct?: number;
  current_price: number;
  estimated_fair_value: number;
  target_price: number;
  stop_loss: number;
  expected_1y_return: string;
  catalyst_summary: string;
  reasons: string[];
  technical?: {
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
  fundamentals?: {
    pe_ratio: number | string;
    sector_pe: number | string;
    pb_ratio: number | string;
    roce_pct: number | string;
    roe_pct: number | string;
    operating_margin_pct: number | string;
    debt_to_equity: number | string;
    moat_strength: string;
  };
  scenarios?: {
    bull: { target: number; prob: number; trigger: string };
    base: { target: number; prob: number; trigger: string };
    bear: { stop: number; prob: number; trigger: string };
  };
};

export type MarketMover = {
  symbol: string;
  name: string;
  category: string;
  asset_type: string;
  price: number;
  change_amt: number;
  change_pct: number;
};

export type MarketScanPayload = {
  timestamp: string;
  scan_status: string;
  market_summary: {
    overall_sentiment: string;
    sentiment_score: number;
    universe_scanned_count: number;
    total_gainers_today: number;
    total_losers_today: number;
  };
  top_5_recommendations: RecommendationItem[];
  market_movers: {
    gainers: MarketMover[];
    losers: MarketMover[];
  };
  internet_sentiment_and_catalysts: {
    macro_news: { title: string; source: string; impact: string; horizon: string }[];
    rising_themes: string[];
    declining_themes: string[];
    key_takeaway: string;
  };
};
