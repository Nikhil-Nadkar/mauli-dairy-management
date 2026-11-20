"""Seed command:  python -m src.seed

Safe to run many times. Creates the two branches, the seven products and the first
admin (credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in the environment).
"""
import sys
from decimal import Decimal

from sqlalchemy import func, select

from src.core import registry  # noqa: F401  (loads all models)
from src.core.config import get_settings
from src.core.database import SessionLocal
from src.core.security import hash_password
from src.modules.branches.models import Branch
from src.modules.products.models import Product
from src.modules.users.models import User


# Shop words for common amounts (the app shows the same words, in English or Marathi).
SHOP_WORDS = {Decimal("0.25"): "Pav", Decimal("0.5"): "Half", Decimal("0.75"): "Paun"}


def button(quantity: Decimal, unit: str) -> dict:
    """One quick button. `quantity` is in base units (litres / kg): button(Decimal("0.5"), "litre") -> Half litre."""
    quantity = quantity.normalize()
    if quantity in SHOP_WORDS:
        label = f"{SHOP_WORDS[quantity]} {'litre' if unit == 'litre' else 'kilo'}"
    elif quantity < 1:
        label = f"{int(quantity * 1000)} {'ml' if unit == 'litre' else 'g'}"
    elif unit == "litre":
        label = f"{quantity} litre{'' if quantity == 1 else 's'}"
    else:
        label = f"{quantity} kg"
    return {"label": label, "quantity": format(quantity, "f")}


def ML(n: int) -> dict:
    """Quick button in millilitres, stored in litres: ML(250) -> 0.25 L."""
    return button(Decimal(n) / 1000, "litre")


def G(n: int) -> dict:
    """Quick button in grams, stored in kg: G(250) -> 0.25 kg."""
    return button(Decimal(n) / 1000, "kg")


# The amounts the shop really sells (owner can change them later on Products & Prices).
DEFAULT_PRODUCTS = [
    ("Milk", "litre", [ML(250), ML(500), ML(1000), ML(2000)]),
    ("Dahi", "kg", [G(200), G(250), G(500), G(1000)]),
    ("Paneer", "kg", [G(200), G(250), G(500), G(1000)]),
    ("Shrikhand", "kg", [G(100), G(200), G(500), G(1000)]),
    ("Khawa", "kg", [G(100), G(200), G(500), G(1000)]),
    ("Lassi", "litre", [ML(100), ML(150), ML(200)]),
    ("Chaas", "litre", [ML(100), ML(150), ML(200)]),
]


def run() -> int:
    settings = get_settings()
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        print("ERROR: set ADMIN_EMAIL and ADMIN_PASSWORD in your environment / .env first.")
        return 1
    if len(settings.ADMIN_PASSWORD) < 8:
        print("ERROR: ADMIN_PASSWORD must be at least 8 characters.")
        return 1

    with SessionLocal() as db:
        for name in ("Branch 1", "Branch 2"):
            if not db.scalar(select(Branch).where(Branch.name == name)):
                db.add(Branch(name=name))
                print(f"Created {name}")

        for name, unit, quick in DEFAULT_PRODUCTS:
            exists = db.scalar(select(Product).where(func.lower(Product.name) == name.lower()))
            if not exists:
                db.add(Product(name=name, base_unit=unit, quick_quantities=quick))
                print(f"Created product {name}")

        email = settings.ADMIN_EMAIL.strip().lower()
        if not db.scalar(select(User).where(User.email == email)):
            db.add(
                User(
                    full_name=settings.ADMIN_FULL_NAME,
                    email=email,
                    password_hash=hash_password(settings.ADMIN_PASSWORD),
                    role="admin",
                    branch_id=None,
                )
            )
            print(f"Created admin {email}")
        else:
            print(f"Admin {email} already exists - left unchanged")

        db.commit()
    print("Seed complete.")
    return 0


if __name__ == "__main__":
    sys.exit(run())
