// backend/routes/mantenimientosRoutes.js
const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/roleMiddleware');

// ✅ UN SOLO NOMBRE: mantenimientosController
const mantenimientosController = require('../controllers/admin/mantenimientosAdminController');

// ========== REPORTES (DEBEN IR PRIMERO) ==========
router.get('/reportes/costos',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getReporteCostos
);

router.get('/reportes/frecuencia',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getReporteFrecuencia
);

router.get('/reportes/vehiculos-costosos',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getVehiculosMasCostosos
);

router.get('/reportes/comparativa',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getComparativaEstimadoReal
);

router.get('/reportes/talleres',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getReportePorTaller
);

// ========== OPCIONES Y ESTADÍSTICAS ==========
router.get('/opciones',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getOpciones
);

router.get('/servicios-preventivos',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getServiciosPreventivos
);

router.get('/estadisticas',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getEstadisticas
);

router.get('/alertas',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getAlertas
);

// ========== DISTRIBUCIÓN DE GASTOS (ANTES DE RUTAS CON :id) ==========
router.get('/pendientes-distribucion',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getMantenimientosPendientesDistribucion
);

router.post('/:id/distribuir-gasto',
  requirePermission('mantenimientos.update'),
  mantenimientosController.distribuirGastoMantenimiento
);

// ========== RUTAS CON PARÁMETROS ESPECÍFICOS ==========
router.get('/vehiculo/:id',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getHistorialVehiculo
);

// Ruta para confirmar cita
router.put('/:id/confirmar',
  requirePermission('mantenimientos.update'),
  mantenimientosController.confirmarMantenimiento
);

// Ruta para cancelar mantenimiento
router.put('/:id/cancelar',
  requirePermission('mantenimientos.update'), 
  mantenimientosController.cancelarMantenimiento
);

router.put('/:id/completar',
  requirePermission('mantenimientos.update'),
  mantenimientosController.completarMantenimiento
);

// ========== CRUD GENÉRICO (VAN AL FINAL) ==========
router.get('/:id',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getMantenimientoById
);

router.get('/',
  requirePermission('mantenimientos.view'),
  mantenimientosController.getMantenimientos
);

router.post('/',
  requirePermission('mantenimientos.create'),
  mantenimientosController.createMantenimiento
);

router.put('/:id',
  requirePermission('mantenimientos.update'),
  mantenimientosController.updateMantenimiento
);

router.delete('/:id',
  requirePermission('mantenimientos.delete'),
  mantenimientosController.deleteMantenimiento
);



// ✅ UN SOLO module.exports
module.exports = router;