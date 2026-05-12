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
  const [solicitudesRecientes, setSolicitudesRecientes] = useState([]);
  const [stats, setStats] = useState({
    totalInversionistas: 0,
    inversionistasActivos: 0,
    capitalTotal: 0,
    solicitudesPendientes: 0,
    contratosActivos: 0,
    solicitudesInversion: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // 🚀 1. Añadimos la cuarta llamada (solicitudes de registro de inversionista)
      const [inversionistasRes, solicitudesRes, inversionesRes, registroInversionistasRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/inversionistas`, { headers }),
        fetch(`${API_BASE_URL}/admin/inversionistas/solicitudes`, { headers }), // Solicitudes de inversión (Contratos)
        fetch(`${API_BASE_URL}/admin/inversiones/hub`, { headers }),
        fetch(`${API_BASE_URL}/solicitudes-inversionistas/admin/lista`, { headers }) // 👈 NUEVA: Prospectos de la tabla solicitudes_inversionistas
      ]);

      // Verificamos que todas las respuestas sean exitosas
      if (!inversionistasRes.ok || !solicitudesRes.ok || !inversionesRes.ok || !registroInversionistasRes.ok) {
        throw new Error('Error al cargar las estadísticas o prospectos');
      }

      const inversionistasData = await inversionistasRes.json();
      const solicitudesData = await solicitudesRes.json();
      const inversionesData = await inversionesRes.json();
      const registroData = await registroInversionistasRes.json(); // 👈 Data de prospectos nuevos

      // --- PROCESAMIENTO DE DATOS EXISTENTES ---
      const listaInversionistas = inversionistasData.inversionistas || inversionistasData.data || [];
      const listaSolicitudes = solicitudesData.solicitudes || solicitudesData.data || [];
      const listaSolicitudesInversion = registroData.solicitudes || registroData.data || [];

      const cantActivos = listaInversionistas.filter(inv => 
        inv.status === 'Activo' || inv.estado === 'Activo'
      ).length;

      const cantPendientes = listaSolicitudes.filter(sol =>

        sol.estado_aceptacion === 'Pendiente'

      ).length;

      const cantSolicitudesInversion = listaSolicitudesInversion.filter(sol =>
        sol.estado_aceptacion === 'Pendiente'
      ).length;

      const cantContratosActivos = inversionesData.stats?.contratos_activos || 0;
      const capitalTotalActivo = inversionesData.stats?.capital_total || 0;

      // --- PROCESAMIENTO DE NUEVOS PROSPECTOS (Para el Card) ---
      const listaProspectos = registroData.data || registroData.solicitudes || [];

      // Filtramos prospectos pendientes
      const prospectosPendientes = listaProspectos.filter(sol => 
        sol.estado_aceptacion === 'Pendiente'
      );

      // 3. Guardamos todo en el estado global de stats
      setStats({
        totalInversionistas: listaInversionistas.length,
        inversionistasActivos: cantActivos,
        capitalTotal: capitalTotalActivo, 
        solicitudesPendientes: cantPendientes, // 🎯 Ahora mostramos prospectos reales, no contratos rechazados
        contratosActivos: cantContratosActivos,
        solicitudesInversion: cantSolicitudesInversion // 🎯 Nueva estadística para solicitudes de inversión
      });

      // 🚀 4. Guardamos los prospectos para el Card visual
      const soloRecientes = prospectosPendientes
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 3);
        
      setSolicitudesRecientes(soloRecientes);

    } catch (error) {
      console.error('❌ Error cargando stats del Home:', error);
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
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen p-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
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
            <p className="text-gray-400 text-sm mb-1">Solicitudes de Inversión Pendientes</p>
            <p className="text-3xl font-bold text-yellow-400">{stats.solicitudesPendientes}</p>
            <p className="text-yellow-400/60 text-xs mt-2">
              {stats.solicitudesPendientes > 0 ? 'Requieren atención' : 'Todo al día'}
            </p>
          </div>

          {/* Solicitudes Inversionistas Pendientes (NUEVOS PROSPECTOS) */}
          <div className="glass rounded-2xl p-5 border border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-yellow-400" /> {/* 👈 Cambié el icono a Users para distinguirlo */}
              </div>
              {stats.solicitudesInversion > 0 && (
                <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-900">{stats.solicitudesInversion}</span>
                </div>
              )}
            </div>
            {/* 👇 Cambié el título para que no se llame igual que la otra */}
            <p className="text-gray-400 text-sm mb-1">Nuevas Solicitudes de Inversionistas</p>
            <p className="text-3xl font-bold text-yellow-400">{stats.solicitudesInversion}</p>
            <p className="text-yellow-400/60 text-xs mt-2">
              {stats.solicitudesInversion > 0 ? 'Por aprobar' : 'Todo al día'}
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
            <p className="text-gray-400 text-sm mb-1">Contratos Activos de Inversión</p>
            <p className="text-3xl font-bold text-purple-400">{stats.contratosActivos}</p>
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
      
      {/* Card de Solicitudes Pendientes */}
      <div className="glass rounded-2xl p-6 border border-white/10 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Solicitudes de Inversionista
          </h3>
          <span className="px-3 py-1 bg-amber-400/10 text-amber-400 rounded-full text-xs font-medium">
            {stats.solicitudesInversion} pendientes
          </span>
        </div>

        <div className="space-y-4 flex-1">
          {loading ? (
            <div className="text-gray-500 text-sm animate-pulse">Cargando...</div>
          ) : solicitudesRecientes.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No hay solicitudes nuevas.</p>
          ) : (
            solicitudesRecientes.map((sol) => (
              <div 
                key={sol.id} 
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                // 🚀 CAMBIO 1: Apuntamos a la nueva pantalla de registro
                onClick={() => navigate(`/admin/solicitudes-registro`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
                      {sol.nombre}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      {sol.tipo_inversionista}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
              </div>
            ))
          )}
        </div>

        {/* 🚀 CAMBIO 2: El botón de "Ver todas" también debe ir a la nueva pantalla */}
        {stats.solicitudesPendientes > 3 && (
          <button 
            onClick={() => navigate('/admin/solicitudes-registro')}
            className="mt-4 text-xs text-cyan-400 hover:underline flex items-center gap-1"
          >
            Ver las {stats.solicitudesPendientes - 3} restantes <ChevronRight className="w-3 h-3" />
          </button>
        )}

  {stats.solicitudesPendientes > 3 && (
    <button 
      onClick={() => navigate('/admin/solicitudes-inversion')}
      className="mt-4 text-xs text-cyan-400 hover:underline flex items-center gap-1"
    >
      Ver todas las solicitudes
    </button>
  )}
</div>

      {/* --- CARD 2: ACCESO RÁPIDO (TU CÓDIGO ACTUAL) --- */}
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
