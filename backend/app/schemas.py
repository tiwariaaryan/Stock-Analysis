from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class Health(BaseModel):
    status: str
    service: str


class Quote(BaseModel):
    symbol: str
    price: Decimal | None = None
    currency: str = "INR"
    as_of: datetime | None = None
    fetched_at: datetime
    source: str
    freshness: str = Field(description="LIVE, EOD, NAV, STALE, or UNAVAILABLE")
    disclaimer: str


class StockDetail(BaseModel):
    symbol: str
    name: str | None = None
    price: Decimal | None = None
    change: float | None = None
    change_pct: float | None = None
    open: Decimal | None = None
    high: Decimal | None = None
    low: Decimal | None = None
    close: Decimal | None = None
    volume: int | None = None
    prev_close: Decimal | None = None
    week_52_high: Decimal | None = None
    week_52_low: Decimal | None = None
    market_cap: float | None = None
    pe_ratio: float | None = None
    sector: str | None = None
    industry: str | None = None
    currency: str = "INR"
    history: list[dict] = []


class MarketStock(BaseModel):
    symbol: str
    name: str
    price: Decimal | None = None
    change_pct: float | None = None
    sector: str | None = None


class MarketIndexOut(BaseModel):
    id: int
    symbol: str
    name: str
    value: Decimal
    change: Decimal | None = None
    change_pct: float | None = None
    updated_at: datetime


class UserOut(BaseModel):
    id: int
    username: str
    email: str | None = None
    display_name: str | None = None
    created_at: datetime


class ProfileCreate(BaseModel):
    username: str
    display_name: str
    pin: str


class PinVerify(BaseModel):
    pin: str


class PortfolioCreate(BaseModel):
    name: str
    description: str | None = None
    currency: str = "INR"


class PortfolioOut(BaseModel):
    id: int
    name: str
    description: str | None
    currency: str = "INR"
    created_at: datetime
    holdings_count: int = 0
    total_invested: Decimal = Decimal("0")


class HoldingCreate(BaseModel):
    symbol: str
    quantity: Decimal
    buy_price: Decimal
    buy_date: datetime | None = None
    asset_type: str = "EQUITY"


class HoldingOut(BaseModel):
    id: int
    symbol: str
    quantity: Decimal
    buy_price: Decimal
    buy_date: datetime | None
    asset_type: str
    current_price: Decimal | None = None
    current_value: Decimal | None = None
    invested_value: Decimal
    pnl: Decimal | None = None
    pnl_pct: float | None = None


class PortfolioDetail(BaseModel):
    id: int
    name: str
    description: str | None
    currency: str = "INR"
    created_at: datetime
    holdings: list[HoldingOut]
    total_invested: Decimal
    total_current: Decimal | None
    total_pnl: Decimal | None
    total_pnl_pct: float | None


class TransactionCreate(BaseModel):
    symbol: str
    transaction_type: str = "BUY"  # BUY, SELL, DIVIDEND, SPLIT
    quantity: Decimal
    price: Decimal
    fees: Decimal = Decimal("0")
    trade_date: datetime | None = None
    notes: str | None = None


class TransactionOut(BaseModel):
    id: int
    portfolio_id: int
    symbol: str
    transaction_type: str
    quantity: Decimal
    price: Decimal
    fees: Decimal
    total_amount: Decimal
    trade_date: datetime
    notes: str | None = None
    created_at: datetime


class WatchlistCreate(BaseModel):
    name: str
    description: str | None = None


class WatchlistOut(BaseModel):
    id: int
    user_id: int | None = None
    name: str
    description: str | None = None
    is_default: bool = False
    items_count: int = 0
    created_at: datetime


class WatchlistItemCreate(BaseModel):
    symbol: str
    target_buy_price: Decimal | None = None
    target_sell_price: Decimal | None = None
    notes: str | None = None
    tags: str | None = None


class WatchlistItemOut(BaseModel):
    id: int
    watchlist_id: int
    symbol: str
    name: str | None = None
    current_price: Decimal | None = None
    target_buy_price: Decimal | None = None
    target_sell_price: Decimal | None = None
    notes: str | None = None
    tags: str | None = None
    alert_active: bool = True
    created_at: datetime


class WatchlistDetail(BaseModel):
    id: int
    name: str
    description: str | None = None
    is_default: bool = False
    created_at: datetime
    items: list[WatchlistItemOut] = []


class ChatRequest(BaseModel):
    message: str
    session_id: int | None = None
    portfolio_id: int | None = None
    history: list[dict] = []


class ChatResponse(BaseModel):
    reply: str
    session_id: int | None = None
    referenced_symbols: list[str] = []
