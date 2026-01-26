import React, { useState, useEffect } from 'react';
import adminService from '../../../services/adminService';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import ModalRegistrarPago from '../../../components/pagos/ModalRegistrarPago';
import ModalDetalles from './components/ModalDetalles';
import { 
  FileText, 
  Plus, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  Car,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Download,
  Search,
  TrendingUp,
  History,
  Ban,
  FileText as FileTextIcon
} from 'lucide-react';

const Rentas = () => {
  const TOLERANCIA_DIAS = 2;

  // Estados principales
  const [rentas, setRentas] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [opciones, setOpciones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState('');

  
  // Estados de filtros
  const [filtros, setFiltros] = useState({
    status: '',
    conductor_id: '',
    vehiculo_id: '',
    metodo_pago: '',
    fecha_desde: '',
    fecha_hasta: '',
    busqueda: ''
  });
  
  // Estados de modales
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedRenta, setSelectedRenta] = useState(null);
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    cargarDatos();
  }, [filtros, currentPage]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const params = {
        ...filtros,
        page: currentPage,
        limit: itemsPerPage
      };
      
      // Limpiar parámetros vacíos
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) {
          delete params[key];
        }
      });
      
      // Remover filtros de búsqueda local (no van al backend)
      delete params.busqueda;
      delete params.busqueda_vehiculo;
      
      const [pagosData, estadisticasData, opcionesData] = await Promise.all([
        adminService.getPagosRentas(params),
        adminService.getEstadisticasPagosRentas({ 
          fecha_desde: filtros.fecha_desde, 
          fecha_hasta: filtros.fecha_hasta 
        }),
        opciones ? Promise.resolve({ opciones }) : adminService.getOpcionesPagosRentas()
      ]);
      
      console.log('✅ Datos cargados:', {
        pagos: pagosData.pagos?.length,
        opciones: opcionesData.opciones?.conductores?.length
      });
      
      setRentas(pagosData.pagos || []);
      setEstadisticas(estadisticasData.estadisticas || {});
      setTotalPages(pagosData.pagination?.totalPages || 1);
      
      if (!opciones && opcionesData.opciones) {
        console.log('📋 Conductores disponibles:', opcionesData.opciones.conductores?.length);
        setOpciones(opcionesData.opciones);
      }
      
    } catch (error) {
      console.error('❌ Error cargando rentas:', error);
      alert('Error al cargar las rentas. Por favor, recarga la página.');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (key, value) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // 🆕 Función para ejecutar la búsqueda (Botón o Enter)
const realizarBusqueda = () => {
  setFiltros(prev => ({
    ...prev,
    busqueda: textoBusqueda // Pasamos el texto local al filtro real
  }));
  setCurrentPage(1); // Reseteamos a la página 1
};

// 🆕 Manejador de tecla Enter
const handleKeyDown = (e) => {
  if (e.key === 'Enter') {
    realizarBusqueda();
  }
};

  const limpiarFiltros = () => {
    setTextoBusqueda('');
    setFiltros({
      status: '',
      conductor_id: '',
      vehiculo_id: '',
      metodo_pago: '',
      fecha_desde: '',
      fecha_hasta: '',
      busqueda: ''
    });
    setCurrentPage(1);
  };

  const handleCreateRenta = () => {
    setSelectedRenta(null);
    setModalType('create');
    setShowModal(true);
  };

  const handleEditRenta = (renta) => {
    setSelectedRenta(renta);
    setModalType('edit');
    setShowModal(true);
  };

  const handleEliminarPago = async (id) => {
    // 1. Buscamos el pago completo para saber su status
    const pago = rentas.find(r => r.id === id);
    if (!pago) return;

    // 2. Validación inicial
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro?')) return;

    let motivoBaja = '';

    // 🟢 3. SI ESTÁ CONFIRMADO, OBLIGAMOS A DAR UN MOTIVO
    if (pago.status === 'Confirmado') {
      motivoBaja = window.prompt("⚠️ Este pago ya fue aprobado. Escribe la razón de la eliminación:");
      
      // Si da cancelar o lo deja vacío, detenemos todo
      if (motivoBaja === null || motivoBaja.trim() === '') {
        return alert("❌ Cancelado: Debes escribir un motivo para eliminar un pago confirmado.");
      }
    }

    try {
      setLoadingAction(true);
      // Enviamos el ID y el Motivo (si existe)
      await adminService.eliminarPagoRenta(id, motivoBaja);
      
      alert('✅ Pago eliminado correctamente');
      cargarDatos(); // Recargamos la tabla

    } catch (error) {
      alert(error.message);
      console.error('Error eliminando:', error);
    } finally {
      setLoadingAction(false);
    }
  };
  const handleViewRenta = (renta) => {
    setSelectedRenta(renta);
    setModalType('view');
    setShowModal(true);
  };

  const handleVerHistorial = async (conductorId) => {
    try {
      setLoadingAction(true);
      const historial = await adminService.getHistorialPagosConductor(conductorId);
      setSelectedRenta(historial);
      setModalType('historial');
      setShowModal(true);
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      alert('Error al obtener el historial');
    } finally {
      setLoadingAction(false);
    }
  };

const handleValidarPago = async (pagoId) => {
    if (!window.confirm('¿Confirmar que este pago fue recibido?')) return;
    
    // 1. Buscamos el pago actual en tu estado para rescatar sus notas viejas
    const pagoActual = rentas.find(p => p.id === pagoId);
    const observacionesViejas = pagoActual?.observaciones || '';

    try {
      setLoadingAction(true);
      
      await adminService.validarPagoRenta(pagoId, {
        // 2. Aquí decidimos qué enviar:
        observaciones: observacionesViejas
      });

      await cargarDatos();
      // Usamos un toast o alert simple
      alert('Pago validado exitosamente');
    } catch (error) {
      console.error('Error validando pago:', error);
      alert('Error al validar el pago');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRechazarPago = async (pagoId) => {
    const motivo = window.prompt('Motivo del rechazo:');
    if (!motivo) return;
    
    try {
      setLoadingAction(true);
      await adminService.rechazarPagoRenta(pagoId, motivo);
      await cargarDatos();
      alert('Pago rechazado');
    } catch (error) {
      console.error('Error rechazando pago:', error);
      alert('Error al rechazar el pago');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalType('');
    setSelectedRenta(null);
  };

  const handleExportarExcel = () => {
    const datosExport = rentasFiltradas.map(r => ({
      'Folio': r.id,
      'Conductor': r.nombre_conductor,
      'Vehículo': r.numero_vehiculo,
      'Tipo Socio': r.tipo_socio,
      'Monto Renta': r.monto_renta_pagado,
      'Monto Póliza': r.monto_poliza_pagado,
      'Monto Total': r.monto_total,
      'Fecha Pago': formatDate(r.fecha_pago),
      'Día que cubre': formatDiaCorrespondiente(obtenerFechaCorrespondiente(r.fecha_pago)),
      'Días hábiles transcurridos (sin domingo)': obtenerInfoTolerancia(r.fecha_pago).diasHabilesTranscurridos ?? 'N/A',
      'Días restantes de tolerancia': obtenerInfoTolerancia(r.fecha_pago).diasRestantesTolerancia ?? 'N/A',
      'Estado tolerancia': obtenerInfoTolerancia(r.fecha_pago).estadoTolerancia,
      'Método': r.metodo_pago,
      'Estado': r.status,
      'Observaciones': r.observaciones || ''
    }));

    const headers = Object.keys(datosExport[0]);
    const csv = [
      headers.join(','),
      ...datosExport.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rentas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const goToDashboard = () => {
    window.location.href = '/admin/rentas';
  };

  const getEstadoColor = (estado) => {
    const colores = {
      'Pendiente': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'Confirmado': 'bg-green-500/10 text-green-400 border-green-500/20',
      'Rechazado': 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    return colores[estado] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const getEstadoIcon = (estado) => {
    const iconos = {
      'Pendiente': Clock,
      'Confirmado': CheckCircle,
      'Rechazado': XCircle
    };
    const IconComponent = iconos[estado] || Clock;
    return <IconComponent className="w-4 h-4" />;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const obtenerRangoObservaciones = (observaciones) => {
    if (!observaciones) return null;
    const match = observaciones.match(/Rango\s+(\d{4}-\d{2}-\d{2})\s+a\s+(\d{4}-\d{2}-\d{2})/i);
    if (!match) return null;
    return {
      inicio: match[1],
      fin: match[2]
    };
  };

  const formatRangoObservaciones = (observaciones) => {
    const rango = obtenerRangoObservaciones(observaciones);
    if (!rango) return null;
    return `${formatDate(rango.inicio)} a ${formatDate(rango.fin)}`;
  };

  const obtenerFechaCorrespondiente = (fechaPago) => {
    if (!fechaPago) return null;
    const fecha = new Date(fechaPago);
    if (Number.isNaN(fecha.getTime())) return null;

    // Si fuera domingo, considerar el sábado previo porque no se cobran rentas ese día
    if (fecha.getDay() === 0) {
      const ajustada = new Date(fecha);
      ajustada.setDate(ajustada.getDate() - 1);
      ajustada.setHours(0, 0, 0, 0);
      return ajustada;
    }

    fecha.setHours(0, 0, 0, 0);
    return fecha;
  };

  const contarDiasHabilesSinDomingos = (inicio, fin = new Date()) => {
    if (!inicio) return null;
    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);
    fechaInicio.setHours(0, 0, 0, 0);
    fechaFin.setHours(0, 0, 0, 0);

    let dias = 0;
    const cursor = new Date(fechaInicio);

    while (cursor < fechaFin) {
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() !== 0) {
        dias += 1;
      }
    }

    return dias;
  };

  const obtenerInfoTolerancia = (fechaPago) => {
    const fechaCorresponde = obtenerFechaCorrespondiente(fechaPago);
    if (!fechaCorresponde) {
      return {
        fechaCorresponde: null,
        diasHabilesTranscurridos: null,
        diasRestantesTolerancia: null,
        estadoTolerancia: 'Sin información'
      };
    }

    const diasHabilesTranscurridos = contarDiasHabilesSinDomingos(fechaCorresponde, new Date());
    const diasRestantesTolerancia = diasHabilesTranscurridos === null
      ? null
      : Math.max(0, TOLERANCIA_DIAS - diasHabilesTranscurridos);

    let estadoTolerancia = 'Al corriente';
    if (diasHabilesTranscurridos > TOLERANCIA_DIAS) {
      estadoTolerancia = 'Atrasado';
    } else if (diasHabilesTranscurridos > 0) {
      estadoTolerancia = 'En tolerancia';
    }

    return {
      fechaCorresponde,
      diasHabilesTranscurridos,
      diasRestantesTolerancia,
      estadoTolerancia
    };
  };

  const formatDiaCorrespondiente = (fecha) => {
    if (!fecha) return 'N/A';
    return fecha.toLocaleDateString('es-MX', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  // 🆕 Filtro de búsqueda mejorado
const rentasFiltradas = rentas.filter(renta => {
  if (renta.status === 'Eliminado') return false;

  // Usamos filtros.busqueda (el valor confirmado al dar Enter)
  if (filtros.busqueda) {
    const termino = filtros.busqueda.toLowerCase();
    const coincide = (
      renta.nombre_conductor?.toLowerCase().includes(termino) ||
      renta.numero_vehiculo?.toLowerCase().includes(termino) ||
      renta.id?.toString().includes(termino)
    );
    if (!coincide) return false;
  }
  
  return true;
});

  // 🆕 Filtrar conductores para el dropdown
  const conductoresFiltrados = opciones?.conductores?.filter(conductor => {
    if (!filtros.busqueda_vehiculo) return true;
    const vehiculo = conductor.numero_vehiculo?.toLowerCase() || '';
    return vehiculo.includes(filtros.busqueda_vehiculo.toLowerCase());
  }) || [];

  if (loading && rentas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="large" message="Cargando pagos de rentas..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={goToDashboard}
            className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FileText className="w-8 h-8" />
              Gestión de Rentas
            </h1>
            <p className="text-gray-400">Sistema de cobranza diaria de conductores</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleExportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            disabled={rentas.length === 0}
          >
            <Download className="w-5 h-5" />
            Exportar Excel
          </button>
          <button
            onClick={handleCreateRenta}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Crear Pago Manual
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass rounded-lg p-4 border border-primary/20 hover:border-primary/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Pagos</p>
                <p className="text-2xl font-bold text-white">{estadisticas.total_pagos || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Conductores activos</p>
              </div>
              <FileText className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-yellow-500/20 hover:border-yellow-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-500">{estadisticas.pendientes || 0}</p>
                <p className="text-xs text-yellow-600 mt-1">
                  {formatCurrency(estadisticas.pendiente_validar)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-green-500/20 hover:border-green-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Confirmados</p>
                <p className="text-2xl font-bold text-green-500">{estadisticas.confirmados || 0}</p>
                <p className="text-xs text-green-600 mt-1">
                  {formatCurrency(estadisticas.total_cobrado)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-red-500/20 hover:border-red-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Rechazados</p>
                <p className="text-2xl font-bold text-red-500">{estadisticas.rechazados || 0}</p>
                <p className="text-xs text-red-600 mt-1">Requieren atención</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-blue-500/20 hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Por Validar</p>
                <p className="text-lg font-bold text-blue-500">
                  {formatCurrency(estadisticas.pendiente_validar_renta ?? estadisticas.pendiente_validar)}
                </p>
                <p className="text-xs text-blue-600 mt-1">Total pendiente</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros Mejorados */}
      <div className="glass rounded-lg p-4 border border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-white">Filtros de Búsqueda</h3>
          </div>
          <button
            onClick={limpiarFiltros}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Búsqueda rápida */}
            <div className="lg:col-span-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por conductor, vehículo o folio..."
                  value={textoBusqueda} // Usamos el estado local
                  onChange={(e) => setTextoBusqueda(e.target.value)} // Solo actualiza visualmente
                  onKeyDown={handleKeyDown} // Detecta el Enter
                  className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <button
                onClick={realizarBusqueda}
                className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-colors flex items-center gap-2 font-medium"
              >
                <Search className="w-4 h-4" />
                Buscar
              </button>
            </div>

          {/* Estado */}
          <select
            value={filtros.status}
            onChange={(e) => handleFiltroChange('status', e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="" className="bg-gray-800">Todos los estados</option>
            {opciones?.estados?.map(estado => (
              <option key={estado} value={estado} className="bg-gray-800">{estado}</option>
            ))}
          </select>

          {/* Método de pago */}
          <select
            value={filtros.metodo_pago}
            onChange={(e) => handleFiltroChange('metodo_pago', e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="" className="bg-gray-800">Todos los métodos</option>
            {opciones?.metodos_pago?.map(metodo => (
              <option key={metodo} value={metodo} className="bg-gray-800">{metodo}</option>
            ))}
          </select>

          {/* Conductor */}
          <select
            value={filtros.conductor_id}
            onChange={(e) => handleFiltroChange('conductor_id', e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="" className="bg-gray-800">
              Todos los conductores ({opciones?.conductores?.length || 0})
            </option>
            {conductoresFiltrados.map(conductor => (
              <option key={conductor.id} value={conductor.id} className="bg-gray-800">
                {conductor.nombre} 
                {conductor.numero_vehiculo && ` - ${conductor.numero_vehiculo}`}
                {!conductor.tiene_asignacion && ' (Sin vehículo)'}
              </option>
            ))}
          </select>

          {/* Vehículo */}
          <select
            value={filtros.vehiculo_id}
            onChange={(e) => handleFiltroChange('vehiculo_id', e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="" className="bg-gray-800">Todos los vehículos</option>
            {opciones?.vehiculos?.map(vehiculo => (
              <option key={vehiculo.id} value={vehiculo.id} className="bg-gray-800">
                {vehiculo.numero} - {vehiculo.tipo_socio}
              </option>
            ))}
          </select>

          {/* Fecha desde */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.fecha_desde}
              onChange={(e) => handleFiltroChange('fecha_desde', e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.fecha_hasta}
              onChange={(e) => handleFiltroChange('fecha_hasta', e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Rentas */}
      <div className="glass rounded-lg border border-primary/20 overflow-hidden">
        <div className="p-4 border-b border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-white">
              Pagos de Rentas ({rentasFiltradas.length})
            </h3>
          </div>
          <div className="text-sm text-gray-400">
            Página {currentPage} de {totalPages}
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <LoadingSpinner message="Cargando rentas..." />
          </div>
        ) : rentasFiltradas.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No se encontraron pagos</p>
            <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left">
                <thead className="bg-dark/50 border-b border-primary/20">
                  <tr>
                    <th className="py-3 px-4 text-gray-400 font-medium">Folio</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Conductor</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Vehículo</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Tipo</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Monto</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Fecha</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Estado</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Método</th>
                    <th className="py-3 px-4 text-gray-400 font-medium text-center whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rentasFiltradas.map((renta) => {
                    const fechaCorresponde = obtenerFechaCorrespondiente(renta.fecha_pago);
                    const fechaParaMostrar = fechaCorresponde || renta.fecha_pago;
                    const rangoObservaciones = formatRangoObservaciones(renta.observaciones);
                    const puedeBorrar = renta.status === 'Confirmado' || renta.status === 'Rechazado';

                    return (
                      <tr 
                        key={renta.id} 
                        className="border-b border-primary/10 hover:bg-primary/5 transition-colors align-top"
                      >
                        <td className="py-4 px-4 font-medium text-white align-top">
                          #{renta.id}
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-white/5 text-gray-300">
                              <User className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-white font-medium text-sm leading-tight">
                                {renta.nombre_conductor}
                              </p>
                              <p className="text-gray-500 text-xs">
                                {renta.numero_telefono}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 font-medium">{renta.numero_vehiculo}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/30">
                            {renta.tipo_socio}
                          </span>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-green-400" />
                              <p className="text-lg font-semibold text-green-300 leading-none">
                                {formatCurrency(renta.monto_total)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                                <span className="text-gray-400">Renta:</span>
                                <span className="font-medium text-white">{formatCurrency(renta.monto_renta_pagado)}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                                <span className="text-gray-400">Póliza:</span>
                                <span className="font-medium text-white">{formatCurrency(renta.monto_poliza_pagado)}</span>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-gray-200">
                              <Calendar className="w-4 h-4" />
                              <span className="font-medium whitespace-nowrap">
                                {formatDate(fechaParaMostrar)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 capitalize">
                              Cubre: {rangoObservaciones || formatDiaCorrespondiente(fechaCorresponde)}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getEstadoColor(renta.status)}`}>
                            {getEstadoIcon(renta.status)}
                            {renta.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-center gap-2 text-gray-300">
                            <CreditCard className="w-4 h-4" />
                            <span className="font-medium">{renta.metodo_pago}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top w-[1%]">
                          <div className="flex justify-center flex-wrap gap-1">
                            <button
                              onClick={() => handleViewRenta(renta)}
                              className="p-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleVerHistorial(renta.conductor_id)}
                              className="p-2 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-colors"
                              title="Ver historial"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            {renta.comprobante_url && (
                              <a
                                href={renta.comprobante_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-cyan-500/20 text-cyan-300 rounded hover:bg-cyan-500/30 transition-colors"
                                title="Ver comprobante"
                              >
                                <FileTextIcon className="w-4 h-4" />
                              </a>
                            )}

                            {renta.status === 'Pendiente' && (
                              <>
                                <button
                                  onClick={() => handleValidarPago(renta.id)}
                                  className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                                  title="Validar pago"
                                  disabled={loadingAction}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                
                                <button
                                  onClick={() => handleEditRenta(renta)}
                                  className="p-2 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors"
                                  title="Editar"
                                  disabled={loadingAction}
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              </>
                            )}
                                    <button
                                      onClick={() => handleEliminarPago(renta.id)}
                                      className={`p-2 rounded transition-colors ${
                                        puedeBorrar 
                                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                                          : 'bg-gray-500/10 text-gray-500 cursor-not-allowed opacity-50'
                                      }`}
                                      title={puedeBorrar ? "Eliminar registro" : "Solo se pueden borrar pagos Confirmados o Rechazados"}
                                      disabled={loadingAction || !puedeBorrar}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>

                            {renta.status === 'Pendiente' && (
                              <button
                                onClick={() => handleRechazarPago(renta.id)}
                                className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                                title="Rechazar"
                                disabled={loadingAction}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-primary/20 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                
                <span className="text-gray-400">
                  Página {currentPage} de {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modales */}
      {showModal && (
        <>
          {modalType === 'view' && (
            <ModalDetalles
              pago={selectedRenta}
              onClose={handleCloseModal}
            />
          )}

          {modalType === 'historial' && (
            <ModalHistorial
              historial={selectedRenta}
              onClose={handleCloseModal}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          )}

          {(modalType === 'create' || modalType === 'edit') && (
            <ModalFormulario
              type={modalType}
              renta={selectedRenta}
              opciones={opciones}
              onClose={handleCloseModal}
              onSuccess={cargarDatos}
            />
          )}
        </>
      )}
    </div>
  );
};

// ========== MODAL HISTORIAL ==========
const ModalHistorial = ({ historial, onClose, formatCurrency, formatDate }) => {
  if (!historial || !historial.historial) {
    return null;
  }

  const { historial: pagos, resumen } = historial;

  const obtenerRangoObservaciones = (observaciones) => {
    if (!observaciones) return null;
    const match = observaciones.match(/Rango\s+(\d{4}-\d{2}-\d{2})\s+a\s+(\d{4}-\d{2}-\d{2})/i);
    if (!match) return null;
    return {
      inicio: match[1],
      fin: match[2]
    };
  };

  const formatRangoObservaciones = (observaciones) => {
    const rango = obtenerRangoObservaciones(observaciones);
    if (!rango) return null;
    return `${formatDate(rango.inicio)} a ${formatDate(rango.fin)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-primary/30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <History className="w-6 h-6 text-primary" />
              Historial de Pagos
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="glass p-4 rounded-lg border border-blue-500/20">
              <p className="text-gray-400 text-sm">Total Pagos</p>
              <p className="text-2xl font-bold text-blue-400">{resumen.total_pagos}</p>
            </div>
            <div className="glass p-4 rounded-lg border border-green-500/20">
              <p className="text-gray-400 text-sm">Total Pagado</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(resumen.total_pagado)}</p>
            </div>
            <div className="glass p-4 rounded-lg border border-yellow-500/20">
              <p className="text-gray-400 text-sm">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-400">{resumen.pagos_pendientes}</p>
            </div>
          </div>

          {/* Lista de Pagos */}
          <div className="space-y-3">
            {pagos.map((pago) => (
              <div 
                key={pago.id}
                className="glass p-4 rounded-lg border border-primary/20 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 font-mono text-sm">#{pago.id}</span>
                      <span className="text-white font-medium">{formatDate(pago.fecha_pago)}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        pago.status === 'Confirmado' ? 'bg-green-500/20 text-green-400' :
                        pago.status === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {pago.status}
                      </span>
                      {pago.status === 'Confirmado' && pago.fecha_pago && (
                        <span className="text-xs text-green-300">
                          cubre {formatRangoObservaciones(pago.observaciones) || formatDate(pago.fecha_pago)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="text-gray-400">Vehículo: <span className="text-white">{pago.numero_vehiculo}</span></span>
                      <span className="text-gray-400">Método: <span className="text-white">{pago.metodo_pago}</span></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(pago.monto_total)}</p>
                    <p className="text-xs text-gray-500">${pago.monto_renta_pagado} + ${pago.monto_poliza_pagado}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== MODAL FORMULARIO ==========
const ModalFormulario = ({ type, renta, opciones, onClose, onSuccess }) => {
  const [selectedConductor, setSelectedConductor] = useState(null);
  const [loadingConductor, setLoadingConductor] = useState(false);
  const [busquedaConductor, setBusquedaConductor] = useState('');
  const [loadingSave, setLoadingSave] = useState(false);
  const [formData, setFormData] = useState({
    monto_renta_pagado: '',
    monto_poliza_pagado: '',
    metodo_pago: '',
    observaciones: ''
  });

  // Inicializar datos cuando es edición
  useEffect(() => {
    if (type === 'edit' && renta) {
      setFormData({
        monto_renta_pagado: renta.monto_renta_pagado || '',
        monto_poliza_pagado: renta.monto_poliza_pagado || '',
        metodo_pago: renta.metodo_pago || '',
        observaciones: renta.observaciones || ''
      });
    }
  }, [type, renta]);

  const handleSaveEdit = async () => {
    if (!formData.monto_renta_pagado || !formData.monto_poliza_pagado || !formData.metodo_pago) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    try {
      setLoadingSave(true);
      await adminService.editarPagoRenta(renta.id, {
        monto_renta_pagado: parseFloat(formData.monto_renta_pagado),
        monto_poliza_pagado: parseFloat(formData.monto_poliza_pagado),
        metodo_pago: formData.metodo_pago,
        observaciones: formData.observaciones
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error guardando pago:', error);
      alert('Error al guardar los cambios');
    } finally {
      setLoadingSave(false);
    }
  };

  if (type === 'edit') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
        <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-primary/30">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Editar Pago</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-white font-medium mb-2">Conductor</label>
              <input
                type="text"
                value={renta?.nombre_conductor || ''}
                disabled
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white opacity-60"
              />
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Vehículo</label>
              <input
                type="text"
                value={renta?.numero_vehiculo || ''}
                disabled
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-medium mb-2">Monto Renta *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monto_renta_pagado}
                  onChange={(e) => setFormData({ ...formData, monto_renta_pagado: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-white font-medium mb-2">Monto Póliza *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monto_poliza_pagado}
                  onChange={(e) => setFormData({ ...formData, monto_poliza_pagado: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Método de Pago *</label>
              <select
                value={formData.metodo_pago}
                onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary"
              >
                <option value="" className="bg-gray-800">Seleccionar método...</option>
                {opciones?.metodos_pago?.map(metodo => (
                  <option key={metodo} value={metodo} className="bg-gray-800">{metodo}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Observaciones</label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary resize-none"
                rows="3"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loadingSave}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50"
              >
                {loadingSave ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleConductorChange = async (conductorId) => {
      // 1. Si el usuario borra la selección manualmente
      if (!conductorId) {
        setSelectedConductor(null);
        return;
      }

      // 🟢 2. VALIDACIÓN ESTRICTA (BLOQUEO)
      try {
        const chequeo = await adminService.verificarPagosPendientes(conductorId);
        
        if (chequeo.existe) {
          // 🛑 AQUI CAMBIAMOS LA LÓGICA:
          // En lugar de confirm(), usamos alert() y cortamos el flujo.
          
          alert(
            `⛔ ACCIÓN DENEGADA\n\n` +
            `Este conductor ya tiene un pago PENDIENTE de autorización por $${chequeo.pago.monto_total} (Fecha: ${new Date(chequeo.pago.fecha_pago).toLocaleDateString()}).\n\n` +
            `>> No puedes crear un pago manual nuevo.\n` +
            `>> Primero debes Validar o Rechazar el pago que ya envió el conductor.`
          );

          // 3. "Lo regresamos para atrás": Limpiamos la selección
          setSelectedConductor(null); 
          
          // Detenemos la función aquí. No se carga nada más.
          return; 
        }
      } catch (error) {
        console.error('⚠️ Error verificando historial:', error);
        // Si falla la conexión, decidimos si dejarlo pasar o bloquearlo. 
        // Por seguridad, mejor dejamos pasar solo si es error de red, pero aquí lo dejamos simple.
      }

      // 4. Carga normal de datos (Solo llega aquí si NO debe nada)
      try {
        setLoadingConductor(true);
        
        const response = await adminService.getConductorById(conductorId);
        const conductorCompleto = response.conductor;
        
        const asignacionActiva = conductorCompleto.asignaciones?.find(a => a.activa === true);
        
        if (!asignacionActiva) {
          alert('Este conductor no tiene una asignación activa. No puede registrar pagos.');
          setSelectedConductor(null);
          return;
        }
        
        setSelectedConductor({
          id: conductorCompleto.id,
          nombre_conductor: conductorCompleto.nombre_conductor,
          numero_vehiculo: asignacionActiva.numero_vehiculo || 'N/A',
          renta_diaria: parseFloat(asignacionActiva.renta_diaria || 400),
          abono_poliza_mantenimiento: parseFloat(asignacionActiva.abono_poliza_mantenimiento || 100)
        });
        
      } catch (error) {
        console.error('❌ Error cargando conductor:', error);
        alert('Error al cargar los datos del conductor.');
        setSelectedConductor(null);
      } finally {
        setLoadingConductor(false);
      }
    };

  // Filtrar conductores por búsqueda
  const conductoresFiltrados = opciones?.conductores?.filter(conductor => {
    if (!busquedaConductor) return true;
    const busqueda = busquedaConductor.toLowerCase();
    return (
      conductor.nombre?.toLowerCase().includes(busqueda) ||
      conductor.numero_vehiculo?.toLowerCase().includes(busqueda)
    );
  }) || [];

  return (
    <>
      {!selectedConductor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-primary/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Registrar Pago</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 🆕 Búsqueda de conductor */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Buscar Conductor
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o vehículo..."
                    value={busquedaConductor}
                    onChange={(e) => setBusquedaConductor(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white font-medium mb-3">
                  Seleccionar Conductor * ({conductoresFiltrados.length} disponibles)
                </label>
                <select
                  onChange={(e) => handleConductorChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary"
                  disabled={loadingConductor}
                  value={selectedConductor?.id || ''}
                >
                  <option value="" className="bg-gray-800">Seleccione un conductor...</option>
                  {conductoresFiltrados.map(conductor => (
                    <option key={conductor.id} value={conductor.id} className="bg-gray-800">
                      {conductor.nombre}
                      {conductor.numero_vehiculo && ` - ${conductor.numero_vehiculo}`}
                      {!conductor.tiene_asignacion && ' (Sin vehículo)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center py-6">
                <User className="w-16 h-16 mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400 text-sm">Selecciona un conductor para continuar</p>
                <p className="text-gray-500 text-xs mt-2">
                  Puedes buscar por nombre o número de vehículo
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ModalRegistrarPago
          isOpen={true}
          onClose={() => {
            setSelectedConductor(null);
            onClose();
          }}
          conductor={selectedConductor}
          onSuccess={(response) => {
            console.log('✅ Pago registrado:', response);
            setSelectedConductor(null);
            onSuccess();
          }}
        />
      )}
    </>
  );
};

export default Rentas;
