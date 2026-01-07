const jwt = require('jsonwebtoken');

// Verificar token JWT
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  console.log('🔐 verifyToken ejecutándose...');
  console.log('  Path:', req.path);
  console.log('  Authorization header:', req.header('Authorization')?.substring(0, 50) + '...');
  console.log('  Token extraído:', token ? 'Sí (' + token.substring(0, 20) + '...)' : 'No');
  
  if (!token) {
    console.log('  ❌ No hay token');
    return res.status(401).json({ 
      success: false, 
      message: 'Acceso denegado. No se proporcionó token.' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const now = Date.now();
    const lastActivity = decoded.lastActivity || 0;
    const INACTIVITY_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 horas

    if (lastActivity && now - lastActivity > INACTIVITY_LIMIT_MS) {
      console.log('  ❌ Token expirado por inactividad');
      return res.status(401).json({
        success: false,
        message: 'Token expirado por inactividad'
      });
    }

    const refreshedPayload = {
      ...decoded,
      lastActivity: now
    };

    // Remove existing exp/iat to avoid conflicts when re-signing
    const { exp, iat, ...payloadToSign } = refreshedPayload;

    const refreshedToken = jwt.sign(payloadToSign, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '1d'
    });

    res.setHeader('x-refreshed-token', refreshedToken);

    console.log('  ✅ Token válido. Usuario ID:', decoded.id, 'Rol:', decoded.rol || decoded.role);
    req.user = refreshedPayload;
    
    // Asegurar compatibilidad: si tiene 'role' mapearlo a 'rol'
    if (decoded.role && !decoded.rol) {
      req.user.rol = decoded.role;
    }
    
    console.log('  ✅ req.user asignado:', req.user);
    next();
  } catch (error) {
    console.log('  ❌ Token inválido:', error.message);
    res.status(401).json({ 
      success: false, 
      message: 'Token inválido o expirado' 
    });
  }
};

// Verificar rol específico (mantener por compatibilidad pero usar el nuevo sistema)
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'No autenticado' 
      });
    }

    // Compatibilidad con 'rol' y 'role'
    const userRole = req.user.rol || req.user.role || 'conductor';

    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permisos para acceder a este recurso',
        requiredRoles: roles,
        userRole: userRole
      });
    }

    next();
  };
};

// Middleware para rutas opcionales (no requiere token pero lo procesa si existe)
const optionalAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      
      // Asegurar compatibilidad
      if (decoded.role && !decoded.rol) {
        req.user.rol = decoded.role;
      }
    } catch (error) {
      // Token inválido, pero continuamos sin usuario
      req.user = null;
    }
  }
  
  next();
};

module.exports = {
  verifyToken,
  checkRole,
  optionalAuth
};
