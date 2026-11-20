from datetime import date, datetime, time, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import text

from src.core.dates import business_tz, months_ago, today_local
from src.core.database import engine
from tests.helpers import auth, make_product, receive, sell, set_prices, setup_shop


def move_sale(sale_id, when):
    with engine.begin() as conn:
        conn.execute(text("UPDATE sales SET created_at = :t WHERE id = :i"), {"t": when, "i": sale_id})


def local(day: date, hh=12, mm=0):
    return datetime.combine(day, time(hh, mm), tzinfo=business_tz())


def summary(client, headers, **params):
    r = client.get("/api/reports/summary", params=params, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def shop(client, admin_h):
    return setup_shop(client, admin_h)


def test_totals_product_branch_and_profit(client, admin_h, staff1_h, shop):
    milk, paneer, dahi = shop
    staff2_h = auth(client, "staff2@test.com")
    sell(client, staff1_h, [(milk, "1"), (paneer, "0.5")])                # 60+180 = 240 | cost 45+150 = 195
    sell(client, staff1_h, [(milk, "2")])                                  # 120 | cost 90
    sell(client, staff2_h, [(milk, "1"), (dahi, "0.25")])                  # 65+27.5 = 92.50 | cost 48+18.75 = 66.75

    s = summary(client, admin_h)                                           # combined, today
    t = s["totals"]
    assert (t["total_sales"], t["total_cost"], t["gross_profit"]) == ("452.50", "351.75", "100.75")
    assert Decimal(t["gross_profit"]) == Decimal(t["total_sales"]) - Decimal(t["total_cost"])
    assert (t["sales_count"], t["items_sold"]) == (3, 5)
    assert s["branch_id"] is None

    by_name = {p["name"]: p for p in s["products"]}
    assert (by_name["Milk"]["quantity"], by_name["Milk"]["sales"], by_name["Milk"]["profit"]) == ("4.000", "245.00", "62.00")
    assert by_name["Paneer"]["sales"] == "180.00" and by_name["Dahi"]["quantity"] == "0.250"
    assert [p["name"] for p in s["products"]][0] == "Milk"                  # biggest seller first

    b = {x["name"]: x for x in s["branches"]}
    assert (b["Branch 1"]["sales"], b["Branch 1"]["sales_count"]) == ("360.00", 2)
    assert (b["Branch 2"]["sales"], b["Branch 2"]["profit"]) == ("92.50", "25.75")

    only2 = summary(client, admin_h, branch_id=2)
    assert only2["totals"]["total_sales"] == "92.50" and [x["name"] for x in only2["branches"]] == ["Branch 2"]
    assert len(only2["products"]) == 2


def test_profit_uses_prices_at_time_of_sale(client, admin_h, staff1_h, shop):
    milk, *_ = shop
    sell(client, staff1_h, [(milk, "1")])                                  # profit 15
    set_prices(client, admin_h, milk, ("100", "90"), ("65", "48"))         # new price -> profit 10
    sell(client, staff1_h, [(milk, "1")])
    t = summary(client, admin_h, branch_id=1)["totals"]
    assert (t["total_sales"], t["total_cost"], t["gross_profit"]) == ("160.00", "135.00", "25.00")


def test_date_ranges_and_zero_filled_daily_series(client, admin_h, staff1_h, shop):
    milk, *_ = shop
    today = today_local()
    ids = [sell(client, staff1_h, [(milk, "1")]).json()["id"] for _ in range(4)]
    move_sale(ids[1], local(today - timedelta(days=3)))
    move_sale(ids[2], local(today - timedelta(days=10)))
    move_sale(ids[3], local(today - timedelta(days=60)))

    assert summary(client, admin_h, range="today")["totals"]["sales_count"] == 1
    s7 = summary(client, admin_h, range="7d")
    assert s7["totals"]["sales_count"] == 2 and len(s7["daily"]) == 7
    assert (s7["date_from"], s7["date_to"]) == (str(today - timedelta(days=6)), str(today))
    assert summary(client, admin_h, range="21d")["totals"]["sales_count"] == 3
    assert summary(client, admin_h, range="3m")["totals"]["sales_count"] == 4
    days = {d["date"]: d for d in s7["daily"]}
    assert days[str(today)]["sales"] == "60.00" and days[str(today - timedelta(days=1))]["sales"] == "0.00"
    assert days[str(today - timedelta(days=3))]["sales_count"] == 1

    custom = summary(client, admin_h, range="custom", date_from=str(today - timedelta(days=12)), date_to=str(today - timedelta(days=9)))
    assert custom["totals"]["sales_count"] == 1 and len(custom["daily"]) == 4


def test_days_are_split_at_local_midnight_not_utc(client, admin_h, staff1_h, shop):
    milk, *_ = shop
    today = today_local()
    just_after = sell(client, staff1_h, [(milk, "1")]).json()["id"]
    just_before = sell(client, staff1_h, [(milk, "1")]).json()["id"]
    move_sale(just_after, local(today, 0, 5))                              # 00:05 today (still yesterday in UTC)
    move_sale(just_before, local(today - timedelta(days=1), 23, 55))       # 23:55 yesterday
    s = summary(client, admin_h, range="7d")
    days = {d["date"]: d["sales_count"] for d in s["daily"]}
    assert days[str(today)] == 1 and days[str(today - timedelta(days=1))] == 1
    assert summary(client, admin_h, range="today")["totals"]["sales_count"] == 1


def test_custom_range_validation(client, admin_h):
    def get(**p):
        return client.get("/api/reports/summary", params={"range": "custom", **p}, headers=admin_h)
    assert get().status_code == 400
    assert get(date_from="2026-01-01").status_code == 400
    assert get(date_from="2026-02-01", date_to="2026-01-01").status_code == 400
    assert get(date_from="2024-01-01", date_to="2026-01-01").status_code == 400      # longer than a year
    assert get(date_from="2026-01-01", date_to="not-a-date").status_code == 422
    assert client.get("/api/reports/summary?range=yesterday", headers=admin_h).status_code == 422
    assert client.get("/api/reports/summary?branch_id=99", headers=admin_h).status_code == 404
    assert get(date_from="2026-01-01", date_to="2026-01-01").status_code == 200


def test_empty_period_is_all_zeros(client, admin_h):
    s = summary(client, admin_h, range="7d")
    assert s["totals"] == {"total_sales": "0.00", "total_cost": "0.00", "gross_profit": "0.00", "sales_count": 0, "items_sold": 0}
    assert s["products"] == [] and len(s["branches"]) == 2 and len(s["daily"]) == 7


def test_reports_are_owner_only(client, staff1_h):
    assert client.get("/api/reports/summary", headers=staff1_h).status_code == 403
    assert client.get("/api/reports/summary?branch_id=2", headers=staff1_h).status_code == 403
    assert client.get("/api/reports/low-stock", headers=staff1_h).status_code == 403
    assert client.get("/api/reports/summary").status_code == 401


def test_low_stock_list(client, admin_h, staff1_h):
    milk = make_product(client, admin_h, "Milk")
    paneer = make_product(client, admin_h, "Paneer", "kg")
    make_product(client, admin_h, "Dahi", "kg")
    set_prices(client, admin_h, milk)
    receive(client, admin_h, [(milk, 3), (paneer, 50)], branch_id=1)       # milk low (<=5), paneer fine, dahi empty
    receive(client, admin_h, [(milk, 50), (paneer, 2)], branch_id=2)
    rows = client.get("/api/reports/low-stock", headers=admin_h).json()
    got = {(r["branch_name"], r["name"]): r["status"] for r in rows}
    assert got == {
        ("Branch 1", "Milk"): "low", ("Branch 1", "Dahi"): "out_of_stock",
        ("Branch 2", "Paneer"): "low", ("Branch 2", "Dahi"): "out_of_stock",
    }
    only1 = client.get("/api/reports/low-stock?branch_id=1", headers=admin_h).json()
    assert {r["branch_name"] for r in only1} == {"Branch 1"}


@pytest.mark.parametrize("today,months,expected", [
    (date(2026, 11, 1), 3, date(2026, 8, 1)),
    (date(2026, 5, 31), 3, date(2026, 2, 28)),      # month is shorter -> clamp
    (date(2024, 5, 31), 3, date(2024, 2, 29)),      # leap year
    (date(2026, 1, 15), 3, date(2025, 10, 15)),     # crosses a year
])
def test_months_ago(today, months, expected):
    assert months_ago(today, months) == expected
