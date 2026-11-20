from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

RangeKey = Literal["today", "7d", "21d", "3m", "custom"]


class Totals(BaseModel):
    total_sales: Decimal      # sum of selling amounts
    total_cost: Decimal       # cost of the products sold (price snapshots at time of sale)
    gross_profit: Decimal     # total_sales - total_cost. NOT net profit: no rent, salaries, electricity...
    sales_count: int          # number of sales (bills)
    items_sold: int           # number of product lines across all sales


class ProductLine(BaseModel):
    product_id: int
    name: str
    base_unit: str
    quantity: Decimal
    sales: Decimal
    cost: Decimal
    profit: Decimal


class BranchLine(BaseModel):
    branch_id: int
    name: str
    sales: Decimal
    cost: Decimal
    profit: Decimal
    sales_count: int


class DayPoint(BaseModel):
    date: date
    sales: Decimal
    profit: Decimal
    sales_count: int


class Summary(BaseModel):
    date_from: date
    date_to: date
    branch_id: int | None     # None = both branches combined
    totals: Totals
    products: list[ProductLine]
    branches: list[BranchLine]
    daily: list[DayPoint]


class LowStockItem(BaseModel):
    branch_id: int
    branch_name: str
    product_id: int
    name: str
    base_unit: str
    available: Decimal
    status: Literal["low", "out_of_stock"]
