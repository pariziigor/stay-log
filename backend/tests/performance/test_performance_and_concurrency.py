import asyncio
import time
import pytest
from httpx import AsyncClient
from app.modules.identity.domain.value_objects import UserRole
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_concurrent_health_and_api_throughput(client: AsyncClient, create_test_user):
    """Teste de concorrência e carga automatizado (RNF-05 / RNF-09).

    Executa requisições assíncronas concorrentes medindo tempos de resposta
    e verificando ausência de contenção ou falhas.
    """
    owner = await create_test_user(email="perf_owner@locacao.com", role=UserRole.OWNER)
    headers = auth_headers(str(owner.id), owner.email, owner.role)

    # 1. Teste de concorrência no endpoint /health (30 requisições simultâneas)
    start_time = time.perf_counter()
    tasks_health = [client.get("/health") for _ in range(30)]
    responses_health = await asyncio.gather(*tasks_health)
    elapsed_health = time.perf_counter() - start_time

    assert all(r.status_code == 200 for r in responses_health)
    assert elapsed_health < 3.0  # Menos de 3 segundos para 30 requisições concorrentes

    # 2. Teste de concorrência autenticada em /api/v1/properties (15 consultas simultâneas)
    start_time_auth = time.perf_counter()
    tasks_props = [client.get("/api/v1/properties", headers=headers) for _ in range(15)]
    responses_props = await asyncio.gather(*tasks_props)
    elapsed_props = time.perf_counter() - start_time_auth

    assert all(r.status_code == 200 for r in responses_props)
    assert elapsed_props < 3.0

