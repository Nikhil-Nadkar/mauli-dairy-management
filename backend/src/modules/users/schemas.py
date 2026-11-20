from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from src.modules.branches.schemas import BranchOut


def _check_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(v.encode("utf-8")) > 72:
        raise ValueError("Password is too long (maximum 72 characters)")
    return v


class UserOut(BaseModel):
    """Never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    role: str
    branch_id: int | None
    branch: BranchOut | None
    is_active: bool


class UserCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str
    role: Literal["admin", "staff"] = "staff"
    branch_id: int | None = None

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("password")
    @classmethod
    def password_ok(cls, v: str) -> str:
        return _check_password(v)

    @model_validator(mode="after")
    def staff_needs_branch(self):
        if self.role == "staff" and self.branch_id is None:
            raise ValueError("Please choose a branch for staff members")
        return self


class UserUpdate(BaseModel):
    """Only the fields that are sent are changed."""

    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    role: Literal["admin", "staff"] | None = None
    branch_id: int | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_ok(cls, v: str) -> str:
        return _check_password(v)
