const postgresService = require('../../services/postgresService');
const auditService = require('../../services/auditService');
const bcrypt = require('bcryptjs');

// Obtener db de postgresService
const { db, TABLES } = postgresService;

/**
 * Genera una contraseña temporal memorable
 * Formato: User_abc12
 */
const generarPasswordTemporal = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  let password = 'User_';
  
  for (let i = 0; i < 3; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  for (let i = 0; i < 2; i++) {
    password += nums.charAt(Math.floor(Math.random() * nums.length));
  }
  
  return password;
};

/**
 * Listar todos los usuarios con filtros, búsqueda y paginación
 * GET /api/admin/usuarios
 * Permisos: super_admin, director
 */
exports.getUsuarios = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      rol, 
      estado, 
      search 
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Construir query con Knex
    let query = db('usuarios as u')
      .leftJoin('conductores as c', 'c.usuario_id', 'u.id')
      .select(
        'u.id',
        'u.email',
        'u.nombre_completo',
        'u.rol',
        'u.estado_cuenta',
        'u.fecha_registro',
        'u.created_at',
        'u.updated_at',
        db.raw('CASE WHEN c.id IS NOT NULL THEN true ELSE false END as tiene_conductor_vinculado'),
        'c.id as conductor_id'
      );

    // Aplicar filtros
    if (rol) {
      query = query.where('u.rol', rol);
    }

    if (estado) {
      query = query.where('u.estado_cuenta', estado);
    }

    if (search) {
      query = query.where(function() {
        this.where('u.email', 'ilike', `%${search}%`)
            .orWhere('u.nombre_completo', 'ilike', `%${search}%`);
      });
    }

    // Clonar query para contar
    const countQuery = query.clone().clearSelect().clearOrder().count('u.id as total').first();
    const { total } = await countQuery;

    // Aplicar paginación y ordenamiento
    const usuarios = await query
      .orderBy('u.fecha_registro', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      usuarios: usuarios || [],
      total: parseInt(total) || 0,
      page: parseInt(page),
      totalPages: Math.ceil((parseInt(total) || 0) / limit)
    });

  } catch (error) {
    console.error('❌ Error al obtener usuarios:', error);
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo usuarios: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener lista de usuarios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtener detalle de un usuario específico
 * GET /api/admin/usuarios/:id
 * Permisos: super_admin, director
 */
exports.getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await db('usuarios as u')
      .leftJoin('conductores as c', 'c.usuario_id', 'u.id')
      .select(
        'u.id',
        'u.email',
        'u.nombre_completo',
        'u.rol',
        'u.estado_cuenta',
        'u.fecha_registro',
        'u.created_at',
        'u.updated_at',
        'c.id as conductor_id',
        'c.nombre_conductor',
        'c.status as conductor_estado'
      )
      .where('u.id', id)
      .first();

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Obtener últimas 10 acciones del usuario desde audit_logs
    const historial = await db('audit_logs')
      .where('usuario_id', id)
      .select('accion as action', 'detalles as details', 'timestamp')
      .orderBy('timestamp', 'desc')
      .limit(10);

    res.json({
      success: true,
      usuario,
      historial: historial || []
    });

  } catch (error) {
    console.error('❌ Error al obtener usuario:', error);
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo usuario ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalle del usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Crear nuevo usuario
 * POST /api/admin/usuarios
 * Permisos: super_admin
 */
exports.createUsuario = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { 
      email, 
      nombre_completo, 
      rol, 
      estado_cuenta = 'Activo' 
    } = req.body;

    // Validaciones
    if (!email || !nombre_completo || !rol) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Email, nombre completo y rol son obligatorios'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Formato de email inválido'
      });
    }

    // Validar que el rol sea válido
    const rolesValidos = [
      'super_admin',
      'director',
      'gerente_ops',
      'contador',
      'reclutador',
      'jefe_taller',
      'secretaria'
    ];
    
    if (!rolesValidos.includes(rol)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Rol inválido'
      });
    }

    // Establecer contexto de auditoría
    await auditService.setUserContext(trx, req.user);

    // Verificar que el email no exista
    const emailCheck = await trx(TABLES.USUARIOS)
      .where('email', email)
      .first();

    if (emailCheck) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Generar contraseña temporal
    const passwordTemporal = generarPasswordTemporal();
    const hashedPassword = await bcrypt.hash(passwordTemporal, 10);

    // Crear usuario
    const [nuevoUsuario] = await trx(TABLES.USUARIOS)
      .insert({
        name: nombre_completo,          // Campo name es obligatorio
        email,
        password: hashedPassword,
        nombre_completo,
        rol,
        estado: estado_cuenta,           // Campo estado
        estado_cuenta,                   // Campo estado_cuenta también
        fecha_registro: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // Registrar en auditoría
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'CREATE_USER',
      descripcion: `Usuario ${nuevoUsuario.email} creado con rol ${nuevoUsuario.rol}`,
      datos_sensibles: {
        usuario_creado_id: nuevoUsuario.id,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol
      },
      ip_address: auditService.getClientIp(req)
    });

    await trx.commit();

    res.status(201).json({
      success: true,
      usuario: {
        id: nuevoUsuario.id,
        email: nuevoUsuario.email,
        nombre_completo: nuevoUsuario.nombre_completo,
        rol: nuevoUsuario.rol,
        estado_cuenta: nuevoUsuario.estado_cuenta,
        fecha_registro: nuevoUsuario.fecha_registro
      },
      password_temporal: passwordTemporal,
      message: 'Usuario creado exitosamente. Comparte la contraseña temporal con el usuario.'
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error al crear usuario:', error);
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error creando usuario: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Actualizar usuario existente
 * PUT /api/admin/usuarios/:id
 * Permisos: super_admin (todos los campos), director (solo estado)
 */
exports.updateUsuario = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { nombre_completo, rol, estado_cuenta } = req.body;
    const hasNombreCompleto = Object.prototype.hasOwnProperty.call(req.body, 'nombre_completo');
    const hasRol = Object.prototype.hasOwnProperty.call(req.body, 'rol');
    const hasEstadoCuenta = Object.prototype.hasOwnProperty.call(req.body, 'estado_cuenta');

    // Verificar que no se edite a sí mismo
    if (parseInt(id) === req.user.id) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes editar tu propio usuario'
      });
    }

    // Establecer contexto de auditoría
    await auditService.setUserContext(trx, req.user);

    // Obtener usuario actual
    const usuarioActual = await trx(TABLES.USUARIOS)
      .where('id', id)
      .first();

    if (!usuarioActual) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Protección: no permitir cambiar rol de otro super_admin
    if (usuarioActual.rol === 'super_admin' && rol && rol !== 'super_admin') {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes cambiar el rol de un super administrador'
      });
    }

    // Preparar campos a actualizar
    const updateData = {
      updated_at: new Date()
    };

    // Si el usuario es super_admin, puede cambiar todo
    if (req.user.rol === 'super_admin') {
      if (hasNombreCompleto) {
        const nombreFinal = nombre_completo?.toString().trim();
        updateData.nombre_completo = nombreFinal || null;
        updateData.name = nombreFinal || null; // Actualizar ambos campos
      }
      if (hasRol && rol) {
        updateData.rol = rol;
      }
    }

    // Ambos roles pueden cambiar el estado
    if (hasEstadoCuenta && estado_cuenta) {
      updateData.estado_cuenta = estado_cuenta;
      updateData.estado = estado_cuenta; // Actualizar ambos campos
    }

    // Verificar que haya algo que actualizar
    if (Object.keys(updateData).length === 1) { // Solo updated_at
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    // Actualizar usuario
    const [usuarioActualizado] = await trx(TABLES.USUARIOS)
      .where('id', id)
      .update(updateData)
      .returning('*');

    // Registrar en auditoría
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'UPDATE_USER',
      descripcion: `Usuario ${usuarioActualizado.email} actualizado`,
      datos_sensibles: {
        usuario_editado_id: id,
        cambios: req.body
      },
      ip_address: auditService.getClientIp(req)
    });

    await trx.commit();

    res.json({
      success: true,
      usuario: {
        id: usuarioActualizado.id,
        email: usuarioActualizado.email,
        nombre_completo: usuarioActualizado.nombre_completo,
        rol: usuarioActualizado.rol,
        estado_cuenta: usuarioActualizado.estado_cuenta
      },
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error al actualizar usuario:', error);
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error actualizando usuario ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Resetear contraseña de un usuario
 * POST /api/admin/usuarios/:id/resetear-password
 * Permisos: super_admin, director
 */
exports.resetearPassword = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;

    // Verificar que no resetee su propia contraseña
    if (parseInt(id) === req.user.id) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes resetear tu propia contraseña. Usa la opción de cambio de contraseña.'
      });
    }

    // Establecer contexto de auditoría
    await auditService.setUserContext(trx, req.user);

    // Verificar que el usuario exista
    const usuario = await trx(TABLES.USUARIOS)
      .where('id', id)
      .select('id', 'email', 'nombre_completo')
      .first();

    if (!usuario) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Generar nueva contraseña temporal
    const nuevaPassword = generarPasswordTemporal();
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);

    // Actualizar contraseña
    await trx(TABLES.USUARIOS)
      .where('id', id)
      .update({
        password: hashedPassword,
        updated_at: new Date()
      });

    // Registrar en auditoría
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'RESET_PASSWORD',
      descripcion: `Contraseña reseteada para usuario ${usuario.email}`,
      datos_sensibles: {
        usuario_afectado_id: id,
        usuario_afectado_email: usuario.email
      },
      ip_address: auditService.getClientIp(req)
    });

    await trx.commit();

    res.json({
      success: true,
      password_temporal: nuevaPassword,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre_completo: usuario.nombre_completo
      },
      message: 'Contraseña reseteada exitosamente. Comparte la nueva contraseña con el usuario.'
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error al resetear contraseña:', error);
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error reseteando contraseña usuario ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al resetear contraseña',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Cambiar estado de un usuario (Activar/Suspender/Prohibir)
 * PUT /api/admin/usuarios/:id/cambiar-estado
 * Permisos: super_admin (todos los estados), director (solo Activo/Suspendido)
 */
exports.cambiarEstado = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { nuevo_estado } = req.body;

    // Validar que el estado sea válido
    const estadosValidos = ['Activo', 'suspendido', 'prohibido'];
    if (!estadosValidos.includes(nuevo_estado)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    // Si es director y quiere cambiar a prohibido, no puede
    if (req.user.rol === 'director' && nuevo_estado === 'prohibido') {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'Solo super_admin puede cambiar el estado a "prohibido"'
      });
    }

    // No puedes cambiar tu propio estado
    if (parseInt(id) === req.user.id) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes cambiar tu propio estado'
      });
    }

    // Establecer contexto de auditoría
    await auditService.setUserContext(trx, req.user);

    // Obtener usuario actual
    const usuario = await trx(TABLES.USUARIOS)
      .where('id', id)
      .first();

    if (!usuario) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Protección: no permitir cambiar estado de otro super_admin
    if (usuario.rol === 'super_admin') {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes cambiar el estado de un super administrador'
      });
    }

    const estadoAnterior = usuario.estado_cuenta;

    // Actualizar estado
    await trx(TABLES.USUARIOS)
      .where('id', id)
      .update({
        estado_cuenta: nuevo_estado,
        estado: nuevo_estado,
        updated_at: new Date()
      });

    // Si el usuario es conductor y se suspende/prohíbe, actualizar su estado
    if ((nuevo_estado === 'suspendido' || nuevo_estado === 'prohibido') && usuario.rol === 'conductor') {
      const estadoConductor = nuevo_estado === 'suspendido' ? 'inactivo' : 'rechazado';
      
      await trx('conductores')
        .where('usuario_id', id)
        .update({
          status: estadoConductor === 'inactivo' ? 'Suspendido' : 'Rechazado',
          updated_at: new Date()
        });
    }

    // Registrar en auditoría
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'CHANGE_USER_STATUS',
      descripcion: `Estado de usuario ${usuario.email} cambiado de ${estadoAnterior} a ${nuevo_estado}`,
      datos_sensibles: {
        usuario_afectado_id: id,
        estado_anterior: estadoAnterior,
        estado_nuevo: nuevo_estado
      },
      ip_address: auditService.getClientIp(req)
    });

    await trx.commit();

    res.json({
      success: true,
      message: `Estado del usuario cambiado a "${nuevo_estado}" exitosamente`
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error al cambiar estado:', error);
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error cambiando estado usuario ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Eliminar usuario (soft delete recomendado - cambiar a prohibido)
 * DELETE /api/admin/usuarios/:id
 * Permisos: super_admin
 */
exports.deleteUsuario = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { force_delete = false } = req.query;

    // No puedes eliminarte a ti mismo
    if (parseInt(id) === req.user.id) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes eliminar tu propio usuario'
      });
    }

    // Establecer contexto de auditoría
    await auditService.setUserContext(trx, req.user);

    // Verificar usuario
    const usuario = await trx(TABLES.USUARIOS)
      .where('id', id)
      .first();

    if (!usuario) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // No permitir eliminar otros super_admin
    if (usuario.rol === 'super_admin') {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes eliminar a un super administrador'
      });
    }

    // Verificar si tiene conductor vinculado activo
    const conductorActivo = await trx('conductores')
      .where('usuario_id', id)
      .whereNotIn('status', ['Rechazado', 'Suspendido'])
      .first();

    if (conductorActivo) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar un usuario con conductor activo vinculado'
      });
    }

    // Recomendación: cambiar a prohibido en lugar de eliminar
    if (!force_delete || force_delete === 'false') {
      await trx(TABLES.USUARIOS)
        .where('id', id)
        .update({
          estado_cuenta: 'prohibido',
          estado: 'prohibido',
          updated_at: new Date()
        });

      await auditService.logCriticalChange({
        usuario_id: req.user.id,
        tipo_cambio: 'DISABLE_USER',
        descripcion: `Usuario ${usuario.email} deshabilitado (cambiado a prohibido)`,
        datos_sensibles: {
          usuario_deshabilitado_id: id,
          email: usuario.email
        },
        ip_address: auditService.getClientIp(req)
      });

      await trx.commit();

      return res.json({
        success: true,
        message: 'Usuario deshabilitado exitosamente (cambiado a estado "prohibido")',
        recommendation: 'Se recomienda deshabilitar usuarios en lugar de eliminarlos permanentemente'
      });
    }

    // Si force_delete = true, eliminar permanentemente
    await trx(TABLES.USUARIOS)
      .where('id', id)
      .delete();

    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'DELETE_USER_PERMANENT',
      descripcion: `Usuario ${usuario.email} eliminado permanentemente`,
      datos_sensibles: {
        usuario_eliminado_id: id,
        email: usuario.email
      },
      ip_address: auditService.getClientIp(req),
      requiere_revision: true
    });

    await trx.commit();

    res.json({
      success: true,
      message: 'Usuario eliminado permanentemente'
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error al eliminar usuario:', error);
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error eliminando usuario ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;
