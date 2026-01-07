// backend/utils/enumHelper.js
const { db } = require('../services/postgresService');

/**
 * Obtiene los valores permitidos de un tipo ENUM en PostgreSQL
 * @param {string} enumTypeName - Nombre del tipo ENUM en PostgreSQL
 * @returns {Promise<Array>} Array con los valores permitidos
 */
async function getEnumValues(enumTypeName) {
  try {
    const query = `
      SELECT unnest(enum_range(NULL::${enumTypeName}))::text as value
    `;
    const result = await db.query(query);
    return result.rows.map(row => row.value);
  } catch (error) {
    console.error(`Error obteniendo valores de ENUM ${enumTypeName}:`, error);
    return [];
  }
}

/**
 * Obtiene todos los valores ENUM relacionados con vehículos
 * @returns {Promise<Object>} Objeto con todos los valores ENUM
 */
async function getVehiculosEnumValues() {
  try {
    // Primero, obtenemos los nombres de los tipos ENUM desde la tabla
    const enumQuery = `
      SELECT 
        column_name, 
        udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'vehiculos' 
      AND udt_name != 'int4' 
      AND udt_name != 'varchar' 
      AND udt_name != 'text' 
      AND udt_name != 'numeric'
      AND udt_name != 'timestamptz';
    `;
    
    const enumColumns = await db.query(enumQuery);
    
    const enumValues = {};
    
    // Para cada columna ENUM, obtenemos sus valores
    for (const column of enumColumns.rows) {
      const values = await getEnumValues(column.udt_name);
      // Convertimos snake_case a camelCase para el frontend
      const fieldName = column.column_name
        .split('_')
        .map((word, index) => 
          index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join('');
      
      enumValues[fieldName] = values;
    }
    
    // Agregamos valores que no son ENUM pero queremos ofrecer como opciones
    enumValues.tipoSocio = ['SD', 'SI', 'SA'];
    enumValues.status = ['Activo', 'Inactivo', 'Temporal'];
    
    // Obtenemos marcas y modelos únicos de los registros existentes
    const marcasQuery = await db.query(
      'SELECT DISTINCT marca FROM vehiculos WHERE marca IS NOT NULL ORDER BY marca'
    );
    const modelosQuery = await db.query(
      'SELECT DISTINCT modelo FROM vehiculos WHERE modelo IS NOT NULL ORDER BY modelo'
    );
    
    enumValues.marcas = marcasQuery.rows.map(r => r.marca);
    enumValues.modelos = modelosQuery.rows.map(r => r.modelo);
    
    // Si no hay marcas/modelos, agregamos algunos por defecto
    if (enumValues.marcas.length === 0) {
      enumValues.marcas = ['Nissan', 'BYD', 'Toyota', 'Chevrolet'];
    }
    
    if (enumValues.modelos.length === 0) {
      enumValues.modelos = ['Versa', 'March', 'V-Drive', 'Dolphin Mini'];
    }
    
    return enumValues;
  } catch (error) {
    console.error('Error obteniendo valores ENUM:', error);
    // Valores por defecto en caso de error
    return {
      tipoSocio: ['SD', 'SI', 'SA'],
      status: ['Activo', 'Inactivo', 'Temporal'],
      marca: ['Nissan', 'BYD'],
      modelo: ['Versa', 'March', 'V-Drive', 'Dolphin Mini'],
      tipoVehiculo: ['Sedan', 'SUV', 'Pickup', 'Van'],
      tipoCombustible: ['Gasolina', 'Eléctrico'],
      color: ['Blanco', 'Negro', 'Gris', 'Rojo', 'Azul'],
      estado: ['Disponible', 'Rentado', 'Mantenimiento', 'Baja', 'Siniestro'],
      marcas: [],
      modelos: []
    };
  }
}

module.exports = {
  getEnumValues,
  getVehiculosEnumValues
};