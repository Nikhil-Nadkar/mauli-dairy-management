from decimal import Decimal

from sqlalchemy import select

from src.core.database import SessionLocal
from src.modules.sales.models import Sale, SaleItem
from src.modules.stock.models import StockMovement
from src.modules.users.models import User
from tests.conftest import auth

MILK = {
    "name": "Milk",
    "base_unit": "litre",
    "quick_quantities": [{"label": "250 ml", "quantity": "0.25"}, {"label": "1 litre", "quantity": "1"}],
}


def make_product(client, admin_h, **overrides):
    r = client.post("/api/products", json={**MILK, **overrides}, headers=admin_h)
    assert r.status_code == 201, r.text
    return r.json()


def set_prices(client, admin_h, pid, b1=("60", "45"), b2=("65", "48")):
    body = {"prices": [
        {"branch_id": 1, "selling_price": b1[0], "cost_price": b1[1]},
        {"branch_id": 2, "selling_price": b2[0], "cost_price": b2[1]},
    ]}
    r = client.put(f"/api/prices/{pid}", json=body, headers=admin_h)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- products ----------
def test_create_product_normalises_quantities(client, admin_h):
    p = make_product(client, admin_h)
    assert p["quick_quantities"][0] == {"label": "250 ml", "quantity": "0.250"}
    assert p["is_active"] is True and p["prices"] == []


def test_duplicate_names_rejected_ignoring_case_and_spaces(client, admin_h):
    make_product(client, admin_h, name="Shrikhand", base_unit="kg")
    for name in ("shrikhand", "SHRIKHAND", "  Shrikhand "):
        assert client.post("/api/products", json={**MILK, "name": name}, headers=admin_h).status_code == 409
    other = make_product(client, admin_h, name="Lassi")
    r = client.patch(f"/api/products/{other['id']}", json={"name": "shrikhand"}, headers=admin_h)
    assert r.status_code == 409


def test_quick_quantity_validation(client, admin_h):
    bad = [
        [{"label": "zero", "quantity": "0"}],
        [{"label": "tiny", "quantity": "0.0001"}],     # more than 3 decimals
        [{"label": " ", "quantity": "1"}],
        [{"label": f"b{i}", "quantity": "1"} for i in range(9)],  # too many buttons
    ]
    for q in bad:
        r = client.post("/api/products", json={**MILK, "quick_quantities": q}, headers=admin_h)
        assert r.status_code == 422, q
        assert isinstance(r.json()["detail"], str)


def test_edit_name_buttons_and_active_flag(client, admin_h):
    p = make_product(client, admin_h)
    r = client.patch(f"/api/products/{p['id']}", headers=admin_h, json={
        "name": "Full Cream Milk", "is_active": False,
        "quick_quantities": [{"label": "2 litres", "quantity": "2"}],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Full Cream Milk" and body["is_active"] is False
    assert [q["label"] for q in body["quick_quantities"]] == ["2 litres"]


def test_unit_locked_once_stock_exists(client, admin_h):
    p = make_product(client, admin_h)
    assert client.patch(f"/api/products/{p['id']}", json={"base_unit": "kg"}, headers=admin_h).status_code == 200
    with SessionLocal() as db:
        staff = db.scalar(select(User).where(User.email == "staff1@test.com"))
        db.add(StockMovement(branch_id=1, product_id=p["id"], movement_type="received", quantity_change=Decimal("5"), user_id=staff.id))
        db.commit()
    r = client.patch(f"/api/products/{p['id']}", json={"base_unit": "litre"}, headers=admin_h)
    assert r.status_code == 400 and "cannot be changed" in r.json()["detail"]


def test_staff_cannot_manage_products_or_prices(client, staff1_h):
    assert client.get("/api/products", headers=staff1_h).status_code == 403
    assert client.post("/api/products", json=MILK, headers=staff1_h).status_code == 403
    assert client.patch("/api/products/1", json={"is_active": False}, headers=staff1_h).status_code == 403
    body = {"prices": [{"branch_id": 1, "selling_price": "1", "cost_price": "1"}]}
    assert client.put("/api/prices/1", json=body, headers=staff1_h).status_code == 403


# ---------- prices ----------
def test_set_and_change_prices_per_branch(client, admin_h):
    p = make_product(client, admin_h)
    out = set_prices(client, admin_h, p["id"])
    assert {x["branch_id"]: (x["selling_price"], x["cost_price"]) for x in out["prices"]} == {1: ("60.00", "45.00"), 2: ("65.00", "48.00")}
    out = set_prices(client, admin_h, p["id"], b1=("62.50", "46"))
    assert len(out["prices"]) == 2  # updated in place, no duplicate rows
    assert out["prices"][0]["selling_price"] == "62.50"


def test_price_validation(client, admin_h):
    p = make_product(client, admin_h)
    def put(price):
        return client.put(f"/api/prices/{p['id']}", json={"prices": [price]}, headers=admin_h)
    assert put({"branch_id": 1, "selling_price": "-5", "cost_price": "1"}).status_code == 422
    assert put({"branch_id": 1, "selling_price": "0", "cost_price": "1"}).status_code == 422
    assert put({"branch_id": 1, "selling_price": "10", "cost_price": "-1"}).status_code == 422
    assert put({"branch_id": 1, "selling_price": "10.123", "cost_price": "1"}).status_code == 422
    assert put({"branch_id": 9, "selling_price": "10", "cost_price": "1"}).status_code == 400
    dup = {"prices": [{"branch_id": 1, "selling_price": "1", "cost_price": "1"}] * 2}
    assert client.put(f"/api/prices/{p['id']}", json=dup, headers=admin_h).status_code == 422
    assert client.put("/api/prices/999", json={"prices": [{"branch_id": 1, "selling_price": "1", "cost_price": "1"}]}, headers=admin_h).status_code == 404


def test_price_change_does_not_touch_old_sales(client, admin_h):
    p = make_product(client, admin_h)
    set_prices(client, admin_h, p["id"])
    with SessionLocal() as db:
        staff = db.scalar(select(User).where(User.email == "staff1@test.com"))
        sale = Sale(branch_id=1, user_id=staff.id, total_amount=Decimal("60"), total_cost=Decimal("45"), profit=Decimal("15"))
        sale.items.append(SaleItem(product_id=p["id"], quantity=Decimal("1"), selling_price=Decimal("60"), cost_price=Decimal("45"),
                                   item_total=Decimal("60"), item_cost=Decimal("45")))
        db.add(sale)
        db.commit()
        sale_id = sale.id
    set_prices(client, admin_h, p["id"], b1=("99", "80"))
    with SessionLocal() as db:
        item = db.scalar(select(SaleItem).where(SaleItem.sale_id == sale_id))
        assert (item.selling_price, item.cost_price) == (Decimal("60.00"), Decimal("45.00"))


# ---------- catalog (what staff see) ----------
def test_catalog_uses_own_branch_price_and_hides_cost(client, admin_h, staff1_h):
    p = make_product(client, admin_h)
    set_prices(client, admin_h, p["id"])
    items = client.get("/api/products/catalog", headers=staff1_h).json()
    assert len(items) == 1 and items[0]["selling_price"] == "60.00"
    assert "cost_price" not in items[0] and "prices" not in items[0]
    staff2_h = auth(client, "staff2@test.com")
    assert client.get("/api/products/catalog", headers=staff2_h).json()[0]["selling_price"] == "65.00"


def test_catalog_blocks_other_branch_and_hides_inactive(client, admin_h, staff1_h):
    p = make_product(client, admin_h)
    set_prices(client, admin_h, p["id"])
    assert client.get("/api/products/catalog?branch_id=2", headers=staff1_h).status_code == 403   # tampering
    assert client.get("/api/products/catalog?branch_id=1", headers=staff1_h).status_code == 200
    client.patch(f"/api/products/{p['id']}", json={"is_active": False}, headers=admin_h)
    assert client.get("/api/products/catalog", headers=staff1_h).json() == []


def test_catalog_admin_must_pick_branch_and_unset_price_is_null(client, admin_h):
    make_product(client, admin_h)
    assert client.get("/api/products/catalog", headers=admin_h).status_code == 400
    items = client.get("/api/products/catalog?branch_id=2", headers=admin_h).json()
    assert items[0]["selling_price"] is None
