from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.dependencies import require_roles
from app.modules.finance.application.dtos import (
    CashFlowSummaryDTO,
    FinancialCategoryCreateDTO,
    FinancialCategoryResponseDTO,
    FinancialTransactionCreateDTO,
    FinancialTransactionResponseDTO,
    PaymentStatus,
    TransactionType,
)
from app.modules.finance.application.services import FinanceService
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole

router = APIRouter(prefix="/finance", tags=["Financeiro & Fluxo de Caixa (RF-13)"])


def get_finance_service(session: AsyncSession = Depends(get_db_session)) -> FinanceService:
    return FinanceService(session)


@router.get(
    "/categories",
    response_model=List[FinancialCategoryResponseDTO],
    summary="Listar categorias financeiras de receitas e despesas",
)
async def list_categories(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: FinanceService = Depends(get_finance_service),
) -> List[FinancialCategoryResponseDTO]:
    return await service.list_categories(current_user=current_user)


@router.post(
    "/categories",
    response_model=FinancialCategoryResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Criar categoria financeira personalizada",
)
async def create_category(
    dto: FinancialCategoryCreateDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: FinanceService = Depends(get_finance_service),
) -> FinancialCategoryResponseDTO:
    return await service.create_category(current_user=current_user, dto=dto)


@router.get(
    "/transactions",
    response_model=List[FinancialTransactionResponseDTO],
    summary="Listar lançamentos financeiros de receitas e despesas",
)
async def list_transactions(
    property_id: Optional[uuid.UUID] = Query(None, description="Filtrar por imóvel"),
    tx_type: Optional[TransactionType] = Query(None, alias="type", description="Filtrar por tipo (income/expense)"),
    payment_status: Optional[PaymentStatus] = Query(None, description="Filtrar por status de pagamento"),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: FinanceService = Depends(get_finance_service),
) -> List[FinancialTransactionResponseDTO]:
    return await service.list_transactions(
        current_user=current_user,
        property_id=property_id,
        tx_type=tx_type,
        payment_status=payment_status,
    )


@router.post(
    "/transactions",
    response_model=FinancialTransactionResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar novo lançamento financeiro (com validação de categoria - RF-13)",
)
async def create_transaction(
    dto: FinancialTransactionCreateDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: FinanceService = Depends(get_finance_service),
) -> FinancialTransactionResponseDTO:
    return await service.create_transaction(current_user=current_user, dto=dto)


@router.get(
    "/summary",
    response_model=CashFlowSummaryDTO,
    summary="Obter resumo consolidado do fluxo de caixa e margem líquida",
)
async def get_cash_flow_summary(
    property_id: Optional[uuid.UUID] = Query(None, description="Filtrar por imóvel"),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: FinanceService = Depends(get_finance_service),
) -> CashFlowSummaryDTO:
    return await service.get_cash_flow_summary(current_user=current_user, property_id=property_id)
