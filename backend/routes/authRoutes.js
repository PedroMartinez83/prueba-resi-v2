const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');

// Importar todas las funciones del controlador
const authController = require('../controllers/authController');

// Rutas públicas
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/vehiculos-disponibles', authController.getVehiculosDisponibles);
router.post('/registrar-conductor', authController.registrarConductor);
router.post('/verificar-vehiculo', authController.verificarVehiculo);
router.post('/registrar-por-vehiculo', authController.registrarPorVehiculo);

// Rutas protegidas (requieren token)
router.get('/verify', verifyToken, authController.verifyAuth);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;