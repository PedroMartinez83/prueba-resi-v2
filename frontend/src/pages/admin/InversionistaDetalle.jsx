import React, { useState, useEffect } from 'react';
import ModalNuevoInversionista from '../../components/inversiones/ModalNuevoInversionista';
import ModalRegistrarPago from '../../components/inversiones/ModalRegistrarPago';
import adminService from '../../services/adminService';
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
  Check, 
  Trash2, 
  AlertTriangle,
  UserCheck,
  Copy
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [inversionSeleccionada, setInversionSeleccionada] = useState(null);
  const [credenciales, setCredenciales] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [contratoParaPago, setContratoParaPago] = useState(null);

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

// Función para manejar el borrado lógico
  const handleEliminar = async () => {
    
    // 🛡️ 1. VALIDACIONES DE NEGOCIO (PRE-BORRADO)
    // Asumiendo que tienes tu arreglo de contratos en la variable 'inversiones'
    if (inversiones && inversiones.length > 0) {
      for (const contrato of inversiones) {
        const saldo = parseFloat(contrato.saldo_pendiente || 0);
        const idContrato = contrato.id_inversion || contrato.id;

        // Regla 1: Activo pero con deuda
        if (contrato.status === 'Activa' && saldo > 0) {
          alert(`⛔ No se puede eliminar al inversionista:\nEl contrato #${idContrato} está Activo y aún tiene pagos pendientes.`);
          return; // Cortamos la ejecución aquí
        }

        // Regla 2: Rescindido pero sin liquidar
        if (contrato.status === 'Rescindido' && saldo > 0) {
          alert(`⛔ No se puede eliminar al inversionista:\nEl contrato #${idContrato} está Rescindido pero aún no se le paga su finiquito de liquidación.`);
          return; 
        }

        // Regla 3: Pausado (Se debe definir su destino primero)
        if (contrato.status === 'Pausado') {
          alert(`⛔ No se puede eliminar al inversionista:\nEl contrato #${idContrato} está Pausado. Debes eliminarlo, reanudarlo o rescindirlo primero.`);
          return; 
        }
        
        // (Nota: Si es Activo/Rescindido con saldo 0, o está Eliminado, el bucle lo ignora y deja pasar)
      }
    }

    // ⚠️ 2. PEDIR CONFIRMACIÓN (Si pasó todas las pruebas de arriba)
    const confirmar = window.confirm('¿Estás seguro de que deseas eliminar este inversionista?\n\nEsta acción lo ocultará del sistema y no se puede deshacer.');
    
    if (confirmar) {
      try {
        // 3. Llamar al endpoint
        const response = await adminService.eliminarInversionista(id);
        
        if (response.success) {
          alert('🗑️ Inversionista eliminado correctamente.');
          // 4. Como ya no existe, lo sacamos de esta pantalla y lo regresamos a la tabla
          navigate('/admin/inversionistas'); 
        } else {
          // Si el backend lo rechaza por alguna otra validación de seguridad
          alert(`⛔ No se pudo eliminar: ${response.message}`);
        }
      } catch (error) {
        console.error("Error al eliminar:", error);
        const mensajeError = error.message || 'Error de conexión al intentar eliminar.';
        alert(`❌ ${mensajeError}`);
      }
    }
  };

  const handleRegistrarPago = async (e) => {
  e.preventDefault();
  setCargandoPago(true);

  try {
    // Usamos el ID del contrato que tengas disponible (inversion.id_inversion o id)
    const idContrato = inversion.id_inversion || id; 
    
    // Llamamos a tu nuevo servicio súper elegante
    await adminService.registrarPagoInversion(idContrato, formPago);

    alert('✅ ¡Pago registrado con éxito!');
    setMostrarModalPago(false);
    
    // Recargamos los datos para ver el nuevo pago en la tabla
    if(typeof fetchInversionistaDetalle === 'function') {
      fetchInversionistaDetalle(); 
    }
    
  } catch (error) {
    // Si tu fetchWithAuth ya maneja los errores, aquí mostramos el mensaje que devuelve
    alert(`❌ Hubo un problema: ${error.message}`);
  } finally {
    setCargandoPago(false);
  }
};

  const handleCrearAccesoInversionista = async () => {
    if (!window.confirm(`¿Estás seguro de crear una cuenta de acceso para este inversionista?`)) return;
    
    try {
      setLoading(true); 
      const response = await adminService.crearAccesoInversionista(id); 
      
      if (response.success) {
        // En lugar de un feo alert(), guardamos las credenciales en el estado para abrir el modal
        setCredenciales({
          email: response.email,
          password: response.password_temporal
        });
      } else {
        alert(`Error: ${response.message}`);
      }
    } catch (error) {
      console.error('Error al crear acceso:', error);
      alert(`Error al crear la cuenta: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Función auxiliar para el botón de copiar
  const copiarContrasena = () => {
    if (credenciales) {
      navigator.clipboard.writeText(credenciales.password);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000); // Regresa a la normalidad en 2 seg
    }
  };

  // Función para cerrar el modal y recargar la página (esto arregla el error de fetch)
  const cerrarModalCredenciales = () => {
    setCredenciales(null);
    window.location.reload(); // 👈 Forma universal y rápida de refrescar los datos
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
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center">
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
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center p-4">
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

  const TarjetaDocumento = ({ titulo, url }) => {
  if (!url) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center opacity-60">
        <span className="text-3xl mb-2">📄</span>
        <h4 className="text-sm font-medium text-gray-400">{titulo}</h4>
        <p className="text-xs text-red-400 mt-2">No adjuntado</p>
      </div>
    );
  }

  // Detectamos si es PDF o Imagen por la extensión de la URL
  const esPDF = url.toLowerCase().endsWith('.pdf');

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-transform hover:scale-105 hover:border-green-500">
      {esPDF ? (
        <span className="text-4xl mb-3">📑</span>
      ) : (
        <div className="w-full h-24 mb-3 overflow-hidden rounded-lg bg-slate-900 flex items-center justify-center">
          <img src={url} alt={titulo} className="object-cover w-full h-full opacity-80 hover:opacity-100 transition-opacity" />
        </div>
      )}
      
      <h4 className="text-sm font-medium text-white mb-3">{titulo}</h4>
      
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-auto px-4 py-1.5 bg-slate-700 hover:bg-green-600 text-white text-xs rounded-lg transition-colors w-full"
      >
        Ver Documento
      </a>
    </div>
  );
};

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
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

          {/* 🗑️ NUEVO - Botón Eliminar */}
            <button
              onClick={handleEliminar}
              className="px-4 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white transition-all font-medium flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Eliminar
            </button>

          {/* ✏️ NUEVO - Botón Editar */}
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-3 bg-slate-800 text-white border border-slate-700 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-all font-medium flex items-center gap-2"
            >
              <Edit className="w-5 h-5" />
              Editar Perfil
            </button>
          
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
                {inversionista.nombre_cuenta_banco && (
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Nombre de la Cuenta</p>
                    <p className="text-white font-medium">{inversionista.nombre_cuenta_banco}</p>
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

        {/* ========================================== */}
        {/* 📂 SECCIÓN DE DOCUMENTOS ADJUNTOS          */}
        {/* ========================================== */}
        <div className="mt-8 bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span>📎</span> Expediente Digital
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* 🛡️ Documentos Comunes (Física y Moral) */}
            <TarjetaDocumento titulo="Identificación Oficial" url={inversionista.doc_identificacion} />
            <TarjetaDocumento titulo="Constancia Fiscal" url={inversionista.doc_constancia_fiscal} />
            <TarjetaDocumento titulo="Comprobante de Domicilio" url={inversionista.doc_comprobante_domicilio} />
            <TarjetaDocumento titulo="Carátula Bancaria" url={inversionista.doc_cuenta_banco} />

            {/* 🏢 Documentos Exclusivos (Solo Persona Moral) */}
            {inversionista.tipo_inversionista === 'Moral' && (
              <>
                <TarjetaDocumento titulo="Acta Constitutiva" url={inversionista.doc_acta_constitutiva} />
                <TarjetaDocumento titulo="Poder Legal" url={inversionista.doc_poder_legal} />
              </>
            )}
          </div>
        </div>

        {/* Información de Cuenta y Actividad */}
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Información de la Cuenta</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>Registro creado:</span>
                <span>{formatDate(inversionista?.created_at)}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Última actualización:</span>
                <span>{formatDate(inversionista?.updated_at)}</span>
              </div>
              
              {/* --- Lógica para mostrar ID de usuario o botón de crear cuenta --- */}
              {!inversionista?.usuario_id ? (
                <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <p className="text-amber-400 font-semibold">Sin Cuenta de Acceso</p>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">Este inversionista no puede iniciar sesión en su portal.</p>
                  <button
                    onClick={handleCrearAccesoInversionista}
                    disabled={loading} // Deshabilitar si ya está cargando algo
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    Crear Cuenta de Acceso
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex justify-between text-gray-300 items-center border-t border-white/10 pt-4">
                  <span>ID Usuario (Login):</span>
                  <span className="font-mono text-emerald-400 font-bold text-base bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                    {inversionista.usuario_id}
                  </span>
                </div>
              )}
            </div>
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
            
            {/* TAB: Contratos Activos - ✅ MEJORADO CON COLORES */}
            {activeTab === 'contratos' && (
              <div className="space-y-4">
                {/* 🚀 Filtramos la lista y verificamos que queden elementos válidos */}
                {inversiones && inversiones.filter(inv => inv.status !== 'Eliminado').length > 0 ? (
                  inversiones
                    // 🚀 Aplicamos el filtro antes de mapear
                    .filter(inversion => inversion.status !== 'Eliminado')
                    .map((inversion, index) => {
                    
                    // 🎨 LÓGICA DE COLORES DE LA TARJETA
                    const estaRescindido = !!(inversion.motivo_rescision_contrato || inversion.motivo_rescision);
                    const estaPagado = parseFloat(inversion.saldo_pendiente || 0) <= 0;
                    const estaPausado = inversion.status === 'Pausado';

                    let colorTarjeta = "p-6 rounded-2xl border transition-all "; 
                    let colorIconoBg = "";
                    let colorIconoText = "";

                    if (estaRescindido) {
                      // 🔴 ROJO: Contrato cancelado/rescindido
                      colorTarjeta += "bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]";
                      colorIconoBg = "bg-red-500/20";
                      colorIconoText = "text-red-400";
                    } else if (estaPagado) {
                      // 🟢 VERDE: Contrato liquidado al 100%
                      colorTarjeta += "bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.05)]";
                      colorIconoBg = "bg-green-500/20";
                      colorIconoText = "text-green-400";
                    } else if (estaPausado) {
                      // � AMARILLO: Contrato pausado
                      colorTarjeta += "bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.05)]";
                      colorIconoBg = "bg-yellow-500/20";
                      colorIconoText = "text-yellow-400";
                    } 
                    
                    else {
                      // ⚪ NORMAL: Contrato activo
                      colorTarjeta += " border-white/10 hover:border-blue-800/30";
                      colorIconoBg = "bg-cyan-500/20";
                      colorIconoText = "text-cyan-400";
                    }

                    return (
                      <div key={`inv-idx-${inversion.id || inversion.id_inversion || index}`} className={colorTarjeta}>
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                          
                          {/* Info del Contrato */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              {/* Icono Dinámico */}
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorIconoBg}`}>
                                <FileText className={`w-6 h-6 ${colorIconoText}`} />
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
                                {formatCurrency(inversion.pago_mensual)}
                              </p>
                            </div>

                            {/* Barra de Progreso */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400 text-sm font-medium">Progreso Financiero</span>
                                <div className="text-right">
                                  <span className="text-cyan-400 text-sm font-bold">
                                    {parseFloat(inversion.porcentaje_pagado || 0).toFixed(2)}%
                                  </span>
                                  <span className="text-gray-500 text-xs ml-2">
                                    ({inversion.pagos_realizados || 0}/{inversion.plazo_meses} meses)
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
                                  style={{ 
                                    // 🚀 Usamos directamente el porcentaje de la BD (Topado a 100 por seguridad visual)
                                    width: `${Math.min(100, parseFloat(inversion.porcentaje_pagado || 0))}%` 
                                  }}
                                />
                              </div>
                            </div>

                            {/* Datos Secundarios */}
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Inversión Total</p>
                                <p className="text-white font-semibold text-lg">
                                  {formatCurrency(inversion.monto_invertido)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Total a Recibir</p>
                                <p className="text-green-400 font-semibold text-lg">
                                  {formatCurrency(inversion.monto_total_contrato)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Plazo</p>
                                <p className="text-purple-400 font-semibold text-lg">
                                  {inversion.plazo_meses} meses
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* ✅ MEJORADO: Botones de Acción */}
                          <div className="flex flex-col gap-3">
                            <button
                              onClick={() => {
                                setInversionSeleccionada(inversion); 
                                setModalPagoOpen(true);
                              }}
                              // 🔒 MAGIA AQUÍ: Bloqueado si el saldo es <= 0 O si el contrato está rescindido
                              disabled={parseFloat(inversion.saldo_pendiente || 0) <= 0 || inversion.status === 'Pausado'}
                              className={`px-6 py-3 rounded-lg transition-all font-medium flex items-center gap-2 ${
                                (parseFloat(inversion.saldo_pendiente || 0) <= 0)
                                  ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed border border-gray-500/30' // ⚪ ESTILO BLOQUEADO
                                  : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/30' // 🟢 ESTILO ACTIVO
                              }`}
                              title={
                                parseFloat(inversion.saldo_pendiente || 0) <= 0 
                                  ? "Contrato totalmente liquidado" : 
                                inversion.status === 'Pausado'
                                  ? "Contrato pausado"
                                  : "Registrar Pago"
                              }
                            >
                              <DollarSign className="w-5 h-5" />
                              {/* 📝 Textos dinámicos dependiendo de por qué está bloqueado */}
                              {parseFloat(inversion.saldo_pendiente || 0) <= 0 
                                  ? 'Contrato Pagado' 
                                  : 'Registrar Pago'
                              }
                            </button>
                            
                            <button
                              onClick={() => navigate(`/admin/inversiones/${inversion.id || inversion.id_inversion}/detalle`)}
                              className="px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors border border-cyan-500/30 flex items-center gap-2"
                            >
                              <Eye className="w-5 h-5" />
                              Ver Contrato
                            </button>
                          </div>

                        </div>
                      </div>
                    );
                  })
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
                        {/* 🚀 Filtramos cruzando los datos con la lista de inversiones */}
                        {pagos && pagos.filter(pago => {
                          // 1. Buscamos el contrato papá de este pago
                          const contratoPapa = inversiones.find(inv => (inv.id || inv.id_inversion) === (pago.inversion_id || pago.contrato_id));
                          // 2. Si existe y está eliminado, retorna false (lo oculta)
                          return contratoPapa?.status !== 'Eliminado';
                        }).length > 0 ? (
                          pagos
                            // 🚀 Aplicamos el mismo filtro cruzado aquí
                            .filter(pago => {
                              const contratoPapa = inversiones.find(inv => (inv.id || inv.id_inversion) === (pago.inversion_id || pago.contrato_id));
                              return contratoPapa?.status !== 'Eliminado';
                            })
                            .slice(0, 12)
                            .map((pago, index) => (
                              <tr key={pago.id || index} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                              
                              {/* 1. Fecha Real del Pago */}
                              <td className="px-4 py-3 text-sm text-gray-300">
                                {pago.fecha_pago_real ? formatDate(pago.fecha_pago_real) : '-'}
                              </td>
                              
                              {/* 2. Vehículo */}
                              <td className="px-4 py-3 text-sm text-white">
                                {pago.numero_vehiculo ? `Veh. ${pago.numero_vehiculo}` : 'Pool'}
                              </td>
                              
                              {/* 3. Número de Cuota */}
                              <td className="px-4 py-3 text-sm text-gray-300">
                                Cuota #{pago.numero_cuota}
                              </td>
                              
                              {/* 4. Monto Real Abonado */}
                              <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-400">
                                {formatCurrency(pago.monto_total || 0)}
                              </td>
                              
                              {/* 5. Estado (Siempre será Completado) */}
                              <td className="px-4 py-3 text-center">
                                <span className="px-3 py-1 rounded-full text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30">
                                  {pago.status || 'Completado'}
                                </span>
                              </td>
                              
                              {/* 6. Columna Extra (Antes era el botón, ahora mostramos el método de pago) */}
                              <td className="px-4 py-3 text-center">
                                <span className="text-gray-400 text-xs px-2 py-1 bg-white/5 rounded-md">
                                  {pago.metodo_pago || 'Transferencia'}
                                </span>
                              </td>

                            </tr>
                          ))
                        ) : (
                          /* ESTADO VACÍO: Si el inversionista aún no tiene ningún pago registrado */
                          <tr>
                            <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                              <div className="flex flex-col items-center justify-center">
                                <span className="text-3xl mb-2">📄</span>
                                <p>Aún no hay historial de pagos recientes.</p>
                              </div>
                            </td>
                          </tr>
                        )}
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

    {/* MODAL DE EDICIÓN */}
      <ModalNuevoInversionista 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)}
        inversionistaAEditar={inversionista} // Asumiendo que tu estado con los datos se llama "inversionista"
        onSave={async (data) => {
          try {
            const response = await adminService.editarInversionista(id, data);
            if (response.success) {
              alert('✅ Inversionista actualizado exitosamente');
              setShowEditModal(false);
              
              // 🔄 AQUÍ: Llama a la función que carga los detalles para que la vista se actualice
              // fetchInversionistaDetalle(); o como se llame tu función de carga inicial
              window.location.reload(); // (O usa recarga rápida de página temporalmente)
              
            } else {
              alert(`⛔ Error: ${response.message}`);
            }
          } catch (error) {
            console.error("Error al editar:", error);
            alert('❌ Error de conexión al guardar los cambios.');
          }
        }} 
      />

      {/* Tu Modal Importado */}
      <ModalRegistrarPago 
        isOpen={modalPagoOpen}
        onClose={() => setModalPagoOpen(false)}
        inversion={inversionSeleccionada}
        datosInversionista={inversionista}
        numeroCuotaSugerida={(pagos?.length || 0) + 1}
        onSuccess={() => {
          fetchInversionistaDetalle(); // Tu función para recargar la tabla
          fetchInversionistaDashboard(); // Recargamos el dashboard también
        }}
      />


      {/* 🟢 MODAL DE CREDENCIALES GENERADAS */}
      {credenciales && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-emerald-500/20">
            
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-emerald-400" />
            </div>
            
            <h2 className="text-2xl font-bold text-white text-center mb-2">¡Cuenta Creada!</h2>
            <p className="text-gray-400 text-center text-sm mb-6">
              Entrega estos datos al inversionista. Por seguridad, la contraseña no se volverá a mostrar.
            </p>

            <div className="space-y-4 mb-8">
              {/* Campo Email */}
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1 block">Usuario / Email</label>
                <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-white font-medium">
                  {credenciales.email}
                </div>
              </div>

              {/* Campo Contraseña con Botón Copiar */}
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1 block">Contraseña Temporal</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 font-mono font-bold tracking-widest text-lg text-center">
                    {credenciales.password}
                  </div>
                  <button
                    onClick={copiarContrasena}
                    className={`p-3 rounded-lg flex-shrink-0 transition-all flex items-center justify-center ${
                      copiado 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                    title="Copiar contraseña"
                  >
                    {copiado ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={cerrarModalCredenciales}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
            >
              Entendido, cerrar
            </button>

          </div>
        </div>
      )}

    </div>
  );
};

export default InversionistaDetalle;
