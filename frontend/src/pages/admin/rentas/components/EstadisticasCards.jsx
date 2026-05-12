import React from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Calendar,
  Users,
  Clock,
  CheckCircle
} from 'lucide-react';

const EstadisticasCards = ({ estadisticas, loading, periodo }) => {

  const formatearDinero = (monto) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(monto);
  };

  const periodoLabel = periodo ? `Ultimos ${periodo} dias` : 'Periodo seleccionado';
  const totalCobradoPeriodo = estadisticas?.total_cobrado_total ?? estadisticas?.total_cobrado ?? 0;
  const totalRentaPeriodo = estadisticas?.total_cobrado_renta ?? 0;
  const totalPolizaPeriodo = estadisticas?.total_ahorrado_poliza ?? 0;

  const cards = [
    {
      titulo: 'Total Cobrado',
      valor: totalCobradoPeriodo,
      formato: 'dinero',
      icono: DollarSign,
      color: 'from-emerald-500 to-teal-500',
      descripcion: periodoLabel
    },
    {
      titulo: 'Total Renta',
      valor: totalRentaPeriodo,
      formato: 'dinero',
      icono: Calendar,
      color: 'from-blue-500 to-indigo-500',
      descripcion: periodoLabel
    },
    {
      titulo: 'Total Poliza',
      valor: totalPolizaPeriodo,
      formato: 'dinero',
      icono: TrendingUp,
      color: 'from-purple-500 to-pink-500',
      descripcion: periodoLabel
    },
    {
      titulo: 'Pendientes de Validar',
      valor: estadisticas?.pendientes_validar || 0,
      formato: 'numero',
      icono: Clock,
      color: 'from-amber-500 to-orange-500',
      descripcion: periodoLabel
    },
    {
      titulo: 'Pagos Confirmados',
      valor: estadisticas?.confirmados || 0,
      formato: 'numero',
      icono: CheckCircle,
      color: 'from-green-500 to-emerald-500',
      descripcion: periodoLabel
    },
    {
      titulo: 'Conductores Activos',
      valor: estadisticas?.conductores_activos || 0,
      formato: 'numero',
      icono: Users,
      color: 'from-cyan-500 to-blue-500',
      descripcion: periodoLabel
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass border border-white/10 rounded-2xl p-6 animate-pulse">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gray-700 rounded-xl"></div>
              <div className="w-16 h-6 bg-gray-700 rounded"></div>
            </div>
            <div className="w-24 h-4 bg-gray-700 rounded mb-2"></div>
            <div className="w-32 h-8 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className="glass border border-white/10 rounded-2xl p-6 hover:border-primary/30 transition-all group"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} group-hover:scale-110 transition-transform`}>
              <card.icono className="h-6 w-6 text-white" />
            </div>

            {card.cambio !== undefined && (
              <div className={`flex items-center gap-1 text-sm ${
                card.cambio >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {card.cambio >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="font-medium">{Math.abs(card.cambio)}%</span>
              </div>
            )}
          </div>

          {/* Contenido */}
          <div>
            <p className="text-gray-400 text-sm mb-2">{card.titulo}</p>
            <p className="text-3xl font-bold text-white mb-1">
              {card.formato === 'dinero'
                ? formatearDinero(card.valor)
                : card.valor.toLocaleString('es-MX')
              }
            </p>
            {card.descripcion && (
              <p className="text-xs text-gray-500">{card.descripcion}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EstadisticasCards;
