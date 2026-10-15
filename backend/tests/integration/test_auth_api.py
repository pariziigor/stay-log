import pytest
from httpx import AsyncClient
from app.modules.identity.domain.value_objects import UserRole


@pytest.mark.asyncio
async def test_register_and_login_flow(client: AsyncClient):
    # 1. Registro de Proprietário
    reg_payload = {
        "full_name": "Mariana Santos",
        "email": "mariana@host.com",
        "password": "SuperPassword123!",
        "role": "owner",
        "phone": "48999998888",
        "consent_terms": True,
    }
    res_reg = await client.post("/api/v1/auth/register", json=reg_payload)
    assert res_reg.status_code == 201
    data_reg = res_reg.json()
    assert data_reg["email"] == "mariana@host.com"
    assert data_reg["role"] == "owner"
    assert "id" in data_reg

    # Registro duplicado deve falhar com 409
    res_dup = await client.post("/api/v1/auth/register", json=reg_payload)
    assert res_dup.status_code == 409

    # 2. Login com sucesso
    login_payload = {
        "email": "mariana@host.com",
        "password": "SuperPassword123!",
    }
    res_login = await client.post("/api/v1/auth/login", json=login_payload)
    assert res_login.status_code == 200
    token_data = res_login.json()
    assert "access_token" in token_data
    assert "refresh_token" in token_data
    assert token_data["role"] == "owner"

    access_token = token_data["access_token"]
    refresh_token = token_data["refresh_token"]

    # 3. Acesso à rota protegida /me
    headers = {"Authorization": f"Bearer {access_token}"}
    res_me = await client.get("/api/v1/auth/me", headers=headers)
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert me_data["email"] == "mariana@host.com"

    # 4. Rotação de Refresh Token
    res_refresh = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert res_refresh.status_code == 200
    new_token_data = res_refresh.json()
    assert new_token_data["access_token"] != access_token
    assert new_token_data["refresh_token"] != refresh_token

    # 5. Tentativa de reuso do token antigo (deve ser rejeitada e disparar alarme de segurança)
    res_reused = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert res_reused.status_code == 401


@pytest.mark.asyncio
async def test_brute_force_lockout(client: AsyncClient, create_test_user):
    user = await create_test_user(
        email="vitima@alvo.com",
        password="CorrectPassword123!",
    )

    # Errar a senha 5 vezes consecutivas
    for _ in range(5):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "vitima@alvo.com", "password": "WrongPassword!"},
        )
        assert res.status_code == 401

    # 6ª tentativa: conta deve estar bloqueada com 423 Locked
    res_locked = await client.post(
        "/api/v1/auth/login",
        json={"email": "vitima@alvo.com", "password": "CorrectPassword123!"},
    )
    assert res_locked.status_code == 423
    assert res_locked.json()["error"]["code"] == "ACCOUNT_LOCKED"
