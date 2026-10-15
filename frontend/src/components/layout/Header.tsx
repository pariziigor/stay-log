import React from 'react';
import { Menu, Bell, Shield, Sparkles, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileSidebar, title = 'Painel de Controle' }) => {
  const { user, role } = useAuth();

  const getRoleBadge = () => {
    switch (role) {
      case 'admin':
        return (
          <Badge variant="violet" dot size="md">
            Administrador Geral
          </Badge>
        );
      case 'owner':
        return (
          <Badge variant="brand" dot size="md">
            Proprietário / Gestor
          </Badge>
        );
      case 'employee':
        return (
          <Badge variant="emerald" dot size="md">
            Operacional / Equipe
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-30 h-18 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between">
      {/* Left: Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs text-slate-400 font-medium hidden sm:block">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Right: Role indicator & Actions */}
      <div className="flex items-center gap-3">
        {/* Role Pill */}
        <div className="hidden sm:flex items-center">{getRoleBadge()}</div>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        {/* User Mini Avatar */}
        <div className="flex items-center gap-2 pl-2 sm:border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center border border-brand-200">
            {user?.full_name?.charAt(0).toUpperCase() || <UserIcon className="w-4 h-4" />}
          </div>
          <span className="text-xs font-bold text-slate-800 hidden md:inline-block max-w-[120px] truncate">
            {user?.full_name?.split(' ')[0]}
          </span>
        </div>
      </div>
    </header>
  );
};
