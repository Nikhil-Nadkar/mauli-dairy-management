from decimal import Decimal

from sqlalchemy import JSON, Boolean, CheckConstraint, Index, String, column, func
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import QTY, Base, TimestampMixin


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("base_unit IN ('litre', 'kg')", name="ck_products_base_unit"),
        CheckConstraint("low_stock_threshold >= 0", name="ck_products_low_stock_nonneg"),
        # "Milk" and "milk" cannot both exist (prevents duplicate Shrikhand etc.)
        Index("uq_products_name_lower", func.lower(column("name")), unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    base_unit: Mapped[str] = mapped_column(String(10), nullable=False)
    # Quick buttons, e.g. [{"label": "250 ml", "quantity": "0.250"}]; quantity is in base units.
    quick_quantities: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # "Low stock" warning shows when available stock <= this (in base units, same for both branches).
    low_stock_threshold: Mapped[Decimal] = mapped_column(QTY, nullable=False, default=Decimal("5"), server_default="5")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
