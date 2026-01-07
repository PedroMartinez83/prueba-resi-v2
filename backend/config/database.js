// backend/config/database.js

const knex = require('knex');
require('dotenv').config({ path: '../.env' }); // Cargar .env desde la raíz

// Inicializamos la configuración base
const dbConfigBase = {
  client: 'pg',
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: '../../migrations'
  },
  seeds: {
    directory: '../../seeds'
  }
};

let dbConfig;

// Lógica para determinar la configuración de conexión
if (process.env.DATABASE_URL) {
  // --- Configuración para Producción (Railway, Heroku, etc.) ---
  console.log('🚀 Usando configuración de base de datos de producción (DATABASE_URL)');
  dbConfig = {
    ...dbConfigBase,
    connection: {
      connectionString: process.env.DATABASE_URL,
      // Esta configuración de SSL es crucial para conexiones en producción
      ssl: { rejectUnauthorized: false } 
    }
  };
} else {
  // --- Configuración para Desarrollo (tu PC local) ---
  console.log('💻 Usando configuración de base de datos de desarrollo (localhost)');
  dbConfig = {
    ...dbConfigBase,
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres123',
      database: process.env.DB_DATABASE || 'auto_manager_db'
    }
  };
}

// Crear instancia de Knex
const db = knex(dbConfig);

// Función para verificar la conexión (sin cambios)
const testConnection = async () => {
  try {
    await db.raw('SELECT 1+1 AS result');
    console.log('✅ Conexión con PostgreSQL establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error de conexión con PostgreSQL:', error.message);
    return false;
  }
};

module.exports = {
  db,
  testConnection
};