import uuid
import pytest
from httpx import AsyncClient
from app.modules.identity.domain.value_objects import UserRole
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_ai_idor_and_cross_tenant_protection(client: AsyncClient, create_test_user):
    """Garante que nenhum usuário consiga visualizar, injetar mensagens ou dispensar insights

    pertencentes a outro proprietário (proteção estrita contra IDOR / Tenant Isolation).
    """
    owner_a = await create_test_user(email="proprietario_a@locacao.com", role=UserRole.OWNER)
    owner_b = await create_test_user(email="proprietario_b@locacao.com", role=UserRole.OWNER)
    admin = await create_test_user(email="admin_ai_audit@locacao.com", role=UserRole.ADMIN)

    headers_a = auth_headers(str(owner_a.id), owner_a.email, owner_a.role)
    headers_b = auth_headers(str(owner_b.id), owner_b.email, owner_b.role)
    headers_admin = auth_headers(str(admin.id), admin.email, admin.role)

    # 1. Owner A cria uma conversa com o assistente de IA
    res_chat = await client.post(
        "/api/v1/ai/chat",
        json={"content": "Como otimizar a precificação das minhas diárias?"},
        headers=headers_a,
    )
    assert res_chat.status_code == 200
    conv_a_id = res_chat.json()["conversation_id"]

    # 2. Owner B tenta ler as mensagens da conversa de Owner A -> 403 Forbidden
    res_idor_get = await client.get(
        f"/api/v1/ai/conversations/{conv_a_id}/messages",
        headers=headers_b,
    )
    assert res_idor_get.status_code == 403
    assert res_idor_get.json()["error"]["code"] == "FORBIDDEN"

    # 3. Owner B tenta injetar uma mensagem no fio da conversa de Owner A -> 403 Forbidden
    res_idor_post = await client.post(
        "/api/v1/ai/chat",
        json={
            "conversation_id": conv_a_id,
            "content": "Tentativa de injeção em conversa alheia",
        },
        headers=headers_b,
    )
    assert res_idor_post.status_code == 403
    assert res_idor_post.json()["error"]["code"] == "FORBIDDEN"

    # 4. Consulta de mensagens em conversa inexistente -> 404 Not Found
    random_uuid = str(uuid.uuid4())
    res_not_found = await client.get(
        f"/api/v1/ai/conversations/{random_uuid}/messages",
        headers=headers_a,
    )
    assert res_not_found.status_code == 404
    assert res_not_found.json()["error"]["code"] == "NOT_FOUND"

    # 5. Owner A visualiza seus insights
    res_insights_a = await client.get("/api/v1/ai/insights", headers=headers_a)
    assert res_insights_a.status_code == 200
    insights_a = res_insights_a.json()
    assert len(insights_a) >= 1
    insight_a_id = insights_a[0]["id"]

    # 6. Owner B tenta dispensar insight pertencente a Owner A -> 403 Forbidden
    res_dismiss_cross = await client.post(
        f"/api/v1/ai/insights/{insight_a_id}/dismiss",
        headers=headers_b,
    )
    assert res_dismiss_cross.status_code == 403
    assert res_dismiss_cross.json()["error"]["code"] == "FORBIDDEN"

    # 7. Tentativa de dispensar insight inexistente -> 404 Not Found
    res_dismiss_not_found = await client.post(
        f"/api/v1/ai/insights/{random_uuid}/dismiss",
        headers=headers_a,
    )
    assert res_dismiss_not_found.status_code == 404
    assert res_dismiss_not_found.json()["error"]["code"] == "NOT_FOUND"

    # 8. Administrador tem permissão para auditar mensagens de qualquer conversa
    res_admin_audit = await client.get(
        f"/api/v1/ai/conversations/{conv_a_id}/messages",
        headers=headers_admin,
    )
    assert res_admin_audit.status_code == 200
    assert len(res_admin_audit.json()) >= 2

