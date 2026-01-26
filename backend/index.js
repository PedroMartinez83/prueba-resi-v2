const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const compression = require('compression');
require('dotenv').config();

const app = express();

// Importar configuración de seguridad
const { 
  rateLimiters, 
  helmetConfig, 
  sanitizeInputs, 
  blockSuspiciousIPs, 
  validateUserAgent 
} = require('./config/security');

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const conductorRoutes = require('./routes/conductorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentsRoutes = require('./routes/paymentsRoutes');
const solicitudesRoutes = require('./routes/solicitudes');
const inversionistasRoutes = require('./routes/inversionistasRoutes');
const inversionesRoutes = require('./routes/inversionesRoutes');
const asignacionesRoutes = require('./routes/asignacionesRoutes');
const auroraRoutes = require('./routes/auroraRoutes');

// Importar middlewares de auditoría
const { 
  auditMiddleware, 
  errorAuditMiddleware,
  deteccionSospechosaMiddleware 
} = require('./middleware/auditMiddleware');

const auditService = require('./services/auditService');
const postgresService = require('./services/postgresService');


// 🔥 Función para verificar si la ruta debe saltarse middlewares
const shouldSkipMiddleware = (req) => {
  const fullPath = req.originalUrl || req.url;

  // Rutas que pueden usar multipart/form-data (express-fileupload)
  const multipartPaths = [
    '/api/solicitudes',
    '/api/admin/conductores'  // Se usa para subir documentos de conductores
  ];

  // Solo saltar middlewares si la petición ES multipart. De lo contrario
  // (por ejemplo, PUT/JSON para actualizar conductores) debemos permitir
  // que express.json y el resto de middlewares corran normalmente.
  const isMultipartPath = multipartPaths.some(path => fullPath.startsWith(path));
  return isMultipartPath && isMultipartRequest(req);
};

// 🔥 Rutas que usan Multer (no express-fileupload)
// Para evitar que el stream sea consumido dos veces y Busboy arroje
// "Unexpected end of form", saltamos express-fileupload en estos paths
const shouldSkipFileUpload = (req) => {
  const fullPath = req.originalUrl || req.url;
  const skipPaths = [
    '/api/conductor/vehiculo/revision-diaria',
    '/api/conductor/siniestros/registrar',
    '/api/conductor/pagos/registrar'
  ];

  return skipPaths.some(path => fullPath.startsWith(path));
};

// Solo procesar peticiones multipart (subida de archivos)
const isMultipartRequest = (req) => {
  const contentType = req.headers['content-type'] || '';
  return contentType.includes('multipart/form-data');
};

// ===== SEGURIDAD: HEADERS Y CONFIGURACIÓN INICIAL =====
app.use(helmetConfig);
app.use(compression());
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ===== CORS CONFIGURATION =====
const vercelOrigins = [
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
].filter(Boolean);

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : process.env.NODE_ENV === 'production' 
    ? [
        'https://app.driverautomanager.com',
        'https://api.driverautomanager.com', 
        'https://driverautomanager.com',
        'https://automanager.vercel.app',
        'https://automanager-back.vercel.app',
        'http://18.221.148.23:4173',
        ...vercelOrigins
      ]
    : ['http://localhost:3000', 'http://localhost:5173','http://18.221.148.23:4173',];

// Permitir orígenes desde la red local en entornos de desarrollo
const isLocalNetworkOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  // Permitir previews de Vercel asociados al proyecto
  const isVercelPreviewOrigin = (() => {
    try {
      const { hostname } = new URL(origin);
      const allowedProjects = ['automanager', 'automanager-back', 'driverautomanager'];
      const isVercelDomain = hostname.endsWith('.vercel.app');
      const matchesProject = allowedProjects.some(project =>
        hostname === `${project}.vercel.app` || hostname.startsWith(`${project}-`)
      );

      return isVercelDomain && matchesProject;
    } catch {
      return false;
    }
  })();

  if (isVercelPreviewOrigin) return true;

  // En desarrollo permitimos accesos desde la red local (IP privada)
  if (process.env.NODE_ENV !== 'production' && isLocalNetworkOrigin(origin)) {
    return true;
  }

  return false;
};

const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
};

app.use(cors({
  origin: function (origin, callback) {
    // 1. Permitir peticiones sin origen (como Postman o Server-to-Server)
    if (!origin) return callback(null, true);

    // 2. TU IP PÚBLICA (Agrégala aquí explícitamente)
    const allowedIPs = [
      'http://18.221.148.23:4173', 
      'http://18.221.148.23:3000',
      'http://localhost:5173'
    ];

    // 3. Verificar si el origen está en tus IPs o en la lista general
    // (Imprimimos en consola para que veas quién intenta entrar)
    console.log('🔍 CORS Check - Origen entrante:', origin);

    if (allowedIPs.includes(origin) || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⛔ CORS Bloqueó a:', origin);
      // TRUCO DE EMERGENCIA: Descomenta la siguiente línea si sigue fallando para dejar pasar a TODOS:
      // callback(null, true); 
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.options('*', cors(corsOptions));

// ===== STRIPE WEBHOOK (antes del body parser) =====
// IMPORTANTE: Este debe ir ANTES de express.json() porque Stripe necesita raw body
app.use('/api/payments/webhook', express.raw({type: 'application/json'}));

// ===== FILE UPLOAD MIDDLEWARE =====
// 🔥 CRÍTICO: Debe ir ANTES de express.json() y express.urlencoded()
// Si va después, el body ya fue parseado y multipart/form-data no funciona
const fileUploadMiddleware = fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB para documentos de conductores
  abortOnLimit: true,
  createParentPath: true,
  debug: process.env.NODE_ENV === 'development',
  parseNested: true
});

app.use((req, res, next) => {
  if (shouldSkipFileUpload(req) || !isMultipartRequest(req)) {
    return next();
  }
  return fileUploadMiddleware(req, res, next);
});

// Log de archivos recibidos (útil para debugging)
app.use((req, res, next) => {
  if (req.files && Object.keys(req.files).length > 0) {
    console.log('📎 Archivos detectados en petición:', Object.keys(req.files));
    console.log('📍 Ruta:', req.path);
  }
  next();
});

// ===== BODY PARSING & SANITIZATION =====
// Estos procesan JSON y URL-encoded, pero NO afectan multipart/form-data
// porque express-fileupload ya lo procesó arriba
app.use((req, res, next) => {
  if (shouldSkipMiddleware(req)) {
    console.log('⏭️  Skipping body-parser para:', req.path);
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (shouldSkipMiddleware(req)) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

app.use((req, res, next) => {
  if (shouldSkipMiddleware(req)) {
    console.log('⏭️  Skipping sanitization para:', req.path);
    return next();
  }
  sanitizeInputs(req, res, next);
});

// ===== SECURITY MIDDLEWARES =====
app.use((req, res, next) => {
  if (shouldSkipMiddleware(req)) {
    console.log('⏭️  Skipping security checks para:', req.path);
    return next();
  }
  blockSuspiciousIPs(req, res, next);
});

app.use((req, res, next) => {
  if (shouldSkipMiddleware(req)) {
    return next();
  }
  validateUserAgent(req, res, next);
});

app.use((req, res, next) => {
  if (shouldSkipMiddleware(req)) {
    return next();
  }
  deteccionSospechosaMiddleware(req, res, next);
});

// ===== RATE LIMITING GLOBAL =====
app.use('/api/', (req, res, next) => {
  if (shouldSkipMiddleware(req)) {
    console.log('⏭️  Skipping rate limiter para:', req.path);
    return next();
  }
  rateLimiters.general(req, res, next);
});

app.use('/api/auth/login', rateLimiters.login);
app.use('/api/auth/register', rateLimiters.login);

// Rate limiter específico para solicitudes (más permisivo)
app.use('/api/solicitudes', rateLimiters.public);

// ===== AUDITORÍA =====
app.use((req, res, next) => {
  if (shouldSkipMiddleware(req)) {
    console.log('⏭️  Skipping audit para:', req.path);
    return next();
  }
  
  auditMiddleware({
    exclude: [
      '/api/health',
      '/api/audit/stats',
      '/favicon.ico',
      '/api/payments/webhook'
    ]
  })(req, res, next);
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Auto Manager API funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '3.0.0',
    security: {
      helmet: 'Activo',
      rate_limiting: 'Activo',
      input_sanitization: 'Activo',
      audit: 'Activo',
      suspicious_detection: 'Activo'
    }
  });
});

// ===== API ROUTES CON RATE LIMITING ESPECÍFICO =====
// 🔥 IMPORTANTE: Solicitudes PRIMERO (antes de cualquier middleware adicional)
app.use('/api/solicitudes', solicitudesRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/conductor', conductorRoutes);
app.use('/api/payments', paymentsRoutes);

// Rutas admin específicas
app.use('/api/admin/inversionistas', inversionistasRoutes);
app.use('/api/admin/inversiones', inversionesRoutes);
app.use('/api/admin/asignaciones', asignacionesRoutes);
app.use('/api/admin/aurora', auroraRoutes);

// Ruta admin genérica (incluye /api/admin/conductores)
app.use('/api/admin', rateLimiters.create, adminRoutes);

// ===== AUDIT STATS (solo super_admin) =====
app.get('/api/audit/stats', async (req, res) => {
  try {
    if (req.user?.rol !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }
    
    const stats = await auditService.getAuditStats(30);
    const suspicious = await auditService.detectarActividadSospechosa();
    
    res.json({
      success: true,
      stats,
      suspicious
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== ERROR HANDLING =====
app.use(errorAuditMiddleware);

app.use((err, req, res, next) => {
  const errorId = Date.now();
  
  const errorDetails = {
    id: errorId,
    message: err.message,
    status: err.status || 500,
    path: req.path,
    method: req.method,
    ip: auditService.getClientIp(req),
    timestamp: new Date().toISOString()
  };
  
  console.error(`Error ${errorId}:`, process.env.NODE_ENV === 'development' ? err : errorDetails);
  
  if (process.env.NODE_ENV === 'production') {
    res.status(err.status || 500).json({
      success: false,
      message: err.status === 500 ? 'Error interno del servidor' : err.message,
      errorId
    });
  } else {
    res.status(err.status || 500).json({
      success: false,
      message: err.message,
      stack: err.stack,
      details: errorDetails
    });
  }
});

// ===== 404 HANDLER =====
app.use((req, res) => {
  auditService.logAction({
    accion: 'ROUTE_NOT_FOUND',
    metodo_http: req.method,
    ruta_api: req.originalUrl,
    ip_address: auditService.getClientIp(req),
    resultado: 'error',
    codigo_respuesta: 404
  });
  
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// ===== SCHEDULED TASKS =====
if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    const hora = new Date().getHours();
    if (hora === 3) {
      try {
        const resultado = await auditService.limpiarLogsAntiguos(90);
        console.log('🧹 Limpieza de logs:', resultado);
      } catch (error) {
        console.error('Error en limpieza:', error);
      }
    }
  }, 60 * 60 * 1000);
  
  setInterval(async () => {
    try {
      const suspicious = await auditService.detectarActividadSospechosa();
      if (suspicious.erroresRepetidos.length > 0 || 
          suspicious.accesosDenegados.length > 0 || 
          suspicious.eliminacionesMasivas.length > 0) {
        console.warn('⚠️ ACTIVIDAD SOSPECHOSA DETECTADA:', suspicious);
      }
    } catch (error) {
      console.error('Error en detección:', error);
    }
  }, 30 * 60 * 1000);
}

// ===== START SERVER =====
const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV}`);
  console.log(`🛡️ Seguridad: COMPLETA`);
  console.log(`🔍 Auditoría: ACTIVA`);
  console.log(`⚡ Rate Limiting: ACTIVO`);
  console.log(`🪖 Helmet: ACTIVO`);
  console.log(`📊 Compresión: ACTIVA`);
  console.log('========================================');
  
  setTimeout(async () => {
    try {
      await postgresService.db.raw('SELECT 1+1 as result');
      console.log('✅ Base de datos: Conectada');
    } catch (error) {
      console.error('❌ Base de datos: Error -', error.message);
    }
  }, 2000);
});
