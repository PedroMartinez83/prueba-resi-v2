// backend/routes/vehiculosRoutes.js
const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/roleMiddleware');
const { vehiculoSchemas, validate } = require('../validators/vehiculoValidator');

// Controllers
const vehiculosController = require('../controllers/vehiculosController');

// ========== RUTAS ESPECIALES (VAN PRIMERO) ==========
router.get('/opciones',
  requirePermission('vehiculos.view'),
  vehiculosController.getOpcionesVehiculos
);

router.post('/catalogo-modelos',
  requirePermission('vehiculos.create'),
  vehiculosController.createCatalogoVehiculo
);

router.get('/disponibles',
  requirePermission('vehiculos.view'),
  vehiculosController.getVehiculosDisponibles
);

router.get('/estadisticas',
  requirePermission('estadisticas.view'),
  vehiculosController.getEstadisticasVehiculos
);

router.get('/polizas-seguro',
  requirePermission('vehiculos.view'),
  vehiculosController.getPolizasSeguro
);

router.post('/polizas',
  requirePermission('vehiculos.create'),
  vehiculosController.createPolizaSeguro
);

// ========== INVENTARIOS DE VEHICULO ==========
router.get('/:id/inventarios',
  requirePermission('vehiculos.view'),
  vehiculosController.getInventariosVehiculo
);

router.get('/:id/inventarios/comparar',
  requirePermission('vehiculos.view'),
  vehiculosController.compararInventariosVehiculo
);

router.get('/:id/inventarios/:snapshotId',
  requirePermission('vehiculos.view'),
  vehiculosController.getInventarioVehiculoById
);

router.post('/:id/inventarios',
  requirePermission('vehiculos.create'),
  vehiculosController.createInventarioVehiculo
);

router.put('/:id/inventarios/:snapshotId',
  requirePermission('vehiculos.update'),
  vehiculosController.updateInventarioVehiculo
);

router.post('/:id/inventarios/:snapshotId/completar',
  requirePermission('vehiculos.update'),
  vehiculosController.completarInventarioVehiculo
);

// ========== ACCIONES ESPECIFICAS CON PARAMETROS ==========
router.post('/:id/asignar-conductor',
  requirePermission('vehiculos.update'),
  validate(vehiculoSchemas.asignarConductor),
  vehiculosController.asignarConductor
);

router.delete('/:id/desasignar-conductor',
  requirePermission('vehiculos.update'),
  vehiculosController.desasignarConductor
);

router.post('/:id/gestionar-baja',
  requirePermission('vehiculos.delete'),
  vehiculosController.procesarSolicitudBaja
);

// ========== CRUD GENERICO (VAN AL FINAL) ==========
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
  validate(vehiculoSchemas.create),
  vehiculosController.createVehiculo
);

router.put('/:id',
  requirePermission('vehiculos.update'),
  validate(vehiculoSchemas.update),
  vehiculosController.updateVehiculo
);

router.delete('/:id',
  requirePermission('vehiculos.delete'),
  vehiculosController.deleteVehiculo
);

module.exports = router;
