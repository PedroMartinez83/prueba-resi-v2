import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Briefcase, Calendar, DollarSign, Car, FileText, ChevronRight, X, AlertTriangle, CheckCircle, PauseCircle, Plus, Clock, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext'; // Ajusta la ruta según tu proyecto
import adminService from '../../services/adminService'; // O inversionistaService, el que uses para fetchWithAut
import inversionistaService from '../../services/inversionistaService';
import ModalSolicitudInversion from '../../components/inversiones/ModalSolicitudInversion.jsx'

const InversionistaContratos = () => {
  const { user } = useAuth();
  const [inversiones, setInversiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contratoSeleccionado, setContratoSeleccionado] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [modalMotivo, setModalMotivo] = useState(false);
  const [motivoTexto, setMotivoTexto] = useState('');



  // 1. 🌐 Sacamos la función y la envolvemos en useCallback
  const fetchContratos = useCallback(async () => {
    try {
      if (user?.inversionistaId) {
        // 1️⃣ Cargar los contratos activos (Lo que ya tenías)
        const responseContratos = await inversionistaService.fetchWithAuth(`/admin/inversionistas/${user.inversionistaId}`);
        if (responseContratos.success && responseContratos.inversiones) {
          setInversiones(responseContratos.inversiones);
        }

        // 2️⃣ Cargar el historial de solicitudes (🚀 ¡LO NUEVO!)
        // Asegúrate de tener importado inversionistaService arriba en tu archivo
        const responseSolicitudes = await inversionistaService.getMisSolicitudes();
        if (responseSolicitudes.success && responseSolicitudes.solicitudes) {
          setMisSolicitudes(responseSolicitudes.solicitudes);
        }
      }
    } catch (error) {
      console.error("Error cargando contratos y solicitudes:", error);
    } finally {
      setLoading(false);
    }
  }, [user]); // 👈 Le decimos que dependa de 'user'

  // 🌐 Cargar los datos del Inversionista
  useEffect(() => {
    fetchContratos();
  }, [fetchContratos]);

  

  // 🚀 FILTRO: Solo contratos válidos (ignoramos los 'Eliminado')
  const contratosValidos = useMemo(() => {
    return inversiones.filter(inv => inv.status !== 'Eliminado');
  }, [inversiones]);

  // 🛠️ Funciones de Formato
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // 🎨 Lógica de Colores por Status
  const getStatusConfig = (status) => {
    switch (status) {
      case 'Activa':
        return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle };
      case 'Rescindido':
        return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: AlertTriangle };
      case 'Pausado':
        return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: PauseCircle };
      case 'Finalizado':
        return { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: CheckCircle };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', icon: Briefcase };
    }
  };

    // 🚀 FUNCIÓN PARA ENVIAR LA SOLICITUD AL BACKEND
  const handleEnviarSolicitud = async (formData) => {
    setIsSubmitting(true);
    try {
      // Llamamos al método que creaste en tu InversionistaService
      const response = await inversionistaService.crearSolicitud({
        monto_inversion: formData.monto_inversion,
        modelo_negocio: formData.modelo_negocio,
        comprobante_url: formData.comprobante_url
      });

      if (response.success) {
        // Cerramos el modal
        setIsModalOpen(false);
        // Opcional: Podrías mostrar una notificación bonita o un Toast aquí
        alert('¡Solicitud enviada con éxito! La revisaremos pronto.');

        fetchContratos();
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="text-white p-8">Cargando tus contratos...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* 🟢 HEADER CON BOTÓN */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Mis Contratos</h1>
          <p className="text-gray-400">Administra y consulta el estado de tus inversiones.</p>
        </div>
        
        {/* El Botón Mágico */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Nueva Solicitud de Inversión
        </button>
      </div>

      {/* 🟢 GRID DE CONTRATOS */}
      {contratosValidos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contratosValidos.map((contrato) => {
            const statusConfig = getStatusConfig(contrato.status);
            const StatusIcon = statusConfig.icon;

            return (
              <div 
                key={contrato.id || contrato.id_inversion} 
                className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:border-cyan-500/30 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Etiqueta de Status y Folio */}
                  <div className="flex justify-between items-start mb-4">
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {contrato.status}
                    </span>
                    <span className="text-gray-500 text-sm font-mono">#{contrato.id || contrato.id_inversion}</span>
                  </div>

                  {/* Vehículo o Plan */}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Car className="w-5 h-5 text-cyan-400" />
                      {contrato.vehiculo_numero ? `Vehículo ${contrato.vehiculo_numero}` : (contrato.modelo_negocio || 'Plan General')}
                    </h3>
                  </div>

                  {/* 📊 BARRA DE PROGRESO DEL CONTRATO */}
                  <div className="mb-6 bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium text-gray-400">Progreso de pagos</span>
                      <span className="text-lg font-bold text-cyan-400">
                        {Number(contrato.porcentaje_pagado || 0).toFixed(1)}%
                      </span>
                    </div>
                    {/* El fondo de la barra */}
                    <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                      {/* El relleno de la barra (con gradiente y animación) */}
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${Math.min(Number(contrato.porcentaje_pagado || 0), 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Datos Financieros */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" /> Capital Invertido</span>
                      <span className="text-white font-medium">{formatCurrency(contrato.monto_invertido)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm flex items-center gap-2"><Calendar className="w-4 h-4" /> Fecha Inicio</span>
                      <span className="text-white font-medium">{formatDate(contrato.fecha_inicio)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" /> Total pagado </span>
                      <span className="text-white font-medium">{formatCurrency(contrato.total_pagado)}</span>
                    </div>
                  </div>
                </div>

                {/* Botón de Detalles */}
                <button 
                  onClick={() => setContratoSeleccionado(contrato)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-cyan-400 border border-white/10 rounded-xl transition-colors font-medium"
                >
                  <FileText className="w-4 h-4" />
                  Ver Detalles completos
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <Briefcase className="w-16 h-16 text-gray-500 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-white mb-2">No tienes contratos activos</h3>
          <p className="text-gray-400">Aún no hay registros de inversión asociados a tu cuenta.</p>
        </div>
      )}

      {/* ========================================= */}
        {/* 🟢 SECCIÓN: MIS SOLICITUDES DE INVERSIÓN */}
        {/* ========================================= */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-cyan-400" />
            Historial de Solicitudes
          </h2>

          {misSolicitudes.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center border border-white/5">
              <p className="text-gray-400">No tienes solicitudes en proceso ni en el historial.</p>
            </div>
          ) : (
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-gray-400 text-sm">
                      <th className="p-4 font-medium whitespace-nowrap">Fecha</th>
                      <th className="p-4 font-medium whitespace-nowrap">Plan de Inversión</th>
                      <th className="p-4 font-medium whitespace-nowrap">Monto</th>
                      <th className="p-4 font-medium whitespace-nowrap">Comprobante</th>
                      <th className="p-4 font-medium whitespace-nowrap">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {misSolicitudes.map((sol) => (
                      <tr key={sol.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-gray-300 whitespace-nowrap">
                          {formatDate(sol.created_at)}
                        </td>
                        <td className="p-4 text-white font-medium whitespace-nowrap">
                          {sol.modelo_negocio}
                        </td>
                        <td className="p-4 text-cyan-400 font-bold whitespace-nowrap">
                          {formatCurrency(sol.monto_invertido)}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {sol.comprobante_url ? (
                            <a 
                              href={sol.comprobante_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                            >
                              <FileText className="w-4 h-4" /> Ver
                            </a>
                          ) : (
                            <span className="text-gray-500 italic">N/A</span>
                          )}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          {/* Insignias de Estado */}
                          <div className="flex flex-col gap-2 items-start">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                              sol.estado_aceptacion === 'Pendiente' 
                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' 
                              : sol.estado_aceptacion === 'Aceptada'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }`}>
                              {sol.estado_aceptacion}
                            </span>
                            
                            {/* 🚀 BOTÓN: VER MOTIVO DE RECHAZO */}
                            {sol.estado_aceptacion === 'Rechazada' && sol.motivo_rechazo && (
                              <button
                                onClick={() => {
                                  setMotivoTexto(sol.motivo_rechazo);
                                  setModalMotivo(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 mt-1 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg transition-colors text-xs font-medium"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                                Ver Motivo
                              </button>
                            )}

                            {/* 🚀 BOTÓN DE DEVOLUCIÓN DE DINERO */}
                            {sol.estado_aceptacion === 'Rechazada' && sol.comprobante_devolucion_url && (
                              <a 
                                href={sol.comprobante_devolucion_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 mt-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors text-xs font-medium"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Ver Devolución
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      {/* 🟢 MODAL DE DETALLES */}
      {contratoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            
            {/* Header del Modal */}
            <div className="sticky top-0 bg-[#1a1a2e] p-6 border-b border-white/10 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold text-white">Detalle del Contrato</h2>
                <p className="text-gray-400 font-mono">Folio #{contratoSeleccionado.id || contratoSeleccionado.id_inversion}</p>
              </div>
              <button 
                onClick={() => setContratoSeleccionado(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-6">
              
              {/* Bloque Financiero Principal */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <p className="text-gray-400 text-sm mb-1">Monto Invertido</p>
                  <p className="text-2xl font-bold text-teal-400">{formatCurrency(contratoSeleccionado.monto_invertido)}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <p className="text-gray-400 text-sm mb-1">Total a Recibir (Estimado)</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(contratoSeleccionado.monto_total_contrato)}</p>
                </div>
              </div>

                    {/* 📊 BARRA DE PROGRESO DEL CONTRATO */}
                  <div className="mb-6 bg-black/20 p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-sm font-medium text-gray-400">Progreso de pagos</span>
                      <span className="text-lg font-bold text-cyan-400">
                        {Number(contratoSeleccionado.porcentaje_pagado || 0).toFixed(1)}%
                      </span>
                    </div>
                    {/* El fondo de la barra */}
                    <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                      {/* El relleno de la barra (con gradiente y animación) */}
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${Math.min(Number(contratoSeleccionado.porcentaje_pagado || 0), 100)}%` }}
                      ></div>
                    </div>
                  </div>

              {/* Información Detallada */}
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/10 bg-white/5">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Términos del Contrato
                  </h3>
                </div>
                <div className="divide-y divide-white/5">
                  <div className="flex justify-between p-4">
                    <span className="text-gray-400">Plazo</span>
                    <span className="text-white font-medium">{contratoSeleccionado.plazo_meses} meses</span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-gray-400">Pagos Mensuales</span>
                    <span className="text-white font-medium">{formatCurrency(contratoSeleccionado.pago_mensual)}</span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-gray-400">Fecha de Inicio</span>
                    <span className="text-white font-medium">{formatDate(contratoSeleccionado.fecha_inicio)}</span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-gray-400">Fecha de Vencimiento</span>
                    <span className="text-white font-medium">{formatDate(contratoSeleccionado.fecha_fin_estimada)}</span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-gray-400">Pagos Realizados</span>
                    <span className="text-white font-medium">{contratoSeleccionado.pagos_realizados || 0} de {contratoSeleccionado.plazo_meses}</span>
                  </div>
                </div>
              </div>

              {/* Si está rescindido, mostramos por qué */}
              {(contratoSeleccionado.motivo_rescision || contratoSeleccionado.motivo_rescision_contrato) && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <h3 className="font-bold text-red-400 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Motivo de Rescisión
                  </h3>
                  <p className="text-red-300 text-sm">
                    {contratoSeleccionado.motivo_rescision || contratoSeleccionado.motivo_rescision_contrato}
                  </p>
                </div>
              )}

            </div>
            
            {/* Footer del Modal */}
            <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end">
              <button 
                onClick={() => setContratoSeleccionado(null)}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors font-medium"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
      {/* 🟢 MODALES AL FINAL DEL COMPONENTE */}
      <ModalSolicitudInversion 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleEnviarSolicitud}
        loading={isSubmitting}
      />

      {/* 🔴 Modal para leer el Motivo de Rechazo */}
      {modalMotivo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-white/10 p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <MessageSquare className="w-6 h-6" /> Detalles del Rechazo
            </h3>
            
            <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-6">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {motivoTexto}
              </p>
            </div>

            <button
              onClick={() => {
                setModalMotivo(false);
                setMotivoTexto('');
              }}
              className="w-full px-4 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all font-medium border border-white/10"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>

    
  );
};

export default InversionistaContratos;