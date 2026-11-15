from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from .base import MarketDataProvider, ProviderQuote
from .google_finance_provider import GoogleFinanceProvider
from .yfinance_provider import YFinanceEodProvider


class GeminiSearchProvider(MarketDataProvider):
    """Zero-LLM Fast Price Fallback: routes to free Google Finance & yfinance providers."""

    async def quote(self, symbol: str) -> ProviderQuote | None:
        clean = symbol.upper().replace(".NS", "").replace(".BO", "").replace(" ", "")

        # 1. Try Google Finance Public (Free & fast)
        try:
            gf = GoogleFinanceProvider()
            q = await gf.quote(clean)
            if q and q.price:
                return q
        except Exception:
            pass

        # 2. Fallback to Yahoo Finance (Free)
        try:
            yf = YFinanceEodProvider()
            q = await yf.quote(clean)
            if q and q.price:
                return q
        except Exception:
            pass

        return None


async def fetch_missing_prices_via_llm(symbols: list[str]) -> dict[str, float]:
    """Zero-LLM Batch fetch: uses Google Finance and yfinance instead of burning LLM tokens."""
    if not symbols:
        return {}

    gf = GoogleFinanceProvider()
    yf = YFinanceEodProvider()
    results = {}

    for sym in symbols:
        clean = sym.upper().replace(".NS", "").replace(".BO", "").replace(" ", "")
        try:
            q = await gf.quote(clean)
            if q and q.price:
                results[clean] = float(q.price)
                continue
        except Exception:
            pass

        try:
            q = await yf.quote(clean)
            if q and q.price:
                results[clean] = float(q.price)
        except Exception:
            pass

    return results
