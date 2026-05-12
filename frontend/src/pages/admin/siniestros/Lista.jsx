import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, Filter, Plus, Eye, Edit, Trash2, Wrench,
  AlertTriangle, Calendar, MapPin, DollarSign,
  RefreshCw, CheckCircle, Clock, XCircle, ChevronDown,
  FileText, ArrowLeft
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

// 🆕 Componente Toast para notificaciones
const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-yellow-500';
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : AlertTriangle;

  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg ${bgColor} text-white shadow-lg animate-slide-in`}>
      <Icon className="w-5 h-5" />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
};

// 🆕 Componente Dropdown de Estado
const EstadoDropdown = ({ siniestro, estados, onCambiarEstado }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCambiar = async (nuevoEstado) => {
    if (nuevoEstado === siniestro.estado) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    await onCambiarEstado(siniestro.id, nuevoEstado);
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${estadoInfo.color} hover:opacity-80 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <EstadoIcon className="w-3.5 h-3.5" />
        <span>{siniestro.estado}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 right-0 w-48 bg-slate-800 rounded-lg shadow-xl border border-white/10 overflow-hidden z-50 animate-fade-in">
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
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                    isActive 
                      ? 'bg-blue-500/20 text-blue-400 font-medium' 
                      : 'text-gray-300 hover:bg-white/5'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{estado}</span>
                  {isActive && <CheckCircle className="w-3.5 h-3.5 ml-auto text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const SiniestrosLista = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [siniestros, setSiniestros] = useState([]);
  const [toast, setToast] = useState(null);
  const [filtros, setFiltros] = useState({
    search: '',
    estado: '',
    gravedad: '',
    clasificacion: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  const [opciones, setOpciones] = useState({
    estados: [],
    gravedades: [],
    clasificaciones: []
  });

  // 🔥 LEER FILTROS DE LA URL (desde Dashboard)
  useEffect(() => {
    const estadoURL = searchParams.get('estado');
    const gravedadURL = searchParams.get('gravedad');
    
    if (estadoURL || gravedadURL) {
      setFiltros(prev => ({
        ...prev,
        estado: estadoURL || '',
        gravedad: gravedadURL || ''
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    cargarOpciones();
  }, []);

  useEffect(() => {
    cargarSiniestros();
  }, [filtros]);

  const cargarOpciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/siniestros/opciones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setOpciones(data.opciones);
      }
    } catch (error) {
      console.error('Error al cargar opciones:', error);
    }
  };

  const cargarSiniestros = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      Object.entries(filtros).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/admin/siniestros?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setSiniestros(data.siniestros);
      }
    } catch (error) {
      console.error('Error al cargar siniestros:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async (siniestroId, nuevoEstado) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/siniestros/${siniestroId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      
      const data = await response.json();

      if (data.success) {
        setSiniestros(prevSiniestros => 
          prevSiniestros.map(s => 
            s.id === siniestroId ? { ...s, estado: nuevoEstado } : s
          )
        );
        
        setToast({ 
          message: `Estado actualizado a "${nuevoEstado}"`, 
          type: 'success' 
        });
      } else {
        throw new Error(data.message || 'Error al actualizar estado');
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      setToast({ 
        message: 'Error al cambiar el estado', 
        type: 'error' 
      });
      cargarSiniestros();
    }
  };

  // 🔥 FUNCIÓN: Crear orden de mantenimiento
  const handleCrearMantenimiento = (siniestro) => {
    if (window.confirm('¿Crear Orden de Mantenimiento para este siniestro?')) {
      navigate('/admin/mantenimientos/programar', {
        state: {
          vehiculo_id: siniestro.vehiculo_id,
          conductor_id: siniestro.conductor_id,
          tipo_servicio: 'Reparación por Siniestro',
          siniestro_id_vinculado: siniestro.id,
          observaciones: `Reparación por Siniestro #${siniestro.folio_siniestro}: ${siniestro.descripcion || ''}`,
          costo_estimado: siniestro.costo_estimado || 0
        }
      });
    }
  };

  // 🆕 FUNCIÓN: Distribuir gasto financiero
  const handleDistribuirGasto = (siniestro) => {
    // TODO: Implementar modal de distribución de gastos
    // Por ahora mostrar alerta
    alert(
      `🔜 Función en desarrollo\n\n` +
      `Siniestro: #${siniestro.folio_siniestro}\n` +
      `Costo Final: $${(siniestro.costo_final || 0).toLocaleString('es-MX')}\n\n` +
      `Esta función abrirá el modal para distribuir el gasto entre:\n` +
      `• Conductor\n` +
      `• Póliza Mecánica\n` +
      `• Aseguradora\n` +
      `• Empresa`
    );
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este siniestro?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/siniestros/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setToast({ message: 'Siniestro eliminado exitosamente', type: 'success' });
        cargarSiniestros();
      }
    } catch (error) {
      console.error('Error al eliminar:', error);
      setToast({ message: 'Error al eliminar siniestro', type: 'error' });
    }
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
    return new Date(date).toLocaleDateString('es-MX');
  };

  const getGravedadInfo = (gravedad) => {
    const config = {
      'Leve': { color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      'Moderado': { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      'Grave': { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      'Total': { color: 'bg-red-500/20 text-red-400 border-red-500/30' }
    };
    return config[gravedad] || config['Leve'];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center">
        <div className="text-white text-xl">Cargando siniestros...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Toast Notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => navigate('/admin/siniestros')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <h1 className="text-4xl font-bold text-white">
                Lista de Siniestros
              </h1>
            </div>
            <p className="text-gray-400 ml-14">
              Gestión y seguimiento de todos los siniestros
            </p>
          </div>
          
          <button
            onClick={() => navigate('/admin/siniestros/registrar')}
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Registrar Siniestro
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Vehículo, conductor, reporte..."
                  value={filtros.search}
                  onChange={(e) => setFiltros({...filtros, search: e.target.value})}
                  className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Estado</label>
              <select
                value={filtros.estado}
                onChange={(e) => setFiltros({...filtros, estado: e.target.value})}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="bg-slate-800">Todos</option>
                {opciones.estados?.map(estado => (
                  <option key={estado} value={estado} className="bg-slate-800">{estado}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Gravedad</label>
              <select
                value={filtros.gravedad}
                onChange={(e) => setFiltros({...filtros, gravedad: e.target.value})}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="bg-slate-800">Todas</option>
                {opciones.gravedades?.map(gravedad => (
                  <option key={gravedad} value={gravedad} className="bg-slate-800">{gravedad}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Fecha Desde</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) => setFiltros({...filtros, fecha_desde: e.target.value})}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Fecha Hasta</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={(e) => setFiltros({...filtros, fecha_hasta: e.target.value})}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setFiltros({
                search: '',
                estado: '',
                gravedad: '',
                clasificacion: '',
                fecha_desde: '',
                fecha_hasta: ''
              })}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm border border-white/20 transition-all"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Tabla */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
        
        {/*   1. Cambiamos a overflow-auto, altura máxima de 60vh y la barra estilizada   */}
        <div className="overflow-auto max-h-[60vh] sidebar-scroll">
          
          {/*   2. Agregamos relative y min-w-[1100px] para que las 9 columnas respiren   */}
          <table className="w-full min-w-[1100px] relative">
            
            {/*   3. Quitamos la transparencia y ponemos fondo sólido, sticky, top-0, z-10   */}
            <thead className="bg-[#1a1a2e] sticky top-0 z-10 shadow-sm">
              <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Folio</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Vehículo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Conductor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Tipo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Gravedad</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Estado</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Costo</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {siniestros.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-lg">No se encontraron siniestros</p>
                    </td>
                  </tr>
                ) : (
                  siniestros.map((siniestro) => {
                    const gravedadInfo = getGravedadInfo(siniestro.gravedad);
                    
                    return (
                      <tr key={siniestro.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-sm">
                          <span className="font-bold text-blue-400">
                            #{siniestro.folio_siniestro}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {formatDate(siniestro.fecha_incidente)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-semibold text-white">
                            {siniestro.numero_vehiculo}
                          </div>
                          <div className="text-xs text-gray-400">
                            {siniestro.marca} {siniestro.modelo}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {siniestro.nombre_conductor || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {siniestro.clasificacion || siniestro.tipo_siniestro}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${gravedadInfo.color}`}>
                            {siniestro.gravedad}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <EstadoDropdown
                            siniestro={siniestro}
                            estados={opciones.estados}
                            onCambiarEstado={handleCambiarEstado}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <div className="font-semibold text-red-400">
                            {formatCurrency(siniestro.costo_final || siniestro.costo_estimado)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center justify-center gap-2">
                            
                            {/* --- 1. BOTÓN "VINCULAR A MANTENIMIENTO" --- */}
                            {/* Mostrar solo si AÚN NO está vinculado y NO está resuelto */}
                            {!siniestro.mantenimiento_id && siniestro.estado !== 'Resuelto' && (
                              <button
                                onClick={() => handleCrearMantenimiento(siniestro)}
                                className="p-1.5 text-purple-400 hover:bg-purple-500/20 rounded border border-purple-500/30 transition-all"
                                title="Crear orden de mantenimiento"
                              >
                                <Wrench className="w-4 h-4" />
                              </button>
                            )}
                            
                            {/* --- 2. BOTÓN "DISTRIBUIR GASTO" (Cierre Financiero) --- */}
                            {/* Mostrar solo si está "Resuelto" (mecánicamente) Y tiene un costo */}
                            {siniestro.estado === 'Resuelto' && (siniestro.costo_final > 0 || siniestro.costo_estimado > 0) && (
                              <button
                                onClick={() => handleDistribuirGasto(siniestro)}
                                className="p-1.5 text-green-400 hover:bg-green-500/20 rounded border border-green-500/30 transition-all"
                                title="Distribuir Costo Final"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                            )}
                            
                            {/* --- 3. BOTONES EXISTENTES --- */}
                            <button
                              onClick={() => navigate(`/admin/siniestros/${siniestro.id}`)}
                              className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-all"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/admin/siniestros/${siniestro.id}/editar`)}
                              className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-all"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEliminar(siniestro.id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-all"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen */}
        <div className="mt-6 bg-blue-500/10 backdrop-blur-sm border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-blue-300">
                Total de siniestros encontrados: <span className="text-white">{siniestros.length}</span>
              </span>
            </div>
            <button
              onClick={() => navigate('/admin/siniestros')}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Ver Dashboard →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SiniestrosLista;
