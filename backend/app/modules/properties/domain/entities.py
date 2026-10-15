from datetime import datetime, time, timezone
from decimal import Decimal
from typing import List, Optional, Set
import uuid
from app.core.exceptions import DomainException
from app.modules.properties.domain.exceptions import UnauthorizedPropertyAccessError
from app.modules.properties.domain.value_objects import (
    Address,
    PropertyPricing,
    PropertyStatus,
    PropertyType,
)
from app.shared.domain.entity import BaseEntity


class Amenity(BaseEntity):
    """Entidade do catálogo de comodidades/características do imóvel (RF-04)."""

    def __init__(
        self,
        id: int,
        code: str,
        name: str,
        category: str,
    ):
        super().__init__()
        self._int_id = id
        self._code = code
        self._name = name
        self._category = category

    @property
    def id(self) -> int:  # type: ignore[override]
        return self._int_id

    @property
    def code(self) -> str:
        return self._code

    @property
    def name(self) -> str:
        return self._name

    @property
    def category(self) -> str:
        return self._category


class Property(BaseEntity):
    """Agregado Raiz do contexto de Imóveis (RF-03, RF-04)."""

    def __init__(
        self,
        owner_id: uuid.UUID,
        name: str,
        address: Address,
        max_guests: int,
        id: Optional[uuid.UUID] = None,
        description: Optional[str] = None,
        property_type: PropertyType = PropertyType.APARTMENT,
        status: PropertyStatus = PropertyStatus.ACTIVE,
        bedrooms: int = 0,
        bathrooms: int = 1,
        beds: int = 1,
        area_m2: Optional[Decimal] = None,
        pricing: Optional[PropertyPricing] = None,
        check_in_time: time = time(15, 0),
        check_out_time: time = time(11, 0),
        amenity_ids: Optional[Set[int]] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        deleted_at: Optional[datetime] = None,
    ):
        super().__init__(id=id, created_at=created_at, updated_at=updated_at)
        self._owner_id = owner_id
        self._set_name(name)
        self._description = description
        self._property_type = property_type
        self._status = status
        self._address = address
        self._set_capacity(max_guests, bedrooms, bathrooms, beds, area_m2)
        self._pricing = pricing or PropertyPricing()
        self._check_in_time = check_in_time
        self._check_out_time = check_out_time
        self._amenity_ids: Set[int] = set(amenity_ids or [])
        self._deleted_at = deleted_at

    def _set_name(self, name: str) -> None:
        if not name or len(name.strip()) < 2:
            raise DomainException("O nome do imóvel deve ter no mínimo 2 caracteres.", error_code="INVALID_PROPERTY_NAME")
        self._name = name.strip()

    def _set_capacity(
        self,
        max_guests: int,
        bedrooms: int,
        bathrooms: int,
        beds: int,
        area_m2: Optional[Decimal],
    ) -> None:
        if max_guests < 1 or max_guests > 100:
            raise DomainException("A capacidade máxima de hóspedes deve estar entre 1 e 100.", error_code="INVALID_CAPACITY")
        if bedrooms < 0 or bathrooms < 0 or beds < 0:
            raise DomainException("Quantidade de quartos, banheiros e camas não pode ser negativa.", error_code="INVALID_ROOMS")
        if area_m2 is not None and area_m2 <= 0:
            raise DomainException("A área em m² deve ser maior que zero.", error_code="INVALID_AREA")

        self._max_guests = max_guests
        self._bedrooms = bedrooms
        self._bathrooms = bathrooms
        self._beds = beds
        self._area_m2 = area_m2

    # --- Getters ---
    @property
    def owner_id(self) -> uuid.UUID:
        return self._owner_id

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> Optional[str]:
        return self._description

    @property
    def property_type(self) -> PropertyType:
        return self._property_type

    @property
    def status(self) -> PropertyStatus:
        return self._status

    @property
    def address(self) -> Address:
        return self._address

    @property
    def max_guests(self) -> int:
        return self._max_guests

    @property
    def bedrooms(self) -> int:
        return self._bedrooms

    @property
    def bathrooms(self) -> int:
        return self._bathrooms

    @property
    def beds(self) -> int:
        return self._beds

    @property
    def area_m2(self) -> Optional[Decimal]:
        return self._area_m2

    @property
    def pricing(self) -> PropertyPricing:
        return self._pricing

    @property
    def check_in_time(self) -> time:
        return self._check_in_time

    @property
    def check_out_time(self) -> time:
        return self._check_out_time

    @property
    def amenity_ids(self) -> Set[int]:
        return set(self._amenity_ids)

    @property
    def deleted_at(self) -> Optional[datetime]:
        return self._deleted_at

    @property
    def is_active(self) -> bool:
        return self._status == PropertyStatus.ACTIVE and self._deleted_at is None

    # --- Métodos de Negócio e Comportamento ---
    def update_details(
        self,
        name: str,
        description: Optional[str],
        property_type: PropertyType,
        address: Address,
        max_guests: int,
        bedrooms: int,
        bathrooms: int,
        beds: int,
        area_m2: Optional[Decimal],
        pricing: PropertyPricing,
        check_in_time: time,
        check_out_time: time,
    ) -> None:
        self._set_name(name)
        self._description = description
        self._property_type = property_type
        self._address = address
        self._set_capacity(max_guests, bedrooms, bathrooms, beds, area_m2)
        self._pricing = pricing
        self._check_in_time = check_in_time
        self._check_out_time = check_out_time
        self.touch()

    def set_status(self, new_status: PropertyStatus) -> None:
        self._status = new_status
        self.touch()

    def activate(self) -> None:
        self.set_status(PropertyStatus.ACTIVE)

    def deactivate(self) -> None:
        self.set_status(PropertyStatus.INACTIVE)

    def mark_under_maintenance(self) -> None:
        self.set_status(PropertyStatus.UNDER_MAINTENANCE)

    def sync_amenities(self, new_amenity_ids: Set[int]) -> None:
        """Sincroniza o conjunto de comodidades vinculadas ao imóvel."""
        self._amenity_ids = set(new_amenity_ids)
        self.touch()

    def add_amenity(self, amenity_id: int) -> None:
        self._amenity_ids.add(amenity_id)
        self.touch()

    def remove_amenity(self, amenity_id: int) -> None:
        self._amenity_ids.discard(amenity_id)
        self.touch()

    def soft_delete(self) -> None:
        """Marca o imóvel como excluído de forma reversível e preserva auditoria."""
        self._status = PropertyStatus.INACTIVE
        self._deleted_at = datetime.now(timezone.utc)
        self.touch()

    def assert_owned_by(self, user_id: uuid.UUID) -> None:
        """Verifica se o usuário fornecido é o proprietário legítimo."""
        if self._owner_id != user_id:
            raise UnauthorizedPropertyAccessError("Acesso negado: você não é o proprietário deste imóvel.")
