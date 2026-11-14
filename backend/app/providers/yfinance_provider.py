from datetime import UTC, datetime
from decimal import Decimal
import os
import yfinance as yf
from .base import MarketDataProvider, ProviderQuote


class YFinanceEodProvider(MarketDataProvider):
    """Best-effort EOD provider. Tries NSE first, falls back to BSE."""

    async def quote(self, symbol: str) -> ProviderQuote | None:
        old_http = os.environ.pop("http_proxy", None)
        old_https = os.environ.pop("https_proxy", None)
        try:
            clean = symbol.upper().replace(".NS", "").replace(".BO", "")

            result = self._fetch_ticker(f"{clean}.NS", symbol)
            if result:
                return result

            result = self._fetch_ticker(f"{clean}.BO", symbol)
            if result:
                return result

            return None
        finally:
            if old_http:
                os.environ["http_proxy"] = old_http
            if old_https:
                os.environ["https_proxy"] = old_https

    def _fetch_ticker(self, ticker_symbol: str, original_symbol: str) -> ProviderQuote | None:
        try:
            ticker = yf.Ticker(ticker_symbol)
            try:
                fi = ticker.fast_info
                price = fi.last_price
                if price and price > 0:
                    return ProviderQuote(
                        symbol=original_symbol.upper(),
                        price=Decimal(str(round(price, 4))),
                        as_of=datetime.now(UTC),
                        fetched_at=datetime.now(UTC),
                        source="yfinance",
                        data_kind="EOD",
                    )
            except Exception:
                pass

            history = ticker.history(period="5d", interval="1d", auto_adjust=False)
            if history.empty:
                return None
            last = history.iloc[-1]
            as_of = history.index[-1].to_pydatetime()
            if as_of.tzinfo is None:
                as_of = as_of.replace(tzinfo=UTC)
            return ProviderQuote(
                symbol=original_symbol.upper(),
                price=Decimal(str(round(float(last["Close"]), 4))),
                as_of=as_of,
                fetched_at=datetime.now(UTC),
                source="yfinance",
                data_kind="EOD",
            )
        except Exception:
            return None
