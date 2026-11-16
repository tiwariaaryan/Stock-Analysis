"use client";
import { useState, useEffect } from "react";
import { API, fmt } from "@/lib/utils";

export default function AIStrategySection({ symbol }: { symbol: string }) {
  const [strategy, setStrategy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/v1/strategy/stock/${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => setStrategy(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol]);

  return (
    <div className="bg-bg-primary rounded-xl border border-rose-500/30 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3 bg-bg-primary flex items-center justify-between hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          <span className="text-xs font-bold text-txt-primary">AI Quant Strategy & Pattern Analogy</span>
          {strategy && (
            <span
              className="text-[10px] font-extrabold px-2 py-0.5 rounded"
              style={{ backgroundColor: `${strategy.signal_color}22`, color: strategy.signal_color }}
            >
              {strategy.signal} ({strategy.ai_score}/100)
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
              <div className="h-12 bg-bg-hover rounded animate-pulse" />
            </div>
          ) : strategy ? (
            <>
              {/* Score bar & Action */}
              <div className="bg-bg-card rounded-lg p-3 border border-border">
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="text-txt-muted">Dalal Street Quant Score</span>
                  <span className="font-bold text-txt-primary">{strategy.ai_score}/100</span>
                </div>
                <div className="w-full bg-bg-primary h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${strategy.ai_score}%`, backgroundColor: strategy.signal_color }}
                  />
                </div>
                <p className="text-[11px] text-txt-secondary mt-2 leading-relaxed">{strategy.action_summary}</p>
              </div>

              {/* Targets, Stop Loss, Risk-to-Reward */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-txt-muted">Hard Stop-Loss</p>
                  <p className="text-xs font-bold text-rose-400 font-mono mt-0.5">₹{fmt(strategy.recommended_stop_loss)}</p>
                  <p className="text-[9px] text-txt-dim mt-0.5">Invalidation point</p>
                </div>
                <div className="bg-bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-txt-muted">Target 1 (Book 50%)</p>
                  <p className="text-xs font-bold text-emerald-400 font-mono mt-0.5">₹{fmt(strategy.target_milestone_1)}</p>
                  <p className="text-[9px] text-txt-dim mt-0.5">R:R: {strategy.risk_reward_ratio}</p>
                </div>
                <div className="bg-bg-card rounded-lg p-2.5 border border-border">
                  <p className="text-[10px] text-txt-muted">Target 2 (Runner)</p>
                  <p className="text-xs font-bold text-txt-primary font-mono mt-0.5">₹{fmt(strategy.target_milestone_2)}</p>
                  <p className="text-[9px] text-txt-dim mt-0.5">Trail stop on break</p>
                </div>
              </div>

              {/* Toggle AI Pattern Engine */}
              {strategy.pattern_analogy && (
                <div className="bg-blue-950/20 rounded-lg p-3 border border-blue-500/30 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-blue-300 text-[11px]">Toggle AI Pattern Analogy</span>
                    <span className="text-[10px] text-txt-dim">Past 2-5 Yrs</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-txt-muted">Win Rate: </span>
                      <strong className="text-gain font-mono">{strategy.pattern_analogy.win_rate_pct}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-txt-muted">Avg 40D Return: </span>
                      <strong className="text-txt-primary font-mono">+{strategy.pattern_analogy.avg_forward_return_pct}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-txt-muted">Matched: </span>
                      <strong className="text-blue-300 font-mono">{strategy.pattern_analogy.matched_events_count}</strong>
                    </div>
                  </div>
                  <p className="text-[11px] text-txt-secondary leading-relaxed pt-1">
                    {strategy.pattern_analogy.analogy_text}
                  </p>
                </div>
              )}

              {/* 3-Stage Staggered Dip Ladder */}
              {strategy.staggered_ladder && strategy.staggered_ladder.length > 0 && (
                <div className="bg-bg-card rounded-lg p-3 border border-border space-y-2">
                  <p className="text-[11px] font-semibold text-txt-muted uppercase tracking-wide">
                    3-Stage Dip Accumulation Ladder (30% / 40% / 30%)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {strategy.staggered_ladder.map((step: any) => (
                      <div key={step.tranche} className="bg-bg-primary p-2 rounded border border-border/60 text-center">
                        <p className="text-[10px] text-txt-muted">Stage {step.tranche} ({step.pct}%)</p>
                        <p className="text-xs font-bold font-mono text-txt-primary mt-0.5">₹{fmt(step.price)}</p>
                        <span className={`text-[9px] font-bold block mt-0.5 ${step.status === "TRIGGERED" ? "text-gain" : "text-txt-dim"}`}>
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Veteran Commentary */}
              {strategy.veteran_commentary && (
                <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-500/30 text-xs">
                  <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                    🏛 Dalal Street Veteran Take
                  </p>
                  <p className="text-[11px] text-txt-secondary leading-relaxed">
                    {strategy.veteran_commentary}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-txt-muted text-center py-2">Could not compute AI strategy</p>
          )}
        </div>
      )}
    </div>
  );
}
