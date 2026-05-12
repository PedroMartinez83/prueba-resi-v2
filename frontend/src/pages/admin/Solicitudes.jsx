import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import solicitudesService from '../../services/solicitudesService';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  FileText,
  TrendingUp,
  Activity,
  Search,
  Filter,
  Eye,
  UserCheck,
  Calendar,
  Phone,
  Mail
} from 'lucide-react';

const SolicitudesConductores = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
    enPrueba: 0,
    migradas: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    estatus: '',
    busqueda: '',
    fechaDesde: '',
    fechaHasta: ''
  });
  const canViewCitas = ['super_admin', 'direccion', 'director', 'gerente_ops', 'finanzas', 'coordinador']
    .includes(user?.rol || user?.role);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar solicitudes y estadísticas en paralelo
      const [solicitudesResponse, statsResponse] = await Promise.all([
        solicitudesService.getSolicitudes(filtros),
        solicitudesService.getEstadisticasSolicitudes()
      ]);
      
      console.log('📊 Solicitudes:', solicitudesResponse);
      console.log('📈 Estadísticas:', statsResponse);
      
      setSolicitudes(solicitudesResponse.solicitudes || []);
      setEstadisticas(statsResponse.estadisticas || statsResponse);
    } catch (err) {
      console.error('❌ Error al cargar datos:', err);
      setError(err.message || 'Error al cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = async () => {
    await cargarDatos();
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Pendiente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Aprobado': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Aprobado (a prueba)': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Rechazado': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Migrado': 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return styles[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const formatFecha = (fecha) => {
    if (!fecha) return 'N/A';
    try {
      return new Date(fecha).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const handleVerDetalle = (id) => {
    navigate(`/admin/solicitudes/${id}`);
  };

  if (loading && solicitudes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-cyan-500 mb-4"></div>
          <p className="text-gray-400">Cargando solicitudes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#07425E] p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Solicitudes de Conductores
          </h1>
          <p className="text-gray-400">
            Gestiona las aplicaciones de nuevos conductores
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canViewCitas && (
            <button
              onClick={() => navigate('/admin/solicitudes/citas')}
              className="px-4 py-2 bg-white/10 text-gray-200 rounded-lg hover:bg-white/20 transition-colors text-sm font-medium"
            >
              Ver agenda de citas
            </button>
          )}
          <div className="text-right">
            <p className="text-sm text-gray-400">Última actualización</p>
            <p className="text-white font-medium text-sm">
              {new Date().toLocaleString('es-MX', { 
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="p-3 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
            title="Actualizar datos"
          >
            <Activity className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 font-medium">Error al cargar datos</p>
            <p className="text-red-300/80 text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={cargarDatos}
            className="text-red-400 hover:text-red-300 text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Solicitudes</p>
                <p className="text-3xl font-bold text-white">{estadisticas.total || 0}</p>
                <p className="text-cyan-400 text-xs mt-1">↑ {estadisticas.pendientes} pendientes</p>
              </div>
              <div className="p-3 bg-cyan-500/20 rounded-lg">
                <FileText className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Pendientes */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-yellow-500/30 transition-all cursor-pointer"
             onClick={() => setFiltros(prev => ({ ...prev, estatus: 'Pendiente' }))}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Pendientes</p>
                <p className="text-3xl font-bold text-white">{estadisticas.pendientes || 0}</p>
                <p className="text-yellow-400 text-xs mt-1">⚠ Requieren atención</p>
              </div>
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Aprobadas */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-green-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Aprobadas</p>
                <p className="text-3xl font-bold text-white">
                  {(estadisticas.aprobadas || 0) + (estadisticas.enPrueba || 0)}
                </p>
                <p className="text-green-400 text-xs mt-1">✓ {estadisticas.migradas || 0} ya migradas</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Tasa de Aprobación */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm mb-1">Tasa de Aprobación</p>
                <p className="text-3xl font-bold text-white">
                  {estadisticas.total > 0 
                    ? Math.round(((estadisticas.aprobadas + estadisticas.enPrueba) / estadisticas.total) * 100) 
                    : 0}%
                </p>
                <p className="text-blue-400 text-xs mt-1">↗ Del total</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Filtros de Búsqueda</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Buscar por nombre o teléfono
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={filtros.busqueda}
                onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Juan Pérez o 3111234567"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Estado
            </label>
            <select
              value={filtros.estatus}
              onChange={(e) => setFiltros(prev => ({ ...prev, estatus: e.target.value }))}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="" className="bg-gray-800">Todos los estados</option>
              <option value="Pendiente" className="bg-gray-800">Pendiente</option>
              <option value="Aprobado" className="bg-gray-800">Aprobado</option>
              <option value="Aprobado (a prueba)" className="bg-gray-800">Aprobado (a prueba)</option>
              <option value="Rechazado" className="bg-gray-800">Rechazado</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Fecha desde
            </label>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros(prev => ({ ...prev, fechaDesde: e.target.value }))}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={aplicarFiltros}
              disabled={loading}
              className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Filtrando...' : 'Aplicar Filtros'}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Solicitudes */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <Users className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">
            Solicitudes Recientes ({solicitudes.length})
          </h3>
        </div>
        
        <div className="p-6">
          {solicitudes.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No hay solicitudes que mostrar</p>
              <p className="text-gray-500 text-sm mt-2">
                {filtros.estatus || filtros.busqueda 
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Las nuevas solicitudes aparecerán aquí automáticamente'}
              </p>
            </div>
          ) : (
            <>
              {/*  1. Scroll vertical/horizontal, altura máxima y borde suave  */}
              <div className="overflow-auto max-h-[60vh] sidebar-scroll rounded-lg border border-white/5">
              
              {/*  2. Tabla con relative y min-w para que no se apachurre  */}
              <table className="w-full min-w-[900px] relative">
                
                {/*  3. Encabezado pegajoso con fondo sólido para tapar el scroll  */}
                <thead className="bg-[#1a1a2e] sticky top-0 z-10 shadow-sm">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">FECHA</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">CANDIDATO</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">CONTACTO</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">ESTADO</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">EXPERIENCIA</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((solicitud) => (
                    <tr 
                      key={solicitud.id} 
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-300 text-sm">
                            {formatFecha(solicitud.fecha_solicitud)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-white font-medium">{solicitud.nombre_completo}</p>
                          <p className="text-gray-400 text-sm">ID: #{solicitud.id}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{solicitud.telefono}</span>
                          </div>
                          {solicitud.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-400 text-xs truncate max-w-[200px]">
                                {solicitud.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusBadge(solicitud.estatus_solicitud)}`}>
                          {solicitud.estatus_solicitud}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {solicitud.experiencia_taxi ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-green-400 text-sm">Con experiencia</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-400 text-sm">Sin experiencia</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleVerDetalle(solicitud.id)}
                            className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          {(solicitud.estatus_solicitud === 'Aprobado' && !solicitud.conductor_id) && (
                            <button
                              onClick={() => handleVerDetalle(solicitud.id)}
                              className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                              title="Migrar a conductor"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SolicitudesConductores;
