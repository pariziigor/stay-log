import pytest
from httpx import AsyncClient
from app.core.security import create_access_token
from app.modules.identity.domain.value_objects import UserRole
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_auth_extended_lifecycle_and_security(client: AsyncClient, create_test_user):
    # 1. Cria usuário ativo
    user = await create_test_user(
        email="ciclo_vida@locacao.com",
        role=UserRole.OWNER,
        password="InitialPassword123!",
        full_name="Usuário Ciclo Completo",
    )
    headers = auth_headers(str(user.id), user.email, user.role)

    # 2. Alteração de senha com senha atual incorreta -> 401 Unauthorized
    res_wrong_old = await client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "SenhaCompletamenteErrada!",
            "new_password": "NewSecretPassword2026!",
        },
        headers=headers,
    )
    assert res_wrong_old.status_code == 401
    assert res_wrong_old.json()["error"]["code"] == "INVALID_CREDENTIALS"

    # 3. Alteração de senha com sucesso -> 204 No Content
    res_change_ok = await client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "InitialPassword123!",
            "new_password": "NewSecretPassword2026!",
        },
        headers=headers,
    )
    assert res_change_ok.status_code == 204

    # 4. Tentar login com a senha antiga -> Deve falhar com 401
    res_old_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "ciclo_vida@locacao.com",
            "password": "InitialPassword123!",
        },
    )
    assert res_old_login.status_code == 401

    # 5. Login com a nova senha -> Deve ter sucesso com 200
    res_new_login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "ciclo_vida@locacao.com",
            "password": "NewSecretPassword2026!",
        },
    )
    assert res_new_login.status_code == 200
    new_token = res_new_login.json()["access_token"]
    refresh_token = res_new_login.json()["refresh_token"]

    # 6. Registrar consentimento LGPD
    res_consent = await client.post(
        "/api/v1/auth/consent",
        json={
            "consent_type": "ai_data_processing",
            "policy_version": "2.1",
        },
        headers={"Authorization": f"Bearer {new_token}"},
    )
    assert res_consent.status_code == 204

    # 7. Logout revogando refresh token
    res_logout = await client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert res_logout.status_code == 204

    # 8. Tentativa de refresh após logout deve falhar com 401
    res_refresh_after_logout = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert res_refresh_after_logout.status_code == 401


@pytest.mark.asyncio
async def test_auth_token_edge_cases(client: AsyncClient):
    # 1. Requisição sem token
    res_no_token = await client.get("/api/v1/auth/me")
    assert res_no_token.status_code == 401
    assert res_no_token.json()["error"]["code"] == "UNAUTHORIZED"

    # 2. Token malformado
    res_malformed = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert res_malformed.status_code == 401

    # 3. Token com UUID não existente no banco
    fake_token = create_access_token(
        subject="00000000-0000-0000-0000-000000000000",
        role="owner",
        email="ghost@locacao.com",
    )
    res_ghost = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {fake_token}"},
    )
    assert res_ghost.status_code == 401

    # 4. Token com tipo diferente de "access" (ex: refresh token)
    res_invalid_type = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer fake_token_abc"},
    )
    assert res_invalid_type.status_code == 401

