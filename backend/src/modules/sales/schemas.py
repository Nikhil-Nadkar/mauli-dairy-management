from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

MAX_QTY = Decimal("100000")


class SaleItemIn(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0, le=MAX_QTY, max_digits=9, decimal_places=3)


class SaleCreate(BaseModel):
    """The receptionist never sends prices - the server looks them up for the branch."""

    branch_id: int | None = None  # staff: leave empty. Admin: required.
    items: list[SaleItemIn] = Field(min_length=1, max_length=50)


class SaleItemOut(BaseModel):
    product_id: int
    product_name: str
    base_unit: str
    quantity: Decimal
    selling_price: Decimal
    item_total: Decimal


class SaleReceipt(BaseModel):
    """What staff get back after a sale. No cost or profit."""

    id: int
    branch_id: int
    branch_name: str
    created_at: datetime
    total_amount: Decimal
    items: list[SaleItemOut]


class SaleItemAdminOut(SaleItemOut):
    cost_price: Decimal
    item_cost: Decimal


class SaleAdminOut(BaseModel):
    id: int
    branch_id: int
    branch_name: str
    user_id: int
    user_name: str
    created_at: datetime
    total_amount: Decimal
    total_cost: Decimal
    profit: Decimal
    items: list[SaleItemAdminOut]


class SalePage(BaseModel):
    items: list[SaleAdminOut]
    has_more: bool
