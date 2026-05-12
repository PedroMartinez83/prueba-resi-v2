import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, DollarSign, Calendar, User, 
  CheckCircle, Clock, AlertCircle, TrendingUp, Car, Trash2, Edit2, AlertTriangle, PlayCircle
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';
import adminService from '@/services/adminService';
import ModalRegistrarPago from '../../components/inversiones/ModalRegistrarPago';
import ModalRescision from '../../components/inversiones/ModalRescision';

const ContratoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [contrato, setContrato] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModalPago, setShowModalPago] = useState(false);
  const [pagoAEditar, setPagoAEditar] = useState(null);
  const [showModalRescision, setShowModalRescision] = useState(false);

  // Función para manejar la eliminación de un pago
  const handleEliminarPago = async (pago) => {
    // 1. Confirmación de seguridad
    if (!window.confirm(`⚠️ ¿Estás completamente seguro de eliminar el pago de la Cuota #${pago.numero_cuota} por ${formatCurrency(pago.monto_total)}?\n\nEsta acción revertirá los saldos del contrato y no se puede deshacer.`)) {
      return;
    }

    try {
      // 2. Llamada al servicio que creamos
      await adminService.eliminarPagoInversion(pago.id);
      
      alert(`✅ Pago #${pago.numero_cuota} eliminado correctamente.`);
      
      // 3. 🔄 RECARGAR DATOS: Aquí debes llamar a la función que recarga el perfil del inversionista
      // Ejemplo: fetchInversionistaData() o loadData()
      fetchContratoDetalle(); // Recargamos el detalle del contrato para reflejar los cambios
      
    } catch (error) {
      alert(`❌ Error al eliminar el pago:\n${error.message}`);
    }
  };

// Funciones para abrir el modal
  const handleAbrirEditarPago = (pago) => {
    setPagoAEditar(pago);
    setShowModalPago(true);
  };

  // Por si también quieres poner un botón de "Crear Nuevo Pago" aquí en el detalle
  const handleAbrirCrearPago = () => {
    setPagoAEditar(null);
    setShowModalPago(true);
  };

  const handleReanudar = async () => {
    if (!window.confirm('▶️ ¿Estás seguro de reanudar este contrato?\n\nLas fechas de inicio y fin se recalibrarán automáticamente a partir del día de hoy.')) {
      return;
    }

    try {
      // Usamos tu nuevo servicio
      await adminService.reanudarContrato(contrato.id || contrato.id_inversion);
      
      alert('✅ Contrato reanudado exitosamente. Las fechas han sido actualizadas.');
      
      fetchContratoDetalle();
      
    } catch (error) {
      alert(`❌ Error al reanudar: ${error.message}`);
    }
  };

  const handleEliminar = async () => {
    // La advertencia de seguridad en 3 líneas para asustar un poco (por seguridad)
    const confirmar = window.confirm(
      "⚠️ ¡ADVERTENCIA EXTREMA!\n\n" +
      "Estás a punto de ELIMINAR este contrato.\n" +
      "Esta acción lo ocultará del sistema y es irreversible desde esta interfaz.\n\n" +
      "¿Estás completamente seguro de querer borrarlo?"
    );

    if (!confirmar) return;

    try {
      await adminService.eliminarInversion(contrato.id || contrato.id_inversion);
      alert("🗑️ Contrato eliminado correctamente.");
      
      // Lo sacamos de la pantalla porque el contrato ya está eliminado
      navigate(-1); 
      
    } catch (error) {
      alert(`❌ Error al intentar eliminar: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchContratoDetalle();
  }, [id]);

  const fetchContratoDetalle = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/inversiones/contratos/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar contrato');
      }

      const data = await response.json();
      setContrato(data.contrato);
      setPagos(data.pagos);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pagado': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Pendiente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Vencido': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getModeloLabel = (modelo) => {
    const modelos = {
      'SI_LEGADO': 'SI Legado',
      'PLUS_60': 'PLUS 60',
      'SMART_40': 'SMART 40'
    };
    return modelos[modelo] || modelo;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center">
        <div className="glass rounded-2xl p-8 border border-white/10">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <p className="text-white text-lg">Cargando contrato...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !contrato) {
    return (
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 border border-red-500/30 max-w-md w-full">
          <div className="flex items-center space-x-3 text-red-400 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h3 className="text-xl font-bold">Error</h3>
          </div>
          <p className="text-gray-300 mb-6">{error || 'Contrato no encontrado'}</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all font-medium"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const progresoGeneral = stats?.progreso_porcentaje ? stats.progreso_porcentaje.toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          
          {/* LADO IZQUIERDO: Botón atrás y Títulos */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="glass p-3 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Detalle de Contrato</h1>
              <p className="text-gray-400">Contrato #{contrato.id_inversion || contrato.id}</p>
            </div>
          </div>

          {/* LADO DERECHO: Grupo de Botones de Acción */}
          <div className="flex items-center gap-3">
            
            {/* BOTÓN REANUDAR (Solo visible si está pausado) */}
            {contrato.status === 'Pausado' && (
              <button
                onClick={handleReanudar}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600 hover:text-white transition-all duration-300 font-medium"
              >
                <PlayCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Reanudar</span>
              </button>
            )}

            {/* 🗑️ NUEVO BOTÓN ELIMINAR */}
            <button
              onClick={handleEliminar}
              className="flex items-center justify-center p-2.5 bg-gray-500/10 text-gray-400 border border-gray-500/30 rounded-lg hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-all"
              title="Eliminar Contrato"
            >
              <Trash2 className="w-5 h-5" />
              <span className="hidden sm:inline">Eliminar</span>
            </button>

            {/* BOTÓN RESCINDIR / ETIQUETAS ESTÁTICAS */}
            <div>
              {/* Camino 1: Completado */}
              {parseFloat(contrato.saldo_pendiente || 0) <= 0 || contrato.status === 'Finalizado' ? (
                <span className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold">
                  <span className="text-lg leading-none">✓</span>
                  Contrato Completado
                </span>
                
              // Camino 2: Rescindido
              ) : contrato.status === 'Rescindido' ? (
                <span className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg font-bold">
                  <AlertTriangle className="w-5 h-5" /> 
                  Contrato Rescindido
                </span>
                
              // Camino 3: Activo (Botón Rescindir)
              ) : (
                <button
                  onClick={() => setShowModalRescision(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 hover:text-red-300 hover:shadow-lg hover:shadow-red-500/20 transition-all font-medium"
                  title="Rescindir / Cancelar Contrato Legalmente"
                >
                  <AlertTriangle className="w-5 h-5" /> 
                  <span className="hidden sm:inline">Rescindir Contrato</span>
                </button>
              )}
            </div>

          </div>
          
        </div>

        {/* Info del Contrato */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Inversionista */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-cyan-400" />
                <p className="text-gray-400 text-sm">Inversionista</p>
              </div>
              <p className="text-white font-bold text-lg">{contrato.inversionista_nombre}</p>
              <p className="text-gray-400 text-sm">{contrato.inversionista_email}</p>
            </div>

            {/* Plan */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <p className="text-gray-400 text-sm">Plan</p>
              </div>
              <p className="text-white font-bold text-lg">{getModeloLabel(contrato.modelo_negocio)}</p>
              <p className="text-gray-400 text-sm">{contrato.plazo_para_inversionistas} meses</p>
            </div>

            {/* Vehículo o Pool */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Car className="w-5 h-5 text-green-400" />
                <p className="text-gray-400 text-sm">Asignación</p>
              </div>
              {contrato.numero_vehiculo ? (
                <>
                  <p className="text-white font-bold text-lg"> {contrato.numero_vehiculo}</p>
                  <p className="text-gray-400 text-sm">{contrato.marca} {contrato.modelo_vehiculo}</p>
                </>
              ) : (
                <p className="text-white font-bold text-lg">Pool General</p>
              )}
            </div>

            {/* Fecha */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-yellow-400" />
                <p className="text-gray-400 text-sm">Fecha de Inicio</p>
              </div>
              <p className="text-white font-bold text-lg">{formatDate(contrato.fecha_de_inicio)}</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs border mt-2 ${
                contrato.status_inversion === 'Activa' 
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}>
                {contrato.status_inversion}
              </span>
            </div>

          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="glass rounded-xl p-4 border border-cyan-500/30 bg-cyan-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Inversión Total</p>
                <DollarSign className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {formatCurrency(contrato.monto_inversion)}
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Pago Mensual</p>
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-purple-400">
                {formatCurrency(contrato.pago_mensual_inversionista)}
              </p>
            </div>

{/* 🟢 TARJETA: TOTAL PAGADO */}
            <div className="glass rounded-xl p-4 border border-green-500/30 bg-green-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Total Pagado</p>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(stats?.monto_total_pagado || 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {stats?.cuotas_pagadas || 0} de {stats?.plazo_total_meses || 0} cuotas
              </p>
            </div>

            {/* 🟡 TARJETA: POR COBRAR (PENDIENTE) */}
            <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Por Cobrar</p>
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              
              <p className="text-2xl font-bold text-yellow-400">
                {formatCurrency(stats?.monto_total_pendiente || 0)}
              </p>

              <p className="text-xs mt-1">
                {/* 🚀 Lógica Universal: Si ya no se debe dinero ($0), celebramos que está completado */}
                {stats?.monto_total_pendiente === 0 
                  ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      ● Contrato Liquidado / Completado
                    </span>
                  )
                  : (
                    <span className="text-gray-400">
                      {stats?.cuotas_pendientes || 0} cuotas pendientes
                    </span>
                  )
                }
              </p>
            </div>

          </div>
        )}

        {/* Barra de Progreso General */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <h3 className="text-xl font-bold text-white mb-4">Progreso General del Contrato</h3>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-gray-400">Completado</span>
            <span className="text-cyan-400 font-bold text-lg">{progresoGeneral}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${progresoGeneral}%` }}
            />
          </div>
        </div>

{/* Historial de Pagos (Antes Calendario) */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Historial de Pagos</h3>
            <span className="text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-full">
              {pagos.length} {pagos.length === 1 ? 'pago registrado' : 'pagos registrados'}
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Cuota</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Fecha de Pago</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Método</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Monto Abonado</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Estado</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagos.length > 0 ? (
                  // 🪄 LA MAGIA: Clonamos el arreglo y lo ordenamos matemáticamente de mayor a menor
                  [...pagos]
                    .sort((a, b) => parseInt(b.numero_cuota) - parseInt(a.numero_cuota))
                    .map((pago, index) => (
                    <tr key={pago.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                      
                      {/* 1. Número de Cuota */}
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        Cuota #{pago.numero_cuota}
                      </td>
                      
                      {/* 2. Fecha Real del Pago */}
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {pago.fecha_pago_real ? formatDate(pago.fecha_pago_real) : '-'}
                      </td>

                      {/* 3. Método de pago */}
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {pago.metodo_pago || 'Transferencia'}
                      </td>
                      
                      {/* 4. Monto Real */}
                      <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-400">
                        {formatCurrency(pago.monto_total)}
                      </td>
                      
                      {/* 5. Estado */}
                      <td className="px-4 py-3 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30">
                          {pago.status || 'Completado'}
                        </span>
                      </td>

                      {/* 6. Acciones: Ahora el índice 0 SIEMPRE será la cuota más alta */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          
                          {/* 🟡 Botón Editar (Siempre visible para todos los pagos) */}
                          <button
                            onClick={() => handleAbrirEditarPago(pago)}
                            className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-colors border border-blue-500/20"
                            title="Editar pago"
                          >
                            <Edit2 className="w-4 h-4" /> 
                          </button>

                          {/* 🔴 Botón Eliminar: Protegido por index === 0 y por estado del contrato */}
                          {index === 0 ? (
                            <button
                              onClick={() => handleEliminarPago(pago)}
                              // 🔒 MAGIA AQUÍ: Bloqueado si el contrato está rescindido
                              disabled={!!(contrato.motivo_rescision_contrato || contrato.motivo_rescision || contrato.status === 'Pausado')}
                              className={`p-2 rounded-lg transition-colors border ${
                                (contrato.motivo_rescision_contrato || contrato.motivo_rescision || contrato.status === 'Pausado')
                                  ? 'bg-gray-500/10 text-gray-500 border-gray-500/20 cursor-not-allowed' // ⚪ ESTILO BLOQUEADO
                                  : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border-red-500/20' // 🔴 ESTILO ACTIVO
                              }`}
                              title={
                                (contrato.motivo_rescision_contrato || contrato.motivo_rescision)
                                  ? "Acción bloqueada: El contrato ha sido rescindido"
                                  : "Eliminar último pago (Revierte saldos)"
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500 italic px-2" title="Solo puedes eliminar el pago más reciente">
                              -
                            </span>
                          )}
                          
                        </div>
                      </td>

                    </tr>
                  ))
                ) : (
                  /* ESTADO VACÍO */
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-3xl mb-2">📄</span>
                        <p>Aún no hay pagos registrados en este contrato.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        
      </div>
      {/* 🟢 EL MODAL DE PAGOS (CREAR/EDITAR) 🟢 */}
      {showModalPago && (
        <ModalRegistrarPago
          isOpen={showModalPago}
          onClose={() => setShowModalPago(false)}
          inversion={contrato} // 👈 Ojo: Asegúrate de pasar la variable que tenga los datos del contrato
          pagoAEditar={pagoAEditar}
          onSuccess={() => {
            // 🔄 Llama a tu función que recarga los datos de esta pantalla
            // Ejemplo: fetchContratoDetalle(); o cargarDatos();
            fetchContratoDetalle();
          }}
        />
      )}

      {/* MODAL DE RESCISIÓN */}
      <ModalRescision
        isOpen={showModalRescision}
        onClose={() => setShowModalRescision(false)}
        contrato={contrato}
        onSuccess={() => {
          fetchContratoDetalle();
        }}
      />
    </div>
  );
};

export default ContratoDetalle;
