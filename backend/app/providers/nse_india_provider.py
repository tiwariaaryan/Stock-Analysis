import os
from datetime import UTC, datetime
from decimal import Decimal

import httpx

from .base import MarketDataProvider, ProviderQuote


class NseIndiaProvider(MarketDataProvider):
    """Fetches live prices directly from NSE India's API as a last-resort fallback."""

    async def quote(self, symbol: str) -> ProviderQuote | None:
        old_http = os.environ.pop("http_proxy", None)
        old_https = os.environ.pop("https_proxy", None)
        try:
            clean = symbol.upper().replace(".NS", "").replace(".BO", "").replace(" ", "")
            price = await self._fetch_nse(clean)
            if price:
                return ProviderQuote(
                    symbol=symbol.upper(),
                    price=price,
                    as_of=datetime.now(UTC),
                    fetched_at=datetime.now(UTC),
                    source="nse_india",
                    data_kind="EOD",
                )
            return None
        finally:
            if old_http:
                os.environ["http_proxy"] = old_http
            if old_https:
                os.environ["https_proxy"] = old_https

    async def _fetch_nse(self, symbol: str) -> Decimal | None:
        try:
            async with httpx.AsyncClient(
                timeout=12,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "application/json, text/html",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            ) as client:
                # First hit the main page to get cookies
                await client.get("https://www.nseindia.com", headers={"Accept": "text/html"})

                # Then fetch the quote API
                resp = await client.get(
                    f"https://www.nseindia.com/api/quote-equity?symbol={symbol}",
                    headers={"Accept": "application/json"},
                )

                if resp.status_code != 200:
                    return None

                data = resp.json()
                price_info = data.get("priceInfo", {})
                price = price_info.get("lastPrice") or price_info.get("close")

                if price and price > 0:
                    return Decimal(str(round(price, 4)))
                return None
        except Exception:
            return None
