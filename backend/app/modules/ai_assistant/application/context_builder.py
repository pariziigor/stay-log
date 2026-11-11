import calendar
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.modules.bookings.infrastructure.models import ReservationModel
from app.modules.finance.infrastructure.models import (
    FinancialCategoryModel,
    FinancialTransactionModel,
)
from app.modules.inventory.infrastructure.models import InventoryItemModel
from app.modules.operations.infrastructure.models import TaskModel
from app.modules.properties.infrastructure.models import PropertyModel


class OperationalContextBuilder:
    """Coletor e agregador de dados operacionais reais da plataforma para o Assistente de IA.

    Converte registros do banco de dados em um contexto estruturado e higienizado (sem PII de hóspedes),
    permitindo análises embasadas em dados reais de ocupação, estoque, tarefas e finanças.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def build_context_for_owner(
        self,
        owner_id: uuid.UUID,
        property_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        today = now.date()

        # 1. Imóveis do proprietário
        prop_stmt = select(PropertyModel).where(
            PropertyModel.owner_id == owner_id,
            PropertyModel.deleted_at.is_(None),
        )
        if property_id:
            prop_stmt = prop_stmt.where(PropertyModel.id == property_id)

        result = await self._session.execute(prop_stmt)
        properties = list(result.scalars().all())
        prop_ids = [p.id for p in properties]
        prop_names = {p.id: p.name for p in properties}

        properties_summary = [
            {
                "id": str(p.id),
                "name": p.name,
                "type": p.property_type,
                "city": p.address_city,
                "state": p.address_state,
                "max_guests": p.max_guests,
                "bedrooms": p.bedrooms,
                "base_nightly_rate": float(p.base_nightly_rate) if p.base_nightly_rate is not None else None,
                "cleaning_fee": float(p.cleaning_fee),
                "status": p.status,
            }
            for p in properties
        ]

        if not prop_ids:
            return {
                "generated_at": now.isoformat(),
                "owner_id": str(owner_id),
                "properties_count": 0,
                "properties": [],
                "occupancy": {
                    "current_month_occupancy_pct": 0.0,
                    "next_month_projected_pct": 0.0,
                    "total_active_reservations": 0,
                    "upcoming_check_ins_today": 0,
                    "upcoming_check_outs_today": 0,
                },
                "inventory_alerts": [],
                "operations": {
                    "pending_cleaning_count": 0,
                    "pending_maintenance_count": 0,
                    "overdue_tasks": [],
                    "today_tasks": [],
                },
                "financial": {
                    "period": now.strftime("%m/%Y"),
                    "gross_revenue": 0.0,
                    "platform_fees_deducted": 0.0,
                    "operational_cleaning_expenses": 0.0,
                    "maintenance_expenses": 0.0,
                    "estimated_net_profit": 0.0,
                    "net_margin_pct": 0.0,
                },
            }

        # 2. Dados reais de ocupação e reservas (sem dados pessoais de hóspedes - LGPD)
        res_stmt = select(ReservationModel).where(
            ReservationModel.property_id.in_(prop_ids),
            ReservationModel.status.notin_(["cancelled", "no_show"]),
        )
        res_result = await self._session.execute(res_stmt)
        active_reservations = list(res_result.scalars().all())

        days_in_cur_month = calendar.monthrange(today.year, today.month)[1]
        cur_month_start = date(today.year, today.month, 1)
        cur_month_end = date(today.year, today.month, days_in_cur_month)

        next_year = today.year + (1 if today.month == 12 else 0)
        next_month = 1 if today.month == 12 else today.month + 1
        days_in_next_month = calendar.monthrange(next_year, next_month)[1]
        next_month_start = date(next_year, next_month, 1)
        next_month_end = date(next_year, next_month, days_in_next_month)

        occupied_nights_cur = 0
        occupied_nights_next = 0
        check_ins_today = 0
        check_outs_today = 0
        total_reservation_revenue = Decimal("0.00")
        total_platform_fees = Decimal("0.00")

        for r in active_reservations:
            if r.check_in_date == today:
                check_ins_today += 1
            if r.check_out_date == today:
                check_outs_today += 1

            # Interseção com o mês corrente
            overlap_start = max(r.check_in_date, cur_month_start)
            overlap_end = min(r.check_out_date, cur_month_end)
            if overlap_end > overlap_start:
                occupied_nights_cur += (overlap_end - overlap_start).days

            # Interseção com o próximo mês
            n_start = max(r.check_in_date, next_month_start)
            n_end = min(r.check_out_date, next_month_end)
            if n_end > n_start:
                occupied_nights_next += (n_end - n_start).days

            total_reservation_revenue += Decimal(str(r.total_amount))
            total_platform_fees += Decimal(str(r.platform_fee))

        total_capacity_cur = max(len(prop_ids) * days_in_cur_month, 1)
        total_capacity_next = max(len(prop_ids) * days_in_next_month, 1)

        occupancy_data = {
            "current_month_occupancy_pct": round(min((occupied_nights_cur / total_capacity_cur) * 100.0, 100.0), 1),
            "next_month_projected_pct": round(min((occupied_nights_next / total_capacity_next) * 100.0, 100.0), 1),
            "total_active_reservations": len(active_reservations),
            "upcoming_check_ins_today": check_ins_today,
            "upcoming_check_outs_today": check_outs_today,
        }

        # 3. Suprimentos com estoque baixo no banco de dados
        inv_stmt = select(InventoryItemModel).where(
            InventoryItemModel.property_id.in_(prop_ids),
            InventoryItemModel.is_active.is_(True),
            InventoryItemModel.current_quantity <= InventoryItemModel.minimum_quantity,
        )
        inv_result = await self._session.execute(inv_stmt)
        low_stock_models = list(inv_result.scalars().all())

        low_stock_items = [
            {
                "property_name": prop_names.get(item.property_id, "Imóvel"),
                "item_name": item.name,
                "category": item.category,
                "current_quantity": float(item.current_quantity),
                "minimum_quantity": float(item.minimum_quantity),
                "shortage": max(float(item.minimum_quantity - item.current_quantity), 0.0),
                "unit": item.unit,
            }
            for item in low_stock_models
        ]

        # 4. Tarefas e Operações de Campo reais
        task_stmt = (
            select(TaskModel)
            .options(selectinload(TaskModel.checklist_items))
            .where(
                TaskModel.property_id.in_(prop_ids),
                TaskModel.status.notin_(["completed", "cancelled"]),
            )
        )
        task_result = await self._session.execute(task_stmt)
        open_tasks = list(task_result.scalars().all())

        pending_cleaning = sum(1 for t in open_tasks if t.task_type == "cleaning")
        pending_maintenance = sum(1 for t in open_tasks if t.task_type == "maintenance")
        overdue_list = []
        today_list = []

        for t in open_tasks:
            due_dt = t.due_at if t.due_at.tzinfo else t.due_at.replace(tzinfo=timezone.utc)
            total_chk = len(t.checklist_items)
            done_chk = sum(1 for c in t.checklist_items if c.is_checked)
            progress_str = (
                f"{int((done_chk / total_chk) * 100)}% ({done_chk} de {total_chk} itens concluídos)"
                if total_chk > 0
                else "Sem checklist"
            )
            entry = {
                "title": t.title,
                "property": prop_names.get(t.property_id, "Imóvel"),
                "due_time": due_dt.strftime("%H:%M"),
                "status": t.status,
                "checklist_progress": progress_str,
            }
            if due_dt < now:
                overdue_list.append(entry)
            if due_dt.date() == today:
                today_list.append(entry)

        operational_tasks = {
            "pending_cleaning_count": pending_cleaning,
            "pending_maintenance_count": pending_maintenance,
            "overdue_tasks": overdue_list,
            "today_tasks": today_list,
        }

        # 5. Fluxo de Caixa Real
        tx_stmt = (
            select(FinancialTransactionModel, FinancialCategoryModel.name)
            .join(FinancialCategoryModel, FinancialCategoryModel.id == FinancialTransactionModel.category_id)
            .where(
                FinancialTransactionModel.property_id.in_(prop_ids),
                FinancialTransactionModel.payment_status != "cancelled",
            )
        )
        tx_result = await self._session.execute(tx_stmt)
        tx_rows = tx_result.all()

        tx_income = Decimal("0.00")
        cleaning_expenses = Decimal("0.00")
        maintenance_expenses = Decimal("0.00")
        other_expenses = Decimal("0.00")

        for tx, cat_name in tx_rows:
            amt = Decimal(str(tx.amount))
            if tx.type == "income":
                tx_income += amt
            else:
                cat_lower = cat_name.lower()
                if "limpeza" in cat_lower or "lavanderia" in cat_lower:
                    cleaning_expenses += amt
                elif "manutenção" in cat_lower or "manutencao" in cat_lower or "reparo" in cat_lower:
                    maintenance_expenses += amt
                else:
                    other_expenses += amt

        gross_revenue = float(tx_income if tx_income > 0 else total_reservation_revenue)
        platform_fees = float(total_platform_fees)
        clean_exp = float(cleaning_expenses)
        maint_exp = float(maintenance_expenses + other_expenses)
        net_profit = gross_revenue - platform_fees - clean_exp - maint_exp
        net_margin_pct = round((net_profit / gross_revenue) * 100.0, 2) if gross_revenue > 0 else 0.0

        financial_summary = {
            "period": now.strftime("%m/%Y"),
            "gross_revenue": round(gross_revenue, 2),
            "platform_fees_deducted": round(platform_fees, 2),
            "operational_cleaning_expenses": round(clean_exp, 2),
            "maintenance_expenses": round(maint_exp, 2),
            "estimated_net_profit": round(net_profit, 2),
            "net_margin_pct": net_margin_pct,
        }

        return {
            "generated_at": now.isoformat(),
            "owner_id": str(owner_id),
            "properties_count": len(properties_summary),
            "properties": properties_summary,
            "occupancy": occupancy_data,
            "inventory_alerts": low_stock_items,
            "operations": operational_tasks,
            "financial": financial_summary,
        }
