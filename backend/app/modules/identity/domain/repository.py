from abc import abstractmethod
from typing import List, Optional
import uuid
from app.modules.identity.domain.entities import RefreshToken, User, UserConsent
from app.modules.identity.domain.value_objects import ConsentType, Email, UserRole
from app.shared.infrastructure.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    """Porta do Repositório de Usuários no contexto de Identidade."""

    @abstractmethod
    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        raise NotImplementedError

    @abstractmethod
    async def get_by_email(self, email: Email) -> Optional[User]:
        raise NotImplementedError

    @abstractmethod
    async def save(self, user: User) -> User:
        raise NotImplementedError

    @abstractmethod
    async def list_users(
        self,
        skip: int = 0,
        limit: int = 50,
        role: Optional[UserRole] = None,
        only_active: bool = True,
    ) -> List[User]:
        raise NotImplementedError

    # Gerenciamento de Refresh Tokens
    @abstractmethod
    async def save_refresh_token(self, token: RefreshToken) -> RefreshToken:
        raise NotImplementedError

    @abstractmethod
    async def get_refresh_token_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        raise NotImplementedError

    @abstractmethod
    async def revoke_refresh_token_family(self, family_id: uuid.UUID) -> None:
        raise NotImplementedError

    # Gerenciamento de Consentimentos LGPD
    @abstractmethod
    async def save_consent(self, consent: UserConsent) -> UserConsent:
        raise NotImplementedError

    @abstractmethod
    async def get_active_consent(
        self,
        user_id: uuid.UUID,
        consent_type: ConsentType,
    ) -> Optional[UserConsent]:
        raise NotImplementedError
