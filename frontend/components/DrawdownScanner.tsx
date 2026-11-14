"use client";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type DrawdownStock = {
  symbol: string; name: string; sector: string; current_price: number;
  week_52_high: number; week_52_low: number | null; drawdown_pct: number;
  change_pct: number; volume: number | null; market_cap: number | null;
};

type MoverStock = {
  symbol: string; name: string; price: number; change_pct: number;
  change: number; volume: number; sector: string;
};

type Movers = { gainers: MoverStock[]; losers: MoverStock[]; volume_shockers: MoverStock[] };

export default function DrawdownScanner({ onStockClick }: { onStockClick: (sym: string) => void }) {
  const [tab, setTab] = useState<"drawdown" | "gainers" | "losers" | "volume">("drawdown");
  const [drawdown, setDrawdown] = useState<DrawdownStock[]>([]);
  const [movers, setMovers] = useState<Movers | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/v1/market/drawdown-scanner`).then(r => r.json()),
      fetch(`${API}/api/v1/market/movers`).then(r => r.json()),
    ]).then(([d, m]) => { setDrawdown(d); setMovers(m); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const tabs = [
    { key: "drawdown", label: "52W Drawdown" },
    { key: "gainers", label: "Top Gainers" },
    { key: "losers", label: "Top Losers" },
    { key: "volume", label: "Volume Shockers" },
  ] as const;

  const maxDraw = drawdown.length > 0 ? Math.abs(drawdown[0]?.drawdown_pct || 50) : 50;

  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 bg-bg-card rounded animate-pulse" />)}</div>;
  }

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-bg-primary rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t.key ? "bg-accent text-white" : "text-txt-muted hover:text-txt-primary"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "drawdown" && (
        <div className="space-y-1">
          {drawdown.length === 0 ? (
            <p className="text-sm text-txt-muted py-4 text-center">No drawdown data. Click &quot;Refresh Prices&quot; first.</p>
          ) : drawdown.map((s, idx) => {
            const barWidth = Math.min(Math.abs(s.drawdown_pct) / maxDraw * 100, 100);
            return (
              <button key={`dd-${s.symbol}-${idx}`} onClick={() => onStockClick(s.symbol)}
                className="w-full flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-bg-hover transition-colors group">
                <span className="text-xs font-semibold text-txt-primary w-24 text-left group-hover:text-accent-light truncate">{s.symbol}</span>
                <div className="flex-1 h-5 bg-bg-primary rounded-sm overflow-hidden relative">
                  <div className="absolute right-0 top-0 bottom-0 rounded-sm"
                    style={{ width: `${barWidth}%`, background: `linear-gradient(to left, #ff5252, #ff8a80)` }} />
                </div>
                <span className="text-xs font-mono text-loss w-16 text-right">{s.drawdown_pct.toFixed(1)}%</span>
              </button>
            );
          })}
        </div>
      )}

      {(tab === "gainers" || tab === "losers" || tab === "volume") && movers && (
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-primary/50">
                <th className="px-4 py-2.5 text-[11px] text-txt-dim font-medium text-left">Symbol</th>
                <th className="px-3 py-2.5 text-[11px] text-txt-dim font-medium text-left">Name</th>
                <th className="px-3 py-2.5 text-[11px] text-txt-dim font-medium text-right">Price</th>
                <th className="px-3 py-2.5 text-[11px] text-txt-dim font-medium text-right">Change</th>
                {tab === "volume" && <th className="px-3 py-2.5 text-[11px] text-txt-dim font-medium text-right">Volume</th>}
                <th className="px-3 py-2.5 text-[11px] text-txt-dim font-medium text-left">Sector</th>
              </tr>
            </thead>
            <tbody>
              {(tab === "gainers" ? movers.gainers : tab === "losers" ? movers.losers : movers.volume_shockers).map((s, idx) => {
                const pos = s.change_pct >= 0;
                return (
                  <tr key={`mover-${tab}-${s.symbol}-${idx}`} onClick={() => onStockClick(s.symbol)}
                    className="border-b border-border last:border-0 hover:bg-bg-hover/50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5 font-medium text-accent-light">{s.symbol}</td>
                    <td className="px-3 py-2.5 text-txt-secondary text-xs truncate max-w-[150px]">{s.name}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-txt-primary">₹{s.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-medium ${pos ? "text-gain" : "text-loss"}`}>
                      {pos ? "+" : ""}{s.change_pct.toFixed(2)}%
                    </td>
                    {tab === "volume" && <td className="px-3 py-2.5 text-right font-mono text-txt-secondary">{s.volume?.toLocaleString("en-IN") || "—"}</td>}
                    <td className="px-3 py-2.5 text-[10px] text-txt-dim">{s.sector}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
