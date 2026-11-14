from datetime import datetime
from decimal import Decimal


def holding_market_value(quantity: Decimal, price: Decimal) -> Decimal:
    """Deterministic calculation; do not delegate financial arithmetic to an LLM."""
    return quantity * price


def compute_xirr(cash_flows: list[tuple[datetime, float]], guess: float = 0.1) -> float | None:
    """Newton-Raphson XIRR solver.
    cash_flows: list of (date, amount) where negative = outflow (buy), positive = inflow (current value).
    Returns annualized rate or None if cannot converge."""
    if not cash_flows or len(cash_flows) < 2:
        return None

    d0 = min(cf[0] for cf in cash_flows)

    def npv(rate: float) -> float:
        return sum(
            amount / ((1 + rate) ** ((dt - d0).days / 365.0))
            for dt, amount in cash_flows
        )

    def dnpv(rate: float) -> float:
        return sum(
            -amount * ((dt - d0).days / 365.0) / ((1 + rate) ** ((dt - d0).days / 365.0 + 1))
            for dt, amount in cash_flows
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
