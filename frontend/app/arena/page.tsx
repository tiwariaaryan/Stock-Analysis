"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useApi } from "@/components/useApi";

type ArenaSandboxSummary = {
  id: number;
  name: string;
  category: string;
  horizon: string;
  initial_capital: number;
  current_cash: number;
  invested_capital?: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  win_rate_pct: number;
  position_count: number;
  trade_count: number;
  auto_execute: boolean;
  position_order: number;
  created_at: string;
};

type ArenaPosition = {
  id: number;
  sandbox_id: number;
  symbol: string;
  name: string | null;
  quantity: number;
  avg_buy_price: number;
  current_price: number | null;
  invested_amount: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  target_sell_price: number | null;
  ai_target_price: number | null;
  custom_target_price: number | null;
  stop_loss_price: number | null;
  distance_to_target_pct: number | null;
  distance_to_stop_pct: number | null;
  horizon: string;
  rationale: string | null;
  ai_score: number | null;
  created_at: string;
};

type ArenaTrade = {
  id: number;
  sandbox_id: number;
  symbol: string;
  trade_type: string;
  quantity: number;
  price: number;
  total_amount: number;
  realized_pnl: number;
  realized_pnl_pct: number;
  notes: string | null;
  executed_at: string;
};

type ArenaSandboxDetail = ArenaSandboxSummary & {
  description: string | null;
  invested_capital: number;
  realized_pnl: number;
  unrealized_pnl: number;
  positions: ArenaPosition[];
  trades: ArenaTrade[];
};

type StockOptionItem = {
  symbol: string;
  name: string;
  tab: string;
  strategy_id?: string;
  strategy_title?: string;
  score: number;
  verdict: string;
  current_price: number;
  target_buy_price: number;
  target_sell_price: number;
  stop_loss_price: number;
  rationale: string;
  is_top?: boolean;
  upside_pct?: number;
  horizon_label?: string;
};

function formatDdMmYyyy(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return "—";
  }
}

// Canonical AI Intelligence Sub-Tab horizon mappings (Derived strictly from AI Discovery Strategy Engine)
const AI_SUBTAB_HORIZONS: Record<string, string> = {
  // 1. Fast Momentum & Delivery Breakouts (Badge: 7 to 14 Days)
  TRENT: "7 – 14 Days",
  DIXON: "7 – 14 Days",
  ETERNAL: "7 – 14 Days",
  KAYNES: "7 – 14 Days",
  ZOMATO: "7 – 14 Days",
  MAZDOCK: "7 – 14 Days",
  BHARTIARTL: "7 – 14 Days",
  ELECON: "7 – 14 Days",
  APARINDS: "7 – 14 Days",

  // 2. Mean-Reversion Bargain Dips (Badge: 14 Days to 1 Month)
  POLYCAB: "14D – 1M",
  CIPLA: "14D – 1M",
  SUNPHARMA: "14D – 1M",
  HDFCAMC: "14D – 1M",
  ASTRAL: "14D – 1M",
  MUTHOOTFIN: "14D – 1M",

  // 3. Untouched Multibagger Growth Rockets (Badge: 3 to 6 Months)
  SUZLON: "3M – 6M",
  KPITTECH: "3M – 6M",
  TATAELXSI: "3M – 6M",
  TITAGARH: "3M – 6M",
  TEJASNET: "3M – 6M",
  IREDA: "3M – 6M",
  PERSISTENT: "3M – 6M",
  COFORGE: "3M – 6M",

  // 4. Macro Theme & Sector Tailwind Surfers (Badge: 3 to 6 Months / 6M – 1Y)
  RVNL: "3M – 6M",
  REC: "3M – 6M",
  PFC: "3M – 6M",
  POWERGRID: "6M – 1Y",

  // 5. Wide-Moat Monopoly Compounders (Badge: 6 Months to 1 Year)
  HAL: "6M – 1Y",
  BEL: "6M – 1Y",
  MCX: "6M – 1Y",
  CAMS: "6M – 1Y",
  CDSL: "6M – 1Y",
  BSE: "6M – 1Y",
  IRCTC: "6M – 1Y",
  CRISIL: "6M – 1Y",
  TCS: "6M – 1Y",
  INFY: "6M – 1Y",
  HCLTECH: "6M – 1Y",
  LT: "6M – 1Y",
  TITAN: "6M – 1Y",
  MARUTI: "6M – 1Y",
  ICICIBANK: "6M – 1Y",
  HDFCBANK: "6M – 1Y",
  RELIANCE: "6M – 1Y",

  // 6. Undervalued Value Compounders (Badge: 1 Year+)
  COALINDIA: "1Y+",
  NMDC: "1Y+",
  SBIN: "1Y+",
  CANBK: "1Y+",
  GAIL: "1Y+",
  ONGC: "1Y+",
  ITC: "1Y+",
};

function resolveStockAIHorizon(symbol?: string | null, posHorizon?: string | null): string {
  const sym = (symbol || "").toUpperCase().replace(".NS", "").replace(".BO", "").trim();
  if (sym && AI_SUBTAB_HORIZONS[sym]) {
    return AI_SUBTAB_HORIZONS[sym];
  }

  const raw = (posHorizon || "1M").trim().toUpperCase();
  if (raw === "1W" || raw === "7D" || raw.includes("7 DAY") || raw.includes("7-14")) return "7 – 14 Days";
  if (raw === "1M" || raw.includes("14D") || raw.includes("1 MONTH")) return "14D – 1M";
  if (raw === "3M" || raw.includes("3 MONTH") || raw.includes("3-6")) return "3M – 6M";
  if (raw === "6M" || raw.includes("6 MONTH") || raw.includes("6M-1Y")) return "6M – 1Y";
  if (raw === "1Y" || raw.includes("1 YEAR") || raw.includes("1Y+")) return "1Y+";
  if (raw === "FLEXIBLE") return "Flexible";
  return "3M – 6M";
}

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

  // Stock Picker state
  const [pickerSource, setPickerSource] = useState<"AI" | "WISHLIST" | "PORTFOLIO" | "SEARCH">("AI");
  const [aiSubTab, setAiSubTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<StockOptionItem[]>([]);
  const [wishlistStocks, setWishlistStocks] = useState<StockOptionItem[]>([]);
  const [portfolioStocks, setPortfolioStocks] = useState<StockOptionItem[]>([]);
  const [searchedStockData, setSearchedStockData] = useState<StockOptionItem | null>(null);
  const [searchingStock, setSearchingStock] = useState(false);

  // Active stock order configuration
  const [activeOrderStock, setActiveOrderStock] = useState<StockOptionItem | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(10);
  const [orderBuyPrice, setOrderBuyPrice] = useState<number>(0);
  const [orderTargetSell, setOrderTargetSell] = useState<number>(0);
  const [orderStopLoss, setOrderStopLoss] = useState<number>(0);

  // Inline editing states for positions table
  const [editingTargetPosId, setEditingTargetPosId] = useState<number | null>(null);
  const [customTargetInput, setCustomTargetInput] = useState<string>("");

  // Intelligence Center Chart Tab
  const [chartTab, setChartTab] = useState<"RUNWAY" | "ALLOCATION" | "HORIZON">("RUNWAY");
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

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

  // Search stock manually
  const handleSearchStock = async () => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return;
    setSearchingStock(true);
    try {
      const res = await fetch(rawUrl(`/api/v1/arena/stock-quote?symbol=${encodeURIComponent(q)}`));
      if (res.ok) {
        const data = await res.json();
        setSearchedStockData({
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
        });
      } else {
        notify(`Stock "${q}" not found.`);
      }
    } catch (e) {
      notify("Search failed");
    } finally {
      setSearchingStock(false);
    }
  };

  // Select stock for order configuration
  const handleSelectStockForOrder = (stock: StockOptionItem) => {
    setActiveOrderStock(stock);
    setOrderBuyPrice(stock.current_price);
    setOrderTargetSell(stock.target_sell_price);
    setOrderStopLoss(stock.stop_loss_price);

    if (detail && stock.current_price > 0) {
      const currentInvested = Number(detail.invested_capital || 0);
      const startingCapital = Number(detail.initial_capital || 0);
      const remainingCapacity = startingCapital > 0 ? Math.max(0, startingCapital - currentInvested) : Number(detail.current_cash || 0);
      const maxSpendable = Math.min(Number(detail.current_cash || 0), remainingCapacity);

      if (maxSpendable >= stock.current_price) {
        const alloc = Math.min(maxSpendable, Math.max(stock.current_price, maxSpendable * 0.25));
        const calculatedQty = Math.max(1, Math.floor(alloc / stock.current_price));
        setOrderQuantity(calculatedQty);
      } else {
        setOrderQuantity(1);
      }
    } else {
      setOrderQuantity(1);
    }
  };

  // Confirm buy order
  const handleConfirmBuyOrder = async () => {
    if (!selectedSandboxId || !activeOrderStock || orderQuantity <= 0) return;
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
        setActiveOrderStock(null);
        setSearchedStockData(null);
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
  const handleSaveCustomTarget = async (posId: number) => {
    if (!selectedSandboxId) return;
    const val = parseFloat(customTargetInput);
    if (isNaN(val) || val <= 0) {
      setEditingTargetPosId(null);
      return;
    }
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
        setEditingTargetPosId(null);
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

  // Filter stocks according to picker source
  let currentDisplayStocks: StockOptionItem[] = [];
  if (pickerSource === "AI") {
    currentDisplayStocks = aiSuggestions.filter((item) => {
      if (aiSubTab === "ALL") return true;
      if (aiSubTab === "TOP") return item.is_top || item.tab.includes("Top");
      if (item.strategy_id === aiSubTab) return true;
      return item.tab.toLowerCase().includes(aiSubTab.toLowerCase()) ||
        (item.strategy_title && item.strategy_title.toLowerCase().includes(aiSubTab.toLowerCase()));
    });
  } else if (pickerSource === "WISHLIST") {
    currentDisplayStocks = wishlistStocks;
  } else if (pickerSource === "PORTFOLIO") {
    currentDisplayStocks = portfolioStocks;
  }

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
        <div className="space-y-6 animate-fade-in">
          {/* Top Bar with Back Button & Editable Name */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToDashboard}
                className="px-3 py-1.5 bg-bg-card hover:bg-bg-hover border border-border rounded-xl text-xs font-semibold text-txt-secondary hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>&larr;</span>
                <span>All Sandboxes</span>
              </button>

              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white">{detail.name}</h1>
                <button
                  onClick={() => setShowRenameModal(true)}
                  className="text-xs text-txt-muted hover:text-cyan-300 p-1 rounded hover:bg-bg-hover transition-colors"
                  title="Rename Sandbox"
                >
                  ✎
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowStockPickerModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all cursor-pointer"
              >
                <span className="text-sm">+</span>
                <span>Add Stocks</span>
              </button>
              <button
                onClick={() => setShowCapitalModal(true)}
                className="px-3.5 py-2 bg-bg-card hover:bg-bg-hover border border-border text-cyan-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                💵 Adjust Capital
              </button>
            </div>
          </div>

          {/* Unified 4-Tile Financial Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Tile 1: Total Starting Cash */}
            <div className="bg-bg-card border border-border rounded-2xl p-4 shadow-md">
              <span className="text-[11px] text-txt-muted block font-medium">Total Starting Cash</span>
              <div className="text-xl font-black text-white font-mono mt-1">
                ₹{Number(detail.initial_capital).toLocaleString("en-IN")}
              </div>
              <span className="text-[10px] text-txt-muted mt-1 block">Allocated Capital</span>
            </div>

            {/* Tile 2: Invested Cash */}
            <div className="bg-bg-card border border-border rounded-2xl p-4 shadow-md">
              <span className="text-[11px] text-txt-muted block font-medium">Invested Cash</span>
              <div className="text-xl font-black text-white font-mono mt-1">
                ₹{Number(detail.invested_capital).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
              <span className="text-[10px] text-txt-muted mt-1 block">Across {detail.positions.length} stocks</span>
            </div>

            {/* Tile 3: Balance Remaining */}
            <div className="bg-bg-card border border-border rounded-2xl p-4 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-txt-muted block font-medium">Balance Remaining</span>
                <button
                  onClick={() => setShowCapitalModal(true)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
                >
                  +/-
                </button>
              </div>
              <div className="text-xl font-black text-cyan-300 font-mono mt-1">
                ₹{Number(detail.current_cash).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
              <span className="text-[10px] text-txt-muted mt-1 block">Available for new orders</span>
            </div>

            {/* Tile 4: Net Profit & Loss */}
            <div className="bg-bg-card border border-border rounded-2xl p-4 shadow-md">
              <span className="text-[11px] text-txt-muted block font-medium">Net Profit & Loss</span>
              <div
                className={`text-xl font-black font-mono mt-1 ${
                  detail.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {detail.total_pnl >= 0 ? "+" : ""}₹{Number(detail.total_pnl).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
              <span
                className={`text-[11px] font-mono font-bold mt-1 block ${
                  detail.total_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {detail.total_pnl >= 0 ? "+" : ""}{detail.total_pnl_pct.toFixed(2)}% Return
              </span>
            </div>
          </div>

          {/* Active Stock Holdings Table */}
          <div className="bg-bg-card border border-border rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📈</span> Active Stock Holdings ({detail.positions.length})
                </h3>
                <p className="text-[11px] text-txt-muted mt-0.5">
                  Quantity and Target Price are directly editable. Live auto-pilot executes on Target or Stop-Loss.
                </p>
              </div>
              {detail.positions.length > 0 && (
                <button
                  onClick={() => setShowStockPickerModal(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-bold"
                >
                  + Add Stocks
                </button>
              )}
            </div>

            {detail.positions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl bg-bg-primary/30">
                <p className="text-xs font-semibold text-txt-secondary mb-1">Your sandbox is empty</p>
                <p className="text-[11px] text-txt-muted max-w-sm mx-auto mb-4">
                  Add stocks from AI recommendations (all 6 sub-tabs), your actual Wishlist, or your existing Portfolio!
                </p>
                <button
                  onClick={() => setShowStockPickerModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  + Add Stocks to Portfolio
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-txt-muted uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Stock</th>
                      <th className="py-2.5 px-3 text-center">Editable Quantity</th>
                      <th className="py-2.5 px-3 text-right">Avg Buy Price</th>
                      <th className="py-2.5 px-3 text-right">Total Invested</th>
                      <th className="py-2.5 px-3 text-right">Live CMP</th>
                      <th className="py-2.5 px-3 text-right">Unrealized P&L</th>
                      <th className="py-2.5 px-3 text-center">AI Target</th>
                      <th className="py-2.5 px-3 text-center">Custom Target</th>
                      <th className="py-2.5 px-3 text-center">Stop Loss</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {detail.positions.map((pos) => {
                      const isGain = pos.unrealized_pnl >= 0;
                      const isEditingTarget = editingTargetPosId === pos.id;

                      return (
                        <tr key={pos.id} className="hover:bg-bg-hover/40 transition-colors">
                          {/* Stock symbol & name */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{pos.symbol}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" title="Locked AI Entry Score (Snapshot at time of trade)">
                                [{pos.ai_score ?? "--"}]
                              </span>
                            </div>
                            <span className="text-[10px] text-txt-muted truncate max-w-[130px] block">{pos.name}</span>
                            {pos.created_at && (
                              <span className="text-[9.5px] text-txt-dim font-mono block mt-0.5 tracking-tight">
                                {formatDdMmYyyy(pos.created_at)}
                              </span>
                            )}
                          </td>

                          {/* Editable Quantity (+ and - steppers) */}
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1.5 font-mono">
                              <button
                                onClick={() => handleUpdateQuantity(pos, -1)}
                                disabled={actionLoading || Number(pos.quantity) <= 0}
                                className="w-6 h-6 rounded bg-bg-primary hover:bg-bg-hover text-txt-primary flex items-center justify-center font-bold text-xs disabled:opacity-40 cursor-pointer"
                                title="Reduce 1 share (credits cash)"
                              >
                                −
                              </button>
                              <span className="w-10 text-center font-bold text-white text-xs">
                                {Number(pos.quantity).toFixed(0)}
                              </span>
                              <button
                                onClick={() => handleUpdateQuantity(pos, 1)}
                                disabled={actionLoading}
                                className="w-6 h-6 rounded bg-bg-primary hover:bg-bg-hover text-txt-primary flex items-center justify-center font-bold text-xs cursor-pointer"
                                title="Add 1 share (deducts cash)"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Avg Buy Price */}
                          <td className="py-3 px-3 text-right font-mono text-txt-secondary">
                            ₹{Number(pos.avg_buy_price).toFixed(2)}
                          </td>

                          {/* Total Invested */}
                          <td className="py-3 px-3 text-right font-mono text-cyan-300 font-semibold">
                            ₹{(Number(pos.quantity) * Number(pos.avg_buy_price)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Live CMP */}
                          <td className="py-3 px-3 text-right font-mono text-white font-bold">
                            ₹{Number(pos.current_price || pos.avg_buy_price).toFixed(2)}
                          </td>

                          {/* Unrealized P&L */}
                          <td className="py-3 px-3 text-right">
                            <div className={`font-mono font-bold ${isGain ? "text-emerald-400" : "text-rose-400"}`}>
                              {isGain ? "+" : ""}₹{Number(pos.unrealized_pnl).toFixed(0)}
                            </div>
                            <div className={`text-[10px] font-mono ${isGain ? "text-emerald-400" : "text-rose-400"}`}>
                              {isGain ? "+" : ""}{pos.unrealized_pnl_pct.toFixed(2)}%
                            </div>
                          </td>

                          {/* AI Target (Preserved benchmark with Time Horizon) */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono text-cyan-300 font-semibold text-xs">
                              ₹{Number(pos.ai_target_price || pos.target_sell_price).toFixed(2)}
                            </span>
                            <span className="text-[9.5px] block font-mono text-cyan-400/90 font-medium tracking-tight">
                              {resolveStockAIHorizon(pos.symbol, pos.horizon)}
                            </span>
                          </td>

                          {/* Custom Target (Editable) */}
                          <td className="py-3 px-3 text-center">
                            {isEditingTarget ? (
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={customTargetInput}
                                  onChange={(e) => setCustomTargetInput(e.target.value)}
                                  className="w-18 px-1.5 py-0.5 rounded bg-bg-primary border border-cyan-400 text-white font-mono text-xs text-center"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveCustomTarget(pos.id)}
                                  className="text-xs text-emerald-400 font-bold px-1"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => setEditingTargetPosId(null)}
                                  className="text-xs text-txt-muted px-1"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingTargetPosId(pos.id);
                                  setCustomTargetInput(pos.custom_target_price ? pos.custom_target_price.toString() : (pos.ai_target_price || "").toString());
                                }}
                                className="cursor-pointer group flex items-center justify-center gap-1"
                                title="Click to customize target price"
                              >
                                <span className={`font-mono font-bold ${pos.custom_target_price ? "text-amber-300" : "text-txt-muted"}`}>
                                  {pos.custom_target_price ? `₹${Number(pos.custom_target_price).toFixed(2)}` : "Set Custom"}
                                </span>
                                <span className="text-[10px] text-txt-muted opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
                              </div>
                            )}
                          </td>

                          {/* Stop Loss */}
                          <td className="py-3 px-3 text-center font-mono text-rose-300">
                            {pos.stop_loss_price ? `₹${Number(pos.stop_loss_price).toFixed(2)}` : "—"}
                          </td>

                          {/* Action Exit & Delete */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSellPosition(pos.id, pos.symbol)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
                                title="Exit Sell at Live CMP (books realized P&L)"
                              >
                                Exit Sell
                              </button>
                              <button
                                onClick={() => handleDeletePosition(pos)}
                                disabled={actionLoading}
                                className="p-1 text-txt-muted hover:text-rose-400 hover:bg-rose-500/15 rounded-lg border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer text-xs"
                                title="Delete stock throughout from sandbox (refunds exact invested amount with 0 P&L booked)"
                              >
                                🗑️
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

          {/* ============================================================ */}
          {/* 50/50 DUAL-WING INTELLIGENCE CENTER                          */}
          {/* ============================================================ */}
          {(() => {
            // Computed Position Analytics
            const posAnalytics = detail.positions.map((pos) => {
              const cmp = pos.current_price || pos.avg_buy_price;
              const target = pos.custom_target_price || pos.ai_target_price || pos.target_sell_price || (pos.avg_buy_price * 1.15);
              const stopLoss = pos.stop_loss_price || (pos.avg_buy_price * 0.93);
              const horizon = resolveStockAIHorizon(pos.symbol, pos.horizon);

              // Time elapsed in days
              const buyDate = pos.created_at ? new Date(pos.created_at) : new Date();
              const daysElapsed = Math.max(1, Math.round((Date.now() - buyDate.getTime()) / (1000 * 60 * 60 * 24)));

              // Horizon duration bounds
              let horizonMaxDays = 30;
              if (horizon.includes("7 – 14") || horizon.includes("7D") || horizon.includes("1W")) horizonMaxDays = 14;
              else if (horizon.includes("14D – 1M") || horizon.includes("1M")) horizonMaxDays = 30;
              else if (horizon.includes("3M – 6M") || horizon.includes("3M")) horizonMaxDays = 180;
              else if (horizon.includes("6M – 1Y") || horizon.includes("6M")) horizonMaxDays = 365;
              else if (horizon.includes("1Y+")) horizonMaxDays = 540;

              // Proximity & Horizon Status
              const isTargetHit = cmp >= target;
              const isCloseToTarget = !isTargetHit && cmp >= target * 0.985; // within 1.5%
              const isNearStopLoss = cmp <= stopLoss * 1.025; // within 2.5% of stop loss
              const isExpired = daysElapsed > horizonMaxDays && !isTargetHit;
              const isOnTrack = !isExpired && !isNearStopLoss && !isTargetHit;

              const targetDistPct = ((target - cmp) / cmp) * 100;
              const stopDistPct = ((cmp - stopLoss) / cmp) * 100;
              const pnlPct = pos.unrealized_pnl_pct || (((cmp - pos.avg_buy_price) / pos.avg_buy_price) * 100);

              // Runway progress from Buy (0%) to Target (100%)
              const runwayPct = target > pos.avg_buy_price
                ? Math.max(0, Math.min(100, Math.round(((cmp - pos.avg_buy_price) / (target - pos.avg_buy_price)) * 100)))
                : 0;

              return {
                ...pos,
                cmp,
                target,
                stopLoss,
                horizon,
                daysElapsed,
                horizonMaxDays,
                isTargetHit,
                isCloseToTarget,
                isNearStopLoss,
                isExpired,
                isOnTrack,
                targetDistPct,
                stopDistPct,
                pnlPct,
                runwayPct,
              };
            });

            // 1. Target Hit / Close to Target
            const targetAchievedOrClose = posAnalytics.filter((p) => p.isTargetHit || p.isCloseToTarget);

            // 2. Active on Horizon (On-Track)
            const activeOnTrack = posAnalytics.filter((p) => p.isOnTrack);

            // 3. Horizon Expired / Target Missed
            const expiredMissed = posAnalytics.filter((p) => p.isExpired);

            // 4. Capital Defense Warning
            const capitalDefenseWarning = posAnalytics.filter((p) => p.isNearStopLoss);

            // 5. Alpha Leader vs. Drag
            const sortedByPnl = [...posAnalytics].sort((a, b) => b.pnlPct - a.pnlPct);
            const alphaLeader = sortedByPnl.length > 0 ? sortedByPnl[0] : null;
            const alphaDrag = sortedByPnl.length > 1 ? sortedByPnl[sortedByPnl.length - 1] : null;

            // 6. Capital Velocity & Holding Duration
            const avgHoldingDays = posAnalytics.length > 0
              ? Math.round(posAnalytics.reduce((acc, p) => acc + p.daysElapsed, 0) / posAnalytics.length)
              : 0;
            const capitalDeployed = detail.invested_capital || 0;
            const totalVal = detail.total_value || (capitalDeployed + detail.current_cash) || 1;
            const capitalDeployedPct = Math.min(100, Math.round((capitalDeployed / totalVal) * 100));

            // 7. Overall Sandbox Health Grade
            const winningPositions = posAnalytics.filter((p) => p.unrealized_pnl >= 0).length;
            const winRate = posAnalytics.length > 0 ? Math.round((winningPositions / posAnalytics.length) * 100) : 0;
            let healthGrade = "A+";
            let healthLabel = "Elite Conviction";
            let healthColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
            if (detail.total_pnl_pct >= 5 && winRate >= 65) {
              healthGrade = "A+";
              healthLabel = "Elite Conviction";
              healthColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
            } else if (detail.total_pnl_pct >= 1 || winRate >= 50) {
              healthGrade = "A";
              healthLabel = "Strong Momentum";
              healthColor = "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
            } else if (detail.total_pnl_pct >= -3) {
              healthGrade = "B";
              healthLabel = "Defensive Stance";
              healthColor = "text-amber-400 border-amber-500/30 bg-amber-500/10";
            } else {
              healthGrade = "C-";
              healthLabel = "Drawdown Alert";
              healthColor = "text-rose-400 border-rose-500/30 bg-rose-500/10";
            }

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* ====================================================== */}
                {/* LEFT WING: SANDBOX PERFORMANCE INTELLIGENCE SUMMARY    */}
                {/* ====================================================== */}
                <div className="bg-bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-border/70 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="text-cyan-400">⚡</span> Performance Intelligence Summary
                      </h3>
                      <p className="text-xs text-slate-300 font-medium mt-0.5">
                        Real-time AI telemetry, time horizon discipline, and risk monitor
                      </p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold font-mono flex items-center gap-1.5 ${healthColor}`}>
                      <span>GRADE {healthGrade}</span>
                      <span className="text-xs font-sans font-semibold text-cyan-200">({healthLabel})</span>
                    </div>
                  </div>

                  {posAnalytics.length === 0 ? (
                    <div className="text-center py-12 text-slate-300 text-xs font-medium">
                      No active positions yet. Add stocks to view live performance intelligence.
                    </div>
                  ) : (
                    <div className="space-y-3.5 text-xs">
                      {/* Metric 1: Target Achieved / Close to Exit */}
                      <div className="bg-bg-surface/70 border border-border/80 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <span>🎯</span> Target Hit / Close to Target
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            targetAchievedOrClose.length > 0 ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40" : "bg-slate-800 text-slate-200 border border-slate-700"
                          }`}>
                            {targetAchievedOrClose.length} Stocks
                          </span>
                        </div>
                        {targetAchievedOrClose.length === 0 ? (
                          <p className="text-xs text-slate-300 font-medium mt-1.5">
                            Autopilot tracking all stocks. No positions currently at or within 1.5% of target.
                          </p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {targetAchievedOrClose.map((p) => (
                              <div key={p.id} className="flex items-center justify-between text-xs bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-1.5">
                                <span className="font-bold text-emerald-300">
                                  {p.symbol} {p.isTargetHit ? "🎯 Hit Target!" : "⚡ Near Target (1.5%)"}
                                </span>
                                <span className="font-mono font-semibold text-slate-200">
                                  CMP ₹{p.cmp.toFixed(1)} / Tgt ₹{p.target.toFixed(1)} ({p.targetDistPct > 0 ? `+${p.targetDistPct.toFixed(1)}% to go` : "Target Met"})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Metric 2: Active on Horizon (On-Track) */}
                      <div className="bg-bg-surface/70 border border-border/80 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <span>⏳</span> Active on Horizon (On-Track)
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/40">
                            {activeOnTrack.length} Positions
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium mt-1">
                          Positions executing within expected time window and progressing towards target:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {activeOnTrack.slice(0, 4).map((p) => (
                            <span key={p.id} className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#111A2E] border border-cyan-500/40 text-xs">
                              <strong className="text-white font-bold">{p.symbol}</strong>
                              <span className="text-cyan-300 font-mono font-bold">Day {p.daysElapsed}/{p.horizonMaxDays}</span>
                              <span className={p.pnlPct >= 0 ? "text-emerald-300 font-mono font-bold" : "text-amber-300 font-mono font-bold"}>
                                {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%
                              </span>
                            </span>
                          ))}
                          {activeOnTrack.length > 4 && (
                            <span className="text-xs text-cyan-200 font-bold bg-slate-800 px-2.5 py-1 rounded border border-cyan-500/40 self-center">
                              +{activeOnTrack.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Metric 3: Horizon Expired / Target Missed */}
                      <div className="bg-bg-surface/70 border border-border/80 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <span>⚠️</span> Horizon Expired / Target Missed
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            expiredMissed.length > 0 ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-slate-800 text-slate-200 border border-slate-700"
                          }`}>
                            {expiredMissed.length} Overdue
                          </span>
                        </div>
                        {expiredMissed.length === 0 ? (
                          <p className="text-xs text-slate-300 font-medium mt-1.5">
                            Zero expired horizons. All stocks are within their defined AI time window.
                          </p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {expiredMissed.map((p) => (
                              <div key={p.id} className="flex items-center justify-between text-xs bg-amber-500/10 border border-amber-500/30 rounded px-2.5 py-1.5">
                                <span className="font-bold text-amber-300">
                                  {p.symbol} ({p.horizon}): {p.daysElapsed} days elapsed
                                </span>
                                <span className="font-mono font-semibold text-slate-200">
                                  CMP ₹{p.cmp.toFixed(1)} vs Tgt ₹{p.target.toFixed(1)} ({p.pnlPct.toFixed(1)}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Metric 4: Capital Defense Warning */}
                      <div className="bg-bg-surface/70 border border-border/80 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <span>🛡️</span> Capital Defense Monitor (Stop-Loss Proximity)
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            capitalDefenseWarning.length > 0 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          }`}>
                            {capitalDefenseWarning.length > 0 ? `${capitalDefenseWarning.length} at Risk` : "Shield Secure"}
                          </span>
                        </div>
                        {capitalDefenseWarning.length === 0 ? (
                          <p className="text-xs text-slate-300 font-medium mt-1.5">
                            Safe buffer maintained across all holdings. Zero positions within 2.5% of stop-loss.
                          </p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {capitalDefenseWarning.map((p) => (
                              <div key={p.id} className="flex items-center justify-between text-xs bg-rose-500/15 border border-rose-500/40 rounded px-2.5 py-1.5">
                                <span className="font-bold text-rose-300">
                                  🛑 {p.symbol}: Near Stop-Loss (₹{p.stopLoss.toFixed(1)})
                                </span>
                                <span className="font-mono font-semibold text-rose-300">
                                  Buffer: {p.stopDistPct.toFixed(1)}% (CMP ₹{p.cmp.toFixed(1)})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Metric 5: Alpha Leader vs Drag */}
                      <div className="bg-bg-surface/70 border border-border/80 rounded-xl p-3 grid grid-cols-2 gap-3">
                        <div className="border-r border-border/60 pr-2">
                          <span className="text-xs uppercase font-extrabold text-cyan-200 tracking-wider block mb-1">
                            🏆 Alpha Leader
                          </span>
                          {alphaLeader ? (
                            <div>
                              <div className="font-bold text-white text-sm">{alphaLeader.symbol}</div>
                              <div className="text-emerald-400 font-mono font-bold text-xs mt-0.5">
                                +{alphaLeader.pnlPct.toFixed(1)}% (+₹{Math.round(alphaLeader.unrealized_pnl).toLocaleString("en-IN")})
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </div>
                        <div className="pl-1">
                          <span className="text-xs uppercase font-extrabold text-cyan-200 tracking-wider block mb-1">
                            ⚓ Performance Drag
                          </span>
                          {alphaDrag ? (
                            <div>
                              <div className="font-bold text-white text-sm">{alphaDrag.symbol}</div>
                              <div className={`font-mono font-bold text-xs mt-0.5 ${alphaDrag.pnlPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {alphaDrag.pnlPct >= 0 ? "+" : ""}{alphaDrag.pnlPct.toFixed(1)}% ({alphaDrag.unrealized_pnl >= 0 ? "+" : ""}₹{Math.round(alphaDrag.unrealized_pnl).toLocaleString("en-IN")})
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </div>
                      </div>

                      {/* Metric 6: Capital Velocity & Holding Duration */}
                      <div className="bg-bg-surface/70 border border-border/80 rounded-xl p-3 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-xs uppercase font-extrabold text-cyan-200 tracking-wider block">
                            ⏱️ Avg Holding Duration
                          </span>
                          <span className="text-base font-bold font-mono text-white mt-0.5 block">
                            {avgHoldingDays} {avgHoldingDays === 1 ? "Day" : "Days"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs uppercase font-extrabold text-cyan-200 tracking-wider block">
                            💼 Capital Deployed
                          </span>
                          <span className="text-base font-bold font-mono text-cyan-300 mt-0.5 block">
                            {capitalDeployedPct}% <span className="text-slate-200 text-xs font-semibold font-sans">({posAnalytics.length} stocks)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ====================================================== */}
                {/* RIGHT WING: DYNAMIC VISUAL ANALYTICS SUITE (3 CHARTS)  */}
                {/* ====================================================== */}
                <div className="bg-bg-card border border-border rounded-2xl p-5 shadow-xl space-y-4">
                  {/* Dynamic Graph Tab Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="text-purple-400">📊</span> Visual Analytics Suite
                      </h3>
                      <p className="text-xs text-slate-300 font-medium mt-0.5">
                        Interactive runway, allocation donut & horizon matrix
                      </p>
                    </div>

                    {/* Chart Tabs */}
                    <div className="flex items-center gap-1 bg-bg-surface p-1 rounded-xl border border-border text-xs">
                      <button
                        onClick={() => setChartTab("RUNWAY")}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                          chartTab === "RUNWAY" ? "bg-cyan-500/25 text-cyan-200 border border-cyan-400" : "text-slate-300 hover:text-white"
                        }`}
                      >
                        <span>🎯</span> Runway
                      </button>
                      <button
                        onClick={() => setChartTab("ALLOCATION")}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                          chartTab === "ALLOCATION" ? "bg-purple-500/25 text-purple-200 border border-purple-400" : "text-slate-300 hover:text-white"
                        }`}
                      >
                        <span>🍩</span> Allocation
                      </button>
                      <button
                        onClick={() => setChartTab("HORIZON")}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                          chartTab === "HORIZON" ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400" : "text-slate-300 hover:text-white"
                        }`}
                      >
                        <span>🗺️</span> Horizon Map
                      </button>
                    </div>
                  </div>

                  {posAnalytics.length === 0 ? (
                    <div className="text-center py-12 text-slate-300 text-xs font-medium">
                      Visual charts will appear dynamically as you add stocks to this sandbox.
                    </div>
                  ) : (
                    <div>
                      {/* CHART 1: TARGET PROXIMITY RUNWAY */}
                      {chartTab === "RUNWAY" && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                            <span>Stock & Target Horizon</span>
                            <span>Stop-Loss ◄ Buy (0%) ► Target (100%)</span>
                          </div>

                          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                            {posAnalytics.map((p) => {
                              const isProfitable = p.cmp >= p.avg_buy_price;
                              const runwayColor = p.isTargetHit
                                ? "from-emerald-500 to-emerald-400"
                                : p.isCloseToTarget
                                ? "from-cyan-500 to-emerald-400"
                                : isProfitable
                                ? "from-blue-600 to-cyan-400"
                                : "from-rose-600 to-amber-500";

                              return (
                                <div key={p.id} className="bg-bg-surface/80 border border-border/80 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white text-sm">{p.symbol}</span>
                                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#111A2E] text-cyan-200 border border-cyan-500/40">
                                        {p.horizon}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-xs">
                                      <span className="text-slate-200 font-medium">CMP: ₹{p.cmp.toFixed(1)}</span>
                                      <span className={`font-bold ${p.pnlPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        ({p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%)
                                      </span>
                                    </div>
                                  </div>

                                  {/* Runway Progress Bar */}
                                  <div className="relative pt-1">
                                    <div className="h-3 w-full bg-slate-900/90 rounded-full border border-border/70 overflow-hidden relative">
                                      {/* Target fill bar */}
                                      <div
                                        className={`h-full bg-gradient-to-r ${runwayColor} transition-all duration-500 rounded-full`}
                                        style={{ width: `${Math.max(4, p.runwayPct)}%` }}
                                      />
                                    </div>

                                    {/* Markers and labels */}
                                    <div className="flex items-center justify-between text-xs text-slate-200 mt-1 font-mono font-semibold">
                                      <span className="text-rose-300 font-bold">🛑 SL: ₹{p.stopLoss.toFixed(1)}</span>
                                      <span className="text-slate-200">Buy: ₹{p.avg_buy_price.toFixed(1)}</span>
                                      <span className="text-emerald-300 font-bold">🎯 Tgt: ₹{p.target.toFixed(1)}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                                    <span className="text-slate-200">
                                      Holding: <strong className="text-white font-bold">{p.daysElapsed} days</strong> ({p.daysElapsed <= p.horizonMaxDays ? `${p.horizonMaxDays - p.daysElapsed}d remaining` : `${p.daysElapsed - p.horizonMaxDays}d overdue`})
                                    </span>
                                    <span className="font-bold text-cyan-300">
                                      {p.isTargetHit ? "🎯 Target Achieved" : `${p.runwayPct}% Runway Completed`}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* CHART 2: CAPITAL ALLOCATION & CASH RESERVE DONUT */}
                      {chartTab === "ALLOCATION" && (() => {
                        const totalPortfolioVal = detail.total_value || 1;
                        const cashPct = Math.round((detail.current_cash / totalPortfolioVal) * 100);

                        // Donut slices
                        const palette = ["#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#3b82f6", "#14b8a6", "#6366f1", "#06b6d4"];
                        const stockSlices = posAnalytics.map((p, idx) => {
                          const val = p.current_value || (p.quantity * p.cmp);
                          const pct = Math.round((val / totalPortfolioVal) * 100);
                          return {
                            symbol: p.symbol,
                            value: val,
                            pct,
                            color: palette[idx % palette.length],
                          };
                        });

                        // High concentration warning (> 30%)
                        const concentratedStocks = stockSlices.filter((s) => s.pct > 30);

                        // Precise SVG Arc calculations (eliminates dash hit-test collisions)
                        const allSlices = [
                          {
                            symbol: "Cash Reserve",
                            value: Math.max(0, detail.current_cash || 0),
                            pct: cashPct,
                            color: "#06b6d4",
                          },
                          ...stockSlices,
                        ];

                        const totalSlicesVal = allSlices.reduce((acc, s) => acc + s.value, 0) || 1;
                        let accumulatedAngle = -Math.PI / 2; // Start from top (12 o'clock)
                        const R = 39; // Radius
                        const cx = 50;
                        const cy = 50;

                        const arcSlices = allSlices.map((s) => {
                          const fraction = Math.max(0.001, s.value / totalSlicesVal);
                          const sliceAngle = fraction * 2 * Math.PI;
                          const startAngle = accumulatedAngle;
                          const endAngle = accumulatedAngle + sliceAngle;
                          accumulatedAngle = endAngle;

                          const x1 = cx + R * Math.cos(startAngle);
                          const y1 = cy + R * Math.sin(startAngle);
                          const safeEnd = Math.min(endAngle, startAngle + 2 * Math.PI - 0.001);
                          const x2 = cx + R * Math.cos(safeEnd);
                          const y2 = cy + R * Math.sin(safeEnd);
                          const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
                          const pathD = `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R} ${R} 0 ${largeArcFlag} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;

                          return {
                            ...s,
                            pathD,
                            sliceAngle,
                          };
                        });

                        return (
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                              {/* SVG Donut */}
                              <div className="relative w-44 h-44 flex items-center justify-center">
                                <svg
                                  className="w-full h-full"
                                  viewBox="0 0 100 100"
                                  onMouseLeave={() => setHoveredSlice(null)}
                                >
                                  {arcSlices.map((s) => {
                                    const isHovered = hoveredSlice === s.symbol;
                                    const isDimmed = Boolean(hoveredSlice && !isHovered);

                                    return (
                                      <path
                                        key={s.symbol}
                                        d={s.pathD}
                                        fill="none"
                                        stroke={s.color}
                                        strokeWidth={isHovered ? 15 : 12}
                                        strokeLinecap="butt"
                                        opacity={isDimmed ? 0.35 : 1}
                                        className="transition-all duration-150 cursor-pointer"
                                        onMouseEnter={() => setHoveredSlice(s.symbol)}
                                        onMouseLeave={() => setHoveredSlice(null)}
                                      >
                                        <title>{s.symbol}</title>
                                      </path>
                                    );
                                  })}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
                                  {hoveredSlice ? (
                                    <div className="transition-all duration-150">
                                      <span className="text-sm font-extrabold text-white tracking-wider block truncate max-w-[120px] drop-shadow-md">
                                        {hoveredSlice}
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="text-xs text-slate-300 uppercase font-extrabold tracking-wider">Total Value</span>
                                      <span className="text-xs font-mono font-bold text-white">
                                        ₹{Math.round(totalPortfolioVal).toLocaleString("en-IN")}
                                      </span>
                                      <span className="text-xs font-mono font-bold text-cyan-300">
                                        {cashPct}% Cash
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Breakdown Legend */}
                              <div className="space-y-1.5 flex-1 max-h-[220px] overflow-y-auto pr-1 text-xs">
                                <div
                                  className={`flex items-center justify-between p-1.5 rounded transition-all cursor-pointer border ${
                                    hoveredSlice === "Cash Reserve" ? "bg-cyan-500/25 border-cyan-400 ring-1 ring-cyan-400" : "bg-cyan-500/10 border-cyan-500/20"
                                  }`}
                                  onMouseEnter={() => setHoveredSlice("Cash Reserve")}
                                  onMouseLeave={() => setHoveredSlice(null)}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                                    <span className="font-semibold text-white">Cash Reserve</span>
                                  </div>
                                  <div className="font-mono text-right">
                                    <strong className="text-cyan-300">₹{Math.round(detail.current_cash).toLocaleString("en-IN")}</strong>
                                    <span className="text-slate-300 text-xs ml-1.5 font-semibold">({cashPct}%)</span>
                                  </div>
                                </div>

                                {stockSlices.map((s) => (
                                  <div
                                    key={s.symbol}
                                    className={`flex items-center justify-between p-1.5 rounded transition-all cursor-pointer border ${
                                      hoveredSlice === s.symbol ? "bg-white/10 border-white/40 ring-1 ring-white/30" : "bg-bg-surface border-border/60"
                                    }`}
                                    onMouseEnter={() => setHoveredSlice(s.symbol)}
                                    onMouseLeave={() => setHoveredSlice(null)}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                      <span className="font-bold text-white">{s.symbol}</span>
                                    </div>
                                    <div className="font-mono text-right">
                                      <span className="text-slate-200 font-semibold">₹{Math.round(s.value).toLocaleString("en-IN")}</span>
                                      <span className="text-slate-300 text-xs ml-1.5 font-semibold">({s.pct}%)</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {concentratedStocks.length > 0 && (
                              <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
                                <span>⚠️</span>
                                <span>Concentration Alert: <strong>{concentratedStocks.map(s => s.symbol).join(", ")}</strong> exceeds 30% of total sandbox capital.</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* CHART 3: TIME HORIZON STRATEGY DISTRIBUTION MAP */}
                      {chartTab === "HORIZON" && (() => {
                        const buckets: { title: string; range: string; icon: string; items: typeof posAnalytics }[] = [
                          {
                            title: "Ultra Short-Term",
                            range: "7 – 14 Days",
                            icon: "⚡",
                            items: posAnalytics.filter((p) => p.horizon.includes("7 – 14") || p.horizon.includes("7D") || p.horizon.includes("1W")),
                          },
                          {
                            title: "Momentum Swing",
                            range: "14D – 1M",
                            icon: "🚀",
                            items: posAnalytics.filter((p) => p.horizon.includes("14D – 1M") || p.horizon.includes("1M")),
                          },
                          {
                            title: "Positional Growth",
                            range: "3M – 6M",
                            icon: "📈",
                            items: posAnalytics.filter((p) => p.horizon.includes("3M – 6M") || p.horizon.includes("3M")),
                          },
                          {
                            title: "Core Compounder",
                            range: "6M – 1Y+",
                            icon: "🏛️",
                            items: posAnalytics.filter((p) => p.horizon.includes("6M") || p.horizon.includes("1Y") || p.horizon.includes("Flexible")),
                          },
                        ];

                        return (
                          <div className="space-y-3">
                            <p className="text-xs text-slate-300 font-medium">
                              Stocks classified by AI conviction timeframe, tracking target deadlines & drift.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                              {buckets.map((b) => (
                                <div key={b.range} className="bg-bg-surface/80 border border-border/80 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span>{b.icon}</span>
                                      <span className="font-bold text-white text-xs">{b.title}</span>
                                    </div>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#111A2E] text-cyan-200 border border-cyan-500/40">
                                      {b.range}
                                    </span>
                                  </div>

                                  {b.items.length === 0 ? (
                                    <div className="text-xs text-slate-300 py-2 text-center font-medium">
                                      0 positions in this horizon
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {b.items.map((p) => (
                                        <div key={p.id} className="p-2 rounded bg-bg-card border border-border/60 text-xs space-y-1">
                                          <div className="flex items-center justify-between">
                                            <strong className="text-white font-bold">{p.symbol}</strong>
                                            <span className={`font-mono font-bold ${p.pnlPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                              {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between text-xs text-slate-300 font-mono font-semibold">
                                            <span>Day {p.daysElapsed}/{p.horizonMaxDays}</span>
                                            <span className={p.isExpired ? "text-amber-300 font-bold" : "text-emerald-300 font-bold"}>
                                              {p.isExpired ? "⚠️ Overdue" : "🟢 On Schedule"}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
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
      {showStockPickerModal && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0E1524] border border-cyan-500/40 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>➕</span> Add Stocks to "{detail.name}"
                </h3>
                <p className="text-[11px] text-txt-muted mt-0.5">
                  Available virtual cash: <strong className="text-cyan-300">₹{Number(detail.current_cash).toLocaleString("en-IN")}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowStockPickerModal(false);
                  setActiveOrderStock(null);
                  setSearchedStockData(null);
                }}
                className="text-txt-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Source Selection Tabs */}
            <div className="px-5 pt-3 border-b border-border flex gap-2 overflow-x-auto text-xs">
              <button
                onClick={() => { setPickerSource("AI"); setActiveOrderStock(null); }}
                className={`py-2 px-3 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  pickerSource === "AI" ? "border-cyan-400 text-cyan-300" : "border-transparent text-txt-muted hover:text-white"
                }`}
              >
                <span>🤖</span> AI Intelligence (6 Sub-Tabs)
              </button>
              <button
                onClick={() => { setPickerSource("WISHLIST"); setActiveOrderStock(null); }}
                className={`py-2 px-3 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  pickerSource === "WISHLIST" ? "border-amber-400 text-amber-300" : "border-transparent text-txt-muted hover:text-white"
                }`}
              >
                <span>📁</span> My Actual Wishlist ({wishlistStocks.length})
              </button>
              <button
                onClick={() => { setPickerSource("PORTFOLIO"); setActiveOrderStock(null); }}
                className={`py-2 px-3 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  pickerSource === "PORTFOLIO" ? "border-emerald-400 text-emerald-300" : "border-transparent text-txt-muted hover:text-white"
                }`}
              >
                <span>💼</span> My Real Portfolio ({portfolioStocks.length})
              </button>
              <button
                onClick={() => { setPickerSource("SEARCH"); setActiveOrderStock(null); }}
                className={`py-2 px-3 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  pickerSource === "SEARCH" ? "border-purple-400 text-purple-300" : "border-transparent text-txt-muted hover:text-white"
                }`}
              >
                <span>🔍</span> Search Any Symbol
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs flex-1">
              {/* If SEARCH Source is chosen */}
              {pickerSource === "SEARCH" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchStock()}
                      placeholder="Type any NSE stock symbol (e.g. RELIANCE, SBIN, TCS, ZOMATO)..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-bg-primary border border-border text-white font-semibold focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      onClick={handleSearchStock}
                      disabled={searchingStock || !searchQuery.trim()}
                      className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                      {searchingStock ? "Searching..." : "Search"}
                    </button>
                  </div>

                  {searchedStockData && (
                    <div className="bg-[#121B2F] border border-cyan-400/50 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-white text-sm">{searchedStockData.symbol}</span>
                          <span className="text-[11px] text-txt-muted ml-2">{searchedStockData.name}</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded font-bold bg-cyan-500/20 text-cyan-300">
                          Score {searchedStockData.score}/100 • {searchedStockData.verdict}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-1 text-center bg-bg-primary/50 rounded-lg p-2 font-mono">
                        <div>
                          <span className="text-[10px] text-txt-muted block">Live CMP</span>
                          <span className="font-bold text-white">₹{searchedStockData.current_price.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-400 block">Suggested Buy</span>
                          <span className="font-bold text-emerald-300">₹{searchedStockData.target_buy_price.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-cyan-400 block">Suggested Target</span>
                          <span className="font-bold text-cyan-300">₹{searchedStockData.target_sell_price.toFixed(2)}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectStockForOrder(searchedStockData)}
                        className="w-full py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold rounded-lg text-xs transition-all shadow-md"
                      >
                        Select & Configure {searchedStockData.symbol} &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* AI Strategy Sub-Tabs (When AI is chosen) */}
              {pickerSource === "AI" && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
                  {[
                    { key: "ALL", label: "All Ranked AI Setups" },
                    { key: "TOP", label: "★ Top 6 Market-Wide" },
                    { key: "fast_breakouts", label: "1. ⚡ Fast Breakouts (7-14D)" },
                    { key: "bargain_dips", label: "2. 📉 Bargain Dips (14D-1M)" },
                    { key: "growth_rockets", label: "3. 🚀 Multibagger Rockets (3-6M)" },
                    { key: "sector_tailwinds", label: "4. 🌊 Sector Tailwinds (6M-1Y)" },
                    { key: "monopoly_compounders", label: "5. 🏰 Monopoly Compounders (1-3Y)" },
                    { key: "value_compounders", label: "6. 💎 Value Compounders (PEG < 1.0)" },
                  ].map((sub) => (
                    <button
                      key={sub.key}
                      onClick={() => setAiSubTab(sub.key)}
                      className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition-colors cursor-pointer ${
                        aiSubTab === sub.key
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-sm"
                          : "bg-bg-primary border-border text-txt-secondary hover:text-white"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Order Config Drawer (when a stock is selected) */}
              {activeOrderStock && (
                <div className="bg-[#101A2D] border-2 border-emerald-500/40 rounded-xl p-4 space-y-3 animate-fade-in shadow-xl">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-sm font-bold text-white">
                      Configure Buy Order: <strong className="text-emerald-400">{activeOrderStock.symbol}</strong>
                    </span>
                    <button onClick={() => setActiveOrderStock(null)} className="text-txt-muted hover:text-white text-xs">
                      ✕ Cancel Selection
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div>
                      <label className="text-[10px] text-txt-muted block mb-1">Buy Price (CMP)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={orderBuyPrice}
                        onChange={(e) => setOrderBuyPrice(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded bg-bg-primary border border-border text-white text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-txt-muted block mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded bg-bg-primary border border-border text-white text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-emerald-400 block mb-1">Suggested Target (₹)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={orderTargetSell}
                        onChange={(e) => setOrderTargetSell(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded bg-bg-primary border border-border text-emerald-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-rose-400 block mb-1">Stop Loss (₹)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={orderStopLoss}
                        onChange={(e) => setOrderStopLoss(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded bg-bg-primary border border-border text-rose-300 text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Quantity quick pills & Total Invested Highlight */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-bg-primary/80 border border-border text-xs">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-txt-muted">Quick Qty:</span>
                      {[1, 5, 10, 25, 50].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setOrderQuantity(q)}
                          className={`px-2 py-0.5 rounded border ${
                            orderQuantity === q ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold" : "bg-bg-card border-border text-txt-secondary"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[11px] text-txt-muted">Total Money Invested:</span>
                      <span className="text-sm font-bold font-mono text-cyan-300">
                        ₹{(orderBuyPrice * orderQuantity).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Validation warnings */}
                  {(() => {
                    const cost = orderBuyPrice * orderQuantity;
                    const invested = detail ? Number(detail.invested_capital || 0) : 0;
                    const startingCash = detail ? Number(detail.initial_capital || 0) : 0;
                    const cash = detail ? Number(detail.current_cash || 0) : 0;
                    const wouldExceedStarting = startingCash > 0 && (invested + cost) > startingCash;
                    const wouldExceedCash = cost > cash;

                    if (wouldExceedStarting) {
                      const avail = Math.max(0, startingCash - invested);
                      return (
                        <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 font-mono">
                          ⚠️ <strong>Starting Cash Limit:</strong> Order of ₹{cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })} would push total invested to ₹{(invested + cost).toLocaleString("en-IN", { maximumFractionDigits: 0 })}, exceeding Total Starting Cash (₹{startingCash.toLocaleString("en-IN", { maximumFractionDigits: 0 })}).
                          <span className="block text-[10px] text-txt-muted mt-0.5">Remaining allowable investment capacity: ₹{avail.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                        </div>
                      );
                    }
                    if (wouldExceedCash) {
                      return (
                        <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 font-mono">
                          ⚠️ <strong>Insufficient Balance:</strong> Order of ₹{cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })} exceeds available cash (₹{cash.toLocaleString("en-IN", { maximumFractionDigits: 0 })}).
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <button
                    onClick={handleConfirmBuyOrder}
                    disabled={
                      actionLoading ||
                      orderQuantity <= 0 ||
                      (orderBuyPrice * orderQuantity) > detail.current_cash ||
                      (detail.initial_capital > 0 && ((Number(detail.invested_capital || 0) + (orderBuyPrice * orderQuantity)) > detail.initial_capital))
                    }
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold rounded-xl text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    Confirm & Add to Portfolio
                  </button>
                </div>
              )}

              {/* Stock List Display (Sorted by highest score first) */}
              {pickerSource !== "SEARCH" && (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {currentDisplayStocks.length === 0 ? (
                    <div className="text-center py-8 text-txt-muted text-xs">
                      No stocks found in this category.
                    </div>
                  ) : (
                    currentDisplayStocks.map((item) => (
                      <div
                        key={item.symbol}
                        className="bg-bg-card border border-border hover:border-cyan-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-white text-xs">{item.symbol}</span>
                            <span className="text-[10px] text-txt-muted truncate max-w-[140px]">{item.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-primary border border-border text-cyan-300 font-bold">
                              {item.tab}
                            </span>
                            {item.horizon_label && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 font-medium">
                                {item.horizon_label}
                              </span>
                            )}
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                              {item.score}/100 • {item.verdict}
                            </span>
                          </div>
                          <p className="text-[10px] text-txt-secondary line-clamp-1">{item.rationale}</p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-[11px] shrink-0">
                          <div>
                            <span className="text-[9px] text-txt-muted block">Live CMP</span>
                            <span className="font-bold text-white">₹{item.current_price.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-cyan-400 block">Buy Target</span>
                            <span className="font-bold text-cyan-300">₹{item.target_buy_price.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-emerald-400 block">
                              Sell Target {item.upside_pct ? `(+${item.upside_pct.toFixed(0)}%)` : ""}
                            </span>
                            <span className="font-bold text-emerald-300">₹{item.target_sell_price.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-rose-400 block">Stop Loss</span>
                            <span className="font-bold text-rose-300">₹{item.stop_loss_price.toFixed(2)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectStockForOrder(item)}
                            className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ml-1"
                          >
                            + Pick
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
