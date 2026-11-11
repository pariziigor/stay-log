import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckSquare,
  Plus,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Play,
  Trash2,
  X,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import {
  taskService,
  TaskItem,
  TaskType,
  TaskPriority,
  TaskStatus,
} from '../services/taskService';
import { propertyService } from '../services/propertyService';
import { userService, TeamMember } from '../services/userService';
import { Property } from '../types/property';
import { getApiErrorMessage } from '../utils/apiError';

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  cleaning: 'Higienização',
  maintenance: 'Manutenção',
  inspection: 'Vistoria',
  check_in: 'Check-in',
  check_out: 'Check-out',
  restock: 'Reposição',
  other: 'Outra',
};

export const TasksPage: React.FC = () => {
  const { role } = useAuth();
  const canManage = role === 'admin' || role === 'owner';

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal de Nova Tarefa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTask, setNewTask] = useState<{
    property_id: string;
    task_type: TaskType;
    title: string;
    description: string;
    priority: TaskPriority;
    due_at: string;
    assigned_to: string;
    checklist: string[];
    newChecklistInput: string;
  }>({
    property_id: '',
    task_type: 'cleaning',
    title: '',
    description: '',
    priority: 'medium',
    due_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16),
    assigned_to: '',
    checklist: [
      'Trocar roupa de cama e toalhas',
      'Higienizar banheiros e repor sabonetes',
    ],
    newChecklistInput: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [tasksData, propsData, teamData] = await Promise.all([
        taskService.listTasks(),
        propertyService.listProperties({ page: 1, page_size: 100 }),
        canManage ? userService.listTeamMembers().catch(() => []) : Promise.resolve([]),
      ]);
      setTasks(tasksData);
      setProperties(propsData.items || []);
      setTeamMembers(teamData);
      if (propsData.items?.length && !newTask.property_id) {
        setNewTask((prev) => ({ ...prev, property_id: propsData.items[0].id }));
      }
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Não foi possível carregar as tarefas operacionais.'));
    } finally {
      setIsLoading(false);
    }
  }, [canManage, newTask.property_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleChecklist = async (task: TaskItem, itemId: string, currentChecked: boolean) => {
    setNotice(null);
    try {
      const updated = await taskService.toggleChecklistItem(task.id, itemId, !currentChecked);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Erro ao atualizar item do checklist.'),
      });
    }
  };

  const handleStatusChange = async (taskId: string, nextStatus: TaskStatus) => {
    setNotice(null);
    try {
      const updated = await taskService.updateTaskStatus(taskId, nextStatus);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setNotice({
        type: 'success',
        text: nextStatus === 'completed' ? 'Tarefa concluída com sucesso!' : 'Status da tarefa atualizado.',
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Não foi possível alterar o status da tarefa.'),
      });
    }
  };

  const handleDeleteTask = async (task: TaskItem) => {
    setNotice(null);
    try {
      await taskService.deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setNotice({ type: 'success', text: `Tarefa "${task.title}" removida.` });
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Erro ao remover tarefa.'),
      });
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.property_id) {
      setNotice({ type: 'error', text: 'Selecione um imóvel para vincular a tarefa.' });
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      const created = await taskService.createTask({
        property_id: newTask.property_id,
        task_type: newTask.task_type,
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        due_at: new Date(newTask.due_at).toISOString(),
        assigned_to: newTask.assigned_to || undefined,
        checklist_items: newTask.checklist
          .filter((c) => c.trim().length > 0)
          .map((c) => ({ description: c.trim(), is_required: true })),
      });
      setTasks((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setNewTask((prev) => ({
        ...prev,
        title: '',
        description: '',
        newChecklistInput: '',
      }));
      setNotice({ type: 'success', text: `Tarefa "${created.title}" criada com sucesso.` });
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Erro ao criar tarefa operacional.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterType === 'all') return true;
    return t.task_type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Tarefas & Operações de Campo
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Coordenação de limpezas, manutenções preventivas e preenchimento de checklists obrigatórios (RF-08 a RF-11).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Atualizar
          </Button>
          {canManage && (
            <Button
              variant="primary"
              onClick={() => setIsModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Nova Tarefa
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-bold underline"
          >
            Fechar
          </button>
        </div>
      )}

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
            type="button"
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

      {/* Estados de Carregamento / Erro / Vazio */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-44 rounded-2xl bg-white border border-slate-200/70 p-6 animate-pulse flex flex-col justify-between"
            >
              <div className="h-5 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-10 bg-slate-100 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <Card className="p-8 text-center border-rose-200 bg-rose-50/40">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Falha ao carregar tarefas</h3>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">{loadError}</p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={loadData}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-white/50">
          <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Nenhuma tarefa encontrada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {canManage
              ? 'Crie uma tarefa operacional com checklist obrigatório para coordenar limpezas e vistorias dos seus imóveis.'
              : 'Não há tarefas atribuídas para você neste filtro.'}
          </p>
          {canManage && (
            <div className="mt-5">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                Criar Primeira Tarefa
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const doneCount = task.checklist_items.filter((i) => i.is_checked).length;
            const totalCount = task.checklist_items.length;
            const allRequiredDone = task.checklist_items
              .filter((i) => i.is_required)
              .every((i) => i.is_checked);

            return (
              <Card key={task.id} className="p-5 sm:p-6 border-slate-200/90 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Badge
                        variant={
                          task.task_type === 'cleaning'
                            ? 'cyan'
                            : task.task_type === 'maintenance'
                            ? 'amber'
                            : 'violet'
                        }
                        size="sm"
                      >
                        {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                      </Badge>
                      <Badge
                        variant={
                          task.priority === 'urgent' || task.priority === 'high' ? 'rose' : 'slate'
                        }
                        size="sm"
                      >
                        {task.priority === 'urgent'
                          ? 'Urgente'
                          : task.priority === 'high'
                          ? 'Alta Prioridade'
                          : task.priority === 'medium'
                          ? 'Média'
                          : 'Baixa'}
                      </Badge>
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Prazo: {new Date(task.due_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      {task.assignee_name && (
                        <span className="text-xs text-slate-500 font-medium">
                          • Responsável: <strong>{task.assignee_name}</strong>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{task.title}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-600" /> {task.property_name}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
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
                        : 'Pendente'}
                    </Badge>

                    {task.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleStatusChange(task.id, 'in_progress')}
                        icon={<Play className="w-3.5 h-3.5" />}
                      >
                        Iniciar
                      </Button>
                    )}

                    {task.status !== 'completed' && (
                      <Button
                        size="sm"
                        variant="emerald"
                        disabled={!allRequiredDone}
                        title={
                          allRequiredDone
                            ? 'Concluir tarefa'
                            : 'Marque todos os itens obrigatórios do checklist para habilitar a conclusão (RF-11)'
                        }
                        onClick={() => handleStatusChange(task.id, 'completed')}
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      >
                        Concluir
                      </Button>
                    )}

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remover tarefa"
                        aria-label={`Remover tarefa ${task.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Checklist Obrigatório */}
                {totalCount > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mb-2">
                      Checklist Obrigatório ({doneCount}/{totalCount})
                    </p>
                    <div className="space-y-1.5">
                      {task.checklist_items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="checkbox"
                          aria-checked={item.is_checked}
                          disabled={task.status === 'completed'}
                          onClick={() => handleToggleChecklist(task, item.id, item.is_checked)}
                          className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 text-xs font-medium hover:bg-slate-100 transition-colors disabled:opacity-70"
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              item.is_checked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {item.is_checked && <CheckCircle2 className="w-3 h-3" />}
                          </div>
                          <span
                            className={
                              item.is_checked ? 'line-through text-slate-400' : 'text-slate-700'
                            }
                          >
                            {item.description}
                          </span>
                          {item.is_required && (
                            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/70 text-slate-600">
                              Obrigatório
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Nova Tarefa */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">Nova Tarefa Operacional</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Imóvel *
                </label>
                <select
                  required
                  value={newTask.property_id}
                  onChange={(e) => setNewTask({ ...newTask, property_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5"
                >
                  <option value="">Selecione um imóvel...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.address.city})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Título da Tarefa *"
                placeholder="Ex: Limpeza completa pós-checkout"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Tipo *
                  </label>
                  <select
                    value={newTask.task_type}
                    onChange={(e) =>
                      setNewTask({ ...newTask, task_type: e.target.value as TaskType })
                    }
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5"
                  >
                    <option value="cleaning">Higienização / Limpeza</option>
                    <option value="maintenance">Manutenção</option>
                    <option value="inspection">Vistoria</option>
                    <option value="restock">Reposição de Estoque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Prioridade *
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask({ ...newTask, priority: e.target.value as TaskPriority })
                    }
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Prazo Limite *"
                  type="datetime-local"
                  value={newTask.due_at}
                  onChange={(e) => setNewTask({ ...newTask, due_at: e.target.value })}
                  required
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Atribuir Funcionário
                  </label>
                  <select
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5"
                  >
                    <option value="">Sem atribuição específica</option>
                    {teamMembers.map((tm) => (
                      <option key={tm.employee_id} value={tm.employee_id}>
                        {tm.full_name} ({tm.job_title || 'Equipe'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checklist Builder */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Itens Obrigatórios do Checklist (RF-10 / RF-11)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Adicionar item ao checklist..."
                    value={newTask.newChecklistInput}
                    onChange={(e) =>
                      setNewTask({ ...newTask, newChecklistInput: e.target.value })
                    }
                    className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (!newTask.newChecklistInput.trim()) return;
                      setNewTask({
                        ...newTask,
                        checklist: [...newTask.checklist, newTask.newChecklistInput.trim()],
                        newChecklistInput: '',
                      });
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {newTask.checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setNewTask({
                            ...newTask,
                            checklist: newTask.checklist.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-rose-500 font-bold hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Criar Tarefa
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
