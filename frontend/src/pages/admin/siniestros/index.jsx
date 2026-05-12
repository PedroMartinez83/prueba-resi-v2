import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Clock,
  Car,
  FileWarning,
  CheckCircle,
  Plus,
  BarChart3,
  FileText,
  Shield,
  XCircle
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const SiniestrosDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [porClasificacion, setPorClasificacion] = useState([]);
  const [topVehiculos, setTopVehiculos] = useState([]);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/siniestros/estadisticas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setEstadisticas(data.estadisticas);
        setPorClasificacion(data.por_clasificacion || []);
        setTopVehiculos(data.top_vehiculos || []);
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const handleMetricClick = (filterKey) => {
    const filterMap = {
      'total': '',
      'reportados': '?estado=Reportado',
      'en_proceso': '?estado=En proceso',
      'resueltos': '?estado=Resuelto',
      'graves': '?gravedad=Grave'
    };
    
    const filter = filterMap[filterKey] || '';
    navigate(`/admin/siniestros/lista${filter}`);
  };

  const handleVerVehiculo = (vehiculoId) => {
    navigate(`/admin/vehiculos/${vehiculoId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center">
        <div className="text-white text-xl">Cargando datos...</div>
      </div>
    );
  }

  const stats = estadisticas || {};

  // 🎯 MÉTRICAS DE ALERTA (Prioridad Alta)
  const alertMetrics = [
    {
      title: 'Reportados',
      value: stats.reportados || 0,
      icon: FileWarning,
      color: 'orange',
      description: 'Pendientes de atención',
      urgent: stats.reportados > 0,
      filterKey: 'reportados'
    },
    {
      title: 'En Proceso',
      value: stats.en_proceso || 0,
      icon: AlertTriangle,
      color: 'yellow',
      description: 'En reparación',
      urgent: stats.en_proceso > 0,
      filterKey: 'en_proceso'
    },
    {
      title: 'Graves',
      value: stats.graves || 0,
      icon: XCircle,
      color: 'red',
      description: 'Daños severos',
      urgent: stats.graves > 0,
      filterKey: 'graves'
    },
    {
      title: 'Pérdida Total',
      value: stats.totales || 0,
      icon: Shield,
      color: 'purple',
      description: 'Vehículos totalizados',
      urgent: stats.totales > 0,
      filterKey: 'totales'
    }
  ];

  // 🎯 MÉTRICAS DE RESUMEN
  const summaryMetrics = [
    {
      title: 'Total Siniestros',
      value: stats.total_siniestros || 0,
      icon: AlertTriangle,
      color: 'red',
      description: 'Histórico completo',
      filterKey: 'total'
    },
    {
      title: 'Resueltos',
      value: stats.resueltos || 0,
      icon: CheckCircle,
      color: 'green',
      description: 'Casos cerrados',
      filterKey: 'resueltos'
    },
    {
      title: 'Costo Total',
      value: formatCurrency(stats.costo_total),
      icon: DollarSign,
      color: 'purple',
      description: 'Daños acumulados',
      filterKey: null
    },
    {
      title: 'Promedio Costo',
      value: formatCurrency(stats.promedio_costo),
      icon: TrendingUp,
      color: 'cyan',
      description: 'Por siniestro',
      filterKey: null
    },
    {
      title: 'Días Fuera Servicio',
      value: `${stats.promedio_dias_fuera?.toFixed(1) || 0}d`,
      icon: Clock,
      color: 'blue',
      description: 'Promedio',
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
      orange: 'text-orange-400',
      cyan: 'text-cyan-400'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              🚨 Siniestros
            </h1>
            <p className="text-gray-400">
              Dashboard de gestión de incidentes
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/siniestros/lista')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <FileText className="w-5 h-5" />
              Ver Todos
            </button>
            
            <button
              onClick={() => navigate('/admin/siniestros/reportes')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm border border-white/20 transition-all flex items-center gap-2"
            >
              <BarChart3 className="w-5 h-5" />
              Reportes
            </button>
            
            <button
              onClick={() => navigate('/admin/siniestros/registrar')}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Registrar Siniestro
            </button>
          </div>
        </div>

        {/* 🎯 GRUPO 1: ALERTAS DE ACCIÓN */}
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
                    metric.urgent ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-900' : ''
                  }`}
                >
                  {metric.urgent && (
                    <div className="absolute top-2 right-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
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
                      Clic para ver detalles →
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 🎯 GRUPO 2: MÉTRICAS DE RESUMEN */}
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

        {/* Siniestros por Clasificación */}
        {porClasificacion.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              Siniestros por Clasificación
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {porClasificacion.map((item, index) => (
                <div 
                  key={index} 
                  className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                >
                  <h3 className="font-semibold text-white capitalize mb-2">
                    {item.clasificacion}
                  </h3>
                  <p className="text-gray-400 text-sm mb-2">
                    Cantidad: <span className="text-white font-semibold">{item.cantidad}</span>
                  </p>
                  <p className="text-2xl font-bold text-red-400">
                    {formatCurrency(item.total_costo || 0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top 10 Vehículos con más Siniestros */}
        {topVehiculos.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Car className="w-6 h-6 text-red-400" />
              Top 10 Vehículos con Más Siniestros
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-400 text-sm font-semibold pb-3 px-4">#</th>
                    <th className="text-left text-gray-400 text-sm font-semibold pb-3 px-4">Vehículo</th>
                    <th className="text-left text-gray-400 text-sm font-semibold pb-3 px-4">Marca/Modelo</th>
                    <th className="text-left text-gray-400 text-sm font-semibold pb-3 px-4">Conductor</th>
                    <th className="text-center text-gray-400 text-sm font-semibold pb-3 px-4">Siniestros</th>
                    <th className="text-right text-gray-400 text-sm font-semibold pb-3 px-4">Costo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topVehiculos.map((vehiculo, index) => (
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
                          {vehiculo.marca} {vehiculo.modelo}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-gray-400 text-sm">
                          {vehiculo.nombre_conductor || 'Sin asignar'}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-semibold">
                          {vehiculo.total_siniestros}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <p className="text-white font-bold text-lg">
                          {formatCurrency(vehiculo.total_costo || 0)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SiniestrosDashboard;
