// frontend/src/pages/admin/Conductores.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ConductorModalWizard from '../../components/admin/ConductorModalWizard';
import { useAuth } from '../../contexts/AuthContext';
import { Check, X } from 'lucide-react';

import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  Phone,
  Mail,
  Star,
  DollarSign,
  Car,
  CheckCircle,
  Clock,
  XCircle,
  Edit,
  Trash2,
  Eye,
  Upload,
  FileText,
  AlertTriangle,
  Shield,
  Activity,
  Calendar,
  MessageCircle,
  MoreVertical,
  Download,
  RefreshCw,
  FileWarning // 🆕 Agregado para siniestros
} from 'lucide-react';
import adminService from '../../services/adminService';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Componente para el Avatar del Conductor con Fallback
const ConductorAvatar = ({ conductor, size = 'md' }) => {
  const [imageError, setImageError] = useState(false);
  
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg'
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getGradient = (name) => {
    const gradients = [
      'from-cyan-400 to-blue-500',
      'from-purple-400 to-pink-500',
      'from-green-400 to-cyan-500',
      'from-orange-400 to-red-500',
      'from-pink-400 to-purple-500',
      'from-blue-400 to-indigo-500'
    ];
    const index = name ? name.length % gradients.length : 0;
    return gradients[index];
  };

  if (conductor.foto_url && !imageError) {
    return (
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden ring-2 ring-white/20`}>
        <img 
          src={conductor.foto_url}
          alt={conductor.nombre_conductor}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${getGradient(conductor.nombre_conductor)} flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white/20`}>
      {getInitials(conductor.nombre_conductor)}
    </div>
  );
};

// Componente de Tarjeta de Conductor Mejorado
const ConductorCard = ({ conductor, onEdit, onDelete, onView, onViewSiniestros, onProcesarBaja }) => {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // 1. Detección de Solicitud y Permisos
  const esSolicitud = conductor.status === 'Solicitud_baja';
  const rolesJefes = ['super_admin', 'direccion', 'gerente_ops'];
  const soyJefe = rolesJefes.includes(user?.rol);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusInfo = (status) => {
    const statusConfig = {
      'Aprobado': {
        color: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
        icon: CheckCircle,
        bgGlow: 'bg-green-500/10'
      },
      'Activo': {
        color: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
        icon: CheckCircle,
        bgGlow: 'bg-green-500/10'
      },
      'Inactivo': {
        color: 'from-gray-500/20 to-slate-500/20 border-gray-500/30 text-gray-300',
        icon: Clock,
        bgGlow: 'bg-gray-500/10'
      },
      'Pendiente': {
        color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-400',
        icon: Clock,
        bgGlow: 'bg-yellow-500/10'
      },
      'Rechazado': {
        color: 'from-red-500/20 to-rose-500/20 border-red-500/30 text-red-400',
        icon: XCircle,
        bgGlow: 'bg-red-500/10'
      },
      'Suspendido': {
        color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-400',
        icon: AlertTriangle,
        bgGlow: 'bg-orange-500/10'
      },
      'Solicitud_baja': {
         color: 'from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-400',
         icon: AlertTriangle,
         bgGlow: 'bg-orange-500/10'
       },
    };
    return statusConfig[status] || statusConfig['Pendiente'];
  };

  const getWorkStatus = (status) => {
    const statusConfig = {
      'activo': { label: 'Activo', color: 'bg-green-500', pulse: true },
      'ocupado': { label: 'Ocupado', color: 'bg-blue-500', pulse: false },
      'en_servicio': { label: 'En servicio', color: 'bg-blue-500', pulse: false },
      'conectado': { label: 'Conectado', color: 'bg-emerald-500', pulse: false },
      'desconectado': { label: 'Desconectado', color: 'bg-gray-500', pulse: false },
      'inactivo': { label: 'Inactivo', color: 'bg-gray-500', pulse: false }
    };
    return statusConfig[status] || statusConfig['Pendiente'];
  };

  const statusInfo = getStatusInfo(conductor.status);
  const StatusIcon = statusInfo.icon;
  const workStatus = getWorkStatus(conductor.status_trabajo);

  // Calcular métricas
  const hasGoodMetrics = conductor.calificacion_promedio >= 4.5 && conductor.tasa_completacion > 90;
  const hasAlerts = conductor.licencia_vencimiento && new Date(conductor.licencia_vencimiento) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

return (
    <div className={`group relative bg-black/40 backdrop-blur-xl rounded-xl border transition-all duration-300 overflow-hidden
      ${esSolicitud 
         ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)]' // 🟠 Estilo Solicitud (Naranja + Sombra)
         : 'border-white/10 hover:border-cyan-500/30' // 🟣 Estilo Original (El que te gusta)
      }
    `}>
      
      {/* ✨ EFECTO DE BRILLO (ESTE ES EL QUE DABA EL COLOR MORADITO) ✨ */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-cyan-500/10 group-hover:via-purple-500/10 group-hover:to-pink-500/10 transition-all duration-500"></div>
      
      {/* Indicadores de estado */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {(hasAlerts || esSolicitud) && (
          <div className="p-1.5 bg-orange-500/20 rounded-lg" title="Documentos próximos a vencer">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
        )}
        {hasGoodMetrics && (
          <div className="p-1.5 bg-green-500/20 rounded-lg" title="Conductor destacado">
            <Star className="w-4 h-4 text-green-400" />
          </div>
        )}
        {conductor.bot_configurado && (
          <div className="p-1.5 bg-blue-500/20 rounded-lg" title="Bot configurado">
            <MessageCircle className="w-4 h-4 text-blue-400" />
          </div>
        )}
      </div>

      <div className="relative p-6">
        {/* Header con Avatar y Status */}
        <div className="flex items-start gap-4 mb-4">
          <ConductorAvatar conductor={conductor} size="lg" />
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate mb-1">
              {conductor.nombre_conductor || 'Sin nombre'}
            </h3>
            
            {/* Status Badge */}
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${statusInfo.color} backdrop-blur-sm border ${statusInfo.color.split(' ')[2]}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{conductor.status}</span>
            </div>
          </div>

{/* Menu de opciones (MODIFICADO) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`p-2 rounded-lg transition-colors ${esSolicitud ? 'bg-orange-500/10 text-orange-400' : 'hover:bg-white/5 text-gray-400'}`}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-900/95 backdrop-blur-xl rounded-lg shadow-xl border border-white/10 overflow-hidden z-20">
                
                {/* 1. OPCIONES DE GESTIÓN (SOLO JEFES Y SI ES SOLICITUD) */}
                {esSolicitud && soyJefe && (
                    <div className="border-b border-white/10 pb-1 mb-1">
                        <button
                          onClick={() => { onProcesarBaja(conductor.id, 'aprobar'); setShowMenu(false); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-green-400 hover:bg-green-500/10 flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" /> Aprobar Baja
                        </button>
                        <button
                          onClick={() => { onProcesarBaja(conductor.id, 'rechazar'); setShowMenu(false); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                        >
                          <X className="w-4 h-4" /> Rechazar
                        </button>
                    </div>
                )}

                {/* 2. OPCIONES NORMALES (Ver, Editar, Siniestros) */}
                <button onClick={() => { onView(conductor); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Ver detalles
                </button>
                
                <button onClick={() => { onViewSiniestros(conductor); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-orange-400 hover:bg-orange-500/10 flex items-center gap-2">
                  <FileWarning className="w-4 h-4" /> Ver siniestros
                </button>
                
                {/* Editar (Bloqueado si es solicitud) */}
                {!esSolicitud && (
                    <button onClick={() => { onEdit(conductor); setShowMenu(false); }} className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/10 flex items-center gap-2">
                      <Edit className="w-4 h-4" /> Editar
                    </button>
                )}

                {/* 3. OPCIÓN ELIMINAR (Oculta si ya es solicitud y soy jefe, porque ya salen los botones de arriba) */}
                {!(esSolicitud && soyJefe) && (
                    <button
                      onClick={() => { 
                          if(esSolicitud) return; // Si ya es solicitud y no soy jefe, no hago nada (o podrías mostrar alerta)
                          onDelete(conductor.id); 
                          setShowMenu(false); 
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                          esSolicitud 
                            ? 'text-gray-500 cursor-not-allowed' // Deshabilitado visualmente
                            : 'text-red-400 hover:bg-red-500/10'
                      }`}
                      disabled={esSolicitud}
                    >
                      <Trash2 className="w-4 h-4" />
                      {esSolicitud ? 'Esperando Aprobación' : 'Eliminar'}
                    </button>
                )}
              </div>
            )}
          </div>
        </div>
        

        {/* Información de contacto */}
        <div className="space-y-2 mb-4">
          {conductor.numero_telefono && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-gray-500" />
              <span className="text-gray-300">{conductor.numero_telefono}</span>
            </div>
          )}
          {conductor.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-gray-500" />
              <span className="text-gray-300 truncate">{conductor.email}</span>
            </div>
          )}
        </div>

        {/* Métricas en grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Calificación */}
          {conductor.calificacion_promedio > 0 && (
            <div className="bg-white/5 rounded-lg p-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-white font-medium">{conductor.calificacion_promedio.toFixed(1)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Calificación</p>
            </div>
          )}
          
          {/* Saldo */}
          {conductor.saldo_ganancias !== undefined && (
            <div className="bg-white/5 rounded-lg p-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-white font-medium">${conductor.saldo_ganancias.toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Saldo</p>
            </div>
          )}
          
          {/* Vehículos */}
          {conductor.vehiculos && conductor.vehiculos.length > 0 && (
            <div className="bg-white/5 rounded-lg p-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium">{conductor.vehiculos.length}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Vehículo{conductor.vehiculos.length !== 1 ? 's' : ''}</p>
            </div>
          )}
          
          {/* Tasa de completación */}
          {conductor.tasa_completacion > 0 && (
            <div className="bg-white/5 rounded-lg p-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span className="text-white font-medium">{conductor.tasa_completacion}%</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Completación</p>
            </div>
          )}
        </div>

        {/* Estado de trabajo con indicador animado */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className={`w-2.5 h-2.5 ${workStatus.color} rounded-full`}></div>
              {workStatus.pulse && (
                <div className={`absolute inset-0 w-2.5 h-2.5 ${workStatus.color} rounded-full animate-ping`}></div>
              )}
            </div>
            <span className="text-sm text-gray-300">{workStatus.label}</span>
          </div>
          
          {/* Última conexión */}
          {conductor.ultima_conexion && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(conductor.ultima_conexion).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente principal de Conductores
const Conductores = () => {
  const navigate = useNavigate();
  const [conductores, setConductores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [conductorEdit, setConductorEdit] = useState(null);
  const [vistaActual, setVistaActual] = useState('grid'); // 'grid' o 'list'
  const [textoBusqueda, setTextoBusqueda] = useState('');
  
  // Filtros y búsqueda
  const [filtros, setFiltros] = useState({
    busqueda: '',
    status: '',
    statusTrabajo: '',
    conVehiculo: false,
    conBot: false
  });

  // Estadísticas
  const [estadisticas, setEstadisticas] = useState({
    total: 0,
    aprobados: 0,
    pendientes: 0,
    activos: 0,
    conVehiculo: 0,
    calificacionPromedio: 0
  });

  useEffect(() => {
    cargarConductores();
  }, []);

  const cargarConductores = async () => {
    try {
      setLoading(true);
      const response = await adminService.getConductores();
      const conductoresData = response.conductores || response || [];
      setConductores(conductoresData);
      calcularEstadisticas(conductoresData);
    } catch (err) {
      console.error('Error al cargar conductores:', err);
    } finally {
      setLoading(false);
    }
  };

  const refrescarDatos = async () => {
    setRefreshing(true);
    await cargarConductores();
    setRefreshing(false);
  };

  const normalizarTexto = (valor) => (valor || '').toString().trim().toLowerCase();

  const getVehiculosConductor = (conductor) => {
    const vehiculos = conductor?.vehiculos || conductor?.VEHICULOS || [];
    if (Array.isArray(vehiculos) && vehiculos.length > 0) return vehiculos;
    if (conductor?.vehiculo_asignado) return [conductor.vehiculo_asignado];
    if (Array.isArray(conductor?.asignaciones) && conductor.asignaciones.length > 0) return conductor.asignaciones;
    return [];
  };

  const esAprobado = (conductor) => {
    const status = normalizarTexto(conductor?.status);
    return status === 'aprobado' || status === 'activo' || status === 'inactivo';
  };

  const esPendiente = (conductor) => normalizarTexto(conductor?.status) === 'pendiente';

  const estaActivo = (conductor) => {
    const statusTrabajo = normalizarTexto(conductor?.status_trabajo);
    const statusConductor = normalizarTexto(conductor?.status);
    return statusTrabajo === 'activo' || statusConductor === 'activo';
  };

  const calcularEstadisticas = (conductoresData) => {
    const conductoresConCalificacion = conductoresData.filter(
      (c) => Number(c?.calificacion_promedio || 0) > 0
    );

    const stats = {
      total: conductoresData.length,
      aprobados: conductoresData.filter(esAprobado).length,
      pendientes: conductoresData.filter(esPendiente).length,
      activos: conductoresData.filter((c) => esAprobado(c) && estaActivo(c)).length,
      conVehiculo: conductoresData.filter((c) => getVehiculosConductor(c).length > 0).length,
      calificacionPromedio:
        conductoresConCalificacion.length > 0
          ? conductoresConCalificacion.reduce((acc, c) => acc + Number(c?.calificacion_promedio || 0), 0) / conductoresConCalificacion.length
          : 0
    };
    setEstadisticas(stats);
  };

  // FUNCIONES PARA EJECUTAR LA BÚSQUEDA
  const realizarBusqueda = () => {
    setFiltros(prev => ({
      ...prev,
      busqueda: textoBusqueda // Pasamos el texto temporal al filtro real
    }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      realizarBusqueda();
    }
  };
  
  // Filtrado de conductores
const conductoresFiltrados = useMemo(() => {
    return conductores
      // 1. TU FILTRO ACTUAL (Lo dejamos casi igual)
      .filter(conductor => {
        const busqueda = filtros.busqueda.toLowerCase();
        const coincideBusqueda = !busqueda || 
          conductor.nombre_conductor?.toLowerCase().includes(busqueda) ||
          conductor.numero_telefono?.toLowerCase().includes(busqueda) ||
          conductor.email?.toLowerCase().includes(busqueda);
        
        const coincideStatus = !filtros.status || (
          filtros.status === 'Aprobado'
            ? esAprobado(conductor) // Asumo que tienes esta función
            : normalizarTexto(conductor.status) === normalizarTexto(filtros.status)
        );

        const coincideStatusTrabajo = !filtros.statusTrabajo || conductor.status_trabajo === filtros.statusTrabajo;
        const coincideVehiculo = !filtros.conVehiculo || getVehiculosConductor(conductor).length > 0;
        const coincideBot = !filtros.conBot || conductor.bot_configurado;
        
        return coincideBusqueda && coincideStatus && coincideStatusTrabajo && coincideVehiculo && coincideBot;
      })
      // 2. EL ORDENAMIENTO MAGICO (Prioridad a Solicitudes) 
      .sort((a, b) => {
        const statusA = (a.status || '').toString().toLowerCase();
        const statusB = (b.status || '').toString().toLowerCase();
        const esSolicitudA = statusA === 'solicitud_baja';
        const esSolicitudB = statusB === 'solicitud_baja';

        // Regla 1: Si A es solicitud y B no, A va primero (-1)
        if (esSolicitudA && !esSolicitudB) return -1;
        
        // Regla 2: Si B es solicitud y A no, B va primero (1)
        if (!esSolicitudA && esSolicitudB) return 1;

        // Regla 3: Si ambos son iguales, mantén el orden original (0)
        return 0;
      });
      
  }, [conductores, filtros]);

  const handleSubmitConductor = async (formData) => {
    try {
      let conductorCreado = null;
      
      if (conductorEdit) {
        await adminService.updateConductor(conductorEdit.id, formData);
        toast.success('Conductor actualizado correctamente');
      } else {
        // ✅ Capturar el conductor creado
        const response = await adminService.createConductor(formData);
        conductorCreado = response.conductor; // Guardar el conductor creado
        console.log('Conductor creado:', conductorCreado);
        toast.success('Conductor creado correctamente');
      }
      
      await cargarConductores();
      setShowModal(false);
      setConductorEdit(null);
      
      // ✅ Navegar automáticamente al detalle del conductor recién creado
      if (conductorCreado && conductorCreado.id) {
        console.log('Navegando al detalle del conductor:', conductorCreado.id);
        navigate(`/admin/conductores/${conductorCreado.id}`);
      }
      
      console.log('Conductor guardado exitosamente');
    } catch (error) {
      console.error('Error al guardar conductor:', error);
      if (!error?.details && !error?.response?.details) {
        toast.error(error?.message || 'Error al guardar conductor');
      }
      throw error;
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setConductorEdit(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este conductor? Esta acción no se puede deshacer.')) {
      try {
        await adminService.deleteConductor(id);
        await cargarConductores();
      } catch (error) {
        console.error('Error al eliminar conductor:', error);
      }
    }
  };

  const handleProcesarBaja = async (id, accion) => {
    const mensaje = accion === 'aprobar' 
      ? '¿Confirmas que deseas APROBAR la baja definitiva de este conductor?' 
      : '¿Deseas RECHAZAR la solicitud? El conductor volverá a estar Suspendido.';

    if (!window.confirm(mensaje)) return;

    try {
      // 1. Llamamos al servicio
      await adminService.gestionarBajaConductor(id, accion);
      
      // 2. Mensaje de éxito
      // Si usas toast: toast.success(`Solicitud ${accion}da correctamente`);
      alert(`Solicitud ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} con éxito`);

      // 3. RECARGAR LA LISTA (Muy importante)
      // Usa el nombre de la función que usas para cargar los datos, 
      // suele ser fetchConductores() o loadConductores()
      cargarConductores(); 

    } catch (error) {
      console.error(error);
      alert('Error al procesar la solicitud: ' + (error.message || 'Desconocido'));
    }
  };

  const handleView = (conductor) => {
    navigate(`/admin/conductores/${conductor.id}`);
  };

  // 🆕 NUEVA FUNCIÓN PARA VER SINIESTROS
  const handleViewSiniestros = (conductor) => {
    navigate(`/admin/siniestros/conductor/${conductor.id}/historial`);
  };

  if (loading) {
    return <LoadingSpinner size="large" message="Cargando conductores..." />;
  }

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Gestión de Conductores</h1>
            <p className="text-gray-400">
              {conductoresFiltrados.length} de {conductores.length} conductores
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={refrescarDatos}
              className={`p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${refreshing ? 'animate-spin' : ''}`}
              disabled={refreshing}
            >
              <RefreshCw className="w-5 h-5 text-gray-400" />
            </button>
            
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nuevo Conductor
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-black/40 backdrop-blur-xl rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span className="text-2xl font-bold text-white">{estadisticas.total}</span>
            </div>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-2xl font-bold text-white">{estadisticas.aprobados}</span>
            </div>
            <p className="text-xs text-gray-400">Aprobados</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-2xl font-bold text-white">{estadisticas.pendientes}</span>
            </div>
            <p className="text-xs text-gray-400">Pendientes</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <span className="text-2xl font-bold text-white">{estadisticas.activos}</span>
            </div>
            <p className="text-xs text-gray-400">Activos</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Car className="w-5 h-5 text-purple-400" />
              <span className="text-2xl font-bold text-white">{estadisticas.conVehiculo}</span>
            </div>
            <p className="text-xs text-gray-400">Con vehículo</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl rounded-lg p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <span className="text-2xl font-bold text-white">{estadisticas.calificacionPromedio.toFixed(1)}</span>
            </div>
            <p className="text-xs text-gray-400">Calificación</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-black/40 backdrop-blur-xl rounded-lg p-4 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
<div className="md:col-span-2 flex gap-2">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
    <input
      type="text"
      placeholder="Buscar por nombre, teléfono o email..."
      
      // 1. Usamos el estado temporal
      value={textoBusqueda}
      onChange={(e) => setTextoBusqueda(e.target.value)}
      
      // 2. Detectamos el Enter
      onKeyDown={handleKeyDown}
      
      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
    />
  </div>

  {/* 3. Botón de Buscar */}
  <button
    onClick={realizarBusqueda}
    className="px-4 py-2.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-all flex items-center gap-2 font-medium"
  >
    <Search className="w-5 h-5" />
    <span className="hidden xl:inline">Buscar</span>
  </button>
</div>
            
            <select
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
              value={filtros.status}
              onChange={(e) => setFiltros({...filtros, status: e.target.value})}
            >
              <option value="">Todos los estados</option>
              <option value="Aprobado">Aprobado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Rechazado">Rechazado</option>
              <option value="Solicitud_baja">Solicitud de Baja</option>
            </select>
            
            <select
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
              value={filtros.statusTrabajo}
              onChange={(e) => setFiltros({...filtros, statusTrabajo: e.target.value})}
            >
              <option value="">Estado de trabajo</option>
              <option value="activo">Activo</option>
              <option value="ocupado">Ocupado</option>
              <option value="inactivo">Inactivo</option>
            </select>
            
            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={filtros.conVehiculo}
                onChange={(e) => setFiltros({...filtros, conVehiculo: e.target.checked})}
                className="rounded border-gray-600 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm">Con vehículo</span>
            </label>
            
            <label className="flex items-center gap- text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={filtros.conBot}
                onChange={(e) => setFiltros({...filtros, conBot: e.target.checked})}
                className="rounded border-gray-600 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm">Bot configurado</span>
            </label>
          </div>
        </div>

        {/* Lista de conductores */}
        {conductoresFiltrados.length === 0 ? (
          <div className="bg-black/40 backdrop-blur-xl rounded-lg p-12 border border-white/10 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No se encontraron conductores
            </h3>
            <p className="text-gray-400 mb-6">
              {conductores.length === 0 
                ? 'Comienza agregando tu primer conductor' 
                : 'Intenta ajustar los filtros de búsqueda'}
            </p>
            {conductores.length === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all"
              >
                <Plus className="w-5 h-5" />
                Agregar primer conductor
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {conductoresFiltrados.map((conductor) => (
              <ConductorCard
                key={conductor.id}
                conductor={conductor}
                onEdit={(c) => { setConductorEdit(c); setShowModal(true); }}
                onDelete={handleDelete}
                onView={handleView}
                onViewSiniestros={handleViewSiniestros} // 🆕 Nueva prop
                onProcesarBaja={handleProcesarBaja}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Wizard de Conductor */}
      <ConductorModalWizard
        isOpen={showModal}
        onClose={handleCloseModal}
        conductor={conductorEdit}
        onSubmit={handleSubmitConductor}
      />
    </div>
  );
};

export default Conductores;
