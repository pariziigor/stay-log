from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


class Base(DeclarativeBase):
    pass


# Configuração do Engine Assíncrono do SQLAlchemy
engine_kwargs: dict = {"echo": False, "future": True}

# Conexões SQLite precisam de connect_args específicos para multithreading em async
if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    # Compatibilidade total com o PgBouncer / Connection Pooler do Supabase (:6543 e :5432)
    engine_kwargs["connect_args"] = {"statement_cache_size": 0}

engine: AsyncEngine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency para injeção de sessão do banco no FastAPI."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
