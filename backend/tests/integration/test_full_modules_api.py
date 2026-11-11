from datetime import date, datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from app.modules.identity.domain.value_objects import UserRole
from tests.conftest import auth_headers


async def _create_sample_property(client: AsyncClient, headers: dict, name: str = "Casa Vista Mar") -> dict:
    payload = {
        "name": name,
        "description": "Imóvel completo para temporada",
        "property_type": "house",
        "address": {
            "street": "Av. Atlântica",
            "number": "500",
            "neighborhood": "Centro",
            "city": "Florianópolis",
            "state": "SC",
            "postal_code": "88010-000",
            "country": "BR",
        },
        "max_guests": 4,
        "bedrooms": 2,
        "bathrooms": 2,
        "beds": 3,
        "base_nightly_rate": "450.00",
        "cleaning_fee": "150.00",
        "amenity_ids": [1, 2],
    }
    res = await client.post("/api/v1/properties", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


@pytest.mark.asyncio
async def test_tasks_and_checklist_blocking_rule_rf11(client: AsyncClient, create_test_user):
    owner = await create_test_user(email="owner_tasks@locacao.com", role=UserRole.OWNER)
    headers_owner = auth_headers(str(owner.id), owner.email, owner.role)

    prop = await _create_sample_property(client, headers_owner, "Chalé Serra Azul")

    # 1. Owner cadastra funcionário na sua equipe via /api/v1/users/team
    res_team = await client.post(
        "/api/v1/users/team",
        json={
            "full_name": "Marta Equipe",
            "email": "marta_campo@locacao.com",
            "password": "Password123!",
            "job_title": "Governanta",
        },
        headers=headers_owner,
    )
    assert res_team.status_code == 201, res_team.text
    emp_id = res_team.json()["employee_id"]
    headers_emp = auth_headers(emp_id, "marta_campo@locacao.com", UserRole.EMPLOYEE.value)

    # 2. Owner cria tarefa com 2 itens de checklist obrigatórios
    due_str = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
    res_task = await client.post(
        "/api/v1/tasks",
        json={
            "property_id": prop["id"],
            "task_type": "cleaning",
            "title": "Limpeza pós-checkout",
            "priority": "high",
            "due_at": due_str,
            "assigned_to": emp_id,
            "checklist_items": [
                {"description": "Trocar roupa de cama", "is_required": True},
                {"description": "Higienizar banheiros", "is_required": True},
            ],
        },
        headers=headers_owner,
    )
    assert res_task.status_code == 201, res_task.text
    task = res_task.json()
    task_id = task["id"]
    assert len(task["checklist_items"]) == 2

    # 3. Funcionário tenta concluir a tarefa sem marcar o checklist -> 422 PENDING_CHECKLIST_ITEMS (RF-11)
    res_block = await client.patch(
        f"/api/v1/tasks/{task_id}/status",
        json={"status": "completed"},
        headers=headers_emp,
    )
    assert res_block.status_code == 422
    assert res_block.json()["error"]["code"] == "PENDING_CHECKLIST_ITEMS"

    # 4. Funcionário marca os 2 itens do checklist -> status avança para in_progress
    for item in task["checklist_items"]:
        res_chk = await client.patch(
            f"/api/v1/tasks/{task_id}/checklist/{item['id']}",
            json={"is_checked": True},
            headers=headers_emp,
        )
        assert res_chk.status_code == 200
        assert res_chk.json()["status"] == "in_progress"

    # 5. Agora a conclusão da tarefa é permitida -> 200 OK
    res_complete = await client.patch(
        f"/api/v1/tasks/{task_id}/status",
        json={"status": "completed", "completion_notes": "Imóvel impecável e pronto."},
        headers=headers_emp,
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["status"] == "completed"
    assert res_complete.json()["completed_at"] is not None


@pytest.mark.asyncio
async def test_bookings_overlap_capacity_and_lgpd_anonymization(client: AsyncClient, create_test_user):
    owner = await create_test_user(email="owner_bookings@locacao.com", role=UserRole.OWNER)
    headers_owner = auth_headers(str(owner.id), owner.email, owner.role)

    prop = await _create_sample_property(client, headers_owner, "Loft Praia Brava")
    today = date.today()

    # 1. Excesso de capacidade (max_guests = 4, tentando reservar para 6) -> 422
    res_cap = await client.post(
        "/api/v1/bookings",
        json={
            "property_id": prop["id"],
            "guest_name": "João Hóspede",
            "check_in_date": (today + timedelta(days=5)).isoformat(),
            "check_out_date": (today + timedelta(days=8)).isoformat(),
            "guests_count": 6,
        },
        headers=headers_owner,
    )
    assert res_cap.status_code == 422
    assert res_cap.json()["error"]["code"] == "GUEST_CAPACITY_EXCEEDED"

    # 2. Cria reserva válida de D+5 a D+8
    res_ok = await client.post(
        "/api/v1/bookings",
        json={
            "property_id": prop["id"],
            "guest_name": "Carlos Hóspede",
            "guest_email": "carlos@hospede.com",
            "guest_phone": "48999990000",
            "source": "airbnb",
            "check_in_date": (today + timedelta(days=5)).isoformat(),
            "check_out_date": (today + timedelta(days=8)).isoformat(),
            "guests_count": 3,
            "platform_fee": "120.00",
        },
        headers=headers_owner,
    )
    assert res_ok.status_code == 201, res_ok.text
    booking = res_ok.json()
    assert booking["nights"] == 3
    # 3 noites * 450 + 150 limpeza = 1500.00
    assert float(booking["total_amount"]) == 1500.0

    # 3. Tenta criar reserva sobreposta (D+6 a D+9) -> 409 Conflict
    res_overlap = await client.post(
        "/api/v1/bookings",
        json={
            "property_id": prop["id"],
            "guest_name": "Outro Hóspede",
            "check_in_date": (today + timedelta(days=6)).isoformat(),
            "check_out_date": (today + timedelta(days=9)).isoformat(),
            "guests_count": 2,
        },
        headers=headers_owner,
    )
    assert res_overlap.status_code == 409
    assert res_overlap.json()["error"]["code"] == "ALREADY_EXISTS"

    # 4. Cancela primeira reserva -> libera agenda para nova reserva no mesmo período
    res_cancel = await client.patch(
        f"/api/v1/bookings/{booking['id']}/status",
        json={"status": "cancelled", "cancellation_reason": "Mudança de voo"},
        headers=headers_owner,
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["status"] == "cancelled"

    res_rebook = await client.post(
        "/api/v1/bookings",
        json={
            "property_id": prop["id"],
            "guest_name": "Novo Hóspede Confirmado",
            "check_in_date": (today + timedelta(days=6)).isoformat(),
            "check_out_date": (today + timedelta(days=9)).isoformat(),
            "guests_count": 2,
        },
        headers=headers_owner,
    )
    assert res_rebook.status_code == 201

    # 5. Anonimização LGPD do hóspede (art. 18)
    res_anon = await client.post(
        f"/api/v1/bookings/guests/{booking['guest_id']}/anonymize",
        headers=headers_owner,
    )
    assert res_anon.status_code == 200
    anon_guest = res_anon.json()
    assert anon_guest["email"] is None
    assert anon_guest["phone"] is None
    assert anon_guest["anonymized_at"] is not None


@pytest.mark.asyncio
async def test_inventory_finance_dashboard_and_real_ai_grounding(client: AsyncClient, create_test_user):
    owner = await create_test_user(email="owner_full@locacao.com", role=UserRole.OWNER)
    headers_owner = auth_headers(str(owner.id), owner.email, owner.role)

    prop = await _create_sample_property(client, headers_owner, "Cobertura Jurerê")

    # 1. Estoque (RF-12): cadastra item com 5 unidades e mínimo de 4
    res_item = await client.post(
        "/api/v1/inventory/items",
        json={
            "property_id": prop["id"],
            "name": "Kit Sabonete Líquido",
            "category": "higiene",
            "unit": "un",
            "initial_quantity": "5",
            "minimum_quantity": "4",
        },
        headers=headers_owner,
    )
    assert res_item.status_code == 201, res_item.text
    item_id = res_item.json()["id"]
    assert res_item.json()["is_low_stock"] is False

    # 2. Tenta dar saída de 8 unidades (saldo ficaria -3) -> 422 INSUFFICIENT_STOCK
    res_neg = await client.post(
        "/api/v1/inventory/movements",
        json={
            "item_id": item_id,
            "movement_type": "out",
            "quantity": "8",
            "reason": "Consumo excessivo",
        },
        headers=headers_owner,
    )
    assert res_neg.status_code == 422
    assert res_neg.json()["error"]["code"] == "INSUFFICIENT_STOCK"

    # 3. Dá saída válida de 3 unidades -> saldo cai para 2 (abaixo do mínimo 4 -> low stock!)
    res_out = await client.post(
        "/api/v1/inventory/movements",
        json={
            "item_id": item_id,
            "movement_type": "out",
            "quantity": "3",
            "reason": "Reposição de check-in",
        },
        headers=headers_owner,
    )
    assert res_out.status_code == 201
    assert float(res_out.json()["balance_after"]) == 2.0

    # 4. Financeiro (RF-13): lista categorias do sistema
    res_cats = await client.get("/api/v1/finance/categories", headers=headers_owner)
    assert res_cats.status_code == 200
    cats = res_cats.json()
    income_cat = next(c for c in cats if c["type"] == "income")
    expense_cat = next(c for c in cats if c["type"] == "expense")

    # 5. Tenta lançar despesa em categoria de receita -> 422 CATEGORY_TYPE_MISMATCH
    res_mismatch = await client.post(
        "/api/v1/finance/transactions",
        json={
            "property_id": prop["id"],
            "category_id": income_cat["id"],
            "type": "expense",
            "amount": "200.00",
            "description": "Lançamento inconsistente",
            "transaction_date": date.today().isoformat(),
        },
        headers=headers_owner,
    )
    assert res_mismatch.status_code == 422
    assert res_mismatch.json()["error"]["code"] == "CATEGORY_TYPE_MISMATCH"

    # 6. Lança receita de R$ 2.000 e despesa de R$ 500
    res_inc = await client.post(
        "/api/v1/finance/transactions",
        json={
            "property_id": prop["id"],
            "category_id": income_cat["id"],
            "type": "income",
            "amount": "2000.00",
            "description": "Reserva Fim de Semana",
            "transaction_date": date.today().isoformat(),
        },
        headers=headers_owner,
    )
    assert res_inc.status_code == 201

    res_exp = await client.post(
        "/api/v1/finance/transactions",
        json={
            "property_id": prop["id"],
            "category_id": expense_cat["id"],
            "type": "expense",
            "amount": "500.00",
            "description": "Lavanderia industrial",
            "transaction_date": date.today().isoformat(),
        },
        headers=headers_owner,
    )
    assert res_exp.status_code == 201

    res_summary = await client.get("/api/v1/finance/summary", headers=headers_owner)
    assert res_summary.status_code == 200
    fin_sum = res_summary.json()
    assert float(fin_sum["total_income"]) == 2000.0
    assert float(fin_sum["total_expense"]) == 500.0
    assert float(fin_sum["net_result"]) == 1500.0
    assert fin_sum["margin_pct"] == 75.0

    # 7. Verifica Dashboard Summary e Copiloto de IA fundamentados nos dados reais
    res_dash = await client.get("/api/v1/dashboard/summary", headers=headers_owner)
    assert res_dash.status_code == 200
    dash = res_dash.json()
    assert dash["properties_count"] == 1
    assert dash["low_stock_items_count"] == 1
    assert dash["low_stock_alerts"][0]["item_name"] == "Kit Sabonete Líquido"

    res_ai = await client.post(
        "/api/v1/ai/chat",
        json={"content": "Tem algum item de estoque acabando?"},
        headers=headers_owner,
    )
    assert res_ai.status_code == 200
    ai_reply = res_ai.json()["content"]
    assert "Kit Sabonete Líquido" in ai_reply
    assert "Cobertura Jurerê" in ai_reply
