from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.security import create_access_token
from src.modules.auth.dependencies import get_current_user
from src.modules.auth.schemas import LoginRequest, LoginResponse
from src.modules.auth.services import authenticate
from src.modules.users.models import User
from src.modules.users.schemas import UserOut

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate(db, data.email, data.password)
    return LoginResponse(access_token=create_access_token(user.id), user=user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout")
def logout(_: User = Depends(get_current_user)):
    # Tokens are stateless; the app logs out by deleting its saved token.
    return {"message": "Logged out."}
