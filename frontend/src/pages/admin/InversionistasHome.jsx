import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  FileText,
  ChevronRight,
  Briefcase,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const InversionistasHome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalInversionistas: 0,
    inversionistasActivos: 0,
    capitalTotal: 0,
    solicitudesPendientes: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Obtener inversionistas
      const inversionistasRes = await fetch(`${API_BASE_URL}/admin/inversionistas`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Obtener solicitudes
      const solicitudesRes = await fetch(`${API_BASE_URL}/admin/inversionistas/solicitudes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (inversionistasRes.ok) {
        const invData = await inversionistasRes.json();
        const inversionistas = invData.inversionistas || [];
        
        const activos = inversionistas.filter(inv => inv.status === 'Activo');
        const capitalTotal = inversionistas.reduce((sum, inv) => 
          sum + (parseFloat(inv.monto_total_invertido) || 0), 0
        );
        
        setStats(prev => ({
          ...prev,
          totalInversionistas: inversionistas.length,
          inversionistasActivos: activos.length,
          capitalTotal
        }));
      }

      if (solicitudesRes.ok) {
        const solData = await solicitudesRes.json();
        const solicitudes = solData.solicitudes || [];
        const pendientes = solicitudes.filter(s => s.status === 'Pendiente');
        
        setStats(prev => ({
          ...prev,
          solicitudesPendientes: pendientes.length
        }));
      }

    } catch (error) {
      console.error('Error cargando stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const menuItems = [
    {
      title: 'CRM de Inversionistas',
      description: 'Gestiona tu cartera de inversionistas',
      icon: Users,
      color: 'cyan',
      path: '/admin/inversionistas',
      stats: `${stats.inversionistasActivos} activos`
    },
    {
      title: 'Solicitudes de Inversión',
      description: 'Revisa y aprueba nuevas solicitudes',
      icon: FileText,
      color: 'purple',
      path: '/admin/solicitudes-inversion',
      stats: `${stats.solicitudesPendientes} pendientes`,
      badge: stats.solicitudesPendientes > 0
    },
  {
  title: 'Hub de Inversiones',
  description: 'Gestión de contratos y pagos',
  icon: Briefcase,
  color: 'green',
  path: '/admin/inversiones/hub',
  stats: 'Ver todos los contratos'
}
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 border border-white/10">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <p className="text-white text-lg">Cargando estadísticas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="glass rounded-2xl p-8 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Módulo de Inversionistas</h1>
              <p className="text-gray-400 mt-2">Gestión integral de inversiones y capital</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Total Inversionistas */}
          <div className="glass rounded-2xl p-6 border border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-500/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-gray-400 text-sm mb-1">Total Inversionistas</p>
            <p className="text-3xl font-bold text-cyan-400">{stats.totalInversionistas}</p>
            <p className="text-cyan-400/60 text-xs mt-2">{stats.inversionistasActivos} activos</p>
          </div>

          {/* Capital Total */}
          <div className="glass rounded-2xl p-6 border border-green-500/30 bg-green-500/5 hover:border-green-500/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-gray-400 text-sm mb-1">Capital Total Invertido</p>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.capitalTotal)}</p>
            <p className="text-green-400/60 text-xs mt-2">Suma de inversiones activas</p>
          </div>

          {/* Solicitudes Pendientes */}
          <div className="glass rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
              {stats.solicitudesPendientes > 0 && (
                <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-900">{stats.solicitudesPendientes}</span>
                </div>
              )}
            </div>
            <p className="text-gray-400 text-sm mb-1">Solicitudes Pendientes</p>
            <p className="text-3xl font-bold text-yellow-400">{stats.solicitudesPendientes}</p>
            <p className="text-yellow-400/60 text-xs mt-2">
              {stats.solicitudesPendientes > 0 ? 'Requieren atención' : 'Todo al día'}
            </p>
          </div>

          {/* Contratos Activos */}
          <div className="glass rounded-2xl p-6 border border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-purple-400" />
              </div>
              <CheckCircle className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-gray-400 text-sm mb-1">Contratos de Inversión</p>
            <p className="text-3xl font-bold text-purple-400">-</p>
            <p className="text-purple-400/60 text-xs mt-2">Disponible en Hub</p>
          </div>

        </div>

        {/* Menu Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const colorClasses = {
              cyan: 'from-cyan-500 to-cyan-600 hover:shadow-cyan-500/30',
              purple: 'from-purple-500 to-purple-600 hover:shadow-purple-500/30',
              green: 'from-green-500 to-green-600 hover:shadow-green-500/30'
            };

            return (
              <div
                key={index}
                onClick={() => navigate(item.path)}
                className="glass rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all cursor-pointer group relative overflow-hidden"
              >
                {/* Badge de notificación */}
                {item.badge && (
                  <div className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                )}

                {/* Icono */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${colorClasses[item.color]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>

                {/* Contenido */}
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {item.description}
                </p>

                {/* Stats */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">{item.stats}</span>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                </div>

                {/* Efecto hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
            );
          })}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Acceso Rápido */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-cyan-400" />
              Acceso Rápido
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/admin/inversionistas')}
                className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-left text-gray-300 hover:text-white transition-all flex items-center justify-between group"
              >
                <span>Ver todos los inversionistas</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/admin/solicitudes-inversion')}
                className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-left text-gray-300 hover:text-white transition-all flex items-center justify-between group"
              >
                <span>Revisar solicitudes pendientes</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            <button
  onClick={() => navigate('/admin/inversiones/hub')}
  className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-left text-gray-300 hover:text-white transition-all flex items-center justify-between group"
>
  <span>Gestionar contratos y pagos</span>
  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
</button>
            </div>
          </div>

          {/* Información */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Funcionalidades Disponibles
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 mt-2"></div>
                <div>
                  <p className="text-white font-medium">CRM Completo</p>
                  <p className="text-gray-400 text-sm">Gestión de inversionistas con historial</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 mt-2"></div>
                <div>
                  <p className="text-white font-medium">Sistema de Solicitudes</p>
                  <p className="text-gray-400 text-sm">Aprobación automática con creación de perfil</p>
                </div>
              </div>
             <div className="flex items-start gap-3">
  <div className="w-2 h-2 rounded-full bg-green-400 mt-2"></div>
  <div>
    <p className="text-white font-medium">Hub de Inversiones</p>
    <p className="text-gray-400 text-sm">Gestión completa de contratos y pagos</p>
  </div>
</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default InversionistasHome;
