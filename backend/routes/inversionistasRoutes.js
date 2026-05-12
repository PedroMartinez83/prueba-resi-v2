// backend/routes/inversionistasRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const inversionistasController = require('../controllers/inversionistasController');


// ========== RUTAS PROTEGIDAS (REQUIEREN AUTENTICACIÓN) ==========
router.use(verifyToken);

// Obtener opciones para formularios (listas desplegables)
router.get('/opciones', 
  requirePermission('inversiones.view'),
  inversionistasController.getOpcionesInversionistas
);

// ========== GESTIÓN DE SOLICITUDES ==========

// Crear nueva solicitud de inversión
router.post('/solicitudes',
  verifyToken ,
  inversionistasController.crearSolicitudInversion
);

// Obtener todas las solicitudes de inversión
router.get('/solicitudes',
  requirePermission('inversiones.view'),
  inversionistasController.getSolicitudesInversion
);

// Obtener solicitudes propias del inversionista
router.get('/mis-solicitudes', 
  verifyToken, 
  inversionistasController.getMisSolicitudes);

// Aprobar solicitud y crear inversionista
router.post('/solicitudes/:id/aprobar',
  requirePermission('inversiones.create'),
  inversionistasController.aprobarSolicitud
);

// Rechazar solicitud
router.post('/solicitudes/:id/rechazar',
  requirePermission('inversiones.update'),
  inversionistasController.rechazarSolicitud
);

// inversionistasRoutes.js
router.get('/pagos', 
  verifyToken, 
  inversionistasController.getHistorialPagos);

// ========== GESTIÓN DE INVERSIONISTAS ==========
// Obtener todos los inversionistas
router.get('/', 
  requirePermission('inversiones.view'),
  inversionistasController.getInversionistas
);

// Obtener dashboard de un inversionista
router.get('/:id/dashboard',
  requirePermission('inversiones.view'),
  inversionistasController.getDashboardInversionista
);

router.get(
  '/verificar', 
  requirePermission('inversiones.view'),
  inversionistasController.verificarCampoDuplicado
);

// Radar de duplicados en tiempo real para el Inversionista
router.get(
  '/verificar-duplicado', verifyToken,
   inversionistasController.verificarDuplicadoPerfil);


// ========== Perfil del Inversionista ==========
// Obtener el perfil del inversionista logueado
router.get('/mi-perfil', 
  verifyToken, inversionistasController.getMiPerfil
);

// Actualizar la información del propio inversionista
router.put('/mi-perfil', 
  verifyToken, 
  inversionistasController.editarMiPerfil
);

// Obtener un inversionista específico
router.get('/:id',
  requirePermission('inversiones.view'),
  inversionistasController.getInversionistaById
);


// Crear nuevo inversionista
router.post(
  '/', 
  requirePermission('inversiones.create'), // Ajusta tus roles
  inversionistasController.crearInversionista
);



// Actualizar inversionista
router.put('/:id',
  requirePermission('inversiones.update'),
  inversionistasController.editarInversionista
);

// 🔴 NUEVA RUTA PARA ELIMINAR (Borrado Lógico)
router.delete(
  '/:id', 
  requirePermission('inversiones.delete'),
  inversionistasController.eliminarInversionista
);

// ========== GESTIÓN DE CONTRATOS/INVERSIONES ==========
// Crear nuevo contrato de inversión
router.post('/inversiones/crear-contrato',
  requirePermission('inversiones.create'),
  inversionistasController.crearContrato
);

// Obtener vehículos disponibles para inversión
router.get('/vehiculos/disponibles',
  requirePermission('inversiones.view'),
  inversionistasController.getVehiculosDisponibles
);

// Obtener los datos bancarios de AutoManager para realizar transferencias
router.get('/configuracion/banco', 
  verifyToken, 
  inversionistasController.getDatosBancarios
);

// Actualizar la cuenta bancaria de la empresa (Requiere permisos de admin)
router.put('/configuracion/banco/:id', 
  requirePermission('inversiones.update'), 
  inversionistasController.updateDatosBancarios
);

// Historial de cambios del perfil
router.get('/mi-perfil/auditoria', 
  verifyToken,
  inversionistasController.getMisAuditoriasPerfil
);



module.exports = router;