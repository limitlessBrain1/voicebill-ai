import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Add parent directory to sys.path so app modules can be loaded
sys.path.insert(
    0,
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)

from app.core.config import settings
from app.database.base import Base

# Import ALL models so that their table definitions are registered in
# Base.metadata before Alembic inspects it.  Missing imports here cause
# autogenerate to miss tables and produce destructive "drop table" migrations.
from app.models import (  # noqa: F401
    Shop,
    User,
    Category,
    Product,
    BillingCart,
    BillingCartItem,
    Sale,
    SaleItem,
    Payment,
)


# Alembic Config object
config = context.config


# Set up Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Override the sqlalchemy.url from alembic.ini with the value from app settings.
# This ensures Alembic always uses DATABASE_URL from the environment — the
# placeholder in alembic.ini is never used at runtime.
config.set_main_option(
    "sqlalchemy.url",
    settings.DATABASE_URL
)


# SQLAlchemy metadata — Alembic uses this to detect models and generate migrations
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in offline mode.

    In offline mode, Alembic generates SQL without
    directly connecting to the database.
    """

    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named"
        },
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in online mode.

    Uses NullPool so that Alembic's migration connection is never reused —
    this is required when running against Neon PostgreSQL direct connections.
    """

    connectable = engine_from_config(
        config.get_section(
            config.config_ini_section,
            {}
        ),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


# Decide which migration mode to use
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
