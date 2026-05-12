// backend/controllers/conductor/pagosController.js
const { db } = require('../../config/database');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { resolveConductorId } = require('./conductorContextHelper');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==========================================
// HELPERS Y UTILIDADES
// ==========================================

const toDateString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split('T')[0];
};

const DEFAULT_POLIZA_DIARIA = 100;

const getPolizaDiaria = (value) => {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_POLIZA_DIARIA;
  }
  return Math.max(parsed, DEFAULT_POLIZA_DIARIA);
};

const getFechaInicioCobro = (fechaAsignacion) => {
  const fechaAsignacionString = toDateString(fechaAsignacion);
  if (!fechaAsignacionString) {
    return null;
  }
  return fechaAsignacionString;
};

const addDaysToDate = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};

// HELPER IMPORTANTE: Cuenta días cobrables en un rango (ignora Domingos)
const contarDiasCobrables = (fechaInicio, fechaFin) => {
  let contador = 0;
  // Creamos objetos Date asegurando la zona horaria para no tener desfases
  let actual = new Date(fechaInicio + 'T12:00:00');
  const fin = new Date(fechaFin + 'T12:00:00');

  while (actual <= fin) {
    const diaSemana = actual.getDay(); // 0 = Domingo
    if (diaSemana !== 0) {
      contador++;
    }
    actual.setDate(actual.getDate() + 1);
  }
  return contador;
};

// Pequeña utilidad para logs
function contarDiasNaturales(inicio, fin) {
    const start = new Date(inicio);
    const end = new Date(fin);
    const diff = Math.abs(end - start);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

const uploadToCloudinary = (fileBuffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

// ==========================================
// LÓGICA DE CÁLCULO DE DEUDAS (Corregida para leer fecha_pago_fin)
// ==========================================

const buildPendientesData = async (trx, conductorId, fechaInicioSolicitada = null, fechaFinSolicitada = null) => {
  const asignacion = await trx('asignaciones')
    .where({ conductor_id: conductorId, activa: true })
    .first();

  if (!asignacion) {
    return { error: { status: 404, message: 'No tienes vehículo asignado' } };
  }

  const fechaInicioAsignacion = getFechaInicioCobro(asignacion.fecha_inicio);
  const fechaCorte = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

  if (!fechaInicioAsignacion) {
    return { error: { status: 400, message: 'Error con la fecha de asignación.' } };
  }

  // 1. Obtenemos TODOS los pagos previos (Aprobados, Confirmados o Pendientes)
  const pagosRegistrados = await trx('pagos_diarios')
    .where({ asignacion_id: asignacion.id })
    .whereIn('status', ['Confirmado', 'Pendiente', 'Aprobado'])
    .select('fecha_pago', 'fecha_pago_fin', 'observaciones');

  const fechasPagadas = new Set();
  let ultimaFechaPagada = null; 

  // 2. Procesamos pagos para encontrar el más reciente y llenar el Set de días pagados
  pagosRegistrados.forEach(pago => {
    const inicio = toDateString(pago.fecha_pago);
    // AQUÍ ESTÁ LA CLAVE: Si tiene fecha fin, usamos ese rango. Si no, es un solo día.
    const fin = pago.fecha_pago_fin ? toDateString(pago.fecha_pago_fin) : inicio;

    if (inicio) {
        // Actualizar última fecha global
        if (!ultimaFechaPagada || fin > ultimaFechaPagada) {
            ultimaFechaPagada = fin;
        }

        // Marcar todos los días del rango como "Pagados" en el Set
        // Así evitamos que buildPendientesData los vuelva a cobrar
        let cursor = inicio;
        while (cursor <= fin) {
            fechasPagadas.add(cursor);
            cursor = addDaysToDate(cursor, 1);
        }
    }
  });

  // 3. DEFINIR EL INICIO DEL CÁLCULO
  let fechaCursor;

  if (fechaInicioSolicitada) {
    fechaCursor = fechaInicioSolicitada;
  } else if (ultimaFechaPagada) {
    // Si ya pagó algo, empezamos al día siguiente
    fechaCursor = addDaysToDate(ultimaFechaPagada, 1);
    
    // Validación: no podemos empezar antes de la asignación
    if (fechaCursor < fechaInicioAsignacion) fechaCursor = fechaInicioAsignacion;
  } else {
    // Si es nuevo, fecha de asignación
    fechaCursor = fechaInicioAsignacion;
  }

  // Límite final
  const fechaLimite = fechaFinSolicitada ? fechaFinSolicitada : fechaCorte;
  const fechasPendientes = [];

  // 4. Calculamos la deuda (Saltando domingos y días ya pagados)
  while (fechaCursor <= fechaLimite) {
    const diaSemana = new Date(`${fechaCursor}T12:00:00`).getDay();
    
    // Si NO es domingo Y NO está en el Set de pagados
    if (diaSemana !== 0 && !fechasPagadas.has(fechaCursor)) {
      fechasPendientes.push(fechaCursor);
    }
    fechaCursor = addDaysToDate(fechaCursor, 1);
  }

  return {
    asignacion,
    fechasPendientes,
    siguienteFechaPendiente: fechasPendientes.length > 0 ? fechasPendientes[0] : null,
    fechaCorte
  };
};

// =====================================================
// OBTENER MIS PAGOS (Historial)
// =====================================================
const getMisPagos = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const limit = parseInt(req.query.limit) || 1000;

    const pagos = await db('pagos_diarios as pd')
      .join('asignaciones as a', 'pd.asignacion_id', 'a.id')
      .where('a.conductor_id', conductorId)
      .andWhere('a.activa', true)
      .orderBy('pd.fecha_pago', 'desc')
      .limit(limit)
      .select(
        'pd.id',
        'pd.fecha_pago',
        'pd.fecha_pago_fin', // <--- Importante ver el fin del rango
        'pd.monto_total',
        'pd.monto_renta_pagado',
        'pd.monto_poliza_pagado',
        'pd.status',
        'pd.metodo_pago',
        'pd.comprobante_url',
        'pd.observaciones',
        'pd.created_at'
      )
      .select(
        db.raw("LPAD(pd.id::text, 6, '0') as folio_pago"),
        db.raw('GREATEST(0, CURRENT_DATE - DATE(pd.fecha_pago)) as dias_atraso')
      );

    res.json({
      success: true,
      pagos,
      message: pagos.length ? null : 'No hay pagos realizados en los últimos 30 días'
    });

  } catch (error) {
    console.error('Error en getMisPagos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener pagos', error: error.message });
  }
};

// =====================================================
// OBTENER RESUMEN DE CUENTA
// =====================================================
const getResumenCuenta = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }

    // 1. Buscamos la asignación actual
    const asignacionActiva = await db('asignaciones as a')
      .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .where('a.conductor_id', conductorId)
      .where('a.activa', true)
      .select(
        'a.id',
        'a.renta_diaria',
        'a.abono_poliza_mantenimiento',
        'a.fecha_inicio',
        'v.total_corrida',
        'v.plazo_corrida',
        'v.porcentaje_pagado'
      )
      .first();
      
    // 🛡️ VALIDACIÓN: Si no tiene carro activo, devolvemos todo en ceros
    if (!asignacionActiva) {
        return res.json({
            success: true,
            message: 'No hay vehículo asignado',
            total_pagado: 0, total_pendiente: 0, total_plan: 0, total_pagos_realizados: 0,
            ultimo_pago_aprobado: null, ultimo_pago_registrado: null, fecha_inicio_asignacion: null
        });
    }

    // 2. 🚨 CORRECCIÓN CLAVE: Filtramos SOLO por la asignación actual 🚨
    const baseQuery = db('pagos_diarios as pd')
      .where('pd.asignacion_id', asignacionActiva.id);

    // Totales financieros (Ahora sí, solo de este carro)
    const totalPagado = await baseQuery.clone().where('pd.status', 'Confirmado').sum('pd.monto_renta_pagado as total').first();
    const totalPendiente = await baseQuery.clone().whereIn('pd.status', ['Pendiente']).sum('pd.monto_renta_pagado as total').first();
    const totalPagosRealizados = await baseQuery.clone().where('pd.status', 'Confirmado').count('pd.id as count').first();

    // 3. Último pago APROBADO (Mejorado para tomar en cuenta rangos)
    const ultimoPagoAprobado = await baseQuery
      .clone()
      .where('pd.status', 'Confirmado')
      // Ordenamos tomando en cuenta la fecha_pago_fin por si pagó por rango
      .orderByRaw('COALESCE(pd.fecha_pago_fin, pd.fecha_pago) DESC')
      .first('pd.fecha_pago', 'pd.fecha_pago_fin');

    // Último pago GENERAL
    const ultimoPagoGeneral = await baseQuery
      .clone()
      .whereIn('pd.status', ['Aprobado', 'Confirmado', 'Pendiente'])
      .orderByRaw('COALESCE(pd.fecha_pago_fin, pd.fecha_pago) DESC')
      .first();

    const fechaUltimoGeneral = ultimoPagoGeneral 
       ? (ultimoPagoGeneral.fecha_pago_fin || ultimoPagoGeneral.fecha_pago) 
       : null;

    const conductor = await db('conductores')
      .where({ id: conductorId })
      .select('saldo_ahorro_mantenimiento', 'saldo_poliza_mecanica')
      .first();

    const totalPlan = parseFloat(asignacionActiva?.total_corrida || 0);
    const totalPagadoValue = parseFloat(totalPagado?.total || 0);
    const totalPendienteValue = totalPlan > 0
      ? Math.max(0, totalPlan - totalPagadoValue)
      : parseFloat(totalPendiente?.total || 0);

    const fechaAprobada = ultimoPagoAprobado 
       ? (ultimoPagoAprobado.fecha_pago_fin || ultimoPagoAprobado.fecha_pago) 
       : null;

    const rentaDb = parseFloat(asignacionActiva?.renta_diaria || 0);
    const polizaDb = parseFloat(asignacionActiva?.abono_poliza_mantenimiento || 0);

    res.json({
      success: true,
      total_pagado: totalPagadoValue,
      total_pendiente: totalPendienteValue,
      total_plan: totalPlan || (totalPagadoValue + totalPendienteValue),
      plazo_corrida: asignacionActiva?.plazo_corrida ? parseInt(asignacionActiva.plazo_corrida) : null,
      porcentaje_pagado: parseFloat(asignacionActiva?.porcentaje_pagado || 0),
      total_pagos_realizados: parseInt(totalPagosRealizados?.count || 0),
      renta_diaria: rentaDb > 0 ? rentaDb : 400,
      abono_poliza_mantenimiento: polizaDb > 0 ? polizaDb : 100,
      
      ultimo_pago_aprobado: fechaAprobada,
      ultimo_pago_registrado: fechaUltimoGeneral,
      
      fecha_inicio_asignacion: asignacionActiva?.fecha_inicio || null,
      saldo_poliza: parseFloat(conductor?.saldo_poliza_mecanica || 0),
      saldo_ahorro: parseFloat(conductor?.saldo_ahorro_mantenimiento || 0)
    });

  } catch (error) {
    console.error('Error en getResumenCuenta:', error);
    res.status(500).json({ success: false, message: 'Error al obtener resumen', error: error.message });
  }
};

// =====================================================
// REGISTRAR PAGO UNIFICADO (Día único o Rango) 🟢
// =====================================================
const registrarPago = async (req, res) => {
  const trx = await db.transaction();

  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const { fecha_inicio, fecha_fin, notas, metodo_pago } = req.body;

    // Validaciones
    if (!req.file) {
      await trx.rollback();
      return res.status(400).json({ message: 'El comprobante de pago es obligatorio' });
    }

    const asignacion = await trx('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      await trx.rollback();
      return res.status(404).json({ message: 'No tienes vehículo asignado actualmente.' });
    }

    // Definición de Fechas
    const fInicio = toDateString(fecha_inicio);
    const fFin = toDateString(fecha_fin || fecha_inicio); 

    // --- 🛡️ 1. VALIDACIÓN DE CONTINUIDAD (CORREGIDA) ---
    const ultimoPagoRegistrado = await trx('pagos_diarios')
      .where('asignacion_id', asignacion.id)
      .whereIn('status', ['Aprobado', 'Pendiente', 'Confirmado', 'Solicitud_borrado'])
      .orderByRaw('COALESCE(fecha_pago_fin, fecha_pago) DESC')
      .first();

    let fechaEsperada;

    if (ultimoPagoRegistrado) {
        // Si ya hay pagos, seguimos la cadena normal (el día siguiente al último pago)
        const rawFecha = ultimoPagoRegistrado.fecha_pago_fin || ultimoPagoRegistrado.fecha_pago;
        const fechaUltima = toDateString(rawFecha);
        fechaEsperada = addDaysToDate(fechaUltima, 1);
    } else {
        // 🚨 AQUÍ ESTÁ LA MAGIA 🚨
        // Si es el PRIMER pago de este conductor con este carro, 
        // su cuenta arranca estrictamente en la fecha que se le asignó.
        // ¡Adiós al primero de enero!
        fechaEsperada = toDateString(asignacion.fecha_inicio);
    }

    // Validación: Si intenta pagar después de lo esperado (dejando hueco)
    if (fInicio > fechaEsperada) {
        const finHueco = addDaysToDate(fInicio, -1);
        
        // Verificamos si los días en el hueco son cobrables (si son domingos, se permite el salto)
        const diasHueco = contarDiasCobrables(fechaEsperada, finHueco);
        
        if (diasHueco > 0) {
             await trx.rollback();
             return res.status(400).json({ 
                message: `Error de continuidad: No puedes dejar huecos. Tu último pago cubre hasta ${toDateString(addDaysToDate(fechaEsperada, -1))}. Debes pagar los ${diasHueco} días hábiles pendientes comenzando desde ${fechaEsperada}.` 
             });
        }
    }

    // Validación: Si intenta pagar después de lo esperado (dejando hueco)
    if (fInicio > fechaEsperada) {
        const finHueco = addDaysToDate(fInicio, -1);
        
        
        // Verificamos si los días en el hueco son cobrables (si son domingos, se permite el salto)
        const diasHueco = contarDiasCobrables(fechaEsperada, finHueco);
        
        if (diasHueco > 0) {
             await trx.rollback();
             return res.status(400).json({ 
                message: `Error de continuidad: No puedes dejar huecos. Tu último pago cubre hasta ${toDateString(addDaysToDate(fechaEsperada, -1))}. Debes pagar los ${diasHueco} días hábiles pendientes comenzando desde ${fechaEsperada}.` 
             });
        }
    }
    // -----------------------------------------------------------

    // Cálculo de Días a Cobrar
    const diasACobrar = contarDiasCobrables(fInicio, fFin);

    if (diasACobrar === 0) {
        await trx.rollback();
        return res.status(400).json({ 
            message: 'El rango seleccionado solo contiene días inhábiles (Domingos) y no genera cobro.' 
        });
    }

    // Validación de Traslape
    const traslape = await trx('pagos_diarios')
      .where('asignacion_id', asignacion.id)
      .whereIn('status', ['Aprobado', 'Pendiente', 'Confirmado', 'Solicitud_borrado'])
      .andWhere(function() {
        this.whereRaw('fecha_pago <= ?', [fFin])
            .andWhereRaw('COALESCE(fecha_pago_fin, fecha_pago) >= ?', [fInicio]);
      })
      .first();

if (traslape) {
       await trx.rollback();

       // 1. Configuración para formato largo (ej: "10 de enero de 2026")
       const opcionesFecha = { 
           year: 'numeric', 
           month: 'long', 
           day: 'numeric',
           timeZone: 'UTC' // ⚠️ IMPORTANTE: Usamos UTC para que no te reste un día por la zona horaria
       };
       
       // 2. Convertimos la fecha
       const fechaConflicto = new Date(traslape.fecha_pago)
           .toLocaleDateString('es-MX', opcionesFecha);
       
       let mensajeError = `Conflicto de fechas: El periodo seleccionado choca con un pago ya registrado del día ${fechaConflicto}.`;
       
       // Mensaje específico si es una solicitud de borrado
       if (traslape.status === 'Solicitud_borrado') {
           mensajeError = `⛔ FECHA BLOQUEADA: Existe una Solicitud de Eliminación en proceso para el día ${fechaConflicto}. Hasta que Dirección no la apruebe definitivamente, esa fecha sigue ocupada.`;
       }

       return res.status(400).json({ 
         success: false,
         message: mensajeError
       });
    }

    // Subida de Imagen
    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: 'auto',
      folder: `comprobantes_pago/${conductorId}`,
      // 🚀 EL TRUCO DE ORO: Forzamos a Cloudinary a convertir TODO a JPG.
      // Así matamos el problema de que el HEIC no se pueda ver en el panel de Admin.
      format: 'jpg', 
      transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }]
    });

    // Cálculo Monetario TOTAL
    const rentaDiaria = parseFloat(asignacion.renta_diaria || 0);
    const polizaDiaria = getPolizaDiaria(asignacion.abono_poliza_mantenimiento);
    
    const totalRenta = rentaDiaria * diasACobrar;
    const totalPoliza = polizaDiaria * diasACobrar;
    const granTotal = totalRenta + totalPoliza;

    const textoObservacion = notas || (diasACobrar > 1 
        ? `Pago por rango de ${diasACobrar} días hábiles.` 
        : `Pago del día ${fInicio}`);

    const [nuevoId] = await trx('pagos_diarios').insert({
        asignacion_id: asignacion.id,
        monto_total: granTotal,
        monto_renta_pagado: totalRenta,
        monto_poliza_pagado: totalPoliza,
        fecha_pago: fInicio,
        fecha_pago_fin: fFin,
        metodo_pago: metodo_pago || 'Transferencia',
        comprobante_url: result.secure_url,
        observaciones: textoObservacion,
        status: 'Pendiente',
        created_at: trx.fn.now(),
        updated_at: trx.fn.now()
    }).returning('id');

    await trx.commit();

    res.status(201).json({
      success: true,
      message: `Pago registrado correctamente. Se cobraron ${diasACobrar} días hábiles.`,
      pago: { id: nuevoId, monto: granTotal, dias_pagados: diasACobrar }
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en registrarPago:', error);
    res.status(500).json({ success: false, message: 'Error interno al procesar el pago', error: error.message });
  }
};

// =====================================================
// OBTENER RESUMEN PARA PONERSE AL TANTO
// =====================================================
const getResumenPonerseAlTanto = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const pendientesData = await buildPendientesData(db, conductorId);

    if (pendientesData.error) {
      return res.status(pendientesData.error.status).json({ success: false, message: pendientesData.error.message });
    }

    const { fechasPendientes, siguienteFechaPendiente, fechaCorte, asignacion } = pendientesData;
    const totalDias = fechasPendientes.length;
    const rentaDiaria = parseFloat(asignacion?.renta_diaria || 400);
    const polizaDiaria = getPolizaDiaria(asignacion?.abono_poliza_mantenimiento);

    res.json({
      success: true,
      total_dias: totalDias,
      total_monto: (rentaDiaria + polizaDiaria) * totalDias,
      total_monto_renta: rentaDiaria * totalDias,
      total_monto_poliza: polizaDiaria * totalDias,
      fecha_inicio_pendiente: siguienteFechaPendiente,
      fecha_corte: fechaCorte,
      renta_diaria: rentaDiaria,
      poliza_diaria: polizaDiaria
    });
  } catch (error) {
    console.error('Error en getResumenPonerseAlTanto:', error);
    res.status(500).json({ success: false, message: 'Error al obtener resumen de adeudos', error: error.message });
  }
};

// =====================================================
// OBTENER SALDO DE PÓLIZA (LEER DEL CONDUCTOR)
// =====================================================
const getMiSaldoPoliza = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }

    // 1. Buscamos los datos personales del conductor (Ahorro y Tipo de Póliza)
    const conductor = await db('conductores')
      .where({ id: conductorId })
      .select('saldo_ahorro_mantenimiento', 'saldo_poliza_mecanica', 'tipo_poliza')
      .first();

    if (!conductor) {
      return res.status(404).json({ success: false, message: 'Conductor no encontrado' });
    }

    // 2. Opcional: identificar vehículo actual solo para referencia visual
    const asignacionActiva = await db('asignaciones')
      .join('vehiculos', 'asignaciones.vehiculo_id', 'vehiculos.id')
      .where('asignaciones.conductor_id', conductorId)
      .where('asignaciones.activa', true)
      .select('vehiculos.numero_vehiculo')
      .first();

    res.json({
      success: true,
      saldo_poliza: parseFloat(conductor.saldo_poliza_mecanica || 0),
      
      saldo_ahorro: parseFloat(conductor.saldo_ahorro_mantenimiento || 0),
      tipo_poliza: conductor.tipo_poliza,
      
      // Opcional: Le mandamos el número del carro para que el Frontend sepa de dónde salió el dinero
      vehiculo_actual: asignacionActiva ? asignacionActiva.numero_vehiculo : 'Sin vehículo asignado'
    });

  } catch (error) {
    console.error('Error en getMiSaldoPoliza:', error);
    res.status(500).json({ success: false, message: 'Error al obtener saldo', error: error.message });
  }
};

module.exports = {
  getMisPagos,
  getResumenCuenta,
  registrarPago,
  getResumenPonerseAlTanto,
  getMiSaldoPoliza
};
