import React, { useState } from 'react';
import { Outlet, Link, useNavigate, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, // (Cambiamos CarCrash por este)
  Wrench, 
  DollarSign, 
  LogOut, 
  Menu, 
  X 
} from 'lucide-react';
import logo from '../assets/logo.png'; // Asegúrate de tener un logo en esta ruta

const DriverLayout = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    if (window.confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/conductor/login');
    }
  };

  const navLinks = [
    { name: 'Dashboard', to: '/conductor/dashboard', icon: LayoutDashboard },
    { name: 'Registrar Siniestro', to: '/conductor/siniestros', icon: AlertTriangle },
    { name: 'Mantenimientos', to: '/conductor/mantenimientos', icon: Wrench },
    { name: 'Mis Pagos', to: '/conductor/pagos', icon: DollarSign },
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
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
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
    <div className="min-h-screen w-full flex bg-gradient-to-br from-[#009ee6] to-[#07425E] text-white">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl"></div>
      </div>
      
      {/* --- Barra Lateral (Sidebar) --- */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-20 w-64 p-4
          bg-black/20 backdrop-blur-xl border-r border-white/10
          flex-col justify-between
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:flex md:static
        `}
      >
        {/* Contenido del Sidebar */}
        <div>
          {/* Logo */}
          <div className="text-center mb-10 p-4">
            <img 
                        src={logo} 
                        alt="Auto Manager" 
                        className="h-12 w-auto center mx-auto mb-2"
                      />
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              AutoManager
            </h1>
            <p className="text-sm text-gray-400">Portal Conductor</p>
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
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:text-white hover:bg-red-500/20 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Cerrar Sesión</span>
        </button>
      </aside>

      {/* Overlay para móvil */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-10 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* --- Contenido Principal --- */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
        {/* Botón de Menú Móvil */}
        <button
          className="md:hidden p-2 mb-4 text-white bg-white/10 rounded-lg"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </button>
        
        {/* El "Outlet" renderizará el Dashboard, Siniestros, etc. */}
        <Outlet />
      </main>
    </div>
  );
};

export default DriverLayout;