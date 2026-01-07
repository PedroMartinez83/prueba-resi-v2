const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/admin/usuariosAdminController');
const { requirePermission } = require('../middleware/roleMiddleware');

/**
 * Rutas del módulo de usuarios
 * NOTA: verifyToken ya está aplicado globalmente en adminRoutes.js
 * Solo necesitamos requirePermission aquí
 */

/**
 * @route   GET /api/admin/usuarios
 * @desc    Listar todos los usuarios con filtros y paginación
 * @access  super_admin, director
 */
router.get(
  '/',
  requirePermission('usuarios', 'view'),
  usuariosController.getUsuarios
);

/**
 * @route   GET /api/admin/usuarios/:id
 * @desc    Obtener detalle de un usuario específico
 * @access  super_admin, director
 */
router.get(
  '/:id',
  requirePermission('usuarios', 'view'),
  usuariosController.getUsuarioById
);

/**
 * @route   POST /api/admin/usuarios
 * @desc    Crear nuevo usuario
 * @access  super_admin
 */
router.post(
  '/',
  requirePermission('usuarios', 'create'),
  usuariosController.createUsuario
);

/**
 * @route   PUT /api/admin/usuarios/:id
 * @desc    Actualizar usuario existente
 * @access  super_admin (todos los campos), director (solo estado)
 */
router.put(
  '/:id',
  requirePermission('usuarios', 'update'),
  usuariosController.updateUsuario
);

/**
 * @route   POST /api/admin/usuarios/:id/resetear-password
 * @desc    Resetear contraseña de un usuario
 * @access  super_admin, director
 */
router.post(
  '/:id/resetear-password',
  requirePermission('usuarios', 'reset_password'),
  usuariosController.resetearPassword
);

/**
 * @route   PUT /api/admin/usuarios/:id/cambiar-estado
 * @desc    Cambiar estado de un usuario (Activo/Suspendido/Prohibido)
 * @access  super_admin (todos), director (solo Activo/Suspendido)
 */
router.put(
  '/:id/cambiar-estado',
  requirePermission('usuarios', 'update'),
  usuariosController.cambiarEstado
);

/**
 * @route   DELETE /api/admin/usuarios/:id
 * @desc    Eliminar usuario (se recomienda cambiar a estado "prohibido")
 * @access  super_admin
 */
router.delete(
  '/:id',
  requirePermission('usuarios', 'delete'),
  usuariosController.deleteUsuario
);

module.exports = router;