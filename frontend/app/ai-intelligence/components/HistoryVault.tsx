"use client";
import type { ScanRunRecord } from "./AITypes";

type HistoryVaultProps = {
  scanRuns: ScanRunRecord[];
  expandedRunId: number | null;
  setExpandedRunId: (id: number | null) => void;
  loadingVault: boolean;
  deletingRunId: number | null;
  handleDeleteBatchRun: (runId: number, batchName: string) => void;
  setModalStock: (symbol: string) => void;
  fmt: (n: number | null | undefined) => string;
};

export default function HistoryVault({
  scanRuns,
  expandedRunId,
  setExpandedRunId,
  loadingVault,
  deletingRunId,
  handleDeleteBatchRun,
  setModalStock,
  fmt,
}: HistoryVaultProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-bg-card p-4 rounded-2xl border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>🏛️</span> Saved AI Setups / History Vault (5,000 Equity Universe Audit)
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Auditable execution logs. Each scan evaluates 500 completely distinct stocks across 10 non-overlapping tiers.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-txt-muted">Total Completed Runs:</span>
          <span className="px-2.5 py-1 bg-indigo-500/20 border border-indigo-400 text-indigo-300 rounded-lg font-bold">
            {scanRuns.length} Runs ({(scanRuns.length * 500).toLocaleString()} Screened)
          </span>
        </div>
      </div>

      {loadingVault ? (
        <div className="space-y-2 py-8 text-center text-txt-muted text-xs">
          <span className="inline-block animate-spin mr-2">⚡</span> Loading Vault Records...
        </div>
      ) : scanRuns.length === 0 ? (
        <div className="text-center py-16 bg-bg-card border border-border rounded-2xl">
          <p className="text-sm font-semibold text-txt-secondary">No execution runs logged yet.</p>
          <p className="text-xs text-txt-muted mt-1">Click &quot;Scan Next 500 Batch&quot; above to screen your first batch of 500 stocks!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scanRuns.map((run) => {
            const isExpanded = expandedRunId === run.run_id;
            const execDate = run.executed_at
              ? new Date(run.executed_at).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Recent";

            return (
              <div
                key={run.run_id}
                className="bg-bg-card border border-border hover:border-indigo-500/50 rounded-2xl overflow-hidden transition-all shadow-md"
              >
                {/* Run Header Row */}
                <div
                  onClick={() => setExpandedRunId(isExpanded ? null : run.run_id)}
                  className="p-4 bg-gradient-to-r from-[#10192E] to-[#121B35] flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-mono font-bold flex items-center justify-center text-xs">
                      #{run.run_id}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm">{run.batch_name}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono font-bold">
                          Equities {run.stock_range}
                        </span>
                      </div>
                      <span className="text-[11px] text-txt-muted block mt-0.5">
                        Executed on {execDate} • 500 Equities Analyzed • {run.top_winners_count} High-Conviction Setups Identified
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {run.top_symbol && (
                      <div className="text-right hidden md:block font-mono text-xs">
                        <span className="text-[10px] text-txt-muted block">Top Setup</span>
                        <span className="font-bold text-emerald-400">
                          {run.top_symbol} [{run.top_score}/100]
                        </span>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBatchRun(run.run_id, run.batch_name);
                      }}
                      disabled={deletingRunId === run.run_id}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                      title="Delete this batch run and purge its 500 stocks from database"
                    >
                      <span>🗑️</span>
                      <span className="hidden sm:inline">Delete Batch</span>
                    </button>
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-bg-primary border border-border text-txt-secondary font-bold flex items-center gap-1.5">
                      <span>{isExpanded ? "Collapse" : "View Stocks"}</span>
                      <span>{isExpanded ? "▲" : "▼"}</span>
                    </span>
                  </div>
                </div>

                {/* Expanded Stock Setups Table */}
                {isExpanded && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B132B] border-b border-border text-[10px] text-txt-muted uppercase font-mono">
                        <tr>
                          <th className="py-2.5 px-4">Stock</th>
                          <th className="py-2.5 px-3">Cap & Sector</th>
                          <th className="py-2.5 px-3">Live CMP</th>
                          <th className="py-2.5 px-4 text-center">Score Evolution (Entry &rarr; Dynamic)</th>
                          <th className="py-2.5 px-3">AI Verdict</th>
                          <th className="py-2.5 px-3">Target Price</th>
                          <th className="py-2.5 px-4">AI Catalyst & Conviction Summary</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30 font-mono">
                        {run.stocks.map((item) => {
                          const delta = item.score_change ?? 0;
                          const isGain = delta > 0;
                          const isLoss = delta < 0;

                          return (
                            <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-xs">{item.symbol}</span>
                                  {item.is_top_setup && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-bold">
                                      ★ Elite
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-txt-muted block truncate max-w-[140px] font-sans">
                                  {item.name}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-txt-primary block font-sans text-xs">{item.cap_category}</span>
                                <span className="text-[10px] text-txt-dim block">{item.sector}</span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-bold text-white">₹{item.current_price?.toFixed(2) ?? "—"}</span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="inline-flex items-center gap-2 bg-[#080E21] px-2.5 py-1 rounded-lg border border-slate-700/80">
                                  <span className="text-slate-400 font-bold text-xs" title="Entry Score in this Run">
                                    {item.initial_ai_score}
                                  </span>
                                  <span className="text-slate-600 text-xs">&rarr;</span>
                                  <span className={`font-bold text-xs ${
                                    item.current_ai_score >= 90 ? "text-emerald-400" : "text-cyan-300"
                                  }`}>
                                    {item.current_ai_score}
                                  </span>
                                  {delta !== 0 ? (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                      isGain ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                                    }`}>
                                      {isGain ? `+${delta}` : delta}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-bold">±0</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  {item.action}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-emerald-400 font-bold">₹{item.target_price?.toFixed(2) ?? "—"}</span>
                                {item.horizon_upside_pct ? (
                                  <span className="text-[10px] text-txt-muted block font-sans">
                                    +{item.horizon_upside_pct}% ({item.horizon_label})
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-3 px-4 font-sans text-xs text-txt-secondary max-w-xs">
                                <p className="line-clamp-2">{item.catalyst_summary}</p>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => setModalStock(item.symbol)}
                                  className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-400/40 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                                >
                                  Inspect &rarr;
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
