from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _build_engine():
    """
    Build a SQLAlchemy engine appropriate for the configured database.

    Neon PostgreSQL behaviour:
    - The **pooled** endpoint (ep-xxx-pooler.neon.tech) runs PgBouncer in
      transaction mode.  SQLAlchemy must NOT layer its own connection pool on
      top — use NullPool so every request checks out a fresh PgBouncer slot.
    - The **direct** endpoint (ep-xxx.neon.tech) is used only for Alembic
      migrations (see alembic/env.py).
    - Both endpoints require sslmode=require.

    Local PostgreSQL:
    - No SSL or pool constraints needed; a standard pool with pool_pre_ping
      is sufficient.
    """
    db_url: str = settings.DATABASE_URL

    # Detect Neon hosted connections by hostname pattern
    is_neon: bool = "neon.tech" in db_url
    is_neon_pooled: bool = "-pooler.neon.tech" in db_url

    # Build connect_args only for Neon (avoid injecting sslmode into local PG)
    connect_args: dict = {}
    if is_neon:
        # sslmode=require if not already present in the connection string
        if "sslmode=" not in db_url:
            connect_args["sslmode"] = "require"

    if is_neon_pooled:
        # NullPool: disable SQLAlchemy's own pool when PgBouncer is handling
        # connection pooling — otherwise connections become exhausted rapidly.
        return create_engine(
            db_url,
            poolclass=NullPool,
            connect_args=connect_args,
        )

    # Standard local or direct-Neon engine with pool_pre_ping
    return create_engine(
        db_url,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency for providing a transactional database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
