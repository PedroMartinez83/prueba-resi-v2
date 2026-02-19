import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Wrench, AlertTriangle, Users, Calendar, DollarSign, Clock, CheckCircle, XCircle, AlertCircle, Download, Filter, FileText, Shield, Activity, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { GenerarPDFButton } from '../../../components/reportes/VehiculoPDFReport';
import adminService from '../../../services/adminService';  // ← AGREGAR ESTA LÍNEA

const VehiculoHistorial = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('financiero');
  const [historialData, setHistorialData] = useState(null);
  
  // ========== REFERENCIAS PARA CAPTURAR GRÁFICOS ==========
  const graficoRecuperacionRef = useRef(null);
  const graficoPieRef = useRef(null);
  const [imagenesGraficos, setImagenesGraficos] = useState({
    recuperacion: null,
    distribucion: null,
    qrCode: null
  });

  useEffect(() => {
    cargarHistorial();
  }, [id]);


  const cargarHistorial = async () => {
  try {
    setLoading(true);
    
    // Obtener el vehículo para conseguir el número de serie
    const vehiculoData = await adminService.getVehiculoById(id);
    
    if (!vehiculoData.success) {
      throw new Error('No se pudo obtener información del vehículo');
    }

    // El backend devuelve NumeroSerie en PascalCase
    const numeroSerie = vehiculoData.vehiculo?.NumeroSerie;

    const historial = numeroSerie
      ? await adminService.getHistorialVehiculo(numeroSerie)
      : await adminService.getHistorialVehiculoById(id);
    
    if (historial.success) {
      setHistorialData(historial);
    } else {
      throw new Error(historial.message || 'Error al cargar historial');
    }
  } catch (error) {
    console.error('Error al cargar historial:', error);
    alert('Error al cargar el historial del vehículo: ' + error.message);
  } finally {
    setLoading(false);
  }
};
  // ========== CAPTURAR GRÁFICOS COMO IMÁGENES ==========
  const capturarGraficos = async () => {
    try {
      let recuperacionImg = null;
      let distribucionImg = null;

      // Capturar gráfico de recuperación (si está visible)
      if (graficoRecuperacionRef.current) {
        recuperacionImg = await toPng(graficoRecuperacionRef.current, {
          cacheBust: true,
          backgroundColor: '#0F172A',
          pixelRatio: 2
        });
      }

      // Capturar gráfico de pie (si está visible)
      if (graficoPieRef.current) {
        distribucionImg = await toPng(graficoPieRef.current, {
          cacheBust: true,
          backgroundColor: '#0F172A',
          pixelRatio: 2
        });
      }

      setImagenesGraficos(prev => ({
        ...prev,
        recuperacion: recuperacionImg,
        distribucion: distribucionImg
      }));

      return {
        recuperacion: recuperacionImg,
        distribucion: distribucionImg,
        qrCode: imagenesGraficos.qrCode
      };
    } catch (error) {
      console.error('Error capturando gráficos:', error);
      return null;
    }
  };

  // ========== LÓGICA INTELIGENTE: LÍNEA DE TIEMPO DE PAGOS ==========
  const generarLineaDeTiempoPagos = () => {
    if (!historialData?.asignacion_actual) return [];

    const fechaInicio = new Date(historialData.asignacion_actual.fecha_inicio);
    const hoy = new Date();
    const timeline = [];

    for (let dia = new Date(fechaInicio); dia <= hoy; dia.setDate(dia.getDate() + 1)) {
      const fechaDia = dia.toISOString().split('T')[0];
      
      // Buscar pago para este día
      const pagoEncontrado = historialData.pagos?.find(p => 
        p.fecha_pago && p.fecha_pago.startsWith(fechaDia)
      );

      // Excluir domingos (día 0)
      if (dia.getDay() !== 0) {
        if (pagoEncontrado) {
          timeline.push({
            id: pagoEncontrado.id,
            fecha: fechaDia,
            estado: 'Pagado',
            monto: parseFloat(pagoEncontrado.monto_total || 0),
            metodo: pagoEncontrado.metodo_pago,
            conductor: pagoEncontrado.nombre_conductor,
            tipo: 'real'
          });
        } else {
          timeline.push({
            id: `faltante-${fechaDia}`,
            fecha: fechaDia,
            estado: 'Faltante',
            monto: parseFloat(historialData.estadisticas?.promedio_renta_diaria || 0),
            conductor: historialData.asignacion_actual.nombre_conductor,
            tipo: 'faltante'
          });
        }
      }
    }

    return timeline.reverse();
  };

  // Preparar datos para gráfico de recuperación
  const prepararDatosRecuperacion = () => {
    if (!historialData?.pagos) return [];

    const pagosOrdenados = [...historialData.pagos].sort((a, b) => 
      new Date(a.fecha_pago) - new Date(b.fecha_pago)
    );

    let acumulado = 0;
    const datos = pagosOrdenados.map((pago, index) => {
      acumulado += parseFloat(pago.monto_total || 0);
      return {
        fecha: new Date(pago.fecha_pago).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
        acumulado: acumulado,
        costo: historialData.estadisticas?.costo_adquisicion || 0
      };
    });

    return datos;
  };

  // Preparar datos para distribución de gastos
  const prepararDatosDistribucionGastos = () => {
    if (!historialData?.mantenimientos) return [];

    const distribucion = {
      fondo: 0,
      poliza: 0,
      empresa: 0,
      conductor: 0
    };

    historialData.mantenimientos.forEach(mant => {
      if (mant.distribucion) {
        distribucion.fondo += parseFloat(mant.distribucion.pagado_fondo_mantenimiento || 0);
        distribucion.poliza += parseFloat(mant.distribucion.pagado_poliza || 0);
        distribucion.empresa += parseFloat(mant.distribucion.pagado_empresa || 0);
        distribucion.conductor += parseFloat(mant.distribucion.pagado_conductor || 0);
      }
    });

    return [
      { nombre: 'Fondo', monto: distribucion.fondo, color: '#8b5cf6' },
      { nombre: 'Póliza', monto: distribucion.poliza, color: '#3b82f6' },
      { nombre: 'Empresa', monto: distribucion.empresa, color: '#10b981' },
      { nombre: 'Conductor', monto: distribucion.conductor, color: '#f59e0b' }
    ];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando historial...</div>
      </div>
    );
  }

  if (!historialData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">No se encontró información del vehículo</div>
      </div>
    );
  }

  const tabs = [
    { id: 'financiero', label: 'Financiero', icon: DollarSign, color: 'from-green-500 to-emerald-600' },
    { id: 'pagos', label: 'Pagos de Renta', icon: Calendar, color: 'from-blue-500 to-cyan-600' },
    { id: 'mantenimientos', label: 'Mantenimientos', icon: Wrench, color: 'from-orange-500 to-amber-600' },
    { id: 'siniestros', label: 'Siniestros', icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
    { id: 'asignaciones', label: 'Asignaciones', icon: Users, color: 'from-purple-500 to-pink-600' },
    { id: 'disciplina', label: 'Disciplina', icon: Shield, color: 'from-indigo-500 to-blue-600' },
    { id: 'auditoria', label: 'Auditoría', icon: Activity, color: 'from-gray-500 to-slate-600' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver</span>
          </button>

          <GenerarPDFButton 
            data={historialData} 
            onPrepareImages={capturarGraficos}
            imagenesGraficos={imagenesGraficos}
          />
        </div>

        {/* Título y Estadísticas Principales */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-white mb-4">
            Historial del Vehículo {historialData.vehiculo?.numero_vehiculo}
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              icon={DollarSign}
              label="Inversión Inicial"
              value={`$${parseFloat(historialData.estadisticas?.costo_adquisicion || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
              color="from-blue-500/20 to-cyan-600/20"
              iconColor="text-blue-400"
            />
            
            <StatCard
              icon={TrendingUp}
              label="Total Recaudado"
              value={`$${parseFloat(historialData.estadisticas?.total_recaudado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
              color="from-green-500/20 to-emerald-600/20"
              iconColor="text-green-400"
            />
            
            <StatCard
              icon={Activity}
              label="ROI"
              value={`${parseFloat(historialData.estadisticas?.roi_porcentaje || 0).toFixed(2)}%`}
              color="from-purple-500/20 to-pink-600/20"
              iconColor="text-purple-400"
            />
            
            <StatCard
              icon={CheckCircle}
              label="Rentabilidad Neta"
              value={`$${parseFloat(historialData.estadisticas?.rentabilidad_neta || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
              color="from-indigo-500/20 to-blue-600/20"
              iconColor="text-indigo-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <StatCard
              icon={Wrench}
              label="Total Mantenimientos"
              value={`$${parseFloat(historialData.estadisticas?.total_mantenimientos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
              color="from-orange-500/20 to-amber-600/20"
              iconColor="text-orange-400"
            />
            
            <StatCard
              icon={Users}
              label="Pagado a Inversionista"
              value={`$${parseFloat(historialData.estadisticas?.total_pagado_inversionista || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
              color="from-yellow-500/20 to-orange-600/20"
              iconColor="text-yellow-400"
            />
            
            <StatCard
              icon={Calendar}
              label="Días Operando"
              value={historialData.estadisticas?.dias_operando || 0}
              color="from-teal-500/20 to-cyan-600/20"
              iconColor="text-teal-400"
            />
            
            <StatCard
              icon={AlertTriangle}
              label="Total Siniestros"
              value={historialData.estadisticas?.total_siniestros || 0}
              color="from-red-500/20 to-rose-600/20"
              iconColor="text-red-400"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                    : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white/60 hover:text-white hover:bg-white/20'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido de Tabs */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
          {activeTab === 'financiero' && (
            <TabFinanciero 
              data={historialData} 
              datosGrafico={prepararDatosRecuperacion()}
              graficoRef={graficoRecuperacionRef}
            />
          )}
          {activeTab === 'pagos' && <TabPagos data={historialData} lineaDeTiempo={generarLineaDeTiempoPagos()} />}
          {activeTab === 'mantenimientos' && (
            <TabMantenimientos 
              data={historialData} 
              datosDistribucion={prepararDatosDistribucionGastos()}
              graficoPieRef={graficoPieRef}
            />
          )}
          {activeTab === 'siniestros' && <TabSiniestros data={historialData} />}
          {activeTab === 'asignaciones' && <TabAsignaciones data={historialData} />}
          {activeTab === 'disciplina' && <TabDisciplina data={historialData} />}
          {activeTab === 'auditoria' && <TabAuditoria data={historialData} />}
        </div>
      </div>
    </div>
  );
};

// ========== COMPONENTE: STAT CARD ==========
const StatCard = ({ icon: Icon, label, value, color, iconColor }) => (
  <div className={`bg-gradient-to-br ${color} backdrop-blur-sm border border-white/20 rounded-xl p-4`}>
    <div className="flex items-center gap-3">
      <Icon className={`w-8 h-8 ${iconColor}`} />
      <div>
        <p className="text-white/60 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold">{value}</p>
      </div>
    </div>
  </div>
);

// ========== TAB: FINANCIERO (ACTUALIZADO CON REF) ==========
const TabFinanciero = ({ data, datosGrafico, graficoRef }) => {
  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

  const datosInversionista = [
    {
      nombre: 'Pagado',
      value: data.estadisticas?.meses_inversionista_pagados || 0,
      color: '#10b981'
    },
    {
      nombre: 'Pendiente',
      value: data.estadisticas?.meses_inversionista_pendientes || 0,
      color: '#f59e0b'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Información de Inversión */}
      {data.inversion && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Información de Inversión
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-white/60 text-sm">Inversionista</p>
              <p className="text-white text-lg font-bold">{data.inversion.inversionista_nombre || 'N/A'}</p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-white/60 text-sm">Modelo de Negocio</p>
              <p className="text-white text-lg font-bold">{data.inversion.modelo_negocio}</p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-white/60 text-sm">Tasa de Rendimiento</p>
              <p className="text-white text-lg font-bold">{data.inversion.tasa_rendimiento}%</p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-white/60 text-sm">Pago Mensual</p>
              <p className="text-white text-lg font-bold">
                ${parseFloat(data.inversion.pago_mensual_inversionista || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-white/60 text-sm">Plazo (meses)</p>
              <p className="text-white text-lg font-bold">{data.inversion.plazo_para_inversionistas}</p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-white/60 text-sm">Estado</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                data.inversion.status_inversion === 'Activa' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
              }`}>
                {data.inversion.status_inversion}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de Recuperación - CON REF PARA CAPTURA */}
      <div 
        ref={graficoRef}
        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
      >
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-400" />
          Recuperación vs Inversión Inicial
        </h3>
        
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={datosGrafico}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="fecha" stroke="rgba(255,255,255,0.6)" />
            <YAxis stroke="rgba(255,255,255,0.6)" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(0,0,0,0.8)', 
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#fff'
              }}
              formatter={(value) => [`$${parseFloat(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, '']}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="acumulado" 
              stroke="#10b981" 
              strokeWidth={3}
              name="Recuperado"
              dot={{ fill: '#10b981', r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="costo" 
              stroke="#ef4444" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Inversión Inicial"
              dot={{ fill: '#ef4444', r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pagos al Inversionista */}
      {data.pagos_inversionista && data.pagos_inversionista.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Historial de Pagos al Inversionista</h3>
          
          <div className="space-y-3">
            {data.pagos_inversionista.slice(0, 10).map((pago, index) => (
              <div
                key={index}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">
                      Mes {pago.mes_pago} - {new Date(pago.fecha_programada).toLocaleDateString('es-MX', { 
                        year: 'numeric', 
                        month: 'long'
                      })}
                    </p>
                    <p className="text-white/60 text-sm">{pago.metodo_pago || 'N/A'}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      pago.status === 'Pagado' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : pago.status === 'Pendiente'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                        : 'bg-red-500/20 text-red-400 border border-red-500/50'
                    }`}>
                      {pago.status}
                    </span>
                    
                    <div className="text-right">
                      <p className="text-white text-xl font-bold">
                        ${parseFloat(pago.monto_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ========== TAB: PAGOS (SIN CAMBIOS) ==========
const TabPagos = ({ data, lineaDeTiempo }) => {
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const pagosFiltrados = lineaDeTiempo.filter(pago => {
    if (filtroEstado === 'todos') return true;
    return pago.estado === filtroEstado;
  });

  const estadisticas = {
    pagados: lineaDeTiempo.filter(p => p.estado === 'Pagado').length,
    faltantes: lineaDeTiempo.filter(p => p.estado === 'Faltante').length,
    montoTotal: lineaDeTiempo
      .filter(p => p.estado === 'Pagado')
      .reduce((acc, p) => acc + parseFloat(p.monto || 0), 0)
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'Pagado': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50', icon: CheckCircle },
      'Faltante': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50', icon: XCircle }
    };

    const badge = badges[estado] || badges['Faltante'];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${badge.bg} ${badge.text} border ${badge.border} text-sm font-medium`}>
        <Icon className="w-4 h-4" />
        {estado}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-500/10 backdrop-blur-sm border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Pagos Realizados</p>
              <p className="text-white text-3xl font-bold">{estadisticas.pagados}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Pagos Faltantes</p>
              <p className="text-white text-3xl font-bold">{estadisticas.faltantes}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <div className="bg-purple-500/10 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Monto Total</p>
              <p className="text-white text-2xl font-bold">
                ${estadisticas.montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <Filter className="w-5 h-5 text-white/60" />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="todos">Todos</option>
          <option value="Pagado">Pagados</option>
          <option value="Faltante">Faltantes</option>
        </select>
        <span className="text-white/60">{pagosFiltrados.length} registros</span>
      </div>

      {/* Lista de Pagos */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {pagosFiltrados.map((pago, index) => (
          <div
            key={pago.id}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-purple-500/20 rounded-lg p-3">
                  <Calendar className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium">
                    {new Date(pago.fecha).toLocaleDateString('es-MX', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-white/60 text-sm">
                    {pago.conductor} {pago.metodo && `• ${pago.metodo}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {getEstadoBadge(pago.estado)}
                <div className="text-right">
                  <p className="text-white text-xl font-bold">
                    ${parseFloat(pago.monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {pagosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No hay registros con este filtro</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ========== TAB: MANTENIMIENTOS (ACTUALIZADO CON REF) ==========
const TabMantenimientos = ({ data, datosDistribucion, graficoPieRef }) => {
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const mantenimientosFiltrados = data.mantenimientos?.filter(mant => {
    if (filtroTipo === 'todos') return true;
    return mant.tipo_servicio === filtroTipo;
  }) || [];

  const tiposServicio = [...new Set(data.mantenimientos?.map(m => m.tipo_servicio) || [])];

  const getEstadoBadge = (estado) => {
    const badges = {
      'Completado': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
      'Pendiente': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
      'Programado': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50' },
      'En Proceso': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' }
    };

    const badge = badges[estado] || badges['Pendiente'];

    return (
      <span className={`px-3 py-1 rounded-full ${badge.bg} ${badge.text} border ${badge.border} text-sm font-medium`}>
        {estado}
      </span>
    );
  };

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Gráfico de Distribución - CON REF PARA CAPTURA */}
      <div 
        ref={graficoPieRef}
        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
      >
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-blue-400" />
          Distribución de Gastos de Mantenimiento
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={datosDistribucion}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.nombre}
                outerRadius={80}
                fill="#8884d8"
                dataKey="monto"
              >
                {datosDistribucion.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value) => [`$${parseFloat(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'Monto']}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 gap-4">
            {datosDistribucion.map((item, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <p className="text-white/60 text-sm">{item.nombre}</p>
                </div>
                <p className="text-white text-lg font-bold">
                  ${item.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <Filter className="w-5 h-5 text-white/60" />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="todos">Todos los servicios</option>
          {tiposServicio.map(tipo => (
            <option key={tipo} value={tipo}>{tipo}</option>
          ))}
        </select>
        <span className="text-white/60">{mantenimientosFiltrados.length} mantenimientos</span>
      </div>

      {/* Lista de Mantenimientos */}
      <div className="space-y-3">
        {mantenimientosFiltrados.map((mant, index) => (
          <div
            key={index}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-4">
                <div className="bg-blue-500/20 rounded-lg p-3">
                  <Wrench className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-lg">{mant.tipo_servicio}</p>
                  <p className="text-white/60 text-sm">{mant.taller || 'Taller no especificado'}</p>
                  <p className="text-white/40 text-sm mt-1">
                    {new Date(mant.fecha_realizada || mant.fecha_programada).toLocaleDateString('es-MX', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getEstadoBadge(mant.estado)}
                <div className="text-right">
                  <p className="text-white text-2xl font-bold">
                    ${parseFloat(mant.costo_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                
                {/* ACCIONES CONTEXTUALES */}
                {mant.estado === 'Programado' && (
                  <button
                    onClick={() => alert(`Ingresar a taller: ${mant.tipo_servicio}`)}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    Ingresar
                  </button>
                )}
                
                {mant.estado === 'En Proceso' && (
                  <button
                    onClick={() => alert(`Finalizar servicio: ${mant.tipo_servicio}`)}
                    className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    Finalizar
                  </button>
                )}
              </div>
            </div>

            {mant.distribucion && (
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/10">
                <div className="bg-purple-500/10 rounded-lg p-2">
                  <p className="text-white/60 text-xs">Fondo</p>
                  <p className="text-white text-sm font-medium">
                    ${parseFloat(mant.distribucion.pagado_fondo_mantenimiento || 0).toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-2">
                  <p className="text-white/60 text-xs">Póliza</p>
                  <p className="text-white text-sm font-medium">
                    ${parseFloat(mant.distribucion.pagado_poliza || 0).toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="bg-green-500/10 rounded-lg p-2">
                  <p className="text-white/60 text-xs">Empresa</p>
                  <p className="text-white text-sm font-medium">
                    ${parseFloat(mant.distribucion.pagado_empresa || 0).toLocaleString('es-MX')}
                  </p>
                </div>
                <div className="bg-orange-500/10 rounded-lg p-2">
                  <p className="text-white/60 text-xs">Conductor</p>
                  <p className="text-white text-sm font-medium">
                    ${parseFloat(mant.distribucion.pagado_conductor || 0).toLocaleString('es-MX')}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}

        {mantenimientosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No hay mantenimientos con este filtro</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ========== TAB: SINIESTROS (SIN CAMBIOS) ==========
const TabSiniestros = ({ data }) => {
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const siniestrosFiltrados = data.siniestros?.filter(sin => {
    if (filtroEstado === 'todos') return true;
    return sin.estado === filtroEstado;
  }) || [];

  const getEstadoBadge = (estado) => {
    const badges = {
      'Resuelto': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' },
      'En Proceso': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' },
      'Reportado': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' }
    };

    const badge = badges[estado] || badges['Reportado'];

    return (
      <span className={`px-3 py-1 rounded-full ${badge.bg} ${badge.text} border ${badge.border} text-sm font-medium`}>
        {estado}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center gap-4">
        <Filter className="w-5 h-5 text-white/60" />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="todos">Todos los estados</option>
          <option value="Reportado">Reportado</option>
          <option value="En Proceso">En Proceso</option>
          <option value="Resuelto">Resuelto</option>
        </select>
        <span className="text-white/60">{siniestrosFiltrados.length} siniestros</span>
      </div>

      {/* Lista de Siniestros */}
      <div className="space-y-3">
        {siniestrosFiltrados.map((siniestro, index) => (
          <div
            key={index}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-4">
                <div className="bg-red-500/20 rounded-lg p-3">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-lg">{siniestro.tipo_siniestro}</p>
                  <p className="text-white/60 text-sm">{siniestro.conductor_nombre || 'Conductor no especificado'}</p>
                  <p className="text-white/40 text-sm mt-1">
                    {new Date(siniestro.fecha_incidente).toLocaleDateString('es-MX', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getEstadoBadge(siniestro.estado)}
                {siniestro.costo_final && (
                  <div className="text-right">
                    <p className="text-white text-2xl font-bold">
                      ${parseFloat(siniestro.costo_final).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                
                {/* ACCIÓN CONTEXTUAL */}
                {siniestro.estado === 'Reportado' && (
                  <button
                    onClick={() => alert(`Gestionar siniestro #${siniestro.folio_siniestro}`)}
                    className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    Gestionar
                  </button>
                )}
              </div>
            </div>

            {siniestro.descripcion && (
              <div className="bg-white/5 rounded-lg p-3 mt-3">
                <p className="text-white/80 text-sm">{siniestro.descripcion}</p>
              </div>
            )}

            {siniestro.fotos_urls && siniestro.fotos_urls.length > 0 && (
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
                    <p className="text-white/60 text-sm">+{JSON.parse(siniestro.fotos_urls).length - 3}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {siniestrosFiltrados.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-400/40 mx-auto mb-4" />
            <p className="text-white/60 text-lg">¡Excelente! No hay siniestros registrados</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ========== TAB: ASIGNACIONES (SIN CAMBIOS) ==========
const TabAsignaciones = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <p className="text-white/60">
          <strong className="text-white">Total de conductores:</strong> {data.asignaciones?.length || 0}
        </p>
        <p className="text-white/60 mt-2">
          <strong className="text-white">Días operando:</strong> {data.estadisticas?.dias_operando || 0}
        </p>
      </div>

      {/* Lista de Asignaciones */}
      <div className="space-y-3">
        {data.asignaciones?.map((asignacion, index) => (
          <div
            key={index}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-purple-500/20 rounded-lg p-3">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-lg">{asignacion.nombre_conductor}</p>
                  <p className="text-white/60 text-sm">
                    {new Date(asignacion.fecha_inicio).toLocaleDateString('es-MX')} 
                    {asignacion.fecha_fin && ` - ${new Date(asignacion.fecha_fin).toLocaleDateString('es-MX')}`}
                  </p>
                  <p className="text-white/40 text-sm">
                    {asignacion.dias_con_vehiculo || 0} días • ${parseFloat(asignacion.renta_diaria || 0).toLocaleString('es-MX')}/día
                  </p>
                </div>
              </div>

              <div className="text-right">
                {asignacion.activa && (
                  <span className="inline-block px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/50 text-sm font-medium mb-2">
                    Activo
                  </span>
                )}
                {asignacion.url_contrato_digital && (
                  <a
                    href={asignacion.url_contrato_digital}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-400 hover:text-blue-300 text-sm mt-1"
                  >
                    Ver contrato
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {(!data.asignaciones || data.asignaciones.length === 0) && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No hay asignaciones registradas</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ========== TAB: DISCIPLINA (SIN CAMBIOS) ==========
const TabDisciplina = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* Amonestaciones */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          Amonestaciones
        </h3>
        
        {data.amonestaciones && data.amonestaciones.length > 0 ? (
          <div className="space-y-3">
            {data.amonestaciones.map((amon, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{amon.tipo_amonestacion}</p>
                    <p className="text-white/60 text-sm">{amon.nombre_conductor}</p>
                    <p className="text-white/40 text-sm">
                      {new Date(amon.fecha).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                </div>
                {amon.descripcion && (
                  <p className="text-white/70 text-sm mt-2">{amon.descripcion}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/60 text-center py-8">No hay amonestaciones registradas</p>
        )}
      </div>

      {/* Revisiones */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          Revisiones del Vehículo
        </h3>
        
        {data.revisiones && data.revisiones.length > 0 ? (
          <div className="space-y-3">
            {data.revisiones.map((rev, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">
                      Revisión - {new Date(rev.fecha_programada).toLocaleDateString('es-MX')}
                    </p>
                    <p className="text-white/60 text-sm">{rev.nombre_conductor}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    rev.aprobada 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                      : 'bg-red-500/20 text-red-400 border border-red-500/50'
                  }`}>
                    {rev.aprobada ? 'Aprobada' : 'No Aprobada'}
                  </span>
                </div>
                {rev.comentarios && (
                  <p className="text-white/70 text-sm mt-2">{rev.comentarios}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/60 text-center py-8">No hay revisiones registradas</p>
        )}
      </div>
    </div>
  );
};

// ========== TAB: AUDITORÍA (SIN CAMBIOS) ==========
const TabAuditoria = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-6 h-6 text-gray-400" />
          Historial de Cambios (Últimos 50)
        </h3>
        
        {data.auditoria && data.auditoria.length > 0 ? (
          <div className="space-y-2">
            {data.auditoria.map((audit, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">
                      {audit.campo_modificado}
                    </p>
                    <p className="text-white/60 text-xs">
                      {audit.usuario_email} • {new Date(audit.fecha_modificacion).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-red-400">Antes: {audit.valor_anterior}</p>
                    <p className="text-green-400">Después: {audit.valor_nuevo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-white/60 text-center py-8">No hay cambios registrados</p>
        )}
      </div>
    </div>
  );
};

export default VehiculoHistorial;
