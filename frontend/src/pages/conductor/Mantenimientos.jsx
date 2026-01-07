// frontend/src/pages/conductor/Mantenimientos.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import conductorService from '../../services/conductorService';
import { 
  Wrench,
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  FileText,
  Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const Mantenimientos = () => {
  const navigate = useNavigate();
  const [mantenimientos, setMantenimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormSolicitud, setMostrarFormSolicitud] = useState(false);
  
  // Form de solicitud
  const [tipoServicio, setTipoServicio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [horaProgramada, setHoraProgramada] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [solicitando, setSolicitando] = useState(false);

  // Tipos de servicio disponibles
  const tiposServicio = [
    'Cambio de Aceite',
    'Revisión General',
    'Alineación y Balanceo',
    'Frenos',
    'Suspensión',
    'Sistema Eléctrico',
    'Aire Acondicionado',
    'Llantas',
    'Transmisión',
    'Otro'
  ];

  useEffect(() => {
    cargarMantenimientos();
  }, []);

  const cargarMantenimientos = async () => {
    try {
      setLoading(true);
      const data = await conductorService.getMisMantenimientos();
      setMantenimientos(data.mantenimientos || data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSolicitud = async (e) => {
    e.preventDefault();
    
    if (!tipoServicio || !descripcion) {
      toast.error('Tipo de servicio y descripción son obligatorios');
      return;
    }

    if (!fechaProgramada || !horaProgramada) {
      toast.error('Selecciona la fecha y hora para tu cita');
      return;
    }

    try {
      setSolicitando(true);

      await conductorService.solicitarMantenimiento({
        tipo_servicio: tipoServicio,
        descripcion: descripcion,
        fecha_programada: fechaProgramada,
        hora_programada: horaProgramada,
        urgente: urgente
      });

      toast.success('¡Solicitud de mantenimiento enviada correctamente!');
      setMostrarFormSolicitud(false);
      setTipoServicio('');
      setDescripcion('');
      setFechaProgramada('');
      setHoraProgramada('');
      setUrgente(false);
      cargarMantenimientos();
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSolicitando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/conductor/dashboard')}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Mantenimientos</h1>
            <p className="text-gray-400">Solicitar servicios y ver historial</p>
          </div>
        </div>
        
        <button
          onClick={() => setMostrarFormSolicitud(!mostrarFormSolicitud)}
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Solicitar Mantenimiento
        </button>
      </div>

      {/* Información Importante */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Wrench className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <p className="text-blue-400 font-semibold">Información Importante</p>
            <p className="text-sm text-gray-300 mt-1">
              • Los mantenimientos preventivos se programan automáticamente cada 10,000 km.<br/>
              • Si detectas algún problema, solicita un mantenimiento marcándolo como "urgente".<br/>
              • El taller te contactará para agendar una cita.
            </p>
          </div>
        </div>
      </div>

      {/* Formulario de Solicitud */}
      {mostrarFormSolicitud && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Solicitar Mantenimiento</h2>
          
          <form onSubmit={handleSubmitSolicitud} className="space-y-6">
            
            {/* Tipo de Servicio */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-400" />
                Tipo de Servicio
              </label>
              <select
                value={tipoServicio}
                onChange={(e) => setTipoServicio(e.target.value)}
                className="w-full p-3 bg-white border border-white/10 rounded-lg text-slate-900"
                required
              >
                <option value="">Selecciona un tipo de servicio</option>
                {tiposServicio.map((tipo) => (
                  <option key={tipo} value={tipo} className="bg-white text-slate-900">
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            {/* Descripción del Problema */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-400" />
                Descripción del Problema
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows="4"
                placeholder="Describe detalladamente el problema o servicio que necesitas. Ej: El auto hace un ruido extraño al frenar..."
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
                required
              ></textarea>
            </div>

            {/* Fecha y hora deseada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-400" />
                  Fecha deseada
                </label>
                <input
                  type="date"
                  value={fechaProgramada}
                  onChange={(e) => setFechaProgramada(e.target.value)}
                  className="w-full p-3 bg-white border border-white/10 rounded-lg text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-400" />
                  Hora deseada
                </label>
                <input
                  type="time"
                  value={horaProgramada}
                  onChange={(e) => setHoraProgramada(e.target.value)}
                  className="w-full p-3 bg-white border border-white/10 rounded-lg text-slate-900"
                  required
                />
              </div>
            </div>

            {/* Urgente */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="urgente"
                checked={urgente}
                onChange={(e) => setUrgente(e.target.checked)}
                className="w-5 h-5 rounded bg-white/5 border border-white/10"
              />
              <label htmlFor="urgente" className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-red-400" />
                Marcar como <strong className="text-red-400">URGENTE</strong>
                <span className="text-gray-400 text-sm">(Solo si el vehículo no puede circular de forma segura)</span>
              </label>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={solicitando}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {solicitando ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Enviar Solicitud
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMostrarFormSolicitud(false)}
                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Estadísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Pendientes</span>
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {mantenimientos.filter(m => m.estado === 'Pendiente').length}
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">En Proceso</span>
            <Wrench className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {mantenimientos.filter(m => m.estado === 'En Proceso').length}
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Completados</span>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {mantenimientos.filter(m => m.estado === 'Completado').length}
          </p>
        </div>
      </div>

      {/* Historial de Mantenimientos */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Historial de Mantenimientos</h2>
        
        {mantenimientos.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No hay mantenimientos registrados</p>
            <p className="text-gray-500 text-sm">Solicita tu primer mantenimiento usando el botón superior</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mantenimientos.map((mant) => (
              <MantenimientoCard key={mant.id} mantenimiento={mant} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

// Componente de Card de Mantenimiento
const MantenimientoCard = ({ mantenimiento }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-white font-semibold text-lg">
              {mantenimiento.tipo_servicio}
            </h3>
            <EstadoBadge estado={mantenimiento.estado} />
            {mantenimiento.urgente && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" />
                URGENTE
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {(mantenimiento.fecha_programada || mantenimiento.fecha_solicitud)
                ? new Date(mantenimiento.fecha_programada || mantenimiento.fecha_solicitud).toLocaleDateString('es-MX')
                : 'Sin fecha'}
            </span>
            {(mantenimiento.folio_mantenimiento || mantenimiento.folio_servicio) && (
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {mantenimiento.folio_mantenimiento || mantenimiento.folio_servicio}
              </span>
            )}
          </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  <div>
                    <p className="text-gray-400 text-sm font-semibold">Descripción:</p>
                    <p className="text-white text-sm">{mantenimiento.descripcion || mantenimiento.observaciones}</p>
                  </div>
              
              {mantenimiento.fecha_programada && (
                <div>
                  <p className="text-gray-400 text-sm font-semibold">Fecha Programada:</p>
                  <p className="text-white text-sm">
                    {new Date(mantenimiento.fecha_programada).toLocaleDateString('es-MX', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}

              {mantenimiento.notas_taller && (
                <div>
                  <p className="text-gray-400 text-sm font-semibold">Notas del Taller:</p>
                  <p className="text-white text-sm">{mantenimiento.notas_taller}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-4 text-cyan-400 hover:text-cyan-300 text-sm"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      </div>
    </div>
  );
};

// Componente de Badge de Estado
const EstadoBadge = ({ estado }) => {
  const config = {
    'Pendiente': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
    'Programado': { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Calendar },
    'En Proceso': { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: Wrench },
    'Completado': { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
    'Cancelado': { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertTriangle },
  };
  
  const ESTADO = config[estado] || config.Pendiente;
  const Icon = ESTADO.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${ESTADO.bg} ${ESTADO.text}`}>
      <Icon className="w-3 h-3" />
      {estado}
    </span>
  );
};

export default Mantenimientos;