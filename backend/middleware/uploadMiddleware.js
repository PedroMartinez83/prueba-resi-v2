const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary'); // 🔥 Importar desde config

// Configurar almacenamiento para imágenes usando la instancia ya configurada
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary, // 🔥 Usar la instancia importada
  params: {
    folder: 'automanager/solicitudes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `${file.fieldname}-${uniqueSuffix}`;
    }
  }
});

// Configurar Multer con límites generosos
const uploadImages = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
    fields: 50,
    fieldSize: 2 * 1024 * 1024,
    parts: 100
  },
  fileFilter: (req, file, cb) => {
    console.log('🖼️ Validando archivo:', file.fieldname, file.mimetype);
    
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
  }
});

module.exports = {
  uploadImages,
  cloudinary
};