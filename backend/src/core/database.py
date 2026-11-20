import os
from datetime import datetime

from sqlalchemy import DateTime, Numeric, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import NullPool

from src.core.config import get_settings


class Base(DeclarativeBase):
    pass


QTY = Numeric(12, 3)    # litres / kg, 3 decimals = down to 1 ml / 1 g
MONEY = Numeric(12, 2)  # rupees


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# On Vercel every request may run in a fresh, short-lived function, so we must not keep our own
# pool of connections; Supabase's "transaction pooler" (port 6543) does the pooling instead.
# Vercel sets VERCEL=1 automatically. Locally a normal pool is used.
# pool_pre_ping avoids "connection closed" errors on free hosts that put the DB to sleep.
_serverless = {"poolclass": NullPool} if os.environ.get("VERCEL") else {}
engine = create_engine(get_settings().DATABASE_URL, pool_pre_ping=True, **_serverless)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    """FastAPI dependency: one DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
