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
    symbols: list[str] = []
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


class ArenaSandboxCreate(BaseModel):
    name: str
    description: str | None = None
    category: str = "CUSTOM"  # USER_INTUITION, AI_INSTITUTIONAL, MARKET_TIPS, CUSTOM
    horizon: str = "1M"  # 1W, 1M, 3M, 6M, 1Y, FLEXIBLE
    initial_capital: float = 100000.0
    auto_execute: bool = True


class ArenaSandboxUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    auto_execute: bool | None = None
    horizon: str | None = None
    position_order: int | None = None


class ArenaPositionUpdate(BaseModel):
    quantity: float | None = None
    custom_target_price: float | None = None
    stop_loss_price: float | None = None


class ArenaReorderRequest(BaseModel):
    sandbox_ids: list[int]


class ArenaOrderCreate(BaseModel):
    symbol: str
    quantity: float
    target_sell_price: float | None = None
    stop_loss_price: float | None = None
    horizon: str = "1M"
    rationale: str | None = None
    custom_buy_price: float | None = None


class ArenaImportAIPicks(BaseModel):
    horizon: str = "1M"
    min_score: int = 65
    allocation_pct_per_stock: float = 20.0
    max_stocks: int = 5


class ArenaCapitalAdjust(BaseModel):
    amount: float


class ArenaPositionOut(BaseModel):
    id: int
    sandbox_id: int
    symbol: str
    name: str | None = None
    quantity: float
    avg_buy_price: float
    current_price: float | None = None
    invested_amount: float
    current_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    target_sell_price: float | None = None
    ai_target_price: float | None = None
    custom_target_price: float | None = None
    stop_loss_price: float | None = None
    distance_to_target_pct: float | None = None
    distance_to_stop_pct: float | None = None
    horizon: str
    rationale: str | None = None
    ai_score: int | None = None
    created_at: datetime


class ArenaTradeOut(BaseModel):
    id: int
    sandbox_id: int
    symbol: str
    trade_type: str
    quantity: float
    price: float
    total_amount: float
    realized_pnl: float
    realized_pnl_pct: float
    notes: str | None = None
    executed_at: datetime


class ArenaSandboxDetail(BaseModel):
    id: int
    user_id: int | None = None
    name: str
    description: str | None = None
    category: str
    horizon: str
    initial_capital: float
    current_cash: float
    invested_capital: float
    total_value: float
    total_pnl: float
    total_pnl_pct: float
    realized_pnl: float
    unrealized_pnl: float
    win_rate_pct: float
    trade_count: int
    auto_execute: bool
    position_order: int = 0
    is_active: bool
    created_at: datetime
    positions: list[ArenaPositionOut] = []
    trades: list[ArenaTradeOut] = []


class ArenaSandboxSummary(BaseModel):
    id: int
    name: str
    category: str
    horizon: str
    initial_capital: float
    current_cash: float
    invested_capital: float = 0.0
    total_value: float
    total_pnl: float
    total_pnl_pct: float
    win_rate_pct: float
    position_count: int
    trade_count: int
    auto_execute: bool
    position_order: int = 0
    created_at: datetime


class ArenaLeaderboardItem(BaseModel):
    id: int
    name: str
    category: str
    horizon: str
    initial_capital: float
    total_value: float
    total_pnl: float
    total_pnl_pct: float
    win_rate_pct: float
    trade_count: int
    rank: int
