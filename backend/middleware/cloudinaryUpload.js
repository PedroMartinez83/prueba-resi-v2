// backend/middleware/cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

/**
 * Middleware para subir archivos a Cloudinary usando express-fileupload
 * Los archivos ya fueron procesados por express-fileupload y están en req.files
 */
const uploadToCloudinary = async (req, res, next) => {
  try {
    // Si no hay archivos, continuar
    if (!req.files || Object.keys(req.files).length === 0) {
      console.log('⚠️ No hay archivos para subir a Cloudinary');
      return next();
    }

    console.log('☁️ Iniciando subida a Cloudinary de', Object.keys(req.files).length, 'archivos');

    // Procesar cada archivo
    for (const [fieldName, file] of Object.entries(req.files)) {
      console.log(`📤 Subiendo ${fieldName}:`, file.name);

      // Subir a Cloudinary desde el archivo temporal
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: 'automanager/solicitudes',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
        public_id: `${fieldName}-${Date.now()}-${Math.round(Math.random() * 1E9)}`,
        resource_type: 'auto'
      });

      console.log(`✅ ${fieldName} subido:`, result.secure_url);

      // Agregar la URL de Cloudinary al objeto del archivo
      req.files[fieldName].path = result.secure_url;
      req.files[fieldName].cloudinary_url = result.secure_url;
      req.files[fieldName].cloudinary_public_id = result.public_id;
    }

    console.log('✅ Todos los archivos subidos a Cloudinary exitosamente');
    next();

  } catch (error) {
    console.error('❌ Error subiendo a Cloudinary:', error);
    
    // Enviar error al cliente
    res.status(500).json({
      success: false,
      message: 'Error subiendo archivos a Cloudinary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { uploadToCloudinary };