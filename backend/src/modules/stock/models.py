from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import QTY, Base


class StockMovement(Base):
    """The stock ledger. Available stock = SUM(quantity_change) per branch + product.

    received   -> positive
    sale       -> negative (linked to sale_id)
    adjustment -> positive or negative, reason required
    """

    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("movement_type IN ('received', 'sale', 'adjustment')", name="ck_stock_type"),
        CheckConstraint("quantity_change <> 0", name="ck_stock_change_nonzero"),
        CheckConstraint(
            "(movement_type = 'received' AND quantity_change > 0)"
            " OR (movement_type = 'sale' AND quantity_change < 0)"
            " OR movement_type = 'adjustment'",
            name="ck_stock_sign_matches_type",
        ),
        CheckConstraint(
            "movement_type <> 'adjustment' OR (reason IS NOT NULL AND length(trim(reason)) > 0)",
            name="ck_stock_adjustment_needs_reason",
        ),
        Index("ix_stock_branch_product", "branch_id", "product_id"),
        Index("ix_stock_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    movement_type: Mapped[str] = mapped_column(String(15), nullable=False)
    quantity_change: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    sale_id: Mapped[int | None] = mapped_column(ForeignKey("sales.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
