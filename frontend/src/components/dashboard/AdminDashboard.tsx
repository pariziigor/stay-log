import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, CalendarCheck, ShieldCheck, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';

export const AdminDashboard: React.FC = () => {
  const stats = [
    { label: 'Total de Imóveis', value: '48', change: '+12% este mês', icon: Building2, color: 'brand' },
    { label: 'Proprietários Ativos', value: '18', change: '100% compliant LGPD', icon: Users, color: 'violet' },
    { label: 'Reservas no Sistema', value: '142', change: '+24% vs mês anterior', icon: CalendarCheck, color: 'emerald' },
    { label: 'Saúde dos Serviços', value: '99.9%', change: 'PostgreSQL & API OK', icon: Activity, color: 'cyan' },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="space-y-6">
      {/* Banner de Boas-Vindas */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <Badge variant="violet" dot size="sm" className="mb-3 bg-purple-900/60 text-purple-200 border-purple-700/50">
            Painel Geral do Administrador
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Controle Macro da Plataforma
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Monitoramento centralizado de todos os imóveis, auditoria de trilhas de segurança, conformidade com a LGPD e métricas de desempenho operacional da rede.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Grid de Estatísticas */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
      >
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div key={idx} variants={item}>
              <Card hoverable className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900">{stat.value}</span>
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> {stat.change}
                  </span>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Seção Operacional e Auditoria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Atividades e Alertas Recentes da Rede</h3>
              <p className="text-xs text-slate-400">Trilha de auditoria das últimas 24 horas</p>
            </div>
            <Badge variant="emerald" dot>Sistema Seguro</Badge>
          </div>
          <div className="space-y-3">
            {[
              { text: 'Novo imóvel cadastrado por Mariana Santos em Florianópolis/SC', time: 'Há 12 min', type: 'info' },
              { text: 'Tentativas excessivas de login bloqueadas automaticamente (IP 187.54.12.9)', time: 'Há 45 min', type: 'warning' },
              { text: 'Consentimento de política LGPD v1.0 confirmado por 3 novos funcionários', time: 'Há 2h', type: 'info' },
              { text: 'Backup automático do PostgreSQL concluído com integridade', time: 'Há 4h', type: 'success' },
            ].map((log, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-brand-500" />
                  <span className="text-slate-700 font-medium">{log.text}</span>
                </div>
                <span className="text-slate-400 font-medium shrink-0">{log.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-base font-bold text-slate-900 mb-1">Status de Segurança</h3>
          <p className="text-xs text-slate-400 mb-4">Parâmetros de conformidade e LGPD</p>
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-900">Isolamento Multi-tenant Ativo</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">Proprietários só visualizam dados de suas próprias unidades.</p>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-brand-50/70 border border-brand-100 flex items-start gap-3">
              <Activity className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-brand-900">Rotação de Refresh Tokens</p>
                <p className="text-[11px] text-brand-700 mt-0.5">Revogação instantânea por detecção de repetição habilitada.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
