from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import branch_filter, require_admin
from src.modules.reports import services as report_service
from src.modules.reports.schemas import LowStockItem, RangeKey, Summary
from src.modules.users.models import User

# Reports show cost and profit, so they are owner-only (staff have no Dashboard/Reports in the menu).
router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/summary", response_model=Summary)
def summary(
    range: RangeKey = "today",
    date_from: date | None = None,
    date_to: date | None = None,
    branch_id: int | None = None,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Totals, product-wise, branch-wise and daily numbers for a period. Omit branch_id for both branches combined."""
    branch = branch_filter(db, user, branch_id)
    start, end = report_service.resolve_range(range, date_from, date_to)
    return report_service.build_summary(db, branch, start, end)


@router.get("/low-stock", response_model=list[LowStockItem])
def low_stock(branch_id: int | None = None, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    branch = branch_filter(db, user, branch_id)
    return report_service.low_stock(db, branch)
