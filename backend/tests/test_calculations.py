from decimal import Decimal
from app.services.calculations import compute_triple_engine_score, holding_market_value

def test_holding_market_value_is_deterministic():
    assert holding_market_value(Decimal("12.5"), Decimal("123.45")) == Decimal("1543.125")

def test_compute_triple_engine_score_high_quality():
    res = compute_triple_engine_score(
        fundamentals={
            "roce_pct": 28.0,
            "debt_to_equity": 0.1,
            "is_bank": False,
            "fcf_positive": True,
            "piotroski_score": 8,
            "pe_ratio": 24.0,
            "sector_pe": 28.0,
            "peg_ratio": 0.9,
            "pledged_pct": 0.0,
        },
        technicals={
            "trend": "UPTREND",
            "rsi_14": 56.0,
            "institutional_flow": "HEAVY_ACCUMULATION",
            "outperforming_nifty": True,
            "pct_away_52w_high": 4.0,
            "delivery_pct": 62.0,
        },
        ai_insights={
            "management_tone": "VERY_BULLISH",
            "catalyst_probability_pct": 90.0,
            "economic_moat": "WIDE",
            "forensic_risk": "CLEAN",
        },
        derivatives={
            "is_fno": True,
            "oi_buildup": "LONG_BUILDUP",
            "pcr": 1.3,
        }
    )
    assert res["total_score"] >= 85.0
    assert res["phase_a_score"] > 25.0
    assert res["phase_b_score"] > 25.0
    assert res["phase_c_score"] > 20.0
    assert not res["veto_triggered"]
    assert res["verdict"] in ("STRONG BUY", "BUY")

def test_compute_triple_engine_score_hard_veto():
    res = compute_triple_engine_score(
        fundamentals={
            "roce_pct": 12.0,
            "debt_to_equity": 4.5,  # High D/E non-bank veto
            "is_bank": False,
            "fcf_positive": False,
            "piotroski_score": 3,
            "pledged_pct": 35.0,  # High pledge veto
        },
        technicals={"trend": "DOWNTREND", "rsi_14": 30.0},
        ai_insights={"management_tone": "DEFENSIVE", "forensic_risk": "RED_FLAG"},
    )
    assert res["veto_triggered"] is True
    assert res["total_score"] <= 38.0
    assert "TRIM" in res["verdict"] or "AVOID" in res["verdict"]

def test_compute_triple_engine_score_de_ratio_normalization():
    # Yahoo Finance provides D/E as 45.2% (i.e. 0.45x). It should normalize and NOT trigger the >3.0x veto.
    res = compute_triple_engine_score(
        fundamentals={
            "roce_pct": 16.0,
            "debt_to_equity": 45.2,  # 45.2% should normalize to 0.45x
            "is_bank": False,
            "fcf_positive": True,
            "piotroski_score": 7,
            "pe_ratio": 24.0,
            "sector_pe": 26.0,
            "peg_ratio": 1.1,
            "pledged_pct": 0.0,
        },
        technicals={
            "trend": "UPTREND",
            "rsi_14": 52.0,
            "institutional_flow": "ACCUMULATION",
            "outperforming_nifty": True,
            "pct_away_52w_high": 7.0,
            "delivery_pct": 54.0,
        },
        ai_insights={
            "management_tone": "CONFIDENT",
            "catalyst_probability_pct": 82.0,
            "economic_moat": "WIDE",
            "forensic_risk": "CLEAN",
        },
    )
    assert not res["veto_triggered"]
    assert res["total_score"] >= 75.0
    # Exact sum invariant
    assert round(res["phase_a_score"] + res["phase_b_score"] + res["phase_c_score"], 1) == res["total_score"]
