import asyncio
import json
import os
import re
from datetime import UTC, datetime
from decimal import Decimal

from .base import MarketDataProvider, ProviderQuote


class GeminiSearchProvider(MarketDataProvider):
    """Last-resort fallback: uses Gemini to find stock prices via web search."""

    async def quote(self, symbol: str) -> ProviderQuote | None:
        price = await self._search_price(symbol)
        if price:
            return ProviderQuote(
                symbol=symbol.upper(),
                price=price,
                as_of=datetime.now(UTC),
                fetched_at=datetime.now(UTC),
                source="gemini_search",
                data_kind="EOD",
            )
        return None

    async def _search_price(self, symbol: str) -> Decimal | None:
        from ..config import get_settings
        settings = get_settings()
        key = settings.gemini_api_key1 or settings.gemini_api_key
        model = settings.gemini_model or "gemini-3.5-flash"
        if not key:
            return None

        saved_proxy = {}
        for k in list(os.environ):
            if "proxy" in k.lower():
                saved_proxy[k] = os.environ.pop(k)

        try:
            from google import genai

            client = genai.Client(api_key=key)
            clean = symbol.upper().replace(".NS", "").replace(".BO", "").replace(" ", "")

            prompt = (
                f"What is the current NSE stock price of {clean} (Indian stock market) as of today? "
                f"Reply with ONLY the number in rupees. Example: 297.50"
            )

            try:
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model=model,
                        contents=prompt,
                        config={"tools": [{"google_search": {}}]},
                    ),
                    timeout=15,
                )
            except Exception:
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model=model,
                        contents=prompt,
                    ),
                    timeout=12,
                )

            text = (response.text or "").strip()
            numbers = re.findall(r'[\d,]+\.?\d*', text.replace(",", ""))
            for n in numbers:
                try:
                    price = float(n)
                    if 0.01 < price < 500000:
                        return Decimal(str(round(price, 4)))
                except ValueError:
                    continue
            return None
        except Exception:
            return None
        finally:
            os.environ.update(saved_proxy)


async def fetch_missing_prices_via_llm(symbols: list[str]) -> dict[str, float]:
    """Batch fetch prices for multiple missing stocks in one LLM call."""
    from ..config import get_settings
    settings = get_settings()
    key = settings.gemini_api_key1 or settings.gemini_api_key
    model = settings.gemini_model or "gemini-3.5-flash"
    if not key or not symbols:
        return {}

    saved_proxy = {}
    for k in list(os.environ):
        if "proxy" in k.lower():
            saved_proxy[k] = os.environ.pop(k)

    try:
        from google import genai

        client = genai.Client(api_key=key)
        symbols_list = ", ".join(s.replace(" ", "") for s in symbols)

        prompt = (
            f"Search the internet and tell me the current stock prices on NSE India for: {symbols_list}\n\n"
            f"Return ONLY a JSON object with symbol as key and price in INR as value.\n"
            f'Example format: {{"TATAMOTORS": 297.50, "TATAPOWER": 348.00}}\n'
            f"Return only the JSON, nothing else."
        )

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    client.models.generate_content,
                    model=model,
                    contents=prompt,
                    config={"tools": [{"google_search": {}}]},
                ),
                timeout=20,
            )
        except Exception:
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    client.models.generate_content,
                    model=model,
                    contents=prompt,
                ),
                timeout=15,
            )

        text = (response.text or "").strip()
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

        try:
            data = json.loads(text)
            result = {}
            for sym, price in data.items():
                if isinstance(price, (int, float)) and 0.01 < price < 500000:
                    result[sym.upper().replace(" ", "")] = float(price)
            return result
        except json.JSONDecodeError:
            pairs = re.findall(r'"?([A-Z]+)"?\s*:\s*([0-9,.]+)', text)
            return {sym.upper(): float(p.replace(",", "")) for sym, p in pairs if 0.01 < float(p.replace(",", "")) < 500000}
    except Exception:
        return {}
    finally:
        os.environ.update(saved_proxy)
