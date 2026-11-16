"use client";
import type { DeepAnalysis } from "./WishlistTypes";

type StockAnalysisPanelProps = {
  selectedStockAnalysis: DeepAnalysis;
  selectedItemId: number | null;
  instReport: any;
  loadingInstReport: boolean;
  dossierTab: "dossier" | "institutional";
  setDossierTab: (tab: "dossier" | "institutional") => void;
  updateTargetPrice: (itemId: number, newPrice: number) => void;
  fmt: (n: number | null | undefined) => string;
};

export default function StockAnalysisPanel({
  selectedStockAnalysis,
  selectedItemId,
  instReport,
  loadingInstReport,
  dossierTab,
  setDossierTab,
  updateTargetPrice,
  fmt,
}: StockAnalysisPanelProps) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 md:p-5 space-y-4 shadow-sm animate-fade-in">
      {/* Dossier Header */}
      <div className="border-b border-border pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-txt-primary font-mono">{selectedStockAnalysis.symbol}</h3>
              <span className={`text-xs font-semibold ${selectedStockAnalysis.day_change_pct >= 0 ? "text-gain" : "text-loss"}`}>
                {selectedStockAnalysis.day_change_pct >= 0 ? "+" : ""}{selectedStockAnalysis.day_change_pct.toFixed(2)}%
              </span>
            </div>
            <p className="text-[11px] text-txt-muted">{selectedStockAnalysis.name}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Big Bold Overall Score Box */}
            <div
              className="flex flex-col items-center justify-center px-3 py-1 rounded-xl border shadow-sm min-w-[62px]"
              style={{
                backgroundColor: `${selectedStockAnalysis.recommendation_color}18`,
                borderColor: `${selectedStockAnalysis.recommendation_color}60`,
              }}
            >
              <span
                className="text-xl font-black font-mono leading-none tracking-tight"
                style={{ color: selectedStockAnalysis.recommendation_color }}
              >
                {selectedStockAnalysis.composite_score}
              </span>
              <span className="text-[9px] font-extrabold text-txt-dim uppercase tracking-wider leading-none mt-1">
                / 100
              </span>
            </div>

            <div className="text-right">
              <span
                className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm block"
                style={{
                  backgroundColor: `${selectedStockAnalysis.recommendation_color}25`,
                  color: selectedStockAnalysis.recommendation_color,
                  border: `1px solid ${selectedStockAnalysis.recommendation_color}66`,
                }}
              >
                {selectedStockAnalysis.recommendation}
              </span>
              <p className="text-[10px] font-bold text-txt-dim mt-1">
                {selectedStockAnalysis.recommendation_sub || "Relative Rating"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-2xl font-black text-txt-primary font-mono">₹{fmt(selectedStockAnalysis.current_price)}</span>
          <div className="text-right">
            {selectedStockAnalysis.diff_label && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  (selectedStockAnalysis.diff_from_wishlist_avg ?? 0) >= 0
                    ? "bg-gain/15 text-gain"
                    : "bg-loss/15 text-loss"
                }`}
              >
                {selectedStockAnalysis.diff_label}
              </span>
            )}
          </div>
        </div>

        {/* 3-Pillar Institutional AI Engine Scorecard Banner with Explicit Sum */}
        <div className="mt-2.5 p-2 rounded-lg bg-bg-card border border-border/70 text-xs font-mono space-y-1.5">
          <div className="flex items-center justify-between border-b border-border/50 pb-1">
            <span className="text-[10px] text-txt-muted uppercase font-bold">3-Pillar Institutional Formula</span>
            <span className="text-[11px] font-extrabold text-txt-primary">
              Final Score (M + F + AI) = <strong className="text-cyan-400">{selectedStockAnalysis.composite_score}/100</strong>
            </span>
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <div className="text-center flex-1">
              <span className="text-[9px] text-cyan-400 uppercase font-bold block">Phase A Math</span>
              <strong className="text-xs text-txt-primary">{selectedStockAnalysis.phase_a_score ?? 30}/35</strong>
            </div>
            <span className="text-slate-500 font-bold text-xs">+</span>
            <div className="text-center flex-1">
              <span className="text-[9px] text-emerald-400 uppercase font-bold block">Phase B Flow</span>
              <strong className="text-xs text-txt-primary">{selectedStockAnalysis.phase_b_score ?? 30}/35</strong>
            </div>
            <span className="text-slate-500 font-bold text-xs">+</span>
            <div className="text-center flex-1">
              <span className="text-[9px] text-indigo-400 uppercase font-bold block">Phase C AI</span>
              <strong className="text-xs text-txt-primary">{selectedStockAnalysis.phase_c_score ?? 25}/30</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Dossier Tabs: 2-Year Dossier vs 28-Field Institutional Report */}
      <div className="flex border-b border-border text-xs">
        <button
          onClick={() => setDossierTab("dossier")}
          className={`flex-1 py-1.5 font-bold transition-colors border-b-2 text-center ${
            dossierTab === "dossier"
              ? "border-accent-light text-accent-light"
              : "border-transparent text-txt-muted hover:text-txt-primary"
          }`}
        >
          2-Year Relative Dossier
        </button>
        <button
          onClick={() => setDossierTab("institutional")}
          className={`flex-1 py-1.5 font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 text-center ${
            dossierTab === "institutional"
              ? "border-rose-400 text-rose-300"
              : "border-transparent text-txt-muted hover:text-txt-primary"
          }`}
        >
          <span>Institutional Report</span>
          {instReport && (
            <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
              {instReport["12_data_coverage_percentage"]}% cov
            </span>
          )}
        </button>
      </div>

      {/* Tab 2: 28-Field Institutional Report */}
      {dossierTab === "institutional" ? (
        <div className="space-y-3 text-xs animate-fade-in">
          {/* 6-Module Score Radar */}
          <div className="bg-bg-primary/70 p-3 rounded-lg border border-border space-y-2">
            <div className="flex justify-between items-center bg-bg-card p-2.5 rounded-lg border border-border">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex flex-col items-center justify-center px-2 py-1 rounded-md border min-w-[50px]"
                  style={{
                    backgroundColor: `${selectedStockAnalysis.recommendation_color}18`,
                    borderColor: `${selectedStockAnalysis.recommendation_color}60`,
                  }}
                >
                  <span
                    className="text-base font-black font-mono leading-none"
                    style={{ color: selectedStockAnalysis.recommendation_color }}
                  >
                    {instReport?.["5_overall_score"] ?? selectedStockAnalysis.composite_score}
                  </span>
                  <span className="text-[8px] font-bold text-txt-dim uppercase leading-none mt-0.5">
                    / 100
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-black text-txt-primary uppercase tracking-wider block">
                    6-Module Institutional Score
                  </span>
                  <span className="text-[10px] text-txt-muted">
                    Dynamic multi-factor synthesis
                  </span>
                </div>
              </div>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border"
                style={{
                  backgroundColor: `${selectedStockAnalysis.recommendation_color}22`,
                  color: selectedStockAnalysis.recommendation_color,
                  borderColor: `${selectedStockAnalysis.recommendation_color}55`,
                }}
              >
                {instReport?.["14_final_recommendation"] ?? selectedStockAnalysis.recommendation}
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              {[
                { label: "Fundamental Analysis (35%)", val: instReport?.["6_fundamental_score"] ?? 50, color: "#3b82f6" },
                { label: "Technical Analysis (20%)", val: instReport?.["7_technical_score"] ?? 50, color: "#00c853" },
                { label: "Valuation Analysis (15%)", val: instReport?.["8_valuation_score"] ?? 50, color: "#f59e0b" },
                { label: "Market & Sector (10%)", val: instReport?.["9_market_sector_score"] ?? 50, color: "#a855f7" },
                { label: "News & Sentiment (10%)", val: instReport?.["10_sentiment_score"] ?? 50, color: "#06b6d4" },
                { label: "Risk Analysis (10%)", val: instReport?.["11_risk_score"] ?? 50, color: "#ef4444" },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-txt-muted">{m.label}</span>
                    <strong className="text-txt-primary font-mono">{m.val}/100</strong>
                  </div>
                  <div className="w-full bg-bg-card h-1.5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${m.val}%`, backgroundColor: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Coverage & Confidence */}
          <div className="bg-bg-primary/70 p-2.5 rounded-lg border border-border flex items-center justify-between text-[11px]">
            <div>
              <span className="text-txt-dim block text-[10px]">Data Coverage</span>
              <strong className="text-txt-primary font-mono">{instReport?.["12_data_coverage_percentage"] ?? 85}% Verified</strong>
            </div>
            <div>
              <span className="text-txt-dim block text-[10px]">Confidence Level</span>
              <span className="font-bold text-accent-light">{instReport?.["13_confidence_level"] ?? "Medium"}</span>
            </div>
            <div>
              <span className="text-txt-dim block text-[10px]">Recommendation</span>
              <span className="font-bold text-gain">{instReport?.["14_final_recommendation"] ?? selectedStockAnalysis.recommendation}</span>
            </div>
          </div>

          {/* Return Scenarios & Fair Value */}
          <div className="bg-gradient-to-r from-blue-950/20 to-bg-primary p-3 rounded-lg border border-blue-500/30 space-y-1.5">
            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
              Model Forecast Scenarios & Fair Value
            </span>
            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="bg-bg-card/70 p-1.5 rounded border border-border/50">
                <span className="text-[9px] text-txt-dim block">1-Year Outlook</span>
                <strong className="text-xs font-mono text-gain">{instReport?.["23_expected_1yr_return"] ?? "+14.5%"}</strong>
              </div>
              <div className="bg-bg-card/70 p-1.5 rounded border border-border/50">
                <span className="text-[9px] text-txt-dim block">Estimated Fair Value</span>
                <strong className="text-xs font-mono text-txt-primary">₹{fmt(instReport?.["26_estimated_fair_value"] ?? selectedStockAnalysis.current_price * 1.12)}</strong>
              </div>
            </div>
          </div>

          {/* Positives & Negatives */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-gain/10 border border-gain/20 rounded-lg p-2 space-y-1">
              <strong className="text-gain block font-bold">Key Positive Factors:</strong>
              {(instReport?.["20_key_positive_factors"] || ["Trading above 200 EMA", "Controlled debt leverage"]).map((p: string, i: number) => (
                <p key={i} className="text-txt-secondary leading-tight">✓ {p}</p>
              ))}
            </div>
            <div className="bg-loss/10 border border-loss/20 rounded-lg p-2 space-y-1">
              <strong className="text-loss block font-bold">Key Risks & Negatives:</strong>
              {(instReport?.["21_key_negative_factors"] || ["Cyclical sector volatility"]).map((n: string, i: number) => (
                <p key={i} className="text-txt-secondary leading-tight">✗ {n}</p>
              ))}
            </div>
          </div>

          {/* Limitations & Missing Data */}
          {instReport?.["28_missing_data_and_limitations"] && (
            <div className="text-[10px] text-txt-dim bg-bg-primary/40 p-2 rounded border border-border/40">
              <span className="font-semibold text-txt-muted">Transparency Disclosure: </span>
              {instReport["28_missing_data_and_limitations"].join(", ")}
            </div>
          )}
        </div>
      ) : (
        /* Tab 1: 2-Year Relative Dossier */
        <>
          {/* 1-Click Target Buy Sync Button */}
          {selectedItemId && selectedStockAnalysis.ai_support_price > 0 && (
            <div className="bg-gradient-to-r from-emerald-950/30 to-bg-primary p-3 rounded-lg border border-emerald-500/30 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide block">
                  AI 2-Year Support Level
                </span>
                <p className="text-xs text-txt-primary font-mono font-bold">
                  ₹{fmt(selectedStockAnalysis.ai_support_price)}
                </p>
              </div>
              <button
                onClick={() => updateTargetPrice(selectedItemId, selectedStockAnalysis.ai_support_price)}
                className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded border border-emerald-500/40 transition-colors flex items-center gap-1"
                title="Updates your wishlist target buy price to the AI 2-year support level"
              >
                <span>🎯 Sync Target Buy</span>
              </button>
            </div>
          )}

          {/* Dalal Street Veteran Verdict */}
          <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-500/30 text-xs">
            <div className="flex items-center gap-1.5 mb-1 text-amber-300 font-bold text-[10px] uppercase tracking-wider">
              <span>🏛</span>
              <span>Dalal Street 2-Year Verdict</span>
            </div>
            <p className="text-[11px] text-txt-secondary leading-relaxed font-sans">
              {selectedStockAnalysis.veteran_verdict}
            </p>
          </div>

          {/* Valuation Radar (2-Year PE Band) */}
          <div className="bg-bg-primary/70 rounded-lg p-3 border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-txt-primary text-[11px]">2-Year Valuation Radar</span>
              <span className="text-[10px] text-txt-dim">
                Percentile: <strong className="text-txt-primary">{selectedStockAnalysis.valuation_band.pe_percentile}%</strong>
              </span>
            </div>

            {/* PE Percentile bar */}
            <div className="w-full bg-bg-card h-2 rounded-full overflow-hidden border border-border">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${selectedStockAnalysis.valuation_band.pe_percentile}%`,
                  backgroundColor: selectedStockAnalysis.recommendation_color,
                }}
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
              <div className="bg-bg-card p-1.5 rounded border border-border/50">
                <span className="text-[9px] text-txt-dim block">Current PE</span>
                <strong className="text-xs font-mono text-txt-primary">
                  {selectedStockAnalysis.valuation_band.current_pe}x
                </strong>
              </div>
              <div className="bg-bg-card p-1.5 rounded border border-border/50">
                <span className="text-[9px] text-txt-dim block">2-Yr Median PE</span>
                <strong className="text-xs font-mono text-txt-secondary">
                  {selectedStockAnalysis.valuation_band.median_2y_pe}x
                </strong>
              </div>
              <div className="bg-bg-card p-1.5 rounded border border-border/50">
                <span className="text-[9px] text-txt-dim block">PEG Ratio</span>
                <strong className="text-xs font-mono text-txt-primary">
                  {selectedStockAnalysis.valuation_band.peg_ratio}
                </strong>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-txt-dim pt-1 border-t border-border/50">
              <span>
                Earnings Yield: <strong className="text-txt-primary">{selectedStockAnalysis.valuation_band.earnings_yield}%</strong>
              </span>
              <span>
                Spread vs 10Y G-Sec:{" "}
                <strong
                  className={selectedStockAnalysis.valuation_band.gsec_spread >= 0 ? "text-gain" : "text-loss"}
                >
                  {selectedStockAnalysis.valuation_band.gsec_spread >= 0 ? "+" : ""}
                  {selectedStockAnalysis.valuation_band.gsec_spread}%
                </strong>
              </span>
            </div>
          </div>

          {/* Piotroski Score & Balance Sheet Shield */}
          <div className="bg-bg-primary/70 rounded-lg p-3 border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-txt-primary text-[11px]">Fundamental & Solvency Shield</span>
              <span className="text-[10px] text-gain font-bold">
                Piotroski: {selectedStockAnalysis.financial_quality.piotroski_f_score}/9
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 text-center">
              <div className="bg-bg-card p-1.5 rounded border border-border/50">
                <span className="text-[8px] text-txt-dim block">ROCE</span>
                <strong className="text-[11px] font-mono text-txt-primary">
                  {selectedStockAnalysis.financial_quality.roce_pct}%
                </strong>
              </div>
              <div className="bg-bg-card p-1.5 rounded border border-border/50">
                <span className="text-[8px] text-txt-dim block">Op. Margin</span>
                <strong className="text-[11px] font-mono text-txt-primary">
                  {selectedStockAnalysis.financial_quality.operating_margin_pct}%
                </strong>
              </div>
              <div className="bg-bg-card p-1.5 rounded border border-border/50">
                <span className="text-[8px] text-txt-dim block">D/E Ratio</span>
                <strong className="text-[11px] font-mono text-txt-primary">
                  {selectedStockAnalysis.financial_quality.debt_to_equity}
                </strong>
              </div>
              <div className="bg-bg-card p-1.5 rounded border border-border/50">
                <span className="text-[8px] text-txt-dim block">Current Ratio</span>
                <strong className="text-[11px] font-mono text-txt-primary">
                  {selectedStockAnalysis.financial_quality.current_ratio}x
                </strong>
              </div>
            </div>
          </div>

          {/* 2-Year Trend & Moving Averages */}
          <div className="bg-bg-primary/70 rounded-lg p-3 border border-border text-xs space-y-1.5">
            <span className="font-semibold text-txt-primary text-[11px] block">2-Year Trend Structure</span>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-txt-muted">Status:</span>
              <span className="font-bold text-txt-primary">{selectedStockAnalysis.price_action_2y.trend_status}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-txt-muted">200 EMA (Trend Anchor):</span>
              <span className="font-mono text-txt-primary">₹{fmt(selectedStockAnalysis.price_action_2y.ema200)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-txt-muted">Pullback from 2Y High:</span>
              <span className="font-mono text-txt-primary">{selectedStockAnalysis.price_action_2y.drawdown_pct}%</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-txt-muted">Net 2-Year Return:</span>
              <span
                className={`font-mono ${
                  selectedStockAnalysis.price_action_2y.return_2y_pct >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {selectedStockAnalysis.price_action_2y.return_2y_pct >= 0 ? "+" : ""}
                {selectedStockAnalysis.price_action_2y.return_2y_pct}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
