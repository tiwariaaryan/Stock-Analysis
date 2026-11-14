from .base import MarketDataProvider, ProviderQuote

class AmfiNavProvider(MarketDataProvider):
    """Reserved official AMFI NAV adapter. Mutual-fund NAV only, never intraday price."""
    async def quote(self, symbol: str) -> ProviderQuote | None:
        # Integrate official AMFI NAV feed by scheme code in a background ingestion job.
        return None
