import os
import re
from datetime import UTC, datetime
from decimal import Decimal

import httpx

from .base import MarketDataProvider, ProviderQuote


class GoogleFinanceProvider(MarketDataProvider):
    """Scrapes Google Finance for Indian stock prices as a fallback."""

    async def quote(self, symbol: str) -> ProviderQuote | None:
        old_http = os.environ.pop("http_proxy", None)
        old_https = os.environ.pop("https_proxy", None)
        try:
            clean = symbol.upper().replace(".NS", "").replace(".BO", "").replace(" ", "")

            for exchange in ["NSE", "BOM"]:
                price = await self._scrape(clean, exchange)
                if price:
                    return ProviderQuote(
                        symbol=symbol.upper(),
                        price=price,
                        as_of=datetime.now(UTC),
                        fetched_at=datetime.now(UTC),
                        source="google_finance",
                        data_kind="EOD",
                    )
            return None
        finally:
            if old_http:
                os.environ["http_proxy"] = old_http
            if old_https:
                os.environ["https_proxy"] = old_https

    async def _scrape(self, symbol: str, exchange: str) -> Decimal | None:
        url = f"https://www.google.com/finance/quote/{symbol}:{exchange}"
        try:
            async with httpx.AsyncClient(
                timeout=12,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            ) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    return None

                text = resp.text

                patterns = [
                    r'data-last-price="([0-9,.]+)"',
                    r'data-value="([0-9,.]+)"[^>]*data-source="price"',
                    r'class="YMlKec fxKbKc"[^>]*>[\s₹]*([0-9,]+\.?[0-9]*)',
                    r'class="YMlKec fxKbKc">\s*₹?\s*([0-9,]+\.[0-9]+)',
                    r'"price":\s*"?([0-9,.]+)"?',
                    r'₹\s*([0-9,]+\.[0-9]{1,2})\s*</div>',
                    r'>₹([0-9,]+\.[0-9]+)<',
                    r'data-currency-price="([0-9,.]+)"',
                ]

                for pattern in patterns:
                    match = re.search(pattern, text)
                    if match:
                        price_str = match.group(1).replace(",", "")
                        try:
                            price = float(price_str)
                            if price > 0:
                                return Decimal(str(round(price, 4)))
                        except ValueError:
                            continue
                return None
        except Exception:
            return None
