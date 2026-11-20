"""shop-style quick buttons (Pav kilo, Half litre, 200 g, ...)

Data only. Updates the quick buttons of the seeded products, but ONLY where a product still has
the old seed defaults - buttons the owner changed in the app are left alone.

Revision ID: 0003
Revises: 0002
"""
import json
from decimal import Decimal

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def b(label: str, quantity: str) -> dict:
    return {"label": label, "quantity": quantity}


# Copied here on purpose: a migration must not change if seed.py changes later.
OLD = {
    "milk": [b("250 ml", "0.25"), b("500 ml", "0.5"), b("1 litre", "1"), b("2 litres", "2")],
    "dahi": [b("250 g", "0.25"), b("500 g", "0.5"), b("1 kg", "1")],
    "paneer": [b("100 g", "0.1"), b("250 g", "0.25"), b("500 g", "0.5"), b("1 kg", "1")],
    "shrikhand": [b("250 g", "0.25"), b("500 g", "0.5"), b("1 kg", "1")],
    "chaas": [b("250 ml", "0.25"), b("500 ml", "0.5"), b("1 litre", "1")],
    "lassi": [b("250 ml", "0.25"), b("500 ml", "0.5"), b("1 litre", "1")],
    "khawa": [b("100 g", "0.1"), b("250 g", "0.25"), b("500 g", "0.5"), b("1 kg", "1")],
}

_KG_200_TO_1 = [b("200 g", "0.2"), b("Pav kilo", "0.25"), b("Half kilo", "0.5"), b("1 kg", "1")]
_KG_100_TO_1 = [b("100 g", "0.1"), b("200 g", "0.2"), b("Half kilo", "0.5"), b("1 kg", "1")]
_CUPS = [b("100 ml", "0.1"), b("150 ml", "0.15"), b("200 ml", "0.2")]
NEW = {
    "milk": [b("Pav litre", "0.25"), b("Half litre", "0.5"), b("1 litre", "1"), b("2 litres", "2")],
    "dahi": _KG_200_TO_1,
    "paneer": _KG_200_TO_1,
    "shrikhand": _KG_100_TO_1,
    "khawa": _KG_100_TO_1,
    "lassi": _CUPS,
    "chaas": _CUPS,
}


def _same(stored, expected) -> bool:
    """Compare button lists, treating "0.25" and "0.250" as equal."""
    norm = lambda items: [(i["label"], Decimal(str(i["quantity"]))) for i in items]  # noqa: E731
    try:
        return norm(stored) == norm(expected)
    except (KeyError, TypeError, ArithmeticError):
        return False


def _replace(old: dict, new: dict) -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, name, quick_quantities FROM products")).all()
    for product_id, name, stored in rows:
        key = name.strip().lower()
        if isinstance(stored, str):
            stored = json.loads(stored)
        if key in old and _same(stored, old[key]):
            conn.execute(
                sa.text("UPDATE products SET quick_quantities = CAST(:q AS JSON) WHERE id = :id"),
                {"q": json.dumps(new[key]), "id": product_id},
            )


def upgrade() -> None:
    _replace(OLD, NEW)


def downgrade() -> None:
    _replace(NEW, OLD)
