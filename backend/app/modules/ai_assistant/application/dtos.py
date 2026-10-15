from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, Field
from app.modules.ai_assistant.domain.value_objects import (
    InsightSeverity,
    InsightType,
    MessageRole,
)


class ChatMessageRequestDTO(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="Pergunta ou instrução do usuário")
    conversation_id: Optional[uuid.UUID] = Field(None, description="ID da conversa existente ou None para nova")
    property_id: Optional[uuid.UUID] = Field(None, description="Filtro opcional para um imóvel específico")


class ChatMessageResponseDTO(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: MessageRole
    content: str
    suggested_actions: List[str] = Field(default_factory=list, description="Ações recomendadas com 1 clique")
    metrics_snapshot: Optional[Dict[str, Any]] = None
    created_at: datetime


class ConversationResponseDTO(BaseModel):
    id: uuid.UUID
    title: str
    property_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class AIInsightResponseDTO(BaseModel):
    id: uuid.UUID
    insight_type: InsightType
    severity: InsightSeverity
    title: str
    content: str
    data: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
