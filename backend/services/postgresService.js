// backend/services/postgresService.js
const { db } = require('../config/database');
const bcrypt = require('bcryptjs'); // <--- AÑADIDO: Para hashear passwords

// Nombres de las tablas en PostgreSQL (minúsculas)
const TABLES = {
  CONDUCTORES: 'conductores',
  VEHICULOS: 'vehiculos',
  RENTAS: 'rentas',
  MANTENIMIENTOS: 'mantenimientos',
  SINIESTROS: 'siniestros',
  USUARIOS: 'usuarios',
  CLIENTES: 'clientes',
  VIAJES: 'viajes',
  MENSAJES: 'mensajes',
  SOLICITUDES_CONDUCTOR: 'solicitudes_conductor',
  INVERSIONISTAS: 'inversionistas',
  INVERSIONES_VEHICULOS: 'inversiones_vehiculos',
  PAGOS_INVERSIONISTAS: 'pagos_inversionistas',
  SOLICITUDES_INVERSION: 'solicitudes_inversion'
};

// <--- AÑADIDO: Función para generar password temporal
/**
 * Genera un password temporal memorable
 * @returns {string} Password (ej: Conduc_a1b2c)
 */
const generateTempPassword = () => {
  const randomPart = Math.random().toString(36).substring(2, 7);
  return `Conduc_${randomPart}`;
};

// ============ FUNCIÓN AUXILIAR PARA FORMATEAR REGISTROS ============
/**
 * Formatea un registro de PostgreSQL - SIMPLIFICADO
 * @param {Object} record - Registro de PostgreSQL
 * @returns {Object} Registro formateado
 */
const formatRecord = (record) => {
  if (!record) return null;
  return record; // Sin modificaciones, usar directamente
};

// ============ FUNCIONES CRUD PRINCIPALES ============

/**
 * Obtiene todos los registros de una tabla
 * @param {string} tableName - Nombre de la tabla
 * @returns {Array} Array de registros
 */
const getAll = async (tableName) => {
  try {
    const records = await db(tableName).select('*');
    return records.map(formatRecord);
  } catch (error) {
    console.error(`Error obteniendo registros de ${tableName}:`, error);
    throw error;
  }
};

/**
 * Obtiene un registro por ID - SIMPLIFICADO
 * @param {string} tableName - Nombre de la tabla
 * @param {string|number} recordId - ID del registro
 * @returns {Object} Registro encontrado
 */
const getById = async (tableName, recordId) => {
  try {
    const record = await db(tableName)
      .where('id', recordId)
      .first();
    
    if (!record) {
      throw new Error(`Record not found: ${recordId}`);
    }
    
    return formatRecord(record);
  } catch (error) {
    console.error(`Error obteniendo registro ${recordId} de ${tableName}:`, error);
    throw error;
  }
};

/**
 * Crea un nuevo registro - SIMPLIFICADO
 * @param {string} tableName - Nombre de la tabla
 * @param {Object} data - Datos del registro a crear
 * @returns {Object} Registro creado
 */
const create = async (tableName, data) => {
  try {
    console.log(`Creando registro en ${tableName}:`, data);
    
    // Limpiar datos antes de insertar
    const cleanData = { ...data };
    delete cleanData.id; // No enviar id, dejar que PostgreSQL lo genere
    
    const [record] = await db(tableName)
      .insert(cleanData)
      .returning('*');
    
    return formatRecord(record);
  } catch (error) {
    console.error(`Error creando registro en ${tableName}:`, error);
    throw error;
  }
};

/**
 * Actualiza un registro existente - SIMPLIFICADO
 * @param {string} tableName - Nombre de la tabla
 * @param {string|number} recordId - ID del registro
 * @param {Object} data - Datos a actualizar
 * @returns {Object} Registro actualizado
 */
const update = async (tableName, recordId, data) => {
  try {
    // Limpiar datos
    const cleanData = { ...data };
    delete cleanData.id;
    delete cleanData.created_at;
    
    const [updated] = await db(tableName)
      .where('id', recordId)
      .update({
        ...cleanData,
        updated_at: new Date()
      })
      .returning('*');
    
    return formatRecord(updated);
  } catch (error) {
    console.error(`Error actualizando registro ${recordId} en ${tableName}:`, error);
    throw error;
  }
};

/**
 * Elimina un registro
 * @param {string} tableName - Nombre de la tabla
 * @param {string|number} recordId - ID del registro
 * @returns {Object} Confirmación de eliminación
 */
const deleteRecord = async (tableName, recordId) => {
  try {
    const deleted = await db(tableName)
      .where('id', recordId)
      .delete();
    
    if (deleted === 0) {
      throw new Error(`Record not found: ${recordId}`);
    }
    
    return { success: true, id: recordId };
  } catch (error) {
    console.error(`Error eliminando registro ${recordId} de ${tableName}:`, error);
    throw error;
  }
};

// ============ FUNCIONES DE BÚSQUEDA ESPECÍFICAS ============

/**
 * Busca un usuario por email
 * @param {string} email - Email del usuario
 * @returns {Object|null} Usuario encontrado o null
 */
const findUserByEmail = async (email) => {
  try {
    const record = await db(TABLES.USUARIOS)
      .where('email', email)
      .first();
    
    return formatRecord(record);
  } catch (error) {
    console.error('Error buscando usuario por email:', error);
    throw error;
  }
};

/**
 * Busca un conductor por email
 * @param {string} email - Email del conductor
 * @returns {Object|null} Conductor encontrado o null
 */
const findConductorByEmail = async (email) => {
  try {
    const record = await db(TABLES.CONDUCTORES)
      .where('email', email)
      .first();
    
    return formatRecord(record);
  } catch (error) {
    console.error('Error buscando conductor por email:', error);
    return null;
  }
};

/**
 * Obtiene un conductor por ID
 * @param {string|number} conductorId - ID del conductor
 * @returns {Object|null} Conductor encontrado o null
 */
const getConductorById = async (conductorId) => {
  try {
    const record = await db(TABLES.CONDUCTORES)
      .where('id', conductorId)
      .first();
    
    return formatRecord(record);
  } catch (error) {
    console.error('Error obteniendo conductor por ID:', error);
    return null;
  }
};

/**
 * Obtiene un vehículo por ID
 * @param {string|number} vehiculoId - ID del vehículo
 * @returns {Object|null} Vehículo encontrado o null
 */
const getVehiculoById = async (vehiculoId) => {
  try {
    const record = await db(TABLES.VEHICULOS)
      .where('id', vehiculoId)
      .first();
    
    return formatRecord(record);
  } catch (error) {
    console.error('Error obteniendo vehículo por ID:', error);
    return null;
  }
};

// ============ FUNCIONES ESPECÍFICAS PARA SOLICITUDES ============

/**
 * Obtiene todas las solicitudes con información de conductor asociado
 * @param {Object} filters - Filtros opcionales (estatus, fecha_desde, fecha_hasta)
 * @param {Object} pagination - Paginación (page, limit)
 * @returns {Object} Solicitudes paginadas con metadatos
 */
const getSolicitudesConPaginacion = async (filters = {}, pagination = { page: 1, limit: 10 }) => {
  try {
    const { estatus, fecha_desde, fecha_hasta } = filters;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = db(TABLES.SOLICITUDES_CONDUCTOR)
      .leftJoin('conductores', 'solicitudes_conductor.conductor_id', 'conductores.id')
      .leftJoin('usuarios as admin', 'solicitudes_conductor.admin_revisor_id', 'admin.id')
      .select(
        'solicitudes_conductor.*',
        'conductores.nombre_conductor as conductor_nombre',
        'admin.name as admin_revisor_nombre'
      );

    // Query separada para count (sin joins)
    let countQuery = db(TABLES.SOLICITUDES_CONDUCTOR);

    // Aplicar filtros a ambas queries
    if (estatus && estatus !== 'Todos') {
      query = query.where('solicitudes_conductor.estatus_solicitud', estatus);
      countQuery = countQuery.where('estatus_solicitud', estatus);
    }

    if (fecha_desde) {
      query = query.where('solicitudes_conductor.fecha_solicitud', '>=', fecha_desde);
      countQuery = countQuery.where('fecha_solicitud', '>=', fecha_desde);
    }

    if (fecha_hasta) {
      query = query.where('solicitudes_conductor.fecha_solicitud', '<=', fecha_hasta);
      countQuery = countQuery.where('fecha_solicitud', '<=', fecha_hasta);
    }

    // Obtener total para paginación
    const [{ count }] = await countQuery.count('id as count');
    const total = parseInt(count);

    // Aplicar paginación y ordenamiento
    const records = await query
      .orderBy('solicitudes_conductor.fecha_solicitud', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      solicitudes: records.map(formatRecord),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  } catch (error) {
    console.error('Error obteniendo solicitudes paginadas:', error);
    throw error;
  }
};

/**
 * Busca una solicitud por teléfono
 * @param {string} telefono - Número de teléfono
 * @returns {Object|null} Solicitud encontrada o null
 */
const findSolicitudByContacto = async (telefono) => {
  try {
    const record = await db(TABLES.SOLICITUDES_CONDUCTOR)
      .where('telefono', telefono)
      .first();
    
    return formatRecord(record);
  } catch (error) {
    console.error('Error buscando solicitud por contacto:', error);
    throw error;
  }
};

/**
 * Obtiene estadísticas de solicitudes - CORREGIDA
 * @returns {Object} Estadísticas detalladas
 */
const getEstadisticasSolicitudes = async () => {
  try {
    // Conteos por estatus
    const estadisticas = await db(TABLES.SOLICITUDES_CONDUCTOR)
      .select('estatus_solicitud')
      .count('id as total')
      .groupBy('estatus_solicitud');

    console.log('Raw estadísticas:', estadisticas);

    // Inicializar con valores por defecto
    const stats = {
      total: 0,
      pendientes: 0,
      aprobadas: 0,
      rechazadas: 0,
      enPrueba: 0,
      migradas: 0
    };

    // Procesar resultados
    estadisticas.forEach(stat => {
      const count = parseInt(stat.total);
      stats.total += count;
      
      switch(stat.estatus_solicitud) {
        case 'Pendiente':
          stats.pendientes = count;
          break;
        case 'Aprobado':
          stats.aprobadas = count;
          break;
        case 'Aprobado (a prueba)':
          stats.enPrueba = count;
          break;
        case 'Rechazado':
          stats.rechazadas = count;
          break;
      }
    });

    // Contar migradas (las que tienen conductor_id)
    const migradas = await db(TABLES.SOLICITUDES_CONDUCTOR)
      .whereNotNull('conductor_id')
      .count('id as total')
      .first();
    
    stats.migradas = parseInt(migradas.total);

    console.log('Stats procesadas:', stats);
    return stats;
  } catch (error) {
    console.error('Error obteniendo estadísticas de solicitudes:', error);
    // Retornar datos por defecto en caso de error
    return {
      total: 0,
      pendientes: 0,
      aprobadas: 0,
      rechazadas: 0,
      enPrueba: 0,
      migradas: 0
    };
  }
};

/**
 * 🔥 MIGRA UNA SOLICITUD APROBADA A CONDUCTOR - CON LÓGICA INTELIGENTE Y COMPLETA
 * @param {number} solicitudId - ID de la solicitud
 * @param {number} adminId - ID del admin que aprueba
 * @param {Object} datosAdicionales - Datos adicionales del conductor (RFC, etc.)
 * @returns {Object} { conductor, passwordTemporal }
 */
const migrarSolicitudAConductor = async (solicitudId, adminId, datosAdicionales = {}) => {
  const trx = await db.transaction();
  
  let passwordTemporal = null; 

  try {
    console.log('🚀 Iniciando migración de solicitud a conductor');
    console.log('📋 Solicitud ID:', solicitudId);

    // 1️⃣ Obtener la solicitud
    const solicitud = await trx(TABLES.SOLICITUDES_CONDUCTOR)
      .where('id', solicitudId)
      .first();

    if (!solicitud) {
      throw new Error('Solicitud no encontrada');
    }

    if (solicitud.estatus_solicitud !== 'Aprobado' && solicitud.estatus_solicitud !== 'Aprobado (a prueba)') {
      throw new Error(`Solicitud no está aprobada. Estado actual: ${solicitud.estatus_solicitud}`);
    }

    if (solicitud.conductor_id) {
      throw new Error('Esta solicitud ya fue migrada a conductor');
    }

    // 2️⃣ Preparar y validar datos para el USUARIO
    console.log('Validando datos para crear usuario...');
    
    const emailUsuario = (solicitud.email || `${solicitud.telefono}@driver.automanager.com`).toLowerCase().trim();
    const usuarioAirtableId = `CONDUCTOR_MIGRADO_${solicitud.id}`;

    // Verificar que el email no exista YA en la tabla USUARIOS
    const usuarioExistente = await trx(TABLES.USUARIOS).where('email', emailUsuario).first();
    if (usuarioExistente) {
      throw new Error(`El email '${emailUsuario}' ya está en uso en la tabla de usuarios (ID: ${usuarioExistente.id}).`);
    }

    // 3️⃣ Crear el USUARIO
    console.log(`Creando usuario para ${emailUsuario}...`);
    passwordTemporal = generateTempPassword();
    const hashedPassword = await bcrypt.hash(passwordTemporal, 10);

    const nuevoUsuario = {
      name: solicitud.nombre_completo.trim(),
      email: emailUsuario,
      password: hashedPassword,
      rol: 'conductor',
      estado_cuenta: 'Activo', // ✅ Campo necesario
      // airtable_id eliminado (ya no se usa)
      nombre_completo: solicitud.nombre_completo.trim(),
      fecha_registro: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    const [usuario] = await trx(TABLES.USUARIOS)
      .insert(nuevoUsuario)
      .returning('*');

    console.log(`✅ Usuario creado exitosamente. ID: ${usuario.id}`);

    // 4️⃣ Lógica Inteligente: Póliza Mecánica
    const tipoPolizaPorDefecto = datosAdicionales.tipo_poliza || 'POLIZA_100';
    let saldoPolizaInicial = 0;
    if (tipoPolizaPorDefecto === 'POLIZA_100') {
      saldoPolizaInicial = 50000.00;
    }

    console.log(`💰 Póliza: ${tipoPolizaPorDefecto}, Saldo: $${saldoPolizaInicial}`);

    // 5️⃣ Crear el conductor con TODOS los campos (Mapeo Completo)
    const nuevoConductor = {
      // Vinculación
      usuario_id: usuario.id,

      // Datos Básicos
      nombre_conductor: solicitud.nombre_completo,
      numero_telefono: solicitud.telefono,
      email: emailUsuario,
      fecha_nacimiento: solicitud.fecha_nacimiento,
      curp: solicitud.curp,
      rfc: datosAdicionales.rfc || null,
      
      // Información Socioeconómica (NUEVOS CAMPOS)
      direccion_completa: solicitud.domicilio,
      estado_civil: solicitud.estado_civil,
      tipo_vivienda: solicitud.tipo_vivienda,
      tiempo_renta_actual: solicitud.tiempo_renta_actual,
      ultimo_empleo: solicitud.ultimo_empleo,
      experiencia_taxi: solicitud.experiencia_taxi || false,
      tiene_responsabilidad_familiar: solicitud.tiene_responsabilidad_familiar || false,
      
      // Referencias Familiares (NUEVOS CAMPOS)
      referencia_familiar_1_nombre: solicitud.referencia_familiar_1_nombre,
      referencia_familiar_1_telefono: solicitud.referencia_familiar_1_telefono,
      referencia_familiar_2_nombre: solicitud.referencia_familiar_2_nombre,
      referencia_familiar_2_telefono: solicitud.referencia_familiar_2_telefono,
      
      // Documentación (URLs)
      url_licencia_frente: solicitud.url_licencia_frente || null,
      url_licencia_reverso: solicitud.url_licencia_reverso || null,
      url_ine_frente: solicitud.url_ine_frente || null,
      url_ine_reverso: solicitud.url_ine_reverso || null,
      numero_de_ine_ife: solicitud.numero_de_ine_ife || null, // Asegurar que venga de algún lado o sea null
      
      // Plan de Carrera
      categoria: 'Oro',
      fecha_ingreso: new Date(),
      
      // Póliza Mecánica
      tipo_poliza: tipoPolizaPorDefecto,
      saldo_poliza_mecanica: saldoPolizaInicial,
      saldo_ahorro_mantenimiento: 0.00,
      total_aportado_poliza: 0.00,
      
      // Estado del Sistema
      status: 'Aprobado',
      status_trabajo: 'inactivo',
      metodo_registro: 'Portal_Solicitud',
      registrado_por: `Admin_ID_${adminId}`,
      
      // Fechas
      fecha_registro: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      
      // Datos Adicionales (Sobrescritura final)
      ...datosAdicionales
    };

    console.log('💾 Insertando conductor completo...');

    // 6️⃣ Insertar conductor
    const [conductor] = await trx(TABLES.CONDUCTORES)
      .insert(nuevoConductor)
      .returning('*');

    console.log('✅ Conductor creado. ID:', conductor.id);

    // 7️⃣ Eliminar la solicitud original (Limpieza automática)
    // Ya no la necesitamos porque toda la info se migró al conductor
    await trx(TABLES.SOLICITUDES_CONDUCTOR)
      .where('id', solicitudId)
      .delete();

    console.log('🗑️ Solicitud eliminada del inbox (Migración completada)');

    // 8️⃣ Commit de la transacción
    await trx.commit();
    console.log('🎉 Migración completada exitosamente');
    
    // Retornar datos
    return { 
      conductor: formatRecord(conductor),
      passwordTemporal: passwordTemporal 
    };

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error migrando solicitud a conductor:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

// ============ FUNCIONES DE UTILIDAD ============

/**
 * Verifica la conexión con PostgreSQL
 * @returns {boolean} true si la conexión es exitosa
 */
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

// ============ EXPORTAR TODO ============
module.exports = {
  // Configuración
  db,
  TABLES,
  
  // CRUD principal
  getAll,
  getById,
  create,
  update,
  deleteRecord,
  
  // Búsquedas específicas
  findUserByEmail,
  findConductorByEmail,
  getConductorById,
  getVehiculoById,
  
  // Funciones específicas para solicitudes
  getSolicitudesConPaginacion,
  findSolicitudByContacto,
  getEstadisticasSolicitudes,
  migrarSolicitudAConductor,
  
  // Utilidades
  testConnection,
  formatRecord
};