// backend/controllers/conductor/documentoController.js
const { db } = require('../../config/database');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Sube archivo a Cloudinary usando stream
 */
const uploadToCloudinary = (fileBuffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

// =====================================================
// OBTENER MIS DOCUMENTOS
// =====================================================
const getMisDocumentos = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;

    const conductor = await db('conductores')
      .where({ id: conductorId })
      .select(
        'url_ine_frente',
        'url_ine_reverso',
        'url_licencia_frente',
        'url_licencia_reverso',
        'url_comprobante_domicilio',
        'fecha_vencimiento_licencia'
      )
      .first();

    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    res.json({
      success: true,
      documentos: conductor
    });

  } catch (error) {
    console.error('Error en getMisDocumentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documentos',
      error: error.message
    });
  }
};

// =====================================================
// SUBIR O ACTUALIZAR DOCUMENTO
// =====================================================
const subirDocumento = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;
    const { tipo_documento } = req.body;

    // Validar que exista archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Debes proporcionar un archivo'
      });
    }

    // Validar tipo de documento
    const tiposPermitidos = [
      'ine_frente',
      'ine_reverso',
      'licencia_frente',
      'licencia_reverso',
      'comprobante_domicilio'
    ];

    if (!tiposPermitidos.includes(tipo_documento)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de documento inválido',
        tiposPermitidos
      });
    }

    // Subir archivo a Cloudinary
    console.log(`Subiendo documento: ${tipo_documento}`);
    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: 'image',
      folder: `documentos_conductores/${conductorId}`,
      transformation: [
        { width: 1500, crop: 'limit', quality: 'auto' }
      ]
    });

    // Mapear tipo de documento al campo de la base de datos
    const camposBD = {
      'ine_frente': 'url_ine_frente',
      'ine_reverso': 'url_ine_reverso',
      'licencia_frente': 'url_licencia_frente',
      'licencia_reverso': 'url_licencia_reverso',
      'comprobante_domicilio': 'url_comprobante_domicilio'
    };

    const campoBD = camposBD[tipo_documento];

    // Actualizar en la base de datos
    await db('conductores')
      .where({ id: conductorId })
      .update({
        [campoBD]: result.secure_url,
        updated_at: db.fn.now()
      });

    res.json({
      success: true,
      message: 'Documento subido correctamente',
      documento: {
        tipo: tipo_documento,
        url: result.secure_url
      }
    });

  } catch (error) {
    console.error('Error en subirDocumento:', error);
    res.status(500).json({
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