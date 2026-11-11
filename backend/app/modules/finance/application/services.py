from decimal import Decimal
from typing import Dict, List, Optional
import uuid
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    BusinessRuleViolationError,
    EntityAlreadyExistsError,
    EntityNotFoundError,
    ForbiddenError,
)
from app.modules.finance.application.dtos import (
    CashFlowSummaryDTO,
    FinancialCategoryCreateDTO,
    FinancialCategoryResponseDTO,
    FinancialTransactionCreateDTO,
    FinancialTransactionResponseDTO,
    PaymentMethod,
    PaymentStatus,
    TransactionType,
)
from app.modules.finance.infrastructure.models import (
    FinancialCategoryModel,
    FinancialTransactionModel,
)
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.properties.infrastructure.models import PropertyModel

DEFAULT_SYSTEM_CATEGORIES = [
    ("Hospedagem Direta", TransactionType.INCOME.value),
    ("Repasse de Plataforma", TransactionType.INCOME.value),
    ("Taxa de Limpeza Recebida", TransactionType.INCOME.value),
    ("Limpeza e Lavanderia", TransactionType.EXPENSE.value),
    ("Manutenção e Reparos", TransactionType.EXPENSE.value),
    ("Suprimentos e Insumos", TransactionType.EXPENSE.value),
    ("Energia, Água e Internet", TransactionType.EXPENSE.value),
    ("Comissão / Taxa de Plataforma", TransactionType.EXPENSE.value),
]


class FinanceService:
    """Serviço de aplicação para Gestão Financeira e Fluxo de Caixa (RF-13)."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def _ensure_system_categories(self) -> None:
        res = await self._session.execute(
            select(func.count(FinancialCategoryModel.id)).where(
                FinancialCategoryModel.owner_id.is_(None)
            )
        )
        count = res.scalar_one() or 0
        if count == 0:
            for name, tx_type in DEFAULT_SYSTEM_CATEGORIES:
                self._session.add(
                    FinancialCategoryModel(
                        owner_id=None,
                        name=name,
                        type=tx_type,
                        is_active=True,
                    )
                )
            await self._session.flush()

    async def list_categories(self, current_user: User) -> List[FinancialCategoryResponseDTO]:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Acesso restrito a proprietários e administradores.")

        await self._ensure_system_categories()

        stmt = select(FinancialCategoryModel).where(FinancialCategoryModel.is_active.is_(True))
        if current_user.role == UserRole.OWNER:
            stmt = stmt.where(
                or_(
                    FinancialCategoryModel.owner_id.is_(None),
                    FinancialCategoryModel.owner_id == current_user.id,
                )
            )
        stmt = stmt.order_by(FinancialCategoryModel.type.asc(), FinancialCategoryModel.name.asc())
        res = await self._session.execute(stmt)
        return [FinancialCategoryResponseDTO.model_validate(c) for c in res.scalars().all()]

    async def create_category(
        self,
        current_user: User,
        dto: FinancialCategoryCreateDTO,
    ) -> FinancialCategoryResponseDTO:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Apenas proprietários ou administradores podem criar categorias financeiras.")

        await self._ensure_system_categories()
        owner_id = current_user.id if current_user.role == UserRole.OWNER else None

        dup_stmt = select(FinancialCategoryModel).where(
            func.lower(FinancialCategoryModel.name) == dto.name.strip().lower(),
            FinancialCategoryModel.type == dto.type.value,
            or_(
                FinancialCategoryModel.owner_id.is_(None),
                FinancialCategoryModel.owner_id == owner_id,
            ),
        )
        dup_res = await self._session.execute(dup_stmt)
        if dup_res.scalar_one_or_none() is not None:
            raise EntityAlreadyExistsError(
                f"Já existe uma categoria '{dto.name.strip()}' para o tipo {dto.type.value}."
            )

        category = FinancialCategoryModel(
            owner_id=owner_id,
            name=dto.name.strip(),
            type=dto.type.value,
            is_active=True,
        )
        self._session.add(category)
        await self._session.flush()
        return FinancialCategoryResponseDTO.model_validate(category)

    async def create_transaction(
        self,
        current_user: User,
        dto: FinancialTransactionCreateDTO,
    ) -> FinancialTransactionResponseDTO:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Apenas proprietários ou administradores podem registrar lançamentos financeiros.")

        await self._ensure_system_categories()

        prop_res = await self._session.execute(
            select(PropertyModel).where(
                PropertyModel.id == dto.property_id,
                PropertyModel.deleted_at.is_(None),
            )
        )
        prop = prop_res.scalar_one_or_none()
        if prop is None:
            raise EntityNotFoundError("Imóvel", dto.property_id)

        if current_user.role == UserRole.OWNER and prop.owner_id != current_user.id:
            raise ForbiddenError("Você só pode registrar lançamentos para os seus próprios imóveis.")

        cat_res = await self._session.execute(
            select(FinancialCategoryModel).where(FinancialCategoryModel.id == dto.category_id)
        )
        category = cat_res.scalar_one_or_none()
        if category is None:
            raise EntityNotFoundError("Categoria Financeira", dto.category_id)

        if (
            category.owner_id is not None
            and current_user.role == UserRole.OWNER
            and category.owner_id != current_user.id
        ):
            raise ForbiddenError("Categoria financeira pertence a outro proprietário.")

        # RF-13: Garante que o tipo do lançamento coincide com o tipo da categoria
        if category.type != dto.type.value:
            raise BusinessRuleViolationError(
                f"O tipo do lançamento ('{dto.type.value}') não coincide com o tipo da categoria '{category.name}' ('{category.type}').",
                error_code="CATEGORY_TYPE_MISMATCH",
            )

        paid_date = (
            (dto.paid_date or dto.transaction_date)
            if dto.payment_status == PaymentStatus.PAID
            else None
        )

        tx = FinancialTransactionModel(
            id=uuid.uuid4(),
            property_id=prop.id,
            category_id=category.id,
            type=dto.type.value,
            amount=dto.amount,
            description=dto.description.strip(),
            transaction_date=dto.transaction_date,
            due_date=dto.due_date,
            paid_date=paid_date,
            payment_status=dto.payment_status.value,
            payment_method=dto.payment_method.value if dto.payment_method else None,
            reservation_id=dto.reservation_id,
            created_by=current_user.id,
        )
        self._session.add(tx)
        await self._session.flush()

        return FinancialTransactionResponseDTO(
            id=tx.id,
            property_id=prop.id,
            property_name=prop.name,
            category_id=category.id,
            category_name=category.name,
            type=TransactionType(tx.type),
            amount=Decimal(str(tx.amount)),
            description=tx.description,
            transaction_date=tx.transaction_date,
            due_date=tx.due_date,
            paid_date=tx.paid_date,
            payment_status=PaymentStatus(tx.payment_status),
            payment_method=PaymentMethod(tx.payment_method) if tx.payment_method else None,
            reservation_id=tx.reservation_id,
            created_at=tx.created_at,
        )

    async def list_transactions(
        self,
        current_user: User,
        property_id: Optional[uuid.UUID] = None,
        tx_type: Optional[TransactionType] = None,
        payment_status: Optional[PaymentStatus] = None,
    ) -> List[FinancialTransactionResponseDTO]:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Acesso restrito a proprietários e administradores.")

        await self._ensure_system_categories()

        stmt = (
            select(FinancialTransactionModel, PropertyModel.name, FinancialCategoryModel.name)
            .join(PropertyModel, PropertyModel.id == FinancialTransactionModel.property_id)
            .join(FinancialCategoryModel, FinancialCategoryModel.id == FinancialTransactionModel.category_id)
            .where(PropertyModel.deleted_at.is_(None))
        )

        if current_user.role == UserRole.OWNER:
            stmt = stmt.where(PropertyModel.owner_id == current_user.id)
        if property_id:
            stmt = stmt.where(FinancialTransactionModel.property_id == property_id)
        if tx_type:
            stmt = stmt.where(FinancialTransactionModel.type == tx_type.value)
        if payment_status:
            stmt = stmt.where(FinancialTransactionModel.payment_status == payment_status.value)

        stmt = stmt.order_by(
            FinancialTransactionModel.transaction_date.desc(),
            FinancialTransactionModel.created_at.desc(),
        )

        res = await self._session.execute(stmt)
        result: List[FinancialTransactionResponseDTO] = []
        for tx, prop_name, cat_name in res.all():
            result.append(
                FinancialTransactionResponseDTO(
                    id=tx.id,
                    property_id=tx.property_id,
                    property_name=prop_name,
                    category_id=tx.category_id,
                    category_name=cat_name,
                    type=TransactionType(tx.type),
                    amount=Decimal(str(tx.amount)),
                    description=tx.description,
                    transaction_date=tx.transaction_date,
                    due_date=tx.due_date,
                    paid_date=tx.paid_date,
                    payment_status=PaymentStatus(tx.payment_status),
                    payment_method=PaymentMethod(tx.payment_method) if tx.payment_method else None,
                    reservation_id=tx.reservation_id,
                    created_at=tx.created_at,
                )
            )
        return result

    async def get_cash_flow_summary(
        self,
        current_user: User,
        property_id: Optional[uuid.UUID] = None,
    ) -> CashFlowSummaryDTO:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Acesso restrito a proprietários e administradores.")

        stmt = (
            select(FinancialTransactionModel)
            .join(PropertyModel, PropertyModel.id == FinancialTransactionModel.property_id)
            .where(
                PropertyModel.deleted_at.is_(None),
                FinancialTransactionModel.payment_status != PaymentStatus.CANCELLED.value,
            )
        )
        if current_user.role == UserRole.OWNER:
            stmt = stmt.where(PropertyModel.owner_id == current_user.id)
        if property_id:
            stmt = stmt.where(FinancialTransactionModel.property_id == property_id)

        res = await self._session.execute(stmt)
        txs = list(res.scalars().all())

        total_income = Decimal("0.00")
        total_expense = Decimal("0.00")
        pending_income = Decimal("0.00")
        pending_expense = Decimal("0.00")

        for tx in txs:
            amt = Decimal(str(tx.amount))
            if tx.type == TransactionType.INCOME.value:
                total_income += amt
                if tx.payment_status in (PaymentStatus.PENDING.value, PaymentStatus.OVERDUE.value):
                    pending_income += amt
            else:
                total_expense += amt
                if tx.payment_status in (PaymentStatus.PENDING.value, PaymentStatus.OVERDUE.value):
                    pending_expense += amt

        net_result = total_income - total_expense
        margin_pct = float(round((net_result / total_income) * Decimal("100"), 2)) if total_income > 0 else 0.0

        return CashFlowSummaryDTO(
            total_income=total_income,
            total_expense=total_expense,
            net_result=net_result,
            margin_pct=margin_pct,
            pending_income=pending_income,
            pending_expense=pending_expense,
            transactions_count=len(txs),
        )
