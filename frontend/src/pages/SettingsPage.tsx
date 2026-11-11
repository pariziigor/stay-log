import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { getApiErrorMessage } from '../utils/apiError';

export const SettingsPage: React.FC = () => {
  const { user, role } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRecordingConsent, setIsRecordingConsent] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (newPassword !== confirmPassword) {
      setNotice({ type: 'error', text: 'A confirmação da nova senha não confere.' });
      return;
    }
    setIsChangingPassword(true);
    try {
      await userService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice({ type: 'success', text: 'Sua senha de acesso foi alterada com sucesso!' });
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Não foi possível alterar a senha. Verifique sua senha atual.'),
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRecordConsent = async (consentType: string) => {
    setIsRecordingConsent(true);
    setNotice(null);
    try {
      await userService.recordConsent({
        consent_type: consentType,
        policy_version: '1.0',
      });
      setNotice({
        type: 'success',
        text: `Consentimento LGPD (${consentType}) registrado com trilha de auditoria!`,
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Erro ao registrar consentimento LGPD.'),
      });
    } finally {
      setIsRecordingConsent(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Configurações de Conta & Privacidade (LGPD)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Gerencie suas credenciais de segurança e preferências de proteção de dados pessoais (RNF-01, RNF-02).
        </p>
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

      {/* Dados do Perfil Autenticado */}
      <Card className="p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Perfil Autenticado</h3>
            <p className="text-xs text-slate-500">Identificação validada via sessão JWT</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 font-bold uppercase block mb-1">Nome Completo</span>
            <span className="text-slate-900 font-extrabold text-sm">{user?.full_name}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 font-bold uppercase block mb-1">E-mail</span>
            <span className="text-slate-900 font-extrabold text-sm">{user?.email}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 font-bold uppercase block mb-1">Perfil de Acesso (RBAC)</span>
            <Badge variant="brand" size="sm">
              {role === 'admin' ? 'Administrador' : role === 'owner' ? 'Proprietário / Gestor' : 'Funcionário'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Alteração de Senha */}
      <Card className="p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Segurança & Alteração de Senha</h3>
            <p className="text-xs text-slate-500">As senhas são armazenadas exclusivamente com hash seguro bcrypt</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 mt-4 max-w-md">
          <Input
            label="Senha Atual *"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            label="Nova Senha (mín. 8 caracteres) *"
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            label="Confirmar Nova Senha *"
            type="password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" isLoading={isChangingPassword}>
            Atualizar Senha
          </Button>
        </form>
      </Card>

      {/* Conformidade LGPD */}
      <Card className="p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Termos & Consentimentos LGPD (Art. 8º)</h3>
            <p className="text-xs text-slate-500">
              Registre ou renove o aceite das políticas de tratamento de dados com auditoria de versão
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={isRecordingConsent}
            onClick={() => handleRecordConsent('terms_of_use')}
          >
            Confirmar Termos de Uso v1.0
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isRecordingConsent}
            onClick={() => handleRecordConsent('privacy_policy')}
          >
            Confirmar Política de Privacidade v1.0
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isRecordingConsent}
            onClick={() => handleRecordConsent('ai_data_processing')}
          >
            Autorizar Processamento Operacional IA
          </Button>
        </div>
      </Card>
    </div>
  );
};
