import React from 'react';
import { AlertTriangle, Phone, Car } from 'lucide-react';

// ✅ Componente "tonto" - Solo recibe y muestra datos
const ConductoresMorosos = ({ datos = [], loading = false, limite = 5 }) => {
  const morosos = datos
    .filter((conductor) => (conductor?.dias_sin_pagar ?? 0) > 0)
    .slice(0, limite);

  const getDelayStyles = (diasAtraso = 0) => {
    if (diasAtraso >= 3) {
      return {
        badge: 'text-red-400 bg-red-500/20',
        card: 'border border-red-500/20 bg-red-500/5 hover:border-red-500/40',
        amount: 'text-red-400'
      };
    }

    if (diasAtraso === 2) {
      return {
        badge: 'text-amber-400 bg-amber-500/20',
        card: 'border border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40',
        amount: 'text-amber-400'
      };
    }

    if (diasAtraso === 1) {
      return {
        badge: 'text-emerald-400 bg-emerald-500/20',
        card: 'border border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40',
        amount: 'text-emerald-400'
      };
    }

    return {
      badge: 'text-gray-300 bg-white/10',
      card: 'border border-white/10 bg-white/5 hover:border-white/20',
      amount: 'text-gray-300'
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
        <p className="text-gray-400">¡Excelente! No hay conductores con deuda</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {morosos.map((conductor, idx) => (
        (() => {
          const diasAtraso = conductor.dias_sin_pagar || 0;
          const styles = getDelayStyles(diasAtraso);
          const deuda = conductor.deuda_estimada || conductor.monto_adeudado || 0;
          const diasLabel = diasAtraso === 1 ? 'día de atraso' : 'días de atraso';

          return (
        <div
          key={conductor.id || idx}
          className={`glass rounded-xl p-4 transition-all ${styles.card}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-white font-semibold flex items-center gap-2">
                {conductor.nombre || conductor.nombre_conductor}
                <span className={`text-xs px-2 py-0.5 rounded ${styles.badge}`}>
                  {diasAtraso} {diasLabel}
                </span>
              </h3>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
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
            <div className="text-right">
              <p className={`${styles.amount} font-bold`}>
                ${deuda.toLocaleString('es-MX')}
              </p>
              <p className="text-xs text-gray-400">adeudado</p>
            </div>
          </div>
          
          {conductor.ultimo_pago && (
            <p className="text-xs text-gray-500 mt-2">
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
