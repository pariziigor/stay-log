from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
import re
from typing import Optional
from app.core.exceptions import DomainException
from app.shared.domain.value_object import ValueObject


class PropertyType(str, Enum):
    APARTMENT = "apartment"
    HOUSE = "house"
    STUDIO = "studio"
    ROOM = "room"
    CHALET = "chalet"
    FARM = "farm"
    OTHER = "other"


class PropertyStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNDER_MAINTENANCE = "under_maintenance"


@dataclass(frozen=True)
class Address(ValueObject):
    """Value Object de Endereço do imóvel com validações de integridade."""

    street: str
    city: str
    state: str
    number: Optional[str] = None
    complement: Optional[str] = None
    neighborhood: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "BR"

    def __post_init__(self) -> None:
        if not self.street or len(self.street.strip()) < 3:
            raise DomainException("O logradouro deve ter pelo menos 3 caracteres.", error_code="INVALID_ADDRESS")
        if not self.city or len(self.city.strip()) < 2:
            raise DomainException("A cidade deve ter pelo menos 2 caracteres.", error_code="INVALID_ADDRESS")
        if not self.state or len(self.state.strip()) != 2:
            raise DomainException("A sigla do estado (UF) deve conter exatamente 2 letras.", error_code="INVALID_STATE")

        norm_state = self.state.strip().upper()
        if not norm_state.isalpha():
            raise DomainException("A sigla do estado (UF) deve conter apenas letras.", error_code="INVALID_STATE")
        object.__setattr__(self, "state", norm_state)

        if self.postal_code:
            clean_cep = re.sub(r"\D", "", self.postal_code)
            if len(clean_cep) != 8:
                raise DomainException("CEP deve conter 8 dígitos.", error_code="INVALID_POSTAL_CODE")
            object.__setattr__(self, "postal_code", f"{clean_cep[:5]}-{clean_cep[5:]}")


@dataclass(frozen=True)
class PropertyPricing(ValueObject):
    """Value Object encapsulando precificação básica e taxas de operação."""

    base_nightly_rate: Optional[Decimal] = None
    cleaning_fee: Decimal = Decimal("0.00")

    def __post_init__(self) -> None:
        if self.base_nightly_rate is not None and self.base_nightly_rate < 0:
            raise DomainException("A diária base não pode ser negativa.", error_code="INVALID_PRICING")
        if self.cleaning_fee < 0:
            raise DomainException("A taxa de limpeza não pode ser negativa.", error_code="INVALID_PRICING")
