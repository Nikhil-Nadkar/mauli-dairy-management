import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from src.core.database import SessionLocal
from src.main import app
from src.modules.sales.models import Sale, SaleItem
from src.modules.stock.models import StockMovement
from src.modules.users.models import User
from tests.helpers import auth, make_product, receive, sell, set_prices, setup_shop, stock_of


def count(model):
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(model))


def test_multi_product_sale_totals_stock_and_snapshots(client, admin_h, staff1_h):
    milk, paneer, dahi = setup_shop(client, admin_h)
    r = sell(client, staff1_h, [(milk, "1"), (paneer, "0.5"), (dahi, "0.25")])
    assert r.status_code == 201, r.text
    sale = r.json()
    # 1 L x 60 + 0.5 kg x 360 + 0.25 kg x 100 = 60 + 180 + 25
    assert sale["total_amount"] == "265.00" and sale["branch_name"] == "Branch 1"
    assert [i["item_total"] for i in sale["items"]] == ["60.00", "180.00", "25.00"]
    assert "cost" not in r.text and "profit" not in r.text            # staff never see cost / profit
    assert stock_of(client, staff1_h, "Milk") == "19.000"
    assert stock_of(client, staff1_h, "Paneer") == "4.500"
    assert stock_of(client, admin_h, "Milk", 2) == "20.000"            # other branch untouched

    page = client.get("/api/sales", headers=admin_h).json()
    admin_sale = page["items"][0]
    assert admin_sale["total_cost"] == "212.50" and admin_sale["profit"] == "52.50"   # cost 45 + 150 + 17.5
    assert admin_sale["user_name"] == "Staff One"
    with SessionLocal() as db:
        moves = db.scalars(select(StockMovement).where(StockMovement.sale_id == sale["id"])).all()
        assert len(moves) == 3 and all(m.movement_type == "sale" and m.quantity_change < 0 for m in moves)


def test_price_change_affects_only_new_sales(client, admin_h, staff1_h):
    milk, *_ = setup_shop(client, admin_h)
    first = sell(client, staff1_h, [(milk, 1)]).json()
    set_prices(client, admin_h, milk, ("99", "80"), ("65", "48"))
    second = sell(client, staff1_h, [(milk, 1)]).json()
    assert first["total_amount"] == "60.00" and second["total_amount"] == "99.00"
    old = next(s for s in client.get("/api/sales", headers=admin_h).json()["items"] if s["id"] == first["id"])
    assert (old["total_amount"], old["profit"], old["items"][0]["selling_price"], old["items"][0]["cost_price"]) == ("60.00", "15.00", "60.00", "45.00")


def test_insufficient_stock_blocks_whole_sale(client, admin_h, staff1_h):
    milk, paneer, dahi = setup_shop(client, admin_h)
    r = sell(client, staff1_h, [(milk, 2), (paneer, 6)])               # only 5 kg paneer
    assert r.status_code == 400 and "Not enough Paneer. Only 5 kg left." in r.json()["detail"]
    assert stock_of(client, staff1_h, "Milk") == "20.000"              # milk NOT deducted either
    assert count(Sale) == 0 and count(SaleItem) == 0


def test_out_of_stock_and_exact_stock(client, admin_h, staff1_h):
    milk, paneer, dahi = setup_shop(client, admin_h)
    assert sell(client, staff1_h, [(paneer, 5)]).status_code == 201     # exactly what is left
    assert stock_of(client, staff1_h, "Paneer") == "0.000"
    r = sell(client, staff1_h, [(paneer, "0.1")])
    assert r.status_code == 400 and r.json()["detail"] == "Paneer is OUT OF STOCK."


def test_price_missing_inactive_and_validation(client, admin_h, staff1_h):
    milk, paneer, _ = setup_shop(client, admin_h)
    unpriced = make_product(client, admin_h, "Lassi")
    receive(client, admin_h, [(unpriced, 5)], branch_id=1)
    r = sell(client, staff1_h, [(unpriced, 1)])
    assert r.status_code == 400 and "price of Lassi is not set" in r.json()["detail"]
    client.patch(f"/api/products/{paneer}", json={"is_active": False}, headers=admin_h)
    assert sell(client, staff1_h, [(paneer, 1)]).status_code == 400
    for bad in (0, -1, "0.0001", 100001):
        assert sell(client, staff1_h, [(milk, bad)]).status_code == 422, bad
    assert client.post("/api/sales", json={"items": []}, headers=staff1_h).status_code == 422
    assert sell(client, staff1_h, [(999, 1)]).status_code == 404
    assert count(Sale) == 0


def test_duplicate_lines_are_merged(client, admin_h, staff1_h):
    milk, *_ = setup_shop(client, admin_h)
    r = sell(client, staff1_h, [(milk, "1"), (milk, "0.5")])
    assert r.status_code == 201
    assert len(r.json()["items"]) == 1 and r.json()["items"][0]["quantity"] == "1.500"
    assert r.json()["total_amount"] == "90.00"


def test_rounding_lines_add_up_to_the_total(client, admin_h, staff1_h):
    milk = make_product(client, admin_h, "Milk")
    paneer = make_product(client, admin_h, "Paneer", "kg")
    set_prices(client, admin_h, milk, ("10.55", "7.33"))
    set_prices(client, admin_h, paneer, ("33.33", "20.01"))
    receive(client, admin_h, [(milk, 50), (paneer, 50)], branch_id=1)
    sale = sell(client, staff1_h, [(milk, "0.333"), (paneer, "0.125")]).json()
    # 0.333 x 10.55 = 3.51315 -> 3.51 ; 0.125 x 33.33 = 4.16625 -> 4.17
    assert [i["item_total"] for i in sale["items"]] == ["3.51", "4.17"]
    assert sale["total_amount"] == "7.68"


# ---------- branch security ----------
def test_staff_cannot_sell_into_another_branch(client, admin_h, staff1_h):
    milk, *_ = setup_shop(client, admin_h)
    assert sell(client, staff1_h, [(milk, 1)], branch_id=2).status_code == 403
    assert stock_of(client, admin_h, "Milk", 2) == "20.000"
    staff2_h = auth(client, "staff2@test.com")
    r = sell(client, staff2_h, [(milk, 1)])
    assert r.status_code == 201 and r.json()["total_amount"] == "65.00" and r.json()["branch_name"] == "Branch 2"  # branch-2 price
    assert stock_of(client, admin_h, "Milk", 1) == "20.000"


def test_admin_must_choose_branch_and_staff_cannot_read_sales(client, admin_h, staff1_h):
    milk, *_ = setup_shop(client, admin_h)
    assert sell(client, admin_h, [(milk, 1)]).status_code == 400
    assert sell(client, admin_h, [(milk, 1)], branch_id=2).status_code == 201
    assert client.get("/api/sales", headers=staff1_h).status_code == 403
    assert len(client.get("/api/sales?branch_id=1", headers=admin_h).json()["items"]) == 0
    assert len(client.get("/api/sales?branch_id=2", headers=admin_h).json()["items"]) == 1
    assert client.get("/api/sales?date_from=2026-01-01", headers=admin_h).status_code == 400


# ---------- all-or-nothing and concurrency ----------
def test_failure_midway_saves_nothing(client, admin_h, staff1_h, monkeypatch):
    milk, *_ = setup_shop(client, admin_h)
    from src.modules.sales import services

    def boom(*args, **kwargs):
        raise RuntimeError("disk exploded")

    monkeypatch.setattr(services, "StockMovement", boom)               # fails after sale rows were flushed
    quiet = TestClient(app, raise_server_exceptions=False)
    r = quiet.post("/api/sales", json={"items": [{"product_id": milk, "quantity": "1"}]}, headers=staff1_h)
    assert r.status_code == 500 and r.json() == {"detail": "Something went wrong. Please try again."}
    monkeypatch.undo()
    assert count(Sale) == 0 and count(SaleItem) == 0
    assert stock_of(client, staff1_h, "Milk") == "20.000"


def test_two_cashiers_selling_the_last_stock_only_one_wins(client, admin_h, staff1_h, monkeypatch):
    """Both sell 3 of 5 L at the same moment. The sleep widens the window between 'check' and 'save';
    without lock_stock() both would succeed and stock would go to -1."""
    from src.modules.sales import services

    milk = make_product(client, admin_h)
    set_prices(client, admin_h, milk)
    receive(client, admin_h, [(milk, 5)], branch_id=1)
    real = services.available_stock

    def slow(db, branch_id, product_id):
        value = real(db, branch_id, product_id)
        time.sleep(0.4)
        return value

    monkeypatch.setattr(services, "available_stock", slow)

    def attempt(_):
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.email == "staff1@test.com"))
            from src.modules.sales.schemas import SaleCreate, SaleItemIn
            try:
                services.create_sale(db, user, 1, SaleCreate(items=[SaleItemIn(product_id=milk, quantity=Decimal("3"))]))
                return "ok"
            except HTTPException as e:
                return e.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, range(2)))
    assert sorted(results, key=str) == [400, "ok"]
    with SessionLocal() as db:
        total = db.scalar(select(func.sum(StockMovement.quantity_change)).where(StockMovement.product_id == milk))
    assert total == Decimal("2")
    assert count(Sale) == 1


# ---------------------------------------------------------------- undo


def _undo(client, headers, sale_id):
    return client.post(f"/api/sales/{sale_id}/undo", headers=headers)


def test_undo_puts_stock_back_and_removes_sale_from_reports(client, admin_h, staff1_h):
    milk, paneer, _ = setup_shop(client, admin_h)
    sale = sell(client, staff1_h, [(milk, 2), (paneer, "0.5")]).json()
    assert stock_of(client, staff1_h, "Milk") == "18.000"

    r = _undo(client, staff1_h, sale["id"])
    assert r.status_code == 200, r.text
    assert stock_of(client, staff1_h, "Milk") == "20.000"
    assert stock_of(client, staff1_h, "Paneer") == "5.000"
    assert count(Sale) == 0 and count(SaleItem) == 0
    totals = client.get("/api/reports/summary", params={"range": "today"}, headers=admin_h).json()["totals"]
    assert totals["total_sales"] == "0.00" and totals["sales_count"] == 0
    assert _undo(client, staff1_h, sale["id"]).status_code == 404       # cannot undo twice


def test_staff_can_only_undo_their_own_sales(client, admin_h, staff1_h):
    milk, *_ = setup_shop(client, admin_h)
    staff2_h = auth(client, "staff2@test.com")
    r = client.post("/api/users", json={"full_name": "Staff Three", "email": "staff3@test.com",
                                         "password": "secret-pass-1", "role": "staff", "branch_id": 1}, headers=admin_h)
    assert r.status_code == 201, r.text
    staff3_h = auth(client, "staff3@test.com")

    sale = sell(client, staff1_h, [(milk, 1)]).json()
    assert _undo(client, staff2_h, sale["id"]).status_code == 404      # other branch: not even visible
    assert _undo(client, staff3_h, sale["id"]).status_code == 403      # same branch, someone else's sale
    assert _undo(client, admin_h, sale["id"]).status_code == 200       # the owner may undo any sale


def test_old_sales_cannot_be_undone(client, admin_h, staff1_h):
    milk, *_ = setup_shop(client, admin_h)
    sale = sell(client, staff1_h, [(milk, 1)]).json()
    with SessionLocal() as db:
        db.get(Sale, sale["id"]).created_at -= timedelta(minutes=6)
        db.commit()
    r = _undo(client, staff1_h, sale["id"])
    assert r.status_code == 400 and "cannot be undone" in r.json()["detail"]
    assert stock_of(client, staff1_h, "Milk") == "19.000"
