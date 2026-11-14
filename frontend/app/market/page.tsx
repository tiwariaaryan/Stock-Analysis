"use client";
import { useState, useEffect } from "react";
import StockModal from "@/components/StockModal";
import DrawdownScanner from "@/components/DrawdownScanner";
import MarketHeatmap from "@/components/MarketHeatmap";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
type Stock = { symbol: string; name: string; sector: string | null; price: number | null; change_pct: number | null };

type MarketView = "stocks" | "scanner" | "heatmap";

export default function MarketPage() {
  const [view, setView] = useState<MarketView>("stocks");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStocks = () => {
    fetch(`${API}/api/v1/market/stocks`).then(r => r.json()).then(setStocks).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadStocks(); }, []);

  useEffect(() => {
    const onFocus = () => loadStocks();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const [searchResults, setSearchResults] = useState<Stock[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Debounced live market search as user types
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      fetch(`${API}/api/v1/market/search?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setSearchResults(data);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(timer);
  }, [search]);

  function handleSearch() {
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    fetch(`${API}/api/v1/market/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSearchResults(data);
      })
      .catch(() => {})
      .finally(() => setSearching(false));
  }

  function clearSearch() {
    setSearch("");
    setSearchResults(null);
    setSearching(false);
  }

  const isSearchingActive = search.trim().length > 0;
  const filtered = isSearchingActive
    ? (searchResults || stocks.filter(s => s.symbol.includes(search.toUpperCase()) || s.name.toUpperCase().includes(search.toUpperCase())))
    : stocks;

  const fmt = (n: number | null) => n == null ? null : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const views = [
    { key: "stocks", label: "Stock List" },
    { key: "scanner", label: "52W Drawdown & Movers" },
    { key: "heatmap", label: "Sector Heatmap" },
  ] as const;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-txt-primary">Live Market</h2>
          <p className="text-xs text-txt-muted mt-1">Click any stock for detailed view &middot; Hit &quot;Refresh Prices&quot; to update</p>
        </div>
        <div className="flex gap-1 bg-bg-primary rounded-lg p-1">
          {views.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === v.key ? "bg-accent text-white" : "text-txt-muted hover:text-txt-primary"}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search — visible in stock list view */}
      {view === "stocks" && (
        <div className="mb-6 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Search any Indian stock or ETF (e.g. ITBEE, TATAMOTORS, SUZLON, RELIANCE)..."
                className="w-full bg-bg-input border border-border rounded-lg pl-4 pr-10 py-2.5 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50 transition-colors"
              />
              {search && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-dim hover:text-txt-primary p-1 text-xs"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {searching ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <span>Search</span>
              )}
            </button>
          </div>

          {isSearchingActive && (
            <div className="flex items-center justify-between px-1 text-xs text-txt-muted">
              <span>
                {searching ? "Searching live market..." : `Showing search results for "${search}" (${filtered.length} found)`}
              </span>
              <button onClick={clearSearch} className="text-accent-light hover:underline">
                Clear and show popular stocks
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stock List View */}
      {view === "stocks" && (
        <>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[76px] bg-bg-card rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((s, idx) => {
                const hasPrice = s.price != null;
                const up = (s.change_pct ?? 0) >= 0;
                return (
                  <button key={`mkt-${s.symbol}-${idx}`} onClick={() => setSelected(s.symbol)}
                    className="bg-bg-card border border-border rounded-lg px-4 py-3 text-left hover:border-border-hover transition-colors group flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-txt-primary group-hover:text-accent-light transition-colors">{s.symbol}</p>
                      <p className="text-[11px] text-txt-muted mt-0.5">{s.name}</p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      {hasPrice ? (
                        <div>
                          <p className="text-sm font-mono font-semibold text-txt-primary">₹{fmt(s.price)}</p>
                          {s.change_pct != null && (
                            <p className={`text-[11px] font-medium text-right ${up ? "text-gain" : "text-loss"}`}>
                              {up ? "+" : ""}{s.change_pct.toFixed(2)}%
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-txt-dim">—</span>
                      )}
                      {s.sector && <span className="text-[10px] text-txt-dim bg-bg-primary px-2 py-0.5 rounded">{s.sector}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {filtered.length === 0 && !loading && search.trim() && (
            <div className="text-center py-12">
              <p className="text-sm text-txt-secondary mb-3">No match for &ldquo;{search}&rdquo;</p>
              <button onClick={handleSearch}
                className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dark transition-colors">
                Fetch &ldquo;{search.toUpperCase()}&rdquo; from market
              </button>
            </div>
          )}
        </>
      )}

      {/* Drawdown Scanner View */}
      {view === "scanner" && (
        <DrawdownScanner onStockClick={(sym) => setSelected(sym)} />
      )}

      {/* Heatmap View */}
      {view === "heatmap" && (
        <MarketHeatmap onStockClick={(sym) => setSelected(sym)} />
      )}

      {selected && <StockModal symbol={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
