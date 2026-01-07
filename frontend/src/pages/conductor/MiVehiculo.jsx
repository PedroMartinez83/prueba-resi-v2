// frontend/src/pages/conductor/MiVehiculo.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import conductorService from '../../services/conductorService';
import { 
  Car, 
  Calendar,
  Gauge,
  Wrench,
  Upload,
  Video,
  Camera,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const MiVehiculo = () => {
  const navigate = useNavigate();
  const [vehiculo, setVehiculo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mostrarFormRevision, setMostrarFormRevision] = useState(false);
  
  // Form de revisión diaria
  const [videoFile, setVideoFile] = useState(null);
  const [fotosFiles, setFotosFiles] = useState([]);
  const [comentarios, setComentarios] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    cargarVehiculo();
  }, []);

  const cargarVehiculo = async () => {
    try {
      setLoading(true);
      const data = await conductorService.getMiVehiculo();
      setVehiculo(data.vehiculo);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('El video no puede superar los 100MB');
        return;
      }
      // Validar duración aproximada (1 minuto)
      setVideoFile(file);
    }
  };

  const handleFotosChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 5) {
      toast.error('Máximo 5 fotos');
      return;
    }
    setFotosFiles(files);
  };

  const handleSubmitRevision = async (e) => {
    e.preventDefault();
    
    if (!videoFile) {
      toast.error('El video es obligatorio');
      return;
    }

    try {
      setSubiendo(true);
      
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('comentarios', comentarios);
      formData.append('kilometraje', kilometraje);
      
      fotosFiles.forEach((foto, index) => {
        formData.append('fotos', foto);
      });

      await conductorService.subirRevisionDiaria(formData);
      
      toast.success('¡Revisión diaria subida correctamente!');
      setMostrarFormRevision(false);
      setVideoFile(null);
      setFotosFiles([]);
      setComentarios('');
      setKilometraje('');
      cargarVehiculo(); // Recargar datos
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubiendo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!vehiculo) {
    return (
      <div className="text-center py-12">
        <Car className="w-20 h-20 text-gray-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Sin Vehículo Asignado</h2>
        <p className="text-gray-400">No tienes un vehículo asignado actualmente.</p>
        <button
          onClick={() => navigate('/conductor/dashboard')}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg"
        >
          Volver al Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/conductor/dashboard')}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Mi Vehículo</h1>
            <p className="text-gray-400">Información y revisión diaria</p>
          </div>
        </div>
        
        {!vehiculo.revisionHoyCompletada && !mostrarFormRevision && (
          <button
            onClick={() => setMostrarFormRevision(true)}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Upload className="w-5 h-5" />
            Subir Revisión Diaria
          </button>
        )}
      </div>

      {/* Alerta de Revisión */}
      {vehiculo.revisionHoyCompletada ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <p className="text-green-400 font-semibold">Revisión Diaria Completada</p>
            <p className="text-sm text-gray-300">Ya subiste tu video de revisión hoy. ¡Gracias!</p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-400" />
          <div>
            <p className="text-yellow-400 font-semibold">Revisión Diaria Pendiente</p>
            <p className="text-sm text-gray-300">Recuerda subir tu video de revisión del vehículo (1 minuto)</p>
          </div>
        </div>
      )}

      {/* Formulario de Revisión Diaria */}
      {mostrarFormRevision && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Subir Revisión Diaria</h2>
          
          <form onSubmit={handleSubmitRevision} className="space-y-6">
            
            {/* Video */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <Video className="w-5 h-5 text-cyan-400" />
                Video de Revisión (Obligatorio - Max 1 minuto)
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
                required
              />
              {videoFile && (
                <p className="text-sm text-green-400 mt-2">✓ {videoFile.name}</p>
              )}
            </div>

            {/* Fotos Opcionales */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <Camera className="w-5 h-5 text-cyan-400" />
                Fotos Adicionales (Opcional - Max 5)
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

            {/* Kilometraje */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-cyan-400" />
                Kilometraje Actual
              </label>
              <input
                type="number"
                value={kilometraje}
                onChange={(e) => setKilometraje(e.target.value)}
                placeholder="Ej: 45000"
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
              />
            </div>

            {/* Comentarios */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Comentarios / Observaciones
              </label>
              <textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                rows="3"
                placeholder="Ej: Todo en buen estado, llantas infladas..."
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
              ></textarea>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={subiendo}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {subiendo ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Subir Revisión
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMostrarFormRevision(false)}
                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Información del Vehículo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Datos Generales */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Car className="w-6 h-6 text-cyan-400" />
            Datos del Vehículo
          </h2>
          <div className="space-y-3">
            <InfoRow label="Marca y Modelo" value={`${vehiculo.marca} ${vehiculo.modelo}`} />
            <InfoRow label="Año" value={vehiculo.año} />
            <InfoRow label="Placa" value={vehiculo.placa} />
            <InfoRow label="Número Económico" value={vehiculo.numero_vehiculo} />
            <InfoRow label="Color" value={vehiculo.color} />
            <InfoRow label="Tipo" value={vehiculo.tipo_vehiculo} />
          </div>
        </div>

        {/* Kilometraje y Mantenimiento */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Gauge className="w-6 h-6 text-cyan-400" />
            Kilometraje y Mantenimiento
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Kilometraje Actual</p>
              <p className="text-3xl font-bold text-white">
                {vehiculo.kilometraje_actual?.toLocaleString('es-MX') || 0} km
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Próximo Mantenimiento</p>
              <p className="text-xl font-semibold text-cyan-400">
                {vehiculo.proximo_mantenimiento_km?.toLocaleString('es-MX') || 0} km
              </p>
            </div>
            
            {/* Progreso */}
            <div>
              <div className="w-full bg-white/10 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-3 rounded-full transition-all"
                  style={{ 
                    width: `${Math.min(
                      ((vehiculo.kilometraje_actual || 0) / (vehiculo.proximo_mantenimiento_km || 1)) * 100, 
                      100
                    )}%` 
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {Math.abs((vehiculo.proximo_mantenimiento_km || 0) - (vehiculo.kilometraje_actual || 0)).toLocaleString('es-MX')} km restantes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Próximo Mantenimiento Programado */}
      {vehiculo.proximoMantenimiento && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-orange-400" />
            Próximo Mantenimiento Programado
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoRow label="Tipo de Servicio" value={vehiculo.proximoMantenimiento.tipo_servicio} />
            <InfoRow label="Fecha Programada" value={new Date(vehiculo.proximoMantenimiento.fecha_programada).toLocaleDateString('es-MX')} />
            <InfoRow label="Estado" value={vehiculo.proximoMantenimiento.estado} />
          </div>
        </div>
      )}

      {/* Último Mantenimiento Realizado */}
      {vehiculo.ultimoMantenimiento && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-400" />
            Último Mantenimiento Realizado
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoRow label="Tipo de Servicio" value={vehiculo.ultimoMantenimiento.tipo_servicio} />
            <InfoRow label="Fecha" value={new Date(vehiculo.ultimoMantenimiento.fecha_servicio).toLocaleDateString('es-MX')} />
            <InfoRow label="Kilometraje" value={`${vehiculo.ultimoMantenimiento.kilometraje_servicio?.toLocaleString('es-MX') || 0} km`} />
          </div>
        </div>
      )}

    </div>
  );
};

// Componente auxiliar para mostrar información
const InfoRow = ({ label, value }) => (
  <div>
    <p className="text-gray-400 text-sm">{label}</p>
    <p className="text-white font-semibold">{value || 'N/A'}</p>
  </div>
);

export default MiVehiculo;