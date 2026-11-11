import json
from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Valor usado apenas em desenvolvimento/testes. Nunca aceito em produção.
INSECURE_DEFAULT_SECRET_KEY = "default-insecure-secret-key-change-in-production-min-32-chars"
LOCAL_ENVIRONMENTS = {"development", "test"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "Sistema de Gestão Inteligente para Locação por Temporada"
    API_V1_STR: str = "/api/v1"

    # JWT Security
    SECRET_KEY: str = INSECURE_DEFAULT_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Brute Force Protection
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCK_MINUTES: int = 15

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./locacao_dev.db"

    # AI Assistant Providers (Gratuitos: Google AI Studio Gemini ou Groq Llama 3.3)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # CORS (aceita lista JSON ou string separada por vírgulas no Render)
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Converte URIs padrão do Supabase/Render (postgres:// ou postgresql://) para o driver asyncpg."""
        if not isinstance(v, str):
            return v
        url = v.strip()
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://") :]
        elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]
        return url

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            raw = v.strip()
            if not raw:
                return []
            if raw.startswith("["):
                parsed = json.loads(raw)
                return [str(i).strip().rstrip("/") for i in parsed if str(i).strip()]
            return [i.strip().rstrip("/") for i in raw.split(",") if i.strip()]
        if isinstance(v, list):
            return [str(i).strip().rstrip("/") for i in v if str(i).strip()]
        return []

    @model_validator(mode="after")
    def enforce_production_safety(self) -> "Settings":
        """Impede subir fora de dev/test com segredo fraco ou banco de desenvolvimento."""
        if self.ENVIRONMENT.lower() in LOCAL_ENVIRONMENTS:
            return self
        if self.SECRET_KEY == INSECURE_DEFAULT_SECRET_KEY or len(self.SECRET_KEY) < 32:
            raise ValueError(
                "SECRET_KEY insegura: defina uma chave aleatória com pelo menos 32 caracteres "
                "(ex.: python -c \"import secrets; print(secrets.token_urlsafe(48))\")."
            )
        if self.DATABASE_URL.startswith("sqlite"):
            raise ValueError("DATABASE_URL com SQLite não é permitido fora de desenvolvimento/teste. Use PostgreSQL.")
        return self


settings = Settings()
