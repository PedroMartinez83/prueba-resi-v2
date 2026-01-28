// frontend/src/pages/conductor/MisPagos.jsx
import React, { useState, useEffect } from 'react';
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
  MessageSquareX
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

const MisPagos = () => {
  const navigate = useNavigate();
  const [pagos, setPagos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mostrarFormPago, setMostrarFormPago] = useState(false);
  
  // Form de pago
  const hoy = new Date().toISOString().split('T')[0];
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [comprobante, setComprobante] = useState(null);
  const [notas, setNotas] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [ponerseAlTanto, setPonerseAlTanto] = useState(false);
  const [resumenPonerseAlTanto, setResumenPonerseAlTanto] = useState(null);
  const [cargandoResumenPonerse, setCargandoResumenPonerse] = useState(false);

  const rentaDiaria = resumen?.renta_diaria || 400;
  const polizaDiaria = resumen?.abono_poliza_mantenimiento ?? 100;
  const totalDiario = rentaDiaria + polizaDiaria;
  const diasReales = calcularDiasSinDomingos(fechaInicio, fechaFin);
  const diasSeleccionados = diasReales;
  const calcularDiasSeleccionados = (inicio, fin) => {
    const fechaInicioLocal = new Date(`${inicio}T00:00:00`);
    const fechaFinLocal = new Date(`${fin}T00:00:00`);
    if (Number.isNaN(fechaInicioLocal.getTime()) || Number.isNaN(fechaFinLocal.getTime())) {
      return 1;
    }
    const diferencia = Math.floor((fechaFinLocal - fechaInicioLocal) / (1000 * 60 * 60 * 24));
    return Math.max(1, diferencia + 1);
  };

  const diasCalculados = calcularDiasSinDomingos(fechaInicio, fechaFin);
    
    // Si está marcado "Ponerse al tanto" y ya tenemos el resumen del servidor, usamos esos datos.
    // Si no, usamos el cálculo normal de fechas.


const totalEstimado = diasReales * (parseFloat(resumen?.renta_diaria || 0) + parseFloat(resumen?.abono_poliza_mantenimiento || 0));

  useEffect(() => {
    cargarPagos();
    cargarResumen();
  }, []);

  // NUEVO USEEFFECT: Autocompletar fecha cuando llegue el resumen
  useEffect(() => {
      if (ponerseAlTanto && resumen?.ultimo_pago_aprobado) {
        
        // 1. FECHA INICIO: El día hábil después del último pago
        const inicioCalculado = getSiguienteDiaHabil(resumen.ultimo_pago_aprobado);
        
        // 2. FECHA FIN: Hoy mismo
        // (Usamos new Date() y ajustamos a string YYYY-MM-DD)
        const hoy = new Date();
        const finCalculado = hoy.toISOString().split('T')[0];

        // Validamos que 'hoy' no sea menor que el inicio (por si pagó por adelantado)
        if (new Date(finCalculado) < new Date(inicioCalculado)) {
          // Si está al día, ponemos inicio y fin iguales (1 día por adelantado si quiere)
          setFechaInicio(inicioCalculado);
          setFechaFin(inicioCalculado);
        } else {
          // Si debe dinero, ponemos el rango completo
          setFechaInicio(inicioCalculado);
          setFechaFin(finCalculado);
        }
        
      } else if (!ponerseAlTanto && resumen?.ultimo_pago_aprobado) {
        // Si LO DESACTIVA, regresamos a pagar solo 1 día (el siguiente hábil)
        const siguienteDia = getSiguienteDiaHabil(resumen.ultimo_pago_aprobado);
        setFechaInicio(siguienteDia);
        setFechaFin(siguienteDia);
      }
    }, [ponerseAlTanto, resumen]);

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
    if (file) {
      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El comprobante no puede superar los 5MB');
        return;
      }
      setComprobante(file);
    }
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

const handleFechaInicioChange = (valor) => {
    if (!valor) {
      setFechaInicio('');
      return;
    }

    // 🟢 VALIDACIÓN DE DOMINGOS MANUAL
    const fechaObj = new Date(`${valor}T12:00:00`);
    const diaSemana = fechaObj.getDay();

    if (diaSemana === 0) { // 0 = Domingo
      // Puedes usar una alerta estándar o un toast si tienes configurado
      alert("⛔ No se pueden iniciar pagos en domingo (Día inhábil). Se seleccionará el lunes.");
      
      //  Auto-corregir al lunes en lugar de solo bloquear
      fechaObj.setDate(fechaObj.getDate() + 1);
      setFechaInicio(fechaObj.toISOString().split('T')[0]);
      return;
    }

    setFechaInicio(valor);
  };

  const handleFechaFinChange = (valor) => {
      if (!valor) {
        setFechaFin('');
        return;
      }

      // 🟢 VALIDACIÓN: Prohibir elegir Domingo como día final
      const fechaObj = new Date(`${valor}T12:00:00`);
      if (fechaObj.getDay() === 0) {
        alert("⛔ No se puede seleccionar domingo como fecha final (No laboral). Por favor selecciona sábado o lunes.");
        // Limpiamos el input o no hacemos nada
        return; 
      }

      setFechaFin(valor);
    };

  const handleSubmitPago = async (e) => {
    e.preventDefault();
    
    if (!comprobante) {
      toast.error('El comprobante es obligatorio');
      return;
    }

    try {
      setRegistrando(true);
      
      const formData = new FormData();
      formData.append('notas', notas || '');

      if (!ponerseAlTanto) {
        formData.append('fecha_inicio', fechaInicio);
        formData.append('fecha_fin', fechaFin);
      }

      formData.append('comprobante', comprobante);

      const respuesta = ponerseAlTanto
        ? await conductorService.registrarPagoMultiple(formData)
        : await conductorService.registrarPago(formData);
      
      toast.success(respuesta?.message || '¡Pago registrado correctamente!');
      setMostrarFormPago(false);
      setFechaInicio(hoy);
      setFechaFin(hoy);
      setComprobante(null);
      setNotas('');
      setPonerseAlTanto(false);
      cargarPagos();
      cargarResumen();
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRegistrando(false);
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

  return (
    <div className="space-y-6">
      
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
                    {new Date(resumen.ultimo_pago_aprobado).toLocaleDateString('es-MX')}
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

          <div className="flex items-start gap-3 p-4 mb-6 bg-white/5 border border-white/10 rounded-xl text-white">
            <input
              id="ponerse-al-tanto"
              type="checkbox"
              checked={ponerseAlTanto}
              onChange={handlePonerseAlTantoChange}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="ponerse-al-tanto" className="text-sm text-gray-200">
              <span className="font-semibold text-white">Ponerse al corriente:</span> registra todos los adeudos pendientes en una sola transacción.
              <span className="block text-xs text-gray-400 mt-1">
                Se registrará un pago por cada día pendiente hasta la fecha actual.
              </span>
              {ponerseAlTanto && (
                <span className="block text-xs text-gray-300 mt-2">
                  {cargandoResumenPonerse ? (
                    'Calculando total pendiente...'
                  ) : resumenPonerseAlTanto?.total_dias > 0 ? (
                    <>
                      Total a pagar hasta hoy: <span className="text-white font-semibold">{formatCurrency(resumenPonerseAlTanto.total_monto)}</span>
                      <span className="block text-gray-400 mt-1">
                        {resumenPonerseAlTanto.total_dias} día{resumenPonerseAlTanto.total_dias !== 1 ? 's' : ''} · Renta {formatCurrency(resumenPonerseAlTanto.total_monto_renta)} · Póliza {formatCurrency(resumenPonerseAlTanto.total_monto_poliza)}
                      </span>
                    </>
                  ) : (
                    'No tienes adeudos pendientes hasta hoy.'
                  )}
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  
                  {/* 🔒 INPUT INICIO: BLOQUEADO (READONLY) */}
                  <div className="relative">
                    <input
                      type="date"
                      value={fechaInicio}
                      readOnly // <--- ESTO LO BLOQUEA
                      className="w-full p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-gray-400 cursor-not-allowed" // Estilo visual de bloqueado
                      required
                    />
                    {/* Tooltip opcional para explicar por qué está bloqueado */}
                    <span className="text-[13px] text-gray-500 absolute bottom-[-25px] left-1">
                      * Automático (Día siguiente al último pago)
                    </span>
                  </div>

                  {/* 🟢 INPUT FIN: CON VALIDACIÓN DE DOMINGOS */}
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => handleFechaFinChange(e.target.value)} // <--- Llama a nuestra validación
                    min={fechaInicio} // No puedes elegir una fecha anterior al inicio
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white disabled:opacity-60 focus:border-cyan-400 focus:outline-none transition-colors"
                    required
                    disabled={ponerseAlTanto}
                  />
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
                accept="image/*,.pdf"
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
                  <tr key={pago.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                    <td className="p-3 text-white font-mono text-sm">
                      {pago.folio_pago || `#${pago.id}`}
                    </td>
                    <td className="p-3 text-white">
                      {new Date(pago.fecha_pago).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="p-3 text-white font-semibold">
                      {formatCurrency(pago.monto_total || pago.monto_renta_pagado)}
                      <p className="text-xs text-gray-400">
                        Renta: {formatCurrency(pago.monto_renta_pagado)} · Póliza: {formatCurrency(pago.monto_poliza_pagado)}
                      </p>
                    </td>
                    <td className="p-3 text-white">
                      {pago.metodo_pago || 'Transferencia'}
                    </td>
                    <td className="p-3 text-white">
                      {Math.max(0, parseInt(pago.dias_atraso ?? 0))} días
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
      className="p-2 rounded-lg bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 transition-colors"
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
    'Rechazado': { bg: 'bg-red-500/20', text: 'text-red-400', icon: X },
    'Eliminado': { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: Trash2 },
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
