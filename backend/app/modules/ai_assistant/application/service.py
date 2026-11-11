from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from app.core.exceptions import EntityNotFoundError, ForbiddenError
from app.modules.ai_assistant.application.context_builder import OperationalContextBuilder
from app.modules.ai_assistant.application.dtos import (
    AIInsightResponseDTO,
    ChatMessageRequestDTO,
    ChatMessageResponseDTO,
    ConversationResponseDTO,
)
from app.modules.ai_assistant.domain.entities import (
    AIConversation,
    AIInsight,
    AIMessage,
)
from app.modules.ai_assistant.domain.repository import AIAssistantRepository
from app.modules.ai_assistant.domain.value_objects import (
    InsightSeverity,
    InsightType,
    MessageRole,
)


class AIAssistantService:
    """Application Service do Assistente de IA para processamento de consultas e geração de insights."""

    def __init__(
        self,
        ai_repo: AIAssistantRepository,
        context_builder: OperationalContextBuilder,
    ):
        self._ai_repo = ai_repo
        self._context_builder = context_builder

    async def send_message(
        self,
        user_id: uuid.UUID,
        dto: ChatMessageRequestDTO,
    ) -> ChatMessageResponseDTO:
        # 1. Recupera ou cria nova conversa
        if dto.conversation_id:
            conversation = await self._ai_repo.get_by_id(dto.conversation_id)
            if conversation is None:
                conversation = AIConversation(
                    id=dto.conversation_id,
                    user_id=user_id,
                    property_id=dto.property_id,
                    title="Consulta Operacional",
                )
                await self._ai_repo.save(conversation)
            elif conversation.user_id != user_id:
                raise ForbiddenError("Acesso negado: a conversa informada pertence a outro usuário.")
        else:
            conversation = AIConversation(
                user_id=user_id,
                property_id=dto.property_id,
                title=dto.content[:40] + ("..." if len(dto.content) > 40 else ""),
            )
            conversation = await self._ai_repo.save(conversation)

        # 2. Persiste mensagem do usuário
        user_message = AIMessage(
            conversation_id=conversation.id,
            role=MessageRole.USER,
            content=dto.content,
        )
        await self._ai_repo.save_message(user_message)

        # 3. Coleta dados operacionais em tempo real do banco de dados (LGPD compliant)
        context = await self._context_builder.build_context_for_owner(
            owner_id=user_id,
            property_id=dto.property_id,
        )

        # 4. Motor de Raciocínio Operacional com Context Injection
        assistant_content, suggested_actions = self._generate_grounded_response(dto.content, context)

        # 5. Persiste mensagem do assistente
        assistant_message = AIMessage(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=assistant_content,
            model="copiloto-operacional-grounded",
            latency_ms=45,
        )
        saved_assistant_message = await self._ai_repo.save_message(assistant_message)

        if conversation.title == "Nova Consulta" or len(conversation.title) <= 15:
            conversation.update_title(dto.content[:45])
            await self._ai_repo.save(conversation)

        return ChatMessageResponseDTO(
            id=saved_assistant_message.id,
            conversation_id=conversation.id,
            role=saved_assistant_message.role,
            content=saved_assistant_message.content,
            suggested_actions=suggested_actions,
            metrics_snapshot=context.get("occupancy"),
            created_at=saved_assistant_message.created_at,
        )

    def _generate_grounded_response(self, user_query: str, context: Dict[str, Any]) -> tuple[str, List[str]]:
        """Gera resposta embasada exclusivamente nos dados reais agregados do banco de dados."""
        query_lower = user_query.lower()
        props = context.get("properties", [])
        occupancy = context.get("occupancy", {})
        inventory = context.get("inventory_alerts", [])
        financial = context.get("financial", {})
        operations = context.get("operations", {})

        first_prop_name = props[0]["name"] if props else "seu portfólio"

        # Intenção 1: Ocupação e Calendário
        if any(w in query_lower for w in ["ocupação", "ocupacao", "reservas", "vazio", "calendário", "calendario"]):
            cur_occ = occupancy.get("current_month_occupancy_pct", 0.0)
            next_occ = occupancy.get("next_month_projected_pct", 0.0)
            active_res = occupancy.get("total_active_reservations", 0)
            checkins = occupancy.get("upcoming_check_ins_today", 0)
            checkouts = occupancy.get("upcoming_check_outs_today", 0)

            content = f"""
### 📊 Análise da Taxa de Ocupação & Reservas

Com base nos registros consolidados das suas propriedades ({len(props)} imóvel(is) cadastrado(s)):

- **Ocupação no Mês Corrente:** **{cur_occ}%**
- **Previsão para o Próximo Mês:** **{next_occ}%**
- **Reservas Ativas Confirmadas:** **{active_res} estadia(s)**
- **Movimentação Prevista para Hoje:** {checkins} check-in(s) e {checkouts} check-out(s).

#### 💡 Recomendações Estratégicas:
1. **Promoção de Meio de Semana:** Configure um desconto progressivo de 10% para estadias de 3+ noites entre terça e quinta-feira em **{first_prop_name}**.
2. **Gestão de Janelas Vagas:** Revise os bloqueios de calendário e antecipe campanhas para datas com ocupação projetada abaixo de 50%.
""".strip()
            actions = ["Ver calendário de reservas", "Registrar nova reserva", "Verificar check-ins de hoje"]
            return content, actions

        # Intenção 2: Suprimentos / Estoque
        if any(w in query_lower for w in ["estoque", "suprimento", "material", "acabando", "falta", "comprar"]):
            if inventory:
                items_str = "\n".join(
                    [
                        f"- ⚠️ **{item['item_name']}** ({item['property_name']}): saldo atual de **{item['current_quantity']} {item['unit']}** (mínimo exigido: {item['minimum_quantity']}). Déficit de {item['shortage']} {item['unit']}."
                        for item in inventory
                    ]
                )
                content = f"""
### 📦 Diagnóstico de Suprimentos & Alertas de Ruptura

Identifiquei **{len(inventory)} item(ns) com estoque crítico** na plataforma:

{items_str}

#### 🛠️ Ação Imediata Recomendada:
1. Registre uma entrada de reposição no módulo de **Estoque & Suprimentos** para regularizar o saldo antes do próximo check-in.
2. Crie uma tarefa operacional de reposição atribuída à equipe de campo.
""".strip()
            else:
                content = f"""
### 📦 Diagnóstico de Suprimentos & Alertas de Ruptura

Nenhum item está abaixo do estoque mínimo configurado no momento ({len(props)} imóvel(is) monitorado(s)).

#### 🛠️ Boas Práticas:
1. Mantenha o registro de saídas atualizado a cada limpeza pós-checkout.
2. Cadastre limites mínimos de segurança para itens de alta rotatividade (higiene, limpeza e enxoval).
""".strip()
            actions = ["Registrar entrada no estoque", "Atribuir tarefa de compra à equipe", "Ver todos os suprimentos"]
            return content, actions

        # Intenção 3: Finanças e Faturamento
        if any(w in query_lower for w in ["faturamento", "receita", "lucro", "financeiro", "dinheiro", "margem"]):
            gross = float(financial.get("gross_revenue", 0.0))
            fees = float(financial.get("platform_fees_deducted", 0.0))
            clean_exp = float(financial.get("operational_cleaning_expenses", 0.0))
            maint_exp = float(financial.get("maintenance_expenses", 0.0))
            net_profit = float(financial.get("estimated_net_profit", 0.0))
            margin = float(financial.get("net_margin_pct", 0.0))
            period = financial.get("period", "Período Atual")

            content = f"""
### 💰 Visão Financeira & Margem Líquida ({period})

Análise consolidada do fluxo de caixa real do seu portfólio:

| Indicador Financeiro | Valor Consolidado |
| :--- | :--- |
| **Receita Bruta de Hospedagem** | R$ {gross:,.2f} |
| **Deduções (Taxas de Plataforma)** | - R$ {fees:,.2f} |
| **Custos Operacionais de Limpeza** | - R$ {clean_exp:,.2f} |
| **Manutenções e Outras Despesas** | - R$ {maint_exp:,.2f} |
| **Resultado Líquido Estimado** | **R$ {net_profit:,.2f}** |
| **Margem Líquida da Operação** | **{margin}%** |

#### 📈 Recomendação Financeira:
Mantenha todas as receitas e despesas categorizadas no módulo **Financeiro** para acompanhar a rentabilidade líquida por imóvel.
""".strip()
            actions = ["Ver extrato financeiro", "Registrar nova receita", "Cadastrar nova despesa"]
            return content, actions

        # Intenção 4: Precificação Dinâmica (Pricing)
        if any(w in query_lower for w in ["diária", "diaria", "preço", "preco", "valor", "ajustar", "precificação", "precificacao", "feriado"]):
            if props:
                lines = []
                for idx, p in enumerate(props, start=1):
                    base_rate = p.get("base_nightly_rate")
                    clean_fee = p.get("cleaning_fee", 0.0)
                    loc = f" ({p.get('city')}/{p.get('state')})" if p.get("city") else ""
                    if base_rate and base_rate > 0:
                        weekend_rate = round(base_rate * 1.15, 2)
                        midweek_rate = round(base_rate * 0.90, 2)
                        lines.append(
                            f"{idx}. **{p['name']}{loc}:**\n"
                            f"   - *Diária Base Atual:* R$ {base_rate:,.2f} (Taxa de limpeza: R$ {clean_fee:,.2f})\n"
                            f"   - *Sugestão para Finais de Semana / Feriados (+15%):* R$ {weekend_rate:,.2f}\n"
                            f"   - *Sugestão Dias Úteis (-10% para 3+ noites):* R$ {midweek_rate:,.2f}"
                        )
                    else:
                        lines.append(
                            f"{idx}. **{p['name']}{loc}:**\n"
                            f"   - *Diária Base Atual:* Não definida (defina o valor base na edição do imóvel para habilitar simulações automáticas)."
                        )
                props_pricing_text = "\n\n".join(lines)
            else:
                props_pricing_text = "Você ainda não possui imóveis cadastrados. Cadastre seu primeiro imóvel na aba **Imóveis** com a diária base para receber simulações de tarifa."

            content = f"""
### 🏷️ Sugestões de Precificação Dinâmica

Com base nos parâmetros reais dos seus imóveis cadastrados:

{props_pricing_text}
""".strip()
            actions = ["Atualizar diárias dos imóveis", "Ajustar taxa de limpeza", "Simular receita mensal"]
            return content, actions

        # Intenção 5: Tarefas e Checklists
        if any(w in query_lower for w in ["tarefa", "limpeza", "manutenção", "manutencao", "checklist", "equipe"]):
            clean_cnt = operations.get("pending_cleaning_count", 0)
            maint_cnt = operations.get("pending_maintenance_count", 0)
            overdue_cnt = len(operations.get("overdue_tasks", []))
            content = f"""
### 🧹 Status de Operações & Checklists de Campo

Resumo das atividades operacionais nos seus imóveis:

- **Limpezas Pendentes / Em Andamento:** {clean_cnt}
- **Manutenções Abertas:** {maint_cnt}
- **Tarefas em Atraso:** {overdue_cnt}

Acesse o módulo **Tarefas & Checklists** para acompanhar o progresso dos itens obrigatórios antes de liberar o próximo check-in.
""".strip()
            actions = ["Ver quadro de tarefas", "Criar nova tarefa", "Gerenciar equipe"]
            return content, actions

        # Resposta Padrão de Visão Geral com Resumo Operacional Real
        prop_names = ", ".join([p["name"] for p in props]) if props else "Nenhum imóvel cadastrado ainda"
        content = f"""
### 🏡 Panorama Operacional do seu Portfólio

Você possui atualmente **{len(props)} imóvel(is) gerenciado(s)** na plataforma: *{prop_names}*.

#### 📌 Resumo Operacional Consolidado:
- **Ocupação no Mês:** **{occupancy.get('current_month_occupancy_pct', 0.0)}%** com {occupancy.get('total_active_reservations', 0)} estadia(s) ativa(s).
- **Alertas de Estoque:** {len(inventory)} item(ns) abaixo do estoque mínimo.
- **Check-ins Hoje:** {occupancy.get('upcoming_check_ins_today', 0)} chegada(s) prevista(s).

Como posso ajudar você agora? Posso analisar a ocupação, verificar suprimentos, detalhar o fluxo de caixa ou sugerir ajustes de diárias.
""".strip()
        actions = ["Analisar taxa de ocupação", "Verificar suprimentos em falta", "Otimizar preços de diárias"]
        return content, actions

    async def list_conversations(self, user_id: uuid.UUID) -> List[ConversationResponseDTO]:
        conversations = await self._ai_repo.list_conversations(user_id)
        return [
            ConversationResponseDTO(
                id=c.id,
                title=c.title,
                property_id=c.property_id,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in conversations
        ]

    async def get_messages(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        is_admin: bool = False,
    ) -> List[ChatMessageResponseDTO]:
        conversation = await self._ai_repo.get_by_id(conversation_id)
        if conversation is None:
            raise EntityNotFoundError("Conversa", conversation_id)
        if not is_admin and conversation.user_id != user_id:
            raise ForbiddenError("Acesso negado: você não tem permissão para acessar esta conversa.")

        messages = await self._ai_repo.list_messages(conversation_id)
        return [
            ChatMessageResponseDTO(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role,
                content=m.content,
                created_at=m.created_at,
            )
            for m in messages
        ]

    async def list_active_insights(self, owner_id: uuid.UUID) -> List[AIInsightResponseDTO]:
        insights = await self._ai_repo.list_active_insights(owner_id)
        if not insights:
            context = await self._context_builder.build_context_for_owner(owner_id=owner_id)
            props = context.get("properties", [])
            low_stock = context.get("inventory_alerts", [])
            overdue = context.get("operations", {}).get("overdue_tasks", [])

            generated_insights: List[AIInsight] = []
            if low_stock:
                first_alert = low_stock[0]
                generated_insights.append(
                    AIInsight(
                        owner_id=owner_id,
                        insight_type=InsightType.LOW_STOCK,
                        severity=InsightSeverity.WARNING,
                        title=f"Estoque Baixo: {first_alert['item_name']} ({first_alert['property_name']})",
                        content=(
                            f"Saldo atual de {first_alert['current_quantity']} {first_alert['unit']} "
                            f"(mínimo configurado: {first_alert['minimum_quantity']} {first_alert['unit']})."
                        ),
                        data=first_alert,
                    )
                )
            if overdue:
                first_task = overdue[0]
                generated_insights.append(
                    AIInsight(
                        owner_id=owner_id,
                        insight_type=InsightType.OVERDUE_TASKS,
                        severity=InsightSeverity.CRITICAL,
                        title=f"Tarefa em Atraso: {first_task['title']}",
                        content=f"Imóvel: {first_task['property']}. Progresso do checklist: {first_task['checklist_progress']}.",
                        data=first_task,
                    )
                )
            if not generated_insights:
                if props:
                    first_prop = props[0]
                    generated_insights.append(
                        AIInsight(
                            owner_id=owner_id,
                            insight_type=InsightType.PRICING_OPPORTUNITY,
                            severity=InsightSeverity.INFO,
                            title=f"Monitoramento Ativo: {first_prop['name']}",
                            content=(
                                f"Ocupação no mês atual em {context['occupancy']['current_month_occupancy_pct']}%. "
                                "Revise tarifas de meio de semana e estoque preventivo antes dos próximos check-ins."
                            ),
                            data={"property_id": first_prop["id"]},
                        )
                    )
                else:
                    generated_insights.append(
                        AIInsight(
                            owner_id=owner_id,
                            insight_type=InsightType.PRICING_OPPORTUNITY,
                            severity=InsightSeverity.INFO,
                            title="Bem-vindo ao Copiloto Operacional",
                            content="Cadastre seu primeiro imóvel na aba Imóveis para receber alertas automáticos de ocupação, estoque e tarefas.",
                            data={"onboarding": True},
                        )
                    )

            insights = [await self._ai_repo.save_insight(ins) for ins in generated_insights]

        return [
            AIInsightResponseDTO(
                id=i.id,
                insight_type=i.insight_type,
                severity=i.severity,
                title=i.title,
                content=i.content,
                data=i.data,
                created_at=i.created_at,
            )
            for i in insights
        ]

    async def dismiss_insight(
        self,
        insight_id: uuid.UUID,
        user_id: uuid.UUID,
        is_admin: bool = False,
    ) -> None:
        insight = await self._ai_repo.get_insight_by_id(insight_id)
        if insight is None:
            raise EntityNotFoundError("Insight", insight_id)
        if not is_admin and insight.owner_id != user_id:
            raise ForbiddenError("Acesso negado: você não tem permissão para dispensar este insight.")
        await self._ai_repo.dismiss_insight(insight_id)
