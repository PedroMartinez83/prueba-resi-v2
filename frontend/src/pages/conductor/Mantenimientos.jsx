import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import conductorService from '../../services/conductorService';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  RefreshCw,
  Wrench,
  Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  formatMaintenanceDate,
  formatMaintenanceDateTime
} from '@/utils/maintenanceDateFormat';

const normalizeEstado = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, '');

const isEstado = (estado, target) => normalizeEstado(estado) === normalizeEstado(target);

const isEstadoFinal = (estado) => {
  const key = normalizeEstado(estado);
  return ['completado', 'cancelado', 'cancelada'].includes(key);
};

const normalizeServicio = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatDate = (value) => {
  return formatMaintenanceDate(value, { fallback: 'Sin fecha' });
};

const formatDateLong = (value) => {
  return formatMaintenanceDateTime(value, {
    fallback: 'Sin fecha',
    month: 'long',
    withWeekday: true
  });
};

const formatDateTime = (value) => {
  return formatMaintenanceDateTime(value, { fallback: 'Sin fecha' });
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(Number(value || 0));

const getCobertura = (mantenimiento) => {
  const items = [
    { key: 'pagado_poliza', label: 'Poliza', value: Number(mantenimiento.pagado_poliza || 0) },
    { key: 'pagado_empresa', label: 'Empresa', value: Number(mantenimiento.pagado_empresa || 0) },
    { key: 'pagado_fondo_mantenimiento', label: 'Fondo de ahorro', value: Number(mantenimiento.pagado_fondo_mantenimiento || 0) },
    { key: 'pagado_conductor', label: 'Conductor', value: Number(mantenimiento.pagado_conductor || 0) }
  ];

  return items.filter((item) => item.value > 0);
};

const HALF_HOUR_SLOTS = (() => {
  const slots = [];
  for (let h = 8; h <= 15; h += 1) {
    const hh = String(h).padStart(2, '0');
    slots.push(`${hh}:00`);
    slots.push(`${hh}:30`);
  }
  return slots.filter((slot) => slot !== '15:30');
})();

const DEFAULT_TIPOS_SOLICITUD = [
  { value: 'preventivo_programado', label: 'Preventivo por kilometraje' },
  { value: 'fuera_programacion', label: 'Fuera de programacion (falla/negligencia)' }
];

const DEFAULT_CAUSAS_FUERA_PROGRAMACION = [
  { value: 'falla_mecanica', label: 'Falla mecanica' },
  { value: 'negligencia_conductor', label: 'Negligencia del conductor' },
  { value: 'siniestro', label: 'Siniestro' },
  { value: 'otro', label: 'Otro' }
];

const getLabelFromOptions = (value, options = [], fallback = '-') =>
  options.find((item) => item.value === value)?.label || fallback;

const PREVENTIVO_DESC_PREFIX = 'Servicio preventivo sugerido por kilometraje';
const isAutoPreventivoDescripcion = (value) =>
  String(value || '').trim().toLowerCase().startsWith(PREVENTIVO_DESC_PREFIX.toLowerCase());
const getServicioPreventivoTitulo = (sugerencia = {}) => {
  const codigo = String(sugerencia?.servicio_codigo || '').trim();
  const nivel = String(sugerencia?.servicio_nivel || '').trim();
  if (!codigo && !nivel) return null;
  if (codigo && nivel) return `Servicio ${codigo} (${nivel})`;
  if (codigo) return `Servicio ${codigo}`;
  return nivel;
};

const Mantenimientos = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const today = new Date().toISOString().split('T')[0];
  const [mantenimientos, setMantenimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormSolicitud, setMostrarFormSolicitud] = useState(false);
  const [contextoSolicitud, setContextoSolicitud] = useState(null);
  const [tiposSolicitudOpciones, setTiposSolicitudOpciones] = useState(DEFAULT_TIPOS_SOLICITUD);
  const [causasFueraProgramacionOpciones, setCausasFueraProgramacionOpciones] = useState(DEFAULT_CAUSAS_FUERA_PROGRAMACION);

  const [tipoServicio, setTipoServicio] = useState('');
  const [tipoSolicitud, setTipoSolicitud] = useState('preventivo_programado');
  const [causaFueraProgramacion, setCausaFueraProgramacion] = useState('');
  const [servicioEspecial, setServicioEspecial] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [horaProgramada, setHoraProgramada] = useState('');
  const [slotsAgenda, setSlotsAgenda] = useState([]);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [urgente, setUrgente] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false);
  const [confirmacionModal, setConfirmacionModal] = useState({ open: false, mantenimiento: null });
  const [formConfirmacion, setFormConfirmacion] = useState({
    visto_bueno_entrega: false,
    satisfecho: true,
    calificacion: 5,
    comentarios: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    const state = location.state || {};
    const tipoSolicitudInicial = String(state?.tipoSolicitud || '').trim();
    const shouldOpenForm = Boolean(state?.openSolicitud);

    if (!shouldOpenForm) return;

    const tiposPermitidos = new Set([
      'preventivo_programado',
      'fuera_programacion'
    ]);

    const tipoFinal = tiposPermitidos.has(tipoSolicitudInicial)
      ? tipoSolicitudInicial
      : 'preventivo_programado';

    setMostrarFormSolicitud(true);
    setTipoSolicitud(tipoFinal);
    if (tipoFinal !== 'fuera_programacion') {
      setCausaFueraProgramacion('');
    } else {
      setCausaFueraProgramacion('otro');
    }
  }, [location.state]);

  useEffect(() => {
    let isMounted = true;

    const cargarDisponibilidad = async () => {
      if (!mostrarFormSolicitud || !fechaProgramada) {
        if (isMounted) setSlotsAgenda([]);
        return;
      }

      try {
        if (isMounted) setCargandoDisponibilidad(true);
        const response = await conductorService.getDisponibilidadSolicitudMantenimiento(fechaProgramada);
        const slots = Array.isArray(response?.slots) ? response.slots : [];
        if (!isMounted) return;
        setSlotsAgenda(slots);

        if (horaProgramada) {
          const slotSeleccionado = slots.find((slot) => slot.hora === horaProgramada);
          if (slotSeleccionado && !slotSeleccionado.disponible) {
            setHoraProgramada('');
            toast.error('La hora seleccionada ya no esta disponible. Elige otro horario.');
          }
        }
      } catch (error) {
        if (!isMounted) return;
        setSlotsAgenda([]);
        toast.error(error.message || 'No se pudo cargar la disponibilidad de agenda');
      } finally {
        if (isMounted) setCargandoDisponibilidad(false);
      }
    };

    cargarDisponibilidad();

    return () => {
      isMounted = false;
    };
  }, [mostrarFormSolicitud, fechaProgramada]);

  const getTipoServicioAutomatico = (opciones) =>
    opciones?.sugerencia?.tipo_servicio || opciones?.tipos_servicio?.[0] || 'Revision general';

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [mantenimientosRes, opcionesRes] = await Promise.allSettled([
        conductorService.getMisMantenimientos(),
        conductorService.getOpcionesSolicitudMantenimiento()
      ]);

      if (mantenimientosRes.status === 'rejected') throw mantenimientosRes.reason;
      if (opcionesRes.status === 'rejected') throw opcionesRes.reason;

      const dataMantenimientos = mantenimientosRes.value || {};
      const dataOpciones = opcionesRes.value || {};

      const opciones = dataOpciones.opciones || null;
      const rows = dataMantenimientos.mantenimientos || [];
      setMantenimientos(rows);
      setContextoSolicitud(opciones);
      setTiposSolicitudOpciones(opciones?.tipos_solicitud || DEFAULT_TIPOS_SOLICITUD);
      setCausasFueraProgramacionOpciones(
        opciones?.causas_fuera_programacion || DEFAULT_CAUSAS_FUERA_PROGRAMACION
      );
      setTipoServicio(getTipoServicioAutomatico(opciones));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const aplicarSugerenciaPreventiva = () => {
    const tipoServicioAutomatico = getTipoServicioAutomatico(contextoSolicitud);
    if (!tipoServicioAutomatico) return;

    setTipoServicio(tipoServicioAutomatico);

    if (!descripcion?.trim()) {
      const kmActual = Number(contextoSolicitud?.vehiculo?.kilometraje_actual || 0).toLocaleString('es-MX');
      setDescripcion(`Servicio preventivo sugerido por kilometraje (${kmActual} km): ${tipoServicioAutomatico}.`);
    }
  };

  const toggleFormSolicitud = () => {
    const abrir = !mostrarFormSolicitud;
    setMostrarFormSolicitud(abrir);
    if (abrir && tipoSolicitud !== 'fuera_programacion') aplicarSugerenciaPreventiva();
  };

  useEffect(() => {
    if (!mostrarFormSolicitud) return;

    if (tipoSolicitud === 'fuera_programacion') {
      setTipoServicio((prev) => {
        const sugerido = getTipoServicioAutomatico(contextoSolicitud);
        return prev === sugerido ? '' : prev;
      });
      setDescripcion((prev) => (isAutoPreventivoDescripcion(prev) ? '' : prev));
      return;
    }

    if (!String(tipoServicio || '').trim()) {
      setTipoServicio(getTipoServicioAutomatico(contextoSolicitud));
    }
    if (!String(descripcion || '').trim()) {
      aplicarSugerenciaPreventiva();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoSolicitud, mostrarFormSolicitud, contextoSolicitud]);

  const alertaPreventivo = contextoSolicitud?.alertas_preventivo || null;
  const recordatorioRegistroKm = contextoSolicitud?.recordatorio_registro_km || null;

  const mantenimientosCompletados = useMemo(
    () =>
      mantenimientos
        .filter((m) => isEstado(m.estado, 'completado'))
        .sort((a, b) => new Date(b.fecha_realizada || b.updated_at || 0) - new Date(a.fecha_realizada || a.updated_at || 0)),
    [mantenimientos]
  );

  const mantenimientosActivos = useMemo(
    () => mantenimientos.filter((m) => !isEstadoFinal(m.estado)),
    [mantenimientos]
  );

  const stats = useMemo(() => {
    const pendientes = mantenimientos.filter((m) => {
      const estado = normalizeEstado(m.estado);
      return ['pendiente', 'programado', 'urgente', 'proximo', 'solicitado'].includes(estado);
    }).length;

    const enProceso = mantenimientos.filter((m) => isEstado(m.estado, 'en proceso') || isEstado(m.estado, 'enproceso')).length;
    const completados = mantenimientosCompletados.length;
    return { pendientes, enProceso, completados };
  }, [mantenimientos, mantenimientosCompletados.length]);

  const abrirConfirmacionEntrega = (mantenimiento) => {
    setFormConfirmacion({
      visto_bueno_entrega: true,
      satisfecho: true,
      calificacion: 5,
      comentarios: ''
    });
    setConfirmacionModal({ open: true, mantenimiento });
  };

  const cerrarConfirmacionEntrega = () => {
    if (confirmandoEntrega) return;
    setConfirmacionModal({ open: false, mantenimiento: null });
  };

  const submitConfirmacionEntrega = async (e) => {
    e.preventDefault();

    const mantenimientoId = confirmacionModal?.mantenimiento?.id;
    if (!mantenimientoId) {
      toast.error('No se encontró el mantenimiento a confirmar');
      return;
    }

    if (!formConfirmacion.visto_bueno_entrega) {
      toast.error('Debes confirmar el visto bueno de entrega');
      return;
    }

    try {
      setConfirmandoEntrega(true);
      await conductorService.confirmarEntregaMantenimiento(mantenimientoId, formConfirmacion);
      toast.success('Confirmación registrada');
      setConfirmacionModal({ open: false, mantenimiento: null });
      await cargarDatos();
    } catch (error) {
      toast.error(error.message || 'No se pudo registrar la confirmación');
    } finally {
      setConfirmandoEntrega(false);
    }
  };

  const handleSubmitSolicitud = async (e) => {
    e.preventDefault();

    if (!tipoServicio) {
      toast.error('Tipo de servicio es obligatorio');
      return;
    }

    if (!fechaProgramada || !horaProgramada) {
      toast.error('Selecciona la fecha y hora para tu cita');
      return;
    }

    const tipoServicioNorm = normalizeServicio(tipoServicio);
    const duplicadoLocal = mantenimientosActivos.find((mant) => {
      const servicioExistente = normalizeServicio(mant?.tipo_servicio);
      return servicioExistente && tipoServicioNorm && servicioExistente === tipoServicioNorm;
    });

    if (duplicadoLocal) {
      const folio = String(duplicadoLocal?.folio_servicio || duplicadoLocal?.id || '');
      toast.error(
        `Ya tienes una solicitud activa de este servicio${folio ? ` (folio #${folio.padStart(4, '0')})` : ''}.`
      );
      return;
    }

    if (slotsAgenda.length > 0) {
      const slotSeleccionado = slotsAgenda.find((slot) => slot.hora === horaProgramada);
      if (!slotSeleccionado) {
        toast.error('Selecciona una hora valida de los bloques disponibles');
        return;
      }
      if (!slotSeleccionado.disponible) {
        toast.error('Ese bloque de 30 minutos ya esta ocupado. Elige otro horario.');
        return;
      }
    }

    try {
      setSolicitando(true);
      const descripcionManual = String(descripcion || '').trim();
      const kmActual = Number(contextoSolicitud?.vehiculo?.kilometraje_actual || 0).toLocaleString('es-MX');
      const descripcionPreventiva = `Servicio preventivo sugerido por kilometraje (${kmActual} km): ${String(tipoServicio || '').trim()}.`;
      const descripcionBase = descripcionManual || (
        tipoSolicitud === 'fuera_programacion'
          ? String(tipoServicio || '').trim()
          : descripcionPreventiva
      );
      const servicioEspecialLimpio = String(servicioEspecial || '').trim();
      const descripcionConEspecial = servicioEspecialLimpio
        ? `${descripcionBase}\n\nServicio especial solicitado: ${servicioEspecialLimpio}`
        : descripcionBase;

      await conductorService.solicitarMantenimiento({
        tipo_servicio: tipoServicio,
        descripcion: descripcionConEspecial,
        servicio_especial: tipoSolicitud === 'fuera_programacion' ? '' : servicioEspecial,
        tipo_solicitud: tipoSolicitud,
        causa_fuera_programacion: tipoSolicitud === 'fuera_programacion' ? (causaFueraProgramacion || 'otro') : null,
        detalle_fuera_programacion: tipoSolicitud === 'fuera_programacion' ? tipoServicio : null,
        kilometraje_actual: contextoSolicitud?.vehiculo?.kilometraje_actual,
        fecha_programada: fechaProgramada,
        hora_programada: horaProgramada,
        urgente
      });

      toast.success('Solicitud de mantenimiento enviada correctamente');
      setMostrarFormSolicitud(false);
      setTipoServicio('');
      setTipoSolicitud('preventivo_programado');
      setCausaFueraProgramacion('');
      setServicioEspecial('');
      setDescripcion('');
      setFechaProgramada('');
      setHoraProgramada('');
      setUrgente(false);
      cargarDatos();
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
    <div className="space-y-6 bg-[#07425E] p-6 rounded-2xl">
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
          onClick={toggleFormSolicitud}
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Solicitar Mantenimiento
        </button>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Wrench className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <p className="text-blue-400 font-semibold">Informacion Importante</p>
            <p className="text-sm text-gray-300 mt-1">
              • Los mantenimientos preventivos se programan automaticamente por kilometraje.
              <br />
              • Si detectas un riesgo en circulacion, marca la solicitud como urgente.
              <br />
              • Tu historial muestra fecha programada y fecha realizada para cada servicio.
            </p>
          </div>
        </div>
      </div>

      {mostrarFormSolicitud && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Solicitar Mantenimiento</h2>

          <form onSubmit={handleSubmitSolicitud} className="space-y-6">
            {contextoSolicitud?.vehiculo && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-gray-300 text-sm font-semibold mb-2">Contexto del vehiculo</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <p className="text-gray-300">
                    Unidad: <span className="text-white font-semibold">{contextoSolicitud.vehiculo.numero_vehiculo}</span>
                  </p>
                  <p className="text-gray-300">
                    KM actual:{' '}
                    <span className="text-white font-semibold">
                      {Number(contextoSolicitud.vehiculo.kilometraje_actual || 0).toLocaleString('es-MX')} km
                    </span>
                  </p>
                </div>
                {tipoSolicitud !== 'fuera_programacion' && contextoSolicitud?.sugerencia?.tipo_servicio && (
                  <div className="mt-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    <p className="text-cyan-300 text-sm">
                      Sugerido por kilometraje:{' '}
                      <strong>
                        {getServicioPreventivoTitulo(contextoSolicitud.sugerencia)
                          ? `${getServicioPreventivoTitulo(contextoSolicitud.sugerencia)} - `
                          : ''}
                        {contextoSolicitud.sugerencia.tipo_servicio}
                      </strong>
                    </p>
                  </div>
                )}
                {alertaPreventivo?.mensaje && (
                  <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-yellow-200 text-sm">{alertaPreventivo.mensaje}</p>
                  </div>
                )}
                {recordatorioRegistroKm?.mostrar && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <p className="text-emerald-200 text-sm">{recordatorioRegistroKm.mensaje}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-white font-semibold mb-2">Tipo de servicio</label>
              <select
                value={tipoSolicitud}
                onChange={(e) => {
                  const value = e.target.value;
                  setTipoSolicitud(value);
                  if (value !== 'fuera_programacion') {
                    setCausaFueraProgramacion('');
                  } else {
                    setCausaFueraProgramacion('otro');
                    setTipoServicio('');
                    setServicioEspecial('');
                  }
                }}
                className="w-full p-3 bg-white border border-white/10 rounded-lg text-slate-900"
              >
                {tiposSolicitudOpciones.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-400" />
                {tipoSolicitud === 'fuera_programacion' ? 'Falla reportada del vehiculo' : 'Tipo de Servicio'}
              </label>
              {tipoSolicitud === 'fuera_programacion' ? (
                <textarea
                  value={tipoServicio}
                  onChange={(e) => setTipoServicio(e.target.value)}
                  rows="2"
                  placeholder="Describe la falla detectada del vehiculo. Ej: ruido en suspension, falla de frenos, no entra reversa, etc."
                  className="w-full p-3 bg-white border border-white/20 rounded-lg text-slate-900"
                  required
                />
              ) : (
                <textarea
                  value={tipoServicio}
                  readOnly
                  rows="4"
                  className="w-full p-3 bg-white/80 border border-white/20 rounded-lg text-slate-900 cursor-not-allowed resize-none"
                />
              )}
            </div>

            {tipoSolicitud !== 'fuera_programacion' && (
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-orange-400" />
                  Servicio especial (opcional)
                </label>
                <input
                  type="text"
                  value={servicioEspecial}
                  onChange={(e) => setServicioEspecial(e.target.value)}
                  maxLength={300}
                  placeholder="Ej: Balero delantero, ruido en suspension..."
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-400" />
                  Fecha deseada
                </label>
                <input
                  type="date"
                  value={fechaProgramada}
                  onChange={(e) => {
                    setFechaProgramada(e.target.value);
                    setHoraProgramada('');
                  }}
                  min={today}
                  lang="es-MX"
                  className="w-full p-3 bg-white border border-white/10 rounded-lg text-slate-900"
                  required
                />
                {fechaProgramada && (
                  <p className="text-xs text-gray-300 mt-1">
                    Fecha seleccionada: {formatDate(fechaProgramada)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-400" />
                  Hora deseada
                </label>
                <select
                  value={horaProgramada}
                  onChange={(e) => setHoraProgramada(e.target.value)}
                  className="w-full p-3 bg-white border border-white/10 rounded-lg text-slate-900"
                  disabled={!fechaProgramada || cargandoDisponibilidad}
                  required
                >
                  <option value="">
                    {fechaProgramada ? 'Selecciona un horario' : 'Primero selecciona fecha'}
                  </option>
                  {(slotsAgenda.length > 0
                    ? slotsAgenda
                    : HALF_HOUR_SLOTS.map((hora) => ({ hora, disponible: true }))
                  ).map((slot) => (
                    <option
                      key={slot.hora}
                      value={slot.hora}
                      disabled={!slot.disponible}
                    >
                      {slot.hora} {!slot.disponible ? ' - Ocupado' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Bloques de 30 minutos (08:00 a 15:00). Si un horario ya esta ocupado, no se puede seleccionar.
                </p>
                {cargandoDisponibilidad && (
                  <p className="text-xs text-cyan-300 mt-1">Cargando disponibilidad...</p>
                )}
              </div>
            </div>

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
              </label>
            </div>

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
                onClick={() => {
                  setMostrarFormSolicitud(false);
                  setTipoServicio('');
                  setTipoSolicitud('preventivo_programado');
                  setCausaFueraProgramacion('');
                  setServicioEspecial('');
                  setDescripcion('');
                  setFechaProgramada('');
                  setHoraProgramada('');
                  setSlotsAgenda([]);
                  setUrgente(false);
                }}
                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Pendientes" value={stats.pendientes} icon={<Clock className="w-5 h-5 text-yellow-400" />} />
        <StatCard title="En Proceso" value={stats.enProceso} icon={<Wrench className="w-5 h-5 text-blue-400" />} />
        <StatCard title="Completados" value={stats.completados} icon={<CheckCircle className="w-5 h-5 text-green-400" />} />
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Seguimiento de Solicitudes</h2>
        {mantenimientosActivos.length === 0 ? (
          <p className="text-gray-400">No tienes mantenimientos activos.</p>
        ) : (
          <div className="space-y-4">
            {mantenimientosActivos.map((mant) => (
              <MantenimientoCard key={mant.id} mantenimiento={mant} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Mantenimientos Completados</h2>
        {mantenimientosCompletados.length === 0 ? (
          <p className="text-gray-400">Aun no hay mantenimientos completados.</p>
        ) : (
          <div className="space-y-4">
            {mantenimientosCompletados.map((mant) => (
              <MantenimientoCard
                key={mant.id}
                mantenimiento={mant}
                highlightCompletado
                onConfirmarEntrega={abrirConfirmacionEntrega}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmacionEntregaModal
        open={confirmacionModal.open}
        mantenimiento={confirmacionModal.mantenimiento}
        form={formConfirmacion}
        setForm={setFormConfirmacion}
        loading={confirmandoEntrega}
        onClose={cerrarConfirmacionEntrega}
        onSubmit={submitConfirmacionEntrega}
      />
    </div>
  );
};

const StatCard = ({ title, value, icon }) => (
  <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-400 text-sm">{title}</span>
      {icon}
    </div>
    <p className="text-3xl font-bold text-white">{value}</p>
  </div>
);

const MantenimientoCard = ({ mantenimiento, highlightCompletado = false, onConfirmarEntrega = null }) => {
  const [expanded, setExpanded] = useState(false);
  const esUrgente = isEstado(mantenimiento.estado, 'urgente');
  const cobertura = getCobertura(mantenimiento);
  const confirmacionEntrega = mantenimiento?.confirmacion_entrega || null;
  const confirmadaEntrega = Boolean(confirmacionEntrega?.confirmada);
  const puedeConfirmarEntrega = Boolean(highlightCompletado && !confirmadaEntrega && onConfirmarEntrega);

  return (
    <div
      className={`rounded-xl p-4 transition-all border ${
        highlightCompletado ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h3 className="text-white font-semibold text-lg">{mantenimiento.tipo_servicio}</h3>
            <EstadoBadge estado={mantenimiento.estado} />
            {mantenimiento.tipo_solicitud === 'fuera_programacion' && (
              <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs font-semibold rounded-full">
                Fuera de programacion
              </span>
            )}
            {esUrgente && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" />
                URGENTE
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mb-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Programada: {formatDate(mantenimiento.fecha_programada || mantenimiento.fecha_solicitud)}
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Realizada: {formatDate(mantenimiento.fecha_realizada)}
            </span>
            {(mantenimiento.folio_mantenimiento || mantenimiento.folio_servicio) && (
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                Folio: {mantenimiento.folio_mantenimiento || mantenimiento.folio_servicio}
              </span>
            )}
          </div>

          {highlightCompletado && (
            <div className="mb-2">
              {confirmadaEntrega ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border border-emerald-500/30 text-emerald-200 bg-emerald-500/10">
                  <CheckCircle className="w-3 h-3" />
                  Entrega confirmada por conductor
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border border-yellow-500/30 text-yellow-200 bg-yellow-500/10">
                  <Clock className="w-3 h-3" />
                  Pendiente de confirmacion de entrega
                </span>
              )}
            </div>
          )}

          {expanded && (
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
              <div>
                <p className="text-gray-400 text-sm font-semibold">Descripcion:</p>
                <p className="text-white text-sm">{mantenimiento.descripcion || mantenimiento.observaciones || 'Sin descripcion'}</p>
              </div>

              {mantenimiento.tipo_solicitud === 'fuera_programacion' && (
                <div>
                  <p className="text-gray-400 text-sm font-semibold">Causa:</p>
                  <p className="text-white text-sm">
                    {getLabelFromOptions(
                      mantenimiento.causa_fuera_programacion,
                      DEFAULT_CAUSAS_FUERA_PROGRAMACION,
                      mantenimiento.causa_fuera_programacion || 'No especificada'
                    )}
                  </p>
                </div>
              )}

              <div>
                <p className="text-gray-400 text-sm font-semibold">Fecha Programada:</p>
                <p className="text-white text-sm">{formatDateLong(mantenimiento.fecha_programada)}</p>
              </div>

              <div>
                <p className="text-gray-400 text-sm font-semibold">Fecha Realizada:</p>
                <p className="text-white text-sm">{formatDateLong(mantenimiento.fecha_realizada)}</p>
              </div>

              <div>
                <p className="text-gray-400 text-sm font-semibold">Costo total:</p>
                <p className="text-white text-sm">{formatCurrency(mantenimiento.costo_total)}</p>
              </div>

              {cobertura.length > 0 && (
                <div>
                  <p className="text-gray-400 text-sm font-semibold">Cobertura del gasto:</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {cobertura.map((item) => (
                      <span
                        key={item.key}
                        className="px-2 py-1 rounded-full text-xs border border-cyan-500/30 text-cyan-200 bg-cyan-500/10"
                      >
                        {item.label}: {formatCurrency(item.value)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {confirmadaEntrega && (
                <div>
                  <p className="text-gray-400 text-sm font-semibold">Confirmacion del conductor:</p>
                  <p className="text-white text-sm">
                    Visto bueno: {confirmacionEntrega?.visto_bueno_entrega ? 'Si' : 'No'} | Satisfaccion:{' '}
                    {confirmacionEntrega?.satisfecho ? 'Satisfecho' : 'No satisfecho'}
                  </p>
                  <p className="text-white text-sm">
                    Calificacion: {confirmacionEntrega?.calificacion || 'Sin calificacion'} / 5
                  </p>
                  <p className="text-white text-sm">
                    Fecha de confirmacion: {formatDateTime(confirmacionEntrega?.fecha_confirmacion)}
                  </p>
                  {confirmacionEntrega?.comentarios && (
                    <p className="text-white text-sm mt-1">Comentarios: {confirmacionEntrega.comentarios}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {puedeConfirmarEntrega && (
            <button
              onClick={() => onConfirmarEntrega(mantenimiento)}
              className="px-3 py-1.5 rounded-lg text-xs border border-emerald-500/40 text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
            >
              Confirmar entrega
            </button>
          )}
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="text-cyan-400 hover:text-cyan-300 text-sm whitespace-nowrap"
          >
            {expanded ? 'Ver menos' : 'Ver mas'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmacionEntregaModal = ({
  open,
  mantenimiento,
  form,
  setForm,
  loading,
  onClose,
  onSubmit
}) => {
  if (!open || !mantenimiento) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#102B46] shadow-2xl">
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-xl font-bold text-white">Confirmar entrega de mantenimiento</h3>
          <p className="text-sm text-gray-300 mt-1">
            Folio {mantenimiento.folio_mantenimiento || mantenimiento.folio_servicio || mantenimiento.id} ·{' '}
            {mantenimiento.tipo_servicio}
          </p>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={Boolean(form.visto_bueno_entrega)}
              onChange={(e) => setForm((prev) => ({ ...prev, visto_bueno_entrega: e.target.checked }))}
              className="w-4 h-4 rounded border-white/20"
            />
            Confirmo que recibí la unidad y doy visto bueno de entrega
          </label>

          <div>
            <p className="text-sm text-gray-200 mb-2">¿Quedaste satisfecho con el servicio?</p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="radio"
                  name="satisfecho"
                  checked={Boolean(form.satisfecho) === true}
                  onChange={() => setForm((prev) => ({ ...prev, satisfecho: true }))}
                />
                Sí
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="radio"
                  name="satisfecho"
                  checked={Boolean(form.satisfecho) === false}
                  onChange={() => setForm((prev) => ({ ...prev, satisfecho: false }))}
                />
                No
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-200 mb-2">Calificación del servicio (1 a 5)</label>
            <select
              value={String(form.calificacion || '')}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  calificacion: e.target.value ? Number(e.target.value) : null
                }))
              }
              className="w-full rounded-lg bg-white text-slate-900 px-3 py-2 border border-white/20"
            >
              <option value="">Sin calificación</option>
              <option value="5">5 - Excelente</option>
              <option value="4">4 - Buena</option>
              <option value="3">3 - Regular</option>
              <option value="2">2 - Mala</option>
              <option value="1">1 - Muy mala</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-200 mb-2">Comentarios (opcional)</label>
            <textarea
              rows={3}
              value={form.comentarios}
              onChange={(e) => setForm((prev) => ({ ...prev, comentarios: e.target.value.slice(0, 500) }))}
              placeholder="Comparte cualquier detalle de la entrega o del servicio"
              className="w-full rounded-lg bg-white/5 text-white placeholder-gray-400 px-3 py-2 border border-white/20"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {loading ? 'Guardando...' : 'Confirmar entrega'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EstadoBadge = ({ estado }) => {
  const normalized = normalizeEstado(estado);
  const config = {
    pendiente: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock, label: 'Pendiente' },
    programado: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Calendar, label: 'Programado' },
    urgente: { bg: 'bg-red-500/20', text: 'text-red-400', icon: Zap, label: 'Urgente' },
    enproceso: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: Wrench, label: 'En proceso' },
    completado: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle, label: 'Completado' },
    cancelado: { bg: 'bg-red-500/20', text: 'text-red-400', icon: Clock, label: 'Cancelado' }
  };

  const estadoConfig = config[normalized] || config.pendiente;
  const Icon = estadoConfig.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${estadoConfig.bg} ${estadoConfig.text}`}>
      <Icon className="w-3 h-3" />
      {estadoConfig.label}
    </span>
  );
};

export default Mantenimientos;
