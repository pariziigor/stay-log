from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.properties.application.dtos import (
    AmenityResponseDTO,
    PropertyCreateDTO,
    PropertyListResponseDTO,
    PropertyResponseDTO,
    PropertyUpdateDTO,
)
from app.modules.properties.application.services import PropertyService
from app.modules.properties.domain.repository import PropertyRepository
from app.modules.properties.domain.value_objects import PropertyStatus, PropertyType
from app.modules.properties.infrastructure.repositories import SQLAlchemyPropertyRepository

router = APIRouter(prefix="/properties", tags=["Imóveis & Propriedades"])


def get_property_repository(session: AsyncSession = Depends(get_db_session)) -> PropertyRepository:
    return SQLAlchemyPropertyRepository(session)


def get_property_service(
    property_repo: PropertyRepository = Depends(get_property_repository),
) -> PropertyService:
    return PropertyService(property_repo)


@router.get(
    "/catalog/amenities",
    response_model=List[AmenityResponseDTO],
    summary="Listar catálogo geral de comodidades e características",
    description="Retorna comodidades padronizadas (Wi-Fi, piscina, ar-condicionado, etc.) para seleção no cadastro.",
)
async def list_amenities_catalog(
    property_service: PropertyService = Depends(get_property_service),
) -> List[AmenityResponseDTO]:
    return await property_service.list_available_amenities()


@router.post(
    "",
    response_model=PropertyResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar novo imóvel de locação",
    description="Permite que proprietários e administradores cadastrem imóveis com capacidade, regras e comodidades.",
)
async def create_property(
    dto: PropertyCreateDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    property_service: PropertyService = Depends(get_property_service),
) -> PropertyResponseDTO:
    return await property_service.create_property(owner_id=current_user.id, dto=dto)


@router.get(
    "",
    response_model=PropertyListResponseDTO,
    summary="Listar imóveis com filtros e paginação",
    description="Proprietários visualizam apenas seus próprios imóveis. Administradores visualizam todos os cadastros.",
)
async def list_properties(
    owner_id: Optional[uuid.UUID] = Query(None, description="Filtro de proprietário (disponível para administradores)"),
    status: Optional[PropertyStatus] = Query(None, description="Filtro por status (active, inactive, under_maintenance)"),
    property_type: Optional[PropertyType] = Query(None, description="Filtro por tipo de propriedade"),
    city: Optional[str] = Query(None, description="Busca textual por cidade"),
    state: Optional[str] = Query(None, min_length=2, max_length=2, description="Sigla do estado UF"),
    min_guests: Optional[int] = Query(None, ge=1, description="Capacidade mínima de hóspedes"),
    page: int = Query(1, ge=1, description="Número da página"),
    page_size: int = Query(20, ge=1, le=100, description="Registros por página"),
    current_user: User = Depends(get_current_user),
    property_service: PropertyService = Depends(get_property_service),
) -> PropertyListResponseDTO:
    return await property_service.list_properties(
        current_user=current_user,
        owner_id_filter=owner_id,
        status=status,
        property_type=property_type,
        city=city,
        state=state,
        min_guests=min_guests,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{property_id}",
    response_model=PropertyResponseDTO,
    summary="Consultar detalhes de um imóvel",
)
async def get_property(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    property_service: PropertyService = Depends(get_property_service),
) -> PropertyResponseDTO:
    return await property_service.get_property(property_id=property_id, current_user=current_user)


@router.put(
    "/{property_id}",
    response_model=PropertyResponseDTO,
    summary="Atualizar informações de um imóvel",
    description="Permite alterar capacidade, tarifas, regras, endereços e lista de comodidades.",
)
async def update_property(
    property_id: uuid.UUID,
    dto: PropertyUpdateDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    property_service: PropertyService = Depends(get_property_service),
) -> PropertyResponseDTO:
    return await property_service.update_property(
        property_id=property_id,
        current_user=current_user,
        dto=dto,
    )


@router.delete(
    "/{property_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover imóvel (Soft Delete)",
    description="Desativa o imóvel preservando o histórico de reservas e lançamentos financeiros.",
)
async def delete_property(
    property_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    property_service: PropertyService = Depends(get_property_service),
) -> None:
    await property_service.delete_property(property_id=property_id, current_user=current_user)
