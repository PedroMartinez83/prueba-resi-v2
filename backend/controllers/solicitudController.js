// backend/controllers/solicitudController.js
const { 
  db,
  create,
  getById,
  update,
  TABLES,
  getSolicitudesConPaginacion,
  findSolicitudByContacto,
  getEstadisticasSolicitudes,
  migrarSolicitudAConductor
} = require('../services/postgresService');
const { sendSolicitudCreadaNotification } = require('../utils/emailService');

const ROLES_CITAS_PERMITIDOS = new Set([
  'super_admin',
  'direccion',
  'director',
  'gerente_ops',
  'finanzas',
  'coordinador'
]);

const esFechaISOValida = (fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha);

const parseFechaLocal = (fechaISO) => {
  const [year, month, day] = fechaISO.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const normalizarBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'si', 'sÃ­', 'asistio', 'asistiÃ³'].includes(normalized)) return true;
  if (['false', '0', 'no', 'no_asistio', 'no_asistiÃ³'].includes(normalized)) return false;
  return null;
};

const tieneAccesoVistaCitas = (rol) => ROLES_CITAS_PERMITIDOS.has(String(rol || '').toLowerCase());

const normalizarTextoBase = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const normalizarTiempoRenta = (value) => {
  const texto = normalizarTextoBase(value);
  if (!texto) return null;
  if (texto.includes('menos') && texto.includes('6')) return 'Menos de 6 meses';
  if (texto.includes('6') && texto.includes('mas')) return '6 meses o más';
  return null;
};

const esTiempoRentaSuficiente = (value) => normalizarTiempoRenta(value) === '6 meses o más';
let solicitudComprobanteColumnChecked = false;

const ensureSolicitudComprobanteColumn = async () => {
  if (solicitudComprobanteColumnChecked) return;
  await db.raw(`
    ALTER TABLE solicitudes_conductor
    ADD COLUMN IF NOT EXISTS url_comprobante_domicilio TEXT
  `);
  solicitudComprobanteColumnChecked = true;
};

// ========== ENDPOINTS PÃšBLICOS (Sin autenticaciÃ³n) ==========

/**
 * Crear nueva solicitud de conductor (PÃšBLICO)
 * POST /api/solicitudes
 */
const crearSolicitud = async (req, res) => {
  console.log('ðŸ”µ Iniciando crearSolicitud');
  console.log('ðŸ“¦ Body recibido:', JSON.stringify(req.body, null, 2));
  console.log('ðŸ“Ž Archivos recibidos:', req.files);
  
  // Reconstruir el body desde el FormData
  if (req.body && Object.keys(req.body).length === 0 && req.files) {
    console.log('âš ï¸ Body vacÃ­o, pero hay archivos. Revisando campos...');
  }

  // Multer pone los campos de texto en req.body cuando usa FormData
  console.log('ðŸ“ Campos de texto completos:', req.body);
  console.log('ðŸ–¼ï¸ Archivos:', req.files ? Object.keys(req.files) : 'No hay archivos');
  
  try {
    const {
      // Paso 1: Contacto Inicial
      nombre_completo,
      telefono,
      email,
      
      // Paso 2: InformaciÃ³n Personal y Residencial
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
      acepta_deposito_garantia,
      deposito_garantia_pagado,
      fecha_cita,
      hora_cita
    } = req.body;

    const emailInput = String(email || '').trim();
    const fechaCitaInput = String(fecha_cita || '').trim();

    // Validaciones bÃ¡sicas obligatorias
    if (!nombre_completo || !telefono || !emailInput || !fecha_nacimiento || !domicilio || !fechaCitaInput) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios',
        required: ['nombre_completo', 'telefono', 'email', 'fecha_nacimiento', 'domicilio', 'fecha_cita']
      });
    }

    // Validar formato de telÃ©fono (10 dÃ­gitos)
    const telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'El telÃ©fono debe tener 10 dÃ­gitos'
      });
    }
    
    const url_licencia_frente = req.files?.licencia_frente?.path || null;
    const url_licencia_reverso = req.files?.licencia_reverso?.path || null;
    const url_ine_frente = req.files?.ine_frente?.path || null;
    const url_ine_reverso = req.files?.ine_reverso?.path || null;
    const url_comprobante_domicilio = req.files?.comprobante_domicilio?.path || null;

    if (!url_licencia_frente || !url_licencia_reverso || !url_ine_frente || !url_ine_reverso) {
      return res.status(400).json({
        success: false,
        message: 'Debes subir los documentos requeridos: licencia frente/reverso e INE frente/reverso'
      });
    }

    const aceptaDepositoGarantia = ['true', '1', 'si', 'sÃ­'].includes(
      String(acepta_deposito_garantia ?? '').toLowerCase().trim()
    );
    const depositoMarcado = ['true', '1', 'si', 'sÃ­'].includes(
      String(deposito_garantia_pagado ?? '').toLowerCase().trim()
    );
    const depositoGarantiaValor = aceptaDepositoGarantia || depositoMarcado;

    console.log('ðŸŒ URLs de Cloudinary:', {
      url_licencia_frente,
      url_licencia_reverso,
      url_ine_frente,
      url_ine_reverso,
      url_comprobante_domicilio
    });

    // Validar CURP (18 caracteres alfanumericos) solo si se proporciona
    if (curp && !/^[A-Za-z0-9]{18}$/.test(String(curp).trim())) {
      return res.status(400).json({
        success: false,
        message: 'El CURP debe tener exactamente 18 caracteres alfanumericos'
      });
    }

    const emailNormalizado = emailInput.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalizado)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de email inválido'
      });
    }

    const curpNormalizada = curp ? curp.toUpperCase().replace(/[^A-Z0-9]/g, '').trim() : null;
    const fechaCitaNormalizada = fechaCitaInput;
    const horaCitaNormalizada = hora_cita ? String(hora_cita).trim() : '13:00';

    if (fechaCitaNormalizada) {
      if (!esFechaISOValida(fechaCitaNormalizada)) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de cita debe tener formato YYYY-MM-DD'
        });
      }

      const fechaCita = parseFechaLocal(fechaCitaNormalizada);
      if (Number.isNaN(fechaCita.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Fecha de cita invÃ¡lida'
        });
      }

      const diaSemana = fechaCita.getDay();
      if (diaSemana === 0 || diaSemana === 6) {
        return res.status(400).json({
          success: false,
          message: 'Solo puedes agendar citas de lunes a viernes'
        });
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (fechaCita < hoy) {
        return res.status(400).json({
          success: false,
          message: 'No puedes agendar una fecha de cita en el pasado'
        });
      }
    }

    if (horaCitaNormalizada && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horaCitaNormalizada)) {
      return res.status(400).json({
        success: false,
        message: 'La hora de cita debe tener formato HH:mm'
      });
    }

    // Verificar si ya existe un conductor registrado con estos datos
    const conductorExistente = await db('conductores')
      .where(function() {
        this.where('numero_telefono', telefonoLimpio);
        if (emailNormalizado) {
          this.orWhere('email', emailNormalizado);
        }
        if (curpNormalizada) {
          this.orWhere('curp', curpNormalizada);
        }
      })
      .first();

    if (conductorExistente) {
      const statusActual = conductorExistente.status || 'Desconocido';
      const esAprobado = ['Aprobado', 'Activo'].includes(statusActual);
      return res.status(409).json({
        success: false,
        message: esAprobado
          ? 'Ya eres conductor aprobado y no puedes generar otra solicitud'
          : 'Ya existe un conductor registrado con estos datos',
        status: statusActual,
        conductor_id: conductorExistente.id
      });
    }

    // Verificar duplicados por telÃ©fono, email o CURP en solicitudes
    // Si la solicitud previa ya fue migrada, se conserva como histÃ³rico y no bloquea aquÃ­.
    const solicitudExistente = await findSolicitudByContacto(telefonoLimpio, emailNormalizado, curpNormalizada);
    if (solicitudExistente && solicitudExistente.estatus_solicitud !== 'Migrado') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una solicitud con este telÃ©fono, email o CURP',
        solicitud_id: solicitudExistente.id,
        estatus: solicitudExistente.estatus_solicitud
      });
    }

    // Validar telefonos de referencias familiares (10 digitos)
    const ref1TelefonoLimpio = referencia_familiar_1_telefono
      ? String(referencia_familiar_1_telefono).replace(/\D/g, '')
      : '';
    const ref2TelefonoLimpio = referencia_familiar_2_telefono
      ? String(referencia_familiar_2_telefono).replace(/\D/g, '')
      : '';

    if (!ref1TelefonoLimpio || ref1TelefonoLimpio.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'El telefono de la referencia familiar 1 debe tener 10 digitos numericos'
      });
    }

    if (!ref2TelefonoLimpio || ref2TelefonoLimpio.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'El telefono de la referencia familiar 2 debe tener 10 digitos numericos'
      });
    }

    // Validar edad mÃ­nima (18 aÃ±os)
    const fechaNac = new Date(fecha_nacimiento);
    const edad = Math.floor((new Date() - fechaNac) / (365.25 * 24 * 60 * 60 * 1000));
    if (edad < 18) {
      return res.status(400).json({
        success: false,
        message: 'Debe ser mayor de 18 aÃ±os para solicitar'
      });
    }

    // Validar estado civil
    const estadosCivilesValidos = ['Soltero', 'Casado', 'UniÃ³n Libre', 'Divorciado', 'Viudo'];
    if (estado_civil && !estadosCivilesValidos.includes(estado_civil)) {
      return res.status(400).json({
        success: false,
        message: 'Estado civil invÃ¡lido',
        validos: estadosCivilesValidos
      });
    }

    // Validar tipo de vivienda
    const tiposViviendaValidos = ['Propia', 'Familiar', 'Rentada'];
    if (tipo_vivienda && !tiposViviendaValidos.includes(tipo_vivienda)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de vivienda invÃ¡lido',
        validos: tiposViviendaValidos
      });
    }

    const tiempoRentaNormalizado = normalizarTiempoRenta(tiempo_renta_actual);

    // Validar tiempo de renta si tipo_vivienda es 'Rentada'
    if (tipo_vivienda === 'Rentada') {
      const tiemposRentaValidos = ['Menos de 6 meses', '6 meses o más'];
      if (!tiempoRentaNormalizado) {
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
      email: emailNormalizado,
      
      // Personal
      fecha_nacimiento: fechaNac,
      curp: curpNormalizada,
      domicilio: domicilio.trim(),
      estado_civil: estado_civil || 'Soltero',
      tiene_responsabilidad_familiar: tiene_responsabilidad_familiar === 'true' || tiene_responsabilidad_familiar === true,
      
      // Estabilidad
      tipo_vivienda: tipo_vivienda || 'Rentada',
      tiempo_renta_actual: tipo_vivienda === 'Rentada' ? tiempoRentaNormalizado : null,
      experiencia_taxi: experiencia_taxi === 'true' || experiencia_taxi === true,
      ultimo_empleo: ultimo_empleo ? ultimo_empleo.trim() : null,
      
      // Referencias
      referencia_familiar_1_nombre: referencia_familiar_1_nombre ? referencia_familiar_1_nombre.trim() : null,
      referencia_familiar_1_telefono: ref1TelefonoLimpio || null,
      referencia_familiar_1_cohabita: referencia_familiar_1_cohabita === 'true' || referencia_familiar_1_cohabita === true,
      referencia_familiar_2_nombre: referencia_familiar_2_nombre ? referencia_familiar_2_nombre.trim() : null,
      referencia_familiar_2_telefono: ref2TelefonoLimpio || null,
      
      // DocumentaciÃ³n
      url_licencia_frente: url_licencia_frente || null,
      url_licencia_reverso: url_licencia_reverso || null,
      url_ine_frente: url_ine_frente || null,
      url_ine_reverso: url_ine_reverso || null,
      url_comprobante_domicilio: url_comprobante_domicilio || null,
      
      // Sistema
      deposito_garantia_pagado: depositoGarantiaValor,
      fecha_cita: fechaCitaNormalizada,
      hora_cita: horaCitaNormalizada,
      asistio_cita: null,
      estatus_solicitud: 'Pendiente',
      fecha_solicitud: new Date()
    };

    console.log('ðŸ’¾ Intentando crear con datos:', JSON.stringify(nuevaSolicitud, null, 2));
    console.log('ðŸ“Š Tabla destino:', TABLES.SOLICITUDES_CONDUCTOR);

    await ensureSolicitudComprobanteColumn();

    const solicitud = await create(TABLES.SOLICITUDES_CONDUCTOR, nuevaSolicitud);
    
    console.log('âœ… Solicitud creada:', solicitud);

    // Notificacion por correo a roles superiores (no bloquea la respuesta del usuario)
    sendSolicitudCreadaNotification({
      solicitud: {
        id: solicitud.id,
        nombre_completo: solicitud.nombre_completo,
        telefono: solicitud.telefono,
        email: solicitud.email,
        curp: solicitud.curp,
        fecha_solicitud: solicitud.fecha_solicitud
      }
    }).catch((errorEmail) => {
      console.error('Error enviando notificacion de solicitud:', errorEmail);
    });

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
    console.error('âŒ Error completo en crearSolicitud:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor. Intenta mÃ¡s tarde.'
    });
  }
};

/**
 * Consultar estado de solicitud (PÃšBLICO con telÃ©fono)
 * GET /api/solicitudes/estado/:telefono
 */
const consultarEstadoSolicitud = async (req, res) => {
  try {
    const { telefono } = req.params;
    
    const telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'TelÃ©fono invÃ¡lido'
      });
    }

    const solicitud = await findSolicitudByContacto(telefonoLimpio);
    
    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'No se encontrÃ³ ninguna solicitud con este telÃ©fono'
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

// ========== ENDPOINTS ADMINISTRATIVOS (Con autenticaciÃ³n) ==========

/**
 * Listar solicitudes con filtros y paginaciÃ³n (ADMIN)
 * GET /api/admin/solicitudes
 */
const listarSolicitudes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      estatus = 'Todos',
      fecha_desde,
      fecha_hasta,
      incluir_migradas
    } = req.query;

    const filters = {};
    if (estatus !== 'Todos') filters.estatus = estatus;
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;
    if (normalizarBoolean(incluir_migradas) === true) filters.incluir_migradas = true;

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
 * Obtener solicitud especÃ­fica con evaluaciÃ³n de criterios (ADMIN)
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

    // Evaluar criterios segÃºn documento v3.0
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
 * Calcular decisiÃ³n final segÃºn algoritmo del documento v3.0 (ADMIN)
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

    // Ejecutar motor y resumen unificado para evitar discrepancias entre endpoints.
    const resultadoMotor = construirResultadoMotor(solicitud);
    const {
      decisionFinal,
      evaluacionConResumen,
      puntajeBase,
      puntajeFinal,
      notasRevision
    } = resultadoMotor;

    // Actualizar el estatus con todos los campos del motor
    const datosActualizacion = {
      estatus_solicitud: decisionFinal.resultado,
      puntaje_motor: puntajeFinal,
      decision_motor: decisionFinal.resultado,
      factores_evaluados: evaluacionConResumen,
      fecha_evaluacion: new Date(),
      admin_revisor_id: req.user.id,
      notas_revision: notasRevision
    };

    const solicitudActualizada = await update(TABLES.SOLICITUDES_CONDUCTOR, id, datosActualizacion);

    res.json({
      success: true,
      message: `Decision calculada: ${decisionFinal.resultado}`,
      resultado: decisionFinal.resultado,
      razon: decisionFinal.razon,
      evaluacion_detallada: evaluacionConResumen,
      puntaje_total: puntajeFinal,
      puntaje_base: puntajeBase,
      puntaje_final: puntajeFinal,
      solicitud: solicitudActualizada
    });

  } catch (error) {
    console.error('Error calculando decisiÃ³n:', error);
    res.status(500).json({
      success: false,
      message: 'Error al calcular la decisiÃ³n'
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

// âœ… AGREGAR ESTE LOG
console.log('ðŸ” Iniciando migraciÃ³n de solicitud ID:', id);
console.log('ðŸ“‹ Datos adicionales recibidos:', datos_adicionales);

    const solicitud = await getById(TABLES.SOLICITUDES_CONDUCTOR, id);
    console.log('ðŸ“‹ Solicitud obtenida:', solicitud ? `ID ${solicitud.id}` : 'No encontrada');

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

    if (!passwordTemporal) {
      console.warn('Migracion completada sin passwordTemporal en respuesta del servicio', {
        solicitudId: id,
        conductorId: conductor?.id
      });
    }

    res.json({
      success: true,
      message: 'Solicitud migrada exitosamente a conductor',
      password_temporal: passwordTemporal, // compatibilidad snake_case
      passwordTemporal, // compatibilidad camelCase
      conductor: {
        id: conductor.id,
        nombre_conductor: conductor.nombre_conductor,
        numero_telefono: conductor.numero_telefono,
        status: conductor.status,
        email: conductor.email // <-- AÃ‘ADIDO: Enviamos el email para mÃ¡s claridad
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
 * Obtener estadÃ­sticas de solicitudes (ADMIN)
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
    console.error('Error obteniendo estadÃ­sticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadÃ­sticas'
    });
  }
};

/**
 * Listar agenda de citas de solicitudes (ADMIN)
 * GET /api/admin/solicitudes/citas
 */
const listarCitasSolicitudes = async (req, res) => {
  try {
    const rolUsuario = req.user?.rol || req.user?.role;
    if (!tieneAccesoVistaCitas(rolUsuario)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para consultar la agenda de citas'
      });
    }

    const {
      fecha_desde,
      fecha_hasta,
      asistio = 'todos',
      page = 1,
      limit = 30
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 200);
    const offset = (pageNumber - 1) * limitNumber;

    let query = db(TABLES.SOLICITUDES_CONDUCTOR).whereNotNull('fecha_cita');
    let countQuery = db(TABLES.SOLICITUDES_CONDUCTOR).whereNotNull('fecha_cita');

    if (fecha_desde) {
      query = query.where('fecha_cita', '>=', fecha_desde);
      countQuery = countQuery.where('fecha_cita', '>=', fecha_desde);
    }

    if (fecha_hasta) {
      query = query.where('fecha_cita', '<=', fecha_hasta);
      countQuery = countQuery.where('fecha_cita', '<=', fecha_hasta);
    }

    if (asistio === 'pendiente') {
      query = query.whereNull('asistio_cita');
      countQuery = countQuery.whereNull('asistio_cita');
    } else {
      const asistioBool = normalizarBoolean(asistio);
      if (asistioBool !== null) {
        query = query.where('asistio_cita', asistioBool);
        countQuery = countQuery.where('asistio_cita', asistioBool);
      }
    }

    const [{ total }] = await countQuery.count('id as total');
    const totalRegistros = parseInt(total, 10) || 0;

    const citas = await query
      .select(
        'id',
        'nombre_completo',
        'telefono',
        'email',
        'estatus_solicitud',
        'fecha_solicitud',
        'fecha_cita',
        'hora_cita',
        'asistio_cita',
        'fecha_registro_asistencia',
        'observaciones_asistencia'
      )
      .orderBy('fecha_solicitud', 'desc')
      .orderBy('id', 'desc')
      .limit(limitNumber)
      .offset(offset);

    const hoy = new Date();
    const hoyISO = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0')
    ].join('-');

    const [totalCitas, asistieron, noAsistieron, pendientesAsistencia, citasHoy] = await Promise.all([
      db(TABLES.SOLICITUDES_CONDUCTOR).whereNotNull('fecha_cita').count('id as total').first(),
      db(TABLES.SOLICITUDES_CONDUCTOR).whereNotNull('fecha_cita').where('asistio_cita', true).count('id as total').first(),
      db(TABLES.SOLICITUDES_CONDUCTOR).whereNotNull('fecha_cita').where('asistio_cita', false).count('id as total').first(),
      db(TABLES.SOLICITUDES_CONDUCTOR).whereNotNull('fecha_cita').whereNull('asistio_cita').count('id as total').first(),
      db(TABLES.SOLICITUDES_CONDUCTOR).where('fecha_cita', hoyISO).count('id as total').first()
    ]);

    return res.json({
      success: true,
      citas,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalRegistros,
        totalPages: Math.ceil(totalRegistros / limitNumber),
        hasNext: pageNumber * limitNumber < totalRegistros,
        hasPrev: pageNumber > 1
      },
      resumen: {
        total_citas: parseInt(totalCitas?.total, 10) || 0,
        asistieron: parseInt(asistieron?.total, 10) || 0,
        no_asistieron: parseInt(noAsistieron?.total, 10) || 0,
        pendientes_asistencia: parseInt(pendientesAsistencia?.total, 10) || 0,
        citas_hoy: parseInt(citasHoy?.total, 10) || 0
      }
    });
  } catch (error) {
    console.error('Error listando citas de solicitudes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la agenda de citas'
    });
  }
};

/**
 * Registrar asistencia de cita para una solicitud (ADMIN)
 * PUT /api/admin/solicitudes/:id/asistencia-cita
 */
const registrarAsistenciaCita = async (req, res) => {
  try {
    const rolUsuario = req.user?.rol || req.user?.role;
    if (!tieneAccesoVistaCitas(rolUsuario)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para registrar asistencia de citas'
      });
    }

    const { id } = req.params;
    const { asistio_cita, observaciones_asistencia } = req.body;

    const asistioNormalizado = normalizarBoolean(asistio_cita);
    if (asistioNormalizado === null) {
      return res.status(400).json({
        success: false,
        message: 'Debes indicar si asistiÃ³ o no asistiÃ³ a la cita'
      });
    }

    const solicitud = await db(TABLES.SOLICITUDES_CONDUCTOR)
      .where('id', id)
      .first();
    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    if (!solicitud.fecha_cita) {
      return res.status(400).json({
        success: false,
        message: 'La solicitud no tiene una cita agendada'
      });
    }

    const datosActualizacion = {
      asistio_cita: asistioNormalizado,
      fecha_registro_asistencia: new Date(),
      observaciones_asistencia: observaciones_asistencia
        ? String(observaciones_asistencia).trim().slice(0, 500)
        : null,
      admin_revisor_id: req.user?.id || null
    };

    const solicitudActualizada = await update(TABLES.SOLICITUDES_CONDUCTOR, id, datosActualizacion);

    return res.json({
      success: true,
      message: asistioNormalizado
        ? 'Asistencia registrada correctamente'
        : 'Inasistencia registrada correctamente',
      solicitud: solicitudActualizada
    });
  } catch (error) {
    console.error('Error registrando asistencia de cita:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar la asistencia de la cita'
    });
  }
};

/**
 * Eliminar solicitud (ADMIN)
 * DELETE /api/admin/solicitudes/:id
 */
const eliminarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;

    const solicitud = await getById(TABLES.SOLICITUDES_CONDUCTOR, id);

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    await db(TABLES.SOLICITUDES_CONDUCTOR)
      .where('id', id)
      .del();

    // "data" se incluye para que auditoria pueda construir correo legible.
    return res.json({
      success: true,
      message: 'Solicitud eliminada correctamente',
      data: {
        id: solicitud.id,
        nombre_completo: solicitud.nombre_completo || null,
        email: solicitud.email || null
      }
    });
  } catch (error) {
    console.error('Error eliminando solicitud:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar la solicitud'
    });
  }
};

// ========== LÃ“GICA DE NEGOCIO SEGÃšN DOCUMENTO V3.0 ==========

/**
 * EvalÃºa los 6 requisitos clave segÃºn la especificaciÃ³n del documento v3.0
 * @param {Object} solicitud - Datos de la solicitud
 * @returns {Object} EvaluaciÃ³n de cada criterio
 */
const evaluarSeisRequisitos = (solicitud) => {
  // Calcular edad
  const edad = Math.floor((new Date() - new Date(solicitud.fecha_nacimiento)) / (365.25 * 24 * 60 * 60 * 1000));

  // 1. cumple_edad: true si edad >= 25
  const cumple_edad = edad >= 25;
  // ExcepciÃ³n de la tabla de decisiones: edad 23-24 entra a prueba (si cumple indispensables).
  const edad_en_rango_prueba = edad >= 23 && edad < 25;

  // 2. cumple_responsabilidad_familiar: true si casado/uniÃ³n libre O tiene responsabilidad familiar
  const cumple_responsabilidad_familiar = 
    ['Casado', 'UniÃ³n Libre'].includes(solicitud.estado_civil) || 
    solicitud.tiene_responsabilidad_familiar === true;

  // 3. cumple_estabilidad_domicilio: true si vivienda propia/familiar O renta >= 6 meses
  const cumple_estabilidad_domicilio = 
    ['Propia', 'Familiar'].includes(solicitud.tipo_vivienda) ||
    esTiempoRentaSuficiente(solicitud.tiempo_renta_actual);

  // 4. cumple_documentacion: true si todos los documentos estÃ¡n subidos
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

  // 6. cumple_deposito: true si el prospecto acepta/cubre el depÃ³sito en garantÃ­a
  const cumple_deposito = solicitud.deposito_garantia_pagado === true;

  return {
    edad,
    cumple_edad,
    edad_en_rango_prueba,
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
 * Ejecuta el algoritmo de decisiÃ³n final segÃºn documento v3.0
 * @param {Object} evaluacion - Resultado de evaluarSeisRequisitos
 * @returns {Object} DecisiÃ³n final con resultado y razÃ³n
 */
const ejecutarAlgoritmoDecision = (evaluacion) => {
  const {
    edad,
    cumple_edad,
    edad_en_rango_prueba,
    cumple_responsabilidad_familiar,
    cumple_estabilidad_domicilio,
    cumple_documentacion,
    cumple_referencias,
    cumple_deposito
  } = evaluacion;

  const motivosIndispensables = [];
  if (!cumple_documentacion) motivosIndispensables.push('documentacion incompleta');
  if (!cumple_referencias) motivosIndispensables.push('referencias insuficientes');
  if (!cumple_deposito) motivosIndispensables.push('deposito en garantia no aceptado');

  const cumpleIndispensables = motivosIndispensables.length === 0;
  const edadCritica = !cumple_edad && !edad_en_rango_prueba;

  // 1. Escenario critico tajante: sin estabilidad domiciliaria.
  if (!cumple_estabilidad_domicilio) {
    const razonIndispensables = !cumpleIndispensables
      ? `. Adicionalmente no reune indispensables: ${motivosIndispensables.join(', ')}`
      : '';
    return {
      resultado: 'Rechazado',
      razon: `No cumple estabilidad en domicilio (renta minima de 6 meses o vivienda propia/familiar)${razonIndispensables}`,
      rechazo_por_indispensables: false,
      motivos_indispensables: motivosIndispensables,
      alerta_indispensables: !cumpleIndispensables,
      rechazo_critico: true,
      escenario_matriz: 'RECHAZO_CRITICO_DOMICILIO'
    };
  }

  // 2. Escenario critico tajante: edad critica + sin responsabilidad familiar.
  if (edadCritica && !cumple_responsabilidad_familiar) {
    const razonIndispensables = !cumpleIndispensables
      ? `. Adicionalmente no reune indispensables: ${motivosIndispensables.join(', ')}`
      : '';
    return {
      resultado: 'Rechazado',
      razon: `No cumple criterio critico de edad y responsabilidad familiar (edad registrada: ${edad})${razonIndispensables}`,
      rechazo_por_indispensables: false,
      motivos_indispensables: motivosIndispensables,
      alerta_indispensables: !cumpleIndispensables,
      rechazo_critico: true,
      escenario_matriz: 'RECHAZO_CRITICO_EDAD_RESP'
    };
  }

  // 3. Aprobacion directa: cumple todo, incluyendo indispensables.
  if (cumple_edad && cumple_responsabilidad_familiar && cumpleIndispensables) {
    return {
      resultado: 'Aprobado',
      razon: 'Cumple todos los criterios de aprobacion directa',
      rechazo_por_indispensables: false,
      motivos_indispensables: [],
      alerta_indispensables: false,
      rechazo_critico: false,
      escenario_matriz: 'APROBADO_1_2_3_4_5_6'
    };
  }

  // 4. Estado por defecto acordado: Aprobado (a prueba), con alertas detalladas.
  const faltantesNoCriticos = [];
  if (!cumple_edad) {
    faltantesNoCriticos.push(
      edad_en_rango_prueba ? 'edad en rango 23-24 (seguimiento reforzado)' : 'edad menor a 25 anos'
    );
  }
  if (!cumple_responsabilidad_familiar) {
    faltantesNoCriticos.push('responsabilidad familiar');
  }

  const bloquesRazon = ['Estado por defecto: aprobado a prueba por 30 dias'];
  if (faltantesNoCriticos.length > 0) {
    bloquesRazon.push(`Aspectos a fortalecer: ${faltantesNoCriticos.join(', ')}`);
  }
  if (!cumpleIndispensables) {
    bloquesRazon.push(`No reune requisitos indispensables: ${motivosIndispensables.join(', ')}`);
  }

  const escenarioPrueba =
    !cumple_edad && !cumple_responsabilidad_familiar
      ? 'PRUEBA_3_CON_ALERTAS'
      : !cumple_edad && cumple_responsabilidad_familiar
        ? (edad_en_rango_prueba ? 'PRUEBA_2_EDAD_23_24' : 'PRUEBA_2_EDAD_BAJA')
        : cumple_edad && !cumple_responsabilidad_familiar
          ? 'PRUEBA_1_SIN_RESPONSABILIDAD'
          : !cumpleIndispensables
            ? 'PRUEBA_ALERTA_INDISPENSABLES'
            : 'PRUEBA_GENERAL';

  return {
    resultado: 'Aprobado (a prueba)',
    razon: bloquesRazon.join('. '),
    rechazo_por_indispensables: false,
    motivos_indispensables: motivosIndispensables,
    alerta_indispensables: !cumpleIndispensables,
    rechazo_critico: false,
    escenario_matriz: escenarioPrueba
  };
};

const construirResultadoMotor = (solicitud) => {
  const evaluacion = evaluarSeisRequisitos(solicitud);
  const decisionFinal = ejecutarAlgoritmoDecision(evaluacion);

  // Puntaje base (sin indispensables) y final (con indispensables)
  let puntajeBase = 0; // Max 60
  if (evaluacion.cumple_edad) puntajeBase += 20;
  else if (evaluacion.edad_en_rango_prueba) puntajeBase += 10;
  if (evaluacion.cumple_responsabilidad_familiar) puntajeBase += 20;
  if (evaluacion.cumple_estabilidad_domicilio) puntajeBase += 20;

  let puntajeIndispensables = 0; // Max 40
  if (evaluacion.cumple_documentacion) puntajeIndispensables += 15;
  if (evaluacion.cumple_referencias) puntajeIndispensables += 15;
  if (evaluacion.cumple_deposito) puntajeIndispensables += 10;

  const puntajeFinalPreliminar = puntajeBase + puntajeIndispensables;

  const tieneExperienciaTaxi =
    solicitud.experiencia_taxi === true ||
    solicitud.experiencia_taxi === 'true' ||
    solicitud.experiencia_taxi === 1 ||
    solicitud.experiencia_taxi === '1';

  const desgloseFactores = [
    {
      clave: 'edad',
      nombre: 'Edad adecuada',
      peso: 20,
      valor: evaluacion.cumple_edad ? 20 : evaluacion.edad_en_rango_prueba ? 10 : 0,
      cumple: evaluacion.cumple_edad || evaluacion.edad_en_rango_prueba
    },
    {
      clave: 'responsabilidad_familiar',
      nombre: 'Responsabilidad familiar',
      peso: 20,
      valor: evaluacion.cumple_responsabilidad_familiar ? 20 : 0,
      cumple: evaluacion.cumple_responsabilidad_familiar
    },
    {
      clave: 'estabilidad_domicilio',
      nombre: 'Vivienda estable',
      peso: 20,
      valor: evaluacion.cumple_estabilidad_domicilio ? 20 : 0,
      cumple: evaluacion.cumple_estabilidad_domicilio
    },
    {
      clave: 'documentacion',
      nombre: 'Documentos validos',
      peso: 15,
      valor: evaluacion.cumple_documentacion ? 15 : 0,
      cumple: evaluacion.cumple_documentacion
    },
    {
      clave: 'referencias',
      nombre: 'Referencias completas',
      peso: 15,
      valor: evaluacion.cumple_referencias ? 15 : 0,
      cumple: evaluacion.cumple_referencias
    },
    {
      clave: 'deposito_garantia',
      nombre: 'Deposito en garantia',
      peso: 10,
      valor: evaluacion.cumple_deposito ? 10 : 0,
      cumple: evaluacion.cumple_deposito
    },
    {
      clave: 'experiencia_taxi',
      nombre: 'Experiencia taxi',
      peso: 0,
      valor: 0,
      cumple: tieneExperienciaTaxi,
      es_informativo: true
    }
  ];

  const rechazoPorIndispensables = decisionFinal.rechazo_por_indispensables === true;
  const rechazoCritico = decisionFinal.rechazo_critico === true;
  const alertaIndispensables = decisionFinal.alerta_indispensables === true;
  const puntajeFinal = rechazoCritico
    ? Math.min(puntajeFinalPreliminar, 59)
    : puntajeFinalPreliminar;

  const observacionesMotor = [];
  if (decisionFinal.resultado !== 'Aprobado' && decisionFinal.razon) {
    observacionesMotor.push(decisionFinal.razon);
  }

  const evaluacionConResumen = {
    ...evaluacion,
    puntaje_base: puntajeBase,
    puntaje_indispensables: puntajeIndispensables,
    puntaje_final: puntajeFinal,
    rechazo_por_indispensables: rechazoPorIndispensables,
    alerta_indispensables: alertaIndispensables,
    rechazo_critico: rechazoCritico,
    motivos_indispensables: decisionFinal.motivos_indispensables || [],
    escenario_matriz: decisionFinal.escenario_matriz || 'NO_IDENTIFICADO',
    escala_puntaje_base: 60,
    escala_puntaje_final: 100,
    modelo_puntaje: 'MOTOR_V4_BASE_FINAL_ALERTAS',
    desglose_factores: desgloseFactores,
    observaciones: observacionesMotor
  };

  let notasRevision = `Decision automatica: ${decisionFinal.razon}. Puntaje base: ${puntajeBase}/60. Puntaje final: ${puntajeFinal}/100.`;
  if (rechazoCritico && puntajeFinalPreliminar !== puntajeFinal) {
    notasRevision += ` Ajuste critico aplicado al puntaje final (preliminar: ${puntajeFinalPreliminar}/100).`;
  }

  return {
    evaluacion,
    decisionFinal,
    evaluacionConResumen,
    puntajeBase,
    puntajeFinal,
    puntajeIndispensables,
    puntajeFinalPreliminar,
    notasRevision
  };
};

/**
 * Recalcular motor para solicitudes historicas (ADMIN)
 * POST /api/admin/solicitudes/recalcular-motor-historico
 */
const recalcularMotorHistorico = async (req, res) => {
  try {
    const dryRunRaw = req.body?.dry_run ?? req.query?.dry_run;
    const incluirMigradasRaw = req.body?.incluir_migradas ?? req.query?.incluir_migradas;
    const sincronizarEstatusRaw = req.body?.sincronizar_estatus ?? req.query?.sincronizar_estatus;
    const limitRaw = req.body?.limit ?? req.query?.limit;

    const dryRun = normalizarBoolean(dryRunRaw) !== false; // default true
    const incluirMigradas = normalizarBoolean(incluirMigradasRaw) === true; // default false
    const sincronizarEstatus = normalizarBoolean(sincronizarEstatusRaw) !== false; // default true
    const limit = Math.max(1, Math.min(parseInt(limitRaw, 10) || 500, 2000));

    const estatusObjetivo = ['Pendiente', 'Rechazado', 'Aprobado', 'Aprobado (a prueba)'];
    if (incluirMigradas) estatusObjetivo.push('Migrado');

    const solicitudes = await db(TABLES.SOLICITUDES_CONDUCTOR)
      .whereIn('estatus_solicitud', estatusObjetivo)
      .orderBy('id', 'asc')
      .limit(limit);

    const resumen = {
      dry_run: dryRun,
      limit,
      total_encontradas: solicitudes.length,
      procesadas: 0,
      actualizadas: 0,
      cambios_estatus: 0,
      por_resultado: {
        Aprobado: 0,
        'Aprobado (a prueba)': 0,
        Rechazado: 0
      },
      muestra: []
    };

    for (const solicitud of solicitudes) {
      const resultadoMotor = construirResultadoMotor(solicitud);
      const nuevoResultado = resultadoMotor.decisionFinal.resultado;

      resumen.procesadas += 1;
      if (resumen.por_resultado[nuevoResultado] !== undefined) {
        resumen.por_resultado[nuevoResultado] += 1;
      }

      const registroMuestra = {
        id: solicitud.id,
        estatus_anterior: solicitud.estatus_solicitud,
        resultado_motor: nuevoResultado,
        puntaje_base: resultadoMotor.puntajeBase,
        puntaje_final: resultadoMotor.puntajeFinal
      };
      if (resumen.muestra.length < 20) {
        resumen.muestra.push(registroMuestra);
      }

      if (dryRun) {
        continue;
      }

      const datosActualizacion = {
        puntaje_motor: resultadoMotor.puntajeFinal,
        decision_motor: nuevoResultado,
        factores_evaluados: resultadoMotor.evaluacionConResumen,
        fecha_evaluacion: new Date(),
        admin_revisor_id: req.user?.id || null,
        notas_revision: resultadoMotor.notasRevision,
        updated_at: new Date()
      };

      if (sincronizarEstatus && solicitud.estatus_solicitud !== 'Migrado') {
        datosActualizacion.estatus_solicitud = nuevoResultado;
        if (solicitud.estatus_solicitud !== nuevoResultado) {
          resumen.cambios_estatus += 1;
        }
      }

      await db(TABLES.SOLICITUDES_CONDUCTOR)
        .where('id', solicitud.id)
        .update(datosActualizacion);

      resumen.actualizadas += 1;
    }

    return res.json({
      success: true,
      message: dryRun
        ? 'Dry run completado: no se aplicaron cambios en BD'
        : 'Recalculo historico completado',
      resumen
    });
  } catch (error) {
    console.error('Error recalculando motor historico:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al recalcular el motor historico'
    });
  }
};

module.exports = {
  // Endpoints pÃºblicos
  crearSolicitud,
  consultarEstadoSolicitud,
  
  // Endpoints administrativos
  listarSolicitudes,
  obtenerSolicitud,
  actualizarSolicitud,
  actualizarEstatus,
  calcularDecisionFinal,
  migrarAConductor,
  obtenerEstadisticas,
  listarCitasSolicitudes,
  registrarAsistenciaCita,
  eliminarSolicitud,
  recalcularMotorHistorico
};

