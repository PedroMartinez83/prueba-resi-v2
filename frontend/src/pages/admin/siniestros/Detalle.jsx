import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Calendar, MapPin, DollarSign, 
  AlertTriangle, User, Car, FileText, Clock, 
  CheckCircle, Image as ImageIcon, Shield, Wrench,
  ChevronDown, XCircle, RefreshCw, Wallet, TrendingUp
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

// 🆕 Toast Component
const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-yellow-500';
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : AlertTriangle;

  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg ${bgColor} text-white shadow-lg`}>
      <Icon className="w-5 h-5" />
      <span>{message}</span>
    </div>
  );
};

// 🆕 Dropdown de Estado CON PORTAL
const EstadoDropdown = ({ siniestro, onCambiarEstado }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const estados = ['Reportado', 'En revisión', 'En proceso', 'Esperando seguro', 'Resuelto', 'Cancelado'];

  // Calcular posición cuando se abre
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 8,
          left: rect.left
        });
      };
      
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCambiar = async (nuevoEstado) => {
    if (nuevoEstado === siniestro.estado) {
      setIsOpen(false);
      return;
    }
    setLoading(true);
    await onCambiarEstado(nuevoEstado);
    setLoading(false);
    setIsOpen(false);
  };

  const getEstadoInfo = (estado) => {
    const config = {
      'Reportado': { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
      'En revisión': { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: RefreshCw },
      'En proceso': { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: RefreshCw },
      'Esperando seguro': { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Clock },
      'Resuelto': { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
      'Cancelado': { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: XCircle }
    };
    return config[estado] || config['Reportado'];
  };

  const estadoInfo = getEstadoInfo(siniestro.estado);
  const EstadoIcon = estadoInfo.icon;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${estadoInfo.color} hover:opacity-80 transition-all ${loading ? 'opacity-50' : ''}`}
      >
        <EstadoIcon className="w-4 h-4" />
        <span>{siniestro.estado}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 🔥 PORTAL: Renderiza fuera del árbol DOM */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 999999
          }}
          className="w-56 bg-slate-800 rounded-lg shadow-2xl border border-white/10 overflow-hidden"
        >
          <div className="py-1">
            {estados.map((estado) => {
              const info = getEstadoInfo(estado);
              const Icon = info.icon;
              const isActive = estado === siniestro.estado;

              return (
                <button
                  key={estado}
                  onClick={() => handleCambiar(estado)}
                  disabled={loading}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                    isActive ? 'bg-blue-500/20 text-blue-400 font-medium' : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{estado}</span>
                  {isActive && <CheckCircle className="w-4 h-4 ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body  // 🔥 Se renderiza directo en el body
      )}
    </>
  );
};
const SiniestroDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [siniestro, setSiniestro] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    cargarSiniestro();
  }, [id]);

  const cargarSiniestro = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/siniestros/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setSiniestro(data.siniestro);
      }
    } catch (error) {
      console.error('Error al cargar siniestro:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async (nuevoEstado) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/siniestros/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      
      const data = await response.json();

      if (data.success) {
        setSiniestro(prev => ({ ...prev, estado: nuevoEstado }));
        setToast({ message: `Estado actualizado a "${nuevoEstado}"`, type: 'success' });
      }
    } catch (error) {
      console.error('Error:', error);
      setToast({ message: 'Error al cambiar estado', type: 'error' });
    }
  };

  const handleCrearMantenimiento = () => {
    if (!siniestro) return;

    const confirmar = window.confirm(
      `¿Deseas crear la Orden de Mantenimiento para el Siniestro #${siniestro.folio_siniestro}?`
    );

    if (!confirmar) return;

    navigate('/admin/mantenimientos/programar', {
      state: {
        vehiculo_id: siniestro.vehiculo_id,
        conductor_id: siniestro.conductor_id || null,
        siniestro_id: siniestro.id,
        siniestro_folio: siniestro.folio_siniestro,
        tipo_servicio: 'Reparación por Siniestro',
        kilometraje_servicio: siniestro.kilometraje_actual || siniestro.kilometraje || 0,
        observaciones: `Reparación por Siniestro #${siniestro.folio_siniestro}: ${siniestro.descripcion || 'Reparación necesaria'}`,
        costo_estimado: siniestro.costo_estimado || 0,
        vehiculo_info: {
          id: siniestro.vehiculo_id,
          numero_vehiculo: siniestro.numero_vehiculo,
          marca: siniestro.marca,
          modelo: siniestro.modelo,
          kilometraje_actual: siniestro.kilometraje_actual || siniestro.kilometraje || 0
        }
      }
    });
  };

  const handleDistribuirGastos = () => {
    console.log('Distribuir gastos del siniestro:', id);
    setToast({ message: 'Función en desarrollo', type: 'info' });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('es-MX');
  };

  const getGravedadInfo = (gravedad) => {
    const config = {
      'Leve': { color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
      'Moderado': { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
      'Grave': { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
      'Total': { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' }
    };
    return config[gravedad] || config['Leve'];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center">
        <div className="text-white text-xl">Cargando detalle del siniestro...</div>
      </div>
    );
  }

  if (!siniestro) {
    return (
      <div className="min-h-screen bg-[#07425E] p-6 flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 text-center backdrop-blur-sm">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Siniestro no encontrado</h2>
          <p className="text-gray-300 mb-4">El siniestro que buscas no existe o fue eliminado.</p>
          <button
            onClick={() => navigate('/admin/siniestros/lista')}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
          >
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  const fotos = siniestro.fotos_urls ? siniestro.fotos_urls.split(',').filter(Boolean) : [];
  const gravedadInfo = getGravedadInfo(siniestro.gravedad);
  
  // 🔥 Determinar qué botones mostrar
  const puedeCrearMantenimiento = !siniestro.mantenimiento_id && siniestro.estado !== 'Resuelto' && siniestro.estado !== 'Cancelado';
  const puedeDistribuirGastos = siniestro.costo_final > 0 && (siniestro.estado === 'En proceso' || siniestro.estado === 'Resuelto');
  const tieneDistribucion = (siniestro.pagado_por_poliza || 0) + (siniestro.pagado_por_empresa || 0) + (siniestro.pagado_por_conductor || 0) + (siniestro.pagado_por_seguro || 0) > 0;

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Toast */}
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/siniestros/lista')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-400" />
            </button>
            <div>
              <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                Siniestro #{siniestro.folio_siniestro}
              </h1>
              <p className="text-gray-400 mt-1">Detalle completo del incidente</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {puedeCrearMantenimiento && (
              <button
                onClick={handleCrearMantenimiento}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg border border-purple-500/30 transition-all"
              >
                <Wrench className="w-5 h-5" />
                Crear Mantenimiento
              </button>
            )}
            
            {puedeDistribuirGastos && !tieneDistribucion && (
              <button
                onClick={handleDistribuirGastos}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg border border-green-500/30 transition-all"
              >
                <Wallet className="w-5 h-5" />
                Distribuir Gastos
              </button>
            )}
            
            <button
              onClick={() => navigate(`/admin/siniestros/${id}/editar`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg border border-blue-500/30 transition-all"
            >
              <Edit className="w-5 h-5" />
              Editar
            </button>
          </div>
        </div>

        {/* Estado y Gravedad */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between">
           <div className="flex items-center gap-8">
  <div className="relative z-[100]">
    <p className="text-sm text-gray-400 mb-2">Estado Actual</p>
    <EstadoDropdown siniestro={siniestro} onCambiarEstado={handleCambiarEstado} />
  </div>
              <div>
                <p className="text-sm text-gray-400 mb-2">Gravedad</p>
                <span className={`px-4 py-2 rounded-lg text-lg font-bold border ${gravedadInfo.bg} ${gravedadInfo.color} ${gravedadInfo.border}`}>
                  {siniestro.gravedad}
                </span>
              </div>
            </div>
            {siniestro.fecha_resolucion && (
              <div className="text-right">
                <p className="text-sm text-gray-400">Resuelto el</p>
                <p className="text-lg font-semibold text-green-400">{formatDate(siniestro.fecha_resolucion)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Mantenimiento Vinculado */}
        {siniestro.mantenimiento_id && (
          <div className="bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/30 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <div>
                  <p className="text-lg font-semibold text-green-400">Orden de Mantenimiento Creada</p>
                  <p className="text-sm text-gray-400">Mantenimiento ID: #{siniestro.mantenimiento_id}</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/admin/mantenimientos/lista')}
                className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg border border-green-500/30"
              >
                Ver Mantenimiento
              </button>
            </div>
          </div>
        )}

        {/* Información del Incidente */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-400" />
            Información del Incidente
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">Fecha del Incidente</p>
              <p className="text-lg font-semibold text-white">{formatDate(siniestro.fecha_incidente)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Hora</p>
              <p className="text-lg font-semibold text-white">{siniestro.hora_incidente || 'No especificada'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-400 mb-1 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Ubicación
              </p>
              <p className="text-lg text-gray-300">{siniestro.ubicacion || 'No especificada'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Tipo de Siniestro</p>
              <p className="text-lg font-semibold text-white">{siniestro.tipo_siniestro}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Clasificación</p>
              <p className="text-lg font-semibold text-white">{siniestro.clasificacion || 'Sin clasificar'}</p>
            </div>
          </div>
        </div>

        {/* Vehículo y Conductor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-400" />
              Vehículo Involucrado
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">ID Vehículo</p>
                <p className="text-lg font-bold text-blue-400">{siniestro.numero_vehiculo || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Marca y Modelo</p>
                <p className="text-lg font-semibold text-white">
                  {siniestro.marca} {siniestro.modelo}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Placas</p>
                <p className="text-lg font-semibold text-white">{siniestro.placa || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              Conductor
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Nombre</p>
                <p className="text-lg font-semibold text-white">{siniestro.nombre_conductor || 'No asignado'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Teléfono</p>
                <p className="text-lg font-semibold text-white">{siniestro.numero_telefono || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Reportado por</p>
                <p className="text-lg font-semibold text-white">{siniestro.reportado_por || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Descripción */}
        {siniestro.descripcion && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" />
              Descripción del Incidente
            </h3>
            <p className="text-gray-300 leading-relaxed">{siniestro.descripcion}</p>
          </div>
        )}

        {/* Información Financiera */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Información Financiera
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
              <p className="text-sm text-blue-400 mb-1">Costo Estimado</p>
              <p className="text-2xl font-bold text-blue-300">{formatCurrency(siniestro.costo_estimado)}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
              <p className="text-sm text-red-400 mb-1">Costo Final</p>
              <p className="text-2xl font-bold text-red-300">{formatCurrency(siniestro.costo_final)}</p>
            </div>
            {siniestro.monto_deducible > 0 && (
              <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg">
                <p className="text-sm text-purple-400 mb-1">Deducible</p>
                <p className="text-2xl font-bold text-purple-300">{formatCurrency(siniestro.monto_deducible)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Distribución de Gastos (si existe) */}
        {tieneDistribucion && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Distribución de Gastos
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {siniestro.pagado_por_poliza > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                  <p className="text-sm text-blue-400 mb-1">Póliza</p>
                  <p className="text-xl font-bold text-blue-300">{formatCurrency(siniestro.pagado_por_poliza)}</p>
                </div>
              )}
              {siniestro.pagado_por_empresa > 0 && (
                <div className="bg-purple-500/10 border border-purple-500/30 p-4 rounded-lg">
                  <p className="text-sm text-purple-400 mb-1">Empresa</p>
                  <p className="text-xl font-bold text-purple-300">{formatCurrency(siniestro.pagado_por_empresa)}</p>
                </div>
              )}
              {siniestro.pagado_por_conductor > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-lg">
                  <p className="text-sm text-orange-400 mb-1">Conductor</p>
                  <p className="text-xl font-bold text-orange-300">{formatCurrency(siniestro.pagado_por_conductor)}</p>
                </div>
              )}
              {siniestro.pagado_por_seguro > 0 && (
                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                  <p className="text-sm text-green-400 mb-1">Seguro</p>
                  <p className="text-xl font-bold text-green-300">{formatCurrency(siniestro.pagado_por_seguro)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Seguro */}
        {siniestro.involucro_seguro && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Información del Seguro
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Aseguradora</p>
                <p className="text-lg font-semibold text-white">{siniestro.aseguradora || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Póliza</p>
                <p className="text-lg font-semibold text-white">{siniestro.poliza_seguro || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Fotos */}
        {fotos.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-400" />
              Fotos del Siniestro ({fotos.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {fotos.map((foto, index) => (
                <a 
                  key={index}
                  href={foto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-purple-500/50 transition-all"
                >
                  <img
                    src={foto}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                    <span className="text-white opacity-0 group-hover:opacity-100 font-semibold">Ver completa</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Observaciones */}
        {siniestro.observaciones && (
          <div className="bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-yellow-400 mb-3">Observaciones</h3>
            <p className="text-gray-300 leading-relaxed">{siniestro.observaciones}</p>
          </div>
        )}

        {/* Cronología */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Cronología
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-semibold text-blue-400">Creado</p>
                <p className="text-sm text-gray-300">{formatDateTime(siniestro.created_at)}</p>
              </div>
            </div>
            {siniestro.updated_at !== siniestro.created_at && (
              <div className="flex items-start gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm font-semibold text-purple-400">Última actualización</p>
                  <p className="text-sm text-gray-300">{formatDateTime(siniestro.updated_at)}</p>
                </div>
              </div>
            )}
            {siniestro.fecha_resolucion && (
              <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400 mt-1" />
                <div>
                  <p className="text-sm font-semibold text-green-400">Resuelto</p>
                  <p className="text-sm text-gray-300">{formatDateTime(siniestro.fecha_resolucion)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SiniestroDetalle;
