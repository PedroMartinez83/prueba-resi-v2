const {
  db, // Importamos 'db' para consultas complejas
  getById,
  create,
  update,
  TABLES,
  findConductorByEmail,
  getRentasPendientesByConductor,
  getWithFilter
} = require('../services/postgresService');
const {
  getPreventiveMaintenanceAlert,
  getMaintenancePlanContext
} = require('../utils/mantenimientoPreventivo');

/**
 * Genera un password temporal memorable
 * @returns {string} Password (ej: Conduc_a1b2c)
 */
const generateTempPassword = () => {
  const randomPart = Math.random().toString(36).substring(2, 7);
  return `Conduc_${randomPart}`;
};


/**
 * OBTIENE TODOS LOS DATOS AGREGADOS PARA EL DASHBOARD DEL CONDUCTOR
 * GET /api/conductor/dashboard
 */
const getDriverDashboard = async (req, res) => {
  try {
    // 1. OBTENER CONDUCTOR Y VEHÍCULO
    // req.user.id es el ID de la tabla 'usuarios' (del middleware)
    const conductorInfo = await db('conductores as c')
      .leftJoin('asignaciones as a', function() {
        this.on('c.id', '=', 'a.conductor_id').andOn('a.activa', '=', db.raw('true'))
      })
      .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .select(
        // Conductor
        'c.id as conductor_id', 'c.nombre_conductor', 'c.status', 'c.status_trabajo', 'c.categoria', 'c.fecha_ingreso',
        // Finanzas (Pólizas y Ahorro)
        'c.tipo_poliza', 'c.saldo_poliza_mecanica', 'c.total_aportado_poliza', 'c.saldo_ahorro_mantenimiento',
        // Vehiculo
        'v.id as vehiculo_id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa', 'v.kilometraje_actual',
        
        // --- 👇 ¡AQUÍ ESTÁ LA CORRECCIÓN! 👇 ---
        // Usamos el nombre real 'proximo_mantenimiento' y lo renombramos a 'proximo_mantenimiento_km'
        'v.proximo_mantenimiento as proximo_mantenimiento_km' 
        // --- 👆 FIN DE LA CORRECCIÓN 👆 ---
      )
      .where('c.usuario_id', req.user.id) // Vinculado al usuario que inició sesión
      .first();

    if (!conductorInfo) {
      return res.status(404).json({ 
        success: false, 
        message: 'Perfil de conductor no encontrado. Contacta a un administrador para que active tu cuenta.' 
      });
    }

    // 2. OBTENER ESTADO DE RENTAS (Según el blueprint)
    const rentas = await db('rentas')
      .where('conductor_id', conductorInfo.conductor_id)
      .whereIn('estado', ['Pendiente', 'Vencida'])
      .select('monto_total');

    let rentas_pendientes = rentas.length;
    let monto_deuda_total = rentas.reduce((sum, r) => sum + parseFloat(r.monto_total || 0), 0);
    
    // Obtener fecha de hoy en formato ISO (YYYY-MM-DD)
    const hoyDate = new Date();
    const hoyISO = hoyDate.toISOString().split('T')[0];
    
    // Verificar si hay pago hoy
    const pagoHoy = await db('pagos_diarios')
      .join('asignaciones', 'pagos_diarios.asignacion_id', 'asignaciones.id')
      .where('asignaciones.conductor_id', conductorInfo.conductor_id)
      .where('pagos_diarios.fecha_pago', hoyISO)
      .where('pagos_diarios.status', 'Confirmado')
      .first();
    
    // Si no hay pago hoy y tiene asignación activa, agregar hoy a la deuda
    if (!pagoHoy && conductorInfo.vehiculo_id) {
      const asignacion = await db('asignaciones')
        .where('conductor_id', conductorInfo.conductor_id)
        .where('activa', true)
        .first();
        
      if (asignacion) {
        monto_deuda_total += parseFloat(asignacion.renta_diaria || 0);
        rentas_pendientes += 1;
      }
    }
    
    // Lógica de tolerancia (Asumiendo 2 días)
    const dias_de_tolerancia_restantes = Math.max(0, 2 - rentas_pendientes);
    const estado_cuenta = rentas_pendientes > 0 ? 'Atrasado' : 'Al Corriente';

    // 3. OBTENER ALERTAS (Amonestaciones, Mantenimientos, Siniestros)
    const [amonestaciones, mant_pendiente, siniestro_pendiente] = await Promise.all([
      // Total de amonestaciones activas (puedes ajustar esta lógica si se 'resetean')
      db('amonestaciones_conductores')
        .where('conductor_id', conductorInfo.conductor_id)
        .count('id as total')
        .first(),

      // Mantenimiento pendiente (el más próximo programado)
      db('mantenimientos')
        .where('vehiculo_id', conductorInfo.vehiculo_id)
        .where('estado', 'Programado')
        .orderBy('fecha_programada', 'asc')
        .select('id', 'tipo_servicio', 'fecha_programada')
        .first(),
        
      // Siniestro pendiente (el último reportado/en revisión/en proceso)
      db('siniestros')
        .where('conductor_id', conductorInfo.conductor_id)
        .whereIn('estado', ['Reportado', 'En revisión', 'En proceso'])
        .orderBy('fecha_incidente', 'desc')
        .select('id', 'folio_siniestro', 'estado')
        .first()
    ]);

    const mantenimientoPreventivo = conductorInfo.vehiculo_id
      ? getPreventiveMaintenanceAlert({
          modelo: conductorInfo.modelo,
          kilometrajeActual: conductorInfo.kilometraje_actual
        })
      : null;

    const mantenimientoPlan = conductorInfo.vehiculo_id
      ? getMaintenancePlanContext({
          modelo: conductorInfo.modelo,
          kilometrajeActual: conductorInfo.kilometraje_actual
        })
      : null;

    // 3.1 Verificar estado de la revisión diaria (reinicia cada día a las 00:00)
    const inicioHoy = new Date(hoyDate);
    inicioHoy.setHours(0, 0, 0, 0);

    const revisionHoy = await db('revisiones_diarias')
      .where({ conductor_id: conductorInfo.conductor_id })
      .whereRaw('DATE(fecha_revision) = ?', [hoyISO])
      .first();

    const proximoReinicio = new Date(inicioHoy);
    proximoReinicio.setDate(proximoReinicio.getDate() + 1);

    // 4. ENSAMBLAR LA RESPUESTA (Según el blueprint)
    const respuesta = {
      success: true,
      conductor: {
        nombre_conductor: conductorInfo.nombre_conductor,
        status: conductorInfo.status,
        status_trabajo: conductorInfo.status_trabajo,
        categoria: conductorInfo.categoria,
        fecha_ingreso: conductorInfo.fecha_ingreso
      },
      vehiculo_asignado: conductorInfo.vehiculo_id ? {
        numero_vehiculo: conductorInfo.numero_vehiculo,
        marca: conductorInfo.marca,
        modelo: conductorInfo.modelo,
        placa: conductorInfo.placa,
        kilometraje_actual: conductorInfo.kilometraje_actual,
        proximo_mantenimiento_km: conductorInfo.proximo_mantenimiento_km // <-- Esta línea ya funcionará gracias al 'as'
      } : null,
      finanzas: {
        tipo_poliza: conductorInfo.tipo_poliza,
        saldo_poliza_mecanica: parseFloat(conductorInfo.saldo_poliza_mecanica || 0),
        limite_poliza: 50000.00, // Límite de Póliza $100
        total_aportado_poliza: parseFloat(conductorInfo.total_aportado_poliza || 0),
        saldo_ahorro_mantenimiento: parseFloat(conductorInfo.saldo_ahorro_mantenimiento || 0)
      },
      estado_rentas: {
        rentas_pendientes: rentas_pendientes,
        dias_de_tolerancia_restantes: dias_de_tolerancia_restantes,
        monto_deuda_total: monto_deuda_total,
        estado_cuenta: estado_cuenta
      },
      revision_diaria: {
        completada_hoy: !!revisionHoy,
        requiere_revision: !revisionHoy,
        ultima_revision: revisionHoy ? revisionHoy.fecha_revision : null,
        inicio_dia: inicioHoy.toISOString(),
        proximo_reinicio: proximoReinicio.toISOString()
      },
      alertas: {
        amonestaciones_activas: parseInt(amonestaciones?.total || 0),
        mantenimiento_pendiente: mant_pendiente || null, // Devuelve el objeto de mantenimiento o null
        mantenimiento_preventivo: mantenimientoPreventivo,
        mantenimiento_plan: mantenimientoPlan,
        siniestro_pendiente: siniestro_pendiente ? {
          id: siniestro_pendiente.id,
          folio: siniestro_pendiente.folio_siniestro,
          estado: siniestro_pendiente.estado
        } : null
      }
    };

    res.json(respuesta);

  } catch (error) {
    console.error(`Error obteniendo dashboard del conductor (User: ${req.user.id}):`, error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los datos del dashboard',
      error: error.message
    });
  }
};


// Obtener información del conductor
const getMiInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    // (Esta función 'findConductorByEmail' es antigua, la nueva usa 'usuario_id')
    const conductor = await findConductorByEmail(req.user.email); 
    
    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    // Obtener vehículo asignado si existe
    let vehiculo = null;
    if (conductor.NumeroVehiculo) {
      try {
        const vehiculoRecords = await getWithFilter(
          TABLES.VEHICULOS, 
          `{NumeroVehiculo} = '${conductor.NumeroVehiculo}'`
        );
        vehiculo = vehiculoRecords[0] || null;
      } catch (error) {
        console.error('Error obteniendo vehículo:', error);
      }
    }

    res.json({
      success: true,
      conductor: {
        ...conductor,
        vehiculo
      }
    });

  } catch (error) {
    console.error('Error obteniendo información del conductor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información'
    });
  }
};

// Obtener rentas del conductor
const getMisRentas = async (req, res) => {
  try {
    const userId = req.user.id;
    const conductor = await findConductorByEmail(req.user.email);
    
    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    const rentas = await getRentasPendientesByConductor(conductor.id);
    
    // Calcular totales de TODAS las rentas no pagadas
    const totalPendiente = rentas
      .filter(r => r.Estado !== 'Pagada')
      .reduce((sum, r) => sum + (r.MontoTotal || 0), 0);

    // Contar días vencidos para socios SD
    const diasVencidos = rentas.filter(r => r.Estado === 'Vencida').length;
    const enTolerancia = rentas.filter(r => r.Estado === 'EnTolerancia').length;

    res.json({
      success: true,
      totalPendiente,
      diasVencidos,
      enTolerancia,
      tipoSocio: conductor.TipoSocio,
      rentas
    });

  } catch (error) {
    console.error('Error obteniendo rentas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rentas'
    });
  }
};

// Obtener mantenimientos del vehículo asignado
const getMisMantenimientos = async (req, res) => {
  try {
    const userId = req.user.id;
    const conductor = await findConductorByEmail(req.user.email);
    
    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    if (!conductor.NumeroVehiculo) {
      return res.json({
        success: true,
        mantenimientos: [],
        message: 'No tiene vehículo asignado'
      });
    }

    // Buscar mantenimientos del vehículo
    const mantenimientos = await getWithFilter(
      TABLES.MANTENIMIENTOS,
      `{VehiculoID} = '${conductor.NumeroVehiculo}'`,
      [{field: "FechaProgramada", direction: "desc"}]
    );

    res.json({
      success: true,
      mantenimientos
    });

  } catch (error) {
    console.error('Error obteniendo mantenimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mantenimientos'
    });
  }
};

// Registrar kilometraje
const registrarKilometraje = async (req, res) => {
  try {
    const { kilometraje } = req.body;
    const userId = req.user.id;
    
    const conductor = await findConductorByEmail(req.user.email);
    
    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    if (!conductor.NumeroVehiculo) {
      return res.status(400).json({
        success: false,
        message: 'No tiene vehículo asignado'
      });
    }

    // Buscar el vehículo
    const vehiculos = await getWithFilter(
      TABLES.VEHICULOS,
      `{NumeroVehiculo} = '${conductor.NumeroVehiculo}'`
    );

    if (vehiculos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado'
      });
    }

    // Actualizar kilometraje del vehículo
    const vehiculoActualizado = await update(TABLES.VEHICULOS, vehiculos[0].id, {
      KilometrajeActual: kilometraje,
      UltimaActualizacionKm: new Date().toISOString()
    });

    // Calcular próximo mantenimiento
    const proximoMantenimiento = Math.ceil(kilometraje / 10000) * 10000;
    
    // --- CORRECCIÓN AQUÍ TAMBIÉN ---
    // (Tu código antiguo también tenía este error, lo corrijo)
    if (proximoMantenimiento !== vehiculos[0].proximo_mantenimiento) {
      await update(TABLES.VEHICULOS, vehiculos[0].id, {
        proximo_mantenimiento: proximoMantenimiento // Usamos el nombre correcto
      });
    }

    res.json({
      success: true,
      message: 'Kilometraje registrado exitosamente',
      kilometraje,
      proximoMantenimiento
    });

  } catch (error) {
    console.error('Error registrando kilometraje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar kilometraje'
    });
  }
};

// Reportar siniestro
const reportarSiniestro = async (req, res) => {
  try {
    const { descripcion, ubicacion, tipoSiniestro, fotosURLs } = req.body;
    const userId = req.user.id;
    
    const conductor = await findConductorByEmail(req.user.email);
    
    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    const nuevoSiniestro = await create(TABLES.SINIESTROS, {
      ConductorID: conductor.id,
      VehiculoID: conductor.NumeroVehiculo || '',
      FechaIncidente: new Date().toISOString(),
      TipoSiniestro: tipoSiniestro || 'Otro',
      Descripcion: descripcion,
      Ubicacion: ubicacion,
      FotosURLs: fotosURLs || '',
      Estado: 'Reportado',
      ReportadoPor: conductor.NombreCompleto
    });

    res.json({
      success: true,
      message: 'Siniestro reportado exitosamente',
      siniestro: nuevoSiniestro
    });

  } catch (error) {
    console.error('Error reportando siniestro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reportar siniestro'
    });
  }
};

// Obtener historial de pagos
const getHistorialPagos = async (req, res) => {
  try {
    const userId = req.user.id;
    const conductor = await findConductorByEmail(req.user.email);
    
    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    const pagos = await getWithFilter(
      TABLES.RENTAS,
      `AND({ConductorID} = '${conductor.id}', {Estado} = 'Pagada')`,
      [{field: "FechaPago", direction: "desc"}]
    );

    res.json({
      success: true,
      total: pagos.length,
      pagos
    });

  } catch (error) {
    console.error('Error obteniendo historial de pagos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial'
    });
  }
};

module.exports = {
  // Exportamos la nueva función
  getDriverDashboard, 
  
  // (Funciones existentes)
  getMiInfo,
  getMisRentas,
  getMisMantenimientos,
  registrarKilometraje,
  reportarSiniestro,
  getHistorialPagos
};
