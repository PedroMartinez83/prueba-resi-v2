// backend/services/airtableService.js
const Airtable = require('airtable');

// Solo cargar dotenv en desarrollo
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Debug para verificar variables en producción
console.log('🔍 Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY ? 'CONFIGURED' : 'MISSING',
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID ? 'CONFIGURED' : 'MISSING'
});

// Configurar Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

// Nombres de las tablas en Airtable
const TABLES = {
  CONDUCTORES: 'Conductores',
  VEHICULOS: 'Vehiculos',
  RENTAS: 'Rentas',
  MANTENIMIENTOS: 'Mantenimientos',
  SINIESTROS: 'Siniestros',
  USUARIOS: 'Usuarios'
};

// ============ FUNCIÓN AUXILIAR PARA FORMATEAR REGISTROS ============
/**
 * Formatea un registro de Airtable para uso interno
 * @param {Object} record - Registro de Airtable
 * @returns {Object} Registro formateado con id y campos al nivel principal
 */
const formatRecord = (record) => {
  return {
    id: record.id,
    ...record.fields
  };
};

// ============ FUNCIONES CRUD PRINCIPALES ============

/**
 * Obtiene todos los registros de una tabla
 * @param {string} tableName - Nombre de la tabla
 * @returns {Array} Array de registros formateados
 */
const getAll = async (tableName) => {
  try {
    const records = await base(tableName).select().all();
    return records.map(formatRecord);
  } catch (error) {
    console.error(`Error obteniendo registros de ${tableName}:`, error);
    throw error;
  }
};

/**
 * Obtiene un registro por ID
 * @param {string} tableName - Nombre de la tabla
 * @param {string} recordId - ID del registro
 * @returns {Object} Registro formateado
 */
const getById = async (tableName, recordId) => {
  try {
    const record = await base(tableName).find(recordId);
    return formatRecord(record);
  } catch (error) {
    console.error(`Error obteniendo registro ${recordId} de ${tableName}:`, error);
    throw error;
  }
};

/**
 * Crea un nuevo registro
 * @param {string} tableName - Nombre de la tabla
 * @param {Object} data - Datos del registro a crear
 * @returns {Object} Registro creado y formateado
 */
const create = async (tableName, data) => {
  try {
    // Log para debugging (eliminar en producción)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Creando registro en ${tableName}:`, data);
    }
    
    const records = await base(tableName).create([
      {
        fields: data
      }
    ]);
    
    return formatRecord(records[0]);
  } catch (error) {
    console.error(`Error creando registro en ${tableName}:`, error);
    throw error;
  }
};

/**
 * Actualiza un registro existente
 * @param {string} tableName - Nombre de la tabla
 * @param {string} recordId - ID del registro
 * @param {Object} data - Datos a actualizar
 * @returns {Object} Registro actualizado y formateado
 */
const update = async (tableName, recordId, data) => {
  try {
    const record = await base(tableName).update(recordId, data);
    return formatRecord(record);
  } catch (error) {
    console.error(`Error actualizando registro ${recordId} en ${tableName}:`, error);
    throw error;
  }
};

/**
 * Elimina un registro
 * @param {string} tableName - Nombre de la tabla
 * @param {string} recordId - ID del registro
 * @returns {Object} Confirmación de eliminación
 */
const deleteRecord = async (tableName, recordId) => {
  try {
    await base(tableName).destroy(recordId);
    return { success: true, id: recordId };
  } catch (error) {
    console.error(`Error eliminando registro ${recordId} de ${tableName}:`, error);
    throw error;
  }
};

// ============ FUNCIONES DE BÚSQUEDA ESPECÍFICAS ============

/**
 * Busca un usuario por email (usando campo Name)
 * @param {string} email - Email del usuario
 * @returns {Object|null} Usuario encontrado o null
 */
const findUserByEmail = async (email) => {
  try {
    const records = await base(TABLES.USUARIOS)
      .select({
        filterByFormula: `{Name} = '${email}'`,
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length === 0) return null;
    
    return formatRecord(records[0]);
  } catch (error) {
    console.error('Error buscando usuario por email:', error);
    throw error;
  }
};

/**
 * Busca un usuario por número de vehículo
 * @param {string} numeroVehiculo - Número del vehículo
 * @returns {Object|null} Usuario encontrado o null
 */
const findUserByVehiculo = async (numeroVehiculo) => {
  try {
    const records = await base(TABLES.USUARIOS)
      .select({
        filterByFormula: `{NumeroVehiculo} = '${numeroVehiculo}'`,
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length === 0) return null;
    
    return formatRecord(records[0]);
  } catch (error) {
    console.error('Error buscando usuario por vehículo:', error);
    throw error;
  }
};

/**
 * Busca un conductor por ID de usuario
 * @param {string} userId - ID del usuario
 * @returns {Object|null} Conductor encontrado o null
 */
// En airtableService.js
const findConductorByEmail = async (email) => {
  try {
    const records = await getWithFilter(
      TABLES.CONDUCTORES,
      `{Email} = '${email}'`
    );
    return records[0] || null;
  } catch (error) {
    console.error('Error buscando conductor por email:', error);
    return null;
  }
};

/**
 * Busca un conductor por número de vehículo
 * @param {string} numeroVehiculo - Número del vehículo
 * @returns {Object|null} Conductor encontrado o null
 */
const findConductorByVehiculo = async (numeroVehiculo) => {
  try {
    const records = await base(TABLES.CONDUCTORES)
      .select({
        filterByFormula: `{NumeroVehiculo} = '${numeroVehiculo}'`,
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length === 0) return null;
    
    return formatRecord(records[0]);
  } catch (error) {
    console.error('Error buscando conductor por vehículo:', error);
    throw error;
  }
};

/**
 * Busca un vehículo por número
 * @param {string} numeroVehiculo - Número del vehículo
 * @returns {Object|null} Vehículo encontrado o null
 */
const findVehiculoByNumero = async (numeroVehiculo) => {
  try {
    const records = await base(TABLES.VEHICULOS)
      .select({
        filterByFormula: `{NumeroVehiculo} = '${numeroVehiculo}'`,
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length === 0) return null;
    
    return formatRecord(records[0]);
  } catch (error) {
    console.error('Error buscando vehículo:', error);
    throw error;
  }
};

/**
 * Obtiene rentas pendientes de un conductor por número de vehículo
 * @param {string} numeroVehiculo - Número del vehículo
 * @returns {Array} Array de rentas pendientes
 */
const getRentasPendientesByVehiculo = async (numeroVehiculo) => {
  try {
    const records = await base(TABLES.RENTAS)
      .select({
        filterByFormula: `AND({ConductorID} = '${numeroVehiculo}', OR({Estado de Pago} = 'Pendiente', {Estado de Pago} = ''))`,
        sort: [{field: "FechaVencimiento", direction: "asc"}]
      })
      .all();
    
    return records.map(formatRecord);
  } catch (error) {
    console.error('Error obteniendo rentas pendientes:', error);
    throw error;
  }
};

/**
 * Obtiene rentas pendientes de un conductor (función legacy)
 * @param {string} conductorId - ID del conductor
 * @returns {Array} Array de rentas pendientes
 */
const getRentasPendientesByConductor = async (conductorId) => {
  try {
    const records = await base(TABLES.RENTAS)
      .select({
        filterByFormula: `AND({ConductorID} = '${conductorId}', {Estado} = 'Pendiente')`,
        sort: [{field: "FechaVencimiento", direction: "desc"}]
      })
      .all();
    
    return records.map(formatRecord);
  } catch (error) {
    console.error('Error obteniendo rentas pendientes:', error);
    throw error;
  }
};

/**
 * Obtiene registros con filtros personalizados
 * @param {string} tableName - Nombre de la tabla
 * @param {string} filterFormula - Fórmula de filtro de Airtable
 * @param {Array} sortFields - Campos para ordenar
 * @returns {Array} Array de registros filtrados
 */
const getWithFilter = async (tableName, filterFormula, sortFields = []) => {
  try {
    const config = {};
    
    if (filterFormula) {
      config.filterByFormula = filterFormula;
    }
    
    if (sortFields.length > 0) {
      config.sort = sortFields;
    }
    
    const records = await base(tableName)
      .select(config)
      .all();
    
    return records.map(formatRecord);
  } catch (error) {
    console.error(`Error obteniendo registros filtrados de ${tableName}:`, error);
    throw error;
  }
};

// ============ FUNCIONES DE UTILIDAD ============

/**
 * Verifica la conexión con Airtable
 * @returns {boolean} true si la conexión es exitosa
 */
const testConnection = async () => {
  try {
    await base(TABLES.USUARIOS).select({ maxRecords: 1 }).firstPage();
    console.log('✅ Conexión con Airtable establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error de conexión con Airtable:', error.message);
    return false;
  }
};

// ============ FUNCIONES ADICIONALES PARA VINCULACIÓN ============
// Agregar estas funciones al final de tu airtableService.js (antes del module.exports)

/**
 * Obtiene un usuario por ID (con vinculaciones)
 * @param {string} userId - ID del usuario
 * @returns {Object|null} Usuario encontrado o null
 */
const findUserById = async (userId) => {
  try {
    const record = await base(TABLES.USUARIOS).find(userId);
    return formatRecord(record);
  } catch (error) {
    console.error('Error buscando usuario por ID:', error);
    return null;
  }
};

/**
 * Obtiene un conductor por ID
 * @param {string} conductorId - ID del conductor
 * @returns {Object|null} Conductor encontrado o null
 */
const getConductorById = async (conductorId) => {
  try {
    const record = await base(TABLES.CONDUCTORES).find(conductorId);
    return formatRecord(record);
  } catch (error) {
    console.error('Error obteniendo conductor por ID:', error);
    return null;
  }
};

/**
 * Obtiene un vehículo por ID
 * @param {string} vehiculoId - ID del vehículo
 * @returns {Object|null} Vehículo encontrado o null
 */
const getVehiculoById = async (vehiculoId) => {
  try {
    const record = await base(TABLES.VEHICULOS).find(vehiculoId);
    return formatRecord(record);
  } catch (error) {
    console.error('Error obteniendo vehículo por ID:', error);
    return null;
  }
};

/**
 * Actualiza un usuario existente
 * @param {string} userId - ID del usuario
 * @param {Object} data - Datos a actualizar
 * @returns {Object} Usuario actualizado
 */
const updateUser = async (userId, data) => {
  try {
    const record = await base(TABLES.USUARIOS).update(userId, data);
    return formatRecord(record);
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    throw error;
  }
};

// ============ ACTUALIZAR EL MODULE.EXPORTS ============
// Reemplaza tu module.exports actual por este:

module.exports = {
  // Configuración
  base,
  TABLES,
  
  // CRUD principal
  getAll,
  getById,
  create,
  update,
  deleteRecord,
  
  // Búsquedas específicas
  findUserByEmail,
  findUserByVehiculo,
  findUserById,              // ← NUEVA
  findConductorByEmail,
  findConductorByVehiculo,
  findVehiculoByNumero,
  getRentasPendientesByConductor,
  getRentasPendientesByVehiculo,
  
  // Obtener por ID
  getConductorById,          // ← NUEVA
  getVehiculoById,           // ← NUEVA
  
  // Actualizar específico
  updateUser,                // ← NUEVA
  
  // Filtros y utilidades
  getWithFilter,
  testConnection,
  
  // Función auxiliar
  formatRecord
};