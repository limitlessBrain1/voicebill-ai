import logging
import os
from typing import List, Optional, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """VoiceBill AI application settings loaded from environment variables or .env file."""

    PROJECT_NAME: str = "VoiceBill AI"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"

    # In production this MUST be set via environment variable to a strong random value.
    # In development a safe local default is used so devs can start without extra setup.
    # Generate a production key with:  python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = "dev-only-secret-key-change-in-production-not-safe-for-real-data"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # Swagger UI / ReDoc / OpenAPI schema toggle.
    # Defaults to True in development so the API docs are immediately accessible.
    # Defaults to False in production to reduce attack surface.
    # Set ENABLE_DOCS=true in the Render environment variables to re-enable when
    # needed (e.g. during a debugging session), without touching any other setting.
    # None means "not explicitly set" — resolved automatically by environment.
    ENABLE_DOCS: Optional[bool] = None

    # Database URL — MUST be overridden by the DATABASE_URL environment variable on Render.
    # Uses the psycopg 3 dialect (postgresql+psycopg); psycopg2 is no longer used.
    # Local dev default is used only when DATABASE_URL is not set in the environment.
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/voicebill_db"

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @model_validator(mode="after")
    def _validate_production_settings(self) -> "Settings":
        """
        Production-safety checks that read the resolved ENVIRONMENT value
        from this Settings instance — not from a stale module-level variable.

        Runs after all fields are populated from env vars / .env / defaults,
        so self.ENVIRONMENT is always the real runtime value.
        """
        is_production = self.ENVIRONMENT.lower() == "production"

        # --- ENABLE_DOCS: resolve None to environment-aware default ---
        if self.ENABLE_DOCS is None:
            self.ENABLE_DOCS = not is_production

        if not is_production:
            return self

        # --- SECRET_KEY: must be strong in production ---
        weak_defaults = {
            "dev-only-secret-key-change-in-production-not-safe-for-real-data",
            "voicebill-ai-dev-secret-key-do-not-use-in-production",
            "change-this-secret-key-in-production-use-a-strong-random-key",
            "",
        }
        if self.SECRET_KEY in weak_defaults or len(self.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY must be set to a strong random value in production. "
                'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
            )

        # --- DATABASE_URL: must not point to localhost in production ---
        localhost_indicators = ("localhost", "127.0.0.1", "0.0.0.0")
        if any(indicator in self.DATABASE_URL for indicator in localhost_indicators):
            raise ValueError(
                "DATABASE_URL is pointing to localhost in a production environment. "
                "Set the DATABASE_URL environment variable on Render to your Neon "
                "PostgreSQL connection string "
                "(e.g. postgresql+psycopg://user:pass@ep-xxx.neon.tech/dbname?sslmode=require)."
            )

        return self

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            import json
            if isinstance(v, str):
                return json.loads(v)
            return v
        raise ValueError(v)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
