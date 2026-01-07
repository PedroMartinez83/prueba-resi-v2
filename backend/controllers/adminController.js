// backend/controllers/adminController.js
const postgresService = require('../services/postgresService');
const { TABLES, db } = postgresService;


// ========== CONTROLADORES DE CONDUCTORES ==========
exports.getConductores = async (req, res) => {
  try {
    console.log('✅ Obteniendo conductores desde PostgreSQL...');
    const conductores = await postgresService.getAll(TABLES.CONDUCTORES);
    res.json({
      success: true,
      conductores
    });
  } catch (error) {
    console.error('❌ Error al obtener conductores:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener conductores',
      message: error.message 
    });
  }
};


exports.getConductorById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Buscando conductor con ID:', id);
    
    // Usar postgresService en lugar de pool directamente
    const conductor = await postgresService.getById(TABLES.CONDUCTORES, id);
    
    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    // Por ahora retornar el conductor básico
    // Más adelante puedes agregar estadísticas y viajes
    res.json({
      success: true,
      data: conductor
    });

  } catch (error) {
    console.error('❌ Error obteniendo conductor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener conductor',
      error: error.message
    });
  }
};

exports.createConductor = async (req, res) => {
  try {
    const nuevoConductor = await postgresService.create(TABLES.CONDUCTORES, req.body);
    res.status(201).json({
      success: true,
      conductor: nuevoConductor
    });
  } catch (error) {
    console.error('❌ Error al crear conductor:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al crear conductor',
      message: error.message 
    });
  }
};

exports.updateConductor = async (req, res) => {
  try {
    const { id } = req.params;
    const conductorActualizado = await postgresService.update(TABLES.CONDUCTORES, id, req.body);
    res.json({
      success: true,
      conductor: conductorActualizado
    });
  } catch (error) {
    console.error('❌ Error al actualizar conductor:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al actualizar conductor',
      message: error.message 
    });
  }
};

exports.deleteConductor = async (req, res) => {
  try {
    const { id } = req.params;
    await postgresService.deleteRecord(TABLES.CONDUCTORES, id);
    res.json({
      success: true,
      message: 'Conductor eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al eliminar conductor:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al eliminar conductor',
      message: error.message 
    });
  }
};

exports.getOpcionesConductores = async (req, res) => {
  try {
    // Implementar según necesidades
    res.json({
      status: ['Activo', 'Inactivo', 'Suspendido'],
      categoria: ['A', 'B', 'C'],
      tipo_licencia: ['Federal', 'Estatal']
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ========== CONTROLADORES DE RENTAS ==========
exports.getRentas = async (req, res) => {
  try {
    console.log('✅ Obteniendo rentas desde PostgreSQL...');
    const rentas = await postgresService.getAll(TABLES.RENTAS);
    res.json({
      success: true,
      rentas
    });
  } catch (error) {
    console.error('❌ Error al obtener rentas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener rentas',
      message: error.message 
    });
  }
};

exports.getRentaById = async (req, res) => {
  try {
    const { id } = req.params;
    const renta = await postgresService.getById(TABLES.RENTAS, id);
    
    if (!renta) {
      return res.status(404).json({ 
        success: false,
        error: 'Renta no encontrada' 
      });
    }
    
    res.json(renta);
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getOpcionesRentas = async (req, res) => {
  try {
    res.json({
      estados: ['Pendiente', 'Pagada', 'Vencida', 'Cancelada'],
      metodos_pago: ['Efectivo', 'Transferencia', 'Tarjeta', 'Stripe']
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createRenta = async (req, res) => {
  try {
    const nuevaRenta = await postgresService.create(TABLES.RENTAS, req.body);
    res.status(201).json({
      success: true,
      renta: nuevaRenta
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateRenta = async (req, res) => {
  try {
    const { id } = req.params;
    const rentaActualizada = await postgresService.update(TABLES.RENTAS, id, req.body);
    res.json({
      success: true,
      renta: rentaActualizada
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.actualizarEstadoRenta = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, fecha_pago, metodo_pago } = req.body;
    
    const rentaActualizada = await postgresService.update(TABLES.RENTAS, id, {
      estado,
      fecha_pago,
      metodo_pago
    });
    
    res.json({
      success: true,
      renta: rentaActualizada
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteRenta = async (req, res) => {
  try {
    const { id } = req.params;
    await postgresService.deleteRecord(TABLES.RENTAS, id);
    res.json({
      success: true,
      message: 'Renta eliminada exitosamente'
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ========== CONTROLADORES DE MANTENIMIENTOS ==========
exports.getMantenimientos = async (req, res) => {
  try {
    const mantenimientos = await postgresService.getAll(TABLES.MANTENIMIENTOS);
    res.json({
      success: true,
      mantenimientos
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.programarMantenimiento = async (req, res) => {
  try {
    const nuevoMantenimiento = await postgresService.create(TABLES.MANTENIMIENTOS, req.body);
    res.status(201).json({
      success: true,
      mantenimiento: nuevoMantenimiento
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateMantenimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const mantenimientoActualizado = await postgresService.update(TABLES.MANTENIMIENTOS, id, req.body);
    res.json({
      success: true,
      mantenimiento: mantenimientoActualizado
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};



// ========== ESTADÍSTICAS ==========
exports.getEstadisticasGenerales = async (req, res) => {
  try {
    // Obtener conteos básicos sin traer todas las filas
    const [vehiculos, rentas, conductores] = await Promise.all([
      db(TABLES.VEHICULOS)
        .select(
          db.raw('COUNT(*) as total'),
          db.raw("COUNT(CASE WHEN estado = 'Disponible' THEN 1 END) as disponibles"),
          db.raw("COUNT(CASE WHEN estado = 'Rentado' THEN 1 END) as rentados"),
          db.raw("COUNT(CASE WHEN estado = 'Mantenimiento' THEN 1 END) as en_mantenimiento")
        )
        .first(),

      db(TABLES.RENTAS)
        .select(
          db.raw('COUNT(*) as total'),
          db.raw("COUNT(CASE WHEN estado = 'Pendiente' THEN 1 END) as pendientes"),
          db.raw("COUNT(CASE WHEN estado = 'Pagada' THEN 1 END) as pagadas"),
          db.raw("COUNT(CASE WHEN estado = 'Vencida' THEN 1 END) as vencidas")
        )
        .first(),

      db(TABLES.CONDUCTORES)
        .select(
          db.raw('COUNT(*) as total'),
          db.raw("COUNT(CASE WHEN status = 'Aprobado' THEN 1 END) as aprobados"),
          db.raw("COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pendientes"),
          db.raw("COUNT(CASE WHEN status = 'Rechazado' THEN 1 END) as rechazados"),
          db.raw("COUNT(CASE WHEN status = 'Aprobado' AND COALESCE(status_trabajo, '') = 'activo' THEN 1 END) as activos"),
          db.raw("COUNT(CASE WHEN status = 'Aprobado' AND COALESCE(status_trabajo, '') <> 'activo' THEN 1 END) as inactivos")
        )
        .first()
    ]);

    const estadisticas = {
      totalVehiculos: parseInt(vehiculos.total) || 0,
      vehiculosDisponibles: parseInt(vehiculos.disponibles) || 0,
      vehiculosRentados: parseInt(vehiculos.rentados) || 0,
      vehiculosMantenimiento: parseInt(vehiculos.en_mantenimiento) || 0,

      totalConductores: parseInt(conductores.total) || 0,
      conductoresAprobados: parseInt(conductores.aprobados) || 0,
      conductoresPendientes: parseInt(conductores.pendientes) || 0,
      conductoresRechazados: parseInt(conductores.rechazados) || 0,
      conductoresActivos: parseInt(conductores.activos) || 0,
      conductoresInactivos: parseInt(conductores.inactivos) || 0,

      totalRentas: parseInt(rentas.total) || 0,
      rentasPendientes: parseInt(rentas.pendientes) || 0,
      rentasPagadas: parseInt(rentas.pagadas) || 0,
      rentasVencidas: parseInt(rentas.vencidas) || 0
    };
    
    res.json({
      success: true,
      estadisticas
    });
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener estadísticas',
      message: error.message 
    });
  }
};