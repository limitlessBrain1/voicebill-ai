import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import api_router

# Determine runtime environment
_IS_PRODUCTION: bool = os.getenv("ENVIRONMENT", "development").lower() == "production"

# Swagger UI, ReDoc and OpenAPI schema are controlled by the ENABLE_DOCS setting.
#
# Defaults:
#   development  → ENABLE_DOCS=True  → docs always on
#   production   → ENABLE_DOCS=False → docs off (reduces attack surface)
#
# To re-enable in production without a code change, set the environment
# variable ENABLE_DOCS=true on Render (or any other host).
_docs_url: str | None = f"{settings.API_V1_STR}/docs" if settings.ENABLE_DOCS else None
_redoc_url: str | None = f"{settings.API_V1_STR}/redoc" if settings.ENABLE_DOCS else None
_openapi_url: str | None = f"{settings.API_V1_STR}/openapi.json" if settings.ENABLE_DOCS else None

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="VoiceBill AI - Production-Ready Kirana / Grocery Store Billing & Management API",
    version="0.1.0",
    openapi_url=_openapi_url,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
)

# Configure Cross-Origin Resource Sharing (CORS) for frontend clients
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register API routers with /api prefix
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    """Root endpoint — health indicator and documentation links (when docs are enabled)."""
    response = {
        "app": settings.PROJECT_NAME,
        "description": "Smart Grocery Billing and Management Platform",
        "health": f"{settings.API_V1_STR}/health",
    }
    if settings.ENABLE_DOCS:
        response["docs"] = f"{settings.API_V1_STR}/docs"
    return response
