const nodemailer = require('nodemailer');
const { db } = require('../config/database');

const isEmailConfigured = () => {
  return (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

const createTransporter = () => {
  if (!isEmailConfigured()) {
    console.warn('⚠️ Configuración SMTP incompleta. No se enviarán correos.');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const transporter = createTransporter();

const sendEmail = async ({ to, subject, text, html }) => {
  if (!transporter) {
    return {
      accepted: [],
      skipped: true,
      message: 'Transporte de correo no configurado'
    };
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  return transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html
  });
};

const sendPasswordResetEmail = async ({ email, code }) => {
  const subject = 'Código de recuperación de contraseña';
  const text = `Tu código de verificación es: ${code}. Este código expira en 15 minutos.`;
  const html = `
    <p>Hola,</p>
    <p>Has solicitado recuperar tu contraseña. Usa el siguiente código para continuar:</p>
    <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
    <p>Este código expira en <strong>15 minutos</strong>.</p>
    <p>Si no solicitaste este cambio, ignora este correo.</p>
  `;

  return sendEmail({ to: email, subject, text, html });
};

const sendPasswordChangedEmail = async ({ email }) => {
  const subject = 'Tu contraseña ha sido actualizada';
  const text =
    'Se ha cambiado la contraseña de tu cuenta. Si no reconoces este cambio, contacta al administrador de inmediato.';
  const html = `
    <p>Hola,</p>
    <p>Te notificamos que tu contraseña ha sido <strong>actualizada</strong>.</p>
    <p>Si no reconoces este cambio, contacta al administrador de inmediato.</p>
  `;

  return sendEmail({ to: email, subject, text, html });
};

const ROLES_NOTIFICACION_SOLICITUD = [
  'super_admin',
  'direccion',
  'director',
  'gerente_ops',
  'finanzas',
  'coordinador'
];

const normalizeEmailList = (values = []) => {
  const input = Array.isArray(values) ? values : String(values || '').split(',');
  return [...new Set(
    input
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean)
  )];
};

const getSolicitudesAdminUrl = () => 'https://automanagersistema.com/admin/solicitudes';

const sendSolicitudCreadaNotification = async ({ solicitud = {}, to } = {}) => {
  try {
    let destinatarios = normalizeEmailList(to);

    if (destinatarios.length === 0) {
      const usuarios = await db('usuarios')
        .whereIn('rol', ROLES_NOTIFICACION_SOLICITUD)
        .where('estado_cuenta', 'Activo')
        .whereNotNull('email')
        .select('email');

      destinatarios = normalizeEmailList(usuarios.map((item) => item.email));
    }

    if (destinatarios.length === 0) {
      return {
        accepted: [],
        skipped: true,
        message: 'No hay destinatarios activos para notificacion de solicitudes'
      };
    }

    const adminSolicitudesUrl = getSolicitudesAdminUrl();
    const fechaTexto = solicitud?.fecha_solicitud
      ? new Date(solicitud.fecha_solicitud).toLocaleString('es-MX')
      : new Date().toLocaleString('es-MX');

    const subject = `Nueva solicitud de conductor #${solicitud?.id || 'N/A'}`;
    const text = [
      'Se recibio una nueva solicitud de conductor.',
      `Folio: ${solicitud?.id || 'N/A'}`,
      `Nombre: ${solicitud?.nombre_completo || 'N/A'}`,
      `Telefono: ${solicitud?.telefono || 'N/A'}`,
      `Email: ${solicitud?.email || 'No proporcionado'}`,
      `CURP: ${solicitud?.curp || 'No proporcionado'}`,
      `Fecha: ${fechaTexto}`,
      '',
      `Revisar en: ${adminSolicitudesUrl}`
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: #1f2937; color: #fff; padding: 16px 20px;">
          <h2 style="margin: 0; font-size: 18px;">Nueva solicitud de conductor</h2>
        </div>
        <div style="padding: 20px; color: #111827;">
          <p>Se recibio una nueva solicitud en el portal.</p>
          <ul style="padding-left: 18px;">
            <li><strong>Folio:</strong> ${solicitud?.id || 'N/A'}</li>
            <li><strong>Nombre:</strong> ${solicitud?.nombre_completo || 'N/A'}</li>
            <li><strong>Telefono:</strong> ${solicitud?.telefono || 'N/A'}</li>
            <li><strong>Email:</strong> ${solicitud?.email || 'No proporcionado'}</li>
            <li><strong>CURP:</strong> ${solicitud?.curp || 'No proporcionado'}</li>
            <li><strong>Fecha:</strong> ${fechaTexto}</li>
          </ul>
          <a href="${adminSolicitudesUrl}" style="display: inline-block; margin-top: 12px; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">
            Abrir modulo de solicitudes
          </a>
        </div>
      </div>
    `;

    return sendEmail({
      to: destinatarios.join(', '),
      subject,
      text,
      html
    });
  } catch (error) {
    console.error('Error enviando notificacion de nueva solicitud:', error);
    return {
      accepted: [],
      skipped: true,
      message: 'Error enviando notificacion de nueva solicitud',
      error: String(error?.message || error)
    };
  }
};

// 1. Roles específicos para inversiones (puedes ajustar esta lista si es diferente)
const ROLES_NOTIFICACION_INVERSIONISTA = [
  'super_admin',
  'direccion',
  'director',
  'finanzas',
  'gerente_ops'
];

// 2. Apuntamos a la nueva clase que creamos hoy
const getSolicitudesInversionistasAdminUrl = () => 'https://automanagersistema.com/admin/solicitudes-registro';

// 3. La función de envío
const sendNuevaSolicitudInversionistaNotification = async ({ solicitud = {}, to } = {}) => {
  try {
    let destinatarios = normalizeEmailList(to);

    if (destinatarios.length === 0) {
      const usuarios = await db('usuarios')
        .whereIn('rol', ROLES_NOTIFICACION_INVERSIONISTA)
        .where('estado_cuenta', 'Activo')
        .whereNotNull('email')
        .select('email');

      destinatarios = normalizeEmailList(usuarios.map((item) => item.email));
    }

    if (destinatarios.length === 0) {
      return {
        accepted: [],
        skipped: true,
        message: 'No hay destinatarios activos para notificación de nuevos prospectos a inversionista'
      };
    }

    const adminUrl = getSolicitudesInversionistasAdminUrl();
    // Usamos created_at porque así se llama en tu tabla de inversionistas
    const fechaTexto = solicitud?.created_at
      ? new Date(solicitud.created_at).toLocaleString('es-MX')
      : new Date().toLocaleString('es-MX');

    const subject = `🚀 Nuevo Prospecto de Inversionista #${solicitud?.id || 'N/A'}`;
    const text = [
      'Se ha registrado un nuevo prospecto a inversionista en el portal.',
      `Folio: ${solicitud?.id || 'N/A'}`,
      `Nombre: ${solicitud?.nombre || 'N/A'}`,
      `Tipo: ${solicitud?.tipo_inversionista || 'N/A'}`,
      `Teléfono: ${solicitud?.telefono || 'N/A'}`,
      `Email: ${solicitud?.email || 'No proporcionado'}`,
      `Fecha: ${fechaTexto}`,
      '',
      `Revisar y aprobar expediente en: ${adminUrl}`
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background: #0891b2; color: #fff; padding: 16px 20px;">
          <h2 style="margin: 0; font-size: 18px;">Nuevo Prospecto de Inversionista 🚀</h2>
        </div>
        <div style="padding: 20px; color: #111827;">
          <p>Se ha registrado un nuevo prospecto en el portal de inversionistas. Por favor, revisa sus documentos para proceder con la aprobación.</p>
          <ul style="padding-left: 18px;">
            <li><strong>Folio:</strong> ${solicitud?.id || 'N/A'}</li>
            <li><strong>Nombre:</strong> ${solicitud?.nombre || 'N/A'}</li>
            <li><strong>Tipo de Persona:</strong> ${solicitud?.tipo_inversionista || 'N/A'}</li>
            <li><strong>Teléfono:</strong> ${solicitud?.telefono || 'N/A'}</li>
            <li><strong>Email:</strong> ${solicitud?.email || 'No proporcionado'}</li>
            <li><strong>Fecha de Registro:</strong> ${fechaTexto}</li>
          </ul>
          <a href="${adminUrl}" style="display: inline-block; margin-top: 12px; background: #06b6d4; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 6px; font-weight: bold;">
            Revisar Expediente
          </a>
        </div>
      </div>
    `;

    // Asume que sendEmail ya está importado o definido en este archivo (igual que en tu otra función)
    return sendEmail({
      to: destinatarios.join(', '),
      subject,
      text,
      html
    });
  } catch (error) {
    console.error('Error enviando notificación de nuevo prospecto inversionista:', error);
    return {
      accepted: [],
      skipped: true,
      message: 'Error enviando notificación de nuevo prospecto inversionista',
      error: String(error?.message || error)
    };
  }
};

/**
 * Notificación de auditoría:
 * - Si viene "to" se envía a ese/ esos correos.
 * - Si no viene "to", se envía a super_admin y direccion activos.
 */
const sendAuditNotification = async ({
  to,
  actorNombre,
  usuarioAfectado = {},
  accion = '',
  detallesCambio = '',
  subject,
  subtitle = 'Actividad del Gerente de Operaciones'
} = {}) => {
  try {
    // 1) Resolver destinatarios
    let destinatarios = to;

    if (!destinatarios) {
      const jefes = await db('usuarios')
        .whereIn('rol', ['super_admin', 'direccion', 'finanzas'])
        .where('estado_cuenta', 'Activo')
        .select('email');

      if (!jefes.length) {
        console.warn(
          '⚠️ [EMAIL SERVICE] No se enviará correo: No hay destinatarios (Jefes activos).'
        );
        return {
          accepted: [],
          skipped: true,
          message: 'No hay destinatarios (jefes activos)'
        };
      }

      destinatarios = jefes
        .map(j => j.email)
        .filter(Boolean)
        .join(', ');

      if (!destinatarios) {
        console.warn(
          '⚠️ [EMAIL SERVICE] No se enviará correo: Los destinatarios obtenidos no tienen email.'
        );
        return {
          accepted: [],
          skipped: true,
          message: 'Destinatarios sin email válido'
        };
      }
    }

    // 2) Normalizar datos
    const nombreActor = actorNombre || 'Gerente Ops';
    const esVehiculoAfectado =
      usuarioAfectado?.tipo === 'vehiculo' ||
      Boolean(usuarioAfectado?.numero_vehiculo);

    const nombreUsuarioAfectado =
      usuarioAfectado.name ||
      usuarioAfectado.nombre ||
      usuarioAfectado.nombre_completo ||
      'N/A';
    const emailUsuarioAfectado = usuarioAfectado.email || 'N/A';

    const tituloAfectado =
      usuarioAfectado?.titulo ||
      (esVehiculoAfectado ? 'Vehiculo afectado' : 'Usuario Afectado');
    const etiquetaPrincipal =
      usuarioAfectado?.etiqueta_principal ||
      (esVehiculoAfectado ? 'Numero de vehiculo' : 'Nombre Completo');
    const valorPrincipal =
      usuarioAfectado?.valor_principal ||
      (esVehiculoAfectado
        ? (usuarioAfectado.numero_vehiculo || 'N/A')
        : nombreUsuarioAfectado);
    const etiquetaSecundaria =
      usuarioAfectado?.etiqueta_secundaria ||
      (esVehiculoAfectado ? 'Placa' : 'Email');
    const valorSecundaria =
      usuarioAfectado?.valor_secundaria ||
      (esVehiculoAfectado
        ? (usuarioAfectado.placa || 'N/A')
        : emailUsuarioAfectado);

    const finalSubject =
      subject || `📢 Auditoría: Cambio realizado por ${nombreActor} - ${accion}`;

    // 3) Normalizar detalle para mostrarlo como lista legible
    const rawDetalle = typeof detallesCambio === 'string' ? detallesCambio.trim() : '';
    const detalleEsHtmlLista = /<li[\s>]/i.test(rawDetalle);
    let detalleItems = [];

    if (rawDetalle) {
      if (detalleEsHtmlLista) {
        detalleItems = Array.from(
          rawDetalle.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi),
          match => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        ).filter(Boolean);
      } else if (rawDetalle.includes('|')) {
        detalleItems = rawDetalle
          .split('|')
          .map(item => item.trim())
          .filter(Boolean);
      } else if (rawDetalle.includes('\n')) {
        detalleItems = rawDetalle
          .split('\n')
          .map(item => item.trim())
          .filter(Boolean);
      } else {
        detalleItems = [rawDetalle];
      }
    }

    const parseDetalleItem = (item) => {
      const texto = (item || '').toString().trim();
      const colonIndex = texto.indexOf(':');

      if (colonIndex <= 0) {
        return {
          text: texto || 'Sin detalle',
          html: texto || 'Sin detalle'
        };
      }

      const label = texto.slice(0, colonIndex).trim();
      const value = texto.slice(colonIndex + 1).trim();

      if (!value) {
        return {
          text: label,
          html: `<strong>${label}:</strong> N/A`
        };
      }

      return {
        text: `${label}: ${value}`,
        html: `<strong>${label}:</strong> ${value}`
      };
    };

    const detalleHtml = detalleItems.length
      ? `<ul style="margin: 0; padding-left: 20px;">${detalleItems
          .map(item => `<li style="margin-bottom: 8px;">${parseDetalleItem(item).html}</li>`)
          .join('')}</ul>`
      : 'Sin detalles adicionales';

    // 4) Texto plano
    const text = [
      'Notificación de Auditoría',
      subtitle,
      `Actor: ${nombreActor}`,
      `${tituloAfectado}: ${valorPrincipal}`,
      `${etiquetaSecundaria}: ${valorSecundaria}`,
      `Acción: ${accion}`,
      'Detalle del cambio:',
      ...(detalleItems.length ? detalleItems.map(item => `- ${parseDetalleItem(item).text}`) : ['- Sin detalles adicionales'])
    ].join('\n');

    // 5) HTML
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #d32f2f; padding: 20px; text-align: center; color: white;">
          <h2 style="margin: 0;">Notificación de Auditoría</h2>
          <p style="margin: 5px 0 0; font-size: 14px;">${subtitle}</p>
        </div>
        
        <div style="padding: 20px; background-color: #ffffff; color: #333;">
          <p>Se ha detectado una modificación realizada por: <strong>${nombreActor}</strong></p>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

          <h3 style="color: #555; font-size: 16px;">👤 ${tituloAfectado}</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 8px;"><strong>${etiquetaPrincipal}:</strong> ${valorPrincipal}</li>
            <li style="margin-bottom: 8px;"><strong>${etiquetaSecundaria}:</strong> ${valorSecundaria}</li>
          </ul>

          <h3 style="color: #555; font-size: 16px;">⚙️ Acción</h3>
          <p style="background-color: #f5f5f5; padding: 10px; border-left: 4px solid #d32f2f; border-radius: 4px;">
            ${accion}
          </p>

          <h3 style="color: #555; font-size: 16px;">📝 Detalle del Cambio</h3>
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 4px; color: #856404; font-size: 14px;">
            ${detalleHtml}
          </div>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999;">
          Sistema AutoManager - Notificación Automática de Seguridad
        </div>
      </div>
    `;

    // 6) Enviar
    const info = await sendEmail({
      to: destinatarios,
      subject: finalSubject,
      text,
      html
    });

    // Si sendEmail devolvió "skipped" porque no hay SMTP, lo informamos igual
    if (info && info.skipped) {
      console.warn('⚠️ [EMAIL SERVICE] Envío omitido:', info.message);
      return info;
    }

    if (info && info.messageId) {
      console.log('✅ [EMAIL SERVICE] Correo enviado. ID:', info.messageId);
    }

    return info;
  } catch (error) {
    console.error('❌ [EMAIL SERVICE] Error enviando notificación de auditoría:', error);
    return {
      accepted: [],
      skipped: true,
      message: 'Error enviando notificación de auditoría',
      error: String(error?.message || error)
    };
  }
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendSolicitudCreadaNotification,
  sendAuditNotification,
  isEmailConfigured,
  sendNuevaSolicitudInversionistaNotification
};
