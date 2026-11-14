from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

@dataclass(frozen=True)
class ProviderQuote:
    symbol: str
    price: Decimal
    as_of: datetime
    fetched_at: datetime
    source: str
    data_kind: str

class MarketDataProvider(ABC):
    @abstractmethod
    async def quote(self, symbol: str) -> ProviderQuote | None: ...
