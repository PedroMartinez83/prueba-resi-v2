// backend/controllers/solicitudController.js
const { 
  create,
  getById,
  update,
  TABLES,
  getSolicitudesConPaginacion,
  findSolicitudByContacto,
  getEstadisticasSolicitudes,
  migrarSolicitudAConductor
} = require('../services/postgresService');

// ========== ENDPOINTS PÚBLICOS (Sin autenticación) ==========

/**
 * Crear nueva solicitud de conductor (PÚBLICO)
 * POST /api/solicitudes
 */
const crearSolicitud = async (req, res) => {
  console.log('🔵 Iniciando crearSolicitud');
  console.log('📦 Body recibido:', JSON.stringify(req.body, null, 2));
  console.log('📎 Archivos recibidos:', req.files);
  
  // Reconstruir el body desde el FormData
  if (req.body && Object.keys(req.body).length === 0 && req.files) {
    console.log('⚠️ Body vacío, pero hay archivos. Revisando campos...');
  }

  // Multer pone los campos de texto en req.body cuando usa FormData
  console.log('📝 Campos de texto completos:', req.body);
  console.log('🖼️ Archivos:', req.files ? Object.keys(req.files) : 'No hay archivos');
  
  try {
    const {
      // Paso 1: Contacto Inicial
      nombre_completo,
      telefono,
      email,
      
      // Paso 2: Información Personal y Residencial
      fecha_nacimiento,
      curp,
      domicilio,
      estado_civil,
      tiene_responsabilidad_familiar,
      
      // Paso 3: Estabilidad y Experiencia
      tipo_vivienda,
      tiempo_renta_actual,
      experiencia_taxi,
      ultimo_empleo,
      
      // Paso 4: Referencias Familiares
      referencia_familiar_1_nombre,
      referencia_familiar_1_telefono,
      referencia_familiar_1_cohabita,
      referencia_familiar_2_nombre,
      referencia_familiar_2_telefono,
    } = req.body;

    // Validaciones básicas obligatorias
    if (!nombre_completo || !telefono || !fecha_nacimiento || !curp || !domicilio) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios',
        required: ['nombre_completo', 'telefono', 'fecha_nacimiento', 'curp', 'domicilio']
      });
    }

    // Validar formato de teléfono (10 dígitos)
    const telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'El teléfono debe tener 10 dígitos'
      });
    }
    
const url_licencia_frente = req.files?.licencia_frente?.path || null;
const url_licencia_reverso = req.files?.licencia_reverso?.path || null;
const url_ine_frente = req.files?.ine_frente?.path || null;
const url_ine_reverso = req.files?.ine_reverso?.path || null;

    console.log('🌐 URLs de Cloudinary:', {
      url_licencia_frente,
      url_licencia_reverso,
      url_ine_frente,
      url_ine_reverso
    });

    // Validar CURP (18 caracteres)
    if (!curp || curp.length !== 18) {
      return res.status(400).json({
        success: false,
        message: 'El CURP debe tener exactamente 18 caracteres'
      });
    }

    // Verificar duplicados por teléfono o CURP
    const solicitudExistente = await findSolicitudByContacto(telefonoLimpio, email);
    if (solicitudExistente) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una solicitud con este teléfono o email',
        solicitud_id: solicitudExistente.id,
        estatus: solicitudExistente.estatus_solicitud
      });
    }

    // Validar edad mínima (18 años)
    const fechaNac = new Date(fecha_nacimiento);
    const edad = Math.floor((new Date() - fechaNac) / (365.25 * 24 * 60 * 60 * 1000));
    if (edad < 18) {
      return res.status(400).json({
        success: false,
        message: 'Debe ser mayor de 18 años para solicitar'
      });
    }

    // Validar estado civil
    const estadosCivilesValidos = ['Soltero', 'Casado', 'Unión Libre', 'Divorciado', 'Viudo'];
    if (estado_civil && !estadosCivilesValidos.includes(estado_civil)) {
      return res.status(400).json({
        success: false,
        message: 'Estado civil inválido',
        validos: estadosCivilesValidos
      });
    }

    // Validar tipo de vivienda
    const tiposViviendaValidos = ['Propia', 'Familiar', 'Rentada'];
    if (tipo_vivienda && !tiposViviendaValidos.includes(tipo_vivienda)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de vivienda inválido',
        validos: tiposViviendaValidos
      });
    }

    // Validar tiempo de renta si tipo_vivienda es 'Rentada'
    if (tipo_vivienda === 'Rentada') {
      const tiemposRentaValidos = ['Menos de 6 meses', '6 meses o más'];
      if (!tiempo_renta_actual || !tiemposRentaValidos.includes(tiempo_renta_actual)) {
        return res.status(400).json({
          success: false,
          message: 'Para vivienda rentada, debe especificar el tiempo en domicilio actual',
          validos: tiemposRentaValidos
        });
      }
    }

    // Crear la solicitud
    const nuevaSolicitud = {
      // Contacto
      nombre_completo: nombre_completo.trim(),
      telefono: telefonoLimpio,
      email: email ? email.trim().toLowerCase() : null,
      
      // Personal
      fecha_nacimiento: fechaNac,
      curp: curp.toUpperCase().trim(),
      domicilio: domicilio.trim(),
      estado_civil: estado_civil || 'Soltero',
      tiene_responsabilidad_familiar: tiene_responsabilidad_familiar === 'true' || tiene_responsabilidad_familiar === true,
      
      // Estabilidad
      tipo_vivienda: tipo_vivienda || 'Rentada',
      tiempo_renta_actual: tipo_vivienda === 'Rentada' ? tiempo_renta_actual : null,
      experiencia_taxi: experiencia_taxi === 'true' || experiencia_taxi === true,
      ultimo_empleo: ultimo_empleo ? ultimo_empleo.trim() : null,
      
      // Referencias
      referencia_familiar_1_nombre: referencia_familiar_1_nombre ? referencia_familiar_1_nombre.trim() : null,
      referencia_familiar_1_telefono: referencia_familiar_1_telefono ? referencia_familiar_1_telefono.replace(/\D/g, '') : null,
      referencia_familiar_1_cohabita: referencia_familiar_1_cohabita === 'true' || referencia_familiar_1_cohabita === true,
      referencia_familiar_2_nombre: referencia_familiar_2_nombre ? referencia_familiar_2_nombre.trim() : null,
      referencia_familiar_2_telefono: referencia_familiar_2_telefono ? referencia_familiar_2_telefono.replace(/\D/g, '') : null,
      
      // Documentación
      url_licencia_frente: url_licencia_frente || null,
      url_licencia_reverso: url_licencia_reverso || null,
      url_ine_frente: url_ine_frente || null,
      url_ine_reverso: url_ine_reverso || null,
      
      // Sistema
      deposito_garantia_pagado: false,
      estatus_solicitud: 'Pendiente',
      fecha_solicitud: new Date()
    };

    console.log('💾 Intentando crear con datos:', JSON.stringify(nuevaSolicitud, null, 2));
    console.log('📊 Tabla destino:', TABLES.SOLICITUDES_CONDUCTOR);
    
    const solicitud = await create(TABLES.SOLICITUDES_CONDUCTOR, nuevaSolicitud);
    
    console.log('✅ Solicitud creada:', solicitud);

    res.status(201).json({
      success: true,
      message: 'Solicitud creada exitosamente. Te contactaremos pronto.',
      solicitud: {
        id: solicitud.id,
        nombre_completo: solicitud.nombre_completo,
        telefono: solicitud.telefono,
        estatus_solicitud: solicitud.estatus_solicitud,
        fecha_solicitud: solicitud.fecha_solicitud
      }
    });

  } catch (error) {
    console.error('❌ Error completo en crearSolicitud:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor. Intenta más tarde.'
    });
  }
};

/**
 * Consultar estado de solicitud (PÚBLICO con teléfono)
 * GET /api/solicitudes/estado/:telefono
 */
const consultarEstadoSolicitud = async (req, res) => {
  try {
    const { telefono } = req.params;
    
    const telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono inválido'
      });
    }

    const solicitud = await findSolicitudByContacto(telefonoLimpio);
    
    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró ninguna solicitud con este teléfono'
      });
    }

    res.json({
      success: true,
      solicitud: {
        id: solicitud.id,
        nombre_completo: solicitud.nombre_completo,
        estatus_solicitud: solicitud.estatus_solicitud,
        fecha_solicitud: solicitud.fecha_solicitud
      }
    });

  } catch (error) {
    console.error('Error consultando estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar el estado'
    });
  }
};

// ========== ENDPOINTS ADMINISTRATIVOS (Con autenticación) ==========

/**
 * Listar solicitudes con filtros y paginación (ADMIN)
 * GET /api/admin/solicitudes
 */
const listarSolicitudes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      estatus = 'Todos',
      fecha_desde,
      fecha_hasta
    } = req.query;

    const filters = {};
    if (estatus !== 'Todos') filters.estatus = estatus;
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;

    const pagination = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 50)
    };

    const resultado = await getSolicitudesConPaginacion(filters, pagination);

    res.json({
      success: true,
      ...resultado
    });

  } catch (error) {
    console.error('Error listando solicitudes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes'
    });
  }
};

/**
 * Obtener solicitud específica con evaluación de criterios (ADMIN)
 * GET /api/admin/solicitudes/:id
 */
const obtenerSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    
    const solicitud = await getById(TABLES.SOLICITUDES_CONDUCTOR, id);
    
    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    // Evaluar criterios según documento v3.0
    const evaluacionCriterios = evaluarSeisRequisitos(solicitud);

    res.json({
      success: true,
      solicitud,
      evaluacion_criterios: evaluacionCriterios
    });

  } catch (error) {
    console.error('Error obteniendo solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la solicitud'
    });
  }
};

/**
 * Actualizar solicitud (ADMIN)
 * PUT /api/admin/solicitudes/:id
 */
const actualizarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      deposito_garantia_pagado,
      notas_revision
    } = req.body;

    const datosActualizacion = {
      admin_revisor_id: req.user.id
    };

    if (typeof deposito_garantia_pagado === 'boolean') {
      datosActualizacion.deposito_garantia_pagado = deposito_garantia_pagado;
    }
    
    if (notas_revision) {
      datosActualizacion.notas_revision = notas_revision;
    }

    const solicitudActualizada = await update(TABLES.SOLICITUDES_CONDUCTOR, id, datosActualizacion);

    res.json({
      success: true,
      message: 'Solicitud actualizada correctamente',
      solicitud: solicitudActualizada
    });

  } catch (error) {
    console.error('Error actualizando solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la solicitud'
    });
  }
};

/**
 * Actualizar estatus de solicitud (ADMIN)
 * PUT /api/admin/solicitudes/:id/estatus
 */
const actualizarEstatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estatus_solicitud, notas_revision } = req.body;

    const datosActualizacion = {
      estatus_solicitud,
      notas_revision,
      admin_revisor_id: req.user?.id || null,
      updated_at: new Date()
    };

    const solicitudActualizada = await update(
      TABLES.SOLICITUDES_CONDUCTOR, 
      id, 
      datosActualizacion
    );

    res.json({
      success: true,
      message: 'Estatus actualizado correctamente',
      solicitud: solicitudActualizada
    });

  } catch (error) {
    console.error('Error actualizando estatus:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el estatus'
    });
  }
};

/**
 * Calcular decisión final según algoritmo del documento v3.0 (ADMIN)
 * POST /api/admin/solicitudes/:id/calcular-decision
 */
const calcularDecisionFinal = async (req, res) => {
  try {
    const { id } = req.params;

    const solicitud = await getById(TABLES.SOLICITUDES_CONDUCTOR, id);
    
    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    if (solicitud.estatus_solicitud !== 'Pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden evaluar solicitudes pendientes'
      });
    }

    // Ejecutar algoritmo principal según documento v3.0
    const evaluacion = evaluarSeisRequisitos(solicitud);
    const decisionFinal = ejecutarAlgoritmoDecision(evaluacion);

    // Calcular puntaje numérico
    let puntaje = 0;
    if (evaluacion.cumple_edad) puntaje += 20;
    else if (evaluacion.edad >= 23) puntaje += 10;
    if (solicitud.experiencia_taxi) puntaje += 30;
    if (evaluacion.cumple_estabilidad_domicilio) puntaje += 25;
    else if (evaluacion.detalles.tipo_vivienda === 'Rentada') puntaje += 10;
    if (evaluacion.cumple_referencias) puntaje += 15;
    if (evaluacion.cumple_documentacion) puntaje += 10;

    // Actualizar el estatus con todos los campos del motor
    const datosActualizacion = {
      estatus_solicitud: decisionFinal.resultado,
      puntaje_motor: puntaje,
      decision_motor: decisionFinal.resultado,
      factores_evaluados: evaluacion,
      fecha_evaluacion: new Date(),
      admin_revisor_id: req.user.id,
      notas_revision: `Decisión automática: ${decisionFinal.razon}. Puntaje: ${puntaje}/100`
    };

    const solicitudActualizada = await update(TABLES.SOLICITUDES_CONDUCTOR, id, datosActualizacion);

    res.json({
      success: true,
      message: `Decisión calculada: ${decisionFinal.resultado}`,
      resultado: decisionFinal.resultado,
      razon: decisionFinal.razon,
      evaluacion_detallada: evaluacion,
      puntaje_total: puntaje,
      solicitud: solicitudActualizada
    });

  } catch (error) {
    console.error('Error calculando decisión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calcular la decisión'
    });
  }
};

/**
 * Migrar solicitud aprobada a conductor (ADMIN)
 * POST /api/admin/solicitudes/:id/migrar
 */
const migrarAConductor = async (req, res) => {
  try {
    const { id } = req.params;
const datos_adicionales = req.body?.datos_adicionales || {};

// ✅ AGREGAR ESTE LOG
console.log('🔍 Iniciando migración de solicitud ID:', id);
console.log('📋 Datos adicionales recibidos:', datos_adicionales);

    const solicitud = await getById(TABLES.SOLICITUDES_CONDUCTOR, id);
    console.log('📋 Solicitud obtenida:', solicitud ? `ID ${solicitud.id}` : 'No encontrada');

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    if (!['Aprobado', 'Aprobado (a prueba)'].includes(solicitud.estatus_solicitud)) {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden migrar solicitudes aprobadas'
      });
    }

    if (solicitud.conductor_id) {
      return res.status(400).json({
        success: false,
        message: 'Esta solicitud ya fue migrada a conductor'
      });
    }

    // Ahora capturamos el objeto completo que devuelve el servicio
    const { conductor, passwordTemporal } = await migrarSolicitudAConductor(id, req.user.id, datos_adicionales);

    res.json({
      success: true,
      message: 'Solicitud migrada exitosamente a conductor',
      password_temporal: passwordTemporal, // <--- AÑADIDO: Enviamos el password al admin
      conductor: {
        id: conductor.id,
        nombre_conductor: conductor.nombre_conductor,
        numero_telefono: conductor.numero_telefono,
        status: conductor.status,
        email: conductor.email // <-- AÑADIDO: Enviamos el email para más claridad
      }
    });

  } catch (error) {
    console.error('Error migrando solicitud:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al migrar la solicitud'
    });
  }
};

/**
 * Obtener estadísticas de solicitudes (ADMIN)
 * GET /api/admin/solicitudes/estadisticas
 */
const obtenerEstadisticas = async (req, res) => {
  try {
    const estadisticas = await getEstadisticasSolicitudes();

    res.json({
      success: true,
      estadisticas
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};

// ========== LÓGICA DE NEGOCIO SEGÚN DOCUMENTO V3.0 ==========

/**
 * Evalúa los 6 requisitos clave según la especificación del documento v3.0
 * @param {Object} solicitud - Datos de la solicitud
 * @returns {Object} Evaluación de cada criterio
 */
const evaluarSeisRequisitos = (solicitud) => {
  // Calcular edad
  const edad = Math.floor((new Date() - new Date(solicitud.fecha_nacimiento)) / (365.25 * 24 * 60 * 60 * 1000));

  // 1. cumple_edad: true si edad >= 25
  const cumple_edad = edad >= 25;

  // 2. cumple_responsabilidad_familiar: true si casado/unión libre O tiene responsabilidad familiar
  const cumple_responsabilidad_familiar = 
    ['Casado', 'Unión Libre'].includes(solicitud.estado_civil) || 
    solicitud.tiene_responsabilidad_familiar === true;

  // 3. cumple_estabilidad_domicilio: true si vivienda propia/familiar O renta >= 6 meses
  const cumple_estabilidad_domicilio = 
    ['Propia', 'Familiar'].includes(solicitud.tipo_vivienda) ||
    solicitud.tiempo_renta_actual === '6 meses o más';

  // 4. cumple_documentacion: true si todos los documentos están subidos
  const cumple_documentacion = 
    solicitud.url_licencia_frente && 
    solicitud.url_licencia_reverso && 
    solicitud.url_ine_frente && 
    solicitud.url_ine_reverso;

  // 5. cumple_referencias: true si tiene 2 referencias Y la primera cohabita
  const cumple_referencias = 
    solicitud.referencia_familiar_1_nombre && 
    solicitud.referencia_familiar_1_telefono &&
    solicitud.referencia_familiar_2_nombre && 
    solicitud.referencia_familiar_2_telefono &&
    solicitud.referencia_familiar_1_cohabita === true;

  // 6. cumple_deposito: true si depósito pagado
  const cumple_deposito = solicitud.deposito_garantia_pagado === true;

  return {
    edad,
    cumple_edad,
    cumple_responsabilidad_familiar,
    cumple_estabilidad_domicilio,
    cumple_documentacion,
    cumple_referencias,
    cumple_deposito,
    detalles: {
      estado_civil: solicitud.estado_civil,
      tiene_responsabilidad_familiar: solicitud.tiene_responsabilidad_familiar,
      tipo_vivienda: solicitud.tipo_vivienda,
      tiempo_renta_actual: solicitud.tiempo_renta_actual,
      documentos_completos: cumple_documentacion,
      referencias_completas: cumple_referencias,
      deposito_pagado: cumple_deposito
    }
  };
};

/**
 * Ejecuta el algoritmo de decisión final según documento v3.0
 * @param {Object} evaluacion - Resultado de evaluarSeisRequisitos
 * @returns {Object} Decisión final con resultado y razón
 */
const ejecutarAlgoritmoDecision = (evaluacion) => {
  const {
    edad,
    cumple_edad,
    cumple_responsabilidad_familiar,
    cumple_estabilidad_domicilio,
    cumple_documentacion,
    cumple_referencias,
    cumple_deposito
  } = evaluacion;

  // 1. Validar requisitos indispensables
  if (!cumple_documentacion || !cumple_referencias || !cumple_deposito) {
    let motivos = [];
    if (!cumple_documentacion) motivos.push('documentación incompleta');
    if (!cumple_referencias) motivos.push('referencias insuficientes');
    if (!cumple_deposito) motivos.push('depósito no pagado');
    
    return {
      resultado: 'Rechazado',
      razon: `Requisitos indispensables no cumplidos: ${motivos.join(', ')}`
    };
  }

  // 2. Evaluar escenario de Aprobación Directa
  if (cumple_edad && cumple_responsabilidad_familiar && cumple_estabilidad_domicilio) {
    return {
      resultado: 'Aprobado',
      razon: 'Cumple todos los criterios de aprobación directa'
    };
  }

  // 3. Evaluar excepción de edad para periodo de prueba
  if (edad >= 23 && edad < 25 && cumple_responsabilidad_familiar && cumple_estabilidad_domicilio) {
    return {
      resultado: 'Aprobado (a prueba)',
      razon: 'Edad entre 23-24 años con responsabilidad familiar y estabilidad domiciliar'
    };
  }

  // 4. Evaluar periodo de prueba por falta de un criterio de estabilidad
  if (cumple_edad && (!cumple_responsabilidad_familiar || !cumple_estabilidad_domicilio)) {
    let criterios_faltantes = [];
    if (!cumple_responsabilidad_familiar) criterios_faltantes.push('responsabilidad familiar');
    if (!cumple_estabilidad_domicilio) criterios_faltantes.push('estabilidad domiciliar');
    
    return {
      resultado: 'Aprobado (a prueba)',
      razon: `Edad adecuada pero falta: ${criterios_faltantes.join(', ')}`
    };
  }

  // 5. Si ninguna condición anterior se cumple
  return {
    resultado: 'Rechazado',
    razon: 'No cumple con los criterios mínimos de aprobación'
  };
};

module.exports = {
  // Endpoints públicos
  crearSolicitud,
  consultarEstadoSolicitud,
  
  // Endpoints administrativos
  listarSolicitudes,
  obtenerSolicitud,
  actualizarSolicitud,
  actualizarEstatus,
  calcularDecisionFinal,
  migrarAConductor,
  obtenerEstadisticas
};