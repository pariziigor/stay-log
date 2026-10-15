from typing import Callable, List, Optional
import uuid
from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repository import UserRepository
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.repositories import SQLAlchemyUserRepository

security_bearer = HTTPBearer(auto_error=False)


def get_user_repository(session: AsyncSession = Depends(get_db_session)) -> UserRepository:
    """Dependency para injeção da porta UserRepository."""
    return SQLAlchemyUserRepository(session)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    user_repo: UserRepository = Depends(get_user_repository),
) -> User:
    """Valida o Bearer Token JWT e retorna a Entidade de Domínio do Usuário Autenticado."""
    if not credentials:
        raise UnauthorizedError("Cabeçalho de autorização (Bearer token) ausente.")

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise UnauthorizedError("Token de acesso inválido ou expirado.")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedError("Identificador de usuário ausente no token.")

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise UnauthorizedError("Formato de ID de usuário inválido no token.")

    user = await user_repo.get_by_id(user_uuid)
    if not user:
        raise UnauthorizedError("Usuário associado a este token não foi encontrado.")

    if not user.is_active:
        raise UnauthorizedError("Usuário desativado ou removido da plataforma.")

    return user


def require_roles(*allowed_roles: UserRole) -> Callable:
    """Dependency Factory para controle de acesso baseado em papéis (RBAC).

    Exemplo:
        @router.post("/properties", dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.OWNER))])
    """

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            role_names = ", ".join(r.value for r in allowed_roles)
            raise ForbiddenError(
                f"Acesso negado. Esta operação requer um dos seguintes perfis: [{role_names}]. "
                f"Perfil atual: '{current_user.role.value}'."
            )
        return current_user

    return role_checker
