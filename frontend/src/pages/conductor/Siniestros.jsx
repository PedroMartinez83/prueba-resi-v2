// frontend/src/pages/conductor/Siniestros.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import conductorService from '../../services/conductorService';
import { 
  AlertTriangle,
  Plus,
  Calendar,
  MapPin,
  Camera,
  Video,
  FileText,
  ArrowLeft,
  RefreshCw,
  Eye,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const Siniestros = () => {
  const navigate = useNavigate();
  const [siniestros, setSiniestros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormReporte, setMostrarFormReporte] = useState(false);
  
  // Form de reporte
  const [tipoSiniestro, setTipoSiniestro] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fechaIncidente, setFechaIncidente] = useState(new Date().toISOString().split('T')[0]);
  const [gravedad, setGravedad] = useState('Media');
  const [fotosFiles, setFotosFiles] = useState([]);
  const [videosFiles, setVideosFiles] = useState([]);
  const [reportando, setReportando] = useState(false);

  // Tipos de siniestro
  const tiposSiniestro = [
    'Colisión',
    'Rayón/Golpe',
    'Robo Parcial',
    'Vandalismo',
    'Falla Mecánica',
    'Ponchadura',
    'Daño por Terceros',
    'Otro'
  ];

  useEffect(() => {
    cargarSiniestros();
  }, []);

  const cargarSiniestros = async () => {
    try {
      setLoading(true);
      const data = await conductorService.getMisSiniestros();
      setSiniestros(data.siniestros || data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFotosChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 10) {
      toast.error('Máximo 10 fotos');
      return;
    }
    setFotosFiles(files);
  };

  const handleVideosChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 3) {
      toast.error('Máximo 3 videos');
      return;
    }
    setVideosFiles(files);
  };

  const handleSubmitReporte = async (e) => {
    e.preventDefault();
    
    if (!tipoSiniestro || !descripcion) {
      toast.error('Tipo de siniestro y descripción son obligatorios');
      return;
    }

    if (fotosFiles.length === 0 && videosFiles.length === 0) {
      toast.error('Debes subir al menos una foto o video del siniestro');
      return;
    }

    try {
      setReportando(true);
      
      const formData = new FormData();
      formData.append('tipo_siniestro', tipoSiniestro);
      formData.append('descripcion', descripcion);
      formData.append('ubicacion', ubicacion);
      formData.append('fecha_incidente', fechaIncidente);
      formData.append('gravedad', gravedad);
      
      fotosFiles.forEach((foto) => {
        formData.append('fotos', foto);
      });
      
      videosFiles.forEach((video) => {
        formData.append('videos', video);
      });

      await conductorService.registrarSiniestro(formData);
      
      toast.success('¡Siniestro reportado correctamente! El área correspondiente te contactará.');
      setMostrarFormReporte(false);
      resetForm();
      cargarSiniestros();
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setReportando(false);
    }
  };

  const resetForm = () => {
    setTipoSiniestro('');
    setDescripcion('');
    setUbicacion('');
    setFechaIncidente(new Date().toISOString().split('T')[0]);
    setGravedad('Media');
    setFotosFiles([]);
    setVideosFiles([]);
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
            <h1 className="text-3xl font-bold text-white">Siniestros</h1>
            <p className="text-gray-400">Reportar incidentes y ver historial</p>
          </div>
        </div>
        
        <button
          onClick={() => setMostrarFormReporte(!mostrarFormReporte)}
          className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Reportar Siniestro
        </button>
      </div>

      {/* Alerta Informativa */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
          <div>
            <p className="text-red-400 font-semibold">¿Cuándo reportar un siniestro?</p>
            <p className="text-sm text-gray-300 mt-1">
              • Cualquier daño al vehículo (rayones, golpes, colisiones)<br/>
              • Robo o intento de robo<br/>
              • Vandalismo<br/>
              • Fallas mecánicas graves<br/>
              <strong className="text-red-400">Es muy importante que reportes INMEDIATAMENTE cualquier incidente.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Formulario de Reporte */}
      {mostrarFormReporte && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Reportar Siniestro</h2>
          
          <form onSubmit={handleSubmitReporte} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo de Siniestro */}
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Tipo de Siniestro
                </label>
                <select
                  value={tipoSiniestro}
                  onChange={(e) => setTipoSiniestro(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
                  required
                >
                  <option value="">Selecciona un tipo</option>
                  {tiposSiniestro.map((tipo) => (
                    <option key={tipo} value={tipo} className="bg-slate-800">
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gravedad */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Gravedad
                </label>
                <select
                  value={gravedad}
                  onChange={(e) => setGravedad(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                  <option value="Leve" className="bg-slate-800">Leve</option>
                  <option value="Media" className="bg-slate-800">Media</option>
                  <option value="Grave" className="bg-slate-800">Grave</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fecha del Incidente */}
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-red-400" />
                  Fecha del Incidente
                </label>
                <input
                  type="date"
                  value={fechaIncidente}
                  onChange={(e) => setFechaIncidente(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
                  required
                />
              </div>

              {/* Ubicación */}
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-red-400" />
                  Ubicación
                </label>
                <input
                  type="text"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej: Av. Insurgentes 123, CDMX"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
                />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-400" />
                Descripción Detallada del Incidente
              </label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows="4"
                placeholder="Describe con el mayor detalle posible lo que sucedió. Incluye: hora aproximada, cómo ocurrió, si hubo terceros involucrados, etc."
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
                required
              ></textarea>
            </div>

            {/* Fotos */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <Camera className="w-5 h-5 text-red-400" />
                Fotos del Incidente (Máximo 10)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFotosChange}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
              />
              {fotosFiles.length > 0 && (
                <p className="text-sm text-green-400 mt-2">✓ {fotosFiles.length} foto(s) seleccionada(s)</p>
              )}
            </div>

            {/* Videos */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <Video className="w-5 h-5 text-red-400" />
                Videos del Incidente (Opcional - Máximo 3)
              </label>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={handleVideosChange}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
              />
              {videosFiles.length > 0 && (
                <p className="text-sm text-green-400 mt-2">✓ {videosFiles.length} video(s) seleccionado(s)</p>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={reportando}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reportando ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Reportando...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Enviar Reporte
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMostrarFormReporte(false)}
                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total</span>
            <FileText className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-white">{siniestros.length}</p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Reportados</span>
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {siniestros.filter(s => s.estado === 'Reportado').length}
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">En Revisión</span>
            <Eye className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {siniestros.filter(s => s.estado === 'En revisión' || s.estado === 'En proceso').length}
          </p>
        </div>
        
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Resueltos</span>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {siniestros.filter(s => s.estado === 'Resuelto' || s.estado === 'Cerrado').length}
          </p>
        </div>
      </div>

      {/* Historial de Siniestros */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Historial de Siniestros</h2>
        
        {siniestros.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No hay siniestros reportados</p>
            <p className="text-gray-500 text-sm">Esperamos que no tengas que usar esta sección 🙏</p>
          </div>
        ) : (
          <div className="space-y-4">
            {siniestros.map((siniestro) => (
              <SiniestroCard key={siniestro.id} siniestro={siniestro} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

// Componente de Card de Siniestro
const SiniestroCard = ({ siniestro }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-white font-semibold text-lg">
              {siniestro.tipo_siniestro}
            </h3>
            <EstadoBadge estado={siniestro.estado} />
            {siniestro.folio_siniestro && (
              <span className="text-gray-400 text-sm">
                {siniestro.folio_siniestro}
              </span>
            )}
            <GravedadBadge gravedad={siniestro.gravedad} />
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(siniestro.fecha_incidente).toLocaleDateString('es-MX')}
            </span>
            {siniestro.ubicacion && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {siniestro.ubicacion}
              </span>
            )}
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
              <div>
                <p className="text-gray-400 text-sm font-semibold">Descripción:</p>
                <p className="text-white text-sm">{siniestro.descripcion}</p>
              </div>
              
              {siniestro.fotos_urls && siniestro.fotos_urls.length > 0 && (
                <div>
                  <p className="text-gray-400 text-sm font-semibold mb-2">
                    Fotos ({siniestro.fotos_urls.length}):
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {siniestro.fotos_urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square bg-white/5 rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                      >
                        <img 
                          src={url} 
                          alt={`Foto ${idx + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-4 text-cyan-400 hover:text-cyan-300 text-sm whitespace-nowrap"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      </div>
    </div>
  );
};

// Badge de Estado
const EstadoBadge = ({ estado }) => {
  const config = {
    'Reportado': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
    'En revisión': { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Eye },
    'En proceso': { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: RefreshCw },
    'Resuelto': { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
    'Rechazado': { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
  };
  
  const ESTADO = config[estado] || config.Reportado;
  const Icon = ESTADO.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${ESTADO.bg} ${ESTADO.text}`}>
      <Icon className="w-3 h-3" />
      {estado}
    </span>
  );
};

// Badge de Gravedad
const GravedadBadge = ({ gravedad }) => {
  const config = {
    'Leve': { bg: 'bg-green-500/20', text: 'text-green-400' },
    'Media': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    'Grave': { bg: 'bg-red-500/20', text: 'text-red-400' },
  };
  
  const GRAVEDAD = config[gravedad] || config.Media;
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${GRAVEDAD.bg} ${GRAVEDAD.text}`}>
      {gravedad}
    </span>
  );
};

export default Siniestros;