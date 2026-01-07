import React from 'react';
import { X, User, Car, DollarSign, Calendar, CreditCard, FileText, Clock } from 'lucide-react';

const ModalDetalles = ({ pago, onClose }) => {
  if (!pago) return null;

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearDinero = (monto) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(monto);
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pendiente': 'text-amber-400 bg-amber-500/20',
      'Confirmado': 'text-emerald-400 bg-emerald-500/20',
      'Rechazado': 'text-red-400 bg-red-500/20'
    };
    return colors[status] || colors['Pendiente'];
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90svh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900/95 backdrop-blur border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Detalles del Pago</h2>
            <p className="text-gray-400 text-sm mt-1">
              Folio #{String(pago.id).padStart(6, '0')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Estado */}
          <div className="text-center py-4">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-lg font-semibold ${getStatusColor(pago.status)}`}>
              {pago.status === 'Pendiente' && <Clock className="h-5 w-5" />}
              {pago.status === 'Confirmado' && <FileText className="h-5 w-5" />}
              {pago.status}
            </span>
          </div>

          {/* Información del Conductor */}
          <div className="glass border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-5 w-5 text-primary" />
              <h3 className="text-white font-semibold">Información del Conductor</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Nombre</p>
                <p className="text-white font-medium">{pago.nombre_conductor}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Teléfono</p>
                <p className="text-white font-medium">{pago.numero_telefono}</p>
              </div>
              {pago.status_conductor && (
                <div>
                  <p className="text-gray-400 text-sm">Estado</p>
                  <p className="text-white font-medium">{pago.status_conductor}</p>
                </div>
              )}
            </div>
          </div>

          {/* Información del Vehículo */}
          <div className="glass border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Car className="h-5 w-5 text-primary" />
              <h3 className="text-white font-semibold">Información del Vehículo</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">Número de Vehículo</p>
                <p className="text-white font-medium">{pago.numero_vehiculo}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Tipo de Socio</p>
                <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                  pago.tipo_socio === 'SD' ? 'bg-blue-500/20 text-blue-400' :
                  pago.tipo_socio === 'SI' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-orange-500/20 text-orange-400'
                }`}>
                  {pago.tipo_socio}
                </span>
              </div>
              {pago.tipo_vehiculo && (
                <div>
                  <p className="text-gray-400 text-sm">Tipo de Vehículo</p>
                  <p className="text-white font-medium">{pago.tipo_vehiculo}</p>
                </div>
              )}
              {(pago.marca || pago.modelo) && (
                <div>
                  <p className="text-gray-400 text-sm">Marca/Modelo</p>
                  <p className="text-white font-medium">
                    {[pago.marca, pago.modelo].filter(Boolean).join(' ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Detalles del Pago */}
          <div className="glass border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="text-white font-semibold">Detalles del Pago</h3>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 border-b border-white/10">
                <span className="text-gray-400">Monto de Renta</span>
                <span className="text-white font-semibold">{formatearDinero(pago.monto_renta_pagado)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 border-b border-white/10">
                <span className="text-gray-400">Monto de Póliza</span>
                <span className="text-white font-semibold">{formatearDinero(pago.monto_poliza_pagado)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2 bg-primary/10 rounded-lg px-3">
                <span className="text-white font-semibold">Total Pagado</span>
                <span className="text-primary text-xl font-bold">{formatearDinero(pago.monto_total)}</span>
              </div>
            </div>
          </div>

          {/* Método de Pago y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <p className="text-gray-400 text-sm">Método de Pago</p>
              </div>
              <p className="text-white font-semibold">{pago.metodo_pago || 'No especificado'}</p>
            </div>
            <div className="glass border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-primary" />
                <p className="text-gray-400 text-sm">Fecha de Pago</p>
              </div>
              <p className="text-white font-semibold">
                {new Date(pago.fecha_pago).toLocaleDateString('es-MX')}
              </p>
            </div>
          </div>

          {/* Información Adicional */}
          {(pago.created_at || pago.updated_at || pago.registrado_por) && (
            <div className="glass border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-primary" />
                <h3 className="text-white font-semibold">Información del Sistema</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pago.created_at && (
                  <div>
                    <p className="text-gray-400 text-sm">Creado</p>
                    <p className="text-white text-sm">{formatearFecha(pago.created_at)}</p>
                  </div>
                )}
                {pago.updated_at && (
                  <div>
                    <p className="text-gray-400 text-sm">Actualizado</p>
                    <p className="text-white text-sm">{formatearFecha(pago.updated_at)}</p>
                  </div>
                )}
                {pago.registrado_por && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-400 text-sm">Registrado por</p>
                    <p className="text-white font-medium">{pago.registrado_por}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(pago.observaciones || pago.comprobante_url) && (
            <div className="glass border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="text-white font-semibold">Información Adicional</h3>
              </div>
              <div className="space-y-3">
                {pago.observaciones && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Observaciones</p>
                    <p className="text-white">{pago.observaciones}</p>
                  </div>
                )}
                {pago.comprobante_url && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Comprobante</p>
                    <a
                      href={pago.comprobante_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-light underline"
                    >
                      Ver comprobante
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-900/95 backdrop-blur border-t border-white/10 px-4 sm:px-6 py-4">
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

export default ModalDetalles;
