from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.modules.branches.models import Branch
from src.modules.prices.models import BranchProductPrice
from src.modules.prices.schemas import PricesUpdate
from src.modules.products.schemas import ProductAdminOut
from src.modules.products.services import get_product, to_admin_out


def set_prices(db: Session, product_id: int, data: PricesUpdate) -> ProductAdminOut:
    """Change current prices. Old sales are untouched: they keep their own price snapshot."""
    product = get_product(db, product_id)
    valid_branch_ids = set(db.scalars(select(Branch.id).where(Branch.is_active.is_(True))))
    for item in data.prices:
        if item.branch_id not in valid_branch_ids:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That branch does not exist.")

    existing = {
        p.branch_id: p
        for p in db.scalars(select(BranchProductPrice).where(BranchProductPrice.product_id == product.id))
    }
    for item in data.prices:
        row = existing.get(item.branch_id)
        if row is None:
            db.add(
                BranchProductPrice(
                    branch_id=item.branch_id,
                    product_id=product.id,
                    selling_price=item.selling_price,
                    cost_price=item.cost_price,
                )
            )
        else:
            row.selling_price = item.selling_price
            row.cost_price = item.cost_price
    db.commit()
    db.refresh(product)
    return to_admin_out(db, [product])[0]
