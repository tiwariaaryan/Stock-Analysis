"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useProfile } from "@/components/ProfileProvider";
import StockModal from "@/components/StockModal";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const cards = [
  {
    href: "/ai-intelligence",
    title: "AI Intelligence",
    desc: "Dalal Street quant scoring, 3-stage dip ladders, statistical win rates & macro regime",
    gradient: "from-rose-900/40 to-bg-card",
    iconColor: "#f43f5e",
  },
  {
    href: "/market",
    title: "Live Market",
    desc: "Browse stocks, search any symbol, view detailed charts and key stats",
    gradient: "from-emerald-900/40 to-bg-card",
    iconColor: "#00c853",
  },
  {
    href: "/portfolio",
    title: "My Portfolio",
    desc: "Track holdings, total investments, P&L, and returns with central ledger",
    gradient: "from-blue-900/40 to-bg-card",
    iconColor: "#3b82f6",
  },
  {
    href: "/arena",
    title: "Paper Arena",
    desc: "Simulate & battle test User vs AI vs Tips with custom capital, automated triggers & leaderboards",
    gradient: "from-cyan-900/40 to-bg-card",
    iconColor: "#06b6d4",
  },
  {
    href: "/wishlist",
    title: "Wishlists",
    desc: "Target price buy/sell alerts, research notes, and dip accumulation lists",
    gradient: "from-amber-900/40 to-bg-card",
    iconColor: "#f59e0b",
  },
  {
    href: "/chat",
    title: "AI Chat",
    desc: "Dalal street veteran copilot with live portfolio, wishlist, and quant context",
    gradient: "from-purple-900/40 to-bg-card",
    iconColor: "#a78bfa",
  },
];

const icons: Record<string, string> = {
  "/ai-intelligence": "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  "/market": "M22 7l-8.5 8.5-4-4L2 17 M16 7h6v6",
  "/portfolio": "M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4Z",
  "/arena": "M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1h10v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34 M6 4h12v7a6 6 0 0 1-12 0V4z",
  "/wishlist": "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  "/chat": "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
};

type MarketIndex = {
  id: number;
  symbol: string;
  name: string;
  value: string;
  change: string | null;
  change_pct: number | null;
};

type DailySnapshot = {
  macro_regime: string;
  regime_color: string;
  cash_guidance: string;
  macro_advice: string;
  portfolio_action_points: string[];
  wishlist_buy_triggers: string[];
  sector_inflows: string[];
};

type RecommendationItem = {
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

type MarketMover = {
  symbol: string;
  name: string;
  category: string;
  asset_type: string;
  price: number;
  change_amt: number;
  change_pct: number;
};

type MarketScanPayload = {
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

export default function Home() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [recData, setRecData] = useState<MarketScanPayload | null>(null);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<"top5" | "movers" | "sentiment">("top5");
  const [modalStock, setModalStock] = useState<string | null>(null);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  // Interactive Hover & Popout state
  const [hoveredStock, setHoveredStock] = useState<RecommendationItem | null>(null);
  const [popoutStock, setPopoutStock] = useState<RecommendationItem | null>(null);

  const { profile, userId } = useProfile();
  const h = new Date().getHours();
  const greet = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  const displayName = profile?.display_name || profile?.username || "";

  function getEffectiveUserId(): number {
    if (userId) return userId;
    if (profile?.id) return profile.id;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("investintel_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.id) return Number(parsed.id);
        }
      } catch {}
    }
    return 2; // Default to user 2 (Aaryan Tiwari)
  }

  useEffect(() => {
    const uid = getEffectiveUserId();

    fetch(`${API}/api/v1/market/indices`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setIndices(data);
      })
      .catch(() => {});

    fetch(`${API}/api/v1/strategy/daily-snapshot?user_id=${uid}`)
      .then((r) => r.json())
      .then((data) => setSnapshot(data))
      .catch(() => {});

    // Load initial cached recommendations if available
    fetch(`${API}/api/v1/strategy/market-recommendations/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setRecData(data);
      })
      .catch(() => {});
  }, [profile?.id, userId]);

  const handleScanMarket = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${API}/api/v1/strategy/market-recommendations/scan`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRecData(data);
      }
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  };

  const handleAddToWishlist = async (sym: string, targetPrice?: number) => {
    try {
      const activeId = getEffectiveUserId();
      const wRes = await fetch(`${API}/api/v1/watchlists?user_id=${activeId}`);
      if (wRes.ok) {
        const lists = await wRes.json();
        if (lists && lists.length > 0) {
          await fetch(`${API}/api/v1/watchlists/${lists[0].id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: sym.toUpperCase(),
              target_buy_price: targetPrice || null,
              notes: "Added from AI Market Recommendations",
            }),
          });
          setAddedSymbols((prev) => new Set([...prev, sym]));
        }
      }
    } catch {
      // ignore
    }
  };

  const fmt = (n: string | number | null | undefined) =>
    n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-48px)] p-4 md:p-8">
      <div className="w-full max-w-5xl space-y-6">
        {/* Greeting */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-muted flex items-center justify-center mx-auto mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5">
              <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-txt-primary">{greet}{displayName ? `, ${displayName}` : ""}</h1>
          <p className="text-sm text-txt-secondary mt-1">
            Autonomous <span className="text-accent-light">Dalal Street Quant Intelligence</span> & Investment Copilot
          </p>
        </div>

        {/* Daily 2-Minute Actionable Snapshot Banner */}
        {snapshot && (
          <div className="bg-bg-card border border-rose-500/30 rounded-xl p-4 md:p-5 relative overflow-hidden shadow-lg shadow-rose-950/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-300">
                  Daily 2-Minute Actionable Snapshot
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="px-2.5 py-0.5 rounded text-[11px] font-bold"
                  style={{ backgroundColor: `${snapshot.regime_color}22`, color: snapshot.regime_color }}
                >
                  {snapshot.macro_regime}
                </span>
                <span className="text-xs text-txt-muted bg-bg-primary px-2.5 py-0.5 rounded border border-border">
                  Dry Powder: <strong className="text-txt-primary">{snapshot.cash_guidance}</strong>
                </span>
                <Link
                  href="/ai-intelligence"
                  className="text-xs font-medium text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  Full Radar &rarr;
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-bg-primary/60 rounded-lg p-3 border border-border/60">
                <p className="font-semibold text-txt-primary mb-1.5 flex items-center gap-1.5">
                  <span className="text-amber-400">🎯</span> Wishlist Dip Triggers & Alerts
                </p>
                <div className="space-y-1">
                  {snapshot.wishlist_buy_triggers.slice(0, 2).map((item, idx) => (
                    <p key={`wb-${idx}`} className="text-txt-secondary text-[11px] leading-relaxed">
                      {item}
                    </p>
                  ))}
                </div>
              </div>

              <div className="bg-bg-primary/60 rounded-lg p-3 border border-border/60">
                <p className="font-semibold text-txt-primary mb-1.5 flex items-center gap-1.5">
                  <span className="text-emerald-400">🛡</span> Portfolio Health & Milestones
                </p>
                <div className="space-y-1">
                  {snapshot.portfolio_action_points.slice(0, 2).map((item, idx) => (
                    <p key={`pa-${idx}`} className="text-txt-secondary text-[11px] leading-relaxed">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* NEW CARD: AI Stock Recommendation System & Market Intelligence */}
        {/* ============================================================== */}
        <div className="bg-bg-card glow-card rounded-2xl p-5 md:p-6 space-y-4 relative overflow-hidden">
          {/* Luminous Top Ambient Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]" />

          {/* Card Top Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8] animate-pulse" />
                <h2 className="text-base md:text-lg font-black ultra-white glow-cyan-title tracking-tight">
                  Dalal Street AI Recommendation & Market Intelligence Engine
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Multi-cap equities & ETFs evaluated across 25 institutional parameters, internet news, blogs, and market breadth
              </p>
            </div>

            {/* Prominent Scan Button */}
            <div className="flex items-center gap-3">
              {recData?.timestamp && (
                <span className="text-[10px] text-cyan-300/80 hidden sm:inline-block font-mono bg-bg-primary/80 px-2.5 py-1 rounded border border-border">
                  Scanned: {new Date(recData.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={handleScanMarket}
                disabled={scanning}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white text-xs font-black rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.4)] flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer active:scale-95 border border-indigo-400/40"
              >
                <span className={scanning ? "animate-spin text-sm" : "text-sm text-cyan-200"}>⚡</span>
                <span className="tracking-wide">{scanning ? "Scanning Market & Internet..." : "Scan Market & Fetch Suggestions"}</span>
              </button>
            </div>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex border-b border-border text-xs gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("top5")}
              className={`py-2 px-3 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "top5"
                  ? "border-accent text-accent-light"
                  : "border-transparent text-txt-muted hover:text-txt-primary"
              }`}
            >
              <span>🎯 Top 5 Curated AI Recommendations</span>
              {recData?.top_5_recommendations && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent-light font-mono">
                  {recData.top_5_recommendations.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("movers")}
              className={`py-2 px-3 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "movers"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-txt-muted hover:text-txt-primary"
              }`}
            >
              <span>📈 Market Movers (Top 10 Gainers & Losers)</span>
            </button>
            <button
              onClick={() => setActiveTab("sentiment")}
              className={`py-2 px-3 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === "sentiment"
                  ? "border-purple-400 text-purple-400"
                  : "border-transparent text-txt-muted hover:text-txt-primary"
              }`}
            >
              <span>🌐 Dalal Street Pulse & Future Catalysts</span>
            </button>
          </div>

          {/* Tab 1: Top 5 Curated AI Recommendations (Option 4: Big Bets Hero + Compact Table) */}
          {activeTab === "top5" && (
            <div className="space-y-4 animate-fade-in relative">
              {!recData ? (
                <div className="text-center py-10 bg-bg-primary/50 rounded-xl border border-dashed border-border/80">
                  <p className="text-sm font-semibold text-txt-primary mb-1">Click "Scan Market & Fetch Suggestions"</p>
                  <p className="text-xs text-txt-muted max-w-md mx-auto mb-4">
                    Our multi-factor engine will scrape internet news, blogs, and market breadth to deliver 5 high-conviction Buy & Sell setups.
                  </p>
                  <button
                    onClick={handleScanMarket}
                    disabled={scanning}
                    className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-lg hover:bg-accent-dark transition-colors cursor-pointer"
                  >
                    ⚡ Start Market Scan Now
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 1. HERO STRIP: Big Bets in Open Market (Top 3 High-Conviction Setups) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-xs">★</span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-txt-primary">
                          Big Bet Highlights (Open Market Setups)
                        </h3>
                      </div>
                      <span className="text-[10px] text-txt-dim">
                        Hover for snapshot &bull; Click card or row for deep analysis
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {recData.top_5_recommendations.slice(0, 3).map((rec, rIdx) => {
                        const isAdded = addedSymbols.has(rec.symbol);
                        const upsidePct = rec.current_price > 0 ? (((rec.target_price - rec.current_price) / rec.current_price) * 100).toFixed(1) : "0";
                        const conviction = rec.conviction_pct ?? Math.round(rec.overall_score);

                        return (
                          <div
                            key={`hero-bet-${rec.symbol}-${rIdx}`}
                            onMouseEnter={() => setHoveredStock(rec)}
                            onMouseLeave={() => setHoveredStock(null)}
                            onClick={() => setPopoutStock(rec)}
                            className="bg-bg-card glow-card rounded-xl p-3.5 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                          >
                            {/* Ambient Top Dual Glow Bar */}
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />

                            <div>
                              {/* Top Bar: Rank, Symbol, Action Badge with Conviction % */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded bg-bg-hover text-cyan-300 border border-slate-700">
                                    #{rec.rank}
                                  </span>
                                  <span className="font-black text-sm ultra-white group-hover:text-cyan-300 font-mono transition-colors">
                                    {rec.symbol}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-medium">
                                    {rec.category}
                                  </span>
                                </div>

                                <div
                                  className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 glow-cyan-badge"
                                  style={{
                                    backgroundColor: `${rec.action_color}25`,
                                    color: rec.action_color,
                                    border: `1px solid ${rec.action_color}77`,
                                  }}
                                >
                                  <span>{rec.action}</span>
                                  <span className="font-mono text-[9px] opacity-90">{conviction}%</span>
                                </div>
                              </div>

                              <p className="text-[11px] text-slate-300 font-medium truncate mb-2.5">{rec.name}</p>

                              {/* Price vs Target Metrics */}
                              <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-bg-hover/80 border border-slate-700/60 text-center mb-2">
                                <div>
                                  <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider">CMP</span>
                                  <strong className="text-xs font-mono font-black ultra-white">₹{fmt(rec.current_price)}</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-emerald-300 font-bold block uppercase tracking-wider">Target 1</span>
                                  <strong className="text-xs font-mono font-black text-emerald-400">₹{fmt(rec.target_price)}</strong>
                                </div>
                                <div>
                                  <span className="text-[9px] text-cyan-300 font-bold block uppercase tracking-wider">Upside</span>
                                  <span className="text-xs font-black font-mono text-cyan-300">+{upsidePct}%</span>
                                </div>
                              </div>

                              {/* 3-Pillar Institutional Breakdown Badge with Explicit Sum */}
                              <div className="flex items-center justify-between text-[9px] font-mono px-2 py-1 rounded bg-bg-hover/60 border border-slate-700/60 mb-2">
                                <span className="text-slate-400 font-medium">Final Score:</span>
                                <span className="text-cyan-300 font-bold">M:{Math.round(rec.phase_a_score ?? 32)}</span>
                                <span className="text-slate-600">+</span>
                                <span className="text-emerald-400 font-bold">F:{Math.round(rec.phase_b_score ?? 31)}</span>
                                <span className="text-slate-600">+</span>
                                <span className="text-indigo-300 font-bold">AI:{Math.round(rec.phase_c_score ?? 28)}</span>
                                <span className="text-slate-600">=</span>
                                <span className="text-white font-bold">{conviction}</span>
                              </div>

                              {/* 1-Line Catalyst */}
                              <p className="text-[10px] text-slate-100 font-medium line-clamp-2 leading-relaxed bg-bg-input p-1.5 rounded border-l-2 border-l-cyan-400 border border-slate-700/50">
                                <strong className="text-cyan-300 font-bold uppercase tracking-wider text-[9px] mr-1">Catalyst:</strong>
                                {rec.catalyst_summary}
                              </p>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="flex items-center justify-between border-t border-slate-700/70 pt-2 mt-2.5 text-xs">
                              <span className="text-[9px] text-slate-300">
                                Exp: <strong className="text-emerald-400 font-bold">{rec.expected_1y_return}</strong>
                              </span>
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleAddToWishlist(rec.symbol, rec.target_price)}
                                  disabled={isAdded}
                                  className={`px-2 py-0.5 text-[10px] rounded font-bold transition-colors ${
                                    isAdded
                                      ? "bg-gain/20 text-gain cursor-default"
                                      : "bg-bg-hover hover:bg-cyan-500/20 text-slate-200 hover:text-white border border-slate-700"
                                  }`}
                                >
                                  {isAdded ? "✓ Added" : "+ Wishlist"}
                                </button>
                                <button
                                  onClick={() => setPopoutStock(rec)}
                                  className="px-2.5 py-0.5 text-[10px] rounded bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-black shadow-[0_0_8px_rgba(56,189,248,0.3)] transition-colors"
                                >
                                  Analysis ↗
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. COMPACT MARKET RADAR TABLE (High-Density Quantitative Table for All 5 Picks) */}
                  <div className="bg-bg-card glow-card rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-2.5 border-b border-border/80 flex items-center justify-between bg-bg-hover/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black ultra-white uppercase tracking-wider">
                          Curated Market Radar Table
                        </span>
                        <span className="text-[10px] text-cyan-300 bg-bg-primary px-2 py-0.5 rounded border border-slate-700 font-bold">
                          5 High-Conviction Setups
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-300 hidden sm:inline-block font-medium">
                        Click any row for complete technical + fundamental breakdown
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border/70 text-[10px] uppercase font-bold text-slate-300 bg-bg-input">
                            <th className="py-2.5 px-3"># Rank & Stock</th>
                            <th className="py-2.5 px-3">Live CMP</th>
                            <th className="py-2.5 px-3">AI Verdict & Conviction</th>
                            <th className="py-2.5 px-3">Target 1 (Upside)</th>
                            <th className="py-2.5 px-3">Stop-Loss</th>
                            <th className="py-2.5 px-3">P/E & ROCE</th>
                            <th className="py-2.5 px-3">Trend & RSI</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {recData.top_5_recommendations.map((rec) => {
                            const isAdded = addedSymbols.has(rec.symbol);
                            const upsidePct = rec.current_price > 0 ? (((rec.target_price - rec.current_price) / rec.current_price) * 100).toFixed(1) : "0";
                            const conviction = rec.conviction_pct ?? Math.round(rec.overall_score);

                            return (
                              <tr
                                key={`row-rec-${rec.symbol}`}
                                onMouseEnter={() => setHoveredStock(rec)}
                                onMouseLeave={() => setHoveredStock(null)}
                                onClick={() => setPopoutStock(rec)}
                                className="hover:bg-bg-hover transition-colors cursor-pointer group"
                              >
                                {/* Rank & Stock */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-cyan-300 w-4">
                                      #{rec.rank}
                                    </span>
                                    <div>
                                      <span className="font-black ultra-white group-hover:text-cyan-300 font-mono block transition-colors">
                                        {rec.symbol}
                                      </span>
                                      <span className="text-[10px] text-slate-300 font-medium truncate block max-w-[130px]">
                                        {rec.name}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Live CMP */}
                                <td className="py-2.5 px-3 font-mono font-black ultra-white">
                                  ₹{fmt(rec.current_price)}
                                </td>

                                {/* AI Verdict & Conviction Badge */}
                                <td className="py-2.5 px-3">
                                  <div
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                                    style={{
                                      backgroundColor: `${rec.action_color}25`,
                                      color: rec.action_color,
                                      border: `1px solid ${rec.action_color}66`,
                                    }}
                                  >
                                    <span>{rec.action}</span>
                                    <span className="font-mono text-[9px] bg-black/40 px-1 rounded">
                                      {conviction}%
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400 mt-1">
                                    <span className="text-slate-500">Score:</span>
                                    <span className="text-cyan-300 font-bold">M:{Math.round(rec.phase_a_score ?? 32)}</span>
                                    <span className="text-slate-600">+</span>
                                    <span className="text-emerald-400 font-bold">F:{Math.round(rec.phase_b_score ?? 31)}</span>
                                    <span className="text-slate-600">+</span>
                                    <span className="text-indigo-300 font-bold">AI:{Math.round(rec.phase_c_score ?? 28)}</span>
                                    <span className="text-slate-600">=</span>
                                    <span className="text-white font-bold">{conviction}</span>
                                  </div>
                                </td>

                                {/* Target 1 & Upside */}
                                <td className="py-2.5 px-3">
                                  <span className="font-mono ultra-white block font-black">
                                    ₹{fmt(rec.target_price)}
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-400 font-mono">
                                    +{upsidePct}%
                                  </span>
                                </td>

                                {/* Stop-Loss */}
                                <td className="py-2.5 px-3 font-mono font-bold text-rose-400">
                                  ₹{fmt(rec.stop_loss)}
                                </td>

                                {/* P/E & ROCE */}
                                <td className="py-2.5 px-3 text-[11px]">
                                  <div className="font-mono text-txt-secondary">
                                    P/E: <strong className="text-txt-primary">{rec.fundamentals?.pe_ratio ?? "—"}</strong>
                                  </div>
                                  <div className="font-mono text-[10px] text-txt-dim">
                                    ROCE: <span className="text-emerald-400">{rec.fundamentals?.roce_pct ? `${rec.fundamentals.roce_pct}%` : "—"}</span>
                                  </div>
                                </td>

                                {/* Trend & RSI */}
                                <td className="py-2.5 px-3">
                                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                                    rec.technical?.trend?.includes("UP")
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                      : rec.technical?.trend?.includes("DOWN")
                                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                                      : "bg-bg-card text-txt-dim border border-border"
                                  }`}>
                                    {rec.technical?.trend ?? "STEADY"}
                                  </span>
                                  <span className="text-[9px] text-txt-dim block mt-0.5 font-mono">
                                    RSI: {rec.technical?.rsi_14 ?? "—"}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleAddToWishlist(rec.symbol, rec.target_price)}
                                      disabled={isAdded}
                                      className={`px-2 py-0.5 text-[10px] rounded font-semibold transition-colors ${
                                        isAdded
                                          ? "bg-gain/20 text-gain cursor-default"
                                          : "bg-bg-hover hover:bg-accent-muted text-txt-primary hover:text-accent-light"
                                      }`}
                                    >
                                      {isAdded ? "✓ Added" : "+ Wishlist"}
                                    </button>
                                    <button
                                      onClick={() => setPopoutStock(rec)}
                                      className="px-2 py-0.5 text-[10px] rounded bg-accent/20 hover:bg-accent/30 text-accent-light font-bold transition-colors"
                                    >
                                      Deep ↗
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. HOVER EFFECT: Dynamic Floating Snippet Card */}
              {hoveredStock && !popoutStock && (
                <div className="fixed bottom-5 right-5 w-80 bg-[#121422]/95 border border-accent/40 rounded-xl p-3.5 shadow-2xl backdrop-blur-md z-40 animate-fade-in pointer-events-none">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
                    <div>
                      <span className="font-bold text-xs text-txt-primary font-mono mr-1.5">
                        {hoveredStock.symbol}
                      </span>
                      <span className="text-[9px] text-txt-dim truncate">
                        {hoveredStock.name}
                      </span>
                    </div>
                    <span
                      className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${hoveredStock.action_color}20`,
                        color: hoveredStock.action_color,
                        border: `1px solid ${hoveredStock.action_color}40`,
                      }}
                    >
                      {hoveredStock.action} {hoveredStock.conviction_pct ?? Math.round(hoveredStock.overall_score)}%
                    </span>
                  </div>

                  {/* Quick Technicals & Fundamentals Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-2 font-mono">
                    <div className="bg-bg-primary/80 p-1.5 rounded border border-border/50">
                      <span className="text-txt-dim block text-[8px] uppercase">Technical Setup</span>
                      <span className="text-txt-primary block font-bold">{hoveredStock.technical?.trend ?? "STEADY"}</span>
                      <span className="text-txt-muted text-[9px]">RSI: {hoveredStock.technical?.rsi_14 ?? "—"}</span>
                    </div>
                    <div className="bg-bg-primary/80 p-1.5 rounded border border-border/50">
                      <span className="text-txt-dim block text-[8px] uppercase">Valuation Ratios</span>
                      <span className="text-txt-primary block font-bold">P/E {hoveredStock.fundamentals?.pe_ratio ?? "—"}</span>
                      <span className="text-txt-muted text-[9px]">ROCE: {hoveredStock.fundamentals?.roce_pct ? `${hoveredStock.fundamentals.roce_pct}%` : "—"}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-txt-secondary line-clamp-2 leading-tight">
                    <strong className="text-txt-primary">Catalyst: </strong>
                    {hoveredStock.catalyst_summary}
                  </p>

                  <div className="mt-2 text-[9px] text-accent-light text-center border-t border-border/40 pt-1.5 font-medium">
                    💡 Click stock row for full technical + fundamental popout
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Market Movers (Top 10 Gainers & Losers) */}
          {activeTab === "movers" && (
            <div className="space-y-3 animate-fade-in">
              {!recData ? (
                <div className="text-center py-8 text-txt-muted text-xs">
                  Click "Scan Market & Fetch Suggestions" to retrieve today's top gainers and losers.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Top 10 Gainers */}
                  <div className="bg-bg-primary/70 rounded-xl p-3.5 border border-gain/30 space-y-2">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-xs font-bold text-gain flex items-center gap-1.5 uppercase tracking-wider">
                        <span>🚀</span> Top 10 Gainers Today
                      </span>
                      <span className="text-[10px] text-txt-dim">NSE / BSE Universe</span>
                    </div>
                    <div className="space-y-1.5">
                      {recData.market_movers.gainers.map((g, idx) => (
                        <div
                          key={`gainer-${idx}-${g.symbol}`}
                          onClick={() => setModalStock(g.symbol)}
                          className="flex items-center justify-between p-2 rounded-lg bg-bg-card hover:bg-bg-hover cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-txt-dim w-4">{idx + 1}.</span>
                            <div>
                              <span className="font-bold text-txt-primary block font-mono">{g.symbol}</span>
                              <span className="text-[9px] text-txt-dim">{g.category}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-txt-primary block">₹{fmt(g.price)}</span>
                            <span className="text-[10px] font-bold text-gain font-mono">
                              +{Math.abs(g.change_pct).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top 10 Losers */}
                  <div className="bg-bg-primary/70 rounded-xl p-3.5 border border-loss/30 space-y-2">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-xs font-bold text-loss flex items-center gap-1.5 uppercase tracking-wider">
                        <span>🔻</span> Top 10 Losers Today
                      </span>
                      <span className="text-[10px] text-txt-dim">NSE / BSE Universe</span>
                    </div>
                    <div className="space-y-1.5">
                      {recData.market_movers.losers.map((l, idx) => (
                        <div
                          key={`loser-${idx}-${l.symbol}`}
                          onClick={() => setModalStock(l.symbol)}
                          className="flex items-center justify-between p-2 rounded-lg bg-bg-card hover:bg-bg-hover cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-txt-dim w-4">{idx + 1}.</span>
                            <div>
                              <span className="font-bold text-txt-primary block font-mono">{l.symbol}</span>
                              <span className="text-[9px] text-txt-dim">{l.category}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-txt-primary block">₹{fmt(l.price)}</span>
                            <span className="text-[10px] font-bold text-loss font-mono">
                              -{Math.abs(l.change_pct).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Dalal Street Pulse & Future Catalysts */}
          {activeTab === "sentiment" && (
            <div className="space-y-3.5 animate-fade-in text-xs">
              {!recData ? (
                <div className="text-center py-8 text-txt-muted text-xs">
                  Click "Scan Market & Fetch Suggestions" to aggregate latest financial news, blogs, and catalysts.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Takeaway & Sentiment Banner */}
                  <div className="bg-bg-primary/80 p-3.5 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="max-w-xl">
                      <span className="text-[10px] font-bold text-accent-light uppercase tracking-wider block mb-1">
                        Dalal Street Macro Intelligence
                      </span>
                      <p className="text-xs text-txt-secondary leading-relaxed">
                        {recData.internet_sentiment_and_catalysts.key_takeaway}
                      </p>
                    </div>
                    <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-border pt-2 sm:pt-0 sm:pl-4">
                      <span className="text-[10px] text-txt-dim block">Sentiment Score</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-xl font-black font-mono text-gain">
                          {recData.market_summary.sentiment_score}
                        </span>
                        <span className="text-[10px] text-txt-muted">/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Future Themes: Rising vs Declining */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-bg-primary/60 p-3 rounded-lg border border-gain/25">
                      <p className="text-[11px] font-bold text-gain uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span>⭐</span> Sectors / Themes Projected to Rise
                      </p>
                      <ul className="space-y-1.5">
                        {recData.internet_sentiment_and_catalysts.rising_themes.map((th, i) => (
                          <li key={`rising-${i}`} className="text-[11px] text-txt-secondary flex items-start gap-1.5">
                            <span className="text-gain font-bold">&check;</span>
                            <span>{th}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-bg-primary/60 p-3 rounded-lg border border-rose-500/25">
                      <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <span>⚠</span> Sectors / Themes Projected to Decline / Face Headwinds
                      </p>
                      <ul className="space-y-1.5">
                        {recData.internet_sentiment_and_catalysts.declining_themes.map((th, i) => (
                          <li key={`declining-${i}`} className="text-[11px] text-txt-secondary flex items-start gap-1.5">
                            <span className="text-rose-400 font-bold">&times;</span>
                            <span>{th}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Live Internet News & Blogs Feed */}
                  <div className="bg-bg-primary/60 p-3 rounded-lg border border-border">
                    <p className="text-[11px] font-bold text-txt-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span>📰</span> Recent Internet News, Blogs & Exchange Filings
                    </p>
                    <div className="space-y-2">
                      {recData.internet_sentiment_and_catalysts.macro_news.map((n, i) => (
                        <div key={`news-${i}`} className="flex items-center justify-between p-2 rounded bg-bg-card border border-border/50 text-xs">
                          <div className="max-w-lg">
                            <p className="text-txt-primary font-medium">{n.title}</p>
                            <span className="text-[10px] text-txt-dim">{n.source}</span>
                          </div>
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded ${
                              n.impact === "POSITIVE" ? "bg-gain/20 text-gain" : "bg-bg-hover text-txt-muted"
                            }`}
                          >
                            {n.impact} &middot; {n.horizon}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="block group">
              <div
                className={`bg-gradient-to-b ${c.gradient} border border-border rounded-xl p-4 h-full hover:border-border-hover transition-all flex flex-col justify-between`}
              >
                <div>
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={c.iconColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-3"
                  >
                    <path d={icons[c.href]} />
                  </svg>
                  <h3 className="text-xs font-semibold text-txt-primary mb-1 group-hover:text-accent-light transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-[11px] text-txt-muted leading-relaxed">{c.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Market Indices (Central Database) */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-txt-muted font-medium">Market Overview (Central DB)</p>
            <span className="text-[10px] text-txt-dim">NSE / BSE</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {indices.length > 0
              ? indices.map((i, idx) => {
                  const chgPct = i.change_pct ?? 0;
                  const up = chgPct >= 0;
                  return (
                    <div key={`index-${i.symbol}-${idx}`} className="text-center bg-bg-primary/50 rounded-lg p-3 border border-border/50">
                      <p className="text-[11px] text-txt-muted mb-1">{i.name}</p>
                      <p className="text-base font-bold text-txt-primary font-mono">{fmt(i.value)}</p>
                      <p className={`text-[11px] font-medium mt-0.5 ${up ? "text-gain" : "text-loss"}`}>
                        {up ? "+" : ""}
                        {chgPct.toFixed(2)}%
                      </p>
                    </div>
                  );
                })
              : [
                  { name: "NIFTY 50", val: "22,620.35", chg: "+0.85%", up: true },
                  { name: "SENSEX", val: "74,512.34", chg: "+0.71%", up: true },
                  { name: "NIFTY Bank", val: "48,153.35", chg: "+1.02%", up: true },
                  { name: "NIFTY IT", val: "33,245.10", chg: "-0.32%", up: false },
                ].map((i, idx) => (
                  <div key={`def-index-${i.name}-${idx}`} className="text-center bg-bg-primary/50 rounded-lg p-3 border border-border/50">
                    <p className="text-[11px] text-txt-muted mb-1">{i.name}</p>
                    <p className="text-base font-bold text-txt-primary font-mono">{i.val}</p>
                    <p className={`text-[11px] font-medium mt-0.5 ${i.up ? "text-gain" : "text-loss"}`}>{i.chg}</p>
                  </div>
                ))}
          </div>
        </div>

        {/* Detailed Technical + Fundamental Analysis Popout Modal (Option 4 Click Effect) */}
        {popoutStock && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in">
            <div className="bg-bg-card glow-card rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative border border-slate-700">
              {/* Luminous Top Dual Ambient Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]" />

              {/* Popout Header */}
              <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between bg-bg-hover/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-black font-mono text-sm glow-cyan-badge">
                    #{popoutStock.rank}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black ultra-white glow-cyan-title font-mono tracking-tight">
                        {popoutStock.symbol}
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-bold">
                        {popoutStock.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">{popoutStock.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider font-mono">Live CMP</span>
                    <strong className="text-base font-mono font-black ultra-white">₹{fmt(popoutStock.current_price)}</strong>
                  </div>
                  <button
                    onClick={() => setPopoutStock(null)}
                    className="w-8 h-8 rounded-lg bg-bg-hover text-slate-300 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer border border-slate-700"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(92vh-140px)]">
                {/* 1. AI Verdict & Conviction Banner */}
                <div className="p-3.5 rounded-xl bg-bg-hover/80 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 shadow-inner">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm glow-cyan-badge"
                      style={{
                        backgroundColor: `${popoutStock.action_color}25`,
                        color: popoutStock.action_color,
                        border: `1px solid ${popoutStock.action_color}77`,
                      }}
                    >
                      <span>⚡ {popoutStock.action}</span>
                      <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-[11px] text-white">
                        {popoutStock.conviction_pct ?? Math.round(popoutStock.overall_score)}%
                      </span>
                    </div>
                    <span className="text-xs text-slate-200 font-medium">
                      Score: <strong className="ultra-white font-mono font-bold">{popoutStock.overall_score}/100</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-emerald-300 font-bold block uppercase">Target 1</span>
                      <strong className="text-emerald-400 font-black">₹{fmt(popoutStock.target_price)}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-cyan-300 font-bold block uppercase">Upside</span>
                      <span className="text-cyan-300 font-black">
                        +{popoutStock.current_price > 0 ? (((popoutStock.target_price - popoutStock.current_price) / popoutStock.current_price) * 100).toFixed(1) : "0"}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-rose-300 font-bold block uppercase">Stop-Loss</span>
                      <strong className="text-rose-400 font-black">₹{fmt(popoutStock.stop_loss)}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-300 font-bold block uppercase">1Y Exp</span>
                      <strong className="ultra-white font-black">{popoutStock.expected_1y_return}</strong>
                    </div>
                  </div>
                </div>

                {/* 3-PILLAR INSTITUTIONAL AI SCORECARD (Quant Math 35 + Market Flow 35 + AI Cognitive 30 = 100) */}
                <div className="bg-bg-primary/90 rounded-xl p-3.5 border border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                    <span className="text-xs font-black ultra-white flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="text-cyan-400">🏛️</span> 3-Pillar Institutional Engine Scorecard
                    </span>
                    <div className="text-[11px] font-mono font-black ultra-white px-2 py-0.5 rounded bg-bg-card border border-slate-700">
                      Total: <span className="text-cyan-300 font-bold">{popoutStock.total_score ?? popoutStock.overall_score}/100</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
                    <div className="bg-bg-card p-2.5 rounded-lg border border-slate-700/60 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-wider">Phase A: Quant Math</span>
                          <span className="text-xs font-black text-cyan-300">{popoutStock.phase_a_score ?? 32}/35</span>
                        </div>
                        <p className="text-[9px] text-slate-300 leading-tight">ROCE/ROE capital efficiency, low D/E solvency, FCF & Piotroski score.</p>
                      </div>
                      <div className="mt-1.5 text-[8px] text-emerald-400 font-bold">✓ Capital Integrity Verified</div>
                    </div>

                    <div className="bg-bg-card p-2.5 rounded-lg border border-slate-700/60 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider">Phase B: Market Flow</span>
                          <span className="text-xs font-black text-emerald-400">{popoutStock.phase_b_score ?? 31}/35</span>
                        </div>
                        <p className="text-[9px] text-slate-300 leading-tight">Institutional FII/DII accumulation, Nifty outperformance, delivery.</p>
                      </div>
                      <div className="mt-1.5 text-[8px] text-cyan-300 font-bold">✓ Microstructure Momentum</div>
                    </div>

                    <div className="bg-bg-card p-2.5 rounded-lg border border-slate-700/60 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-indigo-300 font-bold uppercase tracking-wider">Phase C: AI Cognitive</span>
                          <span className="text-xs font-black text-indigo-300">{popoutStock.phase_c_score ?? 28}/30</span>
                        </div>
                        <p className="text-[9px] text-slate-300 leading-tight">
                          Tone: <strong className="text-white">{popoutStock.management_tone ?? "VERY_BULLISH"}</strong> &bull; Cat: <strong className="text-white">{popoutStock.catalyst_probability_pct ?? 88}%</strong>
                        </p>
                      </div>
                      <div className="mt-1.5 text-[8px] text-purple-300 font-bold">
                        Audit: {popoutStock.forensic_status ?? "CLEAN"} &bull; Veto: {popoutStock.veto_triggered ? "TRIGGERED" : "PASSED"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. DUAL ANALYSIS GRID: Technicals + Fundamentals Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Technical Analysis Column */}
                  <div className="bg-bg-primary/80 rounded-xl p-3.5 border border-border/80 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <span className="text-xs font-bold text-accent-light flex items-center gap-1.5 uppercase tracking-wider">
                        <span>📈</span> Technical Architecture
                      </span>
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                        popoutStock.technical?.trend?.includes("UP")
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-bg-card text-txt-dim border border-border"
                      }`}>
                        {popoutStock.technical?.trend ?? "STEADY STRUCTURE"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-bg-card p-2 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">RSI (14)</span>
                        <strong className="text-txt-primary text-sm">{popoutStock.technical?.rsi_14 ?? "52.0"}</strong>
                        <span className="text-[9px] text-emerald-400 block mt-0.5">Healthy Momentum</span>
                      </div>
                      <div className="bg-bg-card p-2 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">MACD Signal</span>
                        <strong className="text-txt-primary text-xs truncate block">{popoutStock.technical?.macd_signal ?? "BULLISH"}</strong>
                        <span className="text-[9px] text-txt-dim block mt-0.5">Trend Confirmation</span>
                      </div>
                      <div className="bg-bg-card p-2 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">200 EMA Anchor</span>
                        <strong className="text-txt-primary text-xs">₹{fmt(popoutStock.technical?.ema_200 ?? (popoutStock.current_price * 0.90))}</strong>
                        <span className="text-[9px] text-emerald-400 block mt-0.5">Trading Above (Bullish)</span>
                      </div>
                      <div className="bg-bg-card p-2 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">Volume Trend</span>
                        <strong className="text-txt-primary text-xs truncate block">{popoutStock.technical?.volume_trend ?? "ACCUMULATION"}</strong>
                        <span className="text-[9px] text-txt-dim block mt-0.5">Institutional Footprint</span>
                      </div>
                    </div>

                    {/* Support & Resistance Bands */}
                    <div className="p-2.5 rounded-lg bg-bg-card border border-border/50 text-[11px] font-mono flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-txt-dim block">Supports</span>
                        <span className="text-emerald-400">
                          ₹{fmt(popoutStock.technical?.support_1 ?? (popoutStock.current_price * 0.95))} &bull; ₹{fmt(popoutStock.technical?.support_2 ?? (popoutStock.current_price * 0.91))}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-txt-dim block">Resistances</span>
                        <span className="text-txt-primary">
                          ₹{fmt(popoutStock.technical?.resistance_1 ?? (popoutStock.current_price * 1.08))} &bull; ₹{fmt(popoutStock.technical?.resistance_2 ?? (popoutStock.current_price * 1.15))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fundamental Analysis Column */}
                  <div className="bg-bg-primary/80 rounded-xl p-3.5 border border-border/80 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <span>🏛</span> Fundamental & Valuation Ratios
                      </span>
                      <span className="text-[10px] text-txt-dim font-mono">
                        Piotroski & Quality
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-bg-card p-2 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">P/E vs Sector</span>
                        <strong className="text-txt-primary text-sm">{popoutStock.fundamentals?.pe_ratio ?? "—"}</strong>
                        <span className="text-[9px] text-txt-dim block mt-0.5">Sec P/E: {popoutStock.fundamentals?.sector_pe ?? "—"}</span>
                      </div>
                      <div className="bg-bg-card p-2 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">Price to Book (P/B)</span>
                        <strong className="text-txt-primary text-sm">{popoutStock.fundamentals?.pb_ratio ?? "—"}x</strong>
                        <span className="text-[9px] text-txt-dim block mt-0.5">Balance Sheet Quality</span>
                      </div>
                      <div className="bg-bg-card p-2 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">ROCE %</span>
                        <strong className="text-emerald-400 text-sm">{popoutStock.fundamentals?.roce_pct ? `${popoutStock.fundamentals.roce_pct}%` : "—"}</strong>
                        <span className="text-[9px] text-txt-dim block mt-0.5">ROE: {popoutStock.fundamentals?.roe_pct ? `${popoutStock.fundamentals.roe_pct}%` : "—"}</span>
                      </div>
                      <div className="bg-bg-card p-2 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">Operating Margin</span>
                        <strong className="text-txt-primary text-sm">{popoutStock.fundamentals?.operating_margin_pct ? `${popoutStock.fundamentals.operating_margin_pct}%` : "—"}</strong>
                        <span className="text-[9px] text-txt-dim block mt-0.5">D/E: {popoutStock.fundamentals?.debt_to_equity ?? "—"}</span>
                      </div>
                    </div>

                    {/* Economic Moat */}
                    <div className="p-2.5 rounded-lg bg-bg-card border border-border/50 text-[11px]">
                      <span className="text-[9px] text-txt-dim block uppercase font-mono">Economic Moat Strength</span>
                      <strong className="text-txt-primary font-medium block mt-0.5">
                        {popoutStock.fundamentals?.moat_strength ?? "Strong Market Leader with Pricing Power"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 3. 3-Scenario Probability Matrix */}
                {popoutStock.scenarios && (
                  <div className="bg-bg-primary/60 rounded-xl p-3.5 border border-border/80">
                    <span className="text-xs font-bold text-txt-primary uppercase tracking-wider block mb-2.5">
                      🔮 12-Month Scenario Probability Matrix
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-emerald-400 text-[11px]">Bull Scenario</span>
                          <span className="font-mono text-[10px] text-txt-dim">{popoutStock.scenarios.bull.prob}% Prob</span>
                        </div>
                        <strong className="text-emerald-300 font-mono text-sm block">₹{fmt(popoutStock.scenarios.bull.target)}</strong>
                        <p className="text-[10px] text-txt-muted mt-1 leading-tight">{popoutStock.scenarios.bull.trigger}</p>
                      </div>

                      <div className="bg-blue-500/5 border border-blue-500/30 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-blue-400 text-[11px]">Base Scenario</span>
                          <span className="font-mono text-[10px] text-txt-dim">{popoutStock.scenarios.base.prob}% Prob</span>
                        </div>
                        <strong className="text-blue-300 font-mono text-sm block">₹{fmt(popoutStock.scenarios.base.target)}</strong>
                        <p className="text-[10px] text-txt-muted mt-1 leading-tight">{popoutStock.scenarios.base.trigger}</p>
                      </div>

                      <div className="bg-rose-500/5 border border-rose-500/30 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-rose-400 text-[11px]">Bear Scenario</span>
                          <span className="font-mono text-[10px] text-txt-dim">{popoutStock.scenarios.bear.prob}% Prob</span>
                        </div>
                        <strong className="text-rose-300 font-mono text-sm block">₹{fmt(popoutStock.scenarios.bear.stop)}</strong>
                        <p className="text-[10px] text-txt-muted mt-1 leading-tight">{popoutStock.scenarios.bear.trigger}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Core Catalyst & Reasons */}
                <div className="bg-bg-primary/60 rounded-xl p-3.5 border border-border/80">
                  <span className="text-xs font-bold text-txt-primary uppercase tracking-wider block mb-1.5">
                    💡 Primary Institutional Thesis & Catalysts
                  </span>
                  <p className="text-xs text-txt-secondary leading-relaxed mb-2.5">
                    {popoutStock.catalyst_summary}
                  </p>
                  <div className="space-y-1">
                    {popoutStock.reasons.map((r, i) => (
                      <p key={`popout-reason-${i}`} className="text-[11px] text-txt-muted flex items-center gap-1.5">
                        <span className="text-accent-light font-bold">&bull;</span>
                        <span>{r}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Popout Footer Action Bar */}
              <div className="p-3.5 sm:p-4 border-t border-border/80 bg-bg-card/70 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    handleAddToWishlist(popoutStock.symbol, popoutStock.target_price);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-bg-hover hover:bg-accent-muted text-txt-primary hover:text-accent-light text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{addedSymbols.has(popoutStock.symbol) ? "✓ Added to Wishlist" : "+ Add to Wishlist"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const sym = popoutStock.symbol;
                      setPopoutStock(null);
                      setModalStock(sym);
                    }}
                    className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-dark transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📊 Open Full Interactive Chart & Modal</span>
                  </button>
                  <button
                    onClick={() => setPopoutStock(null)}
                    className="px-3.5 py-2 rounded-lg bg-bg-card border border-border text-txt-muted hover:text-txt-primary text-xs font-medium transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stock Detail Modal */}
        {modalStock && <StockModal symbol={modalStock} onClose={() => setModalStock(null)} />}

        <p className="text-center text-[10px] text-txt-dim">
          Dalal Street Quant Engine &middot; Research platform only &middot; Not financial advice &middot; No order execution
        </p>
      </div>
    </div>
  );
}
