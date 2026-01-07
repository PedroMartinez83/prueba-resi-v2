const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🔥 USAR MEMORIA EN LUGAR DE CloudinaryStorage
const uploadSiniestroFotos = multer({
  storage: multer.memoryStorage(), // Guardar en memoria primero
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por foto
    files: 10
  },
  fileFilter: (req, file, cb) => {
    console.log('📸 Procesando archivo:', file.originalname, file.mimetype);
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  }
});

const uploadInspeccionVideo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten videos'), false);
    }
  }
});

module.exports = {
  uploadSiniestroFotos,
  uploadInspeccionVideo,
  cloudinary
};