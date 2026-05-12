// frontend/src/pages/conductor/MisPagos.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import conductorService from '../../services/conductorService';
import { 
  DollarSign,
  CreditCard,
  Upload,
  Calendar,
  Check,
  X,
  Clock,
  ArrowLeft,
  RefreshCw,
  FileText,
  AlertTriangle,
  Trash2,
  MessageSquareX, 
  Lock
} from 'lucide-react';
import { toast } from 'react-hot-toast';


const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount || 0);
};
// FUNCIÓN AUXILIAR: Calcular siguiente día hábil sin contar domingos
const getSiguienteDiaHabil = (fechaStr) => {
  // 1. Si no hay fecha, devolvemos hoy
  if (!fechaStr) return new Date().toISOString().split('T')[0];

  try {
    // 2. LIMPIEZA: Tomamos solo la parte "YYYY-MM-DD" por si viene con hora
    const fechaLimpia = typeof fechaStr === 'string' ? fechaStr.split('T')[0] : fechaStr;

    // 3. Creamos la fecha a mediodía para evitar problemas de zona horaria
    const fecha = new Date(`${fechaLimpia}T12:00:00`);

    // 4. Validación de seguridad: Si la fecha es inválida, devolvemos hoy
    if (isNaN(fecha.getTime())) {
      console.warn("Fecha inválida recibida:", fechaStr);
      return new Date().toISOString().split('T')[0];
    }

    // 5. Lógica de sumar días
    fecha.setDate(fecha.getDate() + 1);

    // 6. Si cae en Domingo (0), saltar al Lunes
    if (fecha.getDay() === 0) {
      fecha.setDate(fecha.getDate() + 1);
    }

    return fecha.toISOString().split('T')[0];
    
  } catch (error) {
    console.error("Error calculando fecha:", error);
    return new Date().toISOString().split('T')[0];
  }
};

// Cuenta los días pero IGNORA los domingos
const calcularDiasSinDomingos = (inicio, fin) => {
  if (!inicio || !fin) return 0;

  const fechaInicio = new Date(`${inicio}T12:00:00`);
  const fechaFin = new Date(`${fin}T12:00:00`);
  
  if (fechaFin < fechaInicio) return 0;

  let diasHabiles = 0;
  let fechaActual = new Date(fechaInicio);

  // Recorremos desde el inicio hasta el fin
  while (fechaActual <= fechaFin) {
    // Si el día actual NO es Domingo (0), lo contamos
    if (fechaActual.getDay() !== 0) {
      diasHabiles++;
    }
    // Pasamos al siguiente día
    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  return diasHabiles;
};

const calcularDiasAtraso = (fechaEsperada, fechaReal) => {
    if (!fechaEsperada || !fechaReal) return 0;

    // 1. Extraemos solo la parte "YYYY-MM-DD" para evitar desfases de zona horaria
    const strEsperada = fechaEsperada.split('T')[0];
    const strReal = fechaReal.split('T')[0];

    // 2. Convertimos a fechas locales seguras (Año, Mes - 1, Día)
    const [yearE, monthE, dayE] = strEsperada.split('-');
    const [yearR, monthR, dayR] = strReal.split('-');
    
    const fechaInicio = new Date(yearE, monthE - 1, dayE);
    const fechaFin = new Date(yearR, monthR - 1, dayR);

    // Si pagó a tiempo o antes, el atraso es 0
    if (fechaFin <= fechaInicio) return 0;

    // 3. Contamos los días saltando los domingos
    let diasAtraso = 0;
    let fechaActual = new Date(fechaInicio);
    fechaActual.setDate(fechaActual.getDate() + 1); // Empezamos a contar desde el día siguiente

    while (fechaActual <= fechaFin) {
      // getDay() devuelve 0 para el Domingo. Si NO es domingo, lo sumamos a la deuda.
      if (fechaActual.getDay() !== 0) {
        diasAtraso++;
      }
      fechaActual.setDate(fechaActual.getDate() + 1); // Avanzamos un día
    }

    return diasAtraso;
  };

const esDomingo = (fechaStr) => {
  if (!fechaStr) return false;
  const fecha = new Date(`${fechaStr}T12:00:00`);
  return !Number.isNaN(fecha.getTime()) && fecha.getDay() === 0;
};

const MisPagos = () => {
  const navigate = useNavigate();
  const [pagos, setPagos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mostrarFormPago, setMostrarFormPago] = useState(false);
  const [resumenPonerseAlTanto, setResumenPonerseAlTanto] = useState(null);
  const [cargandoResumenPonerse, setCargandoResumenPonerse] = useState(false);
  
  // Form de pago
  const hoy = new Date().toLocaleDateString('en-CA');
  const inputFechaFinRef = useRef(null);
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [comprobante, setComprobante] = useState(null);
  const [notas, setNotas] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [ponerseAlTanto, setPonerseAlTanto] = useState(false);
  const [metodoPago, setMetodoPago] = useState('Transferencia');
  const rentaDiaria = resumen?.renta_diaria ? parseFloat(resumen.renta_diaria) : 400;
  const polizaDiaria = resumen?.abono_poliza_mantenimiento ? parseFloat(resumen.abono_poliza_mantenimiento) : 100;
  const totalDiario = rentaDiaria + polizaDiaria;
  const diasReales = calcularDiasSinDomingos(fechaInicio, fechaFin);
  const diasSeleccionados = diasReales;



    
    // Si está marcado "Ponerse al tanto" y ya tenemos el resumen del servidor, usamos esos datos.
    // Si no, usamos el cálculo normal de fechas.


const totalEstimado = diasSeleccionados * totalDiario;

const estaAlCorriente = React.useMemo(() => {
    // 1. Empezamos con la fecha que dice el backend (Confirmados)
    let fechaMasReciente = resumen?.ultimo_pago_aprobado;

    // 2. BÚSQUEDA LOCAL: Revisamos si hay pagos Pendientes más recientes
    if (pagos && pagos.length > 0) {
      // Filtramos los estados que consideramos como "Pagado" (incluyendo Pendiente)
      const pagosValidos = pagos.filter(p => 
        ['Aprobado', 'Pendiente', 'Confirmado'].includes(p.status)
      );

      if (pagosValidos.length > 0) {
        // Ordenamos descendente para sacar el último
        pagosValidos.sort((a, b) => {
          const fA = new Date(a.fecha_pago_fin || a.fecha_pago);
          const fB = new Date(b.fecha_pago_fin || b.fecha_pago);
          return fB - fA; 
        });

        const ultimoLocal = pagosValidos[0].fecha_pago_fin || pagosValidos[0].fecha_pago;

        // Si la fecha local es mayor a la del resumen (o si no había resumen), ganamos
        if (!fechaMasReciente || new Date(ultimoLocal) > new Date(fechaMasReciente)) {
            fechaMasReciente = ultimoLocal;
        }
      }
    }

    // 3. Si después de todo no tenemos fecha, es un conductor nuevo o sin pagos
    if (!fechaMasReciente) return false;

    // 4. COMPARACIÓN FINAL
    // Normalizamos a YYYY-MM-DD para comparar texto
    const ultimo = String(fechaMasReciente).substring(0, 10);
    const hoy = new Date().toLocaleDateString('en-CA'); 
    
    // Si la fecha cubierta (sea Pendiente o Confirmada) es hoy o futuro -> ESTÁ AL CORRIENTE
    return ultimo >= hoy; 

  }, [resumen, pagos]);

  
  useEffect(() => {
    cargarPagos();
    cargarResumen();
  }, []);

  // NUEVO USEEFFECT: Autocompletar fecha de forma inteligente (Anti-Domingos)
  useEffect(() => {
    if (!resumen) return;

    // 1. Extraemos las fechas limpiando la zona horaria ("YYYY-MM-DD")
    // 🛡️ ESCUDO: Si viene null, no hacemos split, usamos la fecha de hoy por seguridad
const fechaAsignacionStr = resumen.fecha_inicio_asignacion 
    ? resumen.fecha_inicio_asignacion.split('T')[0] 
    : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' });
    let fechaBase = resumen.ultimo_pago_aprobado ? resumen.ultimo_pago_aprobado.split('T')[0] : null;

    // 🚀 DETECTOR DE DOMINGOS (Solo para cuando arranca en limpio) 🚀
    let fechaArranqueLimpio = fechaAsignacionStr;
    const objAsignacion = new Date(`${fechaAsignacionStr}T12:00:00`); // T12 para evitar brincos de zona horaria
    
    if (objAsignacion.getDay() === 0) { // Si es 0, es Domingo
        console.log('⚠️ Asignación en Domingo detectada, ajustando arranque del conductor al Lunes...');
        objAsignacion.setDate(objAsignacion.getDate() + 1); // Sumamos 1 día
        fechaArranqueLimpio = objAsignacion.toISOString().split('T')[0]; // Guardamos el Lunes
    }

    // 🚨 LA REGLA DE ORO 🚨
    // Si la fecha del último pago es ANTERIOR a cuando se le dio el carro,
    // significa que ese pago es de un chofer anterior. ¡Lo borramos de la memoria!
    if (fechaBase && fechaBase < fechaAsignacionStr) {
        console.log('🧹 Ignorando pagos viejos del chofer anterior...');
        fechaBase = null; 
    }

    // 2. Revisión en la tabla local (por si acaba de registrar un pago y está "Pendiente")
    if (pagos && pagos.length > 0) {
        const pagosValidos = pagos.filter(p => {
            const esStatusValido = ['Aprobado', 'Pendiente', 'Confirmado'].includes(p.status);
            
            // Extraemos la fecha del pago local limpiamente
            const fechaPagoLocal = p.fecha_pago_fin ? p.fecha_pago_fin.split('T')[0] : p.fecha_pago.split('T')[0];
            
            // Solo tomamos pagos que se hayan hecho DESDE que se le asignó el carro
            return esStatusValido && (fechaPagoLocal >= fechaAsignacionStr);
        });

        if (pagosValidos.length > 0) {
            // Ordenamos del más nuevo al más viejo
            pagosValidos.sort((a, b) => {
                const fA = a.fecha_pago_fin || a.fecha_pago;
                const fB = b.fecha_pago_fin || b.fecha_pago;
                return new Date(fB) - new Date(fA);
            });

            const ultimaFechaLocal = pagosValidos[0].fecha_pago_fin || pagosValidos[0].fecha_pago;
            const ultimaFechaLocalStr = ultimaFechaLocal.split('T')[0];
            
            // Comparamos si el pago local es más nuevo que el de la base de datos
            if (!fechaBase || ultimaFechaLocalStr > fechaBase) {
                fechaBase = ultimaFechaLocalStr;
            }
        }
    }

    // 3. Calculamos las fechas finales para el Datepicker
    const hoy = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD formato local

    if (ponerseAlTanto) {
      if (fechaBase) {
        // Tiene historial válido -> Sigue la cadena
        const inicioCalculado = getSiguienteDiaHabil(fechaBase); // Tu función que brinca domingos
        
        if (inicioCalculado > hoy) {
           setFechaInicio(inicioCalculado);
           setFechaFin(inicioCalculado);
        } else {
           setFechaInicio(inicioCalculado);
           setFechaFin(hoy);
        }
      } else {
        // 🆕 LIMPIO TOTAL: Empieza el día exacto que arrancó (¡ya sin domingos!)
        setFechaInicio(fechaArranqueLimpio);
        setFechaFin(hoy);
      }
    } 
    // MODO MANUAL
    else {
      if (fechaBase) {
        const siguienteDia = getSiguienteDiaHabil(fechaBase);
        setFechaInicio(siguienteDia);
        setFechaFin(siguienteDia);
      } else {
        // 🆕 LIMPIO TOTAL: Arranca justo el día de asignación (¡ya sin domingos!)
        setFechaInicio(fechaArranqueLimpio);
        setFechaFin(fechaArranqueLimpio);
      }
    }

  }, [ponerseAlTanto, resumen, pagos]);

  const cargarPagos = async () => {
    try {
      setLoading(true);
      const data = await conductorService.getMisPagos();
      setPagos(data.pagos || data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarResumen = async () => {
    try {
      const data = await conductorService.getResumenCuenta();
      setResumen(data);
    } catch (error) {
      console.error('Error al cargar resumen:', error);
    }
  };

  const cargarResumenPonerseAlTanto = async () => {
    try {
      setCargandoResumenPonerse(true);
      const data = await conductorService.getResumenPonerseAlTanto();
      setResumenPonerseAlTanto(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCargandoResumenPonerse(false);
    }
  };

  const handleComprobanteChange = (e) => {
    const file = e.target.files[0];
    
    // 🛡️ BLINDAJE 1: Si el usuario abrió la galería y le dio "Cancelar", 
    // matamos el archivo fantasma para evitar desincronizaciones.
    if (!file) {
      setComprobante(null);
      return;
    }

    // 🛡️ BLINDAJE 2: Validación de tamaño
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El comprobante no puede superar los 5MB');
      e.target.value = ''; // Limpiamos la memoria del HTML
      setComprobante(null); // Limpiamos la memoria de React
      return;
    }

    // Si todo está perfecto, lo guardamos
    setComprobante(file);
  };

  const handlePonerseAlTantoChange = (e) => {
    const checked = e.target.checked;
    setPonerseAlTanto(checked);
    if (checked) {
      setFechaInicio(hoy);
      setFechaFin(hoy);
      cargarResumenPonerseAlTanto();
    } else {
      setResumenPonerseAlTanto(null);
    }
  };

  const handleFechaFinChange = (valor) => {
    if (!valor) {
      setFechaFin('');
      return;
    }

    setFechaFin(valor);
  };

const handleSubmitPago = async (  e) => {
    e.preventDefault();

    // 🚨 PRUEBA DE FUEGO:
    console.log("Estado exacto del comprobante al dar clic:", comprobante);
    
    // 1. Validaciones Visuales
    if (!comprobante) {
      toast.error('Debes subir el comprobante de transferencia');
      return;
    }
    if (!fechaInicio) {
      toast.error('Selecciona una fecha de inicio');
      return;
    }
    if (esDomingo(fechaFin || fechaInicio)) {
      toast.error('⛔ No se puede registrar domingo como fecha final. Selecciona sábado o lunes.');
      return;
    }

    try {
      setLoading(true);

      // 2. Preparamos el paquete 📦
      const formData = new FormData();
      
      // Siempre mandamos las dos fechas. 
      // Si es pago de un solo día (DatePicker normal), el estado 'fechaFin' podría ser igual a 'fechaInicio' 
      // o venir vacío. Si viene vacío, el backend es inteligente y asume que es el mismo día.
      formData.append('fecha_inicio', fechaInicio);
      
      // Si 'fechaFin' tiene valor, lo mandamos. Si no, mandamos fechaInicio como fin (o dejamos que el backend decida)
      // Lo ideal es mandar ambos para ser explícitos.
      formData.append('fecha_fin', fechaFin || fechaInicio);
      formData.append('metodo_pago', metodoPago);
      
      formData.append('notas', notas || '');
      formData.append('comprobante', comprobante);

      // 3. ¡Disparamos a la función única! 🔫
      const response = await conductorService.registrarPago(formData);

      if (response.success) {
        toast.success(response.message); // "Se cobraron 3 días hábiles..."
        
        // 4. Limpieza y recarga
        setMostrarFormPago(false);
        setPonerseAlTanto(false);
        setComprobante(null);
        setNotas('');
        // Recargamos el resumen para que se actualice la fecha sugerida automáticamente
        cargarResumen(); 
        cargarPagos();
      }

    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  const totalPagado = resumen?.total_pagado || 0;
  const totalPendiente = resumen?.total_pendiente || 0;
  const totalPlan = resumen?.total_plan || (totalPagado + totalPendiente);
  const progresoPagos = resumen?.porcentaje_pagado !== undefined && resumen?.porcentaje_pagado !== null
      ? Math.min(100, parseFloat(resumen.porcentaje_pagado))
      : (totalPlan > 0
          ? Math.min(100, Math.round((totalPagado / totalPlan) * 100))
          : 0);
  const pagosRealizados = resumen?.total_pagos_realizados || 0;
  const estadoProgreso = progresoPagos >= 100 ? 'Completado' : 'En progreso';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }
  
  // 1. Formato para la fecha de creación (Ej: 21 ene 2026)
  const formatDiaCorrespondiente = (fecha) => {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // 2. Función para formatear el rango que cubre (Versión blindada)
  const formatRangoCubre = (fechaInicio, fechaFin) => {
    if (!fechaInicio) return 'Sin fecha';

    const parseFecha = (fecha) => {
      if (!fecha) return null;
      const fechaSegura = fecha.includes('T') ? fecha : `${fecha}T12:00:00`;
      return new Date(fechaSegura);
    };

    const dInicio = parseFecha(fechaInicio);
    const dFin = fechaFin ? parseFecha(fechaFin) : dInicio;

    const getDia = (d) => d.getDate();
    // Usamos 'short' si quieres que diga 'ene' en vez de 'enero' para ahorrar espacio en móvil
    const getMes = (d) => d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
    const getAnio = (d) => d.getFullYear();

    if (dInicio.toDateString() === dFin.toDateString()) {
      return `${getDia(dInicio)} ${getMes(dInicio)} ${getAnio(dInicio)}`;
    }

    if (dInicio.getMonth() === dFin.getMonth() && dInicio.getFullYear() === dFin.getFullYear()) {
      return `${getDia(dInicio)} al ${getDia(dFin)} ${getMes(dInicio)} ${getAnio(dInicio)}`;
    }

    return `${getDia(dInicio)} ${getMes(dInicio)} al ${getDia(dFin)} ${getMes(dFin)} ${getAnio(dFin)}`;
  };

  // Helper para mostrar la fecha bonita
  const formatearFechaElegante = (fechaStr) => {
    if (!fechaStr) return 'Selecciona una fecha';
    // Cortamos el string para evitar problemas de zona horaria al crear el Date
    const [year, month, day] = fechaStr.split('-');
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };


  return (
    <div className="space-y-6 bg-[#07425E] p-6 rounded-2xl">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/conductor/dashboard')}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Mis Pagos</h1>
            <p className="text-gray-400">Historial y registro de rentas</p>
          </div>
        </div>
        
        <button
          onClick={() => setMostrarFormPago(!mostrarFormPago)}
          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Upload className="w-5 h-5" />
          Registrar Pago
        </button>
      </div>

      {/* Resumen de Cuenta */}
      {resumen && (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-gray-400 text-sm">Progreso de pagos</p>
              <h2 className="text-3xl font-bold text-white">{progresoPagos}%</h2>
              <p className="text-sm text-gray-400">Pagos registrados: {pagosRealizados}</p>
              {resumen?.ultimo_pago_aprobado && (
              <p className="text-sm text-gray-400 mt-1">
                  Último pago aprobado:{' '}
                  <span className="text-white font-semibold">
                    {resumen.ultimo_pago_aprobado 
                      ? new Date(resumen.ultimo_pago_aprobado).toLocaleDateString('es-MX', {
                          timeZone: 'UTC', // 🛡️ Evita que te reste un día por tu zona horaria
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Ninguno'
                    }
                  </span>
                </p>
              )}
            </div>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
                estadoProgreso === 'Completado'
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-yellow-500/20 text-yellow-200'
              }`}>
                {estadoProgreso === 'Completado' ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                {estadoProgreso}
              </span>
            </div>
            <div>
              <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${progresoPagos}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>0%</span>
                <span>Cada pago te acerca al 100%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de Registro de Pago */}
      {mostrarFormPago && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Registrar Nuevo Pago</h2>
          <div className="flex items-start gap-3 p-4 mb-6 bg-blue-500/10 border border-blue-400/30 rounded-xl text-blue-100">
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Monto estimado</p>
              <p className="text-sm text-blue-100/80">
                El total se calcula con la renta diaria ({formatCurrency(rentaDiaria)}) más la póliza ({formatCurrency(polizaDiaria)}) por día, multiplicado por los días seleccionados. Los días ya pagados se descontarán al registrar tu pago.
              </p>
            </div>
          </div>

<div className={`flex items-start gap-3 p-4 mb-6 border rounded-xl transition-colors ${
            estaAlCorriente 
              ? 'bg-gray-800/30 border-gray-700 opacity-60 cursor-not-allowed' // Estilo deshabilitado
              : 'bg-white/5 border-white/10 text-white' // Estilo normal
          }`}>
            <input
              id="ponerse-al-tanto"
              type="checkbox"
              checked={ponerseAlTanto}
              onChange={handlePonerseAlTantoChange}
              disabled={estaAlCorriente} // ⛔ BLOQUEO
              className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500 disabled:cursor-not-allowed"
            />
            <label 
              htmlFor="ponerse-al-tanto" 
              className={`text-sm ${estaAlCorriente ? 'cursor-not-allowed text-gray-500' : 'cursor-pointer text-gray-200'}`}
            >
              <span className={`font-semibold ${estaAlCorriente ? 'text-gray-400' : 'text-white'}`}>
                {estaAlCorriente ? 'Estás al corriente' : 'Ponerse al corriente:'}
              </span>
              
              {!estaAlCorriente && (
                <>
                   registra todos los adeudos pendientes en una sola transacción.
                  <span className="block text-xs text-gray-400 mt-1">
                    Se registrará un pago por cada día pendiente hasta la fecha actual.
                  </span>
                </>
              )}
              
              {estaAlCorriente && (
                <span className="block text-xs text-green-400 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  ¡Felicidades! No tienes adeudos pendientes hasta la fecha.
                </span>
              )}
            </label>
          </div>
          
          <form onSubmit={handleSubmitPago} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Monto estimado */}
              <div className="space-y-3">
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-cyan-400" />
                  Monto del pago (estimado)
                </label>
                <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-white">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{formatCurrency(totalEstimado)}</span>
                    <span className="text-sm text-gray-400">Total</span>
                  </div>
                  <div className="mt-3 text-sm text-gray-300">
                    {diasSeleccionados} día{diasSeleccionados !== 1 ? 's' : ''} · {formatCurrency(totalDiario)} por día
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatCurrency(rentaDiaria)} renta + {formatCurrency(polizaDiaria)} póliza
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Rango de Pago
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 mb-6">
                  
                  {/* 🔒 INPUT INICIO: VISUALMENTE BLOQUEADO (MORADITO) */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Fecha de Inicio (Automática)
                    </label>
                    {/* DIV simulando un input, ahora con tonos morados */}
                    <div className="w-full p-3 bg-[#07425E] border border-blue-500/30 rounded-lg text-white-300 flex items-center justify-between shadow-inner cursor-not-allowed">
                      <span className=" font-medium">
                        {formatearFechaElegante(fechaInicio)}
                      </span>
                      <Lock className="w-4 h-4 text-white-400" />
                    </div>
                    {/* Tooltip */}
                    <span className="text-[12px] text-white-400 absolute -bottom-5 left-1 font-medium">
                      * Calculado desde tu último pago
                    </span>
                  </div>


                  {/* 🟢 INPUT FIN: HITBOX GIGANTE CON useRef */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Fecha de Fin
                    </label>
                    
                    {/* Contenedor que agrupa el input real y el diseño visual */}
                    <div className="relative w-full">
                      
                      {/* 1. INPUT REAL (Transparente y encima de todo) */}
                      {/* 🔒 MAGIA AQUÍ: absolute inset-0 lo estira por todo el div, opacity-0 lo hace invisible pero clickeable */}
                      <input
                        type="date"
                        value={fechaFin}
                        onChange={(e) => handleFechaFinChange(e.target.value)}
                        min={fechaInicio}
                        disabled={ponerseAlTanto}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                        required
                      />
                      
                      {/* 2. DISEÑO VISUAL (Lo que el usuario ve, pero está debajo del input real) */}
                      <div 
                        className={`w-full p-3 border rounded-lg flex items-center justify-between transition-colors ${
                          ponerseAlTanto 
                            ? 'bg-gray-200 text-gray-400 border-gray-300' 
                            : 'bg-white text-black border-gray-300 hover:border-cyan-500 shadow-sm'
                        }`}
                      >
                        <span className="font-medium">
                          {fechaFin ? formatearFechaElegante(fechaFin) : 'Selecciona una fecha'}
                        </span>
                        
                        <span className="text-gray-500">📅</span> 
                      </div>
                      
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>

            {/* 💳 SECCIÓN: MÉTODO DE PAGO */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Método de Pago
              </label>
              <div className="relative">
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-400 focus:outline-none appearance-none cursor-pointer transition-colors"
                >
                  <option value="Transferencia" className="bg-gray-900 text-white">Transferencia</option>
                  <option value="Deposito" className="bg-gray-900 text-white">Depósito</option>
                </select>
                
                {/* Flecha decorativa */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Comprobante */}
            <div>
              <label className="block text-white font-semibold mb-2 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Comprobante de Pago (Obligatorio)
              </label>
              <input
                type="file"
                // 🚀 ESTRICTO: Forzamos a que el celular haga la conversión a JPG/PNG o pida PDF
                accept="image/jpeg, image/png, image/jpg, application/pdf" 
                // 🚀 ANTI-BUG: Limpiamos el caché temporal para que deje re-seleccionar la misma foto
                onClick={(e) => (e.target.value = null)} 
                onChange={handleComprobanteChange}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white"
                required
              />
              {comprobante && (
                <p className="text-sm text-green-400 mt-2">✓ {comprobante.name}</p>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Notas / Observaciones
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows="2"
                placeholder="Ej: Pago correspondiente al día 15..."
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400"
              ></textarea>
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={registrando}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {registrando ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    {ponerseAlTanto ? 'Registrar Adeudos' : 'Registrar Pago'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarFormPago(false);
                  setPonerseAlTanto(false);
                }}
                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Historial de Pagos */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold text-white">Historial de Pagos</h2>
          <p className="text-sm text-gray-300">Historial completo de pagos</p>
        </div>
        <p className="text-xs text-red-200 font-medium mb-4">
          Los pagos rechazados o eliminados se muestran en rojo para identificarlos rapido.
        </p>
        
        {pagos.length === 0 ? (

          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No hay pagos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 text-gray-400 font-semibold">Folio</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Fecha</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Monto</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Método</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Días atraso</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Estado</th>
                  <th className="text-left p-3 text-gray-400 font-semibold">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago) => (
                  <tr
                    key={pago.id}
                    className={`border-b transition-all ${['Rechazado', 'Eliminado'].includes(pago.status) ? 'border-red-400/70 bg-red-600/30 hover:bg-red-600/40 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.45)]' : 'border-white/5 hover:bg-white/5'}`}
                  >
                    <td className={`p-3 font-mono text-sm ${['Rechazado', 'Eliminado'].includes(pago.status) ? 'text-red-50' : 'text-white'}`}>
                      {pago.folio_pago || `#${pago.id}`}
                    </td>
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-2">
                          {/* FECHA DE REGISTRO (CREACIÓN) */}
                          <div className={`flex items-center gap-2 ${['Rechazado', 'Eliminado'].includes(pago.status) ? 'text-red-50' : 'text-gray-200'}`}>
                            <Calendar className="w-4 h-4" />
                            <span className="font-medium whitespace-nowrap capitalize">
                              {formatDiaCorrespondiente(pago.created_at)}
                            </span>
                          </div>
                          
                          {/* RANGO QUE CUBRE EL PAGO */}
                          <p className={`text-xs ${['Rechazado', 'Eliminado'].includes(pago.status) ? 'text-red-100' : 'text-gray-500'}`}>
                            Cubre: {formatRangoCubre(pago.fecha_pago, pago.fecha_pago_fin)}
                          </p>
                        </div>
                      </td>
                    <td className={`p-3 font-semibold ${['Rechazado', 'Eliminado'].includes(pago.status) ? 'text-red-50' : 'text-white'}`}>
                      {formatCurrency(pago.monto_total || pago.monto_renta_pagado)}
                      <p className={`text-xs ${['Rechazado', 'Eliminado'].includes(pago.status) ? 'text-red-100' : 'text-gray-400'}`}>
                        Renta: {formatCurrency(pago.monto_renta_pagado)} · Póliza: {formatCurrency(pago.monto_poliza_pagado)}
                      </p>
                    </td>
                    <td className={`p-3 ${['Rechazado', 'Eliminado'].includes(pago.status) ? 'text-red-50' : 'text-white'}`}>
                      {pago.metodo_pago || 'Transferencia'}
                    </td>
                    <td className={`p-3 ${['Rechazado', 'Eliminado'].includes(pago.status) ? 'text-red-50' : 'text-white'}`}>
                      {calcularDiasAtraso(pago.fecha_pago, pago.created_at)} {calcularDiasAtraso(pago.fecha_pago, pago.created_at) === 1 ? 'día' : 'días'}
                    </td>
                    <td className="p-3">
                      <EstadoBadge estado={pago.status} />
                      {pago.status === 'Rechazado' && pago.observaciones && (
                        <p className="text-xs text-red-300 mt-2">
                          {pago.observaciones}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      {pago.comprobante_url ? (
                        <a
                          href={pago.comprobante_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1"
                        >
                          <FileText className="w-4 h-4" />
                          Ver
                        </a>
                      ) : (
                        <span className="text-gray-500 text-sm">Sin comprobante</span>
                      )}

                      <div className="flex justify gap-2">
                        {pago.status === 'Eliminado' && (
                      <button
                        onClick={() => alert(`⛔ RAZÓN DE LA ELIMINACIÓN:\n\n${pago.observaciones || 'Sin motivo especificado'}`)}
                        className="p-2 rounded-lg bg-red-500/35 text-red-100 hover:bg-red-500/45 transition-colors"
                        title="Ver motivo de eliminación"
                      >
                        <MessageSquareX size={18} />
                      </button>
                    )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

// Componente para badge de estado
const EstadoBadge = ({ estado }) => {
  const config = {
    'Confirmado': { bg: 'bg-green-500/20', text: 'text-green-400', icon: Check },
    'Pagada': { bg: 'bg-green-500/20', text: 'text-green-400', icon: Check },
    'Pendiente': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
    'Vencida': { bg: 'bg-red-500/20', text: 'text-red-400', icon: X },
    'Rechazado': { bg: 'bg-red-600/35', text: 'text-red-100', icon: X },
    'Eliminado': { bg: 'bg-red-600/35', text: 'text-red-100', icon: Trash2 },
  };
  
  const ESTADO = config[estado] || config.Pendiente;
  const Icon = ESTADO.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${ESTADO.bg} ${ESTADO.text}`}>
      <Icon className="w-4 h-4" />
      {estado}
    </span>
  );
};

export default MisPagos;
