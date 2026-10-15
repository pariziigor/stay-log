import { api } from './api';
import {
  AIInsight,
  ChatMessageRequest,
  ChatMessageResponse,
  ConversationSummary,
} from '../types/ai';

export const aiService = {
  async sendMessage(data: ChatMessageRequest): Promise<ChatMessageResponse> {
    const response = await api.post<ChatMessageResponse>('/ai/chat', data);
    return response.data;
  },

  async listConversations(): Promise<ConversationSummary[]> {
    const response = await api.get<ConversationSummary[]>('/ai/conversations');
    return response.data;
  },

  async getConversationMessages(conversationId: string): Promise<ChatMessageResponse[]> {
    const response = await api.get<ChatMessageResponse[]>(`/ai/conversations/${conversationId}/messages`);
    return response.data;
  },

  async listActiveInsights(): Promise<AIInsight[]> {
    const response = await api.get<AIInsight[]>('/ai/insights');
    return response.data;
  },

  async dismissInsight(insightId: string): Promise<void> {
    await api.post(`/ai/insights/${insightId}/dismiss`);
  },
};
