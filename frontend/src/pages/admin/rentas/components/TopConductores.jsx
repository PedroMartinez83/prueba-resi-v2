import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Car } from 'lucide-react';
import adminService from '../../../../services/adminService';

// ✅ Componente que carga y muestra los datos
const TopConductores = ({ limite = 10 }) => {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, [limite]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const response = await adminService.getTopConductores({ limite });
      setDatos(response?.top_conductores || []);
    } catch (error) {
      console.error('Error al cargar top conductores:', error);
      setDatos([]);
    } finally {
      setLoading(false);
    }
  };

  const topConductores = datos.slice(0, limite);

  const getMedalColor = (posicion) => {
    switch (posicion) {
      case 0: return 'from-yellow-400 to-amber-500';
      case 1: return 'from-gray-300 to-gray-400';
      case 2: return 'from-orange-400 to-amber-600';
      default: return 'from-indigo-500 to-purple-500';
    }
  };

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!topConductores.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topConductores.map((conductor, idx) => (
        <div
          key={conductor.id || idx}
          className="glass border border-white/10 rounded-xl p-4 hover:border-primary/30 transition-all"
        >
          <div className="flex items-center gap-4">
            {/* Posición */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${getMedalColor(idx)} flex items-center justify-center`}>
              {idx < 3 ? (
                <Trophy className="h-5 w-5 text-white" />
              ) : (
                <span className="text-white font-bold">{idx + 1}</span>
              )}
            </div>

            {/* Info Conductor */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate">
                {conductor.nombre || conductor.nombre_conductor}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                <Car className="h-3 w-3" />
                <span>{conductor.vehiculo || conductor.numero_vehiculo || 'N/A'}</span>
                {conductor.cumplimiento_porcentaje && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                      {conductor.cumplimiento_porcentaje}% cumplimiento
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Monto Total */}
            <div className="text-right">
              <p className="text-emerald-400 font-bold">
                ${(conductor.total_pagado || 0).toLocaleString('es-MX')}
              </p>
              <p className="text-xs text-gray-400">
                {conductor.total_pagos || 0} pagos
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TopConductores;