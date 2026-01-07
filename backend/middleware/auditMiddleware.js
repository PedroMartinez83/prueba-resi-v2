// backend/middleware/auditMiddleware.js
const auditService = require('../services/auditService');
const postgresService = require('../services/postgresService');

const cleanCircularReferences = (obj, seen = new WeakSet()) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Si ya vimos este objeto, retornar null para evitar circularidad
  if (seen.has(obj)) {
    return '[Circular]';
  }

  seen.add(obj);

  // Si es un array
  if (Array.isArray(obj)) {
    return obj.map(item => cleanCircularReferences(item, seen));
  }

  // Si es un objeto
  const cleaned = {};
  for (const key in obj) {
    // ✅ CAMBIO: Usar Object.prototype.hasOwnProperty.call
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      try {
        // Ignorar archivos de express-fileupload y cloudinary
        if (key === 'files' || key === 'tempFilePath' || key === 'mv' || key === 'mimetype') {
          cleaned[key] = '[File Object]';
          continue;
        }
        
        const value = obj[key];
        
        if (typeof value === 'function') {
          cleaned[key] = '[Function]';
        } else if (value instanceof Buffer) {
          cleaned[key] = `[Buffer ${value.length} bytes]`;
        } else if (typeof value === 'object' && value !== null) {
          cleaned[key] = cleanCircularReferences(value, seen);
        } else {
          cleaned[key] = value;
        }
      } catch (e) {
        cleaned[key] = '[Error serializing]';
      }
    }
  }

  return cleaned;
};

/**
 * Middleware para auditar todas las peticiones HTTP
 */
const auditMiddleware = (options = {}) => {
  return async (req, res, next) => {
    // Marcar tiempo de inicio
    req.startTime = Date.now();
    
    // Capturar datos originales para comparación
    const originalSend = res.send;
    const originalJson = res.json;
    const originalStatus = res.status;
    
    // Datos de auditoría
    const auditData = {
      usuario_id: req.user?.id || null,
      usuario_email: req.user?.email || null,
      usuario_rol: req.user?.rol || null,
      metodo_http: req.method,
      ruta_api: req.originalUrl || req.url,
      ip_address: auditService.getClientIp(req),
      user_agent: req.headers['user-agent'],
      datos_anteriores: req.method === 'PUT' || req.method === 'PATCH' ? cleanCircularReferences(req.body) : null
    };

    // Interceptar respuesta
    res.status = function(code) {
      auditData.codigo_respuesta = code;
      return originalStatus.call(this, code);
    };

    res.send = function(data) {
      auditData.duracion_ms = Date.now() - req.startTime;
      registrarAuditoria(data);
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      auditData.duracion_ms = Date.now() - req.startTime;
      registrarAuditoria(data);
      return originalJson.call(this, data);
    };

    // Función para registrar la auditoría
    const registrarAuditoria = async (responseData) => {
      try {
        // Determinar resultado basado en el código de respuesta
        if (!auditData.codigo_respuesta) {
          auditData.codigo_respuesta = res.statusCode;
        }
        
        if (auditData.codigo_respuesta >= 200 && auditData.codigo_respuesta < 300) {
          auditData.resultado = 'success';
        } else if (auditData.codigo_respuesta === 401 || auditData.codigo_respuesta === 403) {
          auditData.resultado = 'denied';
        } else if (auditData.codigo_respuesta >= 400) {
          auditData.resultado = 'error';
          if (responseData?.error || responseData?.message) {
            auditData.mensaje_error = responseData.error || responseData.message;
          }
        }

        // Determinar acción basada en el método HTTP
        switch (req.method) {
          case 'POST':
            auditData.accion = 'CREATE';
            auditData.datos_nuevos = cleanCircularReferences(req.body);
            break;
          case 'PUT':
          case 'PATCH':
            auditData.accion = 'UPDATE';
            auditData.datos_nuevos = cleanCircularReferences(req.body);
            break;
          case 'DELETE':
            auditData.accion = 'DELETE';
            break;
          case 'GET':
            auditData.accion = 'READ';
            break;
        }

        // Determinar tabla afectada desde la ruta
        const rutaParts = req.originalUrl.split('/').filter(Boolean);
        const tablasConocidas = [
          'vehiculos', 'conductores', 'usuarios', 'rentas', 
          'mantenimientos', 'clientes', 'inversiones'
        ];
        
        for (const tabla of tablasConocidas) {
          if (rutaParts.includes(tabla)) {
            auditData.tabla_afectada = tabla;
            // Intentar obtener el ID del registro
            const indexTabla = rutaParts.indexOf(tabla);
            if (rutaParts[indexTabla + 1] && !isNaN(rutaParts[indexTabla + 1])) {
              auditData.registro_id = parseInt(rutaParts[indexTabla + 1]);
            }
            break;
          }
        }

        // Solo auditar si está configurado para esta ruta
        const rutasExcluidas = options.exclude || [
          '/api/health',
          '/api/audit/stats',
          '/favicon.ico'
        ];
        
        const debeAuditar = !rutasExcluidas.some(ruta => 
          req.originalUrl.startsWith(ruta)
        );

        if (debeAuditar) {
          await auditService.logAction(auditData);
        }
      } catch (error) {
        console.error('Error al registrar auditoría:', error);
        // No interrumpir la respuesta por error de auditoría
      }
    };

    next();
  };
};

/**
 * Middleware para auditar errores
 */
const errorAuditMiddleware = async (err, req, res, next) => {
  try {
    const { navegador, sistema_operativo } = auditService.parseUserAgent(req.headers['user-agent']);
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: err.status >= 500 ? 'critical' : 'error',
      mensaje: err.message,
      stack_trace: err.stack,
      contexto: cleanCircularReferences({
        body: req.body,
        params: req.params,
        query: req.query
      }),
      archivo: err.fileName,
      linea: err.lineNumber,
      navegador,
      sistema_operativo,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
  } catch (auditError) {
    console.error('Error registrando error en auditoría:', auditError);
  }
  
  next(err);
};

/**
 * Middleware para detectar actividad sospechosa
 */
const deteccionSospechosaMiddleware = async (req, res, next) => {
  // COMENTADO TEMPORALMENTE PARA DEBUG
  next();
  
  /* COMENTADO
  try {
    const ip = auditService.getClientIp(req);
    
    // Verificar intentos recientes desde esta IP
    const intentosRecientes = await postgresService.db('audit_logs')
      .where('ip_address', ip)
      .where('resultado', 'denied')
      .where('created_at', '>=', new Date(Date.now() - 15 * 60 * 1000)) // Últimos 15 minutos
      .count('id as total')
      .first();
    
    if (intentosRecientes && intentosRecientes.total > 5) {
      // Bloquear temporalmente o aplicar rate limiting más estricto
      console.warn(`⚠️ IP sospechosa detectada: ${ip} con ${intentosRecientes.total} intentos fallidos`);
      
      // Registrar como actividad sospechosa
      await auditService.logAction({
        accion: 'SUSPICIOUS_ACTIVITY',
        ip_address: ip,
        mensaje_error: `${intentosRecientes.total} intentos fallidos en 15 minutos`,
        resultado: 'denied',
        codigo_respuesta: 429
      });
      
      return res.status(429).json({
        success: false,
        error: 'Demasiados intentos. Por favor espere antes de intentar nuevamente.'
      });
    }
  } catch (error) {
    console.error('Error en detección sospechosa:', error);
  }
  
  next();
  */
};

module.exports = {
  auditMiddleware,
  errorAuditMiddleware,
  deteccionSospechosaMiddleware
};