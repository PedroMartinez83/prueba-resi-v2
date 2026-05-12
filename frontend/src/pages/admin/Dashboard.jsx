// frontend/src/pages/admin/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import adminService from '../../services/adminService';
import solicitudesService from '../../services/solicitudesService';
import Card, { StatCard } from '../../components/common/Card';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import logo from '../../assets/logo.png';
import { 
  Car, 
  Users, 
  FileText, 
  DollarSign,
  AlertTriangle,
  Wrench,
  TrendingUp,
  Activity,
  CheckCircle,
  Clock,
  XCircle,
  UserPlus
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [estadisticas, setEstadisticas] = useState({
    totalVehiculos: 0,
    vehiculosDisponibles: 0,
    vehiculosRentados: 0,
    vehiculosMantenimiento: 0,
    totalConductores: 0,
    conductoresActivos: 0,
    totalRentas: 0,
    rentasPendientes: 0,
    rentasPagadas: 0,
    rentasVencidas: 0
  });
  
  const initialSolicitudesStats = {
    total: 0,
    pendientes: 0,
    aprobadas: 0,
    rechazadas: 0,
    enPrueba: 0,
    migradas: 0
  };

  const [solicitudesStats, setSolicitudesStats] = useState(initialSolicitudesStats);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      
      // Cargar estadísticas principales y de solicitudes en paralelo
      const [data, solicitudesData] = await Promise.all([
        adminService.getDashboardStats(),
        solicitudesService.getEstadisticasSolicitudes()
      ]);
      
      setEstadisticas(data);
      // Asegurar que las estadísticas de solicitudes siempre tengan valores numéricos
      const solicitudesSource = solicitudesData?.estadisticas || solicitudesData || {};
      const sanitizedSolicitudes = Object.keys(initialSolicitudesStats).reduce((acc, key) => {
        const value = solicitudesSource?.[key];
        acc[key] = typeof value === 'number' ? value : initialSolicitudesStats[key];
        return acc;
      }, {});

      setSolicitudesStats(sanitizedSolicitudes);
      setError(null);
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
      setError('Error al cargar las estadísticas. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="large" message="Cargando estadísticas del sistema..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-white mb-4">{error}</p>
            <button
              onClick={cargarEstadisticas}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
            >
              Reconectar
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // Estructura estándar de datos con fallbacks
  const stats = estadisticas || {
    vehiculos: {
      total: 0,
      disponibles: 0, 
      rentados: 0, 
      enMantenimiento: 0,
      enSiniestro: 0,
      baja: 0
    },
    conductores: { 
      total: 0, 
      aprobados: 0,
      activos: 0, 
      pendientes: 0,
      rechazados: 0,
      inactivos: 0
    },
    rentas: { 
      total: 0, 
      pendientes: 0, 
      pagadas: 0, 
      vencidas: 0, 
      enTolerancia: 0,
      montoTotalPagado: 0,
      montoTotalPendiente: 0
    },
    mantenimientos: { 
      total: 0, 
      programados: 0, 
      completados: 0, 
      enProceso: 0,
      cancelados: 0
    },
    siniestros: { 
      total: 0, 
      reportados: 0,
      enProceso: 0,
      enTaller: 0,
      resueltos: 0, 
      cerrados: 0
    }
  };



  const solicitudes = solicitudesStats || initialSolicitudesStats;

  return (
    <div className="space-y-6">
      {/* Header con logo */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <img 
            src={logo} 
            alt="Auto Manager" 
            className="h-12 w-auto"
          />
          <div>
            <h1 className="text-3xl font-bold text-white">
              Dashboard Administrativo
            </h1>
            <p className="text-gray-400">
              Bienvenido, {user?.nombre || 'Administrador'}
            </p>
          </div>

        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-gray-400">Última actualización</p>
            <p className="text-white font-medium">
              {new Date().toLocaleString('es-MX', { 
                dateStyle: 'short', 
                timeStyle: 'short' 
              })}
            </p>
          </div>
          <button
            onClick={cargarEstadisticas}
            className="p-3 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
            title="Actualizar datos"
          >
            <Activity className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tarjetas principales con solicitudes incluidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        <div
          onClick={() => navigate('/admin/vehiculos')}
          className="cursor-pointer transform hover:scale-105 transition-all h-full"
        >
          <StatCard
            title="Vehículos Totales"
            value={stats.vehiculos.total}
            icon={Car}
            color="primary"
            trend={stats.vehiculos.disponibles > 0 ? "up" : "down"}
            trendValue={`${stats.vehiculos.disponibles} disponibles`}
            className="h-full"
          />
        </div>

        <div
          onClick={() => navigate('/admin/conductores')}
          className="cursor-pointer transform hover:scale-105 transition-all h-full"
        >
          <StatCard
            title="Conductores Activos"
            value={stats.conductores.activos}
            icon={Users}
            color="success"
            trend={stats.conductores.pendientes > 0 ? "up" : "neutral"}
            trendValue={`${stats.conductores.pendientes} pendientes`}
            className="h-full"
          />
        </div>

        <div
          onClick={() => navigate('/admin/solicitudes')}
          className="cursor-pointer transform hover:scale-105 transition-all h-full"
        >
          <StatCard
            title="Solicitudes Pendientes"
            value={solicitudes.pendientes}
            icon={UserPlus}
            color="warning"
            trend={solicitudes.pendientes > 0 ? "up" : "neutral"}
            trendValue={`${solicitudes.total} total`}
            className="h-full"
          />
        </div>

        <div className="cursor-pointer transform hover:scale-105 transition-all h-full">
          <StatCard
            title="Ingresos del Mes"
            value={`$${(stats.rentas.ingresosMes || 0).toLocaleString('es-MX')}`}
            icon={DollarSign}
            color="info"
            trend="up"
            trendValue={`$${(stats.rentas.montoTotalPendiente || 0).toLocaleString('es-MX')} pendiente`}
            className="h-full"
          />
        </div>
      </div>

      {/* Sección de detalles con solicitudes incluidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Estado de Vehículos */}
        <div
          onClick={() => navigate('/admin/vehiculos')}
          className="cursor-pointer transform hover:scale-105 transition-all h-full"
        >
          <Card title="Estado de Vehículos" icon={Car} className="h-full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Disponibles</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{stats.vehiculos.disponibles}</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Rentados</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{stats.vehiculos.rentados}</span>
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">En Mantenimiento</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{stats.vehiculos.enMantenimiento || 0}</span>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Siniestro/Baja</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{(stats.vehiculos.enSiniestro || 0) + (stats.vehiculos.baja || 0)}</span>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
              </div>
              
              {/* Barra de progreso */}
              {stats.vehiculos.total > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div className="flex h-full">
                      <div 
                        className="bg-green-500" 
                        style={{ width: `${(stats.vehiculos.disponibles / stats.vehiculos.total) * 100}%` }}
                      ></div>
                      <div 
                        className="bg-blue-500" 
                        style={{ width: `${(stats.vehiculos.rentados / stats.vehiculos.total) * 100}%` }}
                      ></div>
                      <div 
                        className="bg-yellow-500" 
                        style={{ width: `${((stats.vehiculos.enMantenimiento || 0) / stats.vehiculos.total) * 100}%` }}
                      ></div>
                      <div 
                        className="bg-red-500" 
                        style={{ width: `${(((stats.vehiculos.enSiniestro || 0) + (stats.vehiculos.baja || 0)) / stats.vehiculos.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Estado de Conductores */}
        <div
          onClick={() => navigate('/admin/conductores')}
          className="cursor-pointer transform hover:scale-105 transition-all h-full"
        >
          <Card title="Estado de Conductores" icon={Users} className="h-full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Aprobados Activos</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{stats.conductores.activos}</span>
                  <CheckCircle className="w-3 h-3 text-green-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Pendientes</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{stats.conductores.pendientes}</span>
                  <Clock className="w-3 h-3 text-yellow-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Aprobados Inactivos</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{stats.conductores.inactivos}</span>
                  <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Rechazados</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{stats.conductores.rechazados}</span>
                  <XCircle className="w-3 h-3 text-red-500" />
                </div>
              </div>
              
              {stats.conductores.pendientes > 0 && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    ⏳ {stats.conductores.pendientes} conductor{stats.conductores.pendientes !== 1 ? 'es' : ''} esperando aprobación
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Solicitudes de Conductores - NUEVA SECCIÓN */}
        <div
          onClick={() => navigate('/admin/solicitudes')}
          className="cursor-pointer transform hover:scale-105 transition-all h-full"
        >
          <Card title="Solicitudes de Conductores" icon={UserPlus} className="h-full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Pendientes</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{solicitudes.pendientes}</span>
                  <Clock className="w-3 h-3 text-yellow-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Aprobadas</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{solicitudes.aprobadas}</span>
                  <CheckCircle className="w-3 h-3 text-green-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">A Prueba</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{solicitudes.enPrueba}</span>
                  <AlertTriangle className="w-3 h-3 text-blue-500" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Rechazadas</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{solicitudes.rechazadas}</span>
                  <XCircle className="w-3 h-3 text-red-500" />
                </div>
              </div>

              {solicitudes.pendientes > 0 && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    ⏳ {solicitudes.pendientes} solicitud{solicitudes.pendientes !== 1 ? 'es' : ''} esperando revisión
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Tarjetas de Mantenimientos y Finanzas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div
          onClick={() => navigate('/admin/mantenimientos')}
          className="cursor-pointer transform hover:scale-105 transition-all h-full"
        >
          <Card title="Mantenimientos" icon={Wrench} className="h-full">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Programados</span>
                <span className="text-white font-semibold">{stats.mantenimientos.programados}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">En Proceso</span>
                <span className="text-yellow-400 font-semibold">{stats.mantenimientos.enProceso || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Completados</span>
                <span className="text-green-400 font-semibold">{stats.mantenimientos.completados}</span>
              </div>
              
              {stats.mantenimientos.programados > 0 && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    🔧 {stats.mantenimientos.programados} mantenimiento{stats.mantenimientos.programados !== 1 ? 's' : ''} programado{stats.mantenimientos.programados !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Resumen Financiero */}
        <Card title="Resumen Financiero" icon={DollarSign} className="h-full">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Ingresos Cobrados</span>
              <span className="text-green-400 font-semibold">
                ${(stats.rentas.montoTotalPagado || 0).toLocaleString('es-MX')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Por Cobrar</span>
              <span className="text-yellow-400 font-semibold">
                ${(stats.rentas.montoTotalPendiente || 0).toLocaleString('es-MX')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Rentas Activas</span>
              <span className="text-white font-semibold">{stats.rentas.total}</span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Total Potencial</p>
                <p className="text-xl font-bold text-white">
                  ${((stats.rentas.montoTotalPagado || 0) + (stats.rentas.montoTotalPendiente || 0)).toLocaleString('es-MX')}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Acciones rápidas con solicitudes incluidas */}
      <Card title="Acciones Rápidas" icon={TrendingUp}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <button 
            onClick={() => navigate('/admin/vehiculos')}
            className="p-4 bg-primary/10 border border-primary/30 rounded-lg hover:bg-primary/20 transition-all group"
          >
            <Car className="w-6 h-6 text-primary mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white font-medium">Gestionar Vehículos</p>
            <p className="text-xs text-gray-400 mt-1">{stats.vehiculos.total} registrados</p>
          </button>
          
          <button 
            onClick={() => navigate('/admin/conductores')}
            className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-all group"
          >
            <Users className="w-6 h-6 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white font-medium">Gestionar Conductores</p>
            <p className="text-xs text-gray-400 mt-1">{stats.conductores.total} registrados</p>
          </button>
          
          <button
            onClick={() => navigate('/admin/solicitudes')}
            className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg hover:bg-orange-500/20 transition-all group"
          >
            <UserPlus className="w-6 h-6 text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white font-medium">Gestionar Solicitudes</p>
            <p className="text-xs text-gray-400 mt-1">{solicitudes.pendientes} pendientes</p>
          </button>
          
          <button 
            onClick={() => navigate('/admin/mantenimientos')}
            className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-all group"
          >
            <Wrench className="w-6 h-6 text-yellow-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white font-medium">Mantenimientos</p>
            <p className="text-xs text-gray-400 mt-1">{stats.mantenimientos.programados} programados</p>
          </button>
          
          <button 
            onClick={() => navigate('/admin/rentas')}
            className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-all group"
          >
            <FileText className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white font-medium">Gestionar Rentas</p>
            <p className="text-xs text-gray-400 mt-1">{stats.rentas.pendientes} pendientes</p>
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
