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
        .whereIn('rol', ['super_admin', 'direccion'])
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

    const tituloAfectado = esVehiculoAfectado ? 'Vehiculo afectado' : 'Usuario Afectado';
    const etiquetaPrincipal = esVehiculoAfectado ? 'Numero de vehiculo' : 'Nombre Completo';
    const valorPrincipal = esVehiculoAfectado
      ? (usuarioAfectado.numero_vehiculo || 'N/A')
      : nombreUsuarioAfectado;
    const etiquetaSecundaria = esVehiculoAfectado ? 'Placa' : 'Email';
    const valorSecundaria = esVehiculoAfectado
      ? (usuarioAfectado.placa || 'N/A')
      : emailUsuarioAfectado;

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

    const describeDetalleItem = (item) => {
      const texto = (item || '').toString().trim();
      const colonIndex = texto.indexOf(':');

      if (colonIndex <= 0) {
        return texto || 'Sin detalle';
      }

      const label = texto.slice(0, colonIndex).trim();
      const value = texto.slice(colonIndex + 1).trim();
      const labelNorm = label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      if (!value) return `Se detecto un cambio en ${label.toLowerCase()}.`;
      if (labelNorm === 'tabla') return `Se realizo la accion en el modulo de ${value}.`;
      if (labelNorm === 'registro') return `El registro afectado corresponde a ${value}.`;
      if (labelNorm === 'fecha y hora') return `La accion se realizo el ${value}.`;
      if (labelNorm === 'nombre') return `Se actualizo el nombre: ${value}.`;
      if (labelNorm === 'estado') return `Se actualizo el estado: ${value}.`;
      return `Se actualizo ${label.toLowerCase()}: ${value}.`;
    };

    const detalleHtml = detalleItems.length
      ? `<ul style="margin: 0; padding-left: 20px;">${detalleItems
          .map(item => `<li style="margin-bottom: 8px;">${describeDetalleItem(item)}</li>`)
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
      ...(detalleItems.length ? detalleItems.map(item => `- ${describeDetalleItem(item)}`) : ['- Sin detalles adicionales'])
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
  sendAuditNotification,
  isEmailConfigured
};
