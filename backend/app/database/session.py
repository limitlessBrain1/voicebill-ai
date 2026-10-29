from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# SQLAlchemy 2.x engine
# Note: For SQLite fallback during early offline prototyping or full PostgreSQL in production
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for providing a transactional database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
