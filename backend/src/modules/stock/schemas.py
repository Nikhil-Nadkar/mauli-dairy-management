from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_QTY = Decimal("100000")


def _qty_field(**kwargs):
    return Field(max_digits=9, decimal_places=3, **kwargs)


class StockRow(BaseModel):
    product_id: int
    name: str
    base_unit: str
    is_active: bool
    available: Decimal
    low_stock_threshold: Decimal
    status: Literal["in_stock", "low", "out_of_stock"]


class ReceiveItem(BaseModel):
    product_id: int
    quantity: Decimal = _qty_field(gt=0, le=MAX_QTY)


class ReceiveRequest(BaseModel):
    branch_id: int | None = None  # staff: leave empty (their own branch is used). Admin: required.
    items: list[ReceiveItem] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def each_product_once(self):
        ids = [i.product_id for i in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Each product can only be listed once")
        return self


class AdjustRequest(BaseModel):
    """quantity_change: negative = remove (damaged/spoiled/wasted), positive = add back."""

    branch_id: int | None = None
    product_id: int
    quantity_change: Decimal = _qty_field(ge=-MAX_QTY, le=MAX_QTY)
    reason: str = Field(max_length=200)

    @field_validator("quantity_change")
    @classmethod
    def not_zero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("Quantity cannot be zero")
        return v

    @field_validator("reason")
    @classmethod
    def reason_required(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 3:
            raise ValueError("Please give a reason for the correction")
        return v


class MovementOut(BaseModel):
    id: int
    created_at: datetime
    branch_id: int
    branch_name: str
    product_id: int
    product_name: str
    base_unit: str
    movement_type: Literal["received", "sale", "adjustment"]
    quantity_change: Decimal
    reason: str | None
    user_name: str
    sale_id: int | None


class MovementPage(BaseModel):
    items: list[MovementOut]
    has_more: bool
