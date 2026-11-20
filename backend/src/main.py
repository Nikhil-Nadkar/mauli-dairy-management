from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import get_settings
from src.core.errors import register_error_handlers
from src.modules.auth.routes import router as auth_router
from src.modules.branches.routes import router as branches_router
from src.modules.prices.routes import router as prices_router
from src.modules.products.routes import router as products_router
from src.modules.reports.routes import router as reports_router
from src.modules.sales.routes import router as sales_router
from src.modules.stock.routes import router as stock_router
from src.modules.users.routes import router as users_router

settings = get_settings()

app = FastAPI(title="Dairy Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

# Each module owns its routes; main.py just registers them.
for router in (auth_router, users_router, branches_router, products_router, prices_router, stock_router, sales_router, reports_router):
    app.include_router(router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
