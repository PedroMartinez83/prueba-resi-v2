const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🔥 Verificar que la configuración es correcta
console.log('📸 Cloudinary configurado:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'NO CONFIGURADO',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '***OCULTO***' : 'NO CONFIGURADO'
});

module.exports = cloudinary;