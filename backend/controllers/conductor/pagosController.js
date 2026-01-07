// backend/controllers/conductor/pagosController.js
const { db } = require('../../config/database');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

const MIN_FECHA_PENDIENTES = '2026-01-01';

const getFechaInicioCobro = (fechaAsignacion) => {
  const fechaAsignacionString = toDateString(fechaAsignacion);
  if (!fechaAsignacionString) {
    return null;
  }
  return fechaAsignacionString < MIN_FECHA_PENDIENTES
    ? MIN_FECHA_PENDIENTES
    : fechaAsignacionString;
};

const formatDisplayDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const parts = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const year = parts.find((part) => part.type === 'year')?.value || '';
  return `${day} de ${month} del ${year}`;
};

const addDaysToDate = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};

const getNextExpectedDate = (startDate, paidDates) => {
  let expected = startDate;
  const sortedDates = [...paidDates].sort();

  for (const paidDate of sortedDates) {
    if (paidDate < expected) {
      continue;
    }

    if (paidDate === expected) {
      expected = addDaysToDate(expected, 1);
      continue;
    }

    if (paidDate > expected) {
      break;
    }
  }

  return expected;
};

const buildPendientesData = async (trx, conductorId) => {
  const asignacion = await trx('asignaciones')
    .where({ conductor_id: conductorId, activa: true })
    .first();

  if (!asignacion) {
    return {
      error: {
        status: 404,
        message: 'No tienes vehículo asignado'
      }
    };
  }

  const fechaInicioAsignacion = getFechaInicioCobro(asignacion.fecha_inicio);
  const fechaCorte = toDateString(new Date());

  if (!fechaInicioAsignacion || !fechaCorte) {
    return {
      error: {
        status: 400,
        message: 'No se pudo determinar el rango de fechas pendiente'
      }
    };
  }

  const pagosRegistrados = await trx('pagos_diarios')
    .where({ asignacion_id: asignacion.id })
    .whereIn('status', ['Confirmado', 'Pendiente'])
    .select('fecha_pago');

  const fechasPagadas = new Set(
    pagosRegistrados
      .map((pago) => toDateString(pago.fecha_pago))
      .filter(Boolean)
  );

  const siguienteFechaPendiente = getNextExpectedDate(
    fechaInicioAsignacion,
    fechasPagadas
  );

  if (siguienteFechaPendiente > fechaCorte) {
    return {
      asignacion,
      fechaInicioAsignacion,
      fechaCorte,
      siguienteFechaPendiente,
      fechasPendientes: []
    };
  }

  const fechasPendientes = [];
  let fechaCursor = siguienteFechaPendiente;

  while (fechaCursor <= fechaCorte) {
    if (!fechasPagadas.has(fechaCursor)) {
      fechasPendientes.push(fechaCursor);
    }
    fechaCursor = addDaysToDate(fechaCursor, 1);
  }

  return {
    asignacion,
    fechaInicioAsignacion,
    fechaCorte,
    siguienteFechaPendiente,
    fechasPendientes
  };
};

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

// =====================================================
// OBTENER MIS PAGOS
// =====================================================
const getMisPagos = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;
    const limit = parseInt(req.query.limit) || 50;

    const pagos = await db('pagos_diarios as pd')
      .join('asignaciones as a', 'pd.asignacion_id', 'a.id')
      .where('a.conductor_id', conductorId)
      .where((builder) => {
        builder
          .whereRaw('pd.fecha_pago >= CURRENT_DATE - INTERVAL \'30 days\'')
          .orWhere('pd.status', 'Pendiente');
      })
      .orderBy('pd.fecha_pago', 'desc')
      .limit(limit)
      .select(
        'pd.id',
        'pd.fecha_pago',
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
      message: pagos.length ? null : 'No hay pagos realizados en los últimos 30 días ni adeudos pendientes'
    });

  } catch (error) {
    console.error('Error en getMisPagos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pagos',
      error: error.message
    });
  }
};

// =====================================================
// OBTENER RESUMEN DE CUENTA
// =====================================================
const getResumenCuenta = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;

    // Obtener asignación activa y datos del plan de pagos
    const asignacionActiva = await db('asignaciones as a')
      .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .where('a.conductor_id', conductorId)
      .where('a.activa', true)
      .select(
        'a.id',
        'a.renta_diaria',
        'a.abono_poliza_mantenimiento',
        'v.total_corrida',
        'v.plazo_corrida'
      )
      .first();

    const baseQuery = db('pagos_diarios as pd')
      .join('asignaciones as a', 'pd.asignacion_id', 'a.id')
      .where('a.conductor_id', conductorId);

    // Total pagado
    const totalPagado = await baseQuery
      .clone()
      .where('pd.status', 'Confirmado')
      .sum('pd.monto_renta_pagado as total')
      .first();

    // Total pendiente
    const totalPendiente = await baseQuery
      .clone()
      .whereIn('pd.status', ['Pendiente'])
      .sum('pd.monto_renta_pagado as total')
      .first();

    // Total de pagos realizados
    const totalPagosRealizados = await baseQuery
      .clone()
      .where('pd.status', 'Confirmado')
      .count('pd.id as count')
      .first();

    const ultimoPagoAprobado = await baseQuery
      .clone()
      .where('pd.status', 'Confirmado')
      .orderBy('pd.fecha_pago', 'desc')
      .first('pd.fecha_pago');

    // Obtener saldos del conductor
    const conductor = await db('conductores')
      .where({ id: conductorId })
      .select('saldo_poliza_mecanica', 'saldo_ahorro_mantenimiento')
      .first();

    // Calcular plan total y pendiente usando el plazo del vehículo si existe
    const totalPlan = parseFloat(asignacionActiva?.total_corrida || 0);
    const totalPagadoValue = parseFloat(totalPagado?.total || 0);
    const totalPendienteValue = totalPlan > 0
      ? Math.max(0, totalPlan - totalPagadoValue)
      : parseFloat(totalPendiente?.total || 0);

    res.json({
      success: true,
      total_pagado: totalPagadoValue,
      total_pendiente: totalPendienteValue,
      total_plan: totalPlan || (totalPagadoValue + totalPendienteValue),
      plazo_corrida: asignacionActiva?.plazo_corrida ? parseInt(asignacionActiva.plazo_corrida) : null,
      total_pagos_realizados: parseInt(totalPagosRealizados?.count || 0),
      renta_diaria: parseFloat(asignacionActiva?.renta_diaria || 400),
      abono_poliza_mantenimiento: getPolizaDiaria(asignacionActiva?.abono_poliza_mantenimiento),
      ultimo_pago_aprobado: ultimoPagoAprobado?.fecha_pago || null,
      saldo_poliza: parseFloat(conductor?.saldo_poliza_mecanica || 0),
      saldo_ahorro: parseFloat(conductor?.saldo_ahorro_mantenimiento || 0)
    });

  } catch (error) {
    console.error('Error en getResumenCuenta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen de cuenta',
      error: error.message
    });
  }
};

// =====================================================
// REGISTRAR PAGO DIARIO
// =====================================================
const registrarPagoDiario = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;
    const { fecha_pago, fecha_inicio, fecha_fin, notas } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'El comprobante de pago es obligatorio'
      });
    }

    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({
        success: false,
        message: 'No tienes vehículo asignado'
      });
    }

    const fechaInicioSolicitada = toDateString(fecha_inicio || fecha_pago || new Date());
    const fechaFinSolicitada = toDateString(fecha_fin || fechaInicioSolicitada);
    const fechaInicioAsignacion = getFechaInicioCobro(asignacion.fecha_inicio);
    const fechaCorte = toDateString(new Date());
    const fechaInicioAsignacionDisplay = formatDisplayDate(fechaInicioAsignacion);
    const fechaCorteDisplay = formatDisplayDate(fechaCorte);

    if (!fechaInicioSolicitada || !fechaFinSolicitada || !fechaInicioAsignacion) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de pago o la fecha de inicio de asignación no es válida'
      });
    }

    if (fechaInicioSolicitada < fechaInicioAsignacion) {
      return res.status(400).json({
        success: false,
        message: `La fecha de inicio no puede ser anterior al inicio de tu asignación (${fechaInicioAsignacionDisplay}).`
      });
    }

    if (fechaFinSolicitada < fechaInicioSolicitada) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de fin no puede ser anterior a la fecha de inicio.'
      });
    }

    if (fechaFinSolicitada > fechaCorte) {
      return res.status(400).json({
        success: false,
        message: `La fecha de fin no puede ser posterior al día de hoy (${fechaCorteDisplay}).`
      });
    }

    const pagosRegistrados = await db('pagos_diarios')
      .where({ asignacion_id: asignacion.id })
      .whereIn('status', ['Confirmado', 'Pendiente'])
      .select('fecha_pago');

    const fechasPagadas = new Set(
      pagosRegistrados
        .map((pago) => toDateString(pago.fecha_pago))
        .filter(Boolean)
    );

    const fechasPendientes = [];
    const totalDiasSeleccionados = [];
    let fechaCursor = fechaInicioSolicitada;

    while (fechaCursor <= fechaFinSolicitada) {
      totalDiasSeleccionados.push(fechaCursor);
      if (!fechasPagadas.has(fechaCursor)) {
        fechasPendientes.push(fechaCursor);
      }
      fechaCursor = addDaysToDate(fechaCursor, 1);
    }

    if (fechasPendientes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Todos los días seleccionados ya cuentan con un pago registrado.'
      });
    }

    console.log('Subiendo comprobante de pago...');
    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: 'image',
      folder: `comprobantes_pago/${conductorId}`,
      transformation: [
        { width: 1200, crop: 'limit', quality: 'auto' }
      ]
    });

    const rentaDiaria = parseFloat(asignacion.renta_diaria || 400);
    const polizaDiaria = getPolizaDiaria(asignacion.abono_poliza_mantenimiento);
    const montoRenta = rentaDiaria * fechasPendientes.length;
    const montoPoliza = polizaDiaria * fechasPendientes.length;
    const montoTotal = montoRenta + montoPoliza;
    const diasOmitidos = totalDiasSeleccionados.length - fechasPendientes.length;
    const observacionesRango = `Rango ${fechaInicioSolicitada} a ${fechaFinSolicitada} (${fechasPendientes.length} día${fechasPendientes.length !== 1 ? 's' : ''}${diasOmitidos > 0 ? `, ${diasOmitidos} omitido${diasOmitidos !== 1 ? 's' : ''}` : ''})`;
    const observaciones = notas ? `${notas} | ${observacionesRango}` : observacionesRango;

    const [nuevoPago] = await db('pagos_diarios')
      .insert({
        asignacion_id: asignacion.id,
        monto_total: montoTotal,
        monto_renta_pagado: montoRenta,
        monto_poliza_pagado: montoPoliza,
        fecha_pago: fechaFinSolicitada,
        metodo_pago: 'Transferencia',
        comprobante_url: result.secure_url,
        observaciones,
        status: 'Pendiente',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Pago registrado correctamente. Pendiente de aprobación.',
      pago: nuevoPago,
      total_dias: fechasPendientes.length,
      total_monto: montoTotal,
      total_monto_renta: montoRenta,
      total_monto_poliza: montoPoliza,
      renta_diaria: rentaDiaria,
      poliza_diaria: polizaDiaria,
      fecha_inicio: fechaInicioSolicitada,
      fecha_fin: fechaFinSolicitada
    });

  } catch (error) {
    console.error('Error en registrarPagoDiario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar pago',
      error: error.message
    });
  }
};

// =====================================================
// REGISTRAR PAGO MÚLTIPLE (PONERSE AL TANTO)
// =====================================================
const registrarPagoMultiple = async (req, res) => {
  const trx = await db.transaction();

  try {
    const conductorId = req.user.conductorId;
    const { notas } = req.body;

    if (!req.file) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'El comprobante de pago es obligatorio'
      });
    }

    const pendientesData = await buildPendientesData(trx, conductorId);

    if (pendientesData.error) {
      await trx.rollback();
      return res.status(pendientesData.error.status).json({
        success: false,
        message: pendientesData.error.message
      });
    }

    const { fechasPendientes } = pendientesData;

    if (fechasPendientes.length === 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'No tienes adeudos pendientes por regularizar.'
      });
    }

    const { asignacion } = pendientesData;
    const rentaDiaria = parseFloat(asignacion.renta_diaria || 400);
    const polizaDiaria = getPolizaDiaria(asignacion.abono_poliza_mantenimiento);
    const montoDiarioTotal = rentaDiaria + polizaDiaria;

    console.log('Subiendo comprobante de pago múltiple...');
    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: 'image',
      folder: `comprobantes_pago/${conductorId}`,
      transformation: [
        { width: 1200, crop: 'limit', quality: 'auto' }
      ]
    });

    const observaciones = notas
      ? `${notas} (Pago múltiple)`
      : 'Pago múltiple para ponerse al tanto';

    const registros = fechasPendientes.map((fecha) => ({
      asignacion_id: asignacion.id,
      monto_total: montoDiarioTotal,
      monto_renta_pagado: rentaDiaria,
      monto_poliza_pagado: polizaDiaria,
      fecha_pago: fecha,
      metodo_pago: 'Transferencia',
      comprobante_url: result.secure_url,
      observaciones,
      status: 'Pendiente',
      created_at: trx.fn.now(),
      updated_at: trx.fn.now()
    }));

    await trx('pagos_diarios').insert(registros);

    await trx.commit();

    res.status(201).json({
      success: true,
      message: `Se registraron ${fechasPendientes.length} pagos pendientes en una sola transacción.`,
      total_dias: fechasPendientes.length,
      total_monto: montoDiarioTotal * fechasPendientes.length,
      total_monto_renta: rentaDiaria * fechasPendientes.length,
      total_monto_poliza: polizaDiaria * fechasPendientes.length,
      renta_diaria: rentaDiaria,
      poliza_diaria: polizaDiaria,
      fechas_registradas: fechasPendientes
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en registrarPagoMultiple:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar pagos pendientes',
      error: error.message
    });
  }
};

// =====================================================
// OBTENER RESUMEN PARA PONERSE AL TANTO
// =====================================================
const getResumenPonerseAlTanto = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;

    const pendientesData = await buildPendientesData(db, conductorId);

    if (pendientesData.error) {
      return res.status(pendientesData.error.status).json({
        success: false,
        message: pendientesData.error.message
      });
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
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen de adeudos',
      error: error.message
    });
  }
};

// =====================================================
// OBTENER SALDO DE PÓLIZA
// =====================================================
const getMiSaldoPoliza = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;

    const conductor = await db('conductores')
      .where({ id: conductorId })
      .select(
        'saldo_poliza_mecanica',
        'saldo_ahorro_mantenimiento',
        'tipo_poliza'
      )
      .first();

    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    res.json({
      success: true,
      saldo_poliza: parseFloat(conductor.saldo_poliza_mecanica || 0),
      saldo_ahorro: parseFloat(conductor.saldo_ahorro_mantenimiento || 0),
      tipo_poliza: conductor.tipo_poliza
    });

  } catch (error) {
    console.error('Error en getMiSaldoPoliza:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener saldo de póliza',
      error: error.message
    });
  }
};

// ⚠️ IMPORTANTE: Exportar TODAS las funciones
module.exports = {
  getMisPagos,
  getResumenCuenta,  // ← Esta debe estar aquí
  registrarPagoDiario,
  registrarPagoMultiple,
  getResumenPonerseAlTanto,
  getMiSaldoPoliza
};
