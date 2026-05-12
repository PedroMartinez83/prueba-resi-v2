import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Car,
  Wrench,
  AlertCircle,
  Save,
  User,
  DollarSign,
  Gauge,
  Info,
  Paperclip
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';
import adminService from '@/services/adminService';
import {
  TALLER_CATEGORIAS_OPCIONES
} from '@/constants/mantenimiento';
import { formatMaintenanceDate } from '@/utils/maintenanceDateFormat';

const DEFAULT_INTERVAL_KM = 10000;
const MAX_ADMIN_ADJUNTOS = 6;
const MAX_ADMIN_ADJUNTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ADMIN_ADJUNTO_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence'
]);
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
  const marca = String(vehiculo?.marca || vehiculo?.Marca || '').trim();
  const modelo = String(vehiculo?.modelo || vehiculo?.Modelo || '').trim();
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
  if (!keys.length) return null;

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
    const objetivo = Number(siguiente?.kilometraje || 0) || kmSeguro + DEFAULT_INTERVAL_KM;
    return {
      tipoServicio: siguiente?.servicio || '',
      kilometrajeObjetivo: objetivo > kmSeguro ? objetivo : kmSeguro + Math.max(Number(meta.intervalKm || DEFAULT_INTERVAL_KM), 1),
      fuenteCalendario: true,
      servicioCodigo: siguiente?.servicio_codigo || null,
      servicioNivel: siguiente?.servicio_nivel || null,
      incluyeRotacion: Boolean(siguiente?.incluye_rotacion)
    };
  }

  return {
    tipoServicio: fallbackTipos[0] || 'Revision general',
    kilometrajeObjetivo: kmSeguro + DEFAULT_INTERVAL_KM,
    fuenteCalendario: false,
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

const ProgramarMantenimiento = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const vehiculoQueryId = new URLSearchParams(location.search).get('vehiculo_id');
  const [loading, setLoading] = useState(false);
  const [vehiculos, setVehiculos] = useState([]);
  const [tiposServicio, setTiposServicio] = useState([]);
  const [serviciosPreventivos, setServiciosPreventivos] = useState({});
  const [servicioSugerido, setServicioSugerido] = useState({ fuenteCalendario: false, kilometrajeObjetivo: 0 });
  const [categoriasTaller, setCategoriasTaller] = useState(TALLER_CATEGORIAS_OPCIONES);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [desdeSiniestro, setDesdeSiniestro] = useState(false);
  const [siniestroInfo, setSiniestroInfo] = useState(null);
  const [slotsAgenda, setSlotsAgenda] = useState([]);
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState(false);
  const [forzarHorarioOcupado, setForzarHorarioOcupado] = useState(false);
  const [adjuntosAdmin, setAdjuntosAdmin] = useState([]);
  const [tiposSolicitudOpciones, setTiposSolicitudOpciones] = useState(DEFAULT_TIPOS_SOLICITUD);
  
  const [formData, setFormData] = useState({
    vehiculo_id: '',
    tipo_solicitud: 'preventivo_programado',
    causa_fuera_programacion: '',
    tipo_servicio: '',
    fecha_programada: '',
    hora_programada: '',
    kilometraje_servicio: '',
    proximo_servicio_km: '',
    taller: '',
    taller_otro_detalle: '',
    servicio_especial: '',
    observaciones: '',
    monto_estimado: ''
  });
  const [errors, setErrors] = useState({});

  const mapTallerToCategoria = (value) => {
    const raw = String(value || '').trim();
    if (!raw) {
      return { categoria: '', detalle: '' };
    }

    if (raw.toLowerCase().startsWith('otro:')) {
      return {
        categoria: 'Otro',
        detalle: raw.slice(5).trim()
      };
    }

    const categoriaExiste = categoriasTaller.some((item) => item.value === raw);
    if (categoriaExiste) {
      return { categoria: raw, detalle: '' };
    }

    return { categoria: 'Otro', detalle: raw };
  };

  const aplicarSugerenciaPorKm = ({ kilometraje, modelo, actualizarTipo = true }) => {
    const sugerencia = getServicioSugerido({
      kilometraje,
      modelo,
      modelos: serviciosPreventivos,
      fallbackTipos: tiposServicio
    });

    setServicioSugerido(sugerencia);
    setFormData((prev) => ({
      ...prev,
      ...(actualizarTipo && prev.tipo_solicitud !== 'fuera_programacion'
        ? { tipo_servicio: sugerencia.tipoServicio || prev.tipo_servicio }
        : {}),
      proximo_servicio_km: sugerencia.kilometrajeObjetivo
    }));
  };

  // 🔥 Cargar opciones primero
  useEffect(() => {
    cargarOpciones();
  }, []);

  // 🔥 Detectar si viene desde siniestro y cargar datos
useEffect(() => {
  console.log('🔍 Verificando location.state:', location.state);
  
  if (location.state && vehiculos.length > 0) {
    // Detectar por siniestro_id en lugar de desde_siniestro
    if (location.state.siniestro_id || location.state.tipo_servicio === 'Reparación por Siniestro') {
      console.log('✅ Detectado: Viene desde siniestro');
      console.log('📦 State recibido:', location.state);
      cargarDatosDesdeSiniestro(location.state);
    }
  }
}, [location.state, vehiculos]);

  useEffect(() => {
    if (desdeSiniestro) return;
    if (!vehiculoQueryId) return;
    if (!vehiculos.length) return;
    if (formData.vehiculo_id) return;

    const exists = vehiculos.some((v) => String(v.id) === String(vehiculoQueryId));
    if (!exists) return;

    setFormData((prev) => ({
      ...prev,
      vehiculo_id: String(vehiculoQueryId)
    }));
  }, [desdeSiniestro, vehiculoQueryId, vehiculos, formData.vehiculo_id]);

  useEffect(() => {
    if (formData.vehiculo_id && !desdeSiniestro) {
      cargarInfoVehiculo(formData.vehiculo_id);
    }
  }, [formData.vehiculo_id, formData.tipo_solicitud]);

  useEffect(() => {
    if (desdeSiniestro) return;
    if (formData.tipo_solicitud === 'fuera_programacion') return;
    if (!formData.vehiculo_id) return;
    const kmActual = Number(formData.kilometraje_servicio);
    if (!Number.isFinite(kmActual)) return;

    aplicarSugerenciaPorKm({
      kilometraje: kmActual,
      modelo: buildModeloDescriptor(vehiculoSeleccionado)
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.vehiculo_id, formData.kilometraje_servicio, formData.tipo_solicitud, desdeSiniestro, vehiculoSeleccionado?.id, serviciosPreventivos, tiposServicio.length]);

  useEffect(() => {
    let isMounted = true;

    const cargarDisponibilidad = async () => {
      if (!formData.fecha_programada) {
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
      } catch (error) {
        if (!isMounted) return;
        console.error('Error al cargar disponibilidad:', error);
        setSlotsAgenda([]);
      } finally {
        if (isMounted) setCargandoDisponibilidad(false);
      }
    };

    cargarDisponibilidad();
    return () => {
      isMounted = false;
    };
  }, [formData.fecha_programada]);

  useEffect(() => {
    const slotSeleccionado = slotsAgenda.find((slot) => slot.hora === formData.hora_programada);
    if (!slotSeleccionado || slotSeleccionado.disponible) {
      setForzarHorarioOcupado(false);
    }
  }, [slotsAgenda, formData.hora_programada]);

  // 🔥 NUEVA FUNCIÓN: Cargar datos desde siniestro
const cargarDatosDesdeSiniestro = (state) => {
  console.log('🔄 Cargando datos desde siniestro...');
  
  setDesdeSiniestro(true);
  setSiniestroInfo({
    folio: state.siniestro_folio,
    id: state.siniestro_id
  });

  // 🔥 CONVERTIR STRINGS A NÚMEROS
  const kilometraje = state.kilometraje_servicio 
    ? parseInt(state.kilometraje_servicio) 
    : 0;

  // Pre-llenar formulario con datos del siniestro
  const vehiculoId = state.vehiculo_id ? String(state.vehiculo_id) : '';
  
  const tallerMap = mapTallerToCategoria(state.taller);

  setFormData({
    vehiculo_id: vehiculoId,
    tipo_solicitud: 'fuera_programacion',
    causa_fuera_programacion: 'siniestro',
    tipo_servicio: state.tipo_servicio || 'Reparación por Siniestro',
    fecha_programada: new Date().toISOString().split('T')[0],
    hora_programada: '',
    kilometraje_servicio: kilometraje, // 🔥 COMO NÚMERO
    proximo_servicio_km: kilometraje ? kilometraje + 10000 : '',
    taller: tallerMap.categoria,
    taller_otro_detalle: tallerMap.detalle,
    servicio_especial: '',
    observaciones: state.observaciones || '',
    monto_estimado: state.costo_estimado || ''
  });

  console.log('📝 Datos pre-llenados con kilometraje:', kilometraje);

  // Cargar info completa del vehículo si está disponible
  if (state.vehiculo_info) {
    setVehiculoSeleccionado(state.vehiculo_info);
    console.log('✅ Vehículo pre-cargado:', state.vehiculo_info);
  } else if (vehiculoId) {
    // Si no viene vehiculo_info, buscar en la lista
    const vehiculo = vehiculos.find(v => v.id === parseInt(vehiculoId));
    if (vehiculo) {
      setVehiculoSeleccionado(vehiculo);
      console.log('✅ Vehículo encontrado en lista:', vehiculo);
    }
  }

  console.log('✅ Formulario pre-llenado con datos del siniestro');
};
  const cargarOpciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const [responseOpciones, responseServicios] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/mantenimientos/opciones`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/admin/mantenimientos/servicios-preventivos`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const data = await responseOpciones.json();
      const serviciosData = await responseServicios.json();

      if (data.success) {
        setVehiculos(data.opciones.vehiculos || []);
        setTiposServicio(data.opciones.tipos_servicio || []);
        setTiposSolicitudOpciones(data.opciones.tipos_solicitud || DEFAULT_TIPOS_SOLICITUD);
        const categoriasBackend = Array.isArray(data.opciones.categorias_taller)
          ? data.opciones.categorias_taller.map((value) => ({ value, label: value }))
          : [];
        if (categoriasBackend.length > 0) {
          setCategoriasTaller(categoriasBackend);
        }
      }

      if (serviciosData.success) {
        setServiciosPreventivos(serviciosData.modelos || {});
      }
    } catch (error) {
      console.error('Error al cargar opciones:', error);
    }
  };

  const cargarInfoVehiculo = (vehiculoId) => {
    const vehiculo = vehiculos.find((v) => v.id === parseInt(vehiculoId, 10));
    if (vehiculo) {
      const kmActual = Number(vehiculo.kilometraje_actual || 0);
      const sugerencia = getServicioSugerido({
        kilometraje: kmActual,
        modelo: buildModeloDescriptor(vehiculo),
        modelos: serviciosPreventivos,
        fallbackTipos: tiposServicio
      });

      setServicioSugerido(sugerencia);
      setVehiculoSeleccionado(vehiculo);
      setFormData((prev) => ({
        ...prev,
        kilometraje_servicio: kmActual,
        tipo_servicio:
          prev.tipo_solicitud === 'fuera_programacion'
            ? prev.tipo_servicio
            : (sugerencia.tipoServicio || prev.tipo_servicio),
        proximo_servicio_km: sugerencia.kilometrajeObjetivo
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === 'fecha_programada') {
        return {
          ...prev,
          fecha_programada: value,
          hora_programada: ''
        };
      }
      return {
        ...prev,
        [name]: value,
        ...(name === 'tipo_solicitud'
          ? {
              causa_fuera_programacion:
                value !== 'fuera_programacion'
                  ? ''
                  : (prev.causa_fuera_programacion || 'otro'),
              tipo_servicio:
                value === 'fuera_programacion'
                  ? (desdeSiniestro ? prev.tipo_servicio : '')
                  : (prev.tipo_servicio || servicioSugerido.tipoServicio || prev.tipo_servicio),
              servicio_especial: value === 'fuera_programacion' ? '' : prev.servicio_especial
            }
          : {}),
        ...(name === 'taller' && value !== 'Otro' ? { taller_otro_detalle: '' } : {})
      };
    });
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleAdjuntosChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const merged = [...adjuntosAdmin, ...files];
    if (merged.length > MAX_ADMIN_ADJUNTOS) {
      setErrors((prev) => ({
        ...prev,
        adjuntos_admin: `Solo puedes adjuntar hasta ${MAX_ADMIN_ADJUNTOS} archivos`
      }));
      event.target.value = '';
      return;
    }

    for (const file of files) {
      const mime = String(file.type || '').toLowerCase();
      if (!ALLOWED_ADMIN_ADJUNTO_MIME_TYPES.has(mime)) {
        setErrors((prev) => ({
          ...prev,
          adjuntos_admin: 'Solo se permiten archivos JPG, PNG, WEBP, HEIC o PDF'
        }));
        event.target.value = '';
        return;
      }
      if (file.size > MAX_ADMIN_ADJUNTO_SIZE_BYTES) {
        setErrors((prev) => ({
          ...prev,
          adjuntos_admin: `El archivo "${file.name}" supera el limite de 10MB`
        }));
        event.target.value = '';
        return;
      }
    }

    setAdjuntosAdmin(merged);
    setErrors((prev) => ({ ...prev, adjuntos_admin: '' }));
    event.target.value = '';
  };

  const removeAdjunto = (index) => {
    setAdjuntosAdmin((prev) => prev.filter((_, i) => i !== index));
  };

  const validarFormulario = () => {
    const newErrors = {};

    if (!formData.vehiculo_id) {
      newErrors.vehiculo_id = 'Debes seleccionar un vehículo';
    }
    if (!String(formData.tipo_servicio || '').trim() && !String(formData.servicio_especial || '').trim()) {
      newErrors.tipo_servicio = 'No se pudo determinar el servicio. Agrega un servicio especial.';
    }
    if (formData.tipo_solicitud === 'fuera_programacion' && !String(formData.tipo_servicio || '').trim()) {
      newErrors.tipo_servicio = 'Debes redactar la falla reportada del vehiculo';
    }
    if (!formData.fecha_programada) {
      newErrors.fecha_programada = 'Debes seleccionar una fecha';
    } else {
      const fechaSeleccionada = new Date(`${formData.fecha_programada}T12:00:00`);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
// Comparamos contra el inicio del día seleccionado
      const fechaComparacion = new Date(`${formData.fecha_programada}T00:00:00`);

      if (fechaComparacion < hoy) {
        newErrors.fecha_programada = 'La fecha no puede ser anterior a hoy';
      }
      
      // 🟢 Modificamos para permitir Sábados (6) si así lo deseas, y bloquear solo Domingos (0)
      if (fechaSeleccionada.getDay() === 0) {
        newErrors.fecha_programada = 'No se pueden agendar mantenimientos los domingos';
      }
    }
    if (!formData.hora_programada) {
      newErrors.hora_programada = 'Debes seleccionar una hora';
    } else {
      const [hora, minuto] = formData.hora_programada.split(':').map(Number);
      if (Number.isNaN(hora) || Number.isNaN(minuto)) {
        newErrors.hora_programada = 'Formato de hora inválido';
      } else {
        const inicioEnMinutos = hora * 60 + minuto;
        const finEnMinutos = inicioEnMinutos + 30;
        if (inicioEnMinutos < 480 || finEnMinutos > 930) {
          newErrors.hora_programada = 'Horarios disponibles de 08:00 a 15:00 en bloques de 30 minutos';
        }
      }
    }
    if (slotsAgenda.length > 0) {
      const slotSeleccionado = slotsAgenda.find((slot) => slot.hora === formData.hora_programada);
      if (slotSeleccionado && !slotSeleccionado.disponible && !forzarHorarioOcupado) {
        newErrors.hora_programada = 'Ese bloque de 30 minutos ya esta ocupado. Activa la opcion de sobrecupo para continuar.';
      }
    }
    if (!formData.kilometraje_servicio || formData.kilometraje_servicio <= 0) {
      newErrors.kilometraje_servicio = 'Debes ingresar el kilometraje';
    }
    if (formData.taller === 'Otro' && !String(formData.taller_otro_detalle || '').trim()) {
      newErrors.taller_otro_detalle = 'Debes describir el taller cuando seleccionas "Otro"';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validarFormulario()) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const payload = new FormData();
      payload.append('vehiculo_id', String(parseInt(formData.vehiculo_id, 10)));
      payload.append('tipo_solicitud', formData.tipo_solicitud || '');
      payload.append(
        'causa_fuera_programacion',
        formData.tipo_solicitud === 'fuera_programacion'
          ? (formData.causa_fuera_programacion || 'otro')
          : ''
      );
      payload.append(
        'detalle_fuera_programacion',
        formData.tipo_solicitud === 'fuera_programacion'
          ? (formData.tipo_servicio || '')
          : ''
      );
      payload.append('forzar_horario_ocupado', forzarHorarioOcupado ? 'true' : 'false');
      payload.append('tipo_servicio', formData.tipo_servicio || '');
      payload.append('fecha_programada', formData.fecha_programada || '');
      payload.append('hora_programada', formData.hora_programada || '');
      payload.append('kilometraje_servicio', String(parseInt(formData.kilometraje_servicio, 10)));
      payload.append('proximo_servicio_km', String(parseInt(formData.proximo_servicio_km, 10)));
      payload.append('taller', formData.taller || '');
      payload.append('taller_otro_detalle', formData.taller_otro_detalle || '');
      payload.append(
        'servicio_especial',
        formData.tipo_solicitud === 'fuera_programacion' ? '' : (formData.servicio_especial || '')
      );
      payload.append('observaciones', formData.observaciones || '');
      payload.append(
        'monto_estimado',
        String(formData.monto_estimado ? parseFloat(formData.monto_estimado) : 0)
      );
      adjuntosAdmin.forEach((file) => {
        payload.append('adjuntos_admin', file);
      });

      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: payload
      });

      const data = await response.json();

if (data.success) {
        if (desdeSiniestro) {
          alert(
            '✅ Solicitud registrada (Pendiente)\n\n' + // Cambiado
            `🔧 Folio: #${data.mantenimiento.folio_servicio}\n` +
            `📋 Vinculado con Siniestro #${siniestroInfo.folio}`
          );
        } else {
          alert('✅ Solicitud de mantenimiento creada. Estado: Pendiente de aprobación.');
        }
        navigate('/admin/mantenimientos');
      } else {
        alert('❌ Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error al programar mantenimiento:', error);
      alert('❌ Error al programar el mantenimiento');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return formatMaintenanceDate(dateString, {
      fallback: '-',
      month: 'long',
      withWeekday: true
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/admin/mantenimientos')}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Programar Mantenimiento
            </h1>
            <p className="text-gray-400">
              Agenda un nuevo servicio para un vehículo
            </p>
          </div>
        </div>

        {/* 🔥 Banner si viene desde siniestro */}
        {desdeSiniestro && siniestroInfo && (
          <div className="mb-6 bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-xl border border-orange-500/30 p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-semibold mb-1">
                  Mantenimiento vinculado a Siniestro
                </p>
                <p className="text-gray-300 text-sm">
                  Este mantenimiento se creará como resultado del <strong>Siniestro #{siniestroInfo.folio}</strong>
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Los datos del vehículo y observaciones se han cargado automáticamente
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          
          {/* Sección 1: Información del Vehículo */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Car className="w-6 h-6 text-blue-400" />
              Información del Vehículo
              {desdeSiniestro && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  Pre-cargado
                </span>
              )}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Vehículo *
                </label>
                <select
                  name="vehiculo_id"
                  value={formData.vehiculo_id}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border ${
                    errors.vehiculo_id ? 'border-red-500' :
                    desdeSiniestro ? 'border-green-500/50 bg-green-500/5' : 'border-white/20'
                  } rounded-lg text-slate-900 focus:outline-none focus:border-blue-500`}
                >
                  <option value="">Selecciona un vehículo</option>
                  {vehiculos.map(vehiculo => (
                    <option key={vehiculo.id} value={vehiculo.id}>
                      {vehiculo.numero_vehiculo} - {vehiculo.marca} {vehiculo.modelo}
                      {vehiculo.nombre_conductor && ` (${vehiculo.nombre_conductor})`}
                    </option>
                  ))}
                </select>
                {errors.vehiculo_id && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.vehiculo_id}
                  </p>
                )}
              </div>

              {vehiculoSeleccionado && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Conductor Asignado</p>
                    <p className="text-white text-sm font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      {vehiculoSeleccionado.nombre_conductor || vehiculoSeleccionado.ConductorInfo?.nombre || 'Sin asignar'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Kilometraje Actual</p>
                    <p className="text-white text-sm font-semibold flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-purple-400" />
                      {vehiculoSeleccionado.kilometraje_actual?.toLocaleString() || '0'} km
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sección 2: Detalles del Servicio */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-purple-400" />
              Detalles del Servicio
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 block">
                  Tipo de solicitud
                </label>
                <select
                  name="tipo_solicitud"
                  value={formData.tipo_solicitud}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {tiposSolicitudOpciones.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 block">
                  {formData.tipo_solicitud === 'fuera_programacion'
                    ? 'Falla reportada del vehiculo *'
                    : 'Tipo de Servicio *'}
                </label>
                <textarea
                  name="tipo_servicio"
                  value={formData.tipo_servicio}
                  onChange={formData.tipo_solicitud === 'fuera_programacion' ? handleChange : undefined}
                  readOnly={formData.tipo_solicitud !== 'fuera_programacion'}
                  rows={Math.max(2, Math.ceil(String(formData.tipo_servicio || '').length / 75))}
                  placeholder={
                    formData.tipo_solicitud === 'fuera_programacion'
                      ? 'Describe la falla detectada del vehiculo. Ej. Ruido en suspension delantera, falla de frenos, no entra reversa, etc.'
                      : ''
                  }
                  className={`w-full px-4 py-3 border ${
                    errors.tipo_servicio ? 'border-red-500' : 'border-white/20'
                  } rounded-lg text-slate-900 leading-relaxed resize-none break-words ${
                    formData.tipo_solicitud === 'fuera_programacion' ? 'bg-white' : 'bg-white/80 cursor-not-allowed'
                  }`}
                />
                {errors.tipo_servicio && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.tipo_servicio}
                  </p>
                )}
                {formData.tipo_solicitud !== 'fuera_programacion' && (
                  <p className="text-gray-500 text-xs mt-1">
                    {servicioSugerido.fuenteCalendario
                      ? `${getServicioPreventivoTitulo(servicioSugerido) ? `${getServicioPreventivoTitulo(servicioSugerido)}. ` : ''}Sugerido por kilometraje en ${Number(servicioSugerido.kilometrajeObjetivo || 0).toLocaleString('es-MX')} km.${servicioSugerido.incluyeRotacion ? ' Incluye rotacion de llantas.' : ''}`
                      : 'No hay calendario preventivo disponible. Usa servicio especial si necesitas ajustar el detalle.'}
                  </p>
                )}
              </div>

              {formData.tipo_solicitud !== 'fuera_programacion' && (
                <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 block">
                  Servicio especial (opcional)
                </label>
                <input
                  type="text"
                  name="servicio_especial"
                  value={formData.servicio_especial}
                  onChange={handleChange}
                  maxLength={300}
                  placeholder="Ej. Balero delantero, ruido en suspension, banda auxiliar..."
                  className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Se agrega como detalle adicional del servicio, igual que en la solicitud del conductor.
                </p>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-cyan-300" />
                  Adjuntar evidencia (fotos o PDF) - Opcional
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,application/pdf"
                  multiple
                  onChange={handleAdjuntosChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:bg-cyan-500/20 file:text-cyan-200 hover:file:bg-cyan-500/30"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Hasta {MAX_ADMIN_ADJUNTOS} archivos. Maximo 10MB por archivo.
                </p>
                {errors.adjuntos_admin && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.adjuntos_admin}
                  </p>
                )}
                {adjuntosAdmin.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {adjuntosAdmin.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between rounded bg-white/5 border border-white/10 px-3 py-2 text-xs"
                      >
                        <span className="text-gray-200 truncate pr-3">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAdjunto(index)}
                          className="text-red-300 hover:text-red-200"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Fecha Programada *
                </label>
                <input
                  type="date"
                  name="fecha_programada"
                  value={formData.fecha_programada}
                  onChange={handleChange}
                  min={today}
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    errors.fecha_programada ? 'border-red-500' : 'border-white/20'
                  } rounded-lg text-white focus:outline-none focus:border-blue-500`}
                />
                {errors.fecha_programada && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.fecha_programada}
                  </p>
                )}
                {formData.fecha_programada && (
                  <p className="text-gray-400 text-xs mt-1">
                    Fecha seleccionada: {formatDate(formData.fecha_programada)}
                  </p>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Hora Programada *
                </label>
                <select
                  name="hora_programada"
                  value={formData.hora_programada}
                  onChange={handleChange}
                  disabled={!formData.fecha_programada || cargandoDisponibilidad}
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    errors.hora_programada ? 'border-red-500' : 'border-white/20'
                  } rounded-lg text-white focus:outline-none focus:border-blue-500`}
                >
                    <option value="">
                      {formData.fecha_programada ? 'Selecciona un horario' : 'Primero selecciona fecha'}
                    </option>
                  {(slotsAgenda.length > 0
                    ? slotsAgenda
                    : HALF_HOUR_SLOTS.map((hora) => ({ hora, disponible: true }))
                  ).map((slot) => (
                    <option key={slot.hora} value={slot.hora}>
                      {slot.hora}
                      {!slot.disponible ? ' - Ocupado' : ''}
                    </option>
                  ))}
                </select>
                {errors.hora_programada && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.hora_programada}
                  </p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Bloques de 30 minutos. Los horarios ocupados se muestran como "Ocupado"; puedes forzar solo si tienes permiso administrativo.
                </p>
                {cargandoDisponibilidad && (
                  <p className="text-cyan-300 text-xs mt-1">Cargando disponibilidad...</p>
                )}
              </div>

              {(() => {
                const slotSeleccionado = slotsAgenda.find((slot) => slot.hora === formData.hora_programada);
                if (!slotSeleccionado || slotSeleccionado.disponible) return null;
                return (
                  <div className="md:col-span-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="text-amber-200 text-sm font-semibold">
                      El horario seleccionado ya esta ocupado.
                    </p>
                    <label className="mt-2 flex items-center gap-2 text-xs text-amber-100">
                      <input
                        type="checkbox"
                        checked={forzarHorarioOcupado}
                        onChange={(e) => setForzarHorarioOcupado(e.target.checked)}
                      />
                      Permitir sobrecupo y agendar de todos modos (con advertencia)
                    </label>
                  </div>
                );
              })()}

              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 block">
                  Categoria de taller
                </label>
                <select
                  name="taller"
                  value={formData.taller}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-white/20 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Seleccionar categoria (opcional)...</option>
                  {categoriasTaller.map((categoria) => (
                    <option key={categoria.value} value={categoria.value}>
                      {categoria.label}
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  Usa categorias estandar para trazabilidad operativa.
                </p>
              </div>

              {formData.taller === 'Otro' && (
                <div className="md:col-span-2">
                  <label className="text-gray-400 text-sm mb-2 block">
                    Descripcion de taller
                  </label>
                  <input
                    type="text"
                    name="taller_otro_detalle"
                    value={formData.taller_otro_detalle}
                    onChange={handleChange}
                    placeholder="Ej. Taller externo especializado en..."
                    className={`w-full px-4 py-3 bg-white/10 border ${
                      errors.taller_otro_detalle ? 'border-red-500' : 'border-white/20'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500`}
                  />
                  {errors.taller_otro_detalle && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.taller_otro_detalle}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Kilometraje al Servicio *
                </label>
                <input
                  type="number"
                  name="kilometraje_servicio"
                  value={formData.kilometraje_servicio}
                  onChange={handleChange}
                  placeholder="0"
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    errors.kilometraje_servicio ? 'border-red-500' : 
                    desdeSiniestro && formData.kilometraje_servicio ? 'border-green-500/50 bg-green-500/5' : 'border-white/20'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500`}
                />
                {errors.kilometraje_servicio && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.kilometraje_servicio}
                  </p>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Próximo Servicio (KM)
                </label>
                <input
                  type="number"
                  name="proximo_servicio_km"
                  value={formData.proximo_servicio_km}
                  onChange={handleChange}
                  placeholder="Auto-calculado"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Se calcula automáticamente (+10,000 km)
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 block">
                  Monto Estimado (opcional)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    name="monto_estimado"
                    value={formData.monto_estimado}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    className={`w-full pl-10 pr-4 py-3 bg-white/10 border ${
                      desdeSiniestro && formData.monto_estimado ? 'border-green-500/50 bg-green-500/5' : 'border-white/20'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500`}
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Costo aproximado del servicio (se actualizará al completar)
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 block">
                  Observaciones
                  {desdeSiniestro && formData.observaciones && (
                    <span className="ml-2 text-xs text-green-400">
                      (Cargadas desde siniestro)
                    </span>
                  )}
                </label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Detalles adicionales del servicio..."
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    desdeSiniestro && formData.observaciones ? 'border-green-500/50 bg-green-500/5' : 'border-white/20'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none`}
                />
              </div>
            </div>
          </div>

          {/* Resumen */}
          {formData.vehiculo_id && formData.tipo_servicio && formData.fecha_programada && (
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-400" />
                Resumen del Mantenimiento
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 mb-1">Vehículo:</p>
                  <p className="text-white font-semibold">
                    {vehiculoSeleccionado?.numero_vehiculo}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Servicio:</p>
                  <p className="text-white font-semibold">
                    {formData.tipo_servicio}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Fecha:</p>
                  <p className="text-white font-semibold">
                    {formatDate(formData.fecha_programada)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Hora:</p>
                  <p className="text-white font-semibold">
                    {formData.hora_programada}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Taller:</p>
                  <p className="text-white font-semibold">
                    {formData.taller === 'Otro'
                      ? `Otro: ${formData.taller_otro_detalle || 'Sin descripcion'}`
                      : (formData.taller || 'Por definir')}
                  </p>
                </div>
                {formData.servicio_especial && (
                  <div>
                    <p className="text-gray-400 mb-1">Servicio especial:</p>
                    <p className="text-white font-semibold">
                      {formData.servicio_especial}
                    </p>
                  </div>
                )}
                {desdeSiniestro && (
                  <div className="col-span-2 pt-2 border-t border-white/10">
                    <p className="text-orange-400 text-xs flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Vinculado con Siniestro #{siniestroInfo?.folio}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/admin/mantenimientos')}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Programando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Programar Mantenimiento
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProgramarMantenimiento;
