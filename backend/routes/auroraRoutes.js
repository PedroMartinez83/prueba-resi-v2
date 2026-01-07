const router = require('express').Router();
const auroraController = require('../controllers/admin/auroraController');
const { verifyToken } = require('../middleware/authMiddleware');

// Ruta protegida
router.post('/', verifyToken, auroraController.procesarComando);

module.exports = router;