from datetime import UTC, datetime
from decimal import Decimal
from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preferences: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-encoded preferences
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    portfolios: Mapped[list["Portfolio"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    watchlists: Mapped[list["Watchlist"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    notes: Mapped[list["AIResearchNote"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    arena_sandboxes: Mapped[list["ArenaSandbox"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Instrument(Base):
    __tablename__ = "instruments"
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    asset_type: Mapped[str] = mapped_column(String(20))  # EQUITY, ETF, MUTUAL_FUND, INDEX
    exchange: Mapped[str | None] = mapped_column(String(20), nullable=True)  # NSE, BSE, AMFI
    isin: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    market_prices: Mapped[list["MarketPrice"]] = relationship(back_populates="instrument", cascade="all, delete-orphan")
    daily_candles: Mapped[list["DailyCandle"]] = relationship(back_populates="instrument", cascade="all, delete-orphan")


class MarketPrice(Base):
    __tablename__ = "market_prices"
    __table_args__ = (UniqueConstraint("instrument_id", "source", name="uq_market_price_source"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    change: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    open: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    high: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    low: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    close: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    prev_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    volume: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    week_52_high: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    week_52_low: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    pe_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    market_cap: Mapped[float | None] = mapped_column(Float, nullable=True)
    as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    source: Mapped[str] = mapped_column(String(40))  # yfinance, fyers, amfi
    data_kind: Mapped[str] = mapped_column(String(20))  # LIVE, EOD, NAV
    freshness: Mapped[str] = mapped_column(String(20), default="EOD")

    instrument: Mapped["Instrument"] = relationship(back_populates="market_prices")


class DailyCandle(Base):
    __tablename__ = "daily_candles"
    __table_args__ = (UniqueConstraint("instrument_id", "candle_date", name="uq_daily_candle"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    candle_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    open: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    high: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    low: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    close: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    volume: Mapped[int] = mapped_column(BigInteger, default=0)
    adj_close: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    instrument: Mapped["Instrument"] = relationship(back_populates="daily_candles")


class MarketIndex(Base):
    __tablename__ = "market_indices"
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(32), unique=True, index=True)  # NIFTY 50, SENSEX
    name: Mapped[str] = mapped_column(String(100))
    value: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    change: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


class Portfolio(Base):
    __tablename__ = "portfolios"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user: Mapped["User | None"] = relationship(back_populates="portfolios")
    holdings: Mapped[list["Holding"]] = relationship(back_populates="portfolio", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="portfolio", cascade="all, delete-orphan")
    snapshots: Mapped[list["PortfolioSnapshot"]] = relationship(back_populates="portfolio", cascade="all, delete-orphan")


class Holding(Base):
    __tablename__ = "holdings"
    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    instrument_id: Mapped[int | None] = mapped_column(ForeignKey("instruments.id"), nullable=True, index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    buy_price: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    buy_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    asset_type: Mapped[str] = mapped_column(String(20), default="EQUITY")
    ai_entry_score: Mapped[int | None] = mapped_column(nullable=True)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="holdings")


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    instrument_id: Mapped[int | None] = mapped_column(ForeignKey("instruments.id"), nullable=True, index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    transaction_type: Mapped[str] = mapped_column(String(20))  # BUY, SELL, DIVIDEND, SPLIT
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    fees: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    trade_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    portfolio: Mapped["Portfolio"] = relationship(back_populates="transactions")


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    snapshot_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    total_invested: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    current_value: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    unrealized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))

    portfolio: Mapped["Portfolio"] = relationship(back_populates="snapshots")


class Watchlist(Base):
    __tablename__ = "watchlists"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user: Mapped["User | None"] = relationship(back_populates="watchlists")
    items: Mapped[list["WatchlistItem"]] = relationship(back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    __table_args__ = (UniqueConstraint("watchlist_id", "symbol", name="uq_watchlist_symbol"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    watchlist_id: Mapped[int] = mapped_column(ForeignKey("watchlists.id"), index=True)
    instrument_id: Mapped[int | None] = mapped_column(ForeignKey("instruments.id"), nullable=True, index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    target_buy_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    target_sell_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "dividend,bluechip"
    alert_active: Mapped[bool] = mapped_column(Boolean, default=True)
    ai_entry_score: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    watchlist: Mapped["Watchlist"] = relationship(back_populates="items")


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), default="New Chat")
    context_portfolio_id: Mapped[int | None] = mapped_column(ForeignKey("portfolios.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user: Mapped["User | None"] = relationship(back_populates="chat_sessions")
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # user, model, system
    content: Mapped[str] = mapped_column(Text)
    referenced_symbols: Mapped[str | None] = mapped_column(String(255), nullable=True)  # JSON or comma-separated
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    session: Mapped["ChatSession"] = relationship(back_populates="messages")


class AIResearchNote(Base):
    __tablename__ = "ai_research_notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    symbol: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    tags: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user: Mapped["User | None"] = relationship(back_populates="notes")


class ExternalDataRecord(Base):
    __tablename__ = "external_data_records"
    __table_args__ = (UniqueConstraint("content_hash", name="uq_content_hash"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(32), index=True)  # NEWS, FUNDAMENTALS, FILING, REGULATORY, SEARCH
    source_name: Mapped[str] = mapped_column(String(64), index=True)  # tavily, serper, ddgs, google_news, nse, screener, etc.
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)  # SHA-256 for strict deduplication
    raw_content: Mapped[str] = mapped_column(Text)  # Complete raw HTML, Markdown, or JSON
    extracted_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-encoded normalized metrics
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    freshness_status: Mapped[str] = mapped_column(String(20), default="FRESH")


class ArenaSandbox(Base):
    __tablename__ = "arena_sandboxes"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(String(40), default="CUSTOM")  # USER_INTUITION, AI_INSTITUTIONAL, MARKET_TIPS, CUSTOM
    horizon: Mapped[str] = mapped_column(String(20), default="1M")  # 1W, 1M, 3M, 6M, 1Y, FLEXIBLE
    initial_capital: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("100000.00"))
    current_cash: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("100000.00"))
    auto_execute: Mapped[bool] = mapped_column(Boolean, default=True)
    position_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    user: Mapped["User | None"] = relationship(back_populates="arena_sandboxes")
    positions: Mapped[list["ArenaPosition"]] = relationship(back_populates="sandbox", cascade="all, delete-orphan")
    trades: Mapped[list["ArenaTrade"]] = relationship(back_populates="sandbox", cascade="all, delete-orphan")


class ArenaPosition(Base):
    __tablename__ = "arena_positions"
    id: Mapped[int] = mapped_column(primary_key=True)
    sandbox_id: Mapped[int] = mapped_column(ForeignKey("arena_sandboxes.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    avg_buy_price: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    target_sell_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    ai_target_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    custom_target_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    stop_loss_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    horizon: Mapped[str] = mapped_column(String(20), default="1M")
    rationale: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ai_score: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    sandbox: Mapped["ArenaSandbox"] = relationship(back_populates="positions")


class ArenaTrade(Base):
    __tablename__ = "arena_trades"
    id: Mapped[int] = mapped_column(primary_key=True)
    sandbox_id: Mapped[int] = mapped_column(ForeignKey("arena_sandboxes.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    trade_type: Mapped[str] = mapped_column(String(30))  # BUY, SELL_TARGET_HIT, SELL_STOP_LOSS, SELL_MANUAL
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    realized_pnl_pct: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    sandbox: Mapped["ArenaSandbox"] = relationship(back_populates="trades")


class AIScanRun(Base):
    __tablename__ = "ai_scan_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    batch_number: Mapped[int] = mapped_column(default=1)
    batch_name: Mapped[str] = mapped_column(String(100))
    stock_offset_start: Mapped[int] = mapped_column(default=1)
    stock_offset_end: Mapped[int] = mapped_column(default=500)
    total_screened: Mapped[int] = mapped_column(default=500)
    top_winners_count: Mapped[int] = mapped_column(default=25)
    top_symbol: Mapped[str | None] = mapped_column(String(64), nullable=True)
    top_score: Mapped[int | None] = mapped_column(nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    vault_items: Mapped[list["AITelecastVault"]] = relationship(back_populates="scan_run", cascade="all, delete-orphan")


class AITelecastVault(Base):
    __tablename__ = "ai_telecast_vault"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("ai_scan_runs.id"), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    batch_number: Mapped[int] = mapped_column(default=1, index=True)
    batch_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cap_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    strategy_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    strategy_title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    current_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    initial_ai_score: Mapped[int | None] = mapped_column(nullable=True)
    current_ai_score: Mapped[int | None] = mapped_column(nullable=True)
    score_change: Mapped[int] = mapped_column(default=0)
    action: Mapped[str | None] = mapped_column(String(30), nullable=True)
    target_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    stop_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    catalyst_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    horizon_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    horizon_upside_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_top_setup: Mapped[bool] = mapped_column(Boolean, default=False)
    telecast_table: Mapped[str | None] = mapped_column(Text, nullable=True)
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    scan_run: Mapped["AIScanRun | None"] = relationship(back_populates="vault_items")
    user: Mapped["User | None"] = relationship()
