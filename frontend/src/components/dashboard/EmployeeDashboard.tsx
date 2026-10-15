import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckSquare,
  Clock,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

interface OperationalTask {
  id: string;
  title: string;
  property: string;
  address: string;
  dueTime: string;
  priority: 'urgent' | 'high' | 'medium';
  status: 'pending' | 'in_progress' | 'completed';
  checklist: Array<{ id: number; text: string; done: boolean; photoRequired?: boolean }>;
}

export const EmployeeDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<OperationalTask[]>([
    {
      id: '1',
      title: 'Limpeza Completa pós-checkout (João Silva)',
      property: 'Chalé da Montanha',
      address: 'Estrada das Araucárias, 500 — Urubici/SC',
      dueTime: 'Hoje às 14:00',
      priority: 'high',
      status: 'in_progress',
      checklist: [
        { id: 1, text: 'Trocar e higienizar roupas de cama e toalhas', done: true },
        { id: 2, text: 'Higienizar banheiros e repor sabonete/papel', done: true },
        { id: 3, text: 'Fotografar bancada da cozinha e fogão limpos', done: false, photoRequired: true },
        { id: 4, text: 'Acondicionar lixo e verificar fechamento de janelas', done: false },
      ],
    },
    {
      id: '2',
      title: 'Vistoria e Manutenção Preventiva do Chuveiro',
      property: 'Studio Beira-Mar',
      address: 'Avenida Atlântica, 1200 — Balneário Camboriú/SC',
      dueTime: 'Hoje às 16:30',
      priority: 'medium',
      status: 'pending',
      checklist: [
        { id: 1, text: 'Checar pressão da água da suíte', done: false },
        { id: 2, text: 'Testar disjuntor do quadro elétrico', done: false },
      ],
    },
  ]);

  const toggleChecklistItem = (taskId: string, itemId: number) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          checklist: task.checklist.map((item) =>
            item.id === itemId ? { ...item, done: !item.done } : item
          ),
        };
      })
    );
  };

  const updateTaskStatus = (taskId: string, nextStatus: 'pending' | 'in_progress' | 'completed') => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task))
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Operacional */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-6 sm:p-8 shadow-xl">
        <Badge variant="emerald" size="sm" className="mb-3 bg-emerald-900/60 text-emerald-200 border-emerald-700/50">
          Acesso Operacional & Equipe
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Suas Tarefas de Hoje
        </h2>
        <p className="mt-2 text-sm text-emerald-100 max-w-xl">
          Complete os itens obrigatórios dos checklists para habilitar a finalização do serviço. Registros são sincronizados com o proprietário em tempo real.
        </p>
      </div>

      {/* Lista de Tarefas Atribuídas */}
      <div className="space-y-4">
        {tasks.map((task) => {
          const completedCount = task.checklist.filter((i) => i.done).length;
          const progressPercent = Math.round((completedCount / task.checklist.length) * 100);

          return (
            <Card key={task.id} className="p-5 sm:p-6 border-slate-200/90 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={task.priority === 'high' ? 'rose' : 'amber'} size="sm">
                      {task.priority === 'high' ? 'Prioridade Alta' : 'Prioridade Média'}
                    </Badge>
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" /> Prazo: {task.dueTime}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">{task.title}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-500" /> {task.property} • {task.address}
                  </p>
                </div>

                {/* Status da Tarefa */}
                <div className="flex items-center gap-2 self-start sm:self-center">
                  {task.status === 'pending' ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      icon={<Play className="w-3.5 h-3.5" />}
                    >
                      Iniciar Tarefa
                    </Button>
                  ) : task.status === 'in_progress' ? (
                    <Button
                      size="sm"
                      variant="emerald"
                      disabled={progressPercent < 100}
                      onClick={() => updateTaskStatus(task.id, 'completed')}
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Concluir Serviço
                    </Button>
                  ) : (
                    <Badge variant="emerald" size="md" dot>
                      Finalizada com Sucesso
                    </Badge>
                  )}
                </div>
              </div>

              {/* Barra de Progresso do Checklist */}
              <div className="mt-4">
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span>Progresso do Checklist ({completedCount}/{task.checklist.length})</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Itens do Checklist */}
              <div className="mt-4 space-y-2">
                {task.checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => task.status !== 'completed' && toggleChecklistItem(task.id, item.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs sm:text-sm cursor-pointer select-none transition-all ${
                      item.done
                        ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950 font-medium'
                        : 'bg-slate-50/80 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border transition-all ${
                        item.done
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {item.done && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>

                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className={item.done ? 'line-through text-slate-500' : ''}>
                        {item.text}
                      </span>
                      {item.photoRequired && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                          <Camera className="w-3 h-3" /> Foto Obrigatória
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
