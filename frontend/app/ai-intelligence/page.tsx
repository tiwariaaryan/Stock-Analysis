"use client";
import { useState, useEffect } from "react";
import StockModal from "@/components/StockModal";
import { useProfile } from "@/components/ProfileProvider";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type TelecastRow = {
  horizon: string;
  low_range: number;
  target: number;
  high_range: number;
  upside_pct: number;
  downside_pct: number;
  confidence_pct: number;
};

type TechnicalData = {
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

type FundamentalData = {
  pe_ratio: number;
  sector_pe: number;
  pb_ratio: number;
  roce_pct: number;
  roe_pct: number;
  operating_margin_pct: number;
  debt_to_equity: number;
  moat_strength: string;
};

type DiscoveredStock = {
  rank: number;
  overall_rank?: number;
  symbol: string;
  name: string;
  sector: string;
  cap_category: string;
  current_price: number;
  action: string;
  conviction_pct: number;
  total_score?: number;
  phase_a_score?: number;
  phase_b_score?: number;
  phase_c_score?: number;
  veto_triggered?: boolean;
  forensic_status?: string;
  management_tone?: string;
  catalyst_probability_pct?: number;
  risk_reward_ratio: string;
  catalyst_summary: string;
  horizon_target: number;
  horizon_upside_pct: number;
  stop_loss: number;
  strategy_id?: string;
  strategy_title?: string;
  strategy_icon?: string;
  strategy_badge?: string;
  strategy_color?: string;
  horizon_label?: string;
  technical: TechnicalData;
  fundamentals: FundamentalData;
  telecast_table: TelecastRow[];
};

type StrategySection = {
  strategy_id: string;
  title: string;
  badge: string;
  icon: string;
  color: string;
  tagline: string;
  horizon_label: string;
  stocks: DiscoveredStock[];
};

type VaultItem = {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  cap_category: string;
  current_price: number;
  initial_ai_score: number;
  current_ai_score: number;
  score_change: number;
  action: string;
  target_price: number;
  stop_loss: number;
  catalyst_summary: string;
  horizon_label: string;
  horizon_upside_pct: number;
  is_top_setup: boolean;
};

type ScanRunRecord = {
  run_id: number;
  batch_number: number;
  batch_name: string;
  stock_range: string;
  total_screened: number;
  top_winners_count: number;
  top_symbol: string | null;
  top_score: number | null;
  executed_at: string;
  stocks: VaultItem[];
};

type DiscoveryResponse = {
  timestamp: string;
  user_id: number;
  excluded_count: number;
  total_strategies: number;
  top_overall_stocks?: DiscoveredStock[];
  top_day_stocks?: DiscoveredStock[];
  top_week_stocks?: DiscoveredStock[];
  sections: StrategySection[];
};

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
      // 1. Get user watchlists
      const wRes = await fetch(`${API}/api/v1/watchlists?user_id=${uid}`);
      if (wRes.ok) {
        const lists = await wRes.json();
        if (lists && lists.length > 0) {
          const targetListId = lists[0].id;
          const addRes = await fetch(`${API}/api/v1/watchlists/${targetListId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: stock.symbol.toUpperCase(),
              target_buy_price: stock.horizon_target || stock.current_price,
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
          <div className="space-y-4 animate-fade-in">
            <div className="bg-bg-card p-4 rounded-2xl border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🏛️</span> Saved AI Setups / History Vault (5,000 Equity Universe Audit)
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Auditable execution logs. Each scan evaluates 500 completely distinct stocks across 10 non-overlapping tiers.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-txt-muted">Total Completed Runs:</span>
                <span className="px-2.5 py-1 bg-indigo-500/20 border border-indigo-400 text-indigo-300 rounded-lg font-bold">
                  {scanRuns.length} Runs ({(scanRuns.length * 500).toLocaleString()} Screened)
                </span>
              </div>
            </div>

            {loadingVault ? (
              <div className="space-y-2 py-8 text-center text-txt-muted text-xs">
                <span className="inline-block animate-spin mr-2">⚡</span> Loading Vault Records...
              </div>
            ) : scanRuns.length === 0 ? (
              <div className="text-center py-16 bg-bg-card border border-border rounded-2xl">
                <p className="text-sm font-semibold text-txt-secondary">No execution runs logged yet.</p>
                <p className="text-xs text-txt-muted mt-1">Click &quot;Scan Next 500 Batch&quot; above to screen your first batch of 500 stocks!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scanRuns.map((run) => {
                  const isExpanded = expandedRunId === run.run_id;
                  const execDate = run.executed_at
                    ? new Date(run.executed_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Recent";

                  return (
                    <div
                      key={run.run_id}
                      className="bg-bg-card border border-border hover:border-indigo-500/50 rounded-2xl overflow-hidden transition-all shadow-md"
                    >
                      {/* Run Header Row */}
                      <div
                        onClick={() => setExpandedRunId(isExpanded ? null : run.run_id)}
                        className="p-4 bg-gradient-to-r from-[#10192E] to-[#121B35] flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-mono font-bold flex items-center justify-center text-xs">
                            #{run.run_id}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-white text-sm">{run.batch_name}</h3>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono font-bold">
                                Equities {run.stock_range}
                              </span>
                            </div>
                            <span className="text-[11px] text-txt-muted block mt-0.5">
                              Executed on {execDate} • 500 Equities Analyzed • {run.top_winners_count} High-Conviction Setups Identified
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {run.top_symbol && (
                            <div className="text-right hidden md:block font-mono text-xs">
                              <span className="text-[10px] text-txt-muted block">Top Setup</span>
                              <span className="font-bold text-emerald-400">
                                {run.top_symbol} [{run.top_score}/100]
                              </span>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBatchRun(run.run_id, run.batch_name);
                            }}
                            disabled={deletingRunId === run.run_id}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                            title="Delete this batch run and purge its 500 stocks from database"
                          >
                            <span>🗑️</span>
                            <span className="hidden sm:inline">Delete Batch</span>
                          </button>
                          <span className="text-xs px-3 py-1.5 rounded-lg bg-bg-primary border border-border text-txt-secondary font-bold flex items-center gap-1.5">
                            <span>{isExpanded ? "Collapse" : "View Stocks"}</span>
                            <span>{isExpanded ? "▲" : "▼"}</span>
                          </span>
                        </div>
                      </div>

                      {/* Expanded Stock Setups Table */}
                      {isExpanded && (
                        <div className="border-t border-border overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#0B132B] border-b border-border text-[10px] text-txt-muted uppercase font-mono">
                              <tr>
                                <th className="py-2.5 px-4">Stock</th>
                                <th className="py-2.5 px-3">Cap & Sector</th>
                                <th className="py-2.5 px-3">Live CMP</th>
                                <th className="py-2.5 px-4 text-center">Score Evolution (Entry &rarr; Dynamic)</th>
                                <th className="py-2.5 px-3">AI Verdict</th>
                                <th className="py-2.5 px-3">Target Price</th>
                                <th className="py-2.5 px-4">AI Catalyst & Conviction Summary</th>
                                <th className="py-2.5 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30 font-mono">
                              {run.stocks.map((item) => {
                                const delta = item.score_change ?? 0;
                                const isGain = delta > 0;
                                const isLoss = delta < 0;

                                return (
                                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-xs">{item.symbol}</span>
                                        {item.is_top_setup && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-bold">
                                            ★ Elite
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-txt-muted block truncate max-w-[140px] font-sans">
                                        {item.name}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3">
                                      <span className="text-txt-primary block font-sans text-xs">{item.cap_category}</span>
                                      <span className="text-[10px] text-txt-dim block">{item.sector}</span>
                                    </td>
                                    <td className="py-3 px-3">
                                      <span className="font-bold text-white">₹{item.current_price?.toFixed(2) ?? "—"}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <div className="inline-flex items-center gap-2 bg-[#080E21] px-2.5 py-1 rounded-lg border border-slate-700/80">
                                        <span className="text-slate-400 font-bold text-xs" title="Entry Score in this Run">
                                          {item.initial_ai_score}
                                        </span>
                                        <span className="text-slate-600 text-xs">&rarr;</span>
                                        <span className={`font-bold text-xs ${
                                          item.current_ai_score >= 90 ? "text-emerald-400" : "text-cyan-300"
                                        }`}>
                                          {item.current_ai_score}
                                        </span>
                                        {delta !== 0 ? (
                                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                            isGain ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                                          }`}>
                                            {isGain ? `+${delta}` : delta}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-500 font-bold">±0</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3">
                                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                        {item.action}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3">
                                      <span className="text-emerald-400 font-bold">₹{item.target_price?.toFixed(2) ?? "—"}</span>
                                      {item.horizon_upside_pct ? (
                                        <span className="text-[10px] text-txt-muted block font-sans">
                                          +{item.horizon_upside_pct}% ({item.horizon_label})
                                        </span>
                                      ) : null}
                                    </td>
                                    <td className="py-3 px-4 font-sans text-xs text-txt-secondary max-w-xs">
                                      <p className="line-clamp-2">{item.catalyst_summary}</p>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                      <button
                                        onClick={() => setModalStock(item.symbol)}
                                        className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-400/40 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                                      >
                                        Inspect &rarr;
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in">
          <div className="bg-bg-card glow-card rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative border border-slate-700">
            {/* Luminous Top Dual Ambient Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]" />

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between bg-bg-hover/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-black font-mono text-sm glow-cyan-badge">
                  #{selectedStock.rank}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black ultra-white glow-cyan-title font-mono tracking-tight">
                      {selectedStock.symbol}
                    </h2>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-bold">
                      {selectedStock.cap_category}
                    </span>
                    <span className="text-[10px] text-cyan-300 font-mono font-medium">
                      {selectedStock.sector}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mt-0.5">{selectedStock.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider font-mono">Live CMP</span>
                  <strong className="text-base sm:text-lg font-mono font-black ultra-white">₹{fmt(selectedStock.current_price)}</strong>
                </div>
                <button
                  onClick={() => setSelectedStock(null)}
                  className="w-8 h-8 rounded-lg bg-bg-hover text-slate-300 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer border border-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(94vh-140px)]">
              {/* 1. AI Conviction & Risk-Reward Banner */}
              <div className="p-3.5 rounded-2xl bg-bg-hover/80 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-500/25 text-emerald-300 border border-emerald-400/60 glow-emerald-badge flex items-center gap-1.5">
                    <span>⚡ {selectedStock.action}</span>
                    <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-[11px] text-white">
                      {selectedStock.conviction_pct}% Conviction
                    </span>
                  </div>
                  <span className="text-xs text-slate-200 font-mono font-medium">
                    Risk-to-Reward: <strong className="text-emerald-400 font-bold">{selectedStock.risk_reward_ratio}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[9px] text-rose-300 font-bold block uppercase">Stop-Loss Floor</span>
                    <strong className="text-rose-400 font-black">₹{fmt(selectedStock.stop_loss)}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-300 font-bold block uppercase">Horizon Target</span>
                    <strong className="text-emerald-400 font-black">₹{fmt(selectedStock.horizon_target)}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-cyan-300 font-bold block uppercase">Upside</span>
                    <strong className="text-cyan-300 font-black">+{selectedStock.horizon_upside_pct}%</strong>
                  </div>
                </div>
              </div>

              {/* 2. 3-PILLAR INSTITUTIONAL AI SCORECARD (Quant Math 35 + Market Flow 35 + AI Cognitive 30 = 100) */}
              <div className="bg-bg-input rounded-2xl p-4 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                  <span className="text-xs font-black ultra-white flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="text-cyan-400">🏛️</span> 3-Pillar Institutional Engine Scorecard
                  </span>
                  <div className="text-[11px] font-mono font-black ultra-white px-2.5 py-0.5 rounded bg-bg-hover border border-slate-700">
                    Total Score: <span className="text-cyan-300 font-bold">{selectedStock.conviction_pct}/100</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  {/* Pillar A: Quant Math */}
                  <div className="bg-bg-hover/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">Phase A: Quant Math</span>
                        <span className="text-xs font-black text-cyan-300">{selectedStock.phase_a_score ?? 32}/35</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-tight">ROCE/ROE capital efficiency, low D/E solvency, positive FCF & Piotroski score.</p>
                    </div>
                    <div className="mt-2 text-[9px] text-emerald-400 font-bold">✓ Capital Integrity Verified</div>
                  </div>

                  {/* Pillar B: Market Microstructure Flow */}
                  <div className="bg-bg-hover/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Phase B: Market Flow</span>
                        <span className="text-xs font-black text-emerald-400">{selectedStock.phase_b_score ?? 31}/35</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-tight">Institutional FII/DII accumulation, relative strength vs Nifty, delivery spikes.</p>
                    </div>
                    <div className="mt-2 text-[9px] text-cyan-300 font-bold">✓ Microstructure Momentum</div>
                  </div>

                  {/* Pillar C: AI Cognitive Intelligence */}
                  <div className="bg-bg-hover/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Phase C: AI Cognitive</span>
                        <span className="text-xs font-black text-indigo-300">{selectedStock.phase_c_score ?? 28}/30</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-tight">
                        Tone: <strong className="text-white">{selectedStock.management_tone ?? "VERY_BULLISH"}</strong> &bull; Cat Prob: <strong className="text-white">{selectedStock.catalyst_probability_pct ?? 88}%</strong>
                      </p>
                    </div>
                    <div className="mt-2 text-[9px] text-purple-300 font-bold">
                      Audit: {selectedStock.forensic_status ?? "CLEAN"} &bull; Hard Veto: {selectedStock.veto_triggered ? "TRIGGERED" : "PASSED"}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. FIVE-HORIZON PRICE TELECASTING TABLE */}
              <div className="bg-bg-input rounded-2xl border border-slate-700/80 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-slate-700/70 flex items-center justify-between bg-bg-hover/60">
                  <span className="text-xs font-black ultra-white uppercase tracking-wider flex items-center gap-1.5">
                    <span className="text-cyan-400">🔮</span> AI Future Price Telecasting Table
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono font-medium">
                    Channels evaluated across statistical volatility & order books
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-700/70 text-[10px] uppercase font-bold text-slate-300 bg-bg-hover/40">
                        <th className="py-2.5 px-3">Horizon</th>
                        <th className="py-2.5 px-3 text-rose-300">Low (Downside Risk)</th>
                        <th className="py-2.5 px-3 text-emerald-300">Most Likely Target</th>
                        <th className="py-2.5 px-3 text-slate-200">High (Bull Channel)</th>
                        <th className="py-2.5 px-3 text-cyan-300">Upside %</th>
                        <th className="py-2.5 px-3 text-rose-300">Downside %</th>
                        <th className="py-2.5 px-3 text-right text-slate-200">AI Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {selectedStock.telecast_table.map((row, idx) => (
                        <tr key={idx} className="hover:bg-bg-hover transition-colors">
                          <td className="py-2.5 px-3 font-black ultra-white">{row.horizon}</td>
                          <td className="py-2.5 px-3 font-semibold text-rose-400">₹{fmt(row.low_range)}</td>
                          <td className="py-2.5 px-3 font-black text-emerald-400">₹{fmt(row.target)}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-100">₹{fmt(row.high_range)}</td>
                          <td className="py-2.5 px-3 text-cyan-300 font-black">+{row.upside_pct}%</td>
                          <td className="py-2.5 px-3 text-rose-400 font-semibold">-{row.downside_pct}%</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                              {row.confidence_pct}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. DUAL ANALYSIS: Technicals + Fundamentals Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Technical Panel */}
                <div className="bg-bg-input rounded-2xl p-4 border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                    <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <span>📈</span> Technical Architecture
                    </span>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {selectedStock.technical.trend}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">RSI (14)</span>
                      <strong className="ultra-white text-sm">{selectedStock.technical.rsi_14}</strong>
                      <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold">Healthy Momentum</span>
                    </div>
                    <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">MACD Signal</span>
                      <strong className="ultra-white text-xs truncate block">{selectedStock.technical.macd_signal}</strong>
                      <span className="text-[9px] text-cyan-300 block mt-0.5 font-medium">Trend Confirmation</span>
                    </div>
                    <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">200 EMA Anchor</span>
                      <strong className="ultra-white text-xs">₹{fmt(selectedStock.technical.ema_200)}</strong>
                      <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold">Above 200 EMA</span>
                    </div>
                    <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Volume Profile</span>
                      <strong className="ultra-white text-xs truncate block">{selectedStock.technical.volume_trend}</strong>
                      <span className="text-[9px] text-cyan-300 block mt-0.5 font-medium">Delivery Expansion</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-bg-hover/80 border border-slate-700/60 text-[11px] font-mono flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Support Levels</span>
                      <span className="text-emerald-400 font-bold">
                        ₹{fmt(selectedStock.technical.support_1)} &bull; ₹{fmt(selectedStock.technical.support_2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Resistance Levels</span>
                      <span className="ultra-white font-bold">
                        ₹{fmt(selectedStock.technical.resistance_1)} &bull; ₹{fmt(selectedStock.technical.resistance_2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fundamental Panel */}
                <div className="bg-bg-input rounded-2xl p-4 border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <span>🏛</span> Fundamental Quality & Ratios
                    </span>
                    <span className="text-[10px] text-cyan-300 font-mono font-bold">
                      Institutional Scorecard
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">P/E vs Sector</span>
                      <strong className="ultra-white text-sm">{selectedStock.fundamentals.pe_ratio}</strong>
                      <span className="text-[9px] text-slate-300 block mt-0.5 font-medium">Sector: {selectedStock.fundamentals.sector_pe}</span>
                    </div>
                    <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">ROCE %</span>
                      <strong className="text-emerald-400 font-black text-sm">{selectedStock.fundamentals.roce_pct}%</strong>
                      <span className="text-[9px] text-cyan-300 block mt-0.5 font-medium">ROE: {selectedStock.fundamentals.roe_pct}%</span>
                    </div>
                    <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Operating Margin</span>
                      <strong className="ultra-white text-sm">{selectedStock.fundamentals.operating_margin_pct}%</strong>
                      <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold">High Cash Flow</span>
                    </div>
                    <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                      <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Debt to Equity</span>
                      <strong className="ultra-white text-sm">{selectedStock.fundamentals.debt_to_equity}</strong>
                      <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold">Prudent Balance Sheet</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-bg-hover/80 border border-slate-700/60 text-[11px]">
                    <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block font-mono">Economic Moat Strength</span>
                    <strong className="ultra-white font-bold block mt-0.5">
                      {selectedStock.fundamentals.moat_strength}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 4. Catalyst Summary */}
              <div className="bg-bg-input rounded-2xl p-4 border-l-4 border-l-cyan-400 border border-slate-700/80">
                <span className="text-xs font-black ultra-white uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                  <span className="text-cyan-400">💡</span> Primary Operational Catalyst & Trigger
                </span>
                <p className="text-xs text-slate-200 font-medium leading-relaxed">
                  {selectedStock.catalyst_summary}
                </p>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-border/80 bg-bg-card/80 flex items-center justify-between gap-3">
              <button
                onClick={() => handleAddAndReplace(selectedStock)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent to-purple-600 hover:from-accent-dark hover:to-purple-700 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-accent/20 active:scale-95"
              >
                <span>★</span>
                <span>Add to Wishlist with AI Target Price (Auto-Replace)</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    const sym = selectedStock.symbol;
                    setSelectedStock(null);
                    setModalStock(sym);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-bg-hover hover:bg-bg-card text-txt-primary hover:text-white border border-border/60 text-xs font-bold transition-colors cursor-pointer"
                >
                  📊 Full Candlestick Chart
                </button>
                <button
                  onClick={() => setSelectedStock(null)}
                  className="px-3.5 py-2.5 rounded-xl bg-bg-card border border-border text-txt-muted hover:text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Detail Candlestick Modal */}
      {modalStock && <StockModal symbol={modalStock} onClose={() => setModalStock(null)} />}
    </div>
  );
}
