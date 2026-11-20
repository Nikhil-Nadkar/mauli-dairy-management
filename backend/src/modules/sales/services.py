"""Creating, undoing and listing sales.

Creating a sale happens in ONE database transaction:
    validate -> lock stock -> re-check stock -> save sale + items (price snapshot) -> save stock deductions -> commit.
If anything fails, nothing is saved.
"""
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.core.dates import day_bounds
from src.modules.branches.models import Branch
from src.modules.prices.models import BranchProductPrice
from src.modules.products.models import Product
from src.modules.sales.models import Sale, SaleItem
from src.modules.sales.schemas import (
    MAX_QTY,
    SaleAdminOut,
    SaleCreate,
    SaleItemAdminOut,
    SaleItemOut,
    SalePage,
    SaleReceipt,
)
from src.modules.stock.models import StockMovement
from src.modules.stock.services import available_stock, lock_stock, qty_text
from src.modules.users.models import User

CENT = Decimal("0.01")
ZERO = Decimal("0")


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


# ------------------------------------------------------------------ create


def _merge_quantities(data: SaleCreate) -> dict[int, Decimal]:
    """1 L + 500 ml of Milk = 1.5 L of Milk. Keeps the order the staff added them."""
    wanted: dict[int, Decimal] = {}
    for item in data.items:
        wanted[item.product_id] = wanted.get(item.product_id, ZERO) + item.quantity
    return wanted


def _load_products_and_prices(
    db: Session, branch_id: int, wanted: dict[int, Decimal]
) -> tuple[dict[int, Product], dict[int, BranchProductPrice]]:
    """Every product must exist, be on sale and have a price in this branch."""
    ids = list(wanted)
    products = {p.id: p for p in db.scalars(select(Product).where(Product.id.in_(ids)))}
    prices = {
        p.product_id: p
        for p in db.scalars(
            select(BranchProductPrice).where(
                BranchProductPrice.branch_id == branch_id, BranchProductPrice.product_id.in_(ids)
            )
        )
    }
    for pid in ids:
        product = products.get(pid)
        if product is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
        if not product.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{product.name} is not on sale.")
        if pid not in prices:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"The price of {product.name} is not set. Please ask the owner.")
        if wanted[pid] > MAX_QTY:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"The quantity of {product.name} is too large.")
    return products, prices


def _lock_and_check_stock(db: Session, branch_id: int, wanted: dict[int, Decimal], products: dict[int, Product]) -> None:
    """Lock, then check stock again (another sale may have just taken it).

    Locks are always taken in ascending product id order, so two sales can never deadlock.
    """
    product_ids = sorted(wanted)
    for pid in product_ids:
        lock_stock(db, branch_id, pid)
    problems = []
    for pid in product_ids:
        product, qty = products[pid], wanted[pid]
        available = available_stock(db, branch_id, pid)
        if available <= 0:
            problems.append(f"{product.name} is OUT OF STOCK.")
        elif available < qty:
            problems.append(f"Not enough {product.name}. Only {qty_text(available, product.base_unit)} left.")
    if problems:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, " ".join(problems))


def _build_items(wanted: dict[int, Decimal], prices: dict[int, BranchProductPrice]) -> list[SaleItem]:
    """Each line keeps a frozen copy of today's price and cost."""
    items = []
    for pid, qty in wanted.items():
        price = prices[pid]
        items.append(
            SaleItem(
                product_id=pid,
                quantity=qty,
                selling_price=price.selling_price,
                cost_price=price.cost_price,
                item_total=_money(qty * price.selling_price),
                item_cost=_money(qty * price.cost_price),
            )
        )
    return items


def _receipt(db: Session, sale: Sale, items: list[SaleItem], products: dict[int, Product]) -> SaleReceipt:
    """What staff get back: no cost or profit."""
    return SaleReceipt(
        id=sale.id,
        branch_id=sale.branch_id,
        branch_name=db.get(Branch, sale.branch_id).name,
        created_at=sale.created_at,
        total_amount=sale.total_amount,
        items=[
            SaleItemOut(
                product_id=i.product_id,
                product_name=products[i.product_id].name,
                base_unit=products[i.product_id].base_unit,
                quantity=i.quantity,
                selling_price=i.selling_price,
                item_total=i.item_total,
            )
            for i in items
        ],
    )


def create_sale(db: Session, user: User, branch_id: int, data: SaleCreate) -> SaleReceipt:
    wanted = _merge_quantities(data)
    products, prices = _load_products_and_prices(db, branch_id, wanted)
    _lock_and_check_stock(db, branch_id, wanted, products)

    items = _build_items(wanted, prices)
    total_amount = sum((i.item_total for i in items), ZERO)
    total_cost = sum((i.item_cost for i in items), ZERO)
    sale = Sale(
        branch_id=branch_id,
        user_id=user.id,
        total_amount=total_amount,
        total_cost=total_cost,
        profit=total_amount - total_cost,
        items=items,
    )
    db.add(sale)
    db.flush()  # gives the sale its id

    # Take the sold quantities out of the stock ledger.
    for item in items:
        db.add(
            StockMovement(
                branch_id=branch_id,
                product_id=item.product_id,
                movement_type="sale",
                quantity_change=-item.quantity,
                sale_id=sale.id,
                user_id=user.id,
            )
        )
    db.commit()
    db.refresh(sale)
    return _receipt(db, sale, items, products)


# ------------------------------------------------------------------ undo


def undo_sale(db: Session, user: User, sale_id: int) -> None:
    """Take back a sale saved by mistake, within a few minutes.

    The sale, its lines and its stock deductions are deleted together, so the stock comes back
    and reports stop counting it. Staff may undo only their own sales; the owner may undo any.
    """
    sale = db.get(Sale, sale_id)
    if sale is None or (user.role != "admin" and sale.branch_id != user.branch_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sale not found.")
    if user.role != "admin" and sale.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only undo your own sales.")

    minutes = get_settings().UNDO_WINDOW_MINUTES
    if datetime.now(timezone.utc) - sale.created_at > timedelta(minutes=minutes):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"This sale is more than {minutes} minutes old, so it cannot be undone. Please ask the owner.",
        )

    db.execute(delete(StockMovement).where(StockMovement.sale_id == sale.id))
    db.delete(sale)  # its lines are deleted with it
    db.commit()


# ------------------------------------------------------------------ list


def list_sales(
    db: Session,
    branch_id: int | None,
    date_from: date | None,
    date_to: date | None,
    limit: int,
    offset: int,
) -> SalePage:
    query = (
        select(Sale, Branch.name, User.full_name)
        .join(Branch, Branch.id == Sale.branch_id)
        .join(User, User.id == Sale.user_id)
        .order_by(Sale.created_at.desc(), Sale.id.desc())
        .limit(limit + 1)
        .offset(offset)
    )
    if branch_id is not None:
        query = query.where(Sale.branch_id == branch_id)
    if date_from is not None and date_to is not None:
        start, end = day_bounds(date_from, date_to)
        query = query.where(Sale.created_at >= start, Sale.created_at < end)
    rows = db.execute(query).all()
    page_rows = rows[:limit]

    items_by_sale = _admin_items_by_sale(db, [s.id for s, _, _ in page_rows])
    return SalePage(
        items=[
            SaleAdminOut(
                id=s.id,
                branch_id=s.branch_id,
                branch_name=branch_name,
                user_id=s.user_id,
                user_name=user_name,
                created_at=s.created_at,
                total_amount=s.total_amount,
                total_cost=s.total_cost,
                profit=s.profit,
                items=items_by_sale.get(s.id, []),
            )
            for s, branch_name, user_name in page_rows
        ],
        has_more=len(rows) > limit,
    )


def _admin_items_by_sale(db: Session, sale_ids: list[int]) -> dict[int, list[SaleItemAdminOut]]:
    """All lines of the given sales, with product names, grouped by sale id."""
    items_by_sale: dict[int, list[SaleItemAdminOut]] = {}
    if not sale_ids:
        return items_by_sale
    rows = db.execute(
        select(SaleItem, Product.name, Product.base_unit)
        .join(Product, Product.id == SaleItem.product_id)
        .where(SaleItem.sale_id.in_(sale_ids))
        .order_by(SaleItem.id)
    ).all()
    for item, product_name, base_unit in rows:
        items_by_sale.setdefault(item.sale_id, []).append(
            SaleItemAdminOut(
                product_id=item.product_id,
                product_name=product_name,
                base_unit=base_unit,
                quantity=item.quantity,
                selling_price=item.selling_price,
                item_total=item.item_total,
                cost_price=item.cost_price,
                item_cost=item.item_cost,
            )
        )
    return items_by_sale
