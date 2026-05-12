import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Calendar,
  Car,
  Wrench,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  List,
  LayoutGrid,
  PlayCircle,
  X,
  Trash2
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';
import adminService from '@/services/adminService';
import {
  TALLER_CATEGORIAS_OPCIONES
} from '@/constants/mantenimiento';
import {
  formatMaintenanceDate,
  formatMaintenanceTime,
  toMaintenanceDateInputValue,
  toMaintenanceTimeInputValue
} from '@/utils/maintenanceDateFormat';

const HALF_HOUR_SLOTS = (() => {
  const slots = [];
  for (let h = 9; h <= 18; h += 1) {
    const hh = String(h).padStart(2, '0');
    slots.push(`${hh}:00`);
    slots.push(`${hh}:30`);
  }
  return slots;
})();

const MAX_ADMIN_ADJUNTOS = 6;
const MAX_ADMIN_ADJUNTO_SIZE_BYTES = 10 * 1024 * 1024;
const KANBAN_FETCH_LIMIT = 1000;
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

const MantenimientosLista = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  
  const [mantenimientos, setMantenimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState('kanban'); // 'lista' o 'kanban'
  
  const [filtros, setFiltros] = useState({
    search: '',
    estado: '',
    tipo_servicio: '',
    vehiculo_id: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  
  const [opciones, setOpciones] = useState({
    vehiculos: [],
    tipos_servicio: [],
    estados: [],
    categorias_taller: []
  });

  // Modales
  const [modalDetalle, setModalDetalle] = useState({ open: false, data: null });
  const [modalCompletar, setModalCompletar] = useState({ open: false, data: null });
  const [completarKmActual, setCompletarKmActual] = useState('');
  const [completarProximoKm, setCompletarProximoKm] = useState('');
  const [completarTallerCategoria, setCompletarTallerCategoria] = useState('');
  const [completarTallerOtroDetalle, setCompletarTallerOtroDetalle] = useState('');
  const [adjuntosCompletar, setAdjuntosCompletar] = useState([]);
  const [modalReprogramar, setModalReprogramar] = useState({
    open: false,
    id: null,
    folio: null,
    vehiculo: '',
    tipo_servicio: '',
    fecha_programada: '',
    hora_programada: '',
    forzar_horario_ocupado: false,
    loading: false
  });
  const [slotsReprogramacion, setSlotsReprogramacion] = useState([]);
  const [cargandoSlotsReprogramacion, setCargandoSlotsReprogramacion] = useState(false);

  // 🔥 MEJORA #2: Leer filtros desde URL al cargar
  useEffect(() => {
    const estadoURL = searchParams.get('estado');
    if (estadoURL) {
      setFiltros(prev => ({ ...prev, estado: estadoURL }));
    }
  }, [searchParams]);

  useEffect(() => {
    cargarOpciones();
    cargarMantenimientos();
  }, [pagination.page, filtros, vistaActual]);

  useEffect(() => {
    let isMounted = true;

    const cargarDisponibilidadAgenda = async () => {
      if (!modalReprogramar.open || !modalReprogramar.fecha_programada) {
        if (isMounted) {
          setSlotsReprogramacion([]);
          setCargandoSlotsReprogramacion(false);
        }
        return;
      }

      try {
        if (isMounted) setCargandoSlotsReprogramacion(true);
        const response = await adminService.getDisponibilidadAgendaMantenimientos(
          modalReprogramar.fecha_programada,
          modalReprogramar.id
        );
        const slots = Array.isArray(response?.slots) ? response.slots : [];

        if (!isMounted) return;
        setSlotsReprogramacion(slots);
      } catch (error) {
        if (!isMounted) return;
        console.error('Error cargando disponibilidad para reprogramacion:', error);
        setSlotsReprogramacion([]);
      } finally {
        if (isMounted) setCargandoSlotsReprogramacion(false);
      }
    };

    cargarDisponibilidadAgenda();

    return () => {
      isMounted = false;
    };
  }, [modalReprogramar.open, modalReprogramar.fecha_programada, modalReprogramar.id]);

  useEffect(() => {
    const selectedSlot = slotsReprogramacion.find((slot) => slot.hora === modalReprogramar.hora_programada);
    if (!selectedSlot || selectedSlot.disponible) {
      setModalReprogramar((prev) => ({ ...prev, forzar_horario_ocupado: false }));
    }
  }, [slotsReprogramacion, modalReprogramar.hora_programada]);

  const fetchWithTokenRefresh = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    const refreshedToken = response.headers.get('x-refreshed-token');
    if (refreshedToken) {
      localStorage.setItem('token', refreshedToken);
    }

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Sesión expirada');
    }

    return response;
  };

  const cargarOpciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetchWithTokenRefresh(`${API_BASE_URL}/admin/mantenimientos/opciones`, {
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

  const cargarMantenimientos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const pageToRequest = vistaActual === 'kanban' ? 1 : pagination.page;
      const limitToRequest = vistaActual === 'kanban' ? KANBAN_FETCH_LIMIT : pagination.limit;
      const filtrosParaConsulta = Object.fromEntries(
        Object.entries(filtros).filter(([key, value]) => {
          if (value === '') return false;
          if (vistaActual === 'kanban' && key === 'estado') return false;
          return true;
        })
      );
      
      const params = new URLSearchParams({
        page: pageToRequest,
        limit: limitToRequest,
        ...filtrosParaConsulta
      });

      const response = await fetchWithTokenRefresh(
        `${API_BASE_URL}/admin/mantenimientos?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setMantenimientos(data.mantenimientos);
        setPagination(prev => ({
          ...prev,
          page: pageToRequest,
          limit: limitToRequest,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error al cargar mantenimientos:', error);
    } finally {
      setLoading(false);
    }
  };

const getEstadoBadge = (estado, statusReal, estadoUi) => {
    // 🟢 1. REGLA DE ORO: Si está Cancelado, se muestra Cancelado (ignoramos fechas/urgencias)
    if (estado === 'Cancelado') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-slate-500/20 text-slate-400 border-slate-500/30 line-through decoration-slate-500/50">
          Cancelado
        </span>
      );
    }

    // Configuración de colores para el resto de estados
    const badges = {
      'Vencido': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Urgente': 'bg-amber-500/20 text-amber-400 border-amber-500/30', // Cambié a amber (naranja) para diferenciar de amarillo chillante
      'Próximo': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      'Proximo': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      'Completado': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Cancelado': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      'Programado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'En proceso': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Reprogramado': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      'Pendiente': 'bg-slate-500/20 text-slate-300 border-slate-500/30' // Agregué pendiente por si acaso
    };
    
    // Si ya está en flujo operativo, ese estado manda (no sobreescribir por fecha)
    const displayEstado = String(estadoUi || estado || statusReal || 'Programado');
    const badgeClass = badges[displayEstado] || badges['Programado'];
    
    return (
      <span className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold leading-none border ${badgeClass}`}>
        {displayEstado}
      </span>
    );
  };

  const getKmExcesoServicio = (mant) => {
    const kmExceso = Number(mant?.km_exceso_servicio || 0);
    return Number.isFinite(kmExceso) ? Math.max(kmExceso, 0) : 0;
  };

  const isPrioridadKmVencido = (mant) => {
    const prioridad = Number(mant?.prioridad_km_vencido || 0);
    return prioridad === 1 || getKmExcesoServicio(mant) > 0;
  };

  const getKmVencidoBadge = (mant, { compact = false } = {}) => {
    if (!isPrioridadKmVencido(mant)) return null;
    const kmExceso = getKmExcesoServicio(mant);
    const kmTexto = kmExceso.toLocaleString('es-MX');
    return (
      <span
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-200 ${
          compact ? 'px-2 py-0.5 text-[10px] font-semibold' : 'px-2.5 py-1 text-xs font-semibold'
        }`}
      >
        {`Vencido por KM +${kmTexto} km`}
      </span>
    );
  };

  const normalizeEstado = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\s]+/g, '');

  const puedeProgramarse = (mant) => {
    const estado = normalizeEstado(mant?.estado);
    const statusReal = normalizeEstado(mant?.status_real);

    if (['completado', 'cancelado', 'enproceso', 'programado', 'reprogramado'].includes(estado)) {
      return false;
    }

    if (['pendiente', 'solicitado'].includes(estado)) {
      return true;
    }

    return ['urgente', 'proximo', 'pendiente'].includes(statusReal);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return formatMaintenanceDate(date, { fallback: '-', month: 'short' });
  };

  const formatTime = (date) => {
    return formatMaintenanceTime(date, { fallback: '-' });
  };

  const toDateInputValue = (value) => {
    return toMaintenanceDateInputValue(value, '');
  };

  const toTimeInputValue = (value) => {
    return toMaintenanceTimeInputValue(value, '');
  };

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (_error) {
      return {};
    }
  })();
  const userRole = String(user?.rol || user?.role || '').trim().toLowerCase();
  const normalizedUserRole = userRole.replace(/\s+/g, '_');
  const canReprogramar = [
    'super_admin',
    'direccion',
    'director',
    'gerente_ops',
    'finanzas',
    'jefe_taller',
    'compras'
  ].includes(normalizedUserRole);
  const canEliminarMantenimiento = [
    'super_admin',
    'direccion',
    'director',
    'gerente',
    'gerente_ops',
    'finanzas',
    'jefe_taller',
    'jefe_de_taller'
  ].includes(normalizedUserRole);

  const categoriasTaller = (() => {
    const raw = Array.isArray(opciones?.categorias_taller) ? opciones.categorias_taller : [];
    const mapped = raw
      .map((item) => {
        if (typeof item === 'string') {
          const value = item.trim();
          return value ? { value, label: value } : null;
        }
        const value = String(item?.value || item?.label || '').trim();
        if (!value) return null;
        return { value, label: String(item?.label || value).trim() };
      })
      .filter(Boolean);

    return mapped.length > 0 ? mapped : TALLER_CATEGORIAS_OPCIONES;
  })();

  const mapTallerToCategoria = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return { categoria: '', detalle: '' };

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

  const cerrarModalCompletar = () => {
    setModalCompletar({ open: false, data: null });
    setAdjuntosCompletar([]);
    setCompletarTallerCategoria('');
    setCompletarTallerOtroDetalle('');
  };

  const handleFiltroChange = (key, value) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      search: '',
      estado: '',
      tipo_servicio: '',
      vehiculo_id: '',
      fecha_desde: '',
      fecha_hasta: ''
    });
  };

  // 🔥 MEJORA #4: Filtros Rápidos
  const aplicarFiltroRapido = (estado) => {
    setFiltros(prev => ({ ...prev, estado }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const puedeReagendar = (mant) => {
    const estado = normalizeEstado(mant?.estado);
    return !['completado', 'cancelado'].includes(estado);
  };

  const handleAbrirReprogramar = (mant) => {
    if (!canReprogramar) {
      alert('No tienes permisos para reprogramar mantenimientos');
      return;
    }
    if (!puedeReagendar(mant)) {
      alert('Este mantenimiento ya no se puede reprogramar');
      return;
    }

    setModalReprogramar({
      open: true,
      id: mant.id,
      folio: mant.folio_servicio,
      vehiculo: mant.numero_vehiculo || '-',
      tipo_servicio: mant.tipo_servicio || '-',
      fecha_programada: toDateInputValue(mant.fecha_programada),
      hora_programada: toTimeInputValue(mant.fecha_programada),
      forzar_horario_ocupado: false,
      loading: false
    });
  };

  const handleCerrarModalReprogramar = () => {
    setSlotsReprogramacion([]);
    setCargandoSlotsReprogramacion(false);
    setModalReprogramar({
      open: false,
      id: null,
      folio: null,
      vehiculo: '',
      tipo_servicio: '',
      fecha_programada: '',
      hora_programada: '',
      forzar_horario_ocupado: false,
      loading: false
    });
  };

  const handleGuardarReprogramacion = async () => {
    if (!modalReprogramar.id || !modalReprogramar.fecha_programada || !modalReprogramar.hora_programada) {
      alert('Selecciona una fecha y hora válidas');
      return;
    }
    const fechaHoraReprogramada = new Date(`${modalReprogramar.fecha_programada}T${modalReprogramar.hora_programada}:00`);
    if (Number.isNaN(fechaHoraReprogramada.getTime())) {
      alert('Selecciona una fecha y hora válidas');
      return;
    }
    if (fechaHoraReprogramada < new Date()) {
      alert('La fecha y hora programadas no pueden estar en el pasado');
      return;
    }

    const slotSeleccionado = slotsReprogramacion.find((slot) => slot.hora === modalReprogramar.hora_programada);
    if (slotSeleccionado && !slotSeleccionado.disponible && !modalReprogramar.forzar_horario_ocupado) {
      alert('Ese bloque de 30 minutos ya está ocupado. Activa sobrecupo para continuar.');
      return;
    }

    try {
      setModalReprogramar((prev) => ({ ...prev, loading: true }));
      const token = localStorage.getItem('token');
      const response = await fetchWithTokenRefresh(`${API_BASE_URL}/admin/mantenimientos/${modalReprogramar.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fecha_programada: modalReprogramar.fecha_programada,
          hora_programada: modalReprogramar.hora_programada,
          forzar_horario_ocupado: Boolean(modalReprogramar.forzar_horario_ocupado)
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'No se pudo reprogramar');
      }

      alert('✅ Mantenimiento reprogramado correctamente');
      handleCerrarModalReprogramar();
      await cargarMantenimientos();
    } catch (error) {
      console.error('Error reprogramando mantenimiento:', error);
      alert(`❌ ${error.message || 'Error de conexión'}`);
      setModalReprogramar((prev) => ({ ...prev, loading: false }));
    }
  };

  // 🔥 NUEVO: Ingresar a Taller
  const handleIngresarTaller = async (mant) => {
    if (!confirm(`¿Ingresar vehículo ${mant.numero_vehiculo} a taller?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetchWithTokenRefresh(`${API_BASE_URL}/admin/mantenimientos/${mant.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: 'En proceso' })
      });

      const data = await response.json();

      if (data.success) {
        if (normalizeEstado(filtros.estado) === 'programado') {
          const estadoDestino = 'En proceso';
          setFiltros((prev) => ({ ...prev, estado: estadoDestino }));
          setPagination((prev) => ({ ...prev, page: 1 }));
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set('estado', estadoDestino);
          setSearchParams(nextParams, { replace: true });
          alert('✅ Movido a En proceso. Se actualizó el filtro para mostrar la nueva columna.');
          return;
        }

        await cargarMantenimientos(); // 🔥 Recarga sin alert
      } else {
        alert('❌ Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al ingresar a taller');
    }
  };

  const handleConfirmarProgramado = async (mant, forzarHorarioOcupado = false) => {
    if (!forzarHorarioOcupado) {
      if (!confirm(`¿Confirmar mantenimiento #${String(mant.folio_servicio).padStart(4, '0')} y enviarlo a Programado?`)) return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetchWithTokenRefresh(`${API_BASE_URL}/admin/mantenimientos/${mant.id}/confirmar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
          },
        body: JSON.stringify({
          forzar_horario_ocupado: Boolean(forzarHorarioOcupado)
        })
      });

      const data = await response.json();
      if (data.success) {
        await cargarMantenimientos();
        return;
      }

      if (response.status === 409 && data?.puede_forzar && !forzarHorarioOcupado) {
        const deseaForzar = confirm(
          `${data.message}\n\n¿Deseas confirmar de todos modos con sobrecupo?`
        );
        if (deseaForzar) {
          await handleConfirmarProgramado(mant, true);
        }
        return;
      }

      alert(`❌ ${data.message || 'No se pudo confirmar el mantenimiento'}`);
    } catch (error) {
      console.error('Error al confirmar mantenimiento:', error);
      alert('❌ Error al confirmar mantenimiento');
    }
  };

  const handleEliminarMantenimiento = async (mant) => {
    if (!canEliminarMantenimiento) {
      alert('No tienes permisos para eliminar mantenimientos');
      return;
    }
    if (!confirm(`¿Eliminar el mantenimiento #${String(mant?.folio_servicio || mant?.id || 0).padStart(4, '0')}? Esta accion no se puede deshacer.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetchWithTokenRefresh(`${API_BASE_URL}/admin/mantenimientos/${mant.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        await cargarMantenimientos();
        return;
      }

      alert(`❌ ${data.message || 'No se pudo eliminar el mantenimiento'}`);
    } catch (error) {
      console.error('Error al eliminar mantenimiento:', error);
      alert('❌ Error al eliminar mantenimiento');
    }
  };

  // 🔥 MEJORA #3: Modal Ver Detalle
  const abrirModalDetalle = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetchWithTokenRefresh(`${API_BASE_URL}/admin/mantenimientos/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setModalDetalle({ open: true, data: data.mantenimiento });
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al cargar detalle');
    }
  };

  // 🔥 MEJORA #3: Modal Completar
    const handleAdjuntosCompletarChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const merged = [...adjuntosCompletar, ...files];
    if (merged.length > MAX_ADMIN_ADJUNTOS) {
      alert(`Solo puedes adjuntar hasta ${MAX_ADMIN_ADJUNTOS} archivos`);
      event.target.value = '';
      return;
    }

    for (const file of files) {
      const mime = String(file.type || '').toLowerCase();
      if (!ALLOWED_ADMIN_ADJUNTO_MIME_TYPES.has(mime)) {
        alert('Solo se permiten archivos JPG, PNG, WEBP, HEIC o PDF');
        event.target.value = '';
        return;
      }
      if (file.size > MAX_ADMIN_ADJUNTO_SIZE_BYTES) {
        alert(`El archivo "${file.name}" supera el limite de 10MB`);
        event.target.value = '';
        return;
      }
    }

    setAdjuntosCompletar(merged);
    event.target.value = '';
  };

  const removeAdjuntoCompletar = (index) => {
    setAdjuntosCompletar((prev) => prev.filter((_, i) => i !== index));
  };
const calcularProximoServicioKm = (kmActualValue) => {
  const km = parseInt(kmActualValue, 10);
  if (Number.isNaN(km) || km < 0) return '';
  const siguiente = Math.ceil(km / 10000) * 10000;
  return siguiente === km ? km + 10000 : siguiente;
};

const abrirModalCompletar = (mant) => {
  const kmActual = Number(mant.km_actual_vehiculo || mant.kilometraje_servicio || 0);
  const kmActualValue = Number.isFinite(kmActual) ? String(kmActual) : '';
  setCompletarKmActual(kmActualValue);
  setCompletarProximoKm(calcularProximoServicioKm(kmActualValue));
  const tallerMap = mapTallerToCategoria(mant.taller);
  setCompletarTallerCategoria(tallerMap.categoria);
  setCompletarTallerOtroDetalle(tallerMap.detalle);

  setModalCompletar({ 
    open: true, 
    data: {
      id: mant.id,
      folio: mant.folio_servicio,
      vehiculo: `${mant.numero_vehiculo} - ${mant.marca} ${mant.modelo}`,
      vehiculo_id: mant.vehiculo_id,
      kilometraje_actual: kmActualValue,
      proximo_servicio_km: mant.proximo_servicio_km || '',
      costo_total: mant.costo_total || 0,
      taller: mant.taller || '',
      tipo_servicio: mant.tipo_servicio || '',
      mecanico: mant.mecanico || '',
      observaciones: mant.observaciones || ''
    }
  });
  setAdjuntosCompletar([]);
};

 const completarMantenimiento = async (e) => {
  e.preventDefault();
  const form = e.target;

  const costoTotal = parseFloat(form.costo_total.value);
  const tallerCategoria = String(form.taller.value || '').trim();
  const tallerOtroDetalle = String(form.taller_otro_detalle?.value || '').trim();

  if (!tallerCategoria) {
    alert('⚠️ Debes seleccionar una categoria de taller');
    return;
  }

  if (tallerCategoria === 'Otro' && !tallerOtroDetalle) {
    alert('⚠️ Debes capturar la descripcion del taller cuando seleccionas "Otro"');
    return;
  }

  const payload = new FormData();
  payload.append('kilometraje_servicio', String(parseInt(form.kilometraje_actual.value, 10)));
  payload.append('proximo_servicio_km', String(parseInt(completarProximoKm, 10)));
  payload.append('costo_total', String(costoTotal));
  payload.append('taller', tallerCategoria);
  payload.append('taller_otro_detalle', tallerCategoria === 'Otro' ? tallerOtroDetalle : '');
  payload.append('mecanico', form.mecanico.value || '');
  payload.append('observaciones_final', form.observaciones.value || '');
  payload.append('fecha_realizada', new Date().toISOString().split('T')[0]);
  adjuntosCompletar.forEach((file) => payload.append('adjuntos_admin', file));

  try {
    const token = localStorage.getItem('token');
    const response = await fetchWithTokenRefresh(
      `${API_BASE_URL}/admin/mantenimientos/${modalCompletar.data.id}/completar`,
      {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          },
        body: payload
      }
    );

    const data = await response.json();
    
    if (data.success) {
      alert('✅ Mantenimiento completado. La distribucion de gastos se registra por separado.');
      cerrarModalCompletar();
      await cargarMantenimientos();
    } else {
      alert('❌ Error: ' + data.message);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error al completar mantenimiento');
  }
};

  // 🔥 MEJORA #1: Vista KANBAN
  const esVencidoActual = (mant) => normalizeEstado(mant?.estado_ui) === 'vencido';

  const esUrgenteActual = (mant) => {
    return normalizeEstado(mant?.estado_ui) === 'urgente';
  };

  const columnasVacias = {
    Programado: [],
    'En proceso': [],
    Completado: [],
    Vencido: [],
    Urgente: []
  };

  const getColumnaKanban = (mant) => {
    const estadoUi = normalizeEstado(mant?.estado_ui);
    if (estadoUi === 'urgente') return 'Urgente';
    if (estadoUi === 'vencido') return 'Vencido';
    if (estadoUi === 'programado') return 'Programado';
    if (estadoUi === 'enproceso') return 'En proceso';
    if (estadoUi === 'completado') return 'Completado';
    return 'Programado';
  };

  // Vista KANBAN (clasificacion exclusiva: cada mantenimiento cae en una sola columna)
  const mantenimientosPorEstado = mantenimientos.reduce((acc, mant) => {
    const columna = getColumnaKanban(mant);
    acc[columna].push(mant);
    return acc;
  }, {
    Programado: [],
    'En proceso': [],
    Completado: [],
    Vencido: [],
    Urgente: []
  });
  const filtroEstadoNormalizado = normalizeEstado(filtros.estado);
  const columnasKanban = (() => {
    if (filtroEstadoNormalizado === 'urgente') {
      return { ...columnasVacias, Urgente: mantenimientosPorEstado.Urgente };
    }
    if (filtroEstadoNormalizado === 'vencido') {
      return { ...columnasVacias, Vencido: mantenimientosPorEstado.Vencido };
    }
    if (filtroEstadoNormalizado === 'programado') {
      return { ...columnasVacias, Programado: mantenimientosPorEstado.Programado };
    }
    if (filtroEstadoNormalizado === 'enproceso') {
      return { ...columnasVacias, 'En proceso': mantenimientosPorEstado['En proceso'] };
    }
    if (filtroEstadoNormalizado === 'completado') {
      return { ...columnasVacias, Completado: mantenimientosPorEstado.Completado };
    }
    return mantenimientosPorEstado;
  })();
  const mantenimientosVisibles = filtroEstadoNormalizado === 'vencido'
    ? mantenimientos.filter(esVencidoActual)
    : filtroEstadoNormalizado === 'urgente'
      ? columnasKanban.Urgente
      : mantenimientos;

  const TarjetaMantenimiento = ({ mant }) => (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 hover:bg-white/15 transition-all mb-3">
      <div className="flex justify-between items-start mb-2">
        <span className="text-white font-mono text-sm">
          #{String(mant.folio_servicio).padStart(4, '0')}
        </span>
        <div className="flex flex-col items-end gap-1">
          {getEstadoBadge(mant.estado, mant.status_real, mant.estado_ui)}
          {getKmVencidoBadge(mant, { compact: true })}
        </div>
      </div>
      
      <div className="mb-3">
        <p className="text-white font-semibold">{mant.numero_vehiculo}</p>
        <p className="text-gray-400 text-xs">{mant.marca} {mant.modelo}</p>
      </div>

      <div className="space-y-1 mb-3">
        <p className="text-gray-300 text-sm">{mant.tipo_servicio}</p>
        {mant.detalle_fuera_programacion && (
          <p className="text-amber-300 text-xs">
            Detalle especial: {mant.detalle_fuera_programacion}
          </p>
        )}
        {mant.servicio_especial && (
          <p className="text-purple-300 text-xs">
            Servicio especial: {mant.servicio_especial}
          </p>
        )}
        {mant.refacciones && (
          <p className="text-cyan-300 text-xs">
            Refacciones: {mant.refacciones}
          </p>
        )}
        <p className="text-gray-400 text-xs">
          📅 {formatDate(mant.fecha_programada)}
        </p>
        {mant.nombre_conductor && (
          <p className="text-gray-400 text-xs">👤 {mant.nombre_conductor}</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <span className="text-white font-semibold text-sm">
          {formatCurrency(mant.costo_total)}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => abrirModalDetalle(mant.id)}
            className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-all"
            title="Ver"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          
          {mant.estado === 'Programado' && (
            <button
              onClick={() => handleIngresarTaller(mant)}
              className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded transition-all"
              title="Ingresar a Taller"
            >
              <PlayCircle className="w-3.5 h-3.5" />
            </button>
          )}
          
          {mant.estado === 'En proceso' && (
            <button
              onClick={() => abrirModalCompletar(mant)}
              className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-all"
              title="Completar"
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {canEliminarMantenimiento && (
            <button
              onClick={() => handleEliminarMantenimiento(mant)}
              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-all"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#07425E] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate('/admin/mantenimientos')}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">
                Lista de Mantenimientos
              </h1>
              <p className="text-sm sm:text-base text-gray-400">
                {pagination.total} mantenimiento(s) registrado(s)
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full lg:w-auto">
            {/* 🔥 Toggle Vista Lista/Kanban */}
            <div className="flex bg-white/10 rounded-lg p-1 w-full">
              <button
                onClick={() => {
                  setVistaActual('lista');
                  setPagination(prev => ({ ...prev, page: 1, limit: 50 }));
                }}
                className={`flex-1 px-3 py-2 rounded flex items-center justify-center gap-2 text-sm transition-all ${
                  vistaActual === 'lista' 
                    ? 'bg-white/20 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                Lista
              </button>
              <button
                onClick={() => {
                  setVistaActual('kanban');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className={`flex-1 px-3 py-2 rounded flex items-center justify-center gap-2 text-sm transition-all ${
                  vistaActual === 'kanban' 
                    ? 'bg-white/20 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Tablero
              </button>
            </div>

            <button
              onClick={() => navigate('/admin/mantenimientos/programar')}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2 w-full"
            >
              <Calendar className="w-4 h-4" />
              Programar
            </button>
          </div>
        </div>

        {/* Filtros Rapidos */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <button
            onClick={() => aplicarFiltroRapido('')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filtros.estado === ''
                ? 'bg-white/20 text-white border border-white/30'
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => aplicarFiltroRapido('Urgente')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filtros.estado === 'Urgente'
                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            Urgentes
          </button>
          <button
            onClick={() => aplicarFiltroRapido('Programado')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filtros.estado === 'Programado'
                ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            Programado
          </button>
          <button
            onClick={() => aplicarFiltroRapido('En proceso')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filtros.estado === 'En proceso'
                ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            En Proceso
          </button>
          <button
            onClick={() => aplicarFiltroRapido('Completado')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filtros.estado === 'Completado'
                ? 'bg-green-500/30 text-green-400 border border-green-500/50'
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            Completados
          </button>
          <button
            onClick={() => aplicarFiltroRapido('Vencido')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filtros.estado === 'Vencido'
                ? 'bg-red-500/30 text-red-400 border border-red-500/50'
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            Vencidos
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros Avanzados
            </h3>
            <button
              onClick={limpiarFiltros}
              className="text-sm text-gray-400 hover:text-white transition-all flex items-center gap-1 self-start sm:self-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Limpiar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Búsqueda */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={filtros.search}
                  onChange={(e) => handleFiltroChange('search', e.target.value)}
                  placeholder="Vehículo, conductor, taller..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Tipo de Servicio */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Tipo de Servicio</label>
              <select
                value={filtros.tipo_servicio}
                onChange={(e) => handleFiltroChange('tipo_servicio', e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Todos</option>
                {opciones.tipos_servicio.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>

            {/* Fecha Desde */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Fecha Desde</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) => handleFiltroChange('fecha_desde', e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Fecha Hasta */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Fecha Hasta</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={(e) => handleFiltroChange('fecha_hasta', e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Vehículo */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Vehículo</label>
              <select
                value={filtros.vehiculo_id}
                onChange={(e) => handleFiltroChange('vehiculo_id', e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Todos</option>
                {opciones.vehiculos.map(vehiculo => (
                  <option key={vehiculo.id} value={vehiculo.id}>
                    {vehiculo.numero_vehiculo} - {vehiculo.marca} {vehiculo.modelo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 🔥 VISTA KANBAN */}
        {vistaActual === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
            {/* Columna URGENTE */}
            <div className="bg-amber-900/20 backdrop-blur-sm rounded-xl border border-amber-500/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                  Urgente
                </h3>
                <span className="bg-amber-500/30 text-amber-300 px-3 py-1 rounded-full text-sm font-bold">
                  {columnasKanban.Urgente.length}
                </span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                {columnasKanban.Urgente.map(mant => (
                  <TarjetaMantenimiento key={mant.id} mant={mant} />
                ))}
                {columnasKanban.Urgente.length === 0 && (
                  <p className="text-gray-400 text-center py-8">No hay mantenimientos urgentes</p>
                )}
              </div>
            </div>

            {/* Columna PROGRAMADO */}
            <div className="bg-blue-900/20 backdrop-blur-sm rounded-xl border border-blue-500/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Programado
                </h3>
                <span className="bg-blue-500/30 text-blue-400 px-3 py-1 rounded-full text-sm font-bold">
                  {columnasKanban.Programado.length}
                </span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                {columnasKanban.Programado.map(mant => (
                  <TarjetaMantenimiento key={mant.id} mant={mant} />
                ))}
                {columnasKanban.Programado.length === 0 && (
                  <p className="text-gray-400 text-center py-8">No hay mantenimientos programados</p>
                )}
              </div>
            </div>

            {/* Columna EN PROCESO */}
            <div className="bg-purple-900/20 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-purple-400" />
                  En Proceso
                </h3>
                <span className="bg-purple-500/30 text-purple-400 px-3 py-1 rounded-full text-sm font-bold">
                  {columnasKanban['En proceso'].length}
                </span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                {columnasKanban['En proceso'].map(mant => (
                  <TarjetaMantenimiento key={mant.id} mant={mant} />
                ))}
                {columnasKanban['En proceso'].length === 0 && (
                  <p className="text-gray-400 text-center py-8">No hay mantenimientos en proceso</p>
                )}
              </div>
            </div>

            {/* Columna COMPLETADO */}
            <div className="bg-green-900/20 backdrop-blur-sm rounded-xl border border-green-500/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Completado
                </h3>
                <span className="bg-green-500/30 text-green-400 px-3 py-1 rounded-full text-sm font-bold">
                  {columnasKanban.Completado.length}
                </span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                {columnasKanban.Completado.map(mant => (
                  <TarjetaMantenimiento key={mant.id} mant={mant} />
                ))}
                {columnasKanban.Completado.length === 0 && (
                  <p className="text-gray-400 text-center py-8">No hay mantenimientos completados</p>
                )}
              </div>
            </div>

            {/* Columna VENCIDO */}
            <div className="bg-red-900/20 backdrop-blur-sm rounded-xl border border-red-500/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  Vencido
                </h3>
                <span className="bg-red-500/30 text-red-300 px-3 py-1 rounded-full text-sm font-bold">
                  {columnasKanban.Vencido.length}
                </span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                {columnasKanban.Vencido.map(mant => (
                  <TarjetaMantenimiento key={mant.id} mant={mant} />
                ))}
                {columnasKanban.Vencido.length === 0 && (
                  <p className="text-gray-400 text-center py-8">No hay mantenimientos vencidos</p>
                )}
              </div>
            </div>

          </div>
        ) : (
          /* VISTA LISTA (Tabla Original) */
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-white">Cargando...</div>
              </div>
            ) : mantenimientosVisibles.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Wrench className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold text-white mb-2">
                  No hay mantenimientos
                </p>
                <p className="text-sm">
                  Intenta ajustar los filtros o programa el primer mantenimiento
                </p>
              </div>
            ) : (
              <>
            <div className="md:hidden p-3 space-y-3">
              {mantenimientosVisibles.map((mant) => (
                <div key={`mobile-mant-${mant.id}`} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white font-mono text-xs">#{String(mant.folio_servicio).padStart(4, '0')}</p>
                      <p className="text-white font-semibold text-sm">{mant.numero_vehiculo}</p>
                      <p className="text-gray-400 text-xs">{mant.marca} {mant.modelo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getEstadoBadge(mant.estado, mant.status_real, mant.estado_ui)}
                      {getKmVencidoBadge(mant, { compact: true })}
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm break-words">{mant.tipo_servicio || 'Sin especificar'}</p>
                  {mant.detalle_fuera_programacion && (
                    <p className="text-amber-300 text-xs break-words">Detalle especial: {mant.detalle_fuera_programacion}</p>
                  )}
                  {mant.servicio_especial && (
                    <p className="text-purple-300 text-xs break-words">Servicio especial: {mant.servicio_especial}</p>
                  )}
                  {mant.refacciones && (
                    <p className="text-cyan-300 text-xs break-words">Refacciones: {mant.refacciones}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-gray-400">Fecha: <span className="text-white">{formatDate(mant.fecha_programada)}</span></p>
                    <p className="text-gray-400 text-right">Costo: <span className="text-white font-semibold">{formatCurrency(mant.costo_total)}</span></p>
                  </div>
                  <p className="text-gray-400 text-xs">
                    Conductor: <span className="text-white">{mant.nombre_conductor || 'Sin asignar'}</span>
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => abrirModalDetalle(mant.id)}
                      className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all text-xs font-semibold"
                    >
                      Ver
                    </button>
                    {puedeProgramarse(mant) && (
                      <button
                        onClick={() => handleConfirmarProgramado(mant)}
                        className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-all text-xs font-semibold"
                      >
                        Aceptar
                      </button>
                    )}
                    {mant.estado === 'Programado' && (
                      <button
                        onClick={() => handleIngresarTaller(mant)}
                        className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-all text-xs font-semibold"
                      >
                        Ingresar
                      </button>
                    )}
                    {mant.estado === 'En proceso' && (
                      <button
                        onClick={() => abrirModalCompletar(mant)}
                        className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all text-xs font-semibold"
                      >
                        Completar
                      </button>
                    )}
                    {canReprogramar && puedeReagendar(mant) && (
                      <button
                        onClick={() => handleAbrirReprogramar(mant)}
                        className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg transition-all text-xs font-semibold"
                      >
                        Reagendar
                      </button>
                    )}
                    {canEliminarMantenimiento && (
                      <button
                        onClick={() => handleEliminarMantenimiento(mant)}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all text-xs font-semibold"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/*   1. Cambiamos a overflow-auto, limitamos a 60vh y ponemos la barra elegante   */}
            <div className="hidden md:block overflow-auto max-h-[60vh] sidebar-scroll border border-white/5 rounded-lg">
              
              {/*   2. Agregamos relative y un ancho mínimo de 1000px para las 8 columnas   */}
              <table className="w-full min-w-[1000px] relative">
                
                {/*   3. Fondo sólido, sticky, top-0, z-10 y una sombrita separadora   */}
                <thead className="bg-[#1a1a2e] sticky top-0 z-10 shadow-sm border-b border-white/10">
                  <tr>
                        <th className="text-left text-gray-400 text-sm font-semibold p-4">Folio</th>
                        <th className="text-left text-gray-400 text-sm font-semibold p-4">Vehículo</th>
                        <th className="text-left text-gray-400 text-sm font-semibold p-4">Conductor</th>
                        <th className="text-left text-gray-400 text-sm font-semibold p-4">Tipo Servicio</th>
                        <th className="text-center text-gray-400 text-sm font-semibold p-4">Fecha Programada</th>
                        <th className="text-center text-gray-400 text-sm font-semibold p-4 min-w-[130px]">Estado</th>
                        <th className="text-right text-gray-400 text-sm font-semibold p-4">Costo</th>
                        <th className="text-center text-gray-400 text-sm font-semibold p-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mantenimientosVisibles.map((mant) => (
                        <tr 
                          key={mant.id}
                          className="border-t border-white/5 hover:bg-white/5 transition-all"
                        >
                          <td className="p-4">
                            <span className="text-white font-mono text-sm">
                              #{String(mant.folio_servicio).padStart(4, '0')}
                            </span>
                          </td>
                          <td className="p-4">
                            <div>
                              <p className="text-white font-semibold">
                                {mant.numero_vehiculo}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {mant.marca} {mant.modelo}
                              </p>
                            </div>
                          </td>
                          <td className="p-4">
                            {mant.nombre_conductor ? (
                              <div>
                                <p className="text-white text-sm">{mant.nombre_conductor}</p>
                                <p className="text-gray-400 text-xs">{mant.conductor_telefono}</p>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-sm">Sin asignar</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div>
                              <span className="text-white text-sm">
                                {mant.tipo_servicio || 'Sin especificar'}
                              </span>
                              {mant.detalle_fuera_programacion && (
                                <p className="text-amber-300 text-xs mt-1">
                                  Detalle especial: {mant.detalle_fuera_programacion}
                                </p>
                              )}
                              {mant.servicio_especial && (
                                <p className="text-purple-300 text-xs mt-1">
                                  Servicio especial: {mant.servicio_especial}
                                </p>
                              )}
                              {mant.refacciones && (
                                <p className="text-cyan-300 text-xs mt-1">
                                  Refacciones: {mant.refacciones}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-white text-sm">
                              {formatDate(mant.fecha_programada)}
                            </span>
                          </td>
                          <td className="p-4 text-center min-w-[130px]">
                            <div className="flex flex-col items-center gap-1">
                              {getEstadoBadge(mant.estado, mant.status_real, mant.estado_ui)}
                              {getKmVencidoBadge(mant, { compact: true })}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <span className="text-white font-semibold">
                              {formatCurrency(mant.costo_total)}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => abrirModalDetalle(mant.id)}
                                className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-all"
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {puedeProgramarse(mant) && (
                                <button
                                  onClick={() => handleConfirmarProgramado(mant)}
                                  className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-all"
                                  title="Aceptar y Programar"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              
                              {mant.estado === 'Programado' && (
                                <button
                                  onClick={() => handleIngresarTaller(mant)}
                                  className="p-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-all"
                                  title="Ingresar a Taller"
                                >
                                  <PlayCircle className="w-4 h-4" />
                                </button>
                              )}

                              {mant.estado === 'En proceso' && (
                                <button
                                  onClick={() => abrirModalCompletar(mant)}
                                  className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all"
                                  title="Completar"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}

                              {canReprogramar && puedeReagendar(mant) && (
                                <button
                                  onClick={() => handleAbrirReprogramar(mant)}
                                  className="p-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg transition-all"
                                  title="Reagendar"
                                >
                                  <Calendar className="w-4 h-4" />
                                </button>
                              )}
                              {canEliminarMantenimiento && (
                                <button
                                  onClick={() => handleEliminarMantenimiento(mant)}
                                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-gray-400 text-sm">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                    {pagination.total} registros
                  </div>
                  <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm"
                    >
                      Anterior
                    </button>
                    <span className="px-3 py-2 bg-white/5 text-white rounded-lg text-sm text-center">
                      Página {pagination.page} de {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 🔥 MODAL VER DETALLE */}
        {modalDetalle.open && modalDetalle.data && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">
                  Detalle de Mantenimiento #{String(modalDetalle.data.folio_servicio).padStart(4, '0')}
                </h2>
                <button
                  onClick={() => setModalDetalle({ open: false, data: null })}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Vehículo</p>
                    <p className="text-white font-semibold">{modalDetalle.data.numero_vehiculo}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Estado</p>
                    {getEstadoBadge(modalDetalle.data.estado, modalDetalle.data.status_real, modalDetalle.data.estado_ui)}
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Tipo de Servicio</p>
                    <p className="text-white">{modalDetalle.data.tipo_servicio}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Taller</p>
                    <p className="text-white">{modalDetalle.data.taller || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Fecha Programada</p>
                    <p className="text-white">{formatDate(modalDetalle.data.fecha_programada)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Hora Programada</p>
                    <p className="text-white">{formatTime(modalDetalle.data.fecha_programada)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Kilometraje</p>
                    <p className="text-white">{modalDetalle.data.kilometraje_servicio?.toLocaleString() || '-'} km</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Costo Total</p>
                    <p className="text-white font-bold text-lg">{formatCurrency(modalDetalle.data.costo_total)}</p>
                  </div>
                </div>

                {modalDetalle.data.observaciones && (
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Observaciones</p>
                    <p className="text-white bg-white/5 p-3 rounded-lg">{modalDetalle.data.observaciones}</p>
                  </div>
                )}

                {Array.isArray(modalDetalle.data.adjuntos_admin) && modalDetalle.data.adjuntos_admin.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Adjuntos del Admin</p>
                    <div className="space-y-2">
                      {modalDetalle.data.adjuntos_admin.map((adjunto, index) => (
                        <a
                          key={`${adjunto.url}-${index}`}
                          href={adjunto.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/20 transition-all text-sm"
                        >
                          {adjunto.original_name || `Adjunto ${index + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 🔥 MODAL COMPLETAR */}
        {modalCompletar.open && modalCompletar.data && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/20 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 sm:p-6 flex justify-between items-center rounded-t-xl">
                <h2 className="text-2xl font-bold text-white">
                  Completar Mantenimiento
                </h2>
                <button
                  onClick={cerrarModalCompletar}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

            <form onSubmit={completarMantenimiento} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <p className="text-gray-400 text-sm mb-2">Vehículo</p>
                <p className="text-white font-semibold">{modalCompletar.data.vehiculo}</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Kilometraje Actual del Vehículo *
                </label>
                <input
                  type="number"
                  name="kilometraje_actual"
                  required
                  value={completarKmActual}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCompletarKmActual(value);
                    setCompletarProximoKm(calcularProximoServicioKm(value));
                  }}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Próximo Servicio (KM) *
                </label>
                <input
                  type="number"
                  name="proximo_servicio"
                  required
                  value={completarProximoKm}
                  readOnly
                  placeholder="Ej: 45000"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500 opacity-80 cursor-not-allowed"
                />
                <p className="text-gray-500 text-xs mt-1">Se calcula automáticamente con intervalo de 10,000 km</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Taller *
                </label>
                <select
                  name="taller"
                  required
                  value={completarTallerCategoria}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCompletarTallerCategoria(value);
                    if (value !== 'Otro') {
                      setCompletarTallerOtroDetalle('');
                    }
                  }}
                  className="w-full px-4 py-2 bg-slate-800 border border-cyan-300/50 rounded-lg text-white focus:outline-none focus:border-cyan-300"
                >
                  <option value="" className="bg-slate-900 text-slate-200">
                    Seleccionar categoria...
                  </option>
                  {categoriasTaller.map((categoria) => (
                    <option
                      key={`categoria-completar-${categoria.value}`}
                      value={categoria.value}
                      className="bg-slate-900 text-white"
                    >
                      {categoria.label}
                    </option>
                  ))}
                </select>
              </div>

              {completarTallerCategoria === 'Otro' && (
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">
                    Descripcion de taller *
                  </label>
                  <input
                    type="text"
                    name="taller_otro_detalle"
                    required
                    value={completarTallerOtroDetalle}
                    onChange={(e) => setCompletarTallerOtroDetalle(e.target.value)}
                    placeholder="Ej. Taller externo especializado en..."
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500"
                  />
                </div>
              )}

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Mecánico
                </label>
                <input
                  type="text"
                  name="mecanico"
                  defaultValue={modalCompletar.data.mecanico}
                  placeholder="Nombre del mecánico"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Costo Total *
                </label>
                <input
                  type="number"
                  name="costo_total"
                  step="0.01"
                  required
                  defaultValue={modalCompletar.data.costo_total}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3">
                <p className="text-cyan-200 text-sm">
                  La distribucion de gastos se registra despues en el modulo de <strong>Distribuir Gastos</strong>.
                </p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Observaciones
                </label>
                <textarea
                  name="observaciones"
                  rows="3"
                  defaultValue={modalCompletar.data.observaciones}
                  placeholder="Detalles del servicio realizado..."
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Adjuntar evidencia (fotos/PDF) - Opcional
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,application/pdf"
                  multiple
                  onChange={handleAdjuntosCompletarChange}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:bg-cyan-500/20 file:text-cyan-200 hover:file:bg-cyan-500/30"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Hasta {MAX_ADMIN_ADJUNTOS} archivos. Maximo 10MB por archivo.
                </p>
                {adjuntosCompletar.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {adjuntosCompletar.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between rounded bg-white/5 border border-white/10 px-3 py-2 text-xs"
                      >
                        <span className="text-gray-200 truncate pr-3">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAdjuntoCompletar(index)}
                          className="text-red-300 hover:text-red-200"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={cerrarModalCompletar}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-semibold transition-all"
                >
                  ✅ Completar
                </button>
              </div>
            </form>
            </div>
          </div>
        )}

        {modalReprogramar.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/20 max-w-lg w-full">
              <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-4 sm:p-6 flex justify-between items-center rounded-t-xl">
                <div>
                  <h2 className="text-2xl font-bold text-white">Reagendar Mantenimiento</h2>
                  <p className="text-amber-100 text-xs mt-1">
                    Folio #{String(modalReprogramar.folio || 0).padStart(4, '0')} · {modalReprogramar.vehiculo}
                  </p>
                </div>
                <button
                  onClick={handleCerrarModalReprogramar}
                  disabled={modalReprogramar.loading}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all disabled:opacity-60"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Servicio</p>
                  <p className="text-white font-semibold">{modalReprogramar.tipo_servicio}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Nueva fecha</label>
                    <input
                      type="date"
                      value={modalReprogramar.fecha_programada}
                      min={today}
                      onChange={(e) =>
                        setModalReprogramar((prev) => ({
                          ...prev,
                          fecha_programada: e.target.value,
                          hora_programada: ''
                        }))
                      }
                      className="w-full px-3 py-2 bg-white border border-white/20 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Nueva hora</label>
                    <select
                      value={modalReprogramar.hora_programada}
                      onChange={(e) => setModalReprogramar((prev) => ({ ...prev, hora_programada: e.target.value }))}
                      disabled={!modalReprogramar.fecha_programada || cargandoSlotsReprogramacion || modalReprogramar.loading}
                      className="w-full px-3 py-2 bg-white border border-white/20 rounded-lg text-slate-900"
                    >
                      <option value="">
                        {modalReprogramar.fecha_programada ? 'Selecciona un horario' : 'Primero selecciona fecha'}
                      </option>
                      {(slotsReprogramacion.length > 0
                        ? slotsReprogramacion
                        : HALF_HOUR_SLOTS.map((hora) => ({ hora, disponible: true }))
                      ).map((slot) => (
                        <option key={slot.hora} value={slot.hora}>
                          {slot.hora}
                          {!slot.disponible ? ' - Ocupado' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Bloques de 30 minutos.</p>
                    {cargandoSlotsReprogramacion && (
                      <p className="text-xs text-cyan-300 mt-1">Cargando disponibilidad...</p>
                    )}
                  </div>
                </div>

                {(() => {
                  const slotSeleccionado = slotsReprogramacion.find((slot) => slot.hora === modalReprogramar.hora_programada);
                  if (!slotSeleccionado || slotSeleccionado.disponible) return null;
                  return (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                      <p className="text-amber-200 text-sm font-semibold">El horario seleccionado ya está ocupado.</p>
                      <label className="mt-2 flex items-center gap-2 text-xs text-amber-100">
                        <input
                          type="checkbox"
                          checked={Boolean(modalReprogramar.forzar_horario_ocupado)}
                          onChange={(e) =>
                            setModalReprogramar((prev) => ({
                              ...prev,
                              forzar_horario_ocupado: e.target.checked
                            }))
                          }
                        />
                        Permitir sobrecupo y guardar de todos modos
                      </label>
                    </div>
                  );
                })()}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCerrarModalReprogramar}
                    disabled={modalReprogramar.loading}
                    className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarReprogramacion}
                    disabled={modalReprogramar.loading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg font-semibold transition-all disabled:opacity-60"
                  >
                    {modalReprogramar.loading ? 'Guardando...' : 'Guardar cambio'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default MantenimientosLista;












