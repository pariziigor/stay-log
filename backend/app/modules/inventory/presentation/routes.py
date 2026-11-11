from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.inventory.application.dtos import (
    InventoryItemCreateDTO,
    InventoryItemResponseDTO,
    InventoryMovementCreateDTO,
    InventoryMovementResponseDTO,
)
from app.modules.inventory.application.services import InventoryService

router = APIRouter(prefix="/inventory", tags=["Suprimentos & Estoque (RF-12)"])


def get_inventory_service(session: AsyncSession = Depends(get_db_session)) -> InventoryService:
    return InventoryService(session)


@router.get(
    "/items",
    response_model=List[InventoryItemResponseDTO],
    summary="Listar itens de suprimento e alertas de estoque mínimo",
)
async def list_items(
    property_id: Optional[uuid.UUID] = Query(None, description="Filtrar por imóvel"),
    low_stock_only: bool = Query(False, description="Exibir apenas itens abaixo ou igual ao estoque mínimo"),
    current_user: User = Depends(get_current_user),
    service: InventoryService = Depends(get_inventory_service),
) -> List[InventoryItemResponseDTO]:
    return await service.list_items(
        current_user=current_user,
        property_id=property_id,
        low_stock_only=low_stock_only,
    )


@router.post(
    "/items",
    response_model=InventoryItemResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar novo item de suprimento para um imóvel",
)
async def create_item(
    dto: InventoryItemCreateDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: InventoryService = Depends(get_inventory_service),
) -> InventoryItemResponseDTO:
    return await service.create_item(current_user=current_user, dto=dto)


@router.post(
    "/movements",
    response_model=InventoryMovementResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar entrada, saída ou ajuste de estoque (com proteção contra saldo negativo)",
)
async def record_movement(
    dto: InventoryMovementCreateDTO,
    current_user: User = Depends(get_current_user),
    service: InventoryService = Depends(get_inventory_service),
) -> InventoryMovementResponseDTO:
    return await service.record_movement(current_user=current_user, dto=dto)


@router.get(
    "/movements",
    response_model=List[InventoryMovementResponseDTO],
    summary="Listar histórico de movimentações de estoque (livro-razão)",
)
async def list_movements(
    item_id: Optional[uuid.UUID] = Query(None, description="Filtrar por item"),
    property_id: Optional[uuid.UUID] = Query(None, description="Filtrar por imóvel"),
    current_user: User = Depends(get_current_user),
    service: InventoryService = Depends(get_inventory_service),
) -> List[InventoryMovementResponseDTO]:
    return await service.list_movements(
        current_user=current_user,
        item_id=item_id,
        property_id=property_id,
    )
