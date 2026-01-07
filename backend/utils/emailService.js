const nodemailer = require('nodemailer');

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
  const text = 'Se ha cambiado la contraseña de tu cuenta. Si no reconoces este cambio, contacta al administrador de inmediato.';
  const html = `
    <p>Hola,</p>
    <p>Te notificamos que tu contraseña ha sido <strong>actualizada</strong>.</p>
    <p>Si no reconoces este cambio, contacta al administrador de inmediato.</p>
  `;

  return sendEmail({ to: email, subject, text, html });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  isEmailConfigured
};