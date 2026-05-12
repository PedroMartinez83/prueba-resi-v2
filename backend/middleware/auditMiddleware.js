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

const ROUTE_TABLE_ALIASES = Object.freeze({
  vehiculos: 'vehiculos',
  conductores: 'conductores',
  usuarios: 'usuarios',
  rentas: 'rentas',
  pagos: 'pagos',
  'pagos-rentas': 'pagos_diarios',
  pagos_rentas: 'pagos_diarios',
  'pagos-diarios': 'pagos_diarios',
  pagos_diarios: 'pagos_diarios',
  mantenimientos: 'mantenimientos',
  clientes: 'clientes',
  inversiones: 'inversiones',
  inversionistas: 'inversionistas',
  solicitudes: 'solicitudes',
  asignaciones: 'asignaciones',
  siniestros: 'siniestros'
});

const normalizeRouteSegment = (value) => String(value || '')
  .trim()
  .toLowerCase();

const parseNumericId = (value) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const safeParseJson = (value) => {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const extractAuditTargetFromRequest = ({ req, responseData }) => {
  const fullPath = String(req.originalUrl || req.url || '').split('?')[0];
  const routeParts = fullPath.split('/').filter(Boolean);

  let tabla_afectada = null;
  let indexTabla = -1;

  for (let i = 0; i < routeParts.length; i += 1) {
    const normalizedSegment = normalizeRouteSegment(routeParts[i]);
    const tablaCanonica = ROUTE_TABLE_ALIASES[normalizedSegment];

    if (tablaCanonica) {
      tabla_afectada = tablaCanonica;
      indexTabla = i;
      break;
    }
  }

  let registro_id =
    parseNumericId(req.params?.id) ||
    parseNumericId(req.body?.id) ||
    parseNumericId(req.query?.id);

  if (!registro_id && indexTabla >= 0) {
    registro_id = parseNumericId(routeParts[indexTabla + 1]);
  }

  if (!registro_id) {
    const responseObject =
      responseData && typeof responseData === 'object'
        ? responseData
        : safeParseJson(responseData);

    registro_id =
      parseNumericId(responseObject?.data?.id) ||
      parseNumericId(responseObject?.result?.id) ||
      parseNumericId(responseObject?.id) ||
      parseNumericId(responseObject?.data?.registro_id) ||
      parseNumericId(responseObject?.result?.registro_id) ||
      parseNumericId(responseObject?.registro_id);
  }

  return { tabla_afectada, registro_id };
};

/**
 * Middleware para auditar todas las peticiones HTTP
 */
const auditMiddleware = (options = {}) => {
  return async (req, res, next) => {

    // 🛑 APAGADOR MAESTRO PARA INVERSIONISTAS 🛑
    // Si la ruta incluye 'inversionistas', no reescribimos NADA.
    // Pasamos el control directamente al siguiente middleware o controlador.
    // Esto permite que el Trigger de PostgreSQL haga el log exacto sin interferencias.
    if (req.originalUrl && req.originalUrl.includes('inversionistas')) {
      return next();
    }
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
    let auditoriaRegistrada = false;

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
      // Evita duplicados cuando Express ejecuta res.json() y luego res.send() internamente.
      if (auditoriaRegistrada) return;
      auditoriaRegistrada = true;

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

        // Determinar tabla y registro afectado desde request/response
        const objetivoAuditoria = extractAuditTargetFromRequest({ req, responseData });
        if (objetivoAuditoria.tabla_afectada) {
          auditData.tabla_afectada = objetivoAuditoria.tabla_afectada;
        }
        if (objetivoAuditoria.registro_id) {
          auditData.registro_id = objetivoAuditoria.registro_id;
        }

        // Solo auditar si está configurado para esta ruta
        const rutasExcluidas = options.exclude || [
          '/api/health',
          '/api/audit/stats',
          '/favicon.ico',
          '/api/admin/inversionistas/mi-perfil'
        ];
        
        const debeAuditar = !rutasExcluidas.some(ruta => 
          req.originalUrl.startsWith(ruta)
        );

        if (debeAuditar) {
          await auditService.logAction(auditData);

          if (
            auditData.accion === 'DELETE' &&
            auditData.resultado === 'success' &&
            req.user?.rol === 'finanzas'
          ) {
            const deletedData = responseData?.data || responseData?.result || responseData;
            await auditService.notificarEliminacionFinanzas({
              actor: req.user,
              ruta_api: auditData.ruta_api,
              tabla_afectada: auditData.tabla_afectada,
              registro_id: auditData.registro_id,
              ip_address: auditData.ip_address,
              user_agent: auditData.user_agent,
              fecha: new Date(),
              datos_registro: deletedData
            });
          }

          if (
            auditData.accion === 'DELETE' &&
            auditData.resultado === 'success' &&
            req.user?.rol === 'coordinador' &&
            ['conductores', 'vehiculos', 'solicitudes'].includes(auditData.tabla_afectada)
          ) {
            const deletedData = responseData?.data || responseData?.result || responseData;
            await auditService.notificarEliminacionCoordinador({
              actor: req.user,
              ruta_api: auditData.ruta_api,
              tabla_afectada: auditData.tabla_afectada,
              registro_id: auditData.registro_id,
              ip_address: auditData.ip_address,
              user_agent: auditData.user_agent,
              fecha: new Date(),
              datos_registro: deletedData
            });
          }

          if (
            auditData.accion === 'DELETE' &&
            auditData.resultado === 'success' &&
            ['gerente_ops', 'direccion', 'director', 'super_admin'].includes(req.user?.rol) &&
            auditData.tabla_afectada === 'solicitudes'
          ) {
            const deletedData = responseData?.data || responseData?.result || responseData;
            await auditService.notificarEliminacionRolSuperior({
              actor: req.user,
              tabla_afectada: auditData.tabla_afectada,
              registro_id: auditData.registro_id,
              fecha: new Date(),
              datos_registro: deletedData
            });
          }

          if (
            auditData.accion === 'DELETE' &&
            auditData.resultado === 'success' &&
            auditData.tabla_afectada === 'mantenimientos'
          ) {
            const deletedData = responseData?.data || responseData?.result || responseData;
            await auditService.notificarEliminacionMantenimientoSuperAdmin({
              actor: req.user,
              ruta_api: auditData.ruta_api,
              tabla_afectada: auditData.tabla_afectada,
              registro_id: auditData.registro_id,
              ip_address: auditData.ip_address,
              user_agent: auditData.user_agent,
              fecha: new Date(),
              datos_registro: deletedData
            });
          }
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
