import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Detect environment once at import time
_ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()
_IS_PRODUCTION: bool = _ENVIRONMENT == "production"


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
    ENABLE_DOCS: bool = not _IS_PRODUCTION

    # Local PostgreSQL default — always overridden by DATABASE_URL env var in production.
    # Uses the psycopg 3 dialect (postgresql+psycopg); psycopg2 is no longer used.
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/voicebill_db"

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong_in_production(cls, v: str) -> str:
        """Reject a weak or default SECRET_KEY when running in production."""
        if _IS_PRODUCTION:
            weak_defaults = {
                "dev-only-secret-key-change-in-production-not-safe-for-real-data",
                "voicebill-ai-dev-secret-key-do-not-use-in-production",
                "change-this-secret-key-in-production-use-a-strong-random-key",
                "",
            }
            if v in weak_defaults or len(v) < 32:
                raise ValueError(
                    "SECRET_KEY must be set to a strong random value in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
        return v

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
