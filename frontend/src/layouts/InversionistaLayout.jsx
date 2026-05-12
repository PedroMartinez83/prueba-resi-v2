// frontend/src/components/inversionista/layout/InversionistaLayout.jsx
import React, { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase,     // Para los contratos
  TrendingUp,    // Para los rendimientos/pagos
  LogOut, 
  Menu, 
  X,
  User
} from 'lucide-react';
import logo from '../assets/logo.png'; // Ajusta la ruta a tu logo según dónde guardes este archivo

const InversionistaLayout = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/inversionista/login'); // Redirige al login correcto
    }
  };

  // Rutas exclusivas para el Inversionista
  const navLinks = [
    { name: 'Dashboard', to: '/inversionista/dashboard', icon: LayoutDashboard },
    { name: 'Mis Contratos', to: '/inversionista/contratos', icon: Briefcase },
    { name: 'Mis Pagos', to: '/inversionista/pagos', icon: TrendingUp },
    { name: 'Mi Perfil', to: '/inversionista/perfil', icon: User },
  ];

  const NavItem = ({ link }) => {
    const Icon = link.icon;
    return (
      <NavLink
        to={link.to}
        end // Asegura que 'Dashboard' no esté activo en otras rutas
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
            isActive
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`
        }
        onClick={() => setIsSidebarOpen(false)} // Cierra el menú en móvil
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium">{link.name}</span>
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-950 text-white overflow-hidden relative">
      
      {/* Fondo animado estilo Inversionista (Tonos Esmeralda/Teal) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[#06302b] via-slate-950 to-slate-900" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      {/* --- Barra Lateral (Sidebar) --- */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-40 w-64 p-4
          bg-white/5 backdrop-blur-xl border-r border-white/10
          flex-col justify-between
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:flex md:static
        `}
      >
        {/* Botón cerrar en móvil */}
        <button 
          className="md:hidden absolute top-4 right-4 text-gray-400 hover:text-white"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X className="w-6 h-6" />
        </button>

        {/* Contenido del Sidebar */}
        <div className="mt-8 md:mt-0">
          {/* Logo */}
          <div className="text-center mb-10 p-4">
            <img 
              src={logo} 
              alt="Auto Manager" 
              className="h-12 w-auto mx-auto mb-3"
            />
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">
              AutoManager Capital
            </h1>
            <p className="text-sm text-emerald-400/80 font-medium tracking-wide">Portal Inversionistas</p>
          </div>
          
          {/* Navegación */}
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <NavItem key={link.name} link={link} />
            ))}
          </nav>
        </div>
        
        {/* Botón de Salir */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 mt-8 rounded-lg text-red-400 hover:text-white hover:bg-red-500/20 border border-transparent hover:border-red-500/30 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </aside>

      {/* Overlay para móvil */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* --- Contenido Principal --- */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative z-10">
        
        {/* Header Móvil */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white/5 backdrop-blur-md border-b border-white/10 sticky top-0 z-20">
          
          {/* 1. Botón del menú ahora va primero (Aparecerá a la izquierda) */}
          <button
            className="p-2 text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* 2. Logo y texto ahora van después (Aparecerán a la derecha) */}
          <div className="flex items-center gap-3">
            <span className="font-bold text-emerald-400">AutoManager</span>
            <img src={logo} alt="Logo" className="h-8 w-auto" />
          </div>

        </div>
        
        {/* El "Outlet" renderizará el contenido de la ruta actual */}
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default InversionistaLayout;