from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid
from app.core.config import settings
from app.core.exceptions import (
    AccountLockedError,
    InvalidCredentialsError,
    UnauthorizedError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.modules.identity.application.dtos import (
    ChangePasswordDTO,
    ConsentCreateDTO,
    RefreshTokenDTO,
    TokenResponseDTO,
    UserLoginDTO,
    UserRegisterDTO,
    UserResponseDTO,
)
from app.modules.identity.domain.entities import RefreshToken, User, UserConsent
from app.modules.identity.domain.exceptions import (
    RefreshTokenExpiredError,
    RefreshTokenRevokedOrReusedError,
    UserAlreadyExistsError,
    UserNotFoundError,
)
from app.modules.identity.domain.repository import UserRepository
from app.modules.identity.domain.value_objects import ConsentType, Email


class AuthService:
    """Application Service responsável pelos casos de uso de Autenticação e Gestão de Usuários."""

    def __init__(self, user_repo: UserRepository):
        self._user_repo = user_repo

    async def register(
        self,
        dto: UserRegisterDTO,
        ip_address: Optional[str] = None,
    ) -> UserResponseDTO:
        email_vo = Email(dto.email)
        existing_user = await self._user_repo.get_by_email(email_vo)
        if existing_user is not None:
            raise UserAlreadyExistsError(dto.email)

        password_hash = get_password_hash(dto.password)
        new_user = User(
            full_name=dto.full_name,
            email=email_vo,
            password_hash=password_hash,
            role=dto.role,
            phone=dto.phone,
        )
        saved_user = await self._user_repo.save(new_user)

        # Registro de consentimento LGPD inicial
        if dto.consent_terms:
            consent = UserConsent(
                user_id=saved_user.id,
                consent_type=ConsentType.TERMS_OF_USE,
                policy_version="1.0",
                ip_address=ip_address,
            )
            await self._user_repo.save_consent(consent)

        return UserResponseDTO(
            id=saved_user.id,
            full_name=saved_user.full_name,
            email=saved_user.email.value,
            role=saved_user.role,
            phone=saved_user.phone,
            is_active=saved_user.is_active,
            last_login_at=saved_user.last_login_at,
            created_at=saved_user.created_at,
        )

    async def login(
        self,
        dto: UserLoginDTO,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> TokenResponseDTO:
        email_vo = Email(dto.email)
        user = await self._user_repo.get_by_email(email_vo)

        if user is None:
            raise InvalidCredentialsError()

        if user.is_locked():
            raise AccountLockedError(minutes=settings.ACCOUNT_LOCK_MINUTES)

        if not user.is_active:
            raise UnauthorizedError("Conta desativada ou removida.")

        if not verify_password(dto.password, user.password_hash):
            user.record_login_failure(
                max_attempts=settings.MAX_FAILED_LOGIN_ATTEMPTS,
                lock_minutes=settings.ACCOUNT_LOCK_MINUTES,
            )
            await self._user_repo.save(user)
            raise InvalidCredentialsError()

        # Login bem-sucedido
        user.record_login_success()
        await self._user_repo.save(user)

        # Geração de Access Token JWT
        access_token = create_access_token(
            subject=str(user.id),
            role=user.role.value,
            email=user.email.value,
        )

        # Geração de Refresh Token com rastreamento por família para rotação segura
        raw_refresh_token = create_refresh_token()
        refresh_token_entity = RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_refresh_token),
            family_id=uuid.uuid4(),
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=user_agent,
            ip_address=ip_address,
        )
        await self._user_repo.save_refresh_token(refresh_token_entity)

        return TokenResponseDTO(
            access_token=access_token,
            refresh_token=raw_refresh_token,
            token_type="bearer",
            expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user.id,
            role=user.role,
            full_name=user.full_name,
        )

    async def refresh_token(
        self,
        dto: RefreshTokenDTO,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> TokenResponseDTO:
        current_hash = hash_token(dto.refresh_token)
        stored_token = await self._user_repo.get_refresh_token_by_hash(current_hash)

        if stored_token is None:
            raise UnauthorizedError("Token de atualização não reconhecido.")

        # Detecção de reuso de token (ataque de repetição ou vazamento):
        # Se um token já revogado for reutilizado, revoga toda a família imediatamente!
        if stored_token.revoked_at is not None:
            await self._user_repo.revoke_refresh_token_family(stored_token.family_id)
            raise RefreshTokenRevokedOrReusedError()

        if stored_token.is_expired():
            raise RefreshTokenExpiredError()

        user = await self._user_repo.get_by_id(stored_token.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("Usuário associado inválido ou desativado.")

        # Rotação de tokens: cria novo refresh token e vincula ao anterior
        new_raw_refresh = create_refresh_token()
        new_token_id = uuid.uuid4()

        stored_token.revoke(replaced_by=new_token_id)
        await self._user_repo.save_refresh_token(stored_token)

        new_refresh_token = RefreshToken(
            id=new_token_id,
            user_id=user.id,
            token_hash=hash_token(new_raw_refresh),
            family_id=stored_token.family_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=user_agent,
            ip_address=ip_address,
        )
        await self._user_repo.save_refresh_token(new_refresh_token)

        new_access_token = create_access_token(
            subject=str(user.id),
            role=user.role.value,
            email=user.email.value,
        )

        return TokenResponseDTO(
            access_token=new_access_token,
            refresh_token=new_raw_refresh,
            token_type="bearer",
            expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user.id,
            role=user.role,
            full_name=user.full_name,
        )

    async def logout(self, refresh_token_str: str) -> None:
        token_hash = hash_token(refresh_token_str)
        stored_token = await self._user_repo.get_refresh_token_by_hash(token_hash)
        if stored_token and stored_token.is_active():
            stored_token.revoke()
            await self._user_repo.save_refresh_token(stored_token)

    async def get_profile(self, user_id: uuid.UUID) -> UserResponseDTO:
        user = await self._user_repo.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError(str(user_id))
        return UserResponseDTO(
            id=user.id,
            full_name=user.full_name,
            email=user.email.value,
            role=user.role,
            phone=user.phone,
            is_active=user.is_active,
            last_login_at=user.last_login_at,
            created_at=user.created_at,
        )

    async def change_password(self, user_id: uuid.UUID, dto: ChangePasswordDTO) -> None:
        user = await self._user_repo.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError(str(user_id))
        if not verify_password(dto.current_password, user.password_hash):
            raise InvalidCredentialsError("Senha atual incorreta.")

        user.change_password(get_password_hash(dto.new_password))
        await self._user_repo.save(user)

    async def record_consent(
        self,
        user_id: uuid.UUID,
        dto: ConsentCreateDTO,
        ip_address: Optional[str] = None,
    ) -> None:
        consent = UserConsent(
            user_id=user_id,
            consent_type=dto.consent_type,
            policy_version=dto.policy_version,
            ip_address=ip_address,
        )
        await self._user_repo.save_consent(consent)
