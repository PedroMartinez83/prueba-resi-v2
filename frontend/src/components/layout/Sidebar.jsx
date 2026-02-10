// frontend/src/components/Layout/Sidebar.jsx
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Car,
  Users,
  FileText,
  Wrench,
  AlertTriangle,
  DollarSign,
  LogOut,
  X,
  User,
  UserPlus,
  TrendingUp,
  Shield
} from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Menú para admin y roles administrativos
  const adminMenuItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin', 'director', 'finanzas', 'gerente_ops', 'gestor_flota', 'admin'] },
    { path: '/admin/rentas', icon: FileText, label: 'Rentas', roles: ['super_admin', 'director', 'finanzas', 'gerente_ops', 'secretaria', 'admin'] },
    { path: '/admin/vehiculos', icon: Car, label: 'Vehículos', roles: ['super_admin', 'director', 'finanzas', 'gerente_ops', 'gestor_flota', 'admin'] },
    { path: '/admin/conductores', icon: Users, label: 'Conductores', roles: ['super_admin', 'director', 'finanzas', 'gerente_ops', 'gestor_flota', 'admin'] },
    { path: '/admin/solicitudes', icon: UserPlus, label: 'Solicitudes', roles: ['super_admin', 'director', 'finanzas', 'gerente_ops', 'reclutador', 'secretaria', 'admin'] },
    { path: '/admin/usuarios', icon: Shield, label: 'Usuarios', roles: ['super_admin', 'director'] }, // 🆕 MÓDULO DE USUARIOS
    { path: '/admin/inversionistas-home', icon: TrendingUp, label: 'Inversionistas', roles: ['super_admin', 'director', 'finanzas', 'gerente_ops', 'admin'] },
    { path: '/admin/mantenimientos', icon: Wrench, label: 'Mantenimientos', roles: ['super_admin', 'director', 'finanzas', 'gerente_ops', 'gestor_flota', 'jefe_taller', 'compras', 'admin'] },
    { path: '/admin/siniestros', icon: AlertTriangle, label: 'Siniestros', roles: ['super_admin', 'director', 'finanzas', 'gerente_ops', 'admin'] },
  ];

  // Menú para conductor
  const conductorMenuItems = [
    { path: '/conductor/dashboard', icon: LayoutDashboard, label: 'Mi Dashboard' },
    { path: '/conductor/vehiculo', icon: Car, label: 'Mi Vehículo' },
    { path: '/conductor/rentas', icon: FileText, label: 'Mis Rentas' },
   { path: '/conductor/pagos', icon: DollarSign, label: 'Mis Pagos' },
  ];

  // Determinar qué menú mostrar según el rol
  const userRole = user?.rol || user?.role;
  const adminRoles = ['admin', 'super_admin', 'director', 'gerente_ops', 'finanzas', 'gestor_flota', 'secretaria', 'reclutador', 'jefe_taller', 'compras'];
  
  // Filtrar items del menú según roles permitidos
  const menuItems = adminRoles.includes(userRole) 
    ? adminMenuItems.filter(item => {
        // Si el item tiene roles especificados, verificar que el usuario tenga uno de esos roles
        if (item.roles && item.roles.length > 0) {
          return item.roles.includes(userRole);
        }
        // Si no tiene roles especificados, mostrar a todos los admin
        return true;
      })
    : conductorMenuItems;

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-[18rem] sm:w-72 lg:w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full bg-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col">
          {/* Header del Sidebar */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">AM</span>
              </div>
              <h2 className="text-white font-semibold text-lg">Auto Manager</h2>
            </div>
            <button
              onClick={toggleSidebar}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Información del usuario */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                <User size={20} className="text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.nombre || user?.email || 'Usuario'}</p>
                <p className="text-gray-400 text-xs capitalize truncate">{userRole || 'Rol'}</p>
              </div>
            </div>
          </div>

          {/* Menú de navegación */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto sidebar-scroll max-h-[calc(100vh-240px)] sm:max-h-[calc(100vh-260px)]">
            <ul className="space-y-2 pr-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`
                      }
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          toggleSidebar();
                        }
                      }}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Botón de cerrar sesión */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
            >
              <LogOut size={20} />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
