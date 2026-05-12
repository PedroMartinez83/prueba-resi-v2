import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Calendar, 
  FileText, 
  ExternalLink, 
  TrendingUp, 
  CheckCircle,
  Clock,
  Landmark
} from 'lucide-react';
import inversionistaService from '../../services/inversionistaService'; // Ajusta tu ruta

const InversionistaPagos = () => {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🌐 CARGAR DATOS
  useEffect(() => {
    const fetchPagos = async () => {
      try {
        const response = await inversionistaService.getHistorialPagos();
        // Asumiendo que tu backend devuelve { success: true, pagos: [...] }
        if (response.success) {
          setPagos(response.pagos || []);
        }
      } catch (error) {
        console.error("Error al cargar el historial de pagos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPagos();
  }, []);

  // 🛠️ UTILIDADES
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });
  };

  // 🧮 ESTADÍSTICAS DEL INVERSIONISTA
  const stats = useMemo(() => {
    const pagosCompletados = pagos.filter(p => p.status === 'Completado');
    const totalRecibido = pagosCompletados.reduce((sum, pago) => sum + parseFloat(pago.monto_total || 0), 0);
    
    // Buscar la fecha del último pago
    let ultimoPagoDate = null;
    if (pagosCompletados.length > 0) {
      const fechas = pagosCompletados.map(p => new Date(p.fecha_pago_real));
      ultimoPagoDate = new Date(Math.max(...fechas));
    }

    return {
      totalRecibido,
      cantidadPagos: pagosCompletados.length,
      ultimoPago: ultimoPagoDate ? formatDate(ultimoPagoDate) : 'Aún no hay pagos'
    };
  }, [pagos]);

  return (
    <div className="space-y-6">
      
      {/* 🟢 HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Landmark className="w-8 h-8 text-emerald-400" />
          Historial de Pagos
        </h1>
        <p className="text-gray-400">Consulta los rendimientos y depósitos transferidos a tu cuenta.</p>
      </div>

      {/* 🟢 TARJETAS DE RESUMEN (ESTILO DASHBOARD) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Cobrado (Rendimiento + Inversión)</p>
              <h2 className="text-3xl font-bold text-emerald-400">{formatCurrency(stats.totalRecibido)}</h2>
            </div>
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400 mb-1">Pagos Recibidos</p>
              <h2 className="text-3xl font-bold text-white">{stats.cantidadPagos} <span className="text-sm font-normal text-gray-400">cuotas</span></h2>
            </div>
            <div className="p-3 bg-cyan-500/20 rounded-xl">
              <CheckCircle className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400 mb-1">Último Depósito</p>
              <h2 className="text-xl font-bold text-white mt-2">{stats.ultimoPago}</h2>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Calendar className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 🟢 LISTA DE PAGOS */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h3 className="text-lg font-bold text-white">Detalle de Transacciones</h3>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-400 mt-4">Cargando tu historial...</p>
          </div>
        ) : pagos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sin movimientos</h3>
            <p className="text-gray-400">Aún no se han registrado pagos en tus contratos activos.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {pagos.map((pago) => (
              <div key={pago.id} className="p-6 hover:bg-white/5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Info del Pago */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <DollarSign className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                      Pago de Rendimiento
                      <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full border border-cyan-500/30">
                        {pago.modelo_negocio || 'Inversión'}
                      </span>
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(pago.fecha_pago_real)}
                      </span>
                      <span className="text-white/20">•</span>
                      <span className="flex items-center gap-1 text-purple-400">
                        <FileText className="w-4 h-4" />
                        Cuota {pago.numero_cuota}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Monto y Comprobante */}
                <div className="flex items-center justify-between md:justify-end gap-6 md:w-1/3">
                  <div className="text-left md:text-right">
                    <p className="text-sm text-gray-400 mb-0.5">Monto Depositado</p>
                    <p className="text-xl font-bold text-emerald-400">{formatCurrency(pago.monto_total)}</p>
                  </div>
                  
                  {pago.comprobante_url ? (
                    <a 
                      href={pago.comprobante_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg transition-colors font-medium text-sm"
                    >
                      Ticket <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="px-4 py-2 text-sm text-gray-500 italic bg-white/5 rounded-lg border border-transparent">
                      Sin comprobante
                    </span>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default InversionistaPagos;