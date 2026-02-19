// backend/services/auditService.js
const { db } = require('../config/database');
const { sendAuditNotification, isEmailConfigured } = require('../utils/emailService');
const os = require('os');

class AuditService {
  getAuditSubtitleByRole(role) {
    switch ((role || '').toString().toLowerCase()) {
      case 'finanzas':
        return 'Actividad de Finanzas';
      case 'coordinador':
        return 'Actividad del Coordinador de Zona';
      case 'gerente_ops':
        return 'Actividad del Gerente de Operaciones';
      case 'direccion':
      case 'direccion':
        return 'Actividad de Direccion';
      case 'super_admin':
        return 'Actividad de Super Admin';
      default:
        return 'Actividad Administrativa';
    }
  }
  /**
   * Registra una acciÃ³n en la tabla audit_logs
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
      console.error('Error al registrar auditorÃ­a:', error);
      // No lanzar error para no interrumpir la operaciÃ³n principal
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
   * Registra eventos de sesiÃ³n
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
      console.error('Error al registrar sesiÃ³n:', error);
      return null;
    }
  }

  /**
   * Registra cambios crÃ­ticos que requieren revisiÃ³n
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
      
      // Si requiere revisiÃ³n, notificar a admins
      if (requiere_revision) {
        await this.notificarCambiosCriticos(log);
      }
      
      return log;
    } catch (error) {
      console.error('Error al registrar cambio crÃ­tico:', error);
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
   * Notifica cambios criticos a administradores
   */
  async notificarCambiosCriticos(logId) {
    // Implementar notificaci??n por email/SMS/Slack
    console.log(`?????? Cambio critico registrado con ID: ${logId}`);
    // TODO: Implementar notificaciones reales
  }

  /**
   * Notifica por correo las eliminaciones realizadas por Finanzas
   */
  async notificarEliminacionFinanzas({
    actor = {},
    ruta_api = null,
    tabla_afectada = null,
    registro_id = null,
    ip_address = null,
    user_agent = null,
    fecha = new Date(),
    datos_registro = null
  }) {
    try {
      if (!isEmailConfigured()) return;

      const destinatarios = await db('usuarios')
        .whereIn('rol', ['super_admin', 'direccion'])
        .whereNotNull('email')
        .pluck('email');

      if (!destinatarios || destinatarios.length === 0) return;

      const subject = 'Notificacion de Auditoria';
      const actorNombre = actor.nombre || actor.nombre_completo || actor.name || actor.email || 'N/A';
      const subtitle = this.getAuditSubtitleByRole(actor?.rol);
      const objetivoNombre = datos_registro?.nombre_completo ||
        datos_registro?.nombre_conductor ||
        datos_registro?.nombre ||
        datos_registro?.numero_vehiculo ||
        datos_registro?.folio_renta ||
        datos_registro?.name ||
        datos_registro?.email ||
        (registro_id ? `ID ${registro_id}` : 'N/A');
      const fechaTexto = new Date(fecha).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City'
      });

      const accionEspecifica = (() => {
        switch (tabla_afectada) {
          case 'pagos':
          case 'pagos_diarios':
          case 'rentas':
            return 'Eliminacion de pago de renta';
          case 'conductores':
            return 'Eliminacion de conductor';
          case 'vehiculos':
            return 'Eliminacion de vehiculo';
          case 'usuarios':
            return 'Eliminacion de usuario';
          default:
            return 'Eliminacion de registro';
        }
      })();

      const usuarioAfectado = tabla_afectada === 'vehiculos'
        ? {
            tipo: 'vehiculo',
            numero_vehiculo:
              datos_registro?.numero_vehiculo ||
              datos_registro?.nombre ||
              (registro_id ? `ID ${registro_id}` : 'N/A'),
            placa: datos_registro?.placa || 'N/A'
          }
        : {
            name: objetivoNombre,
            email:
              datos_registro?.email ||
              datos_registro?.usuario_email ||
              datos_registro?.conductor_email ||
              'N/A'
          };

      const detallesCambio = [
        `Tabla: ${tabla_afectada || 'N/A'}`,
        `Registro: ${registro_id || 'N/A'}`,
        `Fecha y hora: ${fechaTexto}`
      ].join(' | ');

      await sendAuditNotification({
        to: destinatarios,
        subject,
        subtitle,
        actorNombre,
        usuarioAfectado,
        accion: accionEspecifica,
        detallesCambio
      });
    } catch (error) {
      console.error('Error enviando notificacion de eliminacion:', error);
    }
  }

  /**
   * Notifica por correo las eliminaciones realizadas por Coordinador de zona
   */
  async notificarEliminacionCoordinador({
    actor = {},
    ruta_api = null,
    tabla_afectada = null,
    registro_id = null,
    ip_address = null,
    user_agent = null,
    fecha = new Date(),
    datos_registro = null
  }) {
    try {
      if (!isEmailConfigured()) return;

      const destinatarios = await db('usuarios')
        .whereIn('rol', ['gerente_ops'])
        .whereNotNull('email')
        .pluck('email');

      if (!destinatarios || destinatarios.length === 0) return;

      const subject = 'Notificacion de Auditoria';
      const actorNombre = actor.nombre || actor.nombre_completo || actor.name || actor.email || 'N/A';
      const subtitle = this.getAuditSubtitleByRole(actor?.rol);
      const objetivoNombre = datos_registro?.nombre_completo ||
        datos_registro?.nombre_conductor ||
        datos_registro?.nombre ||
        datos_registro?.numero_vehiculo ||
        datos_registro?.folio_renta ||
        datos_registro?.name ||
        datos_registro?.email ||
        (registro_id ? `ID ${registro_id}` : 'N/A');
      const fechaTexto = new Date(fecha).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City'
      });

      const accionEspecifica = (() => {
        switch (tabla_afectada) {
          case 'conductores':
            return 'Eliminacion de conductor';
          case 'vehiculos':
            return 'Eliminacion de vehiculo';
          case 'solicitudes':
            return 'Eliminacion de solicitud';
          default:
            return 'Eliminacion de registro';
        }
      })();

      const usuarioAfectado = tabla_afectada === 'vehiculos'
        ? {
            tipo: 'vehiculo',
            numero_vehiculo:
              datos_registro?.numero_vehiculo ||
              datos_registro?.nombre ||
              (registro_id ? `ID ${registro_id}` : 'N/A'),
            placa: datos_registro?.placa || 'N/A'
          }
        : {
            name: objetivoNombre,
            email:
              datos_registro?.email ||
              datos_registro?.usuario_email ||
              datos_registro?.conductor_email ||
              'N/A'
          };

      const detallesCambio = [
        `Tabla: ${tabla_afectada || 'N/A'}`,
        `Registro: ${registro_id || 'N/A'}`,
        `Fecha y hora: ${fechaTexto}`
      ].join(' | ');

      await sendAuditNotification({
        to: destinatarios,
        subject,
        subtitle,
        actorNombre,
        usuarioAfectado,
        accion: accionEspecifica,
        detallesCambio
      });
    } catch (error) {
      console.error('Error enviando notificacion de eliminacion (coordinador):', error);
    }
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
    
    // DetecciÃ³n bÃ¡sica - puedes usar la librerÃ­a 'useragent' para algo mÃ¡s robusto
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

// Exportar instancia Ãºnica (Singleton)
module.exports = new AuditService();

