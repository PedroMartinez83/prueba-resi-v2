// backend/routes/asignacionesRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');  // ← AGREGAR ESTA LÍNEA
const { requirePermission } = require('../middleware/roleMiddleware');
const asignacionesController = require('../controllers/admin/asignacionesAdminController');

// ========== APLICAR VERIFICACIÓN DE TOKEN A TODAS LAS RUTAS ==========
router.use(verifyToken);  // ← AGREGAR ESTA LÍNEA

// ========== RUTAS DE HISTORIAL - CON AUTENTICACIÓN SEGURA ==========
router.get('/vehiculo/:numero_serie/historial',
  requirePermission('vehiculos.view'),
  asignacionesController.getHistorialVehiculoPorSerie
);

router.get('/vehiculo/:vehiculo_id/historial',
  requirePermission('vehiculos.view'),
  asignacionesController.getHistorialVehiculo
);

// ========== OTRAS RUTAS - CON PERMISOS ==========
router.get('/activa/:vehiculo_id',
  requirePermission('vehiculos.view'),
  asignacionesController.getAsignacionActiva
);

router.post('/:id/contrato',
  requirePermission('vehiculos.update'),
  asignacionesController.subirContrato
);

router.get('/conductores-disponibles',
  requirePermission('vehiculos.view'),
  asignacionesController.getConductoresDisponibles
);

router.post('/cambiar-conductor',
  requirePermission('vehiculos.update'),
  asignacionesController.cambiarConductor
);

module.exports = router;