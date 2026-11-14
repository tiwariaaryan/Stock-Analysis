"use client";
import { useState, useEffect } from "react";
import AdvancedCandleChart from "@/components/AdvancedCandleChart";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type StockDetail = {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  prev_close: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  sector: string | null;
  industry: string | null;
  history: { date: string; close: number; volume: number }[];
};

export default function StockModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("6M");
  const [error, setError] = useState("");
  const [showWishlistPicker, setShowWishlistPicker] = useState(false);
  const [wishlists, setWishlists] = useState<{ id: number; name: string }[]>([]);
  const [targetPrice, setTargetPrice] = useState("");
  const [newListName, setNewListName] = useState("");
  const [addingTo, setAddingTo] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");

    fetch(`${API}/api/v1/market/stocks/${encodeURIComponent(symbol)}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setStock)
      .catch(() => setError("Could not load stock data"))
      .finally(() => setLoading(false));
  }, [symbol]);

  async function openWishlistPicker() {
    try {
      const res = await fetch(`${API}/api/v1/watchlists?user_id=1`);
      if (res.ok) setWishlists(await res.json());
    } catch {}
    setTargetPrice(stock?.price ? String(Math.round(Number(stock.price) * 0.95 * 100) / 100) : "");
    setShowWishlistPicker(true);
  }

  async function addToWishlist(wId: number) {
    setAddingTo(wId);
    try {
      await fetch(`${API}/api/v1/watchlists/${wId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          target_buy_price: targetPrice ? parseFloat(targetPrice) : null,
          notes: `Added from Live Market`,
        }),
      });
    } catch {}
    setAddingTo(null);
    setShowWishlistPicker(false);
  }

  async function createAndAdd() {
    if (!newListName.trim()) return;
    setAddingTo(-1);
    try {
      const res = await fetch(`${API}/api/v1/watchlists?user_id=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      if (res.ok) {
        const newList = await res.json();
        await addToWishlist(newList.id);
      }
    } catch {}
    setAddingTo(null);
    setNewListName("");
  }

  const hist =
    stock?.history?.slice(
      period === "1W" ? -5 : period === "1M" ? -22 : period === "3M" ? -66 : -120
    ) || [];
  const maxP = Math.max(...hist.map((h) => h.close), 0);
  const minP = Math.min(...hist.map((h) => h.close), Infinity);
  const rng = maxP - minP || 1;
  const pts = hist
    .map((h, i) => `${(i / (hist.length - 1 || 1)) * 100},${100 - ((h.close - minP) / rng) * 80 - 10}`)
    .join(" ");
  const area = hist.length > 0 ? `0,100 ${pts} 100,100` : "";
  const up = (stock?.change ?? 0) >= 0;

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtBig = (n: number | null | undefined) => {
    if (n == null) return "—";
    if (n >= 1e12) return `₹${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
    if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  const stats = [
    { label: "Open", val: `₹${fmt(stock?.open)}` },
    { label: "High", val: `₹${fmt(stock?.high)}` },
    { label: "Low", val: `₹${fmt(stock?.low)}` },
    { label: "Prev Close", val: `₹${fmt(stock?.prev_close)}` },
    { label: "Volume", val: stock?.volume?.toLocaleString("en-IN") || "—" },
    { label: "52W High", val: `₹${fmt(stock?.week_52_high)}` },
    { label: "52W Low", val: `₹${fmt(stock?.week_52_low)}` },
    { label: "Market Cap", val: fmtBig(stock?.market_cap) },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-fade-in shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-bg-card/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          {loading ? (
            <div className="h-6 w-48 bg-bg-hover rounded animate-pulse" />
          ) : (
            <div>
              <h2 className="text-lg font-bold text-txt-primary">{stock?.name || symbol}</h2>
              <p className="text-[11px] text-txt-muted">
                {stock?.symbol} &middot; {stock?.sector || "N/A"} &middot; {stock?.industry || ""}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            {!loading && stock && (
              <button
                onClick={openWishlistPicker}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 bg-bg-primary border border-border text-txt-secondary hover:text-accent-light hover:border-accent/40"
              >
                <span>+ Wishlist</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-bg-primary border border-border flex items-center justify-center text-txt-muted hover:text-txt-primary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-bg-hover rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-loss text-sm">{error}</div>
        ) : stock ? (
          <div className="p-6 space-y-5">
            {/* Price */}
            <div>
              <span className="text-3xl font-bold text-txt-primary font-mono">₹{fmt(stock.price)}</span>
              {stock.change != null && (
                <span className={`text-base font-semibold ml-3 ${up ? "text-gain" : "text-loss"}`}>
                  {up ? "+" : ""}
                  {stock.change.toFixed(2)} ({stock.change_pct?.toFixed(2)}%)
                </span>
              )}
            </div>

            {/* Advanced Candlestick Chart */}
            <AdvancedCandleChart symbol={symbol} />

            {/* Key Stats */}
            <div className="grid grid-cols-4 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="bg-bg-primary rounded-lg px-3 py-2.5">
                  <p className="text-[10px] text-txt-dim mb-0.5">{s.label}</p>
                  <p className="text-xs font-mono text-txt-primary">{s.val}</p>
                </div>
              ))}
            </div>

            {/* AI Quant Strategy & Pattern Analogy */}
            <AIStrategySection symbol={symbol} />

            {/* Institutional 28-Field AI Research & 6-Factor Radar */}
            <InstitutionalReportSection symbol={symbol} />

            {/* Fundamentals & Health Scorecard */}
            <FundamentalsSection symbol={symbol} />

            <p className="text-[10px] text-txt-dim text-center">
              EOD data via yfinance &middot; Saved to central database &middot; Research only &middot; Not financial advice
            </p>
          </div>
        ) : null}

        {/* Wishlist Picker */}
        {showWishlistPicker && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-20 flex items-center justify-center p-4 rounded-2xl">
            <div className="bg-bg-card border border-border rounded-xl w-full max-w-xs p-5 animate-fade-in shadow-2xl">
              <h3 className="text-sm font-bold text-txt-primary mb-1">Add {symbol} to Wishlist</h3>
              <p className="text-[10px] text-txt-dim mb-3">Choose a wishlist or create a new one</p>

              <div className="mb-3">
                <label className="text-[10px] text-txt-muted block mb-1">Target Buy Price (₹)</label>
                <input type="number" step="any" value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm font-mono text-txt-primary focus:outline-none focus:border-accent/50" />
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto mb-3">
                {wishlists.map(w => (
                  <button key={w.id} onClick={() => addToWishlist(w.id)} disabled={addingTo !== null}
                    className="w-full text-left px-3 py-2 bg-bg-primary rounded-lg text-xs text-txt-secondary hover:text-accent-light hover:bg-bg-hover transition-colors flex items-center justify-between disabled:opacity-50">
                    <span>{w.name}</span>
                    {addingTo === w.id && <span className="text-[10px] text-accent-light">Adding...</span>}
                  </button>
                ))}
                {wishlists.length === 0 && <p className="text-[10px] text-txt-dim text-center py-2">No wishlists yet</p>}
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-[10px] text-txt-dim mb-1.5">Or create new</p>
                <div className="flex gap-2">
                  <input value={newListName} onChange={e => setNewListName(e.target.value)}
                    placeholder="New list name"
                    onKeyDown={e => e.key === "Enter" && createAndAdd()}
                    className="flex-1 bg-bg-input border border-border rounded-lg px-3 py-1.5 text-xs text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50" />
                  <button onClick={createAndAdd} disabled={!newListName.trim() || addingTo !== null}
                    className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-accent-dark disabled:opacity-50 transition-colors">
                    Create
                  </button>
                </div>
              </div>

              <button onClick={() => setShowWishlistPicker(false)}
                className="w-full mt-3 text-center text-[11px] text-txt-muted hover:text-txt-primary transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InstitutionalReportSection({ symbol }: { symbol: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  function load() {
    if (data) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    fetch(`${API}/api/v1/strategy/stock/${encodeURIComponent(symbol)}/institutional-report`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const recColor = (rec: string) => {
    if (rec?.includes("BUY")) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (rec?.includes("SELL") || rec?.includes("AVOID")) return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  };

  return (
    <div className="bg-bg-primary rounded-xl border border-indigo-500/30 overflow-hidden">
      <button
        onClick={load}
        className="w-full text-left px-4 py-3 bg-bg-primary flex items-center justify-between hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span className="text-xs font-bold text-txt-primary">Institutional 28-Field Analysis & 6-Factor Radar</span>
          {data && (
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${recColor(data["14_final_recommendation"])}`}>
              {data["14_final_recommendation"]} ({data["5_overall_score"]}/100)
            </span>
          )}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-txt-dim transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="p-4 pt-1 border-t border-border/60 space-y-3.5">
          {loading ? (
            <div className="space-y-2 py-2">
              <div className="h-6 bg-bg-hover rounded animate-pulse" />
              <div className="h-16 bg-bg-hover rounded animate-pulse" />
            </div>
          ) : data ? (
            <div className="space-y-3">
              {/* Header Badge & Coverage */}
              <div className="flex items-center justify-between bg-bg-card p-3 rounded-lg border border-border">
                <div>
                  <p className="text-[10px] text-txt-dim uppercase tracking-wider font-semibold">Institutional Verdict</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-black px-2 py-0.5 rounded border ${recColor(data["14_final_recommendation"])}`}>
                      {data["14_final_recommendation"]}
                    </span>
                    <span className="text-xs font-mono font-bold text-txt-primary">
                      {data["5_overall_score"]}/100
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-txt-dim">Coverage / Confidence</p>
                  <p className="text-xs font-mono font-bold text-txt-secondary">
                    {data["12_data_coverage_percentage"]}% &middot; {data["13_confidence_level"]}
                  </p>
                </div>
              </div>

              {/* 6-Factor Radar Progress Bars */}
              <div className="bg-bg-card p-3 rounded-lg border border-border">
                <p className="text-[10px] font-bold text-txt-muted uppercase tracking-wider mb-2">6-Module Institutional Factor Breakdown</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "Fundamental (35%)", val: data["6_fundamental_score"], col: "bg-blue-500" },
                    { label: "Technical (20%)", val: data["7_technical_score"], col: "bg-purple-500" },
                    { label: "Valuation (15%)", val: data["8_valuation_score"], col: "bg-emerald-500" },
                    { label: "Market Context (10%)", val: data["9_market_sector_score"], col: "bg-cyan-500" },
                    { label: "News & Sentiment (10%)", val: data["10_sentiment_score"], col: "bg-amber-500" },
                    { label: "Risk & Drawdown (10%)", val: data["11_risk_score"], col: "bg-rose-500" },
                  ].map(m => (
                    <div key={m.label} className="bg-bg-primary/60 p-2 rounded border border-border/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-txt-dim">{m.label}</span>
                        <span className="text-[11px] font-mono font-bold text-txt-primary">{Math.round(m.val || 0)}/100</span>
                      </div>
                      <div className="w-full bg-bg-hover h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${m.col}`} style={{ width: `${Math.min(m.val || 0, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fair Value & Scenarios */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-bg-card p-2.5 rounded-lg border border-border">
                  <p className="text-[10px] text-txt-dim">Est. Fair Value</p>
                  <p className="text-xs font-bold text-txt-primary font-mono mt-0.5">₹{fmt(data["26_estimated_fair_value"])}</p>
                </div>
                <div className="bg-bg-card p-2.5 rounded-lg border border-border">
                  <p className="text-[10px] text-txt-dim">Expected 1-Yr Return</p>
                  <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">{data["23_expected_1yr_return"]}</p>
                </div>
                <div className="bg-bg-card p-2.5 rounded-lg border border-border">
                  <p className="text-[10px] text-txt-dim">Expected 3-Yr CAGR</p>
                  <p className="text-xs font-bold text-txt-primary font-mono mt-0.5">{data["24_expected_3yr_return"]}</p>
                </div>
                <div className="bg-bg-card p-2.5 rounded-lg border border-border">
                  <p className="text-[10px] text-txt-dim">Expected 5-Yr Horizon</p>
                  <p className="text-xs font-bold text-txt-primary font-mono mt-0.5">{data["25_expected_5yr_return"]}</p>
                </div>
              </div>

              {/* Investment Rationale */}
              {data["27_investment_rationale"] && (
                <div className="p-3 bg-indigo-950/20 rounded-lg border border-indigo-500/30 text-xs">
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                    🏛 Dalal Street Institutional Rationale
                  </p>
                  <p className="text-[11px] text-txt-secondary leading-relaxed">
                    {data["27_investment_rationale"]}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-txt-muted text-center py-2">Could not load institutional report</p>
          )}
        </div>
      )}
    </div>
  );
}

function AIStrategySection({ symbol }: { symbol: string }) {
  const [strategy, setStrategy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/v1/strategy/stock/${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => setStrategy(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol]);

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-bg-primary rounded-xl border border-rose-500/30 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3 bg-bg-primary flex items-center justify-between hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          <span className="text-xs font-bold text-txt-primary">AI Quant Strategy & Pattern Analogy</span>
          {strategy && (
            <span
              className="text-[10px] font-extrabold px-2 py-0.5 rounded"
              style={{ backgroundColor: `${strategy.signal_color}22`, color: strategy.signal_color }}
            >
              {strategy.signal} ({strategy.ai_score}/100)
            </span>
          )}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-txt-dim transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="p-4 pt-1 border-t border-border/60 space-y-3.5">
          {loading ? (
            <div className="space-y-2 py-2">
              <div className="h-6 bg-bg-hover rounded animate-pulse" />
              <div className="h-12 bg-bg-hover rounded animate-pulse" />
            </div>
          ) : strategy ? (
            <>
              {/* Score bar & Action */}
              <div className="bg-bg-card rounded-lg p-3 border border-border">
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="text-txt-muted">Dalal Street Quant Score</span>
                  <span className="font-bold text-txt-primary">{strategy.ai_score}/100</span>
                </div>
                <div className="w-full bg-bg-primary h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${strategy.ai_score}%`, backgroundColor: strategy.signal_color }}
                  />
                </div>
                <p className="text-[11px] text-txt-secondary mt-2 leading-relaxed">{strategy.action_summary}</p>
              </div>

              {/* Targets, Stop Loss, Risk-to-Reward */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-txt-muted">Hard Stop-Loss</p>
                  <p className="text-xs font-bold text-rose-400 font-mono mt-0.5">₹{fmt(strategy.recommended_stop_loss)}</p>
                  <p className="text-[9px] text-txt-dim mt-0.5">Invalidation point</p>
                </div>
                <div className="bg-bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-txt-muted">Target 1 (Book 50%)</p>
                  <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">₹{fmt(strategy.target_milestone_1)}</p>
                  <p className="text-[9px] text-txt-dim mt-0.5">R:R: {strategy.risk_reward_ratio}</p>
                </div>
                <div className="bg-bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-txt-muted">Target 2 (Runner)</p>
                  <p className="text-xs font-bold text-txt-primary font-mono mt-0.5">₹{fmt(strategy.target_milestone_2)}</p>
                  <p className="text-[9px] text-txt-dim mt-0.5">Trail stop on break</p>
                </div>
              </div>

              {/* Toggle AI Pattern Engine */}
              {strategy.pattern_analogy && (
                <div className="bg-blue-950/20 rounded-lg p-3 border border-blue-500/30 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-300 text-[11px]">Toggle AI Pattern Analogy</span>
                    <span className="text-[10px] text-txt-dim">Past 2-5 Yrs</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-txt-muted">Win Rate: </span>
                      <strong className="text-gain font-mono">{strategy.pattern_analogy.win_rate_pct}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-txt-muted">Avg 40D Return: </span>
                      <strong className="text-txt-primary font-mono">+{strategy.pattern_analogy.avg_forward_return_pct}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-txt-muted">Matched: </span>
                      <strong className="text-blue-300 font-mono">{strategy.pattern_analogy.matched_events_count}</strong>
                    </div>
                  </div>
                  <p className="text-[11px] text-txt-secondary leading-relaxed pt-1">
                    {strategy.pattern_analogy.analogy_text}
                  </p>
                </div>
              )}

              {/* 3-Stage Staggered Dip Ladder */}
              {strategy.staggered_ladder && strategy.staggered_ladder.length > 0 && (
                <div className="bg-bg-card rounded-lg p-3 border border-border space-y-2">
                  <p className="text-[11px] font-semibold text-txt-muted uppercase tracking-wide">
                    3-Stage Dip Accumulation Ladder (30% / 40% / 30%)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {strategy.staggered_ladder.map((step: any) => (
                      <div key={step.tranche} className="bg-bg-primary p-2 rounded border border-border/60 text-center">
                        <p className="text-[10px] text-txt-muted">Stage {step.tranche} ({step.pct}%)</p>
                        <p className="text-xs font-bold font-mono text-txt-primary mt-0.5">₹{fmt(step.price)}</p>
                        <span className={`text-[9px] font-bold block mt-0.5 ${step.status === "TRIGGERED" ? "text-gain" : "text-txt-dim"}`}>
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Veteran Commentary */}
              {strategy.veteran_commentary && (
                <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-500/30 text-xs">
                  <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                    🏛 Dalal Street Veteran Take
                  </p>
                  <p className="text-[11px] text-txt-secondary leading-relaxed">
                    {strategy.veteran_commentary}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-txt-muted text-center py-2">Could not compute AI strategy</p>
          )}
        </div>
      )}
    </div>
  );
}

function FundamentalsSection({ symbol }: { symbol: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  function load() {
    if (data) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    fetch(`${API}/api/v1/market/stocks/${encodeURIComponent(symbol)}/fundamentals`)
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }

  return (
    <div>
      <button onClick={load}
        className="w-full text-left px-4 py-3 bg-bg-primary rounded-lg flex items-center justify-between hover:bg-bg-hover transition-colors">
        <span className="text-xs font-medium text-txt-secondary">Fundamentals & Health Check</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-txt-dim transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 animate-fade-in">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-bg-primary rounded animate-pulse" />)}</div>
          ) : data ? (
            <div className="space-y-3">
              {/* Health Score */}
              <div className="flex items-center gap-3 px-4 py-3 bg-bg-primary rounded-lg">
                <div className={`text-2xl font-bold ${data.health_score >= 4 ? "text-gain" : data.health_score >= 3 ? "text-yellow-400" : "text-loss"}`}>
                  {data.health_score}/5
                </div>
                <div>
                  <p className="text-sm font-medium text-txt-primary">{data.health_label} Financial Health</p>
                  <p className="text-[10px] text-txt-dim">{data.name}</p>
                </div>
              </div>

              {/* 5-Point Checks */}
              <div className="grid grid-cols-5 gap-1.5">
                {data.health_checks?.map((c: any) => (
                  <div key={c.name} className={`px-2 py-2 rounded-lg text-center ${c.pass ? "bg-gain/10 border border-gain/20" : "bg-loss/10 border border-loss/20"}`}>
                    <div className={`text-base mb-0.5 ${c.pass ? "text-gain" : "text-loss"}`}>{c.pass ? "✓" : "✗"}</div>
                    <p className="text-[9px] font-medium text-txt-primary">{c.name}</p>
                    <p className="text-[8px] text-txt-dim">{c.desc}</p>
                  </div>
                ))}
              </div>

              {/* Key Ratios */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "PE (TTM)", val: data.ratios?.trailing_pe },
                  { label: "PE (Fwd)", val: data.ratios?.forward_pe },
                  { label: "P/B", val: data.ratios?.price_to_book },
                  { label: "ROE", val: data.ratios?.roe, suffix: "%" },
                  { label: "ROCE", val: data.ratios?.roce, suffix: "%" },
                  { label: "Op. Margin", val: data.ratios?.operating_margin, suffix: "%" },
                  { label: "D/E", val: data.ratios?.debt_to_equity, suffix: "%" },
                  { label: "Curr. Ratio", val: data.ratios?.current_ratio },
                  { label: "Div. Yield", val: data.ratios?.dividend_yield, suffix: "%" },
                ].map(r => (
                  <div key={r.label} className="bg-bg-primary rounded px-2.5 py-2">
                    <p className="text-[9px] text-txt-dim">{r.label}</p>
                    <p className="text-xs font-mono text-txt-primary">{r.val != null ? `${r.val}${r.suffix || ""}` : "—"}</p>
                  </div>
                ))}
              </div>

              {/* Shareholding */}
              {data.shareholding && (
                <div className="px-3 py-2.5 bg-bg-primary rounded-lg">
                  <p className="text-[10px] text-txt-dim mb-2">Shareholding Pattern</p>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div style={{ width: `${data.shareholding.promoters}%` }} className="bg-blue-500" title={`Promoters ${data.shareholding.promoters}%`} />
                    <div style={{ width: `${data.shareholding.fii}%` }} className="bg-green-500" title={`FII ${data.shareholding.fii}%`} />
                    <div style={{ width: `${data.shareholding.public}%` }} className="bg-gray-500" title={`Public ${data.shareholding.public}%`} />
                  </div>
                  <div className="flex gap-4 mt-1.5">
                    <span className="text-[9px] text-txt-dim"><span className="inline-block w-2 h-2 bg-blue-500 rounded-sm mr-1" />Promoters {data.shareholding.promoters}%</span>
                    <span className="text-[9px] text-txt-dim"><span className="inline-block w-2 h-2 bg-green-500 rounded-sm mr-1" />FII {data.shareholding.fii}%</span>
                    <span className="text-[9px] text-txt-dim"><span className="inline-block w-2 h-2 bg-gray-500 rounded-sm mr-1" />Public {data.shareholding.public}%</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-txt-muted text-center py-2">Could not load fundamentals</p>
          )}
        </div>
      )}
    </div>
  );
}
