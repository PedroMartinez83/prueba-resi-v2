// backend/controllers/admin/pagosRentasAdminController.js
const { db } = require('../../config/database');
const auditService = require('../../services/auditService');
const { format, subDays } = require('date-fns');

const toDateString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split('T')[0];
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

const normalizeDateString = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }
  const trimmed = value.toString().trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let year = slashMatch[3];
    if (year.length === 2) {
      year = String(2000 + parseInt(year, 10)).padStart(4, '0');
    }
    const month = slashMatch[2].padStart(2, '0');
    const day = slashMatch[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return trimmed;
};

const parseRangeFromObservaciones = (observaciones = '') => {
  if (!observaciones) return null;

  const patterns = [
    /Rango:\s*(\d{4}-\d{2}-\d{2})\s*>\s*(\d{4}-\d{2}-\d{2})/i,
    /Rango[:\s]+(\d{4}-\d{2}-\d{2})\s*a\s*(\d{4}-\d{2}-\d{2})/i,
    /Pago del\s*(\d{4}-\d{2}-\d{2})\s*al\s*(\d{4}-\d{2}-\d{2})/i,
    /Rango[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*a\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /Pago del\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*al\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /Del\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*al\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
  ];

  for (const pattern of patterns) {
    const match = observaciones.match(pattern);
    if (match) {
      return {
        inicio: normalizeDateString(match[1]),
        fin: normalizeDateString(match[2])
      };
    }
  }

  return null;
};

const calcularFechaInicioDesdeFin = (fechaFin, dias) => {
  if (!fechaFin || !dias || dias <= 1) return fechaFin;
  const cursor = new Date(`${fechaFin}T12:00:00Z`);
  let restantes = dias - 1;

  while (restantes > 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (cursor.getUTCDay() !== 0) {
      restantes -= 1;
    }
  }

  return cursor.toISOString().split('T')[0];
};

// ========== OBTENER TODOS LOS PAGOS DE RENTAS ==========
exports.getPagosRentas = async (req, res) => {
  try {
    const { 
      conductor_id,
      vehiculo_id,
      fecha_desde,
      fecha_hasta,
      metodo_pago,
      status,
      tipo_socio,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (page - 1) * limit;

    // Query base usando la vista
    let queryBuilder = db('vista_pagos_rentas');
    let countQuery = db('pagos_diarios');

    // Aplicar filtros
    if (conductor_id) {
      queryBuilder = queryBuilder.where('conductor_id', conductor_id);
      countQuery = countQuery.whereExists(function() {
        this.select('*')
          .from('asignaciones')
          .whereRaw('asignaciones.id = pagos_diarios.asignacion_id')
          .where('asignaciones.conductor_id', conductor_id);
      });
    }

    if (vehiculo_id) {
      queryBuilder = queryBuilder.where('vehiculo_id', vehiculo_id);
      countQuery = countQuery.whereExists(function() {
        this.select('*')
          .from('asignaciones')
          .whereRaw('asignaciones.id = pagos_diarios.asignacion_id')
          .where('asignaciones.vehiculo_id', vehiculo_id);
      });
    }

    if (fecha_desde) {
      queryBuilder = queryBuilder.where('fecha_pago', '>=', fecha_desde);
      countQuery = countQuery.where('fecha_pago', '>=', fecha_desde);
    }

    if (fecha_hasta) {
      queryBuilder = queryBuilder.where('fecha_pago', '<=', fecha_hasta);
      countQuery = countQuery.where('fecha_pago', '<=', fecha_hasta);
    }

    if (metodo_pago) {
      queryBuilder = queryBuilder.where('metodo_pago', metodo_pago);
      countQuery = countQuery.where('metodo_pago', metodo_pago);
    }

    if (status) {
      queryBuilder = queryBuilder.where('status', status);
      countQuery = countQuery.where('status', status);
    }

    if (tipo_socio) {
      queryBuilder = queryBuilder.where('tipo_socio', tipo_socio);
    }

    // Obtener total para paginación
    const [{ count }] = await countQuery.count('id as count');
    const total = parseInt(count);

    // Obtener pagos
    const pagos = await queryBuilder
      .orderBy('fecha_pago', 'desc')
      .limit(limit)
      .offset(offset);

    // Enriquecer observaciones y rango si la vista no los incluye
    const pagoIds = pagos.map((pago) => pago.id).filter(Boolean);
    if (pagoIds.length > 0) {
      const pagosRaw = await db('pagos_diarios')
        .whereIn('id', pagoIds)
        .select('id', 'observaciones');
      const observacionesMap = new Map(
        pagosRaw.map((row) => [row.id, row.observaciones])
      );

      const pagosDetalle = await db('pagos_diarios as p')
        .leftJoin('asignaciones as a', 'p.asignacion_id', 'a.id')
        .whereIn('p.id', pagoIds)
        .select(
          'p.id',
          'p.fecha_pago',
          'p.monto_total',
          'p.monto_renta_pagado',
          'p.monto_poliza_pagado',
          'a.renta_diaria',
          'a.abono_poliza_mantenimiento'
        );
      const detalleMap = new Map(
        pagosDetalle.map((row) => [row.id, row])
      );

      pagos.forEach((pago) => {
        if (!pago.observaciones) {
          pago.observaciones = observacionesMap.get(pago.id) || pago.observaciones;
        }

        if (!pago.rango_inicio && !pago.rango_fin) {
          const rango = parseRangeFromObservaciones(pago.observaciones || '');
          if (rango) {
            pago.rango_inicio = rango.inicio;
            pago.rango_fin = rango.fin;
          }
        }

        if (!pago.rango_inicio && !pago.rango_fin) {
          const detalle = detalleMap.get(pago.id);
          if (detalle?.fecha_pago) {
            const rentaDiaria = parseFloat(detalle.renta_diaria || 0);
            const polizaDiaria = parseFloat(detalle.abono_poliza_mantenimiento || 0);
            const montoRenta = parseFloat(detalle.monto_renta_pagado || 0);
            const montoPoliza = parseFloat(detalle.monto_poliza_pagado || 0);
            const montoTotal = parseFloat(detalle.monto_total || 0);

            let diasEstimados = 1;
            if (rentaDiaria > 0 && montoRenta > 0) {
              diasEstimados = Math.round(montoRenta / rentaDiaria);
            } else if (polizaDiaria > 0 && montoPoliza > 0) {
              diasEstimados = Math.round(montoPoliza / polizaDiaria);
            } else if (rentaDiaria + polizaDiaria > 0 && montoTotal > 0) {
              diasEstimados = Math.round(montoTotal / (rentaDiaria + polizaDiaria));
            }

            const diasNormalizados = Math.max(1, diasEstimados || 1);
            const fechaFin = normalizeDateString(detalle.fecha_pago);
            const fechaInicio = calcularFechaInicioDesdeFin(fechaFin, diasNormalizados);

            pago.rango_inicio = fechaInicio;
            pago.rango_fin = fechaFin;
          }
        }
      });
    }

    res.json({
      success: true,
      pagos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo pagos de rentas: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Error al obtener pagos de rentas',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== ESTADÍSTICAS DE PAGOS (CON "DOS CUBETAS") ==========
exports.getEstadisticasPagos = async (req, res) => {
  console.log('🔍 Iniciando getEstadisticasPagos...');

  try {
    const { fecha_desde, fecha_hasta } = req.query;

    let baseQuery = db('pagos_diarios');

    if (fecha_desde) {
      baseQuery = baseQuery.where('fecha_pago', '>=', fecha_desde);
    }
    if (fecha_hasta) {
      baseQuery = baseQuery.where('fecha_pago', '<=', fecha_hasta);
    }

    // Estadísticas generales
    const [stats] = await baseQuery.clone()
      .select(
        db.raw('COUNT(*) as total_pagos'),
        db.raw("COUNT(CASE WHEN status = 'Confirmado' THEN 1 END) as confirmados"),
        db.raw("COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pendientes"),
        db.raw("COUNT(CASE WHEN status = 'Rechazado' THEN 1 END) as rechazados"),
        
        // 🎯 CAMBIO CLAVE: Usar monto_renta_pagado (ganancia empresa)
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN monto_renta_pagado ELSE 0 END) as total_cobrado"),
        
        // 🆕 NUEVO: Total ahorrado en póliza (dinero conductor)
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN monto_poliza_pagado ELSE 0 END) as total_ahorrado_poliza"),
        
        db.raw("SUM(CASE WHEN status = 'Pendiente' THEN monto_total ELSE 0 END) as pendiente_validar"),
        db.raw("SUM(CASE WHEN status = 'Pendiente' THEN monto_renta_pagado ELSE 0 END) as pendiente_validar_renta"),
        db.raw("COUNT(DISTINCT asignacion_id) as conductores_activos")
      );

    // Cobrado HOY (solo renta, no póliza; por fecha de registro)
    const hoyResult = await db('pagos_diarios')
      .where('status', 'Confirmado')
      .whereRaw('DATE(created_at) = CURRENT_DATE')
      .sum('monto_renta_pagado as total');
    const cobradoHoy = parseFloat(hoyResult[0]?.total || 0);

    // Cobrado SEMANA (últimos 7 días)
    const semanaResult = await db('pagos_diarios')
      .where('status', 'Confirmado')
      .whereRaw('fecha_pago >= CURRENT_DATE - INTERVAL \'7 days\'')
      .sum('monto_renta_pagado as total');
    const cobradoSemana = parseFloat(semanaResult[0]?.total || 0);

    // Cobrado MES actual
    const mesResult = await db('pagos_diarios')
      .where('status', 'Confirmado')
      .whereRaw('EXTRACT(MONTH FROM fecha_pago) = EXTRACT(MONTH FROM CURRENT_DATE)')
      .whereRaw('EXTRACT(YEAR FROM fecha_pago) = EXTRACT(YEAR FROM CURRENT_DATE)')
      .sum('monto_renta_pagado as total');
    const cobradoMes = parseFloat(mesResult[0]?.total || 0);

    // Fondo de pólizas MES actual
    const polizaMesResult = await db('pagos_diarios')
      .where('status', 'Confirmado')
      .whereRaw('EXTRACT(MONTH FROM fecha_pago) = EXTRACT(MONTH FROM CURRENT_DATE)')
      .whereRaw('EXTRACT(YEAR FROM fecha_pago) = EXTRACT(YEAR FROM CURRENT_DATE)')
      .sum('monto_poliza_pagado as total');
    const polizaMes = parseFloat(polizaMesResult[0]?.total || 0);

    // Conductores con deuda
    const deudaResult = await db.raw(`
      WITH pagos_confirmados AS (
        SELECT
          asignacion_id,
          MAX(fecha_pago) as ultimo_pago
        FROM pagos_diarios
        WHERE status = 'Confirmado'
        GROUP BY asignacion_id
      )
      SELECT COUNT(DISTINCT c.id) as total
      FROM conductores c
      INNER JOIN asignaciones a ON c.id = a.conductor_id
      LEFT JOIN pagos_confirmados p ON a.id = p.asignacion_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as dias_adeudados
        FROM generate_series(
          COALESCE(p.ultimo_pago::date, a.fecha_inicio::date - 1) + 1,
          CURRENT_DATE,
          interval '1 day'
        ) as d(fecha)
        WHERE EXTRACT(DOW FROM d.fecha) <> 0
      ) dias ON true
      WHERE a.activa = true
        AND NOT EXISTS (
          SELECT 1 FROM pagos_diarios pd
          WHERE pd.asignacion_id = a.id
            AND pd.status = 'Confirmado'
            AND pd.fecha_pago >= CURRENT_DATE - INTERVAL '2 days'
        )
    `);
    const conductoresDeuda = parseInt(deudaResult.rows[0]?.total || 0);

    // Proyección mensual
    const diasDelMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const diaActual = new Date().getDate();
    const diasRestantes = diasDelMes - diaActual;
    const promedioDiario = cobradoMes / diaActual;
    const proyeccion = cobradoMes + (promedioDiario * diasRestantes);
    const promedioDiarioPoliza = polizaMes / diaActual;
    const proyeccionPoliza = polizaMes + (promedioDiarioPoliza * diasRestantes);

    // Por método de pago
    const porMetodo = await db('pagos_diarios')
      .where('status', 'Confirmado')
      .select('metodo_pago')
      .sum('monto_renta_pagado as total')
      .count('id as cantidad')
      .groupBy('metodo_pago');

    // Top 10 conductores
    const topConductores = await db('vista_pagos_rentas')
      .where('status', 'Confirmado')
      .select('conductor_id', 'nombre_conductor')
      .sum('monto_renta_pagado as total_pagado')
      .count('id as total_pagos')
      .groupBy('conductor_id', 'nombre_conductor')
      .orderBy('total_pagado', 'desc')
      .limit(10);

    res.json({
      success: true,
      estadisticas: {
        total_pagos: parseInt(stats.total_pagos || 0),
        confirmados: parseInt(stats.confirmados || 0),
        pendientes: parseInt(stats.pendientes || 0),
        rechazados: parseInt(stats.rechazados || 0),
        
        // 💰 GANANCIAS DE LA EMPRESA (solo renta)
        total_cobrado: parseFloat(stats.total_cobrado || 0),
        
        // 🆕 NUEVO: Dinero ahorrado en póliza (conductores)
        total_ahorrado_poliza: parseFloat(stats.total_ahorrado_poliza || 0),
        
        pendientes_validar: parseInt(stats.pendientes || 0),
        pendiente_validar_renta: parseFloat(stats.pendiente_validar_renta || 0),
        conductores_activos: parseInt(stats.conductores_activos || 0),
        
        // Temporales
        cobrado_hoy: cobradoHoy,
        cobrado_semana: cobradoSemana,
        cobrado_mes: cobradoMes,
        conductores_deuda: conductoresDeuda,
        proyeccion_mes: parseFloat(proyeccion),
        proyeccion_poliza_mes: parseFloat(proyeccionPoliza),
        cambio_dia: 0,
        cambio_semana: 0,
        cambio_mes: 0
      },
      por_metodo: porMetodo,
      top_conductores: topConductores
    });

  } catch (error) {
    console.error('❌ ERROR COMPLETO:', error);

    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo estadísticas: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== GRÁFICA DE COBRANZA DIARIA - "DOS CUBETAS" ==========
exports.getGraficaDiaria = async (req, res) => {
  try {
    const { dias = 7 } = req.query;
    const fechaInicio = subDays(new Date(), parseInt(dias) - 1);

    const sql = `
      SELECT 
        DATE(pd.fecha_pago) as fecha,
        SUM(pd.monto_renta_pagado) as cobrado_renta,
        SUM(pd.monto_poliza_pagado) as cobrado_poliza,
        SUM(pd.monto_total) as cobrado_total,
        COUNT(DISTINCT pd.asignacion_id) as pagos_recibidos
      FROM pagos_diarios pd
      WHERE pd.fecha_pago >= ?
        AND pd.status = 'Confirmado'
      GROUP BY DATE(pd.fecha_pago)
      ORDER BY fecha ASC
    `;

    const result = await db.raw(sql, [fechaInicio]);

    const totalConductoresResult = await db('asignaciones')
      .where('activa', true)
      .countDistinct('id as count');
    
    const totalConductores = parseInt(totalConductoresResult[0].count) || 91;
    const montoEsperadoPorDia = 400;
    const esperado = totalConductores * montoEsperadoPorDia;

    const datos = result.rows.map(row => ({
      fecha: format(new Date(row.fecha), 'dd/MMM'),
      cobrado_renta: parseFloat(row.cobrado_renta || 0),
      cobrado_poliza: parseFloat(row.cobrado_poliza || 0),
      cobrado_total: parseFloat(row.cobrado_total || 0),
      esperado: esperado,
      diferencia: parseFloat(row.cobrado_renta || 0) - esperado,
      porcentaje_cobranza: ((parseFloat(row.cobrado_renta || 0) / esperado) * 100).toFixed(1)
    }));

    const totalCobradoRenta = datos.reduce((sum, d) => sum + d.cobrado_renta, 0);
    const totalCobradoPoliza = datos.reduce((sum, d) => sum + d.cobrado_poliza, 0);

    res.json({
      success: true,
      datos,
      resumen: {
        total_cobrado_renta: totalCobradoRenta,
        total_cobrado_poliza: totalCobradoPoliza,
        total_esperado: esperado * datos.length,
        promedio_diario_renta: totalCobradoRenta / datos.length,
        promedio_diario_poliza: totalCobradoPoliza / datos.length,
        dias_analizados: datos.length
      }
    });

  } catch (error) {
    console.error('❌ Error en getGraficaDiaria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener gráfica diaria',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== VALIDAR PAGO EN EFECTIVO (VERSIÓN DEBUG) ==========
exports.validarPago = async (req, res) => {
  console.log(`🔍 Iniciando validación de pago ${req.params.id}...`);
  const trx = await db.transaction();

  try {
    const { id } = req.params;
    const { observaciones } = req.body;
    
    // Verificación de seguridad del usuario
    const usuarioActual = req.user || { id: 0, email: 'sistema@admin.com', nombre: 'Sistema' };
    console.log('👤 Usuario realizando acción:', usuarioActual.email);

    // Intentamos configurar auditoría (si falla, no detenemos el proceso crítico)
    try {
      if (auditService && auditService.setUserContext) {
        await auditService.setUserContext(trx, usuarioActual);
      }
    } catch (auditErr) {
      console.warn('⚠️ Advertencia: No se pudo configurar contexto de auditoría', auditErr.message);
    }

    await auditService.setUserContext(trx, req.user);

    const pago = await trx('pagos_diarios')
      .where('id', id)
      .first();

    if (!pago) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }

    if (pago.status !== 'Pendiente') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden validar pagos pendientes'
      });
    }

    const [pagoActualizado] = await trx('pagos_diarios')
      .where('id', id)
      .update(datosUpdate)
      .returning('*');

    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'validacion_pago_renta',
      descripcion: `Pago validado - Renta: $${pago.monto_renta_pagado}, Póliza: $${pago.monto_poliza_pagado}`,
      datos_sensibles: {
        pago_id: id,
        monto_total: pago.monto_total,
        monto_renta: pago.monto_renta_pagado,
        monto_poliza: pago.monto_poliza_pagado,
        metodo_pago: pago.metodo_pago,
        fecha_pago: pago.fecha_pago
      },
      ip_address: auditService.getClientIp(req)
    });

    await trx.commit();
    console.log('✅ Pago validado exitosamente');

    res.json({
      success: true,
      message: 'Pago validado exitosamente',
      pago: pagoActualizado
    });

  } catch (error) {
    await trx.rollback();

    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error validando pago: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      message: 'Error interno al validar pago',
      error: error.message, 
      details: error.stack // Opcional: ver dónde tronó
    });
  }
};

// ========== RECHAZAR PAGO ==========
exports.rechazarPago = async (req, res) => {
  const trx = await db.transaction();

  try {
    const { id } = req.params;
    const { motivo_rechazo } = req.body;

    if (!motivo_rechazo) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Debe especificar el motivo del rechazo'
      });
    }

    await auditService.setUserContext(trx, req.user);

    const pago = await trx('pagos_diarios')
      .where('id', id)
      .first();

    if (!pago) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }

    await trx('pagos_diarios')
      .where('id', id)
      .update({
        status: 'Rechazado',
        observaciones: `RECHAZADO: ${motivo_rechazo}`,
        registrado_por: req.user.email,
        updated_at: new Date()
      });

    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'rechazo_pago_renta',
      descripcion: `Pago rechazado - Motivo: ${motivo_rechazo}`,
      datos_sensibles: {
        pago_id: id,
        monto: pago.monto_total,
        motivo: motivo_rechazo
      },
      ip_address: auditService.getClientIp(req),
      requiere_revision: true
    });

    await trx.commit();

    res.json({
      success: true,
      message: 'Pago rechazado'
    });

  } catch (error) {
    await trx.rollback();

    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error rechazando pago: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Error al rechazar pago'
    });
  }
};

// ========== REGISTRAR PAGO MANUAL (ADMIN) - CON DESTINO DE AHORRO ==========
exports.registrarPagoManual = async (req, res) => {
  const trx = await db.transaction();

  try {
    const {
      conductor_id,
      conductorId,
      monto_total,
      montoTotal,
      monto_renta,
      monto_extra,
      destino_extra, // 'poliza' o 'mantenimiento'
      metodo_pago,
      metodoPago,
      referencia,
      referencia_pago,
      comprobante_url,
      comprobanteUrl,
      fecha_pago,
      fechaPago,
      observaciones
    } = req.body;

    // ✅ Normalizar nombres
    const conductorIdFinal = conductor_id || conductorId;
    const montoTotalFinal = parseFloat(monto_total || montoTotal || 0);
    const montoRentaFinal = parseFloat(monto_renta || 0);
    const montoExtraFinal = parseFloat(monto_extra || 0);
    const destinoExtra = destino_extra || 'poliza'; // Default a póliza
    const metodoPagoFinal = metodo_pago || metodoPago;
    const comprobanteUrlFinal = comprobante_url || comprobanteUrl;
    const referenciaPagoFinal = referencia_pago || referencia || null;
    let observacionesFinal = observaciones ? String(observaciones) : null;

    if (referenciaPagoFinal) {
      observacionesFinal = observacionesFinal
        ? `${observacionesFinal} | Referencia: ${referenciaPagoFinal}`
        : `Referencia: ${referenciaPagoFinal}`;
    }

    console.log('🔍 === ADMIN REGISTRANDO PAGO MANUAL ===');
    console.log('📥 Datos recibidos:', req.body);
    console.log('✅ Conductor ID:', conductorIdFinal);
    console.log('✅ Monto total:', montoTotalFinal);
    console.log('✅ Monto renta:', montoRentaFinal);
    console.log('✅ Monto extra:', montoExtraFinal);
    console.log('✅ Destino extra:', destinoExtra);

    // Validaciones
    if (!conductorIdFinal || !metodoPagoFinal) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: conductor_id, metodo_pago'
      });
    }
    await auditService.setUserContext(trx, req.user);

    // Obtener conductor
    const conductor = await trx('conductores')
      .where('id', conductorIdFinal)
      .first();

    if (!conductor) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }

    const tipoPoliza = conductor.tipo_poliza || 'POLIZA_100';

    console.log('👤 CONDUCTOR:', conductor.nombre_conductor);
    console.log('📋 Tipo de póliza:', tipoPoliza);
    console.log('🎯 Destino extra:', destinoExtra);

    // Obtener asignación activa
    const asignacion = await trx('asignaciones')
      .where('conductor_id', conductorIdFinal)
      .where('activa', true)
      .first();

    if (!asignacion) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'El conductor no tiene una asignación activa'
      });
    }

    console.log('✅ Asignación encontrada:', asignacion.id);

    const fechaInicioAsignacion = toDateString(asignacion.fecha_inicio);
    const fechaPagoSolicitada = toDateString(fecha_pago || fechaPago || new Date());

    if (!fechaInicioAsignacion || !fechaPagoSolicitada) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'No se pudo determinar la fecha de pago o la fecha de inicio de asignación'
      });
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

    if (fechaPagoSolicitada < fechaInicioAsignacion) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: `La fecha de pago no puede ser anterior al inicio de asignación (${fechaInicioAsignacion}).`
      });
    }

    if (fechasPagadas.has(fechaPagoSolicitada)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: `Ya existe un pago registrado para el día ${fechaPagoSolicitada}.`
      });
    }

    // 🎯 CALCULAR MONTOS CORRECTAMENTE
    let montoParaRenta = 0;
    let montoParaExtra = 0;
    let montoTotalCalculado = 0;

    // Si vienen los montos separados (desde el frontend nuevo)
    if (montoRentaFinal > 0 && montoExtraFinal > 0) {
      montoParaRenta = montoRentaFinal;
      montoParaExtra = montoExtraFinal;
      montoTotalCalculado = montoParaRenta + montoParaExtra;
      
    // Si solo viene el total (compatibilidad con frontend viejo)
    } else if (montoTotalFinal > 0) {
      const montoExtraDefault = tipoPoliza === 'AHORRO_50' ? 50 : 100;
      montoParaExtra = Math.min(montoTotalFinal, montoExtraDefault);
      montoParaRenta = montoTotalFinal - montoParaExtra;
      montoTotalCalculado = montoTotalFinal;
      
    } else {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar monto_total o monto_renta + monto_extra'
      });
    }

    // Validar que el total sea mayor a 0
    if (montoTotalCalculado <= 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El monto total debe ser mayor a 0'
      });
    }

    console.log('🧮 DIVISIÓN DEL PAGO:');
    console.log('   💰 Total pagado:', montoTotalCalculado.toFixed(2));
    console.log('   🚗 → Para renta:', montoParaRenta.toFixed(2));
    console.log('   💵 → Para extra:', montoParaExtra.toFixed(2));
    console.log('   🎯 → Destino:', destinoExtra);

    // Guardar pago en la base de datos
    const [nuevoPago] = await trx('pagos_diarios')
      .insert({
        asignacion_id: asignacion.id,
        monto_total: montoTotalCalculado,
        monto_renta_pagado: montoParaRenta,
        monto_poliza_pagado: montoParaExtra,
        fecha_pago: new Date(`${fechaPagoSolicitada}T00:00:00`),
        metodo_pago: metodoPagoFinal,
        comprobante_url: comprobanteUrlFinal || null,
       observaciones: observacionesFinal,
        status: 'Confirmado',
        registrado_por: `Admin: ${req.user.email}`,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    console.log('✅ Pago guardado con ID:', nuevoPago.id);

    // 🏦 ACTUALIZAR SALDOS DEL CONDUCTOR
    let saldoPolizaPrevio = parseFloat(conductor.saldo_poliza_mecanica || 50000);
    let saldoMantenimientoPrevio = parseFloat(conductor.saldo_ahorro_mantenimiento || 0);
    let totalAportadoPrevio = parseFloat(conductor.total_aportado_poliza || 0);
    
    let nuevoSaldoPoliza = saldoPolizaPrevio;
    let nuevoSaldoMantenimiento = saldoMantenimientoPrevio;
    let nuevoTotalAportado = totalAportadoPrevio;

    if (montoParaExtra > 0) {
      if (destinoExtra === 'poliza') {
        // 🛡️ VA PARA PÓLIZA MECÁNICA
        console.log('🛡️ DESTINO: PÓLIZA MECÁNICA');
        
        // SIEMPRE actualizar el total histórico
        nuevoTotalAportado = totalAportadoPrevio + montoParaExtra;
        
        // Solo si es AHORRO_50, sumar al saldo
        if (tipoPoliza === 'AHORRO_50') {
          nuevoSaldoPoliza = saldoPolizaPrevio + montoParaExtra;
          console.log('   💰 AHORRO_50: SÍ suma al saldo');
          console.log('   Saldo previo:', saldoPolizaPrevio.toFixed(2));
          console.log('   + Abono:', montoParaExtra.toFixed(2));
          console.log('   = Nuevo saldo:', nuevoSaldoPoliza.toFixed(2));
        } else {
          console.log('   🛡️ POLIZA_100: NO suma al saldo (prima de seguro)');
          console.log('   Saldo se mantiene en:', saldoPolizaPrevio.toFixed(2));
        }
        
        console.log('   📊 Total aportado histórico:', nuevoTotalAportado.toFixed(2));

        await trx('conductores')
          .where('id', conductorIdFinal)
          .update({
            saldo_poliza_mecanica: nuevoSaldoPoliza,
            total_aportado_poliza: nuevoTotalAportado,
            updated_at: new Date()
          });

      } else if (destinoExtra === 'mantenimiento') {
        // 🔧 VA PARA AHORRO DE MANTENIMIENTO
        console.log('🔧 DESTINO: AHORRO DE MANTENIMIENTO');
        nuevoSaldoMantenimiento = saldoMantenimientoPrevio + montoParaExtra;
        
        console.log('   💰 Se ACUMULA en ahorro de mantenimiento');
        console.log('   Saldo previo:', saldoMantenimientoPrevio.toFixed(2));
        console.log('   + Abono:', montoParaExtra.toFixed(2));
        console.log('   = Nuevo saldo:', nuevoSaldoMantenimiento.toFixed(2));

        await trx('conductores')
          .where('id', conductorIdFinal)
          .update({
            saldo_ahorro_mantenimiento: nuevoSaldoMantenimiento,
            updated_at: new Date()
          });
      }
    }

    // 📝 Auditoría crítica
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'registro_pago_manual_admin',
      descripcion: `Pago manual [${destinoExtra.toUpperCase()}] - Renta: $${montoParaRenta.toFixed(2)}, Extra: $${montoParaExtra.toFixed(2)}`,
      datos_sensibles: {
        pago_id: nuevoPago.id,
        conductor_id: conductorIdFinal,
        asignacion_id: asignacion.id,
        tipo_poliza: tipoPoliza,
        destino_extra: destinoExtra,
        monto_total: montoTotalCalculado,
        monto_renta: montoParaRenta,
        monto_extra: montoParaExtra,
        metodo_pago: metodoPagoFinal,
        referencia_pago: referenciaPagoFinal,
        saldo_poliza_anterior: saldoPolizaPrevio,
        saldo_poliza_nuevo: nuevoSaldoPoliza,
        saldo_mantenimiento_anterior: saldoMantenimientoPrevio,
        saldo_mantenimiento_nuevo: nuevoSaldoMantenimiento,
        total_aportado_anterior: totalAportadoPrevio,
        total_aportado_nuevo: nuevoTotalAportado
      },
      ip_address: auditService.getClientIp(req)
    });

    await trx.commit();

    console.log('✅ TRANSACCIÓN COMPLETADA EXITOSAMENTE');

    res.status(201).json({
      success: true,
      message: 'Pago registrado exitosamente',
      pago: nuevoPago,
      tipo_poliza: tipoPoliza,
      destino_extra: destinoExtra,
      division: {
        total: montoTotal,
        para_renta: montoParaRenta,
        para_extra: montoParaExtra,
        porcentaje_renta: ((montoParaRenta / montoTotal) * 100).toFixed(1) + '%',
        porcentaje_extra: ((montoParaExtra / montoTotal) * 100).toFixed(1) + '%'
      },
      saldos_actualizados: {
        poliza: {
          anterior: saldoPolizaPrevio,
          nuevo: nuevoSaldoPoliza,
          cambio: nuevoSaldoPoliza - saldoPolizaPrevio
        },
        mantenimiento: {
          anterior: saldoMantenimientoPrevio,
          nuevo: nuevoSaldoMantenimiento,
          cambio: nuevoSaldoMantenimiento - saldoMantenimientoPrevio
        },
        total_aportado_poliza: nuevoTotalAportado
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ ERROR REGISTRANDO PAGO MANUAL:', error.message);
    console.error('📍 Stack:', error.stack);

    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error registrando pago manual: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Error al registrar pago',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== OBTENER SALDO PÓLIZA DE UN CONDUCTOR ==========
exports.getSaldoPolizaConductor = async (req, res) => {
  try {
    const { conductorId } = req.params;

    const conductor = await db('conductores')
      .where('id', conductorId)
      .select(
        'id',
        'nombre_conductor',
        'saldo_poliza_mecanica',
        'saldo_ahorro_mantenimiento',
        'tipo_poliza',
        'total_aportado_poliza'
      )
      .first();

    if (!conductor) {
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }

    const tipoPoliza = conductor.tipo_poliza || 'POLIZA_100';
    const saldoPoliza = parseFloat(conductor.saldo_poliza_mecanica || 50000);
    const saldoMantenimiento = parseFloat(conductor.saldo_ahorro_mantenimiento || 0);
    const totalAportado = parseFloat(conductor.total_aportado_poliza || 0);

    res.json({
      success: true,
      conductor: {
        id: conductor.id,
        nombre: conductor.nombre_conductor,
        tipo_poliza: tipoPoliza,
        poliza_mecanica: {
          saldo: saldoPoliza,
          limite_maximo: 50000,
          porcentaje_disponible: ((saldoPoliza / 50000) * 100).toFixed(1) + '%',
          total_aportado_historico: totalAportado,
          puede_usar: saldoPoliza > 0
        },
        ahorro_mantenimiento: {
          saldo: saldoMantenimiento,
          puede_usar: saldoMantenimiento > 0
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo saldos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener saldos del conductor'
    });
  }
};

// ========== OBTENER SIGUIENTE PAGO PENDIENTE (ADMIN) ==========
exports.getSiguientePagoPendiente = async (req, res) => {
  try {
    const { conductorId } = req.params;

    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({
        success: false,
        error: 'El conductor no tiene una asignación activa'
      });
    }

    const fechaInicioAsignacion = toDateString(asignacion.fecha_inicio);
    const fechaActual = toDateString(new Date());

    if (!fechaInicioAsignacion || !fechaActual) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo determinar la fecha de inicio o la fecha actual'
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

    const siguienteFechaPendiente = getNextExpectedDate(
      fechaInicioAsignacion,
      fechasPagadas
    );

    const hayPendiente = siguienteFechaPendiente <= fechaActual;

    res.json({
      success: true,
      siguiente_fecha_pendiente: siguienteFechaPendiente,
      fecha_actual: fechaActual,
      hay_pendiente: hayPendiente
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo siguiente pago pendiente: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Error al obtener siguiente pago pendiente'
    });
  }
};

// ========== 🆕 OBTENER OPCIONES PARA CREAR PAGO (CORREGIDO) ==========
exports.getOpcionesPagos = async (req, res) => {
  try {
    console.log('🔍 Obteniendo opciones para crear pago...');
    
    // Estados posibles
    const estados = ['Pendiente', 'Confirmado', 'Rechazado'];
    
    // Métodos de pago
    const metodos_pago = ['Efectivo', 'Transferencia', 'Tarjeta', 'Stripe'];
    
    // Traer TODOS los conductores con su vehículo asignado (si tienen)
    const conductores = await db('conductores')
      .select(
        'conductores.id',
        'conductores.nombre_conductor as nombre',
        'conductores.status',
        'conductores.numero_telefono',
        'conductores.tipo_poliza',
        'asignaciones.vehiculo_id',
        'vehiculos.numero_vehiculo',
        'asignaciones.activa as tiene_asignacion'
      )
      .leftJoin('asignaciones', function() {
        this.on('conductores.id', '=', 'asignaciones.conductor_id')
            .andOn('asignaciones.activa', '=', db.raw('true'));
      })
      .leftJoin('vehiculos', 'asignaciones.vehiculo_id', 'vehiculos.id')
      .whereNotIn('conductores.status', ['Prohibido'])
      .orderBy('conductores.nombre_conductor');
    
    console.log(`✅ Conductores encontrados: ${conductores.length}`);
    
    // Vehículos operativos
    const vehiculos = await db('vehiculos')
      .select('id', 'numero_vehiculo as numero', 'tipo_socio', 'estado')
      .whereIn('estado', ['Disponible', 'Rentado', 'Asignado'])
      .orderBy('numero_vehiculo');
    
    console.log(`✅ Vehículos encontrados: ${vehiculos.length}`);
    
    res.json({
      success: true,
      opciones: {
        estados,
        metodos_pago,
        conductores,
        vehiculos
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo opciones:', error);
    console.error('📍 Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener opciones',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== TENDENCIA MENSUAL ==========
exports.getTendenciaMensual = async (req, res) => {
  try {
    const { meses = 6 } = req.query;
    
    const sql = `
      SELECT 
        TO_CHAR(fecha_pago, 'YYYY-MM') as mes,
        SUM(monto_renta_pagado) as total_cobrado,
        COUNT(*) as total_pagos,
        COUNT(DISTINCT asignacion_id) as conductores_activos
      FROM pagos_diarios
      WHERE status = 'Confirmado'
        AND fecha_pago >= CURRENT_DATE - INTERVAL '${parseInt(meses)} months'
      GROUP BY TO_CHAR(fecha_pago, 'YYYY-MM')
      ORDER BY mes ASC
    `;
    
    const result = await db.raw(sql);
    
    res.json({
      success: true,
      datos: result.rows.map(row => ({
        mes: row.mes,
        total_cobrado: parseFloat(row.total_cobrado || 0),
        total_pagos: parseInt(row.total_pagos || 0),
        conductores_activos: parseInt(row.conductores_activos || 0),
        promedio_diario: parseFloat(row.total_cobrado || 0) / 30
      }))
    });
    
  } catch (error) {
    console.error('Error en getTendenciaMensual:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tendencia mensual'
    });
  }
};

// ========== DISTRIBUCIÓN POR TIPO DE SOCIO ==========
exports.getDistribucionTipoSocio = async (req, res) => {
  try {
    const sql = `
      SELECT 
        v.tipo_socio,
        COUNT(pd.id) as total_pagos,
        SUM(pd.monto_renta_pagado) as total_cobrado,
        AVG(pd.monto_renta_pagado) as promedio_pago
      FROM pagos_diarios pd
      INNER JOIN asignaciones a ON pd.asignacion_id = a.id
      INNER JOIN vehiculos v ON a.vehiculo_id = v.id
      WHERE pd.status = 'Confirmado'
      GROUP BY v.tipo_socio
      ORDER BY total_cobrado DESC
    `;
    
    const result = await db.raw(sql);
    
    res.json({
      success: true,
      distribucion: result.rows.map(row => ({
        tipo_socio: row.tipo_socio,
        total_pagos: parseInt(row.total_pagos || 0),
        total_cobrado: parseFloat(row.total_cobrado || 0),
        promedio_pago: parseFloat(row.promedio_pago || 0)
      }))
    });
    
  } catch (error) {
    console.error('Error en getDistribucionTipoSocio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener distribución por tipo de socio'
    });
  }
};

// ========== TOP CONDUCTORES ==========
exports.getTopConductores = async (req, res) => {
  try {
    const { limite = 10 } = req.query;
    
    const sql = `
      WITH pagos_confirmados AS (
        SELECT
          asignacion_id,
          MAX(fecha_pago) as ultimo_pago,
          COALESCE(SUM(monto_total), 0) as total_pagado_confirmado
        FROM pagos_diarios
        WHERE status = 'Confirmado'
        GROUP BY asignacion_id
      )
      SELECT 
        c.id,
        c.nombre_conductor,
        a.id as asignacion_id,
        a.renta_diaria,
        a.fecha_inicio,
        COUNT(pd.id) as total_pagos,
        SUM(pd.monto_total) as total_pagado,
        SUM(pd.monto_renta_pagado) as total_renta,
        SUM(pd.monto_poliza_pagado) as total_poliza,
        AVG(pd.monto_total) as promedio_pago,
        COALESCE(dias.dias_adeudados, 0) as dias_transcurridos,
        COALESCE(p.total_pagado_confirmado, 0) + COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) as total_debido,
        COALESCE(p.total_pagado_confirmado, 0) as total_pagado_confirmado,
        COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) as deuda_aproximada
      FROM conductores c
      INNER JOIN asignaciones a ON c.id = a.conductor_id
      INNER JOIN pagos_diarios pd ON a.id = pd.asignacion_id
      LEFT JOIN pagos_confirmados p ON a.id = p.asignacion_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as dias_adeudados
        FROM generate_series(
          COALESCE(p.ultimo_pago::date, a.fecha_inicio::date - 1) + 1,
          CURRENT_DATE,
          interval '1 day'
        ) as d(fecha)
        WHERE EXTRACT(DOW FROM d.fecha) <> 0
      ) dias ON true
      WHERE pd.status = 'Confirmado'
        AND pd.fecha_pago >= CURRENT_DATE - INTERVAL '30 days'
        AND a.activa = true
        AND COALESCE(dias.dias_adeudados, 0) = 0
      GROUP BY c.id, c.nombre_conductor, a.id, a.renta_diaria, a.fecha_inicio, a.abono_poliza_mantenimiento, p.total_pagado_confirmado, dias.dias_adeudados
      ORDER BY total_pagado DESC
      LIMIT ${parseInt(limite)}
    `;

    const result = await db.raw(sql);
    
    res.json({
      success: true,
      top_conductores: result.rows.map(row => ({
        id: row.id,
        nombre: row.nombre_conductor,
        total_pagos: parseInt(row.total_pagos || 0),
        total_pagado: parseFloat(row.total_pagado || 0),
        total_renta: parseFloat(row.total_renta || 0),
        total_poliza: parseFloat(row.total_poliza || 0),
        promedio_pago: parseFloat(row.promedio_pago || 0),
        dias_transcurridos: parseInt(row.dias_transcurridos || 0),
        total_debido: parseFloat(row.total_debido || 0),
        total_pagado_confirmado: parseFloat(row.total_pagado_confirmado || 0),
        deuda_aproximada: parseFloat(row.deuda_aproximada || 0)
      })),
      nota: 'Muestra solo conductores al corriente (sin deuda, domingos excluidos) en los últimos 30 días'
    });
    
  } catch (error) {
    console.error('❌ Error en getTopConductores:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener top conductores',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== CONDUCTORES MOROSOS ==========
exports.getConductoresMorosos = async (req, res) => {
  console.log('🔍 Iniciando getConductoresMorosos...');
  
  try {
    const { dias_sin_pago = 2 } = req.query;
    const diasSinPago = parseInt(dias_sin_pago);
    
    console.log('📅 Días sin pago:', diasSinPago);
    
    const sql = `
      WITH pagos_confirmados AS (
        SELECT
          asignacion_id,
          MAX(fecha_pago) as ultimo_pago,
          COALESCE(SUM(monto_total), 0) as total_pagado
        FROM pagos_diarios
        WHERE status = 'Confirmado'
        GROUP BY asignacion_id
      )
      SELECT 
        c.id,
        c.nombre_conductor,
        c.numero_telefono,
        v.numero_vehiculo,
        v.tipo_socio,
        MAX(pd.fecha_pago) as ultimo_pago,
        CURRENT_DATE - MAX(pd.fecha_pago)::date as dias_sin_pagar,
        (CURRENT_DATE - MAX(pd.fecha_pago)::date) * a.renta_diaria as deuda_estimada
      FROM conductores c
      INNER JOIN asignaciones a ON c.id = a.conductor_id
      INNER JOIN vehiculos v ON a.vehiculo_id = v.id
      LEFT JOIN pagos_diarios pd ON a.id = pd.asignacion_id AND pd.status = 'Confirmado'
      WHERE a.activa = true
      GROUP BY c.id, c.nombre_conductor, c.numero_telefono, v.numero_vehiculo, v.tipo_socio, a.renta_diaria
      HAVING MAX(pd.fecha_pago) IS NULL 
         OR (CURRENT_DATE - MAX(pd.fecha_pago)::date) >= ${diasSinPago}
      ORDER BY dias_sin_pagar DESC NULLS FIRST
    `;
    
    console.log('📊 Ejecutando SQL...');
    const result = await db.raw(sql);
    console.log('✅ Resultados obtenidos:', result.rows.length);
    
    res.json({
      success: true,
      conductores_morosos: result.rows.map(row => ({
        id: row.id,
        nombre: row.nombre_conductor,
        telefono: row.numero_telefono,
        vehiculo: row.numero_vehiculo,
        tipo_socio: row.tipo_socio,
        ultimo_pago: row.ultimo_pago,
        dias_sin_pagar: parseInt(row.dias_sin_pagar || 0),
        deuda_estimada: parseFloat(row.deuda_estimada || 0)
      })),
      total_morosos: result.rows.length
    });
    
  } catch (error) {
    console.error('❌ Error COMPLETO en getConductoresMorosos:', error.message);
    console.error('📍 Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener conductores morosos',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== HISTORIAL DE PAGOS DE UN CONDUCTOR ==========
exports.getHistorialConductor = async (req, res) => {
  try {
    const { conductorId } = req.params;
    const { limite = 50 } = req.query;
    
    const conductor = await db('conductores')
      .where('id', conductorId)
      .select('id', 'nombre_conductor', 'saldo_poliza_mecanica', 'saldo_ahorro_mantenimiento', 'tipo_poliza', 'total_aportado_poliza')
      .first();
    
    if (!conductor) {
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }
    
    const historial = await db('vista_pagos_rentas')
      .where('conductor_id', conductorId)
      .orderBy('fecha_pago', 'desc')
      .limit(parseInt(limite));
    
    const [resumen] = await db('pagos_diarios')
      .whereExists(function() {
        this.select('*')
          .from('asignaciones')
          .whereRaw('asignaciones.id = pagos_diarios.asignacion_id')
          .where('asignaciones.conductor_id', conductorId);
      })
      .select(
        db.raw('COUNT(*) as total_pagos'),
        db.raw("COUNT(CASE WHEN status = 'Confirmado' THEN 1 END) as pagos_confirmados"),
        db.raw("COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pagos_pendientes"),
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN monto_total ELSE 0 END) as total_pagado"),
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN monto_renta_pagado ELSE 0 END) as total_renta_pagada"),
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN monto_poliza_pagado ELSE 0 END) as total_poliza_acumulada")
      );
    
    res.json({
      success: true,
      conductor: {
        id: conductor.id,
        nombre: conductor.nombre_conductor,
        tipo_poliza: conductor.tipo_poliza || 'POLIZA_100',
        saldo_poliza_actual: parseFloat(conductor.saldo_poliza_mecanica || 50000),
        saldo_ahorro_mantenimiento: parseFloat(conductor.saldo_ahorro_mantenimiento || 0),
        total_aportado_historico: parseFloat(conductor.total_aportado_poliza || 0)
      },
      historial,
      resumen: {
        total_pagos: parseInt(resumen.total_pagos || 0),
        pagos_confirmados: parseInt(resumen.pagos_confirmados || 0),
        pagos_pendientes: parseInt(resumen.pagos_pendientes || 0),
        total_pagado: parseFloat(resumen.total_pagado || 0),
        total_renta_pagada: parseFloat(resumen.total_renta_pagada || 0),
        total_poliza_acumulada: parseFloat(resumen.total_poliza_acumulada || 0)
      }
    });
    
  } catch (error) {
    console.error('Error en getHistorialConductor:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial del conductor'
    });
  }
};

// ========== EDITAR PAGO DE RENTA ==========
exports.editarPago = async (req, res) => {
  const trx = await db.transaction();

  try {
    const { id } = req.params;
    const { 
      monto_renta_pagado, 
      monto_poliza_pagado,
      metodo_pago, 
      observaciones,
      fecha_pago 
    } = req.body;

    await auditService.setUserContext(trx, req.user);

    const pago = await trx('pagos_diarios')
      .where('id', id)
      .first();

    if (!pago) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }

    if (pago.status !== 'Pendiente') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden editar pagos en estado Pendiente'
      });
    }

    const monto_total = parseFloat(monto_renta_pagado || 0) + parseFloat(monto_poliza_pagado || 0);

    const [pagoActualizado] = await trx('pagos_diarios')
      .where('id', id)
      .update({
        monto_renta_pagado: monto_renta_pagado !== undefined ? monto_renta_pagado : pago.monto_renta_pagado,
        monto_poliza_pagado: monto_poliza_pagado !== undefined ? monto_poliza_pagado : pago.monto_poliza_pagado,
        monto_total: monto_total || pago.monto_total,
        metodo_pago: metodo_pago || pago.metodo_pago,
        fecha_pago: fecha_pago || pago.fecha_pago,
        observaciones: observaciones !== undefined ? observaciones : pago.observaciones,
        updated_at: new Date()
      })
      .returning('*');

    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'edicion_pago_renta',
      descripcion: `Pago editado - Renta: $${pagoActualizado.monto_renta_pagado}, Póliza: $${pagoActualizado.monto_poliza_pagado}`,
      datos_sensibles: {
        pago_id: id,
        monto_anterior_renta: pago.monto_renta_pagado,
        monto_anterior_poliza: pago.monto_poliza_pagado,
        monto_nuevo_renta: pagoActualizado.monto_renta_pagado,
        monto_nuevo_poliza: pagoActualizado.monto_poliza_pagado,
        monto_total: pagoActualizado.monto_total
      },
      ip_address: auditService.getClientIp(req)
    });

    await trx.commit();

    res.json({
      success: true,
      message: 'Pago editado exitosamente',
      pago: pagoActualizado
    });

  } catch (error) {
    await trx.rollback();

    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error editando pago: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Error al editar pago'
    });
  }
};

// ========== ELIMINAR PAGO DE RENTA ==========
exports.eliminarPago = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    console.log(`🗑️ Eliminando pago ID: ${id}. Motivo: ${motivo || 'No especificado'}`);

    await db.transaction(async (trx) => {
      // 1. Buscamos el pago (igual que antes)
      const pago = await trx('pagos_diarios as p')
        .leftJoin('asignaciones as a', 'p.asignacion_id', 'a.id')
        .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
        .where('p.id', id)
        .select('p.*', 'v.id as vehiculo_id', 'v.total_pagado_corrida', 'v.total_corrida')
        .first();

      if (!pago) throw new Error('El pago no existe');

      // 🟢 NUEVA REGLA DE CONTINUIDAD
      // Si el pago es "Confirmado", validamos que sea EL ÚLTIMO de la fila
      if (pago.status === 'Confirmado') {
        
        // Buscamos cuál es el pago confirmado más reciente de esta asignación
        const ultimoConfirmado = await trx('pagos_diarios')
          .where('asignacion_id', pago.asignacion_id)
          .where('status', 'Confirmado')
          .orderBy('id', 'desc') // Ordenamos por ID (el último insertado)
          .first();

        // Si existe un pago posterior, bloqueamos la acción
        if (ultimoConfirmado && ultimoConfirmado.id !== pago.id) {
          throw new Error(
            `⛔ Solo puedes eliminar el último pago confirmado de este conductor (ID: ${ultimoConfirmado.id}).`
          );
        }

        console.log('✅ Es el último pago. Procediendo a revertir saldo...');

        // ... (Aquí sigue tu lógica de reversión de saldo que ya teníamos) ...
        const nuevoTotalPagado = Math.max(0, parseFloat(pago.total_pagado_corrida || 0) - parseFloat(pago.monto_total || 0));
        const nuevoSaldoPendiente = Math.max(0, parseFloat(pago.total_corrida || 0) - nuevoTotalPagado);
        let nuevoPorcentaje = 0;
        if (pago.total_corrida > 0) nuevoPorcentaje = (nuevoTotalPagado / parseFloat(pago.total_corrida)) * 100;

        await trx('vehiculos')
          .where('id', pago.vehiculo_id)
          .update({
            total_pagado_corrida: nuevoTotalPagado,
            saldo_pendiente_corrida: nuevoSaldoPendiente,
            porcentaje_pagado: nuevoPorcentaje,
            updated_at: new Date()
          });
      }


      const textoEliminacion = motivo ? `[Pago Eliminado: ${motivo}]` : '[Pago Eliminado sin motivo especificado]';

      // Concatenar observaciones antiguas con el motivo de eliminación
      const nuevasObservaciones = [pago.observaciones, textoEliminacion]
        .filter(Boolean)
        .join('. ');

      // 3. Borrado Lógico (Siempre permitido para Rechazados o el último Confirmado)
      await trx('pagos_diarios')
        .where('id', id)
        .update({
          status: 'Eliminado',
          updated_at: new Date(),
          observaciones: `${nuevasObservaciones} - Eliminado por admin el ${new Date().toLocaleDateString()}`
        });
    });


    res.json({ success: true, message: 'Registro eliminado y justificado correctamente.' });

  } catch (error) {
    console.error('❌ Error en eliminarPago:', error);
    // Usamos status 400 para errores de lógica de negocio (validaciones)
    res.status(400).json({ 
      success: false, 
      message: error.message // Enviamos el mensaje claro al frontend
    });
  }
};

// ========== VERIFICAR PAGOS PENDIENTES ANTES DE CREAR NUEVO ==========
exports.verificarPagosPendientes = async (req, res) => {
  const { conductorId } = req.params;

  try {
    // Buscamos si existe ALGÚN pago con estatus 'Pendiente' para este conductor
    const pagoPendiente = await db('pagos_diarios')
      .join('asignaciones', 'pagos_diarios.asignacion_id', 'asignaciones.id')
      .where('asignaciones.conductor_id', conductorId)
      .where('pagos_diarios.status', 'Pendiente')
      .select('pagos_diarios.id', 'pagos_diarios.fecha_pago', 'pagos_diarios.monto_total')
      .first();

    if (pagoPendiente) {
      return res.json({ 
        existe: true, 
        mensaje: `⚠️ ATENCIÓN: Este conductor ya tiene un pago PENDIENTE de autorización por $${pagoPendiente.monto_total} (Fecha: ${new Date(pagoPendiente.fecha_pago).toLocaleDateString()}). \n\n¿Seguro que quieres crear otro manual?`,
        pago: pagoPendiente
      });
    }

    return res.json({ existe: false });

  } catch (error) {
    console.error('Error verificando pendientes:', error);
    res.status(500).json({ error: 'Error al verificar pagos pendientes' });
  }
};

module.exports = exports;
