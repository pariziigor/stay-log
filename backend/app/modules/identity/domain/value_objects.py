from enum import Enum
import re
from dataclasses import dataclass
from app.core.exceptions import DomainException
from app.shared.domain.value_object import ValueObject


class UserRole(str, Enum):
    ADMIN = "admin"
    OWNER = "owner"
    EMPLOYEE = "employee"

    def can_manage_all_properties(self) -> bool:
        return self == UserRole.ADMIN

    def can_manage_own_properties(self) -> bool:
        return self in (UserRole.ADMIN, UserRole.OWNER)

    def is_operational_staff(self) -> bool:
        return self == UserRole.EMPLOYEE


class ConsentType(str, Enum):
    TERMS_OF_USE = "terms_of_use"
    PRIVACY_POLICY = "privacy_policy"
    MARKETING = "marketing"
    AI_DATA_PROCESSING = "ai_data_processing"


@dataclass(frozen=True)
class Email(ValueObject):
    """Value Object de E-mail com validação e normalização case-insensitive."""

    value: str

    def __post_init__(self) -> None:
        if not self.value or not isinstance(self.value, str):
            raise DomainException("O e-mail não pode ser vazio.", error_code="INVALID_EMAIL")
        normalized = self.value.strip().lower()
        # Validação RFC 5322 simplificada
        pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
        if not re.match(pattern, normalized):
            raise DomainException(f"Formato de e-mail inválido: '{self.value}'", error_code="INVALID_EMAIL")
        object.__setattr__(self, "value", normalized)

    def __str__(self) -> str:
        return self.value
