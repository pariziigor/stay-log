import asyncio
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.database import Base, get_db_session
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import Email, UserRole
from app.modules.identity.infrastructure.models import (
    RefreshTokenModel,
    TeamMemberModel,
    UserConsentModel,
    UserModel,
)
from app.modules.properties.infrastructure.models import (
    AmenityModel,
    PropertyAmenityModel,
    PropertyModel,
)

# SQLite em memória assíncrono para os testes
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestAsyncSessionFactory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestAsyncSessionFactory() as session:
        # Seed inicial de comodidades para testes
        amenities = [
            AmenityModel(id=1, code="wifi", name="Wi-Fi", category="conectividade"),
            AmenityModel(id=2, code="pool", name="Piscina", category="lazer"),
            AmenityModel(id=3, code="air_conditioning", name="Ar-condicionado", category="conforto"),
        ]
        session.add_all(amenities)
        await session.commit()

        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def create_test_user(db_session: AsyncSession):
    async def _creator(
        email: str,
        role: UserRole = UserRole.OWNER,
        password: str = "Secret1234!",
        full_name: str = "Test User",
    ) -> UserModel:
        user_model = UserModel(
            full_name=full_name,
            email=email.lower().strip(),
            password_hash=get_password_hash(password),
            role=role.value,
            is_active=True,
        )
        db_session.add(user_model)
        await db_session.commit()
        await db_session.refresh(user_model)
        return user_model

    return _creator


def auth_headers(user_id: str, email: str, role: str) -> dict:
    token = create_access_token(subject=str(user_id), email=email, role=role)
    return {"Authorization": f"Bearer {token}"}
