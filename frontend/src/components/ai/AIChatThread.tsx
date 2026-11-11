import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Copy,
  Check,
  ShieldCheck,
  TrendingUp,
  Package,
  Calendar,
  DollarSign,
  Flame,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessageResponse } from '../../types/ai';
import { AIMarkdown } from './AIMarkdown';
import { cn } from '../../utils/cn';

interface AIChatThreadProps {
  messages: ChatMessageResponse[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  activeConversationTitle?: string;
  onNewConversation?: () => void;
}

const QUICK_ACTIONS = [
  { label: 'Taxa de Ocupação', query: 'Qual é a taxa de ocupação dos meus imóveis este mês?', icon: TrendingUp },
  { label: 'Recomendação de Preço', query: 'Quais imóveis têm oportunidade de ajuste de preço para o próximo feriado?', icon: DollarSign },
  { label: 'Estoque Baixo', query: 'Quais itens de suprimento estão abaixo do estoque mínimo?', icon: Package },
  { label: 'Limpezas & Tarefas', query: 'Quais tarefas de limpeza e manutenção estão pendentes ou atrasadas?', icon: Calendar },
];

export const AIChatThread: React.FC<AIChatThreadProps> = ({
  messages,
  isLoading,
  onSendMessage,
  activeConversationTitle,
  onNewConversation,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    onSendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[550px] bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Top Header Bar */}
      <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200/80 backdrop-blur-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span>{activeConversationTitle || 'Copiloto de Gestão Inteligente'}</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand-700">
                <Sparkles className="w-2.5 h-2.5" />
                IA Ativa
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Conectado aos dados operacionais com anonimização LGPD</span>
            </p>
          </div>
        </div>

        {onNewConversation && messages.length > 0 && (
          <button
            onClick={onNewConversation}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-white border border-brand-200 hover:border-brand-300 px-3 py-1.5 rounded-xl shadow-2xs transition-all hover:scale-102 cursor-pointer"
          >
            + Nova Conversa
          </button>
        )}
      </div>

      {/* Messages Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg mb-4"
            >
              <Sparkles className="w-8 h-8" />
            </motion.div>
            <h2 className="text-lg font-bold text-slate-800">
              Como posso apoiar a sua operação hoje?
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Faça perguntas sobre a ocupação dos seus imóveis, recomendações de preços, reposição de estoque ou status das limpezas.
            </p>

            {/* Quick Prompt Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 w-full text-left">
              {QUICK_ACTIONS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(item.query)}
                    className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-brand-50/50 hover:border-brand-300 text-left transition-all duration-200 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 group-hover:text-brand-700">
                      <Icon className="w-4 h-4 text-brand-600" />
                      <span>{item.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      {item.query}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 shadow-xs',
                    isUser
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-tr-xs'
                      : 'bg-slate-50/90 border border-slate-200/90 text-slate-800 rounded-tl-xs'
                  )}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div>
                      <AIMarkdown content={msg.content} />

                      {/* Suggested Action Pills */}
                      {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200/80">
                          <p className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-brand-500" />
                            Ações sugeridas:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggested_actions.map((action, actionIdx) => (
                              <button
                                key={actionIdx}
                                onClick={() => onSendMessage(action)}
                                className="px-2.5 py-1 text-xs font-medium text-brand-700 bg-white border border-brand-200 hover:border-brand-400 hover:bg-brand-50/80 rounded-lg shadow-2xs transition-all hover:scale-102 cursor-pointer"
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer Actions (Copy) */}
                      <div className="mt-2 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="hover:text-slate-600 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Copiar resposta"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-600">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Analisando métricas operacionais...
                </span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form & Bottom Bar */}
      <div className="p-3 sm:p-4 bg-slate-50/80 border-t border-slate-200/80">
        {/* Quick prompt chips if conversation has messages */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
            {QUICK_ACTIONS.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSendMessage(item.query)}
                disabled={isLoading}
                className="whitespace-nowrap px-2.5 py-1 text-[11px] font-medium bg-white text-slate-700 border border-slate-200 hover:border-brand-300 hover:text-brand-600 rounded-full shadow-2xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre ocupação, preços, estoque, tarefas..."
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100 transition-all max-h-32"
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-10 px-4 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-medium flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-102 active:scale-98 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold">Enviar</span>
          </button>
        </form>

        <div className="mt-2 text-center">
          <p className="text-[10px] text-slate-400">
            Pressione <kbd className="font-mono bg-white border border-slate-200 px-1 py-0.5 rounded text-[9px]">Enter</kbd> para enviar ou <kbd className="font-mono bg-white border border-slate-200 px-1 py-0.5 rounded text-[9px]">Shift+Enter</kbd> para quebra de linha.
          </p>
        </div>
      </div>
    </div>
  );
};
