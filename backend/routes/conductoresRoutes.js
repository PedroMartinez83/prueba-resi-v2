// backend/routes/conductoresRoutes.js
const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/roleMiddleware');

// Controllers
const conductoresAdminController = require('../controllers/admin/conductoresAdminController');

// ========== RUTAS ESPECIALES (VAN PRIMERO) ==========
router.get('/opciones', 
  requirePermission(['conductores.view', 'prospectos.view']), 
  conductoresAdminController.getOpcionesConductores
);

router.get('/estadisticas',
  requirePermission('estadisticas.view'),
  conductoresAdminController.getEstadisticasConductores
);

// ========== 🆕 RUTAS DE PLAN DE CARRERA Y PÓLIZA ==========
// Amonestaciones
router.get('/:id/amonestaciones',
  requirePermission('conductores.view'),
  conductoresAdminController.getAmonestaciones
);

router.post('/:id/amonestar',
  requirePermission('conductores.update'),
  conductoresAdminController.amonestar
);

// Promoción a Socio Dueño
router.post('/:id/promover-a-sd',
  requirePermission('conductores.update'),
  conductoresAdminController.promoverASocioDueno
);

// Póliza Mecánica
router.patch('/:id/poliza-mecanica',
  requirePermission('conductores.update'),
  conductoresAdminController.ajustarPolizaMecanica
);

// --- 👇 ¡AQUÍ ESTÁ LA NUEVA RUTA QUE AÑADIMOS! 👇 ---
/**
 * Crea una cuenta de acceso (usuario) para un conductor existente
 */
router.post('/:id/crear-acceso',
  requirePermission('conductores.update'), // Usamos el permiso de 'update'
  conductoresAdminController.crearAccesoConductor // Esta es la función que crearemos
);
// --- 👆 FIN DE LA RUTA NUEVA 👆 ---


// ========== RUTAS CON PARÁMETROS ESPECÍFICOS ==========
router.post('/:id/asignar-vehiculo',
  requirePermission('conductores.update'),
  conductoresAdminController.asignarVehiculo
);

router.delete('/:id/desasignar-vehiculo',
  requirePermission('conductores.update'),
  conductoresAdminController.desasignarVehiculo
);

router.put('/:id/status',
  requirePermission('conductores.update'),
  conductoresAdminController.cambiarStatus
);

// ========== CRUD GENÉRICO (VAN AL FINAL) ==========
router.get('/:id',
  requirePermission('conductores.view'),
  conductoresAdminController.getConductorById
);

router.get('/', 
  requirePermission('conductores.view'), 
  conductoresAdminController.getConductores
);

router.post('/', 
  requirePermission('conductores.create'), 
  conductoresAdminController.createConductor
);

router.put('/:id', 
  requirePermission('conductores.update'), 
  conductoresAdminController.updateConductor
);

router.delete('/:id', 
  requirePermission('conductores.delete'), 
  conductoresAdminController.deleteConductor
);

router.post('/:id/gestionar-baja', 
  requirePermission('conductores.update'),
  conductoresAdminController.gestionarBajaConductor
);

module.exports = router;