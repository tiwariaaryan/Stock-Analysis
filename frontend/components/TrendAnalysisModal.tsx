"use client";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type TrendData = {
  symbol: string; name: string; sector: string; current_price: number;
  direction: Record<string, { direction: string; confidence_pct: number; reasoning: string }>;
  price_targets: Record<string, { low: number; high: number; most_likely: number }>;
  scenarios: Record<string, { bull: any; base: any; bear: any }>;
  historical_pattern: any;
  technical_signals: any;
  fundamental_outlook: any;
  risk_matrix: any;
  ai_summary: string;
  api_calls: any;
  institutional_scorecard?: {
    total_score: number;
    verdict: string;
    phase_a_score: number;
    phase_b_score: number;
    phase_c_score: number;
  };
};

const TF = ["1_week", "1_month", "6_month"] as const;
const TF_LABEL: Record<string, string> = { "1_week": "1 Week", "1_month": "1 Month", "6_month": "6 Months" };

function dirColor(d: string) { return d === "UP" ? "text-gain" : d === "DOWN" ? "text-loss" : "text-yellow-400"; }
function dirBg(d: string) { return d === "UP" ? "bg-gain/10 border-gain/20" : d === "DOWN" ? "bg-loss/10 border-loss/20" : "bg-yellow-400/10 border-yellow-400/20"; }
function dirIcon(d: string) { return d === "UP" ? "↑" : d === "DOWN" ? "↓" : "→"; }

export default function TrendAnalysisModal({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "scenarios" | "technicals" | "risk">("overview");

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/v1/strategy/ai/trend-analysis/${encodeURIComponent(symbol)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError("Could not load trend analysis"))
      .finally(() => setLoading(false));
  }, [symbol]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-bg-card/95 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between z-10 rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-txt-primary">Trend Analysis — {data?.name || symbol}</h2>
            <p className="text-[10px] text-txt-dim">{data?.sector || ""} · AI Prediction · {data?.api_calls ? `${data.api_calls.total} API calls` : ""}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-bg-primary border border-border flex items-center justify-center text-txt-muted hover:text-txt-primary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-bg-hover rounded-xl animate-pulse" />)}</div>
        ) : error ? (
          <div className="p-8 text-center text-loss text-sm">{error}</div>
        ) : data ? (
          <div className="p-5 space-y-4">

            {/* Current Price + AI Summary */}
            <div className="bg-bg-primary rounded-xl p-4">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-2xl font-bold text-txt-primary font-mono">₹{data.current_price?.toLocaleString("en-IN")}</span>
                {data.direction?.["1_month"] && (
                  <span className={`text-sm font-semibold ${dirColor(data.direction["1_month"].direction)}`}>
                    {dirIcon(data.direction["1_month"].direction)} {data.direction["1_month"].direction} ({data.direction["1_month"].confidence_pct}% confidence)
                  </span>
                )}
              </div>
              <p className="text-xs text-txt-secondary leading-relaxed">{data.ai_summary}</p>
            </div>

            {/* 3-Pillar Institutional Alignment Scorecard */}
            {data.institutional_scorecard && (
              <div className="bg-bg-primary/90 rounded-xl p-3 border border-border/80 text-xs font-mono flex flex-wrap items-center justify-between gap-2 shadow-sm">
                <div>
                  <span className="text-[10px] text-txt-dim uppercase block">Institutional 3-Pillar Alignment</span>
                  <span className="font-extrabold text-txt-primary">
                    Final Score (M + F + AI) = <strong className="text-cyan-400">{data.institutional_scorecard.total_score}/100</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-cyan-400 font-bold">M:{Math.round(data.institutional_scorecard.phase_a_score)}</span>
                  <span className="text-slate-500 font-bold">+</span>
                  <span className="text-emerald-400 font-bold">F:{Math.round(data.institutional_scorecard.phase_b_score)}</span>
                  <span className="text-slate-500 font-bold">+</span>
                  <span className="text-indigo-400 font-bold">AI:{Math.round(data.institutional_scorecard.phase_c_score)}</span>
                  <span className="text-slate-500 font-bold">=</span>
                  <span className="text-white font-extrabold">{data.institutional_scorecard.total_score}</span>
                  <span className="ml-2 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    {data.institutional_scorecard.verdict}
                  </span>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-bg-primary rounded-lg p-1 w-fit">
              {[
                { key: "overview", label: "Direction & Targets" },
                { key: "scenarios", label: "Scenarios" },
                { key: "technicals", label: "Technicals" },
                { key: "risk", label: "Risk Matrix" },
              ].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key as any)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${activeTab === t.key ? "bg-accent text-white" : "text-txt-muted hover:text-txt-primary"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab: Direction & Price Targets */}
            {activeTab === "overview" && (
              <div className="space-y-3">
                {/* Direction Cards */}
                <div className="grid grid-cols-3 gap-3">
                  {TF.map(tf => {
                    const d = data.direction?.[tf];
                    const t = data.price_targets?.[tf];
                    if (!d) return null;
                    return (
                      <div key={tf} className={`rounded-xl border p-3.5 ${dirBg(d.direction)}`}>
                        <p className="text-[10px] text-txt-muted mb-1">{TF_LABEL[tf]}</p>
                        <div className={`text-lg font-bold ${dirColor(d.direction)}`}>
                          {dirIcon(d.direction)} {d.direction}
                        </div>
                        <p className="text-[10px] text-txt-dim mt-0.5">{d.confidence_pct}% confidence</p>
                        {t && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="text-[9px] text-txt-dim">Price Range</p>
                            <p className="text-xs font-mono text-txt-primary">₹{t.low?.toLocaleString("en-IN")} — ₹{t.high?.toLocaleString("en-IN")}</p>
                            <p className="text-[9px] text-txt-dim mt-1">Most Likely</p>
                            <p className="text-sm font-bold font-mono text-txt-primary">₹{t.most_likely?.toLocaleString("en-IN")}</p>
                          </div>
                        )}
                        <p className="text-[9px] text-txt-dim mt-2 leading-relaxed">{d.reasoning}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Projected Price Chart */}
                {data.price_targets && (
                  <div className="bg-bg-primary rounded-xl p-4">
                    <p className="text-[10px] text-txt-dim mb-3">Projected Price Zones</p>
                    <div className="h-[120px] relative">
                      <svg viewBox="0 0 600 120" className="w-full h-full">
                        {/* Collect all prices for scale */}
                        {(() => {
                          const allPrices = [data.current_price || 0];
                          TF.forEach(tf => { const t = data.price_targets?.[tf]; if (t) { allPrices.push(t.low, t.high, t.most_likely); } });
                          const min = Math.min(...allPrices) * 0.95;
                          const max = Math.max(...allPrices) * 1.05;
                          const range = max - min || 1;
                          const y = (p: number) => 110 - ((p - min) / range) * 100;
                          const positions = [50, 200, 400, 550];

                          return (
                            <>
                              {/* Grid */}
                              {[0,25,50,75,100].map(pct => <line key={pct} x1="0" y1={10 + pct} x2="600" y2={10 + pct} stroke="#1f1f32" strokeWidth="0.5" />)}

                              {/* Current price line */}
                              <line x1="0" y1={y(data.current_price || 0)} x2="600" y2={y(data.current_price || 0)} stroke="#a78bfa" strokeWidth="0.8" strokeDasharray="4 3" />
                              <text x="5" y={y(data.current_price || 0) - 4} fill="#a78bfa" fontSize="8">Now ₹{data.current_price?.toLocaleString("en-IN")}</text>

                              {/* Projected zones */}
                              {TF.map((tf, i) => {
                                const t = data.price_targets?.[tf];
                                if (!t) return null;
                                const x = positions[i + 1];
                                const bullY = y(t.high);
                                const bearY = y(t.low);
                                const baseY = y(t.most_likely);
                                return (
                                  <g key={tf}>
                                    <rect x={x - 30} y={bullY} width="60" height={bearY - bullY} fill="#a78bfa" fillOpacity="0.15" rx="3" />
                                    <line x1={x - 30} y1={baseY} x2={x + 30} y2={baseY} stroke="#a78bfa" strokeWidth="1.5" />
                                    <circle cx={x} cy={baseY} r="3" fill="#a78bfa" />
                                    <text x={x} y={bullY - 4} textAnchor="middle" fill="#00c853" fontSize="7">₹{t.high}</text>
                                    <text x={x} y={bearY + 10} textAnchor="middle" fill="#ff5252" fontSize="7">₹{t.low}</text>
                                    <text x={x} y={118} textAnchor="middle" fill="#64748b" fontSize="8">{TF_LABEL[tf]}</text>
                                  </g>
                                );
                              })}

                              {/* Connect most_likely points */}
                              {(() => {
                                const pts = [{ x: positions[0], y: y(data.current_price || 0) }];
                                TF.forEach((tf, i) => { const t = data.price_targets?.[tf]; if (t) pts.push({ x: positions[i + 1], y: y(t.most_likely) }); });
                                const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
                                return <path d={path} fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="6 3" />;
                              })()}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>
                )}

                {/* Historical Pattern */}
                {data.historical_pattern && (
                  <div className="bg-bg-primary rounded-xl p-4">
                    <p className="text-[10px] text-txt-dim mb-2">Historical Pattern Match</p>
                    <p className="text-xs text-txt-secondary mb-3">{data.historical_pattern.pattern_description}</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center"><p className="text-[9px] text-txt-dim">Matched Setups</p><p className="text-sm font-bold text-txt-primary">{data.historical_pattern.matched_setups}</p></div>
                      <div className="text-center"><p className="text-[9px] text-txt-dim">Win Rate</p><p className="text-sm font-bold text-gain">{data.historical_pattern.win_rate_pct}%</p></div>
                      <div className="text-center"><p className="text-[9px] text-txt-dim">Avg Return</p><p className="text-sm font-bold text-gain">+{data.historical_pattern.avg_return_pct}%</p></div>
                      <div className="text-center"><p className="text-[9px] text-txt-dim">Recovery Days</p><p className="text-sm font-bold text-txt-primary">{data.historical_pattern.avg_recovery_days}</p></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Scenarios */}
            {activeTab === "scenarios" && data.scenarios && (
              <div className="space-y-4">
                {TF.map(tf => {
                  const s = data.scenarios?.[tf];
                  if (!s) return null;
                  return (
                    <div key={tf} className="bg-bg-primary rounded-xl p-4">
                      <p className="text-xs font-semibold text-txt-primary mb-3">{TF_LABEL[tf]} Scenarios</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(["bull", "base", "bear"] as const).map(sc => {
                          const d = s[sc];
                          if (!d) return null;
                          const color = sc === "bull" ? "gain" : sc === "bear" ? "loss" : "yellow-400";
                          return (
                            <div key={sc} className={`rounded-lg border p-3 bg-${color}/5 border-${color}/20`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-[10px] font-bold uppercase text-${color}`}>{sc === "bull" ? "🐂 Bull" : sc === "bear" ? "🐻 Bear" : "📊 Base"}</span>
                                <span className="text-[10px] text-txt-dim">{d.probability_pct}%</span>
                              </div>
                              <p className={`text-lg font-bold font-mono text-${color}`}>₹{d.price?.toLocaleString("en-IN")}</p>
                              <p className="text-[9px] text-txt-dim mt-1">{d.trigger}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab: Technicals */}
            {activeTab === "technicals" && data.technical_signals && (
              <div className="space-y-3">
                <div className="bg-bg-primary rounded-xl p-4">
                  <p className="text-xs font-semibold text-txt-primary mb-3">Technical Signals</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Trend", val: data.technical_signals.trend },
                      { label: "RSI (14)", val: data.technical_signals.rsi_14, sub: data.technical_signals.rsi_signal },
                      { label: "MACD", val: data.technical_signals.macd_signal },
                      { label: "EMA 20", val: `₹${data.technical_signals.ema_20}` },
                      { label: "EMA 50", val: `₹${data.technical_signals.ema_50}` },
                      { label: "EMA 200", val: `₹${data.technical_signals.ema_200}` },
                      { label: "Volume", val: data.technical_signals.volume_trend },
                    ].map(s => (
                      <div key={s.label} className="bg-bg-card rounded-lg px-3 py-2">
                        <p className="text-[9px] text-txt-dim">{s.label}</p>
                        <p className="text-xs font-mono text-txt-primary">{s.val}</p>
                        {s.sub && <p className="text-[8px] text-txt-dim">{s.sub}</p>}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-txt-dim mt-3">{data.technical_signals.ema_signal}</p>
                </div>
                <div className="bg-bg-primary rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-txt-dim mb-1">Support Levels</p>
                      <div className="flex gap-1.5">
                        {(data.technical_signals.support_levels || []).map((s: number) => (
                          <span key={s} className="px-2 py-0.5 bg-gain/10 text-gain text-[10px] font-mono rounded">₹{s}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-txt-dim mb-1">Resistance Levels</p>
                      <div className="flex gap-1.5">
                        {(data.technical_signals.resistance_levels || []).map((r: number) => (
                          <span key={r} className="px-2 py-0.5 bg-loss/10 text-loss text-[10px] font-mono rounded">₹{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {data.fundamental_outlook && (
                  <div className="bg-bg-primary rounded-xl p-4">
                    <p className="text-xs font-semibold text-txt-primary mb-2">Fundamental Outlook</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-txt-dim">Earnings:</span> <span className="text-txt-primary">{data.fundamental_outlook.earnings_trend}</span></div>
                      <div><span className="text-txt-dim">PE vs Sector:</span> <span className="text-txt-primary">{data.fundamental_outlook.pe_vs_sector}</span></div>
                      <div><span className="text-txt-dim">Sector:</span> <span className="text-txt-primary">{data.fundamental_outlook.sector_outlook}</span></div>
                      <div><span className="text-txt-dim">Moat:</span> <span className="text-txt-primary">{data.fundamental_outlook.moat_strength}</span></div>
                    </div>
                    {data.fundamental_outlook.upcoming_catalyst && (
                      <p className="text-[10px] text-accent-light mt-2">Catalyst: {data.fundamental_outlook.upcoming_catalyst}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Risk Matrix */}
            {activeTab === "risk" && data.risk_matrix && (
              <div className="space-y-3">
                <div className="bg-loss/5 border border-loss/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-loss">Risk Assessment</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      data.risk_matrix.overall_risk_level === "LOW" ? "bg-gain/15 text-gain" :
                      data.risk_matrix.overall_risk_level === "HIGH" ? "bg-loss/15 text-loss" : "bg-yellow-400/15 text-yellow-400"
                    }`}>{data.risk_matrix.overall_risk_level} RISK</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-bg-card rounded-lg p-2.5 text-center">
                      <p className="text-[9px] text-txt-dim">Stop Loss</p>
                      <p className="text-sm font-bold font-mono text-loss">₹{data.risk_matrix.stop_loss?.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="bg-bg-card rounded-lg p-2.5 text-center">
                      <p className="text-[9px] text-txt-dim">Max Downside</p>
                      <p className="text-sm font-bold font-mono text-loss">{data.risk_matrix.max_downside_pct}%</p>
                    </div>
                    <div className="bg-bg-card rounded-lg p-2.5 text-center">
                      <p className="text-[9px] text-txt-dim">Risk:Reward</p>
                      <p className="text-sm font-bold font-mono text-txt-primary">{data.risk_matrix.risk_reward_ratio}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-txt-dim mb-2">{data.risk_matrix.stop_loss_reasoning}</p>
                </div>

                {data.risk_matrix.risk_events && (
                  <div className="bg-bg-primary rounded-xl p-4">
                    <p className="text-xs font-semibold text-txt-primary mb-2">Risk Events</p>
                    <div className="space-y-2">
                      {data.risk_matrix.risk_events.map((r: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                            r.probability === "HIGH" ? "bg-loss/15 text-loss" :
                            r.probability === "MEDIUM" ? "bg-yellow-400/15 text-yellow-400" : "bg-gain/15 text-gain"
                          }`}>{r.probability}</span>
                          <div>
                            <p className="text-txt-primary">{r.event}</p>
                            <p className="text-[10px] text-txt-dim">{r.impact}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
