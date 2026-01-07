import React, { useState, useEffect } from 'react';
import { X, History, Calendar, DollarSign, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import adminService from '../../../../services/adminService';
const ModalHistorial = ({ conductorId, nombreConductor, onClose }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);

  useEffect(() => {
    if (conductorId) {
      cargarHistorial();
    }
  }, [conductorId]);

  const cargarHistorial = async () => {
    try {
      setLoading(true);
      const data = await adminService.getHistorialPagosConductor(conductorId);
      setHistorial(data.historial || []);
      setEstadisticas(data.estadisticas || null);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatearDinero = (monto) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(monto);
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const configs = {
      'Pendiente': { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Clock },
      'Confirmado': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle },
      'Rechazado': { bg: 'bg-red-500/20', text: 'text-red-400', icon: X }
    };
    const config = configs[status] || configs['Pendiente'];
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${config.bg} ${config.text}`}>
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-2xl font-bold text-white">Historial de Pagos</h2>
              <p className="text-gray-400 text-sm mt-1">{nombreConductor}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Estadísticas Resumen */}
        {estadisticas && (
          <div className="p-6 border-b border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass border border-white/10 rounded-xl p-4 text-center">
                <DollarSign className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
                <p className="text-gray-400 text-xs mb-1">Total Pagado</p>
                <p className="text-white font-bold text-lg">
                  {formatearDinero(estadisticas.total_pagado || 0)}
                </p>
              </div>
              <div className="glass border border-white/10 rounded-xl p-4 text-center">
                <CheckCircle className="h-5 w-5 text-blue-400 mx-auto mb-2" />
                <p className="text-gray-400 text-xs mb-1">Pagos Totales</p>
                <p className="text-white font-bold text-lg">
                  {estadisticas.total_pagos || 0}
                </p>
              </div>
              <div className="glass border border-white/10 rounded-xl p-4 text-center">
                <TrendingUp className="h-5 w-5 text-purple-400 mx-auto mb-2" />
                <p className="text-gray-400 text-xs mb-1">Promedio por Pago</p>
                <p className="text-white font-bold text-lg">
                  {formatearDinero(estadisticas.promedio_pago || 0)}
                </p>
              </div>
              <div className="glass border border-white/10 rounded-xl p-4 text-center">
                <Calendar className="h-5 w-5 text-amber-400 mx-auto mb-2" />
                <p className="text-gray-400 text-xs mb-1">Último Pago</p>
                <p className="text-white font-bold text-sm">
                  {estadisticas.ultimo_pago 
                    ? formatearFecha(estadisticas.ultimo_pago)
                    : 'N/A'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Pagos */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-400">Cargando historial...</p>
            </div>
          ) : historial.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No hay pagos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map((pago) => (
                <div
                  key={pago.id}
                  className="glass border border-white/10 rounded-xl p-4 hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-gray-400 text-sm font-mono">
                          #{String(pago.id).padStart(6, '0')}
                        </span>
                        {getStatusBadge(pago.status)}
                        <span className="text-gray-400 text-sm">
                          {formatearFecha(pago.fecha_pago)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mt-3">
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Renta</p>
                          <p className="text-white font-medium text-sm">
                            {formatearDinero(pago.monto_renta_pagado)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Póliza</p>
                          <p className="text-white font-medium text-sm">
                            {formatearDinero(pago.monto_poliza_pagado)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Total</p>
                          <p className="text-emerald-400 font-bold text-sm">
                            {formatearDinero(pago.monto_total)}
                          </p>
                        </div>
                      </div>

                      {pago.metodo_pago && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">
                            Método: <span className="text-gray-400">{pago.metodo_pago}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur border-t border-white/10 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalHistorial;