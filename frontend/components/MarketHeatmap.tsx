"use client";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type HeatmapStock = { symbol: string; name: string; price: number; change_pct: number; market_cap: number };
type Sector = { name: string; total_cap: number; stocks: HeatmapStock[] };

function getColor(pct: number): string {
  if (pct >= 3) return "#00c853";
  if (pct >= 1) return "#2e7d32";
  if (pct >= 0) return "#1b4332";
  if (pct >= -1) return "#4a1a1a";
  if (pct >= -3) return "#b71c1c";
  return "#ff5252";
}

export default function MarketHeatmap({ onStockClick }: { onStockClick: (sym: string) => void }) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupSectors, setGroupSectors] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/v1/market/heatmap`)
      .then(r => r.json())
      .then(d => setSectors(d.sectors || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-[500px] bg-bg-card rounded-xl animate-pulse" />;
  }

  if (!sectors.length) {
    return <p className="text-sm text-txt-muted text-center py-10">No heatmap data. Click &quot;Refresh Prices&quot; first.</p>;
  }

  const allStocks = sectors.flatMap(s => s.stocks.map(st => ({ ...st, sector: s.name })));
  const totalCap = allStocks.reduce((sum, s) => sum + (s.market_cap || 1), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-xs text-txt-muted">Size: Market Cap</span>
          <span className="text-xs text-txt-muted">Color: 1-Day % Change</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-txt-muted">Group Sectors</span>
          <button onClick={() => setGroupSectors(!groupSectors)}
            className={`w-9 h-5 rounded-full transition-colors relative ${groupSectors ? "bg-accent" : "bg-bg-input border border-border"}`}>
            <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${groupSectors ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
          </button>
        </label>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-0.5 text-[10px]">
          <span className="text-txt-dim">-3%</span>
          <div className="flex h-3">
            {["#ff5252","#b71c1c","#4a1a1a","#1b4332","#2e7d32","#00c853"].map(c => (
              <div key={c} className="w-6 h-full" style={{ background: c }} />
            ))}
          </div>
          <span className="text-txt-dim">+3%</span>
        </div>
      </div>

      {groupSectors ? (
        <div className="space-y-3">
          {sectors.map(sector => (
            <div key={sector.name}>
              <p className="text-[11px] font-semibold text-txt-muted mb-1.5 uppercase tracking-wider">{sector.name}</p>
              <div className="flex flex-wrap gap-1">
                {sector.stocks.map((s, idx) => {
                  const size = Math.max(Math.sqrt((s.market_cap || 1) / totalCap) * 600, 60);
                  return (
                    <button key={`${sector.name}-${s.symbol}-${idx}`} onClick={() => onStockClick(s.symbol)}
                      className="rounded-md flex flex-col items-center justify-center p-1.5 hover:brightness-125 transition-all border border-white/5"
                      style={{ background: getColor(s.change_pct), width: `${size}px`, height: `${Math.max(size * 0.7, 50)}px` }}>
                      <span className="text-[11px] font-bold text-white leading-tight">{s.symbol}</span>
                      <span className={`text-[10px] font-mono font-semibold ${s.change_pct >= 0 ? "text-green-200" : "text-red-200"}`}>
                        {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {allStocks.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)).map((s, idx) => {
            const size = Math.max(Math.sqrt((s.market_cap || 1) / totalCap) * 600, 55);
            return (
              <button key={`all-${s.symbol}-${idx}`} onClick={() => onStockClick(s.symbol)}
                className="rounded-md flex flex-col items-center justify-center p-1 hover:brightness-125 transition-all border border-white/5"
                style={{ background: getColor(s.change_pct), width: `${size}px`, height: `${Math.max(size * 0.7, 45)}px` }}>
                <span className="text-[10px] font-bold text-white leading-tight">{s.symbol}</span>
                <span className={`text-[9px] font-mono ${s.change_pct >= 0 ? "text-green-200" : "text-red-200"}`}>
                  {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
