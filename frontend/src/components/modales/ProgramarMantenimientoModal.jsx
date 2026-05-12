// frontend/src/components/modales/ProgramarMantenimientoModal.jsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader,
  Gauge
} from 'lucide-react';
import adminService from '../../services/adminService';

const DEFAULT_INTERVAL_KM = 10000;
const HALF_HOUR_SLOTS = (() => {
  const slots = [];
  for (let h = 9; h <= 18; h += 1) {
    const hh = String(h).padStart(2, '0');
    slots.push(`${hh}:00`);
    slots.push(`${hh}:30`);
  }
  return slots;
})();

const normalizeText = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_');

const isBydDolphinMiniModel = (modelo) => {
  const normalized = normalizeText(modelo);
  const hasDolphinMini = normalized.includes('dolphin') && normalized.includes('mini');
  const hasBydDolphinMini = normalized.includes('byd') && hasDolphinMini;
  return hasBydDolphinMini || hasDolphinMini;
};

const buildModeloDescriptor = (vehiculo = {}) => {
  const marca = String(vehiculo?.Marca || vehiculo?.marca || '').trim();
  const modelo = String(vehiculo?.Modelo || vehiculo?.modelo || '').trim();
  return `${marca} ${modelo}`.trim() || modelo || marca;
};

const getScheduleMeta = (modeloKey) => {
  const normalizedKey = normalizeText(modeloKey);
  if (normalizedKey.includes('byd_dolphin_mini')) {
    return {
      startKm: 5000,
      intervalKm: 20000,
      cycleLength: 9
    };
  }
  return {
    startKm: 10000,
    intervalKm: DEFAULT_INTERVAL_KM,
    cycleLength: 10
  };
};

const resolveScheduleKey = (modelo, modelos = {}) => {
  const keys = Object.keys(modelos || {});
  if (keys.length === 0) return null;

  const normalizedModelo = normalizeText(modelo);

  const direct = keys.find((key) => normalizeText(key) === normalizedModelo);
  if (direct) return direct;

  if (isBydDolphinMiniModel(modelo)) {
    const bydKey = keys.find((key) => normalizeText(key).includes('byd_dolphin_mini'));
    if (bydKey) return bydKey;
  }

  const genericKey = keys.find((key) => {
    const normalized = normalizeText(key);
    return normalized === 'generic' || normalized === 'generico_10000km' || normalized === 'generico';
  });
  if (genericKey) return genericKey;

  if (
    normalizedModelo.includes('v_drive') ||
    normalizedModelo.includes('vdrive') ||
    normalizedModelo.includes('versa')
  ) {
    const vDriveKey = keys.find((key) => normalizeText(key).includes('v_drive'));
    if (vDriveKey) return vDriveKey;
  }

  if (normalizedModelo.includes('march')) {
    const marchKey = keys.find((key) => normalizeText(key).includes('march'));
    if (marchKey) return marchKey;
  }

  return keys[0];
};

const getServicioSugerido = ({ kilometraje, modelo, modelos, fallbackTipos = [] }) => {
  const kmActual = Number(kilometraje);
  const kmSeguro = Number.isFinite(kmActual) && kmActual >= 0 ? kmActual : 0;

  const modeloKey = resolveScheduleKey(modelo, modelos);
  const schedule = modeloKey ? modelos?.[modeloKey] || [] : [];
  const meta = getScheduleMeta(modeloKey);

  if (Array.isArray(schedule) && schedule.length > 0) {
    const ordenados = [...schedule].sort((a, b) => Number(a.kilometraje || 0) - Number(b.kilometraje || 0));
    let siguiente = ordenados.find((item) => Number(item.kilometraje || 0) >= kmSeguro) || null;
    if (!siguiente) {
      const startKm = Number(meta.startKm || DEFAULT_INTERVAL_KM);
      const intervalKm = Math.max(Number(meta.intervalKm || DEFAULT_INTERVAL_KM), 1);
      const cycleLength = Math.max(Number(meta.cycleLength || ordenados.length), 1);
      const kmObjetivo = kmSeguro <= startKm
        ? startKm
        : startKm + (Math.ceil((kmSeguro - startKm) / intervalKm) * intervalKm);
      const cycleStep = Math.max(Math.round((kmObjetivo - startKm) / intervalKm), 0);
      const cycleIndex = cycleStep % cycleLength;
      const kmBaseCiclo = startKm + (cycleIndex * intervalKm);
      const baseCiclo = ordenados.find((item) => Number(item.kilometraje || 0) === kmBaseCiclo);
      const fallback = baseCiclo || ordenados[ordenados.length - 1];
      siguiente = {
        ...fallback,
        kilometraje: kmObjetivo
      };
    }

    return {
      tipoServicio: siguiente?.servicio || '',
      kilometrajeObjetivo: Number(siguiente?.kilometraje || 0) || kmSeguro + Math.max(Number(meta.intervalKm || DEFAULT_INTERVAL_KM), 1),
      fuenteCalendario: true,
      modeloKey: modeloKey || null,
      servicioCodigo: siguiente?.servicio_codigo || null,
      servicioNivel: siguiente?.servicio_nivel || null,
      incluyeRotacion: Boolean(siguiente?.incluye_rotacion)
    };
  }

  return {
    tipoServicio: fallbackTipos[0] || 'Revision general',
    kilometrajeObjetivo: kmSeguro + DEFAULT_INTERVAL_KM,
    fuenteCalendario: false,
    modeloKey: null,
    servicioCodigo: null,
    servicioNivel: null,
    incluyeRotacion: false
  };
};

const getServicioPreventivoTitulo = (sugerencia = {}) => {
  const codigo = String(sugerencia?.servicioCodigo || '').trim();
  const nivel = String(sugerencia?.servicioNivel || '').trim();
  if (!codigo && !nivel) return null;
  if (codigo && nivel) return `Servicio ${codigo} (${nivel})`;
  if (codigo) return `Servicio ${codigo}`;
  return nivel;
};

const ProgramarMantenimientoModal = ({ isOpen, onClose, vehiculo, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [opciones, setOpciones] = useState({
    tipos_servicio: [],
    talleres: []
  });

  const [serviciosPreventivos, setServiciosPreventivos] = useState({});
  const [servicioSugerido, setServicioSugerido] = useState({
    tipoServicio: '',
    kilometrajeObjetivo: 0,
    fuenteCalendario: false,
    modeloKey: null
  });

  const [formData, setFormData] = useState({
    tipo_servicio: '',
    servicio_especial: '',
    fecha_programada: new Date().toISOString().split('T')[0],
    hora_programada: '',
    kilometraje_servicio: vehiculo?.KilometrajeActual || 0,
    proximo_servicio_km: 0,
    taller: '',
    observaciones: '',
    monto_estimado: 0
  });

  const [formErrors, setFormErrors] = useState({});
  const [slotsAgenda, setSlotsAgenda] = useState([]);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);

  const buildFormWithSuggestion = (kmValue, modelosRef, tiposRef) => {
    const kmActual = Number(kmValue);
    const kmSeguro = Number.isFinite(kmActual) && kmActual >= 0 ? kmActual : 0;

    const sugerencia = getServicioSugerido({
      kilometraje: kmSeguro,
      modelo: buildModeloDescriptor(vehiculo),
      modelos: modelosRef,
      fallbackTipos: tiposRef
    });

    const proximoKm = Number(sugerencia.kilometrajeObjetivo) > kmSeguro
      ? Number(sugerencia.kilometrajeObjetivo)
      : kmSeguro + DEFAULT_INTERVAL_KM;

    return {
      sugerencia,
      form: {
        tipo_servicio: sugerencia.tipoServicio || '',
        servicio_especial: '',
        fecha_programada: new Date().toISOString().split('T')[0],
        hora_programada: '',
        kilometraje_servicio: kmSeguro,
        proximo_servicio_km: proximoKm,
        taller: '',
        observaciones: '',
        monto_estimado: 0
      }
    };
  };

  const initializeModal = async () => {
    try {
      setLoading(true);
      setError(null);

      const [responseOpciones, responseServicios] = await Promise.all([
        adminService.getOpcionesMantenimientos(),
        adminService.getServiciosPreventivosMantenimientos()
      ]);

      const opcionesData = responseOpciones?.success
        ? responseOpciones.opciones || { tipos_servicio: [], talleres: [] }
        : { tipos_servicio: [], talleres: [] };

      const modelosData = responseServicios?.success
        ? responseServicios.modelos || {}
        : {};

      setOpciones(opcionesData);
      setServiciosPreventivos(modelosData);

      const kmActual = Number(vehiculo?.KilometrajeActual || 0);
      const { sugerencia, form } = buildFormWithSuggestion(kmActual, modelosData, opcionesData.tipos_servicio || []);

      setServicioSugerido(sugerencia);
      setFormData(form);
      setFormErrors({});
    } catch (err) {
      console.error('Error inicializando modal de mantenimiento:', err);
      setError('No se pudieron cargar las opciones del formulario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      initializeModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vehiculo]);

  useEffect(() => {
    let isMounted = true;

    const cargarDisponibilidad = async () => {
      if (!isOpen || !formData.fecha_programada) {
        if (isMounted) {
          setSlotsAgenda([]);
          setCargandoDisponibilidad(false);
        }
        return;
      }

      try {
        if (isMounted) setCargandoDisponibilidad(true);
        const response = await adminService.getDisponibilidadAgendaMantenimientos(formData.fecha_programada);
        const slots = Array.isArray(response?.slots) ? response.slots : [];
        if (!isMounted) return;
        setSlotsAgenda(slots);

        if (formData.hora_programada) {
          const slotSeleccionado = slots.find((slot) => slot.hora === formData.hora_programada);
          if (slotSeleccionado && !slotSeleccionado.disponible) {
            setFormData((prev) => ({ ...prev, hora_programada: '' }));
            setFormErrors((prev) => ({
              ...prev,
              hora_programada: 'La hora seleccionada ya no esta disponible'
            }));
          }
        }
      } catch (err) {
        if (!isMounted) return;
        setSlotsAgenda([]);
      } finally {
        if (isMounted) setCargandoDisponibilidad(false);
      }
    };

    cargarDisponibilidad();
    return () => {
      isMounted = false;
    };
  }, [isOpen, formData.fecha_programada]);

  const resetForm = () => {
    const kmActual = Number(vehiculo?.KilometrajeActual || 0);
    const { sugerencia, form } = buildFormWithSuggestion(kmActual, serviciosPreventivos, opciones.tipos_servicio || []);

    setServicioSugerido(sugerencia);
    setFormData(form);
    setFormErrors({});
    setError(null);
  };

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose();
    }
  };

  const handleFormChange = (field, value) => {
    if (field === 'kilometraje_servicio') {
      const kmNumerico = Number(value);
      const kmSeguro = Number.isFinite(kmNumerico) && kmNumerico >= 0 ? kmNumerico : 0;

      const sugerencia = getServicioSugerido({
        kilometraje: kmSeguro,
        modelo: buildModeloDescriptor(vehiculo),
        modelos: serviciosPreventivos,
        fallbackTipos: opciones.tipos_servicio || []
      });

      const proximoKm = Number(sugerencia.kilometrajeObjetivo) > kmSeguro
        ? Number(sugerencia.kilometrajeObjetivo)
        : kmSeguro + DEFAULT_INTERVAL_KM;

      setServicioSugerido(sugerencia);
      setFormData((prev) => ({
        ...prev,
        kilometraje_servicio: value,
        tipo_servicio: sugerencia.tipoServicio || '',
        proximo_servicio_km: proximoKm
      }));

      setFormErrors((prev) => ({
        ...prev,
        kilometraje_servicio: null,
        tipo_servicio: null,
        proximo_servicio_km: null
      }));
      return;
    }

    if (field === 'fecha_programada') {
      setFormData((prev) => ({
        ...prev,
        fecha_programada: value,
        hora_programada: ''
      }));
      if (formErrors.fecha_programada || formErrors.hora_programada) {
        setFormErrors((prev) => ({
          ...prev,
          fecha_programada: null,
          hora_programada: null
        }));
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));

    if (formErrors[field]) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    const kmActual = Number(formData.kilometraje_servicio);
    const kmProximo = Number(formData.proximo_servicio_km);
    const servicioBase = String(formData.tipo_servicio || '').trim();
    const servicioEspecial = String(formData.servicio_especial || '').trim();

    if (!servicioBase && !servicioEspecial) {
      errors.tipo_servicio = 'No se pudo determinar el servicio. Agrega un servicio especial.';
    }

    if (!formData.fecha_programada) {
      errors.fecha_programada = 'Seleccione una fecha';
    } else {
      const fechaSeleccionada = new Date(`${formData.fecha_programada}T12:00:00`);
      const diaSemana = fechaSeleccionada.getDay();
      if (Number.isNaN(fechaSeleccionada.getTime())) {
        errors.fecha_programada = 'Fecha invalida';
      } else if (diaSemana === 0) {
        errors.fecha_programada = 'No se pueden agendar mantenimientos los domingos';
      }
    }

    if (!formData.hora_programada) {
      errors.hora_programada = 'Seleccione una hora';
    } else {
      const [hora, minuto] = formData.hora_programada.split(':').map(Number);
      if (Number.isNaN(hora) || Number.isNaN(minuto)) {
        errors.hora_programada = 'Formato de hora invalido';
      } else {
        const inicioEnMinutos = hora * 60 + minuto;
        const finEnMinutos = inicioEnMinutos + 30;
        if (inicioEnMinutos < 540 || finEnMinutos > 1140) {
          errors.hora_programada = 'Horarios disponibles de 09:00 a 19:00 en bloques de 30 minutos';
        }
      }
    }

    if (slotsAgenda.length > 0) {
      const slotSeleccionado = slotsAgenda.find((slot) => slot.hora === formData.hora_programada);
      if (slotSeleccionado && !slotSeleccionado.disponible) {
        errors.hora_programada = 'Ese bloque de 30 minutos ya esta ocupado';
      }
    }

    if (!Number.isFinite(kmActual) || kmActual < 0) {
      errors.kilometraje_servicio = 'Ingrese un kilometraje valido';
    }

    if (!Number.isFinite(kmProximo) || kmProximo <= kmActual) {
      errors.proximo_servicio_km = 'Debe ser mayor al kilometraje actual';
    }

    return errors;
  };

  const handleProgramar = async () => {
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const servicioBase = String(formData.tipo_servicio || '').trim();
      const servicioEspecial = String(formData.servicio_especial || '').trim();

      const tipoServicioFinal = [
        servicioBase,
        servicioEspecial ? `Especial: ${servicioEspecial}` : ''
      ].filter(Boolean).join(' | ');

      const datos = {
        vehiculo_id: vehiculo.id,
        tipo_servicio: tipoServicioFinal,
        fecha_programada: formData.fecha_programada,
        hora_programada: formData.hora_programada,
        kilometraje_servicio: parseInt(formData.kilometraje_servicio, 10),
        proximo_servicio_km: parseInt(formData.proximo_servicio_km, 10),
        taller: formData.taller || null,
        observaciones: formData.observaciones || null,
        monto_estimado: parseFloat(formData.monto_estimado) || 0
      };

      const response = await adminService.programarMantenimiento(datos);

      if (response.success) {
        if (onSuccess) {
          await onSuccess(response);
        }
        handleClose();
      } else {
        throw new Error(response.error || 'Error al programar mantenimiento');
      }
    } catch (err) {
      console.error('Error programando mantenimiento:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="glass rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-primary/20 flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Programar Mantenimiento
            </h2>
            <p className="text-sm text-gray-400">
              Vehiculo: <span className="text-primary font-semibold">{vehiculo?.NumeroVehiculo}</span> - {vehiculo?.Marca} {vehiculo?.Modelo}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-2 hover:bg-surface-secondary rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Error</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Kilometraje Actual <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    value={formData.kilometraje_servicio}
                    onChange={(e) => handleFormChange('kilometraje_servicio', e.target.value)}
                    min="0"
                    className={`w-full pl-10 pr-4 py-2 bg-surface-secondary border rounded-lg text-white focus:outline-none focus:ring-2 ${
                      formErrors.kilometraje_servicio
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-gray-700 focus:ring-primary/50'
                    }`}
                  />
                </div>
                {formErrors.kilometraje_servicio && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.kilometraje_servicio}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Proximo Servicio (km) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    value={formData.proximo_servicio_km}
                    onChange={(e) => handleFormChange('proximo_servicio_km', e.target.value)}
                    min="0"
                    className={`w-full pl-10 pr-4 py-2 bg-surface-secondary border rounded-lg text-white focus:outline-none focus:ring-2 ${
                      formErrors.proximo_servicio_km
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-gray-700 focus:ring-primary/50'
                    }`}
                  />
                </div>
                {formErrors.proximo_servicio_km && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.proximo_servicio_km}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Servicio sugerido segun kilometraje <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Wrench className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                <textarea
                  value={formData.tipo_servicio}
                  readOnly
                  rows={Math.max(2, Math.ceil(String(formData.tipo_servicio || '').length / 75))}
                  className={`w-full pl-10 pr-4 py-2 bg-white/90 border rounded-lg text-slate-900 leading-relaxed resize-none break-words ${
                    formErrors.tipo_servicio ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {formErrors.tipo_servicio && (
                <p className="text-red-400 text-xs mt-1">{formErrors.tipo_servicio}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                {servicioSugerido.fuenteCalendario
                  ? `${getServicioPreventivoTitulo(servicioSugerido) ? `${getServicioPreventivoTitulo(servicioSugerido)}. ` : ''}Sugerido para modelo ${vehiculo?.Modelo || '-'} en ${Number(servicioSugerido.kilometrajeObjetivo || 0).toLocaleString('es-MX')} km.${servicioSugerido.incluyeRotacion ? ' Incluye rotacion de llantas.' : ''}`
                  : 'No hay calendario preventivo configurado para este modelo. Se aplico sugerencia general.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Servicio especial (opcional)
              </label>
              <div className="relative">
                <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.servicio_especial}
                  onChange={(e) => handleFormChange('servicio_especial', e.target.value)}
                  placeholder="Ej. Balero delantero, banda auxiliar, etc."
                  className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Fecha Programada <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="date"
                  value={formData.fecha_programada}
                  onChange={(e) => handleFormChange('fecha_programada', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 ${
                    formErrors.fecha_programada
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-gray-300 focus:ring-primary/50'
                  }`}
                />
              </div>
              {formErrors.fecha_programada && (
                <p className="text-red-400 text-xs mt-1">{formErrors.fecha_programada}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Hora Programada <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <select
                  value={formData.hora_programada}
                  onChange={(e) => handleFormChange('hora_programada', e.target.value)}
                  disabled={!formData.fecha_programada || cargandoDisponibilidad}
                  className={`w-full pl-10 pr-4 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 ${
                    formErrors.hora_programada
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-gray-300 focus:ring-primary/50'
                  }`}
                >
                  <option value="">
                    {formData.fecha_programada ? 'Selecciona un horario' : 'Primero selecciona fecha'}
                  </option>
                  {(slotsAgenda.length > 0
                    ? slotsAgenda
                    : HALF_HOUR_SLOTS.map((hora) => ({ hora, disponible: true }))
                  ).map((slot) => (
                    <option key={slot.hora} value={slot.hora} disabled={!slot.disponible}>
                      {slot.hora}
                      {!slot.disponible ? ' - Ocupado' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {formErrors.hora_programada && (
                <p className="text-red-400 text-xs mt-1">{formErrors.hora_programada}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">Bloques de 30 minutos. Si un horario ya esta ocupado, no se puede seleccionar.</p>
              {cargandoDisponibilidad && (
                <p className="text-cyan-300 text-xs mt-1">Cargando disponibilidad...</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Taller
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <select
                  value={formData.taller}
                  onChange={(e) => handleFormChange('taller', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Seleccionar taller (opcional)...</option>
                  {opciones.talleres.map((taller) => (
                    <option key={taller} value={taller}>{taller}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Monto Estimado
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="number"
                  value={formData.monto_estimado}
                  onChange={(e) => handleFormChange('monto_estimado', e.target.value)}
                  min="0"
                  step="10"
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Observaciones
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => handleFormChange('observaciones', e.target.value)}
                  rows="3"
                  placeholder="Detalles adicionales del servicio..."
                  className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-700 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-surface-secondary border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleProgramar}
            disabled={saving || loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-500 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Programando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Programar Mantenimiento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgramarMantenimientoModal;
