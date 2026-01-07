// backend/routes/inversionistasRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const inversionistasController = require('../controllers/inversionistasController');

// ========== RUTA PÚBLICA (SIN AUTENTICACIÓN) ==========
// Registro público desde portal web
router.post('/registro-publico', 
  inversionistasController.registroPublico
);

// ========== RUTAS PROTEGIDAS (REQUIEREN AUTENTICACIÓN) ==========
router.use(verifyToken);

// Obtener opciones para formularios (listas desplegables)
router.get('/opciones', 
  requirePermission('inversiones.view'),
  inversionistasController.getOpcionesInversionistas
);

// ========== GESTIÓN DE SOLICITUDES ==========
// Obtener todas las solicitudes de inversión
router.get('/solicitudes',
  requirePermission('inversiones.view'),
  inversionistasController.getSolicitudesInversion
);

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

// Obtener un inversionista específico
router.get('/:id',
  requirePermission('inversiones.view'),
  inversionistasController.getInversionistaById
);

// Crear nuevo inversionista
router.post('/',
  requirePermission('inversiones.create'),
  inversionistasController.createInversionista
);

// Actualizar inversionista
router.put('/:id',
  requirePermission('inversiones.update'),
  inversionistasController.updateInversionista
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

module.exports = router;