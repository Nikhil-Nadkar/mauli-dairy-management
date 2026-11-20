from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import MONEY, Base, TimestampMixin


class BranchProductPrice(TimestampMixin, Base):
    """Current price of a product in a branch. Old prices live on in sale_items snapshots."""

    __tablename__ = "branch_product_prices"
    __table_args__ = (
        UniqueConstraint("branch_id", "product_id", name="uq_branch_product_price"),
        CheckConstraint("selling_price >= 0", name="ck_price_selling_nonneg"),
        CheckConstraint("cost_price >= 0", name="ck_price_cost_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    selling_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)  # per base unit
    cost_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)     # per base unit
