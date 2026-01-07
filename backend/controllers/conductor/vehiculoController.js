// backend/controllers/conductor/vehiculoController.js
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
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {Object} options - Opciones de Cloudinary
 * @returns {Promise<Object>} Resultado de Cloudinary
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
// OBTENER MI VEHÍCULO ASIGNADO
// =====================================================
const getMiVehiculo = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;

    // Obtener asignación activa del conductor
    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({
        success: false,
        message: 'No tienes un vehículo asignado actualmente'
      });
    }

    // Obtener datos completos del vehículo
    const vehiculo = await db('vehiculos')
      .where({ id: asignacion.vehiculo_id })
      .first();

    if (!vehiculo) {
      return res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado'
      });
    }

    // Obtener último mantenimiento realizado
    const ultimoMantenimiento = await db('mantenimientos')
      .where({ vehiculo_id: vehiculo.id, estado: 'Completado' })
      .orderBy('fecha_realizada', 'desc')
      .first();

    // Obtener próximo mantenimiento programado
    const proximoMantenimiento = await db('mantenimientos')
      .where({ vehiculo_id: vehiculo.id, estado: 'Programado' })
      .orderBy('fecha_programada', 'asc')
      .first();

    // Verificar si subió revisión hoy
    const hoy = new Date().toISOString().split('T')[0];
    const revisionHoy = await db('revisiones_diarias')
      .where({ conductor_id: conductorId })
      .whereRaw('DATE(fecha_revision) = ?', [hoy])
      .first();

    res.json({
      success: true,
      vehiculo: {
        ...vehiculo,
        asignacion: {
          fecha_inicio: asignacion.fecha_inicio,
          fecha_fin: asignacion.fecha_fin,
          renta_diaria: asignacion.renta_diaria,
          abono_poliza: asignacion.abono_poliza_mantenimiento
        },
        ultimoMantenimiento,
        proximoMantenimiento,
        revisionHoyCompletada: !!revisionHoy
      }
    });

  } catch (error) {
    console.error('Error en getMiVehiculo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del vehículo',
      error: error.message
    });
  }
};

// =====================================================
// SUBIR REVISIÓN DIARIA (VIDEO + FOTOS)
// =====================================================
const subirRevisionDiaria = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;
    const { comentarios, kilometraje } = req.body;

    // Validar que existan archivos
    if (!req.files || !req.files.video) {
      return res.status(400).json({
        success: false,
        message: 'El video de revisión es obligatorio'
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

    // Verificar si ya subió revisión hoy
    const hoy = new Date().toISOString().split('T')[0];
    const revisionExistente = await db('revisiones_diarias')
      .where({ conductor_id: conductorId })
      .whereRaw('DATE(fecha_revision) = ?', [hoy])
      .first();

    if (revisionExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya subiste tu revisión diaria hoy'
      });
    }

    // 1. SUBIR VIDEO A CLOUDINARY
    console.log('Subiendo video a Cloudinary...');
    const videoFile = req.files.video[0];
    const videoResult = await uploadToCloudinary(videoFile.buffer, {
      resource_type: 'video',
      folder: 'revisiones_diarias',
      chunk_size: 6000000, // 6MB chunks
      eager: [
        { width: 640, height: 480, crop: 'limit', quality: 'auto' }
      ],
      eager_async: true
    });

    // 2. SUBIR FOTOS (si existen)
    let fotosUrls = [];
    if (req.files.fotos && req.files.fotos.length > 0) {
      console.log(`Subiendo ${req.files.fotos.length} fotos a Cloudinary...`);
      const uploadPromises = req.files.fotos.map(foto =>
        uploadToCloudinary(foto.buffer, {
          resource_type: 'image',
          folder: 'revisiones_diarias/fotos',
          transformation: [
            { width: 1200, crop: 'limit', quality: 'auto' }
          ]
        })
      );
      const fotosResults = await Promise.all(uploadPromises);
      fotosUrls = fotosResults.map(r => r.secure_url);
    }

    // 3. GUARDAR EN BASE DE DATOS
    const [nuevaRevision] = await db('revisiones_diarias')
      .insert({
        conductor_id: conductorId,
        vehiculo_id: asignacion.vehiculo_id,
        fecha_revision: db.fn.now(),
        video_url: videoResult.secure_url,
        fotos_urls: JSON.stringify(fotosUrls),
        comentarios: comentarios || null,
        kilometraje: kilometraje ? parseInt(kilometraje) : null,
        cloudinary_video_id: videoResult.public_id,
        created_at: db.fn.now()
      })
      .returning('*');

    // 4. ACTUALIZAR KILOMETRAJE DEL VEHÍCULO (si se proporcionó)
    if (kilometraje) {
      await db('vehiculos')
        .where({ id: asignacion.vehiculo_id })
        .update({
          kilometraje_actual: parseInt(kilometraje),
          updated_at: db.fn.now()
        });
    }

    res.status(201).json({
      success: true,
      message: 'Revisión diaria subida correctamente',
      revision: {
        id: nuevaRevision.id,
        fecha_revision: nuevaRevision.fecha_revision,
        video_url: nuevaRevision.video_url,
        fotos_count: fotosUrls.length
      }
    });

  } catch (error) {
    console.error('Error en subirRevisionDiaria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir revisión diaria',
      error: error.message
    });
  }
};

// =====================================================
// OBTENER HISTORIAL DE REVISIONES DIARIAS
// =====================================================
const getHistorialRevisiones = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;
    const limit = parseInt(req.query.limit) || 30;

    const revisiones = await db('revisiones_diarias')
      .where({ conductor_id: conductorId })
      .orderBy('fecha_revision', 'desc')
      .limit(limit)
      .select('*');

    // Parsear JSON de fotos_urls
    const revisionesConFotos = revisiones.map(rev => ({
      ...rev,
      fotos_urls: rev.fotos_urls ? JSON.parse(rev.fotos_urls) : []
    }));

    res.json({
      success: true,
      total: revisiones.length,
      revisiones: revisionesConFotos
    });

  } catch (error) {
    console.error('Error en getHistorialRevisiones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de revisiones',
      error: error.message
    });
  }
};

module.exports = {
  getMiVehiculo,
  subirRevisionDiaria,
  getHistorialRevisiones
};