"use client";

import { useState } from "react";
import type { StockOptionItem, ArenaSandboxDetail } from "./ArenaTypes";

type StockPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  detail: ArenaSandboxDetail;
  // Stock sources
  aiSuggestions: StockOptionItem[];
  wishlistStocks: StockOptionItem[];
  portfolioStocks: StockOptionItem[];
  // Callbacks
  onConfirmBuyOrder: (
    activeOrderStock: StockOptionItem,
    orderQuantity: number,
    orderBuyPrice: number,
    orderTargetSell: number,
    orderStopLoss: number
  ) => Promise<void>;
  onSearchStock: (query: string) => Promise<StockOptionItem | null>;
  actionLoading: boolean;
  notify: (msg: string) => void;
};

export default function StockPickerModal({
  isOpen,
  onClose,
  detail,
  aiSuggestions,
  wishlistStocks,
  portfolioStocks,
  onConfirmBuyOrder,
  onSearchStock,
  actionLoading,
  notify,
}: StockPickerModalProps) {
  const [pickerSource, setPickerSource] = useState<"AI" | "WISHLIST" | "PORTFOLIO" | "SEARCH">("AI");
  const [aiSubTab, setAiSubTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedStockData, setSearchedStockData] = useState<StockOptionItem | null>(null);
  const [searchingStock, setSearchingStock] = useState(false);

  // Active stock order configuration
  const [activeOrderStock, setActiveOrderStock] = useState<StockOptionItem | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<number>(10);
  const [orderBuyPrice, setOrderBuyPrice] = useState<number>(0);
  const [orderTargetSell, setOrderTargetSell] = useState<number>(0);
  const [orderStopLoss, setOrderStopLoss] = useState<number>(0);

  if (!isOpen) return null;

  // Search stock manually
  const handleSearchStock = async () => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return;
    setSearchingStock(true);
    try {
      const result = await onSearchStock(q);
      if (result) {
        setSearchedStockData(result);
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
    if (!activeOrderStock || orderQuantity <= 0) return;
    await onConfirmBuyOrder(activeOrderStock, orderQuantity, orderBuyPrice, orderTargetSell, orderStopLoss);
    setActiveOrderStock(null);
    setSearchedStockData(null);
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#0E1524] border border-cyan-500/40 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>➕</span> Add Stocks to &quot;{detail.name}&quot;
            </h3>
            <p className="text-[11px] text-txt-muted mt-0.5">
              Available virtual cash: <strong className="text-cyan-300">₹{Number(detail.current_cash).toLocaleString("en-IN")}</strong>
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
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
  );
}
