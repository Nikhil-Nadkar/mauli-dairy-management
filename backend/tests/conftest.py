"""Tests run against a SEPARATE PostgreSQL database. All its tables are wiped for every test.

    createdb dairy_test
    TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/dairy_test pytest
"""
import os

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
if not TEST_DB or "test" not in TEST_DB.rsplit("/", 1)[-1]:
    pytest.exit("Set TEST_DATABASE_URL to a database whose name contains 'test' (it gets wiped).", returncode=2)

os.environ["DATABASE_URL"] = TEST_DB
os.environ.setdefault("SECRET_KEY", "test-secret-key-test-secret-key-test-secret-key")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from src.core import registry  # noqa: E402,F401
from src.core.database import Base, SessionLocal, engine  # noqa: E402
from src.core.security import hash_password  # noqa: E402
from src.main import app  # noqa: E402
from src.modules.branches.models import Branch  # noqa: E402
from src.modules.users.models import User  # noqa: E402

PASSWORD = "secret-pass-1"
_HASH = hash_password(PASSWORD)  # hashed once; bcrypt is slow on purpose


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def data():
    """Fresh data for every test: 2 branches, 1 admin, 1 staff per branch."""
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users, branches, products, branch_product_prices, sales, sale_items, stock_movements RESTART IDENTITY CASCADE"))
    with SessionLocal() as db:
        b1, b2 = Branch(name="Branch 1"), Branch(name="Branch 2")
        db.add_all([b1, b2])
        db.flush()
        db.add_all([
            User(full_name="Owner", email="admin@test.com", password_hash=_HASH, role="admin"),
            User(full_name="Staff One", email="staff1@test.com", password_hash=_HASH, role="staff", branch_id=b1.id),
            User(full_name="Staff Two", email="staff2@test.com", password_hash=_HASH, role="staff", branch_id=b2.id),
        ])
        db.commit()


@pytest.fixture()
def client():
    return TestClient(app)


def login(client, email, password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def auth(client, email):
    token = login(client, email).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_h(client):
    return auth(client, "admin@test.com")


@pytest.fixture()
def staff1_h(client):
    return auth(client, "staff1@test.com")
