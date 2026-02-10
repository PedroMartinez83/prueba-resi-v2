// frontend/src/pages/admin/Usuarios.jsx
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Eye,
  Edit,
  Trash2,
  Key,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Mail,
  UserCheck,
  UserX,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import adminService from '../../services/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import UsuarioModal from '../../components/admin/UsuarioModal';

// Configuración de colores por rol
const ROL_COLORS = {
  super_admin: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400',
  director: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
  gerente_ops: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30 text-cyan-400',
  finanzas: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
  reclutador: 'from-indigo-500/20 to-indigo-600/20 border-indigo-500/30 text-indigo-400',
  jefe_taller: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400',
  secretaria: 'from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400',
  gestor_flota: 'from-teal-500/20 to-teal-600/20 border-teal-500/30 text-teal-400',
  compras: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-400',
  conductor: 'from-gray-500/20 to-gray-600/20 border-gray-500/30 text-gray-400'
};

const DEFAULT_ROLE_STYLE = 'from-gray-500/20 to-gray-600/20 border-gray-500/30 text-gray-300';

// Configuración de estados
const ESTADO_CONFIG = {
  'Activo': {
    color: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
    icon: ShieldCheck,
    label: 'Activo'
  },
  'suspendido': {
    color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-400',
    icon: ShieldAlert,
    label: 'Suspendido'
  },
  'prohibido': {
    color: 'from-red-500/20 to-rose-500/20 border-red-500/30 text-red-400',
    icon: ShieldAlert,
    label: 'Prohibido'
  },
  'verificacion_pendiente': {
    color: 'from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-400',
    icon: Clock,
    label: 'Verificación Pendiente'
  }
};

// Nombres amigables de roles
const ROL_NAMES = {
  super_admin: 'Super Admin',
  director: 'Director',
  gerente_ops: 'Gerente Operaciones',
  finanzas: 'Finanzas',
  reclutador: 'Reclutador',
  jefe_taller: 'Jefe de Taller',
  secretaria: 'Secretaria',
  gestor_flota: 'Gestor de Flota',
  compras: 'Compras',
  conductor: 'Conductor'
};

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [usuarioEdit, setUsuarioEdit] = useState(null);
  const [passwordModal, setPasswordModal] = useState(null);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  
  // Filtros
  const [filtros, setFiltros] = useState({
    search: '',
    rol: '',
    estado: ''
  });

  // Paginación
  const [paginacion, setPaginacion] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Usuario actual
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = currentUser.rol === 'super_admin';
  const isDirector = currentUser.rol === 'director';

  useEffect(() => {
    cargarUsuarios();
  }, [paginacion.page, filtros]);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await adminService.getUsuarios({
        page: paginacion.page,
        limit: paginacion.limit,
        ...filtros
      });
      
      setUsuarios(response.usuarios || []);
      setPaginacion(prev => ({
        ...prev,
        total: response.total || 0,
        totalPages: response.totalPages || 1
      }));
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      alert('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const refrescarDatos = async () => {
    setRefreshing(true);
    await cargarUsuarios();
    setRefreshing(false);
  };

  const handleCrearUsuario = () => {
    setUsuarioEdit(null);
    setShowModal(true);
  };

  const handleEditarUsuario = (usuario) => {
    setUsuarioEdit(usuario);
    setShowModal(true);
  };

  const handleGuardarUsuario = async (usuarioData) => {
    try {
      if (usuarioEdit) {
        await adminService.updateUsuario(usuarioEdit.id, usuarioData);
        alert('Usuario actualizado exitosamente');
      } else {
        const response = await adminService.createUsuario(usuarioData);
        
        // Mostrar contraseña temporal
        if (response.password_temporal) {
          setPasswordModal({
            email: response.usuario.email,
            password: response.password_temporal
          });
        }
        alert('Usuario creado exitosamente');
      }
      
      await cargarUsuarios();
      setShowModal(false);
      setUsuarioEdit(null);
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      alert(error.message || 'Error al guardar usuario');
    }
  };

  const handleResetearPassword = async (usuario) => {
    if (!confirm(`¿Resetear contraseña de ${usuario.email}?`)) return;
    
    try {
      const response = await adminService.resetearPasswordUsuario(usuario.id);
      setPasswordModal({
        email: usuario.email,
        password: response.password_temporal
      });
      alert('Contraseña reseteada exitosamente');
    } catch (error) {
      console.error('Error al resetear contraseña:', error);
      alert(error.message || 'Error al resetear contraseña');
    }
  };

  const handleCambiarEstado = async (usuario, nuevoEstado) => {
    const mensajes = {
      'Activo': '¿Activar este usuario?',
      'suspendido': '¿Suspender este usuario? No podrá acceder al sistema.',
      'prohibido': '¿Prohibir este usuario? Esta acción es más restrictiva.'
    };
    
    if (!confirm(mensajes[nuevoEstado])) return;
    
    try {
      await adminService.cambiarEstadoUsuario(usuario.id, nuevoEstado);
      alert('Estado cambiado exitosamente');
      await cargarUsuarios();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert(error.message || 'Error al cambiar estado');
    }
  };

  const handleEliminarUsuario = async (usuario) => {
    if (!confirm(`¿Deshabilitar usuario ${usuario.email}?\n\nSe cambiará su estado a "prohibido" (recomendado).`)) return;
    
    try {
      await adminService.deleteUsuario(usuario.id, false); // false = soft delete
      alert('Usuario deshabilitado exitosamente');
      await cargarUsuarios();
    } catch (error) {
      console.error('Error al deshabilitar usuario:', error);
      alert(error.message || 'Error al deshabilitar usuario');
    }
  };

  //  FUNCIONES PARA EJECUTAR LA BÚSQUEDA
  const realizarBusqueda = () => {
    setFiltros(prev => ({
      ...prev,
      search: textoBusqueda // Pasamos el texto temporal al filtro real
    }));
    setPaginacion(prev => ({ ...prev, page: 1 })); // Regresamos a la página 1
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      realizarBusqueda();
    }
  };

  const limpiarFiltros = () => {
    setTextoBusqueda('');
    setFiltros({
      search: '',
      rol: '',
      estado: ''
    });
    setPaginacion(prev => ({ ...prev, page: 1 }));
  };

  if (loading && usuarios.length === 0) {
    return <LoadingSpinner size="large" message="Cargando usuarios..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Users className="w-8 h-8 text-cyan-400" />
              Gestión de Usuarios
            </h1>
            <p className="text-gray-400">
              {usuarios.length} de {paginacion.total} usuarios
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={refrescarDatos}
              disabled={refreshing}
              className={`p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-5 h-5 text-gray-400" />
            </button>
            
            {isSuperAdmin && (
              <button
                onClick={handleCrearUsuario}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Crear Usuario
              </button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* BARRA DE BÚSQUEDA MANUAL */}
            <div className="md:col-span-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por email o nombre..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                  
                  // 1. Usamos el estado temporal
                  value={textoBusqueda}
                  onChange={(e) => setTextoBusqueda(e.target.value)}
                  
                  // 2. Detectamos el Enter
                  onKeyDown={handleKeyDown}
                />
              </div>

              {/* 3. Botón de Buscar */}
              <button
                onClick={realizarBusqueda}
                className="px-4 py-2.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-all flex items-center gap-2 font-medium"
              >
                <Search className="w-5 h-5" />
                <span className="hidden xl:inline">Buscar</span>
              </button>
            </div>
            
            {/* Filtro por Rol */}
            <select
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
              value={filtros.rol}
              onChange={(e) => setFiltros({...filtros, rol: e.target.value})}
            >
              <option value="">Todos los roles</option>
              {Object.entries(ROL_NAMES).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
            
            {/* Filtro por Estado */}
            <select
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
              value={filtros.estado}
              onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
            >
              <option value="">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="suspendido">Suspendido</option>
              <option value="prohibido">Prohibido</option>
            </select>
          </div>
          
          {(filtros.search || filtros.rol || filtros.estado) && (
            <button
              onClick={limpiarFiltros}
              className="mt-4 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Tabla de Usuarios */}
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Email</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Nombre</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Rol</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Estado</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-400">Última Conexión</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-gray-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => {
                  const estadoInfo = ESTADO_CONFIG[usuario.estado_cuenta] || ESTADO_CONFIG['Activo'];
                  const EstadoIcon = estadoInfo.icon;
                  const esMiUsuario = usuario.id === currentUser.id;
                  
                  return (
                    <tr 
                      key={usuario.id} 
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      {/* Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <span className="text-white">{usuario.email}</span>
                          {esMiUsuario && (
                            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">Tú</span>
                          )}
                        </div>
                      </td>
                      
                      {/* Nombre */}
                      <td className="px-6 py-4 text-gray-300">{usuario.nombre_completo || '-'}</td>
                      
                      {/* Rol */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${ROL_COLORS[usuario.rol] || DEFAULT_ROLE_STYLE} backdrop-blur-sm border text-xs font-medium`}>
                          <Shield className="w-3.5 h-3.5" />
                          {ROL_NAMES[usuario.rol] || usuario.rol}
                        </span>
                      </td>
                      
                      {/* Estado */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${estadoInfo.color} backdrop-blur-sm border text-xs font-medium`}>
                          <EstadoIcon className="w-3.5 h-3.5" />
                          {estadoInfo.label}
                        </span>
                      </td>
                      
                      {/* Última Conexión */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Clock className="w-4 h-4" />
                          {usuario.ultima_conexion 
                            ? new Date(usuario.ultima_conexion).toLocaleDateString('es-MX', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Nunca'}
                        </div>
                      </td>
                      
                      {/* Acciones */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Editar (Super Admin o Director) */}
                          {(isSuperAdmin || isDirector) && !esMiUsuario && (
                            <button
                              onClick={() => handleEditarUsuario(usuario)}
                              className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                              title="Editar usuario"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Resetear Password (Super Admin o Director) */}
                          {(isSuperAdmin || isDirector) && !esMiUsuario && (
                            <button
                              onClick={() => handleResetearPassword(usuario)}
                              className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                              title="Resetear contraseña"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          )}
                          
                          {/* Cambiar Estado */}
                          {!esMiUsuario && usuario.rol !== 'super_admin' && (
                            <>
                              {usuario.estado_cuenta !== 'Activo' && (
                                <button
                                  onClick={() => handleCambiarEstado(usuario, 'Activo')}
                                  className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                  title="Activar usuario"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                              )}
                              {usuario.estado_cuenta === 'Activo' && (
                                <button
                                  onClick={() => handleCambiarEstado(usuario, 'suspendido')}
                                  className="p-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors"
                                  title="Suspender usuario"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                          
                          {/* Eliminar (Solo Super Admin) */}
                          {isSuperAdmin && !esMiUsuario && usuario.rol !== 'super_admin' && (
                            <button
                              onClick={() => handleEliminarUsuario(usuario)}
                              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                              title="Deshabilitar usuario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Sin resultados */}
          {usuarios.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No se encontraron usuarios</p>
            </div>
          )}
        </div>

        {/* Paginación */}
        {paginacion.totalPages > 1 && (
          <div className="flex items-center justify-between bg-black/40 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
            <p className="text-sm text-gray-400">
              Mostrando {((paginacion.page - 1) * paginacion.limit) + 1} - {Math.min(paginacion.page * paginacion.limit, paginacion.total)} de {paginacion.total}
            </p>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaginacion(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={paginacion.page === 1}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              
              <span className="text-white px-4">
                Página {paginacion.page} de {paginacion.totalPages}
              </span>
              
              <button
                onClick={() => setPaginacion(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={paginacion.page >= paginacion.totalPages}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Usuario */}
      {showModal && (
        <UsuarioModal
          usuario={usuarioEdit}
          onClose={() => {
            setShowModal(false);
            setUsuarioEdit(null);
          }}
          onGuardar={handleGuardarUsuario}
        />
      )}

      {/* Modal de Contraseña Temporal */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-cyan-500/30 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Key className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Contraseña Temporal Generada</h3>
              <p className="text-gray-400 text-sm">Comparte esta contraseña con el usuario</p>
            </div>
            
            <div className="bg-black/40 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-400 mb-2">Email:</p>
              <p className="text-white font-mono">{passwordModal.email}</p>
              
              <p className="text-sm text-gray-400 mb-2 mt-4">Contraseña temporal:</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl text-cyan-400 font-mono flex-1">{passwordModal.password}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(passwordModal.password);
                    alert('Contraseña copiada al portapapeles');
                  }}
                  className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                  title="Copiar contraseña"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6">
              <p className="text-xs text-yellow-400">
                ⚠️ El usuario deberá cambiar esta contraseña en su próximo inicio de sesión
              </p>
            </div>
            
            <button
              onClick={() => setPasswordModal(null)}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all font-medium"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;
