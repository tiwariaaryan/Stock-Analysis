"use client";
import { useState, useEffect, use } from "react";
import StockModal from "@/components/StockModal";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Holding = {
  id: number; symbol: string; quantity: string; buy_price: string; buy_date: string | null;
  asset_type: string; current_price: string | null; current_value: string | null;
  invested_value: string; pnl: string | null; pnl_pct: number | null;
};
type Portfolio = {
  id: number; name: string; description: string | null; created_at: string;
  holdings: Holding[]; total_invested: string; total_current: string | null;
  total_pnl: string | null; total_pnl_pct: number | null;
};

type HoldingAiSignal = {
  holding_id: number;
  symbol: string;
  quantity: number;
  buy_price: number;
  current_price: number;
  gain_pct: number;
  ai_status: string;
  status_color: string;
  recommended_action: string;
  trailing_stop_loss: number;
};

type PortfolioAiAudit = {
  portfolio_id: number;
  portfolio_name: string;
  holdings_signals: HoldingAiSignal[];
  action_items: string[];
  updated_at: string;
};

export default function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sym, setSym] = useState(""); const [qty, setQty] = useState(""); const [price, setPrice] = useState("");
  const [atype, setAtype] = useState("EQUITY"); const [saving, setSaving] = useState(false);
  const [viewStock, setViewStock] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [aiAudit, setAiAudit] = useState<PortfolioAiAudit | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`${API}/api/v1/portfolios/${id}`).then(r => r.json()).then(setPf).catch(() => {}).finally(() => setLoading(false));
    fetch(`${API}/api/v1/portfolios/${id}/analytics`).then(r => r.json()).then(setAnalytics).catch(() => {});
    fetch(`${API}/api/v1/strategy/portfolio/${id}`).then(r => r.json()).then(setAiAudit).catch(() => {});
  };
  useEffect(() => { load(); }, [id]);

  async function add() {
    if (!sym.trim() || !qty || !price) return;
    setSaving(true);
    await fetch(`${API}/api/v1/portfolios/${id}/holdings`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: sym.trim().toUpperCase(), quantity: parseFloat(qty), buy_price: parseFloat(price), asset_type: atype }),
    });
    setSym(""); setQty(""); setPrice(""); setShowAdd(false); setSaving(false); load();
  }

  async function remove(hid: number) {
    await fetch(`${API}/api/v1/portfolios/${id}/holdings/${hid}`, { method: "DELETE" });
    load();
  }

  const fmt = (n: string | number | null) => n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtQty = (n: string | number | null) => {
    if (n == null) return "—";
    const num = Number(n);
    if (Number.isInteger(num)) return num.toLocaleString("en-IN");
    return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 bg-bg-card rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-bg-card rounded-lg animate-pulse" />)}</div>
      <div className="h-48 bg-bg-card rounded-lg animate-pulse" />
    </div>
  );

  if (!pf) return <div className="p-6 text-center text-txt-muted">Portfolio not found</div>;

  const hasCur = pf.total_current != null;
  const xirrVal = analytics?.xirr_pct != null
    ? `${analytics.xirr_pct >= 0 ? "+" : ""}${Number(analytics.xirr_pct).toFixed(2)}%`
    : "—";
  const xirrColor = analytics?.xirr_pct != null
    ? (analytics.xirr_pct >= 0 ? "text-gain" : "text-loss")
    : "text-txt-dim";

  const summaryCards = [
    { label: "Total Invested", val: `₹${fmt(pf.total_invested)}`, color: "text-txt-primary", tooltip: "Total capital deployed across all active holdings" },
    { label: "Current Value", val: hasCur ? `₹${fmt(pf.total_current)}` : "—", color: "text-txt-primary", tooltip: "Live market value based on latest stock prices" },
    { label: "Total P&L", val: pf.total_pnl ? `${Number(pf.total_pnl) >= 0 ? "+" : ""}₹${fmt(pf.total_pnl)}` : "—", color: pf.total_pnl && Number(pf.total_pnl) >= 0 ? "text-gain" : "text-loss", tooltip: "Unrealized gain or loss on current holdings" },
    { label: "Returns", val: pf.total_pnl_pct != null ? `${pf.total_pnl_pct >= 0 ? "+" : ""}${pf.total_pnl_pct.toFixed(2)}%` : "—", color: pf.total_pnl_pct != null && pf.total_pnl_pct >= 0 ? "text-gain" : "text-loss", tooltip: "Overall percentage return on invested capital" },
    { label: "Annualized XIRR", val: xirrVal, color: xirrColor, tooltip: "Money-weighted annualized return (Newton-Raphson cash flow model)" },
  ];

  const signalMap = new Map((aiAudit?.holdings_signals || []).map((s) => [s.holding_id, s]));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-txt-primary">{pf.name}</h2>
          {pf.description && <p className="text-xs text-txt-muted mt-0.5">{pf.description}</p>}
        </div>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors">
          + Add Holding
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {summaryCards.map(c => (
          <div key={c.label} className="bg-bg-card border border-border rounded-lg px-4 py-3.5" title={c.tooltip}>
            <p className="text-[11px] text-txt-muted mb-1 flex items-center justify-between">
              <span>{c.label}</span>
              {c.label === "Annualized XIRR" && <span className="text-[9px] px-1 rounded bg-accent/20 text-accent-light">AI</span>}
            </p>
            <p className={`text-lg font-bold font-mono ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Dalal Street AI Health & Action Items Banner */}
      {aiAudit && aiAudit.action_items && aiAudit.action_items.length > 0 && (
        <div className="bg-bg-card border border-emerald-500/30 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>🛡</span> Dalal Street AI Risk & Profit Milestones
            </span>
            <span className="text-[10px] text-txt-dim font-mono">Autonomous Audit</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {aiAudit.action_items.map((act, i) => (
              <div key={i} className="p-2.5 bg-bg-primary/70 rounded-lg border border-border text-txt-secondary leading-relaxed">
                {act}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* XIRR & Risk Analytics */}
      {analytics && (
        <div className="space-y-3">
          {analytics.concentration_warnings?.length > 0 && (
            <div className="space-y-1.5">
              {analytics.concentration_warnings.map((w: string, i: number) => (
                <div key={i} className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-300">{w}</div>
              ))}
            </div>
          )}

          {analytics.sector_distribution && Object.keys(analytics.sector_distribution).length > 0 && (
            <div className="bg-bg-card border border-border rounded-lg p-4">
              <p className="text-[10px] text-txt-dim mb-2">Sector Distribution</p>
              <div className="flex h-4 rounded-full overflow-hidden mb-2">
                {Object.entries(analytics.sector_distribution).map(([sector, pct], i) => {
                  const colors = ["#3b82f6","#8b5cf6","#06b6d4","#22c55e","#f59e0b","#ef4444","#ec4899","#64748b"];
                  return <div key={sector} style={{ width: `${pct as number}%`, background: colors[i % colors.length] }} title={`${sector}: ${pct}%`} />;
                })}
              </div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(analytics.sector_distribution).map(([sector, pct], i) => {
                  const colors = ["#3b82f6","#8b5cf6","#06b6d4","#22c55e","#f59e0b","#ef4444","#ec4899","#64748b"];
                  return (
                    <span key={sector} className="text-[10px] text-txt-muted flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm inline-block" style={{ background: colors[i % colors.length] }} />
                      {sector} {pct as number}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="bg-bg-card border border-accent/30 rounded-xl p-5 animate-fade-in">
          <p className="text-sm font-medium text-txt-primary mb-3">Add Holding</p>
          <div className="grid grid-cols-4 gap-2.5">
            <input value={sym} onChange={e => setSym(e.target.value)} placeholder="Symbol"
              className="bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50" />
            <input value={qty} onChange={e => setQty(e.target.value)} type="number" step="any" placeholder="Quantity"
              className="bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50" />
            <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="any" placeholder="Buy Price (₹)"
              className="bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50" />
            <select value={atype} onChange={e => setAtype(e.target.value)}
              className="bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:border-accent/50">
              <option value="EQUITY">Equity</option><option value="ETF">ETF</option><option value="MUTUAL_FUND">Mutual Fund</option>
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={add} disabled={saving || !sym.trim() || !qty || !price}
              className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dark disabled:opacity-50 transition-colors">{saving ? "Adding..." : "Add"}</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-txt-muted text-sm hover:text-txt-primary transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {!pf.holdings.length ? (
        <div className="bg-bg-card border border-border rounded-xl p-10 text-center">
          <p className="text-sm text-txt-secondary mb-1">No holdings yet</p>
          <p className="text-[11px] text-txt-dim">Add stocks, ETFs, or mutual funds to this portfolio</p>
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="border-b border-border bg-bg-primary/50">
                <th className="px-4 py-3 text-[11px] text-txt-dim font-medium text-left">Symbol</th>
                <th className="px-3 py-3 text-[11px] text-txt-dim font-medium text-left">Type</th>
                <th className="px-3 py-3 text-[11px] text-txt-dim font-medium text-right">Qty</th>
                <th className="px-3 py-3 text-[11px] text-txt-dim font-medium text-right">Buy Price</th>
                <th className="px-3 py-3 text-[11px] text-txt-dim font-medium text-right">CMP</th>
                <th className="px-3 py-3 text-[11px] text-txt-dim font-medium text-right">Invested</th>
                <th className="px-3 py-3 text-[11px] text-txt-dim font-medium text-right">Current</th>
                <th className="px-4 py-3 text-[11px] text-txt-dim font-medium text-right min-w-[130px]">P&L</th>
                <th className="px-4 py-3 text-[11px] text-txt-dim font-medium text-left min-w-[180px]">AI Strategy & Trailing Stop</th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pf.holdings.map(h => {
                const pos = h.pnl != null && Number(h.pnl) >= 0;
                const sig = signalMap.get(h.id);
                return (
                  <tr key={h.id} className="border-b border-border last:border-0 hover:bg-bg-hover/50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => setViewStock(h.symbol)} className="font-medium text-accent-light hover:underline text-sm">{h.symbol}</button>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-txt-muted">{h.asset_type}</td>
                    <td className="px-3 py-3 text-right font-mono text-txt-primary">{fmtQty(h.quantity)}</td>
                    <td className="px-3 py-3 text-right font-mono text-txt-secondary">₹{fmt(h.buy_price)}</td>
                    <td className="px-3 py-3 text-right font-mono text-txt-primary">{h.current_price ? `₹${fmt(h.current_price)}` : "—"}</td>
                    <td className="px-3 py-3 text-right font-mono text-txt-secondary">₹{fmt(h.invested_value)}</td>
                    <td className="px-3 py-3 text-right font-mono text-txt-primary">{h.current_value ? `₹${fmt(h.current_value)}` : "—"}</td>
                    <td className="px-4 py-3 text-right min-w-[130px]">
                      {h.pnl != null ? (
                        <div>
                          <span className={`font-mono text-sm ${pos ? "text-gain" : "text-loss"}`}>
                            {pos ? "+" : ""}₹{fmt(h.pnl)}
                          </span>
                          {h.pnl_pct != null && (
                            <span className={`text-[11px] ml-1.5 ${pos ? "text-gain" : "text-loss"}`}>
                              ({h.pnl_pct >= 0 ? "+" : ""}{h.pnl_pct.toFixed(2)}%)
                            </span>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-left min-w-[180px]">
                      {sig ? (
                        <div>
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ backgroundColor: `${sig.status_color}22`, color: sig.status_color }}
                          >
                            {sig.ai_status}
                          </span>
                          <div className="text-[11px] text-txt-dim mt-0.5">
                            Trail SL: <strong className="text-rose-400 font-mono">₹{fmt(sig.trailing_stop_loss)}</strong>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-txt-dim">Auditing...</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <button onClick={() => remove(h.id)} className="text-txt-dim hover:text-loss transition-colors" title="Remove">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewStock && <StockModal symbol={viewStock} onClose={() => setViewStock(null)} />}
    </div>
  );
}
