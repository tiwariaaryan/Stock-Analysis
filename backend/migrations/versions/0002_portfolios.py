"""add portfolio and holdings tables
Revision ID: 0002
"""
from alembic import op
import sqlalchemy as sa
revision, down_revision, branch_labels, depends_on = "0002", "0001", None, None

def upgrade():
    op.create_table("portfolios",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table("holdings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("portfolio_id", sa.Integer, sa.ForeignKey("portfolios.id"), nullable=False),
        sa.Column("symbol", sa.String(64), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("buy_price", sa.Numeric(18, 4), nullable=False),
        sa.Column("buy_date", sa.DateTime(timezone=True)),
        sa.Column("asset_type", sa.String(20), nullable=False, server_default="EQUITY"),
    )
    op.create_index("ix_holdings_portfolio_id", "holdings", ["portfolio_id"])

def downgrade():
    op.drop_table("holdings")
    op.drop_table("portfolios")
