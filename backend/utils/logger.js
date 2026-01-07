// backend/utils/logger.js
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  // Solo en desarrollo - logs detallados
  debug: (...args) => {
    if (isDevelopment) {
      console.log('🔍 DEBUG:', ...args);
    }
  },
  
  // Información importante - siempre visible
  info: (...args) => {
    console.log('ℹ️ INFO:', ...args);
  },
  
  // Operaciones exitosas - siempre visible
  success: (...args) => {
    console.log('✅ SUCCESS:', ...args);
  },
  
  // Advertencias - siempre visible
  warning: (...args) => {
    console.warn('⚠️ WARNING:', ...args);
  },
  
  // Errores - siempre visible
  error: (...args) => {
    console.error('❌ ERROR:', ...args);
  },
  
  // Solo en desarrollo - logs de debugging específicos
  devOnly: (...args) => {
    if (isDevelopment) {
      console.log('🚧 DEV:', ...args);
    }
  },

  // Solo en desarrollo - logs de estructura de datos
  structure: (title, data) => {
    if (isDevelopment) {
      console.log(`📋 STRUCTURE [${title}]:`, JSON.stringify(data, null, 2));
    }
  }
};

module.exports = logger;