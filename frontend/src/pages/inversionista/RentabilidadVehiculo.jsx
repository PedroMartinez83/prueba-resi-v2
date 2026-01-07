// frontend/src/pages/RentabilidadVehiculo.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  TrendingUp, 
  DollarSign, 
  Calendar,
  Wrench,
  AlertTriangle,
  User,
  ArrowUpCircle,
  ArrowDownCircle,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Clock
} from 'lucide-react';
import { GenerarPDFButton } from '../../components/reportes/VehiculoPDFReport';
import adminService from "../../services/adminService";

const RentabilidadVehiculo = () => {
  const { vehiculoId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [historialData, setHistorialData] = useState(null);
  const [activeTab, setActiveTab] = useState('conductor');

  useEffect(() => {
    if (vehiculoId) {
      cargarHistorial();
    }
  }, [vehiculoId]);

  const cargarHistorial = async () => {
  try {
    setLoading(true);
    console.log('🔍 Cargando historial para vehículo:', vehiculoId);

    const response = await adminService.getHistorialVehiculo(vehiculoId);

    console.log('✅ Datos recibidos:', response);
    
    if (response.success) {
      setHistorialData(response);
    } else {
      throw new Error(response.message || 'Error al cargar historial');
    }
  } catch (error) {
    console.error('❌ Error completo:', error);
    alert('Error al cargar los datos del vehículo: ' + error.message);
  } finally {
    setLoading(false);
  }
};

  // ========== CÁLCULO DEL HÉROE: RENTABILIDAD NETA ==========
  const calcularRentabilidadNeta = () => {
    if (!historialData) return 0;

    const totalRecaudado = parseFloat(historialData.estadisticas?.total_recaudado || 0);
    const totalMantenimientos = parseFloat(historialData.estadisticas?.total_mantenimientos || 0);
    const totalPagadoInversionista = parseFloat(historialData.estadisticas?.total_pagado_inversionista || 0);

    return totalRecaudado - totalMantenimientos - totalPagadoInversionista;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  const tabs = [
    { 
      id: 'conductor', 
      label: 'Pagos del Conductor', 
      icon: User,
      color: 'from-blue-500 to-cyan-600',
      description: '¿El conductor paga a tiempo?'
    },
    { 
      id: 'inversionista', 
      label: 'Pagos al Inversionista', 
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
      description: '¿Cuánto le debemos?'
    },
    { 
      id: 'gastos', 
      label: 'Gastos Operativos', 
      icon: Wrench,
      color: 'from-orange-500 to-amber-600',
      description: 'Mantenimientos y siniestros'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-light to-dark p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* ========== HEADER CON NAVEGACIÓN ========== */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Volver</span>
          </button>

          <div className="glass rounded-2xl p-6 border border-primary/20">
            {/* Header con Título y Botón PDF */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Historial y Rentabilidad
                </h1>
                {historialData && (
                  <p className="text-gray-400">
                    Vehículo #{historialData.vehiculo?.numero_vehiculo} - {historialData.vehiculo?.marca} {historialData.vehiculo?.modelo}
                  </p>
                )}
              </div>

              {/* Botón Exportar PDF */}
              {historialData && !loading && (
                <GenerarPDFButton 
                  data={historialData}
                  imagenesGraficos={{}}
                />
              )}
            </div>

            {/* EL HÉROE - Rentabilidad Neta */}
            {!loading && historialData && (
              <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-white/10">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  
                  {/* Métrica Principal - EL HÉROE */}
                  <div className="lg:col-span-1 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-5 h-5 text-primary" />
                      <p className="text-sm text-gray-400 uppercase tracking-wide">
                        Rentabilidad Neta
                      </p>
                    </div>
                    <p className={`text-5xl font-bold ${
                      calcularRentabilidadNeta() >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(calcularRentabilidadNeta())}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      (Lifetime del vehículo)
                    </p>
                  </div>

                  {/* Gráfico de Barras Simple */}
                  <div className="lg:col-span-3">
                    <div className="space-y-3">
                      {/* Barra 1: Total Recaudado */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <ArrowUpCircle className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-gray-300">Total Recaudado</span>
                          </div>
                          <span className="text-sm font-bold text-green-400">
                            {formatCurrency(historialData.estadisticas?.total_recaudado)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3">
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* Barra 2: Total Gastos */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <ArrowDownCircle className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-gray-300">Gastos Operativos</span>
                          </div>
                          <span className="text-sm font-bold text-red-400">
                            {formatCurrency(historialData.estadisticas?.total_mantenimientos)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3">
                          <div 
                            className="h-full bg-gradient-to-r from-red-500 to-rose-600 rounded-full"
                            style={{ 
                              width: `${Math.min((parseFloat(historialData.estadisticas?.total_mantenimientos || 0) / parseFloat(historialData.estadisticas?.total_recaudado || 1)) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>

                      {/* Barra 3: Pagado a Inversionista */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <ArrowDownCircle className="w-4 h-4 text-orange-400" />
                            <span className="text-sm text-gray-300">Pagado a Inversionista</span>
                          </div>
                          <span className="text-sm font-bold text-orange-400">
                            {formatCurrency(historialData.estadisticas?.total_pagado_inversionista)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3">
                          <div 
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-600 rounded-full"
                            style={{ 
                              width: `${Math.min((parseFloat(historialData.estadisticas?.total_pagado_inversionista || 0) / parseFloat(historialData.estadisticas?.total_recaudado || 1)) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========== CONTENIDO: TABS + SECCIONES ========== */}
        <div className="glass rounded-2xl border border-primary/20 overflow-hidden">
          <div className="flex flex-col lg:flex-row min-h-[600px]">
            
            {/* Sidebar de Tabs (Izquierda) */}
            <div className="lg:w-64 bg-black/20 border-r border-white/10 p-4">
              <div className="space-y-2">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left p-4 rounded-xl transition-all ${
                        activeTab === tab.id
                          ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <Icon className="w-5 h-5" />
                        <span className="font-bold text-sm">{tab.label}</span>
                      </div>
                      <p className="text-xs opacity-80 ml-8">{tab.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contenido de Tabs (Derecha) */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-400">Cargando datos...</p>
                  </div>
                </div>
              ) : historialData ? (
                <>
                  {activeTab === 'conductor' && (
                    <SeccionPagosConductor data={historialData} />
                  )}
                  
                  {activeTab === 'inversionista' && (
                    <SeccionPagosInversionista data={historialData} />
                  )}
                  
                  {activeTab === 'gastos' && (
                    <SeccionGastosOperativos data={historialData} />
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400">No hay datos disponibles</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== SECCIÓN 1: PAGOS DEL CONDUCTOR (LÓGICA INTELIGENTE) ==========
const SeccionPagosConductor = ({ data }) => {
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [mostrarSoloRecientes, setMostrarSoloRecientes] = useState(true);

  // ========== LÓGICA INTELIGENTE: LÍNEA DE TIEMPO DÍA POR DÍA ==========
  const generarLineaDeTiempoPagos = () => {
    // ✅ MEJORA #1: Verificar que exista asignacion_actual
    const asignacionActiva = data?.asignacion_actual;
    
    if (!asignacionActiva) {
      return [];
    }

    const fechaInicio = new Date(asignacionActiva.fecha_inicio);
    const hoy = new Date();
    const timeline = [];

    // Loop por cada día desde fecha_inicio hasta hoy
    for (let dia = new Date(fechaInicio); dia <= hoy; dia.setDate(dia.getDate() + 1)) {
      const fechaDia = dia.toISOString().split('T')[0];
      
      // Buscar pago para este día
      const pagoEncontrado = data.pagos?.find(p => 
        p.fecha_pago && p.fecha_pago.startsWith(fechaDia)
      );

      // Excluir domingos (día 0)
      if (dia.getDay() !== 0) {
        if (pagoEncontrado) {
          timeline.push({
            id: pagoEncontrado.id,
            fecha: fechaDia,
            fechaObj: new Date(fechaDia),
            estado: 'Pagado',
            monto: parseFloat(pagoEncontrado.monto_total || 0),
            montoRenta: parseFloat(pagoEncontrado.monto_renta_pagado || 0),
            montoPoliza: parseFloat(pagoEncontrado.monto_poliza_pagado || 0),
            metodo: pagoEncontrado.metodo_pago,
            conductor: pagoEncontrado.nombre_conductor,
            tipo: 'real'
          });
        } else {
          timeline.push({
            id: `faltante-${fechaDia}`,
            fecha: fechaDia,
            fechaObj: new Date(fechaDia),
            estado: 'Faltante',
            monto: parseFloat(data.estadisticas?.promedio_renta_diaria || 0),
            conductor: data.asignacion_actual.nombre_conductor,
            tipo: 'faltante'
          });
        }
      }
    }

    return timeline.reverse(); // Más reciente primero
  };

  const lineaDeTiempo = generarLineaDeTiempoPagos();

  // Filtrar pagos
  const pagosFiltrados = lineaDeTiempo.filter(pago => {
    if (filtroEstado === 'todos') return true;
    return pago.estado === filtroEstado;
  });

  // Mostrar solo últimos 30 días si está activado
  const pagosAMostrar = mostrarSoloRecientes 
    ? pagosFiltrados.slice(0, 30) 
    : pagosFiltrados;

  // Calcular estadísticas
  const estadisticas = {
    pagados: lineaDeTiempo.filter(p => p.estado === 'Pagado').length,
    faltantes: lineaDeTiempo.filter(p => p.estado === 'Faltante').length,
    montoTotal: lineaDeTiempo
      .filter(p => p.estado === 'Pagado')
      .reduce((acc, p) => acc + parseFloat(p.monto || 0), 0),
    porcentajePagos: lineaDeTiempo.length > 0 
      ? ((lineaDeTiempo.filter(p => p.estado === 'Pagado').length / lineaDeTiempo.length) * 100).toFixed(1)
      : 0
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">
          Flujo de Pagos del Conductor
        </h3>
        <p className="text-gray-400">
          Línea de tiempo inteligente día por día (excluye domingos)
        </p>
      </div>

      {/* Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 uppercase">Pagos Realizados</p>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-400">{estadisticas.pagados}</p>
          <p className="text-xs text-gray-500 mt-1">
            {estadisticas.porcentajePagos}% de cumplimiento
          </p>
        </div>

        <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 uppercase">Pagos Faltantes</p>
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-400">{estadisticas.faltantes}</p>
          <p className="text-xs text-gray-500 mt-1">
            días sin pago
          </p>
        </div>

        <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 uppercase">Total Recaudado</p>
            <DollarSign className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-400">
            {formatCurrency(estadisticas.montoTotal)}
          </p>
        </div>

        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 uppercase">Promedio Diario</p>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {formatCurrency(data.estadisticas?.promedio_renta_diaria)}
          </p>
        </div>
      </div>

      {/* Barra de Progreso Visual */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-400">Cumplimiento de Pagos</p>
          <p className="text-sm font-bold text-white">{estadisticas.porcentajePagos}%</p>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${estadisticas.porcentajePagos}%` }}
          />
        </div>
      </div>

      {/* Controles de Filtro */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="todos">Todos ({lineaDeTiempo.length})</option>
            <option value="Pagado">Pagados ({estadisticas.pagados})</option>
            <option value="Faltante">Faltantes ({estadisticas.faltantes})</option>
          </select>
        </div>

        <button
          onClick={() => setMostrarSoloRecientes(!mostrarSoloRecientes)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mostrarSoloRecientes
              ? 'bg-primary text-dark'
              : 'bg-white/10 text-gray-400 hover:bg-white/20'
          }`}
        >
          {mostrarSoloRecientes ? 'Últimos 30 días' : 'Ver todo'}
        </button>
      </div>

      {/* Lista de Pagos - Línea de Tiempo */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {pagosAMostrar.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No hay registros con este filtro</p>
          </div>
        ) : (
          pagosAMostrar.map((pago) => (
            <div
              key={pago.id}
              className={`bg-white/5 backdrop-blur-sm border rounded-xl p-4 transition-all hover:bg-white/10 ${
                pago.estado === 'Pagado'
                  ? 'border-green-500/30 hover:border-green-500/50'
                  : 'border-red-500/30 hover:border-red-500/50'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Izquierda: Fecha e Icono */}
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${
                    pago.estado === 'Pagado'
                      ? 'bg-green-500/20'
                      : 'bg-red-500/20'
                  }`}>
                    {pago.estado === 'Pagado' ? (
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400" />
                    )}
                  </div>

                  <div>
                    <p className="text-white font-medium">
                      {formatDate(pago.fecha)}
                    </p>
                    <p className="text-sm text-gray-400">
                      {pago.conductor} {pago.metodo && `• ${pago.metodo}`}
                    </p>
                  </div>
                </div>

                {/* Derecha: Estado y Monto */}
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    pago.estado === 'Pagado'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                      : 'bg-red-500/20 text-red-400 border border-red-500/50'
                  }`}>
                    {pago.estado}
                  </span>

                  <div className="text-right">
                    <p className="text-white text-xl font-bold">
                      {formatCurrency(pago.monto)}
                    </p>
                    {pago.estado === 'Pagado' && pago.montoRenta && (
                      <p className="text-xs text-gray-500">
                        Renta: {formatCurrency(pago.montoRenta)} | Póliza: {formatCurrency(pago.montoPoliza)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Mostrar más */}
      {mostrarSoloRecientes && pagosFiltrados.length > 30 && (
        <button
          onClick={() => setMostrarSoloRecientes(false)}
          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-white font-medium transition-all"
        >
          Ver {pagosFiltrados.length - 30} pagos más antiguos
        </button>
      )}
    </div>
  );
};

// ========== SECCIÓN 2: PAGOS AL INVERSIONISTA (3 PANELES DINÁMICOS) ==========
const SeccionPagosInversionista = ({ data }) => {
  const [mostrarTodosPagos, setMostrarTodosPagos] = useState(false);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No definida';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  // Si no hay inversión
  if (!data.inversion) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Detalle de Inversión
          </h3>
          <p className="text-gray-400">
            Este vehículo no tiene un plan de inversión configurado.
          </p>
        </div>

        <div className="bg-yellow-500/10 rounded-xl p-6 border border-yellow-500/30">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <p className="text-yellow-400 font-bold">Sin Inversión Asignada</p>
          </div>
          <p className="text-gray-300 text-sm">
            Para configurar un plan de inversión, ve a la página de detalle del vehículo y usa la calculadora de inversión.
          </p>
        </div>
      </div>
    );
  }

  const modeloNegocio = data.inversion.modelo_negocio || 'SI_LEGADO';

  // ========== PANEL A: SI_LEGADO ==========
  if (modeloNegocio === 'SI_LEGADO') {
    const pagoMensual = 8000;
    const plazoMeses = data.inversion.plazo_para_inversionistas || 62;
    const mesesPagados = data.estadisticas?.meses_inversionista_pagados || 0;
    const totalPagado = mesesPagados * pagoMensual;
    const progreso = (mesesPagados / plazoMeses) * 100;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Detalle de Inversión
          </h3>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm font-bold">
              🏛️ SI Legado - Vehículo Completo
            </span>
          </div>
        </div>

        {/* Información del Inversionista */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <User className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Inversionista</p>
              <p className="text-xl font-bold text-white">
                {data.inversion.inversionista_nombre || 'Sin asignar'}
              </p>
              {data.inversion.inversionista_email && (
                <p className="text-sm text-gray-400">{data.inversion.inversionista_email}</p>
              )}
            </div>
          </div>

          {/* Grid de Info */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Pago Mensual Fijo</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(pagoMensual)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Plazo del Contrato</p>
              <p className="text-2xl font-bold text-white">{plazoMeses} meses</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Meses Pagados</p>
              <p className="text-2xl font-bold text-blue-400">{mesesPagados}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Meses Pendientes</p>
              <p className="text-2xl font-bold text-orange-400">{plazoMeses - mesesPagados}</p>
            </div>
          </div>
        </div>

        {/* Progreso Visual */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-bold">Progreso del Contrato</p>
            <p className="text-2xl font-bold text-purple-400">{progreso.toFixed(1)}%</p>
          </div>
          
          <div className="w-full bg-gray-800 rounded-full h-6 overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-700"
              style={{ width: `${progreso}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
              <p className="text-xs text-gray-400 mb-1">Total Pagado</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(totalPagado)}</p>
            </div>
            <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
              <p className="text-xs text-gray-400 mb-1">Total Pendiente</p>
              <p className="text-xl font-bold text-orange-400">
                {formatCurrency((plazoMeses - mesesPagados) * pagoMensual)}
              </p>
            </div>
          </div>
        </div>

        {/* Historial de Pagos */}
        {data.pagos_inversionista && data.pagos_inversionista.length > 0 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-bold text-white mb-4">Historial de Pagos al Inversionista</h4>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data.pagos_inversionista
                .slice(0, mostrarTodosPagos ? undefined : 10)
                .map((pago, index) => (
                  <div
                    key={index}
                    className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">
                          Mes {pago.mes_pago} - {formatDate(pago.fecha_programada)}
                        </p>
                        <p className="text-sm text-gray-400">
                          {pago.metodo_pago || 'Método no especificado'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          pago.status === 'Pagado'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                            : pago.status === 'Pendiente'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                            : 'bg-red-500/20 text-red-400 border border-red-500/50'
                        }`}>
                          {pago.status}
                        </span>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(pago.monto_total)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {!mostrarTodosPagos && data.pagos_inversionista.length > 10 && (
              <button
                onClick={() => setMostrarTodosPagos(true)}
                className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-white text-sm transition-all"
              >
                Ver {data.pagos_inversionista.length - 10} pagos más
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ========== PANEL B: AUTOMANAGER (PLUS 60 / SMART 40) ==========
  if (modeloNegocio === 'AUTOMANAGER' || modeloNegocio === 'PLUS_60' || modeloNegocio === 'SMART_40') {
    const inversionInicial = parseFloat(data.inversion.inversion || 0);
    const totalCorrida = parseFloat(data.inversion.total_corrida || 0);
    const totalRecuperado = parseFloat(data.estadisticas?.total_recaudado || 0);
    const utilidadProyectada = parseFloat(data.inversion.utilidad_empresa || 0);
    const pagoMensual = parseFloat(data.inversion.pago_mensual_inversionista || 0);
    const plazoMeses = data.inversion.plazo_para_inversionistas || 0;
    const progreso = inversionInicial > 0 ? (totalRecuperado / totalCorrida) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Detalle de Inversión
          </h3>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-bold">
              🚀 Inversión Fraccional - AutoManager
            </span>
          </div>
        </div>

        {/* Información del Inversionista */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <User className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Inversionista</p>
              <p className="text-xl font-bold text-white">
                {data.inversion.inversionista_nombre || 'Sin asignar'}
              </p>
              {data.inversion.inversionista_email && (
                <p className="text-sm text-gray-400">{data.inversion.inversionista_email}</p>
              )}
            </div>
          </div>

          {/* Grid de Info Financiera */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Inversión Inicial</p>
              <p className="text-lg font-bold text-blue-400">{formatCurrency(inversionInicial)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Utilidad Proyectada</p>
              <p className="text-lg font-bold text-green-400">{formatCurrency(utilidadProyectada)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Total a Recibir</p>
              <p className="text-lg font-bold text-purple-400">{formatCurrency(totalCorrida)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Pago Mensual</p>
              <p className="text-lg font-bold text-orange-400">{formatCurrency(pagoMensual)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Plazo del Contrato</p>
              <p className="text-lg font-bold text-white">{plazoMeses} meses</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Tasa de Rendimiento</p>
              <p className="text-lg font-bold text-cyan-400">{data.inversion.tasa_rendimiento}%</p>
            </div>
          </div>
        </div>

        {/* Gráfico de Recuperación */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-bold">Progreso de Recuperación</p>
            <p className="text-3xl font-bold text-purple-400">{progreso.toFixed(1)}%</p>
          </div>
          
          <div className="w-full bg-gray-800 rounded-full h-6 overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progreso, 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
              <p className="text-xs text-gray-400 mb-1">Recuperado</p>
              <p className="text-lg font-bold text-green-400">{formatCurrency(totalRecuperado)}</p>
            </div>
            <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
              <p className="text-xs text-gray-400 mb-1">Meta Total</p>
              <p className="text-lg font-bold text-purple-400">{formatCurrency(totalCorrida)}</p>
            </div>
            <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
              <p className="text-xs text-gray-400 mb-1">Por Recuperar</p>
              <p className="text-lg font-bold text-orange-400">
                {formatCurrency(totalCorrida - totalRecuperado)}
              </p>
            </div>
          </div>
        </div>

        {/* Historial de Pagos */}
        {data.pagos_inversionista && data.pagos_inversionista.length > 0 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-bold text-white mb-4">Historial de Pagos al Inversionista</h4>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data.pagos_inversionista
                .slice(0, mostrarTodosPagos ? undefined : 10)
                .map((pago, index) => (
                  <div
                    key={index}
                    className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">
                          Mes {pago.mes_pago} - {formatDate(pago.fecha_programada)}
                        </p>
                        <p className="text-sm text-gray-400">
                          {pago.metodo_pago || 'Método no especificado'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          pago.status === 'Pagado'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                            : pago.status === 'Pendiente'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                            : 'bg-red-500/20 text-red-400 border border-red-500/50'
                        }`}>
                          {pago.status}
                        </span>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(pago.monto_total)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {!mostrarTodosPagos && data.pagos_inversionista.length > 10 && (
              <button
                onClick={() => setMostrarTodosPagos(true)}
                className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-white text-sm transition-all"
              >
                Ver {data.pagos_inversionista.length - 10} pagos más
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ========== PANEL C: SD (SOCIO DUEÑO) ==========
  if (modeloNegocio === 'SD' || modeloNegocio === 'SOCIO_DUENO') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Detalle de Inversión
          </h3>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-sm font-bold">
              🤝 Socio Dueño (SD)
            </span>
          </div>
        </div>

        {/* Mensaje Informativo */}
        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-8 border-2 border-yellow-500/30">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-white mb-2">
                Modelo Socio Dueño
              </h4>
              <p className="text-gray-300 leading-relaxed">
                Este vehículo opera bajo el plan <strong className="text-yellow-400">"Socio Dueño"</strong>. 
                Los pagos se realizan a un acreedor externo y no generan pagos a inversionistas internos.
              </p>
            </div>
          </div>

          <div className="bg-white/5 rounded-lg p-4 mt-4">
            <p className="text-sm text-gray-400 mb-2">📋 Características del modelo SD:</p>
            <ul className="text-sm text-gray-300 space-y-1 ml-4">
              <li>• Vehículo en propiedad del socio</li>
              <li>• Pagos directos a acreedor externo</li>
              <li>• Sin retorno de inversión a inversionistas</li>
              <li>• Utilidades para el socio dueño</li>
            </ul>
          </div>
        </div>

        {/* Info Básica si está disponible */}
        {data.inversion.inversionista_nombre && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <User className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase">Socio Dueño</p>
                <p className="text-xl font-bold text-white">
                  {data.inversion.inversionista_nombre}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback por si hay un modelo desconocido
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">
          Detalle de Inversión
        </h3>
        <p className="text-gray-400">
          Modelo: {modeloNegocio}
        </p>
      </div>

      <div className="bg-red-500/10 rounded-xl p-6 border border-red-500/30">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <p className="text-red-400 font-bold">Modelo de negocio no reconocido</p>
        </div>
        <p className="text-gray-300 text-sm mt-2">
          El modelo "{modeloNegocio}" no está configurado en el sistema.
        </p>
      </div>
    </div>
  );
};

// ========== SECCIÓN 3: GASTOS OPERATIVOS (TABS CON LISTAS) ==========
const SeccionGastosOperativos = ({ data }) => {
  const [tabActivo, setTabActivo] = useState('mantenimientos');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  // Filtrar mantenimientos
  const mantenimientosFiltrados = data.mantenimientos?.filter(mant => {
    if (filtroEstado === 'todos') return true;
    return mant.estado === filtroEstado;
  }) || [];

  // Filtrar siniestros
  const siniestrosFiltrados = data.siniestros?.filter(sin => {
    if (filtroEstado === 'todos') return true;
    return sin.estado === filtroEstado;
  }) || [];

  // Estados de mantenimiento
  const estadosMantenimiento = [...new Set(data.mantenimientos?.map(m => m.estado) || [])];
  
  // Estados de siniestros
  const estadosSiniestros = [...new Set(data.siniestros?.map(s => s.estado) || [])];

  const getEstadoBadge = (estado) => {
    const badges = {
      'Completado': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
      'Pendiente': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
      'Programado': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
      'En Proceso': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
      'Resuelto': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
      'Reportado': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' }
    };

    const badge = badges[estado] || { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' };

    return (
      <span className={`px-3 py-1 rounded-full ${badge.bg} ${badge.text} border ${badge.border} text-xs font-bold`}>
        {estado}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">
          Gastos Operativos
        </h3>
        <p className="text-gray-400">
          Historial completo de mantenimientos y siniestros del vehículo
        </p>
      </div>

      {/* Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl p-6 border-2 border-orange-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/20 rounded-lg">
                <Wrench className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase">Total Mantenimientos</p>
                <p className="text-3xl font-bold text-orange-400">
                  {formatCurrency(data.estadisticas?.total_mantenimientos)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{data.mantenimientos?.length || 0} servicios</span>
            <span className="text-gray-400">
              Promedio: {data.mantenimientos?.length > 0 
                ? formatCurrency(parseFloat(data.estadisticas?.total_mantenimientos || 0) / data.mantenimientos.length)
                : '$0'
              }
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 rounded-xl p-6 border-2 border-red-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase">Total Siniestros</p>
                <p className="text-3xl font-bold text-red-400">
                  {data.estadisticas?.total_siniestros || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{data.siniestros?.length || 0} incidentes</span>
            <span className={`font-bold ${
              (data.siniestros?.length || 0) === 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {(data.siniestros?.length || 0) === 0 ? '✓ Sin incidentes' : '⚠ Con incidentes'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setTabActivo('mantenimientos');
            setFiltroEstado('todos');
          }}
          className={`flex-1 py-3 rounded-xl font-bold transition-all ${
            tabActivo === 'mantenimientos'
              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Wrench className="w-5 h-5" />
            <span>Mantenimientos ({data.mantenimientos?.length || 0})</span>
          </div>
        </button>

        <button
          onClick={() => {
            setTabActivo('siniestros');
            setFiltroEstado('todos');
          }}
          className={`flex-1 py-3 rounded-xl font-bold transition-all ${
            tabActivo === 'siniestros'
              ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Siniestros ({data.siniestros?.length || 0})</span>
          </div>
        </button>
      </div>

      {/* Filtro de Estado */}
      <div className="flex items-center gap-3">
        <Filter className="w-5 h-5 text-gray-400" />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="todos">Todos los estados</option>
          {tabActivo === 'mantenimientos' 
            ? estadosMantenimiento.map(estado => (
                <option key={estado} value={estado}>{estado}</option>
              ))
            : estadosSiniestros.map(estado => (
                <option key={estado} value={estado}>{estado}</option>
              ))
          }
        </select>
        <span className="text-gray-400 text-sm">
          {tabActivo === 'mantenimientos' 
            ? `${mantenimientosFiltrados.length} resultados`
            : `${siniestrosFiltrados.length} resultados`
          }
        </span>
      </div>

      {/* Contenido de Tabs */}
      <div className="bg-white/5 rounded-xl border border-white/10">
        {/* TAB MANTENIMIENTOS */}
        {tabActivo === 'mantenimientos' && (
          <div className="p-4">
            {mantenimientosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4 opacity-50" />
                <p className="text-gray-400">No hay mantenimientos con este filtro</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {mantenimientosFiltrados.map((mant, index) => (
                  <div
                    key={index}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg flex-shrink-0">
                          <Wrench className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-white font-bold">{mant.tipo_servicio}</p>
                          <p className="text-sm text-gray-400">{mant.taller || 'Taller no especificado'}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(mant.fecha_realizada || mant.fecha_programada)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getEstadoBadge(mant.estado)}
                        <div className="text-right">
                          <p className="text-xl font-bold text-white">
                            {formatCurrency(mant.costo_total)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Distribución de gastos */}
                    {mant.distribucion && (
                      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/10">
                        <div className="bg-purple-500/10 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Fondo</p>
                          <p className="text-sm font-bold text-white">
                            {formatCurrency(mant.distribucion.pagado_fondo_mantenimiento)}
                          </p>
                        </div>
                        <div className="bg-blue-500/10 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Póliza</p>
                          <p className="text-sm font-bold text-white">
                            {formatCurrency(mant.distribucion.pagado_poliza)}
                          </p>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Empresa</p>
                          <p className="text-sm font-bold text-white">
                            {formatCurrency(mant.distribucion.pagado_empresa)}
                          </p>
                        </div>
                        <div className="bg-orange-500/10 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Conductor</p>
                          <p className="text-sm font-bold text-white">
                            {formatCurrency(mant.distribucion.pagado_conductor)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB SINIESTROS */}
        {tabActivo === 'siniestros' && (
          <div className="p-4">
            {siniestrosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                {data.siniestros?.length === 0 ? (
                  <>
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <p className="text-green-400 font-bold text-lg">¡Excelente!</p>
                    <p className="text-gray-400">Este vehículo no tiene siniestros registrados</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4 opacity-50" />
                    <p className="text-gray-400">No hay siniestros con este filtro</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {siniestrosFiltrados.map((siniestro, index) => (
                  <div
                    key={index}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="text-white font-bold">{siniestro.tipo_siniestro}</p>
                          <p className="text-sm text-gray-400">
                            {siniestro.conductor_nombre || 'Conductor no especificado'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(siniestro.fecha_incidente)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getEstadoBadge(siniestro.estado)}
                        {siniestro.costo_final && (
                          <div className="text-right">
                            <p className="text-xl font-bold text-white">
                              {formatCurrency(siniestro.costo_final)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Descripción */}
                    {siniestro.descripcion && (
                      <div className="bg-white/5 rounded-lg p-3 mt-3">
                        <p className="text-sm text-gray-300">{siniestro.descripcion}</p>
                      </div>
                    )}

                    {/* Fotos */}
                    {siniestro.fotos_urls && JSON.parse(siniestro.fotos_urls).length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {JSON.parse(siniestro.fotos_urls).slice(0, 3).map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Foto ${i + 1}`}
                            className="w-20 h-20 object-cover rounded-lg border border-white/20 cursor-pointer hover:scale-110 transition-transform"
                            onClick={() => window.open(url, '_blank')}
                          />
                        ))}
                        {JSON.parse(siniestro.fotos_urls).length > 3 && (
                          <div className="w-20 h-20 bg-white/10 rounded-lg border border-white/20 flex items-center justify-center">
                            <p className="text-white/60 text-xs">
                              +{JSON.parse(siniestro.fotos_urls).length - 3}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RentabilidadVehiculo;