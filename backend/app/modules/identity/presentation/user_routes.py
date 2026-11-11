from datetime import datetime, timezone
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.dependencies import require_roles
from app.core.exceptions import (
    BusinessRuleViolationError,
    EntityAlreadyExistsError,
    EntityNotFoundError,
    ForbiddenError,
)
from app.core.security import get_password_hash
from app.modules.identity.application.dtos import (
    TeamMemberInviteDTO,
    TeamMemberResponseDTO,
    UserResponseDTO,
    UserStatusUpdateDTO,
)
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.models import TeamMemberModel, UserModel

router = APIRouter(prefix="/users", tags=["Gestão de Usuários & Equipe (RF-01, RF-02)"])


@router.get(
    "",
    response_model=List[UserResponseDTO],
    summary="Listar usuários da plataforma (Admin) ou membros da equipe (Owner)",
)
async def list_users(
    role: Optional[UserRole] = Query(None, description="Filtrar por perfil"),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    session: AsyncSession = Depends(get_db_session),
) -> List[UserResponseDTO]:
    if current_user.role == UserRole.ADMIN:
        stmt = select(UserModel).where(UserModel.deleted_at.is_(None))
        if role:
            stmt = stmt.where(UserModel.role == role.value)
        stmt = stmt.order_by(UserModel.created_at.desc())
    else:
        # Owner enxerga os funcionários vinculados à sua equipe
        stmt = (
            select(UserModel)
            .join(TeamMemberModel, TeamMemberModel.employee_id == UserModel.id)
            .where(
                TeamMemberModel.owner_id == current_user.id,
                UserModel.deleted_at.is_(None),
            )
            .order_by(UserModel.full_name.asc())
        )

    res = await session.execute(stmt)
    return [UserResponseDTO.model_validate(u) for u in res.scalars().all()]


@router.get(
    "/team",
    response_model=List[TeamMemberResponseDTO],
    summary="Listar membros da equipe operacional vinculados ao proprietário",
)
async def list_team_members(
    owner_id: Optional[uuid.UUID] = Query(None, description="Filtrar por proprietário (Admin)"),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    session: AsyncSession = Depends(get_db_session),
) -> List[TeamMemberResponseDTO]:
    stmt = (
        select(TeamMemberModel, UserModel)
        .join(UserModel, UserModel.id == TeamMemberModel.employee_id)
        .where(UserModel.deleted_at.is_(None))
    )
    if current_user.role == UserRole.OWNER:
        stmt = stmt.where(TeamMemberModel.owner_id == current_user.id)
    elif owner_id is not None:
        stmt = stmt.where(TeamMemberModel.owner_id == owner_id)

    stmt = stmt.order_by(UserModel.full_name.asc())
    res = await session.execute(stmt)
    result: List[TeamMemberResponseDTO] = []
    for tm, emp in res.all():
        result.append(
            TeamMemberResponseDTO(
                employee_id=emp.id,
                owner_id=tm.owner_id,
                full_name=emp.full_name,
                email=emp.email,
                phone=emp.phone,
                job_title=tm.job_title,
                is_active=tm.is_active and emp.is_active,
                created_at=tm.created_at,
            )
        )
    return result


@router.post(
    "/team",
    response_model=TeamMemberResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar ou vincular funcionário à equipe do proprietário",
)
async def invite_or_link_team_member(
    dto: TeamMemberInviteDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    session: AsyncSession = Depends(get_db_session),
) -> TeamMemberResponseDTO:
    target_owner_id = (
        current_user.id
        if current_user.role == UserRole.OWNER
        else (dto.owner_id or current_user.id)
    )

    email_norm = str(dto.email).lower().strip()
    emp_res = await session.execute(
        select(UserModel).where(UserModel.email == email_norm, UserModel.deleted_at.is_(None))
    )
    emp = emp_res.scalar_one_or_none()

    if emp is None:
        if not dto.password or len(dto.password) < 8:
            raise BusinessRuleViolationError(
                "Para cadastrar um novo funcionário, informe uma senha inicial com no mínimo 8 caracteres.",
                error_code="PASSWORD_REQUIRED_FOR_NEW_EMPLOYEE",
            )
        emp = UserModel(
            id=uuid.uuid4(),
            full_name=dto.full_name.strip(),
            email=email_norm,
            password_hash=get_password_hash(dto.password),
            role=UserRole.EMPLOYEE.value,
            phone=dto.phone.strip() if dto.phone else None,
            is_active=True,
        )
        session.add(emp)
        await session.flush()
    else:
        if emp.role != UserRole.EMPLOYEE.value:
            raise EntityAlreadyExistsError(
                f"O e-mail '{email_norm}' já pertence a uma conta com perfil '{emp.role}' e não pode ser vinculado como funcionário."
            )

    link_res = await session.execute(
        select(TeamMemberModel).where(
            TeamMemberModel.owner_id == target_owner_id,
            TeamMemberModel.employee_id == emp.id,
        )
    )
    existing_link = link_res.scalar_one_or_none()
    if existing_link is not None:
        existing_link.is_active = True
        if dto.job_title:
            existing_link.job_title = dto.job_title.strip()
        tm = existing_link
    else:
        tm = TeamMemberModel(
            owner_id=target_owner_id,
            employee_id=emp.id,
            job_title=dto.job_title.strip() if dto.job_title else "Equipe de Campo",
            is_active=True,
        )
        session.add(tm)

    await session.flush()
    return TeamMemberResponseDTO(
        employee_id=emp.id,
        owner_id=tm.owner_id,
        full_name=emp.full_name,
        email=emp.email,
        phone=emp.phone,
        job_title=tm.job_title,
        is_active=tm.is_active and emp.is_active,
        created_at=tm.created_at,
    )


@router.patch(
    "/{user_id}/status",
    response_model=UserResponseDTO,
    summary="Ativar ou desativar usuário (Admin) ou vínculo de equipe (Owner)",
)
async def update_user_status(
    user_id: uuid.UUID,
    dto: UserStatusUpdateDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    session: AsyncSession = Depends(get_db_session),
) -> UserResponseDTO:
    res = await session.execute(
        select(UserModel).where(UserModel.id == user_id, UserModel.deleted_at.is_(None))
    )
    target_user = res.scalar_one_or_none()
    if target_user is None:
        raise EntityNotFoundError("Usuário", user_id)

    if current_user.role == UserRole.ADMIN:
        if target_user.id == current_user.id and not dto.is_active:
            raise BusinessRuleViolationError(
                "Não é permitido desativar a própria conta de administrador.",
                error_code="CANNOT_DEACTIVATE_SELF",
            )
        target_user.is_active = dto.is_active
        target_user.updated_at = datetime.now(timezone.utc)
        await session.flush()
        return UserResponseDTO.model_validate(target_user)

    # Se for Owner, só pode ativar/desativar o vínculo do funcionário na sua equipe
    link_res = await session.execute(
        select(TeamMemberModel).where(
            TeamMemberModel.owner_id == current_user.id,
            TeamMemberModel.employee_id == user_id,
        )
    )
    link = link_res.scalar_one_or_none()
    if link is None:
        raise ForbiddenError("Este usuário não faz parte da sua equipe.")

    link.is_active = dto.is_active
    await session.flush()

    return UserResponseDTO(
        id=target_user.id,
        full_name=target_user.full_name,
        email=target_user.email,
        role=UserRole(target_user.role),
        phone=target_user.phone,
        is_active=link.is_active and target_user.is_active,
        last_login_at=target_user.last_login_at,
        created_at=target_user.created_at,
    )
