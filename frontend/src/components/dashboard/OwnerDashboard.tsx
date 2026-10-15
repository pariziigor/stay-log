import React from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

export const OwnerDashboard: React.FC = () => {
  const navigate = useNavigate();

  const metrics = [
    { label: 'Taxa de Ocupação', value: '82%', change: '+14% vs mês anterior', icon: CalendarDays, color: 'emerald' },
    { label: 'Receita Prevista (Mês)', value: 'R$ 14.850', change: '8 reservas pagas', icon: DollarSign, color: 'brand' },
    { label: 'Imóveis Ativos', value: '3 unidades', change: '100% disponíveis', icon: Building2, color: 'violet' },
    { label: 'Tarefas da Equipe', value: '5 pendentes', change: '2 limpezas agendadas', icon: CheckCircle2, color: 'amber' },
  ];

  const quickActions = [
    { label: 'Cadastrar Imóvel', icon: Plus, action: () => navigate('/properties'), primary: true },
    { label: 'Ver Reservas', icon: CalendarDays, action: () => navigate('/bookings') },
    { label: 'Atribuir Tarefas', icon: CheckCircle2, action: () => navigate('/tasks') },
    { label: 'Perguntar à IA', icon: Sparkles, action: () => navigate('/ai-assistant'), glow: true },
  ];

  return (
    <div className="space-y-6">
      {/* Banner Principal Moderno com Ação Rápida de IA */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 via-indigo-600 to-brand-800 text-white p-6 sm:p-8 shadow-xl shadow-brand-700/15">
        <div className="relative z-10 max-w-2xl">
          <Badge variant="cyan" size="sm" className="mb-3 bg-cyan-900/60 text-cyan-200 border-cyan-700/50">
            Inteligência Operacional
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Olá, Mariana! Seus imóveis estão com 82% de ocupação neste mês.
          </h2>
          <p className="mt-2 text-sm text-indigo-100/90 leading-relaxed">
            Há 2 check-ins programados para hoje e o estoque de toalhas da unidade Beira-Mar foi reposto com sucesso pela equipe.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {quickActions.map((qa, i) => {
              const Icon = qa.icon;
              return (
                <button
                  key={i}
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

        {/* Efeito luminoso decorativo */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      </div>

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
                <span className="text-2xl sm:text-3xl font-black text-slate-900">{m.value}</span>
                <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {m.change}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Próximos Check-ins e Alertas de Estoque */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Movimentação de Hoje</h3>
              <p className="text-xs text-slate-400">Entradas e saídas de hóspedes com status operacional</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/bookings')}>
              Ver Calendário <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          <div className="space-y-3">
            {[
              { guest: 'João Silva', property: 'Chalé da Montanha', time: 'Check-in às 15:00', guests: '4 hóspedes', status: 'Limpeza Concluída', badge: 'emerald' },
              { guest: 'Camila Rossi', property: 'Studio Beira-Mar', time: 'Check-out às 11:00', guests: '2 hóspedes', status: 'Aguardando Saída', badge: 'amber' },
              { guest: 'Marcos Duarte', property: 'Apto Praia Brava', time: 'Check-in amanhã', guests: '5 hóspedes', status: 'Higienização Agendada', badge: 'brand' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {item.guest.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.guest}</p>
                    <p className="text-[11px] text-slate-500">{item.property} • {item.guests}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> {item.time}
                  </span>
                  <Badge variant={item.badge as any} size="sm">{item.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Alerta de Estoque e Insight de IA */}
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-white to-amber-50/30 border-amber-200/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4.5 h-4.5 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-950">Atenção ao Estoque</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              O item <strong>Papel Higiênico (folha dupla)</strong> atingiu 4 unidades no <em>Studio Beira-Mar</em> (mínimo configurado: 8).
            </p>
            <div className="mt-4">
              <Button size="sm" variant="secondary" onClick={() => navigate('/inventory')} className="w-full text-xs">
                Registrar Reposição
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-indigo-900 to-brand-950 text-white">
            <div className="flex items-center gap-2 mb-2 text-brand-300">
              <Sparkles className="w-4.5 h-4.5 text-amber-300 animate-pulse" />
              <h3 className="text-sm font-bold">Insight do Assistente IA</h3>
            </div>
            <p className="text-xs text-indigo-100/90 leading-relaxed">
              "A taxa de ocupação para o feriado de novembro está em 40%. Sugiro ajustar a diária do <strong>Chalé da Montanha</strong> de R$ 450 para R$ 410 para acelerar o fechamento."
            </p>
            <div className="mt-4">
              <Button size="sm" variant="emerald" onClick={() => navigate('/ai-assistant')} className="w-full text-xs">
                Conversar com IA
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
