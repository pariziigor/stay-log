from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Set
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.modules.identity.infrastructure.models import TeamMemberModel
from app.modules.properties.domain.entities import Amenity, Property
from app.modules.properties.domain.repository import PropertyRepository
from app.modules.properties.domain.value_objects import (
    Address,
    PropertyPricing,
    PropertyStatus,
    PropertyType,
)
from app.modules.properties.infrastructure.models import (
    AmenityModel,
    PropertyAmenityModel,
    PropertyModel,
)


class SQLAlchemyPropertyRepository(PropertyRepository):
    """Adaptador de infraestrutura do Repositório de Imóveis via SQLAlchemy Assíncrono."""

    def __init__(self, session: AsyncSession):
        self._session = session

    # --- Mapeadores Domínio ↔ ORM ---
    @staticmethod
    def _to_domain_amenity(model: AmenityModel) -> Amenity:
        return Amenity(
            id=model.id,
            code=model.code,
            name=model.name,
            category=model.category,
        )

    @classmethod
    def _to_domain_property(cls, model: PropertyModel) -> Property:
        amenity_ids = {pa.amenity_id for pa in model.property_amenities}
        address = Address(
            street=model.address_street,
            number=model.address_number,
            complement=model.address_complement,
            neighborhood=model.address_neighborhood,
            city=model.address_city,
            state=model.address_state,
            postal_code=model.address_postal_code,
            country=model.address_country,
        )
        pricing = PropertyPricing(
            base_nightly_rate=model.base_nightly_rate,
            cleaning_fee=model.cleaning_fee,
        )
        return Property(
            id=model.id,
            owner_id=model.owner_id,
            name=model.name,
            description=model.description,
            property_type=PropertyType(model.property_type),
            status=PropertyStatus(model.status),
            address=address,
            max_guests=model.max_guests,
            bedrooms=model.bedrooms,
            bathrooms=model.bathrooms,
            beds=model.beds,
            area_m2=model.area_m2,
            pricing=pricing,
            check_in_time=model.check_in_time,
            check_out_time=model.check_out_time,
            amenity_ids=amenity_ids,
            created_at=model.created_at,
            updated_at=model.updated_at,
            deleted_at=model.deleted_at,
        )

    # --- Operações do Repositório ---
    async def get_by_id(self, property_id: uuid.UUID) -> Optional[Property]:
        stmt = (
            select(PropertyModel)
            .options(selectinload(PropertyModel.property_amenities))
            .where(PropertyModel.id == property_id, PropertyModel.deleted_at.is_(None))
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain_property(model) if model else None

    async def save(self, property_entity: Property) -> Property:
        stmt = (
            select(PropertyModel)
            .options(selectinload(PropertyModel.property_amenities))
            .where(PropertyModel.id == property_entity.id)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            model = PropertyModel(
                id=property_entity.id,
                owner_id=property_entity.owner_id,
                name=property_entity.name,
                description=property_entity.description,
                property_type=property_entity.property_type.value,
                status=property_entity.status.value,
                address_street=property_entity.address.street,
                address_number=property_entity.address.number,
                address_complement=property_entity.address.complement,
                address_neighborhood=property_entity.address.neighborhood,
                address_city=property_entity.address.city,
                address_state=property_entity.address.state,
                address_postal_code=property_entity.address.postal_code,
                address_country=property_entity.address.country,
                max_guests=property_entity.max_guests,
                bedrooms=property_entity.bedrooms,
                bathrooms=property_entity.bathrooms,
                beds=property_entity.beds,
                area_m2=property_entity.area_m2,
                base_nightly_rate=property_entity.pricing.base_nightly_rate,
                cleaning_fee=property_entity.pricing.cleaning_fee,
                check_in_time=property_entity.check_in_time,
                check_out_time=property_entity.check_out_time,
                created_at=property_entity.created_at,
                updated_at=property_entity.updated_at,
                deleted_at=property_entity.deleted_at,
                # Coleção explícita: sem isso, imóvel sem comodidades dispara lazy-load
                # (I/O fora do greenlet) e falha com MissingGreenlet / HTTP 500.
                property_amenities=[],
            )
            self._session.add(model)
        else:
            model.name = property_entity.name
            model.description = property_entity.description
            model.property_type = property_entity.property_type.value
            model.status = property_entity.status.value
            model.address_street = property_entity.address.street
            model.address_number = property_entity.address.number
            model.address_complement = property_entity.address.complement
            model.address_neighborhood = property_entity.address.neighborhood
            model.address_city = property_entity.address.city
            model.address_state = property_entity.address.state
            model.address_postal_code = property_entity.address.postal_code
            model.address_country = property_entity.address.country
            model.max_guests = property_entity.max_guests
            model.bedrooms = property_entity.bedrooms
            model.bathrooms = property_entity.bathrooms
            model.beds = property_entity.beds
            model.area_m2 = property_entity.area_m2
            model.base_nightly_rate = property_entity.pricing.base_nightly_rate
            model.cleaning_fee = property_entity.pricing.cleaning_fee
            model.check_in_time = property_entity.check_in_time
            model.check_out_time = property_entity.check_out_time
            model.updated_at = property_entity.updated_at
            model.deleted_at = property_entity.deleted_at

        # Sincronização atômica de comodidades vinculadas
        current_amenity_ids = {pa.amenity_id for pa in model.property_amenities}
        target_amenity_ids = property_entity.amenity_ids

        # Remover desassociadas
        to_remove = [pa for pa in model.property_amenities if pa.amenity_id not in target_amenity_ids]
        for pa in to_remove:
            model.property_amenities.remove(pa)

        # Adicionar novas
        to_add = target_amenity_ids - current_amenity_ids
        for aid in to_add:
            model.property_amenities.append(PropertyAmenityModel(property_id=model.id, amenity_id=aid))

        await self._session.flush()
        return self._to_domain_property(model)

    async def delete(self, property_id: uuid.UUID) -> None:
        """Soft delete da propriedade para preservar histórico de reservas e financeiro."""
        stmt = select(PropertyModel).where(PropertyModel.id == property_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model:
            model.status = PropertyStatus.INACTIVE.value
            model.deleted_at = datetime.now(timezone.utc)
            await self._session.flush()

    def _apply_filters(
        self,
        stmt,
        owner_id: Optional[uuid.UUID] = None,
        status: Optional[PropertyStatus] = None,
        property_type: Optional[PropertyType] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        min_guests: Optional[int] = None,
        owner_ids: Optional[Set[uuid.UUID]] = None,
    ):
        stmt = stmt.where(PropertyModel.deleted_at.is_(None))
        if owner_id:
            stmt = stmt.where(PropertyModel.owner_id == owner_id)
        if owner_ids is not None:
            # `is not None` é deliberado: conjunto vazio significa "nenhum imóvel", nunca "sem filtro".
            stmt = stmt.where(PropertyModel.owner_id.in_(owner_ids))
        if status:
            stmt = stmt.where(PropertyModel.status == status.value)
        if property_type:
            stmt = stmt.where(PropertyModel.property_type == property_type.value)
        if city:
            stmt = stmt.where(PropertyModel.address_city.ilike(f"%{city.strip()}%"))
        if state:
            stmt = stmt.where(PropertyModel.address_state == state.strip().upper())
        if min_guests:
            stmt = stmt.where(PropertyModel.max_guests >= min_guests)
        return stmt

    async def list_properties(
        self,
        owner_id: Optional[uuid.UUID] = None,
        status: Optional[PropertyStatus] = None,
        property_type: Optional[PropertyType] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        min_guests: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
        owner_ids: Optional[Set[uuid.UUID]] = None,
    ) -> List[Property]:
        stmt = select(PropertyModel).options(selectinload(PropertyModel.property_amenities))
        stmt = self._apply_filters(stmt, owner_id, status, property_type, city, state, min_guests, owner_ids)
        stmt = stmt.offset(skip).limit(limit).order_by(PropertyModel.created_at.desc())

        result = await self._session.execute(stmt)
        return [self._to_domain_property(m) for m in result.scalars().all()]

    async def count_properties(
        self,
        owner_id: Optional[uuid.UUID] = None,
        status: Optional[PropertyStatus] = None,
        property_type: Optional[PropertyType] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        min_guests: Optional[int] = None,
        owner_ids: Optional[Set[uuid.UUID]] = None,
    ) -> int:
        stmt = select(func.count(PropertyModel.id))
        stmt = self._apply_filters(stmt, owner_id, status, property_type, city, state, min_guests, owner_ids)
        result = await self._session.execute(stmt)
        return result.scalar_one() or 0

    async def list_owner_ids_for_employee(self, employee_id: uuid.UUID) -> Set[uuid.UUID]:
        stmt = select(TeamMemberModel.owner_id).where(
            TeamMemberModel.employee_id == employee_id,
            TeamMemberModel.is_active.is_(True),
        )
        result = await self._session.execute(stmt)
        return set(result.scalars().all())

    async def list_amenities(self) -> List[Amenity]:
        stmt = select(AmenityModel).order_by(AmenityModel.category, AmenityModel.name)
        result = await self._session.execute(stmt)
        return [self._to_domain_amenity(m) for m in result.scalars().all()]

    async def get_amenities_by_ids(self, amenity_ids: Set[int]) -> List[Amenity]:
        if not amenity_ids:
            return []
        stmt = select(AmenityModel).where(AmenityModel.id.in_(amenity_ids))
        result = await self._session.execute(stmt)
        return [self._to_domain_amenity(m) for m in result.scalars().all()]
