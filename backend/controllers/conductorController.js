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

// Helper: Cuenta cuántos días hábiles (NO domingos) hay entre dos fechas
const contarDiasDeuda = (fechaUltimoPagoFin, fechaHoy) => {
  // 1. FUNCION INTERNA: Limpiar fecha a string YYYY-MM-DD
  const limpiarFecha = (fecha) => {
    if (!fecha) return null;
    // Si ya es string, tomamos los primeros 10 chars
    if (typeof fecha === 'string') return fecha.substring(0, 10);
    // Si es objeto Date, lo pasamos a ISO y cortamos
    return fecha.toISOString().split('T')[0];
  };

  const strUltimoPago = limpiarFecha(fechaUltimoPagoFin);
  const strHoy = limpiarFecha(fechaHoy);

  // 2. CONFIGURAR CURSOR (Día de inicio del conteo)
  let cursor;
  
  if (strUltimoPago) {
    // Si pagó hasta el día '2026-01-01', la deuda empieza el '2026-01-02'
    // Usamos T12:00:00 para evitar problemas de horario de verano/invierno
    cursor = new Date(`${strUltimoPago}T12:00:00`);
    cursor.setDate(cursor.getDate() + 1); 
  } else {
    // Si es virgen (sin pagos), empieza el 1 de Enero
    cursor = new Date('2026-01-01T12:00:00');
  }

  // 3. CONFIGURAR FIN (Hoy)
  // Usamos T23:59:59 para asegurar que el día de hoy se cuente
  const fin = new Date(`${strHoy}T23:59:59`);

  let diasDeuda = 0;

  // 4. BUCLE DE CONTEO
  // Mientras el cursor sea menor o igual a hoy...
  while (cursor <= fin) {
    // Si NO es domingo (0), sumamos deuda
    if (cursor.getDay() !== 0) {
      diasDeuda++;
    }
    // Avanzamos un día
    cursor.setDate(cursor.getDate() + 1);
  }

  return diasDeuda;
};

/**
 * OBTIENE TODOS LOS DATOS AGREGADOS PARA EL DASHBOARD DEL CONDUCTOR
 * GET /api/conductor/dashboard
 */
const getDriverDashboard = async (req, res) => {
  try {
    // 1. OBTENER CONDUCTOR Y VEHÍCULO
    const usuarioId = req.user?.id;
    const conductorIdFromToken = req.user?.conductorId;

    if (!usuarioId && !conductorIdFromToken) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado o sin identificador valido.'
      });
    }

    let conductorInfoQuery = db('conductores as c')
      .leftJoin('asignaciones as a', function() {
        this.on('c.id', '=', 'a.conductor_id').andOn('a.activa', '=', db.raw('true'))
      })
      .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .select(
        'c.id as conductor_id', 'c.nombre_conductor', 'c.status', 'c.status_trabajo', 'c.categoria', 'c.fecha_ingreso',
        'c.tipo_poliza', 'c.total_aportado_poliza', 'c.saldo_ahorro_mantenimiento', 'c.saldo_poliza_mecanica',
        'v.id as vehiculo_id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa', 'v.kilometraje_actual',
        'v.proximo_mantenimiento as proximo_mantenimiento_km',
        // 🚨 AGREGAMOS a.fecha_inicio AQUÍ PARA SABER CUÁNDO ARRANCÓ EL CHOFER 🚨
        'a.id as asignacion_id', 'a.fecha_inicio as fecha_asignacion', 'a.renta_diaria', 'a.abono_poliza_mantenimiento as poliza_diaria'
      );

    if (conductorIdFromToken) {
      conductorInfoQuery = conductorInfoQuery.where('c.id', conductorIdFromToken);
    } else {
      conductorInfoQuery = conductorInfoQuery.where('c.usuario_id', usuarioId);
    }

    let conductorInfo = await conductorInfoQuery.first();

    // Fallback de email
    if (!conductorInfo && usuarioId) {
      const emailRaw = req.user?.email || req.user?.name || '';
      const emailNormalized = emailRaw.toString().trim().toLowerCase();

      if (!emailNormalized) {
        return res.status(404).json({ success: false, message: 'Perfil no encontrado.' });
      }

      const conductorByEmail = await db('conductores').where('email', emailNormalized).first();
      if (conductorByEmail) {
        await db('conductores').where('id', conductorByEmail.id).update({ usuario_id: usuarioId, updated_at: new Date() });
        conductorInfo = await conductorInfoQuery.clearWhere().where('c.id', conductorByEmail.id).first();
      }
    }

    if (!conductorInfo) {
      return res.status(404).json({ success: false, message: 'Perfil de conductor no encontrado.' });
    }

    // =========================================================================
    // 2. OBTENER ESTADO DE RENTAS (NUEVA LÓGICA INTELIGENTE 🧠)
    // =========================================================================
    
    const ultimoPago = await db('pagos_diarios')
      .where('asignacion_id', conductorInfo.asignacion_id)
      .whereIn('status', ['Confirmado', 'Pagada']) 
      .orderByRaw('COALESCE(fecha_pago_fin, fecha_pago) DESC')
      .first();

    // B. Determinamos la fecha límite cubierta o LA FECHA DE ASIGNACIÓN
    let fechaCubierta = null;
    let esChoferNuevo = false;

    if (ultimoPago) {
      fechaCubierta = ultimoPago.fecha_pago_fin || ultimoPago.fecha_pago;
    } else if (conductorInfo.fecha_asignacion) {
      // 🛡️ ESCUDO: Si no hay pagos, no debe desde 1970, debe empezar a contar desde su asignación
      fechaCubierta = conductorInfo.fecha_asignacion;
      esChoferNuevo = true;
    }

    // C. Calculamos los días de atraso reales
    const hoyISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' }); // Forzamos el formato ISO limpio YYYY-MM-DD
    
    let rentas_pendientes = 0;
    let monto_deuda_total = 0;

    if (conductorInfo.vehiculo_id && fechaCubierta) {
        // Aseguramos que la fecha cubierta esté en el formato correcto para tu helper
        const fechaCorte = new Date(fechaCubierta).toISOString().split('T')[0];
        
        // Llamamos a tu función para que calcule los días hábiles
        rentas_pendientes = contarDiasDeuda(fechaCorte, hoyISO);
        
        // 🛡️ PARCHE PARA NUEVOS: Si se lo diste hoy o en el futuro, los días de deuda se fuerzan a 0
        if (esChoferNuevo && fechaCorte >= hoyISO) {
          rentas_pendientes = 0;
        }

        // Si sale negativo (porque va adelantado), lo topamos a 0
        rentas_pendientes = Math.max(0, rentas_pendientes);

        console.log(`📊 CALCULO DEUDA: Último Pago/Asig: ${fechaCorte} | Hoy: ${hoyISO} | Días Deuda: ${rentas_pendientes}`);
        
        const costoDiario = parseFloat(conductorInfo.renta_diaria || 400) + parseFloat(conductorInfo.poliza_diaria || 100);
        monto_deuda_total = rentas_pendientes * costoDiario;
    }

    // Lógica visual
    const dias_de_tolerancia_restantes = Math.max(0, 2 - rentas_pendientes);
    const estado_cuenta = rentas_pendientes > 0 ? 'Atrasado' : 'Al Corriente';

    // =========================================================================
    // 3. OBTENER ALERTAS 
    // =========================================================================
    const [amonestaciones, mant_pendiente, siniestro_pendiente] = await Promise.all([
      db('amonestaciones_conductores').where('conductor_id', conductorInfo.conductor_id).count('id as total').first(),
      db('mantenimientos').where('vehiculo_id', conductorInfo.vehiculo_id).where('estado', 'Programado').orderBy('fecha_programada', 'asc').first(),
      db('siniestros').where('conductor_id', conductorInfo.conductor_id).whereIn('estado', ['Reportado', 'En revisión', 'En proceso']).orderBy('fecha_incidente', 'desc').first()
    ]);

    const mantenimientoPreventivo = conductorInfo.vehiculo_id
      ? getPreventiveMaintenanceAlert({ modelo: conductorInfo.modelo, kilometrajeActual: conductorInfo.kilometraje_actual })
      : null;

    const mantenimientoPlan = conductorInfo.vehiculo_id
      ? getMaintenancePlanContext({ modelo: conductorInfo.modelo, kilometrajeActual: conductorInfo.kilometraje_actual })
      : null;

    // 3.1 Revisión diaria
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const hoyLimpio = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' });
    const revisionHoy = await db('revisiones_diarias')
      .where({ conductor_id: conductorInfo.conductor_id })
      .whereRaw('DATE(fecha_revision) = ?', [hoyLimpio])
      .first();
    
    const proximoReinicio = new Date(inicioHoy);
    proximoReinicio.setDate(proximoReinicio.getDate() + 1);

    // 4. RESPUESTA
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
        proximo_mantenimiento_km: conductorInfo.proximo_mantenimiento_km
      } : null,
      finanzas: {
        tipo_poliza: conductorInfo.tipo_poliza,
        saldo_poliza_mecanica: parseFloat(conductorInfo.saldo_poliza_mecanica || 0),
        limite_poliza: 50000.00,
        total_aportado_poliza: parseFloat(conductorInfo.total_aportado_poliza || 0),
        saldo_ahorro_mantenimiento: parseFloat(conductorInfo.saldo_ahorro_mantenimiento || 0)
      },
      estado_rentas: {
        rentas_pendientes: rentas_pendientes, 
        dias_de_tolerancia_restantes: dias_de_tolerancia_restantes,
        monto_deuda_total: monto_deuda_total, 
        estado_cuenta: estado_cuenta,
        // 🚨 Le mandamos la fecha de asignación al frontend para que la use como salvavidas
        fecha_inicio_asignacion: conductorInfo.fecha_asignacion ? new Date(conductorInfo.fecha_asignacion).toISOString() : null,
        ultimo_pago_fecha: fechaCubierta 
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
        mantenimiento_pendiente: mant_pendiente || null,
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
    console.error(`Error obteniendo dashboard:`, error);
    res.status(500).json({ success: false, message: 'Error al obtener los datos del dashboard', error: error.message });
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
  contarDiasDeuda,
  // (Funciones existentes)
  getMiInfo,
  getMisRentas,
  getMisMantenimientos,
  registrarKilometraje,
  reportarSiniestro,
  getHistorialPagos
};
