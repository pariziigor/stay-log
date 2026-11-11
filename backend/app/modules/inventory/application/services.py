from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Set
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    BusinessRuleViolationError,
    EntityAlreadyExistsError,
    EntityNotFoundError,
    ForbiddenError,
)
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.models import TeamMemberModel
from app.modules.inventory.application.dtos import (
    InventoryItemCreateDTO,
    InventoryItemResponseDTO,
    InventoryMovementCreateDTO,
    InventoryMovementResponseDTO,
    StockMovementType,
)
from app.modules.inventory.infrastructure.models import (
    InventoryItemModel,
    InventoryMovementModel,
)
from app.modules.properties.infrastructure.models import PropertyModel


class InventoryService:
    """Serviço de aplicação para Gestão de Suprimentos, Estoque e Movimentações (RF-12)."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def _get_allowed_owner_ids_for_employee(self, employee_id: uuid.UUID) -> Set[uuid.UUID]:
        stmt = select(TeamMemberModel.owner_id).where(
            TeamMemberModel.employee_id == employee_id,
            TeamMemberModel.is_active.is_(True),
        )
        res = await self._session.execute(stmt)
        return set(res.scalars().all())

    async def _build_item_dtos(self, items: List[InventoryItemModel]) -> List[InventoryItemResponseDTO]:
        if not items:
            return []

        prop_ids = {i.property_id for i in items}
        prop_res = await self._session.execute(
            select(PropertyModel.id, PropertyModel.name).where(PropertyModel.id.in_(prop_ids))
        )
        prop_names: Dict[uuid.UUID, str] = {row[0]: row[1] for row in prop_res.all()}

        result: List[InventoryItemResponseDTO] = []
        for i in items:
            cur_qty = Decimal(str(i.current_quantity))
            min_qty = Decimal(str(i.minimum_quantity))
            result.append(
                InventoryItemResponseDTO(
                    id=i.id,
                    property_id=i.property_id,
                    property_name=prop_names.get(i.property_id, "Imóvel"),
                    name=i.name,
                    category=i.category,
                    unit=i.unit,
                    current_quantity=cur_qty,
                    minimum_quantity=min_qty,
                    is_low_stock=cur_qty <= min_qty,
                    is_active=i.is_active,
                    created_at=i.created_at,
                    updated_at=i.updated_at,
                )
            )
        return result

    async def list_items(
        self,
        current_user: User,
        property_id: Optional[uuid.UUID] = None,
        low_stock_only: bool = False,
    ) -> List[InventoryItemResponseDTO]:
        stmt = (
            select(InventoryItemModel)
            .join(PropertyModel, PropertyModel.id == InventoryItemModel.property_id)
            .where(PropertyModel.deleted_at.is_(None), InventoryItemModel.is_active.is_(True))
        )

        if current_user.role == UserRole.OWNER:
            stmt = stmt.where(PropertyModel.owner_id == current_user.id)
        elif current_user.role == UserRole.EMPLOYEE:
            allowed_owners = await self._get_allowed_owner_ids_for_employee(current_user.id)
            if not allowed_owners:
                return []
            stmt = stmt.where(PropertyModel.owner_id.in_(allowed_owners))

        if property_id:
            stmt = stmt.where(InventoryItemModel.property_id == property_id)
        if low_stock_only:
            stmt = stmt.where(InventoryItemModel.current_quantity <= InventoryItemModel.minimum_quantity)

        stmt = stmt.order_by(InventoryItemModel.category.asc(), InventoryItemModel.name.asc())
        res = await self._session.execute(stmt)
        items = list(res.scalars().all())
        return await self._build_item_dtos(items)

    async def create_item(
        self,
        current_user: User,
        dto: InventoryItemCreateDTO,
    ) -> InventoryItemResponseDTO:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Apenas proprietários ou administradores podem cadastrar itens de estoque.")

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
            raise ForbiddenError("Você só pode cadastrar suprimentos nos seus próprios imóveis.")

        # Verifica duplicidade de nome no mesmo imóvel
        dup_stmt = select(InventoryItemModel).where(
            InventoryItemModel.property_id == dto.property_id,
            func.lower(InventoryItemModel.name) == dto.name.strip().lower(),
        )
        dup_res = await self._session.execute(dup_stmt)
        if dup_res.scalar_one_or_none() is not None:
            raise EntityAlreadyExistsError(
                f"Já existe um item de estoque com o nome '{dto.name.strip()}' neste imóvel."
            )

        item = InventoryItemModel(
            id=uuid.uuid4(),
            property_id=dto.property_id,
            name=dto.name.strip(),
            category=dto.category.strip().lower(),
            unit=dto.unit.strip(),
            current_quantity=dto.initial_quantity,
            minimum_quantity=dto.minimum_quantity,
            is_active=True,
        )
        self._session.add(item)

        if dto.initial_quantity > Decimal("0"):
            movement = InventoryMovementModel(
                id=uuid.uuid4(),
                item_id=item.id,
                movement_type=StockMovementType.IN.value,
                quantity=dto.initial_quantity,
                balance_after=dto.initial_quantity,
                reason="Saldo inicial de abertura",
                performed_by=current_user.id,
            )
            self._session.add(movement)

        await self._session.flush()
        dtos = await self._build_item_dtos([item])
        return dtos[0]

    async def record_movement(
        self,
        current_user: User,
        dto: InventoryMovementCreateDTO,
    ) -> InventoryMovementResponseDTO:
        res = await self._session.execute(
            select(InventoryItemModel).where(InventoryItemModel.id == dto.item_id)
        )
        item = res.scalar_one_or_none()
        if item is None:
            raise EntityNotFoundError("Item de Estoque", dto.item_id)

        prop_res = await self._session.execute(
            select(PropertyModel).where(PropertyModel.id == item.property_id)
        )
        prop = prop_res.scalar_one_or_none()
        if prop is None:
            raise EntityNotFoundError("Imóvel", item.property_id)

        if current_user.role == UserRole.OWNER and prop.owner_id != current_user.id:
            raise ForbiddenError("Acesso negado: este item pertence a um imóvel de outro proprietário.")
        if current_user.role == UserRole.EMPLOYEE:
            allowed_owners = await self._get_allowed_owner_ids_for_employee(current_user.id)
            if prop.owner_id not in allowed_owners:
                raise ForbiddenError("Acesso negado: você não integra a equipe deste imóvel.")

        current_qty = Decimal(str(item.current_quantity))
        if dto.movement_type == StockMovementType.IN:
            delta = dto.quantity
        elif dto.movement_type == StockMovementType.OUT:
            delta = -dto.quantity
        else:
            delta = dto.quantity

        new_balance = current_qty + delta
        if new_balance < Decimal("0"):
            raise BusinessRuleViolationError(
                f"Estoque insuficiente para '{item.name}': saldo atual é {current_qty} {item.unit}, "
                f"movimentação solicitada resultaria em {new_balance} {item.unit}.",
                error_code="INSUFFICIENT_STOCK",
            )

        now = datetime.now(timezone.utc)
        item.current_quantity = new_balance
        item.updated_at = now

        movement = InventoryMovementModel(
            id=uuid.uuid4(),
            item_id=item.id,
            movement_type=dto.movement_type.value,
            quantity=dto.quantity,
            balance_after=new_balance,
            unit_cost=dto.unit_cost,
            reason=dto.reason.strip() if dto.reason else None,
            task_id=dto.task_id,
            performed_by=current_user.id,
            occurred_at=now,
        )
        self._session.add(movement)
        await self._session.flush()

        return InventoryMovementResponseDTO(
            id=movement.id,
            item_id=item.id,
            item_name=item.name,
            property_name=prop.name,
            movement_type=StockMovementType(movement.movement_type),
            quantity=Decimal(str(movement.quantity)),
            balance_after=Decimal(str(movement.balance_after)),
            unit_cost=Decimal(str(movement.unit_cost)) if movement.unit_cost is not None else None,
            reason=movement.reason,
            performed_by=movement.performed_by,
            occurred_at=movement.occurred_at,
        )

    async def list_movements(
        self,
        current_user: User,
        item_id: Optional[uuid.UUID] = None,
        property_id: Optional[uuid.UUID] = None,
    ) -> List[InventoryMovementResponseDTO]:
        stmt = (
            select(InventoryMovementModel, InventoryItemModel.name, PropertyModel.name)
            .join(InventoryItemModel, InventoryItemModel.id == InventoryMovementModel.item_id)
            .join(PropertyModel, PropertyModel.id == InventoryItemModel.property_id)
            .where(PropertyModel.deleted_at.is_(None))
        )

        if current_user.role == UserRole.OWNER:
            stmt = stmt.where(PropertyModel.owner_id == current_user.id)
        elif current_user.role == UserRole.EMPLOYEE:
            allowed_owners = await self._get_allowed_owner_ids_for_employee(current_user.id)
            if not allowed_owners:
                return []
            stmt = stmt.where(PropertyModel.owner_id.in_(allowed_owners))

        if item_id:
            stmt = stmt.where(InventoryMovementModel.item_id == item_id)
        if property_id:
            stmt = stmt.where(InventoryItemModel.property_id == property_id)

        stmt = stmt.order_by(InventoryMovementModel.occurred_at.desc()).limit(100)
        res = await self._session.execute(stmt)
        result: List[InventoryMovementResponseDTO] = []
        for mov, item_name, prop_name in res.all():
            result.append(
                InventoryMovementResponseDTO(
                    id=mov.id,
                    item_id=mov.item_id,
                    item_name=item_name,
                    property_name=prop_name,
                    movement_type=StockMovementType(mov.movement_type),
                    quantity=Decimal(str(mov.quantity)),
                    balance_after=Decimal(str(mov.balance_after)),
                    unit_cost=Decimal(str(mov.unit_cost)) if mov.unit_cost is not None else None,
                    reason=mov.reason,
                    performed_by=mov.performed_by,
                    occurred_at=mov.occurred_at,
                )
            )
        return result
