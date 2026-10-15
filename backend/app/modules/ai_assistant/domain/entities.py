from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid
from app.modules.ai_assistant.domain.value_objects import (
    InsightSeverity,
    InsightType,
    MessageRole,
)
from app.shared.domain.entity import BaseEntity


class AIConversation(BaseEntity):
    """Agregado Raiz de uma sessão de conversa com o copiloto de IA."""

    def __init__(
        self,
        user_id: uuid.UUID,
        id: Optional[uuid.UUID] = None,
        property_id: Optional[uuid.UUID] = None,
        title: Optional[str] = None,
        archived_at: Optional[datetime] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        super().__init__(id=id, created_at=created_at, updated_at=updated_at)
        self._user_id = user_id
        self._property_id = property_id
        self._title = title or "Nova Consulta"
        self._archived_at = archived_at

    @property
    def user_id(self) -> uuid.UUID:
        return self._user_id

    @property
    def property_id(self) -> Optional[uuid.UUID]:
        return self._property_id

    @property
    def title(self) -> str:
        return self._title

    @property
    def archived_at(self) -> Optional[datetime]:
        return self._archived_at

    def update_title(self, new_title: str) -> None:
        self._title = new_title.strip()[:150]
        self.touch()

    def archive(self) -> None:
        self._archived_at = datetime.now(timezone.utc)
        self.touch()


class AIMessage(BaseEntity):
    """Entidade de mensagem individual em uma conversa com o assistente."""

    def __init__(
        self,
        conversation_id: uuid.UUID,
        role: MessageRole,
        content: str,
        id: Optional[uuid.UUID] = None,
        tool_name: Optional[str] = None,
        tool_payload: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None,
        prompt_tokens: Optional[int] = None,
        completion_tokens: Optional[int] = None,
        latency_ms: Optional[int] = None,
        created_at: Optional[datetime] = None,
    ):
        super().__init__(id=id, created_at=created_at)
        self._conversation_id = conversation_id
        self._role = role
        self._content = content
        self._tool_name = tool_name
        self._tool_payload = tool_payload
        self._model = model
        self._prompt_tokens = prompt_tokens
        self._completion_tokens = completion_tokens
        self._latency_ms = latency_ms

    @property
    def conversation_id(self) -> uuid.UUID:
        return self._conversation_id

    @property
    def role(self) -> MessageRole:
        return self._role

    @property
    def content(self) -> str:
        return self._content

    @property
    def tool_name(self) -> Optional[str]:
        return self._tool_name

    @property
    def tool_payload(self) -> Optional[Dict[str, Any]]:
        return self._tool_payload

    @property
    def model(self) -> Optional[str]:
        return self._model

    @property
    def prompt_tokens(self) -> Optional[int]:
        return self._prompt_tokens

    @property
    def completion_tokens(self) -> Optional[int]:
        return self._completion_tokens

    @property
    def latency_ms(self) -> Optional[int]:
        return self._latency_ms


class AIInsight(BaseEntity):
    """Entidade de insight gerado proativamente para apoiar a tomada de decisão."""

    def __init__(
        self,
        owner_id: uuid.UUID,
        insight_type: InsightType,
        severity: InsightSeverity,
        title: str,
        content: str,
        id: Optional[uuid.UUID] = None,
        property_id: Optional[uuid.UUID] = None,
        data: Optional[Dict[str, Any]] = None,
        generated_by: str = "ai",
        is_dismissed: bool = False,
        expires_at: Optional[datetime] = None,
        created_at: Optional[datetime] = None,
    ):
        super().__init__(id=id, created_at=created_at)
        self._owner_id = owner_id
        self._insight_type = insight_type
        self._severity = severity
        self._title = title
        self._content = content
        self._property_id = property_id
        self._data = data or {}
        self._generated_by = generated_by
        self._is_dismissed = is_dismissed
        self._expires_at = expires_at

    @property
    def owner_id(self) -> uuid.UUID:
        return self._owner_id

    @property
    def insight_type(self) -> InsightType:
        return self._insight_type

    @property
    def severity(self) -> InsightSeverity:
        return self._severity

    @property
    def title(self) -> str:
        return self._title

    @property
    def content(self) -> str:
        return self._content

    @property
    def property_id(self) -> Optional[uuid.UUID]:
        return self._property_id

    @property
    def data(self) -> Dict[str, Any]:
        return self._data

    @property
    def generated_by(self) -> str:
        return self._generated_by

    @property
    def is_dismissed(self) -> bool:
        return self._is_dismissed

    @property
    def expires_at(self) -> Optional[datetime]:
        return self._expires_at

    def dismiss(self) -> None:
        self._is_dismissed = True
        self.touch()
