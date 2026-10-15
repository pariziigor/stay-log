import pytest
from httpx import AsyncClient
from app.modules.identity.domain.value_objects import UserRole
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_ai_assistant_rbac_and_flow(client: AsyncClient, create_test_user):
    # 1. Setup users
    owner = await create_test_user(email="owner_ai@locacao.com", role=UserRole.OWNER)
    employee = await create_test_user(email="employee_ai@locacao.com", role=UserRole.EMPLOYEE)

    headers_owner = auth_headers(str(owner.id), owner.email, owner.role)
    headers_emp = auth_headers(str(employee.id), employee.email, employee.role)

    # 2. Funcionário não possui acesso ao Assistente de IA (RF-02 / RF-16) -> 403 Forbidden
    res_emp = await client.post(
        "/api/v1/ai/chat",
        json={"content": "Qual é a taxa de ocupação?"},
        headers=headers_emp,
    )
    assert res_emp.status_code == 403

    res_emp_insights = await client.get("/api/v1/ai/insights", headers=headers_emp)
    assert res_emp_insights.status_code == 403

    # 3. Proprietário envia mensagem sobre ocupação -> Inicia nova conversa
    chat_payload = {
        "content": "Como está a minha taxa de ocupação este mês?",
    }
    res_chat = await client.post(
        "/api/v1/ai/chat",
        json=chat_payload,
        headers=headers_owner,
    )
    assert res_chat.status_code == 200
    chat_data = res_chat.json()
    assert chat_data["role"] == "assistant"
    assert "ocupação" in chat_data["content"].lower() or "ocupacao" in chat_data["content"].lower() or "propriedade" in chat_data["content"].lower()
    assert chat_data["conversation_id"] is not None
    assert len(chat_data["suggested_actions"]) > 0
    conv_id = chat_data["conversation_id"]

    # 4. Continuação da conversa no mesmo fio
    followup_payload = {
        "conversation_id": conv_id,
        "content": "Qual é a sugestão de precificação para o feriado?",
    }
    res_followup = await client.post(
        "/api/v1/ai/chat",
        json=followup_payload,
        headers=headers_owner,
    )
    assert res_followup.status_code == 200
    followup_data = res_followup.json()
    assert followup_data["conversation_id"] == conv_id

    # 5. Listar conversas do proprietário
    res_convs = await client.get("/api/v1/ai/conversations", headers=headers_owner)
    assert res_convs.status_code == 200
    convs_list = res_convs.json()
    assert len(convs_list) >= 1
    assert any(c["id"] == conv_id for c in convs_list)

    # 6. Obter mensagens da conversa
    res_msgs = await client.get(
        f"/api/v1/ai/conversations/{conv_id}/messages",
        headers=headers_owner,
    )
    assert res_msgs.status_code == 200
    msgs = res_msgs.json()
    assert len(msgs) >= 2  # Pelo menos primeira pergunta e resposta

    # 7. Listar insights proativos
    res_insights = await client.get("/api/v1/ai/insights", headers=headers_owner)
    assert res_insights.status_code == 200
    insights = res_insights.json()
    assert isinstance(insights, list)
    if len(insights) > 0:
        insight_id = insights[0]["id"]
        # Dispensar insight
        res_dismiss = await client.post(
            f"/api/v1/ai/insights/{insight_id}/dismiss",
            headers=headers_owner,
        )
        assert res_dismiss.status_code == 204
