"use client";
import { useState, useEffect } from "react";
import StockModal from "@/components/StockModal";
import TrendAnalysisModal from "@/components/TrendAnalysisModal";
import { useApi } from "@/components/useApi";
import type { WatchlistItem, Watchlist, DeepAnalysis, WishlistDeepAudit } from "./components/WishlistTypes";
import EditableTargetPrice from "./components/EditableTargetPrice";
import StockAnalysisPanel from "./components/StockAnalysisPanel";

export default function WishlistPage() {
  const { url, API, userId } = useApi();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedWId, setSelectedWId] = useState<number | null>(null);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [aiLadders, setAiLadders] = useState<any>(null);
  const [convictionData, setConvictionData] = useState<any>(null);
  const [convictionLoading, setConvictionLoading] = useState(false);

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
  const [trendStock, setTrendStock] = useState<string | null>(null);

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

  // 6. AI Conviction Scores
  const fetchConvictionScores = async () => {
    if (!selectedWId) return;
    if (convictionData) { setConvictionData(null); return; }
    setConvictionLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/strategy/ai/conviction-scores/${selectedWId}`);
      if (res.ok) setConvictionData(await res.json());
    } catch {}
    setConvictionLoading(false);
  };

  // 7. Create new watchlist
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

  // Filter and sort items — highest AI score first
  const filteredItems = items
    .filter((it) => {
      if (filterRec === "ALL") return true;
      const a = analysisMap.get(it.id);
      return a?.recommendation === filterRec;
    })
    .sort((a, b) => {
      const scoreA = analysisMap.get(a.id)?.composite_score ?? 0;
      const scoreB = analysisMap.get(b.id)?.composite_score ?? 0;
      return scoreB - scoreA;
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
            onClick={fetchConvictionScores}
            disabled={convictionLoading || !selectedWId}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border ${
              convictionData ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-bg-card border-border text-txt-secondary hover:text-amber-400 hover:border-amber-500/40"
            } disabled:opacity-50`}
          >
            {convictionLoading ? "Scoring..." : convictionData ? "Hide Scores" : "🏆 AI Conviction"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-accent hover:bg-accent-dark text-white text-xs font-medium rounded-lg transition-colors"
          >
            + Add Stock
          </button>
        </div>
      </div>

      {/* AI Conviction Scores Panel */}
      {convictionData && convictionData.items && convictionData.items.length > 0 && (
        <div className="bg-bg-card border border-amber-500/20 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">🏆 AI Conviction Scores</h3>
            <span className="text-[10px] text-txt-dim">{convictionData.api_calls?.total || 0} API calls</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {convictionData.items.map((item: any) => {
              const callColor = item.call === "STRONG_BUY" || item.call === "BUY_ON_DIP" ? "gain" :
                item.call === "AVOID" ? "loss" : "yellow-400";
              return (
                <div key={item.symbol} className="bg-bg-primary rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-txt-primary">{item.symbol}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded bg-${callColor}/15 text-${callColor} border border-${callColor}/20`}>
                        {item.call?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className={`text-lg font-bold ${item.conviction_score >= 70 ? "text-gain" : item.conviction_score >= 50 ? "text-yellow-400" : "text-loss"}`}>
                      {item.conviction_score}/100
                    </span>
                  </div>
                  <p className="text-[10px] text-txt-secondary mb-2">{item.reasoning}</p>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-bg-card rounded px-1.5 py-1">
                      <p className="text-[8px] text-txt-dim">Entry</p>
                      <p className="text-[10px] font-mono text-txt-primary">₹{item.entry_zone_low}-{item.entry_zone_high}</p>
                    </div>
                    <div className="bg-bg-card rounded px-1.5 py-1">
                      <p className="text-[8px] text-txt-dim">Stop Loss</p>
                      <p className="text-[10px] font-mono text-loss">₹{item.stop_loss}</p>
                    </div>
                    <div className="bg-bg-card rounded px-1.5 py-1">
                      <p className="text-[8px] text-txt-dim">Target 6M</p>
                      <p className="text-[10px] font-mono text-gain">₹{item.target_6m}</p>
                    </div>
                    <div className="bg-bg-card rounded px-1.5 py-1">
                      <p className="text-[8px] text-txt-dim">Sentiment</p>
                      <p className="text-[10px] font-mono text-txt-primary">{item.sentiment_score}/100</p>
                    </div>
                  </div>
                  {item.catalyst && <p className="text-[9px] text-accent-light mt-1.5">Catalyst: {item.catalyst}</p>}
                  {item.risk_factors && <p className="text-[9px] text-loss mt-0.5">Risk: {item.risk_factors}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              Immediate Buy Target Alert — Target Buy Price Reached!
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
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-border bg-bg-primary/50 text-[11px] text-txt-dim font-medium">
                    <th className="px-3.5 py-3 text-left">Stock</th>
                    <th className="px-3 py-3 text-center min-w-[170px]">Overall AI Score & Signal</th>
                    <th className="px-3 py-3 text-right">Live CMP</th>
                    <th className="px-3 py-3 text-right min-w-[130px]">Target Buy</th>
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
                          <div className="flex items-center gap-2">
                            {a ? (
                              <span
                                className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded border"
                                style={{
                                  backgroundColor: `${a.recommendation_color}18`,
                                  borderColor: `${a.recommendation_color}60`,
                                  color: a.recommendation_color,
                                }}
                                title={`Live Dynamic AI Score: ${a.composite_score}/100 (${a.recommendation})`}
                              >
                                [{a.composite_score}]
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-bg-card border border-border text-txt-muted">
                                [—]
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalStock(it.symbol);
                              }}
                              className="font-bold text-accent-light hover:underline text-xs block text-left"
                            >
                              {it.symbol}
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {it.name && <span className="text-[10px] text-txt-muted truncate max-w-[80px]">{it.name}</span>}
                            <button
                              onClick={(e) => { e.stopPropagation(); setTrendStock(it.symbol); }}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-light border border-accent/20 hover:bg-accent/20 transition-colors"
                              title="AI Trend Analysis"
                            >📈 Trend</button>
                          </div>
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

                        {/* Target Buy with distance % */}
                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <EditableTargetPrice
                            value={tb}
                            onSave={(newPrice) => updateTargetPrice(it.id, newPrice)}
                          />
                          {isTargetHit ? (
                            <span className="inline-block text-[9px] font-bold text-gain bg-gain/15 px-1.5 py-0.5 rounded mt-0.5 animate-pulse">
                              🎯 Target Hit!
                            </span>
                          ) : tb && cmp ? (
                            <span className="block text-[9px] font-mono text-txt-dim mt-0.5">
                              {(((cmp - tb) / tb) * 100) > 0 ? "+" : ""}
                              {(((cmp - tb) / tb) * 100).toFixed(1)}% away
                            </span>
                          ) : null}
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
            <StockAnalysisPanel
              selectedStockAnalysis={selectedStockAnalysis}
              selectedItemId={selectedItemId}
              instReport={instReport}
              loadingInstReport={loadingInstReport}
              dossierTab={dossierTab}
              setDossierTab={setDossierTab}
              updateTargetPrice={updateTargetPrice}
              fmt={fmt}
            />
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
      {trendStock && <TrendAnalysisModal symbol={trendStock} onClose={() => setTrendStock(null)} />}
    </div>
  );
}
