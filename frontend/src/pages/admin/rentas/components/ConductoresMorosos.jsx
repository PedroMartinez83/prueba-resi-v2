import React from 'react';
import { AlertTriangle, Phone, Car, DollarSign, TrendingDown } from 'lucide-react';

// ✅ Componente "tonto" - Solo recibe y muestra datos
const ConductoresMorosos = ({ datos = [], loading = false, limite = 5 }) => {
  const morosos = datos
    .filter((conductor) => (conductor?.deuda_aproximada ?? 0) > 0)
    .slice(0, limite);

  const getDelayStyles = (deuda = 0, debido = 0) => {
    if (!debido || deuda <= 0) {
      return {
        badge: 'text-gray-300 bg-white/10',
        card: 'border border-white/10 bg-white/5 hover:border-white/20',
        amount: 'text-gray-300',
        deudaBg: 'bg-emerald-500/10 border-emerald-500/30'
      };
    }

    // Calcular porcentaje de deuda pendiente
    const porcentajeDeuda = (deuda / debido) * 100;

    if (porcentajeDeuda >= 80) {
      return {
        badge: 'text-red-400 bg-red-500/20',
        card: 'border border-red-500/20 bg-red-500/5 hover:border-red-500/40',
        amount: 'text-red-400',
        deudaBg: 'bg-red-500/10 border-red-500/30'
      };
    }

    if (porcentajeDeuda >= 50) {
      return {
        badge: 'text-amber-400 bg-amber-500/20',
        card: 'border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40',
        amount: 'text-amber-400',
        deudaBg: 'bg-amber-500/10 border-amber-500/30'
      };
    }

    if (porcentajeDeuda >= 20) {
      return {
        badge: 'text-yellow-400 bg-yellow-500/20',
        card: 'border border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/40',
        amount: 'text-yellow-400',
        deudaBg: 'bg-yellow-500/10 border-yellow-500/30'
      };
    }

    return {
      badge: 'text-emerald-400 bg-emerald-500/20',
      card: 'border border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40',
      amount: 'text-emerald-400',
      deudaBg: 'bg-emerald-500/10 border-emerald-500/30'
    };
  };

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!morosos.length) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-3">
          <AlertTriangle className="h-8 w-8 text-emerald-400" />
        </div>
        <p className="text-gray-400">¡Excelente! No hay conductores con deuda pendiente</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {morosos.map((conductor, idx) => (
        (() => {
          const deuda = conductor.deuda_aproximada || 0;
          const debido = conductor.total_debido || 1;
          const pagado = conductor.total_pagado || 0;
          const porcentajePago = conductor.porcentaje_pago || 0;
          const styles = getDelayStyles(deuda, debido);

          return (
            <div
              key={conductor.id || idx}
              className={`glass rounded-xl p-4 transition-all ${styles.card}`}
            >
              {/* Header: Nombre y badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-white font-semibold flex items-center gap-2 mb-2">
                    {conductor.nombre || conductor.nombre_conductor}
                    <span className={`text-xs px-2 py-0.5 rounded ${styles.badge}`}>
                      ${parseFloat(deuda).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} adeudado
                    </span>
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Car className="h-3 w-3" />
                      {conductor.vehiculo || conductor.numero_vehiculo}
                    </span>
                    {conductor.telefono && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {conductor.telefono}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Deuda destacada con barra de progreso */}
              <div className={`p-3 rounded-lg border mb-3 ${styles.deudaBg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className={`h-5 w-5 ${styles.amount}`} />
                    <div>
                      <p className="text-sm text-gray-400">Deuda pendiente</p>
                      <p className={`text-lg font-bold ${styles.amount}`}>
                        ${parseFloat(deuda).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Pagado</p>
                    <p className="text-sm font-semibold text-emerald-400">
                      {parseFloat(porcentajePago).toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                {/* Barra de progreso */}
                <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.min(parseFloat(porcentajePago), 100)}%` }}
                  />
                </div>
              </div>

              {/* Detalles de deuda */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="bg-white/5 border border-white/10 rounded p-2">
                  <p className="text-gray-400">Total debido</p>
                  <p className="text-white font-semibold">
                    ${parseFloat(debido).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded p-2">
                  <p className="text-gray-400">Pagado hasta hoy</p>
                  <p className="text-emerald-400 font-semibold">
                    ${parseFloat(pagado).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              
              {/* Último pago */}
              {conductor.ultimo_pago && (
                <p className="text-xs text-gray-500">
                  Último pago: {new Date(conductor.ultimo_pago).toLocaleDateString('es-MX')}
                </p>
              )}
            </div>
          );
        })()
      ))}
    </div>
  );
};

export default ConductoresMorosos;
