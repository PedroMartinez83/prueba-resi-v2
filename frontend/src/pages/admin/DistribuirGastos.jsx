// frontend/src/pages/admin/DistribuirGastos.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, AlertCircle, CheckCircle, Wallet, 
  Shield, Building2, User, Calendar, Wrench,
  DollarSign, Save, X, Search, Filter
} from 'lucide-react';
import adminService from '../../services/adminService';

const DistribuirGastos = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('distribucion');
  const [mantenimientos, setMantenimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [distribuyendo, setDistribuyendo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('todos');
  const [filtrosFinanciero, setFiltrosFinanciero] = useState({ estado_financiero: '', search: '' });
  const [vistaFinanciera, setVistaFinanciera] = useState({
    resumen: {},
    mantenimientos: [],
    pagination: {}
  });
  const [loadingFinanciero, setLoadingFinanciero] = useState(false);
  const [errorFinanciero, setErrorFinanciero] = useState('');
  const [estadoFinancieroDraft, setEstadoFinancieroDraft] = useState({});
  const [updatingFinancieroId, setUpdatingFinancieroId] = useState(null);

  // Estado del modal de distribución
  const [modalAbierto, setModalAbierto] = useState(false);
  const [mantenimientoSeleccionado, setMantenimientoSeleccionado] = useState(null);
  const [distribucion, setDistribucion] = useState({
    pagado_fondo_mantenimiento: 0,
    pagado_poliza: 0,
    pagado_empresa: 0,
    pagado_conductor: 0,
    observaciones: ''
  });

  useEffect(() => {
    cargarMantenimientosPendientes();
    cargarFlujoFinanciero();
  }, []);

  const cargarMantenimientosPendientes = async () => {
    try {
      setLoading(true);
      const response = await adminService.getMantenimientosPendientesDistribucion();
      
      if (response.success) {
        setMantenimientos(response.mantenimientos || []);
      }
    } catch (error) {
      console.error('Error al cargar mantenimientos:', error);
      alert('Error al cargar los mantenimientos pendientes');
    } finally {
      setLoading(false);
    }
  };

  const cargarFlujoFinanciero = async (filtros = filtrosFinanciero, options = {}) => {
    const { page = 1, append = false } = options;

    try {
      setLoadingFinanciero(true);
      setErrorFinanciero('');

      const data = await adminService.getFlujoFinancieroMantenimientos({
        ...filtros,
        page,
        limit: 30
      });

      const rows = data?.mantenimientos || [];
      setVistaFinanciera((prev) => ({
        resumen: data?.resumen || {},
        mantenimientos: append ? [...(prev?.mantenimientos || []), ...rows] : rows,
        pagination: data?.pagination || {}
      }));

      setEstadoFinancieroDraft((prev) => {
        const next = { ...prev };
        rows.forEach((item) => {
          next[item.id] = item.estado_financiero || 'capturado';
        });
        return next;
      });
    } catch (error) {
      console.error('Error cargando flujo financiero:', error);
      setErrorFinanciero(error.message || 'No se pudo cargar el flujo financiero');
      setVistaFinanciera({
        resumen: {},
        mantenimientos: [],
        pagination: {}
      });
    } finally {
      setLoadingFinanciero(false);
    }
  };

  const actualizarEstadoFinanciero = async (mantenimientoId) => {
    const estadoNuevo = estadoFinancieroDraft[mantenimientoId];
    if (!estadoNuevo) return;

    try {
      setUpdatingFinancieroId(mantenimientoId);
      await adminService.actualizarEstadoFlujoFinanciero(mantenimientoId, estadoNuevo);
      await cargarFlujoFinanciero();
    } catch (error) {
      console.error('Error actualizando flujo financiero:', error);
      alert(error.message || 'No se pudo actualizar el flujo financiero');
    } finally {
      setUpdatingFinancieroId(null);
    }
  };

  const handleVerMasFinanciero = async () => {
    if (loadingFinanciero) return;
    const currentPage = Number(vistaFinanciera?.pagination?.page || 1);
    const totalPages = Number(vistaFinanciera?.pagination?.totalPages || 1);
    if (currentPage >= totalPages) return;
    await cargarFlujoFinanciero(filtrosFinanciero, {
      page: currentPage + 1,
      append: true
    });
  };

  const abrirModalDistribucion = (mantenimiento) => {
    setMantenimientoSeleccionado(mantenimiento);
    setDistribucion({
      pagado_fondo_mantenimiento: 0,
      pagado_poliza: 0,
      pagado_empresa: 0,
      pagado_conductor: 0,
      observaciones: ''
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setMantenimientoSeleccionado(null);
    setDistribucion({
      pagado_fondo_mantenimiento: 0,
      pagado_poliza: 0,
      pagado_empresa: 0,
      pagado_conductor: 0,
      observaciones: ''
    });
  };

  const handleInputChange = (campo, valor) => {
    const valorNumerico = parseFloat(valor) || 0;
    setDistribucion(prev => ({
      ...prev,
      [campo]: valorNumerico
    }));
  };

  const calcularTotal = () => {
    return (
      parseFloat(distribucion.pagado_fondo_mantenimiento) +
      parseFloat(distribucion.pagado_poliza) +
      parseFloat(distribucion.pagado_empresa) +
      parseFloat(distribucion.pagado_conductor)
    );
  };

  const calcularRestante = () => {
    if (!mantenimientoSeleccionado) return 0;
    return parseFloat(mantenimientoSeleccionado.costo_total) - calcularTotal();
  };

  const distribucionValida = () => {
    const costoTotal = parseFloat(mantenimientoSeleccionado?.costo_total || 0);
    const total = calcularTotal();
    return Math.abs(costoTotal - total) < 0.01; // Tolerancia de 1 centavo
  };

  const handleDistribuir = async () => {
    if (!distribucionValida()) {
      alert(`La distribución debe sumar exactamente $${formatCurrency(mantenimientoSeleccionado.costo_total)}`);
      return;
    }

    try {
      setDistribuyendo(mantenimientoSeleccionado.id);
      
      const response = await adminService.distribuirGastoMantenimiento(
        mantenimientoSeleccionado.id,
        distribucion
      );

    if (response.success) {
  let mensaje = '✅ Distribución Registrada Exitosamente';
  
  // Resumen de la distribución
  mensaje += '\n\n📊 RESUMEN DE DISTRIBUCIÓN:';
  mensaje += `\n━━━━━━━━━━━━━━━━━━━━━━`;
  mensaje += `\n• Costo Total: ${formatCurrency(mantenimientoSeleccionado.costo_total)}`;
  
  if (distribucion.pagado_fondo_mantenimiento > 0) {
    mensaje += `\n• Fondo Mantenimiento: ${formatCurrency(distribucion.pagado_fondo_mantenimiento)}`;
  }
  if (distribucion.pagado_poliza > 0) {
    mensaje += `\n• Póliza Mecánica: ${formatCurrency(distribucion.pagado_poliza)}`;
  }
  if (distribucion.pagado_empresa > 0) {
    mensaje += `\n• Empresa (Inversión): ${formatCurrency(distribucion.pagado_empresa)}`;
  }
  if (distribucion.pagado_conductor > 0) {
    mensaje += `\n• Deuda Conductor: ${formatCurrency(distribucion.pagado_conductor)}`;
  }
  
  // Detalle del descuento de póliza
  if (response.detalle_poliza) {
    const detalle = response.detalle_poliza;
    const porcentaje = ((detalle.saldo_nuevo / 50000) * 100).toFixed(1);
    
    mensaje += '\n\n💳 DESCUENTO DE PÓLIZA MECÁNICA:';
    mensaje += `\n━━━━━━━━━━━━━━━━━━━━━━`;
    mensaje += `\n👤 Conductor: ${detalle.nombre}`;
    mensaje += `\n📍 ID: ${detalle.id}`;
    mensaje += `\n\n💰 Movimiento:`;
    mensaje += `\n   Saldo Anterior: ${formatCurrency(detalle.saldo_previo)}`;
    mensaje += `\n   Descontado: -${formatCurrency(detalle.monto_descontado)}`;
    mensaje += `\n   Saldo Actual: ${formatCurrency(detalle.saldo_nuevo)}`;
    mensaje += `\n\n📊 Disponible: ${porcentaje}% de $50,000.00`;
    
    // Alerta si queda poco saldo
    if (detalle.saldo_nuevo < 10000) {
      mensaje += `\n\n⚠️ ALERTA: Saldo bajo en póliza`;
    }
  }
  
  mensaje += '\n\n━━━━━━━━━━━━━━━━━━━━━━';
  mensaje += '\n✓ La distribución se ha guardado correctamente';
  
  alert(mensaje);
  cerrarModal();
  cargarMantenimientosPendientes();
}
    } catch (error) {
      console.error('Error al distribuir:', error);
      alert(error.message || 'Error al registrar la distribución');
    } finally {
      setDistribuyendo(null);
    }
  };

  const autoDistribuir = (tipo) => {
    if (!mantenimientoSeleccionado) return;
    
    const costoTotal = parseFloat(mantenimientoSeleccionado.costo_total);
    const nuevaDistribucion = {
      pagado_fondo_mantenimiento: 0,
      pagado_poliza: 0,
      pagado_empresa: 0,
      pagado_conductor: 0,
      observaciones: distribucion.observaciones
    };

    switch(tipo) {
      case 'poliza':
        nuevaDistribucion.pagado_poliza = costoTotal;
        break;
      case 'empresa':
        nuevaDistribucion.pagado_empresa = costoTotal;
        break;
      case 'conductor':
        nuevaDistribucion.pagado_conductor = costoTotal;
        break;
      case 'fondo':
        nuevaDistribucion.pagado_fondo_mantenimiento = costoTotal;
        break;
      case '50-50':
        nuevaDistribucion.pagado_poliza = costoTotal / 2;
        nuevaDistribucion.pagado_empresa = costoTotal / 2;
        break;
      default:
        break;
    }

    setDistribucion(nuevaDistribucion);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEstadoFinancieroLabel = (estado) => {
    const map = {
      capturado: 'Capturado',
      validado_finanzas: 'Validado por Finanzas',
      pagado: 'Pagado'
    };
    return map[estado] || 'Capturado';
  };

  const getBadgeEstadoOperativo = (estado) => {
    const classes = {
      Pendiente: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      Programado: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'En proceso': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      Completado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      Cancelado: 'bg-red-500/20 text-red-300 border-red-500/30',
      Reprogramado: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${classes[estado] || classes.Pendiente}`}>
        {estado || 'Pendiente'}
      </span>
    );
  };

  const getBadgeEstadoFinanciero = (estado) => {
    const classes = {
      capturado: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      validado_finanzas: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      pagado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${classes[estado] || classes.capturado}`}>
        {getEstadoFinancieroLabel(estado)}
      </span>
    );
  };

  const mantenimientosFiltrados = mantenimientos.filter(m => {
    const coincideBusqueda = 
      m.numero_vehiculo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.nombre_conductor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.tipo_servicio?.toLowerCase().includes(searchTerm.toLowerCase());

    const diasDesde = parseInt(m.dias_desde_completado) || 0;
    let coincideFecha = true;

    if (filtroFecha === '7dias') coincideFecha = diasDesde <= 7;
    else if (filtroFecha === '30dias') coincideFecha = diasDesde <= 30;
    else if (filtroFecha === 'masde30') coincideFecha = diasDesde > 30;

    return coincideBusqueda && coincideFecha;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07425E] p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-500 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07425E] p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/mantenimientos')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Mantenimientos
        </button>

        <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Distribuir Gastos de Mantenimiento</h1>
              <p className="text-gray-400">
                {mantenimientos.length} mantenimiento{mantenimientos.length !== 1 ? 's' : ''} pendiente{mantenimientos.length !== 1 ? 's' : ''} de distribución
              </p>
            </div>

            <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-amber-500/20 border border-amber-500/30">
              <AlertCircle className="w-6 h-6 text-amber-400" />
              <div>
                <p className="text-amber-400 text-sm font-semibold">Total Pendiente</p>
                <p className="text-white text-2xl font-bold">
                  {formatCurrency(mantenimientos.reduce((sum, m) => sum + parseFloat(m.costo_total || 0), 0))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="inline-flex rounded-xl border border-white/20 bg-white/5 p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('distribucion')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'distribucion'
                ? 'bg-cyan-500/20 border border-cyan-400/30 text-cyan-200'
                : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            Distribucion de Gastos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('flujo')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'flujo'
                ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-200'
                : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            Flujo Financiero
          </button>
        </div>
      </div>

      {activeTab === 'distribucion' && (
      <>

      {/* Filtros */}
      <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por vehículo, conductor o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* Filtro de fecha */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none"
            >
              <option value="todos">Todos los periodos</option>
              <option value="7dias">Últimos 7 días</option>
              <option value="30dias">Últimos 30 días</option>
              <option value="masde30">Más de 30 días</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Mantenimientos */}
      <div className="space-y-4">
        {mantenimientosFiltrados.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">¡Todo al día!</h3>
            <p className="text-gray-400">No hay mantenimientos pendientes de distribución</p>
          </div>
        ) : (
          mantenimientosFiltrados.map((mantenimiento) => (
            <div 
              key={mantenimiento.id}
              className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 hover:bg-white/15 transition-all"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-semibold">
                      #{mantenimiento.folio_servicio}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      parseInt(mantenimiento.dias_desde_completado) <= 7
                        ? 'bg-green-500/20 text-green-400'
                        : parseInt(mantenimiento.dias_desde_completado) <= 30
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {mantenimiento.dias_desde_completado} días
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Vehículo</p>
                      <p className="text-white font-semibold">
                        {mantenimiento.numero_vehiculo} - {mantenimiento.marca} {mantenimiento.modelo}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Conductor</p>
                      <p className="text-white font-semibold">
                        {mantenimiento.nombre_conductor || 'Sin asignar'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Tipo de Servicio</p>
                      <p className="text-white font-semibold">{mantenimiento.tipo_servicio}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>Completado: {formatDate(mantenimiento.fecha_realizada)}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <div className="text-right">
                    <p className="text-gray-400 text-sm mb-1">Costo Total</p>
                    <p className="text-3xl font-bold text-white">
                      {formatCurrency(mantenimiento.costo_total)}
                    </p>
                  </div>

                  <button
                    onClick={() => abrirModalDistribucion(mantenimiento)}
                    disabled={distribuyendo === mantenimiento.id}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {distribuyendo === mantenimiento.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <Wallet className="w-5 h-5" />
                        <span>Distribuir Gasto</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </>
      )}

      {activeTab === 'flujo' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="backdrop-blur-xl bg-white/10 rounded-xl border border-white/20 p-3">
              <p className="text-xs text-gray-400">Capturado</p>
              <p className="text-2xl font-bold text-white">{vistaFinanciera?.resumen?.capturado || 0}</p>
            </div>
            <div className="backdrop-blur-xl bg-white/10 rounded-xl border border-white/20 p-3">
              <p className="text-xs text-gray-400">Validado por Finanzas</p>
              <p className="text-2xl font-bold text-white">{vistaFinanciera?.resumen?.validado_finanzas || 0}</p>
            </div>
            <div className="backdrop-blur-xl bg-white/10 rounded-xl border border-white/20 p-3">
              <p className="text-xs text-gray-400">Pagado</p>
              <p className="text-2xl font-bold text-white">{vistaFinanciera?.resumen?.pagado || 0}</p>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                value={filtrosFinanciero.search}
                onChange={(e) => setFiltrosFinanciero((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Buscar por unidad, folio, conductor o servicio"
                className="md:col-span-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400"
              />
              <select
                value={filtrosFinanciero.estado_financiero}
                onChange={(e) => setFiltrosFinanciero((prev) => ({ ...prev, estado_financiero: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-emerald-400"
              >
                <option value="">Todos los estados</option>
                <option value="capturado">Capturado</option>
                <option value="validado_finanzas">Validado por Finanzas</option>
                <option value="pagado">Pagado</option>
              </select>
              <div className="grid grid-cols-2 md:flex gap-2">
                <button
                  type="button"
                  onClick={() => cargarFlujoFinanciero()}
                  className="w-full md:flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 rounded-lg text-sm font-semibold"
                >
                  Filtrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const reset = { estado_financiero: '', search: '' };
                    setFiltrosFinanciero(reset);
                    cargarFlujoFinanciero(reset);
                  }}
                  className="w-full px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-200 rounded-lg text-sm"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          {errorFinanciero && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {errorFinanciero}
            </div>
          )}

          <div className="hidden md:block overflow-auto max-h-[60vh] border border-white/10 rounded-xl">
            <table className="w-full min-w-[1100px] relative">
              <thead className="bg-[#1a1a2e] sticky top-0 z-10 shadow-sm border-b border-white/10">
                <tr className="text-left text-xs uppercase text-gray-400">
                  <th className="px-4 py-3">Folio</th>
                  <th className="px-4 py-3">Vehiculo</th>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Estado Mant.</th>
                  <th className="px-4 py-3">Estado Financiero</th>
                  <th className="px-4 py-3">Costo</th>
                  <th className="px-4 py-3">Actualizado</th>
                  <th className="px-4 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody>
                {loadingFinanciero && vistaFinanciera.mantenimientos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando flujo financiero...</td>
                  </tr>
                )}
                {!loadingFinanciero && vistaFinanciera.mantenimientos.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No hay mantenimientos en flujo financiero.</td>
                  </tr>
                )}
                {vistaFinanciera.mantenimientos.map((item) => (
                  <tr key={`flujo-financiero-${item.id}`} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white font-semibold">#{String(item.folio_servicio || item.id).padStart(4, '0')}</td>
                    <td className="px-4 py-3">
                      <p className="text-white font-semibold">{item.numero_vehiculo || '-'}</p>
                      <p className="text-gray-500 text-xs">{item.nombre_conductor || 'Sin conductor'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-200 max-w-[260px]">{item.tipo_servicio || '-'}</td>
                    <td className="px-4 py-3">{getBadgeEstadoOperativo(item.estado_operativo_label || item.estado)}</td>
                    <td className="px-4 py-3">{getBadgeEstadoFinanciero(item.estado_financiero)}</td>
                    <td className="px-4 py-3 text-emerald-300 font-semibold">{formatCurrency(item.costo_total || 0)}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{formatDateTime(item.flujo_actualizado_at || item.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={estadoFinancieroDraft[item.id] || item.estado_financiero || 'capturado'}
                          onChange={(e) => setEstadoFinancieroDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="px-2 py-1.5 rounded-md bg-white/10 border border-white/20 text-white text-xs"
                        >
                          <option value="capturado">Capturado</option>
                          <option value="validado_finanzas">Validado por Finanzas</option>
                          <option value="pagado">Pagado</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => actualizarEstadoFinanciero(item.id)}
                          disabled={updatingFinancieroId === item.id}
                          className="px-3 py-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {updatingFinancieroId === item.id ? 'Guardando...' : 'Actualizar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Number(vistaFinanciera?.pagination?.page || 1) < Number(vistaFinanciera?.pagination?.totalPages || 1) && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleVerMasFinanciero}
                disabled={loadingFinanciero}
                className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingFinanciero ? 'Cargando...' : 'Ver mas registros'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Distribución */}
      {modalAbierto && mantenimientoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="backdrop-blur-xl bg-gray-800/95 rounded-2xl border border-white/20 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="sticky top-0 bg-gray-800/95 backdrop-blur-xl border-b border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Distribuir Gasto de Mantenimiento</h2>
                <button
                  onClick={cerrarModal}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                <Wrench className="w-12 h-12 text-cyan-400" />
                <div className="flex-1">
                  <p className="text-white font-semibold text-lg">
                    {mantenimientoSeleccionado.numero_vehiculo} - {mantenimientoSeleccionado.tipo_servicio}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Folio #{mantenimientoSeleccionado.folio_servicio} • {formatDate(mantenimientoSeleccionado.fecha_realizada)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Costo Total</p>
                  <p className="text-3xl font-bold text-white">
                    {formatCurrency(mantenimientoSeleccionado.costo_total)}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 space-y-6">
              {/* Botones de Auto-Distribución */}
              <div>
                <p className="text-gray-300 font-semibold mb-3">Distribución Rápida:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => autoDistribuir('poliza')}
                    className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all text-sm font-semibold"
                  >
                    100% Póliza
                  </button>
                  <button
                    onClick={() => autoDistribuir('empresa')}
                    className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all text-sm font-semibold"
                  >
                    100% Empresa
                  </button>
                  <button
                    onClick={() => autoDistribuir('conductor')}
                    className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 transition-all text-sm font-semibold"
                  >
                    100% Conductor
                  </button>
                  <button
                    onClick={() => autoDistribuir('fondo')}
                    className="p-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 transition-all text-sm font-semibold"
                  >
                    100% Fondo
                  </button>
                  <button
                    onClick={() => autoDistribuir('50-50')}
                    className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-all text-sm font-semibold col-span-2"
                  >
                    50% Póliza / 50% Empresa
                  </button>
                </div>
              </div>

              {/* Campos de Distribución Manual */}
              <div className="space-y-4">
                <p className="text-gray-300 font-semibold">Distribución Manual:</p>

                {/* Fondo de Mantenimiento */}
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Wallet className="w-5 h-5 text-green-400" />
                    <label className="text-green-400 font-semibold">Fondo de Mantenimiento</label>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={distribucion.pagado_fondo_mantenimiento}
                    onChange={(e) => handleInputChange('pagado_fondo_mantenimiento', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    placeholder="0.00"
                  />
                </div>

                {/* Póliza Mecánica */}
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    <label className="text-blue-400 font-semibold">Póliza Mecánica del Conductor</label>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={distribucion.pagado_poliza}
                    onChange={(e) => handleInputChange('pagado_poliza', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="0.00"
                  />
                </div>

                {/* Empresa (Inversión) */}
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Building2 className="w-5 h-5 text-purple-400" />
                    <label className="text-purple-400 font-semibold">Empresa (Inversión del Vehículo)</label>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={distribucion.pagado_empresa}
                    onChange={(e) => handleInputChange('pagado_empresa', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    placeholder="0.00"
                  />
                </div>

                {/* Deuda del Conductor */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <User className="w-5 h-5 text-amber-400" />
                    <label className="text-amber-400 font-semibold">Deuda del Conductor</label>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={distribucion.pagado_conductor}
                    onChange={(e) => handleInputChange('pagado_conductor', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Resumen de Distribución */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">Suma de Distribución:</span>
                  <span className="text-white font-bold text-xl">{formatCurrency(calcularTotal())}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-300">Costo Total del Mantenimiento:</span>
                  <span className="text-white font-bold text-xl">
                    {formatCurrency(mantenimientoSeleccionado.costo_total)}
                  </span>
                </div>
                <div className={`flex justify-between items-center p-3 rounded-lg ${
                  Math.abs(calcularRestante()) < 0.01
                    ? 'bg-green-500/20 border border-green-500/30'
                    : 'bg-red-500/20 border border-red-500/30'
                }`}>
                  <span className={Math.abs(calcularRestante()) < 0.01 ? 'text-green-400' : 'text-red-400'}>
                    {calcularRestante() > 0 ? 'Falta por distribuir:' : calcularRestante() < 0 ? 'Exceso distribuido:' : '¡Distribución correcta!'}
                  </span>
                  <span className={`font-bold text-xl ${Math.abs(calcularRestante()) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
                    {Math.abs(calcularRestante()) < 0.01 ? '✓' : formatCurrency(Math.abs(calcularRestante()))}
                  </span>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-gray-300 font-semibold mb-2">Observaciones (Opcional):</label>
                <textarea
                  value={distribucion.observaciones}
                  onChange={(e) => setDistribucion({ ...distribucion, observaciones: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                  placeholder="Notas adicionales sobre la distribución..."
                />
              </div>

              {/* Botones de Acción */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={cerrarModal}
                  className="flex-1 px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDistribuir}
                  disabled={!distribucionValida() || distribuyendo}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {distribuyendo ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Guardar Distribución</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistribuirGastos;
