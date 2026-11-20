"""add low_stock_threshold to products

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("low_stock_threshold", sa.Numeric(12, 3), server_default="5", nullable=False),
    )
    op.create_check_constraint("ck_products_low_stock_nonneg", "products", "low_stock_threshold >= 0")


def downgrade() -> None:
    op.drop_constraint("ck_products_low_stock_nonneg", "products", type_="check")
    op.drop_column("products", "low_stock_threshold")
