import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  DollarSign,
  CheckCircle2,
  Sparkles,
  Plus,
  ArrowUpRight,
  Clock,
  AlertCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { dashboardService, DashboardSummary } from '../../services/dashboardService';
import { getApiErrorMessage } from '../../utils/apiError';

export const OwnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getSummary();
      setSummary(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível carregar os indicadores do painel.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const firstName = user?.full_name?.split(' ')[0] || 'Gestor';
  const occPct = summary?.occupancy_pct ?? 0;
  const grossRev = summary?.gross_revenue ?? 0;
  const propsCount = summary?.properties_count ?? 0;
  const pendingTasks = summary?.pending_tasks_count ?? 0;

  const metrics = [
    {
      label: 'Taxa de Ocupação (Mês)',
      value: `${occPct}%`,
      change: `Próximo mês: ${summary?.next_month_occupancy_pct ?? 0}%`,
      icon: CalendarDays,
    },
    {
      label: 'Receita Bruta',
      value: `R$ ${Number(grossRev).toFixed(2).replace('.', ',')}`,
      change: `Margem líquida: ${summary?.net_margin_pct ?? 0}%`,
      icon: DollarSign,
    },
    {
      label: 'Imóveis Cadastrados',
      value: `${propsCount} unidade(s)`,
      change: `${summary?.active_reservations_count ?? 0} reserva(s) ativa(s)`,
      icon: Building2,
    },
    {
      label: 'Tarefas da Equipe',
      value: `${pendingTasks} aberta(s)`,
      change: `${summary?.completed_tasks_count ?? 0} concluída(s)`,
      icon: CheckCircle2,
    },
  ];

  const quickActions = [
    { label: 'Gerenciar Imóveis', icon: Plus, action: () => navigate('/properties'), primary: true },
    { label: 'Ver Reservas', icon: CalendarDays, action: () => navigate('/bookings') },
    { label: 'Atribuir Tarefas', icon: CheckCircle2, action: () => navigate('/tasks') },
    { label: 'Perguntar à IA', icon: Sparkles, action: () => navigate('/ai-assistant'), glow: true },
  ];

  return (
    <div className="space-y-6">
      {/* Banner Principal Moderno com Dados Reais */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 via-indigo-600 to-brand-800 text-white p-6 sm:p-8 shadow-xl shadow-brand-700/15">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="cyan" size="sm" className="bg-cyan-900/60 text-cyan-200 border-cyan-700/50">
              Inteligência Operacional em Tempo Real
            </Badge>
            <button
              type="button"
              onClick={loadSummary}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Atualizar indicadores"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Olá, {firstName}! Você gerencia {propsCount} imóvel(is) com {occPct}% de ocupação neste mês.
          </h2>
          <p className="mt-2 text-sm text-indigo-100/90 leading-relaxed">
            Há {summary?.upcoming_check_ins_today ?? 0} check-in(s) e {summary?.upcoming_check_outs_today ?? 0} check-out(s) previstos para hoje, com {summary?.low_stock_items_count ?? 0} alerta(s) de estoque mínimo.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {quickActions.map((qa, i) => {
              const Icon = qa.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={qa.action}
                  className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm ${
                    qa.primary
                      ? 'bg-white text-brand-700 hover:bg-indigo-50 hover:shadow-md'
                      : qa.glow
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-extrabold hover:shadow-lg'
                      : 'bg-white/15 backdrop-blur-md text-white hover:bg-white/25 border border-white/20'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{qa.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {error && (
        <Card className="p-4 border-rose-200 bg-rose-50 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={loadSummary}>
            Recarregar
          </Button>
        </Card>
      )}

      {/* Grid de Métricas Operacionais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <Card key={idx} hoverable className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{m.label}</span>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {isLoading ? '...' : m.value}
                </span>
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {m.change}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tarefas Abertas e Alertas Reais de Estoque */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Próximas Tarefas Operacionais</h3>
              <p className="text-xs text-slate-400">Limpezas, manutenções e vistorias ativas nos seus imóveis</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/tasks')}>
              Ver Quadro <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          {!summary || summary.upcoming_tasks.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              Nenhuma tarefa pendente no momento. Crie tarefas operacionais na aba <strong>Tarefas & Equipe</strong>.
            </div>
          ) : (
            <div className="space-y-3">
              {summary.upcoming_tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 gap-2"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">{t.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {t.property_name} • Checklist: {t.checklist_done}/{t.checklist_total}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(t.due_at).toLocaleDateString('pt-BR')}
                    </span>
                    <Badge variant={t.status === 'in_progress' ? 'brand' : 'amber'} size="sm">
                      {t.status === 'in_progress' ? 'Em Execução' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Alerta de Estoque e Copiloto de IA */}
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-white to-amber-50/30 border-amber-200/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4.5 h-4.5 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-950">Monitoramento de Estoque</h3>
            </div>
            {summary && summary.low_stock_alerts.length > 0 ? (
              <p className="text-xs text-slate-600 leading-relaxed">
                O item <strong>{summary.low_stock_alerts[0].item_name}</strong> está com saldo de{' '}
                <strong>
                  {summary.low_stock_alerts[0].current_quantity} {summary.low_stock_alerts[0].unit}
                </strong>{' '}
                no imóvel <em>{summary.low_stock_alerts[0].property_name}</em> (mínimo:{' '}
                {summary.low_stock_alerts[0].minimum_quantity}).
              </p>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                Todos os itens de suprimento monitorados estão dentro do nível mínimo de segurança.
              </p>
            )}
            <div className="mt-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate('/inventory')}
                className="w-full text-xs"
              >
                Gerenciar Estoque
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-indigo-900 to-brand-950 text-white">
            <div className="flex items-center gap-2 mb-2 text-brand-300">
              <Sparkles className="w-4.5 h-4.5 text-amber-300 animate-pulse" />
              <h3 className="text-sm font-bold">Copiloto Operacional IA</h3>
            </div>
            <p className="text-xs text-indigo-100/90 leading-relaxed">
              Consulte análises de ocupação, simulações de diárias e diagnóstico de fluxo de caixa fundamentados nos registros reais do seu portfólio.
            </p>
            <div className="mt-4">
              <Button
                size="sm"
                variant="emerald"
                onClick={() => navigate('/ai-assistant')}
                className="w-full text-xs"
              >
                Conversar com IA
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
