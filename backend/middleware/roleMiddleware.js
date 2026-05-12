// backend/middleware/roleMiddleware.js

// DefiniciÃ³n de roles segÃºn el documento de especificaciones
const ROLES = {
  SUPER_ADMIN: 'super_admin',        // TI - Control total del sistema
  DIRECCION: 'direccion',      // Vista total, dashboards, decisiones
  GERENTE_OPERACIONES: 'gerente_ops', // GestiÃ³n flota y conductores
  FINANZAS: 'finanzas',               // Finanzas, pagos, conciliaci?n
  COORDINADOR: 'coordinador',         // Coordinador de zona
  GESTOR_FLOTA: 'gestor_flota',     // Documentos, seguros, compliance
  RECLUTADOR: 'reclutador',         // Solo prospectos y reclutamiento
  JEFE_TALLER: 'jefe_taller',       // Mantenimiento y Ã³rdenes de servicio
  ENCARGADO_COMPRAS: 'compras',     // Inventario y proveedores
  SECRETARIA: 'secretaria',         // Soporte administrativo
  CONDUCTOR: 'conductor',            // Acceso limitado a su informaciÃ³n
  CLIENTE: 'cliente',                // Solo sus rentas y pagos
  INVERSIONISTA: 'inversionista'         // Acceso a su portafolio y dashboard de inversiones
};

// JerarquÃ­a de roles (mayor nÃºmero = mÃ¡s permisos)
const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.DIRECCION]: 90,
  [ROLES.GERENTE_OPERACIONES]: 80,
  [ROLES.FINANZAS]: 70,
  [ROLES.COORDINADOR]: 65,
  [ROLES.GESTOR_FLOTA]: 60,
  [ROLES.JEFE_TALLER]: 50,
  [ROLES.ENCARGADO_COMPRAS]: 40,
  [ROLES.RECLUTADOR]: 30,
  [ROLES.SECRETARIA]: 25,
  [ROLES.CONDUCTOR]: 20,
  [ROLES.CLIENTE]: 10
};

// Matriz de permisos por mÃ³dulo y acciÃ³n
const PERMISSIONS = {
  // CONDUCTORES
  'conductores.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES, ROLES.GESTOR_FLOTA, ROLES.SECRETARIA, ROLES.COORDINADOR, ROLES.JEFE_TALLER],
  'conductores.create': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.SECRETARIA, ROLES.COORDINADOR, ROLES.DIRECCION, ROLES.JEFE_TALLER],
  'conductores.update': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.GESTOR_FLOTA, ROLES.COORDINADOR, ROLES.DIRECCION, ROLES.JEFE_TALLER],
  'conductores.delete': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.COORDINADOR, ROLES.DIRECCION, ROLES.JEFE_TALLER],
  'conductores.approve': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES],
  
  // PROSPECTOS (Reclutamiento)
  'prospectos.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES, ROLES.RECLUTADOR, ROLES.SECRETARIA, ROLES.COORDINADOR],
  'prospectos.create': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.RECLUTADOR, ROLES.SECRETARIA, ROLES.COORDINADOR, ROLES.DIRECCION],
  'prospectos.update': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.RECLUTADOR, ROLES.SECRETARIA, ROLES.COORDINADOR, ROLES.DIRECCION],
  'prospectos.delete': [ROLES.SUPER_ADMIN, ROLES.RECLUTADOR, ROLES.SECRETARIA, ROLES.COORDINADOR, ROLES.GERENTE_OPERACIONES, ROLES.DIRECCION],
  
  // VEHÃCULOS
  'vehiculos.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES, ROLES.GESTOR_FLOTA, ROLES.JEFE_TALLER, ROLES.COORDINADOR],
  'vehiculos.create': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.COORDINADOR, ROLES.DIRECCION],
  'vehiculos.update': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.GESTOR_FLOTA, ROLES.COORDINADOR, ROLES.DIRECCION],
  'vehiculos.delete': [ROLES.SUPER_ADMIN, ROLES.COORDINADOR, ROLES.GERENTE_OPERACIONES, ROLES.DIRECCION],
  'vehiculos.assign': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES],
  
  // DOCUMENTOS VEHICULARES (Seguros, tarjetas circulaciÃ³n)
  'documentos.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES, ROLES.GESTOR_FLOTA],
  'documentos.update': [ROLES.SUPER_ADMIN, ROLES.GESTOR_FLOTA, ROLES.DIRECCION],
  
  // RENTAS
  'rentas.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES, ROLES.SECRETARIA, ROLES.COORDINADOR],
  'rentas.create': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.SECRETARIA, ROLES.COORDINADOR, ROLES.DIRECCION],
  'rentas.update': [ROLES.SUPER_ADMIN, ROLES.SECRETARIA, ROLES.COORDINADOR, ROLES.DIRECCION],
  'rentas.delete': [ROLES.SUPER_ADMIN, ROLES.DIRECCION],
  'rentas.payment': [ROLES.SUPER_ADMIN, ROLES.SECRETARIA, ROLES.DIRECCION],
  
  // PAGOS DE RENTAS
  'pagos_rentas.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES, ROLES.FINANZAS, ROLES.SECRETARIA, ROLES.COORDINADOR],
  'pagos_rentas.create': [ROLES.SUPER_ADMIN, ROLES.FINANZAS, ROLES.SECRETARIA, ROLES.COORDINADOR, ROLES.GERENTE_OPERACIONES, ROLES.DIRECCION],
  'pagos_rentas.update': [ROLES.SUPER_ADMIN, ROLES.FINANZAS, ROLES.SECRETARIA, ROLES.COORDINADOR, ROLES.GERENTE_OPERACIONES, ROLES.DIRECCION],
  'pagos_rentas.delete': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.DIRECCION],
  
  
  // FINANZAS
  'finanzas.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.FINANZAS, ROLES.GERENTE_OPERACIONES],
  'finanzas.ingresos': [ROLES.SUPER_ADMIN, ROLES.DIRECCION],
  'finanzas.gastos': [ROLES.SUPER_ADMIN, ROLES.JEFE_TALLER, ROLES.ENCARGADO_COMPRAS, ROLES.DIRECCION],
  'finanzas.conciliar': [ROLES.SUPER_ADMIN, ROLES.DIRECCION],
  'finanzas.reportes': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.FINANZAS, ROLES.GERENTE_OPERACIONES],
  
  // MANTENIMIENTO
  'mantenimiento.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES, ROLES.JEFE_TALLER, ROLES.ENCARGADO_COMPRAS],
  'mantenimiento.create': [ROLES.SUPER_ADMIN, ROLES.JEFE_TALLER, ROLES.DIRECCION],
  'mantenimiento.update': [ROLES.SUPER_ADMIN, ROLES.JEFE_TALLER, ROLES.DIRECCION],
  'mantenimiento.delete': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.JEFE_TALLER, ROLES.GERENTE_OPERACIONES, 'gerente'],
  'mantenimiento.approve': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.DIRECCION, ROLES.JEFE_TALLER],
  
  // INVENTARIO Y COMPRAS
  'inventario.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.JEFE_TALLER, ROLES.ENCARGADO_COMPRAS],
  'inventario.update': [ROLES.SUPER_ADMIN, ROLES.ENCARGADO_COMPRAS, ROLES.DIRECCION],
  'compras.create': [ROLES.SUPER_ADMIN, ROLES.ENCARGADO_COMPRAS, ROLES.DIRECCION],
  'compras.approve': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.DIRECCION],
  'proveedores.manage': [ROLES.SUPER_ADMIN, ROLES.ENCARGADO_COMPRAS, ROLES.DIRECCION],
  
  // SINIESTROS
  'siniestros.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES, ROLES.GESTOR_FLOTA],
  'siniestros.create': [ROLES.SUPER_ADMIN, ROLES.GERENTE_OPERACIONES, ROLES.GESTOR_FLOTA, ROLES.DIRECCION],
  'siniestros.update': [ROLES.SUPER_ADMIN, ROLES.GESTOR_FLOTA, ROLES.DIRECCION],
  
  // REPORTES Y ESTADÃSTICAS
  'estadisticas.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES],
  'reportes.financieros': [ROLES.SUPER_ADMIN, ROLES.DIRECCION],
  'reportes.operativos': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.GERENTE_OPERACIONES],
  
  // ðŸ†• ADMINISTRACIÃ“N DE USUARIOS (ACTUALIZADO)
  'usuarios.view': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.FINANZAS, ROLES.COORDINADOR, ROLES.GERENTE_OPERACIONES, ROLES.JEFE_TALLER],
  'usuarios.create': [ROLES.SUPER_ADMIN, ROLES.FINANZAS, ROLES.GERENTE_OPERACIONES],
  'usuarios.update': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.FINANZAS, ROLES.COORDINADOR, ROLES.GERENTE_OPERACIONES, ROLES.JEFE_TALLER], // direccion solo puede cambiar estado
  'usuarios.delete': [ROLES.SUPER_ADMIN, ROLES.FINANZAS, ROLES.GERENTE_OPERACIONES],
  'usuarios.reset_password': [ROLES.SUPER_ADMIN, ROLES.DIRECCION, ROLES.FINANZAS, ROLES.GERENTE_OPERACIONES],
  'sistema.config': [ROLES.SUPER_ADMIN],

  // Permisos de inversiones
  'inversiones.view': ['super_admin', 'direccion', 'inversionista', 'finanzas', 'gerente_ops', 'coordinador'],
  'inversiones.create': ['super_admin', 'direccion', 'inversionista', 'finanzas', 'gerente_ops', 'coordinador'],
  'inversiones.update': ['super_admin', 'direccion','inversionista', 'finanzas', 'gerente_ops', 'coordinador'],
  'inversiones.delete': ['super_admin', 'inversionista', 'direccion', 'finanzas', 'gerente_ops', 'coordinador'],
  'inversiones.payment': ['direccion', 'super_admin', 'inversionista', 'finanzas', 'gerente_ops', 'coordinador']
};

/**
 * Verifica si un rol tiene un permiso especÃ­fico
 * @param {string} userRole - Rol del usuario
 * @param {string} permission - Permiso a verificar
 * @returns {boolean}
 */
const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const resolvePermissionAliases = (permission) => {
  const perm = String(permission || '').trim();
  if (!perm) return [];

  const aliases = [perm];
  if (perm.startsWith('mantenimientos.')) {
    aliases.push(perm.replace(/^mantenimientos\./, 'mantenimiento.'));
  } else if (perm.startsWith('mantenimiento.')) {
    aliases.push(perm.replace(/^mantenimiento\./, 'mantenimientos.'));
  }

  return [...new Set(aliases)];
};

const hasPermission = (userRole, permission) => {
  const role = normalizeRole(userRole);
  // Super admin siempre tiene todos los permisos
  if (role === ROLES.SUPER_ADMIN) return true;

  if (role === ROLES.GERENTE_OPERACIONES) return true; // Por seguridad, verificar ambas formas

  // Finanzas tiene todos los accesos segÃºn configuraciÃ³n
  if (role === ROLES.FINANZAS) return true;

  if (role === ROLES.JEFE_TALLER) return true; // Jefe de taller tiene acceso amplio a mantenimientos e inventario
  
  const permissionAliases = resolvePermissionAliases(permission);

  // Verificar si el permiso existe y el rol estÃ¡ en la lista
  const allowedRoles = permissionAliases
    .map((perm) => PERMISSIONS[perm])
    .find(Boolean);
  if (!allowedRoles) return false;
  
  return allowedRoles.includes(role);
};

/**
 * Verifica si un rol tiene mayor jerarquÃ­a que otro
 * @param {string} role1 - Primer rol
 * @param {string} role2 - Segundo rol
 * @returns {boolean}
 */
const hasHigherRole = (role1, role2) => {
  return (ROLE_HIERARCHY[role1] || 0) > (ROLE_HIERARCHY[role2] || 0);
};

/**
 * Middleware para verificar permisos
 * @param {string|Array} requiredPermissions - Permiso(s) requerido(s)
 * @returns {Function} Middleware de Express
 */
const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    // Verificar que el usuario estÃ© autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }
    
    const userRole = normalizeRole(req.user.rol || req.user.role || ROLES.CONDUCTOR);
    
    // âœ… BYPASS EXPLÃCITO PARA SUPER_ADMIN - AGREGADO PARA SEGURIDAD
    if (userRole === 'super_admin' || userRole === ROLES.SUPER_ADMIN) {
      return next();
    }
    
    // Si es un array de permisos, verificar que tenga al menos uno
    if (Array.isArray(requiredPermissions)) {
      const hasAnyPermission = requiredPermissions.some(permission => 
        hasPermission(userRole, permission)
      );
      
      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para realizar esta acciÃ³n',
          requiredPermissions,
          userRole
        });
      }
    } else {
      // Si es un solo permiso, verificar que lo tenga
      if (!hasPermission(userRole, requiredPermissions)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para realizar esta acciÃ³n',
          requiredPermission: requiredPermissions,
          userRole
        });
      }
    }
    
    next();
  };
};

/**
 * Middleware para requerir un rol mÃ­nimo
 * @param {string} minimumRole - Rol mÃ­nimo requerido
 * @returns {Function} Middleware de Express
 */
const requireRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }
    
    const userRole = req.user.rol || ROLES.CONDUCTOR;
    const userHierarchy = ROLE_HIERARCHY[userRole] || 0;
    const requiredHierarchy = ROLE_HIERARCHY[minimumRole] || 0;
    
    if (userHierarchy < requiredHierarchy) {
      return res.status(403).json({
        success: false,
        message: 'Rol insuficiente para esta acciÃ³n',
        requiredRole: minimumRole,
        userRole
      });
    }
    
    next();
  };
};

/**
 * Middleware para filtrar datos segÃºn el rol
 * Ãštil para que cada rol vea solo la informaciÃ³n que le corresponde
 */
const filterDataByRole = (req, res, next) => {
  const userRole = req.user?.rol || ROLES.CONDUCTOR;
  
  // Agregar filtros al query segÃºn el rol
  req.roleFilters = {};
  
  switch(userRole) {
    case ROLES.CONDUCTOR:
      // Los conductores solo ven su propia informaciÃ³n
      req.roleFilters.conductorId = req.user.id;
      break;
      
    case ROLES.CLIENTE:
      // Los clientes solo ven sus propias rentas
      req.roleFilters.clienteId = req.user.id;
      break;
      
    case ROLES.RECLUTADOR:
      // Los reclutadores solo ven prospectos
      req.roleFilters.onlyProspects = true;
      break;
      
    case ROLES.JEFE_TALLER:
      // Jefe de taller ve solo mantenimientos
      req.roleFilters.onlyMaintenance = true;
      break;
      
    case ROLES.FINANZAS:
      // Finanzas ve toda la informaciÃ³n financiera
      req.roleFilters.financialData = true;
      break;
  
      
    // Roles con acceso mÃ¡s amplio
    case ROLES.GESTOR_FLOTA:
    case ROLES.GERENTE_OPERACIONES:
    case ROLES.DIRECCION:
    case ROLES.SUPER_ADMIN:
      // Sin filtros, ven todo segÃºn sus permisos
      break;
      
    default:
      // Por defecto, filtro restrictivo
      req.roleFilters.restricted = true;
  }
  
  next();
};

/**
 * Obtener permisos de un rol
 * @param {string} role - Rol a consultar
 * @returns {Array} Lista de permisos
 */
const getRolePermissions = (role) => {
  const permissions = [];
  
  for (const [permission, allowedRoles] of Object.entries(PERMISSIONS)) {
    if (allowedRoles.includes(role) || role === ROLES.SUPER_ADMIN) {
      permissions.push(permission);
    }
  }
  
  return permissions;
};

/**
 * Obtener informaciÃ³n completa del rol
 * @param {string} role - Rol a consultar
 * @returns {Object} InformaciÃ³n del rol
 */
const getRoleInfo = (role) => {
  return {
    name: role,
    hierarchy: ROLE_HIERARCHY[role] || 0,
    permissions: getRolePermissions(role),
    description: getRoleDescription(role)
  };
};

/**
 * Obtener descripciÃ³n del rol
 * @param {string} role - Rol
 * @returns {string} DescripciÃ³n
 */
const getRoleDescription = (role) => {
  const descriptions = {
    [ROLES.SUPER_ADMIN]: 'Administrador del sistema con control total',
    [ROLES.DIRECCION]: 'VisiÃ³n completa del negocio y toma de decisiones',
    [ROLES.GERENTE_OPERACIONES]: 'GestiÃ³n de flota y conductores',
    [ROLES.COORDINADOR]: 'Coordinador de zona (operaciÃ³n y seguimiento)',
    [ROLES.GESTOR_FLOTA]: 'GestiÃ³n documental y compliance',
    [ROLES.RECLUTADOR]: 'CaptaciÃ³n y gestiÃ³n de prospectos',
    [ROLES.JEFE_TALLER]: 'Mantenimiento y Ã³rdenes de servicio',
    [ROLES.ENCARGADO_COMPRAS]: 'Inventario y proveedores',
    [ROLES.SECRETARIA]: 'Soporte administrativo (pagos y solicitudes)',
    [ROLES.CONDUCTOR]: 'Conductor de vehÃ­culo',
    [ROLES.CLIENTE]: 'Cliente del servicio'
  };
  
  return descriptions[role] || 'Sin descripciÃ³n';
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  hasPermission,
  hasHigherRole,
  requirePermission,
  requireRole,
  filterDataByRole,
  getRolePermissions,
  getRoleInfo,
  getRoleDescription
};

