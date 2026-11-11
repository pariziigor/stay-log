import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { userService, TeamMember } from '../services/userService';
import { User } from '../types/auth';
import { getApiErrorMessage } from '../utils/apiError';

export const UsersPage: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [users, setUsers] = useState<User[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    job_title: 'Limpeza & Manutenção',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (isAdmin) {
        const allUsers = await userService.listUsers();
        setUsers(allUsers);
      } else {
        const teamList = await userService.listTeamMembers();
        setTeam(teamList);
      }
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Não foi possível carregar a lista de usuários/equipe.'));
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotice(null);
    try {
      const created = await userService.inviteTeamMember({
        full_name: inviteForm.full_name.trim(),
        email: inviteForm.email.trim(),
        password: inviteForm.password || undefined,
        phone: inviteForm.phone.trim() || undefined,
        job_title: inviteForm.job_title.trim() || 'Equipe de Campo',
      });
      setIsModalOpen(false);
      setInviteForm({
        full_name: '',
        email: '',
        password: '',
        phone: '',
        job_title: 'Limpeza & Manutenção',
      });
      setNotice({
        type: 'success',
        text: `Funcionário "${created.full_name}" vinculado à equipe com sucesso!`,
      });
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Erro ao cadastrar/vincular membro da equipe.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentActive: boolean) => {
    setNotice(null);
    try {
      await userService.updateUserStatus(userId, !currentActive);
      setNotice({
        type: 'success',
        text: !currentActive ? 'Acesso ativado com sucesso.' : 'Acesso desativado com sucesso.',
      });
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Não foi possível alterar o status do usuário.'),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isAdmin ? 'Gestão de Usuários da Plataforma' : 'Minha Equipe Operacional'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? 'Administração global de contas, perfis de acesso RBAC e status de segurança (RF-01, RF-02).'
              : 'Cadastre ou vincule funcionários de limpeza e manutenção para atuarem nos seus imóveis (RF-02).'}
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
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Adicionar Funcionário
          </Button>
        </div>
      </div>

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
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-20 rounded-2xl bg-white border border-slate-200/70 p-4 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <Card className="p-8 text-center border-rose-200 bg-rose-50/40">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Erro ao carregar usuários</h3>
          <p className="text-xs text-slate-600 mt-1">{loadError}</p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={loadData}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      ) : isAdmin ? (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={u.role === 'admin' ? 'violet' : u.role === 'owner' ? 'brand' : 'emerald'}
                    size="sm"
                  >
                    {u.role.toUpperCase()}
                  </Badge>
                  <Badge variant={u.is_active ? 'emerald' : 'rose'} dot size="sm">
                    {u.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <p className="text-sm font-bold text-slate-900">{u.full_name}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              <Button
                size="sm"
                variant={u.is_active ? 'danger' : 'emerald'}
                onClick={() => handleToggleStatus(u.id, u.is_active)}
                icon={u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
              >
                {u.is_active ? 'Desativar' : 'Ativar'}
              </Button>
            </Card>
          ))}
        </div>
      ) : team.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-white/50">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Nenhum funcionário vinculado à sua equipe</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Adicione diaristas, governantas ou técnicos de manutenção para que eles possam visualizar seus imóveis e executar os checklists operacionais.
          </p>
          <div className="mt-5">
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
              Cadastrar Primeiro Funcionário
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {team.map((tm) => (
            <Card key={tm.employee_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="brand" size="sm">
                    {tm.job_title || 'Equipe de Campo'}
                  </Badge>
                  <Badge variant={tm.is_active ? 'emerald' : 'rose'} dot size="sm">
                    {tm.is_active ? 'Vínculo Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <p className="text-sm font-bold text-slate-900">{tm.full_name}</p>
                <p className="text-xs text-slate-500">
                  {tm.email} {tm.phone ? `• ${tm.phone}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant={tm.is_active ? 'danger' : 'emerald'}
                onClick={() => handleToggleStatus(tm.employee_id, tm.is_active)}
                icon={tm.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
              >
                {tm.is_active ? 'Suspender Acesso' : 'Reativar Acesso'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Convite / Cadastro de Funcionário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">Cadastrar Funcionário na Equipe</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4 mt-4">
              <Input
                label="Nome Completo *"
                placeholder="Ex: Lucas Operacional"
                value={inviteForm.full_name}
                onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                required
              />

              <Input
                label="E-mail de Acesso *"
                type="email"
                placeholder="lucas@equipe.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                required
              />

              <Input
                label="Senha Inicial (mín. 8 caracteres) *"
                type="password"
                placeholder="••••••••"
                value={inviteForm.password}
                onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                helperText="Obrigatória caso o e-mail ainda não possua conta na plataforma."
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Função / Cargo"
                  placeholder="Ex: Governanta"
                  value={inviteForm.job_title}
                  onChange={(e) => setInviteForm({ ...inviteForm, job_title: e.target.value })}
                />
                <Input
                  label="Telefone"
                  placeholder="(48) 99999-0000"
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Vincular à Equipe
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
