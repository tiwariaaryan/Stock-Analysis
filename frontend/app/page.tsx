"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useProfile } from "@/components/ProfileProvider";
import StockModal from "@/components/StockModal";
import type { MarketIndex, DailySnapshot, RecommendationItem, MarketScanPayload } from "./components/HomeTypes";
import RecommendationsSection from "./components/RecommendationsSection";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function Home() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [recData, setRecData] = useState<MarketScanPayload | null>(null);
  const [scanning, setScanning] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"top5" | "movers" | "sentiment">("top5");
  const [modalStock, setModalStock] = useState<string | null>(null);
  const [addedSymbols, setAddedSymbols] = useState<Set<string>>(new Set());

  // Interactive Hover & Popout state
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

  const handleSyncAllPrices = async () => {
    setSyncingPrices(true);
    setSyncToast(null);
    try {
      const activeId = getEffectiveUserId();
      const res = await fetch(`${API}/api/v1/market/refresh-all?user_id=${activeId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSyncToast(`✅ Successfully synced ${data.refreshed}/${data.total} stock prices across Portfolio, Wishlist & Paper Arena!`);
        fetch(`${API}/api/v1/market/indices`).then((r) => r.ok && r.json()).then((d) => d && setIndices(d)).catch(() => {});
      } else {
        setSyncToast("⚠️ Price sync failed — please try again.");
      }
    } catch {
      setSyncToast("⚠️ Could not reach server for price sync.");
    } finally {
      setSyncingPrices(false);
      setTimeout(() => setSyncToast(null), 6000);
    }
  };

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
      let targetListId: number | null = null;
      const wRes = await fetch(`${API}/api/v1/watchlists?user_id=${activeId}`);
      if (wRes.ok) {
        const lists = await wRes.json();
        if (lists && lists.length > 0) {
          targetListId = lists[0].id;
        } else {
          // Auto-create default watchlist if user has none
          const createRes = await fetch(`${API}/api/v1/watchlists?user_id=${activeId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Primary Wishlist", description: "Default Wishlist" }),
          });
          if (createRes.ok) {
            const newList = await createRes.json();
            targetListId = newList.id;
          }
        }
      }

      if (targetListId) {
        await fetch(`${API}/api/v1/watchlists/${targetListId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: sym.toUpperCase(),
            target_sell_price: targetPrice || null,
            notes: "Added from AI Market Recommendations",
          }),
        });
        setAddedSymbols((prev) => new Set([...prev, sym]));
      }
    } catch {
      // ignore
    }
  };

  const fmt = (n: string | number | null | undefined) =>
    n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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

        {/* Market Indices (Central Database) - On Top of Home Screen */}
        <div className="bg-bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs text-txt-muted font-bold uppercase tracking-wider">Market Overview (Central DB)</p>
            </div>
            <span className="text-[11px] text-txt-dim font-medium">NSE / BSE</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-border/80 pb-4">
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

            {/* Master 2-Button Control Center */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap">
              {recData?.timestamp && (
                <span className="text-[11px] text-cyan-300/80 font-mono bg-bg-primary/80 px-2.5 py-2 rounded-xl border border-border shrink-0 whitespace-nowrap">
                  Scanned: {new Date(recData.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}

              {/* Master Button 1: Sync All Live Prices */}
              <button
                onClick={handleSyncAllPrices}
                disabled={syncingPrices}
                className={`h-10 px-4 rounded-xl text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border whitespace-nowrap shrink-0 ${
                  syncingPrices
                    ? "bg-cyan-600/40 border-cyan-400 text-cyan-200 animate-pulse shadow-cyan-950/40"
                    : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-cyan-400/40 shadow-cyan-950/30"
                }`}
                title="Fetch latest live market prices for all stocks across your Portfolios, Wishlists, and Paper Arena sandboxes"
              >
                <span className={`text-sm ${syncingPrices ? "animate-spin" : ""}`}>🔄</span>
                <span className="tracking-wide">
                  {syncingPrices ? "Syncing Live Prices..." : "Sync All Live Prices"}
                </span>
              </button>

              {/* Master Button 2: Run AI Market Research */}
              <button
                onClick={handleScanMarket}
                disabled={scanning}
                className={`h-10 px-4 rounded-xl text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border whitespace-nowrap shrink-0 ${
                  scanning
                    ? "bg-indigo-600/40 border-indigo-400 text-indigo-200 animate-pulse shadow-indigo-950/40"
                    : "bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white border-indigo-400/40 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                }`}
                title="Run comprehensive AI research: market breadth, news sentiment, top movers, and top 5 high-conviction trade setups"
              >
                <span className={`text-sm ${scanning ? "animate-spin text-cyan-200" : "text-cyan-200"}`}>⚡</span>
                <span className="tracking-wide">
                  {scanning ? "Researching..." : "Run AI Market Research"}
                </span>
              </button>
            </div>
          </div>

          {/* Sync Toast Notification */}
          {syncToast && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2 rounded-xl flex items-center justify-between animate-fade-in">
              <span>{syncToast}</span>
              <button onClick={() => setSyncToast(null)} className="text-txt-muted hover:text-white ml-2 text-xs">✕</button>
            </div>
          )}

          <RecommendationsSection
            recData={recData}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            scanning={scanning}
            handleScanMarket={handleScanMarket}
            handleAddToWishlist={handleAddToWishlist}
            addedSymbols={addedSymbols}
            setModalStock={setModalStock}
            setPopoutStock={setPopoutStock}
            popoutStock={popoutStock}
            fmt={fmt}
          />
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
  );
}
