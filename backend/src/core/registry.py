"""Imports every module's models so SQLAlchemy/Alembic know about all tables. Import this, not each model."""
from src.modules.branches.models import Branch  # noqa: F401
from src.modules.prices.models import BranchProductPrice  # noqa: F401
from src.modules.products.models import Product  # noqa: F401
from src.modules.sales.models import Sale, SaleItem  # noqa: F401
from src.modules.stock.models import StockMovement  # noqa: F401
from src.modules.users.models import User  # noqa: F401
