//
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
import adminService from '../../../services/adminService';

const Estadisticas = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [periodo, setPeriodo] = useState('30'); // días
  const [mesesHistorico, setMesesHistorico] = useState('12');

  useEffect(() => {
    cargarEstadisticas();
  }, [periodo]);

  const toDateParam = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const calcularRangoPeriodo = (dias) => {
    const totalDias = Number(dias) || 30;
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(hoy.getDate() - (totalDias - 1));
    return {
      fecha_desde: toDateParam(desde),
      fecha_hasta: toDateParam(hoy)
    };
  };

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      const rango = calcularRangoPeriodo(periodo);
      const data = await adminService.getEstadisticasPagosRentas(rango);
      setEstadisticas({
        ...(data.estadisticas || {}),
        insights: data.insights || data.estadisticas?.insights || null
      });
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

  const periodosHistoricos = [
    { valor: '3', label: '3 meses' },
    { valor: '6', label: '6 meses' },
    { valor: '12', label: '12 meses' },
    { valor: '18', label: '18 meses' }
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
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300">Historico:</label>
            <select
              value={mesesHistorico}
              onChange={(e) => setMesesHistorico(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-primary"
            >
              {periodosHistoricos.map((item) => (
                <option key={item.valor} value={item.valor} className="text-black">
                  Ultimos {item.label}
                </option>
              ))}
            </select>

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
      <EstadisticasCards estadisticas={estadisticas} loading={loading} periodo={periodo} />

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
          <GraficaTendencias meses={parseInt(mesesHistorico, 10)} />
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
            Mejor dia de cobro
          </h3>
          <p className="text-white text-2xl font-bold mb-1">
            {estadisticas?.insights?.mejor_dia || '-'}
          </p>
          <p className="text-gray-400 text-sm">
            {periodo ? `Periodo: ultimos ${periodo} dias` : 'Periodo seleccionado'}
          </p>
        </div>

        <div className="glass border border-blue-500/20 bg-blue-500/5 rounded-xl p-6">
          <h3 className="text-blue-400 font-semibold mb-2">
            Hora pico
          </h3>
          <p className="text-white text-2xl font-bold mb-1">
            {estadisticas?.insights?.hora_pico || '-'}
          </p>
          <p className="text-gray-400 text-sm">
            {periodo ? `Periodo: ultimos ${periodo} dias` : 'Periodo seleccionado'}
          </p>
        </div>

        <div className="glass border border-purple-500/20 bg-purple-500/5 rounded-xl p-6">
          <h3 className="text-purple-400 font-semibold mb-2">
            Metodo preferido
          </h3>
          <p className="text-white text-2xl font-bold mb-1">
            {estadisticas?.insights?.metodo_preferido || '-'}
          </p>
          <p className="text-gray-400 text-sm">
            {periodo ? `Periodo: ultimos ${periodo} dias` : 'Periodo seleccionado'}
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
