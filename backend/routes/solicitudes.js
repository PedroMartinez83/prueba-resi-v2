// backend/routes/solicitudes.js
const express = require('express');
const router = express.Router();
const { uploadToCloudinary } = require('../middleware/cloudinaryUpload');
const { 
  crearSolicitud, 
  consultarEstadoSolicitud 
} = require('../controllers/solicitudController');

// ========== RUTAS PÚBLICAS (Sin autenticación) ==========

/**
 * Crear nueva solicitud de conductor
 * POST /api/solicitudes
 * 
 * express-fileupload ya procesó los archivos en server.js
 * Los archivos están disponibles en req.files
 */
router.post('/', 
  uploadToCloudinary,  // ✅ Sube archivos a Cloudinary primero
  crearSolicitud       // ✅ Luego guarda en DB con las URLs
);
/**
 * Consultar estado de solicitud por teléfono
 * GET /api/solicitudes/estado/:telefono
 */
router.get('/estado/:telefono', consultarEstadoSolicitud);

/**
 * Endpoint para validar si un teléfono ya tiene solicitud
 * GET /api/solicitudes/validar/:telefono
 */
router.get('/validar/:telefono', async (req, res) => {
  try {
    const { telefono } = req.params;
    const { findSolicitudByContacto } = require('../services/postgresService');
    
    const telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono inválido'
      });
    }

    const solicitudExistente = await findSolicitudByContacto(telefonoLimpio);
    
    if (solicitudExistente) {
      return res.json({
        success: true,
        existe: true,
        estatus: solicitudExistente.estatus_solicitud,
        fecha_solicitud: solicitudExistente.fecha_solicitud
      });
    } else {
      return res.json({
        success: true,
        existe: false
      });
    }

  } catch (error) {
    console.error('Error validando teléfono:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar teléfono'
    });
  }
});

/**
 * Endpoint de prueba
 * GET /api/solicitudes/test
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'API de solicitudes funcionando correctamente',
    timestamp: new Date().toISOString(),
    endpoints_disponibles: [
      'POST /api/solicitudes - Crear solicitud',
      'GET /api/solicitudes/estado/:telefono - Consultar estado',
      'GET /api/solicitudes/validar/:telefono - Validar teléfono'
    ]
  });
});

module.exports = router;