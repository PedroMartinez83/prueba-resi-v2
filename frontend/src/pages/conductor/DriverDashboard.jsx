import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import conductorService from '../../services/conductorService';
import { 
  Car, 
  DollarSign, 
  AlertTriangle,
  CreditCard,
  Wrench,
  Shield,
  Award,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowRight,
  Calendar,
  FileText,
  Video
} from 'lucide-react';

// Función para formatear moneda
const formatCurrency = (amount) => {
  if (typeof amount !== 'number') {
    amount = parseFloat(amount) || 0;
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};



const DriverDashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [misPagos, setMisPagos] = useState([]); // Nuevo estado para pagos

  useEffect(() => {
    cargarDatosCompletos();
  }, []);

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await conductorService.getDashboardData();
      if (response.success) {
        console.log("Datos del Dashboard:", response);
        setDashboardData(response);
      } else {
        throw new Error(response.message || "No se pudieron cargar los datos");
      }
    } catch (err) {
      console.error('Error cargando dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 FUNCIÓN DE CARGA UNIFICADA
  const cargarDatosCompletos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Pedimos Dashboard y Pagos al mismo servicio (conductorService)
      const [dashResponse, pagosResponse] = await Promise.all([
        conductorService.getDashboardData(),
        conductorService.getMisPagos() // 👈 AQUÍ ESTÁ EL CAMBIO CORRECTO
      ]);

      if (dashResponse.success) {
        setDashboardData(dashResponse);
      } else {
        throw new Error(dashResponse.message || "No se pudieron cargar los datos");
      }

      // Guardamos los pagos (validando si viene como array o dentro de .data)
      if (Array.isArray(pagosResponse)) {
        setMisPagos(pagosResponse);
      } else if (pagosResponse.pagos && Array.isArray(pagosResponse.pagos)) {
        setMisPagos(pagosResponse.pagos);
      } else if (pagosResponse.data && Array.isArray(pagosResponse.data)) {
        setMisPagos(pagosResponse.data);
      } else {
        setMisPagos([]); // Fallback
      }

    } catch (err) {
      console.error('Error cargando información:', err);
      // Si falla pagos pero carga dashboard, permitimos mostrar la pantalla
      if (!dashboardData) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- ESTADOS DE CARGA Y ERROR ---
  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center h-[60vh]">
        <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin" />
        <p className="text-gray-400 mt-4">Cargando tu información...</p>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="w-full text-center">
        <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Error al Cargar</h2>
        <p className="text-gray-400 mb-6">{error || 'No se pudieron cargar los datos del dashboard.'}</p>
        <button
          onClick={cargarDatosCompletos}
          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { conductor, vehiculo_asignado, finanzas, estado_rentas, alertas } = dashboardData;
  const revisionDiaria = dashboardData.revision_diaria;
  const mantenimientoPreventivo = alertas?.mantenimiento_preventivo;
  const mantenimientoPlan = alertas?.mantenimiento_plan;
  const kmPreventivoObjetivo = mantenimientoPreventivo?.kilometraje_objetivo || 0;
  const kmPreventivoTexto = kmPreventivoObjetivo
    ? kmPreventivoObjetivo.toLocaleString('es-MX')
    : 'N/D';
  const kmPreventivoDiferencia = Math.abs(mantenimientoPreventivo?.diferencia_km || 0).toLocaleString('es-MX');

// --- EXTRACCIÓN DE DATOS ---

  // =========================================================
  // 🧮 CÁLCULO DE DEUDA REAL (Descontando Pendientes)
  // =========================================================
  
  // 1. Filtramos pagos que el backend aún no cuenta (Pendientes)
  const pagosPendientes = misPagos.filter(p => p.status === 'Pendiente');

  // 2. Calculamos cuánto valen esos pagos
  const montoEnRevision = pagosPendientes.reduce((sum, p) => sum + parseFloat(p.monto_total || 0), 0);
  
  // 3. Calculamos cuántos días cubren (Aproximado)
const diasEnRevision = pagosPendientes.reduce((sum, p) => {
      // Normalizamos las fechas para ignorar horas/zonas horarias
      // Usamos .split('T')[0] para quedarnos solo con YYYY-MM-DD
      const fechaInicioStr = (p.fecha_pago || '').toString().split('T')[0];
      const fechaFinStr = (p.fecha_pago_fin || p.fecha_pago || '').toString().split('T')[0];

      if (fechaInicioStr && fechaFinStr) {
          const inicio = new Date(fechaInicioStr);
          const fin = new Date(fechaFinStr);
          
          // Diferencia en milisegundos
          const diffTime = Math.abs(fin - inicio);
          // Convertimos a días (redondeando hacia arriba por seguridad)
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          return sum + diffDays + 1; // +1 porque el día inicial cuenta
      }
      
      return sum + 1; // Fallback: cuenta como 1 día
  }, 0);

  // 4. Restamos a lo que dice el backend
  const deudaOficial = parseFloat(estado_rentas?.monto_deuda_total || 0);
  const diasOficiales = parseInt(estado_rentas?.rentas_pendientes || 0);

  // Math.max(0, ...) asegura que nunca mostremos deuda negativa
  const deudaReal = Math.max(0, deudaOficial - montoEnRevision);
  const diasReales = Math.max(0, diasOficiales - diasEnRevision);

  // Lógica de visualización de alertas
  const mostrarAlertaDeuda = diasReales > 0;
  // Mostramos alerta azul si oficial > 0 pero real == 0 (significa que todo está pagado pero pendiente)
  const mostrarInfoRevision = !mostrarAlertaDeuda && diasOficiales > 0;

  // =========================================================

  return (
    <div className="w-full space-y-8">
      
      {/* Header de Bienvenida */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          ¡Bienvenido, {conductor?.nombre_conductor?.split(' ')[0]}! 👋
        </h1>
        <div className="flex items-center flex-wrap gap-3 mt-3">
          <span className="px-4 py-2 rounded-full text-sm font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Categoría: {conductor?.categoria || 'Oro'}
          </span>
          <span className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-500/20 text-gray-300 border border-gray-500/30">
            Amonestaciones: {alertas?.amonestaciones_activas || 0} / 3
          </span>
          {conductor?.status && (
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              conductor.status === 'Activo' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              Estado: {conductor.status}
            </span>
          )}
        </div>
      </div>

      
    {/* CASO 1: DEUDA REAL (Rojo) - Aún debe dinero descontando lo pendiente */}
      {mostrarAlertaDeuda && (
        <Alerta 
          tipo="error" 
          titulo={`⚠️ Tienes ${diasReales} pagos atrasados (${formatCurrency(deudaReal)})`}
          subtitulo={
             diasEnRevision > 0 
               ? `Tienes pagos por ${formatCurrency(montoEnRevision)} en revisión, pero aún falta cubrir este saldo.`
               : "Regulariza tu situación para evitar una amonestación."
          }
          accion={() => navigate('/conductor/pagos')}
          textoAccion="Ver Pagos"
        />
      )}

      {/* CASO 2: TODO EN REVISIÓN (Azul) - Debe en sistema, pero ya subió comprobantes */}
      {mostrarInfoRevision && (
        <Alerta 
          tipo="info" 
          titulo="⏳ Pagos en revisión"
          subtitulo={`Tus pagos pendientes (${formatCurrency(montoEnRevision)}) cubren tu deuda actual. Espera a que sean aprobados.`}
          accion={() => navigate('/conductor/pagos')}
          textoAccion="Ver Estado"
        />
      )}

      {mantenimientoPreventivo && (
        <Alerta
          tipo={mantenimientoPreventivo.estado === 'vencido' ? 'error' : 'warning'}
          titulo={`🔧 Mantenimiento preventivo ${mantenimientoPreventivo.estado === 'vencido' ? 'vencido' : 'próximo'}`}
          subtitulo={mantenimientoPreventivo.estado === 'vencido'
            ? `Has excedido el servicio de ${kmPreventivoTexto} km por ${kmPreventivoDiferencia} km. ${mantenimientoPreventivo.tipo_servicio}`
            : `Faltan ${kmPreventivoDiferencia} km para el servicio de ${kmPreventivoTexto} km. ${mantenimientoPreventivo.tipo_servicio}`}
          accion={() => navigate('/conductor/mantenimientos')}
          textoAccion="Agendar mantenimiento"
        />
      )}

      {mantenimientoPlan?.proximo_servicio && (
        <Alerta
          tipo="info"
          titulo={`📅 Próximo servicio recomendado: ${mantenimientoPlan.proximo_servicio.kilometraje_objetivo.toLocaleString('es-MX')} km`}
          subtitulo={`${mantenimientoPlan.proximo_servicio.tipo_servicio}`}
          accion={() => navigate('/conductor/mantenimientos')}
          textoAccion="Ver plan completo"
        />
      )}

      {alertas?.siniestro_pendiente && (
        <Alerta 
          tipo="info" 
          titulo={`📋 Siniestro en proceso: ${alertas.siniestro_pendiente.folio}`}
          subtitulo={`Estado: ${alertas.siniestro_pendiente.estado}`}
          accion={() => navigate('/conductor/siniestros')}
          textoAccion="Ver Siniestros"
        />
      )}

      {/* Acciones Rápidas (4 botones principales) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <BotonAccion 
          titulo="Realizar Pago" 
          subtitulo="Registra tu renta" 
          icono={CreditCard}
          color="blue"
          onClick={() => navigate('/conductor/pagos')}
        />
        <BotonAccion 
          titulo="Revisión diaria" 
          subtitulo={revisionDiaria?.completada_hoy ? 'Completada ✅' : 'Pendiente desde 00:00'} 
          icono={Video}
          color={revisionDiaria?.completada_hoy ? 'green' : 'orange'}
          onClick={() => navigate('/conductor/vehiculo')}
        />
        <BotonAccion 
          titulo="Mi Vehículo" 
          subtitulo="Ver detalles" 
          icono={Car}
          color="purple"
          onClick={() => navigate('/conductor/vehiculo')}
        />
        <BotonAccion 
          titulo="Mantenimiento" 
          subtitulo="Solicitar servicio" 
          icono={Wrench}
          color="orange"
          onClick={() => navigate('/conductor/mantenimientos')}
        />
        <BotonAccion 
          titulo="Reportar Siniestro" 
          subtitulo="Incidente o daño" 
          icono={AlertTriangle}
          color="red"
          onClick={() => navigate('/conductor/siniestros')}
        />
      </div>

      {/* Paneles de Información (Póliza, Vehículo) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel de Finanzas */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">💰 Mis Finanzas</h2>
            <button
              onClick={() => navigate('/conductor/pagos')}
              className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
            >
              Ver detalles <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          {finanzas?.tipo_poliza === 'POLIZA_100' ? (
            <PanelPoliza 
              saldo={finanzas.saldo_poliza_mecanica}
              limite={finanzas.limite_poliza}
            />
          ) : (
            <PanelAhorro
              titulo="Cartera de Ahorro"
              saldo={finanzas?.saldo_poliza_mecanica || 0}
              subtitulo="Acumulado de tus abonos"
            />
          )}

          {/* Ahorro Adicional */}
          {finanzas?.saldo_ahorro_mantenimiento > 0 && (
            <div className="mt-4">
              <PanelAhorro
                titulo="Ahorro Voluntario"
                saldo={finanzas.saldo_ahorro_mantenimiento}
                subtitulo="Tu ahorro independiente"
              />
            </div>
          )}
        </div>

        {/* Panel de Vehículo */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">🚗 Mi Vehículo</h2>
            <button
              onClick={() => navigate('/conductor/vehiculo')}
              className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
            >
              Ver más <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <InfoVehiculo vehiculo={vehiculo_asignado} mantenimientoPlan={mantenimientoPlan} />
        </div>
      </div>

      {/* Enlaces Rápidos Adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <EnlaceRapido
          icono={FileText}
          titulo="Mi Perfil"
          descripcion="Ver y editar mis datos"
          onClick={() => navigate('/conductor/perfil')}
        />
        <EnlaceRapido
          icono={Calendar}
          titulo="Historial"
          descripcion="Ver mis registros"
          onClick={() => navigate('/conductor/pagos')}
        />
        <EnlaceRapido
          icono={Shield}
          titulo="Documentos"
          descripcion="Mis documentos"
          onClick={() => navigate('/conductor/perfil')}
        />
      </div>
    </div>
  );
};

// ===============================================
// COMPONENTES DE UI
// ===============================================

// Componente de Alerta
// Componente Alerta Reutilizable
const Alerta = ({ tipo, titulo, subtitulo, accion, textoAccion }) => {
    const colores = {
        error: "bg-red-500/10 border-red-500/30 text-red-400",
        info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
        warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
    };
    return (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 mb-4 ${colores[tipo] || colores.info}`}>
            <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                    <h3 className="font-bold text-sm md:text-base">{titulo}</h3>
                    <p className="text-xs md:text-sm opacity-80">{subtitulo}</p>
                </div>
            </div>
            {accion && (
                <button onClick={accion} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors whitespace-nowrap">
                    {textoAccion}
                </button>
            )}
        </div>
    );
};
// Componente de Botón de Acción
const BotonAccion = ({ titulo, subtitulo, icono: Icon, color, onClick }) => {
  const config = {
    blue: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', hover: 'hover:bg-cyan-500/20' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', hover: 'hover:bg-purple-500/20' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', hover: 'hover:bg-orange-500/20' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', hover: 'hover:bg-red-500/20' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', hover: 'hover:bg-green-500/20' }
  };
  const COLOR = config[color] || config.blue;

  return (
    <button
      onClick={onClick}
      className={`p-5 rounded-xl shadow-lg text-white transition-all ${COLOR.bg} border ${COLOR.border} ${COLOR.hover} transform hover:-translate-y-1`}
    >
      <div className="flex flex-col items-center text-center gap-3">
        <Icon className={`h-10 w-10 ${COLOR.text}`} />
        <div>
          <h3 className="text-lg font-semibold text-white">{titulo}</h3>
          <p className="text-sm text-gray-400">{subtitulo}</p>
        </div>
      </div>
    </button>
  );
};

// Panel de Póliza
const PanelPoliza = ({ saldo, limite }) => (
  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium text-purple-300">Póliza Mecánica</span>
      <Shield className="w-5 h-5 text-purple-400" />
    </div>
    <p className="text-3xl font-bold text-white">{formatCurrency(saldo)}</p>
    <div className="w-full bg-white/10 rounded-full h-2.5 mt-2">
      <div 
        className="bg-purple-400 h-2.5 rounded-full" 
        style={{ width: `${Math.min((saldo / limite) * 100, 100)}%` }}
      ></div>
    </div>
    <p className="text-xs text-gray-400 mt-1">de {formatCurrency(limite)}</p>
  </div>
);

// Panel de Ahorro
const PanelAhorro = ({ titulo, saldo, subtitulo }) => (
  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
    <span className="text-sm font-medium text-blue-300">{titulo}</span>
    <p className="text-3xl font-bold text-white">{formatCurrency(saldo)}</p>
    <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>
  </div>
);

// Info de Vehículo
const InfoVehiculo = ({ vehiculo, mantenimientoPlan }) => {
  if (!vehiculo) {
    return (
      <div className="text-center py-8">
        <Car className="w-12 h-12 text-gray-500 mx-auto mb-3" />
        <p className="text-gray-400">No tienes un vehículo asignado.</p>
      </div>
    );
  }
  
  const kmActual = vehiculo.kilometraje_actual || 0;
  const kmProximo = vehiculo.proximo_mantenimiento_km || 0;
  const kmProgreso = (kmProximo > 0) ? (kmActual / kmProximo) * 100 : 0;
  const proximoServicio = mantenimientoPlan?.proximo_servicio;
  const ultimoServicio = mantenimientoPlan?.ultimo_servicio;
  
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <span className="text-gray-400">Vehículo:</span>
        <span className="font-medium text-white">{vehiculo.marca || 'N/A'} {vehiculo.modelo || ''}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Placa:</span>
        <span className="font-medium text-white">{vehiculo.placa}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Núm. Económico:</span>
        <span className="font-medium text-white">{vehiculo.numero_vehiculo}</span>
      </div>
      
      {/* Kilometraje */}
      <div className="pt-3 border-t border-white/10">
        <p className="text-sm text-gray-400 mb-1">Kilometraje</p>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-2xl font-bold text-white">
            {kmActual.toLocaleString('es-MX')} km
          </span>
          <span className="text-sm text-gray-400">
            Próx: {kmProximo.toLocaleString('es-MX')} km
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2.5">
          <div 
            className="bg-cyan-400 h-2.5 rounded-full transition-all" 
            style={{ width: `${Math.min(kmProgreso, 100)}%` }}
          ></div>
        </div>
      </div>

      {proximoServicio && (
        <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-gray-400">Próximo servicio sugerido</p>
              <p className="text-sm font-semibold text-white">
                {proximoServicio.kilometraje_objetivo.toLocaleString('es-MX')} km
              </p>
            </div>
            <span className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 rounded-full">
              {Math.max((proximoServicio.kilometraje_objetivo - kmActual), 0).toLocaleString('es-MX')} km restantes
            </span>
          </div>
          <p className="text-xs text-gray-300 mt-1 leading-snug">
            {proximoServicio.tipo_servicio}
          </p>
        </div>
      )}

      {ultimoServicio && (
        <div className="mt-2 p-3 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-xs text-gray-400">Último servicio sugerido</p>
          <p className="text-sm font-semibold text-white">
            {ultimoServicio.kilometraje_objetivo.toLocaleString('es-MX')} km
          </p>
          <p className="text-xs text-gray-300 mt-1 leading-snug">
            {ultimoServicio.tipo_servicio}
          </p>
        </div>
      )}
    </div>
  );
};

// Enlace Rápido
const EnlaceRapido = ({ icono: Icon, titulo, descripcion, onClick }) => (
  <button
    onClick={onClick}
    className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left"
  >
    <Icon className="w-6 h-6 text-cyan-400 mb-2" />
    <h3 className="text-white font-semibold">{titulo}</h3>
    <p className="text-gray-400 text-sm">{descripcion}</p>
  </button>
);

export default DriverDashboard;
