import uuid
import pytest
from app.modules.ai_assistant.domain.entities import AIConversation, AIInsight, AIMessage
from app.modules.ai_assistant.domain.value_objects import (
    InsightSeverity,
    InsightType,
    MessageRole,
)
from app.modules.ai_assistant.application.service import AIAssistantService


def test_ai_entities_and_value_objects():
    conv_id = uuid.uuid4()
    user_id = uuid.uuid4()
    prop_id = uuid.uuid4()

    # AIConversation
    conv = AIConversation(
        id=conv_id,
        user_id=user_id,
        property_id=prop_id,
        title="Consulta Inicial",
    )
    assert conv.id == conv_id
    assert conv.user_id == user_id
    assert conv.property_id == prop_id
    assert conv.title == "Consulta Inicial"
    assert conv.archived_at is None

    conv.update_title("Novo Título Otimizado")
    assert conv.title == "Novo Título Otimizado"
    conv.archive()
    assert conv.archived_at is not None

    # AIMessage
    msg = AIMessage(
        conversation_id=conv_id,
        role=MessageRole.USER,
        content="Como melhorar as avaliações?",
    )
    assert msg.role == MessageRole.USER
    assert msg.content == "Como melhorar as avaliações?"
    assert msg.conversation_id == conv_id

    # AIInsight
    insight = AIInsight(
        owner_id=user_id,
        insight_type=InsightType.PRICING_OPPORTUNITY,
        severity=InsightSeverity.CRITICAL,
        title="Oportunidade de Tarifa",
        content="Demanda alta detectada.",
        data={"multiplier": 1.25},
    )
    assert insight.insight_type == InsightType.PRICING_OPPORTUNITY
    assert insight.severity == InsightSeverity.CRITICAL
    assert insight.is_dismissed is False
    insight.dismiss()
    assert insight.is_dismissed is True


def test_ai_grounded_response_heuristics():
    """Valida as regras analíticas de grounding do AIAssistantService para cada intenção operacional."""
    # Instanciamos o service com mocks None para testar o método puro de heurística
    service = AIAssistantService(ai_repo=None, context_builder=None)  # type: ignore

    mock_context = {
        "properties": [{"name": "Chalé da Montanha"}],
        "occupancy": {
            "current_month_occupancy_pct": 82.5,
            "next_month_projected_pct": 65.0,
            "total_active_reservations": 14,
            "upcoming_check_ins_today": 3,
            "upcoming_check_outs_today": 2,
        },
        "inventory_alerts": [
            {
                "item_name": "Toalha de Banho",
                "property_name": "Chalé da Montanha",
                "current_quantity": 2,
                "unit": "un",
                "minimum_quantity": 6,
                "shortage": 4,
            }
        ],
        "financial": {
            "period": "Mês Atual",
            "gross_revenue": 15400.0,
            "platform_fees_deducted": 2310.0,
            "operational_cleaning_expenses": 1200.0,
            "maintenance_expenses": 450.0,
            "estimated_net_profit": 11440.0,
            "net_margin_pct": 74.3,
        },
    }

    # 1. Intenção: Ocupação e Reservas
    resp_occ, actions_occ = service._generate_grounded_response("Qual é a minha taxa de ocupação?", mock_context)
    assert "Taxa de Ocupação" in resp_occ
    assert "82.5%" in resp_occ
    assert len(actions_occ) >= 2

    # 2. Intenção: Suprimentos / Estoque
    resp_inv, actions_inv = service._generate_grounded_response("Tem algum item de estoque acabando?", mock_context)
    assert "Suprimentos" in resp_inv
    assert "Toalha de Banho" in resp_inv
    assert len(actions_inv) >= 2

    # 3. Intenção: Finanças e Faturamento
    resp_fin, actions_fin = service._generate_grounded_response("Qual o faturamento e lucro estimado?", mock_context)
    assert "Visão Financeira" in resp_fin
    assert "15,400.00" in resp_fin
    assert len(actions_fin) >= 2

    # 4. Intenção: Precificação / Diária
    resp_price, actions_price = service._generate_grounded_response("Qual a sugestão de diária e preço?", mock_context)
    assert "Precificação Dinâmica" in resp_price
    assert len(actions_price) >= 2

    # 5. Intenção genérica / Fallback
    resp_gen, actions_gen = service._generate_grounded_response("Olá, me dê um resumo geral.", mock_context)
    assert "Panorama Operacional" in resp_gen
    assert "Chalé da Montanha" in resp_gen
    assert len(actions_gen) >= 2

