from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.core.dates import day_bounds, months_ago, today_local
from src.modules.branches.models import Branch
from src.modules.products.models import Product
from src.modules.reports.schemas import BranchLine, DayPoint, LowStockItem, ProductLine, Summary, Totals
from src.modules.sales.models import Sale, SaleItem
from src.modules.stock.services import stock_overview

MAX_CUSTOM_DAYS = 366
CENT = Decimal("0.01")
MILLI = Decimal("0.001")


def _money(v) -> Decimal:
    return Decimal(v or 0).quantize(CENT)


@dataclass
class _Tally:
    """Running totals for one day or one branch."""

    sales: Decimal = Decimal(0)
    cost: Decimal = Decimal(0)
    profit: Decimal = Decimal(0)
    count: int = 0

    def add(self, sales, cost, profit, count) -> None:
        self.sales += sales
        self.cost += cost
        self.profit += profit
        self.count += count


def resolve_range(key: str, date_from: date | None, date_to: date | None) -> tuple[date, date]:
    """Turn 'Last 7 days' etc. into real dates. Ranges include today, in the business timezone."""
    today = today_local()
    if key == "today":
        return today, today
    if key == "7d":
        return today - timedelta(days=6), today
    if key == "21d":
        return today - timedelta(days=20), today
    if key == "3m":
        return months_ago(today, 3) + timedelta(days=1), today
    # custom
    if date_from is None or date_to is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please choose both a start date and an end date.")
    if date_from > date_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The start date must be before the end date.")
    if (date_to - date_from).days + 1 > MAX_CUSTOM_DAYS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please choose a period of one year or less.")
    return date_from, date_to


def build_summary(db: Session, branch_id: int | None, date_from: date, date_to: date) -> Summary:
    start, end = day_bounds(date_from, date_to)
    in_range = [Sale.created_at >= start, Sale.created_at < end]
    if branch_id is not None:
        in_range.append(Sale.branch_id == branch_id)

    # Sales grouped by LOCAL calendar day and branch (one pass gives totals, branch-wise and daily).
    local_day = cast(func.timezone(get_settings().APP_TIMEZONE, Sale.created_at), Date)
    sale_rows = db.execute(
        select(
            local_day.label("day"),
            Sale.branch_id,
            func.sum(Sale.total_amount),
            func.sum(Sale.total_cost),
            func.sum(Sale.profit),
            func.count(Sale.id),
        )
        .where(*in_range)
        .group_by(local_day, Sale.branch_id)
    ).all()

    by_day: dict[date, _Tally] = {}
    by_branch: dict[int, _Tally] = {}
    for day, b_id, amount, cost, profit, n in sale_rows:
        by_day.setdefault(day, _Tally()).add(amount, cost, profit, n)
        by_branch.setdefault(b_id, _Tally()).add(amount, cost, profit, n)

    # Product-wise, using the price/cost frozen on each sale line.
    product_rows = db.execute(
        select(
            SaleItem.product_id,
            Product.name,
            Product.base_unit,
            func.sum(SaleItem.quantity),
            func.sum(SaleItem.item_total),
            func.sum(SaleItem.item_cost),
            func.count(SaleItem.id),
        )
        .join(Sale, Sale.id == SaleItem.sale_id)
        .join(Product, Product.id == SaleItem.product_id)
        .where(*in_range)
        .group_by(SaleItem.product_id, Product.name, Product.base_unit)
        .order_by(func.sum(SaleItem.item_total).desc())
    ).all()

    branch_query = select(Branch).where(Branch.is_active.is_(True)).order_by(Branch.id)
    if branch_id is not None:
        branch_query = branch_query.where(Branch.id == branch_id)
    branches = list(db.scalars(branch_query))

    total_sales = sum((t.sales for t in by_branch.values()), Decimal(0))
    total_cost = sum((t.cost for t in by_branch.values()), Decimal(0))
    empty = _Tally()
    return Summary(
        date_from=date_from,
        date_to=date_to,
        branch_id=branch_id,
        totals=Totals(
            total_sales=_money(total_sales),
            total_cost=_money(total_cost),
            gross_profit=_money(total_sales - total_cost),
            sales_count=sum(t.count for t in by_branch.values()),
            items_sold=sum(row[6] for row in product_rows),
        ),
        products=[
            ProductLine(
                product_id=pid,
                name=name,
                base_unit=unit,
                quantity=Decimal(qty).quantize(MILLI),
                sales=_money(sales),
                cost=_money(cost),
                profit=_money(Decimal(sales) - Decimal(cost)),
            )
            for pid, name, unit, qty, sales, cost, _ in product_rows
        ],
        branches=[
            BranchLine(
                branch_id=b.id,
                name=b.name,
                sales=_money(by_branch.get(b.id, empty).sales),
                cost=_money(by_branch.get(b.id, empty).cost),
                profit=_money(by_branch.get(b.id, empty).profit),
                sales_count=by_branch.get(b.id, empty).count,
            )
            for b in branches
        ],
        daily=[
            DayPoint(
                date=d,
                sales=_money(by_day.get(d, empty).sales),
                profit=_money(by_day.get(d, empty).profit),
                sales_count=by_day.get(d, empty).count,
            )
            for d in (date_from + timedelta(days=i) for i in range((date_to - date_from).days + 1))
        ],
    )


def low_stock(db: Session, branch_id: int | None) -> list[LowStockItem]:
    """Active products that are low or out of stock. branch_id None = both branches."""
    query = select(Branch).where(Branch.is_active.is_(True)).order_by(Branch.id)
    if branch_id is not None:
        query = query.where(Branch.id == branch_id)
    result = []
    for branch in db.scalars(query):
        for row in stock_overview(db, branch.id):
            if row.is_active and row.status != "in_stock":
                result.append(
                    LowStockItem(
                        branch_id=branch.id,
                        branch_name=branch.name,
                        product_id=row.product_id,
                        name=row.name,
                        base_unit=row.base_unit,
                        available=row.available,
                        status=row.status,
                    )
                )
    return result
