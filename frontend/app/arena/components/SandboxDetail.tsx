"use client";

import { useState } from "react";
import type { ArenaSandboxDetail, ArenaPosition } from "./ArenaTypes";

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

type SandboxDetailProps = {
  detail: ArenaSandboxDetail;
  actionLoading: boolean;
  onBackToDashboard: () => void;
  onShowStockPicker: () => void;
  onShowCapitalModal: () => void;
  onShowRenameModal: () => void;
  onUpdateQuantity: (pos: ArenaPosition, delta: number) => Promise<void>;
  onSaveCustomTarget: (posId: number, value: number) => Promise<void>;
  onSellPosition: (posId: number, symbol: string) => Promise<void>;
  onDeletePosition: (pos: ArenaPosition) => Promise<void>;
};

export default function SandboxDetail({
  detail,
  actionLoading,
  onBackToDashboard,
  onShowStockPicker,
  onShowCapitalModal,
  onShowRenameModal,
  onUpdateQuantity,
  onSaveCustomTarget,
  onSellPosition,
  onDeletePosition,
}: SandboxDetailProps) {
  // Inline editing states for positions table
  const [editingTargetPosId, setEditingTargetPosId] = useState<number | null>(null);
  const [customTargetInput, setCustomTargetInput] = useState<string>("");

  // Intelligence Center Chart Tab
  const [chartTab, setChartTab] = useState<"RUNWAY" | "ALLOCATION" | "HORIZON">("RUNWAY");
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const handleSaveCustomTarget = async (posId: number) => {
    const val = parseFloat(customTargetInput);
    if (isNaN(val) || val <= 0) {
      setEditingTargetPosId(null);
      return;
    }
    await onSaveCustomTarget(posId, val);
    setEditingTargetPosId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Bar with Back Button & Editable Name */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="px-3 py-1.5 bg-bg-card hover:bg-bg-hover border border-border rounded-xl text-xs font-semibold text-txt-secondary hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>&larr;</span>
            <span>All Sandboxes</span>
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-white">
              {detail.name}
              <span className="ml-2 text-xs font-normal text-txt-muted">
                {detail.created_at ? new Date(detail.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-") : ""}
              </span>
            </h1>
            <button
              onClick={onShowRenameModal}
              className="text-xs text-txt-muted hover:text-cyan-300 p-1 rounded hover:bg-bg-hover transition-colors"
              title="Rename Sandbox"
            >
              ✎
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onShowStockPicker}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all cursor-pointer"
          >
            <span className="text-sm">+</span>
            <span>Add Stocks</span>
          </button>
          <button
            onClick={onShowCapitalModal}
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
              onClick={onShowCapitalModal}
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
              onClick={onShowStockPicker}
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
              onClick={onShowStockPicker}
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
                            onClick={() => onUpdateQuantity(pos, -1)}
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
                            onClick={() => onUpdateQuantity(pos, 1)}
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
                            onClick={() => onSellPosition(pos.id, pos.symbol)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
                            title="Exit Sell at Live CMP (books realized P&L)"
                          >
                            Exit Sell
                          </button>
                          <button
                            onClick={() => onDeletePosition(pos)}
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
                        <span className="text-slate-300 text-xs">{"—"}</span>
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
                        <span className="text-slate-300 text-xs">{"—"}</span>
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
  );
}
