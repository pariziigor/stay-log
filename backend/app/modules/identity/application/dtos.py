from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.modules.identity.domain.value_objects import ConsentType, UserRole


class UserRegisterDTO(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150, description="Nome completo do usuário")
    email: EmailStr = Field(..., description="E-mail corporativo ou pessoal")
    password: str = Field(..., min_length=8, max_length=100, description="Senha forte (mínimo 8 caracteres)")
    role: UserRole = Field(
        default=UserRole.OWNER,
        description="Autocadastro público só é permitido para 'owner'. Funcionários entram por convite e administradores são criados via CLI.",
    )
    phone: Optional[str] = Field(None, max_length=20, description="Telefone de contato")
    consent_terms: bool = Field(True, description="Consentimento com termos de uso e política de privacidade (LGPD)")

    @field_validator("role")
    @classmethod
    def only_owner_can_self_register(cls, value: UserRole) -> UserRole:
        # Evita escalonamento de privilégio: o papel nunca é decidido pelo cliente.
        if value != UserRole.OWNER:
            raise ValueError("Autocadastro permitido apenas para o perfil 'owner'.")
        return value


class UserLoginDTO(BaseModel):
    email: EmailStr = Field(..., description="E-mail cadastrado")
    password: str = Field(..., description="Senha cadastrada")


class TokenResponseDTO(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user_id: uuid.UUID
    role: UserRole
    full_name: str


class RefreshTokenDTO(BaseModel):
    refresh_token: str = Field(..., description="Token de atualização rotativo")


class UserResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    role: UserRole
    phone: Optional[str] = None
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime


class ConsentCreateDTO(BaseModel):
    consent_type: ConsentType
    policy_version: str = "1.0"


class ConsentResponseDTO(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    consent_type: ConsentType
    policy_version: str
    granted_at: datetime
    is_active: bool


class ChangePasswordDTO(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
