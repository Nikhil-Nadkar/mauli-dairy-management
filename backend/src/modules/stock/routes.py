from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import branch_filter, get_current_user, resolve_branch_id
from src.modules.stock import services as stock_service
from src.modules.stock.schemas import AdjustRequest, MovementPage, ReceiveRequest, StockRow
from src.modules.users.models import User

router = APIRouter(prefix="/api/stock", tags=["Stock"])


@router.get("", response_model=list[StockRow])
def overview(branch_id: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Available stock and status per product for ONE branch (staff: their own)."""
    branch = resolve_branch_id(db, user, branch_id)
    return stock_service.stock_overview(db, branch)


@router.post("/receive", response_model=list[StockRow])
def receive(data: ReceiveRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    branch = resolve_branch_id(db, user, data.branch_id)
    return stock_service.receive_stock(db, user, branch, data)


@router.post("/adjust", response_model=StockRow)
def adjust(data: AdjustRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Correct stock (damaged / spoiled / wasted / counting mistake). A reason is required."""
    branch = resolve_branch_id(db, user, data.branch_id)
    return stock_service.adjust_stock(db, user, branch, data)


@router.get("/movements", response_model=MovementPage)
def movements(
    branch_id: int | None = None,
    product_id: int | None = None,
    limit: int = Query(30, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stock history, newest first. Staff: own branch only. Admin: one branch, or both if branch_id is omitted."""
    branch = branch_filter(db, user, branch_id)
    return stock_service.list_movements(db, branch, product_id, limit, offset)
