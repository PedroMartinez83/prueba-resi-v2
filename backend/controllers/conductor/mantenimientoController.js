// backend/controllers/conductor/mantenimientoController.js
const { db } = require('../../config/database');
const { resolveConductorId } = require('./conductorContextHelper');
const {
  getMaintenancePlanContext,
  getSiguienteServicioKm,
  buildRecordatorioRegistroKm,
  buildPreventivoAlertas
} = require('../../utils/mantenimientoPreventivo');
const { SERVICIOS_ESPECIALES_OPCIONES } = require('../../utils/mantenimientoCatalogo');
const {
  buildSolicitudMeta,
  appendMetaToObservaciones,
  enrichMantenimientoWithMeta,
  getSolicitudCatalogo
} = require('../../utils/mantenimientoSolicitudMeta');
const {
  findActiveDuplicateByVehiculoServicio
} = require('../../utils/mantenimientoDuplicados');
const {
  SLOT_MINUTES,
  SLOT_MS,
  isEstadoActivoAgenda,
  parseDateTime,
  getDayBounds,
  formatHHmm,
  buildHalfHourSlots,
  findConflictingMantenimiento
} = require('../../utils/mantenimientoAgenda');

const TIPOS_SERVICIO_BASE = [
  'Cambio de aceite',
  'Alineacion y balanceo',
  'Revision general',
  'Cambio de llantas',
  'Frenos',
  'Suspension',
  'Verificacion vehicular',
  'Limpieza profunda',
  'Reparacion mecanica',
  'Reparacion electrica',
  'Hojalateria y pintura',
  'Transmision',
  'Sistema de enfriamiento',
  'Bateria y sistema electrico',
  'Otros'
];

const sanitizeText = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, 300);

const LEGACY_VARCHAR_LIMIT = 255;
const truncateForLegacyVarchar = (value, limit = LEGACY_VARCHAR_LIMIT) => {
  const text = String(value ?? '');
  if (text.length <= limit) return text;
  return text.slice(0, limit);
};

const CONDUCTOR_AGENDA_START_HOUR = 8;
const CONDUCTOR_AGENDA_END_HOUR = 15;
const CONDUCTOR_ALLOWED_SLOTS = new Set(
  buildHalfHourSlots({
    startHour: CONDUCTOR_AGENDA_START_HOUR,
    endHour: CONDUCTOR_AGENDA_END_HOUR,
    includeEndHalf: false
  })
);

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'si', 'yes', 'on'].includes(normalized);
  }
  return false;
};

let confirmacionEntregaTableInitialized = false;

const sanitizeComentario = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 500);

const ensureConfirmacionEntregaTable = async (dbClient) => {
  if (confirmacionEntregaTableInitialized) return;

  await dbClient.raw(`
    CREATE TABLE IF NOT EXISTS confirmaciones_entrega_mantenimiento (
      id SERIAL PRIMARY KEY,
      mantenimiento_id INTEGER NOT NULL UNIQUE REFERENCES mantenimientos(id) ON DELETE CASCADE,
      conductor_id INTEGER NOT NULL REFERENCES conductores(id) ON DELETE CASCADE,
      visto_bueno_entrega BOOLEAN NOT NULL DEFAULT false,
      satisfecho BOOLEAN NOT NULL DEFAULT false,
      calificacion SMALLINT NULL,
      comentarios TEXT NULL,
      fecha_confirmacion TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT chk_confirmacion_calificacion
        CHECK (calificacion IS NULL OR (calificacion >= 1 AND calificacion <= 5))
    )
  `);

  await dbClient.raw(`
    CREATE INDEX IF NOT EXISTS idx_confirmacion_entrega_conductor_fecha
    ON confirmaciones_entrega_mantenimiento (conductor_id, fecha_confirmacion DESC)
  `);

  await dbClient.raw(`
    CREATE INDEX IF NOT EXISTS idx_confirmacion_entrega_mantenimiento_id
    ON confirmaciones_entrega_mantenimiento (mantenimiento_id)
  `);

  confirmacionEntregaTableInitialized = true;
};

// =====================================================
// OBTENER MIS MANTENIMIENTOS
// =====================================================
const getMisMantenimientos = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const limit = parseInt(req.query.limit) || 50;

    // Obtener vehículo asignado
    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.json({
        success: true,
        message: 'No tienes vehículo asignado',
        mantenimientos: []
      });
    }

    // Obtener mantenimientos del vehículo con contexto de cobertura de gasto
    await ensureConfirmacionEntregaTable(db);

    const mantenimientosRaw = await db('mantenimientos as m')
      .leftJoin('distribucion_gastos_mantenimiento as d', 'm.id', 'd.mantenimiento_id')
      .leftJoin('confirmaciones_entrega_mantenimiento as ce', 'm.id', 'ce.mantenimiento_id')
      .where('m.vehiculo_id', asignacion.vehiculo_id)
      .orderBy('m.created_at', 'desc')
      .limit(limit)
      .select(
        'm.*',
        'd.pagado_fondo_mantenimiento',
        'd.pagado_poliza',
        'd.pagado_empresa',
        'd.pagado_conductor',
        'd.fecha_distribucion',
        'd.estado as estado_distribucion_gasto',
        'ce.id as confirmacion_entrega_id',
        'ce.visto_bueno_entrega',
        'ce.satisfecho',
        'ce.calificacion as calificacion_satisfaccion',
        'ce.comentarios as comentarios_confirmacion_entrega',
        'ce.fecha_confirmacion as fecha_confirmacion_entrega'
      );

    const mantenimientos = mantenimientosRaw.map((item) =>
      enrichMantenimientoWithMeta({
        ...item,
        costo_total: Number(item.costo_total || 0),
        pagado_fondo_mantenimiento: Number(item.pagado_fondo_mantenimiento || 0),
        pagado_poliza: Number(item.pagado_poliza || 0),
        pagado_empresa: Number(item.pagado_empresa || 0),
        pagado_conductor: Number(item.pagado_conductor || 0),
        confirmacion_entrega: {
          confirmada: Boolean(item.confirmacion_entrega_id),
          visto_bueno_entrega: item.confirmacion_entrega_id ? toBoolean(item.visto_bueno_entrega) : false,
          satisfecho: item.confirmacion_entrega_id ? toBoolean(item.satisfecho) : null,
          calificacion: item.calificacion_satisfaccion != null ? Number(item.calificacion_satisfaccion) : null,
          comentarios: item.comentarios_confirmacion_entrega || null,
          fecha_confirmacion: item.fecha_confirmacion_entrega || null
        }
      })
    );

    res.json({
      success: true,
      total: mantenimientos.length,
      mantenimientos
    });

  } catch (error) {
    console.error('Error en getMisMantenimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mantenimientos',
      error: error.message
    });
  }
};

// =====================================================
// RESUMEN FINANCIERO DE MANTENIMIENTOS (CONDUCTOR)
// =====================================================
const getResumenFinancieroMantenimientos = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }

    const conductor = await db('conductores')
      .select('id', 'nombre_conductor', 'saldo_ahorro_mantenimiento', 'saldo_poliza_mecanica')
      .where({ id: conductorId })
      .first();

    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!conductor || !asignacion) {
      const saldoPolizaActual = Number(conductor?.saldo_poliza_mecanica || 0);
      const saldoFondoActual = Number(conductor?.saldo_ahorro_mantenimiento || 0);
      return res.json({
        success: true,
        resumen_financiero: {
          total_mantenimientos_completados: 0,
          total_costo_mantenimientos: 0,
          total_cubierto_poliza: 0,
          total_cubierto_empresa: 0,
          total_cubierto_fondo: 0,
          total_cargo_conductor: 0,
          saldo_poliza: {
            anterior: saldoPolizaActual,
            actual: saldoPolizaActual
          },
          saldo_fondo: {
            anterior: saldoFondoActual,
            actual: saldoFondoActual
          },
          monto_disponible_total: Math.max(saldoPolizaActual, 0) + Math.max(saldoFondoActual, 0),
          ultimo_movimiento: null
        }
      });
    }

    const resumenRaw = await db('mantenimientos as m')
      .leftJoin('distribucion_gastos_mantenimiento as d', 'm.id', 'd.mantenimiento_id')
      .where('m.vehiculo_id', asignacion.vehiculo_id)
      .where('m.estado', 'Completado')
      .select(
        db.raw('COUNT(m.id) as total_mantenimientos_completados'),
        db.raw('COALESCE(SUM(m.costo_total), 0) as total_costo_mantenimientos'),
        db.raw('COALESCE(SUM(d.pagado_poliza), 0) as total_cubierto_poliza'),
        db.raw('COALESCE(SUM(d.pagado_empresa), 0) as total_cubierto_empresa'),
        db.raw('COALESCE(SUM(d.pagado_fondo_mantenimiento), 0) as total_cubierto_fondo'),
        db.raw('COALESCE(SUM(d.pagado_conductor), 0) as total_cargo_conductor')
      )
      .first();

    const ultimoMovimiento = await db('mantenimientos as m')
      .leftJoin('distribucion_gastos_mantenimiento as d', 'm.id', 'd.mantenimiento_id')
      .where('m.vehiculo_id', asignacion.vehiculo_id)
      .where('m.estado', 'Completado')
      .whereNotNull('d.id')
      .orderBy('d.fecha_distribucion', 'desc')
      .select(
        'm.id',
        'm.folio_servicio',
        'm.tipo_servicio',
        'm.fecha_realizada',
        'd.fecha_distribucion',
        'd.pagado_fondo_mantenimiento',
        'd.pagado_poliza',
        'd.pagado_empresa',
        'd.pagado_conductor',
        'd.estado as estado_distribucion'
      )
      .first();

    const saldoPolizaActual = Number(conductor.saldo_poliza_mecanica || 0);
    const saldoFondoActual = Number(conductor.saldo_ahorro_mantenimiento || 0);
    const descuentoUltimoPoliza = Number(ultimoMovimiento?.pagado_poliza || 0);
    const descuentoUltimoFondo = Number(ultimoMovimiento?.pagado_fondo_mantenimiento || 0);

    const saldoPolizaAnterior = saldoPolizaActual + descuentoUltimoPoliza;
    const saldoFondoAnterior = saldoFondoActual + descuentoUltimoFondo;

    res.json({
      success: true,
      resumen_financiero: {
        total_mantenimientos_completados: Number(resumenRaw?.total_mantenimientos_completados || 0),
        total_costo_mantenimientos: Number(resumenRaw?.total_costo_mantenimientos || 0),
        total_cubierto_poliza: Number(resumenRaw?.total_cubierto_poliza || 0),
        total_cubierto_empresa: Number(resumenRaw?.total_cubierto_empresa || 0),
        total_cubierto_fondo: Number(resumenRaw?.total_cubierto_fondo || 0),
        total_cargo_conductor: Number(resumenRaw?.total_cargo_conductor || 0),
        saldo_poliza: {
          anterior: saldoPolizaAnterior,
          actual: saldoPolizaActual
        },
        saldo_fondo: {
          anterior: saldoFondoAnterior,
          actual: saldoFondoActual
        },
        monto_disponible_total: Math.max(saldoPolizaActual, 0) + Math.max(saldoFondoActual, 0),
        ultimo_movimiento: ultimoMovimiento
          ? {
              id: ultimoMovimiento.id,
              folio_servicio: ultimoMovimiento.folio_servicio,
              tipo_servicio: ultimoMovimiento.tipo_servicio,
              fecha_realizada: ultimoMovimiento.fecha_realizada,
              fecha_distribucion: ultimoMovimiento.fecha_distribucion,
              pagado_fondo_mantenimiento: Number(ultimoMovimiento.pagado_fondo_mantenimiento || 0),
              pagado_poliza: Number(ultimoMovimiento.pagado_poliza || 0),
              pagado_empresa: Number(ultimoMovimiento.pagado_empresa || 0),
              pagado_conductor: Number(ultimoMovimiento.pagado_conductor || 0),
              estado_distribucion: ultimoMovimiento.estado_distribucion || null
            }
          : null
      }
    });
  } catch (error) {
    console.error('Error en getResumenFinancieroMantenimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen financiero de mantenimientos',
      error: error.message
    });
  }
};

// =====================================================
// OBTENER MANTENIMIENTO POR ID
// =====================================================
const getMantenimientoById = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const { id } = req.params;

    // Obtener vehículo asignado
    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({
        success: false,
        message: 'No tienes vehículo asignado'
      });
    }

    await ensureConfirmacionEntregaTable(db);

    // Obtener mantenimiento
    const mantenimiento = await db('mantenimientos as m')
      .leftJoin('confirmaciones_entrega_mantenimiento as ce', 'm.id', 'ce.mantenimiento_id')
      .where({ 'm.id': id, 'm.vehiculo_id': asignacion.vehiculo_id })
      .select(
        'm.*',
        'ce.id as confirmacion_entrega_id',
        'ce.visto_bueno_entrega',
        'ce.satisfecho',
        'ce.calificacion as calificacion_satisfaccion',
        'ce.comentarios as comentarios_confirmacion_entrega',
        'ce.fecha_confirmacion as fecha_confirmacion_entrega'
      )
      .first();

    if (!mantenimiento) {
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    res.json({
      success: true,
      mantenimiento: {
        ...enrichMantenimientoWithMeta(mantenimiento),
        confirmacion_entrega: {
          confirmada: Boolean(mantenimiento.confirmacion_entrega_id),
          visto_bueno_entrega: mantenimiento.confirmacion_entrega_id ? toBoolean(mantenimiento.visto_bueno_entrega) : false,
          satisfecho: mantenimiento.confirmacion_entrega_id ? toBoolean(mantenimiento.satisfecho) : null,
          calificacion: mantenimiento.calificacion_satisfaccion != null ? Number(mantenimiento.calificacion_satisfaccion) : null,
          comentarios: mantenimiento.comentarios_confirmacion_entrega || null,
          fecha_confirmacion: mantenimiento.fecha_confirmacion_entrega || null
        }
      }
    });

  } catch (error) {
    console.error('Error en getMantenimientoById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mantenimiento',
      error: error.message
    });
  }
};

// =====================================================
// CONFIRMAR ENTREGA DE MANTENIMIENTO COMPLETADO
// =====================================================
const confirmarEntregaMantenimiento = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }

    const mantenimientoId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(mantenimientoId) || mantenimientoId <= 0) {
      return res.status(400).json({ success: false, message: 'ID de mantenimiento invalido' });
    }

    const vistoBuenoEntrega = toBoolean(req.body?.visto_bueno_entrega);
    const satisfecho = toBoolean(req.body?.satisfecho);
    const comentarios = sanitizeComentario(req.body?.comentarios);

    const calificacionInput = req.body?.calificacion;
    const calificacion =
      calificacionInput === null || calificacionInput === undefined || calificacionInput === ''
        ? null
        : Number.parseInt(calificacionInput, 10);

    if (!vistoBuenoEntrega) {
      return res.status(400).json({
        success: false,
        message: 'Debes confirmar el visto bueno de entrega para cerrar la validacion'
      });
    }

    if (calificacion !== null && (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5)) {
      return res.status(400).json({
        success: false,
        message: 'La calificacion debe estar entre 1 y 5'
      });
    }

    await ensureConfirmacionEntregaTable(db);

    const mantenimiento = await db('mantenimientos')
      .where({ id: mantenimientoId })
      .select('id', 'vehiculo_id', 'estado', 'folio_servicio', 'tipo_servicio')
      .first();

    if (!mantenimiento) {
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    if (String(mantenimiento.estado || '').trim().toLowerCase() !== 'completado') {
      return res.status(400).json({
        success: false,
        message: 'Solo puedes confirmar entrega en mantenimientos completados'
      });
    }

    const relacionConductor = await db('asignaciones')
      .where({
        conductor_id: conductorId,
        vehiculo_id: mantenimiento.vehiculo_id
      })
      .first();

    if (!relacionConductor) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para confirmar este mantenimiento'
      });
    }

    const payload = {
      visto_bueno_entrega: vistoBuenoEntrega,
      satisfecho,
      calificacion,
      comentarios: comentarios || null,
      fecha_confirmacion: db.fn.now(),
      updated_at: db.fn.now()
    };

    const existente = await db('confirmaciones_entrega_mantenimiento')
      .where({ mantenimiento_id: mantenimientoId })
      .first();

    let confirmacion = null;
    let message = 'Confirmacion de entrega registrada correctamente';

    if (existente) {
      if (Number(existente.conductor_id) !== Number(conductorId)) {
        return res.status(403).json({
          success: false,
          message: 'Este mantenimiento ya fue confirmado por otro conductor'
        });
      }

      const [updated] = await db('confirmaciones_entrega_mantenimiento')
        .where({ mantenimiento_id: mantenimientoId })
        .update(payload)
        .returning('*');

      confirmacion = updated || null;
      message = 'Confirmacion de entrega actualizada correctamente';
    } else {
      const [created] = await db('confirmaciones_entrega_mantenimiento')
        .insert({
          mantenimiento_id: mantenimientoId,
          conductor_id: conductorId,
          ...payload,
          created_at: db.fn.now()
        })
        .returning('*');

      confirmacion = created || null;
    }

    return res.json({
      success: true,
      message,
      confirmacion: confirmacion
        ? {
            id: confirmacion.id,
            mantenimiento_id: confirmacion.mantenimiento_id,
            conductor_id: confirmacion.conductor_id,
            visto_bueno_entrega: toBoolean(confirmacion.visto_bueno_entrega),
            satisfecho: toBoolean(confirmacion.satisfecho),
            calificacion: confirmacion.calificacion != null ? Number(confirmacion.calificacion) : null,
            comentarios: confirmacion.comentarios || null,
            fecha_confirmacion: confirmacion.fecha_confirmacion || null
          }
        : null
    });
  } catch (error) {
    console.error('Error en confirmarEntregaMantenimiento:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al confirmar entrega del mantenimiento',
      error: error.message
    });
  }
};

// =====================================================
// OPCIONES PARA SOLICITAR MANTENIMIENTO (CON CONTEXTO)
// =====================================================
const getOpcionesSolicitud = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }

    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    const solicitudCatalogo = getSolicitudCatalogo();

    if (!asignacion) {
      return res.json({
        success: true,
        opciones: {
          tipos_servicio: TIPOS_SERVICIO_BASE,
          servicios_especiales: SERVICIOS_ESPECIALES_OPCIONES,
          tipos_solicitud: solicitudCatalogo.tipos_solicitud,
          causas_fuera_programacion: solicitudCatalogo.causas_fuera_programacion,
          vehiculo: null,
          sugerencia: null
        }
      });
    }

    const vehiculo = await db('vehiculos')
      .select('id', 'numero_vehiculo', 'marca', 'modelo', 'placa', 'tipo_socio', 'kilometraje_actual', 'proximo_mantenimiento')
      .where({ id: asignacion.vehiculo_id })
      .first();

    if (!vehiculo) {
      return res.json({
        success: true,
        opciones: {
          tipos_servicio: TIPOS_SERVICIO_BASE,
          servicios_especiales: SERVICIOS_ESPECIALES_OPCIONES,
          tipos_solicitud: solicitudCatalogo.tipos_solicitud,
          causas_fuera_programacion: solicitudCatalogo.causas_fuera_programacion,
          vehiculo: null,
          sugerencia: null
        }
      });
    }

    const kmActual = Number(vehiculo.kilometraje_actual || 0);
    const mantenimientoPlan = getMaintenancePlanContext({
      modelo: vehiculo.modelo,
      kilometrajeActual: kmActual
    });

    const sugerencia = mantenimientoPlan?.proximo_servicio
      ? {
          kilometraje_objetivo: Number(mantenimientoPlan.proximo_servicio.kilometraje_objetivo || 0),
          tipo_servicio: mantenimientoPlan.proximo_servicio.tipo_servicio || null,
          servicio_codigo: mantenimientoPlan.proximo_servicio.servicio_codigo || null,
          servicio_nivel: mantenimientoPlan.proximo_servicio.servicio_nivel || null,
          incluye_rotacion: Boolean(mantenimientoPlan.proximo_servicio.incluye_rotacion),
          diferencia_km: Number(mantenimientoPlan.proximo_servicio.diferencia_km || 0),
          estado: mantenimientoPlan.proximo_servicio.estado || 'proximo'
        }
      : null;

    const tiposServicio = [...TIPOS_SERVICIO_BASE];
    if (sugerencia?.tipo_servicio && !tiposServicio.includes(sugerencia.tipo_servicio)) {
      tiposServicio.unshift(sugerencia.tipo_servicio);
    }
    const siguienteServicioKm = getSiguienteServicioKm(kmActual, vehiculo.tipo_socio);
    const alertasPreventivo = buildPreventivoAlertas({
      kilometrajeActual: kmActual,
      siguienteServicioKm,
      tipoSocio: vehiculo.tipo_socio
    });
    const recordatorioRegistroKm = buildRecordatorioRegistroKm();

    res.json({
      success: true,
      opciones: {
        tipos_servicio: tiposServicio,
        servicios_especiales: SERVICIOS_ESPECIALES_OPCIONES,
        tipos_solicitud: solicitudCatalogo.tipos_solicitud,
        causas_fuera_programacion: solicitudCatalogo.causas_fuera_programacion,
        vehiculo: {
          id: vehiculo.id,
          numero_vehiculo: vehiculo.numero_vehiculo,
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          placa: vehiculo.placa,
          tipo_socio: vehiculo.tipo_socio,
          kilometraje_actual: kmActual,
          proximo_mantenimiento: Number(vehiculo.proximo_mantenimiento || 0),
          proximo_servicio_sugerido_km: siguienteServicioKm
        },
        sugerencia,
        alertas_preventivo: alertasPreventivo,
        recordatorio_registro_km: recordatorioRegistroKm
      }
    });
  } catch (error) {
    console.error('Error en getOpcionesSolicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener opciones de mantenimiento',
      error: error.message
    });
  }
};

// =====================================================
// DISPONIBILIDAD DE AGENDA PARA SOLICITUDES
// =====================================================
const getDisponibilidadSolicitud = async (req, res) => {
  try {
    const fecha = String(req.query?.fecha || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar una fecha valida con formato YYYY-MM-DD'
      });
    }

    const fechaCheckDia = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(fechaCheckDia.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Fecha invalida'
      });
    }

    const { start, end } = getDayBounds(fecha);
    const rows = await db('mantenimientos')
      .select('id', 'estado', 'fecha_programada')
      .where('fecha_programada', '>=', start)
      .andWhere('fecha_programada', '<', end);

    const citasActivas = rows.filter((item) => isEstadoActivoAgenda(item.estado));
    const horasOcupadas = citasActivas
      .map((item) => {
        const date = new Date(item.fecha_programada);
        if (Number.isNaN(date.getTime())) return null;
        return {
          id: item.id,
          estado: item.estado,
          hora: formatHHmm(date),
          timestamp: date.getTime()
        };
      })
      .filter(Boolean);

    const slots = Array.from(CONDUCTOR_ALLOWED_SLOTS).map((hora) => {
      const slotDate = parseDateTime(fecha, hora);
      const slotTimestamp = slotDate ? slotDate.getTime() : null;
      const conflicto = slotTimestamp == null
        ? null
        : horasOcupadas.find((ocupada) => Math.abs(ocupada.timestamp - slotTimestamp) < SLOT_MS);

      return {
        hora,
        disponible: !conflicto,
        cita_id: conflicto?.id || null,
        estado: conflicto?.estado || null
      };
    });

    return res.json({
      success: true,
      fecha,
      diferencia_minima_minutos: SLOT_MINUTES,
      slots
    });
  } catch (error) {
    console.error('Error en getDisponibilidadSolicitud:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener disponibilidad de agenda',
      error: error.message
    });
  }
};

// =====================================================
// SOLICITAR MANTENIMIENTO
// =====================================================
const solicitarMantenimiento = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const {
      tipo_servicio,
      descripcion,
      urgente,
      kilometraje_actual,
      fecha_programada,
      hora_programada,
      servicio_especial,
      tipo_solicitud,
      causa_fuera_programacion,
      detalle_fuera_programacion
    } = req.body;

    // Validación
    if (!tipo_servicio || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de servicio y descripción son obligatorios'
      });
    }

    if (!fecha_programada || !hora_programada) {
      return res.status(400).json({
        success: false,
        message: 'Fecha y hora programada son obligatorias'
      });
    }

    const fechaHoraProgramada = parseDateTime(fecha_programada, hora_programada);
    if (!fechaHoraProgramada) {
      return res.status(400).json({
        success: false,
        message: 'Fecha u hora invalida'
      });
    }

    const fechaCheckDia = new Date(`${fecha_programada}T12:00:00`);
    if (Number.isNaN(fechaCheckDia.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Fecha invalida'
      });
    }

    if (fechaCheckDia.getDay() === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se pueden agendar mantenimientos los domingos'
      });
    }

    const horaNormalizada = formatHHmm(fechaHoraProgramada);
    if (!CONDUCTOR_ALLOWED_SLOTS.has(horaNormalizada)) {
      return res.status(400).json({
        success: false,
        message: 'Horario invalido. Para conductor, los horarios disponibles son de 08:00 a 15:00 en bloques de 30 minutos'
      });
    }

    const ahora = new Date();
    if (fechaHoraProgramada <= ahora) {
      return res.status(400).json({
        success: false,
        message: 'La fecha y hora programada deben ser futuras'
      });
    }

    const urgenteFlag = toBoolean(urgente);
    const horasAnticipacion = (fechaHoraProgramada.getTime() - ahora.getTime()) / (1000 * 60 * 60);
    if (!urgenteFlag && horasAnticipacion < 48) {
      return res.status(400).json({
        success: false,
        message: 'La solicitud requiere al menos 48 horas de anticipación (excepto urgencias)',
        horas_requeridas: 48,
        horas_actuales: Number(horasAnticipacion.toFixed(2))
      });
    }

    const conflictoAgenda = await findConflictingMantenimiento({
      dbClient: db,
      fechaHoraProgramada
    });

    if (conflictoAgenda) {
      const conflictDate = new Date(conflictoAgenda.fecha_programada);
      const horaConflicto = Number.isNaN(conflictDate.getTime()) ? null : formatHHmm(conflictDate);
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cita de mantenimiento en ese bloque de 30 minutos',
        diferencia_minima_minutos: SLOT_MINUTES,
        conflicto: {
          cita_id: conflictoAgenda.id,
          folio_servicio: conflictoAgenda.folio_servicio || null,
          estado: conflictoAgenda.estado || null,
          hora: horaConflicto
        }
      });
    }

    // Obtener vehículo asignado
    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({
        success: false,
        message: 'No tienes vehículo asignado'
      });
    }

    // Obtener datos del vehículo
    const vehiculo = await db('vehiculos')
      .where({ id: asignacion.vehiculo_id })
      .first();

    const kilometrajeServicioFinal = kilometraje_actual
      ? parseInt(kilometraje_actual, 10)
      : Number(vehiculo.kilometraje_actual || 0);
    const tipoServicioFinal = String(tipo_servicio || '').trim();
    const duplicadoActivo = await findActiveDuplicateByVehiculoServicio(db, {
      vehiculoId: asignacion.vehiculo_id,
      tipoServicio: tipoServicioFinal
    });

    if (duplicadoActivo) {
      return res.status(409).json({
        success: false,
        message: `Ya existe una solicitud activa del mismo servicio para este vehiculo (${duplicadoActivo.folio_servicio ? `folio #${String(duplicadoActivo.folio_servicio).padStart(4, '0')}` : `id ${duplicadoActivo.id}`})`,
        duplicado: {
          id: duplicadoActivo.id,
          folio_servicio: duplicadoActivo.folio_servicio || null,
          estado: duplicadoActivo.estado || null,
          fecha_programada: duplicadoActivo.fecha_programada || null
        }
      });
    }

    // Generar folio único
    const ultimoFolio = await db('mantenimientos')
      .max('folio_servicio as ultimo')
      .first();

    const nuevoFolio = (ultimoFolio?.ultimo || 0) + 1;

    // Determinar estado inicial
    const estadoInicial = urgenteFlag ? 'Urgente' : 'Pendiente';

    const servicioEspecial = sanitizeText(servicio_especial);
    const solicitudMeta = buildSolicitudMeta({
      tipo_solicitud,
      causa_fuera_programacion,
      detalle_fuera_programacion: detalle_fuera_programacion || servicioEspecial,
      servicio_especial: servicioEspecial
    });

    if (
      solicitudMeta.tipo_solicitud === 'fuera_programacion' &&
      !solicitudMeta.causa_fuera_programacion
    ) {
      return res.status(400).json({
        success: false,
        message: 'Debes indicar la causa cuando la solicitud es fuera de programacion',
        validos: ['falla_mecanica', 'negligencia_conductor', 'siniestro', 'otro']
      });
    }
    const tipoServicioNormalizado = String(tipo_servicio || '').trim().toLowerCase();
    if (['otro', 'otros'].includes(tipoServicioNormalizado) && !servicioEspecial) {
      return res.status(400).json({
        success: false,
        message: 'Si seleccionas "Otros", debes capturar un servicio especial'
      });
    }

    const descripcionLimpia = String(descripcion || '').trim();
    const descripcionIncluyeServicioEspecial = servicioEspecial
      ? descripcionLimpia.toLowerCase().includes(servicioEspecial.toLowerCase())
      : false;

    const observacionesBase = [
      descripcionLimpia,
      servicioEspecial && !descripcionIncluyeServicioEspecial
        ? `Servicio especial solicitado: ${servicioEspecial}`
        : null
    ]
      .filter(Boolean)
      .join('\n\n');
    const observacionesFinales = appendMetaToObservaciones(observacionesBase, solicitudMeta);

    const payloadBase = {
      folio_servicio: nuevoFolio,
      vehiculo_id: asignacion.vehiculo_id,
      tipo_servicio,
      estado: estadoInicial,
      status: 'Todo',
      kilometraje_servicio: kilometrajeServicioFinal,
      fecha_programada: fechaHoraProgramada,
      observaciones: observacionesFinales,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    };

    let nuevoMantenimiento;
    try {
      [nuevoMantenimiento] = await db('mantenimientos')
        .insert(payloadBase)
        .returning('*');
    } catch (insertError) {
      // Compatibilidad defensiva para esquemas legacy en producción
      // donde algunos campos en "mantenimientos" siguen como varchar(255).
      if (insertError?.code !== '22001') throw insertError;

      const payloadCompat = {
        ...payloadBase,
        tipo_servicio: truncateForLegacyVarchar(payloadBase.tipo_servicio),
        estado: truncateForLegacyVarchar(payloadBase.estado),
        status: truncateForLegacyVarchar(payloadBase.status),
        observaciones: truncateForLegacyVarchar(payloadBase.observaciones)
      };

      console.warn(
        '[solicitarMantenimiento] Reintentando insert por compatibilidad varchar(255) en producción',
        {
          folio_servicio: payloadBase.folio_servicio,
          len_tipo_servicio: String(payloadBase.tipo_servicio || '').length,
          len_estado: String(payloadBase.estado || '').length,
          len_status: String(payloadBase.status || '').length,
          len_observaciones: String(payloadBase.observaciones || '').length
        }
      );

      [nuevoMantenimiento] = await db('mantenimientos')
        .insert(payloadCompat)
        .returning('*');
    }

    res.status(201).json({
      success: true,
      message: 'Solicitud de mantenimiento creada correctamente',
      mantenimiento: {
        id: nuevoMantenimiento.id,
        folio_servicio: nuevoMantenimiento.folio_servicio,
        tipo_servicio: nuevoMantenimiento.tipo_servicio,
        tipo_solicitud: solicitudMeta.tipo_solicitud,
        causa_fuera_programacion: solicitudMeta.causa_fuera_programacion,
        estado: nuevoMantenimiento.estado,
        fecha_programada: nuevoMantenimiento.fecha_programada
      }
    });

  } catch (error) {
    console.error('Error en solicitarMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al solicitar mantenimiento',
      error: error.message
    });
  }
};

module.exports = {
  getMisMantenimientos,
  getResumenFinancieroMantenimientos,
  getMantenimientoById,
  confirmarEntregaMantenimiento,
  getOpcionesSolicitud,
  getDisponibilidadSolicitud,
  solicitarMantenimiento
};


