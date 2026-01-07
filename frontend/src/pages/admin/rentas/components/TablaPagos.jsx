import React from 'react';
import { 
  Eye, 
  Check, 
  X, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  DollarSign
} from 'lucide-react';

const TablaPagos = ({ 
  pagos, 
  loading, 
  pagination,
  onVerDetalles,
  onValidar,
  onRechazar,
  onCambiarPagina
}) => {

  const getStatusBadge = (status) => {
    const configs = {
      'Pendiente': {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        icon: Clock
      },
      'Confirmado': {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        icon: Check
      },
      'Rechazado': {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        icon: X
      }
    };

    const config = configs[status] || configs['Pendiente'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatearDinero = (monto) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(monto);
  };

  if (loading) {
    return (
      <div className="glass border border-white/10 rounded-xl p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-gray-400">Cargando pagos...</p>
        </div>
      </div>
    );
  }

  if (!pagos?.length) {
    return (
      <div className="glass border border-white/10 rounded-xl p-8">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold mb-2">No hay pagos</h3>
          <p className="text-gray-400">No se encontraron pagos con los filtros seleccionados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass border border-white/10 rounded-xl overflow-hidden">
      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full">
          <thead className="bg-gray-800/50 border-b border-white/10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Folio</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Conductor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Vehículo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Monto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Método</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {pagos.map((pago) => (
              <tr 
                key={pago.id} 
                className="hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-4">
                  <span className="text-white font-mono text-sm">
                    #{String(pago.id).padStart(6, '0')}
                  </span>
                </td>
                
                <td className="px-4 py-4">
                  <span className="text-gray-300 text-sm">
                    {formatearFecha(pago.fecha_pago)}
                  </span>
                </td>
                
                <td className="px-4 py-4">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {pago.nombre_conductor}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {pago.numero_telefono}
                    </p>
                  </div>
                </td>
                
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">
                      {pago.numero_vehiculo}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      pago.tipo_socio === 'SD' ? 'bg-blue-500/20 text-blue-400' :
                      pago.tipo_socio === 'SI' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-orange-500/20 text-orange-400'
                    }`}>
                      {pago.tipo_socio}
                    </span>
                  </div>
                </td>
                
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <DollarSign className="h-4 w-4" />
                    {formatearDinero(pago.monto_total)}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Renta: {formatearDinero(pago.monto_renta_pagado)} + 
                    Póliza: {formatearDinero(pago.monto_poliza_pagado)}
                  </p>
                </td>
                
                <td className="px-4 py-4">
                  <span className="text-gray-300 text-sm">
                    {pago.metodo_pago || 'N/A'}
                  </span>
                </td>
                
                <td className="px-4 py-4">
                  {getStatusBadge(pago.status)}
                </td>
                
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onVerDetalles(pago)}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    
                    {pago.status === 'Pendiente' && (
                      <>
                        <button
                          onClick={() => onValidar(pago)}
                          className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                          title="Validar pago"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => onRechazar(pago)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Rechazar pago"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {pagination && (
        <div className="border-t border-white/10 px-4 py-3 bg-gray-800/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} pagos
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => onCambiarPagina(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <span className="text-white font-medium">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              
              <button
                onClick={() => onCambiarPagina(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablaPagos;
