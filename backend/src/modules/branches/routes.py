from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.branches.models import Branch
from src.modules.branches.schemas import BranchOut
from src.modules.users.models import User

router = APIRouter(prefix="/api/branches", tags=["Branches"])


@router.get("", response_model=list[BranchOut])
def list_branches(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin sees both branches. Staff see only their own."""
    query = select(Branch).where(Branch.is_active.is_(True)).order_by(Branch.id)
    if user.role != "admin":
        query = query.where(Branch.id == user.branch_id)
    return list(db.scalars(query))
