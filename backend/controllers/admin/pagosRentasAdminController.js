// backend/controllers/admin/pagosRentasAdminController.js
const { db } = require('../../config/database');
const auditService = require('../../services/auditService');
const { format, subDays } = require('date-fns');


// Función auxiliar simple para evitar errores de fecha
const toDateString = (dateVal) => {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  return d.toISOString().split('T')[0];
};
const addDaysToDate = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};
const calcularDiasHabiles = (inicio, fin) => {
  if (!inicio || !fin) return 1;
  const dInicio = new Date(`${inicio}T12:00:00`);
  const dFin = new Date(`${fin}T12:00:00`);
  if (dFin < dInicio) return 0;

  let dias = 0;
  let cursor = new Date(dInicio);
  while (cursor <= dFin) {
    if (cursor.getDay() !== 0) dias++; // No contar domingos
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
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

    // Conductores con deuda PENDIENTE (ultimo pago confirmado)
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
        AND COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) > 0
    `);
    const conductoresDeuda = parseInt(deudaResult.rows[0]?.total || 0);

    // Proyección mensual: NumConductores × MontoRenta × DíasDelMessinDomingos
    
    // 1. Obtener número de conductores activos
    const conductoresActivosResult = await db('asignaciones')
      .where('activa', true)
      .countDistinct('conductor_id as total');
    const numConductores = parseInt(conductoresActivosResult[0]?.total || 0);

    // 2. Obtener monto de renta promedio
    let montoRenta = 0;
    if (numConductores > 0) {
      const rentaResult = await db('asignaciones')
        .where('activa', true)
        .avg('renta_diaria as promedio');
      montoRenta = parseFloat(rentaResult[0]?.promedio || 0);
    }

    // 3. Calcular días del mes descontando domingos
    const fecha = new Date();
    const ano = fecha.getFullYear();
    const mes = fecha.getMonth();
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    
    let domingos = 0;
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const d = new Date(ano, mes, dia);
      if (d.getDay() === 0) {
        domingos++;
      }
    }
    const diasHabiles = ultimoDia - domingos;

    // 4. Calcular proyección: NumConductores × MontoRenta × DíasHábiles
    const proyeccion = numConductores * montoRenta * diasHabiles;
    
    // Mantener proyección de póliza con método anterior
    const diaActual = new Date().getDate();
    const promedioDiarioPoliza = polizaMes / diaActual || 0;
    const diasRestantes = ultimoDia - diaActual;
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

    // 1. Obtener el pago
    const pago = await trx('pagos_diarios').where('id', id).first();

    if (!pago) {
      throw new Error('Pago no encontrado en la base de datos');
    }

    if (pago.status !== 'Pendiente') {
      throw new Error(`El pago no está pendiente (Estado actual: ${pago.status})`);
    }

    // 2. Obtener Asignación y Vehículo
    const asignacion = await trx('asignaciones').where('id', pago.asignacion_id).first();
    if (!asignacion) throw new Error('Asignación no encontrada');

    const vehiculo = await trx('vehiculos').where('id', asignacion.vehiculo_id).first();
    if (!vehiculo) throw new Error('Vehículo no encontrado');

    // 3. Cálculos financieros (Protegidos contra nulos)
    const montoAbonar = parseFloat(pago.monto_total || 0);
    const totalCorrida = parseFloat(vehiculo.total_corrida || 0);
    const pagadoActual = parseFloat(vehiculo.total_pagado_corrida || 0);

    const nuevoPagado = pagadoActual + montoAbonar;
    const nuevoSaldoPendiente = Math.max(0, totalCorrida - nuevoPagado);
    
    let nuevoPorcentaje = 0;
    if (totalCorrida > 0) {
      nuevoPorcentaje = (nuevoPagado / totalCorrida) * 100;
    }

    console.log(`💰 Actualizando finanzas: ${vehiculo.numero_vehiculo} | Abono: ${montoAbonar} | Nuevo %: ${nuevoPorcentaje.toFixed(2)}`);

    // 4. ACTUALIZAR VEHÍCULO
    await trx('vehiculos')
      .where('id', vehiculo.id)
      .update({
        total_pagado_corrida: nuevoPagado,
        saldo_pendiente_corrida: nuevoSaldoPendiente,
        porcentaje_pagado: nuevoPorcentaje, // PostgreSQL maneja float a numeric
        updated_at: new Date()
      });

    // 5. CONFIRMAR EL PAGO
    // ⚠️ NOTA: Si 'registrado_por' no existe en tu tabla, esto dará error.
    // Usamos un objeto dinámico para prevenirlo si es necesario, pero aquí asumimos que existe.
    const datosUpdate = {
      status: 'Confirmado',
      observaciones: observaciones || pago.observaciones,
      updated_at: new Date()
    };
    
    // Solo intentamos guardar el email si tenemos el dato
    if (usuarioActual.email) {
      datosUpdate.registrado_por = usuarioActual.email;
    }

    const [pagoActualizado] = await trx('pagos_diarios')
      .where('id', id)
      .update(datosUpdate)
      .returning('*');

    // 6. Auditoría final
    try {
      await auditService.logCriticalChange({
        usuario_id: usuarioActual.id,
        tipo_cambio: 'validacion_pago_renta',
        descripcion: `Pago validado ($${montoAbonar}) - Avance auto: ${nuevoPorcentaje.toFixed(2)}%`,
        datos_sensibles: {
          pago_id: id,
          vehiculo_id: vehiculo.id,
          monto_abonado: montoAbonar
        },
        ip_address: req.ip || '0.0.0.0'
      });
    } catch (logErr) {
      console.warn('⚠️ Error guardando log de auditoría (no crítico):', logErr.message);
    }

    await trx.commit();
    console.log('✅ Pago validado exitosamente');

    res.json({
      success: true,
      message: 'Pago validado correctamente.',
      pago: pagoActualizado,
      avance_vehiculo: {
        total_pagado: nuevoPagado,
        pendiente: nuevoSaldoPendiente,
        porcentaje: nuevoPorcentaje.toFixed(2) + '%'
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ ERROR FATAL EN VALIDAR PAGO:', error); // <--- Mira esto en tu terminal negra
    
    // Respondemos con el error real para que lo veas en el frontend (solo para debug)
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
  const { conductor_id, monto_renta, monto_extra, fecha_pago, fecha_fin, metodo_pago, observaciones, referencia } = req.body;

  try {
    await db.transaction(async (trx) => {
      // 1. Buscamos la asignación (Indispensable para obtener el asignacion_id)
      const asignacion = await trx('asignaciones').where({ conductor_id, activa: true }).first();
      if (!asignacion) throw new Error('Conductor sin asignación activa');

      const vehiculo = await trx('vehiculos').where('id', asignacion.vehiculo_id).first().forUpdate();

      // 2. Cálculos según el rango de fechas
      const numDias = calcularDiasHabiles(fecha_pago, fecha_fin);
      const abonoRentaTotal = parseFloat(monto_renta || 0) * numDias;
      const abonoExtraTotal = parseFloat(monto_extra || 0) * numDias;
      const montoTotalAbono = abonoRentaTotal + abonoExtraTotal;

      // 3. INSERTAR EN PAGOS_DIARIOS (Con tus nombres de columna reales)
      await trx('pagos_diarios').insert({
        asignacion_id: asignacion.id,        
        fecha_pago: fecha_fin,               
        monto_renta_pagado: abonoRentaTotal, 
        monto_poliza_pagado: abonoExtraTotal, 
        monto_total: montoTotalAbono,        
        metodo_pago: metodo_pago,            
        referencia: referencia,              
        status: 'Confirmado',                
        observaciones: observaciones,        
        created_at: new Date(),
        updated_at: new Date()
      });

      // 4. ACTUALIZAR CORRIDA DEL VEHÍCULO
      const totalCorrida = parseFloat(vehiculo.total_corrida || 0);
      const pagadoAnterior = parseFloat(vehiculo.total_pagado_corrida || 0);
      
      const nuevoTotalPagado = pagadoAnterior + montoTotalAbono;
      const nuevoSaldoPendiente = Math.max(0, totalCorrida - nuevoTotalPagado);
      const nuevoPorcentaje = totalCorrida > 0 ? (nuevoTotalPagado / totalCorrida) * 100 : 0;

      await trx('vehiculos').where('id', vehiculo.id).update({
        total_pagado_corrida: nuevoTotalPagado.toFixed(2),
        saldo_pendiente_corrida: nuevoSaldoPendiente.toFixed(2),
        porcentaje_pagado: nuevoPorcentaje.toFixed(2),
        updated_at: new Date()
      });
    });

    res.json({ success: true, message: 'Pago registrado y unidad actualizada' });
  } catch (error) {
    console.error('❌ Error DB:', error.message);
    res.status(500).json({ success: false, error: error.message });
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

    // 1. Obtener la asignación activa
    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({ success: false, message: 'El conductor no tiene asignación activa' });
    }

    // 2. BUSCAR EL ÚLTIMO PAGO CONFIRMADO (Ordenado por fecha DESC)
    const ultimoPagoReal = await db('pagos_diarios')
      .where({ asignacion_id: asignacion.id })
      .where('status', 'Confirmado') // ⚠️ Asegúrate que en tu BD sea 'Confirmado' (con C mayúscula)
      .orderBy('fecha_pago', 'desc') // El más reciente primero
      .first();

    let fechaReferencia;

    if (ultimoPagoReal) {
      // Si encontramos pagos, esa es nuestra referencia
      fechaReferencia = ultimoPagoReal.fecha_pago;
      console.log(`✅ Último pago encontrado: ${toDateString(fechaReferencia)}`);
    } else {
      // ⚠️ FALLBACK: Si no hay pagos confirmados, usamos (Inicio Contrato - 1 día)
      // Así, al sumar +1 día en el frontend, te sugerirá la fecha exacta del contrato (19 Sep).
      const fechaInicio = new Date(asignacion.fecha_inicio);
      fechaInicio.setDate(fechaInicio.getDate() - 1); 
      fechaReferencia = fechaInicio;
      console.log(`⚠️ Sin pagos confirmados. Usando inicio contrato: ${toDateString(fechaReferencia)}`);
    }

    res.json({
      success: true,
      // Enviamos la fecha encontrada para que el Frontend calcule el "Siguiente Día"
      siguiente_fecha_pendiente: toDateString(fechaReferencia) 
    });

  } catch (error) {
    console.error('Error al obtener siguiente pago:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
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
  try {
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
        a.id as asignacion_id,
        a.renta_diaria,
        a.fecha_inicio,
        -- Dias adeudados desde el siguiente pago (sin domingos)
        COALESCE(dias.dias_adeudados, 0) as dias_transcurridos,
        -- Total debido acumulado (pagado + deuda actual)
        COALESCE(p.total_pagado, 0) + COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) as total_debido,
        -- Total pagado confirmado (renta + poliza)
        COALESCE(p.total_pagado, 0) as total_pagado,
        -- Deuda aproximada con base en el ultimo pago confirmado
        COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) as deuda_aproximada,
        -- Ultimo pago confirmado
        p.ultimo_pago
      FROM conductores c
      INNER JOIN asignaciones a ON c.id = a.conductor_id
      INNER JOIN vehiculos v ON a.vehiculo_id = v.id
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
        -- Mostrar SOLO conductores con DEUDA PENDIENTE (deuda > 0)
        AND COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) > 0
      ORDER BY deuda_aproximada DESC
    `;

    const result = await db.raw(sql);
    
    res.json({
      success: true,
      conductores_morosos: result.rows.map(row => ({
        id: row.id,
        nombre: row.nombre_conductor,
        nombre_conductor: row.nombre_conductor,
        telefono: row.numero_telefono,
        numero_telefono: row.numero_telefono,
        vehiculo: row.numero_vehiculo,
        numero_vehiculo: row.numero_vehiculo,
        tipo_socio: row.tipo_socio,
        dias_transcurridos: parseInt(row.dias_transcurridos || 0),
        total_debido: parseFloat(row.total_debido || 0),
        total_pagado: parseFloat(row.total_pagado || 0),
        deuda_aproximada: parseFloat(row.deuda_aproximada || 0),
        porcentaje_pago: row.total_debido > 0 ? ((parseFloat(row.total_pagado || 0) / parseFloat(row.total_debido || 1)) * 100).toFixed(1) : '0',
        ultimo_pago: row.ultimo_pago
      })),
      total_morosos: result.rows.length,
      nota: 'Los conductores se muestran si tienen deuda pendiente con base en el ultimo pago confirmado (domingos excluidos)'
    });
    
  } catch (error) {
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
