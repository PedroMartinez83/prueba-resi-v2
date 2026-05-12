const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');


// 🚀 Importaciones clásicas (Asegúrate de que los nombres de los archivos sean exactos)
const SolicitudInversionistaController = require('../controllers/solicitudInversionistaController');
const inversionistasController = require('../controllers/inversionistasController');

const router = express.Router();

// ☁️ Configuración de Cloudinary (Usa tus variables de entorno)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🚀 Multer configurado para mandar directo a Cloudinary
 const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'solicitudes_inversionistas', 
    resource_type: 'auto', 
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf','avif', 'webp']
  },
}); 

const upload = multer({ storage: storage });

const camposArchivos = upload.fields([
  { name: 'doc_identificacion', maxCount: 1 },
  { name: 'doc_constancia_fiscal', maxCount: 1 },
  { name: 'doc_comprobante_domicilio', maxCount: 1 },
  { name: 'doc_cuenta_banco', maxCount: 1 },
  { name: 'doc_acta_constitutiva', maxCount: 1 },
  { name: 'doc_poder_legal', maxCount: 1 },
  { name: 'doc_id_representante', maxCount: 1 }
]);

// 🌍 RUTAS PÚBLICAS
router.post('/nueva', 
  // 1. Micrófono en la puerta de entrada
  (req, res, next) => {
    console.log("📥 [PASO 1] Petición llegando a la ruta /nueva...");
    next();
  },
  
  // 2. Trampa de errores para Multer
  (req, res, next) => {
    camposArchivos(req, res, (err) => {
      if (err) {
        console.log("❌ [ERROR FATAL DE MULTER]:", err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error al procesar los archivos', 
          error: err.message 
        });
      }
      console.log("✅ [PASO 2] Multer logró procesar los archivos sin explotar.");
      next();
    });
  },
  
  // 3. Pasamos al controlador
  SolicitudInversionistaController.crearSolicitud
);
router.get('/verificar', inversionistasController.verificarCampoDuplicado);

// 🔒 RUTAS PRIVADAS (Panel Admin)
router.get('/admin/lista', SolicitudInversionistaController.obtenerSolicitudes);
router.get('/admin/:id', SolicitudInversionistaController.obtenerSolicitudPorId);
router.put('/admin/:id/evaluar', SolicitudInversionistaController.evaluarSolicitud);
// 🚀 Pegamos la ruta aquí, que es territorio seguro
router.post('/admin/solicitudes/:id/aprobar', inversionistasController.aprobarSolicitudInversionista);
// 🚀 Ruta para rechazar (Asegúrate de que quede en solicitudesInversionistaRoutes.js)
router.post('/admin/solicitudes/:id/rechazar', inversionistasController.rechazarSolicitudInversionista);

// 🚀 Exportación clásica para que Express lo entienda
module.exports = router;