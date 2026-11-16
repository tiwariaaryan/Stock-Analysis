"use client";
import { useState } from "react";
import { API, fmt } from "@/lib/utils";

export default function InstitutionalReportSection({ symbol }: { symbol: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  function load() {
    if (data) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    fetch(`${API}/api/v1/strategy/stock/${encodeURIComponent(symbol)}/institutional-report`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const recColor = (rec: string) => {
    if (rec?.includes("BUY")) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (rec?.includes("SELL") || rec?.includes("AVOID")) return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  };

  return (
    <div className="bg-bg-primary rounded-xl border border-indigo-500/30 overflow-hidden">
      <button
        onClick={load}
        className="w-full text-left px-4 py-3 bg-bg-primary flex items-center justify-between hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span className="text-xs font-bold text-txt-primary">Institutional 28-Field Analysis & 6-Factor Radar</span>
          {data && (
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${recColor(data["14_final_recommendation"])}`}>
              {data["14_final_recommendation"]} ({data["5_overall_score"]}/100)
            </span>
          )}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-txt-dim transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="p-4 pt-1 border-t border-border/60 space-y-3.5">
          {loading ? (
            <div className="space-y-2 py-2">
              <div className="h-6 bg-bg-hover rounded animate-pulse" />
              <div className="h-16 bg-bg-hover rounded animate-pulse" />
            </div>
          ) : data ? (
            <div className="space-y-3">
              {/* Header Badge & Coverage */}
              <div className="flex items-center justify-between bg-bg-card p-3 rounded-lg border border-border">
                <div>
                  <p className="text-[10px] text-txt-dim uppercase tracking-wider font-semibold">Institutional Verdict</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-black px-2 py-0.5 rounded border ${recColor(data["14_final_recommendation"])}`}>
                      {data["14_final_recommendation"]}
                    </span>
                    <span className="text-xs font-mono font-bold text-txt-primary">
                      {data["5_overall_score"]}/100
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-txt-dim">Coverage / Confidence</p>
                  <p className="text-xs font-mono font-bold text-txt-secondary">
                    {data["12_data_coverage_percentage"]}% &middot; {data["13_confidence_level"]}
                  </p>
                </div>
              </div>

              {/* 6-Factor Radar Progress Bars */}
              <div className="bg-bg-card p-3 rounded-lg border border-border">
                <p className="text-[10px] font-bold text-txt-muted uppercase tracking-wider mb-2">6-Module Institutional Factor Breakdown</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "Fundamental (35%)", val: data["6_fundamental_score"], col: "bg-blue-500" },
                    { label: "Technical (20%)", val: data["7_technical_score"], col: "bg-purple-500" },
                    { label: "Valuation (15%)", val: data["8_valuation_score"], col: "bg-emerald-500" },
                    { label: "Market Context (10%)", val: data["9_market_sector_score"], col: "bg-cyan-500" },
                    { label: "News & Sentiment (10%)", val: data["10_sentiment_score"], col: "bg-amber-500" },
                    { label: "Risk & Drawdown (10%)", val: data["11_risk_score"], col: "bg-rose-500" },
                  ].map(m => (
                    <div key={m.label} className="bg-bg-primary/60 p-2 rounded border border-border/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-txt-dim">{m.label}</span>
                        <span className="text-[11px] font-mono font-bold text-txt-primary">{Math.round(m.val || 0)}/100</span>
                      </div>
                      <div className="w-full bg-bg-hover h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${m.col}`} style={{ width: `${Math.min(m.val || 0, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fair Value & Scenarios */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-bg-card p-2.5 rounded-lg border border-border">
                  <p className="text-[10px] text-txt-dim">Est. Fair Value</p>
                  <p className="text-xs font-bold text-txt-primary font-mono mt-0.5">₹{fmt(data["26_estimated_fair_value"])}</p>
                </div>
                <div className="bg-bg-card p-2.5 rounded-lg border border-border">
                  <p className="text-[10px] text-txt-dim">Expected 1-Yr Return</p>
                  <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">{data["23_expected_1yr_return"]}</p>
                </div>
                <div className="bg-bg-card p-2.5 rounded-lg border border-border">
                  <p className="text-[10px] text-txt-dim">Expected 3-Yr CAGR</p>
                  <p className="text-xs font-bold text-txt-primary font-mono mt-0.5">{data["24_expected_3yr_return"]}</p>
                </div>
                <div className="bg-bg-card p-2.5 rounded-lg border border-border">
                  <p className="text-[10px] text-txt-dim">Expected 5-Yr Horizon</p>
                  <p className="text-xs font-bold text-txt-primary font-mono mt-0.5">{data["25_expected_5yr_return"]}</p>
                </div>
              </div>

              {/* Investment Rationale */}
              {data["27_investment_rationale"] && (
                <div className="p-3 bg-indigo-950/20 rounded-lg border border-indigo-500/30 text-xs">
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                    🏛 Dalal Street Institutional Rationale
                  </p>
                  <p className="text-[11px] text-txt-secondary leading-relaxed">
                    {data["27_investment_rationale"]}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-txt-muted text-center py-2">Could not load institutional report</p>
          )}
        </div>
      )}
    </div>
  );
}
