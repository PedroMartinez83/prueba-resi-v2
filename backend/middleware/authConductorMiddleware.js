const jwt = require('jsonwebtoken');
const { db, TABLES } = require('../services/postgresService');

const INACTIVITY_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 horas

/**
 * Middleware para proteger rutas del portal del CONDUCTOR.
 * Verifica el JWT y asegura que el rol sea 'conductor'.
 */
const authConductor = async (req, res, next) => {
  // 1. Obtener el token del header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Acceso denegado. No se proporcionó token.' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 2. Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Inactividad
    const now = Date.now();
    const lastActivity = decoded.lastActivity || 0;

    if (lastActivity && now - lastActivity > INACTIVITY_LIMIT_MS) {
      return res.status(401).json({
        success: false,
        message: 'Token expirado por inactividad.'
      });
    }
    
    // 3. Verificar el ROL
    if (decoded.rol !== 'conductor') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso prohibido. Rol no autorizado.' 
      });
    }

    // 4. (Opcional pero recomendado) Verificar que el usuario aún exista
    // Usamos el 'id' del token, que es el 'id' de la tabla USUARIOS
    const usuario = await db(TABLES.USUARIOS)
      .where('id', decoded.id)
      .where('estado', 'Activo') // Asegurarse que esté activo
      .first();

    if (!usuario) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido. Usuario no encontrado o inactivo.' 
      });
    }
    
    // 5. ¡Éxito! Adjuntar el usuario al request
    // req.user contendrá la info de la tabla 'usuarios' (id, email, rol, etc.)
    req.user = usuario; 
    
    next(); // Continuar a la siguiente función (el controlador)

  } catch (error) {
    console.error('Error en middleware de conductor:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expirado. Por favor, inicia sesión de nuevo.' 
      });
    }
    return res.status(401).json({ 
      success: false, 
      message: 'Token inválido.' 
    });
  }
};

module.exports = authConductor;
