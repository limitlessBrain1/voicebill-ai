import logging
from typing import Generator
from urllib.parse import urlparse

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger(__name__)


def _safe_db_host(db_url: str) -> str:
    """
    Extract only the hostname and database name from a DATABASE_URL for safe logging.
    Never returns the password, username, or full URL.
    """
    try:
        parsed = urlparse(db_url)
        host = parsed.hostname or "unknown"
        db = parsed.path.lstrip("/") or "unknown"
        return f"host={host} db={db}"
    except ValueError:
        return "host=<parse-error>"


def _build_engine():
    """
    Build a SQLAlchemy engine appropriate for the configured database.

    Neon PostgreSQL behaviour:
    - The **pooled** endpoint (ep-xxx-pooler.neon.tech) runs PgBouncer in
      transaction mode.  SQLAlchemy must NOT layer its own connection pool on
      top — use NullPool so every request checks out a fresh PgBouncer slot.
    - The **direct** endpoint (ep-xxx.neon.tech) is used only for Alembic
      migrations (see alembic/env.py).
    - Both endpoints require SSL — append ?sslmode=require to the URL when
      not already present.  psycopg 3 does not accept sslmode via connect_args;
      it must be embedded in the connection string.

    Local PostgreSQL:
    - No SSL or pool constraints needed; a standard pool with pool_pre_ping
      is sufficient.
    """
    db_url: str = settings.DATABASE_URL

    # Safe diagnostic: log host+dbname but never the password
    logger.info("DATABASE_URL configured: %s", _safe_db_host(db_url))

    # Detect Neon hosted connections by hostname pattern
    is_neon: bool = "neon.tech" in db_url
    is_neon_pooled: bool = "-pooler.neon.tech" in db_url

    # psycopg 3: sslmode must be in the connection string, not in connect_args.
    # Append ?sslmode=require (or &sslmode=require) when connecting to Neon and
    # it is not already present in the URL.
    if is_neon and "sslmode=" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url = f"{db_url}{separator}sslmode=require"
        logger.info("SSL: appended sslmode=require to Neon connection URL")

    if is_neon_pooled:
        logger.info("Engine mode: Neon pooled (NullPool)")
        # NullPool: disable SQLAlchemy's own pool when PgBouncer is handling
        # connection pooling — otherwise connections become exhausted rapidly.
        return create_engine(
            db_url,
            poolclass=NullPool,
        )

    if is_neon:
        logger.info("Engine mode: Neon direct (pool_pre_ping)")
    else:
        logger.info("Engine mode: local PostgreSQL (pool_pre_ping)")

    # Standard local or direct-Neon engine with pool_pre_ping
    return create_engine(
        db_url,
        pool_pre_ping=True,
    )


def _verify_connection(eng) -> None:
    """
    Attempt a lightweight SELECT 1 at startup to verify the database is reachable.
    Logs a warning on failure but does NOT abort startup — the health endpoint will
    report the error on subsequent requests, and Render's health-check will catch it.
    """
    try:
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection verified successfully.")
    except SQLAlchemyError as exc:
        # Catch all SQLAlchemy database errors (OperationalError, ProgrammingError,
        # InterfaceError, etc.) so no database-related startup failure escapes silently.
        # Log only the exception type — never the message, which may contain credentials.
        logger.error(
            "Database connection FAILED at startup. "
            "Check DATABASE_URL on Render. Error type: %s",
            type(exc).__name__,
        )


engine = _build_engine()
_verify_connection(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency for providing a transactional database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
