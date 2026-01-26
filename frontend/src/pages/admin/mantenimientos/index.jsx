import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Calendar,
  AlertTriangle,
  DollarSign,
  Clock,
  CheckCircle,
  Car,
  TrendingUp,
  FileText,
  Plus,
  BarChart3,
  Edit,
  Eye,
  Wallet,
  Table
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const MantenimientosDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [pendientesDistribucion, setPendientesDistribucion] = useState(0); // 🆕
  const [serviciosModalAbierto, setServiciosModalAbierto] = useState(false);
  const [serviciosPreventivos, setServiciosPreventivos] = useState(null);
  const [cargandoServicios, setCargandoServicios] = useState(false);
  const [errorServicios, setErrorServicios] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No hay token de autenticación');
        setLoading(false);
        return;
      }
      
      console.log('🔧 Cargando datos de mantenimientos...');
      
      // Cargar estadísticas
      const resEstadisticas = await fetch(`${API_BASE_URL}/admin/mantenimientos/estadisticas`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 Response estadísticas:', resEstadisticas.status);
      
      if (!resEstadisticas.ok) {
        console.error('Error en estadísticas:', resEstadisticas.status);
        setEstadisticas({ 
          success: true, 
          estadisticas: {},
          top_vehiculos: [],
          costos_mensuales: []
        });
      } else {
        const dataEstadisticas = await resEstadisticas.json();
        setEstadisticas(dataEstadisticas);
      }
      
      // Cargar alertas
      const resAlertas = await fetch(`${API_BASE_URL}/admin/mantenimientos/alertas`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('⚠️ Response alertas:', resAlertas.status);
      
      if (!resAlertas.ok) {
        console.error('Error en alertas:', resAlertas.status);
        setAlertas({
          vencidos: [],
          urgentes: [],
          proximos: [],
          por_kilometraje: []
        });
      } else {
        const dataAlertas = await resAlertas.json();
        setAlertas(dataAlertas.alertas);
      }

      // 🆕 Cargar mantenimientos pendientes de distribución
      const resPendientes = await fetch(`${API_BASE_URL}/admin/mantenimientos/pendientes-distribucion`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (resPendientes.ok) {
        const dataPendientes = await resPendientes.json();
        setPendientesDistribucion(dataPendientes.total_pendientes || 0);
      }
      
    } catch (error) {
      console.error('❌ Error al cargar datos:', error);
      setEstadisticas({ 
        success: true, 
        estadisticas: {},
        top_vehiculos: [],
        costos_mensuales: []
      });
      setAlertas({
        vencidos: [],
        urgentes: [],
        proximos: [],
        por_kilometraje: []
      });
    } finally {
      setLoading(false);
    }
  };

  const cargarServiciosPreventivos = async () => {
    try {
      setCargandoServicios(true);
      setErrorServicios('');

      const token = localStorage.getItem('token');

      if (!token) {
        setErrorServicios('No hay token de autenticación');
        setCargandoServicios(false);
        return;
      }

      const resServicios = await fetch(`${API_BASE_URL}/admin/mantenimientos/servicios-preventivos`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!resServicios.ok) {
        throw new Error('No se pudieron cargar los servicios preventivos');
      }

      const dataServicios = await resServicios.json();
      setServiciosPreventivos(dataServicios.modelos || {});
    } catch (error) {
      console.error('❌ Error al cargar servicios preventivos:', error);
      setErrorServicios(error.message || 'Error al obtener servicios preventivos');
    } finally {
      setCargandoServicios(false);
    }
  };

  const handleVerServicios = () => {
    setServiciosModalAbierto(true);
    if (!serviciosPreventivos) {
      cargarServiciosPreventivos();
    }
  };

  const handleCerrarServicios = () => {
    setServiciosModalAbierto(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // 🎯 MEJORA 1: Función para manejar clic en tarjetas (FILTROS INTELIGENTES)
  const handleMetricClick = (metricType) => {
    const filterMap = {
      'vencidos': '?estado=vencido',
      'urgentes': '?estado=urgente',
      'programados': '?estado=Programado',
      'en_proceso': '?estado=En proceso',
      'completados': '?estado=Completado',
      'por_kilometraje': '?alerta=kilometraje',
      'gastos_pendientes': '/admin/mantenimientos/distribuir-gastos' // 🆕 Ruta directa
    };
    
    const filter = filterMap[metricType] || '';
    
    // 🆕 Si es gastos_pendientes, navegar directamente
    if (metricType === 'gastos_pendientes') {
      navigate(filter);
    } else {
      navigate(`/admin/mantenimientos/lista${filter}`);
    }
  };

  // 🎯 MEJORA 2: Funciones para acciones en alertas
  const handleReprogramar = (mantenimientoId, e) => {
    e.stopPropagation();
    navigate(`/admin/mantenimientos/programar?edit=${mantenimientoId}`);
  };

  const handleVerVehiculo = (vehiculoId, e) => {
    e.stopPropagation();
    navigate(`/admin/vehiculos/${vehiculoId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando datos...</div>
      </div>
    );
  }

  const stats = estadisticas?.estadisticas || {};
  
  // 🎯 MEJORA 3: Agrupar métricas por prioridad
  const alertMetrics = [
    {
      title: 'Vencidos',
      value: stats.vencidos || 0,
      icon: AlertTriangle,
      color: 'red',
      description: 'Pasaron fecha programada',
      urgent: stats.vencidos > 0,
      filterKey: 'vencidos'
    },
    {
      title: 'Urgentes',
      value: stats.urgentes || 0,
      icon: Clock,
      color: 'yellow',
      description: 'Próximos 7 días',
      urgent: stats.urgentes > 0,
      filterKey: 'urgentes'
    },
    {
      title: 'Por Kilometraje',
      value: stats.por_kilometraje || 0,
      icon: Car,
      color: 'orange',
      description: 'Requieren servicio',
      urgent: stats.por_kilometraje > 0,
      filterKey: 'por_kilometraje'
    },
    // 🆕 NUEVA TARJETA: Gastos Pendientes
    {
      title: 'Gastos Pendientes',
      value: pendientesDistribucion,
      icon: Wallet,
      color: 'purple',
      description: 'Requieren distribución',
      urgent: pendientesDistribucion > 0,
      filterKey: 'gastos_pendientes'
    }
  ];

  const summaryMetrics = [
    {
      title: 'En Proceso',
      value: stats.en_proceso || 0,
      icon: Wrench,
      color: 'indigo',
      description: 'Actualmente en taller',
      filterKey: 'en_proceso'
    },
    {
      title: 'Programados',
      value: stats.programados || 0,
      icon: Calendar,
      color: 'blue',
      description: 'Pendientes de realizar',
      filterKey: 'programados'
    },
    {
      title: 'Completados Mes',
      value: stats.completados_mes || 0,
      icon: CheckCircle,
      color: 'green',
      description: 'Este mes',
      filterKey: 'completados'
    },
    {
      title: 'Costo Total Mes',
      value: formatCurrency(stats.costo_total_mes),
      icon: DollarSign,
      color: 'purple',
      description: 'Gastado este mes',
      filterKey: null
    },
    {
      title: 'Promedio Costo',
      value: formatCurrency(stats.promedio_costo),
      icon: TrendingUp,
      color: 'cyan',
      description: 'Por servicio',
      filterKey: null
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
      green: 'from-green-500/20 to-green-600/20 border-green-500/30',
      red: 'from-red-500/20 to-red-600/20 border-red-500/30',
      purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
      yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
      indigo: 'from-indigo-500/20 to-indigo-600/20 border-indigo-500/30',
      orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
      cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30'
    };
    return colors[color] || colors.blue;
  };

  const getIconColor = (color) => {
    const colors = {
      blue: 'text-blue-400',
      green: 'text-green-400',
      red: 'text-red-400',
      purple: 'text-purple-400',
      yellow: 'text-yellow-400',
      indigo: 'text-indigo-400',
      orange: 'text-orange-400',
      cyan: 'text-cyan-400'
    };
    return colors[color] || colors.blue;
  };

  const renderTablaServicios = (modeloKey, titulo) => {
    const servicios = [...(serviciosPreventivos?.[modeloKey] || [])].sort((a, b) => a.kilometraje - b.kilometraje);

    if (!servicios.length) {
      return (
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-sm">
          No hay servicios configurados.
        </div>
      );
    }

    return (
      <div className="bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h3 className="text-white font-semibold">{titulo}</h3>
          </div>
          <span className="text-xs text-gray-400">{servicios.length} servicios</span>
        </div>
        <div className="overflow-hidden border-t border-white/10">
          <table className="min-w-full text-sm text-left text-gray-200">
            <thead className="bg-white/5 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Kilometraje</th>
                <th className="px-4 py-3">Servicio</th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((servicio, index) => (
                <tr key={`${modeloKey}-${servicio.kilometraje}-${index}`} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold text-white">
                    {servicio.kilometraje.toLocaleString()} km
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {servicio.servicio}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              🔧 Mantenimientos
            </h1>
            <p className="text-gray-400">
              Dashboard y gestión de servicios
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/mantenimientos/lista')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Ver mantenimientos
            </button>

            <button
              onClick={handleVerServicios}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <Table className="w-5 h-5" />
              Ver tabla de servicios
            </button>

            <button
              onClick={() => navigate('/admin/mantenimientos/reportes')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <BarChart3 className="w-5 h-5" />
              Reportes
            </button>
            
            <button
              onClick={() => navigate('/admin/mantenimientos/programar')}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Programar Mantenimiento
            </button>
          </div>
        </div>

        {/* 🎯 MEJORA 3: GRUPO 1 - ALERTAS DE ACCIÓN (Ahora con 4 tarjetas) */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ⚠️ Alertas de Acción
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {alertMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div
                  key={index}
                  onClick={() => metric.filterKey && handleMetricClick(metric.filterKey)}
                  className={`relative p-6 rounded-xl backdrop-blur-sm border transition-all hover:scale-105 cursor-pointer bg-gradient-to-br ${getColorClasses(metric.color)} ${
                    metric.urgent ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900' : ''
                  }`}
                >
                  {metric.urgent && (
                    <div className="absolute top-2 right-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">{metric.title}</p>
                      <p className="text-4xl font-bold text-white">
                        {metric.value}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg bg-white/5 ${getIconColor(metric.color)}`}>
                      <Icon className="w-7 h-7" />
                    </div>
                  </div>
                  
                  <p className="text-gray-400 text-sm">
                    {metric.description}
                  </p>
                  
                  {metric.filterKey && (
                    <p className="text-xs text-gray-500 mt-2">
                      Clic para {metric.filterKey === 'gastos_pendientes' ? 'distribuir' : 'ver detalles'} →
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 🎯 MEJORA 3: GRUPO 2 - MÉTRICAS DE RESUMEN (Más pequeñas) */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            📊 Métricas de Resumen
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {summaryMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div
                  key={index}
                  onClick={() => metric.filterKey && handleMetricClick(metric.filterKey)}
                  className={`p-4 rounded-xl backdrop-blur-sm border transition-all bg-gradient-to-br ${getColorClasses(metric.color)} ${
                    metric.filterKey ? 'hover:scale-105 cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg bg-white/5 ${getIconColor(metric.color)}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  
                  <p className="text-gray-400 text-xs mb-1">{metric.title}</p>
                  <p className="text-2xl font-bold text-white mb-1">
                    {metric.value}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {metric.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alertas y Próximos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* 🎯 MEJORA 2: Alertas Críticas con BOTONES DE ACCIÓN */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  Alertas Críticas
                </h2>
                <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-semibold">
                  {(alertas?.vencidos?.length || 0) + (alertas?.urgentes?.length || 0)} alertas
                </span>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {/* Vencidos con BOTONES */}
                {alertas?.vencidos?.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-semibold">
                            VENCIDO
                          </span>
                          <span className="text-red-400 text-sm font-semibold">
                            {item.dias_vencido} día(s) de retraso
                          </span>
                        </div>
                        <p className="text-white font-semibold mb-1">
                          {item.numero_vehiculo} - {item.marca} {item.modelo}
                        </p>
                        <p className="text-gray-400 text-sm mb-1">
                          {item.tipo_servicio}
                        </p>
                        {item.nombre_conductor && (
                          <p className="text-gray-400 text-xs">
                            Conductor: {item.nombre_conductor}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">Programado:</p>
                        <p className="text-white text-sm">
                          {new Date(item.fecha_programada).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    </div>
                    
                    {/* 🎯 BOTONES DE ACCIÓN */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleReprogramar(item.id, e)}
                        className="flex-1 px-3 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 border border-yellow-500/30"
                      >
                        <Calendar className="w-4 h-4" />
                        Reprogramar
                      </button>
                      <button
                        onClick={(e) => handleVerVehiculo(item.vehiculo_id, e)}
                        className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 border border-blue-500/30"
                      >
                        <Car className="w-4 h-4" />
                        Ver Vehículo
                      </button>
                    </div>
                  </div>
                ))}

                {/* Urgentes con BOTONES */}
                {alertas?.urgentes?.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-semibold">
                            URGENTE
                          </span>
                          <span className="text-yellow-400 text-sm font-semibold">
                            En {item.dias_restantes} día(s)
                          </span>
                        </div>
                        <p className="text-white font-semibold mb-1">
                          {item.numero_vehiculo} - {item.marca} {item.modelo}
                        </p>
                        <p className="text-gray-400 text-sm mb-1">
                          {item.tipo_servicio}
                        </p>
                        {item.nombre_conductor && (
                          <p className="text-gray-400 text-xs">
                            Conductor: {item.nombre_conductor}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs">Programado:</p>
                        <p className="text-white text-sm">
                          {new Date(item.fecha_programada).toLocaleDateString('es-MX')}
                        </p>
                      </div>
                    </div>
                    
                    {/* 🎯 BOTONES DE ACCIÓN */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleVerVehiculo(item.vehiculo_id, e)}
                        className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 border border-blue-500/30"
                      >
                        <Car className="w-4 h-4" />
                        Ver Vehículo
                      </button>
                      <button
                        onClick={(e) => handleReprogramar(item.id, e)}
                        className="flex-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 border border-green-500/30"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Confirmar
                      </button>
                    </div>
                  </div>
                ))}

                {(!alertas?.vencidos?.length && !alertas?.urgentes?.length) && (
                  <div className="text-center py-12 text-gray-400">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
                    <p className="text-lg font-semibold text-white mb-2">
                      ¡Todo en orden!
                    </p>
                    <p className="text-sm">
                      No hay mantenimientos vencidos o urgentes
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Próximos 30 días */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Próximos 30 días
                </h2>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold">
                  {alertas?.proximos?.length || 0}
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {alertas?.proximos?.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleVerVehiculo(item.vehiculo_id)}
                    className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                        {item.dias_restantes}d
                      </span>
                      <p className="text-white text-sm font-semibold flex-1 truncate">
                        {item.numero_vehiculo}
                      </p>
                    </div>
                    <p className="text-gray-400 text-xs mb-1">
                      {item.tipo_servicio}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {new Date(item.fecha_programada).toLocaleDateString('es-MX', { 
                        day: '2-digit', 
                        month: 'short' 
                      })}
                    </p>
                  </div>
                ))}

                {!alertas?.proximos?.length && (
                  <div className="text-center py-8 text-gray-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No hay mantenimientos próximos</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Top 10 Vehículos */}
        {estadisticas?.top_vehiculos?.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Car className="w-6 h-6 text-purple-400" />
              Top 10 Vehículos - Mayor Gasto en Mantenimientos
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-400 text-sm font-semibold pb-3 px-4">#</th>
                    <th className="text-left text-gray-400 text-sm font-semibold pb-3 px-4">Vehículo</th>
                    <th className="text-left text-gray-400 text-sm font-semibold pb-3 px-4">Marca/Modelo</th>
                    <th className="text-center text-gray-400 text-sm font-semibold pb-3 px-4">Mantenimientos</th>
                    <th className="text-right text-gray-400 text-sm font-semibold pb-3 px-4">Total Gastado</th>
                  </tr>
                </thead>
                <tbody>
                  {estadisticas.top_vehiculos.map((vehiculo, index) => (
                    <tr 
                      key={vehiculo.id}
                      onClick={() => handleVerVehiculo(vehiculo.id)}
                      className="border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer"
                    >
                      <td className="py-4 px-4">
                        <span className="text-white font-bold">{index + 1}</span>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-white font-semibold">
                          {vehiculo.numero_vehiculo}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {vehiculo.placa}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-white">
                          {vehiculo.marca}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-semibold">
                          {vehiculo.total_mantenimientos}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                       <p className="text-white font-bold text-lg">
  {formatCurrency(vehiculo.total_gastado)}
</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {serviciosModalAbierto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Guía de mantenimientos preventivos</p>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Table className="w-5 h-5" /> Ver tabla de servicios
                  </h3>
                </div>
                <button
                  onClick={handleCerrarServicios}
                  className="px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/10 transition-all"
                >
                  Cerrar
                </button>
              </div>

              <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4">
                {errorServicios && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                    {errorServicios}
                  </div>
                )}

                {cargandoServicios ? (
                  <p className="text-gray-300 text-sm">Cargando tabla de servicios...</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderTablaServicios('v-drive', 'Nissan V-Drive')}
                    {renderTablaServicios('march', 'Nissan March')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MantenimientosDashboard;
