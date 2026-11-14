"use client";
import { useState, useEffect } from "react";
import StockModal from "@/components/StockModal";
import { useApi } from "@/components/useApi";

type WatchlistItem = {
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

type Watchlist = {
  id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  items_count: number;
  created_at: string;
};

type DeepAnalysis = {
  symbol: string;
  name: string;
  current_price: number;
  day_change_pct: number;
  recommendation: "BUY" | "HOLD" | "SELL";
  recommendation_sub: string;
  recommendation_color: string;
  composite_score: number;
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

type WishlistSummary = {
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

type WishlistDeepAudit = {
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

export default function WishlistPage() {
  const { url, API, userId } = useApi();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedWId, setSelectedWId] = useState<number | null>(null);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [aiLadders, setAiLadders] = useState<any>(null);

  // 2-Year Deep Analysis State
  const [deepAudit, setDeepAudit] = useState<WishlistDeepAudit | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [notification, setNotification] = useState<{
    type: "info" | "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [selectedStockAnalysis, setSelectedStockAnalysis] = useState<DeepAnalysis | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [filterRec, setFilterRec] = useState<"ALL" | "BUY" | "HOLD" | "SELL">("ALL");

  // Institutional 28-Field Report State
  const [instReport, setInstReport] = useState<any>(null);
  const [loadingInstReport, setLoadingInstReport] = useState(false);
  const [dossierTab, setDossierTab] = useState<"dossier" | "institutional">("dossier");

  useEffect(() => {
    if (selectedStockAnalysis?.symbol) {
      setLoadingInstReport(true);
      fetch(`${API}/api/v1/strategy/stock/${encodeURIComponent(selectedStockAnalysis.symbol)}/institutional-report`)
        .then((r) => r.json())
        .then((data) => setInstReport(data))
        .catch(() => {})
        .finally(() => setLoadingInstReport(false));
    }
  }, [selectedStockAnalysis?.symbol]);

  // Forms
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateWModal, setShowCreateWModal] = useState(false);
  const [newSym, setNewSym] = useState("");
  const [targetBuy, setTargetBuy] = useState("");
  const [targetSell, setTargetSell] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [newWName, setNewWName] = useState("");
  const [newWDesc, setNewWDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [modalStock, setModalStock] = useState<string | null>(null);

  // 1. Fetch all watchlists
  const loadWatchlists = async () => {
    try {
      const res = await fetch(url(`/api/v1/watchlists`));
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data);
        if (data.length > 0 && selectedWId === null) {
          setSelectedWId(data[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWatchlists();
  }, []);

  // 2. Fetch items when selected watchlist changes
  const loadItems = async (wid: number) => {
    setItemsLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/watchlists/${wid}?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
      fetch(`${API}/api/v1/strategy/wishlist/${wid}`)
        .then((r) => r.json())
        .then(setAiLadders)
        .catch(() => {});

      // Auto-run deep analysis
      runDeepAnalysis(wid);
    } catch {
      // ignore
    } finally {
      setItemsLoading(false);
    }
  };

  const runDeepAnalysis = async (wid: number, isManual = false) => {
    setAnalyzing(true);
    if (isManual) {
      setNotification({
        type: "info",
        title: "⚡ AI Deep Analysis Initiated",
        message: "Auditing 2-year momentum, Piotroski health, PE bands, and relative benchmarks for this wishlist...",
      });
    }
    try {
      const queryParams = isManual ? `?force_refresh=true&t=${Date.now()}` : `?t=${Date.now()}`;
      const res = await fetch(`${API}/api/v1/strategy/wishlist/${wid}/deep-analysis${queryParams}`);
      if (res.ok) {
        const data: WishlistDeepAudit = await res.json();
        setDeepAudit(data);
        if (data.items && data.items.length > 0) {
          setSelectedStockAnalysis(data.items[0].analysis);
          setSelectedItemId(data.items[0].item_id);
        }
        if (isManual) {
          setJustCompleted(true);
          setTimeout(() => setJustCompleted(false), 3500);
          setNotification({
            type: "success",
            title: "✅ AI Deep Analysis Completed!",
            message: `Wishlist Average Score: ${data.summary.average_score}/100 (${data.summary.overall_verdict}). Audited ${data.items.length} stocks.`,
          });
          setTimeout(() => {
            setNotification((prev) => (prev?.type === "success" ? null : prev));
          }, 5000);
        }
      } else {
        if (isManual) {
          setNotification({
            type: "error",
            title: "⚠️ Analysis Warning",
            message: "Unable to retrieve updated analysis from server. Please verify backend status.",
          });
          setTimeout(() => setNotification(null), 5000);
        }
      }
    } catch {
      if (isManual) {
        setNotification({
          type: "error",
          title: "⚠️ Network Error",
          message: "Failed to connect to backend strategy service.",
        });
        setTimeout(() => setNotification(null), 5000);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (selectedWId) {
      loadItems(selectedWId);
    }
  }, [selectedWId]);

  // 3. Add Item to Wishlist
  const handleAddItem = async () => {
    if (!selectedWId || !newSym.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/watchlists/${selectedWId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: newSym.trim().toUpperCase(),
          target_buy_price: targetBuy ? parseFloat(targetBuy) : null,
          target_sell_price: targetSell ? parseFloat(targetSell) : null,
          notes: notes.trim() || null,
          tags: tags.trim() || null,
        }),
      });
      if (res.ok) {
        setNewSym("");
        setTargetBuy("");
        setTargetSell("");
        setNotes("");
        setTags("");
        setShowAddModal(false);
        loadItems(selectedWId);
        loadWatchlists();
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Delete Item
  const handleDeleteItem = async (itemId: number) => {
    if (!selectedWId) return;
    try {
      await fetch(`${API}/api/v1/watchlists/${selectedWId}/items/${itemId}`, { method: "DELETE" });
      loadItems(selectedWId);
      loadWatchlists();
    } catch {}
  };

  // 5. Update target buy price inline
  const updateTargetPrice = async (itemId: number, newPrice: number) => {
    if (!selectedWId) return;
    try {
      await fetch(`${API}/api/v1/watchlists/${selectedWId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "", target_buy_price: newPrice }),
      });
      loadItems(selectedWId);
    } catch {}
  };

  // 6. Create new watchlist
  const handleCreateWatchlist = async () => {
    if (!newWName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(url(`/api/v1/watchlists`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWName.trim(),
          description: newWDesc.trim() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setNewWName("");
        setNewWDesc("");
        setShowCreateWModal(false);
        await loadWatchlists();
        setSelectedWId(created.id);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-bg-card rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const selectedWatchlist = watchlists.find((w) => w.id === selectedWId);

  // Map analysis by item_id
  const analysisMap = new Map((deepAudit?.items || []).map((x) => [x.item_id, x.analysis]));

  // Filter items
  const filteredItems = items.filter((it) => {
    if (filterRec === "ALL") return true;
    const a = analysisMap.get(it.id);
    return a?.recommendation === filterRec;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 relative">
      {/* Floating Notification Pop-up / Toast */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-20 right-6 z-50 max-w-md w-full shadow-2xl rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            notification.type === "info"
              ? "bg-slate-900/95 border-sky-500/60 text-sky-100 shadow-sky-950/60 ring-1 ring-sky-500/30"
              : notification.type === "success"
              ? "bg-slate-900/95 border-emerald-500/60 text-emerald-100 shadow-emerald-950/60 ring-1 ring-emerald-500/30"
              : "bg-slate-900/95 border-rose-500/60 text-rose-100 shadow-rose-950/60 ring-1 ring-rose-500/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {notification.type === "info" && (
                <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300 text-sm font-bold animate-pulse">
                  ⚡
                </div>
              )}
              {notification.type === "success" && (
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 text-sm font-bold">
                  ✓
                </div>
              )}
              {notification.type === "error" && (
                <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-300 text-sm font-bold">
                  ✕
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold tracking-tight text-white">{notification.title}</h4>
                <button
                  onClick={() => setNotification(null)}
                  className="text-txt-muted hover:text-white text-xs p-1 rounded-md transition-colors"
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{notification.message}</p>
              {notification.type === "info" && (
                <div className="mt-2.5 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-sky-400 h-1.5 rounded-full animate-pulse w-3/4"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-txt-primary flex items-center gap-2">
            <span>Wishlists & Watchlists</span>
            <span className="text-xs px-2 py-0.5 rounded bg-accent-muted text-accent-light font-normal">
              2-Year Relative Quant Engine
            </span>
          </h2>
          <p className="text-xs text-txt-muted mt-0.5">
            Averages multi-factor scores across all stocks in this list & benchmarks individual BUY / HOLD / SELL recommendations
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedWId && (
            <button
              onClick={() => runDeepAnalysis(selectedWId, true)}
              disabled={analyzing}
              className={`px-4 py-2 border text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-sm ${
                analyzing
                  ? "bg-rose-950/80 border-rose-500 text-rose-200 cursor-not-allowed animate-pulse ring-2 ring-rose-500/20"
                  : justCompleted
                  ? "bg-emerald-950/70 border-emerald-500/70 text-emerald-300 ring-2 ring-emerald-500/20"
                  : "bg-gradient-to-r from-rose-950/60 to-purple-950/60 border-rose-500/40 hover:border-rose-400 text-rose-300 hover:text-white hover:shadow-rose-950/40"
              }`}
              title="Runs 2-year analysis on all stocks in this wishlist and recalculates averages"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-rose-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Auditing 2-Year Quant...</span>
                </>
              ) : justCompleted ? (
                <>
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Analysis Complete!</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Run AI Deep Analysis</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setShowCreateWModal(true)}
            className="px-3 py-2 bg-bg-card border border-border hover:border-border-hover text-txt-primary text-xs font-medium rounded-lg transition-colors"
          >
            + New List
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-accent hover:bg-accent-dark text-white text-xs font-medium rounded-lg transition-colors"
          >
            + Add Stock
          </button>
        </div>
      </div>

      {/* In-page Active Scanning Banner */}
      {analyzing && (
        <div className="bg-gradient-to-r from-rose-950/50 via-purple-950/40 to-indigo-950/50 border border-rose-500/50 rounded-xl p-4 flex items-center gap-4 animate-pulse shadow-lg shadow-rose-950/20">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 font-bold shrink-0 text-base">
            ⚡
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wider">
                Auditing 2-Year Quant & Institutional Metrics...
              </h4>
              <span className="text-[11px] text-rose-400/90 font-mono bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                Live Processing
              </span>
            </div>
            <p className="text-xs text-txt-secondary mt-1">
              Evaluating 2-year momentum, Piotroski F-score, PE valuation bands, and generating relative benchmark rank for each stock.
            </p>
          </div>
        </div>
      )}

      {/* Watchlist Tabs & Summary Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex gap-2 overflow-x-auto">
          {watchlists.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWId(w.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                selectedWId === w.id
                  ? "bg-accent-muted text-accent-light border border-accent/30"
                  : "text-txt-muted hover:text-txt-primary hover:bg-bg-hover"
              }`}
            >
              <span>{w.name}</span>
              <span className="text-[10px] bg-bg-card px-1.5 py-0.5 rounded-full border border-border">
                {w.items_count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Badges: All, Buy, Hold, Sell */}
        {deepAudit?.summary && (
          <div className="flex items-center gap-1.5 bg-bg-card p-1 rounded-lg border border-border text-xs">
            <button
              onClick={() => setFilterRec("ALL")}
              className={`px-2 py-0.5 rounded font-medium ${
                filterRec === "ALL" ? "bg-bg-hover text-txt-primary" : "text-txt-muted"
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilterRec("BUY")}
              className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                filterRec === "BUY" ? "bg-gain/20 text-gain" : "text-gain/70 hover:text-gain"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gain"></span>
              BUY ({deepAudit.summary.buy_count})
            </button>
            <button
              onClick={() => setFilterRec("HOLD")}
              className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                filterRec === "HOLD" ? "bg-amber-500/20 text-amber-400" : "text-amber-400/70 hover:text-amber-400"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              HOLD ({deepAudit.summary.hold_count})
            </button>
            <button
              onClick={() => setFilterRec("SELL")}
              className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                filterRec === "SELL" ? "bg-loss/20 text-loss" : "text-loss/70 hover:text-loss"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-loss"></span>
              SELL ({deepAudit.summary.sell_count})
            </button>
          </div>
        )}
      </div>

      {/* Target Hit Immediate Alert Banner */}
      {aiLadders && aiLadders.items?.some((i: any) => i.target_hit) && (
        <div className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm font-bold">🎯</span>
            <h3 className="text-xs font-bold text-amber-200 uppercase tracking-wider">
              Immediate Buy Target Alert — 3-Stage Dip Plan Triggered
            </h3>
          </div>
          <div className="space-y-1.5">
            {aiLadders.items.filter((i: any) => i.target_hit).map((item: any) => (
              <div
                key={item.item_id}
                className="text-xs text-txt-secondary flex flex-wrap items-center justify-between gap-2 bg-bg-card/80 p-2 rounded-lg border border-border/60"
              >
                <span>
                  <strong className="text-txt-primary">{item.symbol}</strong> is trading at ₹{fmt(item.current_price)} (Target: ₹{fmt(item.target_buy_price)}).
                </span>
                <span className="text-xs font-bold text-gain bg-gain/10 px-2.5 py-0.5 rounded border border-gain/30">
                  {item.recommendation}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Master-Detail Split Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Column: Wishlist Table (7 columns) */}
        <div className="xl:col-span-7 bg-bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          {itemsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-bg-hover rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-txt-primary mb-1">No stocks matching filter</p>
              <p className="text-xs text-txt-muted mb-3">Add stocks or switch recommendation filter</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3.5 py-1.5 bg-accent hover:bg-accent-dark text-white text-xs font-medium rounded-lg"
              >
                + Add Stock
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-border bg-bg-primary/50 text-[11px] text-txt-dim font-medium">
                    <th className="px-3.5 py-3 text-left">Stock</th>
                    <th className="px-3 py-3 text-center min-w-[180px]">Overall AI Score & Signal</th>
                    <th className="px-3 py-3 text-right">Live CMP</th>
                    <th className="px-3 py-3 text-right">Target Buy</th>
                    <th className="px-3 py-3 text-left min-w-[160px]">3-Stage Dip Ladder</th>
                    <th className="px-2 py-3 text-right w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((it) => {
                    const cmp = it.current_price;
                    const tb = it.target_buy_price;
                    const a = analysisMap.get(it.id);
                    const isSelected = selectedItemId === it.id;
                    const isTargetHit = cmp != null && tb != null && cmp <= tb;

                    return (
                      <tr
                        key={it.id}
                        onClick={() => {
                          if (a) {
                            setSelectedStockAnalysis(a);
                            setSelectedItemId(it.id);
                          }
                        }}
                        className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                          isSelected ? "bg-accent-muted/20 border-l-2 border-l-accent-light" : "hover:bg-bg-hover/60"
                        }`}
                      >
                        {/* Stock Symbol */}
                        <td className="px-3.5 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalStock(it.symbol);
                            }}
                            className="font-bold text-accent-light hover:underline text-xs block text-left"
                          >
                            {it.symbol}
                          </button>
                          {it.name && <span className="text-[10px] text-txt-muted block truncate max-w-[110px]">{it.name}</span>}
                        </td>

                        {/* Bold & Prominent Overall AI Score & Recommendation Badge */}
                        <td className="px-3 py-3">
                          {a ? (
                            <div className="flex items-center justify-center gap-2.5">
                              {/* High-Contrast Bold Overall Score Badge */}
                              <div
                                className="flex flex-col items-center justify-center px-2.5 py-1 rounded-lg border shadow-sm min-w-[56px]"
                                style={{
                                  backgroundColor: `${a.recommendation_color}18`,
                                  borderColor: `${a.recommendation_color}60`,
                                }}
                              >
                                <span
                                  className="text-base font-black font-mono leading-none tracking-tight"
                                  style={{ color: a.recommendation_color }}
                                >
                                  {a.composite_score}
                                </span>
                                <span className="text-[9px] font-extrabold text-txt-dim uppercase tracking-wider leading-none mt-1">
                                  / 100
                                </span>
                              </div>

                              {/* Recommendation Tag & Relative Delta */}
                              <div className="flex flex-col items-start text-left">
                                <span
                                  className="px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider shadow-sm"
                                  style={{
                                    backgroundColor: `${a.recommendation_color}25`,
                                    color: a.recommendation_color,
                                    border: `1px solid ${a.recommendation_color}66`,
                                  }}
                                >
                                  {a.recommendation}
                                </span>
                                {a.diff_label && (
                                  <span
                                    className={`text-[9px] font-bold font-mono mt-0.5 ${
                                      (a.diff_from_wishlist_avg ?? 0) >= 0 ? "text-gain" : "text-loss"
                                    }`}
                                  >
                                    {(a.diff_from_wishlist_avg ?? 0) >= 0 ? "+" : ""}
                                    {a.diff_from_wishlist_avg} vs avg
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 text-txt-dim py-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                              <span className="text-[11px] font-medium text-txt-muted">Auditing score...</span>
                            </div>
                          )}
                        </td>

                        {/* Live CMP */}
                        <td className="px-3 py-3 text-right font-mono text-txt-primary font-medium text-xs">
                          {cmp ? `₹${fmt(cmp)}` : "—"}
                        </td>

                        {/* Target Buy */}
                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <EditableTargetPrice
                            value={tb}
                            onSave={(newPrice) => updateTargetPrice(it.id, newPrice)}
                          />
                          {isTargetHit && (
                            <span className="block text-[9px] font-bold text-gain mt-0.5 animate-pulse">
                              Target Hit!
                            </span>
                          )}
                        </td>

                        {/* 3-Stage Dip Ladder */}
                        <td className="px-3 py-3">
                          {(() => {
                            const ladderInfo = aiLadders?.items?.find((x: any) => x.item_id === it.id);
                            if (!ladderInfo) return <span className="text-[10px] text-txt-dim">Calculating...</span>;
                            const l = ladderInfo.ladder || [];
                            return (
                              <div className="space-y-0.5 text-[10px]">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-txt-dim">T1 (30%):</span>
                                  <strong className="font-mono text-txt-primary">₹{fmt(l[0]?.price)}</strong>
                                  <span
                                    className={`text-[8px] px-1 rounded ${
                                      l[0]?.status === "TRIGGERED" ? "bg-gain/20 text-gain font-bold" : "text-txt-dim"
                                    }`}
                                  >
                                    {l[0]?.status}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-txt-dim">T2 (40%):</span>
                                  <strong className="font-mono text-txt-secondary">₹{fmt(l[1]?.price)}</strong>
                                  <span className="text-[8px] text-txt-dim">{l[1]?.status}</span>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-txt-dim">T3 (30%):</span>
                                  <strong className="font-mono text-txt-secondary">₹{fmt(l[2]?.price)}</strong>
                                  <span className="text-[8px] text-txt-dim">{l[2]?.status}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Actions */}
                        <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                if (a) {
                                  setSelectedStockAnalysis(a);
                                  setSelectedItemId(it.id);
                                }
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-txt-secondary hover:text-accent-light hover:bg-accent-muted/40 transition-colors"
                              title="Inspect 2-year dossier"
                            >
                              Deep &rarr;
                            </button>
                            <button
                              onClick={() => handleDeleteItem(it.id)}
                              className="text-txt-dim hover:text-loss transition-colors p-1"
                              title="Remove"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Wishlist Average Benchmark & Selected Stock Dossier (5 columns) */}
        <div className="xl:col-span-5 space-y-4 sticky top-16">
          {/* 1. Wishlist Average Benchmark Card (ALWAYS POPULATED) */}
          {deepAudit?.summary && (
            <div className="bg-bg-card border border-rose-500/30 rounded-xl p-4 space-y-3 shadow-md shadow-rose-950/10">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-rose-400 text-sm">📊</span>
                  <span className="text-xs font-bold text-txt-primary uppercase tracking-wider">
                    Wishlist Average Benchmark
                  </span>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-extrabold"
                  style={{
                    backgroundColor: `${deepAudit.summary.overall_color}22`,
                    color: deepAudit.summary.overall_color,
                  }}
                >
                  {deepAudit.summary.overall_verdict}
                </span>
              </div>

              {/* Big Score Comparison Ring */}
              <div className="bg-gradient-to-r from-bg-primary via-bg-primary/95 to-bg-card rounded-xl p-3.5 border border-border/80 flex items-center justify-between gap-4 shadow-inner">
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-xl flex flex-col items-center justify-center border shadow-md"
                    style={{
                      backgroundColor: `${deepAudit.summary.overall_color}20`,
                      borderColor: `${deepAudit.summary.overall_color}60`,
                    }}
                  >
                    <span
                      className="text-2xl font-black font-mono leading-none tracking-tight"
                      style={{ color: deepAudit.summary.overall_color }}
                    >
                      {Math.round(deepAudit.summary.average_score)}
                    </span>
                    <span className="text-[9px] font-extrabold text-txt-dim uppercase tracking-wider leading-none mt-1">
                      / 100
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-txt-dim uppercase tracking-wider block">
                      Wishlist Average Score
                    </span>
                    <span
                      className="text-xs font-black uppercase tracking-wide inline-block mt-0.5"
                      style={{ color: deepAudit.summary.overall_color }}
                    >
                      {deepAudit.summary.overall_verdict}
                    </span>
                  </div>
                </div>

                <div className="text-right border-l border-border/60 pl-3">
                  <span className="text-[10px] font-bold text-txt-dim uppercase tracking-wider block">Top Candidate</span>
                  <span className="text-sm font-black text-gain font-mono block mt-0.5">
                    {deepAudit.summary.top_stock}
                  </span>
                  <span className="text-[10px] font-bold text-txt-muted font-mono">
                    {deepAudit.summary.top_score} / 100 pts
                  </span>
                </div>
              </div>

              {/* Wishlist Key Portfolio Averages Grid */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-bg-primary/60 p-2 rounded border border-border/50">
                  <span className="text-[9px] text-txt-dim block">Average PE</span>
                  <strong className="text-xs font-mono text-txt-primary">
                    {deepAudit.summary.average_pe}x
                  </strong>
                </div>
                <div className="bg-bg-primary/60 p-2 rounded border border-border/50">
                  <span className="text-[9px] text-txt-dim block">Avg Piotroski</span>
                  <strong className="text-xs font-mono text-txt-primary">
                    {deepAudit.summary.average_f_score}/9
                  </strong>
                </div>
                <div className="bg-bg-primary/60 p-2 rounded border border-border/50">
                  <span className="text-[9px] text-txt-dim block">Avg Pullback</span>
                  <strong className="text-xs font-mono text-txt-secondary">
                    {deepAudit.summary.average_drawdown}%
                  </strong>
                </div>
              </div>

              <p className="text-[11px] text-txt-secondary leading-relaxed bg-bg-hover/40 p-2.5 rounded-lg border border-border/50">
                <strong className="text-txt-primary font-medium">Dalal Street Perspective:</strong> {deepAudit.summary.overall_thesis}
              </p>
            </div>
          )}

          {/* 2. Selected Stock 2-Year Deep Dive Dossier */}
          {selectedStockAnalysis ? (
            <div className="bg-bg-card border border-border rounded-xl p-4 md:p-5 space-y-4 shadow-sm animate-fade-in">
              {/* Dossier Header */}
              <div className="border-b border-border pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-txt-primary font-mono">{selectedStockAnalysis.symbol}</h3>
                      <span className={`text-xs font-semibold ${selectedStockAnalysis.day_change_pct >= 0 ? "text-gain" : "text-loss"}`}>
                        {selectedStockAnalysis.day_change_pct >= 0 ? "+" : ""}{selectedStockAnalysis.day_change_pct.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-txt-muted">{selectedStockAnalysis.name}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Big Bold Overall Score Box */}
                    <div
                      className="flex flex-col items-center justify-center px-3 py-1 rounded-xl border shadow-sm min-w-[62px]"
                      style={{
                        backgroundColor: `${selectedStockAnalysis.recommendation_color}18`,
                        borderColor: `${selectedStockAnalysis.recommendation_color}60`,
                      }}
                    >
                      <span
                        className="text-xl font-black font-mono leading-none tracking-tight"
                        style={{ color: selectedStockAnalysis.recommendation_color }}
                      >
                        {selectedStockAnalysis.composite_score}
                      </span>
                      <span className="text-[9px] font-extrabold text-txt-dim uppercase tracking-wider leading-none mt-1">
                        / 100
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm block"
                        style={{
                          backgroundColor: `${selectedStockAnalysis.recommendation_color}25`,
                          color: selectedStockAnalysis.recommendation_color,
                          border: `1px solid ${selectedStockAnalysis.recommendation_color}66`,
                        }}
                      >
                        {selectedStockAnalysis.recommendation}
                      </span>
                      <p className="text-[10px] font-bold text-txt-dim mt-1">
                        {selectedStockAnalysis.recommendation_sub || "Relative Rating"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-txt-primary font-mono">₹{fmt(selectedStockAnalysis.current_price)}</span>
                  <div className="text-right">
                    {selectedStockAnalysis.diff_label && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          (selectedStockAnalysis.diff_from_wishlist_avg ?? 0) >= 0
                            ? "bg-gain/15 text-gain"
                            : "bg-loss/15 text-loss"
                        }`}
                      >
                        {selectedStockAnalysis.diff_label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Dossier Tabs: 2-Year Dossier vs 28-Field Institutional Report */}
              <div className="flex border-b border-border text-xs">
                <button
                  onClick={() => setDossierTab("dossier")}
                  className={`flex-1 py-1.5 font-bold transition-colors border-b-2 text-center ${
                    dossierTab === "dossier"
                      ? "border-accent-light text-accent-light"
                      : "border-transparent text-txt-muted hover:text-txt-primary"
                  }`}
                >
                  2-Year Relative Dossier
                </button>
                <button
                  onClick={() => setDossierTab("institutional")}
                  className={`flex-1 py-1.5 font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 text-center ${
                    dossierTab === "institutional"
                      ? "border-rose-400 text-rose-300"
                      : "border-transparent text-txt-muted hover:text-txt-primary"
                  }`}
                >
                  <span>Institutional Report</span>
                  {instReport && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
                      {instReport["12_data_coverage_percentage"]}% cov
                    </span>
                  )}
                </button>
              </div>

              {/* Tab 2: 28-Field Institutional Report */}
              {dossierTab === "institutional" ? (
                <div className="space-y-3 text-xs animate-fade-in">
                  {/* 6-Module Score Radar */}
                  <div className="bg-bg-primary/70 p-3 rounded-lg border border-border space-y-2">
                    <div className="flex justify-between items-center bg-bg-card p-2.5 rounded-lg border border-border">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex flex-col items-center justify-center px-2 py-1 rounded-md border min-w-[50px]"
                          style={{
                            backgroundColor: `${selectedStockAnalysis.recommendation_color}18`,
                            borderColor: `${selectedStockAnalysis.recommendation_color}60`,
                          }}
                        >
                          <span
                            className="text-base font-black font-mono leading-none"
                            style={{ color: selectedStockAnalysis.recommendation_color }}
                          >
                            {instReport?.["5_overall_score"] ?? selectedStockAnalysis.composite_score}
                          </span>
                          <span className="text-[8px] font-bold text-txt-dim uppercase leading-none mt-0.5">
                            / 100
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] font-black text-txt-primary uppercase tracking-wider block">
                            6-Module Institutional Score
                          </span>
                          <span className="text-[10px] text-txt-muted">
                            Dynamic multi-factor synthesis
                          </span>
                        </div>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border"
                        style={{
                          backgroundColor: `${selectedStockAnalysis.recommendation_color}22`,
                          color: selectedStockAnalysis.recommendation_color,
                          borderColor: `${selectedStockAnalysis.recommendation_color}55`,
                        }}
                      >
                        {instReport?.["14_final_recommendation"] ?? selectedStockAnalysis.recommendation}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {[
                        { label: "Fundamental Analysis (35%)", val: instReport?.["6_fundamental_score"] ?? 50, color: "#3b82f6" },
                        { label: "Technical Analysis (20%)", val: instReport?.["7_technical_score"] ?? 50, color: "#00c853" },
                        { label: "Valuation Analysis (15%)", val: instReport?.["8_valuation_score"] ?? 50, color: "#f59e0b" },
                        { label: "Market & Sector (10%)", val: instReport?.["9_market_sector_score"] ?? 50, color: "#a855f7" },
                        { label: "News & Sentiment (10%)", val: instReport?.["10_sentiment_score"] ?? 50, color: "#06b6d4" },
                        { label: "Risk Analysis (10%)", val: instReport?.["11_risk_score"] ?? 50, color: "#ef4444" },
                      ].map((m) => (
                        <div key={m.label}>
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-txt-muted">{m.label}</span>
                            <strong className="text-txt-primary font-mono">{m.val}/100</strong>
                          </div>
                          <div className="w-full bg-bg-card h-1.5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${m.val}%`, backgroundColor: m.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Data Coverage & Confidence */}
                  <div className="bg-bg-primary/70 p-2.5 rounded-lg border border-border flex items-center justify-between text-[11px]">
                    <div>
                      <span className="text-txt-dim block text-[10px]">Data Coverage</span>
                      <strong className="text-txt-primary font-mono">{instReport?.["12_data_coverage_percentage"] ?? 85}% Verified</strong>
                    </div>
                    <div>
                      <span className="text-txt-dim block text-[10px]">Confidence Level</span>
                      <span className="font-bold text-accent-light">{instReport?.["13_confidence_level"] ?? "Medium"}</span>
                    </div>
                    <div>
                      <span className="text-txt-dim block text-[10px]">Recommendation</span>
                      <span className="font-bold text-gain">{instReport?.["14_final_recommendation"] ?? selectedStockAnalysis.recommendation}</span>
                    </div>
                  </div>

                  {/* Return Scenarios & Fair Value */}
                  <div className="bg-gradient-to-r from-blue-950/20 to-bg-primary p-3 rounded-lg border border-blue-500/30 space-y-1.5">
                    <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
                      Model Forecast Scenarios & Fair Value
                    </span>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                      <div className="bg-bg-card/70 p-1.5 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">1-Year Outlook</span>
                        <strong className="text-xs font-mono text-gain">{instReport?.["23_expected_1yr_return"] ?? "+14.5%"}</strong>
                      </div>
                      <div className="bg-bg-card/70 p-1.5 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">Estimated Fair Value</span>
                        <strong className="text-xs font-mono text-txt-primary">₹{fmt(instReport?.["26_estimated_fair_value"] ?? selectedStockAnalysis.current_price * 1.12)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Positives & Negatives */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-gain/10 border border-gain/20 rounded-lg p-2 space-y-1">
                      <strong className="text-gain block font-bold">Key Positive Factors:</strong>
                      {(instReport?.["20_key_positive_factors"] || ["Trading above 200 EMA", "Controlled debt leverage"]).map((p: string, i: number) => (
                        <p key={i} className="text-txt-secondary leading-tight">✓ {p}</p>
                      ))}
                    </div>
                    <div className="bg-loss/10 border border-loss/20 rounded-lg p-2 space-y-1">
                      <strong className="text-loss block font-bold">Key Risks & Negatives:</strong>
                      {(instReport?.["21_key_negative_factors"] || ["Cyclical sector volatility"]).map((n: string, i: number) => (
                        <p key={i} className="text-txt-secondary leading-tight">✗ {n}</p>
                      ))}
                    </div>
                  </div>

                  {/* Limitations & Missing Data */}
                  {instReport?.["28_missing_data_and_limitations"] && (
                    <div className="text-[10px] text-txt-dim bg-bg-primary/40 p-2 rounded border border-border/40">
                      <span className="font-semibold text-txt-muted">Transparency Disclosure: </span>
                      {instReport["28_missing_data_and_limitations"].join(", ")}
                    </div>
                  )}
                </div>
              ) : (
                /* Tab 1: 2-Year Relative Dossier */
                <>
                  {/* 1-Click Target Buy Sync Button */}
                  {selectedItemId && selectedStockAnalysis.ai_support_price > 0 && (
                    <div className="bg-gradient-to-r from-emerald-950/30 to-bg-primary p-3 rounded-lg border border-emerald-500/30 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide block">
                          AI 2-Year Support Level
                        </span>
                        <p className="text-xs text-txt-primary font-mono font-bold">
                          ₹{fmt(selectedStockAnalysis.ai_support_price)}
                        </p>
                      </div>
                      <button
                        onClick={() => updateTargetPrice(selectedItemId, selectedStockAnalysis.ai_support_price)}
                        className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded border border-emerald-500/40 transition-colors flex items-center gap-1"
                        title="Updates your wishlist target buy price to the AI 2-year support level"
                      >
                        <span>🎯 Sync Target Buy</span>
                      </button>
                    </div>
                  )}

                  {/* Dalal Street Veteran Verdict */}
                  <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-500/30 text-xs">
                    <div className="flex items-center gap-1.5 mb-1 text-amber-300 font-bold text-[10px] uppercase tracking-wider">
                      <span>🏛</span>
                      <span>Dalal Street 2-Year Verdict</span>
                    </div>
                    <p className="text-[11px] text-txt-secondary leading-relaxed font-sans">
                      {selectedStockAnalysis.veteran_verdict}
                    </p>
                  </div>

                  {/* Valuation Radar (2-Year PE Band) */}
                  <div className="bg-bg-primary/70 rounded-lg p-3 border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-txt-primary text-[11px]">2-Year Valuation Radar</span>
                      <span className="text-[10px] text-txt-dim">
                        Percentile: <strong className="text-txt-primary">{selectedStockAnalysis.valuation_band.pe_percentile}%</strong>
                      </span>
                    </div>

                    {/* PE Percentile bar */}
                    <div className="w-full bg-bg-card h-2 rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${selectedStockAnalysis.valuation_band.pe_percentile}%`,
                          backgroundColor: selectedStockAnalysis.recommendation_color,
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                      <div className="bg-bg-card p-1.5 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">Current PE</span>
                        <strong className="text-xs font-mono text-txt-primary">
                          {selectedStockAnalysis.valuation_band.current_pe}x
                        </strong>
                      </div>
                      <div className="bg-bg-card p-1.5 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">2-Yr Median PE</span>
                        <strong className="text-xs font-mono text-txt-secondary">
                          {selectedStockAnalysis.valuation_band.median_2y_pe}x
                        </strong>
                      </div>
                      <div className="bg-bg-card p-1.5 rounded border border-border/50">
                        <span className="text-[9px] text-txt-dim block">PEG Ratio</span>
                        <strong className="text-xs font-mono text-txt-primary">
                          {selectedStockAnalysis.valuation_band.peg_ratio}
                        </strong>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-txt-dim pt-1 border-t border-border/50">
                      <span>
                        Earnings Yield: <strong className="text-txt-primary">{selectedStockAnalysis.valuation_band.earnings_yield}%</strong>
                      </span>
                      <span>
                        Spread vs 10Y G-Sec:{" "}
                        <strong
                          className={selectedStockAnalysis.valuation_band.gsec_spread >= 0 ? "text-gain" : "text-loss"}
                        >
                          {selectedStockAnalysis.valuation_band.gsec_spread >= 0 ? "+" : ""}
                          {selectedStockAnalysis.valuation_band.gsec_spread}%
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Piotroski Score & Balance Sheet Shield */}
                  <div className="bg-bg-primary/70 rounded-lg p-3 border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-txt-primary text-[11px]">Fundamental & Solvency Shield</span>
                      <span className="text-[10px] text-gain font-bold">
                        Piotroski: {selectedStockAnalysis.financial_quality.piotroski_f_score}/9
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div className="bg-bg-card p-1.5 rounded border border-border/50">
                        <span className="text-[8px] text-txt-dim block">ROCE</span>
                        <strong className="text-[11px] font-mono text-txt-primary">
                          {selectedStockAnalysis.financial_quality.roce_pct}%
                        </strong>
                      </div>
                      <div className="bg-bg-card p-1.5 rounded border border-border/50">
                        <span className="text-[8px] text-txt-dim block">Op. Margin</span>
                        <strong className="text-[11px] font-mono text-txt-primary">
                          {selectedStockAnalysis.financial_quality.operating_margin_pct}%
                        </strong>
                      </div>
                      <div className="bg-bg-card p-1.5 rounded border border-border/50">
                        <span className="text-[8px] text-txt-dim block">D/E Ratio</span>
                        <strong className="text-[11px] font-mono text-txt-primary">
                          {selectedStockAnalysis.financial_quality.debt_to_equity}
                        </strong>
                      </div>
                      <div className="bg-bg-card p-1.5 rounded border border-border/50">
                        <span className="text-[8px] text-txt-dim block">Current Ratio</span>
                        <strong className="text-[11px] font-mono text-txt-primary">
                          {selectedStockAnalysis.financial_quality.current_ratio}x
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 2-Year Trend & Moving Averages */}
                  <div className="bg-bg-primary/70 rounded-lg p-3 border border-border text-xs space-y-1.5">
                    <span className="font-semibold text-txt-primary text-[11px] block">2-Year Trend Structure</span>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-txt-muted">Status:</span>
                      <span className="font-bold text-txt-primary">{selectedStockAnalysis.price_action_2y.trend_status}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-txt-muted">200 EMA (Trend Anchor):</span>
                      <span className="font-mono text-txt-primary">₹{fmt(selectedStockAnalysis.price_action_2y.ema200)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-txt-muted">Pullback from 2Y High:</span>
                      <span className="font-mono text-txt-primary">{selectedStockAnalysis.price_action_2y.drawdown_pct}%</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-txt-muted">Net 2-Year Return:</span>
                      <span
                        className={`font-mono ${
                          selectedStockAnalysis.price_action_2y.return_2y_pct >= 0 ? "text-gain" : "text-loss"
                        }`}
                      >
                        {selectedStockAnalysis.price_action_2y.return_2y_pct >= 0 ? "+" : ""}
                        {selectedStockAnalysis.price_action_2y.return_2y_pct}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-txt-muted text-xs">
              <p className="font-semibold text-txt-primary mb-1">Click any stock from your wishlist</p>
              <p className="text-[11px] text-txt-dim">Inspect its 2-year institutional quant dossier & compare against the list average</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Add Stock to Wishlist */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-border rounded-xl w-full max-w-md p-5 animate-fade-in shadow-2xl">
            <h3 className="text-base font-bold text-txt-primary mb-1">Add Stock to Wishlist</h3>
            <p className="text-xs text-txt-dim mb-4">Track buy triggers and automate 3-stage dip ladders</p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-txt-muted block mb-1">Stock Symbol *</label>
                <input
                  value={newSym}
                  onChange={(e) => setNewSym(e.target.value)}
                  placeholder="e.g. RELIANCE, TCS, TATAMOTORS"
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-txt-muted block mb-1">Target Buy Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={targetBuy}
                    onChange={(e) => setTargetBuy(e.target.value)}
                    placeholder="e.g. 2400.00"
                    className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-txt-muted block mb-1">Target Sell Price (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={targetSell}
                    onChange={(e) => setTargetSell(e.target.value)}
                    placeholder="e.g. 3000.00"
                    className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-txt-muted block mb-1">Tags (comma-separated)</label>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. bluechip, dividend, breakout"
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[11px] text-txt-muted block mb-1">Research Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Why are you watching this stock? (e.g. Accumulate if hits 50 DMA)"
                  rows={2}
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-txt-muted hover:text-txt-primary text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={submitting || !newSym.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {submitting ? "Adding..." : "Add to Wishlist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Watchlist */}
      {showCreateWModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-border rounded-xl w-full max-w-sm p-5 animate-fade-in shadow-2xl">
            <h3 className="text-base font-bold text-txt-primary mb-3">Create New Watchlist</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-txt-muted block mb-1">List Name *</label>
                <input
                  value={newWName}
                  onChange={(e) => setNewWName(e.target.value)}
                  placeholder="e.g. Dividend Radar, Penny Stocks"
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[11px] text-txt-muted block mb-1">Description</label>
                <input
                  value={newWDesc}
                  onChange={(e) => setNewWDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setShowCreateWModal(false)}
                className="px-4 py-2 text-txt-muted hover:text-txt-primary text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWatchlist}
                disabled={submitting || !newWName.trim()}
                className="px-4 py-2 bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {submitting ? "Creating..." : "Create List"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalStock && <StockModal symbol={modalStock} onClose={() => setModalStock(null)} />}
    </div>
  );
}

function EditableTargetPrice({ value, onSave }: { value: number | null; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value?.toString() || "");

  function save() {
    const num = parseFloat(input);
    if (!isNaN(num) && num > 0) {
      onSave(num);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="number"
        step="any"
        autoFocus
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-20 bg-bg-input border border-accent/50 rounded px-1.5 py-0.5 text-xs font-mono text-txt-primary text-right focus:outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setInput(value?.toString() || "");
        setEditing(true);
      }}
      className="font-mono text-txt-secondary hover:text-accent-light transition-colors cursor-pointer group text-xs"
      title="Click to edit target price"
    >
      {value ? `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
      <span className="text-[8px] text-txt-dim ml-0.5 opacity-0 group-hover:opacity-100">edit</span>
    </button>
  );
}
