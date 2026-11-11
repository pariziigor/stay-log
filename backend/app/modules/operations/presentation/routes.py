from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.dependencies import get_current_user, require_roles
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.operations.application.dtos import (
    ChecklistItemToggleDTO,
    TaskCreateDTO,
    TaskResponseDTO,
    TaskStatus,
    TaskStatusUpdateDTO,
    TaskType,
)
from app.modules.operations.application.services import TaskService

router = APIRouter(prefix="/tasks", tags=["Operações & Tarefas (RF-08 a RF-11)"])


def get_task_service(session: AsyncSession = Depends(get_db_session)) -> TaskService:
    return TaskService(session)


@router.get(
    "",
    response_model=List[TaskResponseDTO],
    summary="Listar tarefas operacionais e checklists",
)
async def list_tasks(
    task_type: Optional[TaskType] = Query(None, description="Filtrar por tipo de tarefa"),
    status_filter: Optional[TaskStatus] = Query(None, alias="status", description="Filtrar por status"),
    property_id: Optional[uuid.UUID] = Query(None, description="Filtrar por imóvel"),
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> List[TaskResponseDTO]:
    return await service.list_tasks(
        current_user=current_user,
        task_type=task_type,
        status=status_filter,
        property_id=property_id,
    )


@router.post(
    "",
    response_model=TaskResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova tarefa operacional com checklist",
)
async def create_task(
    dto: TaskCreateDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: TaskService = Depends(get_task_service),
) -> TaskResponseDTO:
    return await service.create_task(current_user=current_user, dto=dto)


@router.patch(
    "/{task_id}/checklist/{item_id}",
    response_model=TaskResponseDTO,
    summary="Marcar ou desmarcar item de checklist da tarefa",
)
async def toggle_checklist_item(
    task_id: uuid.UUID,
    item_id: uuid.UUID,
    dto: ChecklistItemToggleDTO,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskResponseDTO:
    return await service.toggle_checklist_item(
        current_user=current_user,
        task_id=task_id,
        item_id=item_id,
        dto=dto,
    )


@router.patch(
    "/{task_id}/status",
    response_model=TaskResponseDTO,
    summary="Atualizar status da tarefa (valida conclusão de checklist - RF-11)",
)
async def update_task_status(
    task_id: uuid.UUID,
    dto: TaskStatusUpdateDTO,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskResponseDTO:
    return await service.update_task_status(
        current_user=current_user,
        task_id=task_id,
        dto=dto,
    )


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover tarefa operacional",
)
async def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: TaskService = Depends(get_task_service),
) -> None:
    await service.delete_task(current_user=current_user, task_id=task_id)
