import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Calendar,
  Car,
  Wrench,
  DollarSign,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  Trash2,
  List,
  LayoutGrid,
  PlayCircle,
  X
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const MantenimientosLista = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [mantenimientos, setMantenimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState('lista'); // 'lista' o 'kanban'
  
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
    estados: []
  });

  // Modales
  const [modalDetalle, setModalDetalle] = useState({ open: false, data: null });
  const [modalCompletar, setModalCompletar] = useState({ open: false, data: null });

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
  }, [pagination.page, filtros]);

  const cargarOpciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/opciones`, {
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
      
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filtros).filter(([_, v]) => v !== '')
        )
      });

      const response = await fetch(
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

const getEstadoBadge = (estado, statusReal) => {
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
      'Completado': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Programado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'En proceso': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Pendiente': 'bg-slate-500/20 text-slate-300 border-slate-500/30' // Agregué pendiente por si acaso
    };
    
    // Si no es cancelado, usamos el statusReal (Urgente/Vencido) o el estado base
    const displayEstado = statusReal || estado;
    const badgeClass = badges[displayEstado] || badges['Programado'];
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badgeClass}`}>
        {displayEstado}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
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

  const handleEliminar = async (id, folio) => {
    if (!confirm(`¿Estás seguro de eliminar el mantenimiento #${String(folio).padStart(4, '0')}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      if (data.success) {
        alert('✅ Mantenimiento eliminado exitosamente');
        cargarMantenimientos();
      } else {
        alert('❌ Error al eliminar: ' + data.message);
      }
    } catch (error) {
      console.error('Error al eliminar mantenimiento:', error);
      alert('❌ Error al eliminar mantenimiento');
    }
  };

  // 🔥 NUEVO: Ingresar a Taller
  const handleIngresarTaller = async (mant) => {
  if (!confirm(`¿Ingresar vehículo ${mant.numero_vehiculo} a taller?`)) return;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${mant.id}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ estado: 'En proceso' })
    });

    const data = await response.json();
    
    if (data.success) {
      await cargarMantenimientos(); // 🔥 Recarga sin alert
    } else {
      alert('❌ Error: ' + data.message);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('❌ Error al ingresar a taller');
  }
};

  // 🔥 MEJORA #3: Modal Ver Detalle
  const abrirModalDetalle = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${id}`, {
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
  const abrirModalCompletar = async (mant) => {
  // 🆕 Obtener saldo de póliza del conductor
  let saldoPoliza = 50000; // Default
  let conductorId = null;
  let nombreConductor = 'Sin asignar';

  if (mant.conductor_id) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/conductores/${mant.conductor_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.conductor) {
        saldoPoliza = parseFloat(data.conductor.saldo_poliza_mecanica) || 50000;
        conductorId = data.conductor.id;
        nombreConductor = data.conductor.nombre_conductor;
      }
    } catch (error) {
      console.error('Error al cargar saldo de póliza:', error);
    }
  }

  setModalCompletar({ 
    open: true, 
    data: {
      id: mant.id,
      folio: mant.folio_servicio,
      vehiculo: `${mant.numero_vehiculo} - ${mant.marca} ${mant.modelo}`,
      vehiculo_id: mant.vehiculo_id,
      kilometraje_actual: mant.km_actual_vehiculo || mant.kilometraje_servicio || '',
      proximo_servicio_km: mant.proximo_servicio_km || '',
      costo_total: mant.costo_total || 0,
      taller: mant.taller || '',
      tipo_servicio: mant.tipo_servicio || '',
      mecanico: mant.mecanico || '',
      observaciones: mant.observaciones || '',
      // 🆕 Datos del conductor
      conductor_id: conductorId,
      nombre_conductor: nombreConductor,
      saldo_poliza_conductor: saldoPoliza
    }
  });
};

 const completarMantenimiento = async (e) => {
  e.preventDefault();
  const form = e.target;
  
  // 🆕 Validar método de distribución
  const metodoDistribucion = form.metodo_distribucion.value;
  if (!metodoDistribucion) {
    alert('⚠️ Debes seleccionar un método de pago');
    return;
  }

  const costoTotal = parseFloat(form.costo_total.value);

  // 🆕 Validar saldo de póliza si se seleccionó ese método
  if (metodoDistribucion === 'poliza') {
    const saldoDisponible = modalCompletar.data.saldo_poliza_conductor;
    if (costoTotal > saldoDisponible) {
      alert(`⚠️ Saldo insuficiente en póliza.\n\nCosto: ${formatCurrency(costoTotal)}\nDisponible: ${formatCurrency(saldoDisponible)}\n\nSelecciona otro método de pago.`);
      return;
    }
  }

  const datos = {
    kilometraje_servicio: parseInt(form.kilometraje_actual.value),
    proximo_servicio_km: parseInt(form.proximo_servicio.value),
    costo_total: costoTotal,
    taller: form.taller.value,
    mecanico: form.mecanico.value,
    observaciones_final: form.observaciones.value,
    fecha_realizada: new Date().toISOString().split('T')[0],
    // 🆕 NUEVOS CAMPOS
    metodo_distribucion: metodoDistribucion,
    conductor_id: modalCompletar.data.conductor_id
  };

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${API_BASE_URL}/admin/mantenimientos/${modalCompletar.data.id}/completar`,
      {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      }
    );

    const data = await response.json();
    
    if (data.success) {
      // 🆕 Mensaje mejorado con detalle del pago
      let mensaje = '✅ Mantenimiento completado exitosamente\n\n';
      
      if (metodoDistribucion === 'poliza') {
        mensaje += `💳 Descuento de Póliza:\n`;
        mensaje += `Conductor: ${modalCompletar.data.nombre_conductor}\n`;
        mensaje += `Descontado: ${formatCurrency(costoTotal)}\n`;
        mensaje += `Nuevo saldo: ${formatCurrency(modalCompletar.data.saldo_poliza_conductor - costoTotal)}`;
      } else if (metodoDistribucion === 'empresa') {
        mensaje += `🏢 Pagado por Empresa\n`;
        mensaje += `Monto: ${formatCurrency(costoTotal)}\n`;
        mensaje += `(Afecta el ROI del vehículo)`;
      } else if (metodoDistribucion === 'conductor') {
        mensaje += `💰 Añadido como Deuda\n`;
        mensaje += `Conductor: ${modalCompletar.data.nombre_conductor}\n`;
        mensaje += `Monto: ${formatCurrency(costoTotal)}`;
      } else if (metodoDistribucion === 'fondo') {
        mensaje += `💚 Pagado desde Fondo de Mantenimiento\n`;
        mensaje += `Monto: ${formatCurrency(costoTotal)}`;
      }

      alert(mensaje);
      setModalCompletar({ open: false, data: null });
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
  const mantenimientosPorEstado = {
    Programado: mantenimientos.filter(m => m.estado === 'Programado'),
    'En proceso': mantenimientos.filter(m => m.estado === 'En proceso'),
    Completado: mantenimientos.filter(m => m.estado === 'Completado')
  };

  const TarjetaMantenimiento = ({ mant }) => (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 hover:bg-white/15 transition-all mb-3">
      <div className="flex justify-between items-start mb-2">
        <span className="text-white font-mono text-sm">
          #{String(mant.folio_servicio).padStart(4, '0')}
        </span>
        {getEstadoBadge(mant.estado, mant.status_real)}
      </div>
      
      <div className="mb-3">
        <p className="text-white font-semibold">{mant.numero_vehiculo}</p>
        <p className="text-gray-400 text-xs">{mant.marca} {mant.modelo}</p>
      </div>

      <div className="space-y-1 mb-3">
        <p className="text-gray-300 text-sm">{mant.tipo_servicio}</p>
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
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/mantenimientos')}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Lista de Mantenimientos
              </h1>
              <p className="text-gray-400">
                {pagination.total} mantenimiento(s) registrado(s)
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {/* 🔥 Toggle Vista Lista/Kanban */}
            <div className="flex bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setVistaActual('lista')}
                className={`px-4 py-2 rounded flex items-center gap-2 transition-all ${
                  vistaActual === 'lista' 
                    ? 'bg-white/20 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                Lista
              </button>
              <button
                onClick={() => setVistaActual('kanban')}
                className={`px-4 py-2 rounded flex items-center gap-2 transition-all ${
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
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg transition-all flex items-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              Programar
            </button>
          </div>
        </div>

        {/* 🔥 MEJORA #4: Filtros Rápidos */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
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
            onClick={() => aplicarFiltroRapido('Programado')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filtros.estado === 'Programado' 
                ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50' 
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            📅 Programado
          </button>
          <button
            onClick={() => aplicarFiltroRapido('En proceso')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filtros.estado === 'En proceso' 
                ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50' 
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            🔧 En Proceso
          </button>
          <button
            onClick={() => aplicarFiltroRapido('Vencido')}
            className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              filtros.estado === 'Vencido' 
                ? 'bg-red-500/30 text-red-400 border border-red-500/50' 
                : 'bg-white/10 text-gray-400 hover:bg-white/15'
            }`}
          >
            ⚠️ Vencidos
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros Avanzados
            </h3>
            <button
              onClick={limpiarFiltros}
              className="text-sm text-gray-400 hover:text-white transition-all flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Limpiar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Columna PROGRAMADO */}
            <div className="bg-blue-900/20 backdrop-blur-sm rounded-xl border border-blue-500/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Programado
                </h3>
                <span className="bg-blue-500/30 text-blue-400 px-3 py-1 rounded-full text-sm font-bold">
                  {mantenimientosPorEstado.Programado.length}
                </span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                {mantenimientosPorEstado.Programado.map(mant => (
                  <TarjetaMantenimiento key={mant.id} mant={mant} />
                ))}
                {mantenimientosPorEstado.Programado.length === 0 && (
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
                  {mantenimientosPorEstado['En proceso'].length}
                </span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                {mantenimientosPorEstado['En proceso'].map(mant => (
                  <TarjetaMantenimiento key={mant.id} mant={mant} />
                ))}
                {mantenimientosPorEstado['En proceso'].length === 0 && (
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
                  {mantenimientosPorEstado.Completado.length}
                </span>
              </div>
              <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                {mantenimientosPorEstado.Completado.map(mant => (
                  <TarjetaMantenimiento key={mant.id} mant={mant} />
                ))}
                {mantenimientosPorEstado.Completado.length === 0 && (
                  <p className="text-gray-400 text-center py-8">No hay mantenimientos completados</p>
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
            ) : mantenimientos.length === 0 ? (
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="text-left text-gray-400 text-sm font-semibold p-4">Folio</th>
                        <th className="text-left text-gray-400 text-sm font-semibold p-4">Vehículo</th>
                        <th className="text-left text-gray-400 text-sm font-semibold p-4">Conductor</th>
                        <th className="text-left text-gray-400 text-sm font-semibold p-4">Tipo Servicio</th>
                        <th className="text-center text-gray-400 text-sm font-semibold p-4">Fecha Programada</th>
                        <th className="text-center text-gray-400 text-sm font-semibold p-4">Estado</th>
                        <th className="text-right text-gray-400 text-sm font-semibold p-4">Costo</th>
                        <th className="text-center text-gray-400 text-sm font-semibold p-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mantenimientos.map((mant) => (
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
                            <span className="text-white text-sm">
                              {mant.tipo_servicio || 'Sin especificar'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-white text-sm">
                              {formatDate(mant.fecha_programada)}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {getEstadoBadge(mant.estado, mant.status_real)}
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

                              <button
                                onClick={() => handleEliminar(mant.id, mant.folio_servicio)}
                                className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="p-4 border-t border-white/10 flex items-center justify-between">
                  <div className="text-gray-400 text-sm">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                    {pagination.total} registros
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
                    >
                      Anterior
                    </button>
                    <span className="px-4 py-2 bg-white/5 text-white rounded-lg">
                      Página {pagination.page} de {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
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
                    {getEstadoBadge(modalDetalle.data.estado, modalDetalle.data.status_real)}
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
              </div>
            </div>
          </div>
        )}

        {/* 🔥 MODAL COMPLETAR */}
        {modalCompletar.open && modalCompletar.data && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/20 max-w-lg w-full">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 sm:p-6 flex justify-between items-center rounded-t-xl">
                <h2 className="text-2xl font-bold text-white">
                  Completar Mantenimiento
                </h2>
                <button
                  onClick={() => setModalCompletar({ open: false, data: null })}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

            <form onSubmit={completarMantenimiento} className="p-4 sm:p-6 space-y-4">
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
                  defaultValue={modalCompletar.data.kilometraje_actual}
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
                  defaultValue={modalCompletar.data.proximo_servicio_km}
                  placeholder="Ej: 45000"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
                <p className="text-gray-500 text-xs mt-1">Sugerido: KM actual + 5000</p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Taller *
                </label>
                <input
                  type="text"
                  name="taller"
                  required
                  defaultValue={modalCompletar.data.taller}
                  placeholder="Nombre del taller"
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>

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

              {/* 🆕 PANEL DE DISTRIBUCIÓN DE PAGO */}
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
                <h4 className="text-white font-semibold flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-400" />
                  ¿Cómo se cubre este costo?
                </h4>

                {/* Mostrar saldo de póliza del conductor */}
                {modalCompletar.data.conductor_id ? (
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Conductor:</span>
                      <span className="text-white font-semibold text-sm">{modalCompletar.data.nombre_conductor}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Saldo Póliza Disponible:</span>
                      <span className="text-green-400 font-bold text-lg">
                        {formatCurrency(modalCompletar.data.saldo_poliza_conductor)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-amber-400 text-sm">
                      ⚠️ Este vehículo no tiene conductor asignado
                    </p>
                  </div>
                )}

                {/* Selector de método de pago */}
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">
                    Método de Pago *
                  </label>
                  <select 
                    name="metodo_distribucion" 
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Seleccionar método...</option>
                    {modalCompletar.data.conductor_id && (
                      <option value="poliza">💳 Descontar de Póliza del Conductor</option>
                    )}
                    <option value="empresa">🏢 Pagar por Empresa (Afecta ROI del vehículo)</option>
                    {modalCompletar.data.conductor_id && (
                      <option value="conductor">💰 Añadir como Deuda al Conductor</option>
                    )}
                    <option value="fondo">💚 Fondo de Mantenimiento</option>
                  </select>
                  <p className="text-gray-500 text-xs mt-1">
                    Esta decisión afectará los registros financieros del sistema
                  </p>
                </div>
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

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalCompletar({ open: false, data: null })}
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

      </div>
    </div>
  );
};

export default MantenimientosLista;
