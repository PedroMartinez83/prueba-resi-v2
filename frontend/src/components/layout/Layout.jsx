// frontend/src/components/Layout/Layout.jsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AuroraChat from '../aurora/AuroraChat'; // <--- Importar
import { Menu } from 'lucide-react';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#009ee7] to-[#1d2228]">
      {/* Patrón de fondo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Contenido principal */}
      <div className="lg:ml-64 relative min-h-screen">
        {/* Header móvil */}
        <header className="lg:hidden bg-black/20 backdrop-blur-sm border-b border-white/10 sticky top-0 z-30">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={toggleSidebar}
              className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AM</span>
              </div>
              <span className="text-white font-semibold">Auto Manager</span>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Aquí se renderizan las páginas hijas */}
            <Outlet />
          </div>
        </main>
      </div>
      <AuroraChat />
    </div>
  );
};

export default Layout;