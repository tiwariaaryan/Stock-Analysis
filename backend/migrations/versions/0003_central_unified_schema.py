"""central unified database schema

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-14 13:00:00.000000

"""
from datetime import UTC, datetime
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("preferences", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    # Seed default user for local-first operations
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO users (id, username, display_name, created_at) "
            "VALUES (1, 'default_user', 'Local Investor', :now)"
        ),
        {"now": datetime.now(UTC)},
    )

    # 2. Enrich instruments table with sector, industry, is_active
    op.add_column("instruments", sa.Column("sector", sa.String(100), nullable=True))
    op.add_column("instruments", sa.Column("industry", sa.String(100), nullable=True))
    op.add_column("instruments", sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False))

    # 3. Enrich market_prices table with detailed quote metrics and stats
    op.add_column("market_prices", sa.Column("change", sa.Numeric(18, 4), nullable=True))
    op.add_column("market_prices", sa.Column("change_pct", sa.Float(), nullable=True))
    op.add_column("market_prices", sa.Column("open", sa.Numeric(18, 4), nullable=True))
    op.add_column("market_prices", sa.Column("high", sa.Numeric(18, 4), nullable=True))
    op.add_column("market_prices", sa.Column("low", sa.Numeric(18, 4), nullable=True))
    op.add_column("market_prices", sa.Column("close", sa.Numeric(18, 4), nullable=True))
    op.add_column("market_prices", sa.Column("prev_close", sa.Numeric(18, 4), nullable=True))
    op.add_column("market_prices", sa.Column("volume", sa.BigInteger(), nullable=True))
    op.add_column("market_prices", sa.Column("week_52_high", sa.Numeric(18, 4), nullable=True))
    op.add_column("market_prices", sa.Column("week_52_low", sa.Numeric(18, 4), nullable=True))
    op.add_column("market_prices", sa.Column("pe_ratio", sa.Float(), nullable=True))
    op.add_column("market_prices", sa.Column("market_cap", sa.Float(), nullable=True))
    op.add_column("market_prices", sa.Column("freshness", sa.String(20), server_default="EOD", nullable=False))

    # 4. Create daily_candles table
    op.create_table(
        "daily_candles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("instrument_id", sa.Integer(), sa.ForeignKey("instruments.id"), nullable=False),
        sa.Column("candle_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open", sa.Numeric(18, 4), nullable=False),
        sa.Column("high", sa.Numeric(18, 4), nullable=False),
        sa.Column("low", sa.Numeric(18, 4), nullable=False),
        sa.Column("close", sa.Numeric(18, 4), nullable=False),
        sa.Column("volume", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("adj_close", sa.Numeric(18, 4), nullable=True),
        sa.UniqueConstraint("instrument_id", "candle_date", name="uq_daily_candle"),
    )
    op.create_index("ix_daily_candles_instrument_id", "daily_candles", ["instrument_id"])
    op.create_index("ix_daily_candles_candle_date", "daily_candles", ["candle_date"])

    # 5. Create market_indices table
    op.create_table(
        "market_indices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(32), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("value", sa.Numeric(18, 4), nullable=False),
        sa.Column("change", sa.Numeric(18, 4), nullable=True),
        sa.Column("change_pct", sa.Float(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_market_indices_symbol", "market_indices", ["symbol"], unique=True)

    # 6. Enrich portfolios table with user_id, currency, is_default
    op.add_column("portfolios", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("portfolios", sa.Column("currency", sa.String(3), server_default="INR", nullable=False))
    op.add_column("portfolios", sa.Column("is_default", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_index("ix_portfolios_user_id", "portfolios", ["user_id"])

    # Set existing portfolios to default user_id = 1
    conn.execute(sa.text("UPDATE portfolios SET user_id = 1 WHERE user_id IS NULL"))

    # 7. Enrich holdings table with instrument_id
    op.add_column("holdings", sa.Column("instrument_id", sa.Integer(), nullable=True))
    op.create_index("ix_holdings_symbol", "holdings", ["symbol"])
    op.create_index("ix_holdings_instrument_id", "holdings", ["instrument_id"])

    # 8. Create transactions ledger table
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("portfolio_id", sa.Integer(), sa.ForeignKey("portfolios.id"), nullable=False),
        sa.Column("instrument_id", sa.Integer(), sa.ForeignKey("instruments.id"), nullable=True),
        sa.Column("symbol", sa.String(64), nullable=False),
        sa.Column("transaction_type", sa.String(20), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("price", sa.Numeric(18, 4), nullable=False),
        sa.Column("fees", sa.Numeric(18, 4), server_default="0", nullable=False),
        sa.Column("total_amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("trade_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_transactions_portfolio_id", "transactions", ["portfolio_id"])
    op.create_index("ix_transactions_symbol", "transactions", ["symbol"])
    op.create_index("ix_transactions_trade_date", "transactions", ["trade_date"])

    # 9. Create portfolio_snapshots table
    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("portfolio_id", sa.Integer(), sa.ForeignKey("portfolios.id"), nullable=False),
        sa.Column("snapshot_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_invested", sa.Numeric(18, 4), nullable=False),
        sa.Column("current_value", sa.Numeric(18, 4), nullable=False),
        sa.Column("unrealized_pnl", sa.Numeric(18, 4), nullable=False),
        sa.Column("realized_pnl", sa.Numeric(18, 4), server_default="0", nullable=False),
    )
    op.create_index("ix_portfolio_snapshots_portfolio_id", "portfolio_snapshots", ["portfolio_id"])
    op.create_index("ix_portfolio_snapshots_snapshot_date", "portfolio_snapshots", ["snapshot_date"])

    # 10. Create watchlists & watchlist_items tables
    op.create_table(
        "watchlists",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_watchlists_user_id", "watchlists", ["user_id"])

    # Seed default watchlist
    conn.execute(
        sa.text(
            "INSERT INTO watchlists (id, user_id, name, description, is_default, created_at) "
            "VALUES (1, 1, 'My Wishlist', 'Default watchlist for tracking buy targets', 1, :now)"
        ),
        {"now": datetime.now(UTC)},
    )

    op.create_table(
        "watchlist_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("watchlist_id", sa.Integer(), sa.ForeignKey("watchlists.id"), nullable=False),
        sa.Column("instrument_id", sa.Integer(), sa.ForeignKey("instruments.id"), nullable=True),
        sa.Column("symbol", sa.String(64), nullable=False),
        sa.Column("target_buy_price", sa.Numeric(18, 4), nullable=True),
        sa.Column("target_sell_price", sa.Numeric(18, 4), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("tags", sa.String(100), nullable=True),
        sa.Column("alert_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("watchlist_id", "symbol", name="uq_watchlist_symbol"),
    )
    op.create_index("ix_watchlist_items_watchlist_id", "watchlist_items", ["watchlist_id"])
    op.create_index("ix_watchlist_items_symbol", "watchlist_items", ["symbol"])

    # 11. Create chat_sessions & chat_messages tables
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("title", sa.String(200), server_default="New Chat", nullable=False),
        sa.Column("context_portfolio_id", sa.Integer(), sa.ForeignKey("portfolios.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_sessions_user_id", "chat_sessions", ["user_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("chat_sessions.id"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("referenced_symbols", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])

    # 12. Create ai_research_notes table
    op.create_table(
        "ai_research_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("symbol", sa.String(64), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tags", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_research_notes_user_id", "ai_research_notes", ["user_id"])
    op.create_index("ix_ai_research_notes_symbol", "ai_research_notes", ["symbol"])


def downgrade():
    op.drop_table("ai_research_notes")
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("watchlist_items")
    op.drop_table("watchlists")
    op.drop_table("portfolio_snapshots")
    op.drop_table("transactions")
    op.drop_index("ix_holdings_instrument_id", "holdings")
    op.drop_index("ix_holdings_symbol", "holdings")
    op.drop_column("holdings", "instrument_id")
    op.drop_index("ix_portfolios_user_id", "portfolios")
    op.drop_column("portfolios", "is_default")
    op.drop_column("portfolios", "currency")
    op.drop_column("portfolios", "user_id")
    op.drop_table("market_indices")
    op.drop_table("daily_candles")
    op.drop_column("market_prices", "freshness")
    op.drop_column("market_prices", "market_cap")
    op.drop_column("market_prices", "pe_ratio")
    op.drop_column("market_prices", "week_52_low")
    op.drop_column("market_prices", "week_52_high")
    op.drop_column("market_prices", "volume")
    op.drop_column("market_prices", "prev_close")
    op.drop_column("market_prices", "close")
    op.drop_column("market_prices", "low")
    op.drop_column("market_prices", "high")
    op.drop_column("market_prices", "open")
    op.drop_column("market_prices", "change_pct")
    op.drop_column("market_prices", "change")
    op.drop_column("instruments", "is_active")
    op.drop_column("instruments", "industry")
    op.drop_column("instruments", "sector")
    op.drop_table("users")
