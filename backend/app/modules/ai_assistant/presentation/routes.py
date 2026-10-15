from typing import List
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.dependencies import get_current_user, require_roles
from app.modules.ai_assistant.application.context_builder import OperationalContextBuilder
from app.modules.ai_assistant.application.dtos import (
    AIInsightResponseDTO,
    ChatMessageRequestDTO,
    ChatMessageResponseDTO,
    ConversationResponseDTO,
)
from app.modules.ai_assistant.application.service import AIAssistantService
from app.modules.ai_assistant.domain.repository import AIAssistantRepository
from app.modules.ai_assistant.infrastructure.repositories import SQLAlchemyAIAssistantRepository
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole

router = APIRouter(prefix="/ai", tags=["Assistente de Inteligência Artificial & Insights"])


def get_ai_repository(session: AsyncSession = Depends(get_db_session)) -> AIAssistantRepository:
    return SQLAlchemyAIAssistantRepository(session)


def get_ai_service(
    session: AsyncSession = Depends(get_db_session),
    repo: AIAssistantRepository = Depends(get_ai_repository),
) -> AIAssistantService:
    context_builder = OperationalContextBuilder(session)
    return AIAssistantService(ai_repo=repo, context_builder=context_builder)


@router.post(
    "/chat",
    response_model=ChatMessageResponseDTO,
    status_code=status.HTTP_200_OK,
    summary="Interagir com o copiloto de inteligência artificial",
    description="Processa perguntas do proprietário com injeção automática de contexto operacional do banco de dados (RF-16).",
)
async def chat_with_assistant(
    dto: ChatMessageRequestDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    ai_service: AIAssistantService = Depends(get_ai_service),
) -> ChatMessageResponseDTO:
    return await ai_service.send_message(user_id=current_user.id, dto=dto)


@router.get(
    "/conversations",
    response_model=List[ConversationResponseDTO],
    summary="Listar conversas e consultas anteriores do usuário",
)
async def list_conversations(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    ai_service: AIAssistantService = Depends(get_ai_service),
) -> List[ConversationResponseDTO]:
    return await ai_service.list_conversations(user_id=current_user.id)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=List[ChatMessageResponseDTO],
    summary="Obter histórico de mensagens de uma conversa",
)
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    ai_service: AIAssistantService = Depends(get_ai_service),
) -> List[ChatMessageResponseDTO]:
    return await ai_service.get_messages(conversation_id=conversation_id)


@router.get(
    "/insights",
    response_model=List[AIInsightResponseDTO],
    summary="Listar insights proativos e alertas operacionais",
    description="Retorna sugestões e anomalias identificadas automaticamente pela IA (estoque baixo, precificação, ocupação).",
)
async def list_active_insights(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    ai_service: AIAssistantService = Depends(get_ai_service),
) -> List[AIInsightResponseDTO]:
    return await ai_service.list_active_insights(owner_id=current_user.id)


@router.post(
    "/insights/{insight_id}/dismiss",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Dispensar um insight",
)
async def dismiss_insight(
    insight_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    ai_service: AIAssistantService = Depends(get_ai_service),
) -> None:
    await ai_service.dismiss_insight(insight_id=insight_id)
