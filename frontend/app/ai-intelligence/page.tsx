"use client";
import { useState, useEffect } from "react";
import StockModal from "@/components/StockModal";
import { useProfile } from "@/components/ProfileProvider";
import type { DiscoveredStock, DiscoveryResponse, ScanRunRecord } from "./components/AITypes";
import StockTelecastModal from "./components/StockTelecastModal";
import HistoryVault from "./components/HistoryVault";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function AIIntelligencePage() {
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedStock, setSelectedStock] = useState<DiscoveredStock | null>(null);
  const [modalStock, setModalStock] = useState<string | null>(null);
  const [activeStrategyTab, setActiveStrategyTab] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // History Vault & Multi-Batch Scanner states
  const [viewMode, setViewMode] = useState<"LIVE_DISCOVERY" | "HISTORY_VAULT">("LIVE_DISCOVERY");
  const [scanRuns, setScanRuns] = useState<ScanRunRecord[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [scanningBatch, setScanningBatch] = useState(false);
  const [currentBatchInfo, setCurrentBatchInfo] = useState<string>("Batch 1: Mega & Nifty 50 Core (Equities 1 - 500)");

  const { profile, userId } = useProfile();

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
    return 2;
  }

  const loadDiscoveryData = async (force: boolean = false) => {
    const uid = getEffectiveUserId();
    if (force) setScanning(true);
    else setLoading(true);

    try {
      const endpoint = force
        ? `${API}/api/v1/strategy/ai-discovery/scan?user_id=${uid}`
        : `${API}/api/v1/strategy/ai-discovery?user_id=${uid}`;
      const method = force ? "POST" : "GET";
      const res = await fetch(endpoint, { method });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  const loadVaultData = async () => {
    const uid = getEffectiveUserId();
    setLoadingVault(true);
    try {
      const res = await fetch(`${API}/api/v1/strategy/ai-discovery/vault?user_id=${uid}`);
      if (res.ok) {
        const runs = await res.json();
        setScanRuns(runs);
        if (runs.length > 0 && expandedRunId === null) {
          setExpandedRunId(runs[0].run_id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingVault(false);
    }
  };

  const handleScanNextBatch = async () => {
    const uid = getEffectiveUserId();
    setScanningBatch(true);
    try {
      const res = await fetch(`${API}/api/v1/strategy/ai-discovery/vault/scan-batch?user_id=${uid}`, {
        method: "POST",
      });
      if (res.ok) {
        const d = await res.json();
        setCurrentBatchInfo(d.batch_name);
        setToastMessage(`✓ Logged Run #${d.run_id}: ${d.batch_name} (Equities ${d.screened_range})`);
        setTimeout(() => setToastMessage(null), 4000);
        await loadVaultData();
        await loadDiscoveryData();
        setExpandedRunId(d.run_id);
      }
    } catch {
      setToastMessage("Batch scan failed. Try again.");
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setScanningBatch(false);
    }
  };

  const [deletingRunId, setDeletingRunId] = useState<number | null>(null);

  const handleDeleteBatchRun = async (runId: number, batchName: string) => {
    const uid = getEffectiveUserId();
    if (!window.confirm(`Delete ${batchName} (#${runId}) from the History Vault? This will permanently remove its 500-equity archived setups from your database.`)) {
      return;
    }
    setDeletingRunId(runId);
    try {
      const res = await fetch(`${API}/api/v1/strategy/ai-discovery/vault/runs/${runId}?user_id=${uid}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setToastMessage(`🗑️ Deleted ${batchName} (#${runId}) successfully!`);
        setTimeout(() => setToastMessage(null), 3000);
        await loadVaultData();
        await loadDiscoveryData();
      } else {
        const err = await res.json();
        setToastMessage(`❌ Error deleting batch: ${err.detail || "Failed"}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch {
      setToastMessage("Failed to delete batch run");
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setDeletingRunId(null);
    }
  };

  useEffect(() => {
    loadDiscoveryData(false);
    loadVaultData();
  }, [profile?.id, userId]);

  const handleAddAndReplace = async (stock: DiscoveredStock) => {
    const uid = getEffectiveUserId();
    try {
      // 1. Get user watchlists (or auto-create default if none exist)
      let targetListId: number | null = null;
      const wRes = await fetch(`${API}/api/v1/watchlists?user_id=${uid}`);
      if (wRes.ok) {
        const lists = await wRes.json();
        if (lists && lists.length > 0) {
          targetListId = lists[0].id;
        } else {
          // Auto-create default watchlist for new user
          const createRes = await fetch(`${API}/api/v1/watchlists?user_id=${uid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Primary Wishlist", description: "Default AI Wishlist" }),
          });
          if (createRes.ok) {
            const newList = await createRes.json();
            targetListId = newList.id;
          }
        }
      }

      if (targetListId) {
        const addRes = await fetch(`${API}/api/v1/watchlists/${targetListId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: stock.symbol.toUpperCase(),
            target_buy_price: stock.current_price,
            target_sell_price: stock.horizon_target || null,
            notes: `Added from AI Discovery Telecast (${stock.action})`,
          }),
        });

        if (addRes.ok) {
          setToastMessage(`✓ Added ${stock.symbol} to Wishlist! Auto-replacing candidate...`);
          setTimeout(() => setToastMessage(null), 3000);

          // Close pop-up if currently opened for this stock
          if (selectedStock?.symbol === stock.symbol) {
            setSelectedStock(null);
          }

          // Trigger instant refresh to exclude added stock and pull next untouched candidate
          loadDiscoveryData(true);
        }
      }
    } catch {
      setToastMessage("Failed to add stock to wishlist");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Curate Top 6 Market-Wide Picks for the "All 6 Strategies" tab (sorted strictly by highest percentage)
  const topOverallStocks: DiscoveredStock[] = (() => {
    const rawList: DiscoveredStock[] =
      data?.top_overall_stocks && data.top_overall_stocks.length > 0
        ? data.top_overall_stocks
        : (() => {
            const all: DiscoveredStock[] = [];
            const seen = new Set<string>();
            data?.sections.forEach((sec) => {
              sec.stocks.forEach((st) => {
                if (!seen.has(st.symbol)) {
                  seen.add(st.symbol);
                  all.push({
                    ...st,
                    strategy_title: st.strategy_title || sec.title,
                    strategy_icon: st.strategy_icon || sec.icon,
                    strategy_badge: st.strategy_badge || sec.badge,
                    strategy_color: st.strategy_color || sec.color,
                    horizon_label: st.horizon_label || sec.horizon_label,
                  });
                }
              });
            });
            return all;
          })();

    return [...rawList]
      .sort((a, b) =>
        b.conviction_pct !== a.conviction_pct
          ? b.conviction_pct - a.conviction_pct
          : b.horizon_upside_pct - a.horizon_upside_pct
      )
      .slice(0, 6);
  })();

  const topDayStocks: DiscoveredStock[] =
    data?.top_day_stocks && data.top_day_stocks.length > 0 ? data.top_day_stocks : topOverallStocks;

  const topWeekStocks: DiscoveredStock[] =
    data?.top_week_stocks && data.top_week_stocks.length > 0 ? data.top_week_stocks : topOverallStocks;

  const rawActiveSection = data?.sections.find((s) => s.strategy_id === activeStrategyTab);
  const activeSection = rawActiveSection
    ? {
        ...rawActiveSection,
        stocks: [...rawActiveSection.stocks].sort((a, b) =>
          b.conviction_pct !== a.conviction_pct
            ? b.conviction_pct - a.conviction_pct
            : b.horizon_upside_pct - a.horizon_upside_pct
        ),
      }
    : null;

  return (
    <div className="min-h-screen bg-bg-primary text-txt-primary">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-500/90 text-black font-bold px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md animate-fade-in text-xs flex items-center gap-2">
          <span>⚡</span> {toastMessage}
        </div>
      )}

      {/* Main Full-Width Container */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Header Bar */}
        <div className="pb-4 border-b border-border/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_#38bdf8] animate-pulse" />
                <h1 className="text-xl sm:text-2xl font-black tracking-tight ultra-white glow-cyan-title">
                  Autonomous AI Stock Discovery & Price Telecasting
                </h1>
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 glow-cyan-badge font-mono uppercase">
                  5-Horizon Forecast
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-3xl">
                Evaluates multi-cap Indian equities on 25 quantitative parameters. Strictly untouched opportunities — automatically excludes your portfolio holdings & wishlists, with real-time candidate replacement.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {data?.excluded_count !== undefined && (
                <span className="text-[11px] text-cyan-300 bg-bg-card px-3 py-1.5 rounded-lg border border-slate-700 hidden sm:inline-flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span>{data.excluded_count} stocks excluded (Portfolio/Wishlist)</span>
                </span>
              )}
              <span className="text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>Multi-Horizon Quant Engine Active</span>
              </span>
            </div>
          </div>
          <div className="h-[2px] w-full glow-headline-bar mt-3 rounded-full" />
        </div>

        {/* View Switcher / Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
          {/* Main Mode Toggle: Current Active Telecast vs Historical Setups Archive */}
          <div className="flex items-center gap-1.5 p-1 bg-bg-card rounded-xl border border-slate-700 w-fit">
            <button
              onClick={() => setViewMode("LIVE_DISCOVERY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "LIVE_DISCOVERY"
                  ? "bg-cyan-500 text-black shadow-md"
                  : "text-txt-muted hover:text-white"
              }`}
            >
              <span>⚡</span> Current Active Telecast
            </button>
            <button
              onClick={() => { setViewMode("HISTORY_VAULT"); loadVaultData(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "HISTORY_VAULT"
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30"
                  : "text-txt-muted hover:text-white"
              }`}
            >
              <span>🏛️</span> Saved AI Setups / History Vault ({scanRuns.length} Runs)
            </button>
          </div>

          {/* Rotating 500-Batch Trigger */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleScanNextBatch}
              disabled={scanningBatch}
              title="Screens next 500 equities (Rotating across 10 non-overlapping batches covering 5,000 listed stocks) and archives top winners"
              className="px-3.5 py-1.5 bg-bg-card hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <span className={scanningBatch ? "animate-spin text-cyan-400" : "text-cyan-400"}>🔄</span>
              <span>{scanningBatch ? "Screening 500 Stocks..." : "Scan Next 500 Batch"}</span>
            </button>
          </div>
        </div>

        {viewMode === "LIVE_DISCOVERY" ? (
          <>
            {/* View Switcher / Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setActiveStrategyTab("all")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeStrategyTab === "all"
                    ? "bg-white text-black shadow-md"
                    : "bg-bg-card text-txt-muted hover:text-white border border-border/50"
                }`}
              >
                All Ranked AI Setups
              </button>
              <button
                onClick={() => setActiveStrategyTab("top_day")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeStrategyTab === "top_day"
                    ? "bg-cyan-500 text-black shadow-md"
                    : "bg-bg-card text-cyan-300 hover:text-white border border-cyan-500/40"
                }`}
              >
                <span>⚡</span>
                <span>Top 6 of the Day</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/20 font-black">
                  {topDayStocks.length}
                </span>
              </button>
              <button
                onClick={() => setActiveStrategyTab("top_week")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeStrategyTab === "top_week"
                    ? "bg-indigo-500 text-white shadow-md"
                    : "bg-bg-card text-indigo-300 hover:text-white border border-indigo-500/40"
                }`}
              >
                <span>🌟</span>
                <span>Top 6 of the Week</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-black/20 font-black">
                  {topWeekStocks.length}
                </span>
              </button>
              {data?.sections.map((s) => (
                <button
                  key={s.strategy_id}
                  onClick={() => setActiveStrategyTab(s.strategy_id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeStrategyTab === s.strategy_id
                      ? "bg-bg-card text-white border border-accent/60 shadow-sm"
                      : "bg-bg-primary text-txt-muted hover:text-white border border-border/40"
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.title}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono opacity-80" style={{ backgroundColor: `${s.color}25`, color: s.color }}>
                    {s.badge}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* MULTI-RUN HISTORY VAULT WITH INDIVIDUAL EXECUTION BLOCKS */
          <HistoryVault
            scanRuns={scanRuns}
            expandedRunId={expandedRunId}
            setExpandedRunId={setExpandedRunId}
            loadingVault={loadingVault}
            deletingRunId={deletingRunId}
            handleDeleteBatchRun={handleDeleteBatchRun}
            setModalStock={setModalStock}
            fmt={fmt}
          />
        )}

        {/* Main Content Area */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 py-12">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-bg-card/40 animate-pulse border border-border/40" />
            ))}
          </div>
        ) : activeStrategyTab === "all" ? (
          <div className="space-y-8">
            {/* BOUNDARY 1: TOP 6 SETUPS OF THE DAY */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-card p-4 rounded-2xl border border-cyan-500/40 glow-card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 text-base">⚡</span>
                    <h2 className="text-base sm:text-lg font-black ultra-white glow-title tracking-tight">
                      Top 6 Setups of the Day (Latest 1,500 Multi-Run Screen)
                    </h2>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 glow-cyan-badge">
                      Today&apos;s Champions
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mt-1">
                    The highest scoring setups discovered across today&apos;s active 500-equity batch executions, automatically populated with live CMP &amp; updated targets.
                  </p>
                </div>
                <div className="text-[11px] text-cyan-300/90 font-mono bg-bg-input px-3 py-1.5 rounded-lg border border-slate-700/70">
                  ⚡ {topDayStocks.length} Day Finalists
                </div>
              </div>

              {/* Grid of Day Setups */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topDayStocks.map((stock, idx) => (
                  <div
                    key={`day-${stock.symbol}-${idx}`}
                    onClick={() => setSelectedStock(stock)}
                    className="bg-bg-card glow-card rounded-2xl p-4.5 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden border border-cyan-500/20 hover:border-cyan-400/60"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_8px_rgba(56,189,248,0.25)]">
                            #{idx + 1}
                          </span>
                          <span className="font-black text-base ultra-white group-hover:text-cyan-300 font-mono transition-colors">
                            {stock.symbol}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-medium">
                            {stock.cap_category}
                          </span>
                        </div>
                        <div className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          <span>{stock.action}</span>
                          <span className="font-mono text-[9px] opacity-90">{stock.conviction_pct}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium mb-3">
                        <span className="truncate pr-2">{stock.name}</span>
                        <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                          <span>⚡</span> {stock.sector}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-bg-hover/80 border border-slate-700/60 text-center mb-3">
                        <div>
                          <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider font-mono">CMP</span>
                          <strong className="text-xs font-mono font-black ultra-white">₹{fmt(stock.current_price)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-emerald-300 font-bold block uppercase tracking-wider font-mono">
                            {stock.horizon_label || "Target"}
                          </span>
                          <strong className="text-xs font-mono font-black text-emerald-400">₹{fmt(stock.horizon_target)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-cyan-300 font-bold block uppercase tracking-wider font-mono">Upside</span>
                          <span className="text-xs font-black font-mono text-cyan-300">+{stock.horizon_upside_pct}%</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-100 font-medium line-clamp-2 leading-relaxed bg-bg-input p-2 rounded-lg border-l-4 border-l-cyan-400 border border-slate-700/60 mb-2">
                        <strong className="text-cyan-300 uppercase tracking-wide text-[10px] mr-1">AI Catalyst:</strong>
                        {stock.catalyst_summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-700/70 pt-3 mt-1 text-xs">
                      <span className="text-[10px] font-mono text-slate-300 flex items-center gap-1 font-medium">
                        <span>Risk/Reward:</span>
                        <strong className="text-emerald-400 font-bold">{stock.risk_reward_ratio || "1:3.5"}</strong>
                      </span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleAddAndReplace(stock)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-bg-hover hover:bg-cyan-500/20 text-slate-200 hover:text-white border border-slate-700 font-bold transition-colors cursor-pointer"
                        >
                          + Wishlist
                        </button>
                        <button
                          onClick={() => setSelectedStock(stock)}
                          className="px-3.5 py-1 text-[11px] rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-black shadow-[0_0_10px_rgba(56,189,248,0.3)] transition-colors cursor-pointer"
                        >
                          Telecast ↗
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BOUNDARY 2: TOP 6 SETUPS OF THE WEEK */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-card p-4 rounded-2xl border border-indigo-500/40 glow-card relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-300 text-base">🌟</span>
                    <h2 className="text-base sm:text-lg font-black ultra-white glow-title tracking-tight">
                      Top 6 Multi-Run Champions of the Week (5,000 Equity Universe Audit)
                    </h2>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/50 glow-cyan-badge">
                      Week&apos;s Champions
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mt-1">
                    Peak institutional conviction across all multi-run audits evaluated this week, arrangement strictly highest to lowest conviction.
                  </p>
                </div>
                <div className="text-[11px] text-indigo-300/90 font-mono bg-bg-input px-3 py-1.5 rounded-lg border border-slate-700/70">
                  🌟 {topWeekStocks.length} Week Finalists
                </div>
              </div>

              {/* Grid of Week Setups */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topWeekStocks.map((stock, idx) => (
                  <div
                    key={`week-${stock.symbol}-${idx}`}
                    onClick={() => setSelectedStock(stock)}
                    className="bg-bg-card glow-card rounded-2xl p-4.5 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden border border-indigo-500/20 hover:border-indigo-400/60"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/50 shadow-[0_0_8px_rgba(99,102,241,0.25)]">
                            #{idx + 1}
                          </span>
                          <span className="font-black text-base ultra-white group-hover:text-indigo-300 font-mono transition-colors">
                            {stock.symbol}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-medium">
                            {stock.cap_category}
                          </span>
                        </div>
                        <div className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          <span>{stock.action}</span>
                          <span className="font-mono text-[9px] opacity-90">{stock.conviction_pct}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium mb-3">
                        <span className="truncate pr-2">{stock.name}</span>
                        <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                          <span>🌟</span> {stock.sector}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-bg-hover/80 border border-slate-700/60 text-center mb-3">
                        <div>
                          <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider font-mono">CMP</span>
                          <strong className="text-xs font-mono font-black ultra-white">₹{fmt(stock.current_price)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-emerald-300 font-bold block uppercase tracking-wider font-mono">
                            {stock.horizon_label || "Target"}
                          </span>
                          <strong className="text-xs font-mono font-black text-emerald-400">₹{fmt(stock.horizon_target)}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-cyan-300 font-bold block uppercase tracking-wider font-mono">Upside</span>
                          <span className="text-xs font-black font-mono text-cyan-300">+{stock.horizon_upside_pct}%</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-100 font-medium line-clamp-2 leading-relaxed bg-bg-input p-2 rounded-lg border-l-4 border-l-indigo-400 border border-slate-700/60 mb-2">
                        <strong className="text-indigo-300 uppercase tracking-wide text-[10px] mr-1">AI Catalyst:</strong>
                        {stock.catalyst_summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-700/70 pt-3 mt-1 text-xs">
                      <span className="text-[10px] font-mono text-slate-300 flex items-center gap-1 font-medium">
                        <span>Risk/Reward:</span>
                        <strong className="text-emerald-400 font-bold">{stock.risk_reward_ratio || "1:3.5"}</strong>
                      </span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleAddAndReplace(stock)}
                          className="px-2.5 py-1 text-[11px] rounded-lg bg-bg-hover hover:bg-cyan-500/20 text-slate-200 hover:text-white border border-slate-700 font-bold transition-colors cursor-pointer"
                        >
                          + Wishlist
                        </button>
                        <button
                          onClick={() => setSelectedStock(stock)}
                          className="px-3.5 py-1 text-[11px] rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-black shadow-[0_0_10px_rgba(99,102,241,0.3)] transition-colors cursor-pointer"
                        >
                          Telecast ↗
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeStrategyTab === "top_day" ? (
          /* TAB: TOP 6 OF THE DAY */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-card p-4 rounded-2xl border border-cyan-500/40 glow-card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-300 text-base">⚡</span>
                  <h2 className="text-base sm:text-lg font-black ultra-white glow-title tracking-tight">
                    Top 6 Setups of the Day (Latest 1,500 Multi-Run Screen)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 glow-cyan-badge">
                    Today&apos;s Champions
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  The highest scoring setups discovered across today&apos;s active 500-equity batch executions, automatically populated with live CMP &amp; updated targets.
                </p>
              </div>
              <div className="text-[11px] text-cyan-300/90 font-mono bg-bg-input px-3 py-1.5 rounded-lg border border-slate-700/70">
                ⚡ {topDayStocks.length} Day Finalists
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topDayStocks.map((stock, idx) => (
                <div
                  key={`day-only-${stock.symbol}-${idx}`}
                  onClick={() => setSelectedStock(stock)}
                  className="bg-bg-card glow-card rounded-2xl p-4.5 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden border border-cyan-500/20 hover:border-cyan-400/60"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_8px_rgba(56,189,248,0.25)]">
                          #{idx + 1}
                        </span>
                        <span className="font-black text-base ultra-white group-hover:text-cyan-300 font-mono transition-colors">
                          {stock.symbol}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-medium">
                          {stock.cap_category}
                        </span>
                      </div>
                      <div className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        <span>{stock.action}</span>
                        <span className="font-mono text-[9px] opacity-90">{stock.conviction_pct}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium mb-3">
                      <span className="truncate pr-2">{stock.name}</span>
                      <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                        <span>⚡</span> {stock.sector}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-bg-hover/80 border border-slate-700/60 text-center mb-3">
                      <div>
                        <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider font-mono">CMP</span>
                        <strong className="text-xs font-mono font-black ultra-white">₹{fmt(stock.current_price)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-300 font-bold block uppercase tracking-wider font-mono">
                          {stock.horizon_label || "Target"}
                        </span>
                        <strong className="text-xs font-mono font-black text-emerald-400">₹{fmt(stock.horizon_target)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-cyan-300 font-bold block uppercase tracking-wider font-mono">Upside</span>
                        <span className="text-xs font-black font-mono text-cyan-300">+{stock.horizon_upside_pct}%</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-100 font-medium line-clamp-2 leading-relaxed bg-bg-input p-2 rounded-lg border-l-4 border-l-cyan-400 border border-slate-700/60 mb-2">
                      <strong className="text-cyan-300 uppercase tracking-wide text-[10px] mr-1">AI Catalyst:</strong>
                      {stock.catalyst_summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-700/70 pt-3 mt-1 text-xs">
                    <span className="text-[10px] font-mono text-slate-300 flex items-center gap-1 font-medium">
                      <span>Risk/Reward:</span>
                      <strong className="text-emerald-400 font-bold">{stock.risk_reward_ratio || "1:3.5"}</strong>
                    </span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleAddAndReplace(stock)}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-bg-hover hover:bg-cyan-500/20 text-slate-200 hover:text-white border border-slate-700 font-bold transition-colors cursor-pointer"
                      >
                        + Wishlist
                      </button>
                      <button
                        onClick={() => setSelectedStock(stock)}
                        className="px-3.5 py-1 text-[11px] rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-black shadow-[0_0_10px_rgba(56,189,248,0.3)] transition-colors cursor-pointer"
                      >
                        Telecast ↗
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeStrategyTab === "top_week" ? (
          /* TAB: TOP 6 OF THE WEEK */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-card p-4 rounded-2xl border border-indigo-500/40 glow-card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-indigo-300 text-base">🌟</span>
                  <h2 className="text-base sm:text-lg font-black ultra-white glow-title tracking-tight">
                    Top 6 Multi-Run Champions of the Week (5,000 Equity Universe Audit)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/50 glow-cyan-badge">
                    Week&apos;s Champions
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  Peak institutional conviction across all multi-run audits evaluated this week, arrangement strictly highest to lowest conviction.
                </p>
              </div>
              <div className="text-[11px] text-indigo-300/90 font-mono bg-bg-input px-3 py-1.5 rounded-lg border border-slate-700/70">
                🌟 {topWeekStocks.length} Week Finalists
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topWeekStocks.map((stock, idx) => (
                <div
                  key={`week-only-${stock.symbol}-${idx}`}
                  onClick={() => setSelectedStock(stock)}
                  className="bg-bg-card glow-card rounded-2xl p-4.5 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden border border-indigo-500/20 hover:border-indigo-400/60"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/50 shadow-[0_0_8px_rgba(99,102,241,0.25)]">
                          #{idx + 1}
                        </span>
                        <span className="font-black text-base ultra-white group-hover:text-indigo-300 font-mono transition-colors">
                          {stock.symbol}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-medium">
                          {stock.cap_category}
                        </span>
                      </div>
                      <div className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                        <span>{stock.action}</span>
                        <span className="font-mono text-[9px] opacity-90">{stock.conviction_pct}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium mb-3">
                      <span className="truncate pr-2">{stock.name}</span>
                      <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                        <span>🌟</span> {stock.sector}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-bg-hover/80 border border-slate-700/60 text-center mb-3">
                      <div>
                        <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider font-mono">CMP</span>
                        <strong className="text-xs font-mono font-black ultra-white">₹{fmt(stock.current_price)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-300 font-bold block uppercase tracking-wider font-mono">
                          {stock.horizon_label || "Target"}
                        </span>
                        <strong className="text-xs font-mono font-black text-emerald-400">₹{fmt(stock.horizon_target)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-cyan-300 font-bold block uppercase tracking-wider font-mono">Upside</span>
                        <span className="text-xs font-black font-mono text-cyan-300">+{stock.horizon_upside_pct}%</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-100 font-medium line-clamp-2 leading-relaxed bg-bg-input p-2 rounded-lg border-l-4 border-l-indigo-400 border border-slate-700/60 mb-2">
                      <strong className="text-indigo-300 uppercase tracking-wide text-[10px] mr-1">AI Catalyst:</strong>
                      {stock.catalyst_summary}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-700/70 pt-3 mt-1 text-xs">
                    <span className="text-[10px] font-mono text-slate-300 flex items-center gap-1 font-medium">
                      <span>Risk/Reward:</span>
                      <strong className="text-emerald-400 font-bold">{stock.risk_reward_ratio || "1:3.5"}</strong>
                    </span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleAddAndReplace(stock)}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-bg-hover hover:bg-cyan-500/20 text-slate-200 hover:text-white border border-slate-700 font-bold transition-colors cursor-pointer"
                      >
                        + Wishlist
                      </button>
                      <button
                        onClick={() => setSelectedStock(stock)}
                        className="px-3.5 py-1 text-[11px] rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-black shadow-[0_0_10px_rgba(99,102,241,0.3)] transition-colors cursor-pointer"
                      >
                        Telecast ↗
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeSection ? (
          /* INDIVIDUAL STRATEGY TAB (5 TO 6 STOCKS SORTED DESCENDING BY UPSIDE %) */
          <div className="space-y-4">
            {/* Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-bg-card p-4 rounded-2xl border border-slate-700/80 glow-card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">{activeSection.icon}</span>
                  <h2 className="text-base sm:text-lg font-black ultra-white glow-title tracking-tight">
                    {activeSection.title}
                  </h2>
                  <span
                    className="px-2.5 py-0.5 rounded text-[10px] font-black font-mono uppercase glow-cyan-badge"
                    style={{ backgroundColor: `${activeSection.color}25`, color: activeSection.color, border: `1px solid ${activeSection.color}55` }}
                  >
                    {activeSection.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium italic mt-1 max-w-2xl">
                  {activeSection.tagline}
                </p>
              </div>
              <div className="text-[11px] text-cyan-300 font-mono bg-bg-input px-3 py-1.5 rounded-lg border border-slate-700">
                {activeSection.stocks.length} Untouched Candidates (Highest % First)
              </div>
            </div>

            {/* Stock Cards Grid (5 to 6 suggestions) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSection.stocks.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => setSelectedStock(stock)}
                  className="bg-bg-card glow-card rounded-2xl p-4.5 transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Ambient Top Dual Glow Bar */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />

                  {/* Top Bar: Rank, Symbol, Sector, Cap */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded bg-bg-hover text-cyan-300 border border-slate-700">
                          #{stock.rank}
                        </span>
                        <span className="font-black text-base ultra-white group-hover:text-cyan-300 font-mono transition-colors">
                          {stock.symbol}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-medium">
                          {stock.cap_category}
                        </span>
                      </div>

                      <div
                        className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 glow-cyan-badge"
                        style={{
                          backgroundColor: `${activeSection.color}25`,
                          color: activeSection.color,
                          border: `1px solid ${activeSection.color}66`,
                        }}
                      >
                        <span>{stock.action}</span>
                        <span className="font-mono text-[9px] opacity-90">{stock.conviction_pct}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium mb-3">
                      <span className="truncate pr-2">{stock.name}</span>
                      <span className="text-[10px] font-mono text-cyan-300 shrink-0 bg-bg-input px-1.5 py-0.5 rounded border border-slate-700/60">
                        {stock.sector}
                      </span>
                    </div>

                    {/* Price & Target Milestones */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-bg-hover/80 border border-slate-700/60 text-center mb-3">
                      <div>
                        <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider font-mono">CMP</span>
                        <strong className="text-xs font-mono font-black ultra-white">₹{fmt(stock.current_price)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-300 font-bold block uppercase tracking-wider font-mono">
                          {activeSection.horizon_label}
                        </span>
                        <strong className="text-xs font-mono font-black text-emerald-400">₹{fmt(stock.horizon_target)}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-cyan-300 font-bold block uppercase tracking-wider font-mono">Upside</span>
                        <span className="text-xs font-black font-mono text-cyan-300">+{stock.horizon_upside_pct}%</span>
                      </div>
                    </div>

                    {/* 3-Pillar Institutional Breakdown Badge with Explicit Sum */}
                    <div className="flex items-center justify-between text-[10px] font-mono px-2.5 py-1.5 rounded-lg bg-bg-hover/60 border border-slate-700/60 mb-2.5">
                      <span className="text-slate-400 font-medium">Final Score:</span>
                      <span className="text-cyan-300 font-bold">M:{Math.round(stock.phase_a_score ?? 32)}</span>
                      <span className="text-slate-600">+</span>
                      <span className="text-emerald-400 font-bold">F:{Math.round(stock.phase_b_score ?? 31)}</span>
                      <span className="text-slate-600">+</span>
                      <span className="text-indigo-300 font-bold">AI:{Math.round(stock.phase_c_score ?? 28)}</span>
                      <span className="text-slate-600">=</span>
                      <span className="text-white font-bold">{stock.conviction_pct}</span>
                    </div>

                    {/* Catalyst Teaser */}
                    <p className="text-[11px] text-slate-100 font-medium line-clamp-2 leading-relaxed bg-bg-input p-2 rounded-lg border-l-4 border-l-indigo-400 border border-slate-700/60 mb-2">
                      <strong className="text-indigo-300 uppercase tracking-wide text-[10px] mr-1">AI Catalyst:</strong>
                      {stock.catalyst_summary}
                    </p>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between border-t border-slate-700/70 pt-3 mt-1 text-xs">
                    <span className="text-[10px] font-mono text-slate-300 flex items-center gap-1 font-medium">
                      <span>Risk/Reward:</span>
                      <strong className="text-emerald-400 font-bold">{stock.risk_reward_ratio}</strong>
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleAddAndReplace(stock)}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-bg-hover hover:bg-cyan-500/20 text-slate-200 hover:text-white border border-slate-700 font-bold transition-colors cursor-pointer"
                      >
                        + Wishlist
                      </button>
                      <button
                        onClick={() => setSelectedStock(stock)}
                        className="px-3.5 py-1 text-[11px] rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-black shadow-[0_0_10px_rgba(56,189,248,0.3)] transition-colors cursor-pointer"
                      >
                        Telecast ↗
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ============================================================== */}
      {/* UNIFIED IN-PAGE TELECAST POP-UP MODAL                          */}
      {/* ============================================================== */}
      {selectedStock && (
        <StockTelecastModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onAddToWishlist={handleAddAndReplace}
          onOpenChart={(sym) => {
            setSelectedStock(null);
            setModalStock(sym);
          }}
          fmt={fmt}
        />
      )}

      {/* Stock Detail Candlestick Modal */}
      {modalStock && <StockModal symbol={modalStock} onClose={() => setModalStock(null)} />}
    </div>
  );
}
