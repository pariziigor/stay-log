from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.database import get_db_session
from app.core.dependencies import get_current_user
from app.modules.ai_assistant.application.context_builder import OperationalContextBuilder
from app.modules.bookings.infrastructure.models import ReservationModel
from app.modules.finance.infrastructure.models import FinancialTransactionModel
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.models import TeamMemberModel, UserModel
from app.modules.inventory.infrastructure.models import InventoryItemModel
from app.modules.operations.infrastructure.models import TaskModel
from app.modules.properties.infrastructure.models import PropertyModel

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Indicadores (RF-14)"])


@router.get(
    "/summary",
    summary="Obter indicadores consolidados reais do painel por perfil (Owner, Admin, Employee)",
)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    if current_user.role == UserRole.OWNER:
        builder = OperationalContextBuilder(session)
        ctx = await builder.build_context_for_owner(owner_id=current_user.id)

        prop_ids = [p["id"] for p in ctx["properties"]]
        # Tarefas abertas e concluídas do proprietário
        task_stmt = (
            select(TaskModel, PropertyModel.name)
            .join(PropertyModel, PropertyModel.id == TaskModel.property_id)
            .options(selectinload(TaskModel.checklist_items))
            .where(
                PropertyModel.owner_id == current_user.id,
                PropertyModel.deleted_at.is_(None),
            )
            .order_by(TaskModel.due_at.asc())
        )
        task_res = await session.execute(task_stmt)
        task_rows = task_res.all()

        open_tasks_list: List[Dict[str, Any]] = []
        completed_count = 0
        pending_count = 0
        for t, prop_name in task_rows:
            if t.status == "completed":
                completed_count += 1
            elif t.status != "cancelled":
                pending_count += 1
                if len(open_tasks_list) < 6:
                    open_tasks_list.append(
                        {
                            "id": str(t.id),
                            "title": t.title,
                            "property_name": prop_name,
                            "task_type": t.task_type,
                            "status": t.status,
                            "priority": t.priority,
                            "due_at": t.due_at.isoformat(),
                            "checklist_total": len(t.checklist_items),
                            "checklist_done": sum(1 for c in t.checklist_items if c.is_checked),
                        }
                    )

        fin = ctx["financial"]
        total_expenses = round(
            float(fin["platform_fees_deducted"])
            + float(fin["operational_cleaning_expenses"])
            + float(fin["maintenance_expenses"]),
            2,
        )
        return {
            "role": current_user.role.value,
            "properties_count": ctx["properties_count"],
            "occupancy_pct": ctx["occupancy"]["current_month_occupancy_pct"],
            "next_month_occupancy_pct": ctx["occupancy"]["next_month_projected_pct"],
            "active_reservations_count": ctx["occupancy"]["total_active_reservations"],
            "upcoming_check_ins_today": ctx["occupancy"]["upcoming_check_ins_today"],
            "upcoming_check_outs_today": ctx["occupancy"]["upcoming_check_outs_today"],
            "gross_revenue": fin["gross_revenue"],
            "total_expenses": total_expenses,
            "net_profit": fin["estimated_net_profit"],
            "net_margin_pct": fin["net_margin_pct"],
            "pending_tasks_count": pending_count,
            "completed_tasks_count": completed_count,
            "low_stock_items_count": len(ctx["inventory_alerts"]),
            "low_stock_alerts": ctx["inventory_alerts"],
            "upcoming_tasks": open_tasks_list,
        }

    if current_user.role == UserRole.EMPLOYEE:
        tm_res = await session.execute(
            select(TeamMemberModel.owner_id).where(
                TeamMemberModel.employee_id == current_user.id,
                TeamMemberModel.is_active.is_(True),
            )
        )
        allowed_owners = set(tm_res.scalars().all())

        task_stmt = (
            select(TaskModel, PropertyModel.name)
            .join(PropertyModel, PropertyModel.id == TaskModel.property_id)
            .options(selectinload(TaskModel.checklist_items))
            .where(PropertyModel.deleted_at.is_(None))
        )
        if allowed_owners:
            task_stmt = task_stmt.where(
                or_(
                    TaskModel.assigned_to == current_user.id,
                    PropertyModel.owner_id.in_(allowed_owners),
                )
            )
        else:
            task_stmt = task_stmt.where(TaskModel.assigned_to == current_user.id)

        task_stmt = task_stmt.order_by(TaskModel.due_at.asc())
        task_res = await session.execute(task_stmt)
        rows = task_res.all()

        pending_count = 0
        completed_count = 0
        upcoming_tasks: List[Dict[str, Any]] = []
        for t, prop_name in rows:
            if t.status == "completed":
                completed_count += 1
            elif t.status != "cancelled":
                pending_count += 1
                upcoming_tasks.append(
                    {
                        "id": str(t.id),
                        "title": t.title,
                        "property_name": prop_name,
                        "task_type": t.task_type,
                        "status": t.status,
                        "priority": t.priority,
                        "due_at": t.due_at.isoformat(),
                        "checklist_total": len(t.checklist_items),
                        "checklist_done": sum(1 for c in t.checklist_items if c.is_checked),
                    }
                )

        low_stock_alerts: List[Dict[str, Any]] = []
        if allowed_owners:
            inv_stmt = (
                select(InventoryItemModel, PropertyModel.name)
                .join(PropertyModel, PropertyModel.id == InventoryItemModel.property_id)
                .where(
                    PropertyModel.owner_id.in_(allowed_owners),
                    PropertyModel.deleted_at.is_(None),
                    InventoryItemModel.is_active.is_(True),
                    InventoryItemModel.current_quantity <= InventoryItemModel.minimum_quantity,
                )
            )
            inv_res = await session.execute(inv_stmt)
            for item, prop_name in inv_res.all():
                low_stock_alerts.append(
                    {
                        "property_name": prop_name,
                        "item_name": item.name,
                        "category": item.category,
                        "current_quantity": float(item.current_quantity),
                        "minimum_quantity": float(item.minimum_quantity),
                        "shortage": max(float(item.minimum_quantity - item.current_quantity), 0.0),
                        "unit": item.unit,
                    }
                )

        return {
            "role": current_user.role.value,
            "properties_count": len(allowed_owners),
            "occupancy_pct": 0.0,
            "next_month_occupancy_pct": 0.0,
            "active_reservations_count": 0,
            "upcoming_check_ins_today": 0,
            "upcoming_check_outs_today": 0,
            "gross_revenue": 0.0,
            "total_expenses": 0.0,
            "net_profit": 0.0,
            "net_margin_pct": 0.0,
            "pending_tasks_count": pending_count,
            "completed_tasks_count": completed_count,
            "low_stock_items_count": len(low_stock_alerts),
            "low_stock_alerts": low_stock_alerts,
            "upcoming_tasks": upcoming_tasks[:10],
        }

    # Perfil ADMIN: métricas globais da plataforma
    users_res = await session.execute(
        select(UserModel.role, func.count(UserModel.id))
        .where(UserModel.deleted_at.is_(None))
        .group_by(UserModel.role)
    )
    role_counts = {row[0]: row[1] for row in users_res.all()}
    total_users = sum(role_counts.values())

    props_count = (
        await session.execute(
            select(func.count(PropertyModel.id)).where(PropertyModel.deleted_at.is_(None))
        )
    ).scalar_one() or 0

    res_count = (
        await session.execute(
            select(func.count(ReservationModel.id)).where(
                ReservationModel.status.notin_(["cancelled", "no_show"])
            )
        )
    ).scalar_one() or 0

    open_tasks_count = (
        await session.execute(
            select(func.count(TaskModel.id)).where(
                TaskModel.status.notin_(["completed", "cancelled"])
            )
        )
    ).scalar_one() or 0

    completed_tasks_count = (
        await session.execute(
            select(func.count(TaskModel.id)).where(TaskModel.status == "completed")
        )
    ).scalar_one() or 0

    low_stock_count = (
        await session.execute(
            select(func.count(InventoryItemModel.id)).where(
                InventoryItemModel.is_active.is_(True),
                InventoryItemModel.current_quantity <= InventoryItemModel.minimum_quantity,
            )
        )
    ).scalar_one() or 0

    income_sum = (
        await session.execute(
            select(func.sum(FinancialTransactionModel.amount)).where(
                FinancialTransactionModel.type == "income",
                FinancialTransactionModel.payment_status != "cancelled",
            )
        )
    ).scalar_one() or 0

    expense_sum = (
        await session.execute(
            select(func.sum(FinancialTransactionModel.amount)).where(
                FinancialTransactionModel.type == "expense",
                FinancialTransactionModel.payment_status != "cancelled",
            )
        )
    ).scalar_one() or 0

    gross_rev = float(income_sum)
    tot_exp = float(expense_sum)
    net_prof = round(gross_rev - tot_exp, 2)
    margin = round((net_prof / gross_rev) * 100.0, 2) if gross_rev > 0 else 0.0

    return {
        "role": current_user.role.value,
        "properties_count": props_count,
        "occupancy_pct": 0.0,
        "next_month_occupancy_pct": 0.0,
        "active_reservations_count": res_count,
        "upcoming_check_ins_today": 0,
        "upcoming_check_outs_today": 0,
        "gross_revenue": gross_rev,
        "total_expenses": tot_exp,
        "net_profit": net_prof,
        "net_margin_pct": margin,
        "pending_tasks_count": open_tasks_count,
        "completed_tasks_count": completed_tasks_count,
        "low_stock_items_count": low_stock_count,
        "low_stock_alerts": [],
        "upcoming_tasks": [],
        "users_summary": {
            "total_users": total_users,
            "owners_count": role_counts.get("owner", 0),
            "employees_count": role_counts.get("employee", 0),
            "admins_count": role_counts.get("admin", 0),
        },
    }
