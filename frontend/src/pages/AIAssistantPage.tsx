import React, { useEffect, useState } from 'react';
import {
  Bot,
  Sparkles,
  AlertTriangle,
  History,
  RefreshCw,
  Plus,
  Building,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiService } from '../services/aiService';
import { propertyService } from '../services/propertyService';
import {
  AIInsight,
  ChatMessageResponse,
  ConversationSummary,
} from '../types/ai';
import { Property } from '../types/property';
import { AIChatThread } from '../components/ai/AIChatThread';
import { AIInsightCard } from '../components/ai/AIInsightCard';
import { cn } from '../utils/cn';

export const AIAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Tab para visualização em telas pequenas ('chat' ou 'insights')
  const [mobileTab, setMobileTab] = useState<'chat' | 'insights'>('chat');

  // Carregar dados iniciais
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsInsightsLoading(true);
      const [insightsData, convsData, propsData] = await Promise.all([
        aiService.listActiveInsights().catch(() => []),
        aiService.listConversations().catch(() => []),
        propertyService.listProperties().catch(() => ({ items: [], total: 0 })),
      ]);

      setInsights(insightsData);
      setConversations(convsData);
      setProperties(propsData.items || []);

      // Se houver conversas existentes, seleciona a mais recente
      if (convsData.length > 0 && !currentConversationId) {
        selectConversation(convsData[0].id);
      }
    } catch {
      setErrorNotice('Não foi possível sincronizar todos os dados do assistente.');
    } finally {
      setIsInsightsLoading(false);
    }
  };

  const selectConversation = async (convId: string) => {
    try {
      setIsLoading(true);
      setCurrentConversationId(convId);
      const history = await aiService.getConversationMessages(convId);
      setMessages(history);
      setMobileTab('chat');
    } catch {
      setErrorNotice('Não foi possível carregar o histórico desta conversa.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setMobileTab('chat');
  };

  const handleSendMessage = async (content: string) => {
    // Adiciona mensagem do usuário temporariamente para feedback imediato
    const tempUserMsg: ChatMessageResponse = {
      id: `temp-${Date.now()}`,
      conversation_id: currentConversationId || '',
      role: 'user',
      content,
      suggested_actions: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const response = await aiService.sendMessage({
        content,
        conversation_id: currentConversationId || undefined,
        property_id: selectedPropertyId || undefined,
      });

      // Se for uma nova conversa, salva o id e atualiza a lista de conversas
      if (!currentConversationId && response.conversation_id) {
        setCurrentConversationId(response.conversation_id);
        const updatedConvs = await aiService.listConversations().catch(() => []);
        setConversations(updatedConvs);
      }

      setMessages((prev) => [...prev, response]);
    } catch {
      // Mensagem de erro amigável se falhar
      const errorMsg: ChatMessageResponse = {
        id: `err-${Date.now()}`,
        conversation_id: currentConversationId || '',
        role: 'assistant',
        content:
          '⚠️ Não foi possível processar sua solicitação no momento. Por favor, verifique a conexão com o servidor e tente novamente.',
        suggested_actions: ['Tentar novamente'],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissInsight = async (id: string) => {
    setDismissingId(id);
    try {
      await aiService.dismissInsight(id);
      setInsights((prev) => prev.filter((item) => item.id !== id));
    } catch {
      setErrorNotice('Não foi possível dispensar o alerta selecionado.');
    } finally {
      setDismissingId(null);
    }
  };

  const handleConsultInsight = (insight: AIInsight) => {
    const prompt = `Por favor, elabore um plano de ação para o alerta: "${insight.title}". Detalhes: ${insight.content}`;
    setMobileTab('chat');
    handleSendMessage(prompt);
  };

  const activeConv = conversations.find((c) => c.id === currentConversationId);

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      {errorNotice && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between"
        >
          <span>{errorNotice}</span>
          <button type="button" onClick={() => setErrorNotice(null)} className="font-bold underline">
            Fechar
          </button>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Assistente de Inteligência Artificial
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Insights preditivos, recomendações de precificação e análise em tempo real dos seus imóveis (RF-16).
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          {/* Property Filter */}
          <div className="relative">
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 pr-8 font-medium text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="">Todos os Imóveis (Visão Geral)</option>
              {properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.name} ({prop.address.city})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchInitialData}
            disabled={isInsightsLoading}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-200 shadow-2xs transition-colors cursor-pointer"
            title="Atualizar dados operacionais"
          >
            <RefreshCw className={cn('w-4 h-4', isInsightsLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Mobile Tab Selector */}
      <div className="flex lg:hidden bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setMobileTab('chat')}
          className={cn(
            'flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5',
            mobileTab === 'chat'
              ? 'bg-white text-brand-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat com IA</span>
        </button>

        <button
          onClick={() => setMobileTab('insights')}
          className={cn(
            'flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5',
            mobileTab === 'insights'
              ? 'bg-white text-brand-700 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          <Sparkles className="w-4 h-4" />
          <span>Alertas & Insights ({insights.length})</span>
        </button>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Chat Thread (8 cols on lg) */}
        <div
          className={cn(
            'lg:col-span-8',
            mobileTab !== 'chat' && 'hidden lg:block'
          )}
        >
          <AIChatThread
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            activeConversationTitle={activeConv?.title}
            onNewConversation={handleStartNewConversation}
          />
        </div>

        {/* Right Column: Proactive Insights & Chat History (4 cols on lg) */}
        <div
          className={cn(
            'lg:col-span-4 space-y-6',
            mobileTab !== 'insights' && 'hidden lg:block'
          )}
        >
          {/* Card: Proactive Insights Feed */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Insights Proativos</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {insights.length} alertas
              </span>
            </div>

            {insights.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Operação Equilibrada</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Nenhum alerta crítico ou desvio operacional detectado no momento.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                <AnimatePresence>
                  {insights.map((insight) => (
                    <AIInsightCard
                      key={insight.id}
                      insight={insight}
                      onDismiss={handleDismissInsight}
                      onConsult={handleConsultInsight}
                      isDismissing={dismissingId === insight.id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Card: Conversation History */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                  <History className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Histórico de Consultas</h3>
              </div>

              <button
                onClick={handleStartNewConversation}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova
              </button>
            </div>

            {conversations.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Nenhuma conversa anterior arquivada.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {conversations.map((conv) => {
                  const isCurrent = conv.id === currentConversationId;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer',
                        isCurrent
                          ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200'
                          : 'hover:bg-slate-50 text-slate-600 border border-transparent'
                      )}
                    >
                      <span className="truncate pr-2">{conv.title}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                        {new Date(conv.updated_at).toLocaleDateString([], {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
