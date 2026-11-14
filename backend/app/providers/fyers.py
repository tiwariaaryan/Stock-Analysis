from .base import MarketDataProvider, ProviderQuote

class FyersProvider(MarketDataProvider):
    """Credential-free OAuth/streaming scaffold; inactive until user connects FYERS."""
    async def authorization_url(self) -> str | None:
        return None
    async def quote(self, symbol: str) -> ProviderQuote | None:
        return None
