from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import MONEY, QTY, Base


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = (
        Index("ix_sales_branch_created", "branch_id", "created_at"),
        CheckConstraint("total_amount >= 0", name="ck_sales_total_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    total_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    profit: Mapped[Decimal] = mapped_column(MONEY, nullable=False)  # total_amount - total_cost (gross)

    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    """One line of a sale, with the price and cost frozen at the moment of sale."""

    __tablename__ = "sale_items"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_sale_items_qty_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id", ondelete="CASCADE"), index=True, nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(QTY, nullable=False)          # base units
    selling_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)   # snapshot, per base unit
    cost_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)      # snapshot, per base unit
    item_total: Mapped[Decimal] = mapped_column(MONEY, nullable=False)      # quantity * selling_price
    item_cost: Mapped[Decimal] = mapped_column(MONEY, nullable=False)       # quantity * cost_price

    sale: Mapped[Sale] = relationship(back_populates="items")
