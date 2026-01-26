// backend/controllers/admin/mantenimientosAdminController.js

const { db } = require('../../config/database');
const { schedules } = require('../../utils/mantenimientoPreventivo');

// ============================================
// OBTENER TODOS LOS MANTENIMIENTOS CON FILTROS
// ============================================
exports.getMantenimientos = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      estado,
      tipo_servicio,
      vehiculo_id,
      conductor_id,
      fecha_desde,
      fecha_hasta,
      search
    } = req.query;

    const offset = (page - 1) * limit;

    // Query base
    let query = db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'v.tipo_socio',
        'v.kilometraje_actual as km_actual_vehiculo',
        'c.id as conductor_id',
        'c.nombre_conductor',
        'c.numero_telefono as conductor_telefono',
        'a.renta_diaria',
        db.raw(`
          CASE 
            WHEN m.estado = 'Completado' THEN 'Completado'
            WHEN m.fecha_programada < NOW() AND m.estado != 'Completado' THEN 'Vencido'
            WHEN m.fecha_programada BETWEEN NOW() AND NOW() + INTERVAL '7 days' THEN 'Urgente'
            WHEN m.fecha_programada BETWEEN NOW() + INTERVAL '8 days' AND NOW() + INTERVAL '30 days' THEN 'Próximo'
            ELSE 'Programado'
          END as status_real
        `),
        db.raw('DATE_PART(\'day\', NOW() - m.fecha_realizada) as dias_desde_ultimo_mant'),
        db.raw('(v.kilometraje_actual - m.kilometraje_servicio) as km_desde_ultimo_mant')
      )
      .leftJoin('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id');

    // Aplicar filtros
    if (estado) {
      const normalizedEstado = estado.toLowerCase();

      if (normalizedEstado === 'vencido') {
        query = query.where(function() {
          this.where('m.estado', '!=', 'Completado')
              .andWhere('m.fecha_programada', '<', db.raw('NOW()'));
        });
      } else if (normalizedEstado === 'urgente') {
        query = query.where(function() {
          this.where('m.estado', '!=', 'Completado')
              .andWhereBetween('m.fecha_programada', [
                db.raw('NOW()'),
                db.raw("NOW() + INTERVAL '7 days'")
              ]);
        });
      } else {
        query = query.where('m.estado', estado);
      }
    }

    if (tipo_servicio) {
      query = query.where('m.tipo_servicio', tipo_servicio);
    }

    if (vehiculo_id) {
      query = query.where('m.vehiculo_id', vehiculo_id);
    }

    if (conductor_id) {
      query = query.where('c.id', conductor_id);
    }

    if (fecha_desde) {
      query = query.where('m.fecha_programada', '>=', fecha_desde);
    }

    if (fecha_hasta) {
      query = query.where('m.fecha_programada', '<=', fecha_hasta);
    }

    if (search) {
      query = query.where(function() {
        this.where('v.numero_vehiculo', 'ilike', `%${search}%`)
            .orWhere('c.nombre_conductor', 'ilike', `%${search}%`)
            .orWhere('m.tipo_servicio', 'ilike', `%${search}%`)
            .orWhere('m.taller', 'ilike', `%${search}%`);
      });
    }

    // Contar total (query separado sin los JOINS complejos)
    const totalCountQuery = db('mantenimientos as m')
      .leftJoin('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id');

    // Aplicar los mismos filtros al count
    if (estado) {
      const normalizedEstado = estado.toLowerCase();

      if (normalizedEstado === 'vencido') {
        totalCountQuery.where(function() {
          this.where('m.estado', '!=', 'Completado')
              .andWhere('m.fecha_programada', '<', db.raw('NOW()'));
        });
      } else if (normalizedEstado === 'urgente') {
        totalCountQuery.where(function() {
          this.where('m.estado', '!=', 'Completado')
              .andWhereBetween('m.fecha_programada', [
                db.raw('NOW()'),
                db.raw("NOW() + INTERVAL '7 days'")
              ]);
        });
      } else {
        totalCountQuery.where('m.estado', estado);
      }
    }
    if (tipo_servicio) {
      totalCountQuery.where('m.tipo_servicio', tipo_servicio);
    }
    if (vehiculo_id) {
      totalCountQuery.where('m.vehiculo_id', vehiculo_id);
    }
    if (conductor_id) {
      totalCountQuery.where('c.id', conductor_id);
    }
    if (fecha_desde) {
      totalCountQuery.where('m.fecha_programada', '>=', fecha_desde);
    }
    if (fecha_hasta) {
      totalCountQuery.where('m.fecha_programada', '<=', fecha_hasta);
    }
    if (search) {
      totalCountQuery.where(function() {
        this.where('v.numero_vehiculo', 'ilike', `%${search}%`)
            .orWhere('c.nombre_conductor', 'ilike', `%${search}%`)
            .orWhere('m.tipo_servicio', 'ilike', `%${search}%`)
            .orWhere('m.taller', 'ilike', `%${search}%`);
      });
    }

    const totalResult = await totalCountQuery.count('m.id as count').first();
    const total = parseInt(totalResult.count);

    // Obtener registros paginados
    const mantenimientos = await query
      .orderBy('m.fecha_programada', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      mantenimientos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error en getMantenimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mantenimientos',
      error: error.message
    });
  }
};

// ============================================
// ESTADÍSTICAS PARA DASHBOARD
// ============================================
exports.getEstadisticas = async (req, res) => {
  try {
    // 1. Totales básicos
    const totalesResult = await db('mantenimientos')
      .select(
        db.raw("COUNT(*) FILTER (WHERE estado != 'Completado') as programados"),
        db.raw("COUNT(*) FILTER (WHERE estado = 'Completado' AND DATE_TRUNC('month', fecha_realizada) = DATE_TRUNC('month', CURRENT_DATE)) as completados_mes"),
        db.raw("COUNT(*) FILTER (WHERE fecha_programada < NOW() AND estado != 'Completado') as vencidos"),
        db.raw("COUNT(*) FILTER (WHERE fecha_programada BETWEEN NOW() AND NOW() + INTERVAL '7 days' AND estado != 'Completado') as urgentes"),
        db.raw("COUNT(*) FILTER (WHERE status = 'En progreso') as en_proceso"),
        db.raw("COALESCE(SUM(costo_total) FILTER (WHERE DATE_TRUNC('month', fecha_realizada) = DATE_TRUNC('month', CURRENT_DATE)), 0) as costo_total_mes"),
        db.raw("COALESCE(AVG(costo_total) FILTER (WHERE estado = 'Completado'), 0) as promedio_costo")
      )
      .first();

    // 2. Vehículos que requieren mantenimiento por kilometraje
    const vehiculosPorKmResult = await db('vehiculos as v')
      .select(db.raw('COUNT(*) as total'))
      .leftJoin('mantenimientos as m', function() {
        this.on('v.id', '=', 'm.vehiculo_id')
            .andOn('m.estado', '=', db.raw('?', ['Completado']));
      })
      .whereRaw('v.kilometraje_actual >= (SELECT MAX(proximo_servicio_km) FROM mantenimientos WHERE vehiculo_id = v.id)')
      .first();

    // 3. Costos por tipo de servicio (top 5)
    const costosPorTipo = await db('mantenimientos')
      .select('tipo_servicio')
      .sum('costo_total as total')
      .count('* as cantidad')
      .where('estado', 'Completado')
      .whereNotNull('tipo_servicio')
      .groupBy('tipo_servicio')
      .orderBy('total', 'desc')
      .limit(5);

    // 4. Top 5 vehículos con más gastos
    const topVehiculos = await db('mantenimientos as m')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa'
      )
      .sum('m.costo_total as total_gastado')
      .count('m.id as total_mantenimientos')
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .where('m.estado', 'Completado')
      .groupBy('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa')
      .orderBy('total_gastado', 'desc')
      .limit(10);

    // 5. Costos últimos 6 meses
    const costosUltimosMeses = await db('mantenimientos')
      .select(
        db.raw("TO_CHAR(fecha_realizada, 'Mon') as mes"),
        db.raw("TO_CHAR(fecha_realizada, 'YYYY-MM') as mes_year")
      )
      .sum('costo_total as total')
      .count('* as cantidad')
      .where('estado', 'Completado')
      .whereRaw("fecha_realizada >= NOW() - INTERVAL '6 months'")
      .groupBy('mes_year', 'mes')
      .orderBy('mes_year', 'asc');

    res.json({
      success: true,
      estadisticas: {
        programados: parseInt(totalesResult.programados) || 0,
        completados_mes: parseInt(totalesResult.completados_mes) || 0,
        vencidos: parseInt(totalesResult.vencidos) || 0,
        urgentes: parseInt(totalesResult.urgentes) || 0,
        en_proceso: parseInt(totalesResult.en_proceso) || 0,
        por_kilometraje: parseInt(vehiculosPorKmResult.total) || 0,
        costo_total_mes: parseFloat(totalesResult.costo_total_mes) || 0,
        promedio_costo: parseFloat(totalesResult.promedio_costo) || 0
      },
      costos_por_tipo: costosPorTipo,
      top_vehiculos: topVehiculos,
      costos_mensuales: costosUltimosMeses
    });

  } catch (error) {
    console.error('Error en getEstadisticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

// ============================================
// ALERTAS DE VENCIMIENTOS
// ============================================
exports.getAlertas = async (req, res) => {
  try {
    // Mantenimientos vencidos
    const vencidos = await db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'c.nombre_conductor',
        'c.numero_telefono',
        db.raw('DATE_PART(\'day\', NOW() - m.fecha_programada) as dias_vencido')
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .where('m.fecha_programada', '<', db.raw('NOW()'))
      .whereNot('m.estado', 'Completado')
      .orderBy('m.fecha_programada', 'asc');

    // Próximos 7 días
    const urgentes = await db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'c.nombre_conductor',
        'c.numero_telefono',
        db.raw('DATE_PART(\'day\', m.fecha_programada - NOW()) as dias_restantes')
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .whereBetween('m.fecha_programada', [db.raw('NOW()'), db.raw("NOW() + INTERVAL '7 days'")])
      .whereNot('m.estado', 'Completado')
      .orderBy('m.fecha_programada', 'asc');

    // Próximos 30 días
    const proximos = await db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'c.nombre_conductor',
        db.raw('DATE_PART(\'day\', m.fecha_programada - NOW()) as dias_restantes')
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .whereBetween('m.fecha_programada', [
        db.raw("NOW() + INTERVAL '8 days'"), 
        db.raw("NOW() + INTERVAL '30 days'")
      ])
      .whereNot('m.estado', 'Completado')
      .orderBy('m.fecha_programada', 'asc')
      .limit(20);

    // Vehículos que requieren por kilometraje
    const porKilometraje = await db('vehiculos as v')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.kilometraje_actual',
        'c.nombre_conductor',
        'c.numero_telefono',
        db.raw('MAX(m.proximo_servicio_km) as proximo_servicio_km'),
        db.raw('(v.kilometraje_actual - MAX(m.proximo_servicio_km)) as km_exceso')
      )
      .leftJoin('mantenimientos as m', function() {
        this.on('v.id', '=', 'm.vehiculo_id')
            .andOn('m.estado', '=', db.raw('?', ['Completado']));
      })
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .groupBy('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.kilometraje_actual', 'c.nombre_conductor', 'c.numero_telefono')
      .havingRaw('v.kilometraje_actual >= MAX(m.proximo_servicio_km)')
      .orderBy('km_exceso', 'desc');

    res.json({
      success: true,
      alertas: {
        vencidos: vencidos.map(v => ({
          ...v,
          dias_vencido: parseInt(v.dias_vencido) || 0
        })),
        urgentes: urgentes.map(u => ({
          ...u,
          dias_restantes: parseInt(u.dias_restantes) || 0
        })),
        proximos: proximos.map(p => ({
          ...p,
          dias_restantes: parseInt(p.dias_restantes) || 0
        })),
        por_kilometraje: porKilometraje.map(pk => ({
          ...pk,
          km_exceso: parseInt(pk.km_exceso) || 0
        }))
      }
    });

  } catch (error) {
    console.error('Error en getAlertas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener alertas',
      error: error.message
    });
  }
};

// ============================================
// HISTORIAL POR VEHÍCULO
// ============================================
exports.getHistorialVehiculo = async (req, res) => {
  try {
    const { id } = req.params;

    const historial = await db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'c.nombre_conductor',
        'c.numero_telefono'
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('m.vehiculo_id', '=', 'a.vehiculo_id')
            .andOn(db.raw('m.fecha_realizada BETWEEN a.fecha_inicio AND COALESCE(a.fecha_fin, NOW())'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .where('m.vehiculo_id', id)
      .orderBy('m.fecha_realizada', 'desc');

    // Estadísticas del vehículo
    const estadisticas = await db('mantenimientos')
      .select(
        db.raw('COUNT(*) as total_mantenimientos'),
        db.raw('COALESCE(SUM(costo_total), 0) as costo_total'),
        db.raw('COALESCE(AVG(costo_total), 0) as costo_promedio'),
        db.raw('COUNT(*) FILTER (WHERE estado = \'Completado\') as completados')
      )
      .where('vehiculo_id', id)
      .first();

    res.json({
      success: true,
      historial,
      estadisticas: {
        total_mantenimientos: parseInt(estadisticas.total_mantenimientos) || 0,
        costo_total: parseFloat(estadisticas.costo_total) || 0,
        costo_promedio: parseFloat(estadisticas.costo_promedio) || 0,
        completados: parseInt(estadisticas.completados) || 0
      }
    });

  } catch (error) {
    console.error('Error en getHistorialVehiculo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
    });
  }
};

// ============================================
// OBTENER UN MANTENIMIENTO POR ID
// ============================================
exports.getMantenimientoById = async (req, res) => {
  try {
    const { id } = req.params;

   const mantenimiento = await db('mantenimientos as m')
  .select(
    'm.*',
    'v.numero_vehiculo',
    'v.marca',
    'v.modelo',
    'v.placa',
    'v.kilometraje_actual',
    'c.id as conductor_id',           // ← AÑADIDO
    'c.nombre_conductor',
    'c.numero_telefono',
    'c.tipo_poliza',                   // ← AÑADIDO
    'c.saldo_poliza_mecanica',        // ← AÑADIDO
    'c.saldo_ahorro_mantenimiento'    // ← AÑADIDO
  )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .where('m.id', id)
      .first();

    if (!mantenimiento) {
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    res.json({
      success: true,
      mantenimiento
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

// ============================================
// CREAR/PROGRAMAR NUEVO MANTENIMIENTO
// ============================================
exports.createMantenimiento = async (req, res) => {
  try {
    const {
      vehiculo_id,
      tipo_servicio,
      fecha_programada,
      hora_programada,
      kilometraje_servicio,
      proximo_servicio_km,
      taller,
      observaciones,
      monto_estimado
    } = req.body;

    // Validaciones básicas
    if (!vehiculo_id || !tipo_servicio || !fecha_programada || !hora_programada) {
      return res.status(400).json({
        success: false,
        message: 'vehiculo_id, tipo_servicio, fecha_programada y hora_programada son obligatorios'
      });
    }

    // Validar hora (HH:mm)
    const horaValida = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hora_programada);
    if (!horaValida) {
      return res.status(400).json({
        success: false,
        message: 'hora_programada debe tener el formato HH:mm'
      });
    }

    // Construir fecha y hora completa
    const fechaHoraProgramada = new Date(`${fecha_programada}T${hora_programada}:00`);
    if (isNaN(fechaHoraProgramada.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Fecha u hora inválida'
      });
    }

    // Validar horario laboral (9:00 a 19:00) y solo lunes a viernes
    const diaSemana = fechaHoraProgramada.getDay();
    if (diaSemana === 0 || diaSemana === 6) {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede agendar mantenimientos de lunes a viernes'
      });
    }

    const horaInicio = fechaHoraProgramada.getHours();
    const horaFinSlot = new Date(fechaHoraProgramada.getTime() + 30 * 60 * 1000);
    const cierreDia = new Date(fechaHoraProgramada);
    cierreDia.setHours(19, 0, 0, 0);

    if (horaInicio < 9 || horaFinSlot > cierreDia) {
      return res.status(400).json({
        success: false,
        message: 'El horario de servicio es de 09:00 a 19:00 con bloques de 30 minutos'
      });
    }

    // Validar que no existan traslapes (intervalo de 30 minutos)
    const traslape = await db('mantenimientos')
      .whereNot('estado', 'Completado')
      .andWhere('fecha_programada', '<', horaFinSlot)
      .andWhere(db.raw("fecha_programada + interval '30 minutes' > ?", [fechaHoraProgramada]))
      .first();

    if (traslape) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un mantenimiento agendado en ese bloque de 30 minutos'
      });
    }

    // Verificar que el vehículo existe
    const vehiculo = await db('vehiculos').where('id', vehiculo_id).first();
    if (!vehiculo) {
      return res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado'
      });
    }

    // Generar folio
    const ultimoFolio = await db('mantenimientos')
      .max('folio_servicio as max_folio')
      .first();
    
    const nuevoFolio = (ultimoFolio.max_folio || 0) + 1;

    // Crear mantenimiento
    const [mantenimiento] = await db('mantenimientos')
      .insert({
        folio_servicio: nuevoFolio,
        vehiculo_id,
        tipo_servicio,
        fecha_programada: fechaHoraProgramada,
        kilometraje_servicio: kilometraje_servicio || vehiculo.kilometraje_actual,
        proximo_servicio_km: proximo_servicio_km || (kilometraje_servicio || vehiculo.kilometraje_actual) + 5000,
        estado: 'Programado',
        status: 'Todo',
        taller,
        observaciones,
        costo_mano_obra: 0,
        costo_refacciones: 0,
        costo_total: monto_estimado || 0,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Mantenimiento programado exitosamente',
      mantenimiento
    });

  } catch (error) {
    console.error('Error en createMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al programar mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// ACTUALIZAR MANTENIMIENTO
// ============================================
exports.updateMantenimiento = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verificar que existe
    const mantenimiento = await trx('mantenimientos').where('id', id).first();
    if (!mantenimiento) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    // 🔥 SI CAMBIA A "En proceso" → Guardar estado previo del vehículo
    if (updates.estado === 'En proceso' && mantenimiento.estado !== 'En proceso') {
      // Obtener estado actual del vehículo
      const vehiculo = await trx('vehiculos')
        .where('id', mantenimiento.vehiculo_id)
        .first();

      // Guardar el estado previo en el mantenimiento
      updates.estado_vehiculo_previo = vehiculo.estado;

      // Cambiar vehículo a Mantenimiento
      await trx('vehiculos')
        .where('id', mantenimiento.vehiculo_id)
        .update({
          estado: 'Mantenimiento',
          updated_at: db.fn.now()
        });
    }

    // Actualizar mantenimiento
    updates.updated_at = db.fn.now();
    
    const [mantenimientoActualizado] = await trx('mantenimientos')
      .where('id', id)
      .update(updates)
      .returning('*');


    await trx.commit();

    res.json({
      success: true,
      message: 'Mantenimiento actualizado exitosamente',
      mantenimiento: mantenimientoActualizado
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en updateMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// COMPLETAR MANTENIMIENTO
// ============================================
exports.completarMantenimiento = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const {
      fecha_realizada,
      kilometraje_servicio,
      proximo_servicio_km,
      servicios_realizados,
      refacciones,
      costo_mano_obra,
      costo_refacciones,
      costo_total,
      taller,
      mecanico,
      observaciones_final,
      // 🆕 NUEVOS CAMPOS
      metodo_distribucion,
      conductor_id
    } = req.body;

    console.log('🔍 DEBUG completarMantenimiento - Datos recibidos:', {
      id,
      costo_total,
      metodo_distribucion,
      conductor_id
    });

    // Verificar que existe
    const mantenimiento = await trx('mantenimientos').where('id', id).first();
    if (!mantenimiento) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    // Calcular costo total si no viene en el body
    const costoFinal = costo_total || 
      ((parseFloat(costo_mano_obra) || 0) + (parseFloat(costo_refacciones) || 0));

    // Actualizar mantenimiento
    const [mantenimientoActualizado] = await trx('mantenimientos')
      .where('id', id)
      .update({
        fecha_realizada: fecha_realizada || db.fn.now(),
        kilometraje_servicio: kilometraje_servicio || mantenimiento.kilometraje_servicio,
        proximo_servicio_km: proximo_servicio_km || mantenimiento.proximo_servicio_km,
        servicios_realizados,
        refacciones,
        costo_mano_obra: costo_mano_obra || 0,
        costo_refacciones: costo_refacciones || 0,
        costo_total: costoFinal,
        taller: taller || mantenimiento.taller,
        mecanico,
        observaciones: observaciones_final || mantenimiento.observaciones,
        estado: 'Completado',
        status: 'Completado',
        updated_at: db.fn.now()
      })
      .returning('*');

    // 🔥 Determinar el estado correcto del vehículo
    let nuevoEstadoVehiculo = 'Disponible'; // Default

    // Si guardamos el estado previo, restaurarlo
    if (mantenimientoActualizado.estado_vehiculo_previo) {
      nuevoEstadoVehiculo = mantenimientoActualizado.estado_vehiculo_previo;
    } else {
      // Si no hay estado previo guardado, verificar si tiene asignación activa
      const tieneAsignacion = await trx('asignaciones')
        .where('vehiculo_id', mantenimiento.vehiculo_id)
        .where('activa', true)
        .first();

      if (tieneAsignacion) {
        // Verificar si tiene renta activa
        const tieneRenta = await trx('rentas')
          .where('vehiculo_id', mantenimiento.vehiculo_id)
          .where('estado_renta', 'activa')
          .first();

        nuevoEstadoVehiculo = tieneRenta ? 'Rentado' : 'Asignado';
      }
    }

    // 🔥 Actualizar vehículo: kilometraje + estado correcto
    await trx('vehiculos')
      .where('id', mantenimiento.vehiculo_id)
      .update({
        kilometraje_actual: kilometraje_servicio || mantenimiento.kilometraje_servicio,
        estado: nuevoEstadoVehiculo,
        updated_at: db.fn.now()
      });


    if (metodo_distribucion && costoFinal > 0) {
      console.log('🔍 DEBUG: Procesando distribución automática:', metodo_distribucion);

      if (metodo_distribucion === 'poliza' && conductor_id) {
        // 💳 DESCONTAR DE PÓLIZA
        const conductorData = await trx('conductores')
          .where('id', conductor_id)
          .first();

        if (conductorData) {
          const saldoActual = parseFloat(conductorData.saldo_poliza_mecanica) || 50000;
          const nuevoSaldo = saldoActual - costoFinal;

          if (nuevoSaldo < 0) {
            await trx.rollback();
            return res.status(400).json({
              success: false,
              message: `Saldo insuficiente en póliza. Disponible: $${saldoActual.toFixed(2)}, Requerido: $${costoFinal.toFixed(2)}`
            });
          }

          await trx('conductores')
            .where('id', conductor_id)
            .update({
              saldo_poliza_mecanica: nuevoSaldo,
              updated_at: db.fn.now()
            });

          detalleDistribucion = {
            metodo: 'poliza',
            conductor: conductorData.nombre_conductor,
            saldo_previo: saldoActual,
            saldo_nuevo: nuevoSaldo,
            monto: costoFinal
          };

          console.log('✅ DEBUG: Póliza descontada correctamente', detalleDistribucion);
        }

      } else if (metodo_distribucion === 'empresa') {
        // 🏢 PAGAR POR EMPRESA
        const vehiculo = await trx('vehiculos')
          .where('id', mantenimiento.vehiculo_id)
          .first();

        if (vehiculo) {
          const inversion = await trx('inversiones_vehiculos')
            .where('numero_de_serie_vehiculo', vehiculo.numero_de_serie_vehiculo)
            .first();

          if (inversion) {
            await trx('inversiones_vehiculos')
              .where('id_inversion', inversion.id_inversion)
              .increment('otros_gastos', costoFinal);

            detalleDistribucion = {
              metodo: 'empresa',
              vehiculo: vehiculo.numero_vehiculo,
              monto: costoFinal
            };

            console.log('✅ DEBUG: Gasto agregado a inversión', detalleDistribucion);
          }
        }

      } else if (metodo_distribucion === 'conductor' && conductor_id) {
        // 💰 DEUDA DEL CONDUCTOR
        detalleDistribucion = {
          metodo: 'deuda_conductor',
          conductor_id,
          monto: costoFinal
        };

        console.log('⚠️ DEBUG: Deuda del conductor (pendiente)', detalleDistribucion);

         } else if (metodo_distribucion === 'fondo') {
        // 💚 FONDO DE MANTENIMIENTO
        detalleDistribucion = {
          metodo: 'fondo',
          monto: costoFinal
        };

        console.log('✅ DEBUG: Pagado desde fondo', detalleDistribucion);
      }
    }

    // 🔥 Actualizar el costo total de mantenimientos del vehículo
    await trx('vehiculos')
      .where('id', mantenimiento.vehiculo_id)
      .increment('costo_total_mantenimientos', costoFinal);

    await trx.commit();

    res.json({
      success: true,
      
      message: `Mantenimiento completado. Vehículo ahora en estado: ${nuevoEstadoVehiculo}`,
      mantenimiento: mantenimientoActualizado,
      estado_vehiculo: nuevoEstadoVehiculo,
      detalle_distribucion: detalleDistribucion
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en completarMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// ELIMINAR MANTENIMIENTO
// ============================================
exports.deleteMantenimiento = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existe = await db('mantenimientos').where('id', id).first();
    if (!existe) {
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    // Eliminar
    await db('mantenimientos').where('id', id).delete();

    res.json({
      success: true,
      message: 'Mantenimiento eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// OPCIONES PARA SELECTS (VEHÍCULOS, TIPOS, ETC)
// ============================================
exports.getOpciones = async (req, res) => {
  try {
    // Vehículos disponibles con conductor asignado
    const vehiculos = await db('vehiculos as v')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'v.kilometraje_actual',
        'c.nombre_conductor',
        'c.id as conductor_id'
      )
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .whereIn('v.estado', ['Disponible', 'Asignado', 'Rentado'])
      .orderBy('v.numero_vehiculo', 'asc');

    // Tipos de servicio (valores únicos de la BD)
    const tiposServicio = [
      'Cambio de aceite',
      'Alineación y balanceo',
      'Revisión general',
      'Cambio de llantas',
      'Frenos',
      'Suspensión',
      'Verificación vehicular',
      'Limpieza profunda',
      'Reparación mecánica',
      'Reparación eléctrica',
      'Hojalatería y pintura',
      'Transmisión',
      'Sistema de enfriamiento',
      'Batería y sistema eléctrico',
      'Otros'
    ];

    // Talleres (valores únicos de la BD)
    const talleresResult = await db('mantenimientos')
      .distinct('taller')
      .whereNotNull('taller')
      .orderBy('taller', 'asc');

    const talleres = talleresResult.map(t => t.taller);

    res.json({
      success: true,
      opciones: {
        vehiculos,
        tipos_servicio: tiposServicio,
        talleres,
        estados: ['Programado', 'En proceso', 'Completado', 'Cancelado', 'Reprogramado']
      }
    });

  } catch (error) {
    console.error('Error en getOpciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener opciones',
      error: error.message
    });
  }
};

// ============================================
// SERVICIOS PREVENTIVOS POR MODELO
// ============================================
exports.getServiciosPreventivos = async (_req, res) => {
  try {
    const modelos = Object.entries(schedules).reduce((acc, [modelo, servicios]) => {
      acc[modelo] = servicios.map(servicio => ({
        kilometraje: servicio.kilometraje,
        servicio: servicio.servicio
      }));
      return acc;
    }, {});

    res.json({
      success: true,
      modelos
    });
  } catch (error) {
    console.error('Error en getServiciosPreventivos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener servicios preventivos',
      error: error.message
    });
  }
};

// ========================================
// REPORTES Y ANÁLISIS
// ========================================

exports.getReporteCostos = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, vehiculo_id, tipo } = req.query;
    
    let query = db('mantenimientos')
      .select(
        db.raw(`
          COUNT(*) as total_mantenimientos,
          COALESCE(SUM(costo_total), 0) as total_estimado,
          COALESCE(SUM(CASE WHEN estado = 'Completado' THEN costo_total ELSE 0 END), 0) as total_real,
          COALESCE(AVG(costo_total), 0) as promedio_estimado,
          COALESCE(AVG(CASE WHEN estado = 'Completado' THEN costo_total END), 0) as promedio_real,
          COALESCE(MAX(CASE WHEN estado = 'Completado' THEN costo_total END), 0) as costo_maximo,
          COALESCE(MIN(CASE WHEN estado = 'Completado' AND costo_total > 0 THEN costo_total END), 0) as costo_minimo
        `)
      );

    if (fecha_inicio && fecha_fin) {
      query = query.whereBetween('fecha_programada', [fecha_inicio, fecha_fin]);
    }

    if (vehiculo_id) {
      query = query.where('vehiculo_id', vehiculo_id);
    }

    if (tipo) {
      query = query.where('tipo_servicio', tipo);
    }

    const resultado = await query.first();

    // Obtener desglose por tipo
    let queryDesglose = db('mantenimientos')
      .select('tipo_servicio')
      .count('* as cantidad')
      .sum('costo_total as total')
      .where('estado', 'Completado')
      .groupBy('tipo_servicio')
      .orderBy('total', 'desc');

    if (fecha_inicio && fecha_fin) {
      queryDesglose = queryDesglose.whereBetween('fecha_programada', [fecha_inicio, fecha_fin]);
    }

    const desgloseTipo = await queryDesglose;

    res.json({
      resumen: {
        total_mantenimientos: parseInt(resultado.total_mantenimientos) || 0,
        total_estimado: parseFloat(resultado.total_estimado) || 0,
        total_real: parseFloat(resultado.total_real) || 0,
        promedio_estimado: parseFloat(resultado.promedio_estimado) || 0,
        promedio_real: parseFloat(resultado.promedio_real) || 0,
        costo_maximo: parseFloat(resultado.costo_maximo) || 0,
        costo_minimo: parseFloat(resultado.costo_minimo) || 0
      },
      desglose_por_tipo: desgloseTipo.map(d => ({
        tipo_mantenimiento: d.tipo_servicio,
        cantidad: parseInt(d.cantidad),
        total: parseFloat(d.total) || 0
      }))
    });

  } catch (error) {
    console.error('Error en getReporteCostos:', error);
    res.status(500).json({ 
      message: 'Error al generar reporte de costos',
      error: error.message 
    });
  }
};

exports.getReporteFrecuencia = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let query = db('mantenimientos')
      .select(
        db.raw(`TO_CHAR(fecha_programada, 'YYYY-MM') as mes`),
        db.raw(`COUNT(*) as cantidad`),
        db.raw(`COALESCE(SUM(CASE WHEN estado = 'Completado' THEN costo_total ELSE 0 END), 0) as costo_total`),
        db.raw(`COUNT(CASE WHEN estado = 'Completado' THEN 1 END) as completados`),
        db.raw(`COUNT(CASE WHEN estado = 'Programado' THEN 1 END) as pendientes`),
        db.raw(`COUNT(CASE WHEN estado = 'En proceso' THEN 1 END) as en_proceso`)
      )
      .groupBy(db.raw(`TO_CHAR(fecha_programada, 'YYYY-MM')`))
      .orderBy(db.raw(`TO_CHAR(fecha_programada, 'YYYY-MM')`), 'desc')
      .limit(12);

    if (fecha_inicio && fecha_fin) {
      query = query.whereBetween('fecha_programada', [fecha_inicio, fecha_fin]);
    }

    const resultado = await query;

    res.json(resultado);

  } catch (error) {
    console.error('Error en getReporteFrecuencia:', error);
    res.status(500).json({ 
      message: 'Error al generar reporte de frecuencia',
      error: error.message 
    });
  }
};

exports.getVehiculosMasCostosos = async (req, res) => {
  try {
    const { limite = 10, fecha_inicio, fecha_fin } = req.query;

    let query = db('mantenimientos as m')
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.año_del_vehiculo as anio',
        'v.placa',
        'c.nombre_conductor', // ✅ AGREGADO: nombre del conductor
        db.raw('COUNT(m.id) as total_mantenimientos'),
        db.raw('COALESCE(SUM(CASE WHEN m.estado = \'Completado\' THEN m.costo_total ELSE 0 END), 0) as costo_total'),
        db.raw('COALESCE(AVG(CASE WHEN m.estado = \'Completado\' THEN m.costo_total END), 0) as costo_promedio'),
        db.raw('MAX(m.fecha_realizada) as ultimo_mantenimiento')
      )
      .where('m.estado', 'Completado')
      .groupBy('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.año_del_vehiculo', 'v.placa', 'c.nombre_conductor')
      .orderBy('costo_total', 'desc')
      .limit(parseInt(limite));

    if (fecha_inicio && fecha_fin) {
      query = query.whereBetween('m.fecha_programada', [fecha_inicio, fecha_fin]);
    }

    const resultado = await query;

    res.json(resultado.map(v => ({
      ...v,
      total_mantenimientos: parseInt(v.total_mantenimientos),
      costo_total: parseFloat(v.costo_total),
      costo_promedio: parseFloat(v.costo_promedio),
      nombre_conductor: v.nombre_conductor || 'Sin asignar' // ✅ Manejo de conductores no asignados
    })));

  } catch (error) {
    console.error('Error en getVehiculosMasCostosos:', error);
    res.status(500).json({ 
      message: 'Error al obtener vehículos más costosos',
      error: error.message 
    });
  }
};

exports.getComparativaEstimadoReal = async (req, res) => {
  try {
    const { vehiculo_id } = req.query;

    let query = db('mantenimientos')
      .select(
        'id',
        'tipo_servicio',
        'fecha_programada',
        'fecha_realizada',
        'costo_total',
        db.raw('0 as diferencia'),
        db.raw('0 as porcentaje_variacion')
      )
      .where('estado', 'Completado')
      .orderBy('fecha_realizada', 'desc')
      .limit(50);

    if (vehiculo_id) {
      query = query.where('vehiculo_id', vehiculo_id);
    }

    const resultado = await query;

    // Calcular estadísticas generales
    const estadisticas = await db('mantenimientos')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('0 as diferencia_promedio'),
        db.raw('0 as porcentaje_promedio'),
        db.raw('COUNT(*) as sobrepasados'),
        db.raw('0 as dentro_presupuesto')
      )
      .where('estado', 'Completado')
      .first();

    res.json({
      mantenimientos: resultado,
      estadisticas: {
        total: parseInt(estadisticas.total),
        diferencia_promedio: 0,
        porcentaje_promedio: 0,
        sobrepasados: 0,
        dentro_presupuesto: parseInt(estadisticas.total)
      }
    });

  } catch (error) {
    console.error('Error en getComparativaEstimadoReal:', error);
    res.status(500).json({ 
      message: 'Error al generar comparativa',
      error: error.message 
    });
  }
};

exports.getReportePorTaller = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let query = db('mantenimientos')
      .select(
        'taller',
        db.raw('COUNT(*) as total_servicios'),
        db.raw('COALESCE(SUM(CASE WHEN estado = \'Completado\' THEN costo_total ELSE 0 END), 0) as facturacion_total'),
        db.raw('COALESCE(AVG(CASE WHEN estado = \'Completado\' THEN costo_total END), 0) as ticket_promedio'),
        db.raw('COUNT(CASE WHEN estado = \'Completado\' THEN 1 END) as completados'),
        db.raw('MAX(fecha_realizada) as ultima_visita')
      )
      .whereNotNull('taller')
      .where('taller', '!=', '')
      .groupBy('taller')
      .orderBy('facturacion_total', 'desc');

    if (fecha_inicio && fecha_fin) {
      query = query.whereBetween('fecha_programada', [fecha_inicio, fecha_fin]);
    }

    const resultado = await query;

    res.json(resultado.map(t => ({
      ...t,
      total_servicios: parseInt(t.total_servicios),
      facturacion_total: parseFloat(t.facturacion_total),
      ticket_promedio: parseFloat(t.ticket_promedio),
      completados: parseInt(t.completados)
    })));

  } catch (error) {
    console.error('Error en getReportePorTaller:', error);
    res.status(500).json({ 
      message: 'Error al generar reporte por taller',
      error: error.message 
    });
  }
};
// ============================================
// DISTRIBUIR GASTO DE MANTENIMIENTO
// ============================================
exports.distribuirGastoMantenimiento = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params; // mantenimiento_id
    const {
      pagado_fondo_mantenimiento = 0,
      pagado_poliza = 0,
      pagado_empresa = 0,
      pagado_conductor = 0,
      observaciones
    } = req.body;

    // 1. Verificar que el mantenimiento existe y está completado
    const mantenimiento = await trx('mantenimientos').where('id', id).first();
    
    if (!mantenimiento) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    if (mantenimiento.estado !== 'Completado') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden distribuir gastos de mantenimientos completados'
      });
    }

    // 2. Convertir a números y validar
    const fondoMant = parseFloat(pagado_fondo_mantenimiento) || 0;
    const poliza = parseFloat(pagado_poliza) || 0;
    const empresa = parseFloat(pagado_empresa) || 0;
    const conductor = parseFloat(pagado_conductor) || 0;
    const costoTotal = parseFloat(mantenimiento.costo_total) || 0;

    const sumaDistribucion = fondoMant + poliza + empresa + conductor;

    // 3. VALIDACIÓN CRÍTICA: La suma debe ser igual al costo total
    if (Math.abs(sumaDistribucion - costoTotal) > 0.01) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: `La suma de la distribución ($${sumaDistribucion.toFixed(2)}) debe ser igual al costo total ($${costoTotal.toFixed(2)})`,
        datos: {
          costo_total: costoTotal,
          suma_distribucion: sumaDistribucion,
          diferencia: costoTotal - sumaDistribucion
        }
      });
    }

    // 4. Verificar si ya existe una distribución
    const distribucionExistente = await trx('distribucion_gastos_mantenimiento')
      .where('mantenimiento_id', id)
      .first();

    if (distribucionExistente) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este mantenimiento ya tiene una distribución de gastos',
        distribucion_existente: distribucionExistente
      });
    }

    // 5. Crear registro de distribución
    const [distribucion] = await trx('distribucion_gastos_mantenimiento')
      .insert({
        mantenimiento_id: id,
        costo_total: costoTotal,
        pagado_fondo_mantenimiento: fondoMant,
        pagado_poliza: poliza,
        pagado_empresa: empresa,
        pagado_conductor: conductor,
        distribuido_por: req.user?.id || null,
        fecha_distribucion: db.fn.now(),
        observaciones,
        estado: 'distribuido',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    // 6. Si pagó empresa → Actualizar inversiones_vehiculos.otros_gastos
    if (empresa > 0) {
      const vehiculo = await trx('vehiculos')
        .where('id', mantenimiento.vehiculo_id)
        .first();

      if (vehiculo) {
        const inversion = await trx('inversiones_vehiculos')
          .where('numero_de_serie_vehiculo', vehiculo.numero_de_serie_vehiculo)
          .first();

        if (inversion) {
          await trx('inversiones_vehiculos')
            .where('id_inversion', inversion.id_inversion)
            .increment('otros_gastos', empresa);
        }
      }
    }

    // 6.5. Si pagó póliza → Descontar de saldo_poliza_mecanica del conductor
    let detallePoliza = null;

    if (poliza > 0) {
      console.log('🔍 DEBUG: Entrando a descuento de póliza, monto:', poliza);
      
      const asignacion = await trx('asignaciones')
        .where('vehiculo_id', mantenimiento.vehiculo_id)
        .where('activa', true)
        .first();

      if (asignacion && asignacion.conductor_id) {
        const conductorData = await trx('conductores')
          .where('id', asignacion.conductor_id)
          .first();

        if (conductorData) {
          const saldoActual = parseFloat(conductorData.saldo_poliza_mecanica) || 50000;
          const nuevoSaldo = saldoActual - poliza;

          if (nuevoSaldo < 0) {
            await trx.rollback();
            return res.status(400).json({
              success: false,
              message: `Saldo insuficiente en póliza. Disponible: $${saldoActual.toFixed(2)}, Requerido: $${poliza.toFixed(2)}`,
              saldo_disponible: saldoActual
            });
          }

          await trx('conductores')
            .where('id', asignacion.conductor_id)
            .update({
              saldo_poliza_mecanica: nuevoSaldo,
              updated_at: db.fn.now()
            });

          detallePoliza = {
            id: conductorData.id,
            nombre: conductorData.nombre_conductor,
            saldo_previo: saldoActual,
            saldo_nuevo: nuevoSaldo,
            monto_descontado: poliza
          };
        }
      }
    }

    // 6.6. 🆕 Si pagó fondo de mantenimiento → Descontar de saldo_ahorro_mantenimiento
    let detalleFondo = null;

    if (fondoMant > 0) {
      console.log('🔍 DEBUG: Entrando a descuento de fondo de mantenimiento, monto:', fondoMant);
      
      const asignacion = await trx('asignaciones')
        .where('vehiculo_id', mantenimiento.vehiculo_id)
        .where('activa', true)
        .first();

      console.log('🔍 DEBUG: Asignación encontrada:', asignacion);

      if (asignacion && asignacion.conductor_id) {
        const conductorData = await trx('conductores')
          .where('id', asignacion.conductor_id)
          .first();

        console.log('🔍 DEBUG: Conductor encontrado:', {
          id: conductorData?.id,
          nombre: conductorData?.nombre_conductor,
          saldo_ahorro_actual: conductorData?.saldo_ahorro_mantenimiento
        });

        if (conductorData) {
          const saldoActual = parseFloat(conductorData.saldo_ahorro_mantenimiento) || 0;
          const nuevoSaldo = saldoActual - fondoMant;

          console.log('🔍 DEBUG: Cálculo fondo:', {
            saldoActual,
            montoDescontar: fondoMant,
            nuevoSaldo
          });

          // ✅ PERMITIR SALDO NEGATIVO (se convierte en deuda)
          await trx('conductores')
            .where('id', asignacion.conductor_id)
            .update({
              saldo_ahorro_mantenimiento: nuevoSaldo,
              updated_at: db.fn.now()
            });

          console.log('✅ DEBUG: Descuento de fondo aplicado correctamente');

          detalleFondo = {
            id: conductorData.id,
            nombre: conductorData.nombre_conductor,
            saldo_previo: saldoActual,
            saldo_nuevo: nuevoSaldo,
            monto_descontado: fondoMant,
            deuda_generada: nuevoSaldo < 0 ? Math.abs(nuevoSaldo) : 0
          };

          if (nuevoSaldo < 0) {
            console.log('⚠️ DEBUG: Se generó deuda en fondo de:', Math.abs(nuevoSaldo));
          }
        }
      }
    }

    // 7. Actualizar vehiculos.costo_total_mantenimientos
    await trx('vehiculos')
      .where('id', mantenimiento.vehiculo_id)
      .increment('costo_total_mantenimientos', costoTotal);

    await trx.commit();

    res.json({
      success: true,
      message: 'Distribución de gastos registrada exitosamente',
      distribucion,
      impactos: {
        fondo_mantenimiento: fondoMant > 0,
        poliza_seguro: poliza > 0,
        empresa_inversion: empresa > 0,
        deuda_conductor: conductor > 0
      },
      detalle_poliza: detallePoliza,
      detalle_fondo: detalleFondo  // ← AÑADIDO
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en distribuirGastoMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al distribuir gastos',
      error: error.message
    });
  }
};

// ============================================
// OBTENER MANTENIMIENTOS PENDIENTES DE DISTRIBUCIÓN
// ============================================
exports.getMantenimientosPendientesDistribucion = async (req, res) => {
  try {
    const mantenimientos = await db('mantenimientos as m')
      .select(
        'm.id',
        'm.folio_servicio',
        'm.tipo_servicio',
        'm.fecha_realizada',
        'm.costo_total',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'c.nombre_conductor',
        db.raw('DATE_PART(\'day\', NOW() - m.fecha_realizada) as dias_desde_completado')
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .leftJoin('distribucion_gastos_mantenimiento as d', 'm.id', 'd.mantenimiento_id')
      .where('m.estado', 'Completado')
      .whereNull('d.id') // No tiene distribución
      .orderBy('m.fecha_realizada', 'desc');

    res.json({
      success: true,
      total_pendientes: mantenimientos.length,
      mantenimientos: mantenimientos.map(m => ({
        ...m,
        dias_desde_completado: parseInt(m.dias_desde_completado) || 0,
        costo_total: parseFloat(m.costo_total) || 0
      }))
    });

  } catch (error) {
    console.error('Error en getMantenimientosPendientesDistribucion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mantenimientos pendientes',
      error: error.message
    });
  }
};