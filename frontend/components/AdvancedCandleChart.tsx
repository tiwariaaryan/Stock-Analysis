"use client";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Candle = {
  date: string; open: number; high: number; low: number; close: number;
  volume: number; running_peak: number; drawdown_pct: number;
};

const PERIODS = ["1mo", "3mo", "6mo", "1y", "5y"] as const;
const PERIOD_LABELS: Record<string, string> = { "1mo": "1M", "3mo": "3M", "6mo": "6M", "1y": "1Y", "5y": "5Y" };

export default function AdvancedCandleChart({ symbol }: { symbol: string }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [maxDD, setMaxDD] = useState(0);
  const [period, setPeriod] = useState("6mo");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/v1/market/stocks/${encodeURIComponent(symbol)}/history?period=${period}`)
      .then(r => r.json())
      .then(d => { setCandles(d.candles || []); setMaxDD(d.max_drawdown || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol, period]);

  if (loading) return <div className="h-[350px] bg-bg-primary rounded-lg animate-pulse" />;
  if (!candles.length) return <p className="text-xs text-txt-muted py-4 text-center">No chart data available</p>;

  const priceMin = Math.min(...candles.map(c => c.low));
  const priceMax = Math.max(...candles.map(c => c.high));
  const priceRange = priceMax - priceMin || 1;
  const ddMin = Math.min(...candles.map(c => c.drawdown_pct), 0);
  const ddRange = Math.abs(ddMin) || 1;

  const W = 800;
  const mainH = 240;
  const subH = 80;
  const pad = { l: 60, r: 10, t: 10, b: 5 };
  const chartW = W - pad.l - pad.r;
  const barW = Math.max(chartW / candles.length * 0.6, 1);

  function priceY(p: number) { return pad.t + mainH - ((p - priceMin) / priceRange) * mainH; }
  function ddY(dd: number) { return (Math.abs(dd) / ddRange) * subH; }

  const retracement = [10, 20, 30, 50];
  const lastPeak = candles[candles.length - 1]?.running_peak || priceMax;

  return (
    <div>
      <div className="flex gap-1 mb-2">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${period === p ? "bg-accent text-white" : "text-txt-muted bg-bg-primary hover:text-txt-secondary"}`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="bg-bg-primary rounded-lg p-2 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${mainH + subH + pad.t + pad.b + 30}`} className="w-full" style={{ minWidth: "500px" }}>
          {/* Price grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const price = priceMin + frac * priceRange;
            const y = priceY(price);
            return (
              <g key={frac}>
                <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#1f1f32" strokeWidth="0.5" />
                <text x={pad.l - 4} y={y + 3} textAnchor="end" fill="#4a5568" fontSize="8" fontFamily="monospace">
                  ₹{price.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* ATH retracement step lines */}
          {retracement.map(pct => {
            const level = lastPeak * (1 - pct / 100);
            if (level < priceMin || level > priceMax) return null;
            const y = priceY(level);
            return (
              <g key={pct}>
                <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#7c3aed" strokeWidth="0.4" strokeDasharray="4 3" opacity="0.5" />
                <text x={W - pad.r + 2} y={y + 3} fill="#a78bfa" fontSize="7" fontFamily="monospace">-{pct}%</text>
              </g>
            );
          })}

          {/* Candlesticks */}
          {candles.map((c, i) => {
            const x = pad.l + (i / candles.length) * chartW + barW / 2;
            const green = c.close >= c.open;
            const color = green ? "#00c853" : "#ff5252";
            const bodyTop = priceY(Math.max(c.open, c.close));
            const bodyBot = priceY(Math.min(c.open, c.close));
            const bodyH = Math.max(bodyBot - bodyTop, 0.5);
            return (
              <g key={i}>
                <line x1={x} y1={priceY(c.high)} x2={x} y2={priceY(c.low)} stroke={color} strokeWidth="0.5" />
                <rect x={x - barW / 2} y={bodyTop} width={barW} height={bodyH} fill={color} rx="0.3" />
              </g>
            );
          })}

          {/* Separator line */}
          <line x1={pad.l} y1={mainH + pad.t + 12} x2={W - pad.r} y2={mainH + pad.t + 12} stroke="#1f1f32" strokeWidth="0.5" />
          <text x={pad.l} y={mainH + pad.t + 24} fill="#4a5568" fontSize="8">Drawdown %</text>

          {/* Drawdown sub-chart */}
          {candles.map((c, i) => {
            const x = pad.l + (i / candles.length) * chartW + barW / 2;
            const baseY = mainH + pad.t + 30;
            const h = ddY(c.drawdown_pct);
            return (
              <rect key={i} x={x - barW / 2} y={baseY} width={barW} height={h}
                fill={c.drawdown_pct < -20 ? "#ff5252" : c.drawdown_pct < -10 ? "#ff8a80" : "#66bb6a"} opacity="0.7" rx="0.2" />
            );
          })}

          {/* Max DD line */}
          {maxDD < 0 && (
            <g>
              <line x1={pad.l} y1={mainH + pad.t + 30 + ddY(maxDD)} x2={W - pad.r} y2={mainH + pad.t + 30 + ddY(maxDD)}
                stroke="#ff5252" strokeWidth="0.5" strokeDasharray="3 2" />
              <text x={W - pad.r + 2} y={mainH + pad.t + 33 + ddY(maxDD)} fill="#ff5252" fontSize="7" fontFamily="monospace">
                Max DD {maxDD.toFixed(1)}%
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
