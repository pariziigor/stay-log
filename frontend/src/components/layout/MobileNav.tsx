import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, CalendarDays, CheckSquare, Bot } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

export const MobileNav: React.FC = () => {
  const { role } = useAuth();

  const getMobileNav = () => {
    if (role === 'employee') {
      return [
        { label: 'Tarefas', path: '/tasks', icon: CheckSquare },
        { label: 'Imóveis', path: '/properties', icon: Building2 },
      ];
    }
    return [
      { label: 'Início', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Imóveis', path: '/properties', icon: Building2 },
      { label: 'Agenda', path: '/bookings', icon: CalendarDays },
      { label: 'Tarefas', path: '/tasks', icon: CheckSquare },
      { label: 'IA', path: '/ai-assistant', icon: Bot },
    ];
  };

  const navItems = getMobileNav();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-slate-200/80 px-2 py-1 shadow-lg">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-200',
                  isActive ? 'text-brand-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-5 h-5 mb-0.5', isActive && 'stroke-[2.5px] scale-110')} />
                  <span className="text-[10px]">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
