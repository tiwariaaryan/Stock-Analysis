from datetime import UTC, datetime
from decimal import Decimal
from typing import Any


def holding_market_value(quantity: Decimal, price: Decimal) -> Decimal:
    """Deterministic calculation; do not delegate financial arithmetic to an LLM."""
    return quantity * price


def compute_xirr(cash_flows: list[tuple[datetime, float]], guess: float = 0.1) -> float | None:
    """Newton-Raphson XIRR solver.
    cash_flows: list of (date, amount) where negative = outflow (buy), positive = inflow (current value).
    Returns annualized rate or None if cannot converge."""
    if not cash_flows or len(cash_flows) < 2:
        return None

    # Defensive normalization: ensure all datetimes are timezone-aware UTC
    normalized_cfs: list[tuple[datetime, float]] = []
    for dt, amount in cash_flows:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        else:
            dt = dt.astimezone(UTC)
        normalized_cfs.append((dt, float(amount)))

    d0 = min(cf[0] for cf in normalized_cfs)

    def npv(rate: float) -> float:
        return sum(
            amount / ((1 + rate) ** ((dt - d0).days / 365.0))
            for dt, amount in normalized_cfs
        )

    def dnpv(rate: float) -> float:
        return sum(
            -amount * ((dt - d0).days / 365.0) / ((1 + rate) ** ((dt - d0).days / 365.0 + 1))
            for dt, amount in normalized_cfs
        )

    rate = guess
    for _ in range(100):
        nv = npv(rate)
        dnv = dnpv(rate)
        if abs(dnv) < 1e-12:
            break
        new_rate = rate - nv / dnv
        if abs(new_rate - rate) < 1e-7:
            return round(new_rate * 100, 2)
        rate = new_rate
        if rate < -0.99:
            rate = -0.99

    return round(rate * 100, 2) if abs(npv(rate)) < 1.0 else None


def compute_triple_engine_score(
    fundamentals: dict[str, Any],
    technicals: dict[str, Any],
    ai_insights: dict[str, Any] | None = None,
    derivatives: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    3-Pillar Institutional AI Scoring Architecture (100 Points):
    - Phase A: Quant Math (35 pts) - Hard balance sheet, ROCE, FCF, Solvency, Piotroski
    - Phase B: Market Microstructure (35 pts) - FII/DII shift, Delivery RVOL, F&O flow, Alpha vs Nifty
    - Phase C: AI Cognitive Intelligence (30 pts) - Earnings call tone, Future catalysts, Forensic audit
    - Hard Veto Gates: High pledge (>25%) or solvency disaster immediately caps total at <40.
    """
    ai_insights = ai_insights or {}
    derivatives = derivatives or {}

    # ─────────────────────────────────────────────────────────
    # HARD VETO GATES (Safety Circuit-Breaker)
    # ─────────────────────────────────────────────────────────
    pledged_pct = float(fundamentals.get("pledged_pct", 0.0))
    de_raw = float(fundamentals.get("debt_to_equity", 0.0))
    # Normalize: Financial APIs like Yahoo Finance return debtToEquity as a percentage (e.g. 45.2% or 39.8%). Convert to ratio format (0.45x).
    de_ratio = de_raw / 100.0 if de_raw > 10.0 else de_raw
    int_cov = float(fundamentals.get("interest_coverage", 8.0))
    forensic_flag = ai_insights.get("forensic_risk", "CLEAN")

    veto_triggered = False
    veto_reason = None

    if pledged_pct > 25.0:
        veto_triggered = True
        veto_reason = f"Promoter pledged shares ({pledged_pct}%) exceed safety threshold (25%)."
    elif de_ratio > 3.0 and not fundamentals.get("is_bank", False):
        veto_triggered = True
        veto_reason = f"Extreme leverage: Debt-to-Equity ({de_ratio}x) exceeds safe limits."
    elif int_cov < 1.2 and not fundamentals.get("is_bank", False):
        veto_triggered = True
        veto_reason = f"Severe interest burden: Interest coverage ({int_cov}x) below solvency threshold."
    elif forensic_flag == "GOVERNANCE_WARNING":
        veto_triggered = True
        veto_reason = ai_insights.get("forensic_notes", "Corporate governance red-flag detected.")

    # ─────────────────────────────────────────────────────────
    # PILLAR A: QUANTITATIVE MATH (35 Points Max)
    # ─────────────────────────────────────────────────────────
    score_a = 0.0

    # 1. Capital Efficiency (ROCE / ROE) - 10 pts
    roce = float(fundamentals.get("roce_pct", 18.0))
    if roce >= 25.0:
        score_a += 10.0
    elif roce >= 18.0:
        score_a += 8.0
    elif roce >= 12.0:
        score_a += 6.0
    else:
        score_a += 3.0

    # 2. Solvency & Balance Sheet Health (Debt/Equity & Interest Coverage) - 9 pts
    if fundamentals.get("is_bank", False):
        # For banks, check NPA and Capital Adequacy
        npa = float(fundamentals.get("net_npa_pct", 1.0))
        score_a += 9.0 if npa < 1.0 else (7.0 if npa < 2.0 else 4.0)
    else:
        if de_ratio <= 0.2:
            score_a += 9.0
        elif de_ratio <= 0.6:
            score_a += 7.5
        elif de_ratio <= 1.2:
            score_a += 5.0
        else:
            score_a += 2.0

    # 3. Cash Engine & Quality of Earnings (Piotroski / FCF yield) - 9 pts
    fcf_positive = fundamentals.get("fcf_positive", True)
    piotroski_f = int(fundamentals.get("piotroski_score", 7))
    if fcf_positive and piotroski_f >= 7:
        score_a += 9.0
    elif fcf_positive or piotroski_f >= 6:
        score_a += 7.0
    else:
        score_a += 4.0

    # 4. Valuation Realism (PEG & P/E discount) - 7 pts
    pe = float(fundamentals.get("pe_ratio", 25.0))
    sector_pe = float(fundamentals.get("sector_pe", 25.0))
    peg = float(fundamentals.get("peg_ratio", 1.0))
    if peg <= 1.0 or pe <= sector_pe * 0.85:
        score_a += 7.0
    elif peg <= 1.5 or pe <= sector_pe * 1.1:
        score_a += 5.5
    else:
        score_a += 3.5

    score_a = round(min(score_a, 35.0), 1)

    # ─────────────────────────────────────────────────────────
    # PILLAR B: MARKET MICROSTRUCTURE & SMART MONEY (35 Points Max)
    # ─────────────────────────────────────────────────────────
    score_b = 0.0

    # 1. Institutional Ownership Shift (FII & DII 3M/6M trend) - 10 pts
    inst_trend = technicals.get("institutional_flow", "ACCUMULATION")
    if inst_trend == "HEAVY_ACCUMULATION":
        score_b += 10.0
    elif inst_trend == "ACCUMULATION":
        score_b += 8.5
    elif inst_trend == "NEUTRAL":
        score_b += 6.0
    else:
        score_b += 2.0

    # 2. Relative Strength vs Nifty & 52W High Proximity - 10 pts
    outperforming_nifty = technicals.get("outperforming_nifty", True)
    pct_from_52w_high = float(technicals.get("pct_away_52w_high", 8.0))
    if outperforming_nifty and pct_from_52w_high <= 12.0:
        score_b += 10.0
    elif outperforming_nifty:
        score_b += 8.0
    elif pct_from_52w_high <= 15.0:
        score_b += 6.0
    else:
        score_b += 3.0

    # 3. Delivery Volume Spike & Trend Golden Structure (50 & 200 EMA) - 8 pts
    trend_type = technicals.get("trend", "UPTREND")
    rsi = float(technicals.get("rsi_14", 55.0))
    if "BULLISH" in trend_type or "UPTREND" in trend_type:
        if 48.0 <= rsi <= 68.0:
            score_b += 8.0
        else:
            score_b += 6.5
    else:
        score_b += 4.0

    # 4. Derivatives / Delivery Confirmation (Adaptive for F&O vs Cash) - 7 pts
    is_fno = derivatives.get("is_fno", False)
    if is_fno:
        pcr = float(derivatives.get("pcr", 1.1))
        oi_buildup = derivatives.get("oi_buildup", "LONG_BUILDUP")
        if oi_buildup == "LONG_BUILDUP" and pcr >= 1.0:
            score_b += 7.0
        elif oi_buildup == "LONG_BUILDUP" or pcr >= 0.9:
            score_b += 5.5
        else:
            score_b += 3.0
    else:
        # Non-F&O Adaptive weight: Reallocated to cash delivery ratio
        deliv_pct = float(technicals.get("delivery_pct", 52.0))
        if deliv_pct >= 55.0:
            score_b += 7.0
        elif deliv_pct >= 40.0:
            score_b += 5.5
        else:
            score_b += 3.5

    score_b = round(min(score_b, 35.0), 1)

    # ─────────────────────────────────────────────────────────
    # PILLAR C: AI COGNITIVE INTELLIGENCE (30 Points Max)
    # ─────────────────────────────────────────────────────────
    score_c = 0.0

    # 1. Earnings Call Sentiment & Management Guidance Tone - 10 pts
    call_tone = ai_insights.get("management_tone", "CONFIDENT")
    if call_tone in ("VERY_BULLISH", "AGGRESSIVE_EXPANSION"):
        score_c += 10.0
    elif call_tone in ("CONFIDENT", "STABLE_GROWTH"):
        score_c += 8.5
    elif call_tone == "NEUTRAL":
        score_c += 6.0
    else:
        score_c += 2.0

    # 2. Forward Catalyst Impact & Probability - 10 pts
    catalyst_prob = float(ai_insights.get("catalyst_probability_pct", 85.0))
    if catalyst_prob >= 85.0:
        score_c += 10.0
    elif catalyst_prob >= 75.0:
        score_c += 8.0
    elif catalyst_prob >= 60.0:
        score_c += 6.0
    else:
        score_c += 3.0

    # 3. Macro Regime Alignment & Forensic Cleanliness - 10 pts
    moat_score = ai_insights.get("economic_moat", "WIDE")
    if moat_score in ("WIDE", "MONOPOLY") and forensic_flag == "CLEAN":
        score_c += 10.0
    elif forensic_flag == "CLEAN":
        score_c += 8.0
    else:
        score_c += 3.0

    score_c = round(min(score_c, 30.0), 1)

    # ─────────────────────────────────────────────────────────
    # COMPOSITE SCORE CALCULATION
    # ─────────────────────────────────────────────────────────
    if veto_triggered:
        # Scale down pillars proportionately so Phase A + Phase B + Phase C == total_score (capped at 38)
        raw_sum = score_a + score_b + score_c
        if raw_sum > 38.0:
            scale = 38.0 / raw_sum
            score_a = round(score_a * scale, 1)
            score_b = round(score_b * scale, 1)
            score_c = round(38.0 - score_a - score_b, 1)
        total_score = round(score_a + score_b + score_c, 1)
        verdict = "TRIM / HIGH RISK"
        verdict_color = "#ef4444"
    else:
        total_score = round(score_a + score_b + score_c, 1)
        if total_score >= 90.0:
            verdict = "STRONG BUY"
            verdict_color = "#10b981"
        elif total_score >= 82.0:
            verdict = "BUY"
            verdict_color = "#34d399"
        elif total_score >= 72.0:
            verdict = "ACCUMULATE"
            verdict_color = "#38bdf8"
        elif total_score >= 58.0:
            verdict = "HOLD"
            verdict_color = "#f59e0b"
        else:
            verdict = "TRIM"
            verdict_color = "#f87171"

    return {
        "total_score": total_score,
        "verdict": verdict,
        "verdict_color": verdict_color,
        "phase_a_score": score_a,
        "phase_a_max": 35.0,
        "phase_b_score": score_b,
        "phase_b_max": 35.0,
        "phase_c_score": score_c,
        "phase_c_max": 30.0,
        "veto_triggered": veto_triggered,
        "veto_reason": veto_reason,
        "forensic_status": forensic_flag,
        "management_tone": call_tone,
        "catalyst_probability_pct": catalyst_prob,
    }
