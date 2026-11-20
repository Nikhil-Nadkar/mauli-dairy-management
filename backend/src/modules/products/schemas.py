from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.modules.prices.schemas import PriceOut

MAX_QUICK_BUTTONS = 8
_THOUSANDTH = Decimal("0.001")


class QuickQuantity(BaseModel):
    """One quick button. `quantity` is in BASE units (litres or kg), e.g. 250 ml = 0.250."""

    label: str = Field(min_length=1, max_length=30)
    quantity: Decimal = Field(gt=0, le=1000, max_digits=7, decimal_places=3)

    @field_validator("label")
    @classmethod
    def strip_label(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Button name is required")
        return v

    @field_validator("quantity")
    @classmethod
    def three_decimals(cls, v: Decimal) -> Decimal:
        return v.quantize(_THOUSANDTH)


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    base_unit: str
    quick_quantities: list[QuickQuantity]
    low_stock_threshold: Decimal
    is_active: bool


class ProductAdminOut(ProductOut):
    """Admin view: includes selling AND cost price of each branch."""

    prices: list[PriceOut] = []


class CatalogItem(BaseModel):
    """What Sales/Stock pages need for ONE branch. Never contains cost price."""

    id: int
    name: str
    base_unit: str
    quick_quantities: list[QuickQuantity]
    selling_price: Decimal | None  # None = admin has not set a price for this branch yet


def _clean_name(v: str) -> str:
    v = " ".join(v.split())
    if not v:
        raise ValueError("Product name is required")
    return v


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_unit: Literal["litre", "kg"]
    quick_quantities: list[QuickQuantity] = Field(default_factory=list, max_length=MAX_QUICK_BUTTONS)
    low_stock_threshold: Decimal = Field(default=Decimal("5"), ge=0, max_digits=9, decimal_places=3)

    _name = field_validator("name")(_clean_name)


class ProductUpdate(BaseModel):
    """Only the fields that are sent are changed."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    base_unit: Literal["litre", "kg"] | None = None
    quick_quantities: list[QuickQuantity] | None = Field(default=None, max_length=MAX_QUICK_BUTTONS)
    low_stock_threshold: Decimal | None = Field(default=None, ge=0, max_digits=9, decimal_places=3)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def clean(cls, v: str | None) -> str | None:
        return None if v is None else _clean_name(v)
