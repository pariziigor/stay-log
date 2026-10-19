from abc import abstractmethod
from typing import List, Optional
import uuid
from app.modules.ai_assistant.domain.entities import (
    AIConversation,
    AIInsight,
    AIMessage,
)
from app.shared.infrastructure.base_repository import BaseRepository


class AIAssistantRepository(BaseRepository[AIConversation]):
    """Porta abstrata do Repositório do Assistente de IA."""

    @abstractmethod
    async def get_by_id(self, entity_id: uuid.UUID) -> Optional[AIConversation]:
        raise NotImplementedError

    @abstractmethod
    async def save(self, entity: AIConversation) -> AIConversation:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, entity_id: uuid.UUID) -> None:
        raise NotImplementedError

    @abstractmethod
    async def list_conversations(
        self,
        user_id: uuid.UUID,
        limit: int = 20,
    ) -> List[AIConversation]:
        raise NotImplementedError

    # Mensagens
    @abstractmethod
    async def save_message(self, message: AIMessage) -> AIMessage:
        raise NotImplementedError

    @abstractmethod
    async def list_messages(
        self,
        conversation_id: uuid.UUID,
        limit: int = 50,
    ) -> List[AIMessage]:
        raise NotImplementedError

    # Insights
    @abstractmethod
    async def save_insight(self, insight: AIInsight) -> AIInsight:
        raise NotImplementedError

    @abstractmethod
    async def list_active_insights(
        self,
        owner_id: uuid.UUID,
        limit: int = 10,
    ) -> List[AIInsight]:
        raise NotImplementedError

    @abstractmethod
    async def get_insight_by_id(self, insight_id: uuid.UUID) -> Optional[AIInsight]:
        raise NotImplementedError

    @abstractmethod
    async def dismiss_insight(self, insight_id: uuid.UUID) -> None:
        raise NotImplementedError
