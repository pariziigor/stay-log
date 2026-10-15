import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  X,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AIInsight, InsightSeverity } from '../../types/ai';
import { cn } from '../../utils/cn';

interface AIInsightCardProps {
  insight: AIInsight;
  onDismiss: (id: string) => void;
  onConsult: (insight: AIInsight) => void;
  isDismissing?: boolean;
}

export const AIInsightCard: React.FC<AIInsightCardProps> = ({
  insight,
  onDismiss,
  onConsult,
  isDismissing = false,
}) => {
  const getSeverityConfig = (sev: InsightSeverity) => {
    switch (sev) {
      case 'critical':
        return {
          icon: AlertTriangle,
          badgeText: 'Crítico',
          bgClass: 'bg-rose-50/90 border-rose-200 text-rose-900',
          iconColor: 'text-rose-600',
          badgeClass: 'bg-rose-100 text-rose-700',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          badgeText: 'Atenção',
          bgClass: 'bg-amber-50/90 border-amber-200 text-amber-900',
          iconColor: 'text-amber-600',
          badgeClass: 'bg-amber-100 text-amber-800',
        };
      case 'opportunity':
        return {
          icon: TrendingUp,
          badgeText: 'Oportunidade',
          bgClass: 'bg-emerald-50/90 border-emerald-200 text-emerald-900',
          iconColor: 'text-emerald-600',
          badgeClass: 'bg-emerald-100 text-emerald-800',
        };
      case 'info':
      default:
        return {
          icon: Info,
          badgeText: 'Informativo',
          bgClass: 'bg-sky-50/90 border-sky-200 text-sky-900',
          iconColor: 'text-sky-600',
          badgeClass: 'bg-sky-100 text-sky-800',
        };
    }
  };

  const config = getSeverityConfig(insight.severity);
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative rounded-2xl border p-4 shadow-xs backdrop-blur-xs transition-all hover:shadow-md',
        config.bgClass
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-xl bg-white/80 shadow-2xs', config.iconColor)}>
            <Icon className="w-4 h-4" />
          </div>
          <span className={cn('text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', config.badgeClass)}>
            {config.badgeText}
          </span>
        </div>

        <button
          onClick={() => onDismiss(insight.id)}
          disabled={isDismissing}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white/60 transition-colors"
          title="Dispensar insight"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-2.5">
        <h4 className="text-sm font-bold leading-tight">{insight.title}</h4>
        <p className="mt-1 text-xs leading-relaxed opacity-90 line-clamp-3">{insight.content}</p>
      </div>

      <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
          <Sparkles className="w-3 h-3 text-brand-500" />
          Gerado por IA
        </span>

        <button
          onClick={() => onConsult(insight)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-white/90 hover:bg-white rounded-lg shadow-2xs transition-all hover:scale-102 cursor-pointer"
        >
          <MessageSquare className="w-3 h-3" />
          Analisar
        </button>
      </div>
    </motion.div>
  );
};
