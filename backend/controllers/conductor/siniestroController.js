// backend/controllers/conductor/siniestroController.js
const { db } = require('../../config/database');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { resolveConductorId } = require('./conductorContextHelper');

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
// OBTENER MIS SINIESTROS
// =====================================================
const getMisSiniestros = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const limit = parseInt(req.query.limit) || 50;

    const siniestros = await db('siniestros')
      .where({ conductor_id: conductorId })
      .orderBy('fecha_incidente', 'desc')
      .limit(limit)
      .select('*');

    // Parsear JSON de fotos y videos
    const siniestrosConArchivos = siniestros.map(sin => ({
      ...sin,
      fotos_urls: sin.fotos_urls ? JSON.parse(sin.fotos_urls) : [],
      videos_urls: sin.videos_urls ? JSON.parse(sin.videos_urls) : []
    }));

    res.json({
      success: true,
      total: siniestros.length,
      siniestros: siniestrosConArchivos
    });

  } catch (error) {
    console.error('Error en getMisSiniestros:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener siniestros',
      error: error.message
    });
  }
};

// =====================================================
// OBTENER SINIESTRO POR ID
// =====================================================
const getSiniestroById = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const { id } = req.params;

    const siniestro = await db('siniestros')
      .where({ id, conductor_id: conductorId })
      .first();

    if (!siniestro) {
      return res.status(404).json({
        success: false,
        message: 'Siniestro no encontrado'
      });
    }

    // Parsear JSON
    const siniestroCompleto = {
      ...siniestro,
      fotos_urls: siniestro.fotos_urls ? JSON.parse(siniestro.fotos_urls) : [],
      videos_urls: siniestro.videos_urls ? JSON.parse(siniestro.videos_urls) : []
    };

    res.json({
      success: true,
      siniestro: siniestroCompleto
    });

  } catch (error) {
    console.error('Error en getSiniestroById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener siniestro',
      error: error.message
    });
  }
};

// =====================================================
// REGISTRAR SINIESTRO
// =====================================================
const registrarSiniestro = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const {
      tipo_siniestro,
      descripcion,
      ubicacion,
      fecha_incidente,
      gravedad
    } = req.body;

    // Validación
    if (!tipo_siniestro || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de siniestro y descripción son obligatorios'
      });
    }

    // Validar que tenga al menos fotos o videos
    if (!req.files || (!req.files.fotos && !req.files.videos)) {
      return res.status(400).json({
        success: false,
        message: 'Debes subir al menos una foto o video del siniestro'
      });
    }

    // Obtener vehículo asignado
    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({
        success: false,
        message: 'No tienes vehículo asignado'
      });
    }

    // Generar folio único
    const ultimoFolio = await db('siniestros')
      .max('folio_siniestro as ultimo')
      .first();
    
    let nuevoFolio = 'SIN-0001';
    if (ultimoFolio && ultimoFolio.ultimo) {
      const numero = parseInt(ultimoFolio.ultimo.split('-')[1]) + 1;
      nuevoFolio = `SIN-${String(numero).padStart(4, '0')}`;
    }

    // 1. SUBIR FOTOS A CLOUDINARY
    let fotosUrls = [];
    if (req.files.fotos && req.files.fotos.length > 0) {
      console.log(`Subiendo ${req.files.fotos.length} fotos a Cloudinary...`);
      const uploadPromises = req.files.fotos.map(foto =>
        uploadToCloudinary(foto.buffer, {
          resource_type: 'image',
          folder: 'siniestros',
          transformation: [
            { width: 1500, crop: 'limit', quality: 'auto' }
          ]
        })
      );
      const fotosResults = await Promise.all(uploadPromises);
      fotosUrls = fotosResults.map(r => r.secure_url);
    }

    // 2. SUBIR VIDEOS A CLOUDINARY
    let videosUrls = [];
    if (req.files.videos && req.files.videos.length > 0) {
      console.log(`Subiendo ${req.files.videos.length} videos a Cloudinary...`);
      const uploadPromises = req.files.videos.map(video =>
        uploadToCloudinary(video.buffer, {
          resource_type: 'video',
          folder: 'siniestros/videos',
          chunk_size: 6000000
        })
      );
      const videosResults = await Promise.all(uploadPromises);
      videosUrls = videosResults.map(r => r.secure_url);
    }

    // 3. GUARDAR EN BASE DE DATOS
    const [nuevoSiniestro] = await db('siniestros')
      .insert({
        folio_siniestro: nuevoFolio,
        conductor_id: conductorId,
        vehiculo_id: asignacion.vehiculo_id,
        tipo_siniestro,
        descripcion,
        ubicacion: ubicacion || null,
        fecha_incidente: fecha_incidente || db.fn.now(),
        gravedad: gravedad || 'Media',
        fotos_urls: JSON.stringify(fotosUrls),
        videos_urls: JSON.stringify(videosUrls),
        estado: 'Reportado',
        created_at: db.fn.now()
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Siniestro reportado correctamente',
      siniestro: {
        id: nuevoSiniestro.id,
        folio_siniestro: nuevoSiniestro.folio_siniestro,
        tipo_siniestro: nuevoSiniestro.tipo_siniestro,
        fecha_incidente: nuevoSiniestro.fecha_incidente,
        estado: nuevoSiniestro.estado,
        fotos_count: fotosUrls.length,
        videos_count: videosUrls.length
      }
    });

  } catch (error) {
    console.error('Error en registrarSiniestro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar siniestro',
      error: error.message
    });
  }
};

module.exports = {
  getMisSiniestros,
  getSiniestroById,
  registrarSiniestro
};
