// backend/routes/vehiculosRoutes.js
const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/roleMiddleware');

// Controllers
const vehiculosController = require('../controllers/vehiculosController');

// ========== RUTAS ESPECIALES (VAN PRIMERO) ==========
router.get('/opciones',
  requirePermission('vehiculos.view'),
  vehiculosController.getOpcionesVehiculos
);
router.get('/disponibles',
  requirePermission('vehiculos.view'),
  vehiculosController.getVehiculosDisponibles
);
router.get('/estadisticas',
  requirePermission('estadisticas.view'),
  vehiculosController.getEstadisticasVehiculos
);

// ✅ NUEVA RUTA: Obtener pólizas de seguro
router.get('/polizas-seguro',
  requirePermission('vehiculos.view'),
  vehiculosController.getPolizasSeguro
);


// ========== ACCIONES ESPECÍFICAS CON PARÁMETROS ==========
router.post('/:id/asignar-conductor',
  requirePermission('vehiculos.update'),
  vehiculosController.asignarConductor
);

router.delete('/:id/desasignar-conductor',
  requirePermission('vehiculos.update'),
  vehiculosController.desasignarConductor
);

// ========== CRUD GENÉRICO (VAN AL FINAL) ==========
router.get('/:id',
  requirePermission('vehiculos.view'),
  vehiculosController.getVehiculoById
);

router.get('/',
  requirePermission('vehiculos.view'),
  vehiculosController.getVehiculos
);

router.post('/',
  requirePermission('vehiculos.create'),
  vehiculosController.createVehiculo
);

router.put('/:id',
  requirePermission('vehiculos.update'),
  vehiculosController.updateVehiculo
);

router.delete('/:id',
  requirePermission('vehiculos.delete'),
  vehiculosController.deleteVehiculo
);

module.exports = router;