from datetime import UTC, datetime
from ..providers.base import MarketDataProvider
from ..schemas import Quote

class MarketDataService:
    def __init__(self, providers: list[MarketDataProvider]): self.providers = providers
    async def quote(self, symbol: str) -> Quote:
        for provider in self.providers:
            result = await provider.quote(symbol)
            if result:
                return Quote(symbol=result.symbol, price=result.price, as_of=result.as_of,
                    fetched_at=result.fetched_at, source=result.source, freshness=result.data_kind,
                    disclaimer="Research data only. yfinance is a best-effort EOD fallback, not live market data.")
        return Quote(symbol=symbol.upper(), fetched_at=datetime.now(UTC), source="none", freshness="UNAVAILABLE",
          disclaimer="No current quote is available. This platform does not infer live prices.")
