import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  CheckSquare,
  PackageOpen,
  DollarSign,
  Bot,
  Users,
  Settings,
  LogOut,
  Sparkles,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onCloseMobile }) => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  // Itens de navegação adaptados dinamicamente para o papel do usuário
  const getNavItems = () => {
    if (role === 'employee') {
      return [
        { label: 'Minhas Tarefas', path: '/tasks', icon: CheckSquare, badge: 'Hoje' },
        { label: 'Imóveis Vinculados', path: '/properties', icon: Building2 },
        { label: 'Controle de Estoque', path: '/inventory', icon: PackageOpen },
        { label: 'Configurações', path: '/settings', icon: Settings },
      ];
    }

    if (role === 'admin') {
      return [
        { label: 'Painel Macro', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Todos os Imóveis', path: '/properties', icon: Building2 },
        { label: 'Reservas Globais', path: '/bookings', icon: CalendarDays },
        { label: 'Operações & Equipe', path: '/tasks', icon: CheckSquare },
        { label: 'Controle de Estoque', path: '/inventory', icon: PackageOpen },
        { label: 'Financeiro', path: '/finance', icon: DollarSign },
        { label: 'Assistente IA', path: '/ai-assistant', icon: Bot, badge: 'IA' },
        { label: 'Gestão de Usuários', path: '/users', icon: Users, badge: 'Admin' },
        { label: 'Configurações', path: '/settings', icon: Settings },
      ];
    }

    // Padrão: Proprietário / Gestor
    return [
      { label: 'Visão Geral', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Meus Imóveis', path: '/properties', icon: Building2 },
      { label: 'Calendário & Reservas', path: '/bookings', icon: CalendarDays },
      { label: 'Tarefas & Checklists', path: '/tasks', icon: CheckSquare },
      { label: 'Controle de Estoque', path: '/inventory', icon: PackageOpen },
      { label: 'Financeiro', path: '/finance', icon: DollarSign },
      { label: 'Minha Equipe', path: '/users', icon: Users },
      { label: 'Assistente IA', path: '/ai-assistant', icon: Bot, badge: 'IA' },
      { label: 'Configurações', path: '/settings', icon: Settings },
    ];
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Backdrop para mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 w-72 bg-white/95 backdrop-blur-xl border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-18 flex items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/25">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                Hospeda<span className="text-brand-600">AI</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-brand-100 text-brand-700">
                  PRO
                </span>
              </span>
              <p className="text-[11px] text-slate-400 font-medium">Temporada Inteligente</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Navegação Principal
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-brand-50 to-indigo-50/50 text-brand-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          'w-4.5 h-4.5 transition-colors',
                          isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'
                        )}
                      />
                      <span>{item.label}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.badge && (
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full',
                            item.badge === 'Novo'
                              ? 'bg-amber-100 text-amber-700 animate-pulse'
                              : 'bg-brand-100 text-brand-700'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shadow-glow" />
                      )}
                    </div>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 truncate">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
              title="Sair da plataforma"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
