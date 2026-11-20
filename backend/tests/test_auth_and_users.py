import pytest
from fastapi import HTTPException

from src.core.database import SessionLocal
from src.modules.auth.dependencies import branch_filter, resolve_branch_id
from src.modules.users.models import User
from tests.conftest import PASSWORD, auth, login


# ---------- login ----------
def test_login_ok_and_no_password_hash_leaked(client):
    r = login(client, "Admin@Test.com")  # email is case-insensitive
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer" and body["user"]["role"] == "admin"
    assert "password" not in r.text and "hash" not in r.text


def test_wrong_password_and_unknown_email_give_same_message(client):
    a = login(client, "admin@test.com", "wrong-password")
    b = login(client, "nobody@test.com", "wrong-password")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json() == {"detail": "Incorrect email or password."}


def test_protected_routes_need_a_valid_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert client.get("/api/auth/me", headers=auth(client, "staff1@test.com")).json()["email"] == "staff1@test.com"


def test_deactivated_user_is_locked_out_immediately(client, admin_h, staff1_h):
    staff_id = client.get("/api/auth/me", headers=staff1_h).json()["id"]
    assert client.patch(f"/api/users/{staff_id}", json={"is_active": False}, headers=admin_h).status_code == 200
    assert client.get("/api/auth/me", headers=staff1_h).status_code == 401  # old token dead
    assert login(client, "staff1@test.com").status_code == 403              # cannot log in again


# ---------- admin-only user management ----------
def test_staff_cannot_manage_users(client, staff1_h):
    assert client.get("/api/users", headers=staff1_h).status_code == 403
    r = client.post("/api/users", headers=staff1_h, json={"full_name": "X", "email": "x@test.com", "password": "longenough1", "branch_id": 1})
    assert r.status_code == 403
    assert client.patch("/api/users/1", headers=staff1_h, json={"is_active": False}).status_code == 403
    assert client.post("/api/users/1/reset-password", headers=staff1_h, json={"new_password": "longenough1"}).status_code == 403


def test_admin_creates_staff(client, admin_h):
    r = client.post("/api/users", headers=admin_h, json={"full_name": " New Girl ", "email": "New@Test.com", "password": "longenough1", "branch_id": 2})
    assert r.status_code == 201
    u = r.json()
    assert u["email"] == "new@test.com" and u["full_name"] == "New Girl" and u["role"] == "staff"
    assert u["branch"]["name"] == "Branch 2"
    assert login(client, "new@test.com", "longenough1").status_code == 200


@pytest.mark.parametrize("payload,status", [
    ({"full_name": "A", "email": "staff1@test.com", "password": "longenough1", "branch_id": 1}, 409),  # duplicate email
    ({"full_name": "A", "email": "a@test.com", "password": "longenough1"}, 422),                       # staff, no branch
    ({"full_name": "A", "email": "a@test.com", "password": "short", "branch_id": 1}, 422),             # short password
    ({"full_name": "A", "email": "not-an-email", "password": "longenough1", "branch_id": 1}, 422),
    ({"full_name": "A", "email": "a@test.com", "password": "longenough1", "branch_id": 99}, 400),      # no such branch
])
def test_create_user_validation(client, admin_h, payload, status):
    r = client.post("/api/users", headers=admin_h, json=payload)
    assert r.status_code == status
    assert isinstance(r.json()["detail"], str)  # always a plain sentence


def test_change_branch_and_admin_cannot_lock_self_out(client, admin_h):
    users = {u["email"]: u for u in client.get("/api/users", headers=admin_h).json()}
    s1, me = users["staff1@test.com"], users["admin@test.com"]
    r = client.patch(f"/api/users/{s1['id']}", json={"branch_id": 2}, headers=admin_h)
    assert r.json()["branch"]["name"] == "Branch 2"
    assert client.patch(f"/api/users/{me['id']}", json={"is_active": False}, headers=admin_h).status_code == 400
    assert client.patch(f"/api/users/{me['id']}", json={"role": "staff", "branch_id": 1}, headers=admin_h).status_code == 400
    assert client.patch(f"/api/users/{s1['id']}", json={"branch_id": None}, headers=admin_h).status_code == 400  # staff need a branch


def test_reset_password(client, admin_h):
    uid = client.get("/api/users", headers=admin_h).json()[0]["id"]
    email = next(u["email"] for u in client.get("/api/users", headers=admin_h).json() if u["id"] == uid)
    assert client.post(f"/api/users/{uid}/reset-password", json={"new_password": "brand-new-pass"}, headers=admin_h).status_code == 200
    assert login(client, email, PASSWORD).status_code == 401
    assert login(client, email, "brand-new-pass").status_code == 200


# ---------- branch permissions ----------
def test_branch_list_is_scoped(client, admin_h, staff1_h):
    assert [b["name"] for b in client.get("/api/branches", headers=admin_h).json()] == ["Branch 1", "Branch 2"]
    assert [b["name"] for b in client.get("/api/branches", headers=staff1_h).json()] == ["Branch 1"]


def _user(email):
    with SessionLocal() as db:
        return db.query(User).filter_by(email=email).one()


def test_resolve_branch_id_blocks_cross_branch_access():
    staff1, admin = _user("staff1@test.com"), _user("admin@test.com")
    with SessionLocal() as db:
        assert resolve_branch_id(db, staff1, None) == staff1.branch_id         # defaults to own branch
        assert resolve_branch_id(db, staff1, staff1.branch_id) == staff1.branch_id
        with pytest.raises(HTTPException) as e:
            resolve_branch_id(db, staff1, 2)                                   # tampered request
        assert e.value.status_code == 403
        with pytest.raises(HTTPException) as e:
            branch_filter(db, staff1, 2)
        assert e.value.status_code == 403
        assert branch_filter(db, staff1, None) == staff1.branch_id            # staff can never get "all"
        assert branch_filter(db, admin, None) is None                          # admin: combined view
        assert branch_filter(db, admin, 2) == 2
        assert resolve_branch_id(db, admin, 2) == 2
        with pytest.raises(HTTPException) as e:
            resolve_branch_id(db, admin, None)
        assert e.value.status_code == 400
        with pytest.raises(HTTPException) as e:
            resolve_branch_id(db, admin, 99)
        assert e.value.status_code == 404
