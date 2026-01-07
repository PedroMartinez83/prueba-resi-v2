// backend/routes/inversionesRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/roleMiddleware');
const inversionesController = require('../controllers/inversionesController');
const inversionistasController = require('../controllers/inversionistasController');

// Middleware de autenticación para todas las rutas
router.use(verifyToken);

// ========== RUTAS PARA MÓDULO DE INVERSIONISTAS ==========
// Crear nuevo contrato de inversión
router.post('/crear-contrato',
  requirePermission('inversiones.create'),
  inversionistasController.crearContrato
);

// Obtener vehículos disponibles
router.get('/vehiculos-disponibles',
  requirePermission('inversiones.view'),
  inversionistasController.getVehiculosDisponibles
);
// Ver detalle de un contrato específico
router.get('/contratos/:id',
  requirePermission('inversiones.view'),
  inversionistasController.getContratoDetalle
);

// Marcar un pago como pagado
router.post('/pagos/:id/marcar-pagado',
  requirePermission('inversiones.create'),
  inversionistasController.marcarPagoPagado
);

// Vincular inversionista a inversión existente
router.post('/:id/vincular-inversionista',
  requirePermission('inversiones.create'),
  inversionistasController.vincularInversionista
);

// Hub de inversiones - Lista de contratos
router.get('/hub',
  requirePermission('inversiones.view'),
  inversionistasController.getHubInversiones
);

// ========== RUTAS EXISTENTES (CÁLCULOS) ==========
// Calcular inversión (sin guardar)
router.post('/calcular', 
  requirePermission('vehiculos.view'),
  inversionesController.calcularInversion
);

// Crear inversión para un vehículo 
router.post('/vehiculo',
  requirePermission('inversiones.create'),
  inversionesController.crearInversionVehiculo
);

// Obtener inversiones de un vehículo
router.get('/vehiculo/:numero_serie',
  requirePermission('inversiones.view'),
  inversionesController.getInversionesByVehiculo
);

// Calcular inversión modelo SI Legado
router.post('/calcular/si-legado',
  requirePermission('vehiculos.view'),
  inversionesController.calcularSILegado
);

// Calcular inversión modelo AutoManager
router.post('/calcular/automanager',
  requirePermission('vehiculos.view'),
  inversionesController.calcularAutoManager
);

// Gestionar multiplicador del sistema
router.get('/parametros/multiplicador',
  requirePermission('vehiculos.view'),
  inversionesController.gestionarMultiplicador
);

router.put('/parametros/multiplicador',
  requirePermission('inversiones.create'),
  inversionesController.gestionarMultiplicador
);

// Crear inversión completa con nuevo flujo
router.post('/crear-completa',
  requirePermission('inversiones.create'),
  inversionesController.crearInversionCompleta
);

module.exports = router;