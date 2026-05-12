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
import {
  formatMaintenanceDate,
  formatMaintenanceDateTime
} from '@/utils/maintenanceDateFormat';

const MiVehiculo = () => {
  const navigate = useNavigate();
  const [vehiculo, setVehiculo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mostrarFormRevision, setMostrarFormRevision] = useState(false);
  
  // Form de revisión diaria
  const [videoFile, setVideoFile] = useState(null);
  const [fotosFiles, setFotosFiles] = useState([]);
  const [comentarios, setComentarios] = useState('');
  const [kilometrajeManual, setKilometrajeManual] = useState('');
  const [guardandoKilometraje, setGuardandoKilometraje] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    cargarVehiculo();
  }, []);

  const formatearFechaSistema = (fecha) => {
    return formatMaintenanceDateTime(fecha, { fallback: 'Sin fecha' });
  };

  const formatearSoloFecha = (fecha) => {
    return formatMaintenanceDate(fecha, { fallback: 'Sin fecha' });
  };

  const cargarVehiculo = async () => {
    try {
      setLoading(true);
      const data = await conductorService.getMiVehiculo();
      setVehiculo(data.vehiculo);
      setKilometrajeManual(String(data?.vehiculo?.kilometraje_actual ?? ''));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActualizarKilometraje = async () => {
    const km = Number(kilometrajeManual);

    if (!Number.isFinite(km) || km < 0) {
      toast.error('Ingresa un kilometraje valido (>= 0)');
      return;
    }

    try {
      setGuardandoKilometraje(true);
      const response = await conductorService.actualizarKilometrajeVehiculo(km);
      const kmActualizado = response?.vehiculo?.kilometraje_actual ?? km;
      const siguienteServicioKm = response?.mantenimiento_preventivo?.siguiente_servicio_km;
      const nuevoRegistro = response?.registro_kilometraje;

      setVehiculo((prev) => ({
        ...prev,
        kilometraje_actual: kmActualizado,
        proximo_mantenimiento: siguienteServicioKm ?? prev?.proximo_mantenimiento,
        proximo_mantenimiento_km: siguienteServicioKm ?? prev?.proximo_mantenimiento_km,
        bloqueo_registro_kilometraje:
          response?.bloqueo_registro_kilometraje ?? prev?.bloqueo_registro_kilometraje,
        historial_kilometraje: nuevoRegistro
          ? [nuevoRegistro, ...(prev?.historial_kilometraje || [])]
          : (prev?.historial_kilometraje || [])
      }));
      setKilometrajeManual(String(kmActualizado));

      toast.success(response?.message || 'Kilometraje actualizado');
    } catch (error) {
      const bloqueo = error?.details?.bloqueo_registro_kilometraje;
      if (bloqueo?.bloqueado) {
        setVehiculo((prev) => ({
          ...prev,
          bloqueo_registro_kilometraje: bloqueo
        }));
      }
      toast.error(error.message || 'No se pudo actualizar el kilometraje');
    } finally {
      setGuardandoKilometraje(false);
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
      
      fotosFiles.forEach((foto, index) => {
        formData.append('fotos', foto);
      });

      const revisionResponse = await conductorService.subirRevisionDiaria(formData);
      
      toast.success('¡Revisión diaria subida correctamente!');
      if (revisionResponse?.aviso_kilometraje) {
        toast.error(revisionResponse.aviso_kilometraje);
      }
      setMostrarFormRevision(false);
      setVideoFile(null);
      setFotosFiles([]);
      setComentarios('');
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

  const proximoMantenimientoKm = vehiculo.proximo_mantenimiento_km ?? vehiculo.proximo_mantenimiento ?? 0;
  const alertaPreventivo = vehiculo.alertas_preventivo || vehiculo.mantenimiento_preventivo?.alertas || null;
  const recordatorioRegistroKm = vehiculo.recordatorio_registro_km || null;
  const bloqueoRegistroKm = vehiculo.bloqueo_registro_kilometraje || null;
  const registroKmBloqueado = Boolean(bloqueoRegistroKm?.bloqueado);
  const KM_CICLO_MANTENIMIENTO = 10000;
  const kmActual = Number(vehiculo.kilometraje_actual) || 0;
  const kmObjetivoPorBloqueo = Number(bloqueoRegistroKm?.hito_objetivo_km) || 0;
  const kmObjetivoServicio =
    Number(proximoMantenimientoKm) ||
    kmObjetivoPorBloqueo ||
    Math.ceil(Math.max(kmActual, 1) / KM_CICLO_MANTENIMIENTO) * KM_CICLO_MANTENIMIENTO;

  let kmEnCiclo = kmActual % KM_CICLO_MANTENIMIENTO;
  if (kmActual > 0 && kmEnCiclo === 0) {
    kmEnCiclo = KM_CICLO_MANTENIMIENTO;
  }

  const servicioExcedido = kmObjetivoServicio > 0 && kmActual > kmObjetivoServicio;
  const progresoCicloPorcentaje = Math.min((kmEnCiclo / KM_CICLO_MANTENIMIENTO) * 100, 100);
  const porcentajeBarra = servicioExcedido ? 100 : progresoCicloPorcentaje;
  const kmRestantes = Math.max(kmObjetivoServicio - kmActual, 0);
  const kmExcedidos = Math.max(kmActual - kmObjetivoServicio, 0);
  const textoProgreso = servicioExcedido
    ? `${kmExcedidos.toLocaleString('es-MX')} km excedidos`
    : kmRestantes === 0
      ? 'Meta alcanzada, agenda servicio'
      : `${kmRestantes.toLocaleString('es-MX')} km restantes`;

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

      {registroKmBloqueado && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <p className="text-red-300 font-semibold">Registro de kilometraje bloqueado</p>
              <p className="text-sm text-gray-200">
                {bloqueoRegistroKm?.mensaje || 'Debes solicitar mantenimiento para continuar registrando kilometraje.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate('/conductor/mantenimientos', {
                state: {
                  openSolicitud: true,
                  tipoSolicitud: 'preventivo_programado'
                }
              })
            }
            className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-200 font-semibold whitespace-nowrap"
          >
            Solicitar mantenimiento
          </button>
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
                {kmActual.toLocaleString('es-MX')} km
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Próximo Mantenimiento</p>
              <p className="text-xl font-semibold text-cyan-400">
                {proximoMantenimientoKm?.toLocaleString('es-MX') || 0} km
              </p>
            </div>

            {alertaPreventivo?.mensaje && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  alertaPreventivo.vencido
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : alertaPreventivo.alerta_capacidad_taller
                      ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200'
                      : alertaPreventivo.alerta_preventiva
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                        : 'border-white/10 bg-white/5 text-gray-300'
                }`}
              >
                {alertaPreventivo.mensaje}
              </div>
            )}

            {recordatorioRegistroKm?.mostrar && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {recordatorioRegistroKm.mensaje}
              </div>
            )}

            <div className="pt-3 border-t border-white/10">
              <p className="text-gray-300 text-sm font-medium mb-2">Registrar kilometraje</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="number"
                  min="0"
                  value={kilometrajeManual}
                  onChange={(e) => setKilometrajeManual(e.target.value)}
                  placeholder="Ej: 128500"
                  disabled={registroKmBloqueado}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleActualizarKilometraje}
                  disabled={guardandoKilometraje || registroKmBloqueado}
                  className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-200 font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {guardandoKilometraje ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar km'
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {registroKmBloqueado
                  ? 'Debes solicitar mantenimiento para volver a registrar kilometraje.'
                  : 'Actualiza el kilometraje cuando termines turno o recorrido.'}
              </p>
            </div>
            
            {/* Progreso */}
            <div>
              <div className="w-full bg-white/10 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${
                    servicioExcedido
                      ? 'bg-gradient-to-r from-red-500 to-rose-600'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  }`}
                  style={{ 
                    width: `${porcentajeBarra}%` 
                  }}
                ></div>
              </div>
              <p className={`text-xs mt-1 ${servicioExcedido ? 'text-red-300' : 'text-gray-400'}`}>
                {textoProgreso}
              </p>
            </div>

            <div className="pt-3 border-t border-white/10">
              <p className="text-gray-300 text-sm font-medium mb-2">Historial de kilometraje</p>

              {Array.isArray(vehiculo.historial_kilometraje) && vehiculo.historial_kilometraje.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {vehiculo.historial_kilometraje.map((registro) => (
                    <div
                      key={registro.id}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <span className="text-xs text-gray-300">
                        {formatearFechaSistema(registro.fecha_registro)}
                      </span>
                      <span className="text-sm font-semibold text-cyan-300">
                        {Number(registro.kilometraje_actual || 0).toLocaleString('es-MX')} km
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Aún no hay registros de kilometraje.</p>
              )}
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
            <InfoRow label="Fecha Programada" value={formatearSoloFecha(vehiculo.proximoMantenimiento.fecha_programada)} />
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
            <InfoRow
              label="Fecha"
              value={formatearSoloFecha(
                vehiculo.ultimoMantenimiento.fecha_realizada
                || vehiculo.ultimoMantenimiento.fecha_servicio
                || vehiculo.ultimoMantenimiento.fecha_programada
              )}
            />
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
