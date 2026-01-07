// backend/controllers/admin/conductoresDisponiblesController.js
const postgresService = require('../../services/postgresService');
const auditService = require('../../services/auditService');

const { db } = postgresService;

/**
 * Obtener conductores disponibles para asignación
 * - Sin vehículo asignado actualmente
 * - Status: Aprobado
 * - Ordenados alfabéticamente
 */
exports.getConductoresDisponibles = async (req, res) => {
  try {
    const conductores = await db('conductores as c')
      .leftJoin('asignaciones as a', function() {
        this.on('c.id', '=', 'a.conductor_id')
            .andOn('a.activa', '=', db.raw('true'))
      })
      .whereNull('a.id') // Solo conductores SIN asignación activa
      .where('c.status', 'Aprobado') // Solo aprobados
      .select(
        'c.id',
        'c.nombre_conductor',
        'c.numero_telefono',
        'c.email',
        'c.categoria',
        'c.calificacion_promedio',
        'c.status',
        'c.fecha_ingreso',
        'c.numero_de_ine_ife',
        'c.licencia_conducir',
        'c.licencia_vigencia',
        'c.direccion_completa',
        'c.fecha_nacimiento',
        'c.deposito'
      )
      .orderBy('c.nombre_conductor');
    
    res.json({
      success: true,
      conductores: conductores.map(c => ({
        id: c.id,
        nombre: c.nombre_conductor,
        telefono: c.numero_telefono,
        email: c.email,
        categoria: c.categoria,
        calificacion: parseFloat(c.calificacion_promedio || 0),
        ine: c.numero_de_ine_ife,
        licencia: c.licencia_conducir,
        licenciaVigencia: c.licencia_vigencia,
        fechaIngreso: c.fecha_ingreso,
        direccion: c.direccion_completa,
        fechaNacimiento: c.fecha_nacimiento,
        deposito: parseFloat(c.deposito || 0)
      })),
      total: conductores.length
    });
    
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo conductores disponibles: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener conductores disponibles',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;