"""Shared FastAPI dependencies: who is logged in, and which branch they may touch.

Every branch-related endpoint MUST get its branch id from
resolve_branch_id() or branch_filter() - never straight from the request.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.security import decode_access_token
from src.modules.branches.models import Branch
from src.modules.users.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized
    # Always re-read the user: a deactivated user or changed branch takes effect immediately.
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can do this.")
    return user


def _check_branch_exists(db: Session, branch_id: int) -> None:
    branch = db.get(Branch, branch_id)
    if branch is None or not branch.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Branch not found.")


def resolve_branch_id(db: Session, user: User, requested_branch_id: int | None) -> int:
    """The ONE branch an action applies to (sales, stock entry, ...).

    Staff: always their own branch. Asking for another branch is refused.
    Admin: must say which branch.
    """
    if user.role != "admin":
        if requested_branch_id is not None and requested_branch_id != user.branch_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only use your own branch.")
        return user.branch_id
    if requested_branch_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please choose a branch.")
    _check_branch_exists(db, requested_branch_id)
    return requested_branch_id


def branch_filter(db: Session, user: User, requested_branch_id: int | None) -> int | None:
    """For reports/lists. Returns a branch id to filter by, or None meaning 'both branches'.

    Staff always get their own branch. Only the admin can get None (combined view).
    """
    if user.role != "admin":
        return resolve_branch_id(db, user, requested_branch_id)
    if requested_branch_id is None:
        return None
    _check_branch_exists(db, requested_branch_id)
    return requested_branch_id
