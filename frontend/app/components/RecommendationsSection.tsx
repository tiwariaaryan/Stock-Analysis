"use client";
import { useState } from "react";
import type { MarketScanPayload, RecommendationItem } from "./HomeTypes";

type RecommendationsSectionProps = {
  recData: MarketScanPayload | null;
  activeTab: "top5" | "movers" | "sentiment";
  setActiveTab: (tab: "top5" | "movers" | "sentiment") => void;
  scanning: boolean;
  handleScanMarket: () => void;
  handleAddToWishlist: (sym: string, targetPrice?: number) => void;
  addedSymbols: Set<string>;
  setModalStock: (symbol: string) => void;
  setPopoutStock: (stock: RecommendationItem | null) => void;
  popoutStock: RecommendationItem | null;
  fmt: (n: string | number | null | undefined) => string;
};

export default function RecommendationsSection({
  recData,
  activeTab,
  setActiveTab,
  scanning,
  handleScanMarket,
  handleAddToWishlist,
  addedSymbols,
  setModalStock,
  setPopoutStock,
  popoutStock,
  fmt,
}: RecommendationsSectionProps) {
  const [hoveredStock, setHoveredStock] = useState<RecommendationItem | null>(null);

  return (
    <>
      {/* Interactive Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
        <div className="inline-flex p-1.5 bg-bg-primary/90 rounded-xl border border-border/80 gap-1.5 text-xs shadow-inner">
          <button
            onClick={() => setActiveTab("top5")}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "top5"
                ? "bg-gradient-to-r from-indigo-500/25 to-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-bg-hover/60 border border-transparent"
            }`}
          >
            <span>🎯 Top 5 Curated AI Recommendations</span>
            {recData?.top_5_recommendations && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                {recData.top_5_recommendations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("movers")}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "movers"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-bg-hover/60 border border-transparent"
            }`}
          >
            <span>📈 Market Movers (Top 10 Gainers & Losers)</span>
          </button>

          <button
            onClick={() => setActiveTab("sentiment")}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "sentiment"
                ? "bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-bg-hover/60 border border-transparent"
            }`}
          >
            <span>🌐 Dalal Street Pulse & Future Catalysts</span>
          </button>
        </div>
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
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded bg-bg-hover text-cyan-300 border border-slate-700 shrink-0">
                                #{rec.rank}
                              </span>
                              <span className="font-black text-sm ultra-white group-hover:text-cyan-300 font-mono transition-colors shrink-0">
                                {rec.symbol}
                              </span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-medium truncate max-w-[125px]"
                                title={rec.category}
                              >
                                {rec.category}
                              </span>
                            </div>

                            <div
                              className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 whitespace-nowrap glow-cyan-badge"
                              style={{
                                backgroundColor: `${rec.action_color}25`,
                                color: rec.action_color,
                                border: `1px solid ${rec.action_color}77`,
                              }}
                            >
                              <span>{rec.action}</span>
                              <span className="font-mono text-[10px] bg-black/40 px-1 py-0.5 rounded text-white font-bold ml-1">
                                {conviction}%
                              </span>
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
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                                style={{
                                  backgroundColor: `${rec.action_color}25`,
                                  color: rec.action_color,
                                  border: `1px solid ${rec.action_color}66`,
                                }}
                              >
                                <span>{rec.action}</span>
                                <span className="font-mono text-[9px] bg-black/40 px-1 py-0.5 rounded text-white font-bold">
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
    </>
  );
}
