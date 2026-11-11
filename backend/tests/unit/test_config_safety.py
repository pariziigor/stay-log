import pytest
from pydantic import ValidationError
from app.core.config import INSECURE_DEFAULT_SECRET_KEY, Settings

STRONG_KEY = "k" * 48
PG_URL = "postgresql+asyncpg://u:p@db:5432/locacao"


def build(**overrides) -> Settings:
    # _env_file=None isola o teste de qualquer .env presente na máquina
    return Settings(_env_file=None, **overrides)


def test_development_accepts_default_secret_and_sqlite():
    settings = build(ENVIRONMENT="development")
    assert settings.SECRET_KEY == INSECURE_DEFAULT_SECRET_KEY


@pytest.mark.parametrize("secret", [INSECURE_DEFAULT_SECRET_KEY, "curta"])
def test_production_rejects_weak_secret(secret):
    with pytest.raises(ValidationError, match="SECRET_KEY insegura"):
        build(ENVIRONMENT="production", SECRET_KEY=secret, DATABASE_URL=PG_URL)


def test_production_rejects_sqlite():
    with pytest.raises(ValidationError, match="SQLite"):
        build(ENVIRONMENT="production", SECRET_KEY=STRONG_KEY)


def test_production_accepts_strong_secret_and_postgres():
    settings = build(ENVIRONMENT="production", SECRET_KEY=STRONG_KEY, DATABASE_URL=PG_URL)
    assert settings.ENVIRONMENT == "production"


def test_cors_origins_parse_comma_separated_string():
    settings = build(BACKEND_CORS_ORIGINS="http://a.com, http://b.com")
    assert settings.BACKEND_CORS_ORIGINS == ["http://a.com", "http://b.com"]
