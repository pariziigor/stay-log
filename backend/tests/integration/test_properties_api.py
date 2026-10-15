import pytest
from httpx import AsyncClient
from app.modules.identity.domain.value_objects import UserRole
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_properties_crud_and_rbac(client: AsyncClient, create_test_user):
    # Criação de usuários com diferentes papéis
    owner_a = await create_test_user(email="ownerA@locacao.com", role=UserRole.OWNER)
    owner_b = await create_test_user(email="ownerB@locacao.com", role=UserRole.OWNER)
    employee = await create_test_user(email="employee@locacao.com", role=UserRole.EMPLOYEE)
    admin = await create_test_user(email="admin@locacao.com", role=UserRole.ADMIN)

    headers_a = auth_headers(str(owner_a.id), owner_a.email, owner_a.role)
    headers_b = auth_headers(str(owner_b.id), owner_b.email, owner_b.role)
    headers_emp = auth_headers(str(employee.id), employee.email, employee.role)
    headers_admin = auth_headers(str(admin.id), admin.email, admin.role)

    # 1. Catálogo de comodidades
    res_amenities = await client.get("/api/v1/properties/catalog/amenities")
    assert res_amenities.status_code == 200
    assert len(res_amenities.json()) >= 3

    # 2. Funcionário tenta criar imóvel -> deve receber 403 Forbidden
    payload_prop = {
        "name": "Chalé da Montanha",
        "description": "Chalé acolhedor com vista panorâmica.",
        "property_type": "chalet",
        "address": {
            "street": "Estrada das Araucárias",
            "number": "500",
            "city": "Urubici",
            "state": "SC",
            "postal_code": "88650-000",
        },
        "max_guests": 6,
        "bedrooms": 3,
        "bathrooms": 2,
        "beds": 4,
        "area_m2": 120.0,
        "base_nightly_rate": 450.0,
        "cleaning_fee": 150.0,
        "amenity_ids": [1, 3],
    }
    res_emp_create = await client.post("/api/v1/properties", json=payload_prop, headers=headers_emp)
    assert res_emp_create.status_code == 403

    # 3. Owner A cria o imóvel
    res_create_a = await client.post("/api/v1/properties", json=payload_prop, headers=headers_a)
    assert res_create_a.status_code == 201
    prop_a_data = res_create_a.json()
    prop_a_id = prop_a_data["id"]
    assert prop_a_data["name"] == "Chalé da Montanha"
    assert prop_a_data["owner_id"] == str(owner_a.id)
    assert len(prop_a_data["amenities"]) == 2

    # 4. Owner B cria seu próprio imóvel
    payload_prop_b = {
        "name": "Studio Beira-Mar",
        "property_type": "studio",
        "address": {
            "street": "Avenida Atlântica",
            "city": "Balneário Camboriú",
            "state": "SC",
        },
        "max_guests": 2,
        "amenity_ids": [1],
    }
    res_create_b = await client.post("/api/v1/properties", json=payload_prop_b, headers=headers_b)
    assert res_create_b.status_code == 201
    prop_b_id = res_create_b.json()["id"]

    # 5. Isolamento de Tenant na listagem:
    # Owner A só deve ver seu imóvel
    res_list_a = await client.get("/api/v1/properties", headers=headers_a)
    assert res_list_a.status_code == 200
    list_a_data = res_list_a.json()
    assert list_a_data["total"] == 1
    assert list_a_data["items"][0]["id"] == prop_a_id

    # Admin enxerga todos os imóveis da plataforma
    res_list_admin = await client.get("/api/v1/properties", headers=headers_admin)
    assert res_list_admin.status_code == 200
    assert res_list_admin.json()["total"] == 2

    # 6. Proteção de acesso cruzado a detalhes:
    # Owner B tentando acessar imóvel de Owner A -> 403 Forbidden
    res_cross = await client.get(f"/api/v1/properties/{prop_a_id}", headers=headers_b)
    assert res_cross.status_code == 403

    # Owner A acessa com sucesso
    res_detail = await client.get(f"/api/v1/properties/{prop_a_id}", headers=headers_a)
    assert res_detail.status_code == 200

    # 7. Atualização de imóvel por Owner A
    res_update = await client.put(
        f"/api/v1/properties/{prop_a_id}",
        json={"name": "Chalé da Montanha Premium", "max_guests": 8},
        headers=headers_a,
    )
    assert res_update.status_code == 200
    assert res_update.json()["name"] == "Chalé da Montanha Premium"
    assert res_update.json()["max_guests"] == 8

    # 8. Soft Delete
    res_del = await client.delete(f"/api/v1/properties/{prop_a_id}", headers=headers_a)
    assert res_del.status_code == 204

    # Imóvel não deve mais aparecer na listagem
    res_list_after_del = await client.get("/api/v1/properties", headers=headers_a)
    assert res_list_after_del.json()["total"] == 0
