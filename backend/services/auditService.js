// backend/services/auditService.js
const { db } = require('../config/database');
const os = require('os');

class AuditService {
  /**
   * Registra una acción en la tabla audit_logs
   */
  async logAction({
    usuario_id = null,
    usuario_email = null,
    usuario_rol = null,
    accion = 'UNKNOWN',
    metodo_http = null,
    ruta_api = null,
    tabla_afectada = null,
    registro_id = null,
    datos_anteriores = null,
    datos_nuevos = null,
    cambios_realizados = null,
    ip_address = null,
    user_agent = null,
    resultado = 'success',
    codigo_respuesta = 200,
    mensaje_error = null,
    duracion_ms = null
  }) {
    try {
      const [log] = await db('audit_logs').insert({
        usuario_id,
        usuario_email,
        usuario_rol,
        accion,
        metodo_http,
        ruta_api,
        tabla_afectada,
        registro_id,
        datos_anteriores: datos_anteriores ? JSON.stringify(datos_anteriores) : null,
        datos_nuevos: datos_nuevos ? JSON.stringify(datos_nuevos) : null,
        cambios_realizados: cambios_realizados ? JSON.stringify(cambios_realizados) : null,
        ip_address,
        user_agent,
        resultado,
        codigo_respuesta,
        mensaje_error,
        duracion_ms,
        created_at: new Date()
      }).returning('id');
      
      return log;
    } catch (error) {
      console.error('Error al registrar auditoría:', error);
      // No lanzar error para no interrumpir la operación principal
      return null;
    }
  }

  /**
   * Registra un error en la tabla error_logs
   */
  async logError({
    usuario_id = null,
    nivel = 'error',
    mensaje,
    stack_trace = null,
    contexto = null,
    archivo = null,
    linea = null,
    columna = null,
    navegador = null,
    sistema_operativo = null,
    ip_address = null,
    url = null,
    metodo_http = null
  }) {
    try {
      const [log] = await db('error_logs').insert({
        usuario_id,
        nivel,
        mensaje,
        stack_trace,
        contexto: contexto ? JSON.stringify(contexto) : null,
        archivo,
        linea,
        columna,
        navegador,
        sistema_operativo,
        ip_address,
        url,
        metodo_http,
        created_at: new Date()
      }).returning('id');
      
      return log;
    } catch (error) {
      console.error('Error al registrar error:', error);
      return null;
    }
  }

  /**
   * Registra eventos de sesión
   */
  async logSession({
    usuario_id,
    usuario_email,
    evento, // login, logout, timeout, forced_logout
    ip_address,
    user_agent,
    dispositivo = null,
    navegador = null,
    sistema_operativo = null,
    ubicacion_aproximada = null,
    token_parcial = null,
    razon_cierre = null,
    duracion_sesion_minutos = null
  }) {
    try {
      const [log] = await db('session_logs').insert({
        usuario_id,
        usuario_email,
        evento,
        ip_address,
        user_agent,
        dispositivo,
        navegador,
        sistema_operativo,
        ubicacion_aproximada,
        token_parcial,
        razon_cierre,
        duracion_sesion_minutos,
        created_at: new Date()
      }).returning('id');
      
      return log;
    } catch (error) {
      console.error('Error al registrar sesión:', error);
      return null;
    }
  }

  /**
   * Registra cambios críticos que requieren revisión
   */
  async logCriticalChange({
    usuario_id,
    tipo_cambio,
    descripcion,
    datos_sensibles = null,
    autorizado_por = null,
    razon = null,
    ip_address = null,
    requiere_revision = false
  }) {
    try {
      const [log] = await db('critical_changes_log').insert({
        usuario_id,
        tipo_cambio,
        descripcion,
        datos_sensibles: datos_sensibles ? JSON.stringify(datos_sensibles) : null,
        autorizado_por,
        razon,
        ip_address,
        requiere_revision,
        created_at: new Date()
      }).returning('id');
      
      // Si requiere revisión, notificar a admins
      if (requiere_revision) {
        await this.notificarCambiosCriticos(log);
      }
      
      return log;
    } catch (error) {
      console.error('Error al registrar cambio crítico:', error);
      return null;
    }
  }

  /**
   * Establece el contexto del usuario para los triggers de PostgreSQL
   */
  async setUserContext(connection, user) {
    if (!user) return;
    
    try {
      await connection.raw(`SET LOCAL app.current_user_id = '${user.id}'`);
      await connection.raw(`SET LOCAL app.current_user_email = '${user.email}'`);
      await connection.raw(`SET LOCAL app.current_user_rol = '${user.rol}'`);
    } catch (error) {
      console.error('Error estableciendo contexto de usuario:', error);
    }
  }

  /**
   * Obtiene la actividad reciente de un usuario
   */
  async getUserActivity(usuario_id, limit = 50) {
    try {
      const activity = await db('audit_logs')
        .where('usuario_id', usuario_id)
        .orderBy('created_at', 'desc')
        .limit(limit);
      
      return activity;
    } catch (error) {
      console.error('Error obteniendo actividad del usuario:', error);
      return [];
    }
  }

  /**
   * Obtiene estadísticas de auditoría
   */
  async getAuditStats(dias = 30) {
    try {
      const fecha_limite = new Date();
      fecha_limite.setDate(fecha_limite.getDate() - dias);

      const stats = await db('audit_logs')
        .where('created_at', '>=', fecha_limite)
        .select(
          db.raw('COUNT(*) as total'),
          db.raw("COUNT(CASE WHEN accion = 'CREATE' THEN 1 END) as creaciones"),
          db.raw("COUNT(CASE WHEN accion = 'UPDATE' THEN 1 END) as actualizaciones"),
          db.raw("COUNT(CASE WHEN accion = 'DELETE' THEN 1 END) as eliminaciones"),
          db.raw("COUNT(CASE WHEN resultado = 'error' THEN 1 END) as errores"),
          db.raw("COUNT(CASE WHEN resultado = 'denied' THEN 1 END) as accesos_denegados")
        )
        .first();

      const porTabla = await db('audit_logs')
        .where('created_at', '>=', fecha_limite)
        .whereNotNull('tabla_afectada')
        .groupBy('tabla_afectada')
        .select('tabla_afectada', db.raw('COUNT(*) as total'))
        .orderBy('total', 'desc');

      const porUsuario = await db('audit_logs')
        .where('created_at', '>=', fecha_limite)
        .whereNotNull('usuario_email')
        .groupBy('usuario_email', 'usuario_rol')
        .select('usuario_email', 'usuario_rol', db.raw('COUNT(*) as total'))
        .orderBy('total', 'desc')
        .limit(10);

      return {
        resumen: stats,
        porTabla,
        porUsuario,
        periodo_dias: dias
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }

  /**
   * Busca intentos sospechosos
   */
  async detectarActividadSospechosa() {
    try {
      // Múltiples errores del mismo usuario
      const erroresRepetidos = await db('audit_logs')
        .where('created_at', '>=', db.raw("NOW() - INTERVAL '1 hour'"))
        .where('resultado', 'error')
        .groupBy('usuario_id', 'usuario_email')
        .having(db.raw('COUNT(*) > ?', [5]))
        .select('usuario_id', 'usuario_email', db.raw('COUNT(*) as intentos'));

      // Múltiples accesos denegados
      const accesosDenegados = await db('audit_logs')
        .where('created_at', '>=', db.raw("NOW() - INTERVAL '1 hour'"))
        .where('resultado', 'denied')
        .groupBy('ip_address')
        .having(db.raw('COUNT(*) > ?', [10]))
        .select('ip_address', db.raw('COUNT(*) as intentos'));

      // Eliminaciones masivas
      const eliminacionesMasivas = await db('audit_logs')
        .where('created_at', '>=', db.raw("NOW() - INTERVAL '1 hour'"))
        .where('accion', 'DELETE')
        .groupBy('usuario_id', 'usuario_email')
        .having(db.raw('COUNT(*) > ?', [10]))
        .select('usuario_id', 'usuario_email', db.raw('COUNT(*) as eliminaciones'));

      return {
        erroresRepetidos,
        accesosDenegados,
        eliminacionesMasivas
      };
    } catch (error) {
      console.error('Error detectando actividad sospechosa:', error);
      return null;
    }
  }

  /**
   * Limpia logs antiguos
   */
  async limpiarLogsAntiguos(diasRetener = 90) {
    try {
      const resultado = await db.raw('SELECT * FROM limpiar_logs_antiguos(?)', [diasRetener]);
      return resultado.rows[0];
    } catch (error) {
      console.error('Error limpiando logs:', error);
      return null;
    }
  }

  /**
   * Notifica cambios críticos a administradores
   */
  async notificarCambiosCriticos(logId) {
    // Implementar notificación por email/SMS/Slack
    console.log(`⚠️ Cambio crítico registrado con ID: ${logId}`);
    // TODO: Implementar notificaciones reales
  }

  /**
   * Obtiene la IP del request
   */
  getClientIp(req) {
    return req.ip || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           'unknown';
  }

  /**
   * Parse user agent para obtener info del navegador
   */
  parseUserAgent(userAgent) {
    if (!userAgent) return { navegador: null, sistema_operativo: null, dispositivo: null };
    
    // Detección básica - puedes usar la librería 'useragent' para algo más robusto
    let navegador = 'Desconocido';
    let sistema_operativo = 'Desconocido';
    let dispositivo = 'Desktop';

    // Navegador
    if (userAgent.includes('Chrome')) navegador = 'Chrome';
    else if (userAgent.includes('Safari')) navegador = 'Safari';
    else if (userAgent.includes('Firefox')) navegador = 'Firefox';
    else if (userAgent.includes('Edge')) navegador = 'Edge';

    // Sistema Operativo
    if (userAgent.includes('Windows')) sistema_operativo = 'Windows';
    else if (userAgent.includes('Mac')) sistema_operativo = 'MacOS';
    else if (userAgent.includes('Linux')) sistema_operativo = 'Linux';
    else if (userAgent.includes('Android')) sistema_operativo = 'Android';
    else if (userAgent.includes('iOS')) sistema_operativo = 'iOS';

    // Dispositivo
    if (userAgent.includes('Mobile')) dispositivo = 'Mobile';
    else if (userAgent.includes('Tablet')) dispositivo = 'Tablet';

    return { navegador, sistema_operativo, dispositivo };
  }
}

// Exportar instancia única (Singleton)
module.exports = new AuditService();
