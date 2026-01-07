import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import conductorService from '../../services/conductorService'; // Importamos nuestro servicio
import { Camera, AlertTriangle, UploadCloud, X, Send, RefreshCw } from 'lucide-react';

// Componente para previsualizar las imágenes
const ImagePreview = ({ file, onRemove }) => {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }, [file]);

  return (
    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/10">
      <img src={preview} alt="preview" className="w-full h-full object-cover" />
      <button
        onClick={onRemove}
        className="absolute top-0 right-0 p-0.5 bg-red-500/80 rounded-full text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const DriverSiniestro = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fecha_incidente: new Date().toISOString().split('T')[0],
    hora_incidente: new Date().toTimeString().split(' ')[0].substring(0, 5),
    ubicacion: '',
    tipo_siniestro: 'Choque',
    descripcion: '',
  });
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (fotos.length + newFiles.length > 10) {
        setError('No puedes subir más de 10 fotos en total.');
        return;
      }
      setFotos(prev => [...prev, ...newFiles]);
      setError(null); // Limpiar error si se agregan fotos correctamente
    }
  };

  const removeFoto = (index) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (fotos.length === 0) {
      setError('Debes subir al menos una foto como evidencia.');
      return;
    }
    if (formData.descripcion.length < 10) {
      setError('Por favor, da una descripción más detallada del incidente.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // 1. Usamos FormData para enviar texto y archivos
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      data.append(key, formData[key]);
    });
    
    // 2. Adjuntamos las fotos
    fotos.forEach((foto) => {
      data.append('fotos', foto); // El backend debe esperar un array llamado 'fotos'
    });

    try {
      // 3. Llamamos al servicio (que crearemos en el Paso 3)
      // (Asumiremos que se llamará 'registrarSiniestro')
      const response = await conductorService.registrarSiniestro(data); 

      if (response.success) {
        setSuccess('¡Siniestro reportado exitosamente! Un administrador se pondrá en contacto contigo.');
        setFormData({
          fecha_incidente: new Date().toISOString().split('T')[0],
          hora_incidente: new Date().toTimeString().split(' ')[0].substring(0, 5),
          ubicacion: '',
          tipo_siniestro: 'Choque',
          descripcion: '',
        });
        setFotos([]);
        setTimeout(() => navigate('/conductor/dashboard'), 4000);
      } else {
        throw new Error(response.message || 'Error al reportar el siniestro.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6">Reportar un Siniestro</h1>
      
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-lg p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Alertas de Error o Éxito */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{success}</span>
            </div>
          )}

          {/* Fila 1: Fecha y Hora */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Fecha del Incidente</label>
              <input
                type="date"
                name="fecha_incidente"
                value={formData.fecha_incidente}
                onChange={handleChange}
                required
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Hora (Aprox.)</label>
              <input
                type="time"
                name="hora_incidente"
                value={formData.hora_incidente}
                onChange={handleChange}
                required
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
              />
            </div>
          </div>

          {/* Fila 2: Ubicación y Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ubicación</label>
              <input
                type="text"
                name="ubicacion"
                value={formData.ubicacion}
                onChange={handleChange}
                required
                placeholder="Ej: Av. Insurgentes esq. con... Cerca de..."
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Siniestro</label>
              <select
                name="tipo_siniestro"
                value={formData.tipo_siniestro}
                onChange={handleChange}
                required
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
              >
                <option>Choque</option>
                <option>Falla Mecánica</option>
                <option>Robo Parcial</option>
                <option>Robo Total</option>
                <option>Vandalismo</option>
                <option>Otro</option>
              </select>
            </div>
          </div>

          {/* Fila 3: Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Descripción del Incidente</label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows="4"
              required
              placeholder="Describe lo que pasó. ¿Qué daños ves? ¿Hay terceros involucrados?"
              className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
            />
          </div>

          {/* Fila 4: Carga de Fotos */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Fotos de Evidencia (Máx 10)</label>
            <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-white/20 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-400">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-slate-700 rounded-md font-medium text-cyan-400 hover:text-cyan-300 px-2"
                  >
                    <span>Sube tus archivos</span>
                    <input id="file-upload" name="fotos" type="file" className="sr-only" multiple onChange={handleFileChange} accept="image/*" />
                  </label>
                  <p className="pl-1">o arrástralos aquí</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 10MB cada uno</p>
              </div>
            </div>
            {/* Previsualización de fotos */}
            {fotos.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {fotos.map((file, index) => (
                  <ImagePreview key={index} file={file} onRemove={() => removeFoto(index)} />
                ))}
              </div>
            )}
          </div>

          {/* Fila 5: Botón de Enviar */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || success}
              className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span>{loading ? 'Enviando Reporte...' : 'Reportar Siniestro Ahora'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default DriverSiniestro;