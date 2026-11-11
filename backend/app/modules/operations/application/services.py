from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
import uuid
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.exceptions import (
    BusinessRuleViolationError,
    EntityNotFoundError,
    ForbiddenError,
)
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.models import TeamMemberModel, UserModel
from app.modules.operations.application.dtos import (
    ChecklistItemResponseDTO,
    ChecklistItemToggleDTO,
    TaskCreateDTO,
    TaskPriority,
    TaskResponseDTO,
    TaskStatus,
    TaskStatusUpdateDTO,
    TaskType,
)
from app.modules.operations.infrastructure.models import (
    TaskChecklistItemModel,
    TaskModel,
)
from app.modules.properties.infrastructure.models import PropertyModel


class TaskService:
    """Serviço de aplicação para gestão de tarefas operacionais e checklists (RF-08, RF-09, RF-10, RF-11)."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def _get_allowed_owner_ids_for_employee(self, employee_id: uuid.UUID) -> Set[uuid.UUID]:
        stmt = select(TeamMemberModel.owner_id).where(
            TeamMemberModel.employee_id == employee_id,
            TeamMemberModel.is_active.is_(True),
        )
        res = await self._session.execute(stmt)
        return set(res.scalars().all())

    async def _assert_task_access(self, current_user: User, task: TaskModel, prop: PropertyModel) -> None:
        if current_user.role == UserRole.ADMIN:
            return
        if current_user.role == UserRole.OWNER:
            if prop.owner_id != current_user.id:
                raise ForbiddenError("Acesso negado: esta tarefa pertence a um imóvel de outro proprietário.")
            return
        # Funcionário: pode acessar se for atribuído à tarefa ou se integrar a equipe do proprietário do imóvel
        if task.assigned_to == current_user.id:
            return
        allowed_owners = await self._get_allowed_owner_ids_for_employee(current_user.id)
        if prop.owner_id not in allowed_owners:
            raise ForbiddenError("Acesso negado: você não possui vínculo com o proprietário deste imóvel.")

    async def _build_dtos(self, tasks: List[TaskModel]) -> List[TaskResponseDTO]:
        if not tasks:
            return []

        prop_ids = {t.property_id for t in tasks}
        user_ids = {t.assigned_to for t in tasks if t.assigned_to is not None}

        prop_res = await self._session.execute(
            select(PropertyModel.id, PropertyModel.name).where(PropertyModel.id.in_(prop_ids))
        )
        prop_names: Dict[uuid.UUID, str] = {row[0]: row[1] for row in prop_res.all()}

        user_names: Dict[uuid.UUID, str] = {}
        if user_ids:
            user_res = await self._session.execute(
                select(UserModel.id, UserModel.full_name).where(UserModel.id.in_(user_ids))
            )
            user_names = {row[0]: row[1] for row in user_res.all()}

        result: List[TaskResponseDTO] = []
        for t in tasks:
            items_dto = [
                ChecklistItemResponseDTO(
                    id=item.id,
                    position=item.position,
                    description=item.description,
                    is_required=item.is_required,
                    is_checked=item.is_checked,
                    checked_by=item.checked_by,
                    checked_at=item.checked_at,
                )
                for item in sorted(t.checklist_items, key=lambda x: x.position)
            ]
            result.append(
                TaskResponseDTO(
                    id=t.id,
                    property_id=t.property_id,
                    property_name=prop_names.get(t.property_id, "Imóvel"),
                    reservation_id=t.reservation_id,
                    task_type=TaskType(t.task_type),
                    title=t.title,
                    description=t.description,
                    priority=TaskPriority(t.priority),
                    status=TaskStatus(t.status),
                    due_at=t.due_at,
                    estimated_minutes=t.estimated_minutes,
                    assigned_to=t.assigned_to,
                    assignee_name=user_names.get(t.assigned_to) if t.assigned_to else None,
                    started_at=t.started_at,
                    completed_at=t.completed_at,
                    completion_notes=t.completion_notes,
                    checklist_items=items_dto,
                    created_at=t.created_at,
                    updated_at=t.updated_at,
                )
            )
        return result

    async def list_tasks(
        self,
        current_user: User,
        task_type: Optional[TaskType] = None,
        status: Optional[TaskStatus] = None,
        property_id: Optional[uuid.UUID] = None,
    ) -> List[TaskResponseDTO]:
        stmt = (
            select(TaskModel)
            .join(PropertyModel, PropertyModel.id == TaskModel.property_id)
            .options(selectinload(TaskModel.checklist_items))
            .where(PropertyModel.deleted_at.is_(None))
        )

        if current_user.role == UserRole.OWNER:
            stmt = stmt.where(PropertyModel.owner_id == current_user.id)
        elif current_user.role == UserRole.EMPLOYEE:
            allowed_owners = await self._get_allowed_owner_ids_for_employee(current_user.id)
            if allowed_owners:
                stmt = stmt.where(
                    or_(
                        TaskModel.assigned_to == current_user.id,
                        PropertyModel.owner_id.in_(allowed_owners),
                    )
                )
            else:
                stmt = stmt.where(TaskModel.assigned_to == current_user.id)

        if property_id:
            stmt = stmt.where(TaskModel.property_id == property_id)
        if task_type:
            stmt = stmt.where(TaskModel.task_type == task_type.value)
        if status:
            stmt = stmt.where(TaskModel.status == status.value)

        stmt = stmt.order_by(TaskModel.due_at.asc(), TaskModel.created_at.desc())
        res = await self._session.execute(stmt)
        tasks = list(res.scalars().all())
        return await self._build_dtos(tasks)

    async def create_task(self, current_user: User, dto: TaskCreateDTO) -> TaskResponseDTO:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Apenas proprietários ou administradores podem criar novas tarefas.")

        prop_res = await self._session.execute(
            select(PropertyModel).where(
                PropertyModel.id == dto.property_id,
                PropertyModel.deleted_at.is_(None),
            )
        )
        prop = prop_res.scalar_one_or_none()
        if prop is None:
            raise EntityNotFoundError("Imóvel", dto.property_id)

        if current_user.role == UserRole.OWNER and prop.owner_id != current_user.id:
            raise ForbiddenError("Você só pode criar tarefas para imóveis de sua titularidade.")

        if dto.assigned_to is not None:
            assignee_res = await self._session.execute(
                select(UserModel).where(
                    UserModel.id == dto.assigned_to,
                    UserModel.deleted_at.is_(None),
                    UserModel.is_active.is_(True),
                )
            )
            assignee = assignee_res.scalar_one_or_none()
            if assignee is None:
                raise EntityNotFoundError("Responsável", dto.assigned_to)

        task_id = uuid.uuid4()
        checklist_models = [
            TaskChecklistItemModel(
                id=uuid.uuid4(),
                task_id=task_id,
                position=idx + 1,
                description=item.description.strip(),
                is_required=item.is_required,
                is_checked=False,
            )
            for idx, item in enumerate(dto.checklist_items)
        ]

        task = TaskModel(
            id=task_id,
            property_id=dto.property_id,
            reservation_id=dto.reservation_id,
            task_type=dto.task_type.value,
            title=dto.title.strip(),
            description=dto.description.strip() if dto.description else None,
            priority=dto.priority.value,
            status=TaskStatus.PENDING.value,
            due_at=dto.due_at,
            estimated_minutes=dto.estimated_minutes,
            assigned_to=dto.assigned_to,
            created_by=current_user.id,
            checklist_items=checklist_models,
        )
        self._session.add(task)
        await self._session.flush()

        dtos = await self._build_dtos([task])
        return dtos[0]

    async def toggle_checklist_item(
        self,
        current_user: User,
        task_id: uuid.UUID,
        item_id: uuid.UUID,
        dto: ChecklistItemToggleDTO,
    ) -> TaskResponseDTO:
        stmt = (
            select(TaskModel)
            .options(selectinload(TaskModel.checklist_items))
            .where(TaskModel.id == task_id)
        )
        res = await self._session.execute(stmt)
        task = res.scalar_one_or_none()
        if task is None:
            raise EntityNotFoundError("Tarefa", task_id)

        prop_res = await self._session.execute(
            select(PropertyModel).where(PropertyModel.id == task.property_id)
        )
        prop = prop_res.scalar_one_or_none()
        if prop is None:
            raise EntityNotFoundError("Imóvel", task.property_id)

        await self._assert_task_access(current_user, task, prop)

        if task.status in (TaskStatus.COMPLETED.value, TaskStatus.CANCELLED.value):
            raise BusinessRuleViolationError(
                "Não é permitido alterar itens de checklist de uma tarefa já concluída ou cancelada.",
                error_code="TASK_ALREADY_CLOSED",
            )

        target_item = next((i for i in task.checklist_items if i.id == item_id), None)
        if target_item is None:
            raise EntityNotFoundError("Item de Checklist", item_id)

        now = datetime.now(timezone.utc)
        target_item.is_checked = dto.is_checked
        if dto.is_checked:
            target_item.checked_by = current_user.id
            target_item.checked_at = now
            if task.status == TaskStatus.PENDING.value:
                task.status = TaskStatus.IN_PROGRESS.value
                task.started_at = task.started_at or now
        else:
            target_item.checked_by = None
            target_item.checked_at = None

        task.updated_at = now
        await self._session.flush()

        dtos = await self._build_dtos([task])
        return dtos[0]

    async def update_task_status(
        self,
        current_user: User,
        task_id: uuid.UUID,
        dto: TaskStatusUpdateDTO,
    ) -> TaskResponseDTO:
        stmt = (
            select(TaskModel)
            .options(selectinload(TaskModel.checklist_items))
            .where(TaskModel.id == task_id)
        )
        res = await self._session.execute(stmt)
        task = res.scalar_one_or_none()
        if task is None:
            raise EntityNotFoundError("Tarefa", task_id)

        prop_res = await self._session.execute(
            select(PropertyModel).where(PropertyModel.id == task.property_id)
        )
        prop = prop_res.scalar_one_or_none()
        if prop is None:
            raise EntityNotFoundError("Imóvel", task.property_id)

        await self._assert_task_access(current_user, task, prop)

        now = datetime.now(timezone.utc)
        if dto.status == TaskStatus.COMPLETED:
            # RF-11: Bloqueia conclusão de tarefa caso existam itens obrigatórios não marcados
            pending_required = [
                item for item in task.checklist_items if item.is_required and not item.is_checked
            ]
            if pending_required:
                raise BusinessRuleViolationError(
                    f"Não é possível concluir a tarefa: existem {len(pending_required)} item(ns) obrigatório(s) pendente(s) no checklist.",
                    error_code="PENDING_CHECKLIST_ITEMS",
                )
            task.completed_at = now
            task.started_at = task.started_at or now
        elif dto.status == TaskStatus.IN_PROGRESS:
            task.started_at = task.started_at or now
            task.completed_at = None
        else:
            task.completed_at = None

        task.status = dto.status.value
        if dto.completion_notes is not None:
            task.completion_notes = dto.completion_notes.strip() or None
        task.updated_at = now

        await self._session.flush()
        dtos = await self._build_dtos([task])
        return dtos[0]

    async def delete_task(self, current_user: User, task_id: uuid.UUID) -> None:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Apenas proprietários ou administradores podem excluir tarefas.")

        stmt = select(TaskModel).where(TaskModel.id == task_id)
        res = await self._session.execute(stmt)
        task = res.scalar_one_or_none()
        if task is None:
            raise EntityNotFoundError("Tarefa", task_id)

        prop_res = await self._session.execute(
            select(PropertyModel).where(PropertyModel.id == task.property_id)
        )
        prop = prop_res.scalar_one_or_none()
        if current_user.role == UserRole.OWNER and prop and prop.owner_id != current_user.id:
            raise ForbiddenError("Você só pode remover tarefas dos seus próprios imóveis.")

        await self._session.delete(task)
        await self._session.flush()
