// backend/config/security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const auditService = require('../services/auditService');

// Configuración de Rate Limiting por tipo de endpoint
const rateLimiters = {
  // Login: máximo 5 intentos por IP cada 15 minutos
  login: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Demasiados intentos de login. Intente nuevamente en 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
      await auditService.logAction({
        accion: 'RATE_LIMIT_EXCEEDED',
        ruta_api: req.originalUrl,
        ip_address: auditService.getClientIp(req),
        mensaje_error: 'Rate limit excedido en login',
        resultado: 'denied',
        codigo_respuesta: 429
      });
      
      res.status(429).json({
        success: false,
        error: 'Demasiados intentos. Por favor espere 15 minutos.'
      });
    }
  }),
  
  // API general: 100 requests por IP cada 15 minutos
  general: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Límite de requests excedido.',
    standardHeaders: true,
    legacyHeaders: false
  }),
  
  // Creación de recursos: 20 por hora
  create: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Límite de creación excedido. Máximo 20 por hora.',
    skipSuccessfulRequests: true
  }),
  
  // Endpoints públicos (más restrictivo)
  public: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Límite excedido para endpoints públicos.'
  })
};

// Configuración de Helmet (headers de seguridad)
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: !process.env.NODE_ENV === 'development'
});

// Sanitización de inputs
const sanitizeInputs = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️ Input sanitizado: ${key} en ${req.originalUrl}`);
    auditService.logAction({
      accion: 'INPUT_SANITIZED',
      ruta_api: req.originalUrl,
      mensaje_error: `Campo ${key} contenía caracteres peligrosos`,
      ip_address: auditService.getClientIp(req),
      resultado: 'warning'
    });
  }
});

// Validación de IPs sospechosas
const blockSuspiciousIPs = async (req, res, next) => {
  const ip = auditService.getClientIp(req);
  
  // Lista de IPs bloqueadas (cargar desde BD en producción)
  const blockedIPs = process.env.BLOCKED_IPS?.split(',') || [];
  
  if (blockedIPs.includes(ip)) {
    await auditService.logAction({
      accion: 'BLOCKED_IP_ATTEMPT',
      ip_address: ip,
      ruta_api: req.originalUrl,
      resultado: 'denied',
      codigo_respuesta: 403
    });
    
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado'
    });
  }
  
  next();
};

// Validación de User-Agent
const validateUserAgent = (req, res, next) => {
  const userAgent = req.headers['user-agent'];
  
  if (!userAgent) {
    return res.status(400).json({
      success: false,
      error: 'User-Agent requerido'
    });
  }
  
  // Bloquear bots conocidos maliciosos
  const maliciousBots = ['sqlmap', 'nikto', 'havij', 'acunetix'];
  const lowerUA = userAgent.toLowerCase();
  
  for (const bot of maliciousBots) {
    if (lowerUA.includes(bot)) {
      auditService.logAction({
        accion: 'MALICIOUS_BOT_BLOCKED',
        user_agent: userAgent,
        ip_address: auditService.getClientIp(req),
        resultado: 'denied'
      });
      
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }
  }
  
  next();
};

module.exports = {
  rateLimiters,
  helmetConfig,
  sanitizeInputs,
  blockSuspiciousIPs,
  validateUserAgent
};