"""Small helpers shared by the sales and reports tests."""
from tests.conftest import auth  # noqa: F401


def make_product(client, admin_h, name="Milk", unit="litre", **extra):
    r = client.post("/api/products", json={"name": name, "base_unit": unit, **extra}, headers=admin_h)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def set_prices(client, admin_h, pid, b1=("60", "45"), b2=("65", "48")):
    body = {"prices": [
        {"branch_id": 1, "selling_price": b1[0], "cost_price": b1[1]},
        {"branch_id": 2, "selling_price": b2[0], "cost_price": b2[1]},
    ]}
    r = client.put(f"/api/prices/{pid}", json=body, headers=admin_h)
    assert r.status_code == 200, r.text


def receive(client, headers, items, branch_id=None):
    body = {"items": [{"product_id": pid, "quantity": str(q)} for pid, q in items]}
    if branch_id is not None:
        body["branch_id"] = branch_id
    r = client.post("/api/stock/receive", json=body, headers=headers)
    assert r.status_code == 200, r.text


def sell(client, headers, items, branch_id=None):
    body = {"items": [{"product_id": pid, "quantity": str(q)} for pid, q in items]}
    if branch_id is not None:
        body["branch_id"] = branch_id
    return client.post("/api/sales", json=body, headers=headers)


def stock_of(client, headers, name, branch_id=None):
    url = "/api/stock" + (f"?branch_id={branch_id}" if branch_id else "")
    return {r["name"]: r["available"] for r in client.get(url, headers=headers).json()}.get(name)


def setup_shop(client, admin_h):
    """Milk (litre), Paneer + Dahi (kg), priced in both branches, 20 / 5 / 5 in stock in BOTH branches."""
    milk = make_product(client, admin_h, "Milk", "litre")
    paneer = make_product(client, admin_h, "Paneer", "kg")
    dahi = make_product(client, admin_h, "Dahi", "kg")
    set_prices(client, admin_h, milk, ("60", "45"), ("65", "48"))
    set_prices(client, admin_h, paneer, ("360", "300"), ("380", "310"))
    set_prices(client, admin_h, dahi, ("100", "70"), ("110", "75"))
    for branch in (1, 2):
        receive(client, admin_h, [(milk, 20), (paneer, 5), (dahi, 5)], branch_id=branch)
    return milk, paneer, dahi
