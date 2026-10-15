import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { UserRole } from '../types/auth';

export const LoginPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('owner');
  const [consentTerms, setConsentTerms] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (isRegister) {
        if (!consentTerms) {
          setErrorMsg('É necessário aceitar os termos de uso e política de privacidade (LGPD).');
          setIsSubmitting(false);
          return;
        }
        await register({
          full_name: fullName,
          email,
          password,
          role,
          phone: phone || undefined,
          consent_terms: consentTerms,
        });
      } else {
        await login({ email, password });
      }
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Falha ao autenticar. Verifique suas credenciais.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preenchimento de credenciais para avaliação rápida com 1 clique
  const setQuickCredentials = (userRole: UserRole) => {
    setIsRegister(false);
    if (userRole === 'admin') {
      setEmail('admin@locacao.com');
      setPassword('SenhaAdmin123!');
    } else if (userRole === 'owner') {
      setEmail('mariana@locacao.com');
      setPassword('SenhaProprietario123!');
    } else {
      setEmail('lucas@locacao.com');
      setPassword('SenhaFuncionario123!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col lg:flex-row">
      {/* Lado Esquerdo: Banner Moderno com Ilustrações e Destaques */}
      <div className="relative flex-1 bg-gradient-to-br from-indigo-950 via-brand-950 to-slate-950 p-8 sm:p-12 lg:p-16 flex flex-col justify-between overflow-hidden text-white">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center text-white shadow-glow">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight flex items-center gap-1.5">
              Hospeda<span className="text-brand-400">AI</span>
            </span>
            <p className="text-xs text-slate-400 font-medium">Gestão Inteligente de Temporada</p>
          </div>
        </div>

        {/* Feature Showcase Central */}
        <div className="relative z-10 my-12 max-w-lg">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 border border-brand-500/30 text-brand-300 mb-6 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> Inteligência Operacional Integrada
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
            Autonomia total para rentabilizar seus imóveis.
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
            Elimine taxas abusivas de intermediários. Centralize reservas, organize checklists de limpeza com fotos e conte com inteligência artificial para otimizar suas diárias.
          </p>

          {/* Cards Flutuantes com Animação */}
          <div className="mt-8 space-y-3">
            {[
              { icon: ShieldCheck, text: 'Segurança com criptografia de ponta a ponta e total conformidade com a LGPD.' },
              { icon: CheckCircle2, text: 'Checklists obrigatórios com travas no banco para prevenir falhas de limpeza.' },
              { icon: Sparkles, text: 'Assistente IA nativo para analisar dados de ocupação e fluxo de caixa.' },
            ].map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-xs sm:text-sm text-slate-200"
                >
                  <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-300 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span>{feat.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between border-t border-white/10 pt-4">
          <span>HospedaAI Platform © 2026</span>
          <span>Arquitetura DDD · FastAPI · React</span>
        </div>
      </div>

      {/* Lado Direito: Formulário com Transição Suave e Seleção de Perfis */}
      <div className="flex-1 bg-white flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-6">
          {/* Header do Formulário */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isRegister ? 'Criar Nova Conta' : 'Acesse sua Plataforma'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isRegister
                ? 'Cadastre-se para gerenciar seus imóveis e equipes com autonomia.'
                : 'Informe seu e-mail e senha para acessar o painel de controle.'}
            </p>
          </div>

          {/* Atalhos Rápidos para Avaliação (1-Clique) */}
          {!isRegister && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <p className="text-[11px] font-extrabold uppercase text-slate-500 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-brand-600" /> Preencher credenciais de teste:
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickCredentials('admin')}
                  className="text-xs font-bold py-1.5 px-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-brand-500 hover:text-brand-600 shadow-2xs transition-all"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => setQuickCredentials('owner')}
                  className="text-xs font-bold py-1.5 px-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-brand-500 hover:text-brand-600 shadow-2xs transition-all"
                >
                  🏠 Gestor
                </button>
                <button
                  type="button"
                  onClick={() => setQuickCredentials('employee')}
                  className="text-xs font-bold py-1.5 px-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:border-brand-500 hover:text-brand-600 shadow-2xs transition-all"
                >
                  🧹 Equipe
                </button>
              </div>
            </div>
          )}

          {/* Alerta de Erro */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-slide-down">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <Input
                  label="Nome Completo *"
                  type="text"
                  placeholder="Seu nome ou Razão Social"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5">
                      Perfil de Acesso
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="owner">Proprietário / Gestor</option>
                      <option value="employee">Funcionário / Equipe</option>
                    </select>
                  </div>
                  <div>
                    <Input
                      label="Telefone (WhatsApp)"
                      type="tel"
                      placeholder="(48) 99999-8888"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      leftIcon={<Phone className="w-4 h-4" />}
                    />
                  </div>
                </div>
              </>
            )}

            <Input
              label="E-mail *"
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Senha de Acesso *"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            {/* Consentimento LGPD */}
            {isRegister && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentTerms}
                    onChange={(e) => setConsentTerms(e.target.checked)}
                    className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <span className="text-[11px] text-slate-600 leading-tight">
                    Concordo com os <strong>Termos de Uso</strong> e autorizo o tratamento de dados pessoais conforme a <strong>Política de Privacidade (LGPD)</strong>.
                  </span>
                </label>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {isRegister ? 'Finalizar Cadastro' : 'Entrar na Plataforma'}
            </Button>
          </form>

          {/* Alternador Login / Cadastro */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMsg('');
              }}
              className="text-xs sm:text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              {isRegister
                ? 'Já possui uma conta cadastrada? Faça login'
                : 'Não possui conta? Cadastre-se gratuitamente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
