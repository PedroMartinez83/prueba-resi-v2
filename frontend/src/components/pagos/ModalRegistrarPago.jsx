// frontend/src/components/pagos/ModalRegistrarPago.jsx
import { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Receipt, AlertCircle, CheckCircle, User, Calendar, Shield, Wrench, Clock } from 'lucide-react';
import api from '../../services/api';

const TOLERANCIA_DIAS = 2;

 // Funciones de tolerancia
  const obtenerFechaCorrespondiente = (fechaPago) => {
    if (!fechaPago) return null;

    const fecha = typeof fechaPago === 'string'
      ? new Date(`${fechaPago}T12:00:00`)
      : new Date(fechaPago);

    if (Number.isNaN(fecha.getTime())) return null;

    // Si fuera domingo, considerar el sábado previo porque no se cobran rentas ese día
    if (fecha.getDay() === 0) {
      const ajustada = new Date(fecha);
      ajustada.setDate(ajustada.getDate() - 1);
      
      return ajustada;
    }

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

  const calcularDiasPagables = (inicio, fin) => {
    if (!inicio || !fin) return 1; // Por defecto 1 día
    
    const dInicio = new Date(`${inicio}T12:00:00`);
    const dFin = new Date(`${fin}T12:00:00`);
    
    if (dFin < dInicio) return 0;

    let diasHabiles = 0;
    let cursor = new Date(dInicio);

    while (cursor <= dFin) {
      // Si NO es domingo (0), cuenta para el pago
      if (cursor.getDay() !== 0) {
        diasHabiles++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return diasHabiles;
  };

//  LÓGICA ACTUALIZADA DE TOLERANCIA
const obtenerInfoTolerancia = (ultimoPagoData) => {
    // Validaciones básicas
    if (!ultimoPagoData || !ultimoPagoData.siguiente_fecha_pendiente) {
      return { fechaCorresponde: null, diasHabilesTranscurridos: null, diasRestantesTolerancia: null, estadoTolerancia: 'Sin información', fechaLimite: null };
    }

    const fechaCorresponde = obtenerFechaCorrespondiente(ultimoPagoData.siguiente_fecha_pendiente);
    if (!fechaCorresponde) return { fechaCorresponde: null, diasHabilesTranscurridos: null, diasRestantesTolerancia: null, estadoTolerancia: 'Sin información', fechaLimite: null };

    const hoy = new Date();

    // 1. CALCULAR FECHA LÍMITE (Fecha Pago + 2 días hábiles)
    const fechaLimite = sumarDiasHabiles(fechaCorresponde.toISOString().split('T')[0], TOLERANCIA_DIAS);
    
    // 2. CALCULAR DÍAS RESTANTES DE VIDA (Hoy vs Límite)
    const diasRestantes = calcularDiferenciaDiasReales(hoy, fechaLimite);

    // 3. CALCULAR DÍAS TRANSCURRIDOS (Fecha Corte vs Hoy) - 🟢 CORREGIDO
    // Si sale negativo (-15) significa que está adelantado 15 días.
    // Si sale positivo (3) significa que ya pasaron 3 días desde que debió pagar.
    const diasTranscurridos = calcularDiferenciaDiasReales(fechaCorresponde, hoy);

    // 4. Determinar Estado
    let estadoTolerancia = 'Al corriente';
    
    // Si ya pasó la fecha límite (días restantes negativos) -> Atrasado
    if (diasRestantes < 0) {
      estadoTolerancia = 'Atrasado';
    } 
    // Si ya pasó la fecha de corte pero no la límite (0 a 2 días restantes) -> En tolerancia
    else if (diasTranscurridos > 0) {
      estadoTolerancia = 'En tolerancia';
    } 
    // Si días transcurridos es negativo o cero -> Al corriente (Adelantado)
    else {
      estadoTolerancia = 'Al corriente';
    }

    return {
      fechaCorresponde,
      diasHabilesTranscurridos: diasTranscurridos, // 🟢 AHORA SÍ DEVUELVE EL NÚMERO
      diasRestantesTolerancia: diasRestantes,
      estadoTolerancia,
      fechaLimite
    };
  };
  const obtenerInfoToleranciaPago = (fechaPago) => {
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

  // FUNCIÓN CORREGIDA: Suma 1 día y salta domingos
  const calcularSiguienteFechaPago = (fechaUltimoPago) => {
    if (!fechaUltimoPago) return '';

    // 1. Tomamos la fecha del último pago (ej. 31 de Enero)
    const fecha = new Date(`${fechaUltimoPago}T12:00:00`); 
    
    // 2. ¡IMPORTANTE! Sumamos 1 día para ir al día que toca pagar (ej. 1 de Febrero)
    fecha.setDate(fecha.getDate() + 1);

    // 3. Ahora sí, si ese nuevo día es Domingo (0), saltamos al Lunes
    if (fecha.getDay() === 0) {
      fecha.setDate(fecha.getDate() + 1);
    }

    return fecha.toISOString().split('T')[0];
  };

const sumarDiasHabiles = (fechaInicio, diasASumar) => {
    const fecha = new Date(`${fechaInicio}T12:00:00`);
    let contador = 0;
    while (contador < diasASumar) {
      fecha.setDate(fecha.getDate() + 1);
      if (fecha.getDay() !== 0) { // Si no es domingo
        contador++;
      }
    }
    return fecha;
  };

  const calcularDiferenciaDiasReales = (fechaDesde, fechaHasta) => {
    const inicio = new Date(fechaDesde);
    const fin = new Date(fechaHasta);
    inicio.setHours(0,0,0,0);
    fin.setHours(0,0,0,0);

    // Si la fecha límite ya pasó (estamos atrasados), contamos hacia atrás
    if (inicio > fin) {
      let dias = 0;
      const cursor = new Date(fin);
      while (cursor < inicio) {
        cursor.setDate(cursor.getDate() + 1);
        if (cursor.getDay() !== 0) dias--; // Restamos días (negativo)
      }
      return dias;
    }

    // Si estamos a tiempo, contamos hacia adelante (positivo)
    let dias = 0;
    const cursor = new Date(inicio);
    while (cursor < fin) {
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() !== 0) dias++;
    }
    return dias;
  };

const ModalRegistrarPago = ({ isOpen, onClose, conductor, onSuccess }) => {
  const fechaHoy = new Date().toISOString().split('T')[0];
  const TOLERANCIA_DIAS = 2;
  const [formData, setFormData] = useState({
    conductor_id: '',
    monto_renta: 400,
    monto_extra: 100,
    destino_extra: 'poliza', // 'poliza' o 'mantenimiento'
    metodo_pago: 'Transferencia',
    referencia: '',
    observaciones: '',
    fecha_pago: fechaHoy
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewDivision, setPreviewDivision] = useState(null);
  const [conductorInfo, setConductorInfo] = useState(null);
  const [infoTolerancia, setInfoTolerancia] = useState(null);
  const [infoToleranciaPagoActual, setInfoToleranciaPagoActual] = useState(null);
  const [ultimoPagoConductor, setUltimoPagoConductor] = useState(null);
  const [diaCorrespondiente, setDiaCorrespondiente] = useState(null);


  useEffect(() => {
      if (ultimoPagoConductor && ultimoPagoConductor.siguiente_fecha_pendiente) {
        const siguienteFecha = calcularSiguienteFechaPago(ultimoPagoConductor.siguiente_fecha_pendiente);
        
        setFormData(prev => ({
          ...prev,
          fecha_pago: siguienteFecha,
          fecha_fin: siguienteFecha // Inicializamos fecha fin igual que inicio
        }));
      }
    }, [ultimoPagoConductor]);

  // Auto-llenar conductor_id cuando se recibe el prop
  useEffect(() => {
    if (conductor) {
      try {
        const tipoPoliza = conductor.tipo_poliza || 'POLIZA_100';
        const rentaDiaria = parseFloat(conductor.renta_diaria || 400);
        const montoExtraDefault = tipoPoliza === 'AHORRO_50' ? 50 : 100;
        
        setConductorInfo({
          ...conductor,
          tipo_poliza: tipoPoliza
        });

        setFormData(prev => ({
          ...prev,
          conductor_id: conductor.id,
          monto_renta: rentaDiaria.toString(),
          monto_extra: montoExtraDefault.toString(),
          destino_extra: 'poliza' // Default a póliza
        }));

        calcularPreview(rentaDiaria, montoExtraDefault, 'poliza');

        // Cargar último pago pendiente
        obtenerUltimoPagoConductor(conductor.id);
      } catch (err) {
        console.error('Error en cargarUltimoPago:', err);
        setError('Error al cargar información del conductor');
      }
    }
  }, [conductor]);

  // Obtener último pago pendiente del conductor
  const obtenerUltimoPagoConductor = async (conductorId) => {
    try {
      const response = await api.get(`/admin/pagos-rentas/conductor/${conductorId}/siguiente-pendiente`);
      if (response.data && response.data.success) {
        setUltimoPagoConductor(response.data);
      } else if (response.data && response.data.error) {
        // El conductor no tiene asignación activa, es normal
        setUltimoPagoConductor(null);
        console.log('Info: Conductor sin asignación activa');
      }
    } catch (err) {
      console.error('Error cargando último pago:', err);
      // No mostrar error al usuario, solo log
      setUltimoPagoConductor(null);
    }
  };

  // Calcular preview de división
  const calcularPreview = (renta, extra, destino) => {
    const montoRenta = parseFloat(renta) || 0;
    const montoExtra = parseFloat(extra) || 0;
    const total = montoRenta + montoExtra;

    if (total > 0) {
      setPreviewDivision({
        total: total,
        para_renta: montoRenta,
        para_extra: montoExtra,
        destino_extra: destino,
        porcentaje_renta: montoRenta > 0 ? ((montoRenta / total) * 100).toFixed(1) : '0.0',
        porcentaje_extra: montoExtra > 0 ? ((montoExtra / total) * 100).toFixed(1) : '0.0'
      });
    } else {
      setPreviewDivision(null);
    }
  };

  // Calcular info de tolerancia cuando cambia el último pago
  useEffect(() => {
    if (ultimoPagoConductor) {
      const info = obtenerInfoTolerancia(ultimoPagoConductor);
      setInfoTolerancia(info);
    } else {
      setInfoTolerancia(null);
    }
  }, [ultimoPagoConductor, obtenerInfoTolerancia]);

  // Calcular info de tolerancia del pago actual cuando cambia la fecha
  useEffect(() => {
    if (formData.fecha_pago) {
      const info = obtenerInfoToleranciaPago(formData.fecha_pago);
      setInfoToleranciaPagoActual(info);
    } else {
      setInfoToleranciaPagoActual(null);
    }
  }, [formData.fecha_pago, obtenerInfoToleranciaPago]);


const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const dataToSend = {
        conductor_id: conductor.id,       // Se usa para buscar la asignación en el Back
        monto_renta: formData.monto_renta,
        monto_extra: formData.monto_extra,
        fecha_pago: formData.fecha_pago,  // Inicio del rango
        fecha_fin: formData.fecha_fin,    // Fin del rango
        metodo_pago: formData.metodo_pago,
        referencia: formData.referencia,
        observaciones: formData.observaciones
      };

      const response = await api.post('/admin/pagos-rentas/registrar-manual', dataToSend);

      if (response.data.success) {
        onSuccess && onSuccess(response.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };
  const handleClose = () => {
    setFormData({
      conductor_id: '',
      monto_renta: '',
      monto_extra: '',
      destino_extra: 'poliza',
      metodo_pago: 'Transferencia',
      referencia: '',
      observaciones: '',
      fecha_pago: new Date().toISOString().split('T')[0]
    });
    setError(null);
    setPreviewDivision(null);
    setConductorInfo(null);
    setInfoTolerancia(null);
    setInfoToleranciaPagoActual(null);
    setUltimoPagoConductor(null);
    onClose();
  };

  if (!isOpen) return null;

   // CÁLCULOS DINÁMICOS PARA LA VISTA
  const diasCalculados = calcularDiasPagables(formData.fecha_pago, formData.fecha_fin);
  
  // Usamos los valores reales del conductor o los defaults (400/100)
  const tarifaRentaInput = parseFloat(formData.monto_renta) || 0;
  const tarifaExtraInput = parseFloat(formData.monto_extra) || 0;


  // Multiplicamos por los días seleccionados
  const totalRentaCalculado = tarifaRentaInput * diasCalculados;
  const totalExtraCalculado = tarifaExtraInput * diasCalculados;
  const granTotalCalculado = totalRentaCalculado + totalExtraCalculado;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass border border-primary/30 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-sm border-b border-primary/20 p-6 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-primary" />
                Registrar Pago Diario
              </h2>
              {conductorInfo && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-medium">{conductorInfo.nombre_conductor}</span>
                    </div>
                    <div className="text-gray-400">
                      Vehículo: <span className="text-white">{conductorInfo.numero_vehiculo || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      conductorInfo.tipo_poliza === 'AHORRO_50' 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}>
                      {conductorInfo.tipo_poliza === 'AHORRO_50' ? '💰 Ahorro $50' : '🛡️ Póliza $100'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Error</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Monto Renta */}
          <div>
            <label className="block text-white font-medium mb-2">
              💼 Monto Renta (Empresa) *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.monto_renta === 0 ? '' : formData.monto_renta}
                onChange={(e) => {
                   const val = e.target.value;
                   setFormData(prev => ({ ...prev, monto_renta: val === '' ? 0 : val }));
                }}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="400.00"
              />

            </div>
            <p className="text-gray-400 text-xs mt-1">
              Tarifa diaria x {diasCalculados} días = <span className="text-white font-bold">${(parseFloat(formData.monto_renta || 0) * diasCalculados).toLocaleString()}</span>
            </p>
          </div>

          {/* Monto Extra y Destino */}
          <div className="space-y-3">
            <label className="block text-white font-medium">
              💰 Monto Extra (Conductor) *
            </label>
            
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.monto_extra === 0 ? '' : formData.monto_extra}
                onChange={(e) => {
                   const val = e.target.value;
                   setFormData(prev => ({ ...prev, monto_extra: val === '' ? 0 : val }));
                }}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="100.00"
              />
            </div>
            <p className="text-gray-400 text-xs">
               Tarifa diaria x {diasCalculados} días = <span className="text-white font-bold">${(parseFloat(formData.monto_extra || 0) * diasCalculados).toLocaleString()}</span>
            </p>

            {/* Selector de Destino */}
            <div className="grid grid-cols-2 gap-3">
              {/* Opción: Póliza */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, destino_extra: 'poliza' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.destino_extra === 'poliza'
                    ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Shield className={`w-5 h-5 ${formData.destino_extra === 'poliza' ? 'text-purple-400' : 'text-gray-400'}`} />
                  <span className={`font-semibold ${formData.destino_extra === 'poliza' ? 'text-purple-400' : 'text-gray-400'}`}>
                    Póliza
                  </span>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Límite $50,000<br/>
                  NO se acumula
                </p>
              </button>

              {/* Opción: Mantenimiento */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, destino_extra: 'mantenimiento' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.destino_extra === 'mantenimiento'
                    ? 'bg-blue-500/20 border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'bg-white/5 border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Wrench className={`w-5 h-5 ${formData.destino_extra === 'mantenimiento' ? 'text-blue-400' : 'text-gray-400'}`} />
                  <span className={`font-semibold ${formData.destino_extra === 'mantenimiento' ? 'text-blue-400' : 'text-gray-400'}`}>
                    Mantenimiento
                  </span>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Ahorro conductor<br/>
                  SÍ se acumula
                </p>
              </button>
            </div>
          </div>
          
          {/* BLOQUE DE FECHAS (RANGO) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. FECHA INICIO (Ya la tenías) */}
            <div>
              <label className="block text-white font-medium mb-2">
                Fecha Inicio (Cubre desde) *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  required
                  value={formData.fecha_pago}
                  min={ultimoPagoConductor?.siguiente_fecha_pendiente 
                    ? calcularSiguienteFechaPago(ultimoPagoConductor.siguiente_fecha_pendiente)
                    : "2024-01-01"
                  }
                  onChange={(e) => {
                    const selectedDate = new Date(`${e.target.value}T12:00:00`);
                    if (selectedDate.getDay() === 0) {
                      setError('⛔ No se pueden seleccionar domingos en fecha inicio.');
                      // Ajuste automático al lunes
                      const lunes = new Date(selectedDate);
                      lunes.setDate(selectedDate.getDate() + 1);
                      setFormData({ 
                        ...formData, 
                        fecha_pago: lunes.toISOString().split('T')[0],
                        fecha_fin: lunes.toISOString().split('T')[0] // Reseteamos fin al cambiar inicio
                      });
                      return;
                    }
                    setError(null);
                    // Al cambiar inicio, actualizamos fin para que sea coherente
                    setFormData({ 
                      ...formData, 
                      fecha_pago: e.target.value,
                      fecha_fin: e.target.value 
                    });
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* 2. FECHA FIN (NUEVO) */}
            <div>
              <label className="block text-white font-medium mb-2">
                Fecha Fin (Hasta) *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  required
                  value={formData.fecha_fin || formData.fecha_pago}
                  min={formData.fecha_pago} // No puede ser menor al inicio
                  onChange={(e) => {
                    const selectedDate = new Date(`${e.target.value}T12:00:00`);
                    if (selectedDate.getDay() === 0) {
                      alert('⛔ La fecha fin no puede ser domingo (no se cobra). Selecciona sábado o lunes.');
                      return;
                    }
                    setFormData({ ...formData, fecha_fin: e.target.value });
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* MENSAJE DE RANGO Y DÍAS CALCULADOS */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
            <p className="text-blue-200 text-sm">
              📅 Rango seleccionado: <strong>{calcularDiasPagables(formData.fecha_pago, formData.fecha_fin)} días hábiles</strong> a pagar.
              <br/>
              <span className="text-xs text-blue-300/70">(Los domingos intermedios no se cobran)</span>
            </p>
          </div>

          {/* Mostrar Día Correspondiente */}
          {diaCorrespondiente && (
            <div className="glass border-2 border-primary/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-white">Día Correspondiente al Pago</h3>
              </div>
              <div className="bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-gray-300 text-sm mb-2">Este pago cubre el día:</p>
                <p className="text-2xl font-bold text-primary capitalize">
                  {formatDiaCorrespondiente(diaCorrespondiente)}
                </p>
                {new Date(formData.fecha_pago).getDay() === 0 && (
                  <div className="mt-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-yellow-400 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <strong>Nota:</strong> Has seleccionado un domingo. Se ha ajustado automáticamente al sábado anterior.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Información de Tolerancia */}
          {infoTolerancia && (
            <div className="glass border-2 border-primary/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-white">Días Restantes del Conductor</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  infoTolerancia.estadoTolerancia === 'Al corriente' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  infoTolerancia.estadoTolerancia === 'En tolerancia' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {infoTolerancia.estadoTolerancia}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Días Transcurridos */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-gray-400 text-sm mb-1 flex items-center gap-1">
                    {infoTolerancia.diasHabilesTranscurridos < 0 ? (
                      <>✨ Estado del Pago</>
                    ) : (
                      <>⏳ Días Transcurridos</>
                    )}
                  </p>
                  
                  <div className="flex items-baseline gap-1">
                    <p className={`text-2xl font-bold ${
                      infoTolerancia.diasHabilesTranscurridos <= 0 ? 'text-blue-400' : 'text-white'
                    }`}>
                      {/* LÓGICA VISUAL: */}
                      {infoTolerancia.diasHabilesTranscurridos < 0 
                        ? `+${Math.abs(infoTolerancia.diasHabilesTranscurridos)}` // Muestra "+15" en vez de "-15"
                        : infoTolerancia.diasHabilesTranscurridos // Muestra "3" normal
                      }
                    </p>
                    
                    {/* Subtexto dinámico */}
                    <span className="text-xs text-gray-400 font-medium">
                       {infoTolerancia.diasHabilesTranscurridos < 0 
                        ? 'días a favor' 
                        : infoTolerancia.diasHabilesTranscurridos === 1 ? 'día transcurrido' : 'días transcurridos'}
                    </span>
                  </div>

                  <p className="text-gray-500 text-[10px] mt-1">
                    {infoTolerancia.diasHabilesTranscurridos < 0 
                      ? 'Conductor adelantado (Pago Seguro)' 
                      : 'Desde el ultimo pago'}
                  </p>
                </div>

                {/* Días Restantes */}
                <div className={`bg-gradient-to-br rounded-lg p-4 border ${
                  infoTolerancia.estadoTolerancia === 'Al corriente' ? 'from-green-500/10 to-green-600/10 border-green-500/30' :
                  infoTolerancia.estadoTolerancia === 'En tolerancia' ? 'from-yellow-500/10 to-yellow-600/10 border-yellow-500/30' :
                  'from-red-500/10 to-red-600/10 border-red-500/30'
                }`}>
                  <p className="text-gray-300 text-sm mb-1 flex items-center gap-1">
                    ⏰ Días restantes de tolerancia
                  </p>
                  <p className={`text-2xl font-bold ${
                    infoTolerancia.estadoTolerancia === 'Al corriente' ? 'text-green-400' :
                    infoTolerancia.estadoTolerancia === 'En tolerancia' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {infoTolerancia.diasRestantesTolerancia !== null ? infoTolerancia.diasRestantesTolerancia : 'N/A'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Máximo: {TOLERANCIA_DIAS} días hábiles
                  </p>
                </div>

                {/* Estado Actual */}
                <div className={`bg-gradient-to-br rounded-lg p-4 border ${
                  infoTolerancia.estadoTolerancia === 'Al corriente' ? 'from-green-500/10 to-green-600/10 border-green-500/30' :
                  infoTolerancia.estadoTolerancia === 'En tolerancia' ? 'from-yellow-500/10 to-yellow-600/10 border-yellow-500/30' :
                  'from-red-500/10 to-red-600/10 border-red-500/30'
                }`}>
                  <p className="text-gray-300 text-sm mb-1 flex items-center gap-1">
                    📊 Estado actual
                  </p>
                  <p className={`text-lg font-bold ${
                    infoTolerancia.estadoTolerancia === 'Al corriente' ? 'text-green-400' :
                    infoTolerancia.estadoTolerancia === 'En tolerancia' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {infoTolerancia.estadoTolerancia}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Último pago: {ultimoPagoConductor ? new Date(ultimoPagoConductor.siguiente_fecha_pendiente).toLocaleDateString('es-MX') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sistema "Dos Cubetas" DINÁMICO */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              Sistema "Dos Cubetas" ({diasCalculados} {diasCalculados === 1 ? 'día' : 'días'})
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Cubeta 1: RENTA */} 
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 p-3 rounded-lg text-center">
                  <div className="text-blue-400 text-xs font-bold mb-1">RENTA</div> 
                  <div className="text-xl font-bold text-white tracking-tight">
                    ${totalRentaCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-blue-300/60 mt-1">
                    (${tarifaRentaInput} x {diasCalculados} días)
                  </div>
                </div>
              </div>

              {/* Cubeta 2: PÓLIZA */}
              <div className="relative group">
                <div className="absolute inset-0 bg-purple-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-3 rounded-lg text-center">
                  <div className="text-purple-400 text-xs font-bold mb-1">
                    {formData.destino_extra === 'mantenimiento' ? 'MANTENIMIENTO' : 'PÓLIZA'} (Total)
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">
                    ${totalExtraCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-purple-300/60 mt-1">
                    (${tarifaExtraInput} x {diasCalculados} días)
                  </div>
                </div>
              </div>
            </div>

            {/* Total Combinado */}
              <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center px-2">
              <span className="text-gray-400 text-xs">Total a Pagar:</span>
              <span className="text-lg font-bold text-emerald-400">
                ${granTotalCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Información de Tolerancia del Pago Actual */}
          {infoToleranciaPagoActual && (
            <div className="glass border-2 border-primary/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-white">Estado Después del Pago</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  infoToleranciaPagoActual.estadoTolerancia === 'Al corriente' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  infoToleranciaPagoActual.estadoTolerancia === 'En tolerancia' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {infoToleranciaPagoActual.estadoTolerancia}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Día Correspondiente */}
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-1 flex items-center gap-1">
                    📅 Día que cubrirá
                  </p>
                  <p className="text-lg font-bold text-blue-400">
                    {formatDiaCorrespondiente(infoToleranciaPagoActual.fechaCorresponde)}
                  </p>
                </div>

                {/* Días Restantes */}
                <div className={`bg-gradient-to-br rounded-lg p-4 border ${
                  infoToleranciaPagoActual.estadoTolerancia === 'Al corriente' ? 'from-green-500/10 to-green-600/10 border-green-500/30' :
                  infoToleranciaPagoActual.estadoTolerancia === 'En tolerancia' ? 'from-yellow-500/10 to-yellow-600/10 border-yellow-500/30' :
                  'from-red-500/10 to-red-600/10 border-red-500/30'
                }`}>
                  <p className="text-gray-300 text-sm mb-1 flex items-center gap-1">
                    ⏰ Días restantes después del pago
                  </p>
                  <p className={`text-2xl font-bold ${
                    infoToleranciaPagoActual.estadoTolerancia === 'Al corriente' ? 'text-green-400' :
                    infoToleranciaPagoActual.estadoTolerancia === 'En tolerancia' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {infoToleranciaPagoActual.diasRestantesTolerancia !== null ? infoToleranciaPagoActual.diasRestantesTolerancia : 'N/A'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Máximo: {TOLERANCIA_DIAS} días hábiles
                  </p>
                </div>

                {/* Estado Actual */}
                <div className={`bg-gradient-to-br rounded-lg p-4 border ${
                  infoToleranciaPagoActual.estadoTolerancia === 'Al corriente' ? 'from-green-500/10 to-green-600/10 border-green-500/30' :
                  infoToleranciaPagoActual.estadoTolerancia === 'En tolerancia' ? 'from-yellow-500/10 to-yellow-600/10 border-yellow-500/30' :
                  'from-red-500/10 to-red-600/10 border-red-500/30'
                }`}>
                  <p className="text-gray-300 text-sm mb-1 flex items-center gap-1">
                    📊 Estado después del pago
                  </p>
                  <p className={`text-lg font-bold ${
                    infoToleranciaPagoActual.estadoTolerancia === 'Al corriente' ? 'text-green-400' :
                    infoToleranciaPagoActual.estadoTolerancia === 'En tolerancia' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {infoToleranciaPagoActual.estadoTolerancia}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Días transcurridos: {infoToleranciaPagoActual.diasHabilesTranscurridos || 0}
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* Método de Pago */}
          <div>
            <label className="block text-white font-medium mb-2">
              Método de Pago *
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                required
                value={formData.metodo_pago}
                onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
              >
                <option value="Transferencia" className="bg-gray-800">Transferencia</option>
                <option value="Efectivo" className="bg-gray-800">Efectivo</option>
                <option value="Tarjeta" className="bg-gray-800">Tarjeta</option>
                <option value="Stripe" className="bg-gray-800">Stripe</option>
              </select>
            </div>
          </div>


           {/* Referencia de Pago */}
          {['Transferencia', 'Tarjeta'].includes(formData.metodo_pago) && (
            <div>
              <label className="block text-white font-medium mb-2">
                Referencia de Pago {formData.metodo_pago === 'Transferencia' ? '(Folio/CLABE)' : '(Últimos dígitos)'}
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.referencia}
                  onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={
                    formData.metodo_pago === 'Transferencia'
                      ? 'Número de referencia o folio de transferencia'
                      : 'Últimos 4 dígitos de la tarjeta'
                  }
                />
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-white font-medium mb-2">
              Observaciones
            </label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Notas adicionales sobre este pago..."
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-white/10 border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.monto_renta || !formData.monto_extra}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {loading ? '⏳ Registrando...' : '✅ Crear Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalRegistrarPago;
