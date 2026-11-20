from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import require_admin
from src.modules.users import services as user_service
from src.modules.users.models import User
from src.modules.users.schemas import PasswordReset, UserCreate, UserOut, UserUpdate

# Every route here is admin-only.
router = APIRouter(prefix="/api/users", tags=["Users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return user_service.list_users(db)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    return user_service.create_user(db, data)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return user_service.update_user(db, admin, user_id, data)


@router.post("/{user_id}/reset-password")
def reset_password(user_id: int, data: PasswordReset, db: Session = Depends(get_db)):
    user_service.reset_password(db, user_id, data.new_password)
    return {"message": "Password changed."}
