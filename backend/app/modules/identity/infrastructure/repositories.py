from datetime import datetime, timezone
from typing import List, Optional
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.identity.domain.entities import RefreshToken, User, UserConsent
from app.modules.identity.domain.repository import UserRepository
from app.modules.identity.domain.value_objects import ConsentType, Email, UserRole
from app.modules.identity.infrastructure.models import (
    RefreshTokenModel,
    UserConsentModel,
    UserModel,
)


class SQLAlchemyUserRepository(UserRepository):
    """Adaptador de infraestrutura do Repositório de Usuários utilizando SQLAlchemy Assíncrono."""

    def __init__(self, session: AsyncSession):
        self._session = session

    # --- Mapeadores de Domínio ↔ ORM ---
    @staticmethod
    def _to_domain_user(model: UserModel) -> User:
        return User(
            id=model.id,
            full_name=model.full_name,
            email=Email(model.email),
            password_hash=model.password_hash,
            role=UserRole(model.role),
            phone=model.phone,
            is_active=model.is_active,
            failed_login_attempts=model.failed_login_attempts,
            locked_until=model.locked_until,
            last_login_at=model.last_login_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
            deleted_at=model.deleted_at,
        )

    @staticmethod
    def _to_domain_refresh_token(model: RefreshTokenModel) -> RefreshToken:
        return RefreshToken(
            id=model.id,
            user_id=model.user_id,
            token_hash=model.token_hash,
            family_id=model.family_id,
            expires_at=model.expires_at,
            revoked_at=model.revoked_at,
            replaced_by=model.replaced_by,
            user_agent=model.user_agent,
            ip_address=model.ip_address,
            created_at=model.created_at,
        )

    @staticmethod
    def _to_domain_consent(model: UserConsentModel) -> UserConsent:
        return UserConsent(
            id=model.id,
            user_id=model.user_id,
            consent_type=ConsentType(model.consent_type),
            policy_version=model.policy_version,
            granted_at=model.granted_at,
            revoked_at=model.revoked_at,
            ip_address=model.ip_address,
        )

    # --- Operações de Usuário ---
    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        stmt = select(UserModel).where(UserModel.id == user_id, UserModel.deleted_at.is_(None))
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain_user(model) if model else None

    async def get_by_email(self, email: Email) -> Optional[User]:
        stmt = select(UserModel).where(
            UserModel.email == email.value,
            UserModel.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain_user(model) if model else None

    async def save(self, user: User) -> User:
        stmt = select(UserModel).where(UserModel.id == user.id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            model = UserModel(
                id=user.id,
                full_name=user.full_name,
                email=user.email.value,
                password_hash=user.password_hash,
                role=user.role.value,
                phone=user.phone,
                is_active=user.is_active,
                failed_login_attempts=user.failed_login_attempts,
                locked_until=user.locked_until,
                last_login_at=user.last_login_at,
                created_at=user.created_at,
                updated_at=user.updated_at,
                deleted_at=user.deleted_at,
            )
            self._session.add(model)
        else:
            model.full_name = user.full_name
            model.email = user.email.value
            model.password_hash = user.password_hash
            model.role = user.role.value
            model.phone = user.phone
            model.is_active = user.is_active
            model.failed_login_attempts = user.failed_login_attempts
            model.locked_until = user.locked_until
            model.last_login_at = user.last_login_at
            model.updated_at = user.updated_at
            model.deleted_at = user.deleted_at

        await self._session.flush()
        return self._to_domain_user(model)

    async def delete(self, entity_id: uuid.UUID) -> None:
        """Soft delete conforme diretrizes da LGPD e regras de integridade."""
        stmt = select(UserModel).where(UserModel.id == entity_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model:
            model.is_active = False
            model.deleted_at = datetime.now(timezone.utc)
            await self._session.flush()

    async def list_users(
        self,
        skip: int = 0,
        limit: int = 50,
        role: Optional[UserRole] = None,
        only_active: bool = True,
    ) -> List[User]:
        stmt = select(UserModel)
        if only_active:
            stmt = stmt.where(UserModel.deleted_at.is_(None), UserModel.is_active.is_(True))
        if role:
            stmt = stmt.where(UserModel.role == role.value)
        stmt = stmt.offset(skip).limit(limit).order_by(UserModel.created_at.desc())
        result = await self._session.execute(stmt)
        return [self._to_domain_user(m) for m in result.scalars().all()]

    # --- Operações de Refresh Token ---
    async def save_refresh_token(self, token: RefreshToken) -> RefreshToken:
        stmt = select(RefreshTokenModel).where(RefreshTokenModel.id == token.id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            model = RefreshTokenModel(
                id=token.id,
                user_id=token.user_id,
                token_hash=token.token_hash,
                family_id=token.family_id,
                expires_at=token.expires_at,
                revoked_at=token.revoked_at,
                replaced_by=token.replaced_by,
                user_agent=token.user_agent,
                ip_address=token.ip_address,
                created_at=token.created_at,
            )
            self._session.add(model)
        else:
            model.revoked_at = token.revoked_at
            model.replaced_by = token.replaced_by

        await self._session.flush()
        return self._to_domain_refresh_token(model)

    async def get_refresh_token_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        stmt = select(RefreshTokenModel).where(RefreshTokenModel.token_hash == token_hash)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain_refresh_token(model) if model else None

    async def revoke_refresh_token_family(self, family_id: uuid.UUID) -> None:
        stmt = (
            update(RefreshTokenModel)
            .where(
                RefreshTokenModel.family_id == family_id,
                RefreshTokenModel.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(timezone.utc))
        )
        await self._session.execute(stmt)
        await self._session.flush()

    # --- Operações de Consentimento LGPD ---
    async def save_consent(self, consent: UserConsent) -> UserConsent:
        stmt = select(UserConsentModel).where(UserConsentModel.id == consent.id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            model = UserConsentModel(
                id=consent.id,
                user_id=consent.user_id,
                consent_type=consent.consent_type.value,
                policy_version=consent.policy_version,
                granted_at=consent.granted_at,
                revoked_at=consent.revoked_at,
                ip_address=consent.ip_address,
            )
            self._session.add(model)
        else:
            model.revoked_at = consent.revoked_at

        await self._session.flush()
        return self._to_domain_consent(model)

    async def get_active_consent(
        self,
        user_id: uuid.UUID,
        consent_type: ConsentType,
    ) -> Optional[UserConsent]:
        stmt = select(UserConsentModel).where(
            UserConsentModel.user_id == user_id,
            UserConsentModel.consent_type == consent_type.value,
            UserConsentModel.revoked_at.is_(None),
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain_consent(model) if model else None
