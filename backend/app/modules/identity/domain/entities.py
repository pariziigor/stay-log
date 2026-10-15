from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid
from app.core.exceptions import DomainException
from app.modules.identity.domain.value_objects import ConsentType, Email, UserRole
from app.shared.domain.entity import BaseEntity


class User(BaseEntity):
    """Agregado Raiz do contexto de Identidade e Acesso."""

    def __init__(
        self,
        full_name: str,
        email: Email,
        password_hash: str,
        role: UserRole,
        id: Optional[uuid.UUID] = None,
        phone: Optional[str] = None,
        is_active: bool = True,
        failed_login_attempts: int = 0,
        locked_until: Optional[datetime] = None,
        last_login_at: Optional[datetime] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        deleted_at: Optional[datetime] = None,
    ):
        super().__init__(id=id, created_at=created_at, updated_at=updated_at)
        self._set_full_name(full_name)
        self._email = email
        self._password_hash = password_hash
        self._role = role
        self._phone = phone
        self._is_active = is_active
        self._failed_login_attempts = max(0, failed_login_attempts)
        self._locked_until = locked_until
        self._last_login_at = last_login_at
        self._deleted_at = deleted_at

    def _set_full_name(self, name: str) -> None:
        if not name or len(name.strip()) < 2:
            raise DomainException("Nome completo deve conter pelo menos 2 caracteres.", error_code="INVALID_NAME")
        self._full_name = name.strip()

    # --- Getters ---
    @property
    def full_name(self) -> str:
        return self._full_name

    @property
    def email(self) -> Email:
        return self._email

    @property
    def password_hash(self) -> str:
        return self._password_hash

    @property
    def role(self) -> UserRole:
        return self._role

    @property
    def phone(self) -> Optional[str]:
        return self._phone

    @property
    def is_active(self) -> bool:
        return self._is_active and self._deleted_at is None

    @property
    def failed_login_attempts(self) -> int:
        return self._failed_login_attempts

    @property
    def locked_until(self) -> Optional[datetime]:
        return self._locked_until

    @property
    def last_login_at(self) -> Optional[datetime]:
        return self._last_login_at

    @property
    def deleted_at(self) -> Optional[datetime]:
        return self._deleted_at

    # --- Métodos de Negócio e Comportamento ---
    def is_locked(self) -> bool:
        """Verifica se a conta está temporariamente bloqueada por força bruta."""
        if self._locked_until is None:
            return False
        now = datetime.now(timezone.utc)
        # Suporta datetime timezone-aware ou naive
        lock_time = self._locked_until if self._locked_until.tzinfo else self._locked_until.replace(tzinfo=timezone.utc)
        return now < lock_time

    def record_login_success(self) -> None:
        """Registra autenticação bem-sucedida, zerando falhas e carimbando acesso."""
        self._failed_login_attempts = 0
        self._locked_until = None
        self._last_login_at = datetime.now(timezone.utc)
        self.touch()

    def record_login_failure(self, max_attempts: int = 5, lock_minutes: int = 15) -> None:
        """Incrementa contador de tentativas incorretas e bloqueia temporariamente se exceder."""
        self._failed_login_attempts += 1
        if self._failed_login_attempts >= max_attempts:
            self._locked_until = datetime.now(timezone.utc) + timedelta(minutes=lock_minutes)
        self.touch()

    def unlock(self) -> None:
        """Desbloqueia a conta administrativamente."""
        self._failed_login_attempts = 0
        self._locked_until = None
        self.touch()

    def change_password(self, new_password_hash: str) -> None:
        """Altera o hash da senha."""
        if not new_password_hash:
            raise DomainException("Hash de senha inválido.")
        self._password_hash = new_password_hash
        self.touch()

    def update_profile(self, full_name: Optional[str] = None, phone: Optional[str] = None) -> None:
        if full_name:
            self._set_full_name(full_name)
        if phone is not None:
            self._phone = phone
        self.touch()

    def deactivate(self) -> None:
        """Desativa a conta do usuário."""
        self._is_active = False
        self._deleted_at = datetime.now(timezone.utc)
        self.touch()

    def can_manage_properties(self) -> bool:
        return self._role.can_manage_own_properties()


class RefreshToken(BaseEntity):
    """Entidade de Refresh Token com suporte a rotação e detecção de reutilização."""

    def __init__(
        self,
        user_id: uuid.UUID,
        token_hash: str,
        family_id: uuid.UUID,
        expires_at: datetime,
        id: Optional[uuid.UUID] = None,
        revoked_at: Optional[datetime] = None,
        replaced_by: Optional[uuid.UUID] = None,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ):
        super().__init__(id=id, created_at=created_at)
        self._user_id = user_id
        self._token_hash = token_hash
        self._family_id = family_id
        self._expires_at = expires_at
        self._revoked_at = revoked_at
        self._replaced_by = replaced_by
        self._user_agent = user_agent
        self._ip_address = ip_address

    @property
    def user_id(self) -> uuid.UUID:
        return self._user_id

    @property
    def token_hash(self) -> str:
        return self._token_hash

    @property
    def family_id(self) -> uuid.UUID:
        return self._family_id

    @property
    def expires_at(self) -> datetime:
        return self._expires_at

    @property
    def revoked_at(self) -> Optional[datetime]:
        return self._revoked_at

    @property
    def replaced_by(self) -> Optional[uuid.UUID]:
        return self._replaced_by

    @property
    def user_agent(self) -> Optional[str]:
        return self._user_agent

    @property
    def ip_address(self) -> Optional[str]:
        return self._ip_address

    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc)
        exp = self._expires_at if self._expires_at.tzinfo else self._expires_at.replace(tzinfo=timezone.utc)
        return now >= exp

    def is_active(self) -> bool:
        return self._revoked_at is None and not self.is_expired()

    def revoke(self, replaced_by: Optional[uuid.UUID] = None) -> None:
        """Revoga o token e opcionalmente associa ao substituto na rotação."""
        if self._revoked_at is None:
            self._revoked_at = datetime.now(timezone.utc)
        self._replaced_by = replaced_by


class UserConsent(BaseEntity):
    """Entidade para registro de consentimentos da LGPD (Art. 8)."""

    def __init__(
        self,
        user_id: uuid.UUID,
        consent_type: ConsentType,
        policy_version: str,
        id: Optional[uuid.UUID] = None,
        granted_at: Optional[datetime] = None,
        revoked_at: Optional[datetime] = None,
        ip_address: Optional[str] = None,
    ):
        super().__init__(id=id, created_at=granted_at)
        self._user_id = user_id
        self._consent_type = consent_type
        self._policy_version = policy_version
        self._granted_at = granted_at or datetime.now(timezone.utc)
        self._revoked_at = revoked_at
        self._ip_address = ip_address

    @property
    def user_id(self) -> uuid.UUID:
        return self._user_id

    @property
    def consent_type(self) -> ConsentType:
        return self._consent_type

    @property
    def policy_version(self) -> str:
        return self._policy_version

    @property
    def granted_at(self) -> datetime:
        return self._granted_at

    @property
    def revoked_at(self) -> Optional[datetime]:
        return self._revoked_at

    @property
    def ip_address(self) -> Optional[str]:
        return self._ip_address

    def revoke(self) -> None:
        self._revoked_at = datetime.now(timezone.utc)
