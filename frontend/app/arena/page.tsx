"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useApi } from "@/components/useApi";

import type {
  ArenaSandboxSummary,
  ArenaSandboxDetail,
  ArenaPosition,
  StockOptionItem,
} from "./components/ArenaTypes";
import StockPickerModal from "./components/StockPickerModal";
import SandboxDetail from "./components/SandboxDetail";

export default function PaperTradingArenaPage() {
  const { rawUrl, userId } = useApi();
  const effectiveUid = userId || 1;

  // View state: null = dashboard, number = inside sandbox
  const [selectedSandboxId, setSelectedSandboxId] = useState<number | null>(null);

  const [sandboxes, setSandboxes] = useState<ArenaSandboxSummary[]>([]);
  const [detail, setDetail] = useState<ArenaSandboxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStockPickerModal, setShowStockPickerModal] = useState(false);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Renaming
  const [renameValue, setRenameValue] = useState("");

  // Create form
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    category: "USER_INTUITION",
    horizon: "1M",
    initial_capital: 100000,
    auto_execute: true,
  });

  // Stock Picker data sources
  const [aiSuggestions, setAiSuggestions] = useState<StockOptionItem[]>([]);
  const [wishlistStocks, setWishlistStocks] = useState<StockOptionItem[]>([]);
  const [portfolioStocks, setPortfolioStocks] = useState<StockOptionItem[]>([]);

  // Capital adjust state
  const [capitalDelta, setCapitalDelta] = useState<number>(25000);
  const [capitalMode, setCapitalMode] = useState<"ADD" | "REDUCE">("ADD");

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Load Sandboxes
  const loadSandboxes = async (autoSelectId?: number) => {
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes?user_id=${effectiveUid}`));
      if (res.ok) {
        const data: ArenaSandboxSummary[] = await res.json();
        setSandboxes(data);
        if (autoSelectId) {
          setSelectedSandboxId(autoSelectId);
          loadDetail(autoSelectId);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Load Sandbox Detail
  const loadDetail = async (id: number) => {
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes/${id}`));
      if (res.ok) {
        const d = await res.json();
        setDetail(d);
        setRenameValue(d.name);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load stock catalogues
  const loadStockSources = async () => {
    try {
      const [aiRes, wlRes, pfRes] = await Promise.all([
        fetch(rawUrl(`/api/v1/arena/ai-suggestions?user_id=${effectiveUid}`)),
        fetch(rawUrl(`/api/v1/arena/wishlist-stocks?user_id=${effectiveUid}`)),
        fetch(rawUrl(`/api/v1/arena/portfolio-stocks?user_id=${effectiveUid}`)),
      ]);
      if (aiRes.ok) {
        const d = await aiRes.json();
        // Sort with highest percentage/score first!
        d.sort((a: StockOptionItem, b: StockOptionItem) => b.score - a.score);
        setAiSuggestions(d);
      }
      if (wlRes.ok) {
        const d = await wlRes.json();
        setWishlistStocks(d);
      }
      if (pfRes.ok) {
        const d = await pfRes.json();
        setPortfolioStocks(d);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSandboxes();
    loadStockSources();
  }, [effectiveUid]);

  // Navigate into a sandbox
  const handleEnterSandbox = (id: number) => {
    setSelectedSandboxId(id);
    loadDetail(id);
  };

  // Return to sandboxes dashboard
  const handleBackToDashboard = () => {
    setSelectedSandboxId(null);
    setDetail(null);
    loadSandboxes();
  };

  // Create new sandbox
  const handleCreateSandbox = async () => {
    if (!createForm.name.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes?user_id=${effectiveUid}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        const created = await res.json();
        setShowCreateModal(false);
        setCreateForm({ name: "", description: "", category: "USER_INTUITION", horizon: "1M", initial_capital: 100000, auto_execute: true });
        notify(`🎉 Created "${created.name}" with ₹${Number(created.initial_capital).toLocaleString("en-IN")}`);
        loadSandboxes(created.id);
      }
    } catch (e) {
      notify("Failed to create sandbox");
    } finally {
      setActionLoading(false);
    }
  };

  // Rename sandbox
  const handleSaveRename = async () => {
    if (!selectedSandboxId || !renameValue.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes/${selectedSandboxId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (res.ok) {
        setShowRenameModal(false);
        notify("Sandbox renamed successfully!");
        loadDetail(selectedSandboxId);
        loadSandboxes();
      }
    } catch (e) {
      notify("Failed to rename");
    } finally {
      setActionLoading(false);
    }
  };

  // Search stock manually (used by StockPickerModal)
  const handleSearchStock = async (query: string): Promise<StockOptionItem | null> => {
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/stock-quote?symbol=${encodeURIComponent(query)}`));
      if (res.ok) {
        const data = await res.json();
        return {
          symbol: data.symbol,
          name: data.name,
          tab: "Search Result",
          score: data.score || 75,
          verdict: data.verdict || "BUY",
          current_price: data.current_price,
          target_buy_price: data.target_buy_price,
          target_sell_price: data.target_sell_price,
          stop_loss_price: data.stop_loss_price,
          rationale: data.rationale || "Live market search result with suggested targets.",
        };
      } else {
        notify(`Stock "${query}" not found.`);
        return null;
      }
    } catch (e) {
      notify("Search failed");
      return null;
    }
  };

  // Confirm buy order (used by StockPickerModal)
  const handleConfirmBuyOrder = async (
    activeOrderStock: StockOptionItem,
    orderQuantity: number,
    orderBuyPrice: number,
    orderTargetSell: number,
    orderStopLoss: number
  ) => {
    if (!selectedSandboxId || orderQuantity <= 0) return;
    setActionLoading(true);
    try {
      const payload = {
        symbol: activeOrderStock.symbol,
        quantity: orderQuantity,
        custom_buy_price: orderBuyPrice,
        target_sell_price: orderTargetSell || null,
        stop_loss_price: orderStopLoss || null,
        horizon: detail?.horizon || "1M",
        rationale: activeOrderStock.rationale,
        ai_score: activeOrderStock.score || null,
      };

      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes/${selectedSandboxId}/orders`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowStockPickerModal(false);
        notify(`✅ Added ${orderQuantity} shares of ${activeOrderStock.symbol} to your portfolio!`);
        loadDetail(selectedSandboxId);
        loadSandboxes();
      } else {
        const err = await res.json();
        notify(`❌ Order error: ${err.detail || "Insufficient funds"}`);
      }
    } catch (e) {
      notify("Failed to execute buy order");
    } finally {
      setActionLoading(false);
    }
  };

  // Update position quantity (+ or -)
  const handleUpdateQuantity = async (pos: ArenaPosition, delta: number) => {
    if (!selectedSandboxId) return;
    const currentQty = Math.round(Number(pos.quantity) || 0);
    const newQty = Math.max(0, currentQty + delta);
    if (newQty === currentQty) return;

    setActionLoading(true);
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes/${selectedSandboxId}/positions/${pos.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      });
      if (res.ok) {
        const updatedDetail = await res.json();
        setDetail(updatedDetail);
        notify(
          newQty > currentQty
            ? `Added +${newQty - currentQty} shares of ${pos.symbol} (cash deducted).`
            : `Reduced -${currentQty - newQty} shares of ${pos.symbol} (proceeds credited to cash).`
        );
        loadSandboxes();
      } else {
        const err = await res.json();
        notify(`Quantity update failed: ${err.detail || "Error"}`);
      }
    } catch (e) {
      notify("Failed to update quantity");
    } finally {
      setActionLoading(false);
    }
  };

  // Save custom target price for position
  const handleSaveCustomTarget = async (posId: number, val: number) => {
    if (!selectedSandboxId) return;
    setActionLoading(true);
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes/${selectedSandboxId}/positions/${posId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_target_price: val }),
      });
      if (res.ok) {
        const updatedDetail = await res.json();
        setDetail(updatedDetail);
        notify(`🎯 Custom target set to ₹${val.toFixed(2)}`);
      }
    } catch (e) {
      notify("Failed to update target");
    } finally {
      setActionLoading(false);
    }
  };

  // Manual sell position
  const handleSellPosition = async (posId: number, symbol: string) => {
    if (!selectedSandboxId) return;
    setActionLoading(true);
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes/${selectedSandboxId}/positions/${posId}/sell`), {
        method: "POST",
      });
      if (res.ok) {
        const trade = await res.json();
        notify(`💰 Sold ${symbol}! Realized P&L: ₹${Number(trade.realized_pnl).toLocaleString("en-IN")} (${trade.realized_pnl_pct}%)`);
        loadDetail(selectedSandboxId);
        loadSandboxes();
      }
    } catch (e) {
      notify("Failed to exit position");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete position throughout sandbox (refunds invested capital with 0 P&L)
  const handleDeletePosition = async (pos: ArenaPosition) => {
    if (!selectedSandboxId) return;
    const investedAmt = (Number(pos.quantity) * Number(pos.avg_buy_price)).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    if (!window.confirm(`Delete ${pos.symbol} completely from this sandbox? ₹${investedAmt} will be refunded to your available balance with 0 P&L booked.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes/${selectedSandboxId}/positions/${pos.id}`), {
        method: "DELETE",
      });
      if (res.ok) {
        const d = await res.json();
        setDetail(d);
        notify(`🗑️ Deleted ${pos.symbol}. ₹${investedAmt} returned to available balance.`);
        loadSandboxes();
      } else {
        const err = await res.json();
        notify(`❌ Error deleting position: ${err.detail || "Failed"}`);
      }
    } catch (e) {
      notify("Failed to delete position");
    } finally {
      setActionLoading(false);
    }
  };

  // Adjust capital (add or reduce)
  const handleAdjustCapital = async () => {
    if (!selectedSandboxId) return;
    const amount = capitalMode === "ADD" ? Math.abs(capitalDelta) : -Math.abs(capitalDelta);
    setActionLoading(true);
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/sandboxes/${selectedSandboxId}/capital`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (res.ok) {
        setShowCapitalModal(false);
        notify(`${capitalMode === "ADD" ? "Added" : "Withdrew"} ₹${Math.abs(amount).toLocaleString("en-IN")} virtual cash!`);
        loadDetail(selectedSandboxId);
        loadSandboxes();
      } else {
        const err = await res.json();
        notify(`Capital adjustment failed: ${err.detail || "Error"}`);
      }
    } catch (e) {
      notify("Failed to adjust capital");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete sandbox
  const handleDeleteSandbox = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await fetch(rawUrl(`/api/v1/arena/sandboxes/${id}`), { method: "DELETE" });
      notify("Sandbox deleted.");
      if (selectedSandboxId === id) {
        setSelectedSandboxId(null);
        setDetail(null);
      }
      loadSandboxes();
    } catch (e) {
      notify("Failed to delete sandbox");
    }
  };

  // Determine top performing sandbox for crux
  const bestPerformingSandbox = sandboxes.length > 0
    ? [...sandboxes].sort((a, b) => b.total_pnl_pct - a.total_pnl_pct)[0]
    : null;

  const totalCapitalAllSandboxes = sandboxes.reduce((acc, s) => acc + Number(s.initial_capital), 0);
  const totalInvestedAllSandboxes = sandboxes.reduce((acc, s) => acc + Number(s.invested_capital || 0), 0);
  const totalBalanceAllSandboxes = sandboxes.reduce((acc, s) => acc + Number(s.current_cash || 0), 0);
  const totalHoldingsAllSandboxes = sandboxes.reduce((acc, s) => acc + Number(s.position_count || 0), 0);
  const totalValueAllSandboxes = sandboxes.reduce((acc, s) => acc + Number(s.total_value), 0);
  const totalPnlAllSandboxes = sandboxes.reduce((acc, s) => acc + Number(s.total_pnl), 0);
  const totalPnlPctAllSandboxes = totalCapitalAllSandboxes > 0
    ? (totalPnlAllSandboxes / totalCapitalAllSandboxes) * 100
    : 0;

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-4 max-w-6xl mx-auto">
        <div className="h-20 bg-bg-card rounded-2xl animate-pulse border border-border" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-bg-card rounded-xl animate-pulse border border-border" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-txt-primary">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0E1524] border border-cyan-500/40 text-cyan-200 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-3 animate-fade-in backdrop-blur-md">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-txt-muted hover:text-white ml-2 text-xs">✕</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* STAGE 1: ARENA HOMEPAGE DASHBOARD                            */}
      {/* ============================================================ */}
      {selectedSandboxId === null && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
                <span>⚔️</span> Paper Trading Arena
              </h1>
              <p className="text-xs text-txt-secondary mt-1">
                Simulate and battle-test your paper portfolios with customizable virtual money and automated execution.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-950/40 flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
            >
              <span>+</span>
              <span>Create Sandbox</span>
            </button>
          </div>

          {/* Arena Performance Crux / Summary Banner */}
          {sandboxes.length > 0 && (
            <div className="bg-gradient-to-r from-[#0C1527] via-[#0E1A33] to-[#122244] border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 text-base">🏆</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Arena Executive Crux & Best Performer
                  </span>
                </div>
                {bestPerformingSandbox && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300">
                    Top Performer: {bestPerformingSandbox.name} ({bestPerformingSandbox.total_pnl >= 0 ? "+" : ""}{bestPerformingSandbox.total_pnl_pct.toFixed(2)}%)
                  </span>
                )}
              </div>

              {/* Crux Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-bg-primary/60 border border-border/80 rounded-xl p-3">
                  <span className="text-[11px] text-txt-muted block">Total Sandboxes</span>
                  <span className="text-lg font-black text-white">{sandboxes.length} Active</span>
                </div>
                <div className="bg-bg-primary/60 border border-border/80 rounded-xl p-3">
                  <span className="text-[11px] text-txt-muted block">Total Initial Capital</span>
                  <span className="text-lg font-black text-white font-mono">
                    ₹{totalCapitalAllSandboxes.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="bg-bg-primary/60 border border-border/80 rounded-xl p-3">
                  <span className="text-[11px] text-txt-muted block">Total Current Value</span>
                  <span className="text-lg font-black text-cyan-300 font-mono">
                    ₹{totalValueAllSandboxes.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="bg-bg-primary/60 border border-border/80 rounded-xl p-3">
                  <span className="text-[11px] text-txt-muted block">Aggregate Net Profit</span>
                  <span
                    className={`text-lg font-black font-mono ${
                      totalPnlAllSandboxes >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {totalPnlAllSandboxes >= 0 ? "+" : ""}₹{totalPnlAllSandboxes.toLocaleString("en-IN", { maximumFractionDigits: 0 })} ({totalPnlPctAllSandboxes.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-txt-secondary leading-relaxed">
                💡 <strong>Strategy Insight:</strong> {bestPerformingSandbox
                  ? `"${bestPerformingSandbox.name}" is leading the arena with a ${bestPerformingSandbox.total_pnl_pct.toFixed(1)}% gain over ${bestPerformingSandbox.position_count} stock holdings. Drag and drop cards below to prioritize.`
                  : "Deploy virtual capital into AI recommendations or personal watchlist setups to benchmark performance."}
              </p>
            </div>
          )}

          {/* Sandboxes List */}
          {sandboxes.length === 0 ? (
            <div className="text-center py-16 px-4 bg-bg-card border border-dashed border-border rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4 text-2xl">
                🎯
              </div>
              <h3 className="text-base font-bold text-white mb-1">No Sandboxes Created Yet</h3>
              <p className="text-xs text-txt-muted max-w-md mx-auto mb-6">
                Create a paper trading portfolio with your chosen amount of virtual cash (e.g. ₹10K, ₹50K, ₹1L) to test your stock picks or AI suggestions in the real market.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                + Create Your First Sandbox
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-semibold uppercase tracking-wider text-txt-muted">
                  Your Sandboxes ({sandboxes.length})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sandboxes.map((sb) => {
                  const isGain = sb.total_pnl > 0;
                  return (
                    <div
                      key={sb.id}
                      className="bg-bg-card border border-border hover:border-cyan-500/50 rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                            {sb.name}
                            <span className="ml-1.5 text-[10px] font-normal text-txt-muted">
                              {sb.created_at ? new Date(sb.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-") : ""}
                            </span>
                          </h3>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                              isGain ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                            }`}
                          >
                            {isGain ? "+" : ""}{sb.total_pnl_pct.toFixed(1)}%
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-txt-secondary mb-4">
                          <div className="flex justify-between">
                            <span className="text-txt-muted">Starting Amount:</span>
                            <span className="font-mono text-white">₹{Number(sb.initial_capital).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-txt-muted">Invested amount:</span>
                            <span className="font-mono text-white font-bold">
                              ₹{Number(sb.invested_capital || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-txt-muted">Balance Remaining:</span>
                            <span className="font-mono text-cyan-300 font-bold">
                              ₹{Number(sb.current_cash).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-txt-muted">Stock Holdings:</span>
                            <span className="font-mono text-white">{sb.position_count} stocks</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-border/80">
                        <button
                          onClick={() => handleEnterSandbox(sb.id)}
                          className="flex-1 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all text-center cursor-pointer shadow-md"
                        >
                          Enter Sandbox &rarr;
                        </button>
                        <button
                          onClick={() => handleDeleteSandbox(sb.id, sb.name)}
                          className="p-2 text-txt-muted hover:text-rose-400 rounded-lg hover:bg-bg-hover transition-colors"
                          title="Delete sandbox"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Executive Summary & Health Diagnostics Box */}
              <div className="mt-8 bg-gradient-to-br from-[#0C1527] via-[#0E1A33] to-[#0A1220] border border-cyan-500/30 rounded-2xl p-5 md:p-6 shadow-2xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">📊</span>
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                        Arena Sandboxes Summary & Health Diagnostics
                      </h2>
                      <p className="text-xs text-txt-secondary mt-0.5">
                        Audit of active paper trading sandboxes, capital deployment, and individual performance benchmarks.
                      </p>
                    </div>
                  </div>
                  {bestPerformingSandbox && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold self-start sm:self-auto">
                      <span>🏆 Best Performer:</span>
                      <span className="font-bold text-white">{bestPerformingSandbox.name}</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ({bestPerformingSandbox.total_pnl_pct > 0 ? "+" : ""}{bestPerformingSandbox.total_pnl_pct.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Overall Summary of Sandbox Items */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-bg-primary/70 border border-border/70 rounded-xl p-3">
                    <span className="text-[11px] text-txt-muted block font-medium">Total Starting Amount</span>
                    <span className="text-base font-black text-white font-mono">
                      ₹{totalCapitalAllSandboxes.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-txt-muted block mt-0.5">{sandboxes.length} Active Sandboxes</span>
                  </div>
                  <div className="bg-bg-primary/70 border border-border/70 rounded-xl p-3">
                    <span className="text-[11px] text-txt-muted block font-medium">Total Invested Amount</span>
                    <span className="text-base font-black text-white font-mono">
                      ₹{totalInvestedAllSandboxes.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[10px] text-cyan-400 block mt-0.5">
                      {totalCapitalAllSandboxes > 0 ? ((totalInvestedAllSandboxes / totalCapitalAllSandboxes) * 100).toFixed(1) : 0}% Deployed
                    </span>
                  </div>
                  <div className="bg-bg-primary/70 border border-border/70 rounded-xl p-3">
                    <span className="text-[11px] text-txt-muted block font-medium">Total Balance Remaining</span>
                    <span className="text-base font-black text-cyan-300 font-mono">
                      ₹{totalBalanceAllSandboxes.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[10px] text-txt-muted block mt-0.5">Available for orders</span>
                  </div>
                  <div className="bg-bg-primary/70 border border-border/70 rounded-xl p-3">
                    <span className="text-[11px] text-txt-muted block font-medium">Total Stock Holdings</span>
                    <span className="text-base font-black text-indigo-300 font-mono">
                      {totalHoldingsAllSandboxes} stocks
                    </span>
                    <span className="text-[10px] text-txt-muted block mt-0.5">Across all sandboxes</span>
                  </div>
                  <div className="bg-bg-primary/70 border border-border/70 rounded-xl p-3 col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-txt-muted block font-medium">Aggregate Return</span>
                    <span
                      className={`text-base font-black font-mono ${
                        totalPnlAllSandboxes >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {totalPnlAllSandboxes >= 0 ? "+" : ""}₹{totalPnlAllSandboxes.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold block mt-0.5 ${
                        totalPnlPctAllSandboxes >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {totalPnlPctAllSandboxes >= 0 ? "+" : ""}{totalPnlPctAllSandboxes.toFixed(2)}% Overall
                    </span>
                  </div>
                </div>

                {/* Individual Sandbox Performance Breakdown Table */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-txt-muted mb-2.5">
                    Individual Sandbox Breakdown & Status
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-border/80">
                    <table className="w-full text-xs text-left border-collapse bg-bg-card/40">
                      <thead>
                        <tr className="border-b border-border/80 text-[11px] text-txt-muted bg-bg-primary/60">
                          <th className="py-2.5 px-3 font-semibold">Sandbox Name</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Starting Amount</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Invested Amount</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Balance Remaining</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Stock Holdings</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Profit Percentage</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {sandboxes.map((sb) => {
                          const isProfitable = sb.total_pnl_pct > 0;
                          const isLoss = sb.total_pnl_pct < 0;
                          const isTop = bestPerformingSandbox?.id === sb.id;
                          const statusLabel = isProfitable
                            ? "🟢 Working Fine"
                            : isLoss
                            ? "🔴 In Drawdown"
                            : "🟡 Stable / Breakeven";
                          const statusColor = isProfitable
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : isLoss
                            ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                            : "text-amber-400 bg-amber-500/10 border-amber-500/20";

                          return (
                            <tr key={sb.id} className="hover:bg-bg-card transition-colors">
                              <td className="py-3 px-3 font-bold text-white">
                                <div className="flex items-center gap-1.5">
                                  <span>{sb.name}</span>
                                  <span className="text-[10px] font-normal text-txt-muted ml-1">
                                    {sb.created_at ? new Date(sb.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-") : ""}
                                  </span>
                                  {isTop && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                                      Best
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-white">
                                ₹{Number(sb.initial_capital).toLocaleString("en-IN")}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-white font-medium">
                                ₹{Number(sb.invested_capital || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-cyan-300">
                                ₹{Number(sb.current_cash).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-3 px-3 text-center font-mono text-white">
                                {sb.position_count} {sb.position_count === 1 ? "stock" : "stocks"}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <span
                                  className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded ${
                                    sb.total_pnl_pct > 0
                                      ? "bg-emerald-500/15 text-emerald-400"
                                      : sb.total_pnl_pct < 0
                                      ? "bg-rose-500/15 text-rose-400"
                                      : "bg-rose-500/15 text-rose-400/90"
                                  }`}
                                >
                                  {sb.total_pnl_pct > 0 ? "+" : ""}{sb.total_pnl_pct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={() => handleEnterSandbox(sb.id)}
                                  className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 hover:text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                                >
                                  Enter &rarr;
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Overall Summary Takeaway */}
                <div className="bg-bg-primary/50 border border-border/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-txt-secondary leading-relaxed">
                  <span className="text-base">💡</span>
                  <div>
                    <span className="font-bold text-white">Summary Crux: </span>
                    {bestPerformingSandbox && bestPerformingSandbox.total_pnl_pct > 0 ? (
                      <span>
                        <strong>&ldquo;{bestPerformingSandbox.name}&rdquo;</strong> is working best with a <strong>+{bestPerformingSandbox.total_pnl_pct.toFixed(1)}%</strong> profit percentage. Aggregate invested capital across all sandboxes is <strong>₹{totalInvestedAllSandboxes.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong> with <strong>{totalHoldingsAllSandboxes} stocks</strong> held, and <strong>₹{totalBalanceAllSandboxes.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong> available in balance.
                      </span>
                    ) : (
                      <span>
                        All {sandboxes.length} sandboxes are operating stably. Total invested capital across all sandbox items is <strong>₹{totalInvestedAllSandboxes.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong> across <strong>{totalHoldingsAllSandboxes} stock holdings</strong> with <strong>₹{totalBalanceAllSandboxes.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong> cash balance remaining.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* STAGE 2: INSIDE A SELECTED SANDBOX                           */}
      {/* ============================================================ */}
      {selectedSandboxId !== null && detail && (
        <SandboxDetail
          detail={detail}
          actionLoading={actionLoading}
          onBackToDashboard={handleBackToDashboard}
          onShowStockPicker={() => setShowStockPickerModal(true)}
          onShowCapitalModal={() => setShowCapitalModal(true)}
          onShowRenameModal={() => setShowRenameModal(true)}
          onUpdateQuantity={handleUpdateQuantity}
          onSaveCustomTarget={handleSaveCustomTarget}
          onSellPosition={handleSellPosition}
          onDeletePosition={handleDeletePosition}
        />
      )}

      {/* ============================================================ */}
      {/* MODAL 1: CREATE NEW SANDBOX                                  */}
      {/* ============================================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0E1524] border border-cyan-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>➕</span> Create New Sandbox Portfolio
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-txt-muted hover:text-white">✕</button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-txt-muted block mb-1 font-semibold">Sandbox Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. My Swing Sandbox, AI 1-Month Bets"
                  className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-txt-muted block mb-1 font-semibold">Virtual Starting Capital</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[10000, 50000, 100000, 500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, initial_capital: amt })}
                      className={`py-1 rounded-lg border text-center font-mono font-bold ${
                        createForm.initial_capital === amt
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                          : "bg-bg-primary border-border text-txt-muted"
                      }`}
                    >
                      ₹{(amt / 1000).toFixed(0)}K
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={createForm.initial_capital}
                  onChange={(e) => setCreateForm({ ...createForm, initial_capital: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-white font-mono focus:border-cyan-400 focus:outline-none"
                  placeholder="Or enter any custom amount"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="auto_exec"
                  checked={createForm.auto_execute}
                  onChange={(e) => setCreateForm({ ...createForm, auto_execute: e.target.checked })}
                  className="rounded border-border text-cyan-500 focus:ring-0"
                />
                <label htmlFor="auto_exec" className="text-txt-secondary cursor-pointer">
                  Enable Automated Target & Stop-loss Execution
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-bg-primary hover:bg-bg-hover text-txt-muted rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSandbox}
                disabled={actionLoading || !createForm.name.trim()}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-xs font-bold shadow-md hover:opacity-90 disabled:opacity-50"
              >
                Create Sandbox
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: RENAME SANDBOX                                      */}
      {/* ============================================================ */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0E1524] border border-cyan-500/40 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>✎</span> Rename Sandbox
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-white focus:border-cyan-400 focus:outline-none font-bold"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRenameModal(false)}
                className="px-3 py-1.5 bg-bg-primary text-txt-muted rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRename}
                disabled={actionLoading || !renameValue.trim()}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: CAPITAL CUSTOMIZATION (ADD OR REDUCE)               */}
      {/* ============================================================ */}
      {showCapitalModal && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0E1524] border border-cyan-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>💵</span> Customize Virtual Cash
              </h3>
              <button onClick={() => setShowCapitalModal(false)} className="text-txt-muted hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex rounded-lg bg-bg-primary p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setCapitalMode("ADD")}
                  className={`flex-1 py-1.5 rounded text-center font-bold transition-colors ${
                    capitalMode === "ADD" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-txt-muted"
                  }`}
                >
                  + Add Cash
                </button>
                <button
                  type="button"
                  onClick={() => setCapitalMode("REDUCE")}
                  className={`flex-1 py-1.5 rounded text-center font-bold transition-colors ${
                    capitalMode === "REDUCE" ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "text-txt-muted"
                  }`}
                >
                  − Reduce Cash
                </button>
              </div>

              <div>
                <label className="text-txt-muted block mb-1 font-semibold">Amount (₹)</label>
                <input
                  type="number"
                  value={capitalDelta}
                  onChange={(e) => setCapitalDelta(Math.abs(Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-white font-mono font-bold focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[10000, 25000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCapitalDelta(amt)}
                    className="py-1 rounded bg-bg-primary border border-border text-cyan-300 font-mono text-[11px]"
                  >
                    ₹{(amt / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
              <button
                onClick={() => setShowCapitalModal(false)}
                className="px-4 py-2 bg-bg-primary hover:bg-bg-hover text-txt-muted rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustCapital}
                disabled={actionLoading || capitalDelta <= 0}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
              >
                Confirm {capitalMode === "ADD" ? "Deposit" : "Withdrawal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: MULTI-SOURCE STOCK PICKER (AI, WISHLIST, PORTFOLIO) */}
      {/* ============================================================ */}
      {detail && (
        <StockPickerModal
          isOpen={showStockPickerModal}
          onClose={() => setShowStockPickerModal(false)}
          detail={detail}
          aiSuggestions={aiSuggestions}
          wishlistStocks={wishlistStocks}
          portfolioStocks={portfolioStocks}
          onConfirmBuyOrder={handleConfirmBuyOrder}
          onSearchStock={handleSearchStock}
          actionLoading={actionLoading}
          notify={notify}
        />
      )}
    </div>
  );
}
