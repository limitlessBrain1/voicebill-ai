import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", tags=["System"])
def health_check():
    """Basic liveness check — does not require database access."""
    return {
        "status": "ok",
        "message": "VoiceBill AI backend is running",
        "environment": settings.ENVIRONMENT,
    }


@router.get("/health/db", tags=["System"])
def database_health_check(db: Session = Depends(get_db)):
    """
    Database connectivity check — executes SELECT 1 against the configured database.

    Returns 200 when connected, 503 when the database is unreachable.
    Logs diagnostic host info without exposing credentials.
    """
    try:
        result = db.execute(text("SELECT 1"))
        scalar = result.scalar()
        return {
            "status": "ok",
            "database": "connected",
            "result": scalar,
        }
    except OperationalError as exc:
        logger.error(
            "Health check: database connection failed. Error type: %s",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Database connection failed. "
                "Check the DATABASE_URL environment variable on Render and verify "
                "that the Neon PostgreSQL instance is reachable."
            ),
        )
    except SQLAlchemyError as exc:
        logger.error(
            "Health check: unexpected database error. Error type: %s",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unexpected database error during health check.",
        )
