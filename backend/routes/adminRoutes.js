// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');

// ========== SUB-RUTAS MODULARIZADAS ==========
const conductoresRoutes = require('./conductoresRoutes');
const vehiculosRoutes = require('./vehiculosRoutes');
const siniestrosRoutes = require('./siniestrosRoutes');
const mantenimientosRoutes = require('./mantenimientosRoutes');
const inversionesRoutes = require('./inversionesRoutes');
const pagosRentasRoutes = require('./pagosRentasRoutes');
const asignacionesRoutes = require('./asignacionesRoutes');
const usuariosRoutes = require('./usuariosRoutes'); // 🆕 MÓDULO DE USUARIOS

// 🔍 DEBUG - AGREGAR ESTO
console.log('🔍 conductoresRoutes:', typeof conductoresRoutes);
console.log('🔍 vehiculosRoutes:', typeof vehiculosRoutes);
console.log('🔍 siniestrosRoutes:', typeof siniestrosRoutes);
console.log('🔍 mantenimientosRoutes:', typeof mantenimientosRoutes);
console.log('🔍 inversionesRoutes:', typeof inversionesRoutes);
console.log('🔍 pagosRentasRoutes:', typeof pagosRentasRoutes);
console.log('🔍 asignacionesRoutes:', typeof asignacionesRoutes);
console.log('🔍 usuariosRoutes:', typeof usuariosRoutes);
// ========== CONTROLLERS NO MODULARIZADOS ==========
const inversionistasController = require('../controllers/inversionistasController');
const inversionesController = require('../controllers/inversionesController');

// ADMIN CONTROLLER LEGACY (deprecar gradualmente)
const {
  getRentas,
  getRentaById,
  getOpcionesRentas,
  createRenta,
  updateRenta,
  actualizarEstadoRenta,
  deleteRenta,
  getEstadisticasGenerales
} = require('../controllers/adminController');

// CONTROLLER DE SOLICITUDES
const {
  listarSolicitudes,
  obtenerSolicitud,
  actualizarSolicitud,
  actualizarEstatus,
  calcularDecisionFinal,
  migrarAConductor,
  obtenerEstadisticas
} = require('../controllers/solicitudController');

// ========== MIDDLEWARE DE AUTENTICACIÓN GLOBAL ==========
router.use(verifyToken);

// ========== RUTAS MODULARIZADAS ==========
router.use('/conductores', conductoresRoutes);
router.use('/vehiculos', vehiculosRoutes);
router.use('/siniestros', siniestrosRoutes);
router.use('/mantenimientos', mantenimientosRoutes);
router.use('/inversiones', inversionesRoutes);
router.use('/pagos-rentas', pagosRentasRoutes);
router.use('/asignaciones', asignacionesRoutes);
router.use('/usuarios', usuariosRoutes); // 🆕 MÓDULO DE USUARIOS

// ========== RUTAS DE SOLICITUDES DE CONDUCTORES ==========
router.get('/solicitudes/estadisticas', 
  requirePermission('prospectos.view'), 
  obtenerEstadisticas
);

router.get('/solicitudes', 
  requirePermission('prospectos.view'), 
  listarSolicitudes
);

router.get('/solicitudes/:id',
  requirePermission('prospectos.view'),
  obtenerSolicitud
);

router.put('/solicitudes/:id', 
  requirePermission('prospectos.view'),
  actualizarSolicitud
);

router.put('/solicitudes/:id/estatus', 
  requirePermission('prospectos.create'),
  actualizarEstatus
);

router.post('/solicitudes/:id/calcular-decision', 
  requirePermission('prospectos.create'),
  calcularDecisionFinal
);

router.post('/solicitudes/:id/migrar', 
  requirePermission('conductores.create'),
  migrarAConductor
);

// ========== RUTAS DE INVERSIONISTAS ==========
router.get('/inversionistas/opciones',
  requirePermission('inversiones.view'),
  inversionistasController.getOpcionesInversionistas
);

router.get('/inversionistas/:id/dashboard',
  requirePermission('inversiones.view'),
  inversionistasController.getDashboardInversionista
);

router.get('/inversionistas/:id',
  requirePermission('inversiones.view'),
  inversionistasController.getInversionistaById
);

router.get('/inversionistas',
  requirePermission('inversiones.view'),
  inversionistasController.getInversionistas
);

router.post('/inversionistas',
  requirePermission('inversiones.create'),
  inversionistasController.createInversionista
);

router.put('/inversionistas/:id',
  requirePermission('inversiones.update'),
  inversionistasController.updateInversionista
);

// ========== RUTAS ADICIONALES DE INVERSIONES (no están en inversionesRoutes.js) ==========
router.get('/inversiones/:id/pagos',
  requirePermission('inversiones.view'),
  inversionesController.getPagosInversion
);

router.post('/inversiones/:id/pagos',
  requirePermission('inversiones.payment'),
  inversionesController.registrarPago
);

// ========== RUTAS DE RENTAS LEGACY (DEPRECADAS) ==========
router.get('/rentas/opciones', 
  requirePermission('rentas.view'), 
  getOpcionesRentas
);

router.get('/rentas/:id', 
  requirePermission('rentas.view'), 
  getRentaById
);

router.get('/rentas', 
  requirePermission('rentas.view'), 
  getRentas
);

router.post('/rentas', 
  requirePermission('rentas.create'), 
  createRenta
);

router.put('/rentas/:id/estado', 
  requirePermission('rentas.payment'), 
  actualizarEstadoRenta
);

router.put('/rentas/:id', 
  requirePermission('rentas.update'), 
  updateRenta
);

router.delete('/rentas/:id', 
  requirePermission('rentas.delete'), 
  deleteRenta
);

// ========== ESTADÍSTICAS GENERALES ==========
router.get('/estadisticas',
  requirePermission('estadisticas.view'),
  getEstadisticasGenerales
);

// ========== SINCRONIZACIÓN DE RENTAS ==========
router.post('/sync/rentas',
  requirePermission('rentas.sync'),
  require('../controllers/adminController').syncRentasFromAirtable
);

module.exports = router;