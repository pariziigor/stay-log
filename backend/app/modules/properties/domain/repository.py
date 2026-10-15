from abc import abstractmethod
from typing import List, Optional, Set
import uuid
from app.modules.properties.domain.entities import Amenity, Property
from app.modules.properties.domain.value_objects import PropertyStatus, PropertyType
from app.shared.infrastructure.base_repository import BaseRepository


class PropertyRepository(BaseRepository[Property]):
    """Porta do Repositório de Imóveis (Domain-Driven Design)."""

    @abstractmethod
    async def get_by_id(self, property_id: uuid.UUID) -> Optional[Property]:
        raise NotImplementedError

    @abstractmethod
    async def save(self, property_entity: Property) -> Property:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, property_id: uuid.UUID) -> None:
        raise NotImplementedError

    @abstractmethod
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
    ) -> List[Property]:
        raise NotImplementedError

    @abstractmethod
    async def count_properties(
        self,
        owner_id: Optional[uuid.UUID] = None,
        status: Optional[PropertyStatus] = None,
        property_type: Optional[PropertyType] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        min_guests: Optional[int] = None,
    ) -> int:
        raise NotImplementedError

    # Comodidades
    @abstractmethod
    async def list_amenities(self) -> List[Amenity]:
        raise NotImplementedError

    @abstractmethod
    async def get_amenities_by_ids(self, amenity_ids: Set[int]) -> List[Amenity]:
        raise NotImplementedError
