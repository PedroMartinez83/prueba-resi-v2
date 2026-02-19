import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConductorModalWizard from '../../components/admin/ConductorModalWizard';
import PanelPlanCarrera from '../../components/admin/PanelPlanCarrera';
import adminService from '../../services/adminService';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft, Phone, Mail, MapPin, Calendar, Clock, 
  FileText, Car, AlertTriangle, CheckCircle, XCircle,
  Edit, Trash2, Download, Send, Camera, Shield,
  TrendingUp, Activity, DollarSign, Star, MessageCircle,
  RefreshCw, Save, Upload, Eye, EyeOff, Copy,
  Navigation, Fuel, Wrench, CreditCard, User, Hash,
  Award,
  UserCheck // <--- CAMBIO 1: Importamos el ícono para "Crear Cuenta"
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const ConductorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [conductor, setConductor] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [statusSeleccionado, setStatusSeleccionado] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
const [uploadingFile, setUploadingFile] = useState(false);
const [selectedDocType, setSelectedDocType] = useState('');
const [selectedFile, setSelectedFile] = useState(null);
const [showAssignVehicleModal, setShowAssignVehicleModal] = useState(false);
const [vehiculosDisponibles, setVehiculosDisponibles] = useState([]);
const [loadingVehiculos, setLoadingVehiculos] = useState(false);
const [selectedVehiculo, setSelectedVehiculo] = useState(null);
const [rentaDiaria, setRentaDiaria] = useState(400);
const [abonoPoliza, setAbonoPoliza] = useState(100);
const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchConductor();
  }, [id]);

  const fetchConductor = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await adminService.getConductorById(id);
      console.log('Respuesta completa del backend:', response);
      
      if (response.success && response.conductor) {
        const conductorData = {
          ...response.conductor,
          nombre_completo: response.conductor.nombre_conductor,
          telefono: response.conductor.numero_telefono,
          direccion: response.conductor.direccion_completa || 'No especificada',
          numero_licencia: response.conductor.licencia_conducir,
          estado_cuenta: response.conductor.status || 'Pendiente',
          chat_id_telegram: response.conductor.chat_id_telegram || response.conductor.username_telegram || 'No configurado',
          bot_activo: response.conductor.bot_configurado || false,
          calificacion: response.conductor.calificacion_promedio || 0,
          viajes_completados: response.conductor.estadisticas?.rentas?.total || 0,
          ingresos_generados: response.conductor.estadisticas?.rentas?.montoTotal || response.conductor.saldo_ganancias || 0,
          vehiculo_actual: response.conductor.vehiculo_asignado ? 
            `${response.conductor.vehiculo_asignado.marca} ${response.conductor.vehiculo_asignado.modelo || ''} - ${response.conductor.vehiculo_asignado.placa}` : 
            'Sin vehículo asignado',
          vehiculo: response.conductor.vehiculo_asignado ? {
            marca: response.conductor.vehiculo_asignado.marca,
            modelo: response.conductor.vehiculo_asignado.modelo,
            año: response.conductor.vehiculo_asignado.año,
            placas: response.conductor.vehiculo_asignado.placa,
            numero_economico: response.conductor.vehiculo_asignado.numero_vehiculo
          } : null,
          documentos: response.conductor.documentos || [
            { 
              tipo: 'INE', 
              estado: response.conductor.numero_de_ine_ife ? 'vigente' : 'vencido',
              vencimiento: '2025-12-31' 
            },
            { 
              tipo: 'Licencia', 
              estado: response.conductor.licencia_vigencia && new Date(response.conductor.licencia_vigencia) > new Date() ? 'vigente' : 'vencido',
              vencimiento: response.conductor.licencia_vigencia || '2025-12-31'
            },
            { 
              tipo: 'CURP', 
              estado: response.conductor.curp ? 'vigente' : 'vencido',
              vencimiento: '2025-12-31'
            }
          ],
          metricas: {
            viajes_mes: response.conductor.estadisticas?.rentas?.total || 0,
            horas_conducidas: 0,
            km_recorridos: 0,
            combustible_consumido: 0,
            mantenimientos: 0,
            siniestros: response.conductor.estadisticas?.siniestros?.total || 0
          },
          historial_viajes: []
        };
        
        setConductor(conductorData);
        setStatusSeleccionado(response.conductor.status || 'Pendiente');
      } else {
        setError('No se pudo cargar la información del conductor');
      }
    } catch (error) {
      console.error('Error al cargar conductor:', error);
      setError('Error al cargar los datos. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };
const handleUploadDocument = async () => {
  if (!selectedFile || !selectedDocType) {
    alert('Por favor selecciona un tipo de documento y un archivo');
    return;
  }

  try {
    setUploadingFile(true);
    
    const formData = new FormData();
    formData.append('documento', selectedFile);
    formData.append('tipo_documento', selectedDocType);
    
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/admin/conductores/${id}/upload-documento`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Error al subir documento');
    }
    
    const data = await response.json();
    
    if (data.success) {
      alert('✅ Documento subido exitosamente');
      setShowUploadModal(false);
      setSelectedFile(null);
      setSelectedDocType('');
      await fetchConductor(); // Recargar datos
    } else {
      throw new Error(data.message || 'Error al subir documento');
    }
  } catch (error) {
    console.error('Error al subir documento:', error);
    alert('❌ Error al subir el documento: ' + error.message);
  } finally {
    setUploadingFile(false);
  }
};
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConductor();
    setTimeout(() => setRefreshing(false), 500);
  };

const handleDelete = async () => {
    // 1. Confirmación simple (igual que en la tabla)
    if (!window.confirm('¿Estás seguro de que deseas eliminar este conductor permanentemente?')) {
      return;
    }

    try {
      // 2. Llamada al servicio (Asegúrate que el método deleteConductor exista en tu adminService)
      // Si en la tabla usas deleteUsuario, cámbialo aquí también.
      await adminService.deleteConductor(conductor.id); 

      // 3. Feedback visual
      alert('Conductor eliminado correctamente'); // O usa un toast si tienes uno

      // 4. REDIRECCIÓN (La parte clave)
      navigate('/admin/conductores');
      
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar el conductor: ' + (error.message || 'Error desconocido'));
    }
  };

const fetchVehiculosDisponibles = async () => {
  try {
    setLoadingVehiculos(true);
    const response = await adminService.getVehiculosDisponibles();
    
    if (response.success) {
      setVehiculosDisponibles(response.vehiculos || []);
    }
  } catch (error) {
    console.error('Error al cargar vehículos disponibles:', error);
    alert('Error al cargar vehículos disponibles');
  } finally {
    setLoadingVehiculos(false);
  }
};

  const handleAsignarVehiculo = async () => {
  if (!selectedVehiculo) {
    alert('Por favor selecciona un vehículo');
    return;
  }

  if (!rentaDiaria || rentaDiaria <= 0) {
    alert('La renta diaria debe ser mayor a 0');
    return;
  }

  try {
    setLoading(true);
    
  const response = await adminService.asignarVehiculo(id, selectedVehiculo, {
  rentaDiaria,
  abonoPoliza,
  fechaInicio
});
    
    if (response.success) {
      alert('✅ Vehículo asignado exitosamente');
      setShowAssignVehicleModal(false);
      setSelectedVehiculo(null);
      await fetchConductor(); // Recargar datos del conductor
    }
  } catch (error) {
    console.error('Error al asignar vehículo:', error);
    alert('Error al asignar vehículo: ' + error.message);
  } finally {
    setLoading(false);
  }
};
  // <--- CAMBIO 2: Añadimos la nueva función para crear la cuenta
  const handleCrearAcceso = async () => {
    if (!window.confirm(`¿Estás seguro de crear una cuenta de acceso para ${conductor.nombre_completo}?\n\nSe generará una contraseña temporal y se vinculará a este perfil.`)) {
      return;
    }
    
    try {
      setLoading(true); // Usamos el loading general
      // Esta función 'crearAccesoConductor' la crearemos en el servicio (Paso 2)
      const response = await adminService.crearAccesoConductor(id);
      
      if (response.success) {
        alert(
          `✅ ¡Cuenta Creada Exitosamente!\n\n` +
          `--- ⚠️ DATOS DE ACCESO (ENTREGAR AL CONDUCTOR) ---\n` +
          `📧 Email: ${response.email}\n` +
          `🔑 Contraseña Temporal: ${response.password_temporal}`
        );
        await fetchConductor(); // ¡Muy importante! Refresca los datos del conductor
      } else {
        alert(`Error: ${response.message || 'No se pudo crear la cuenta.'}`);
      }
    } catch (error) {
      console.error('Error al crear acceso:', error);
      alert(`Error al crear la cuenta: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarStatus = async () => {
    if (!statusSeleccionado) return;

    try {
      setStatusUpdating(true);
      const response = await adminService.cambiarStatusConductor(id, statusSeleccionado);

      if (response.success) {
        toast.success(`Estado actualizado a ${statusSeleccionado}`);
        await fetchConductor();
      } else {
        toast.error(response?.error || 'No se pudo actualizar el estado');
      }
    } catch (error) {
      console.error('Error cambiando status:', error);
      toast.error(error?.message || 'Error al cambiar estado');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDesasignarVehiculo = async () => {
    if (!window.confirm(`¿Desasignar el vehículo actual de ${conductor?.nombre_completo}?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await adminService.desasignarVehiculo(id);

      if (response.success) {
        toast.success('Vehículo desasignado exitosamente');
        await fetchConductor();
      } else {
        toast.error(response?.error || 'Error al desasignar vehículo');
      }
    } catch (error) {
      console.error('Error al desasignar vehículo:', error);
      toast.error(error?.message || 'Error al desasignar vehículo');
    } finally {
      setLoading(false);
    }
  };
  

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (date) => {
    if (!date) return 'No especificada';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    const statusMap = {
      'Activo': 'bg-emerald-500',
      'activo': 'bg-emerald-500',
      'Aprobado': 'bg-emerald-500',
      'Inactivo': 'bg-gray-500',
      'inactivo': 'bg-gray-500',
      'Pendiente': 'bg-amber-500',
      'pendiente': 'bg-amber-500',
      'Suspendido': 'bg-amber-500',
      'suspendido': 'bg-amber-500',
      'Rechazado': 'bg-red-500',
      'Prohibido': 'bg-red-500'
    };
    return statusMap[status] || 'bg-gray-500';
  };

  const getDocumentStatusIcon = (estado) => {
    switch(estado) {
      case 'vigente': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'por_vencer': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'vencido': return <XCircle className="w-5 h-5 text-red-400" />;
      default: return null;
    }
  };

  const tabs = [
    { id: 'general', label: 'Información General', icon: User },
    { id: 'carrera', label: 'Plan de Carrera', icon: Award },
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'vehiculo', label: 'Vehículo', icon: Car },
    { id: 'metricas', label: 'Métricas', icon: TrendingUp },
    { id: 'historial', label: 'Historial', icon: Clock },
    { id: 'finanzas', label: 'Finanzas', icon: DollarSign }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="flex flex-col items-center justify-center h-64">
          <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />
          <p className="text-white text-xl mb-4">{error}</p>
          <button
            onClick={() => navigate('/admin/conductores')}
            className="px-6 py-2 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-all"
          >
            Volver a Conductores
          </button>
        </div>
      </div>
    );
  }

  if (!conductor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-white text-xl mb-4">No se encontró el conductor</p>
          <button
            onClick={() => navigate('/admin/conductores')}
            className="px-6 py-2 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-all"
          >
            Volver a Conductores
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/conductores')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Conductores
        </button>

        <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {conductor?.nombre_completo?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div className={`absolute bottom-0 right-0 w-6 h-6 ${getStatusColor(conductor?.estado_cuenta)} rounded-full border-2 border-gray-800`}></div>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white">{conductor?.nombre_completo}</h1>
                <p className="text-gray-400">ID: {conductor?.id}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-white font-semibold">{conductor?.calificacion || 'N/A'}</span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-400">{conductor?.viajes_completados} viajes</span>
                  {conductor?.deposito && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-400">Depósito: {formatCurrency(conductor.deposito)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className={`p-3 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              <div className="hidden lg:flex items-center gap-3 px-3 py-2 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20">
                <span className="text-[10px] uppercase tracking-wider text-gray-400">Estado</span>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                  <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(statusSeleccionado)}`}></span>
                  <select
                    value={statusSeleccionado}
                    onChange={(e) => setStatusSeleccionado(e.target.value)}
                    className="bg-transparent text-white text-sm font-semibold focus:outline-none"
                  >
                    <option value="Pendiente" className="bg-gray-800">Pendiente</option>
                    <option value="Aprobado" className="bg-gray-800">Aprobado</option>
                    <option value="Rechazado" className="bg-gray-800">Rechazado</option>
                    <option value="Suspendido" className="bg-gray-800">Suspendido</option>
                  </select>
                </div>
                <button
                  onClick={handleCambiarStatus}
                  disabled={statusUpdating}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-lg hover:from-cyan-500 hover:to-blue-600 transition-all disabled:opacity-50"
                >
                  {statusUpdating ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
              
              <button
                onClick={() => setShowEditModal(true)}
                className="p-3 rounded-xl backdrop-blur-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-all"
              >
                <Edit className="w-5 h-5" />
              </button>

              <button
                onClick={handleDelete} // ✅ Ahora llama a la función directa
                className="p-3 rounded-xl backdrop-blur-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
                title="Eliminar Conductor"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-2 mb-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cambio rápido de estado (mobile) */}
      <div className="lg:hidden backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-4 mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">Cambiar estado del conductor</div>
            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(statusSeleccionado)} text-white/90`}>
              {statusSeleccionado}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(statusSeleccionado)}`}></span>
              <select
                value={statusSeleccionado}
                onChange={(e) => setStatusSeleccionado(e.target.value)}
                className="w-full bg-transparent text-white focus:outline-none"
              >
                <option value="Pendiente" className="bg-gray-800">Pendiente</option>
                <option value="Aprobado" className="bg-gray-800">Aprobado</option>
                <option value="Rechazado" className="bg-gray-800">Rechazado</option>
                <option value="Suspendido" className="bg-gray-800">Suspendido</option>
              </select>
            </div>
            <button
              onClick={handleCambiarStatus}
              disabled={statusUpdating}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-lg hover:from-cyan-500 hover:to-blue-600 transition-all disabled:opacity-50"
            >
              {statusUpdating ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'general' && (
            <>
              {/* Información de Contacto */}
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Información de Contacto</h2>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-300">{conductor?.telefono || 'No especificado'}</span>
                    {conductor?.telefono && (
                      <button 
                        onClick={() => handleCopyToClipboard(conductor.telefono)}
                        className="ml-auto text-gray-400 hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-300">{conductor?.email || 'No especificado'}</span>
                    {conductor?.email && (
                      <button 
                        onClick={() => handleCopyToClipboard(conductor.email)}
                        className="ml-auto text-gray-400 hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-300">{conductor?.direccion}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-300">{conductor?.chat_id_telegram}</span>
                    {conductor?.bot_activo && (
                      <span className="ml-2 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                        Bot Activo
                      </span>
                    )}
                  </div>
                  {conductor?.curp && (
                    <div className="flex items-center gap-3">
                      <Hash className="w-5 h-5 text-cyan-400" />
                      <span className="text-gray-300">CURP: {conductor.curp}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Información Laboral */}
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <h2 className="text-xl font-bold text-white mb-4">Información Laboral</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Fecha de Nacimiento</p>
                    <p className="text-white font-semibold">
                      {formatDate(conductor?.fecha_nacimiento)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Fecha de Ingreso</p>
                    <p className="text-white font-semibold">
                      {formatDate(conductor?.fecha_ingreso)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Número de Licencia</p>
                    <p className="text-white font-semibold">{conductor?.numero_licencia || 'No especificado'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Vigencia de Licencia</p>
                    <p className="text-white font-semibold">
                      {conductor?.licencia_vigencia ? (
                        <span className={new Date(conductor.licencia_vigencia) < new Date() ? 'text-red-400' : ''}>
                          {formatDate(conductor.licencia_vigencia)}
                        </span>
                      ) : 'No especificada'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Vehículo Asignado</p>
                    <p className="text-white font-semibold">{conductor?.vehiculo_actual}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Estado de Cuenta</p>
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                      conductor?.estado_cuenta === 'Activo' || conductor?.estado_cuenta === 'Aprobado' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : conductor?.estado_cuenta === 'Pendiente' 
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {conductor?.estado_cuenta}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'carrera' && (
            <PanelPlanCarrera 
              conductor={conductor} 
              onRefresh={handleRefresh} 
            />
          )}

         {activeTab === 'documentos' && (
  <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl font-bold text-white">Documentos</h2>
      <button 
        onClick={() => setShowUploadModal(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg transition-all"
      >
        <Upload className="w-4 h-4" />
        Subir Documento
      </button>
    </div>
    
    <div className="space-y-3">
      {/* INE Frente */}
      {conductor?.url_ine_frente ? (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-white font-semibold">INE - Frente</p>
              <p className="text-gray-400 text-sm">Documento cargado</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.open(conductor.url_ine_frente, '_blank')}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Ver documento"
            >
              <Eye className="w-4 h-4" />
            </button>
            <a
              href={conductor.url_ine_frente}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Descargar documento"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 border-dashed">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-white font-semibold">INE - Frente</p>
              <p className="text-gray-400 text-sm">No cargado</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setSelectedDocType('ine_frente');
              setShowUploadModal(true);
            }}
            className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
          >
            Subir
          </button>
        </div>
      )}

      {/* INE Reverso */}
      {conductor?.url_ine_reverso ? (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-white font-semibold">INE - Reverso</p>
              <p className="text-gray-400 text-sm">Documento cargado</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.open(conductor.url_ine_reverso, '_blank')}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Ver documento"
            >
              <Eye className="w-4 h-4" />
            </button>
            <a
              href={conductor.url_ine_reverso}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Descargar documento"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 border-dashed">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-white font-semibold">INE - Reverso</p>
              <p className="text-gray-400 text-sm">No cargado</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setSelectedDocType('ine_reverso');
              setShowUploadModal(true);
            }}
            className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
          >
            Subir
          </button>
        </div>
      )}

      {/* Licencia Frente */}
      {conductor?.url_licencia_frente ? (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            {conductor.licencia_vigencia && new Date(conductor.licencia_vigencia) < new Date() ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            )}
            <div>
              <p className="text-white font-semibold">Licencia - Frente</p>
              <p className="text-gray-400 text-sm">
                {conductor.licencia_vigencia ? 
                  `Vence: ${formatDate(conductor.licencia_vigencia)}` : 
                  'Vigencia no especificada'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.open(conductor.url_licencia_frente, '_blank')}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Ver documento"
            >
              <Eye className="w-4 h-4" />
            </button>
            <a
              href={conductor.url_licencia_frente}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Descargar documento"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 border-dashed">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-white font-semibold">Licencia - Frente</p>
              <p className="text-gray-400 text-sm">No cargado</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setSelectedDocType('licencia_frente');
              setShowUploadModal(true);
            }}
            className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
          >
            Subir
          </button>
        </div>
      )}

      {/* Licencia Reverso */}
      {conductor?.url_licencia_reverso ? (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-white font-semibold">Licencia - Reverso</p>
              <p className="text-gray-400 text-sm">Documento cargado</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.open(conductor.url_licencia_reverso, '_blank')}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Ver documento"
            >
              <Eye className="w-4 h-4" />
            </button>
            <a
              href={conductor.url_licencia_reverso}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              title="Descargar documento"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 border-dashed">
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-white font-semibold">Licencia - Reverso</p>
              <p className="text-gray-400 text-sm">No cargado</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setSelectedDocType('licencia_reverso');
              setShowUploadModal(true);
            }}
            className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
          >
            Subir
          </button>
        </div>
      )}

      {/* CURP */}
      {conductor?.curp && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-white font-semibold">CURP</p>
              <p className="text-gray-400 text-sm font-mono">{conductor.curp}</p>
            </div>
          </div>
          <button 
            onClick={() => handleCopyToClipboard(conductor.curp)}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            title="Copiar CURP"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* RFC */}
      {conductor?.rfc && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-white font-semibold">RFC</p>
              <p className="text-gray-400 text-sm font-mono">{conductor.rfc}</p>
            </div>
          </div>
          <button 
            onClick={() => handleCopyToClipboard(conductor.rfc)}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            title="Copiar RFC"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  </div>
)}

          {activeTab === 'vehiculo' && (
            <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Vehículo Asignado</h2>
              {conductor?.vehiculo ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Marca</p>
                      <p className="text-white font-semibold">{conductor.vehiculo.marca}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Modelo</p>
                      <p className="text-white font-semibold">{conductor.vehiculo.modelo}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Año</p>
                      <p className="text-white font-semibold">{conductor.vehiculo.año}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Placas</p>
                      <p className="text-white font-semibold">{conductor.vehiculo.placas}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Número Económico</p>
                      <p className="text-white font-semibold">{conductor.vehiculo.numero_economico}</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleDesasignarVehiculo}
                      disabled={loading}
                      className="px-6 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl hover:bg-red-500/30 transition-all disabled:opacity-50"
                    >
                      Desasignar Vehículo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Car className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No hay vehículo asignado</p>
               <button 
  onClick={() => {
    setShowAssignVehicleModal(true);
    fetchVehiculosDisponibles();
  }}
  className="px-6 py-2 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-all"
>
  Asignar Vehículo
</button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'metricas' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Navigation className="w-5 h-5 text-cyan-400" />
                  <p className="text-gray-400">Viajes este mes</p>
                </div>
                <p className="text-3xl font-bold text-white">{conductor?.metricas.viajes_mes}</p>
              </div>
              
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <p className="text-gray-400">Viajes Completados</p>
                </div>
                <p className="text-3xl font-bold text-white">{conductor?.viajes_completados}</p>
              </div>

              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <p className="text-gray-400">Ganancias Totales</p>
                </div>
                <p className="text-2xl font-bold text-white">{formatCurrency(conductor?.ingresos_generados)}</p>
              </div>

              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  <p className="text-gray-400">Promedio por Viaje</p>
                </div>
                <p className="text-2xl font-bold text-white">
                  {conductor?.viajes_completados > 0 
                    ? formatCurrency(conductor?.ingresos_generados / conductor?.viajes_completados)
                    : '$0'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Historial de Viajes</h2>
              {conductor?.historial_viajes && conductor.historial_viajes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 text-gray-400">Fecha</th>
                        <th className="text-left py-3 text-gray-400">Cliente</th>
                        <th className="text-left py-3 text-gray-400">Origen</th>
                        <th className="text-left py-3 text-gray-400">Destino</th>
                        <th className="text-left py-3 text-gray-400">Monto</th>
                        <th className="text-left py-3 text-gray-400">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conductor.historial_viajes.map((viaje, index) => (
                        <tr key={viaje.id || index} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-3 text-white">{formatDate(viaje.fecha_inicio || viaje.fecha)}</td>
                          <td className="py-3 text-white">{viaje.cliente_nombre || viaje.cliente || 'N/A'}</td>
                          <td className="py-3 text-white">{viaje.origen || 'N/A'}</td>
                          <td className="py-3 text-white">{viaje.destino || 'N/A'}</td>
                          <td className="py-3 text-white">{formatCurrency(viaje.total || viaje.monto)}</td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              viaje.status === 'completado' || viaje.estado === 'completado'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : viaje.status === 'en_curso' 
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {viaje.status || viaje.estado || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No hay historial de viajes disponible</p>
                </div>
              )}
            </div>
          )}

         {activeTab === 'finanzas' && (
  <div className="space-y-6">
    {/* 🆕 TIPO DE PÓLIZA */}
    <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Tipo de Póliza</h2>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
          conductor?.tipo_poliza === 'AHORRO_50' 
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
            : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
        }`}>
          {conductor?.tipo_poliza === 'AHORRO_50' ? '💰 Ahorro $50' : '🛡️ Póliza $100'}
        </span>
      </div>
      <p className="text-gray-400 text-sm">
        {conductor?.tipo_poliza === 'AHORRO_50' 
          ? 'Modelo de ahorro acumulativo - El conductor ahorra $50 diarios que se acumulan en su cartera.' 
          : 'Modelo de póliza global - El conductor paga $100 diarios como prima de seguro con límite de $50,000.'}
      </p>
    </div>

    {/* 🛡️ PÓLIZA MECÁNICA */}
    <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-6 h-6 text-purple-400" />
        <h2 className="text-xl font-bold text-white">Póliza Mecánica</h2>
      </div>
      
      <div className="space-y-4">
        {/* Saldo Disponible */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
          <p className="text-gray-400 text-sm mb-2">Saldo Disponible</p>
          <p className="text-4xl font-bold text-white mb-3">
            {formatCurrency(conductor?.saldo_poliza_mecanica || 50000)}
          </p>
          
          {/* Barra de Progreso */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 rounded-full"
                style={{ 
                  width: `${Math.min(((conductor?.saldo_poliza_mecanica || 50000) / 50000) * 100, 100)}%` 
                }}
              />
            </div>
            <span className="text-sm text-purple-400 font-bold min-w-[60px] text-right">
              {((conductor?.saldo_poliza_mecanica || 50000) / 50000 * 100).toFixed(1)}%
            </span>
          </div>
          
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>$0</span>
            <span>Límite: $50,000</span>
          </div>
        </div>

        {/* Total Aportado (Histórico) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <p className="text-gray-400 text-sm">Total Aportado</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(conductor?.total_aportado_poliza || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Registro histórico</p>
          </div>

          {/* Estado de Póliza */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <p className="text-gray-400 text-sm">Estado</p>
            </div>
            <p className="text-xl font-bold text-emerald-400">
              {(conductor?.saldo_poliza_mecanica || 50000) > 0 ? 'Activa' : 'Agotada'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {(conductor?.saldo_poliza_mecanica || 50000) > 0 ? 'Disponible para usar' : 'Sin fondos'}
            </p>
          </div>
        </div>

        {/* Información adicional */}
        <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
          <p className="text-xs text-gray-400">
            💡 <strong className="text-purple-400">
              {conductor?.tipo_poliza === 'AHORRO_50' ? 'Modelo AHORRO_50:' : 'Modelo POLIZA_100:'}
            </strong> {' '}
            {conductor?.tipo_poliza === 'AHORRO_50' 
              ? 'Los pagos diarios se acumulan en este saldo. Puede usarse para mantenimientos y reparaciones.'
              : 'Este es un límite global de $50,000. Los pagos diarios NO aumentan este límite, solo se registran históricamente.'}
          </p>
        </div>
      </div>
    </div>

    {/* 🔧 AHORRO PARA MANTENIMIENTO */}
    <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Wrench className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-bold text-white">Ahorro para Mantenimiento</h2>
      </div>
      
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
        <p className="text-gray-400 text-sm mb-2">Saldo Acumulado</p>
        <p className="text-4xl font-bold text-blue-400 mb-2">
          {formatCurrency(conductor?.saldo_ahorro_mantenimiento || 0)}
        </p>
        <p className="text-xs text-gray-500">
          Ahorro voluntario del conductor para mantenimientos
        </p>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <p className="text-xs text-gray-400">
          💡 <strong className="text-blue-400">Ahorro Independiente:</strong> Este saldo se acumula cuando el conductor elige destinar sus pagos extras al "Ahorro para Mantenimiento". Es completamente independiente de la póliza mecánica.
        </p>
      </div>
    </div>

    {/* 💰 OTRAS FINANZAS */}
    <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
      <h2 className="text-xl font-bold text-white mb-4">Resumen Financiero</h2>
      <div className="space-y-3">
        
        <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10">
          <div>
            <p className="text-gray-400 text-sm">Ingresos Generados</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(conductor?.ingresos_generados || 0)}
            </p>
          </div>
          <DollarSign className="w-8 h-8 text-emerald-400" />
        </div>
        
        {conductor?.deposito && (
          <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10">
            <div>
              <p className="text-gray-400 text-sm">Depósito</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(conductor.deposito)}
              </p>
            </div>
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
        )}

        {conductor?.saldo_ganancias && (
          <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10">
            <div>
              <p className="text-gray-400 text-sm">Saldo de Ganancias</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(conductor.saldo_ganancias)}
              </p>
            </div>
            <CreditCard className="w-8 h-8 text-purple-400" />
          </div>
        )}
        
        <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/10">
          <div>
            <p className="text-gray-400 text-sm">Promedio por Viaje</p>
            <p className="text-2xl font-bold text-white">
              {conductor?.viajes_completados > 0 
                ? formatCurrency((conductor?.ingresos_generados || 0) / conductor.viajes_completados)
                : '$0.00'}
            </p>
          </div>
          <TrendingUp className="w-8 h-8 text-cyan-400" />
        </div>
      </div>
    </div>
  </div>
)}

          {/* Alertas */}
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Alertas</h3>
            <div className="space-y-3">
              {conductor?.licencia_vigencia && new Date(conductor.licencia_vigencia) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-semibold">Licencia por vencer</p>
                    <p className="text-gray-400 text-xs">Vence: {formatDate(conductor.licencia_vigencia)}</p>
                  </div>
                </div>
              )}
              
              {!conductor?.curp && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-semibold">CURP faltante</p>
                    <p className="text-gray-400 text-xs">Requiere actualización</p>
                  </div>
                </div>
              )}

              {conductor?.estado_cuenta === 'Pendiente' && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Clock className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-semibold">Verificación pendiente</p>
                    <p className="text-gray-400 text-xs">Completar documentación</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actividad Reciente */}
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Información Adicional</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>Registro creado:</span>
                <span>{formatDate(conductor?.created_at)}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Última actualización:</span>
                <span>{formatDate(conductor?.updated_at)}</span>
              </div>
              
              {/* --- 👇 CAMBIO 3: Lógica para mostrar ID de usuario o botón de crear cuenta --- */}
              {!conductor?.usuario_id ? (
                <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <p className="text-amber-400 font-semibold">Sin Cuenta de Acceso</p>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">Este conductor no puede iniciar sesión en el portal.</p>
                  <button
                    onClick={handleCrearAcceso}
                    disabled={loading} // Deshabilitar si ya está cargando algo
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    Crear Cuenta de Acceso
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex justify-between text-gray-300 items-center">
                  <span>ID Usuario (Login):</span>
                  <span className="font-mono text-cyan-400 text-base bg-white/10 px-2 py-0.5 rounded">
                    {conductor.usuario_id}
                  </span>
                </div>
              )}
              {/* --- 👆 FIN DEL CAMBIO 👆 --- */}
              
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="backdrop-blur-xl bg-gray-800/90 rounded-2xl border border-white/20 p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Confirmar Eliminación</h3>
            <p className="text-gray-300 mb-6">
              ¿Estás seguro de que deseas eliminar a {conductor?.nombre_completo}? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
{/* Modal para asignar vehículo */}
{showAssignVehicleModal && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="backdrop-blur-xl bg-gray-800/90 rounded-2xl border border-white/20 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <h3 className="text-xl font-bold text-white mb-4">Asignar Vehículo</h3>
      
      <div className="space-y-4">
        {/* Selector de vehículo */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Vehículo Disponible
          </label>
          
          {loadingVehiculos ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent mx-auto"></div>
              <p className="text-gray-400 text-sm mt-2">Cargando vehículos...</p>
            </div>
          ) : vehiculosDisponibles.length === 0 ? (
            <div className="text-center py-8 bg-white/5 rounded-lg border border-white/10">
              <Car className="w-12 h-12 text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400">No hay vehículos disponibles</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {vehiculosDisponibles.map((vehiculo) => (
                <button
                  key={vehiculo.id}
                  onClick={() => setSelectedVehiculo(vehiculo.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedVehiculo === vehiculo.id
                      ? 'border-cyan-500 bg-cyan-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">
                        {vehiculo.numero_vehiculo} - {vehiculo.marca} {vehiculo.modelo}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {vehiculo.año} • {vehiculo.placa} • {vehiculo.color}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {vehiculo.tipo_vehiculo} • {vehiculo.tipo_socio}
                      </p>
                    </div>
                    {selectedVehiculo === vehiculo.id && (
                      <CheckCircle className="w-6 h-6 text-cyan-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Configuración de renta */}
        {selectedVehiculo && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Renta Diaria ($)
                </label>
                <input
                  type="number"
                  value={rentaDiaria}
                  onChange={(e) => setRentaDiaria(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  min="0"
                  step="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Abono Póliza ($)
                </label>
                <input
                  type="number"
                  value={abonoPoliza}
                  onChange={(e) => setAbonoPoliza(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  min="0"
                  step="10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Fecha de Inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>

            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <p className="text-cyan-400 text-sm">
                💡 <strong>Total diario:</strong> ${(rentaDiaria + abonoPoliza).toFixed(2)}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Renta: ${rentaDiaria} + Póliza: ${abonoPoliza}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => {
            setShowAssignVehicleModal(false);
            setSelectedVehiculo(null);
          }}
          className="flex-1 px-4 py-2 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          onClick={handleAsignarVehiculo}
          disabled={loading || !selectedVehiculo}
          className="flex-1 px-4 py-2 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Asignando...' : 'Asignar Vehículo'}
        </button>
      </div>
    </div>
  </div>
)}
      
      {/* Modal para subir documentos */}
{showUploadModal && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="backdrop-blur-xl bg-gray-800/90 rounded-2xl border border-white/20 p-6 max-w-md w-full">
      <h3 className="text-xl font-bold text-white mb-4">Subir Documento</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tipo de Documento
          </label>
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            <option value="">Seleccionar...</option>
            <option value="ine_frente">INE - Frente</option>
            <option value="ine_reverso">INE - Reverso</option>
            <option value="licencia_frente">Licencia - Frente</option>
            <option value="licencia_reverso">Licencia - Reverso</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Archivo
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setSelectedFile(e.target.files[0])}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:text-white hover:file:bg-cyan-600"
          />
          {selectedFile && (
            <p className="text-xs text-gray-400 mt-2">
              Archivo: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => {
            setShowUploadModal(false);
            setSelectedFile(null);
            setSelectedDocType('');
          }}
          className="flex-1 px-4 py-2 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
          disabled={uploadingFile}
        >
          Cancelar
        </button>
        <button
          onClick={handleUploadDocument}
          disabled={uploadingFile || !selectedFile || !selectedDocType}
          className="flex-1 px-4 py-2 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploadingFile ? 'Subiendo...' : 'Subir'}
        </button>
      </div>
    </div>
  </div>
)}

      <ConductorModalWizard
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        conductor={conductor}
        onSubmit={async (formData) => {
          try {
            const dataToSend = {
              nombre_conductor: formData.get('nombre_conductor'),
              numero_telefono: formData.get('numero_telefono'),
              email: formData.get('email'),
              curp: formData.get('curp'),
              rfc: formData.get('RFC'),
              direccion_completa: formData.get('direccion'),
              fecha_nacimiento: formData.get('fecha_nacimiento'),
              status: formData.get('status'),
              matricula: formData.get('matricula'),
              licencia_conducir: formData.get('LicenciaConducir'),
              licencia_vigencia: formData.get('licencia_vencimiento'),
              chat_id_telegram: formData.get('chat_id_telegram'),
              username_telegram: formData.get('username_telegram'),
              saldo_ganancias: formData.get('saldo_ganancias'),
              deposito: formData.get('deposito'),
              tasa_aceptacion: formData.get('tasa_aceptacion'),
              tasa_cancelacion: formData.get('tasa_cancelacion'),
              tasa_completacion: formData.get('tasa_completacion'),
              status_trabajo: formData.get('status_trabajo'),
              bot_configurado: formData.get('bot_configurado') === 'true',
              observaciones: formData.get('Observaciones'),
              categoria: formData.get('categoria'),
              numero_de_ine_ife: formData.get('Numero_de_INE_IFE')
            };
            
            Object.keys(dataToSend).forEach(key => {
              if (dataToSend[key] === null || dataToSend[key] === undefined || dataToSend[key] === '') {
                delete dataToSend[key];
              }
            });
              
            const response = await adminService.updateConductor(conductor.id, dataToSend);
            if (response.success) {
              await fetchConductor();
              setShowEditModal(false);
              toast.success('Conductor actualizado correctamente');
            }
          } catch (error) {
            console.error('Error:', error);
            toast.error(error?.message || 'Error al actualizar conductor');
            throw error;
          }
        }}
      />
      
    </div>
  );
};

export default ConductorDetail;
