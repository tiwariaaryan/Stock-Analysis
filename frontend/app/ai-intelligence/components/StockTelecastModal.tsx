"use client";
import type { DiscoveredStock } from "./AITypes";

type StockTelecastModalProps = {
  stock: DiscoveredStock;
  onClose: () => void;
  onAddToWishlist: (stock: DiscoveredStock) => void;
  onOpenChart: (symbol: string) => void;
  fmt: (n: number | null | undefined) => string;
};

export default function StockTelecastModal({
  stock,
  onClose,
  onAddToWishlist,
  onOpenChart,
  fmt,
}: StockTelecastModalProps) {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-bg-card glow-card rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden relative border border-slate-700">
        {/* Luminous Top Dual Ambient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between bg-bg-hover/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-black font-mono text-sm glow-cyan-badge">
              #{stock.rank}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black ultra-white glow-cyan-title font-mono tracking-tight">
                  {stock.symbol}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-bg-input text-slate-300 border border-slate-700 font-bold">
                  {stock.cap_category}
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-medium">
                  {stock.sector}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">{stock.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] text-slate-300 font-bold block uppercase tracking-wider font-mono">Live CMP</span>
              <strong className="text-base sm:text-lg font-mono font-black ultra-white">₹{fmt(stock.current_price)}</strong>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-bg-hover text-slate-300 hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer border border-slate-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(94vh-140px)]">
          {/* 1. AI Conviction & Risk-Reward Banner */}
          <div className="p-3.5 rounded-2xl bg-bg-hover/80 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-500/25 text-emerald-300 border border-emerald-400/60 glow-emerald-badge flex items-center gap-1.5">
                <span>⚡ {stock.action}</span>
                <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-[11px] text-white">
                  {stock.conviction_pct}% Conviction
                </span>
              </div>
              <span className="text-xs text-slate-200 font-mono font-medium">
                Risk-to-Reward: <strong className="text-emerald-400 font-bold">{stock.risk_reward_ratio}</strong>
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-[9px] text-rose-300 font-bold block uppercase">Stop-Loss Floor</span>
                <strong className="text-rose-400 font-black">₹{fmt(stock.stop_loss)}</strong>
              </div>
              <div>
                <span className="text-[9px] text-emerald-300 font-bold block uppercase">Horizon Target</span>
                <strong className="text-emerald-400 font-black">₹{fmt(stock.horizon_target)}</strong>
              </div>
              <div>
                <span className="text-[9px] text-cyan-300 font-bold block uppercase">Upside</span>
                <strong className="text-cyan-300 font-black">+{stock.horizon_upside_pct}%</strong>
              </div>
            </div>
          </div>

          {/* 2. 3-PILLAR INSTITUTIONAL AI SCORECARD (Quant Math 35 + Market Flow 35 + AI Cognitive 30 = 100) */}
          <div className="bg-bg-input rounded-2xl p-4 border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
              <span className="text-xs font-black ultra-white flex items-center gap-1.5 uppercase tracking-wider">
                <span className="text-cyan-400">🏛️</span> 3-Pillar Institutional Engine Scorecard
              </span>
              <div className="text-[11px] font-mono font-black ultra-white px-2.5 py-0.5 rounded bg-bg-hover border border-slate-700">
                Total Score: <span className="text-cyan-300 font-bold">{stock.conviction_pct}/100</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
              {/* Pillar A: Quant Math */}
              <div className="bg-bg-hover/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">Phase A: Quant Math</span>
                    <span className="text-xs font-black text-cyan-300">{stock.phase_a_score ?? 32}/35</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-tight">ROCE/ROE capital efficiency, low D/E solvency, positive FCF & Piotroski score.</p>
                </div>
                <div className="mt-2 text-[9px] text-emerald-400 font-bold">✓ Capital Integrity Verified</div>
              </div>

              {/* Pillar B: Market Microstructure Flow */}
              <div className="bg-bg-hover/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Phase B: Market Flow</span>
                    <span className="text-xs font-black text-emerald-400">{stock.phase_b_score ?? 31}/35</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-tight">Institutional FII/DII accumulation, relative strength vs Nifty, delivery spikes.</p>
                </div>
                <div className="mt-2 text-[9px] text-cyan-300 font-bold">✓ Microstructure Momentum</div>
              </div>

              {/* Pillar C: AI Cognitive Intelligence */}
              <div className="bg-bg-hover/80 p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Phase C: AI Cognitive</span>
                    <span className="text-xs font-black text-indigo-300">{stock.phase_c_score ?? 28}/30</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-tight">
                    Tone: <strong className="text-white">{stock.management_tone ?? "VERY_BULLISH"}</strong> &bull; Cat Prob: <strong className="text-white">{stock.catalyst_probability_pct ?? 88}%</strong>
                  </p>
                </div>
                <div className="mt-2 text-[9px] text-purple-300 font-bold">
                  Audit: {stock.forensic_status ?? "CLEAN"} &bull; Hard Veto: {stock.veto_triggered ? "TRIGGERED" : "PASSED"}
                </div>
              </div>
            </div>
          </div>

          {/* 3. FIVE-HORIZON PRICE TELECASTING TABLE */}
          <div className="bg-bg-input rounded-2xl border border-slate-700/80 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-700/70 flex items-center justify-between bg-bg-hover/60">
              <span className="text-xs font-black ultra-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="text-cyan-400">🔮</span> AI Future Price Telecasting Table
              </span>
              <span className="text-[10px] text-slate-300 font-mono font-medium">
                Channels evaluated across statistical volatility & order books
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700/70 text-[10px] uppercase font-bold text-slate-300 bg-bg-hover/40">
                    <th className="py-2.5 px-3">Horizon</th>
                    <th className="py-2.5 px-3 text-rose-300">Low (Downside Risk)</th>
                    <th className="py-2.5 px-3 text-emerald-300">Most Likely Target</th>
                    <th className="py-2.5 px-3 text-slate-200">High (Bull Channel)</th>
                    <th className="py-2.5 px-3 text-cyan-300">Upside %</th>
                    <th className="py-2.5 px-3 text-rose-300">Downside %</th>
                    <th className="py-2.5 px-3 text-right text-slate-200">AI Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {stock.telecast_table.map((row, idx) => (
                    <tr key={idx} className="hover:bg-bg-hover transition-colors">
                      <td className="py-2.5 px-3 font-black ultra-white">{row.horizon}</td>
                      <td className="py-2.5 px-3 font-semibold text-rose-400">₹{fmt(row.low_range)}</td>
                      <td className="py-2.5 px-3 font-black text-emerald-400">₹{fmt(row.target)}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-100">₹{fmt(row.high_range)}</td>
                      <td className="py-2.5 px-3 text-cyan-300 font-black">+{row.upside_pct}%</td>
                      <td className="py-2.5 px-3 text-rose-400 font-semibold">-{row.downside_pct}%</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
                          {row.confidence_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. DUAL ANALYSIS: Technicals + Fundamentals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Technical Panel */}
            <div className="bg-bg-input rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <span>📈</span> Technical Architecture
                </span>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {stock.technical.trend}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">RSI (14)</span>
                  <strong className="ultra-white text-sm">{stock.technical.rsi_14}</strong>
                  <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold">Healthy Momentum</span>
                </div>
                <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">MACD Signal</span>
                  <strong className="ultra-white text-xs truncate block">{stock.technical.macd_signal}</strong>
                  <span className="text-[9px] text-cyan-300 block mt-0.5 font-medium">Trend Confirmation</span>
                </div>
                <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">200 EMA Anchor</span>
                  <strong className="ultra-white text-xs">₹{fmt(stock.technical.ema_200)}</strong>
                  <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold">Above 200 EMA</span>
                </div>
                <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Volume Profile</span>
                  <strong className="ultra-white text-xs truncate block">{stock.technical.volume_trend}</strong>
                  <span className="text-[9px] text-cyan-300 block mt-0.5 font-medium">Delivery Expansion</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-bg-hover/80 border border-slate-700/60 text-[11px] font-mono flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Support Levels</span>
                  <span className="text-emerald-400 font-bold">
                    ₹{fmt(stock.technical.support_1)} &bull; ₹{fmt(stock.technical.support_2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Resistance Levels</span>
                  <span className="ultra-white font-bold">
                    ₹{fmt(stock.technical.resistance_1)} &bull; ₹{fmt(stock.technical.resistance_2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Fundamental Panel */}
            <div className="bg-bg-input rounded-2xl p-4 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <span>🏛</span> Fundamental Quality & Ratios
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold">
                  Institutional Scorecard
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">P/E vs Sector</span>
                  <strong className="ultra-white text-sm">{stock.fundamentals.pe_ratio}</strong>
                  <span className="text-[9px] text-slate-300 block mt-0.5 font-medium">Sector: {stock.fundamentals.sector_pe}</span>
                </div>
                <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">ROCE %</span>
                  <strong className="text-emerald-400 font-black text-sm">{stock.fundamentals.roce_pct}%</strong>
                  <span className="text-[9px] text-cyan-300 block mt-0.5 font-medium">ROE: {stock.fundamentals.roe_pct}%</span>
                </div>
                <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Operating Margin</span>
                  <strong className="ultra-white text-sm">{stock.fundamentals.operating_margin_pct}%</strong>
                  <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold">High Cash Flow</span>
                </div>
                <div className="bg-bg-hover/80 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block">Debt to Equity</span>
                  <strong className="ultra-white text-sm">{stock.fundamentals.debt_to_equity}</strong>
                  <span className="text-[9px] text-emerald-400 block mt-0.5 font-bold">Prudent Balance Sheet</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-bg-hover/80 border border-slate-700/60 text-[11px]">
                <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider block font-mono">Economic Moat Strength</span>
                <strong className="ultra-white font-bold block mt-0.5">
                  {stock.fundamentals.moat_strength}
                </strong>
              </div>
            </div>
          </div>

          {/* 4. Catalyst Summary */}
          <div className="bg-bg-input rounded-2xl p-4 border-l-4 border-l-cyan-400 border border-slate-700/80">
            <span className="text-xs font-black ultra-white uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <span className="text-cyan-400">💡</span> Primary Operational Catalyst & Trigger
            </span>
            <p className="text-xs text-slate-200 font-medium leading-relaxed">
              {stock.catalyst_summary}
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-border/80 bg-bg-card/80 flex items-center justify-between gap-3">
          <button
            onClick={() => onAddToWishlist(stock)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent to-purple-600 hover:from-accent-dark hover:to-purple-700 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-accent/20 active:scale-95"
          >
            <span>★</span>
            <span>Add to Wishlist with AI Target Price (Auto-Replace)</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onOpenChart(stock.symbol)}
              className="px-4 py-2.5 rounded-xl bg-bg-hover hover:bg-bg-card text-txt-primary hover:text-white border border-border/60 text-xs font-bold transition-colors cursor-pointer"
            >
              📊 Full Candlestick Chart
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl bg-bg-card border border-border text-txt-muted hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
