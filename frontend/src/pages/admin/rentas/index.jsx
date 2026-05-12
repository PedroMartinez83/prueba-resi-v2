import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  CreditCard,
  FileText,
  TrendingUp,
  DollarSign,
  Calendar,
  Users,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  TrendingDown,
  Shield,
  X
} from 'lucide-react';
import adminService from "../../../services/adminService";
import GraficaCobranza from './components/GraficaCobranza';
import ConductoresMorosos from './components/ConductoresMorosos';
import TopConductores from './components/TopConductores';

const RentasDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [morosos, setMorosos] = useState([]);
  const [datosGrafica, setDatosGrafica] = useState([]);
  const [topConductores, setTopConductores] = useState([]); // 🆕 NUEVO
  const [alertas, setAlertas] = useState([]);
  const [mostrarTodosDeuda, setMostrarTodosDeuda] = useState(false);

  const cargarDashboard = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      
      // 🎯 OPTIMIZACIÓN: Todas las peticiones juntas (4 en total)
      const [statsResponse, morososResponse, graficaResponse, topResponse] = await Promise.all([
        adminService.getEstadisticasPagosRentas(),
        adminService.getConductoresMorosos(),
        adminService.getGraficaDiaria({ dias: 7 }),
        adminService.getTopConductores({ limite: 10 }) // 🆕 NUEVO
      ]);

      console.log('📊 Stats recibidas:', statsResponse);
      console.log('🚨 Morosos recibidos:', morososResponse);
      console.log('📈 Gráfica recibida:', graficaResponse);
      console.log('🏆 Top conductores recibidos:', topResponse);

      // Guardar correctamente los datos
      const stats = statsResponse.estadisticas || statsResponse;
      setEstadisticas(stats);
      
      const conductoresMorosos = morososResponse.conductores_morosos || morososResponse;
      setMorosos(conductoresMorosos);
      
      const datosGraf = graficaResponse.datos || [];
      setDatosGrafica(datosGraf);
      
      const topConds = topResponse.top_conductores || topResponse; // 🆕 NUEVO
      setTopConductores(topConds);
      
      // Generar alertas
      const nuevasAlertas = [];
      
      if (conductoresMorosos.length > 0) {
        nuevasAlertas.push({
          tipo: 'warning',
          mensaje: `${conductoresMorosos.length} conductor(es) con pagos pendientes`,
          icono: AlertTriangle,
          accion: () => navigate('/admin/rentas/pagos?status=Pendiente')
        });
      }
      
      if (stats?.pendientes > 0) {
        nuevasAlertas.push({
          tipo: 'info',
          mensaje: `${stats.pendientes} pago(s) por validar`,
          icono: Clock,
          accion: () => navigate('/admin/rentas/pagos?status=Pendiente')
        });
      }
      
      setAlertas(nuevasAlertas);
      
    } catch (error) {
      console.error('❌ Error al cargar dashboard:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    cargarDashboard(true);

    const intervalId = setInterval(() => {
      cargarDashboard(false);
    }, 30000);

    const handleFocus = () => {
      cargarDashboard(false);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const deudaTotalConductores = estadisticas?.total_deuda_conductores ??
    (Array.isArray(morosos)
      ? morosos.reduce((total, conductor) => total + parseFloat(conductor.deuda_aproximada || 0), 0)
      : 0);

  const metricasCards = [
    {
      titulo: 'Cobrado Hoy',
      valor: estadisticas?.cobrado_hoy || 0,
      formato: 'dinero',
      icono: DollarSign,
      color: 'from-emerald-500 to-teal-500',
      cambio: estadisticas?.cambio_dia || 0,
      onClick: () => {
        const hoy = new Date().toISOString().split('T')[0];
        navigate(`/admin/rentas/pagos?fecha_desde=${hoy}&fecha_hasta=${hoy}`);
      }
    },
    {
      titulo: 'Cobrado Esta Semana',
      valor: estadisticas?.cobrado_semana || 0,
      formato: 'dinero',
      icono: Calendar,
      color: 'from-blue-500 to-indigo-500',
      cambio: estadisticas?.cambio_semana || 0,
      onClick: () => navigate('/admin/rentas/pagos')
    },
    {
      titulo: 'Cobrado Este Mes',
      valor: estadisticas?.cobrado_mes || 0,
      formato: 'dinero',
      icono: TrendingUp,
      color: 'from-purple-500 to-pink-500',
      cambio: estadisticas?.cambio_mes || 0,
      onClick: () => navigate('/admin/rentas/pagos')
    },
    {
      titulo: 'Fondo de Pólizas (Mes)',
      valor: estadisticas?.poliza_mes_real || 0,
      formato: 'dinero',
      icono: Shield,
      color: 'from-indigo-500 to-purple-600',
      descripcion: 'Dinero ahorrado por conductores'
    },
    {
      titulo: 'Pendientes Validar',
      valor: estadisticas?.pendientes || 0,
      formato: 'numero',
      icono: Clock,
      color: 'from-amber-500 to-orange-500',
      onClick: () => navigate('/admin/rentas/pagos?status=Pendiente')
    },
    {
      titulo: 'Conductores con Deuda',
      valor: estadisticas?.conductores_deuda || 0,
      formato: 'numero',
      icono: Users,
      color: 'from-red-500 to-rose-500',
      onClick: () => navigate('/admin/rentas/pagos?status=Pendiente')
    },
    {
      titulo: 'Proyección Mensual',
      valor: estadisticas?.proyeccion_mes || 0,
      formato: 'dinero',
      icono: TrendingUp,
      color: 'from-cyan-500 to-blue-500'
    },
    {
      titulo: 'Deuda Total Conductores',
      valor: deudaTotalConductores,
      formato: 'dinero',
      icono: AlertTriangle,
      color: 'from-red-500 to-rose-600',
      descripcion: 'Total pendiente por pagar',
      onClick: () => navigate('/admin/rentas/pagos?status=Pendiente')
    }
  ];

  const formatearValor = (valor, formato) => {
    if (formato === 'dinero') {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(valor);
    }
    return valor.toLocaleString('es-MX');
  };

  const navegarA = (ruta) => {
    navigate(`/admin/rentas/${ruta}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#07425E] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Sistema de Rentas
          </h1>
          <p className="text-gray-400">
            Panel de control y gestión de cobranza diaria
          </p>
        </div>
        
        {/* Navegación */}
        <div className="flex gap-2">
          <NavButton
            icon={Home}
            label="Dashboard"
            active={true}
            onClick={() => navegarA('')}
          />
          <NavButton
            icon={CreditCard}
            label="Pagos"
            onClick={() => navegarA('pagos')}
          />
          <NavButton
            icon={FileText}
            label="Reportes"
            onClick={() => navegarA('reportes')}
          />
          <NavButton
            icon={TrendingUp}
            label="Estadísticas"
            onClick={() => navegarA('estadisticas')}
          />
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((alerta, idx) => (
            <div
              key={idx}
              onClick={alerta.accion}
              className={`glass border cursor-pointer transition-all hover:scale-[1.01] ${
                alerta.tipo === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-blue-500/30 bg-blue-500/5'
              } rounded-xl p-4 flex items-center gap-3`}
            >
              <alerta.icono className={`h-5 w-5 ${
                alerta.tipo === 'warning' ? 'text-amber-400' : 'text-blue-400'
              }`} />
              <span className="text-white flex-1">{alerta.mensaje}</span>
              <ArrowUpRight className="h-4 w-4 text-gray-400" />
            </div>
          ))}
        </div>
      )}

      {/* Métricas Cards - INTERACTIVAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {metricasCards.map((metrica, idx) => (
          <div
            key={idx}
            onClick={metrica.onClick}
            className={`glass border border-white/10 rounded-2xl p-6 transition-all ${
              metrica.onClick 
                ? 'cursor-pointer hover:border-primary/50 hover:scale-[1.02]' 
                : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${metrica.color}`}>
                <metrica.icono className="h-6 w-6 text-white" />
              </div>
              {metrica.cambio !== undefined && (
                <div className={`flex items-center gap-1 text-sm ${
                  metrica.cambio >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {metrica.cambio >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span>{Math.abs(metrica.cambio)}%</span>
                </div>
              )}
            </div>
            
            <p className="text-gray-400 text-sm mb-2">{metrica.titulo}</p>
            <p className="text-3xl font-bold text-white">
              {formatearValor(metrica.valor, metrica.formato)}
            </p>
            {metrica.descripcion && (
              <p className="text-xs text-gray-500 mt-2">{metrica.descripcion}</p>
            )}
          </div>
        ))}
      </div>

      {/* Gráfica de Cobranza - 🆕 RECIBE DATOS */}
      <div className="glass border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">
          Tendencia de Cobranza - Últimos 7 Días
        </h2>
        <GraficaCobranza datos={datosGrafica} loading={loading} />
      </div>

      {/* Sección Inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conductores con Deuda - 🆕 RECIBE DATOS */}
        <div className="glass border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              Conductores con la mayor deuda
            </h2>
            <button
              onClick={() => setMostrarTodosDeuda(true)}
              className="text-sm text-primary hover:text-primary-light transition-colors"
            >
              Ver más →
            </button>
          </div>
          <ConductoresMorosos
            datos={morosos}
            loading={loading}
            limite={5}
          />
        </div>

        {/* Top Conductores - 🆕 RECIBE DATOS */}
        <div className="glass border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              Mejores Pagadores
            </h2>
            <button
              onClick={() => navegarA('estadisticas')}
              className="text-sm text-primary hover:text-primary-light transition-colors"
            >
              Ver más →
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Pagadores puntuales o adelantados para ofrecer incentivos.
          </p>
          <TopConductores datos={topConductores} loading={loading} limite={5} />
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AccesoRapido
          titulo="Registrar Pago"
          descripcion="Nuevo pago manual"
          icono={CreditCard}
          onClick={() => navegarA('pagos?nuevo=true')}
        />
        <AccesoRapido
          titulo="Validar Pagos"
          descripcion={`${estadisticas?.pendientes || 0} pendientes`}
          icono={Clock}
          onClick={() => navegarA('pagos?status=Pendiente')}
        />
        <AccesoRapido
          titulo="Reporte del Día"
          descripcion="Descargar Excel"
          icono={FileText}
          onClick={() => navegarA('reportes?tipo=diario')}
        />
        <AccesoRapido
          titulo="Ver Estadísticas"
          descripcion="Análisis completo"
          icono={TrendingUp}
          onClick={() => navegarA('estadisticas')}
        />
      </div>

      {mostrarTodosDeuda && (
        <ModalConductoresMorosos
          onClose={() => setMostrarTodosDeuda(false)}
          datos={morosos}
          loading={loading}
        />
      )}
    </div>
  );
};

// Componente NavButton
const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
      active
        ? 'bg-primary text-white'
        : 'glass border border-white/10 text-gray-400 hover:text-white hover:border-primary/30'
    }`}
  >
    <Icon className="h-4 w-4" />
    <span className="text-sm font-medium">{label}</span>
  </button>
);

const ModalConductoresMorosos = ({ onClose, datos, loading }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="glass border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-gray-900/80">
        <div>
          <h3 className="text-xl font-semibold text-white">
            Conductores con mayor deuda
          </h3>
          <p className="text-sm text-gray-400">
            Lista completa de conductores con los mayores pagos atrasados
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5 text-gray-300" />
        </button>
      </div>
      <div className="p-6 max-h-[75vh] overflow-y-auto">
        <ConductoresMorosos datos={datos} loading={loading} limite={datos.length} />
      </div>
    </div>
  </div>
);

// Componente AccesoRapido
const AccesoRapido = ({ titulo, descripcion, icono: Icon, onClick }) => (
  <button
    onClick={onClick}
    className="glass border border-white/10 rounded-xl p-4 text-left hover:border-primary/30 transition-all hover:scale-105 group"
  >
    <Icon className="h-8 w-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
    <h3 className="text-white font-semibold mb-1">{titulo}</h3>
    <p className="text-sm text-gray-400">{descripcion}</p>
  </button>
);

export default RentasDashboard;
