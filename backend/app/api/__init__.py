from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.billing import router as billing_router
from app.api.categories import router as category_router
from app.api.health import router as health_router
from app.api.products import router as product_router
from app.api.sales import router as sales_router
from app.api.shops import router as shop_router
from app.api.voice_products import router as voice_product_router


api_router = APIRouter()


api_router.include_router(
    health_router,
    tags=["System"],
)

api_router.include_router(
    shop_router,
)

api_router.include_router(
    auth_router,
)

api_router.include_router(
    category_router,
)

api_router.include_router(
    product_router,
)

api_router.include_router(
    billing_router,
)

api_router.include_router(
    voice_product_router,
)

api_router.include_router(
    sales_router,
)