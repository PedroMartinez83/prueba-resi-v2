const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const multer = require('multer');

// Configuración de Multer para subir archivos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB máximo (para videos de revisión diaria)
  }
});

// Controllers
const {
  getDriverDashboard,
  getMiInfo,
  getMisRentas,
  getMisMantenimientos,
  registrarKilometraje,
  reportarSiniestro,
  getHistorialPagos
} = require('../controllers/conductorController');

const pagosController = require('../controllers/conductor/pagosController');

// ========== 🆕 NUEVOS CONTROLLERS ==========
const perfilController = require('../controllers/conductor/perfilController');
const vehiculoController = require('../controllers/conductor/vehiculoController');
const siniestroController = require('../controllers/conductor/siniestroController');
const mantenimientoController = require('../controllers/conductor/mantenimientoController');
const documentoController = require('../controllers/conductor/documentoController');

// Todas las rutas requieren autenticación y rol de conductor
router.use(verifyToken);
router.use(checkRole('conductor', 'super_admin'));
 // Admin también puede acceder

// ========================================
// DASHBOARD PRINCIPAL
// ========================================
/**
 * GET /api/conductor/dashboard
 * Obtiene todos los datos agregados para el Dashboard
 */
router.get('/dashboard', getDriverDashboard);

// ========================================
// PERFIL DEL CONDUCTOR
// ========================================
/**
 * GET /api/conductor/perfil
 * Obtiene información completa del perfil del conductor
 */
router.get('/perfil', perfilController.getMiPerfil);

/**
 * PUT /api/conductor/perfil/actualizar
 * Actualiza datos del perfil (teléfono, dirección, etc.)
 */
router.put('/perfil/actualizar', perfilController.actualizarPerfil);

/**
 * PUT /api/conductor/perfil/cambiar-password
 * Cambia la contraseña del conductor
 */
router.put('/perfil/cambiar-password', perfilController.cambiarPassword);

// ========================================
// MI VEHÍCULO
// ========================================
/**
 * GET /api/conductor/vehiculo
 * Obtiene información del vehículo asignado
 */
router.get('/vehiculo', vehiculoController.getMiVehiculo);

/**
 * POST /api/conductor/vehiculo/revision-diaria
 * Sube video/fotos de la revisión diaria del vehículo
 * Acepta: video (1 minuto), fotos opcionales, comentarios
 */
router.post(
  '/vehiculo/revision-diaria', 
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'fotos', maxCount: 5 }
  ]),
  vehiculoController.subirRevisionDiaria
);

/**
 * GET /api/conductor/vehiculo/revisiones
 * Obtiene historial de revisiones diarias
 */
router.get('/vehiculo/revisiones', vehiculoController.getHistorialRevisiones);

/**
 * POST /api/conductor/vehiculo/actualizar-kilometraje
 * Actualiza el kilometraje del vehículo
 */
router.post('/vehiculo/actualizar-kilometraje', registrarKilometraje);

// ========================================
// PAGOS DE RENTA
// ========================================
/**
 * GET /api/conductor/pagos
 * Obtiene historial de pagos del conductor
 */
router.get('/pagos', pagosController.getMisPagos);

/**
 * GET /api/conductor/pagos/resumen
 * Obtiene resumen de cuenta (saldos, próximos pagos, etc.)
 */
router.get('/pagos/resumen', pagosController.getResumenCuenta);

/**
 * GET /api/conductor/pagos/ponerse-al-tanto/resumen
 * Obtiene resumen de adeudos para ponerse al tanto
 */
router.get('/pagos/ponerse-al-tanto/resumen', pagosController.getResumenPonerseAlTanto);

/**
 * POST /api/conductor/pagos/registrar
 * Registra un pago de renta (sube comprobante)
 * Acepta: monto, fecha_pago, comprobante (imagen)
 */
router.post('/pagos/registrar', upload.single('comprobante'), pagosController.registrarPago);


/**
 * GET /api/conductor/pagos/mi-saldo-poliza
 * Obtiene saldo de póliza mecánica
 */
router.get('/pagos/mi-saldo-poliza', pagosController.getMiSaldoPoliza);

// ========================================
// SINIESTROS
// ========================================
/**
 * GET /api/conductor/siniestros
 * Obtiene mis siniestros reportados
 */
router.get('/siniestros', siniestroController.getMisSiniestros);

/**
 * GET /api/conductor/siniestros/:id
 * Obtiene detalle de un siniestro específico
 */
router.get('/siniestros/:id', siniestroController.getSiniestroById);

/**
 * POST /api/conductor/siniestros/registrar
 * Registra un nuevo siniestro (con fotos/videos)
 * Acepta: descripcion, tipo_siniestro, ubicacion, fotos[], videos[]
 */
router.post(
  '/siniestros/registrar',
  upload.fields([
    { name: 'fotos', maxCount: 10 },
    { name: 'videos', maxCount: 3 }
  ]),
  siniestroController.registrarSiniestro
);

// ========================================
// MANTENIMIENTOS
// ========================================
/**
 * GET /api/conductor/mantenimientos
 * Obtiene mis solicitudes de mantenimiento
 */
router.get('/mantenimientos', mantenimientoController.getMisMantenimientos);

/**
 * GET /api/conductor/mantenimientos/:id
 * Obtiene detalle de un mantenimiento específico
 */
router.get('/mantenimientos/:id', mantenimientoController.getMantenimientoById);

/**
 * POST /api/conductor/mantenimientos/solicitar
 * Solicita un mantenimiento
 * Acepta: tipo_servicio, descripcion, urgente (boolean)
 */
router.post('/mantenimientos/solicitar', mantenimientoController.solicitarMantenimiento);

// ========================================
// DOCUMENTOS
// ========================================
/**
 * GET /api/conductor/documentos
 * Obtiene mis documentos (INE, licencia, etc.)
 */
router.get('/documentos', documentoController.getMisDocumentos);

/**
 * POST /api/conductor/documentos/subir
 * Sube o actualiza un documento
 * Acepta: tipo_documento, archivo
 */
router.post(
  '/documentos/subir',
  upload.single('archivo'),
  documentoController.subirDocumento
);

// ========================================
// NOTIFICACIONES
// ========================================
/**
 * GET /api/conductor/notificaciones
 * Obtiene notificaciones del conductor
 */
router.get('/notificaciones', (req, res) => {
  // TODO: Implementar cuando tengas el módulo de notificaciones
  res.json({ success: true, notificaciones: [] });
});

/**
 * PUT /api/conductor/notificaciones/:id/leer
 * Marca una notificación como leída
 */
router.put('/notificaciones/:id/leer', (req, res) => {
  // TODO: Implementar cuando tengas el módulo de notificaciones
  res.json({ success: true, message: 'Notificación marcada como leída' });
});

// ========================================
// RUTAS LEGACY (Mantener compatibilidad)
// ========================================
router.get('/mi-info', getMiInfo);
router.get('/mis-rentas', getMisRentas);
router.get('/mis-mantenimientos', getMisMantenimientos);
router.post('/reportar-siniestro', reportarSiniestro);
router.get('/historial-pagos', getHistorialPagos);



module.exports = router;
