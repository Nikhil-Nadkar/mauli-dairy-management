from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

from sqlalchemy import func, select

from src.core.database import SessionLocal
from src.modules.stock.models import StockMovement
from src.modules.users.models import User
from tests.conftest import auth


def make_product(client, admin_h, name="Milk", unit="litre", **extra):
    r = client.post("/api/products", json={"name": name, "base_unit": unit, **extra}, headers=admin_h)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def receive(client, headers, items, branch_id=None):
    body = {"items": [{"product_id": pid, "quantity": str(q)} for pid, q in items]}
    if branch_id is not None:
        body["branch_id"] = branch_id
    return client.post("/api/stock/receive", json=body, headers=headers)


def adjust(client, headers, pid, change, reason="Spoiled", branch_id=None):
    body = {"product_id": pid, "quantity_change": str(change), "reason": reason}
    if branch_id is not None:
        body["branch_id"] = branch_id
    return client.post("/api/stock/adjust", json=body, headers=headers)


def rows(client, headers, branch_id=None):
    url = "/api/stock" + (f"?branch_id={branch_id}" if branch_id else "")
    r = client.get(url, headers=headers)
    assert r.status_code == 200, r.text
    return {x["name"]: x for x in r.json()}


def total_in_db(branch_id, product_id):
    with SessionLocal() as db:
        return db.scalar(select(func.coalesce(func.sum(StockMovement.quantity_change), 0)).where(
            StockMovement.branch_id == branch_id, StockMovement.product_id == product_id))


# ---------- receiving ----------
def test_receive_increases_stock_and_status_follows(client, admin_h, staff1_h):
    milk = make_product(client, admin_h)
    paneer = make_product(client, admin_h, "Paneer", "kg", low_stock_threshold="3")
    dahi = make_product(client, admin_h, "Dahi", "kg")
    r = receive(client, staff1_h, [(milk, 15), (paneer, 2)])
    assert r.status_code == 200 and len(r.json()) == 2
    s = rows(client, staff1_h)
    assert (s["Milk"]["available"], s["Milk"]["status"]) == ("15.000", "in_stock")
    assert (s["Paneer"]["available"], s["Paneer"]["status"]) == ("2.000", "low")        # 2 <= its limit of 3
    assert (s["Dahi"]["available"], s["Dahi"]["status"]) == ("0.000", "out_of_stock")
    receive(client, staff1_h, [(milk, "0.5")])
    assert rows(client, staff1_h)["Milk"]["available"] == "15.500"
    assert dahi


def test_receive_is_all_or_nothing_and_validated(client, admin_h, staff1_h):
    milk = make_product(client, admin_h)
    hidden = make_product(client, admin_h, "Chaas")
    client.patch(f"/api/products/{hidden}", json={"is_active": False}, headers=admin_h)
    assert receive(client, staff1_h, [(milk, 5), (999, 1)]).status_code == 404
    assert receive(client, staff1_h, [(milk, 5), (hidden, 1)]).status_code == 400
    for bad in (0, -3, "0.0001", 200000):
        assert receive(client, staff1_h, [(milk, bad)]).status_code == 422, bad
    assert receive(client, staff1_h, [(milk, 1), (milk, 2)]).status_code == 422          # same product twice
    assert client.post("/api/stock/receive", json={"items": []}, headers=staff1_h).status_code == 422
    assert total_in_db(1, milk) == 0                                                       # nothing was saved


# ---------- branch isolation ----------
def test_staff_cannot_touch_or_see_other_branch(client, admin_h, staff1_h):
    milk = make_product(client, admin_h)
    staff2_h = auth(client, "staff2@test.com")
    receive(client, staff1_h, [(milk, 10)])
    assert rows(client, staff2_h)["Milk"]["available"] == "0.000"                          # branch 2 sees its own (empty) stock
    assert client.get("/api/stock?branch_id=1", headers=staff2_h).status_code == 403
    assert client.get("/api/stock/movements?branch_id=1", headers=staff2_h).status_code == 403
    assert receive(client, staff2_h, [(milk, 5)], branch_id=1).status_code == 403
    assert adjust(client, staff2_h, milk, -1, branch_id=1).status_code == 403
    assert total_in_db(1, milk) == Decimal("10")
    assert total_in_db(2, milk) == 0
    assert client.get("/api/stock/movements", headers=staff2_h).json()["items"] == []     # history is scoped too


def test_admin_chooses_branch(client, admin_h):
    milk = make_product(client, admin_h)
    assert client.get("/api/stock", headers=admin_h).status_code == 400                    # must pick a branch
    assert receive(client, admin_h, [(milk, 8)]).status_code == 400
    assert receive(client, admin_h, [(milk, 8)], branch_id=2).status_code == 200
    assert rows(client, admin_h, 2)["Milk"]["available"] == "8.000"
    assert rows(client, admin_h, 1)["Milk"]["available"] == "0.000"


# ---------- corrections ----------
def test_adjust_needs_reason_and_cannot_go_negative(client, admin_h, staff1_h):
    milk = make_product(client, admin_h)
    receive(client, staff1_h, [(milk, 5)])
    for reason in ("", "  ", "ab"):
        assert adjust(client, staff1_h, milk, -1, reason=reason).status_code == 422
    assert client.post("/api/stock/adjust", json={"product_id": milk, "quantity_change": "-1"}, headers=staff1_h).status_code == 422
    assert adjust(client, staff1_h, milk, 0).status_code == 422
    r = adjust(client, staff1_h, milk, -6)
    assert r.status_code == 400 and "Only 5 L of Milk" in r.json()["detail"]
    assert total_in_db(1, milk) == 5
    r = adjust(client, staff1_h, milk, "-2.5", reason="Spoiled in fridge")
    assert r.status_code == 200 and r.json()["available"] == "2.500"
    assert adjust(client, staff1_h, milk, "1", reason="Counting mistake").json()["available"] == "3.500"
    assert adjust(client, staff1_h, 999, -1).status_code == 404


def test_last_litre_race_only_one_wins(client, admin_h, staff1_h, monkeypatch):
    """Two people remove 3 L from 5 L at the same moment: exactly one may succeed.

    Calls the service directly from two threads (own DB sessions) and sleeps right after the
    stock is read, so both would pass the check if lock_stock() did not make them queue up.
    (Verified: with the lock line removed, this test fails.)
    """
    import time
    from fastapi import HTTPException
    from src.modules.stock import services as stock_service
    from src.modules.stock.schemas import AdjustRequest

    milk = make_product(client, admin_h)
    receive(client, staff1_h, [(milk, 5)])

    real_available = stock_service.available_stock

    def slow_available(db, branch_id, product_id):
        value = real_available(db, branch_id, product_id)
        time.sleep(0.4)  # widen the window between "check" and "write"
        return value

    monkeypatch.setattr(stock_service, "available_stock", slow_available)

    def attempt(_):
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.email == "staff1@test.com"))
            data = AdjustRequest(product_id=milk, quantity_change=Decimal("-3"), reason="Spoiled")
            try:
                stock_service.adjust_stock(db, user, 1, data)
                return "ok"
            except HTTPException as e:
                return e.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, range(2)))
    assert sorted(results, key=str) == [400, "ok"]
    assert total_in_db(1, milk) == 2  # never negative


# ---------- the ledger ----------
def test_available_equals_received_minus_sold_plus_adjustments(client, admin_h, staff1_h):
    milk = make_product(client, admin_h)
    receive(client, staff1_h, [(milk, 10)])
    adjust(client, staff1_h, milk, -2)
    with SessionLocal() as db:
        staff = db.scalar(select(User).where(User.email == "staff1@test.com"))
        db.add(StockMovement(branch_id=1, product_id=milk, movement_type="sale", quantity_change=Decimal("-3"), user_id=staff.id))
        db.commit()
    assert rows(client, staff1_h)["Milk"]["available"] == "5.000"                          # 10 - 3 - 2


def test_hidden_product_listed_only_while_it_has_stock(client, admin_h, staff1_h):
    milk = make_product(client, admin_h)
    receive(client, staff1_h, [(milk, 4)])
    client.patch(f"/api/products/{milk}", json={"is_active": False}, headers=admin_h)
    s = rows(client, staff1_h)
    assert s["Milk"]["is_active"] is False and s["Milk"]["available"] == "4.000"
    adjust(client, staff1_h, milk, -4, reason="Thrown away")
    assert rows(client, staff1_h) == {}


# ---------- history ----------
def test_movement_history(client, admin_h, staff1_h):
    milk = make_product(client, admin_h)
    paneer = make_product(client, admin_h, "Paneer", "kg")
    receive(client, staff1_h, [(milk, 10), (paneer, 2)])
    adjust(client, staff1_h, milk, -1, reason="Spoiled")
    page = client.get("/api/stock/movements", headers=staff1_h).json()
    assert page["has_more"] is False and len(page["items"]) == 3
    newest = page["items"][0]
    assert (newest["movement_type"], newest["quantity_change"], newest["reason"], newest["user_name"]) == ("adjustment", "-1.000", "Spoiled", "Staff One")
    assert newest["branch_name"] == "Branch 1" and newest["product_name"] == "Milk"
    only_paneer = client.get(f"/api/stock/movements?product_id={paneer}", headers=staff1_h).json()["items"]
    assert [m["product_name"] for m in only_paneer] == ["Paneer"]
    p1 = client.get("/api/stock/movements?limit=2", headers=staff1_h).json()
    p2 = client.get("/api/stock/movements?limit=2&offset=2", headers=staff1_h).json()
    assert (len(p1["items"]), p1["has_more"], len(p2["items"]), p2["has_more"]) == (2, True, 1, False)
    receive(client, admin_h, [(milk, 1)], branch_id=2)
    assert len(client.get("/api/stock/movements", headers=admin_h).json()["items"]) == 4   # admin: both branches
    assert len(client.get("/api/stock/movements?branch_id=2", headers=admin_h).json()["items"]) == 1


# ---------- low-stock limit ----------
def test_low_stock_threshold_is_configurable(client, admin_h, staff1_h):
    milk = make_product(client, admin_h)
    assert client.get("/api/products", headers=admin_h).json()[0]["low_stock_threshold"] == "5.000"
    receive(client, staff1_h, [(milk, 8)])
    assert rows(client, staff1_h)["Milk"]["status"] == "in_stock"
    assert client.patch(f"/api/products/{milk}", json={"low_stock_threshold": "10"}, headers=admin_h).status_code == 200
    assert rows(client, staff1_h)["Milk"]["status"] == "low"
    assert client.patch(f"/api/products/{milk}", json={"low_stock_threshold": "-1"}, headers=admin_h).status_code == 422
