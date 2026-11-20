from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import branch_filter, get_current_user, require_admin, resolve_branch_id
from src.modules.sales import services as sale_service
from src.modules.sales.schemas import SaleCreate, SalePage, SaleReceipt
from src.modules.users.models import User

router = APIRouter(prefix="/api/sales", tags=["Sales"])


@router.post("", response_model=SaleReceipt, status_code=status.HTTP_201_CREATED)
def create_sale(data: SaleCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    branch = resolve_branch_id(db, user, data.branch_id)
    return sale_service.create_sale(db, user, branch, data)


@router.post("/{sale_id}/undo")
def undo_sale(sale_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Take back a sale saved by mistake (only for a few minutes after saving)."""
    sale_service.undo_sale(db, user, sale_id)
    return {"detail": "Sale cancelled. The stock has been put back."}


@router.get("", response_model=SalePage)
def list_sales(
    branch_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """All sales records (owner only: they include cost and profit)."""
    if (date_from is None) != (date_to is None):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please give both a start date and an end date.")
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The start date must be before the end date.")
    branch = branch_filter(db, user, branch_id)
    return sale_service.list_sales(db, branch, date_from, date_to, limit, offset)
