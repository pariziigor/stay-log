import React, { useState } from 'react';
import {
  CheckSquare,
  Clock,
  Plus,
  Filter,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Camera,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

export const TasksPage: React.FC = () => {
  const { role } = useAuth();
  const [filterType, setFilterType] = useState('all');

  const [tasks, setTasks] = useState([
    {
      id: '1',
      title: 'Limpeza e Higienização pós-checkout (João Silva)',
      type: 'cleaning',
      property: 'Chalé da Montanha',
      assignee: 'Lucas Operacional',
      priority: 'high',
      status: 'in_progress',
      due: 'Hoje às 14:00',
      checklist: [
        { id: 1, text: 'Trocar roupa de cama e toalhas', done: true },
        { id: 2, text: 'Higienizar banheiros e repor sabonetes', done: true },
        { id: 3, text: 'Fotografar bancada da cozinha e fogão limpos', done: false, photoRequired: true },
      ],
    },
    {
      id: '2',
      title: 'Manutenção do Ar-condicionado da Suíte Master',
      type: 'maintenance',
      property: 'Studio Beira-Mar',
      assignee: 'Técnico Refrigeração',
      priority: 'medium',
      status: 'pending',
      due: 'Amanhã às 10:00',
      checklist: [
        { id: 1, text: 'Limpar filtros de ar e verificar dreno', done: false },
        { id: 2, text: 'Testar controle remoto e pilha', done: false },
      ],
    },
    {
      id: '3',
      title: 'Vistoria e Checklist de Entrada (Hóspedes Família Costa)',
      type: 'inspection',
      property: 'Apartamento Praia Brava',
      assignee: 'Mariana Santos',
      priority: 'low',
      status: 'completed',
      due: 'Concluído hoje',
      checklist: [
        { id: 1, text: 'Conferir louças e taças', done: true },
        { id: 2, text: 'Testar fechadura eletrônica e código', done: true },
      ],
    },
  ]);

  const toggleCheck = (taskId: string, itemId: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          checklist: t.checklist.map((item) =>
            item.id === itemId ? { ...item, done: !item.done } : item
          ),
        };
      })
    );
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterType === 'all') return true;
    return t.type === filterType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Tarefas & Operações de Campo
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Coordenação de limpezas, manutenções preventivas e preenchimento de checklists obrigatórios (RF-08 a RF-11).
          </p>
        </div>

        {role !== 'employee' && (
          <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
            Nova Tarefa
          </Button>
        )}
      </div>

      {/* Filtros de Tipo */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Todas as Demandas' },
          { id: 'cleaning', label: 'Limpezas' },
          { id: 'maintenance', label: 'Manutenções' },
          { id: 'inspection', label: 'Vistorias' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              filterType === tab.id
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista de Tarefas */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <Card key={task.id} className="p-5 sm:p-6 border-slate-200/90 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge
                    variant={
                      task.type === 'cleaning'
                        ? 'cyan'
                        : task.type === 'maintenance'
                        ? 'amber'
                        : 'violet'
                    }
                    size="sm"
                  >
                    {task.type === 'cleaning'
                      ? 'Higienização'
                      : task.type === 'maintenance'
                      ? 'Manutenção'
                      : 'Vistoria'}
                  </Badge>
                  <Badge variant={task.priority === 'high' ? 'rose' : 'slate'} size="sm">
                    {task.priority === 'high' ? 'Alta Prioridade' : 'Normal'}
                  </Badge>
                  <span className="text-xs text-slate-400 font-medium">
                    Atribuído a: <strong>{task.assignee}</strong>
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{task.title}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-600" /> {task.property}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    task.status === 'completed'
                      ? 'emerald'
                      : task.status === 'in_progress'
                      ? 'brand'
                      : 'amber'
                  }
                  dot
                  size="md"
                >
                  {task.status === 'completed'
                    ? 'Finalizada'
                    : task.status === 'in_progress'
                    ? 'Em Execução'
                    : 'Aguardando Início'}
                </Badge>
              </div>
            </div>

            {/* Checklist */}
            <div className="mt-4">
              <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2">
                Checklist Obrigatório ({task.checklist.filter((i) => i.done).length}/{task.checklist.length})
              </p>
              <div className="space-y-1.5">
                {task.checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleCheck(task.id, item.id)}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 text-xs font-medium cursor-pointer hover:bg-slate-100 transition-colors select-none"
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border ${
                        item.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {item.done && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span className={item.done ? 'line-through text-slate-400' : 'text-slate-700'}>
                      {item.text}
                    </span>
                    {item.photoRequired && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        <Camera className="w-3 h-3" /> Foto
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
