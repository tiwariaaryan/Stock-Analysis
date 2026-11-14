"""initial instruments and market data tables
Revision ID: 0001
"""
from alembic import op
import sqlalchemy as sa
revision, down_revision, branch_labels, depends_on = "0001", None, None, None
def upgrade():
    op.create_table("instruments", sa.Column("id", sa.Integer, primary_key=True), sa.Column("symbol", sa.String(64), nullable=False, unique=True), sa.Column("name", sa.String(255), nullable=False), sa.Column("asset_type", sa.String(20), nullable=False), sa.Column("exchange", sa.String(20)), sa.Column("isin", sa.String(20)))
    op.create_table("market_prices", sa.Column("id", sa.Integer, primary_key=True), sa.Column("instrument_id", sa.Integer, nullable=False), sa.Column("price", sa.Numeric(18,4), nullable=False), sa.Column("currency", sa.String(3), nullable=False), sa.Column("as_of", sa.DateTime(timezone=True), nullable=False), sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False), sa.Column("source", sa.String(40), nullable=False), sa.Column("data_kind", sa.String(20), nullable=False), sa.UniqueConstraint("instrument_id", "as_of", "source", name="uq_market_price"))
def downgrade():
    op.drop_table("market_prices"); op.drop_table("instruments")
