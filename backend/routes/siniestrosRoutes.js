// backend/routes/siniestrosRoutes.js
const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/roleMiddleware');
const { uploadSiniestroFotos } = require('../middleware/uploadSiniestrosMiddleware');

// Controllers
const siniestrosController = require('../controllers/admin/siniestrosAdminController');

// ========== RUTAS ESPECIALES (VAN PRIMERO) ==========
router.get('/opciones',
  requirePermission('siniestros.view'),
  siniestrosController.getOpciones
);

router.get('/estadisticas',
  requirePermission('estadisticas.view'),
  siniestrosController.getEstadisticas
);

router.get('/vehiculo/:id/historial',
  requirePermission('siniestros.view'),
  siniestrosController.getHistorialVehiculo
);

router.get('/conductor/:id/historial',
  requirePermission('siniestros.view'),
  siniestrosController.getHistorialConductor
);

// ========== 🆕 RUTAS NUEVAS - INTELIGENCIA ==========

// Vincular siniestro con mantenimiento
router.post('/:id/vincular-mantenimiento',
  requirePermission('siniestros.update'),
  siniestrosController.vincularMantenimiento
);

// Distribuir gastos del siniestro
router.post('/:id/distribuir-gasto',
  requirePermission('siniestros.update'),
  siniestrosController.distribuirGastoSiniestro
);

// ========== CRUD GENÉRICO (VAN AL FINAL) ==========
router.get('/:id',
  requirePermission('siniestros.view'),
  siniestrosController.getSiniestroById
);

router.get('/',
  requirePermission('siniestros.view'),
  siniestrosController.getSiniestros
);

// 🔥 CREAR SINIESTRO - Middleware condicional
router.post('/',
  requirePermission('siniestros.create'),
  (req, res, next) => {
    // Si viene JSON (Content-Type: application/json), salta Multer
    if (req.is('application/json')) {
      console.log('📄 Request es JSON, saltando Multer');
      return next();
    }
    // Si viene FormData, usa Multer
    console.log('📦 Request es FormData, usando Multer');
    uploadSiniestroFotos.array('fotos', 10)(req, res, next);
  },
  siniestrosController.createSiniestro
);

// 🔥 ACTUALIZAR SINIESTRO - Middleware condicional
router.put('/:id',
  requirePermission('siniestros.update'),
  (req, res, next) => {
    if (req.is('application/json')) {
      console.log('📄 Request es JSON, saltando Multer');
      return next();
    }
    console.log('📦 Request es FormData, usando Multer');
    uploadSiniestroFotos.array('fotos', 10)(req, res, next);
  },
  siniestrosController.updateSiniestro
);

router.delete('/:id',
  requirePermission('siniestros.delete'),
  siniestrosController.deleteSiniestro
);

module.exports = router;