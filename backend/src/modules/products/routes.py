from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, require_admin, resolve_branch_id
from src.modules.products import services as product_service
from src.modules.products.schemas import CatalogItem, ProductAdminOut, ProductCreate, ProductUpdate
from src.modules.users.models import User

router = APIRouter(prefix="/api/products", tags=["Products"])


# NOTE: /catalog must stay above /{product_id} routes.
@router.get("/catalog", response_model=list[CatalogItem])
def catalog(branch_id: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Products + selling price for one branch. Staff always get their own branch."""
    branch = resolve_branch_id(db, user, branch_id)
    return product_service.catalog_for_branch(db, branch)


@router.get("", response_model=list[ProductAdminOut], dependencies=[Depends(require_admin)])
def list_products(db: Session = Depends(get_db)):
    return product_service.list_products_admin(db)


@router.post("", response_model=ProductAdminOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    return product_service.create_product(db, data)


@router.patch("/{product_id}", response_model=ProductAdminOut, dependencies=[Depends(require_admin)])
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db)):
    return product_service.update_product(db, product_id, data)
