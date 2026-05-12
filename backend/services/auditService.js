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

  normalizeVehiculoNumero({
    numeroVehiculo = null,
    tipoSocio = 'SD',
    numeroUnidad = null,
    registroId = null
  } = {}) {
    const numeroActual = (numeroVehiculo || '').toString().trim();
    const tipo = (tipoSocio || 'SD').toString().trim().toUpperCase() || 'SD';
    const unidad = Number.parseInt(numeroUnidad, 10);
    const idNumerico = Number.parseInt(registroId, 10);

    const unidadFinal = Number.isInteger(unidad) && unidad > 0
      ? unidad
      : (Number.isInteger(idNumerico) && idNumerico > 0 ? idNumerico : null);

    const matchEstandar = numeroActual.match(/^([A-Za-z]{2,})-(\d+)$/);
    if (matchEstandar) {
      return `${matchEstandar[1].toUpperCase()}-${String(parseInt(matchEstandar[2], 10)).padStart(4, '0')}`;
    }

    const matchSoloDigitos = numeroActual.match(/(\d+)/);
    if (matchSoloDigitos) {
      return `${tipo}-${String(parseInt(matchSoloDigitos[1], 10)).padStart(4, '0')}`;
    }

    if (unidadFinal) {
      return `${tipo}-${String(unidadFinal).padStart(4, '0')}`;
    }

    return numeroActual || (Number.isInteger(idNumerico) && idNumerico > 0 ? `ID ${idNumerico}` : 'N/A');
  }

  async resolveVehiculoAfectado({ datos_registro = null, registro_id = null } = {}) {
    const numeroVehiculoPayload =
      datos_registro?.numero_vehiculo ||
      datos_registro?.NumeroVehiculo ||
      datos_registro?.numeroVehiculo ||
      datos_registro?.vehiculo?.numero_vehiculo ||
      datos_registro?.vehiculo?.NumeroVehiculo ||
      datos_registro?.vehiculo?.numeroVehiculo ||
      null;
    const tipoSocioPayload =
      datos_registro?.tipo_socio ||
      datos_registro?.TipoSocio ||
      datos_registro?.tipoSocio ||
      datos_registro?.vehiculo?.tipo_socio ||
      datos_registro?.vehiculo?.TipoSocio ||
      datos_registro?.vehiculo?.tipoSocio ||
      null;
    const numeroUnidadPayload =
      datos_registro?.numero_unidad ||
      datos_registro?.NumeroUnidad ||
      datos_registro?.numeroUnidad ||
      datos_registro?.vehiculo?.numero_unidad ||
      datos_registro?.vehiculo?.NumeroUnidad ||
      datos_registro?.vehiculo?.numeroUnidad ||
      null;

    const placaPayload =
      datos_registro?.placa ||
      datos_registro?.Placa ||
      datos_registro?.vehiculo?.placa ||
      datos_registro?.vehiculo?.Placa ||
      null;

    let numeroVehiculo = numeroVehiculoPayload;
    let placa = placaPayload;
    let tipoSocio = tipoSocioPayload;
    let numeroUnidad = numeroUnidadPayload;
    const registroIdNumerico = Number.parseInt(registro_id, 10);

    if (
      (!numeroVehiculo || !placa || !tipoSocio || !numeroUnidad) &&
      Number.isInteger(registroIdNumerico) &&
      registroIdNumerico > 0
    ) {
      const vehiculoDb = await db('vehiculos')
        .where('id', registroIdNumerico)
        .select('numero_vehiculo', 'placa', 'tipo_socio', 'numero_unidad')
        .first();

      if (vehiculoDb) {
        if (!numeroVehiculo) numeroVehiculo = vehiculoDb.numero_vehiculo;
        if (!placa) placa = vehiculoDb.placa;
        if (!tipoSocio) tipoSocio = vehiculoDb.tipo_socio;
        if (!numeroUnidad) numeroUnidad = vehiculoDb.numero_unidad;
      }
    }

    const numeroVehiculoNormalizado = this.normalizeVehiculoNumero({
      numeroVehiculo,
      tipoSocio,
      numeroUnidad,
      registroId: registroIdNumerico
    });

    return {
      tipo: 'vehiculo',
      numero_vehiculo: numeroVehiculoNormalizado,
      placa: placa || 'N/A'
    };
  }

  async resolveConductorAfectado({ datos_registro = null, registro_id = null } = {}) {
    const nombrePayload =
      datos_registro?.nombre_conductor ||
      datos_registro?.NombreConductor ||
      datos_registro?.nombre_completo ||
      datos_registro?.name ||
      datos_registro?.nombre ||
      datos_registro?.conductor?.nombre_conductor ||
      datos_registro?.conductor?.NombreConductor ||
      datos_registro?.conductor?.nombre_completo ||
      datos_registro?.conductor?.name ||
      null;

    const emailPayload =
      datos_registro?.email ||
      datos_registro?.conductor_email ||
      datos_registro?.usuario_email ||
      datos_registro?.conductor?.email ||
      null;

    let nombreConductor = nombrePayload;
    let emailConductor = emailPayload;
    const registroIdNumerico = Number.parseInt(registro_id, 10);

    if (
      (!nombreConductor || !emailConductor) &&
      Number.isInteger(registroIdNumerico) &&
      registroIdNumerico > 0
    ) {
      const conductorDb = await db('conductores')
        .where('id', registroIdNumerico)
        .select('nombre_conductor', 'email')
        .first();

      if (conductorDb) {
        if (!nombreConductor) nombreConductor = conductorDb.nombre_conductor;
        if (!emailConductor) emailConductor = conductorDb.email;
      }
    }

    return {
      name:
        nombreConductor ||
        (Number.isInteger(registroIdNumerico) && registroIdNumerico > 0
          ? `ID ${registroIdNumerico}`
          : 'N/A'),
      email: emailConductor || 'N/A'
    };
  }

  async resolvePagoRentaAfectado({ datos_registro = null, registro_id = null } = {}) {
    const nombrePayload =
      datos_registro?.nombre_conductor ||
      datos_registro?.NombreConductor ||
      datos_registro?.nombre_completo ||
      datos_registro?.name ||
      datos_registro?.numero_vehiculo ||
      datos_registro?.NumeroVehiculo ||
      null;

    const emailPayload =
      datos_registro?.email ||
      datos_registro?.conductor_email ||
      datos_registro?.usuario_email ||
      null;

    let nombreAfectado = nombrePayload;
    let emailAfectado = emailPayload;
    const registroIdNumerico = Number.parseInt(registro_id, 10);

    if (
      (!nombreAfectado || !emailAfectado) &&
      Number.isInteger(registroIdNumerico) &&
      registroIdNumerico > 0
    ) {
      const pagoDb = await db('pagos_diarios as p')
        .leftJoin('asignaciones as a', 'p.asignacion_id', 'a.id')
        .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
        .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
        .where('p.id', registroIdNumerico)
        .select('c.nombre_conductor', 'c.email', 'v.numero_vehiculo')
        .first();

      if (pagoDb) {
        if (!nombreAfectado) {
          nombreAfectado = pagoDb.nombre_conductor || pagoDb.numero_vehiculo;
        }
        if (!emailAfectado) {
          emailAfectado = pagoDb.email;
        }
      }
    }

    return {
      name:
        nombreAfectado ||
        (Number.isInteger(registroIdNumerico) && registroIdNumerico > 0
          ? `Pago ID ${registroIdNumerico}`
          : 'N/A'),
      email: emailAfectado || 'N/A'
    };
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
      const userId = Number.isInteger(Number(user.id)) && Number(user.id) > 0
        ? String(Number(user.id))
        : '';
      const userEmail = typeof user.email === 'string' ? user.email : '';
      const userRol = typeof user.rol === 'string' ? user.rol : '';

      await connection.raw('SELECT set_config(?, ?, true)', ['app.current_user_id', userId]);
      await connection.raw('SELECT set_config(?, ?, true)', ['app.current_user_email', userEmail]);
      await connection.raw('SELECT set_config(?, ?, true)', ['app.current_user_rol', userRol]);
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

      const esPagoRenta = ['pagos', 'pagos_diarios', 'rentas'].includes(tabla_afectada);

      const usuarioAfectado = tabla_afectada === 'vehiculos'
        ? await this.resolveVehiculoAfectado({ datos_registro, registro_id })
        : tabla_afectada === 'conductores'
          ? await this.resolveConductorAfectado({ datos_registro, registro_id })
          : esPagoRenta
            ? await this.resolvePagoRentaAfectado({ datos_registro, registro_id })
          : {
              name: objetivoNombre,
              email:
                datos_registro?.email ||
                datos_registro?.usuario_email ||
                datos_registro?.conductor_email ||
                'N/A'
            };
      const registroDetalle = tabla_afectada === 'vehiculos'
        ? (usuarioAfectado?.numero_vehiculo || 'N/A')
        : tabla_afectada === 'conductores'
          ? (usuarioAfectado?.name || 'N/A')
          : (registro_id || objetivoNombre || 'N/A');

      const detallesCambio = [
        `Tabla: ${tabla_afectada || 'N/A'}`,
        `Registro: ${registroDetalle}`,
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

      const esPagoRenta = ['pagos', 'pagos_diarios', 'rentas'].includes(tabla_afectada);

      const usuarioAfectado = tabla_afectada === 'vehiculos'
        ? await this.resolveVehiculoAfectado({ datos_registro, registro_id })
        : tabla_afectada === 'conductores'
          ? await this.resolveConductorAfectado({ datos_registro, registro_id })
          : esPagoRenta
            ? await this.resolvePagoRentaAfectado({ datos_registro, registro_id })
          : {
              name: objetivoNombre,
              email:
                datos_registro?.email ||
                datos_registro?.usuario_email ||
                datos_registro?.conductor_email ||
                'N/A'
            };
      const registroDetalle = tabla_afectada === 'vehiculos'
        ? (usuarioAfectado?.numero_vehiculo || 'N/A')
        : tabla_afectada === 'conductores'
          ? (usuarioAfectado?.name || 'N/A')
          : (registro_id || objetivoNombre || 'N/A');

      const detallesCambio = [
        `Tabla: ${tabla_afectada || 'N/A'}`,
        `Registro: ${registroDetalle}`,
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
   * Notifica eliminaciones de solicitudes hechas por gerente o superior
   * hacia los roles jerarquicamente superiores.
   */
  async notificarEliminacionRolSuperior({
    actor = {},
    tabla_afectada = null,
    registro_id = null,
    fecha = new Date(),
    datos_registro = null
  }) {
    try {
      if (!isEmailConfigured()) return;

      const rolesDestino = ['super_admin', 'director', 'direccion', 'gerente_ops'];

      let destinatarios = await db('usuarios')
        .whereIn('rol', rolesDestino)
        .where('estado_cuenta', 'Activo')
        .whereNotNull('email')
        .pluck('email');

      destinatarios = [...new Set(
        (destinatarios || [])
          .map((email) => String(email || '').trim().toLowerCase())
          .filter(Boolean)
      )];

      if (destinatarios.length === 0) return;

      const subject = 'Notificacion de Auditoria';
      const actorNombre = actor.nombre || actor.nombre_completo || actor.name || actor.email || 'N/A';
      const subtitle = this.getAuditSubtitleByRole(actor?.rol);
      const objetivoNombre =
        datos_registro?.nombre_completo ||
        datos_registro?.nombre ||
        datos_registro?.email ||
        (registro_id ? `ID ${registro_id}` : 'N/A');
      const fechaTexto = new Date(fecha).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City'
      });

      const accionEspecifica = tabla_afectada === 'solicitudes'
        ? 'Eliminacion de solicitud'
        : 'Eliminacion de registro';

      const usuarioAfectado = {
        name: objetivoNombre,
        email: datos_registro?.email || 'N/A'
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
      console.error('Error enviando notificacion de eliminacion (gerente/superior):', error);
    }
  }

  /**
   * Notifica eliminaciones de mantenimientos al super admin
   */
  async notificarEliminacionMantenimientoSuperAdmin({
    actor = {},
    ruta_api = null,
    tabla_afectada = 'mantenimientos',
    registro_id = null,
    ip_address = null,
    user_agent = null,
    fecha = new Date(),
    datos_registro = null
  }) {
    try {
      if (!isEmailConfigured()) return;

      let destinatarios = await db('usuarios')
        .whereIn('rol', ['super_admin', 'director', 'gerente', 'finanzas'])
        .where('estado_cuenta', 'Activo')
        .whereNotNull('email')
        .pluck('email');

      destinatarios = [...new Set(
        (destinatarios || [])
          .map((email) => String(email || '').trim().toLowerCase())
          .filter(Boolean)
      )];

      if (destinatarios.length === 0) return;

      const subject = 'Notificacion de Auditoria';
      const actorNombre = actor.nombre || actor.nombre_completo || actor.name || actor.email || 'N/A';
      const subtitle = this.getAuditSubtitleByRole(actor?.rol);
      const fechaTexto = new Date(fecha).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City'
      });

      const folioServicio =
        datos_registro?.folio_servicio ||
        (registro_id ? `#${String(registro_id).padStart(4, '0')}` : 'N/A');

      const numeroVehiculo = datos_registro?.numero_vehiculo || 'N/A';
      const usuarioAfectado = {
        tipo: 'vehiculo',
        titulo: 'Vehiculo afectado',
        etiqueta_principal: 'Folio de servicio',
        valor_principal: folioServicio,
        etiqueta_secundaria: 'Numero de vehiculo',
        valor_secundaria: numeroVehiculo,
        numero_vehiculo: numeroVehiculo,
        placa: datos_registro?.placa || 'N/A'
      };

      const detallesCambio = [
        `Folio de servicio: ${folioServicio}`,
        `Vehiculo: ${numeroVehiculo}`,
        `Placa: ${datos_registro?.placa || 'N/A'}`,
        `Tipo de servicio: ${datos_registro?.tipo_servicio || 'N/A'}`,
        `Estado previo: ${datos_registro?.estado || 'N/A'}`,
        `Fecha programada: ${datos_registro?.fecha_programada || 'N/A'}`,
        `Fecha y hora: ${fechaTexto}`
      ].join(' | ');

      await sendAuditNotification({
        to: destinatarios,
        subject,
        subtitle,
        actorNombre,
        usuarioAfectado,
        accion: 'Eliminacion de mantenimiento',
        detallesCambio
      });
    } catch (error) {
      console.error('Error enviando notificacion de eliminacion de mantenimiento:', error);
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

