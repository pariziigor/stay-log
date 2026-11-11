import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  CalendarCheck,
  ShieldCheck,
  Activity,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { dashboardService, DashboardSummary } from '../../services/dashboardService';
import { getApiErrorMessage } from '../../utils/apiError';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
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
      setError(getApiErrorMessage(err, 'Erro ao carregar indicadores administrativos.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const stats = [
    {
      label: 'Total de Imóveis',
      value: String(summary?.properties_count ?? 0),
      change: 'Unidades ativas',
      icon: Building2,
    },
    {
      label: 'Usuários na Plataforma',
      value: String(summary?.users_summary?.total_users ?? 0),
      change: `${summary?.users_summary?.owners_count ?? 0} proprietário(s) • ${summary?.users_summary?.employees_count ?? 0} equipe`,
      icon: Users,
    },
    {
      label: 'Reservas Ativas',
      value: String(summary?.active_reservations_count ?? 0),
      change: `${summary?.pending_tasks_count ?? 0} tarefa(s) em aberto`,
      icon: CalendarCheck,
    },
    {
      label: 'Volume Financeiro Bruto',
      value: `R$ ${Number(summary?.gross_revenue ?? 0).toFixed(2).replace('.', ',')}`,
      change: `Líq. R$ ${Number(summary?.net_profit ?? 0).toFixed(2).replace('.', ',')}`,
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="violet" dot size="sm" className="bg-purple-900/60 text-purple-200 border-purple-700/50">
              Painel Geral do Administrador
            </Badge>
            <button
              type="button"
              onClick={loadSummary}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Atualizar métricas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Controle Macro da Plataforma
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Monitoramento centralizado de todos os imóveis, usuários, reservas e conformidade LGPD em tempo real.
          </p>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-rose-200 bg-rose-50 text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={loadSummary}>
            Recarregar
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} hoverable className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {isLoading ? '...' : stat.value}
                </span>
                <p className="mt-1 text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {stat.change}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1">Ações de Governança</h3>
          <p className="text-xs text-slate-400 mb-4">Atalhos administrativos da plataforma</p>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" variant="primary" onClick={() => navigate('/users')}>
              Gerenciar Usuários
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/properties')}>
              Auditar Imóveis
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/bookings')}>
              Reservas Globais
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/finance')}>
              Fluxo Financeiro
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1">Conformidade & Segurança</h3>
          <p className="text-xs text-slate-400 mb-4">Controles ativos no ambiente</p>
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900">Isolamento Multi-tenant & RBAC</p>
                <p className="text-[11px] text-emerald-700">
                  Proprietários e funcionários acessam estritamente os recursos vinculados ao seu escopo.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
