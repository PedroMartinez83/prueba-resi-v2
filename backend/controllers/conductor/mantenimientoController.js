// backend/controllers/conductor/mantenimientoController.js
const { db } = require('../../config/database');

// =====================================================
// OBTENER MIS MANTENIMIENTOS
// =====================================================
const getMisMantenimientos = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;
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

    // Obtener mantenimientos del vehículo
    const mantenimientos = await db('mantenimientos')
      .where({ vehiculo_id: asignacion.vehiculo_id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .select('*');

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
// OBTENER MANTENIMIENTO POR ID
// =====================================================
const getMantenimientoById = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;
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

    // Obtener mantenimiento
    const mantenimiento = await db('mantenimientos')
      .where({ id, vehiculo_id: asignacion.vehiculo_id })
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

// =====================================================
// SOLICITAR MANTENIMIENTO
// =====================================================
const solicitarMantenimiento = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;
    const {
      tipo_servicio,
      descripcion,
      urgente,
      kilometraje_actual,
      fecha_programada,
      hora_programada
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

    const fechaHoraProgramada = new Date(`${fecha_programada}T${hora_programada}:00`);
    if (isNaN(fechaHoraProgramada.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Fecha u hora inválida'
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

    // Generar folio único
    const ultimoFolio = await db('mantenimientos')
      .max('folio_servicio as ultimo')
      .first();

    const nuevoFolio = (ultimoFolio?.ultimo || 0) + 1;

    // Determinar estado inicial
    const estadoInicial = urgente ? 'Urgente' : 'Pendiente';

    // Crear solicitud de mantenimiento
    const [nuevoMantenimiento] = await db('mantenimientos')
      .insert({
        folio_servicio: nuevoFolio,
        vehiculo_id: asignacion.vehiculo_id,
        tipo_servicio,
        estado: estadoInicial,
        status: 'Todo',
        kilometraje_servicio: kilometraje_actual ? parseInt(kilometraje_actual) : vehiculo.kilometraje_actual,
        fecha_programada: fechaHoraProgramada,
        observaciones: descripcion,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Solicitud de mantenimiento creada correctamente',
      mantenimiento: {
        id: nuevoMantenimiento.id,
        folio_servicio: nuevoMantenimiento.folio_servicio,
        tipo_servicio: nuevoMantenimiento.tipo_servicio,
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
  getMantenimientoById,
  solicitarMantenimiento
};