// backend/routes/pagosRentasRoutes.js
const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/roleMiddleware');

// Controllers
const pagosRentasController = require('../controllers/admin/pagosRentasAdminController');

// ========== RUTAS ESPECIALES (VAN PRIMERO) ==========

// Opciones y estadísticas
router.get('/opciones',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getOpcionesPagos
);

router.get('/estadisticas',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getEstadisticasPagos
);

// Gráficas y reportes
router.get('/grafica-diaria',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getGraficaDiaria
);

router.get('/tendencia-mensual',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getTendenciaMensual
);

router.get('/distribucion-tipo-socio',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getDistribucionTipoSocio
);

router.get('/top-conductores',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getTopConductores
);

router.get('/conductores-morosos',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getConductoresMorosos
);

// Historial por conductor
router.get('/conductor/:conductorId/historial',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getHistorialConductor
);

// Siguiente pago pendiente por conductor
router.get('/conductor/:conductorId/siguiente-pendiente',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getSiguientePagoPendiente
);

// Acciones específicas
router.put('/:id/validar',
  requirePermission('pagos_rentas.update'),
  pagosRentasController.validarPago
);

router.put('/:id/rechazar',
  requirePermission('pagos_rentas.update'),
  pagosRentasController.rechazarPago
);

// Editar pago
router.put('/:id/editar',
  requirePermission('pagos_rentas.update'),
  pagosRentasController.editarPago
);

// Eliminar pago
router.delete('/:id',
  requirePermission('pagos_rentas.delete'),
  pagosRentasController.eliminarPago
);

// ========== 🆕 NUEVAS RUTAS - LÓGICA "DOS CUBETAS" ==========

// Registrar pago manual por admin
router.post('/registrar-manual',
  requirePermission('pagos_rentas.create'),
  pagosRentasController.registrarPagoManual
);

// Ver saldo de póliza de un conductor
router.get('/conductor/:conductorId/saldo-poliza',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getSaldoPolizaConductor
);

// ========== CRUD GENÉRICO (VAN AL FINAL) ==========
router.get('/',
  requirePermission('pagos_rentas.view'),
  pagosRentasController.getPagosRentas
);

module.exports = router;
