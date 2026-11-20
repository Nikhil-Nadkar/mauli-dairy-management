from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    branch_id: int
    selling_price: Decimal
    cost_price: Decimal


class PriceIn(BaseModel):
    branch_id: int
    selling_price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    cost_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class PricesUpdate(BaseModel):
    prices: list[PriceIn] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def no_duplicate_branches(self):
        ids = [p.branch_id for p in self.prices]
        if len(ids) != len(set(ids)):
            raise ValueError("Each branch can only appear once")
        return self
