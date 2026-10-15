import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';

export const MainLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname: string) => {
    if (pathname.includes('/dashboard')) return 'Visão Geral & Indicadores';
    if (pathname.includes('/properties')) return 'Gestão de Imóveis';
    if (pathname.includes('/tasks')) return 'Tarefas & Operações';
    if (pathname.includes('/bookings')) return 'Calendário & Reservas';
    if (pathname.includes('/inventory')) return 'Controle de Suprimentos';
    if (pathname.includes('/finance')) return 'Módulo Financeiro';
    if (pathname.includes('/ai-assistant')) return 'Assistente de Inteligência Artificial';
    if (pathname.includes('/users')) return 'Gerenciamento de Usuários';
    if (pathname.includes('/settings')) return 'Configurações do Sistema';
    return 'Plataforma HospedaAI';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop e Drawer Mobile */}
      <Sidebar
        isOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0 pb-16 lg:pb-0">
        <Header
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          title={getPageTitle(location.pathname)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav />
      </div>
    </div>
  );
};
