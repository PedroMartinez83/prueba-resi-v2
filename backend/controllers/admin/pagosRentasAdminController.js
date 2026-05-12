///// backend/controllers/admin/pagosRentasAdminController.js
const { db } = require('../../config/database');
const auditService = require('../../services/auditService');
const { format, subDays } = require('date-fns');


// Función auxiliar simple para evitar errores de fecha
const toDateString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
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



// Convierte a entero positivo o retorna null si no es válido
const toPositiveIntOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toMoney = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
      fecha_registro_desde,
      fecha_registro_hasta,
      metodo_pago,
      status,
      tipo_socio,
      busqueda,
      page = 1,
      limit: rawLimit = 50
    } = req.query;

    // 🚀 CAMBIO 2: Asegúrate de que 'limit' sea un número válido. 
    // Si desde el frontend mandamos 100000 como string, hay que convertirlo.
    let limit = parseInt(rawLimit);
    if (isNaN(limit) || limit <= 0) {
      limit = 50; 
    }

    const offset = (parseInt(page) - 1) * limit;

    // Query base usando la vista
    let queryBuilder = db('vista_pagos_rentas');
    let countQuery = db('vista_pagos_rentas');

    // Aplicar filtros

    // Aplicar filtros

    // 🔍 NUEVO: Filtro de Búsqueda Global (Backend) - ¡Simplificado!
    if (busqueda) {
      const terminoBusqueda = `%${busqueda}%`;
      const funcionBusqueda = function() {
        this.where('nombre_conductor', 'ILIKE', terminoBusqueda)
            .orWhere('numero_vehiculo', 'ILIKE', terminoBusqueda)
            .orWhereRaw('CAST(id AS TEXT) ILIKE ?', [terminoBusqueda]); 
      };

      queryBuilder = queryBuilder.where(funcionBusqueda);
      countQuery = countQuery.where(funcionBusqueda);
    }

    // 🧑‍✈️ Filtro por Conductor
    if (conductor_id) {
      queryBuilder = queryBuilder.where('conductor_id', conductor_id);
      countQuery = countQuery.where('conductor_id', conductor_id);
    }

    // 🚗 Filtro por Vehículo
    if (vehiculo_id) {
      queryBuilder = queryBuilder.where('vehiculo_id', vehiculo_id);
      countQuery = countQuery.where('vehiculo_id', vehiculo_id);
    }

    if (fecha_registro_desde) {
      queryBuilder = queryBuilder.where('created_at', '>=', `${fecha_registro_desde} 00:00:00`);
      countQuery = countQuery.where('created_at', '>=', `${fecha_registro_desde} 00:00:00`);
    } else if (fecha_desde) {
      queryBuilder = queryBuilder.where('fecha_pago', '>=', fecha_desde);
      countQuery = countQuery.where('fecha_pago', '>=', fecha_desde);
    }

    if (fecha_registro_hasta) {
      queryBuilder = queryBuilder.where('created_at', '<=', `${fecha_registro_hasta} 23:59:59`);
      countQuery = countQuery.where('created_at', '<=', `${fecha_registro_hasta} 23:59:59`);
    } else if (fecha_hasta) {
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
    // 🚀 NUEVO: Si no buscaron un status específico, escóndeme los eliminados
    else {
      queryBuilder = queryBuilder.where('status', '!=', 'Eliminado');
      countQuery = countQuery.where('status', '!=', 'Eliminado');
    }
    if (tipo_socio) {
      queryBuilder = queryBuilder.where('tipo_socio', tipo_socio);
      countQuery = countQuery.where('tipo_socio', tipo_socio);
    }

    // Obtener total para paginación
    const [{ count }] = await countQuery.count('id as count');
    const total = parseInt(count);

    // Obtener pagos
      const pagos = await queryBuilder
      .orderBy('created_at', 'desc') // 👈 Ahora ordena por la fecha en que se registró el pago en sistema
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
          'p.fecha_pago_fin',
          'p.created_at',
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

        const detalle = detalleMap.get(pago.id);
        if (detalle?.fecha_pago) {
          pago.created_at = detalle.created_at;
          pago.fecha_pago_fin = detalle.fecha_pago_fin;
          const rangoInicio = normalizeDateString(detalle.fecha_pago);
          const rangoFin = normalizeDateString(detalle.fecha_pago_fin || detalle.fecha_pago);
          pago.rango_inicio = rangoInicio;
          pago.rango_fin = rangoFin;
          if (rangoInicio || rangoFin) {
            pago.dias_cubiertos = rangoInicio && rangoFin && rangoInicio !== rangoFin
              ? `${rangoInicio} a ${rangoFin}`
              : (rangoInicio || rangoFin);
          }
        }

        if (!pago.created_at && detalle?.created_at) {
          pago.created_at = detalle.created_at;
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
    const tzName = 'America/Mazatlan';

    let baseQuery = db('pagos_diarios');
    const baseConfirmados = db('pagos_diarios').where('status', 'Confirmado');

    if (fecha_desde) {
      baseQuery = baseQuery.where('fecha_pago', '>=', fecha_desde);
      baseConfirmados.andWhere('fecha_pago', '>=', fecha_desde);
    }
    if (fecha_hasta) {
      baseQuery = baseQuery.where('fecha_pago', '<=', fecha_hasta);
      baseConfirmados.andWhere('fecha_pago', '<=', fecha_hasta);
    }

    // Estadísticas generales
    const [stats] = await baseQuery.clone()
      .select(
        db.raw('COUNT(*) as total_pagos'),
        db.raw("COUNT(CASE WHEN status = 'Confirmado' THEN 1 END) as confirmados"),
        db.raw("COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pendientes"),
        db.raw("COUNT(CASE WHEN status = 'Rechazado' THEN 1 END) as rechazados"),
        
        // 🎯 CAMBIO CLAVE: Usar monto_renta_pagado (ganancia empresa)
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN COALESCE(monto_total, COALESCE(monto_renta_pagado, 0) + COALESCE(monto_poliza_pagado, 0)) ELSE 0 END) as total_cobrado"), 
        // 🔵 NUEVO: Total cobrado incluyendo póliza (monto_total)
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN COALESCE(monto_renta_pagado, 0) ELSE 0 END) as total_cobrado_renta"),

        // Total cobrado incluyendo póliza (dia de hoy)
        db.raw(`SUM(
          CASE 
            WHEN status = 'Confirmado' 
            AND DATE(created_at AT TIME ZONE 'America/Mazatlan') = DATE(now() AT TIME ZONE 'America/Mazatlan') 
            THEN COALESCE(monto_total, COALESCE(monto_renta_pagado, 0) + COALESCE(monto_poliza_pagado, 0)) 
            ELSE 0 
          END
        ) as total_cobrado_hoy`),
        
        // 🆕 NUEVO: Total ahorrado en póliza (dinero conductor)
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN monto_poliza_pagado ELSE 0 END) as total_ahorrado_poliza"),
        
        db.raw("SUM(CASE WHEN status = 'Pendiente' THEN monto_total ELSE 0 END) as pendiente_validar"),
        db.raw("SUM(CASE WHEN status = 'Pendiente' THEN monto_renta_pagado ELSE 0 END) as pendiente_validar_renta"),
        db.raw("COUNT(DISTINCT asignacion_id) as conductores_activos")
      );

    // Cobrado HOY (renta + póliza; por fecha de aceptación/validación)
    const resumenTemporalResult = await db.raw(`
      WITH validaciones AS (
        SELECT
          NULLIF((ccl.datos_sensibles::jsonb->>'pago_id'), '')::int AS pago_id,
          MIN(ccl.created_at) AS fecha_validacion
        FROM critical_changes_log ccl
        WHERE ccl.tipo_cambio IN ('validacion_pago_renta', 'validacion_pago_renta_masivo')
          AND ccl.datos_sensibles IS NOT NULL
        GROUP BY 1
      ),
      pagos_evento AS (
        SELECT
          (COALESCE(v.fecha_validacion, pd.created_at) AT TIME ZONE ?)::timestamp AS fecha_evento_local,
          COALESCE(pd.monto_total, COALESCE(pd.monto_renta_pagado, 0) + COALESCE(pd.monto_poliza_pagado, 0)) AS monto_total,
          COALESCE(pd.monto_renta_pagado, 0) AS monto_renta,
          COALESCE(pd.monto_poliza_pagado, 0) AS monto_poliza
        FROM pagos_diarios pd
        LEFT JOIN validaciones v ON v.pago_id = pd.id
        WHERE pd.status = 'Confirmado'
      ),
      limites AS (
        SELECT
          (NOW() AT TIME ZONE ?)::date AS hoy,
          DATE_TRUNC('week', NOW() AT TIME ZONE ?)::date AS semana_inicio,
          (DATE_TRUNC('week', NOW() AT TIME ZONE ?) + INTERVAL '7 day')::date AS semana_fin_exclusivo,
          DATE_TRUNC('month', NOW() AT TIME ZONE ?)::date AS mes_inicio,
          (DATE_TRUNC('month', NOW() AT TIME ZONE ?) + INTERVAL '1 month')::date AS mes_fin_exclusivo
      )
      SELECT
        COALESCE(SUM(CASE WHEN pe.fecha_evento_local::date = l.hoy THEN pe.monto_total ELSE 0 END), 0) AS cobrado_hoy,
        COALESCE(SUM(CASE WHEN pe.fecha_evento_local::date >= l.semana_inicio AND pe.fecha_evento_local::date < l.semana_fin_exclusivo THEN pe.monto_total ELSE 0 END), 0) AS cobrado_semana,
        COALESCE(SUM(CASE WHEN pe.fecha_evento_local::date >= l.mes_inicio AND pe.fecha_evento_local::date < l.mes_fin_exclusivo THEN pe.monto_total ELSE 0 END), 0) AS cobrado_mes,
        COALESCE(SUM(CASE WHEN pe.fecha_evento_local::date >= l.mes_inicio AND pe.fecha_evento_local::date < l.mes_fin_exclusivo THEN pe.monto_renta ELSE 0 END), 0) AS cobrado_mes_renta,
        COALESCE(SUM(CASE WHEN pe.fecha_evento_local::date >= l.mes_inicio AND pe.fecha_evento_local::date < l.mes_fin_exclusivo THEN pe.monto_poliza ELSE 0 END), 0) AS poliza_mes
      FROM pagos_evento pe
      CROSS JOIN limites l
    `, [tzName, tzName, tzName, tzName, tzName, tzName]);
    const cobradoHoy = parseFloat(resumenTemporalResult.rows?.[0]?.cobrado_hoy || 0);
    const cobradoSemana = parseFloat(resumenTemporalResult.rows?.[0]?.cobrado_semana || 0);
    const cobradoMes = parseFloat(resumenTemporalResult.rows?.[0]?.cobrado_mes || 0);
    const cobradoMesRenta = parseFloat(resumenTemporalResult.rows?.[0]?.cobrado_mes_renta || 0);
    const polizaMes = parseFloat(resumenTemporalResult.rows?.[0]?.poliza_mes || 0);

    // Conductores con deuda PENDIENTE (ultimo pago confirmado)
    const deudaResult = await db.raw(`
      WITH pagos_confirmados AS (
        SELECT
          asignacion_id,
          MAX(COALESCE(fecha_pago_fin, fecha_pago))::date as ultimo_pago
        FROM pagos_diarios
        WHERE status IN ('Confirmado', 'Pagada')
        GROUP BY asignacion_id
      )
      SELECT
        COUNT(DISTINCT c.id) as total,
        COALESCE(SUM(
          COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0))
        ), 0) as deuda_total
      FROM conductores c
      INNER JOIN asignaciones a ON c.id = a.conductor_id
      LEFT JOIN pagos_confirmados p ON a.id = p.asignacion_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as dias_adeudados
        FROM generate_series(
          GREATEST(
            COALESCE(p.ultimo_pago::date, a.fecha_inicio::date - 1) + 1,
            DATE '2026-01-01'
          ),
          (NOW() AT TIME ZONE 'America/Mazatlan')::date,
          interval '1 day'
        ) as d(fecha)
        WHERE EXTRACT(DOW FROM d.fecha) <> 0
      ) dias ON true
      WHERE a.activa = true
        AND COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) > 0
    `);
    const conductoresDeuda = parseInt(deudaResult.rows[0]?.total || 0);
    const deudaTotalConductores = parseFloat(deudaResult.rows[0]?.deuda_total || 0);

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

    // Por metodo de pago
    const porMetodo = await baseConfirmados.clone()
      .select('metodo_pago')
      .sum('monto_total as total')
      .count('id as cantidad')
      .groupBy('metodo_pago');

    // Indicadores avanzados (segun fecha/hora de registro del conductor)
    const rangoInsights = db('pagos_diarios')
      .where('status', 'Confirmado');

    if (fecha_desde) {
      rangoInsights.andWhereRaw("DATE(created_at AT TIME ZONE ?) >= ?", [tzName, fecha_desde]);
    }
    if (fecha_hasta) {
      rangoInsights.andWhereRaw("DATE(created_at AT TIME ZONE ?) <= ?", [tzName, fecha_hasta]);
    }

    const mejorDiaResult = await rangoInsights.clone()
      .select(db.raw("EXTRACT(DOW FROM (created_at AT TIME ZONE ?))::int as dow", [tzName]))
      .sum('monto_total as total')
      .groupBy('dow')
      .orderBy('total', 'desc')
      .first();

    const horaPicoResult = await rangoInsights.clone()
      .select(db.raw("EXTRACT(HOUR FROM (created_at AT TIME ZONE ?))::int as hour", [tzName]))
      .count('id as total')
      .groupBy('hour')
      .orderBy('total', 'desc')
      .first();

    const metodoPreferidoResult = await rangoInsights.clone()
      .select('metodo_pago')
      .count('id as total')
      .groupBy('metodo_pago')
      .orderBy('total', 'desc')
      .first();

    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const mejorDia = mejorDiaResult?.dow !== undefined && mejorDiaResult?.dow !== null
      ? diasSemana[mejorDiaResult.dow]
      : null;

    const horaPico = horaPicoResult?.hour !== undefined && horaPicoResult?.hour !== null
      ? `${String(horaPicoResult.hour).padStart(2, '0')}:00`
      : null;

    const metodoPreferido = metodoPreferidoResult?.metodo_pago || null;

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
        total_cobrado_total: parseFloat(stats.total_cobrado || 0),
        total_cobrado_renta: parseFloat(stats.total_cobrado_renta || 0),
        
        // 🆕 NUEVO: Dinero ahorrado en póliza (conductores)
        total_ahorrado_poliza: parseFloat(stats.total_ahorrado_poliza || 0),
        
        pendientes_validar: parseInt(stats.pendientes || 0),
        pendiente_validar_renta: parseFloat(stats.pendiente_validar_renta || 0),
        conductores_activos: parseInt(stats.conductores_activos || 0),

        // Saldos pendientes
        saldos_pendientes: parseFloat(stats.pendiente_validar || 0),

        total_cobrado_hoy: cobradoHoy,
        
        // Temporales
        cobrado_hoy: cobradoHoy,
        cobrado_semana: cobradoSemana,
        cobrado_mes: cobradoMes,
        cobrado_mes_renta: cobradoMesRenta,
        conductores_deuda: conductoresDeuda,
        total_deuda_conductores: deudaTotalConductores,
        proyeccion_mes: parseFloat(proyeccion),
        proyeccion_poliza_mes: parseFloat(proyeccionPoliza),
        poliza_mes_real: polizaMes,
        cambio_dia: 0,
        cambio_semana: 0,
        cambio_mes: 0
      },
      por_metodo: porMetodo,
      top_conductores: topConductores,
      insights: {
        mejor_dia: mejorDia,
        hora_pico: horaPico,
        metodo_preferido: metodoPreferido,
        rango: {
          fecha_desde: fecha_desde || null,
          fecha_hasta: fecha_hasta || null
        }
      }
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
        await trx.rollback();
        throw new Error(`El pago no está pendiente (Estado actual: ${pago.status})`);
    }

    // =====================================================================
    // 🛡️ VALIDACIÓN FIFO (First In, First Out)
    // =====================================================================
    // Buscamos si existe algún pago PENDIENTE con fecha ANTERIOR a este.
    // Si existe, significa que te estás saltando la fila.
    const pagoAnteriorPendiente = await trx('pagos_diarios')
      .where('asignacion_id', pago.asignacion_id) // Mismo conductor/vehículo
      .where('status', 'Pendiente')               // Que esté pendiente
      .andWhere(function() {
         // Buscamos fechas MENORES a la fecha de este pago
         this.where('fecha_pago', '<', pago.fecha_pago)
      })
      .orderBy('fecha_pago', 'asc') // El más antiguo primero
      .first();

    if (pagoAnteriorPendiente) {
        await trx.rollback();
        
        const fechaPendiente = new Date(pagoAnteriorPendiente.fecha_pago).toISOString().split('T')[0];
        
        return res.status(400).json({
            success: false,
            message: `⚠️ ORDEN INCORRECTO: No puedes validar este pago porque existe uno ANTERIOR (del día ${fechaPendiente}) que aún está pendiente.\n\nDebes validar los pagos en orden cronológico (del más antiguo al más nuevo).`
        });
    }
    // =====================================================================

    // 2. Obtener Asignación y Vehículo
    const asignacion = await trx('asignaciones').where('id', pago.asignacion_id).first();
    if (!asignacion) throw new Error('Asignación no encontrada');

    const vehiculoId = toPositiveIntOrNull(asignacion.vehiculo_id);
    if (!vehiculoId) throw new Error(`Asignación inválida: vehiculo_id "${asignacion.vehiculo_id}"`);

    const vehiculo = await trx('vehiculos').where('id', vehiculoId).first();
    if (!vehiculo) throw new Error(`Vehículo no encontrado (ID ${vehiculoId})`);

    // 3. Cálculos financieros (SEPARACIÓN DE FONDOS)
    // 👉 El abono a la deuda es SOLO la renta pagada
    const montoRentaAbonar = parseFloat(pago.monto_renta_pagado || 0); 
    // 👉 El fondo de póliza es SOLO la póliza pagada
    const montoPolizaAbonar = parseFloat(pago.monto_poliza_pagado || 0); 
    
    // --- Cálculos de la Deuda del Vehículo ---
    const totalCorrida = parseFloat(vehiculo.total_corrida || 0);
    const pagadoActual = parseFloat(vehiculo.total_pagado_corrida || 0);

    const nuevoPagado = pagadoActual + montoRentaAbonar; // 👈 Solo suma la renta
    const nuevoSaldoPendiente = Math.max(0, totalCorrida - nuevoPagado);
    
    let nuevoPorcentaje = 0;
    if (totalCorrida > 0) {
      nuevoPorcentaje = (nuevoPagado / totalCorrida) * 100;
    }

    // --- Cálculos del Fondo de Póliza ---
    // Si la columna poliza_mecanica no existe o es nula, empezamos de cero
    const fondoPolizaActual = parseFloat(vehiculo.poliza_mecanica || 0); 
    const nuevoFondoPoliza = fondoPolizaActual + montoPolizaAbonar; // 👈 Sumamos los $100/día

    console.log(`💰 Actualizando finanzas auto ${vehiculo.numero_vehiculo}:`);
    console.log(`   - Abono a deuda (Renta): $${montoRentaAbonar} | Nuevo %: ${nuevoPorcentaje.toFixed(2)}`);
    console.log(`   - Abono a fondo (Póliza): $${montoPolizaAbonar} | Nuevo Fondo: $${nuevoFondoPoliza}`);


    // 4. ACTUALIZAR VEHÍCULO
    await trx('vehiculos')
      .where('id', vehiculoId)
      .update({
        total_pagado_corrida: nuevoPagado,
        saldo_pendiente_corrida: nuevoSaldoPendiente,
        porcentaje_pagado: nuevoPorcentaje,
        poliza_mecanica: nuevoFondoPoliza, // 👈 ¡NUEVO CAMPO AFECTADO!
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
        descripcion: `Pago validado ($${montoRentaAbonar}) - Avance auto: ${nuevoPorcentaje.toFixed(2)}%`,
        datos_sensibles: {
          pago_id: id,
          vehiculo_id: vehiculo.id,
          monto_abonado: montoRentaAbonar
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


// =====================================================================
// 🚀 VALIDAR MÚLTIPLES PAGOS (MASIVO)
// =====================================================================
exports.validarPagosMasivos = async (req, res) => {
  console.log(`🔍 Iniciando validación masiva de pagos...`);
  const trx = await db.transaction();
  
  try {
    const { pagosIds } = req.body;
    
    if (!pagosIds || !Array.isArray(pagosIds) || pagosIds.length === 0) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'No se enviaron pagos para validar.' });
    }

    const usuarioActual = req.user || { id: 0, email: 'sistema@admin.com', nombre: 'Sistema' };
    console.log('👤 Usuario realizando acción masiva:', usuarioActual.email);

    try {
      if (auditService && auditService.setUserContext) {
        await auditService.setUserContext(trx, usuarioActual);
      }
    } catch (auditErr) {
      console.warn('⚠️ Advertencia: No se pudo configurar contexto de auditoría', auditErr.message);
    }

    // 1. Obtenemos TODOS los pagos seleccionados y los ORDENAMOS por fecha (del más viejo al nuevo)
    const pagosAProcesar = await trx('pagos_diarios')
      .whereIn('id', pagosIds)
      .orderBy('fecha_pago', 'asc');

    let totalAbonadoGlobal = 0;

    // 2. Procesamos uno por uno en estricto orden
    for (const pago of pagosAProcesar) {
      console.log(`⏳ Procesando pago masivo ID: ${pago.id} de fecha ${pago.fecha_pago}`);

      if (pago.status !== 'Pendiente') {
          throw new Error(`El pago #${pago.id} ya no está pendiente (Estado: ${pago.status}).`);
      }

      // 🛡️ VALIDACIÓN FIFO (Igual que en el individual)
      const pagoAnteriorPendiente = await trx('pagos_diarios')
        .where('asignacion_id', pago.asignacion_id)
        .where('status', 'Pendiente')
        .andWhere('fecha_pago', '<', pago.fecha_pago)
        .orderBy('fecha_pago', 'asc')
        .first();

      if (pagoAnteriorPendiente) {
          const fechaPendiente = new Date(pagoAnteriorPendiente.fecha_pago).toISOString().split('T')[0];
          throw new Error(`⛔ ORDEN INCORRECTO: Para el pago #${pago.id} existe uno ANTERIOR (del ${fechaPendiente}) pendiente de aprobar. La validación masiva se ha cancelado para proteger los saldos.`);
      }

      // Obtener Asignación y Vehículo
      const asignacion = await trx('asignaciones').where('id', pago.asignacion_id).first();
      if (!asignacion) throw new Error(`Asignación no encontrada para el pago #${pago.id}`);

      // Usar tu utilidad para evitar errores de ID
      // OJO: Si no tienes importada la función toPositiveIntOrNull aquí arriba, usa parseInt()
      const vehiculoId = parseInt(asignacion.vehiculo_id);
      if (!vehiculoId || isNaN(vehiculoId)) throw new Error(`Asignación inválida: vehiculo_id "${asignacion.vehiculo_id}"`);

      // ⚠️ BLOQUEAMOS la fila del vehículo con .forUpdate() para que nadie más la modifique mientras hacemos mates
      const vehiculo = await trx('vehiculos').where('id', vehiculoId).first().forUpdate();
      if (!vehiculo) throw new Error(`Vehículo no encontrado (ID ${vehiculoId})`);

      // ==========================================
      // 💰 CÁLCULOS FINANCIEROS (SEPARACIÓN DE FONDOS)
      // ==========================================
      const montoRentaAbonar = parseFloat(pago.monto_renta_pagado || 0);
      const montoPolizaAbonar = parseFloat(pago.monto_poliza_pagado || 0);
      const montoTotalAbonar = parseFloat(pago.monto_total || 0); // Lo guardamos para el mensaje final
      
      // --- Cálculos de la Deuda del Vehículo ---
      const totalCorrida = parseFloat(vehiculo.total_corrida || 0);
      const pagadoActual = parseFloat(vehiculo.total_pagado_corrida || 0);

      const nuevoPagado = pagadoActual + montoRentaAbonar; // 👈 Solo la renta
      const nuevoSaldoPendiente = Math.max(0, totalCorrida - nuevoPagado);
      
      let nuevoPorcentaje = 0;
      if (totalCorrida > 0) {
        nuevoPorcentaje = (nuevoPagado / totalCorrida) * 100;
      }

      // --- Cálculos del Fondo de Póliza ---
      const fondoPolizaActual = parseFloat(vehiculo.poliza_mecanica || 0);
      const nuevoFondoPoliza = fondoPolizaActual + montoPolizaAbonar; // 👈 Solo la póliza

      // Sumamos el total global para el mensaje de éxito que sale al final
      totalAbonadoGlobal += montoTotalAbonar;

      // ACTUALIZAR VEHÍCULO
      await trx('vehiculos')
        .where('id', vehiculoId)
        .update({
          total_pagado_corrida: nuevoPagado,
          saldo_pendiente_corrida: nuevoSaldoPendiente,
          porcentaje_pagado: nuevoPorcentaje,
          poliza_mecanica: nuevoFondoPoliza, // 👈 ¡Nuevo campo actualizado!
          updated_at: new Date()
        });
      // ==========================================

      // CONFIRMAR EL PAGO
      const datosUpdate = {
        status: 'Confirmado',
        updated_at: new Date()
      };
      
      if (usuarioActual.email) {
        datosUpdate.registrado_por = usuarioActual.email;
      }

      await trx('pagos_diarios').where('id', pago.id).update(datosUpdate);

      // Auditoría
      try {
        await auditService.logCriticalChange({
          usuario_id: usuarioActual.id,
          tipo_cambio: 'validacion_pago_renta_masivo',
          descripcion: `Pago masivo validado ($${montoAbonar}) - Avance auto: ${nuevoPorcentaje.toFixed(2)}%`,
          datos_sensibles: { pago_id: pago.id, vehiculo_id: vehiculo.id, monto_abonado: montoAbonar },
          ip_address: req.ip || '0.0.0.0'
        });
      } catch (logErr) {}
    }

    // SI LLEGAMOS AQUÍ, NADA FALLÓ. ¡GUARDAMOS TODO!
    await trx.commit();
    console.log(`✅ Validación masiva exitosa. Se aprobaron ${pagosIds.length} pagos.`);

    res.json({
      success: true,
      message: `¡Se han validado ${pagosIds.length} pagos exitosamente por un total de $${totalAbonadoGlobal}!`,
      pagosAprobados: pagosIds.length
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ ERROR FATAL EN VALIDACIÓN MASIVA:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Ocurrió un error al procesar los pagos masivos.'
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

    // 1. Buscamos el pago que queremos rechazar
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

    // =====================================================================
    // 🛡️ VALIDACIÓN DE ORDEN CRONOLÓGICO (LIFO - Last In, First Out)
    // =====================================================================
    // Buscamos si existe algún pago posterior que esté "VIVO" (Pendiente, Aprobado o Confirmado)
    const pagoPosterior = await trx('pagos_diarios')
      .where('asignacion_id', pago.asignacion_id)
      .where('status', 'Pendiente') // 🟢 CORRECCIÓN AQUÍ
      .andWhere(function() {
         // Buscamos fechas mayores a la fecha de este pago
         this.where('fecha_pago', '>', pago.fecha_pago)
      })
      .orderBy('fecha_pago', 'asc')
      .first();

    if (pagoPosterior) {
        await trx.rollback();
        
        const fechaConflicto = new Date(pagoPosterior.fecha_pago).toISOString().split('T')[0];
        
        return res.status(400).json({
            success: false,
            error: `⚠️ BLOQUEO DE INTEGRIDAD: No puedes rechazar este pago porque existe una solicitud PENDIENTE posterior del día ${fechaConflicto}.\n\nPara mantener el orden, debes rechazar primero la solicitud más reciente.`
        });
    }
    // =====================================================================

    // 2. Si pasó la validación, procedemos a rechazar
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
        motivo: motivo_rechazo,
        fecha_pago: pago.fecha_pago
      },
      ip_address: auditService.getClientIp(req),
      requiere_revision: true
    });

    await trx.commit();

    res.json({
      success: true,
      message: 'Pago rechazado correctamente'
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

// Cuenta días hábiles en un rango (ignora Domingos)
const contarDiasCobrables = (fechaInicio, fechaFin) => {
  let contador = 0;
  // Usamos hora fija (12:00) para evitar problemas de zona horaria
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

// ========== REGISTRAR PAGO MANUAL (ADMIN) - CON DESTINO DE AHORRO SEPARADO ==========
exports.registrarPagoManual = async (req, res) => {
  const { conductor_id, monto_renta, monto_extra, fecha_pago, fecha_fin, metodo_pago, observaciones, referencia } = req.body;

  try {
    await db.transaction(async (trx) => {
      // 1. Buscamos la asignación
      const asignacion = await trx('asignaciones')
        .where({ conductor_id, activa: true })
        .orderBy('id', 'desc') // Importante: tomar la última
        .first();
      
      if (!asignacion) throw new Error('❌ El conductor no tiene asignación activa.');
      const vehiculoId = toPositiveIntOrNull(asignacion.vehiculo_id);
      if (!vehiculoId) throw new Error(`❌ La asignación #${asignacion.id} tiene vehiculo_id inválido: ${JSON.stringify(asignacion.vehiculo_id)}`);

      // 2. BUSCAR VEHÍCULO CON VALIDACIÓN
      const vehiculo = await trx('vehiculos')
        .where('id', vehiculoId)
        .first()
        .forUpdate();
      
      // 🛡️ ESTA LÍNEA EVITA EL ERROR "integer: «»"
      if (!vehiculo) throw new Error(`❌ El vehículo ID ${vehiculoId} no existe en la base de datos.`);

      // 3. FECHAS Y RANGO
      const fInicio = toDateString(fecha_pago);
      let fFin = toDateString(fecha_fin);
      if (!fFin) fFin = fInicio; // Si no hay fin, es igual al inicio
      if (new Date(fFin) < new Date(fInicio)) fFin = fInicio;

      // 4. DÍAS HÁBILES
      const diasACobrar = contarDiasCobrables(fInicio, fFin);
      if (diasACobrar === 0) throw new Error('❌ El rango seleccionado solo contiene domingos.');

      // 5. TOTALES SEPARADOS
      const rentaTotal = parseFloat(monto_renta || 0) * diasACobrar;
      const polizaTotal = parseFloat(monto_extra || 0) * diasACobrar;
      const granTotal = rentaTotal + polizaTotal; // Solo se usa para el registro del pago y el total cobrado

      // 🟢 Formateo de fechas para el texto de observaciones
      const opcionesFecha = { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' };
      const fInicioLegible = new Date(fInicio).toLocaleDateString('es-MX', opcionesFecha);
      const fFinLegible = new Date(fFin).toLocaleDateString('es-MX', opcionesFecha);
      
      const textoRango = (diasACobrar > 1) 
          ? ` (Periodo: ${fInicioLegible} al ${fFinLegible})` 
          : ` (Día: ${fInicioLegible})`;
      const obsFinal = observaciones 
          ? `${observaciones.trim()}\n${textoRango}` 
          : textoRango.trim();

      // 6. INSERTAR REGISTRO DE PAGO
      await trx('pagos_diarios').insert({
        asignacion_id: asignacion.id,
        fecha_pago: fInicio,
        fecha_pago_fin: fFin,
        monto_renta_pagado: rentaTotal,
        monto_poliza_pagado: polizaTotal,
        monto_total: granTotal,
        metodo_pago: metodo_pago,
        referencia: referencia,
        status: 'Confirmado',
        observaciones: obsFinal.trim(),
        created_at: new Date(),
        updated_at: new Date()
      });

      // 7. ACTUALIZAR VEHÍCULO (CÁLCULOS SEPARADOS)
      const totalCorrida = parseFloat(vehiculo.total_corrida || 0);
      
      // Dinero de la renta (Progreso)
      const pagadoAnterior = parseFloat(vehiculo.total_pagado_corrida || 0);
      const nuevoTotalPagado = pagadoAnterior + rentaTotal; // 👈 Solo sumamos la renta
      
      // Dinero de la póliza (Alcancía)
      const polizaAnterior = parseFloat(vehiculo.poliza_mecanica || 0);
      const nuevaPoliza = polizaAnterior + polizaTotal; // 👈 Sumamos la póliza a su fondo
      
      // Recálculo de deuda y porcentaje (Basado solo en la renta)
      const nuevoSaldoPendiente = Math.max(0, totalCorrida - nuevoTotalPagado);
      const nuevoPorcentaje = totalCorrida > 0 ? (nuevoTotalPagado / totalCorrida) * 100 : 0;

      await trx('vehiculos')
        .where('id', vehiculoId)
        .update({
          total_pagado_corrida: nuevoTotalPagado.toFixed(2),
          saldo_pendiente_corrida: nuevoSaldoPendiente.toFixed(2),
          porcentaje_pagado: nuevoPorcentaje.toFixed(2),
          poliza_mecanica: nuevaPoliza.toFixed(2), // 👈 Inyectamos el fondo de la póliza
          updated_at: new Date()
        });
    });

    res.json({ success: true, message: 'Pago registrado y unidad actualizada correctamente.' });

  } catch (error) {
    console.error('❌ Error Admin Pago:', error.message);
        if (error.detail) {
      console.error('📌 Detalle SQL Admin Pago:', error.detail);
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// 2. CORRECCIÓN EN OBTENER SIGUIENTE PAGO (PARA DETECTAR SI ES NUEVO)
exports.getSiguientePagoPendiente = async (req, res) => {
  try {
    const { conductorId } = req.params;

    // 1. Validar Asignación
    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({ success: false, message: 'Sin asignación activa' });
    }

    // 2. BUSCAR EL ÚLTIMO PAGO REAL (CONFIRMADO O PENDIENTE)
    // ⚠️ EL TRUCO: Ordenamos por la fecha FINAL, no la inicial.
    // COALESCE asegura que si fecha_pago_fin es null, use fecha_pago.
    const ultimoPagoReal = await db('pagos_diarios')
      .where({ asignacion_id: asignacion.id })
      .whereIn('status', ['Confirmado', 'Pendiente']) 
      .orderByRaw('COALESCE(fecha_pago_fin, fecha_pago) DESC') // <--- CLAVE MAESTRA 🗝️
      .first();

    let fechaReferencia;
    let sinHistorial = false;

    if (ultimoPagoReal) {
      // 3. SELECCIONAR LA FECHA CORRECTA
      // Tomamos la fecha FIN del rango. Si no tiene fin, tomamos la de inicio.
      fechaReferencia = ultimoPagoReal.fecha_pago_fin || ultimoPagoReal.fecha_pago;
      
      console.log(`🔍 Último pago encontrado: ID ${ultimoPagoReal.id} | Fin: ${fechaReferencia}`);
    } else {
      // No hay pagos previos
      sinHistorial = true;
      fechaReferencia = null;
    }

    // 🚨 LA MAGIA ESTÁ AQUÍ 🚨
    // Formateamos la fecha de inicio de la asignación a YYYY-MM-DD de forma segura
    const fechaInicioCarro = asignacion.fecha_inicio 
        ? new Date(asignacion.fecha_inicio).toISOString().split('T')[0] 
        : null;

    res.json({
      success: true,
      siguiente_fecha_pendiente: toDateString(fechaReferencia), // Enviamos la fecha fin correcta
      sin_historial: sinHistorial,
      fecha_asignacion: fechaInicioCarro // 👈 ¡ESTO ERA LO QUE LE FALTABA A REACT!
    });

  } catch (error) {
    console.error('Error al obtener siguiente pago:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
};

// ========== OBTENER SALDO PÓLIZA DE UN CONDUCTOR ==========
exports.getSaldoPolizaConductor = async (req, res) => {
  try {
    const { conductorId } = req.params;

    const conductor = await db('conductores as c')
      .leftJoin('asignaciones as a', function() {
        this.on('c.id', '=', 'a.conductor_id')
          .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .where('c.id', conductorId)
      .select(
        'c.id',
        'c.nombre_conductor',
        'c.saldo_ahorro_mantenimiento',
        'c.tipo_poliza',
        'c.total_aportado_poliza',
        'v.poliza_mecanica',
        'v.numero_vehiculo'
      )
      .first();

    if (!conductor) {
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }

    const tipoPoliza = conductor.tipo_poliza || 'POLIZA_100';
    const saldoPoliza = parseFloat(conductor.poliza_mecanica || 0);
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


// ========== 🆕 OBTENER OPCIONES PARA CREAR PAGO (CORREGIDO) ==========
exports.getOpcionesPagos = async (req, res) => {
  try {
    console.log('🔍 Obteniendo opciones para crear pago...');
    
    // Estados posibles
    const estados = ['Pendiente', 'Confirmado', 'Rechazado'];
    
    // Métodos de pago
    const metodos_pago = ['Deposito', 'Transferencia', 'Tarjeta', 'Stripe'];
    
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
    const tzName = 'America/Mazatlan';
    const mesesParam = parseInt(req.query.meses, 10);
    const meses = Number.isInteger(mesesParam) && mesesParam > 0
      ? Math.min(mesesParam, 36)
      : 12;

    const mensualSql = `
      WITH params AS (
        SELECT
          DATE_TRUNC('month', NOW() AT TIME ZONE ?)::date AS mes_actual,
          ?::int AS meses
      ),
      serie_meses AS (
        SELECT
          (p.mes_actual - make_interval(months => (p.meses - 1 - gs.idx)))::date AS mes_inicio
        FROM params p
        JOIN LATERAL generate_series(0, p.meses - 1) AS gs(idx) ON true
      ),
      validaciones AS (
        SELECT
          NULLIF((ccl.datos_sensibles::jsonb->>'pago_id'), '')::int AS pago_id,
          MIN(ccl.created_at) AS fecha_validacion
        FROM critical_changes_log ccl
        WHERE ccl.tipo_cambio IN ('validacion_pago_renta', 'validacion_pago_renta_masivo')
          AND ccl.datos_sensibles IS NOT NULL
        GROUP BY 1
      ),
      pagos_evento AS (
        SELECT
          DATE_TRUNC('month', (COALESCE(v.fecha_validacion, pd.created_at) AT TIME ZONE ?))::date AS mes_inicio,
          COALESCE(pd.monto_total, COALESCE(pd.monto_renta_pagado, 0) + COALESCE(pd.monto_poliza_pagado, 0)) AS monto_total,
          COALESCE(pd.monto_renta_pagado, 0) AS monto_renta,
          COALESCE(pd.monto_poliza_pagado, 0) AS monto_poliza,
          pd.asignacion_id
        FROM pagos_diarios pd
        LEFT JOIN validaciones v ON v.pago_id = pd.id
        WHERE pd.status = 'Confirmado'
      ),
      pagos_rango AS (
        SELECT
          pe.mes_inicio,
          SUM(pe.monto_total)::numeric AS total_cobrado,
          SUM(pe.monto_renta)::numeric AS total_renta,
          SUM(pe.monto_poliza)::numeric AS total_poliza,
          COUNT(*)::int AS total_pagos,
          COUNT(DISTINCT pe.asignacion_id)::int AS conductores_activos
        FROM pagos_evento pe
        WHERE pe.mes_inicio >= (SELECT MIN(mes_inicio) FROM serie_meses)
          AND pe.mes_inicio <= (SELECT MAX(mes_inicio) FROM serie_meses)
        GROUP BY 1
      )
      SELECT
        sm.mes_inicio,
        COALESCE(pr.total_cobrado, 0) AS total_cobrado,
        COALESCE(pr.total_renta, 0) AS total_renta,
        COALESCE(pr.total_poliza, 0) AS total_poliza,
        COALESCE(pr.total_pagos, 0) AS total_pagos,
        COALESCE(pr.conductores_activos, 0) AS conductores_activos
      FROM serie_meses sm
      LEFT JOIN pagos_rango pr ON pr.mes_inicio = sm.mes_inicio
      ORDER BY sm.mes_inicio ASC
    `;

    const mensualResult = await db.raw(mensualSql, [tzName, meses, tzName]);
    const mesesLabel = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const datos = mensualResult.rows.map((row) => {
      const mesInicio = row.mes_inicio instanceof Date
        ? new Date(row.mes_inicio)
        : new Date(`${row.mes_inicio}T12:00:00`);
      const anio = mesInicio.getFullYear();
      const mesNumero = mesInicio.getMonth() + 1;
      const totalCobrado = parseFloat(row.total_cobrado || 0);
      const totalRenta = parseFloat(row.total_renta || 0);
      const totalPoliza = parseFloat(row.total_poliza || 0);
      const totalPagos = parseInt(row.total_pagos || 0, 10);
      const conductoresActivos = parseInt(row.conductores_activos || 0, 10);
      const diasMes = new Date(anio, mesNumero, 0).getDate();

      return {
        anio,
        mes_numero: mesNumero,
        mes: `${anio}-${String(mesNumero).padStart(2, '0')}`,
        mes_label: `${mesesLabel[mesNumero - 1]} ${anio}`,
        total_cobrado: totalCobrado,
        total_renta: totalRenta,
        total_poliza: totalPoliza,
        total_pagos: totalPagos,
        conductores_activos: conductoresActivos,
        promedio_diario: diasMes > 0 ? totalCobrado / diasMes : 0,
        promedio: diasMes > 0 ? totalCobrado / diasMes : 0
      };
    });

    const resumenBase = datos.reduce(
      (acc, item) => {
        acc.total_cobrado += item.total_cobrado;
        acc.total_renta += item.total_renta;
        acc.total_poliza += item.total_poliza;
        acc.total_pagos += item.total_pagos;
        return acc;
      },
      { total_cobrado: 0, total_renta: 0, total_poliza: 0, total_pagos: 0 }
    );

    const mejorMes = datos.reduce((max, item) =>
      !max || item.total_cobrado > max.total_cobrado ? item : max, null);

    const anualActualResult = await db.raw(
      `
      WITH validaciones AS (
        SELECT
          NULLIF((ccl.datos_sensibles::jsonb->>'pago_id'), '')::int AS pago_id,
          MIN(ccl.created_at) AS fecha_validacion
        FROM critical_changes_log ccl
        WHERE ccl.tipo_cambio IN ('validacion_pago_renta', 'validacion_pago_renta_masivo')
          AND ccl.datos_sensibles IS NOT NULL
        GROUP BY 1
      ),
      pagos_evento AS (
        SELECT
          (COALESCE(v.fecha_validacion, pd.created_at) AT TIME ZONE ?)::timestamp AS fecha_evento_local,
          COALESCE(pd.monto_total, COALESCE(pd.monto_renta_pagado, 0) + COALESCE(pd.monto_poliza_pagado, 0)) AS monto_total,
          COALESCE(pd.monto_renta_pagado, 0) AS monto_renta,
          COALESCE(pd.monto_poliza_pagado, 0) AS monto_poliza
        FROM pagos_diarios pd
        LEFT JOIN validaciones v ON v.pago_id = pd.id
        WHERE pd.status = 'Confirmado'
      )
      SELECT
        COALESCE(SUM(pe.monto_total), 0)::numeric AS total_cobrado,
        COALESCE(SUM(pe.monto_renta), 0)::numeric AS total_renta,
        COALESCE(SUM(pe.monto_poliza), 0)::numeric AS total_poliza
      FROM pagos_evento pe
      WHERE EXTRACT(YEAR FROM pe.fecha_evento_local)::int =
            EXTRACT(YEAR FROM (NOW() AT TIME ZONE ?))::int
      `,
      [tzName, tzName]
    );

    const totalAnualCobrado = parseFloat(anualActualResult.rows?.[0]?.total_cobrado || 0);
    const totalAnualRenta = parseFloat(anualActualResult.rows?.[0]?.total_renta || 0);
    const totalAnualPoliza = parseFloat(anualActualResult.rows?.[0]?.total_poliza || 0);

    res.json({
      success: true,
      meses_consultados: meses,
      datos,
      resumen_periodo: {
        meses,
        total_cobrado: resumenBase.total_cobrado,
        total_renta: resumenBase.total_renta,
        total_poliza: resumenBase.total_poliza,
        total_pagos: resumenBase.total_pagos,
        promedio_mensual: datos.length > 0 ? resumenBase.total_cobrado / datos.length : 0,
        mejor_mes: mejorMes?.mes_label || null
      },
      resumen_anual: {
        anio_actual: new Date().getFullYear(),
        total_cobrado: totalAnualCobrado,
        total_renta: totalAnualRenta,
        total_poliza: totalAnualPoliza
      }
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
          MAX(COALESCE(fecha_pago_fin, fecha_pago))::date as ultimo_pago,
          COALESCE(SUM(monto_total), 0) as total_pagado_confirmado
        FROM pagos_diarios
        WHERE status IN ('Confirmado', 'Pagada')
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
          GREATEST(
            COALESCE(p.ultimo_pago::date, a.fecha_inicio::date - 1) + 1,
            DATE '2026-01-01'
          ),
          (NOW() AT TIME ZONE 'America/Mazatlan')::date,
          interval '1 day'
        ) as d(fecha)
        WHERE EXTRACT(DOW FROM d.fecha) <> 0
      ) dias ON true
      WHERE pd.status IN ('Confirmado', 'Pagada')
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
          MAX(COALESCE(fecha_pago_fin, fecha_pago))::date as ultimo_pago,
          COALESCE(SUM(monto_total), 0) as total_pagado
        FROM pagos_diarios
        WHERE status IN ('Confirmado', 'Pagada')
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
          GREATEST(
            COALESCE(p.ultimo_pago::date, a.fecha_inicio::date - 1) + 1,
            DATE '2026-01-01'
          ),
          (NOW() AT TIME ZONE 'America/Mazatlan')::date,
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
    
    const conductor = await db('conductores as c')
      .leftJoin('asignaciones as a', function() {
        this.on('c.id', '=', 'a.conductor_id')
          .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .where('c.id', conductorId)
      .select(
        'c.id',
        'c.nombre_conductor',
        'c.saldo_ahorro_mantenimiento',
        'c.tipo_poliza',
        'c.total_aportado_poliza',
        'v.poliza_mecanica'
      )
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

    const historialIds = historial.map((pago) => pago.id).filter(Boolean);
    if (historialIds.length > 0) {
      const pagosDetalle = await db('pagos_diarios')
        .whereIn('id', historialIds)
        .select('id', 'fecha_pago', 'fecha_pago_fin');
      const detalleMap = new Map(
        pagosDetalle.map((row) => [row.id, row])
      );

      historial.forEach((pago) => {
        const montoTotalRaw = parseFloat(pago.monto_total || 0);
        const montoRentaRaw = parseFloat(pago.monto_renta_pagado || 0);
        const montoPolizaRaw = parseFloat(pago.monto_poliza_pagado || 0);
        const montoCalculado = montoRentaRaw + montoPolizaRaw;
        pago.monto_total = montoTotalRaw > 0 ? montoTotalRaw : montoCalculado;

        const detalle = detalleMap.get(pago.id);
        if (detalle?.fecha_pago) {
          const rangoInicio = normalizeDateString(detalle.fecha_pago);
          const rangoFin = normalizeDateString(detalle.fecha_pago_fin || detalle.fecha_pago);
          pago.rango_inicio = rangoInicio;
          pago.rango_fin = rangoFin;
          if (rangoInicio || rangoFin) {
            pago.dias_cubiertos = rangoInicio && rangoFin && rangoInicio !== rangoFin
              ? `${rangoInicio} a ${rangoFin}`
              : (rangoInicio || rangoFin);
          }
        }
      });
    }
    
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
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN COALESCE(monto_total, COALESCE(monto_renta_pagado, 0) + COALESCE(monto_poliza_pagado, 0)) ELSE 0 END) as total_pagado"),
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN monto_renta_pagado ELSE 0 END) as total_renta_pagada"),
        db.raw("SUM(CASE WHEN status = 'Confirmado' THEN monto_poliza_pagado ELSE 0 END) as total_poliza_acumulada")
      );
    
    res.json({
      success: true,
      conductor: {
        id: conductor.id,
        nombre: conductor.nombre_conductor,
        tipo_poliza: conductor.tipo_poliza || 'POLIZA_100',
        saldo_poliza_actual: parseFloat(conductor.poliza_mecanica || 0),
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

    const montoRentaNuevo = monto_renta_pagado !== undefined
      ? Number.parseFloat(monto_renta_pagado)
      : Number.parseFloat(pago.monto_renta_pagado);
    const montoPolizaNuevo = monto_poliza_pagado !== undefined
      ? Number.parseFloat(monto_poliza_pagado)
      : Number.parseFloat(pago.monto_poliza_pagado);

    if (!Number.isFinite(montoRentaNuevo) || !Number.isFinite(montoPolizaNuevo)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Los montos enviados no son validos'
      });
    }

    if (montoRentaNuevo < 0 || montoPolizaNuevo < 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'No se permiten montos negativos'
      });
    }

    const monto_total = montoRentaNuevo + montoPolizaNuevo;

    const [pagoActualizado] = await trx('pagos_diarios')
      .where('id', id)
      .update({
        monto_renta_pagado: montoRentaNuevo,
        monto_poliza_pagado: montoPolizaNuevo,
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

// ========== AJUSTAR PAGO CONFIRMADO (SOLO MONTO RENTA) ==========
exports.editarPagoConfirmado = async (req, res) => {
  const trx = await db.transaction();

  try {
    const { id } = req.params;
    const { monto_renta_pagado, motivo_ajuste } = req.body;
    const usuarioActual = req.user || {};
    const rolesPermitidos = ['super_admin', 'direccion', 'finanzas'];

    if (!rolesPermitidos.includes(String(usuarioActual.rol || ''))) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ajustar pagos confirmados'
      });
    }

    const montoRentaNuevoRaw = Number.parseFloat(monto_renta_pagado);
    if (!Number.isFinite(montoRentaNuevoRaw)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El monto de renta no es valido'
      });
    }

    if (montoRentaNuevoRaw < 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'No se permiten montos negativos'
      });
    }
    const montoRentaNuevo = toMoney(montoRentaNuevoRaw);
    const motivoAjusteNormalizado = String(motivo_ajuste || '').trim();
    const motivoAjusteTexto = motivoAjusteNormalizado || 'Sin motivo';

    await auditService.setUserContext(trx, req.user);

    const pago = await trx('pagos_diarios')
      .where('id', id)
      .forUpdate()
      .first();

    if (!pago) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }

    const statusPagoNormalizado = String(pago.status || '').trim().toLowerCase();
    if (!['confirmado', 'pagada'].includes(statusPagoNormalizado)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden ajustar pagos en estado Confirmado o Pagada'
      });
    }

    const asignacionIdPago = toPositiveIntOrNull(pago.asignacion_id);
    if (!asignacionIdPago) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El pago no tiene asignacion valida para recalcular saldos'
      });
    }

    const pagoPendienteMismaAsignacion = await trx('pagos_diarios')
      .where('asignacion_id', asignacionIdPago)
      .whereNot('id', id)
      .whereRaw("LOWER(TRIM(COALESCE(status, ''))) = 'pendiente'")
      .first();

    if (pagoPendienteMismaAsignacion) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'No puedes ajustar este pago mientras existan pagos Pendientes en la misma asignacion'
      });
    }

    const asignacion = await trx('asignaciones')
      .where('id', asignacionIdPago)
      .first();

    if (!asignacion) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Asignacion no encontrada para este pago'
      });
    }

    const vehiculo = await trx('vehiculos')
      .where('id', asignacion.vehiculo_id)
      .forUpdate()
      .first();

    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Vehiculo no encontrado para la asignacion'
      });
    }

    const rentaAnterior = toMoney(pago.monto_renta_pagado);
    const polizaActual = toMoney(pago.monto_poliza_pagado);
    const totalAnterior = toMoney(pago.monto_total || (rentaAnterior + polizaActual));

    const deltaRenta = montoRentaNuevo - rentaAnterior;
    const montoTotalNuevo = montoRentaNuevo + polizaActual;
    const deltaTotal = montoTotalNuevo - totalAnterior;

    if (deltaRenta === 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'No hay cambios en el monto de renta'
      });
    }

    const notaAjuste = `\n[AJUSTE_CONFIRMADO ${new Date().toISOString()}] Renta: ${rentaAnterior} -> ${montoRentaNuevo}. Delta: ${deltaRenta}. Motivo: ${motivoAjusteTexto}`;
    const observacionesActualizadas = `${pago.observaciones || ''}${notaAjuste}`.trim();

    const [pagoActualizado] = await trx('pagos_diarios')
      .where('id', id)
      .update({
        monto_renta_pagado: Number(montoRentaNuevo.toFixed(2)),
        monto_total: Number(montoTotalNuevo.toFixed(2)),
        observaciones: observacionesActualizadas,
        updated_at: new Date()
      })
      .returning('*');

    // Regla operativa solicitada: aplicar SOLO la diferencia del ajuste
    // (ej. 500 -> 850 => +350 en total_pagado_corrida).
    const totalCorrida = toMoney(vehiculo.total_corrida);
    const totalPagadoActual = toMoney(vehiculo.total_pagado_corrida);
    const totalPagadoPorDelta = totalPagadoActual + deltaRenta;
    if (totalPagadoPorDelta < 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El ajuste dejaría total_pagado_corrida en negativo'
      });
    }

    const nuevoSaldoPendiente = Math.max(0, totalCorrida - totalPagadoPorDelta);
    const nuevoPorcentaje = totalCorrida > 0 ? (totalPagadoPorDelta / totalCorrida) * 100 : 0;

    const updateVehiculoPayload = {
      total_pagado_corrida: Number(totalPagadoPorDelta.toFixed(2)),
      saldo_pendiente_corrida: Number(nuevoSaldoPendiente.toFixed(2)),
      porcentaje_pagado: Number(nuevoPorcentaje.toFixed(2)),
      updated_at: new Date()
    };

    const filasVehiculoActualizadas = await trx('vehiculos')
      .where('id', vehiculo.id)
      .update(updateVehiculoPayload);

    if (!filasVehiculoActualizadas) {
      await trx.rollback();
      return res.status(500).json({
        success: false,
        error: 'No se pudo actualizar el vehiculo asociado al pago'
      });
    }

    await auditService.logCriticalChange({
      usuario_id: req.user?.id,
      tipo_cambio: 'ajuste_pago_confirmado_renta',
      descripcion: `Ajuste de pago confirmado #${id}. Delta renta: ${deltaRenta >= 0 ? '+' : ''}$${deltaRenta.toFixed(2)}.`,
      datos_sensibles: {
        pago_id: id,
        asignacion_id: asignacionIdPago,
        vehiculo_id: vehiculo.id,
        renta_anterior: rentaAnterior,
        renta_nueva: montoRentaNuevo,
        delta_renta: Number(deltaRenta.toFixed(2)),
        poliza_conservada: polizaActual,
        total_anterior: totalAnterior,
        total_nuevo: Number(montoTotalNuevo.toFixed(2)),
        delta_total: Number(deltaTotal.toFixed(2)),
        motivo_ajuste: motivoAjusteTexto
      },
      ip_address: auditService.getClientIp(req),
      requiere_revision: true
    });

    const vehiculoPost = await trx('vehiculos')
      .where('id', vehiculo.id)
      .first();

    const totalPagadoPersistido = toMoney(vehiculoPost?.total_pagado_corrida);
    const saldoPersistido = toMoney(vehiculoPost?.saldo_pendiente_corrida);
    const porcentajePersistido = toMoney(vehiculoPost?.porcentaje_pagado);

    const totalEsperado = Number(totalPagadoPorDelta.toFixed(2));
    const saldoEsperado = Number(nuevoSaldoPendiente.toFixed(2));
    const porcentajeEsperado = Number(nuevoPorcentaje.toFixed(2));

    // Verificacion estricta: si el vehiculo no queda persistido con los calculos esperados,
    // se revierte toda la operacion para evitar inconsistencias silenciosas.
    const tolerancia = 0.009;
    const difTotal = Math.abs(totalPagadoPersistido - totalEsperado);
    const difSaldo = Math.abs(saldoPersistido - saldoEsperado);
    const difPorcentaje = Math.abs(porcentajePersistido - porcentajeEsperado);
    if (difTotal > tolerancia || difSaldo > tolerancia || difPorcentaje > tolerancia) {
      await trx.rollback();
      return res.status(500).json({
        success: false,
        error: 'No se pudo persistir de forma consistente la corrida del vehiculo'
      });
    }

    const totalPagadoPost = Number(
      toMoney(
        vehiculoPost?.total_pagado_corrida ??
        totalPagadoPorDelta
      ).toFixed(2)
    );

    await trx.commit();

    res.json({
      success: true,
      message: 'Pago confirmado ajustado correctamente',
      pago: pagoActualizado,
      impacto: {
        delta_renta: Number(deltaRenta.toFixed(2)),
        delta_total: Number(deltaTotal.toFixed(2)),
        vehiculo: {
          id: vehiculoPost?.id || vehiculo.id,
          total_pagado_corrida: totalPagadoPost,
          saldo_pendiente_corrida: Number(vehiculoPost?.saldo_pendiente_corrida ?? nuevoSaldoPendiente.toFixed(2)),
          porcentaje_pagado: Number(vehiculoPost?.porcentaje_pagado ?? nuevoPorcentaje.toFixed(2))
        }
      }
    });
  } catch (error) {
    await trx.rollback();

    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error ajustando pago confirmado: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Error al ajustar pago confirmado'
    });
  }
};

// ========== ELIMINAR PAGO DE RENTA ==========
exports.eliminarPago = async (req, res) => {
  const { id } = req.params;
  const motivoBaja = req.body.motivoBaja || req.body.motivo; 
  const { rol } = req.user;
  const rolesSupremos = ['super_admin', 'direccion', 'finanzas']; 

  try {
    console.log(`🗑️ Procesando eliminación ID: ${id}. Rol: ${rol}. Motivo: ${motivoBaja || 'Sin motivo'}`);

    // =====================================================================
    // 🕵️ CASO A: GERENTE DE OPERACIONES (MODO SOLICITUD)
    // =====================================================================
    if (rol === 'gerente_ops') {
      if (!motivoBaja || motivoBaja.trim().length < 5) {
        return res.status(400).json({ 
          success: false, 
          message: '⚠️ Es obligatorio escribir un motivo detallado.' 
        });
      }

    const pagoActual = await db('pagos_diarios').where('id', id).select('observaciones').first();
      
      // 2. Fecha legible y blindada a la hora de México
      const opcionesFecha = { 
          timeZone: 'America/Mexico_City', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
      };
      const fechaHoy = new Date().toLocaleDateString('es-MX', opcionesFecha);
      
      // 3. Armamos el texto con el salto de línea (\n) al principio
      const textoSolicitud = `\n[Solicitud Baja: ${motivoBaja} - Solicitado el ${fechaHoy}]`;

      // 4. Concatenamos inteligentemente
      const observacionesViejas = pagoActual?.observaciones ? pagoActual.observaciones.trim() : '';
      
      const nuevasObservaciones = observacionesViejas 
          ? `${observacionesViejas}${textoSolicitud}` 
          : textoSolicitud.trim();

      await db('pagos_diarios')
        .where('id', id)
        .update({
          status: 'Solicitud_borrado',
          observaciones: nuevasObservaciones,
          updated_at: new Date()
        });

      return res.json({ 
        success: true, 
        message: '📩 Solicitud enviada a aprobación.' 
      });
    }

    // =====================================================================
    // 🦸‍♂️ CASO B: ADMIN/DIRECCIÓN (MODO EJECUCIÓN REAL)
    // =====================================================================
    if (rolesSupremos.includes(rol)) {

      let pagoEliminado = null;

      await db.transaction(async (trx) => {
        // 1. BUSCAR DATOS
        const pago = await trx('pagos_diarios as p')
          .leftJoin('asignaciones as a', 'p.asignacion_id', 'a.id')
          .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
          .where('p.id', id)
          .select(
            'p.*',
            'a.vehiculo_id as asignacion_vehiculo_id',
            'v.id as vehiculo_id_db',
            'v.total_pagado_corrida',
            'v.total_corrida',
            'v.saldo_pendiente_corrida',
            'v.poliza_mecanica'
          )
          .first();

        if (!pago) throw new Error('El pago no existe o ya fue eliminado.');

        const statusConDinero = ['Confirmado', 'Pagada', 'Solicitud_borrado'];
        const esOrigenRechazado = pago.status === 'Solicitud_borrado' && 
                                  (pago.observaciones || '').includes('RECHAZADO:');

          console.log('🧾 Snapshot eliminarPago:', {
          pago_id: pago.id,
          status: pago.status,
          asignacion_id: pago.asignacion_id,
          vehiculo_id_pago: pago.vehiculo_id,
          vehiculo_id_asignacion: pago.asignacion_vehiculo_id,
          vehiculo_id_db: pago.vehiculo_id_db,
          monto_total: pago.monto_total,
          total_pagado_corrida: pago.total_pagado_corrida,
          total_corrida: pago.total_corrida
        });

        if (statusConDinero.includes(pago.status) && !esOrigenRechazado) {
          
          // --- A. VALIDACIONES DE INTEGRIDAD ---
          
          // A1. Candado de Pendientes
          const tienePendientes = await trx('pagos_diarios')
            .where('asignacion_id', pago.asignacion_id)
            .where('status', 'Pendiente')
            .first();

          if (tienePendientes) {
             const fechaPendiente = new Date(tienePendientes.fecha_pago).toLocaleDateString('es-MX');
             throw new Error(`⛔ BLOQUEO: Existen solicitudes PENDIENTES (ej. ${fechaPendiente}). Resuélvelas primero.`);
          }

          // A2. Freno de Mano (LIFO)
          const ultimoConfirmado = await trx('pagos_diarios')
            .where('asignacion_id', pago.asignacion_id)
            .whereIn('status', statusConDinero)
            .andWhere(function() {
                this.where('fecha_pago', '>', pago.fecha_pago)
            })
            .first();

          if (ultimoConfirmado) {
             const fechaConflicto = new Date(ultimoConfirmado.fecha_pago).toLocaleDateString('es-MX');
             throw new Error(`⛔ ORDEN INCORRECTO: Existe un pago POSTERIOR confirmado (${fechaConflicto}). Elimina en orden inverso.`);
          }

          // --- B. REVERSIÓN DE SALDOS (BLINDAJE EXTREMO) 🛡️ ---

          const vehiculoIdLimpio =
            toPositiveIntOrNull(pago.vehiculo_id_db) ??
            toPositiveIntOrNull(pago.asignacion_vehiculo_id) ??
            toPositiveIntOrNull(pago.vehiculo_id);

          if (!vehiculoIdLimpio) {
             console.warn('⚠️ ALERTA: vehiculo_id inválido para reversión en eliminarPago', {
               pago_id: id,
               vehiculo_id_pago: pago.vehiculo_id,
               vehiculo_id_asignacion: pago.asignacion_vehiculo_id,
               vehiculo_id_db: pago.vehiculo_id_db
             });
          } else {
             // 🛠️ HELPER NUCLEAR: Limpia basura, símbolos ($) y fuerza Número
             const cleanNumber = (val) => {
                if (val === null || val === undefined || val === '') return 0;
                // Convertimos a string, quitamos todo lo que NO sea número, punto o guión
                const strLimpio = String(val).replace(/[^0-9.-]/g, '');
                const num = parseFloat(strLimpio);
                return isFinite(num) ? num : 0;
             };

             // 1. Obtenemos valores ultra limpios (SEPARADOS)
             const rentaAEliminar = cleanNumber(pago.monto_renta_pagado); 
             const polizaAEliminar = cleanNumber(pago.monto_poliza_pagado);
             
             const pagadoActual = cleanNumber(pago.total_pagado_corrida);
             const totalCorrida = cleanNumber(pago.total_corrida);
             const fondoPolizaActual = cleanNumber(pago.poliza_mecanica); // 👈 El fondo actual del carro

             // 2. Operaciones Matemáticas (Reversa Separada)
             // A. Reversa de la Deuda
             let nuevoTotalPagado = pagadoActual - rentaAEliminar;
             if (nuevoTotalPagado < 0) nuevoTotalPagado = 0;

             let nuevoSaldoPendiente = totalCorrida - nuevoTotalPagado;
             if (nuevoSaldoPendiente < 0) nuevoSaldoPendiente = 0;
             
             let nuevoPorcentaje = 0;
             if (totalCorrida > 0) {
                nuevoPorcentaje = (nuevoTotalPagado / totalCorrida) * 100;
             }

             // B. Reversa del Fondo de Póliza
             let nuevoFondoPoliza = fondoPolizaActual - polizaAEliminar;
             if (nuevoFondoPoliza < 0) nuevoFondoPoliza = 0;

             // 3. Objeto Final (Garantizando Numbers puros)
             const datosUpdate = {
                 total_pagado_corrida: Number(nuevoTotalPagado.toFixed(2)),
                 saldo_pendiente_corrida: Number(nuevoSaldoPendiente.toFixed(2)),
                 porcentaje_pagado: Number(nuevoPorcentaje.toFixed(2)),
                 poliza_mecanica: Number(nuevoFondoPoliza.toFixed(2)), // 👈 ¡Actualizamos el fondo!
                 updated_at: new Date()
             };

             console.log('📉 Datos BLINDADOS para Update:', datosUpdate);

             // 4. Update con trazabilidad SQL detallada
             const updateVehiculoQuery = trx('vehiculos')
               .where('id', vehiculoIdLimpio)
               .update(datosUpdate);

                            const debugSql = updateVehiculoQuery.clone().toSQL();
             console.log('🧠 SQL Update Vehículo (eliminarPago):', {
               sql: debugSql.sql,
               bindings: debugSql.bindings,
               bindingTypes: (debugSql.bindings || []).map((value) => typeof value)
             });

             try {
               await updateVehiculoQuery;
             } catch (sqlError) {
               console.error('❌ Error SQL al actualizar vehículo en eliminarPago', {
                 vehiculoIdLimpio,
                 datosUpdate,
                 code: sqlError.code,
                 detail: sqlError.detail,
                 where: sqlError.where,
                 routine: sqlError.routine
               });
               throw sqlError;
             }
          }
        }

        // 3. BORRADO LÓGICO
      let notaEliminacion = '';
        
        // 1. Configuramos el formato elegante y blindamos la zona horaria del servidor
        const opcionesFecha = { 
            timeZone: 'America/Mexico_City', // 🛡️ Asegura que siempre sea la hora de México, sin importar dónde esté el servidor
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        };
        const fechaBorrado = new Date().toLocaleDateString('es-MX', opcionesFecha);

        // 2. Armamos la nota
        if (motivoBaja) {
            notaEliminacion = `\n[Eliminado por: ${motivoBaja} el ${fechaBorrado}]`;
        } else if (pago.status === 'Solicitud_borrado') {
            notaEliminacion = `\n[✅ Solicitud de Baja Aprobada el ${fechaBorrado}]`;
        } else {
            notaEliminacion = `\n[Eliminado sin motivo el ${fechaBorrado}]`;
        }

        const nuevasObservaciones = (pago.observaciones || '') + notaEliminacion;

        await trx('pagos_diarios')
          .where('id', id)
          .update({
            status: 'Eliminado',
            observaciones: nuevasObservaciones,
            updated_at: new Date()
          });

        pagoEliminado = { ...pago, status: 'Eliminado' };
      });

      return res.json({ 
        success: true, 
        message: '✅ Pago eliminado y saldos revertidos correctamente.',
        data: pagoEliminado
      });
    }

    return res.status(403).json({ success: false, message: '⛔ Sin permisos.' });

  } catch (error) {
    console.error('❌ Error en eliminarPago:', error.message);
        if (error.detail) {
      console.error('📌 Detalle SQL:', error.detail);
    }
    const statusCode = error.message.includes('No puedes eliminar') || error.message.includes('BLOQUEO') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
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
      .whereIn('pagos_diarios.status', ['Pendiente', 'Solicitud_borrado'])
      .select('pagos_diarios.id', 'pagos_diarios.fecha_pago', 'pagos_diarios.monto_total')
      .first();

    if (pagoPendiente) {
      return res.json({ 
        existe: true, 
        pago: pagoPendiente
      });
    }

    return res.json({ existe: false });

  } catch (error) {
    console.error('Error verificando pendientes:', error);
    res.status(500).json({ error: 'Error al verificar pagos pendientes' });
  }
};

// ========== CAMBIAR STATUS DE PAGO A 'CONFIRMADO' Y LIMPIAR OBSERVACIONES ==========
exports.cambiarStatus = async (req, res) => {
  const { id } = req.params;
  const { status, motivo } = req.body; // status será 'Confirmado'

  try {
    console.log(`🔄 Restaurando pago ${id} a ${status}`);

    // 1. Buscamos el pago actual para obtener sus observaciones sucias
    const pago = await db('pagos_diarios').where('id', id).first();
    
    if (!pago) {
        return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    }

    let observacionesLimpias = pago.observaciones || '';

    // 2. Lógica de Limpieza 🧼
    // El texto que agregó el gerente empieza con " | [Solicitud Baja:" o "[Solicitud Baja:"
    const separador = " | [Solicitud Baja:";
    const separadorInicio = "[Solicitud Baja:";

    if (observacionesLimpias.includes(separador)) {
        // Cortamos el string justo donde empieza la solicitud
        observacionesLimpias = observacionesLimpias.split(separador)[0];
    } 
    else if (observacionesLimpias.startsWith(separadorInicio)) {
        // Si era la única observación, lo dejamos vacío
        observacionesLimpias = ""; 
    }

    // 3. Preparamos la nota del Admin (Opcional: Si quieres que quede registro del rechazo)
    // Si NO quieres que quede rastro de nada, deja notaAdmin vacío: const notaAdmin = '';
    const notaAdmin = motivo 

    // 4. Concatenamos: Observaciones Originales + Nota del Admin
    // Si estaba vacío, quitamos el separador inicial " | " para que se vea bien
    let observacionesFinales = observacionesLimpias 
        ? `${observacionesLimpias}${notaAdmin}`
        : notaAdmin.startsWith(' | ') ? notaAdmin.substring(3) : notaAdmin;

    // 5. Guardamos en BD
    await db('pagos_diarios')
      .where('id', id)
      .update({
        status: status,
        observaciones: observacionesFinales, // 👈 Texto limpio y corregido
        updated_at: db.fn.now()
      });

    res.json({ success: true, message: '✅ Solicitud rechazada. Observaciones restauradas.' });

  } catch (error) {
    console.error('Error al cambiar status:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el estado.' });
  }
};

// ========== OBTENER REPORTE DE REZAGO (MISMA LOGICA DEL INDICADOR) ==========
exports.obtenerReporteRezago = async (req, res) => {
  try {
    const query = `
      WITH pagos_confirmados AS (
        SELECT
          asignacion_id,
          MAX(COALESCE(fecha_pago_fin, fecha_pago))::date as ultimo_pago
        FROM pagos_diarios
        WHERE status IN ('Confirmado', 'Pagada')
        GROUP BY asignacion_id
      )
      SELECT
        a.id AS id_asignacion,
        c.id AS conductor_id,
        c.nombre_conductor AS conductor_nombre,
        v.numero_vehiculo AS vehiculo_placa,
        (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) AS monto_renta,
        COALESCE(p.ultimo_pago::date, NULL) AS ultimo_fecha_pago_fin,
        COALESCE(dias.dias_adeudados, 0) AS dias_rezago,
        COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) AS monto_adeudado
      FROM asignaciones a
      INNER JOIN conductores c ON c.id = a.conductor_id
      INNER JOIN vehiculos v ON v.id = a.vehiculo_id
      LEFT JOIN pagos_confirmados p ON p.asignacion_id = a.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as dias_adeudados
        FROM generate_series(
          GREATEST(
            COALESCE(p.ultimo_pago::date, a.fecha_inicio::date - 1) + 1,
            DATE '2026-01-01'
          ),
          (NOW() AT TIME ZONE 'America/Mazatlan')::date,
          interval '1 day'
        ) as d(fecha)
        WHERE EXTRACT(DOW FROM d.fecha) <> 0
      ) dias ON true
      WHERE a.activa = true
        AND COALESCE(dias.dias_adeudados, 0)
          * (a.renta_diaria + COALESCE(a.abono_poliza_mantenimiento, 0)) > 0
      ORDER BY monto_adeudado DESC, dias_rezago DESC, c.nombre_conductor ASC
    `;

    const result = await db.raw(query);
    const reporte = result.rows.map((row) => ({
      id_asignacion: parseInt(row.id_asignacion, 10),
      conductor_id: parseInt(row.conductor_id, 10),
      conductor_nombre: row.conductor_nombre,
      vehiculo_placa: row.vehiculo_placa,
      monto_renta: parseFloat(row.monto_renta || 0),
      ultimo_fecha_pago_fin: row.ultimo_fecha_pago_fin,
      dias_rezago: parseInt(row.dias_rezago || 0, 10),
      monto_adeudado: parseFloat(row.monto_adeudado || 0)
    }));

    res.status(200).json(reporte);
  } catch (error) {
    console.error('Error al obtener reporte de rezago:', error);
    res.status(500).json({ message: 'Error al obtener los datos de rezago' });
  }
};

module.exports = exports;

