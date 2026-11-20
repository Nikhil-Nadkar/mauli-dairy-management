from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.security import hash_password
from src.modules.branches.models import Branch
from src.modules.users.models import User
from src.modules.users.schemas import UserCreate, UserUpdate


def _require_branch(db: Session, branch_id: int) -> None:
    branch = db.get(Branch, branch_id)
    if branch is None or not branch.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That branch does not exist.")


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.is_active.desc(), User.full_name)))


def create_user(db: Session, data: UserCreate) -> User:
    email = data.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists.")
    branch_id = data.branch_id if data.role == "staff" else None
    if branch_id is not None:
        _require_branch(db, branch_id)
    user = User(
        full_name=data.full_name,
        email=email,
        password_hash=hash_password(data.password),
        role=data.role,
        branch_id=branch_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, current_admin: User, user_id: int, data: UserUpdate) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    sent = data.model_fields_set

    if user.id == current_admin.id:
        # Stops the owner from locking themselves out.
        if data.is_active is False:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot turn off your own account.")
        if data.role == "staff":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove your own admin access.")

    if "full_name" in sent and data.full_name is not None:
        user.full_name = data.full_name.strip()
    if "is_active" in sent and data.is_active is not None:
        user.is_active = data.is_active
    if "role" in sent and data.role is not None:
        user.role = data.role
    if "branch_id" in sent:
        user.branch_id = data.branch_id

    # Final state must make sense: staff need a branch, admins have none.
    if user.role == "admin":
        user.branch_id = None
    elif user.branch_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please choose a branch for staff members.")
    else:
        _require_branch(db, user.branch_id)

    db.commit()
    db.refresh(user)
    return user


def reset_password(db: Session, user_id: int, new_password: str) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    user.password_hash = hash_password(new_password)
    db.commit()
