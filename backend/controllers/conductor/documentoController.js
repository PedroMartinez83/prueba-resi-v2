// backend/controllers/conductor/documentoController.js
const path = require('path');
const { db } = require('../../config/database');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const CONTROLLER_VERSION = 'documento-controller-v4';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const CAMPOS_DOCUMENTO = {
  ine_frente: 'url_ine_frente',
  ine_reverso: 'url_ine_reverso',
  licencia_frente: 'url_licencia_frente',
  licencia_reverso: 'url_licencia_reverso',
  comprobante_domicilio: 'url_comprobante_domicilio'
};

const DOCUMENTOS_SELECT = [
  'url_ine_frente',
  'url_ine_reverso',
  'url_licencia_frente',
  'url_licencia_reverso',
  'url_comprobante_domicilio',
  'fecha_vencimiento_licencia'
];

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/png',
  'image/webp'
]);

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif'
]);

const parsePositiveInt = (value) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeEmail = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const setVersionHeader = (res) => {
  res.setHeader('x-documento-controller-version', CONTROLLER_VERSION);
};

const jsonWithVersion = (res, statusCode, payload) => {
  setVersionHeader(res);
  return res.status(statusCode).json({
    ...payload,
    controllerVersion: CONTROLLER_VERSION
  });
};

const uploadToCloudinary = (fileBuffer, options) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    });

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });

const findUsuarioIdFromToken = async (user = {}) => {
  const userId = parsePositiveInt(user.id);
  if (userId) return userId;

  const emailCandidates = [normalizeEmail(user.email), normalizeEmail(user.name)].filter(Boolean);
  if (emailCandidates.length === 0) return null;

  const usuario = await db('usuarios')
    .where((qb) => {
      qb.whereIn('email', emailCandidates).orWhereIn('name', emailCandidates);
    })
    .select('id')
    .first();

  return parsePositiveInt(usuario?.id);
};

const findConductorByUsuarioId = async (usuarioId) => {
  const validUsuarioId = parsePositiveInt(usuarioId);
  if (!validUsuarioId) return null;

  const conductor = await db('conductores')
    .where({ usuario_id: validUsuarioId })
    .select('id', 'usuario_id', 'email')
    .orderBy('id', 'desc')
    .first();

  const conductorId = parsePositiveInt(conductor?.id);
  if (!conductorId) return null;

  return {
    id: conductorId,
    usuarioId: parsePositiveInt(conductor?.usuario_id),
    source: 'usuario_id'
  };
};

const findConductorByConductorId = async (conductorIdFromToken) => {
  const conductorId = parsePositiveInt(conductorIdFromToken);
  if (!conductorId) return null;

  const conductor = await db('conductores')
    .where({ id: conductorId })
    .select('id', 'usuario_id', 'email')
    .first();

  const validConductorId = parsePositiveInt(conductor?.id);
  if (!validConductorId) return null;

  return {
    id: validConductorId,
    usuarioId: parsePositiveInt(conductor?.usuario_id),
    source: 'conductor_id_token'
  };
};

const findConductorByEmailCandidates = async (user = {}) => {
  const emailCandidates = [normalizeEmail(user.email), normalizeEmail(user.name)].filter(Boolean);
  if (emailCandidates.length === 0) return null;

  const conductor = await db('conductores as c')
    .leftJoin('usuarios as u', 'u.id', 'c.usuario_id')
    .where((qb) => {
      qb.whereIn('u.email', emailCandidates)
        .orWhereIn('u.name', emailCandidates)
        .orWhereIn('c.email', emailCandidates);
    })
    .select('c.id', 'c.usuario_id')
    .orderBy('c.id', 'desc')
    .first();

  const conductorId = parsePositiveInt(conductor?.id);
  if (!conductorId) return null;

  return {
    id: conductorId,
    usuarioId: parsePositiveInt(conductor?.usuario_id),
    source: 'email_fallback'
  };
};

const resolveConductorContext = async (user = {}) => {
  const usuarioId = await findUsuarioIdFromToken(user);

  if (usuarioId) {
    const byUsuario = await findConductorByUsuarioId(usuarioId);
    if (byUsuario) {
      return { ...byUsuario, usuarioId };
    }
  }

  const byTokenConductorId = await findConductorByConductorId(user.conductorId);
  if (byTokenConductorId) {
    return {
      ...byTokenConductorId,
      usuarioId: byTokenConductorId.usuarioId || usuarioId || null
    };
  }

  const byEmail = await findConductorByEmailCandidates(user);
  if (byEmail) {
    return {
      ...byEmail,
      usuarioId: byEmail.usuarioId || usuarioId || null
    };
  }

  return null;
};

const getUploadOptions = (file, conductorId) => {
  const mime = String(file?.mimetype || '').toLowerCase();
  const isImage = mime.startsWith('image/');

  const options = {
    resource_type: 'auto',
    folder: `documentos_conductores/${conductorId}`
  };

  if (isImage) {
    options.transformation = [{ width: 1500, crop: 'limit', quality: 'auto' }];
  }

  return options;
};

const requireConductorContext = async (req, res) => {
  const conductor = await resolveConductorContext(req.user);

  if (!conductor?.id) {
    jsonWithVersion(res, 400, {
      success: false,
      message: 'No se pudo identificar al conductor autenticado'
    });
    return null;
  }

  console.log(`[${CONTROLLER_VERSION}] conductor resuelto`, {
    tokenUserId: req.user?.id,
    tokenConductorId: req.user?.conductorId,
    resolvedConductorId: conductor.id,
    resolvedUsuarioId: conductor.usuarioId,
    source: conductor.source
  });

  return conductor;
};

const getMisDocumentos = async (req, res) => {
  try {
    const conductor = await requireConductorContext(req, res);
    if (!conductor) return;

    const documentos = await db('conductores')
      .where({ id: conductor.id })
      .select(...DOCUMENTOS_SELECT)
      .first();

    if (!documentos) {
      return jsonWithVersion(res, 404, {
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    return jsonWithVersion(res, 200, {
      success: true,
      documentos
    });
  } catch (error) {
    console.error(`[${CONTROLLER_VERSION}] Error en getMisDocumentos:`, error);
    return jsonWithVersion(res, 500, {
      success: false,
      message: 'Error al obtener documentos',
      error: error.message
    });
  }
};

const subirDocumento = async (req, res) => {
  try {
    const conductor = await requireConductorContext(req, res);
    if (!conductor) return;

    const tipoDocumento = String(req.body?.tipo_documento || '').trim();
    const campoBD = CAMPOS_DOCUMENTO[tipoDocumento];

    if (!req.file || !req.file.buffer) {
      return jsonWithVersion(res, 400, {
        success: false,
        message: 'Debes proporcionar un archivo'
      });
    }

    const mimeType = String(req.file.mimetype || '').toLowerCase();
    const fileExtension = path.extname(String(req.file.originalname || '')).toLowerCase();
    const mimeAllowed = ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType);
    const extensionAllowed = ALLOWED_DOCUMENT_EXTENSIONS.has(fileExtension);

    if (!mimeAllowed && !extensionAllowed) {
      return jsonWithVersion(res, 400, {
        success: false,
        message: 'Tipo de archivo no permitido',
        tiposPermitidos: {
          mimeTypes: Array.from(ALLOWED_DOCUMENT_MIME_TYPES),
          extensiones: Array.from(ALLOWED_DOCUMENT_EXTENSIONS)
        }
      });
    }

    if (!campoBD) {
      return jsonWithVersion(res, 400, {
        success: false,
        message: 'Tipo de documento inválido',
        tiposPermitidos: Object.keys(CAMPOS_DOCUMENTO)
      });
    }

    const conductorExiste = await db('conductores')
      .where({ id: conductor.id })
      .select('id')
      .first();

    if (!conductorExiste) {
      return jsonWithVersion(res, 404, {
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    console.log(`[${CONTROLLER_VERSION}] Subiendo documento`, {
      tipoDocumento,
      conductorId: conductor.id,
      mimeType: req.file.mimetype || null,
      extension: fileExtension || null,
      size: req.file.size || null
    });

    const uploaded = await uploadToCloudinary(req.file.buffer, getUploadOptions(req.file, conductor.id));

    const filasActualizadas = await db('conductores')
      .where({ id: conductor.id })
      .update({
        [campoBD]: uploaded.secure_url,
        updated_at: db.fn.now()
      });

    if (!filasActualizadas) {
      return jsonWithVersion(res, 404, {
        success: false,
        message: 'Conductor no encontrado para actualizar documento'
      });
    }

    return jsonWithVersion(res, 200, {
      success: true,
      message: 'Documento subido correctamente',
      documento: {
        tipo: tipoDocumento,
        url: uploaded.secure_url
      }
    });
  } catch (error) {
    console.error(`[${CONTROLLER_VERSION}] Error en subirDocumento:`, error);
    return jsonWithVersion(res, 500, {
      success: false,
      message: 'Error al subir documento',
      error: error.message
    });
  }
};

module.exports = {
  getMisDocumentos,
  subirDocumento
};
