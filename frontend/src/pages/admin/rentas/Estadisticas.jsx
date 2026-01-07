import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  CreditCard,
  FileText,
  TrendingUp,
  Calendar,
  Filter
} from 'lucide-react';
import GraficaCobranza from './components/GraficaCobranza';
import GraficaTendencias from './components/GraficaTendencias';
import GraficaPorTipoSocio from './components/GraficaPorTipoSocio';
import TopConductores from './components/TopConductores';
import EstadisticasCards from './components/EstadisticasCards';
import adminService from '../../../services/adminService';const Estadisticas = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [periodo, setPeriodo] = useState('30'); // días

  useEffect(() => {
    cargarEstadisticas();
  }, [periodo]);

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      const data = await adminService.getEstadisticasPagosRentas({
        periodo
      });
      setEstadisticas(data.estadisticas);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const navegarA = (ruta) => {
    navigate(`/admin/rentas/${ruta}`);
  };

  const periodos = [
    { valor: '7', label: 'Últimos 7 días' },
    { valor: '30', label: 'Últimos 30 días' },
    { valor: '90', label: 'Últimos 3 meses' },
    { valor: '365', label: 'Último año' }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Estadísticas</h1>
          <p className="text-gray-400">Análisis detallado de cobranza y tendencias</p>
        </div>
        
        {/* Navegación */}
        <div className="flex gap-2">
          <NavButton
            icon={Home}
            label="Dashboard"
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
            active={true}
            onClick={() => navegarA('estadisticas')}
          />
        </div>
      </div>

      {/* Selector de Período */}
      <div className="glass border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <span className="text-white font-medium">Período de análisis</span>
          </div>
          
          <div className="flex gap-2">
            {periodos.map((p) => (
              <button
                key={p.valor}
                onClick={() => setPeriodo(p.valor)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  periodo === p.valor
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards de Estadísticas */}
      <EstadisticasCards estadisticas={estadisticas} loading={loading} />

      {/* Gráfica de Cobranza Diaria */}
      <div className="glass border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Tendencia de Cobranza Diaria
          </h2>
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <GraficaCobranza dias={parseInt(periodo)} />
      </div>

      {/* Grid de Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencias Mensuales */}
        <div className="glass border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Tendencia Mensual
          </h2>
          <GraficaTendencias meses={12} />
        </div>

        {/* Distribución por Tipo Socio */}
        <div className="glass border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Distribución por Tipo de Socio
          </h2>
          <GraficaPorTipoSocio />
        </div>
      </div>

      {/* Top Conductores */}
      <div className="glass border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Top 10 Mejores Pagadores
          </h2>
          <TrendingUp className="h-5 w-5 text-emerald-400" />
        </div>
        <TopConductores limite={10} />
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-6">
          <h3 className="text-emerald-400 font-semibold mb-2">
            📈 Mejor Día de Cobro
          </h3>
          <p className="text-white text-2xl font-bold mb-1">Lunes</p>
          <p className="text-gray-400 text-sm">
            Promedio: $43,500 por día
          </p>
        </div>

        <div className="glass border border-blue-500/20 bg-blue-500/5 rounded-xl p-6">
          <h3 className="text-blue-400 font-semibold mb-2">
            ⏰ Hora Pico
          </h3>
          <p className="text-white text-2xl font-bold mb-1">9:00 - 11:00 AM</p>
          <p className="text-gray-400 text-sm">
            60% de los pagos diarios
          </p>
        </div>

        <div className="glass border border-purple-500/20 bg-purple-500/5 rounded-xl p-6">
          <h3 className="text-purple-400 font-semibold mb-2">
            💳 Método Preferido
          </h3>
          <p className="text-white text-2xl font-bold mb-1">Efectivo</p>
          <p className="text-gray-400 text-sm">
            75% de las transacciones
          </p>
        </div>
      </div>
    </div>
  );
};

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

export default Estadisticas;