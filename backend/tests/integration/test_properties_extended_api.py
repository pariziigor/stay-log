import uuid
import pytest
from httpx import AsyncClient
from app.modules.identity.domain.value_objects import UserRole
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_properties_filters_pagination_and_exceptions(client: AsyncClient, create_test_user):
    admin = await create_test_user(email="admin_prop_filter@locacao.com", role=UserRole.ADMIN)
    owner = await create_test_user(email="owner_prop_filter@locacao.com", role=UserRole.OWNER)
    other_owner = await create_test_user(email="other_owner_filter@locacao.com", role=UserRole.OWNER)
    employee = await create_test_user(email="employee_prop@locacao.com", role=UserRole.EMPLOYEE)

    headers_admin = auth_headers(str(admin.id), admin.email, admin.role)
    headers_owner = auth_headers(str(owner.id), owner.email, owner.role)
    headers_other = auth_headers(str(other_owner.id), other_owner.email, other_owner.role)
    headers_emp = auth_headers(str(employee.id), employee.email, employee.role)

    # 1. Cadastra 3 propriedades distintas para testar filtros
    p1 = {
        "name": "Pousada dos Pinhais",
        "property_type": "chalet",
        "address": {"street": "Rodovia SC-430", "city": "Urubici", "state": "SC"},
        "max_guests": 8,
        "base_nightly_rate": 600.0,
        "cleaning_fee": 180.0,
        "amenity_ids": [1],
    }
    p2 = {
        "name": "Loft Praia Brava",
        "property_type": "studio",
        "address": {"street": "Av Jose Medeiros", "city": "Itajaí", "state": "SC"},
        "max_guests": 2,
        "base_nightly_rate": 350.0,
        "cleaning_fee": 100.0,
        "amenity_ids": [1, 2],
    }
    p3 = {
        "name": "Casa de Campo Serra Geral",
        "property_type": "house",
        "address": {"street": "Estrada Geral", "city": "Urubici", "state": "SC"},
        "max_guests": 10,
        "base_nightly_rate": 800.0,
        "cleaning_fee": 250.0,
        "amenity_ids": [1, 2, 3],
    }

    res1 = await client.post("/api/v1/properties", json=p1, headers=headers_owner)
    assert res1.status_code == 201
    prop1_id = res1.json()["id"]

    res2 = await client.post("/api/v1/properties", json=p2, headers=headers_owner)
    assert res2.status_code == 201

    res3 = await client.post("/api/v1/properties", json=p3, headers=headers_owner)
    assert res3.status_code == 201
    prop3_id = res3.json()["id"]

    # 2. Teste de filtro por cidade (Urubici deve retornar 2 registros)
    res_city = await client.get("/api/v1/properties?city=Urubici", headers=headers_owner)
    assert res_city.status_code == 200
    assert res_city.json()["total"] == 2

    # 3. Teste de filtro por capacidade mínima (min_guests=9 deve retornar apenas p3)
    res_guests = await client.get("/api/v1/properties?min_guests=9", headers=headers_owner)
    assert res_guests.status_code == 200
    assert res_guests.json()["total"] == 1
    assert res_guests.json()["items"][0]["name"] == "Casa de Campo Serra Geral"

    # 4. Teste de filtro por tipo de imóvel (studio deve retornar apenas p2)
    res_type = await client.get("/api/v1/properties?property_type=studio", headers=headers_owner)
    assert res_type.status_code == 200
    assert res_type.json()["total"] == 1
    assert res_type.json()["items"][0]["name"] == "Loft Praia Brava"

    # 5. Teste de paginação (page=1, page_size=2)
    res_pag1 = await client.get("/api/v1/properties?page=1&page_size=2", headers=headers_owner)
    assert res_pag1.status_code == 200
    data_pag1 = res_pag1.json()
    assert data_pag1["total"] == 3
    assert len(data_pag1["items"]) == 2
    assert data_pag1["page"] == 1

    # Página 2 deve retornar o 1 item restante
    res_pag2 = await client.get("/api/v1/properties?page=2&page_size=2", headers=headers_owner)
    assert res_pag2.status_code == 200
    data_pag2 = res_pag2.json()
    assert len(data_pag2["items"]) == 1
    assert data_pag2["page"] == 2

    # 6. Tentativa de obter imóvel inexistente -> 404 Not Found
    fake_uuid = str(uuid.uuid4())
    res_404_get = await client.get(f"/api/v1/properties/{fake_uuid}", headers=headers_owner)
    assert res_404_get.status_code == 404
    assert res_404_get.json()["error"]["code"] == "PROPERTY_NOT_FOUND"

    # 7. Tentativa de atualizar imóvel inexistente -> 404 Not Found
    res_404_put = await client.put(
        f"/api/v1/properties/{fake_uuid}",
        json={"name": "Inexistente"},
        headers=headers_owner,
    )
    assert res_404_put.status_code == 404

    # 8. Tentativa de deletar imóvel inexistente -> 404 Not Found
    res_404_del = await client.delete(f"/api/v1/properties/{fake_uuid}", headers=headers_owner)
    assert res_404_del.status_code == 404

    # 9. Outro proprietário tentando editar imóvel alheio -> 403 Forbidden
    res_cross_put = await client.put(
        f"/api/v1/properties/{prop1_id}",
        json={"name": "Hacked Name"},
        headers=headers_other,
    )
    assert res_cross_put.status_code == 403

    # 10. Outro proprietário tentando deletar imóvel alheio -> 403 Forbidden
    res_cross_del = await client.delete(
        f"/api/v1/properties/{prop1_id}",
        headers=headers_other,
    )
    assert res_cross_del.status_code == 403

    # 11. Funcionário tentando deletar imóvel -> 403 Forbidden
    res_emp_del = await client.delete(
        f"/api/v1/properties/{prop1_id}",
        headers=headers_emp,
    )
    assert res_emp_del.status_code == 403

    # 12. Validação de payload inválido (max_guests <= 0 deve falhar na validação)
    bad_payload = {
        "name": "Inválido",
        "property_type": "chalet",
        "address": {"street": "Rua X", "city": "Cidade", "state": "SC"},
        "max_guests": 0,
    }
    res_bad = await client.post("/api/v1/properties", json=bad_payload, headers=headers_owner)
    assert res_bad.status_code == 422
    assert res_bad.json()["error"]["code"] == "VALIDATION_ERROR"

