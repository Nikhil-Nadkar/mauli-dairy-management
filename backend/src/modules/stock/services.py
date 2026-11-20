"""Stock ledger logic. Available stock = SUM(stock_movements.quantity_change) per branch + product.

Anything that REDUCES stock (corrections and sales) must:
  1. call lock_stock() for each (branch, product) it touches - always in ascending product_id order,
  2. re-read available_stock() after locking,
  3. refuse if the result would go below zero,
  4. insert its movement(s) and commit - all in ONE transaction.
The lock makes two people selling/removing the last litre at the same moment safe.
"""
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from src.modules.branches.models import Branch
from src.modules.products.models import Product
from src.modules.stock.models import StockMovement
from src.modules.stock.schemas import AdjustRequest, MovementOut, MovementPage, ReceiveRequest, StockRow
from src.modules.users.models import User

THOUSANDTH = Decimal("0.001")


def _dec(value) -> Decimal:
    """SUM/COALESCE can return int 0 or odd scales; always give 3 decimals."""
    return Decimal(value).quantize(THOUSANDTH)


def lock_stock(db: Session, branch_id: int, product_id: int) -> None:
    """Wait for anyone else changing this branch+product, until our transaction ends (PostgreSQL)."""
    db.execute(text("SELECT pg_advisory_xact_lock(:b, :p)"), {"b": branch_id, "p": product_id})


def available_stock(db: Session, branch_id: int, product_id: int) -> Decimal:
    total = db.scalar(
        select(func.coalesce(func.sum(StockMovement.quantity_change), 0)).where(
            StockMovement.branch_id == branch_id, StockMovement.product_id == product_id
        )
    )
    return _dec(total)


def stock_status(available: Decimal, threshold: Decimal) -> str:
    if available <= 0:
        return "out_of_stock"
    if available <= threshold:
        return "low"
    return "in_stock"


def qty_text(value: Decimal, base_unit: str) -> str:
    return f"{format(value.normalize(), 'f')} {'L' if base_unit == 'litre' else 'kg'}"


def _row(product: Product, available: Decimal) -> StockRow:
    return StockRow(
        product_id=product.id,
        name=product.name,
        base_unit=product.base_unit,
        is_active=product.is_active,
        available=available,
        low_stock_threshold=product.low_stock_threshold,
        status=stock_status(available, product.low_stock_threshold),
    )


def stock_overview(db: Session, branch_id: int, only_product_ids: list[int] | None = None) -> list[StockRow]:
    totals = (
        select(StockMovement.product_id, func.sum(StockMovement.quantity_change).label("total"))
        .where(StockMovement.branch_id == branch_id)
        .group_by(StockMovement.product_id)
        .subquery()
    )
    query = (
        select(Product, func.coalesce(totals.c.total, 0))
        .outerjoin(totals, totals.c.product_id == Product.id)
        .order_by(Product.is_active.desc(), Product.name)
    )
    if only_product_ids is not None:
        query = query.where(Product.id.in_(only_product_ids))
    rows = []
    for product, total in db.execute(query).all():
        available = _dec(total)
        # Hidden products only matter while they still have stock on the shelf.
        if not product.is_active and available == 0 and only_product_ids is None:
            continue
        rows.append(_row(product, available))
    return rows


def receive_stock(db: Session, user: User, branch_id: int, data: ReceiveRequest) -> list[StockRow]:
    """Record incoming stock for one or more products in a single all-or-nothing step."""
    ids = [i.product_id for i in data.items]
    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(ids)))}
    for item in data.items:
        product = products.get(item.product_id)
        if product is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
        if not product.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{product.name} is hidden, so stock cannot be added.")
    for item in data.items:
        db.add(
            StockMovement(
                branch_id=branch_id,
                product_id=item.product_id,
                movement_type="received",
                quantity_change=item.quantity,
                user_id=user.id,
            )
        )
    db.commit()
    return stock_overview(db, branch_id, only_product_ids=ids)


def adjust_stock(db: Session, user: User, branch_id: int, data: AdjustRequest) -> StockRow:
    product = db.get(Product, data.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")

    lock_stock(db, branch_id, product.id)
    available = available_stock(db, branch_id, product.id)
    if available + data.quantity_change < 0:
        db.rollback()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Only {qty_text(available, product.base_unit)} of {product.name} in stock, "
            f"so you cannot remove {qty_text(abs(data.quantity_change), product.base_unit)}.",
        )
    db.add(
        StockMovement(
            branch_id=branch_id,
            product_id=product.id,
            movement_type="adjustment",
            quantity_change=data.quantity_change,
            reason=data.reason,
            user_id=user.id,
        )
    )
    db.commit()
    return stock_overview(db, branch_id, only_product_ids=[product.id])[0]


def list_movements(
    db: Session, branch_id: int | None, product_id: int | None, limit: int, offset: int
) -> MovementPage:
    query = (
        select(StockMovement, Branch.name, Product.name, Product.base_unit, User.full_name)
        .join(Branch, Branch.id == StockMovement.branch_id)
        .join(Product, Product.id == StockMovement.product_id)
        .join(User, User.id == StockMovement.user_id)
        .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
        .limit(limit + 1)
        .offset(offset)
    )
    if branch_id is not None:
        query = query.where(StockMovement.branch_id == branch_id)
    if product_id is not None:
        query = query.where(StockMovement.product_id == product_id)
    rows = db.execute(query).all()
    items = [
        MovementOut(
            id=m.id,
            created_at=m.created_at,
            branch_id=m.branch_id,
            branch_name=branch_name,
            product_id=m.product_id,
            product_name=product_name,
            base_unit=base_unit,
            movement_type=m.movement_type,
            quantity_change=m.quantity_change,
            reason=m.reason,
            user_name=user_name,
            sale_id=m.sale_id,
        )
        for m, branch_name, product_name, base_unit, user_name in rows[:limit]
    ]
    return MovementPage(items=items, has_more=len(rows) > limit)
