import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  CreditCard,
  FileText,
  DollarSign,
  TrendingUp,
  Calendar,
  Edit,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Plus,
  Check
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const InversionistaDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [inversionista, setInversionista] = useState(null);
  const [inversiones, setInversiones] = useState([]); // ✅ NUEVO - Estado separado
  const [pagos, setPagos] = useState([]); // ✅ NUEVO - Estado separado
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('contratos');
  const [showModalPago, setShowModalPago] = useState(false); // ✅ NUEVO - Modal registrar pago
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null); // ✅ NUEVO

  useEffect(() => {
    fetchInversionistaDetalle();
    fetchInversionistaDashboard();
  }, [id]);

  const fetchInversionistaDetalle = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/inversionistas/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar inversionista');
      }

      const data = await response.json();
      
      // ✅ CORRECCIÓN: Mapeo correcto de datos
      console.log('📊 Datos recibidos:', data);
      
      setInversionista(data.inversionista || data);
      setInversiones(data.inversiones || []); // ✅ NUEVO
      setPagos(data.pagos || []); // ✅ NUEVO
      
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
    }
  };

  const fetchInversionistaDashboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/inversionistas/${id}/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar dashboard');
      }

      const data = await response.json();
      setDashboard(data);
    } catch (err) {
      console.error('Error dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Función para registrar pago
const handleMarcarPagado = async () => {
  if (!pagoSeleccionado) return;
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/admin/inversiones/pagos/${pagoSeleccionado.id}/marcar-pagado`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Mostrar mensaje de éxito
      alert('✅ Pago registrado exitosamente');
      
      // Cerrar modal
      setShowModalPago(false);
      setPagoSeleccionado(null);
      
      // ✅ NUEVO: Esperar un momento y recargar datos
      setTimeout(async () => {
        await fetchInversionistaDetalle();
        await fetchInversionistaDashboard();
      }, 300);
      
    } else {
      throw new Error(data.message || 'Error al marcar pago');
    }
  } catch (error) {
    console.error('Error:', error);
    alert(`❌ Error: ${error.message}`);
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

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getModeloLabel = (modelo) => {
    const modelos = {
      'SI_LEGADO': 'SI Legado',
      'AutoManager': 'AutoManager',
      'PLUS 60': 'PLUS 60',
      'SMART 40': 'SMART 40',
      'PLUS_60': 'PLUS 60',
      'SMART_40': 'SMART 40'
    };
    return modelos[modelo] || modelo;
  };

  const getStatusPagoColor = (status) => {
    const colors = {
      'Pagado': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Pendiente': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Vencido': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 border border-white/10">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            <p className="text-white text-lg">Cargando información...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !inversionista) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 border border-red-500/30 max-w-md w-full">
          <div className="flex items-center space-x-3 text-red-400 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h3 className="text-xl font-bold">Error</h3>
          </div>
          <p className="text-gray-300 mb-6">{error || 'Inversionista no encontrado'}</p>
          <button
            onClick={() => navigate('/admin/inversionistas')}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all font-medium"
          >
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header con botón volver y NUEVO CONTRATO */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/inversionistas')}
              className="glass p-3 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-300" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Detalle de Inversionista</h1>
              <p className="text-gray-400">Información completa y contratos activos</p>
            </div>
          </div>
          
          {/* ✅ NUEVO - Botón Crear Contrato */}
          <button
            onClick={() => navigate(`/admin/inversiones/crear?inversionista_id=${id}`)}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Contrato
          </button>
        </div>

        {/* Card de Información Personal */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            
            {/* Info Principal */}
            <div className="flex items-start gap-4 flex-1">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-3xl">
                {inversionista.nombre?.charAt(0).toUpperCase() || 'I'}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">{inversionista.nombre}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  
                  <div className="flex items-center gap-3 text-gray-300">
                    <Mail className="w-5 h-5 text-cyan-400" />
                    <span>{inversionista.email || 'No especificado'}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-gray-300">
                    <Phone className="w-5 h-5 text-green-400" />
                    <span>{formatPhone(inversionista.telefono)}</span>
                  </div>
                  
                  {inversionista.whatsapp && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <Phone className="w-5 h-5 text-green-400" />
                      <span>WhatsApp: {formatPhone(inversionista.whatsapp)}</span>
                    </div>
                  )}
                  
                  {inversionista.rfc && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <FileText className="w-5 h-5 text-purple-400" />
                      <span>RFC: {inversionista.rfc}</span>
                    </div>
                  )}
                  
                  {inversionista.direccion && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <MapPin className="w-5 h-5 text-red-400" />
                      <span>{inversionista.direccion}</span>
                    </div>
                  )}
                  
                </div>
              </div>
            </div>

            {/* Badge de Estado */}
            <div className="flex flex-col items-end gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-medium border ${
                inversionista.status === 'Activo'
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}>
                {inversionista.status}
              </span>
              <span className="px-4 py-2 rounded-full text-sm font-medium border bg-purple-500/20 text-purple-400 border-purple-500/30">
                {inversionista.tipo_inversionista}
              </span>
            </div>

          </div>

          {/* Información Bancaria */}
          {(inversionista.banco || inversionista.cuenta_bancaria) && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Información Bancaria
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {inversionista.banco && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Banco</p>
                    <p className="text-white font-medium">{inversionista.banco}</p>
                  </div>
                )}
                {inversionista.cuenta_bancaria && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Cuenta</p>
                    <p className="text-white font-medium font-mono">{inversionista.cuenta_bancaria}</p>
                  </div>
                )}
                {inversionista.clabe && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">CLABE</p>
                    <p className="text-white font-medium font-mono">{inversionista.clabe}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards del Dashboard */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="glass rounded-xl p-4 border border-cyan-500/30 bg-cyan-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Capital Invertido</p>
                <DollarSign className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {formatCurrency(dashboard.total_invertido)}
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-green-500/30 bg-green-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Total Cobrado</p>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(dashboard.total_cobrado)}
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Por Cobrar</p>
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-purple-400">
                {formatCurrency(dashboard.total_por_cobrar)}
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-sm">Contratos Activos</p>
                <FileText className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-3xl font-bold text-yellow-400">
                {dashboard.contratos_activos}
              </p>
            </div>

          </div>
        )}

        {/* Tabs */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          
          {/* Tab Headers */}
          <div className="flex border-b border-white/10 bg-white/5">
            <button
              onClick={() => setActiveTab('contratos')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'contratos'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Contratos Activos
            </button>
            <button
              onClick={() => setActiveTab('pagos')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'pagos'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Historial de Pagos
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            
            {/* TAB: Contratos Activos - ✅ MEJORADO */}
            {activeTab === 'contratos' && (
              <div className="space-y-4">
                {inversiones && inversiones.length > 0 ? (
                  inversiones.map((inversion) => (
                    <div 
                      key={inversion.id}
                      className="glass rounded-xl p-6 border border-white/10 hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        
                        {/* Info del Contrato */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                              <FileText className="w-6 h-6 text-cyan-400" />
                            </div>
                            <div>
                              <h3 className="text-white font-bold text-xl">
                                {inversion.vehiculo_numero 
                                  ? `Vehículo ${inversion.vehiculo_numero}` 
                                  : 'Pool General'}
                              </h3>
                              <p className="text-gray-400 text-sm">
                                {getModeloLabel(inversion.modelo_negocio || inversion.plan_preferido)}
                              </p>
                            </div>
                          </div>

                          {/* ✅ HÉROE: Pago Mensual */}
                          <div className="mb-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                            <p className="text-gray-400 text-sm mb-1">Pago Mensual</p>
                            <p className="text-cyan-400 font-bold text-3xl">
                              {formatCurrency(inversion.pago_mensual_inversionista)}
                            </p>
                          </div>

                          {/* Barra de Progreso */}
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-gray-400 text-sm font-medium">Progreso de pagos</span>
                              <span className="text-cyan-400 text-sm font-bold">
                                {inversion.pagos_realizados || 0} / {inversion.plazo_para_inversionistas} meses
                              </span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all"
                                style={{ 
                                  width: `${((inversion.pagos_realizados || 0) / inversion.plazo_para_inversionistas * 100).toFixed(1)}%` 
                                }}
                              />
                            </div>
                          </div>

                          {/* Datos Secundarios */}
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-gray-400 text-xs mb-1">Inversión Total</p>
                              <p className="text-white font-semibold text-lg">
                                {formatCurrency(inversion.inversion)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-xs mb-1">Total a Recibir</p>
                              <p className="text-green-400 font-semibold text-lg">
                                {formatCurrency(inversion.utilidad_inversionista)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-xs mb-1">Plazo</p>
                              <p className="text-purple-400 font-semibold text-lg">
                                {inversion.plazo_para_inversionistas} meses
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* ✅ MEJORADO: Botones de Acción */}
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={() => {
                              alert('🚀 Funcionalidad de registrar pago disponible próximamente');
                            }}
                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-medium flex items-center gap-2"
                          >
                            <DollarSign className="w-5 h-5" />
                            Registrar Pago
                          </button>
                          
                          <button
  onClick={() => navigate(`/admin/inversiones/${inversion.id_inversion}/detalle`)}
  className="px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors border border-cyan-500/30 flex items-center gap-2"
>
  <Eye className="w-5 h-5" />
  Ver Contrato
</button>
                        </div>

                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg mb-4">No hay contratos activos</p>
                    <button
                      onClick={() => navigate(`/admin/inversiones/crear?inversionista_id=${id}`)}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all font-medium inline-flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Crear Primer Contrato
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Historial de Pagos - ✅ MEJORADO con Acciones */}
            {activeTab === 'pagos' && (
              <div className="space-y-4">
                {pagos && pagos.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Fecha</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Contrato</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Mes</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Monto</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Estado</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagos.slice(0, 12).map((pago, index) => (
                          <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-gray-300">
                              {formatDate(pago.fecha_pago)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white">
                              {pago.vehiculo_numero ? `Veh. ${pago.vehiculo_numero}` : 'Pool'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-300">
                              Mes {pago.mes_pago}
                            </td>
                           <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-400">
  {formatCurrency(pago.monto_programado || pago.monto_pagado || 0)}
</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusPagoColor(pago.status)}`}>
                                {pago.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {(pago.status === 'Pendiente' || pago.status === 'Vencido') && (
                                <button
                                  onClick={() => {
                                    setPagoSeleccionado(pago);
                                    setShowModalPago(true);
                                  }}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors border border-green-500/30 text-sm font-medium"
                                >
                                  <Check className="w-4 h-4" />
                                  Marcar como Pagado
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No hay pagos registrados</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="glass rounded-2xl p-4 border border-white/10">
          <p className="text-gray-400 text-center text-sm">
            Sistema Auto Manager - Detalle de Inversionista · Desarrollado por{' '}
            <span className="text-cyan-400">somoslazaro.marketing</span>
          </p>
        </div>

      </div>

      {/* ✅ NUEVO - Modal Marcar Pago como Pagado */}
      {showModalPago && pagoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl border border-white/10 p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">Confirmar Pago</h3>
            <p className="text-gray-300 mb-4">
              ¿Confirmas que deseas marcar este pago como <span className="text-green-400 font-bold">Pagado</span>?
            </p>
            
           <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-4">
  <div className="grid grid-cols-2 gap-3 text-sm">
    <div>
      <p className="text-gray-400">Mes:</p>
      <p className="text-white font-semibold">Mes {pagoSeleccionado.mes_pago}</p>
    </div>
    <div>
      <p className="text-gray-400">Monto:</p>
      <p className="text-cyan-400 font-bold">
        {formatCurrency(pagoSeleccionado.monto_programado || pagoSeleccionado.monto_pagado || 0)}
      </p>
    </div>
  </div>
  
  {/* ✅ NUEVO: Información adicional */}
  <div className="mt-3 pt-3 border-t border-cyan-500/20">
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">Fecha programada:</span>
      <span className="text-white">{formatDate(pagoSeleccionado.fecha_programada)}</span>
    </div>
  </div>
</div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModalPago(false);
                  setPagoSeleccionado(null);
                }}
                className="flex-1 px-4 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleMarcarPagado}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all font-medium"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InversionistaDetalle;
