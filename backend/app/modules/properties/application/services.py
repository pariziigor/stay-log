from typing import List, Optional, Set
import uuid
from app.core.exceptions import ForbiddenError
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.properties.application.dtos import (
    AddressDTO,
    AmenityResponseDTO,
    PropertyCreateDTO,
    PropertyListResponseDTO,
    PropertyResponseDTO,
    PropertyUpdateDTO,
)
from app.modules.properties.domain.entities import Amenity, Property
from app.modules.properties.domain.exceptions import (
    AmenityNotFoundError,
    PropertyNotFoundError,
    UnauthorizedPropertyAccessError,
)
from app.modules.properties.domain.repository import PropertyRepository
from app.modules.properties.domain.value_objects import (
    Address,
    PropertyPricing,
    PropertyStatus,
    PropertyType,
)


class PropertyService:
    """Application Service responsável pelos casos de uso do domínio de Imóveis (RF-03, RF-04)."""

    def __init__(self, property_repo: PropertyRepository):
        self._property_repo = property_repo

    async def _build_response_dto(
        self,
        property_entity: Property,
        preloaded_amenities: Optional[List[Amenity]] = None,
    ) -> PropertyResponseDTO:
        if preloaded_amenities is not None:
            amenities = preloaded_amenities
        else:
            amenities = await self._property_repo.get_amenities_by_ids(property_entity.amenity_ids)
        amenity_dtos = [
            AmenityResponseDTO(
                id=a.id,
                code=a.code,
                name=a.name,
                category=a.category,
            )
            for a in amenities
        ]
        return PropertyResponseDTO(
            id=property_entity.id,
            owner_id=property_entity.owner_id,
            name=property_entity.name,
            description=property_entity.description,
            property_type=property_entity.property_type,
            status=property_entity.status,
            address=AddressDTO(
                street=property_entity.address.street,
                number=property_entity.address.number,
                complement=property_entity.address.complement,
                neighborhood=property_entity.address.neighborhood,
                city=property_entity.address.city,
                state=property_entity.address.state,
                postal_code=property_entity.address.postal_code,
                country=property_entity.address.country,
            ),
            max_guests=property_entity.max_guests,
            bedrooms=property_entity.bedrooms,
            bathrooms=property_entity.bathrooms,
            beds=property_entity.beds,
            area_m2=property_entity.area_m2,
            base_nightly_rate=property_entity.pricing.base_nightly_rate,
            cleaning_fee=property_entity.pricing.cleaning_fee,
            check_in_time=property_entity.check_in_time,
            check_out_time=property_entity.check_out_time,
            amenities=amenity_dtos,
            created_at=property_entity.created_at,
            updated_at=property_entity.updated_at,
        )

    async def create_property(
        self,
        owner_id: uuid.UUID,
        dto: PropertyCreateDTO,
    ) -> PropertyResponseDTO:
        address_vo = Address(
            street=dto.address.street,
            number=dto.address.number,
            complement=dto.address.complement,
            neighborhood=dto.address.neighborhood,
            city=dto.address.city,
            state=dto.address.state,
            postal_code=dto.address.postal_code,
            country=dto.address.country,
        )
        pricing_vo = PropertyPricing(
            base_nightly_rate=dto.base_nightly_rate,
            cleaning_fee=dto.cleaning_fee,
        )

        property_entity = Property(
            owner_id=owner_id,
            name=dto.name,
            description=dto.description,
            property_type=dto.property_type,
            status=PropertyStatus.ACTIVE,
            address=address_vo,
            max_guests=dto.max_guests,
            bedrooms=dto.bedrooms,
            bathrooms=dto.bathrooms,
            beds=dto.beds,
            area_m2=dto.area_m2,
            pricing=pricing_vo,
            check_in_time=dto.check_in_time,
            check_out_time=dto.check_out_time,
            amenity_ids=set(dto.amenity_ids),
        )

        saved = await self._property_repo.save(property_entity)
        return await self._build_response_dto(saved)

    async def get_property(
        self,
        property_id: uuid.UUID,
        current_user: User,
    ) -> PropertyResponseDTO:
        prop = await self._property_repo.get_by_id(property_id)
        if prop is None:
            raise PropertyNotFoundError(str(property_id))

        # RBAC: Proprietário só visualiza seus imóveis; Admin visualiza qualquer um;
        # Funcionário só visualiza imóveis de proprietários aos quais está vinculado.
        if current_user.role == UserRole.OWNER and prop.owner_id != current_user.id:
            raise UnauthorizedPropertyAccessError()
        if current_user.role == UserRole.EMPLOYEE:
            allowed_owners = await self._property_repo.list_owner_ids_for_employee(current_user.id)
            if prop.owner_id not in allowed_owners:
                raise UnauthorizedPropertyAccessError()

        return await self._build_response_dto(prop)

    async def list_properties(
        self,
        current_user: User,
        owner_id_filter: Optional[uuid.UUID] = None,
        status: Optional[PropertyStatus] = None,
        property_type: Optional[PropertyType] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        min_guests: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PropertyListResponseDTO:
        skip = (page - 1) * page_size
        limit = page_size

        # Tenant isolation: Proprietários só têm acesso aos seus próprios imóveis
        allowed_owner_ids = None
        if current_user.role == UserRole.OWNER:
            effective_owner_id = current_user.id
        elif current_user.role == UserRole.ADMIN:
            effective_owner_id = owner_id_filter
        else:
            # Funcionários: apenas imóveis dos proprietários cujas equipes integram.
            effective_owner_id = owner_id_filter
            allowed_owner_ids = await self._property_repo.list_owner_ids_for_employee(current_user.id)
            if not allowed_owner_ids:
                return PropertyListResponseDTO(total=0, page=page, page_size=page_size, items=[])

        items = await self._property_repo.list_properties(
            owner_id=effective_owner_id,
            status=status,
            property_type=property_type,
            city=city,
            state=state,
            min_guests=min_guests,
            skip=skip,
            limit=limit,
            owner_ids=allowed_owner_ids,
        )
        total = await self._property_repo.count_properties(
            owner_id=effective_owner_id,
            status=status,
            property_type=property_type,
            city=city,
            state=state,
            min_guests=min_guests,
            owner_ids=allowed_owner_ids,
        )

        all_amenity_ids: Set[int] = {aid for p in items for aid in p.amenity_ids}
        all_amenities = await self._property_repo.get_amenities_by_ids(all_amenity_ids)
        amenities_by_id = {a.id: a for a in all_amenities}

        dtos = [
            await self._build_response_dto(
                p,
                preloaded_amenities=[amenities_by_id[aid] for aid in sorted(p.amenity_ids) if aid in amenities_by_id],
            )
            for p in items
        ]
        return PropertyListResponseDTO(
            total=total,
            page=page,
            page_size=page_size,
            items=dtos,
        )

    async def update_property(
        self,
        property_id: uuid.UUID,
        current_user: User,
        dto: PropertyUpdateDTO,
    ) -> PropertyResponseDTO:
        prop = await self._property_repo.get_by_id(property_id)
        if prop is None:
            raise PropertyNotFoundError(str(property_id))

        if current_user.role == UserRole.OWNER:
            prop.assert_owned_by(current_user.id)
        elif current_user.role != UserRole.ADMIN:
            raise ForbiddenError("Apenas o proprietário ou um administrador pode alterar as configurações do imóvel.")

        # Atualização de endereço
        current_addr = prop.address
        if dto.address:
            new_address = Address(
                street=dto.address.street,
                number=dto.address.number,
                complement=dto.address.complement,
                neighborhood=dto.address.neighborhood,
                city=dto.address.city,
                state=dto.address.state,
                postal_code=dto.address.postal_code,
                country=dto.address.country,
            )
        else:
            new_address = current_addr

        # Atualização de precificação
        new_pricing = PropertyPricing(
            base_nightly_rate=dto.base_nightly_rate if dto.base_nightly_rate is not None else prop.pricing.base_nightly_rate,
            cleaning_fee=dto.cleaning_fee if dto.cleaning_fee is not None else prop.pricing.cleaning_fee,
        )

        prop.update_details(
            name=dto.name if dto.name is not None else prop.name,
            description=dto.description if dto.description is not None else prop.description,
            property_type=dto.property_type or prop.property_type,
            address=new_address,
            max_guests=dto.max_guests or prop.max_guests,
            bedrooms=dto.bedrooms if dto.bedrooms is not None else prop.bedrooms,
            bathrooms=dto.bathrooms if dto.bathrooms is not None else prop.bathrooms,
            beds=dto.beds if dto.beds is not None else prop.beds,
            area_m2=dto.area_m2 if dto.area_m2 is not None else prop.area_m2,
            pricing=new_pricing,
            check_in_time=dto.check_in_time or prop.check_in_time,
            check_out_time=dto.check_out_time or prop.check_out_time,
        )

        if dto.status is not None:
            prop.set_status(dto.status)

        if dto.amenity_ids is not None:
            prop.sync_amenities(set(dto.amenity_ids))

        saved = await self._property_repo.save(prop)
        return await self._build_response_dto(saved)

    async def delete_property(
        self,
        property_id: uuid.UUID,
        current_user: User,
    ) -> None:
        prop = await self._property_repo.get_by_id(property_id)
        if prop is None:
            raise PropertyNotFoundError(str(property_id))

        if current_user.role == UserRole.OWNER:
            prop.assert_owned_by(current_user.id)
        elif current_user.role != UserRole.ADMIN:
            raise ForbiddenError("Apenas o proprietário ou um administrador pode remover este imóvel.")

        prop.soft_delete()
        await self._property_repo.save(prop)

    async def list_available_amenities(self) -> List[AmenityResponseDTO]:
        amenities = await self._property_repo.list_amenities()
        return [
            AmenityResponseDTO(
                id=a.id,
                code=a.code,
                name=a.name,
                category=a.category,
            )
            for a in amenities
        ]
