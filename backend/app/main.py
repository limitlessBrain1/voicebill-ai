from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="VoiceBill AI - Production-Ready Kirana / Grocery Store Billing & Management API",
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
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
    """Root endpoint welcoming visitors and providing documentation links."""
    return {
        "app": settings.PROJECT_NAME,
        "description": "Smart Grocery Billing and Management Platform",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
    }
