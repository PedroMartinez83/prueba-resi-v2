const postgresService = require('../../services/postgresService');
const auditService = require('../../services/auditService');
const bcrypt = require('bcryptjs');
const emailService = require('../../utils/emailService');
const { ROLE_HIERARCHY } = require('../../middleware/roleMiddleware');

// Obtener db de postgresService
const { db, TABLES } = postgresService;

// Roles que coordinador no puede modificar por jerarquia
const COORDINADOR_ROLES_BLOQUEADOS = new Set([
  'super_admin',
  'gerente_ops',
  'direccion',
  'director',
  'finanzas'
]);

const EMAIL_EDIT_ALLOWED_ROLES = new Set([
  'super_admin',
  'director',
  'gerente_ops',
  'finanzas'
]);

const GERENTE_EMAIL_ROLES_BLOQUEADOS = new Set(['super_admin', 'direccion', 'finanzas', 'gerente_ops']);
const USER_ASSIGNABLE_ROLES = new Set([
  'super_admin',
  'direccion',
  'director',
  'gerente_ops',
  'finanzas',
  'coordinador',
  'gestor_flota',
  'reclutador',
  'jefe_taller',
  'compras',
  'secretaria',
  'conductor',
  'cliente'
]);

const normalizeEmailValue = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const canEditTargetByHierarchyForEmail = (actorRole, targetRole) => {
  if (!actorRole || !targetRole) return false;
  if (actorRole === 'super_admin') return true;
  if (actorRole === 'direccion') return targetRole !== 'super_admin';
  if (actorRole === 'director') return targetRole !== 'super_admin';
  if (actorRole === 'gerente_ops') return !GERENTE_EMAIL_ROLES_BLOQUEADOS.has(targetRole);
  if (actorRole === 'coordinador') return !COORDINADOR_ROLES_BLOQUEADOS.has(targetRole);

  const actorRank = ROLE_HIERARCHY?.[actorRole] ?? 0;
  const targetRank = ROLE_HIERARCHY?.[targetRole] ?? 0;

  // Mismo criterio que usa hoy el sistema: bloquear solo superiores (mismo nivel se permite)
  return actorRank >= targetRank;
};

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
 * Permisos: super_admin, direccion
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
 * Permisos: super_admin, direccion
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
    if (!USER_ASSIGNABLE_ROLES.has(rol)) {
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
      .andWhere(function () {
        this.whereRaw('LOWER(COALESCE(email, \'\')) = LOWER(?)', [email])
          .orWhereRaw('LOWER(COALESCE(name, \'\')) = LOWER(?)', [email]);
      })
      .first();

    if (emailCheck) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado o entra en conflicto con otro usuario'
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
 * Permisos: super_admin (todos los campos), direccion (solo estado)
 */
exports.updateUsuario = async (req, res) => {
  // Iniciamos la transacción
  const trx = await db.transaction(); 

  try {
    const { id } = req.params;
    const { email, nombre_completo, rol, estado_cuenta } = req.body;
    
    // Validamos qué campos vienen en el body
    const hasNombreCompleto = Object.prototype.hasOwnProperty.call(req.body, 'nombre_completo');
    const hasEmail = Object.prototype.hasOwnProperty.call(req.body, 'email');
    const hasRol = Object.prototype.hasOwnProperty.call(req.body, 'rol');
    const hasEstadoCuenta = Object.prototype.hasOwnProperty.call(req.body, 'estado_cuenta');

    // 1. VALIDACIONES DE SEGURIDAD
    if (parseInt(id) === req.user.id) {
      await trx.rollback();
      return res.status(403).json({ success: false, message: 'No puedes editar tu propio usuario' });
    }

    // Establecer contexto de auditoría (Log en BD)
    await auditService.setUserContext(trx, req.user);

    // 2. OBTENER USUARIO ACTUAL (Para comparar y validar)
    const usuarioActual = await trx(TABLES.USUARIOS).where('id', id).first();

    if (!usuarioActual) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Finanzas no puede editar usuarios de direccion o super admin
    if (req.user?.rol === 'finanzas' && ['super_admin', 'direccion'].includes(usuarioActual.rol)) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes editar usuarios de direccion o super admin'
      });
    }

    if (req.user?.rol === 'coordinador' && COORDINADOR_ROLES_BLOQUEADOS.has(usuarioActual.rol)) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes editar usuarios con rol superior al tuyo'
      });
    }

    // Regla adicional para gerente_ops respetando jerarquía/sensibilidad (alineada con frontend)
    if (req.user?.rol === 'gerente_ops' && GERENTE_EMAIL_ROLES_BLOQUEADOS.has(usuarioActual.rol)) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes editar usuarios con rol restringido para tu jerarquía'
      });
    }

    // Protección: no permitir cambiar rol de otro super_admin
    if (usuarioActual.rol === 'super_admin' && rol && rol !== 'super_admin') {
      await trx.rollback();
      return res.status(403).json({ success: false, message: 'No puedes cambiar el rol de un super administrador' });
    }

    // 3. PREPARAR DATOS (Lógica original manteniendo compatibilidad)
    const updateData = { updated_at: new Date() };

    const puedeEditarNombre = ['super_admin', 'finanzas', 'coordinador', 'gerente_ops'].includes(req.user.rol);
    const puedeEditarRol = ['super_admin', 'finanzas'].includes(req.user.rol);
    const puedeEditarEmail = EMAIL_EDIT_ALLOWED_ROLES.has(req.user.rol);

    if (hasEmail) {
      if (!puedeEditarEmail) {
        await trx.rollback();
        return res.status(403).json({
          success: false,
          message: 'Tu rol no tiene permiso para editar correos'
        });
      }

      if (!canEditTargetByHierarchyForEmail(req.user?.rol, usuarioActual.rol)) {
        await trx.rollback();
        return res.status(403).json({
          success: false,
          message: 'No puedes editar el correo de un usuario con rol superior'
        });
      }

      const emailNormalizado = normalizeEmailValue(email);
      if (!emailNormalizado) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: 'El email es obligatorio' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalizado)) {
        await trx.rollback();
        return res.status(400).json({ success: false, message: 'Formato de email inválido' });
      }

      const emailActualNormalizado = normalizeEmailValue(usuarioActual.email);
      if (emailNormalizado !== emailActualNormalizado) {
        const emailExistente = await trx(TABLES.USUARIOS)
          .whereNot('id', id)
          .andWhere(function () {
            this.whereRaw('LOWER(COALESCE(email, \'\')) = ?', [emailNormalizado])
              .orWhereRaw('LOWER(COALESCE(name, \'\')) = ?', [emailNormalizado]);
          })
          .first();

        if (emailExistente) {
          await trx.rollback();
          return res.status(400).json({
            success: false,
            message: 'El email ya está registrado o entra en conflicto con otro usuario'
          });
        }

        updateData.email = emailNormalizado;

        // Compatibilidad con cuentas legacy: si `name` almacenaba el email anterior, sincronizarlo
        const legacyName = normalizeEmailValue(usuarioActual.name);
        if (!hasNombreCompleto && legacyName && legacyName === emailActualNormalizado) {
          updateData.name = emailNormalizado;
        }
      }
    }

    // Super admin y finanzas pueden cambiar nombre y rol (coordinador solo nombre)
    if (puedeEditarNombre) {
      if (hasNombreCompleto) {
        const nombreFinal = nombre_completo?.toString().trim();
        updateData.nombre_completo = nombreFinal || null;
        updateData.name = nombreFinal || null; 
      }
      if (puedeEditarRol && hasRol && rol) {
        if (!USER_ASSIGNABLE_ROLES.has(rol)) {
          await trx.rollback();
          return res.status(400).json({
            success: false,
            message: 'Rol inválido'
          });
        }
        updateData.rol = rol;
      }
    }

    if (hasEstadoCuenta && estado_cuenta) {
      updateData.estado_cuenta = estado_cuenta;
      updateData.estado = estado_cuenta;
    }

    if (Object.keys(updateData).length <= 1) { // Solo updated_at
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    }

    // 4. EJECUTAR UPDATE EN BD
    const [usuarioActualizado] = await trx(TABLES.USUARIOS)
      .where('id', id)
      .update(updateData)
      .returning('*');

    if (updateData.email) {
      await trx('conductores')
        .where({ usuario_id: usuarioActualizado.id })
        .update({
          email: updateData.email,
          updated_at: trx.fn.now()
        });
    }

    // 5. LOG EN BD (Audit Service)
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'UPDATE_USER',
      descripcion: `Usuario ${usuarioActualizado.email} actualizado por ${req.user.rol}`,
      datos_sensibles: { usuario_editado_id: id, cambios: req.body },
      ip_address: auditService.getClientIp(req)
    });

    // Confirmamos la transacción
    await trx.commit(); 

    // =====================================================================
    // 📧 6. AUDITORÍA POR CORREO (SOLO GERENTE_OPS)
    // =====================================================================
    // Ejecutamos esto DESPUÉS del commit para no bloquear la respuesta si el correo falla.
    if (req.user.rol === 'gerente_ops') {
      
      let detalleHtml = '<ul style="padding-left: 20px;">';
      let huboCambiosReales = false;

      // Comparamos lo que envió vs lo que había
      // Nota: Usamos usuarioActual (antes del cambio) vs updateData (lo nuevo)
      
      if (updateData.nombre_completo && updateData.nombre_completo !== usuarioActual.nombre_completo) {
          detalleHtml += `<li><strong>Nombre:</strong> De "<em>${usuarioActual.nombre_completo}</em>" a "<em>${updateData.nombre_completo}</em>"</li>`;
          huboCambiosReales = true;
      }
      if (updateData.rol && updateData.rol !== usuarioActual.rol) {
          detalleHtml += `<li><strong>Rol:</strong> De "<em>${usuarioActual.rol}</em>" a "<em>${updateData.rol}</em>"</li>`;
          huboCambiosReales = true;
      }
      if (updateData.email && updateData.email !== usuarioActual.email) {
          detalleHtml += `<li><strong>Email:</strong> De "<em>${usuarioActual.email || 'Sin email'}</em>" a "<em>${updateData.email}</em>"</li>`;
          huboCambiosReales = true;
      }
if (updateData.estado_cuenta !== undefined && updateData.estado_cuenta != usuarioActual.estado_cuenta) {
          console.log('   👉 Cambio detectado en ESTADO');
          
          // Función auxiliar para formatear bonito el valor de la BD o del Front
          const formatEstado = (val) => {
              if (val === true || val === 1 || val === 'Activo') return 'Activo';
              if (val === 'suspendido') return 'Suspendido';
              if (val === 'prohibido') return 'Prohibido';
              if (val === false || val === 0 || val === 'Inactivo') return 'Inactivo';
              return val; // Por si llega algo raro, lo mostramos tal cual
          };

          const estadoAnterior = formatEstado(usuarioActual.estado_cuenta);
          const estadoNuevo = formatEstado(updateData.estado_cuenta);

          detalleHtml += `<li><strong>Estado:</strong> De "<em>${estadoAnterior}</em>" a "<em>${estadoNuevo}</em>"</li>`;
          huboCambiosReales = true;
      }

      if (huboCambiosReales) {
        // Llamamos al servicio de correo sin await (fire and forget)
        emailService.sendAuditNotification({
            usuarioAfectado: usuarioActual, // Enviamos el objeto usuario original
            accion: 'EDICIÓN DE PERFIL',
            detallesCambio: detalleHtml,
            actorNombre: req.user.nombre || req.user.email
        }).catch(err => console.error('Error enviando correo auditoría:', err));
      }
    }
    // =====================================================================

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
    // ... (Tu manejo de errores original) ...
    res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
  }
};
/**
 * Resetear contraseña de un usuario
 * POST /api/admin/usuarios/:id/resetear-password
 * Permisos: super_admin, direccion
 */
exports.resetearPassword = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { rol: rolSolicitante, nombre: nombreSolicitante, email: emailSolicitante } = req.user;

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
      .select('id', 'email', 'name')
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

    // =====================================================================
    // 📧 3. AUDITORÍA POR CORREO (SOLO GERENTE_OPS)
    // =====================================================================
    if (rolSolicitante === 'gerente_ops') {
      
      const detalleHtml = `
        <p>Se ha realizado un reseteo manual de contraseña.</p>
        <ul style="padding-left: 20px;">
           <li><strong>Usuario Afectado:</strong> ${usuario.name || 'Sin nombre'} (${usuario.email})</li>
           <li><strong>Acción:</strong> Generación de nueva contraseña temporal.</li>
        </ul>
        <div style="background-color: #fff3cd; padding: 10px; border-radius: 4px; font-size: 12px; color: #856404;">
           ⚠️ <strong>Nota de Seguridad:</strong> El Gerente ha recibido la nueva contraseña temporal en su pantalla para compartirla con el usuario.
        </div>
      `;

      // Enviamos correo (fire and forget)
      emailService.sendAuditNotification({
          usuarioAfectado: usuario,
          accion: 'RESETEO DE CONTRASEÑA',
          detallesCambio: detalleHtml,
          actorNombre: nombreSolicitante || emailSolicitante
      }).catch(err => console.error('❌ Error enviando correo auditoría reset:', err));
    }
    // =====================================================================

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
 * Permisos: super_admin (todos los estados), direccion (solo Activo/Suspendido)
 */
exports.cambiarEstado = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { nuevo_estado } = req.body;
    const { rol: rolSolicitante, nombre: nombreSolicitante, email: emailSolicitante } = req.user;

    // Validar que el estado sea válido
    const estadosValidos = ['Activo', 'suspendido', 'prohibido'];
    if (!estadosValidos.includes(nuevo_estado)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Estado inválido'
      });
    }

    // Si es direccion y quiere cambiar a prohibido, no puede
    if (req.user.rol === 'direccion' && nuevo_estado === 'prohibido') {
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

    if (req.user?.rol === 'coordinador' && COORDINADOR_ROLES_BLOQUEADOS.has(usuario.rol)) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes modificar usuarios con rol superior al tuyo'
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

    // =====================================================================
    // 📧 6. AUDITORÍA POR CORREO (SOLO GERENTE_OPS)
    // =====================================================================
    if (rolSolicitante === 'gerente_ops') {
      
      // Definimos el título de la acción según el estado nuevo
      let accionTitulo = '';
      let colorEstilo = '';
      
      if (nuevo_estado === 'Activo') {
          accionTitulo = 'REACTIVACIÓN DE CUENTA';
          colorEstilo = 'color: #2e7d32;'; // Verde
      } else if (nuevo_estado === 'suspendido') {
          accionTitulo = 'SUSPENSIÓN DE CUENTA';
          colorEstilo = 'color: #f57c00;'; // Naranja
      } else if (nuevo_estado === 'prohibido') {
          accionTitulo = 'BLOQUEO PERMANENTE (PROHIBIDO)';
          colorEstilo = 'color: #d32f2f;'; // Rojo
      }

      // Preparamos el HTML del detalle
      const detalleHtml = `
        <p>El estado de la cuenta ha cambiado:</p>
        <ul style="padding-left: 20px;">
           <li><strong>Anterior:</strong> ${estadoAnterior || 'Desconocido'}</li>
           <li><strong>Nuevo:</strong> <span style="font-weight: bold; ${colorEstilo}">${nuevo_estado}</span></li>
        </ul>
      `;

      // Enviamos correo (fire and forget)
      emailService.sendAuditNotification({
          usuarioAfectado: usuario,
          accion: accionTitulo,
          detallesCambio: detalleHtml,
          actorNombre: nombreSolicitante || emailSolicitante
      }).catch(err => console.error('❌ Error enviando correo auditoría cambio estado:', err));
    }
    // =====================================================================

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

    // Finanzas no puede eliminar usuarios de direcciÃ³n
    if (req.user?.rol === 'finanzas' && usuario.rol === 'direccion') {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No puedes eliminar a un usuario de direcciÃ³n'
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
