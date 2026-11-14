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
  current_price: number;
  estimated_fair_value: number;
  target_price: number;
  stop_loss: number;
  expected_1y_return: string;
  catalyst_summary: string;
  reasons: string[];
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

  const { profile } = useProfile();
  const h = new Date().getHours();
  const greet = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  const displayName = profile?.display_name || profile?.username || "";

  useEffect(() => {
    fetch(`${API}/api/v1/market/indices`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setIndices(data);
      })
      .catch(() => {});

    fetch(`${API}/api/v1/strategy/daily-snapshot`)
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
  }, []);

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
      const wRes = await fetch(`${API}/api/v1/watchlists?user_id=1`);
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
        <div className="bg-bg-card border border-accent/40 rounded-2xl p-5 md:p-6 shadow-xl shadow-accent/5 space-y-4 relative overflow-hidden">
          {/* Card Top Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                <h2 className="text-base md:text-lg font-black text-txt-primary tracking-tight">
                  Dalal Street AI Recommendation & Market Intelligence Engine
                </h2>
              </div>
              <p className="text-xs text-txt-muted mt-1 leading-relaxed">
                Multi-cap equities & ETFs evaluated across 25 institutional parameters, internet news, blogs, and market breadth
              </p>
            </div>

            {/* Prominent Scan Button */}
            <div className="flex items-center gap-3">
              {recData?.timestamp && (
                <span className="text-[10px] text-txt-dim hidden sm:inline-block font-mono">
                  Scanned: {new Date(recData.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={handleScanMarket}
                disabled={scanning}
                className="px-4 py-2.5 bg-gradient-to-r from-accent to-purple-600 hover:from-accent-dark hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-accent/25 flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer active:scale-95"
              >
                <span className={scanning ? "animate-spin text-sm" : "text-sm"}>⚡</span>
                <span>{scanning ? "Scanning Market & Internet..." : "Scan Market & Fetch Suggestions"}</span>
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

          {/* Tab 1: Top 5 Curated AI Recommendations */}
          {activeTab === "top5" && (
            <div className="space-y-3 animate-fade-in">
              {!recData ? (
                <div className="text-center py-10 bg-bg-primary/50 rounded-xl border border-dashed border-border/80">
                  <p className="text-sm font-semibold text-txt-primary mb-1">Click "Scan Market & Fetch Suggestions"</p>
                  <p className="text-xs text-txt-muted max-w-md mx-auto mb-4">
                    Our multi-factor engine will scrape internet news, blogs, and market breadth to deliver 5 high-conviction Buy & Sell setups.
                  </p>
                  <button
                    onClick={handleScanMarket}
                    disabled={scanning}
                    className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-lg hover:bg-accent-dark transition-colors"
                  >
                    ⚡ Start Market Scan Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {recData.top_5_recommendations.map((rec, rIdx) => {
                    const isAdded = addedSymbols.has(rec.symbol);
                    return (
                      <div
                        key={`rec-${rec.rank}-${rec.symbol}-${rIdx}`}
                        className="bg-bg-primary/80 border border-border/80 hover:border-accent/40 rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between"
                      >
                        {/* Header: Rank, Symbol, Action Badge & Score */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded bg-bg-hover text-txt-dim">
                                #{rec.rank}
                              </span>
                              <button
                                onClick={() => setModalStock(rec.symbol)}
                                className="font-bold text-accent-light hover:underline text-sm font-mono"
                              >
                                {rec.symbol}
                              </button>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-card text-txt-muted border border-border">
                                {rec.category}
                              </span>
                            </div>

                            {/* Score & Action Badge */}
                            <div className="flex items-center gap-2">
                              <div
                                className="flex flex-col items-center justify-center px-2 py-0.5 rounded-md border min-w-[46px]"
                                style={{
                                  backgroundColor: `${rec.action_color}18`,
                                  borderColor: `${rec.action_color}55`,
                                }}
                              >
                                <span className="text-xs font-black font-mono leading-none" style={{ color: rec.action_color }}>
                                  {rec.overall_score}
                                </span>
                                <span className="text-[8px] font-bold text-txt-dim leading-none mt-0.5">/100</span>
                              </div>
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-sm"
                                style={{
                                  backgroundColor: `${rec.action_color}25`,
                                  color: rec.action_color,
                                  border: `1px solid ${rec.action_color}66`,
                                }}
                              >
                                {rec.action}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-txt-muted mb-2.5">{rec.name}</p>

                          {/* Price & Target Milestones Grid */}
                          <div className="grid grid-cols-4 gap-1.5 text-center bg-bg-card p-2 rounded-lg border border-border/60 mb-2.5">
                            <div>
                              <span className="text-[9px] text-txt-dim block">Live CMP</span>
                              <strong className="text-xs font-mono text-txt-primary">₹{fmt(rec.current_price)}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-txt-dim block">Fair Value</span>
                              <strong className="text-xs font-mono text-txt-secondary">₹{fmt(rec.estimated_fair_value)}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-txt-dim block">Target 1</span>
                              <strong className="text-xs font-mono text-gain">₹{fmt(rec.target_price)}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-txt-dim block">Stop-Loss</span>
                              <strong className="text-xs font-mono text-rose-400">₹{fmt(rec.stop_loss)}</strong>
                            </div>
                          </div>

                          {/* Catalyst Summary */}
                          <p className="text-[11px] text-txt-secondary leading-relaxed bg-bg-card/50 p-2 rounded border border-border/40 mb-2">
                            <strong className="text-txt-primary font-medium">Catalyst: </strong>
                            {rec.catalyst_summary}
                          </p>

                          {/* 3 Core Factors */}
                          <div className="space-y-1 mb-3">
                            {rec.reasons.map((r, i) => (
                              <p key={`rec-reason-${rec.symbol}-${i}`} className="text-[10px] text-txt-muted flex items-center gap-1.5">
                                <span className={rec.action.includes("BUY") ? "text-gain" : "text-amber-400"}>&bull;</span>
                                <span>{r}</span>
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* Footer Action Buttons */}
                        <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                          <span className="text-[10px] font-mono text-txt-dim">
                            1Y Exp: <strong className="text-txt-primary">{rec.expected_1y_return}</strong>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAddToWishlist(rec.symbol, rec.target_price)}
                              disabled={isAdded}
                              className={`px-2.5 py-1 text-[11px] rounded font-semibold transition-colors flex items-center gap-1 ${
                                isAdded
                                  ? "bg-gain/20 text-gain cursor-default"
                                  : "bg-bg-hover hover:bg-accent-muted text-txt-primary hover:text-accent-light"
                              }`}
                            >
                              <span>{isAdded ? "✓ In Wishlist" : "+ Wishlist"}</span>
                            </button>
                            <button
                              onClick={() => setModalStock(rec.symbol)}
                              className="px-2.5 py-1 text-[11px] rounded bg-accent/20 hover:bg-accent/30 text-accent-light font-bold transition-colors"
                            >
                              Deep Report &rarr;
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
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

        {/* Stock Detail Modal */}
        {modalStock && <StockModal symbol={modalStock} onClose={() => setModalStock(null)} />}

        <p className="text-center text-[10px] text-txt-dim">
          Dalal Street Quant Engine &middot; Research platform only &middot; Not financial advice &middot; No order execution
        </p>
      </div>
    </div>
  );
}
