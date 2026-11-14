"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Technicals = {
  rsi: number;
  ema20: number;
  ema50: number;
  ema200: number;
  macd: { macd: number; signal: number; hist: number; bullish_cross: boolean };
  volume_ratio: number;
  drawdown_from_52w_high: number;
  week_52_high: number;
  week_52_low: number;
};

type PatternAnalogy = {
  matched_events_count: number;
  win_rate_pct: number;
  avg_forward_return_pct: number;
  summary: string;
  analogy_text: string;
};

type LadderStep = {
  tranche: number;
  pct: number;
  price: number;
  status: string;
};

type StockStrategy = {
  symbol: string;
  name: string;
  current_price: number;
  day_change_pct: number;
  ai_score: number;
  signal: string;
  signal_color: string;
  action_summary: string;
  risk_reward_ratio: string;
  recommended_stop_loss: number;
  target_milestone_1: number;
  target_milestone_2: number;
  technicals: Technicals;
  pattern_analogy: PatternAnalogy;
  staggered_ladder: LadderStep[];
  veteran_commentary: string;
  updated_at: string;
};

type SectorRotation = {
  name: string;
  momentum: string;
  status: string;
  color: string;
};

type MacroRegime = {
  macro_regime: string;
  regime_color: string;
  recommended_cash_position: string;
  market_advice: string;
  nifty_value: number;
  nifty_change_pct: number;
  sectors_rotation: SectorRotation[];
  updated_at: string;
};

type DailySnapshot = {
  macro_regime: string;
  regime_color: string;
  cash_guidance: string;
  macro_advice: string;
  portfolio_action_points: string[];
  wishlist_buy_triggers: string[];
  sector_inflows: string[];
};

const QUICK_STOCKS = ["TMPV", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ZOMATO", "JPPOWER"];

export default function AIIntelligencePage() {
  const [macro, setMacro] = useState<MacroRegime | null>(null);
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState("TMPV");
  const [searchInput, setSearchInput] = useState("");
  const [strategy, setStrategy] = useState<StockStrategy | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/strategy/market-regime`)
      .then((r) => r.json())
      .then((d) => setMacro(d))
      .catch(() => {});

    fetch(`${API}/api/v1/strategy/daily-snapshot`)
      .then((r) => r.json())
      .then((d) => setSnapshot(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSymbol) return;
    setLoadingStrategy(true);
    setErrorMsg(null);
    fetch(`${API}/api/v1/strategy/stock/${encodeURIComponent(selectedSymbol)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load AI strategy");
        return r.json();
      })
      .then((d) => {
        setStrategy(d);
        setLoadingStrategy(false);
      })
      .catch((e) => {
        setErrorMsg(e.message);
        setLoadingStrategy(false);
      });
  }, [selectedSymbol]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (clean) {
      setSelectedSymbol(clean);
      setSearchInput("");
    }
  }

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="text-xs uppercase font-bold tracking-wider text-rose-400">InvestIntel Quant Core</span>
          </div>
          <h1 className="text-2xl font-bold text-txt-primary">AI Market Intelligence Hub</h1>
          <p className="text-xs text-txt-secondary mt-0.5">
            Pragmatic Dalal Street quant scoring, 3-stage dip ladders, statistical win rates & macro regime radar
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="px-3.5 py-1.5 rounded-lg bg-accent-muted text-accent-light hover:bg-accent-muted/80 text-xs font-semibold flex items-center gap-2 border border-accent/30 transition-colors"
          >
            <span>Ask Dalal Street Copilot</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>

      {/* Top Section: Macro Regime & Daily 2-Min Actionable Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Macro Market Regime */}
        <div className="lg:col-span-1 bg-bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-txt-muted uppercase tracking-wider">Macro Market Regime</span>
              {macro && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: `${macro.regime_color}22`, color: macro.regime_color }}
                >
                  {macro.macro_regime}
                </span>
              )}
            </div>

            {macro ? (
              <div className="space-y-3">
                <div className="bg-bg-primary/60 rounded-lg p-3 border border-border">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs text-txt-muted">NIFTY 50</span>
                    <span className="text-sm font-bold text-txt-primary font-mono">{fmt(macro.nifty_value)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-txt-dim text-[11px]">Recommended Cash Buffer:</span>
                    <strong className="text-txt-primary text-[11px]">{macro.recommended_cash_position}</strong>
                  </div>
                </div>

                <p className="text-xs text-txt-secondary leading-relaxed bg-bg-hover/40 p-2.5 rounded-lg border border-border/50">
                  <strong className="text-txt-primary font-medium">Dalal Street Guidance:</strong> {macro.market_advice}
                </p>
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center text-xs text-txt-muted">Loading Macro Regime...</div>
            )}
          </div>

          {/* Sector Rotation */}
          {macro && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[11px] font-semibold text-txt-muted mb-2 uppercase tracking-wide">Sector Inflows vs Outflows</p>
              <div className="grid grid-cols-2 gap-1.5">
                {macro.sectors_rotation.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] p-1.5 bg-bg-primary/50 rounded border border-border/40">
                    <span className="truncate pr-1 text-txt-secondary" title={s.name}>{s.name.split("/")[0]}</span>
                    <span className="text-[10px] font-bold font-mono" style={{ color: s.color }}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Daily 2-Minute Actionable Snapshot */}
        <div className="lg:col-span-2 bg-bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-sm">⚡</span>
                <span className="text-xs font-semibold text-txt-primary uppercase tracking-wider">
                  Daily 2-Minute Actionable Checklist
                </span>
              </div>
              <span className="text-[11px] text-txt-muted">Semi-Passive Action Feed</span>
            </div>

            {snapshot ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Wishlist buy triggers */}
                <div className="bg-bg-primary/70 rounded-lg p-3.5 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-txt-primary flex items-center gap-1.5">
                      <span className="text-amber-400">🎯</span> Wishlist Target Dip Triggers
                    </span>
                    <Link href="/wishlist" className="text-[11px] text-accent-light hover:underline">
                      View All &rarr;
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {snapshot.wishlist_buy_triggers.map((item, idx) => (
                      <div key={idx} className="text-xs text-txt-secondary bg-bg-card/70 p-2 rounded border border-border/60">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Portfolio Health & Milestones */}
                <div className="bg-bg-primary/70 rounded-lg p-3.5 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-txt-primary flex items-center gap-1.5">
                      <span className="text-emerald-400">🛡</span> Portfolio Health & Trailing Stops
                    </span>
                    <Link href="/portfolio" className="text-[11px] text-accent-light hover:underline">
                      View Holdings &rarr;
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {snapshot.portfolio_action_points.map((item, idx) => (
                      <div key={idx} className="text-xs text-txt-secondary bg-bg-card/70 p-2 rounded border border-border/60">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-xs text-txt-muted">Loading 2-Minute Snapshot...</div>
            )}
          </div>

          <div className="mt-4 pt-2.5 border-t border-border flex items-center justify-between text-[11px] text-txt-dim">
            <span>Built for semi-passive investing: no screen watching required</span>
            <span>Refreshes automatically with market quotes</span>
          </div>
        </div>
      </div>

      {/* Stock Quant & Pattern Analogy Explorer */}
      <div className="bg-bg-card border border-border rounded-xl p-4 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-bold text-txt-primary">Stock Quant & Pattern Analogy Engine</h2>
            <p className="text-xs text-txt-muted">
              Toggle AI / Danelfin style pattern matching, statistical win rate & 3-stage dip ladder generator
            </p>
          </div>

          {/* Quick Select Buttons & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-bg-primary p-1 rounded-lg border border-border">
              {QUICK_STOCKS.map((sym) => (
                <button
                  key={sym}
                  onClick={() => setSelectedSymbol(sym)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                    selectedSymbol === sym
                      ? "bg-accent-light text-black shadow-sm"
                      : "text-txt-muted hover:text-txt-primary hover:bg-bg-hover"
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Custom symbol..."
                className="w-28 sm:w-32 bg-bg-primary border border-border rounded-l-lg px-2.5 py-1 text-xs text-txt-primary focus:outline-none focus:border-accent-light uppercase"
              />
              <button
                type="submit"
                className="bg-accent-muted hover:bg-accent-muted/80 text-accent-light px-2.5 py-1 rounded-r-lg text-xs font-semibold border-y border-r border-accent/40"
              >
                Scan
              </button>
            </form>
          </div>
        </div>

        {/* Loading / Error States */}
        {loadingStrategy && (
          <div className="py-12 text-center text-txt-muted text-xs flex flex-col items-center gap-2">
            <span className="w-5 h-5 border-2 border-accent-light border-t-transparent rounded-full animate-spin"></span>
            Computing quantitative signals & running 5-year pattern analogy for {selectedSymbol}...
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-lg text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Strategy Dashboard Card */}
        {strategy && !loadingStrategy && (
          <div className="space-y-5">
            {/* Top Stat Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Symbol & Signal */}
              <div className="bg-bg-primary/80 border border-border rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-txt-primary font-mono">{strategy.symbol}</span>
                    <span className={`text-xs font-semibold ${strategy.day_change_pct >= 0 ? "text-gain" : "text-loss"}`}>
                      {strategy.day_change_pct >= 0 ? "+" : ""}{strategy.day_change_pct.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold text-txt-primary font-mono mt-1">₹{fmt(strategy.current_price)}</p>
                </div>

                <div className="mt-3 pt-3 border-t border-border">
                  <span
                    className="inline-block px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wide"
                    style={{ backgroundColor: `${strategy.signal_color}22`, color: strategy.signal_color }}
                  >
                    {strategy.signal}
                  </span>
                </div>
              </div>

              {/* Composite AI Quant Score */}
              <div className="bg-bg-primary/80 border border-border rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-txt-muted font-medium">Composite AI Score</span>
                    <span className="text-xs font-bold text-txt-primary">{strategy.ai_score}/100</span>
                  </div>
                  <div className="w-full bg-bg-card h-2.5 rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${strategy.ai_score}%`,
                        backgroundColor: strategy.signal_color,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-txt-secondary mt-2.5 leading-relaxed">{strategy.action_summary}</p>
                </div>

                <div className="text-[10px] text-txt-dim mt-2 pt-2 border-t border-border/50">
                  Factors: Momentum (40%) + Valuation/DD (35%) + Volume (25%)
                </div>
              </div>

              {/* Risk/Reward & Invalidation Stop-Loss */}
              <div className="bg-bg-primary/80 border border-border rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs text-txt-muted font-medium">Risk-to-Reward & Stop-Loss</span>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-txt-secondary">R:R Ratio:</span>
                      <strong className="text-txt-primary font-mono">{strategy.risk_reward_ratio}</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-rose-400 font-medium">Hard Stop-Loss:</span>
                      <strong className="text-rose-400 font-mono">₹{fmt(strategy.recommended_stop_loss)}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border text-[11px] text-txt-muted">
                  Invalidation protects capital against deep sector breakdowns.
                </div>
              </div>

              {/* Target Milestones */}
              <div className="bg-bg-primary/80 border border-border rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs text-txt-muted font-medium">Profit Target Milestones</span>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-400">Target 1 (Book 50%):</span>
                      <strong className="text-txt-primary font-mono">₹{fmt(strategy.target_milestone_1)}</strong>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-400">Target 2 (Runner):</span>
                      <strong className="text-txt-primary font-mono">₹{fmt(strategy.target_milestone_2)}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border text-[11px] text-txt-muted">
                  Lock initial gains and trail stop-loss to cost basis.
                </div>
              </div>
            </div>

            {/* Pattern Analogy Engine Box (Toggle AI / Trendlyne Style) */}
            <div className="bg-gradient-to-r from-blue-950/30 via-bg-primary to-purple-950/30 border border-blue-500/30 rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between border-b border-border/80 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-sm">📊</span>
                  <h3 className="text-xs font-bold text-blue-200 uppercase tracking-wider">
                    Toggle AI Historical Pattern Analogy Engine
                  </h3>
                </div>
                <span className="text-[11px] text-txt-muted">2–5 Year Lookback Pattern Search</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div className="bg-bg-card/80 p-3 rounded-lg border border-border/60">
                  <span className="text-[11px] text-txt-muted">Historical Win Rate</span>
                  <p className="text-xl font-extrabold text-gain font-mono mt-0.5">
                    {strategy.pattern_analogy.win_rate_pct}%
                  </p>
                  <p className="text-[10px] text-txt-dim mt-0.5">Probability of positive 40-day return</p>
                </div>

                <div className="bg-bg-card/80 p-3 rounded-lg border border-border/60">
                  <span className="text-[11px] text-txt-muted">Avg Forward 40D Return</span>
                  <p className="text-xl font-extrabold text-txt-primary font-mono mt-0.5">
                    +{strategy.pattern_analogy.avg_forward_return_pct}%
                  </p>
                  <p className="text-[10px] text-txt-dim mt-0.5">Across matched historical setups</p>
                </div>

                <div className="bg-bg-card/80 p-3 rounded-lg border border-border/60">
                  <span className="text-[11px] text-txt-muted">Matched Historical Events</span>
                  <p className="text-xl font-extrabold text-blue-300 font-mono mt-0.5">
                    {strategy.pattern_analogy.matched_events_count} Setups
                  </p>
                  <p className="text-[10px] text-txt-dim mt-0.5">Matching RSI & Drawdown bounds</p>
                </div>
              </div>

              <p className="text-xs text-txt-secondary leading-relaxed bg-bg-card/50 p-3 rounded-lg border border-border/50">
                <strong className="text-txt-primary">Pattern Insight:</strong> {strategy.pattern_analogy.analogy_text}
              </p>
            </div>

            {/* 3-Stage Staggered Dip Ladder */}
            <div className="bg-bg-primary/80 border border-border rounded-xl p-4 md:p-5">
              <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
                <div>
                  <h3 className="text-xs font-bold text-txt-primary uppercase tracking-wider">
                    3-Stage Staggered Dip Accumulation Ladder (30% / 40% / 30%)
                  </h3>
                  <p className="text-[11px] text-txt-muted">
                    Gradual entry execution protects against volatile fake-outs and averages your cost basis.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-bg-hover text-txt-muted border border-border">
                  Systematic Accumulation
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {strategy.staggered_ladder.map((step) => {
                  const isTriggered = step.status === "TRIGGERED";
                  return (
                    <div
                      key={step.tranche}
                      className={`p-3.5 rounded-lg border ${
                        isTriggered
                          ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
                          : "bg-bg-card border-border text-txt-secondary"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-txt-primary">Stage {step.tranche} Allocation</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isTriggered ? "bg-emerald-500/20 text-emerald-300" : "bg-bg-hover text-txt-dim"
                          }`}
                        >
                          {step.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-txt-muted font-medium">{step.pct}% Tranche:</span>
                        <span className="text-base font-extrabold font-mono text-txt-primary">₹{fmt(step.price)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Technical Confluence & Dalal Street Veteran Take */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Technical Indicator Stats */}
              <div className="lg:col-span-1 bg-bg-primary/80 border border-border rounded-xl p-4">
                <h4 className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-3">Technical Confluence</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-1.5 bg-bg-card rounded border border-border/50">
                    <span className="text-txt-muted">RSI (14-Day):</span>
                    <strong className="text-txt-primary font-mono">{strategy.technicals.rsi}</strong>
                  </div>
                  <div className="flex justify-between p-1.5 bg-bg-card rounded border border-border/50">
                    <span className="text-txt-muted">50 EMA:</span>
                    <strong className="text-txt-primary font-mono">₹{fmt(strategy.technicals.ema50)}</strong>
                  </div>
                  <div className="flex justify-between p-1.5 bg-bg-card rounded border border-border/50">
                    <span className="text-txt-muted">200 EMA (Trend Filter):</span>
                    <strong className="text-txt-primary font-mono">₹{fmt(strategy.technicals.ema200)}</strong>
                  </div>
                  <div className="flex justify-between p-1.5 bg-bg-card rounded border border-border/50">
                    <span className="text-txt-muted">52-Week Peak Drawdown:</span>
                    <strong className="text-txt-primary font-mono">{strategy.technicals.drawdown_from_52w_high}%</strong>
                  </div>
                  <div className="flex justify-between p-1.5 bg-bg-card rounded border border-border/50">
                    <span className="text-txt-muted">Volume vs 20D Avg:</span>
                    <strong className="text-txt-primary font-mono">{strategy.technicals.volume_ratio}x</strong>
                  </div>
                </div>
              </div>

              {/* Dalal Street Veteran Commentary */}
              <div className="lg:col-span-2 bg-gradient-to-br from-bg-primary via-bg-card to-amber-950/20 border border-amber-500/30 rounded-xl p-4 md:p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-amber-400">
                    <span>🏛</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Pragmatic Dalal Street Veteran Take
                    </h4>
                  </div>
                  <p className="text-xs text-txt-secondary leading-relaxed font-sans">
                    {strategy.veteran_commentary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-txt-dim">
                  <span>Objective quantitative discipline &middot; Zero emotional bias</span>
                  <Link href={`/market`} className="text-accent-light hover:underline">
                    View Live Candle Chart &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
