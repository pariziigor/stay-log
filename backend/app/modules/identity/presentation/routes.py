from typing import Optional
from fastapi import APIRouter, Depends, Header, Request, status
from app.core.dependencies import get_current_user, get_user_repository
from app.modules.identity.application.dtos import (
    ChangePasswordDTO,
    ConsentCreateDTO,
    RefreshTokenDTO,
    TokenResponseDTO,
    UserLoginDTO,
    UserRegisterDTO,
    UserResponseDTO,
)
from app.modules.identity.application.services import AuthService
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.repository import UserRepository

router = APIRouter(prefix="/auth", tags=["Autenticação & Identidade"])


def get_auth_service(user_repo: UserRepository = Depends(get_user_repository)) -> AuthService:
    return AuthService(user_repo)


@router.post(
    "/register",
    response_model=UserResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar novo usuário na plataforma",
    description="Permite cadastrar um novo Proprietário ou Funcionário, gravando consentimento de LGPD.",
)
async def register(
    dto: UserRegisterDTO,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponseDTO:
    client_ip = request.client.host if request.client else None
    return await auth_service.register(dto, ip_address=client_ip)


@router.post(
    "/login",
    response_model=TokenResponseDTO,
    summary="Autenticar usuário e obter tokens JWT",
    description="Autentica via e-mail e senha, retornando um Access Token curto e Refresh Token com proteção contra força bruta.",
)
async def login(
    dto: UserLoginDTO,
    request: Request,
    user_agent: Optional[str] = Header(None),
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponseDTO:
    client_ip = request.client.host if request.client else None
    return await auth_service.login(dto, user_agent=user_agent, ip_address=client_ip)


@router.post(
    "/refresh",
    response_model=TokenResponseDTO,
    summary="Rotacionar e renovar Access Token",
    description="Implementa rotação automática de refresh token com detecção de reuso para proteção contra roubo de credenciais.",
)
async def refresh_token(
    dto: RefreshTokenDTO,
    request: Request,
    user_agent: Optional[str] = Header(None),
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenResponseDTO:
    client_ip = request.client.host if request.client else None
    return await auth_service.refresh_token(dto, user_agent=user_agent, ip_address=client_ip)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Encerrar sessão e revogar Refresh Token",
)
async def logout(
    dto: RefreshTokenDTO,
    auth_service: AuthService = Depends(get_auth_service),
) -> None:
    await auth_service.logout(dto.refresh_token)


@router.get(
    "/me",
    response_model=UserResponseDTO,
    summary="Obter perfil do usuário autenticado",
)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponseDTO:
    return UserResponseDTO(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email.value,
        role=current_user.role,
        phone=current_user.phone,
        is_active=current_user.is_active,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
    )


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Alterar senha do usuário autenticado",
)
async def change_password(
    dto: ChangePasswordDTO,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> None:
    await auth_service.change_password(current_user.id, dto)


@router.post(
    "/consent",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Registrar consentimento LGPD",
    description="Grava o consentimento de termos ou políticas com auditoria de IP e versão.",
)
async def record_consent(
    dto: ConsentCreateDTO,
    request: Request,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> None:
    client_ip = request.client.host if request.client else None
    await auth_service.record_consent(current_user.id, dto, ip_address=client_ip)
