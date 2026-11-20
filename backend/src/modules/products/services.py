from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.modules.prices.models import BranchProductPrice
from src.modules.prices.schemas import PriceOut
from src.modules.products.models import Product
from src.modules.products.schemas import CatalogItem, ProductAdminOut, ProductCreate, ProductUpdate
from src.modules.sales.models import SaleItem
from src.modules.stock.models import StockMovement


def get_product(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    return product


def _check_name_free(db: Session, name: str, exclude_id: int | None = None) -> None:
    query = select(Product.id).where(func.lower(Product.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Product.id != exclude_id)
    if db.scalar(query) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A product with this name already exists.")


def to_admin_out(db: Session, products: list[Product]) -> list[ProductAdminOut]:
    ids = [p.id for p in products]
    prices = db.scalars(select(BranchProductPrice).where(BranchProductPrice.product_id.in_(ids))) if ids else []
    by_product: dict[int, list] = {}
    for price in prices:
        by_product.setdefault(price.product_id, []).append(price)
    result = []
    for p in products:
        out = ProductAdminOut.model_validate(p)
        out.prices = [PriceOut.model_validate(x) for x in sorted(by_product.get(p.id, []), key=lambda x: x.branch_id)]
        result.append(out)
    return result


def list_products_admin(db: Session) -> list[ProductAdminOut]:
    products = list(db.scalars(select(Product).order_by(Product.is_active.desc(), Product.name)))
    return to_admin_out(db, products)


def create_product(db: Session, data: ProductCreate) -> ProductAdminOut:
    _check_name_free(db, data.name)
    product = Product(
        name=data.name,
        base_unit=data.base_unit,
        quick_quantities=[q.model_dump(mode="json") for q in data.quick_quantities],
        low_stock_threshold=data.low_stock_threshold,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return to_admin_out(db, [product])[0]


def update_product(db: Session, product_id: int, data: ProductUpdate) -> ProductAdminOut:
    product = get_product(db, product_id)
    sent = data.model_fields_set

    if "name" in sent and data.name is not None:
        _check_name_free(db, data.name, exclude_id=product.id)
        product.name = data.name

    if "base_unit" in sent and data.base_unit is not None and data.base_unit != product.base_unit:
        # Changing litre<->kg after stock or sales exist would silently corrupt every quantity.
        has_history = db.scalar(select(StockMovement.id).where(StockMovement.product_id == product.id).limit(1)) is not None
        has_history = has_history or db.scalar(select(SaleItem.id).where(SaleItem.product_id == product.id).limit(1)) is not None
        if has_history:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "The unit cannot be changed because this product already has stock or sales recorded.",
            )
        product.base_unit = data.base_unit

    if "quick_quantities" in sent and data.quick_quantities is not None:
        product.quick_quantities = [q.model_dump(mode="json") for q in data.quick_quantities]

    if "low_stock_threshold" in sent and data.low_stock_threshold is not None:
        product.low_stock_threshold = data.low_stock_threshold

    if "is_active" in sent and data.is_active is not None:
        product.is_active = data.is_active

    db.commit()
    db.refresh(product)
    return to_admin_out(db, [product])[0]


def catalog_for_branch(db: Session, branch_id: int) -> list[CatalogItem]:
    """Active products with the selling price for ONE branch (used by Sales and Stock pages)."""
    rows = db.execute(
        select(Product, BranchProductPrice.selling_price)
        .outerjoin(
            BranchProductPrice,
            (BranchProductPrice.product_id == Product.id) & (BranchProductPrice.branch_id == branch_id),
        )
        .where(Product.is_active.is_(True))
        .order_by(Product.id)
    ).all()
    return [
        CatalogItem(
            id=p.id,
            name=p.name,
            base_unit=p.base_unit,
            quick_quantities=p.quick_quantities,
            selling_price=selling_price,
        )
        for p, selling_price in rows
    ]
