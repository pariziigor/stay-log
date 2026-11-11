from contextlib import asynccontextmanager
import logging
import time
from typing import AsyncGenerator
from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import AsyncSessionFactory, Base, engine, get_db_session
from app.core.exceptions import AppException
from app.modules.ai_assistant.infrastructure.models import (
    AIConversationModel,
    AIInsightModel,
    AIMessageModel,
)
from app.modules.ai_assistant.presentation.dashboard_routes import router as dashboard_router
from app.modules.ai_assistant.presentation.routes import router as ai_router
from app.modules.bookings.infrastructure.models import GuestModel, ReservationModel
from app.modules.bookings.presentation.routes import router as bookings_router
from app.modules.finance.infrastructure.models import (
    FinancialCategoryModel,
    FinancialTransactionModel,
)
from app.modules.finance.presentation.routes import router as finance_router
from app.modules.identity.infrastructure.models import (
    RefreshTokenModel,
    TeamMemberModel,
    UserConsentModel,
    UserModel,
)
from app.modules.identity.presentation.routes import router as auth_router
from app.modules.identity.presentation.user_routes import router as users_router
from app.modules.inventory.infrastructure.models import (
    InventoryItemModel,
    InventoryMovementModel,
)
from app.modules.inventory.presentation.routes import router as inventory_router
from app.modules.operations.infrastructure.models import (
    TaskChecklistItemModel,
    TaskModel,
)
from app.modules.operations.presentation.routes import router as tasks_router
from app.modules.properties.infrastructure.models import (
    AmenityModel,
    PropertyAmenityModel,
    PropertyModel,
)
from app.modules.properties.presentation.routes import router as properties_router

logger = logging.getLogger("hospedaai.api")

DEFAULT_AMENITIES = [
    ("wifi", "Wi-Fi de Alta Velocidade", "conectividade"),
    ("pool", "Piscina", "lazer"),
    ("air_conditioning", "Ar-condicionado", "conforto"),
    ("kitchen", "Cozinha Equipada", "cozinha"),
    ("parking", "Estacionamento Gratuito", "comodidade"),
    ("smart_tv", "Smart TV", "entretenimento"),
    ("washer", "Máquina de Lavar", "lavanderia"),
    ("bbq_grill", "Churrasqueira", "lazer"),
]


from app.modules.finance.application.services import DEFAULT_SYSTEM_CATEGORIES


async def _seed_reference_catalog_if_empty() -> None:
    async with AsyncSessionFactory() as session:
        count = (await session.execute(select(func.count(AmenityModel.id)))).scalar_one() or 0
        if count == 0:
            for code, name, cat in DEFAULT_AMENITIES:
                session.add(AmenityModel(code=code, name=name, category=cat))

        cat_count = (
            await session.execute(
                select(func.count(FinancialCategoryModel.id)).where(
                    FinancialCategoryModel.owner_id.is_(None)
                )
            )
        ).scalar_one() or 0
        if cat_count == 0:
            for name, tx_type in DEFAULT_SYSTEM_CATEGORIES:
                session.add(
                    FinancialCategoryModel(
                        owner_id=None,
                        name=name,
                        type=tx_type,
                        is_active=True,
                    )
                )

        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Garante que todas as tabelas e catálogos de referência existam ao iniciar (SQLite dev ou PostgreSQL Supabase/Render)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_reference_catalog_if_empty()
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API estruturado em Domain-Driven Design (DDD) para gestão de locação por temporada.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )


@app.middleware("http")
async def security_headers_and_audit_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Headers de Segurança HTTP (OWASP)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["X-Process-Time-Ms"] = str(elapsed_ms)

    logger.info(
        "%s %s -> %s (%sms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


# --- Handlers Globais de Exceção ---
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = []
    for error in exc.errors():
        field_loc = " -> ".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({"field": field_loc, "message": error["msg"]})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Dados de requisição inválidos.",
                "details": {"validation_errors": errors},
            }
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Erro interno não tratado em %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Ocorreu um erro interno no servidor.",
                "details": {"exception": str(exc)} if settings.ENVIRONMENT == "development" else {},
            }
        },
    )


# --- Rotas da API ---
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(properties_router, prefix=settings.API_V1_STR)
app.include_router(tasks_router, prefix=settings.API_V1_STR)
app.include_router(bookings_router, prefix=settings.API_V1_STR)
app.include_router(inventory_router, prefix=settings.API_V1_STR)
app.include_router(finance_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Infraestrutura"], summary="Verificação de integridade da API e Banco de Dados")
async def health_check(session: AsyncSession = Depends(get_db_session)):
    db_status = "connected"
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "unreachable"
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }
