from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import require_admin
from src.modules.prices import services as price_service
from src.modules.prices.schemas import PricesUpdate
from src.modules.products.schemas import ProductAdminOut

# Prices (and especially cost prices) are admin-only.
router = APIRouter(prefix="/api/prices", tags=["Prices"], dependencies=[Depends(require_admin)])


@router.put("/{product_id}", response_model=ProductAdminOut)
def update_prices(product_id: int, data: PricesUpdate, db: Session = Depends(get_db)):
    """Set selling + cost price per branch for one product. Only affects NEW sales."""
    return price_service.set_prices(db, product_id, data)
