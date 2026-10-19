from datetime import datetime, timezone
from typing import List, Optional
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
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
from app.modules.ai_assistant.infrastructure.models import (
    AIConversationModel,
    AIInsightModel,
    AIMessageModel,
)


class SQLAlchemyAIAssistantRepository(AIAssistantRepository):
    """Adaptador de persistência do Assistente de IA com SQLAlchemy Assíncrono."""

    def __init__(self, session: AsyncSession):
        self._session = session

    # --- Mappers ---
    @staticmethod
    def _to_domain_conversation(model: AIConversationModel) -> AIConversation:
        return AIConversation(
            id=model.id,
            user_id=model.user_id,
            property_id=model.property_id,
            title=model.title,
            archived_at=model.archived_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_domain_message(model: AIMessageModel) -> AIMessage:
        return AIMessage(
            id=model.id,
            conversation_id=model.conversation_id,
            role=MessageRole(model.role),
            content=model.content,
            tool_name=model.tool_name,
            tool_payload=model.tool_payload,
            model=model.model,
            prompt_tokens=model.prompt_tokens,
            completion_tokens=model.completion_tokens,
            latency_ms=model.latency_ms,
            created_at=model.created_at,
        )

    @staticmethod
    def _to_domain_insight(model: AIInsightModel) -> AIInsight:
        return AIInsight(
            id=model.id,
            owner_id=model.owner_id,
            property_id=model.property_id,
            insight_type=InsightType(model.insight_type),
            severity=InsightSeverity(model.severity),
            title=model.title,
            content=model.content,
            data=model.data,
            generated_by=model.generated_by,
            is_dismissed=model.is_dismissed,
            expires_at=model.expires_at,
            created_at=model.created_at,
        )

    # --- Operações de Conversa ---
    async def get_by_id(self, entity_id: uuid.UUID) -> Optional[AIConversation]:
        stmt = select(AIConversationModel).where(AIConversationModel.id == entity_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain_conversation(model) if model else None

    async def save(self, entity: AIConversation) -> AIConversation:
        stmt = select(AIConversationModel).where(AIConversationModel.id == entity.id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model is None:
            model = AIConversationModel(
                id=entity.id,
                user_id=entity.user_id,
                property_id=entity.property_id,
                title=entity.title,
                archived_at=entity.archived_at,
                created_at=entity.created_at,
                updated_at=entity.updated_at,
            )
            self._session.add(model)
        else:
            model.title = entity.title
            model.archived_at = entity.archived_at
            model.updated_at = entity.updated_at

        await self._session.flush()
        return self._to_domain_conversation(model)

    async def delete(self, entity_id: uuid.UUID) -> None:
        stmt = (
            update(AIConversationModel)
            .where(AIConversationModel.id == entity_id)
            .values(archived_at=datetime.now(timezone.utc))
        )
        await self._session.execute(stmt)
        await self._session.flush()

    async def list_conversations(
        self,
        user_id: uuid.UUID,
        limit: int = 20,
    ) -> List[AIConversation]:
        stmt = (
            select(AIConversationModel)
            .where(AIConversationModel.user_id == user_id, AIConversationModel.archived_at.is_(None))
            .order_by(AIConversationModel.updated_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_domain_conversation(m) for m in result.scalars().all()]

    # --- Operações de Mensagens ---
    async def save_message(self, message: AIMessage) -> AIMessage:
        model = AIMessageModel(
            id=message.id,
            conversation_id=message.conversation_id,
            role=message.role.value,
            content=message.content,
            tool_name=message.tool_name,
            tool_payload=message.tool_payload,
            model=message.model,
            prompt_tokens=message.prompt_tokens,
            completion_tokens=message.completion_tokens,
            latency_ms=message.latency_ms,
            created_at=message.created_at,
        )
        self._session.add(model)
        await self._session.flush()
        return self._to_domain_message(model)

    async def list_messages(
        self,
        conversation_id: uuid.UUID,
        limit: int = 50,
    ) -> List[AIMessage]:
        stmt = (
            select(AIMessageModel)
            .where(AIMessageModel.conversation_id == conversation_id)
            .order_by(AIMessageModel.created_at.asc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_domain_message(m) for m in result.scalars().all()]

    # --- Operações de Insights ---
    async def save_insight(self, insight: AIInsight) -> AIInsight:
        model = AIInsightModel(
            id=insight.id,
            owner_id=insight.owner_id,
            property_id=insight.property_id,
            insight_type=insight.insight_type.value,
            severity=insight.severity.value,
            title=insight.title,
            content=insight.content,
            data=insight.data,
            generated_by=insight.generated_by,
            is_dismissed=insight.is_dismissed,
            expires_at=insight.expires_at,
            created_at=insight.created_at,
        )
        self._session.add(model)
        await self._session.flush()
        return self._to_domain_insight(model)

    async def list_active_insights(
        self,
        owner_id: uuid.UUID,
        limit: int = 10,
    ) -> List[AIInsight]:
        stmt = (
            select(AIInsightModel)
            .where(
                AIInsightModel.owner_id == owner_id,
                AIInsightModel.is_dismissed.is_(False),
            )
            .order_by(AIInsightModel.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [self._to_domain_insight(m) for m in result.scalars().all()]

    async def get_insight_by_id(self, insight_id: uuid.UUID) -> Optional[AIInsight]:
        stmt = select(AIInsightModel).where(AIInsightModel.id == insight_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_domain_insight(model) if model else None

    async def dismiss_insight(self, insight_id: uuid.UUID) -> None:
        stmt = (
            update(AIInsightModel)
            .where(AIInsightModel.id == insight_id)
            .values(is_dismissed=True)
        )
        await self._session.execute(stmt)
        await self._session.flush()
