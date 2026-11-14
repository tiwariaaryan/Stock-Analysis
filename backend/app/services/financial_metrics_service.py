import math
from typing import Any


# ==========================================
# 1. Fundamental Deterministic Calculations
# ==========================================

def calculate_growth_rate(current: float | None, previous: float | None) -> float | None:
    """Calculate percentage growth rate between two periods."""
    if current is None or previous is None or previous == 0:
        return None
    return round(((current - previous) / abs(previous)) * 100, 2)


def calculate_cagr(start_val: float | None, end_val: float | None, years: float) -> float | None:
    """Calculate Compound Annual Growth Rate."""
    if start_val is None or end_val is None or start_val <= 0 or end_val <= 0 or years <= 0:
        return None
    try:
        return round(((end_val / start_val) ** (1.0 / years) - 1.0) * 100, 2)
    except Exception:
        return None


def calculate_operating_margin(operating_income: float | None, revenue: float | None) -> float | None:
    """Operating Profit Margin (OPM %)."""
    if operating_income is None or revenue is None or revenue <= 0:
        return None
    return round((operating_income / revenue) * 100, 2)


def calculate_net_margin(net_income: float | None, revenue: float | None) -> float | None:
    """Net Profit Margin (NPM %)."""
    if net_income is None or revenue is None or revenue <= 0:
        return None
    return round((net_income / revenue) * 100, 2)


def calculate_roe(net_income: float | None, shareholders_equity: float | None) -> float | None:
    """Return on Equity (ROE %)."""
    if net_income is None or shareholders_equity is None or shareholders_equity <= 0:
        return None
    return round((net_income / shareholders_equity) * 100, 2)


def calculate_roce(ebit: float | None, capital_employed: float | None) -> float | None:
    """Return on Capital Employed (ROCE %).
    Capital Employed = Total Assets - Current Liabilities.
    """
    if ebit is None or capital_employed is None or capital_employed <= 0:
        return None
    return round((ebit / capital_employed) * 100, 2)


def calculate_debt_to_equity(total_debt: float | None, total_equity: float | None) -> float | None:
    """Debt to Equity Ratio (D/E)."""
    if total_debt is None or total_equity is None or total_equity <= 0:
        return None
    return round(total_debt / total_equity, 2)


def calculate_pe_ratio(price: float | None, eps: float | None) -> float | None:
    """Price to Earnings Ratio."""
    if price is None or eps is None or eps <= 0:
        return None
    return round(price / eps, 2)


def calculate_free_cash_flow(operating_cash_flow: float | None, capex: float | None) -> float | None:
    """Free Cash Flow (FCF) = Operating Cash Flow - Capex."""
    if operating_cash_flow is None:
        return None
    c = abs(capex) if capex is not None else 0.0
    return round(operating_cash_flow - c, 2)


# ==========================================
# 2. Technical Deterministic Calculations
# ==========================================

def calculate_ema(prices: list[float], period: int) -> list[float]:
    """Calculate Exponential Moving Average."""
    if len(prices) < period:
        return [prices[-1]] * len(prices) if prices else []
    multiplier = 2 / (period + 1)
    ema = [sum(prices[:period]) / period]
    for p in prices[period:]:
        ema.append((p - ema[-1]) * multiplier + ema[-1])
    pad = [ema[0]] * (len(prices) - len(ema))
    return pad + ema


def calculate_rsi(prices: list[float], period: int = 14) -> float:
    """Calculate 14-period Relative Strength Index."""
    if len(prices) < period + 1:
        return 50.0
    deltas = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
    gains = [max(d, 0.0) for d in deltas]
    losses = [abs(min(d, 0.0)) for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 2)


def calculate_macd(prices: list[float]) -> dict[str, Any]:
    """Calculate MACD (12, 26, 9)."""
    if len(prices) < 35:
        return {"macd": 0.0, "signal": 0.0, "hist": 0.0, "bullish_cross": False}
    ema12 = calculate_ema(prices, 12)
    ema26 = calculate_ema(prices, 26)
    macd_line = [e12 - e26 for e12, e26 in zip(ema12, ema26)]
    signal_line = calculate_ema(macd_line, 9)
    hist = macd_line[-1] - signal_line[-1]
    bullish_cross = macd_line[-1] > signal_line[-1] and macd_line[-2] <= signal_line[-2]
    return {
        "macd": round(macd_line[-1], 2),
        "signal": round(signal_line[-1], 2),
        "hist": round(hist, 2),
        "bullish_cross": bullish_cross,
    }


def calculate_volume_trend(volumes: list[int], window: int = 20) -> float:
    """Ratio of latest volume to rolling 20-day average volume."""
    if not volumes:
        return 1.0
    clean_vols = [v for v in volumes[-window:] if v > 0]
    if not clean_vols:
        return 1.0
    avg_vol = sum(clean_vols) / len(clean_vols)
    curr_vol = volumes[-1]
    return round(curr_vol / avg_vol, 2) if avg_vol > 0 else 1.0


def calculate_period_return(prices: list[float], days: int = 252) -> float:
    """Calculate percentage return over a trading window (e.g. 1 year ~ 252 sessions)."""
    if len(prices) < 2:
        return 0.0
    start_idx = max(0, len(prices) - days)
    start_price = prices[start_idx]
    curr_price = prices[-1]
    if start_price <= 0:
        return 0.0
    return round(((curr_price - start_price) / start_price) * 100, 2)


# ==========================================
# 3. Risk & Quantitative Statistics
# ==========================================

def calculate_daily_returns(prices: list[float]) -> list[float]:
    """Calculate daily simple percentage returns."""
    if len(prices) < 2:
        return []
    return [(prices[i] - prices[i - 1]) / prices[i - 1] for i in range(1, len(prices)) if prices[i - 1] > 0]


def calculate_annualized_volatility(daily_returns: list[float]) -> float:
    """Historical annualized volatility (Standard Deviation * sqrt(252))."""
    if len(daily_returns) < 10:
        return 22.0  # standard market default
    mean_ret = sum(daily_returns) / len(daily_returns)
    variance = sum((r - mean_ret) ** 2 for r in daily_returns) / (len(daily_returns) - 1)
    daily_std = math.sqrt(variance)
    annualized = daily_std * math.sqrt(252) * 100
    return round(annualized, 2)


def calculate_beta(stock_prices: list[float], index_prices: list[float]) -> float:
    """Calculate Beta relative to benchmark index (e.g. Nifty 50).
    Beta = Cov(R_s, R_m) / Var(R_m).
    """
    s_ret = calculate_daily_returns(stock_prices)
    m_ret = calculate_daily_returns(index_prices)
    n = min(len(s_ret), len(m_ret))
    if n < 30:
        return 1.0

    s_ret = s_ret[-n:]
    m_ret = m_ret[-n:]

    mean_s = sum(s_ret) / n
    mean_m = sum(m_ret) / n

    covariance = sum((s_ret[i] - mean_s) * (m_ret[i] - mean_m) for i in range(n)) / (n - 1)
    variance_m = sum((m_ret[i] - mean_m) ** 2 for i in range(n)) / (n - 1)

    if variance_m == 0:
        return 1.0
    beta = covariance / variance_m
    return round(beta, 2)


def calculate_max_drawdown(prices: list[float]) -> float:
    """Calculate maximum peak-to-trough drawdown percentage."""
    if len(prices) < 2:
        return 0.0
    max_dd = 0.0
    running_max = prices[0]
    for p in prices:
        if p > running_max:
            running_max = p
        if running_max > 0:
            dd = ((p - running_max) / running_max) * 100
            if dd < max_dd:
                max_dd = dd
    return round(max_dd, 2)


def calculate_sharpe_ratio(annual_return_pct: float, annual_volatility_pct: float, risk_free_rate_pct: float = 6.8) -> float:
    """Sharpe Ratio = (Annual Return - Risk Free Rate) / Annual Volatility.
    Uses Indian 10-year G-Sec benchmark (~6.8%).
    """
    if annual_volatility_pct <= 0:
        return 0.0
    excess_return = annual_return_pct - risk_free_rate_pct
    return round(excess_return / annual_volatility_pct, 2)
