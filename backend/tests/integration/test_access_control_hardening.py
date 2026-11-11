import pytest
from httpx import AsyncClient
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.models import TeamMemberModel
from tests.conftest import auth_headers

PROPERTY_PAYLOAD = {
    "name": "Casa Escopo",
    "property_type": "house",
    "address": {"street": "Rua das Flores", "city": "Florianópolis", "state": "SC"},
    "max_guests": 4,
}


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["admin", "employee"])
async def test_public_register_rejects_privileged_roles(client: AsyncClient, role: str):
    res = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Invasor",
            "email": f"invasor_{role}@host.com",
            "password": "SuperPassword123!",
            "role": role,
        },
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_public_register_defaults_to_owner(client: AsyncClient):
    res = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Novo Dono", "email": "dono@host.com", "password": "SuperPassword123!"},
    )
    assert res.status_code == 201
    assert res.json()["role"] == "owner"


@pytest.mark.asyncio
async def test_employee_only_sees_properties_of_linked_owner(
    client: AsyncClient, create_test_user, db_session
):
    owner_a = await create_test_user(email="dono_a@locacao.com", role=UserRole.OWNER)
    owner_b = await create_test_user(email="dono_b@locacao.com", role=UserRole.OWNER)
    employee = await create_test_user(email="func_escopo@locacao.com", role=UserRole.EMPLOYEE)
    stranger = await create_test_user(email="func_solto@locacao.com", role=UserRole.EMPLOYEE)

    h_a = auth_headers(str(owner_a.id), owner_a.email, owner_a.role)
    h_b = auth_headers(str(owner_b.id), owner_b.email, owner_b.role)
    h_emp = auth_headers(str(employee.id), employee.email, employee.role)
    h_stranger = auth_headers(str(stranger.id), stranger.email, stranger.role)

    prop_a = (await client.post("/api/v1/properties", json=PROPERTY_PAYLOAD, headers=h_a)).json()["id"]
    prop_b = (await client.post("/api/v1/properties", json=PROPERTY_PAYLOAD, headers=h_b)).json()["id"]

    # Sem vínculo: nenhum imóvel visível, nem por ID
    res_none = await client.get("/api/v1/properties", headers=h_emp)
    assert res_none.status_code == 200
    assert res_none.json()["total"] == 0
    assert (await client.get(f"/api/v1/properties/{prop_a}", headers=h_emp)).status_code == 403

    # Vincula o funcionário apenas ao proprietário A
    db_session.add(TeamMemberModel(owner_id=owner_a.id, employee_id=employee.id))
    await db_session.commit()

    res_list = await client.get("/api/v1/properties", headers=h_emp)
    assert res_list.json()["total"] == 1
    assert res_list.json()["items"][0]["id"] == prop_a

    assert (await client.get(f"/api/v1/properties/{prop_a}", headers=h_emp)).status_code == 200
    assert (await client.get(f"/api/v1/properties/{prop_b}", headers=h_emp)).status_code == 403

    # Filtrar por outro proprietário não amplia o escopo
    res_other = await client.get(f"/api/v1/properties?owner_id={owner_b.id}", headers=h_emp)
    assert res_other.json()["total"] == 0

    # Funcionário de outra equipe continua sem acesso
    assert (await client.get("/api/v1/properties", headers=h_stranger)).json()["total"] == 0
