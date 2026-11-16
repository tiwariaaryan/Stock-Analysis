"use client";
import { useState } from "react";
import { API } from "@/lib/utils";

export default function FundamentalsSection({ symbol }: { symbol: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  function load() {
    if (data) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    fetch(`${API}/api/v1/market/stocks/${encodeURIComponent(symbol)}/fundamentals`)
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }

  return (
    <div>
      <button onClick={load}
        className="w-full text-left px-4 py-3 bg-bg-primary rounded-lg flex items-center justify-between hover:bg-bg-hover transition-colors">
        <span className="text-xs font-medium text-txt-secondary">Fundamentals & Health Check</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-txt-dim transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 animate-fade-in">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-bg-primary rounded animate-pulse" />)}</div>
          ) : data ? (
            <div className="space-y-3">
              {/* Health Score */}
              <div className="flex items-center gap-3 px-4 py-3 bg-bg-primary rounded-lg">
                <div className={`text-2xl font-bold ${data.health_score >= 4 ? "text-gain" : data.health_score >= 3 ? "text-yellow-400" : "text-loss"}`}>
                  {data.health_score}/5
                </div>
                <div>
                  <p className="text-sm font-medium text-txt-primary">{data.health_label} Financial Health</p>
                  <p className="text-[10px] text-txt-dim">{data.name}</p>
                </div>
              </div>

              {/* 5-Point Checks */}
              <div className="grid grid-cols-5 gap-1.5">
                {data.health_checks?.map((c: any) => (
                  <div key={c.name} className={`px-2 py-2 rounded-lg text-center ${c.pass ? "bg-gain/10 border border-gain/20" : "bg-loss/10 border border-loss/20"}`}>
                    <div className={`text-base mb-0.5 ${c.pass ? "text-gain" : "text-loss"}`}>{c.pass ? "✓" : "✗"}</div>
                    <p className="text-[9px] font-medium text-txt-primary">{c.name}</p>
                    <p className="text-[8px] text-txt-dim">{c.desc}</p>
                  </div>
                ))}
              </div>

              {/* Key Ratios */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "PE (TTM)", val: data.ratios?.trailing_pe },
                  { label: "PE (Fwd)", val: data.ratios?.forward_pe },
                  { label: "P/B", val: data.ratios?.price_to_book },
                  { label: "ROE", val: data.ratios?.roe, suffix: "%" },
                  { label: "ROCE", val: data.ratios?.roce, suffix: "%" },
                  { label: "Op. Margin", val: data.ratios?.operating_margin, suffix: "%" },
                  { label: "D/E", val: data.ratios?.debt_to_equity, suffix: "%" },
                  { label: "Curr. Ratio", val: data.ratios?.current_ratio },
                  { label: "Div. Yield", val: data.ratios?.dividend_yield, suffix: "%" },
                ].map(r => (
                  <div key={r.label} className="bg-bg-primary rounded px-2.5 py-2">
                    <p className="text-[9px] text-txt-dim">{r.label}</p>
                    <p className="text-xs font-mono text-txt-primary">{r.val != null ? `${r.val}${r.suffix || ""}` : "—"}</p>
                  </div>
                ))}
              </div>

              {/* Shareholding */}
              {data.shareholding && (
                <div className="px-3 py-2.5 bg-bg-primary rounded-lg">
                  <p className="text-[10px] text-txt-dim mb-2">Shareholding Pattern</p>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div style={{ width: `${data.shareholding.promoters}%` }} className="bg-blue-500" title={`Promoters ${data.shareholding.promoters}%`} />
                    <div style={{ width: `${data.shareholding.fii}%` }} className="bg-green-500" title={`FII ${data.shareholding.fii}%`} />
                    <div style={{ width: `${data.shareholding.public}%` }} className="bg-gray-500" title={`Public ${data.shareholding.public}%`} />
                  </div>
                  <div className="flex gap-4 mt-1.5">
                    <span className="text-[9px] text-txt-dim"><span className="inline-block w-2 h-2 bg-blue-500 rounded-sm mr-1" />Promoters {data.shareholding.promoters}%</span>
                    <span className="text-[9px] text-txt-dim"><span className="inline-block w-2 h-2 bg-green-500 rounded-sm mr-1" />FII {data.shareholding.fii}%</span>
                    <span className="text-[9px] text-txt-dim"><span className="inline-block w-2 h-2 bg-gray-500 rounded-sm mr-1" />Public {data.shareholding.public}%</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-txt-muted text-center py-2">Could not load fundamentals</p>
          )}
        </div>
      )}
    </div>
  );
}
