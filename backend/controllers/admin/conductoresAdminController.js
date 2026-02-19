// backend/controllers/admin/conductoresAdminController.js
const postgresService = require('../../services/postgresService');
const auditService = require('../../services/auditService');
const { validateConductor } = require('../../validators/conductorValidator');
const cloudinary = require('../../config/cloudinary');

const bcrypt = require('bcryptjs'); // <--- CAMBIO 1: Importamos BCRYPT

// Obtener db y TABLES
const { db, TABLES } = postgresService;

// <--- CAMBIO 2: Añadimos la función para generar passwords
/**
 * Genera un password temporal memorable
 * @returns {string} Password (ej: Conduc_a1b2c)
 */
const generateTempPassword = () => {
  const randomPart = Math.random().toString(36).substring(2, 7);
  return `Conduc_${randomPart}`;
};

/**
 * Genera o normaliza el correo del conductor. Si no existe, crea uno temporal
 * usando el número de teléfono (o un timestamp) para permitir el acceso al portal.
 */
const ensureConductorEmail = (data = {}, fallback = {}) => {
  const providedEmail = data.email?.toString().trim();
  if (providedEmail) {
    return providedEmail.toLowerCase();
  }

  const telefono =
    data.numero_telefono?.toString().trim() ||
    fallback.numero_telefono?.toString().trim() ||
    '';
  const sanitizedPhone = telefono.replace(/\D/g, '');
  const temporalLocalPart = sanitizedPhone || `conductor_${Date.now()}`;

  return `${temporalLocalPart}@driver.automanager.com`;
};

// ========== MAPEO DE CAMPOS ==========
const mapearCamposConductor = (data, options = {}) => {
  const { allowNull = false } = options;
  // ... (Tu código de mapeo sin cambios)
  const mapeo = {
    'NombreConductor': 'nombre_conductor',
    'NumeroTelefono': 'numero_telefono',
    'Email': 'email',
    'Matricula': 'matricula',
    'Status': 'status',
    'UbicacionActual': 'ubicacion_actual',
    'CalificacionPromedio': 'calificacion_promedio',
    'UltimaConexion': 'ultima_conexion',
    'LicenciaVencimiento': 'licencia_vencimiento',
    'SeguroVehiculoVencimiento': 'seguro_vehiculo_vencimiento',
    'VerificacionAntecedentes': 'verificacion_antecedentes',
    'SaldoGanancias': 'saldo_ganancias',
    'TasaAceptacion': 'tasa_aceptacion',
    'TasaCancelacion': 'tasa_cancelacion',
    'TasaCompletacion': 'tasa_completacion',
    'TipoVehiculo': 'tipo_vehiculo',
    'MaxPasajeros': 'max_pasajeros',
    'ChatIdTelegram': 'chat_id_telegram',
    'UsernameTelegram': 'username_telegram',
    'MetodoRegistro': 'metodo_registro',
    'FechaRegistro': 'fecha_registro',
    'StatusTrabajo': 'status_trabajo',
    'UltimaActivacion': 'ultima_activacion',
    'TotalActivacionesHoy': 'total_activaciones_hoy',
    'RegistradoPor': 'registrado_por',
    'BotConfigurado': 'bot_configurado',
    'PrimerMensajeBot': 'primer_mensaje_bot',
    'FotoFrenteLicenciaUrl': 'foto_frente_licencia_url',
    'FotoReversoLicenciaUrl': 'foto_reverso_licencia_url',
    'FechaFotoFrente': 'fecha_foto_frente',
    'FechaFotoReverso': 'fecha_foto_reverso',
    'TipoSocio': 'tipo_socio',
    'Rfc': 'rfc',
    'DireccionCompleta': 'direccion_completa',
    'ContactoEmergencia': 'contacto_emergencia',
    'Categoria': 'categoria',
    'NumeroIneIfe': 'numero_de_ine_ife',
    'LicenciaConducir': 'licencia_conducir',
    'LicenciaVigencia': 'licencia_vigencia',
    'FechaIngreso': 'fecha_ingreso',
    'FechaCategorizacion': 'fecha_categorizacion',
    'Observaciones': 'observaciones',
    'UsuarioId': 'usuario_id',
    'Deposito': 'deposito',
    'Curp': 'curp',
    'FechaNacimiento': 'fecha_nacimiento',
    'FechaUltimoAscenso': 'fecha_ultimo_ascenso',
    'UsaUniforme': 'usa_uniforme'
  };

  const resultado = {};
  for (const [key, value] of Object.entries(data)) {
    const campoPostgres = mapeo[key] || key.toLowerCase();
    if (value === '' || value === null || value === undefined) {
      if (allowNull && value !== undefined) {
        resultado[campoPostgres] = null;
      }
      continue;
    }
    resultado[campoPostgres] = value;
  }
  return resultado;
};

const mapearCamposRespuestaConductor = (record) => {
  if (!record) return null;
  
  return {
    id: record.id,
    nombre_conductor: record.nombre_conductor,
    numero_telefono: record.numero_telefono,
    email: record.email,
    matricula: record.matricula,
    status: record.status || 'Pendiente',
    ubicacion_actual: record.ubicacion_actual,
    calificacion_promedio: parseFloat(record.calificacion_promedio || 0),
    ultima_conexion: record.ultima_conexion,
    licencia_vencimiento: record.licencia_vencimiento,
    seguro_vehiculo_vencimiento: record.seguro_vehiculo_vencimiento,
    verificacion_antecedentes: record.verificacion_antecedentes || 'Pendiente',
    saldo_ganancias: parseFloat(record.saldo_ganancias || 0),
    tasa_aceptacion: parseFloat(record.tasa_aceptacion || 0),
    tasa_cancelacion: parseFloat(record.tasa_cancelacion || 0),
    tasa_completacion: parseFloat(record.tasa_completacion || 0),
    tipo_vehiculo: record.tipo_vehiculo,
    max_pasajeros: record.max_pasajeros || 4,
    chat_id_telegram: record.chat_id_telegram,
    username_telegram: record.username_telegram,
    metodo_registro: record.metodo_registro || 'manual',
    fecha_registro: record.fecha_registro,
    status_trabajo: record.status_trabajo || 'inactivo',
    ultima_activacion: record.ultima_activacion,
    total_activaciones_hoy: record.total_activaciones_hoy || 0,
    registrado_por: record.registrado_por,
    bot_configurado: record.bot_configurado || false,
    primer_mensaje_bot: record.primer_mensaje_bot,
    foto_frente_licencia_url: record.foto_frente_licencia_url,
    foto_reverso_licencia_url: record.foto_reverso_licencia_url,
    fecha_foto_frente: record.fecha_foto_frente,
    fecha_foto_reverso: record.fecha_foto_reverso,
    // 📄 URLs DE DOCUMENTOS (CLOUDINARY)
    url_ine_frente: record.url_ine_frente,
    url_ine_reverso: record.url_ine_reverso,
    url_licencia_frente: record.url_licencia_frente,
    url_licencia_reverso: record.url_licencia_reverso,
    url_comprobante_domicilio: record.url_comprobante_domicilio,
    // 🔥 CAMPOS DE CONFIGURACIÓN (ESTOS FALTABAN)
    tipo_socio: record.tipo_socio || '',
    zona_trabajo: record.zona_trabajo || '', // ← CRÍTICO
    horario_preferido: record.horario_preferido || '', // ← CRÍTICO
    
    rfc: record.rfc,
    direccion_completa: record.direccion_completa,
    contacto_emergencia: record.contacto_emergencia,
    categoria: record.categoria || 'Oro', // Cambiado de 'B' a 'Oro'
    numero_de_ine_ife: record.numero_de_ine_ife,
    licencia_conducir: record.licencia_conducir,
    licencia_vigencia: record.licencia_vigencia,
    fecha_ingreso: record.fecha_ingreso,
    fecha_categorizacion: record.fecha_categorizacion,
    observaciones: record.observaciones,
    usuario_id: record.usuario_id,
    deposito: parseFloat(record.deposito || 0),
    curp: record.curp,
    fecha_nacimiento: record.fecha_nacimiento,
    fecha_ultimo_ascenso: record.fecha_ultimo_ascenso,
    usa_uniforme: record.usa_uniforme || false,
    
    // 🔥 CAMPOS ADICIONALES QUE FALTABAN
    estado_civil: record.estado_civil || '',
    telefono_emergencia: record.telefono_emergencia || '',
    
    // Pólizas y ahorro
    saldo_poliza_mecanica: parseFloat(record.saldo_poliza_mecanica || 50000),
    total_aportado_poliza: parseFloat(record.total_aportado_poliza || 0),
    saldo_ahorro_mantenimiento: parseFloat(record.saldo_ahorro_mantenimiento || 0),
    tipo_poliza: record.tipo_poliza || 'POLIZA_100',
    saldo_billetera_digital: parseFloat(record.saldo_billetera_digital || 0),
    
    // URLs de documentos
    url_ine_frente: record.url_ine_frente || null,
    url_ine_reverso: record.url_ine_reverso || null,
    url_licencia_frente: record.url_licencia_frente || null,
    url_licencia_reverso: record.url_licencia_reverso || null,
    url_comprobante_domicilio: record.url_comprobante_domicilio || null,
    
    created_at: record.created_at,
    updated_at: record.updated_at,
    vehiculo_asignado: record.vehiculo_asignado || null
  };
};
// ========== OBTENER TODOS LOS CONDUCTORES ==========
exports.getConductores = async (req, res) => {
  // ... (Tu código sin cambios)
  try {
    const conductores = await db('conductores as c')
      .leftJoin('asignaciones as a', function() {
        this.on('c.id', '=', 'a.conductor_id')
            .andOn('a.activa', '=', db.raw('true'))
      })
      .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .select(
        'c.*',
        'v.id as vehiculo_id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'v.estado as estado_vehiculo',
        'a.renta_diaria',
        'a.abono_poliza_mantenimiento',
        'a.fecha_inicio as fecha_asignacion'
      )
      .where(function() {
        this.whereNull('c.status').orWhere('c.status', '<>', 'Eliminado');
      })
      .orderBy('c.nombre_conductor');
    
    if (conductores.length === 0) {
      return res.json({
        success: true,
        conductores: [],
        message: 'No hay conductores registrados en la base de datos'
      });
    }
    
    // Agrupar conductores con sus vehículos
    const conductoresMap = new Map();
    
    conductores.forEach(conductor => {
      const conductorId = conductor.id;
      
      if (!conductoresMap.has(conductorId)) {
        const conductorData = { ...conductor };
        delete conductorData.vehiculo_id;
        delete conductorData.numero_vehiculo;
        delete conductorData.marca;
        delete conductorData.modelo;
        delete conductorData.placa;
        delete conductorData.estado_vehiculo;
        delete conductorData.renta_diaria;
        delete conductorData.abono_poliza_mantenimiento;
        delete conductorData.fecha_asignacion;
        
        conductoresMap.set(conductorId, {
          ...mapearCamposRespuestaConductor(conductorData),
          vehiculos: []
        });
      }
      
      if (conductor.vehiculo_id) {
          conductoresMap.get(conductorId).vehiculos.push({
  id: conductor.vehiculo_id,
  numero_vehiculo: conductor.numero_vehiculo,  // ← CONSISTENTE
  marca: conductor.marca,
  modelo: conductor.modelo,
  placa: conductor.placa,
  estado: conductor.estado_vehiculo,
  renta_diaria: parseFloat(conductor.renta_diaria || 0),
  abono_poliza: parseFloat(conductor.abono_poliza_mantenimiento || 0),
  fecha_asignacion: conductor.fecha_asignacion
});
      }
    });
    
    const conductoresMapeados = Array.from(conductoresMap.values());
    
    res.json({
      success: true,
      conductores: conductoresMapeados,
      total: conductoresMapeados.length
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo conductores: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener conductores',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== OBTENER UN CONDUCTOR POR ID ==========
exports.getConductorById = async (req, res) => {
  // ... (Tu código sin cambios)
  try {
    const { id } = req.params;
    const conductorId = parseInt(id);
    
    if (isNaN(conductorId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de conductor inválido'
      });
    }
    
    // Obtener conductor con información completa
    const conductor = await db('conductores as c')
      .leftJoin('asignaciones as a', function() {
        this.on('c.id', '=', 'a.conductor_id')
            .andOn('a.activa', '=', db.raw('true'))
      })
      .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .leftJoin('usuarios as u', 'c.usuario_id', 'u.id')
      .select(
        'c.*',
        'v.id as vehiculo_id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'v.tipo_vehiculo as tipo_vehiculo_asignado',
        'v.estado as estado_vehiculo',
        'v.kilometraje_actual',
        'a.id as asignacion_id',
        'a.renta_diaria',
        'a.abono_poliza_mantenimiento',
        'a.fecha_inicio as fecha_asignacion',
        'a.url_contrato_digital',
        'u.email as usuario_email',
        'u.rol as usuario_rol'
      )
      .where('c.id', conductorId)
      .first();
    
    if (!conductor) {
      return res.status(404).json({ 
        success: false,
        error: `Conductor con ID ${conductorId} no encontrado`
      });
    }
    
    // Obtener estadísticas del conductor
    const [rentas, siniestros, calificaciones] = await Promise.all([
      db('rentas')
        .where('conductor_id', conductorId)
        .select(
          db.raw('COUNT(*) as total'),
          db.raw("COUNT(CASE WHEN estado = 'Pagada' THEN 1 END) as pagadas"),
          db.raw("COUNT(CASE WHEN estado = 'Pendiente' THEN 1 END) as pendientes"),
          db.raw("COUNT(CASE WHEN estado = 'Vencida' THEN 1 END) as vencidas"),
          db.raw('SUM(monto_total) as monto_total')
        )
        .first(),
      
      db('siniestros')
        .where('conductor_id', conductorId)
        .count('id as total')
        .first(),
      
      db('calificaciones')
        .where('conductor_id', conductorId)
        .select(
          db.raw('AVG(estrellas) as promedio'),

          db.raw('COUNT(*) as total')
        )
        .first()
    ]);
    
    // Mapear respuesta
    const conductorMapeado = mapearCamposRespuestaConductor(conductor);
    
   // Agregar información del vehículo asignado
if (conductor.vehiculo_id) {
  conductorMapeado.vehiculo_asignado = {
    id: conductor.vehiculo_id,
    asignacion_id: conductor.asignacion_id,
    numero_vehiculo: conductor.numero_vehiculo,
    marca: conductor.marca,
    modelo: conductor.modelo,
    placa: conductor.placa,
    tipo_vehiculo: conductor.tipo_vehiculo_asignado,
    estado: conductor.estado_vehiculo,
    kilometraje_actual: conductor.kilometraje_actual,
    renta_diaria: parseFloat(conductor.renta_diaria || 0),
    abono_poliza: parseFloat(conductor.abono_poliza_mantenimiento || 0),
    fecha_asignacion: conductor.fecha_asignacion,
    url_contrato: conductor.url_contrato_digital
  };
  
  // 🆕 AGREGAR TAMBIÉN EN FORMATO DE ARRAY (para el frontend)
  conductorMapeado.asignaciones = [
    {
      id: conductor.asignacion_id,
      activa: true,
      numero_vehiculo: conductor.numero_vehiculo,
      renta_diaria: parseFloat(conductor.renta_diaria || 400),
      abono_poliza_mantenimiento: parseFloat(conductor.abono_poliza_mantenimiento || 100),
      fecha_inicio: conductor.fecha_asignacion,
      vehiculo_id: conductor.vehiculo_id
    }
  ];
} else {
  // Si no tiene vehículo, devolver array vacío
  conductorMapeado.asignaciones = [];
}
    
    // Agregar estadísticas
    conductorMapeado.estadisticas = {
      rentas: {
        total: parseInt(rentas?.total || 0),
        pagadas: parseInt(rentas?.pagadas || 0),
        pendientes: parseInt(rentas?.pendientes || 0),
        vencidas: parseInt(rentas?.vencidas || 0),
        montoTotal: parseFloat(rentas?.monto_total || 0)
      },
      siniestros: {
        total: parseInt(siniestros?.total || 0)
      },
      calificaciones: {
        promedio: parseFloat(calificaciones?.promedio || 0),
        total: parseInt(calificaciones?.total || 0)
      }
    };
    
    // Información del usuario asociado
    if (conductor.usuario_id) {
      conductorMapeado.usuario_info = {
        id: conductor.usuario_id,
        email: conductor.usuario_email,
        rol: conductor.usuario_rol
      };
    }
    
    res.json({
      success: true,
      conductor: conductorMapeado
    });
    
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo conductor ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener el conductor',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== CREAR CONDUCTOR CON AUDITORÍA ==========
exports.createConductor = async (req, res) => {
  // ... (Tu código sin cambios)
  const trx = await db.transaction();
  
  try {
    const datosEntrada = {
      ...req.body,
      email: ensureConductorEmail(req.body)
    };

    // Validar datos con Joi
    const { error, value } = validateConductor(datosEntrada);
    if (error) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details
      });
    }
    
    // Establecer contexto de usuario para triggers
    await auditService.setUserContext(trx, req.user);
    
    const datosPostgres = mapearCamposConductor(value);
    
    // Verificar duplicados
    const existente = await trx('conductores')
      .where(function() {
        if (datosPostgres.email) {
          this.where('email', datosPostgres.email);
        }
        if (datosPostgres.numero_telefono) {
          this.orWhere('numero_telefono', datosPostgres.numero_telefono);
        }
        if (datosPostgres.numero_de_ine_ife) {
          this.orWhere('numero_de_ine_ife', datosPostgres.numero_de_ine_ife);
        }
        if (datosPostgres.curp) {
          this.orWhere('curp', datosPostgres.curp);
        }
        if (datosPostgres.rfc) {
          this.orWhere('rfc', datosPostgres.rfc);
        }
      })
      .first();
    
    if (existente) {
      await trx.rollback();
      let campo = 'email';
      if (existente.numero_telefono === datosPostgres.numero_telefono) campo = 'teléfono';
      if (existente.numero_de_ine_ife === datosPostgres.numero_de_ine_ife) campo = 'INE/IFE';
      if (existente.curp === datosPostgres.curp) campo = 'CURP';
      if (existente.rfc === datosPostgres.rfc) campo = 'RFC';
      
      return res.status(400).json({
        success: false,
        error: `Ya existe un conductor con ese ${campo}`
      });
    }
    // ✅ PROCESAR ARCHIVOS SI EXISTEN
if (req.files) {
  console.log('📤 Subiendo archivos a Cloudinary...');
  console.log('📎 Archivos detectados:', Object.keys(req.files));
  
  const archivosASubir = {
    ine_frente: 'url_ine_frente',
    ine_reverso: 'url_ine_reverso',
    licencia_frente: 'url_licencia_frente',
    licencia_reverso: 'url_licencia_reverso',
    comprobante_domicilio: 'url_comprobante_domicilio'
  };
  
  for (const [fieldName, dbColumn] of Object.entries(archivosASubir)) {
    if (req.files[fieldName]) {
      try {
        const file = req.files[fieldName];
        console.log(`📤 Subiendo ${fieldName}:`, file.name, `(${file.size} bytes)`);
        
        // Subir a Cloudinary
        const result = await cloudinary.uploader.upload(file.tempFilePath, {
          folder: `conductores/${datosPostgres.nombre_conductor || 'sin_nombre'}`,
          resource_type: 'auto',
          public_id: `${fieldName}_${Date.now()}`
        });
        
        datosPostgres[dbColumn] = result.secure_url;
        console.log(`✅ ${fieldName} subido exitosamente:`, result.secure_url);
      } catch (uploadError) {
        console.error(`❌ Error subiendo ${fieldName}:`, uploadError.message);
        // Continuar con otros archivos incluso si uno falla
      }
    }
  }
  
  console.log('📋 URLs generadas:', {
    url_ine_frente: datosPostgres.url_ine_frente || 'no subido',
    url_ine_reverso: datosPostgres.url_ine_reverso || 'no subido',
    url_licencia_frente: datosPostgres.url_licencia_frente || 'no subido',
    url_licencia_reverso: datosPostgres.url_licencia_reverso || 'no subido'
  });
} else {
  console.log('⚠️ No se detectaron archivos en req.files');
}
    
    // Establecer valores por defecto
    datosPostgres.status = datosPostgres.status || 'Pendiente';
    datosPostgres.status_trabajo = datosPostgres.status_trabajo || 'inactivo';
    datosPostgres.metodo_registro = datosPostgres.metodo_registro || 'manual';
    datosPostgres.fecha_registro = datosPostgres.fecha_registro || new Date();
    datosPostgres.fecha_ingreso = datosPostgres.fecha_ingreso || new Date();
    datosPostgres.registrado_por = req.user.email;
    datosPostgres.created_at = new Date();
    datosPostgres.updated_at = new Date();
    
    // Crear conductor
    const [nuevoConductor] = await trx(TABLES.CONDUCTORES)
      .insert(datosPostgres)
      .returning('*');
    
    // Si se especifica un usuario, crear el usuario también
    if (value.CrearUsuario && datosPostgres.email) {
      const [usuario] = await trx('usuarios')
        .insert({
          email: datosPostgres.email,
          password: value.Password || 'temporal123', // Debería ser hasheado
          nombre: datosPostgres.nombre_conductor,
          rol: 'conductor',
          estado_cuenta: 'Activo',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id');
      
      // Actualizar conductor con usuario_id
      await trx('conductores')
        .where('id', nuevoConductor.id)
        .update({ usuario_id: usuario.id });
      
      nuevoConductor.usuario_id = usuario.id;
    }
    
    await trx.commit();
    
    res.status(201).json({
      success: true,
      conductor: mapearCamposRespuestaConductor(nuevoConductor),
      message: 'Conductor creado exitosamente'
    });
    
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error creando conductor: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error al crear el conductor',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== ACTUALIZAR CONDUCTOR CON AUDITORÍA ==========
exports.updateConductor = async (req, res) => {
  // ... (Tu código sin cambios)
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    
    // Establecer contexto de usuario para triggers
    await auditService.setUserContext(trx, req.user);
    
    // Obtener datos anteriores para auditoría
    const conductorAnterior = await trx(TABLES.CONDUCTORES)
      .where('id', id)
      .first();
    
    if (!conductorAnterior) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }

    const datosEntrada = {
      ...req.body
    };
    
    if (!Object.prototype.hasOwnProperty.call(req.body, 'email')) {
      datosEntrada.email = ensureConductorEmail(req.body, conductorAnterior);
    }
    
    // Validar datos con Joi (parcial para actualización)
    const { error, value } = validateConductor(datosEntrada, true);
    if (error) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details
      });
    }
    
    const datosPostgres = mapearCamposConductor(value, { allowNull: true });

    // Normalizar chat_id_telegram: permitir limpiar a null y evitar duplicados
    if (Object.prototype.hasOwnProperty.call(datosPostgres, 'chat_id_telegram')) {
      const rawChatId = datosPostgres.chat_id_telegram;
      if (typeof rawChatId === 'string') {
        const normalized = rawChatId.trim();
        if (normalized === '' || normalized.toLowerCase() === 'null') {
          datosPostgres.chat_id_telegram = null;
        } else {
          datosPostgres.chat_id_telegram = normalized;
        }
      } else if (rawChatId === '') {
        datosPostgres.chat_id_telegram = null;
      }

      if (datosPostgres.chat_id_telegram) {
        const chatIdDuplicado = await trx('conductores')
          .where('id', '!=', id)
          .where('chat_id_telegram', datosPostgres.chat_id_telegram)
          .first();

        if (chatIdDuplicado) {
          datosPostgres.chat_id_telegram = null;
        }
      }
    }
    
    // Verificar duplicados (excepto el conductor actual)
    if (datosPostgres.email || datosPostgres.numero_telefono || 
        datosPostgres.numero_de_ine_ife || datosPostgres.curp || datosPostgres.rfc) {
      
      const existente = await trx('conductores')
        .where('id', '!=', id)
        .where(function() {
          if (datosPostgres.email) {
            this.where('email', datosPostgres.email);
          }
          if (datosPostgres.numero_telefono) {
            this.orWhere('numero_telefono', datosPostgres.numero_telefono);
          }
          if (datosPostgres.numero_de_ine_ife) {
            this.orWhere('numero_de_ine_ife', datosPostgres.numero_de_ine_ife);
          }
          if (datosPostgres.curp) {
            this.orWhere('curp', datosPostgres.curp);
          }
          if (datosPostgres.rfc) {
            this.orWhere('rfc', datosPostgres.rfc);
          }
        })
        .first();
      
      if (existente) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          error: 'Ya existe otro conductor con esos datos únicos'
        });
      }
    }
    
    datosPostgres.updated_at = new Date();
    
    const [conductorActualizado] = await trx(TABLES.CONDUCTORES)
      .where('id', id)
      .update(datosPostgres)
      .returning('*');
    
    // Registrar cambios críticos.
    const cambiosCriticos = [];
    
    if (conductorAnterior.status !== conductorActualizado.status) {
      cambiosCriticos.push(`Estado: ${conductorAnterior.status} → ${conductorActualizado.status}`);
    }
    if (conductorAnterior.categoria !== conductorActualizado.categoria) {
      cambiosCriticos.push(`Categoría: ${conductorAnterior.categoria} → ${conductorActualizado.categoria}`);
    }
    if (conductorAnterior.verificacion_antecedentes !== conductorActualizado.verificacion_antecedentes) {
      cambiosCriticos.push(`Verificación: ${conductorAnterior.verificacion_antecedentes} → ${conductorActualizado.verificacion_antecedentes}`);
    }
    
    if (cambiosCriticos.length > 0) {
      await auditService.logCriticalChange({
        usuario_id: req.user.id,
        tipo_cambio: 'actualizacion_conductor',
        descripcion: `Conductor ${conductorActualizado.nombre_conductor} actualizado: ${cambiosCriticos.join(', ')}`,
        datos_sensibles: {
          cambios: cambiosCriticos,
          datos_anteriores: conductorAnterior,
          datos_nuevos: conductorActualizado
        },
        ip_address: auditService.getClientIp(req)
      });
    }
    
    await trx.commit();
    
    res.json({
      success: true,
      conductor: mapearCamposRespuestaConductor(conductorActualizado),
      message: 'Conductor actualizado exitosamente'
    });
    
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error actualizando conductor ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error al actualizar el conductor',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== ELIMINAR CONDUCTOR CON AUDITORÍA ==========
// 1. MODIFICAMOS EL DELETE ACTUAL (Para pedir la baja o borrar directo)
exports.deleteConductor = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    // 1. BLINDAJE DE DATOS Y CONTEXTO
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        await trx.rollback();
        return res.status(400).json({ error: 'ID de conductor inválido' });
    }

    if (!req.user || !req.user.id) {
        await trx.rollback();
        return res.status(401).json({ error: 'Usuario no autenticado o sin ID válido' });
    }

    // Establecer contexto para que los Triggers de la BD no fallen (Error "invalid input syntax for type integer")
    await auditService.setUserContext(trx, req.user);

    const { rol } = req.user; 

    // 2. OBTENER DATOS DEL CONDUCTOR
    const conductor = await trx(TABLES.CONDUCTORES).where('id', id).first();
    
    if (!conductor) {
      await trx.rollback();
      return res.status(404).json({ success: false, error: 'Conductor no encontrado' });
    }

    // ==========================================
    // 🚦 LÓGICA 1: JEFE DE TALLER (SOLICITUD)
    // ==========================================
    if (rol === 'jefe_taller') {
          // Guardamos el estado actual para poder restaurarlo si se rechaza
          const estadoActual = conductor.status;

          // Actualizamos a 'Solicitud_baja'
          await trx(TABLES.CONDUCTORES)
              .where('id', id)
              .update({ 
                  status: 'Solicitud_baja',
                  updated_at: new Date()
              });

          // GUARDAMOS LA MEMORIA EN EL LOG DE AUDITORÍA
          await auditService.logCriticalChange({
              usuario_id: req.user.id,
              tipo_cambio: 'solicitud_baja_conductor', 
              descripcion: `Solicitud de baja para conductor ${conductor.nombre_conductor}`,
              datos_sensibles: { 
                  conductor_id: id,
                  nombre: conductor.nombre_conductor,
                  status_previo: estadoActual // <--- Aquí guardamos la memoria ("Activo", "Inactivo", etc.)
              },
              ip_address: auditService.getClientIp(req)
          });

          await trx.commit();
          return res.json({ success: true, message: 'Solicitud de baja enviada a Dirección' });
    }

    // ==========================================
    // 🗑️ LÓGICA 2: ADMINS (BORRADO REAL/APROBACIÓN)
    // ==========================================
    
    const statusNormalizado = (conductor.status || '').toString().trim().toLowerCase();
    
    // Permitimos borrar si está Inactivo, Rechazado, Suspendido O EN SOLICITUD
    const estadosPermitidos = new Set(['inactivo', 'rechazado', 'suspendido', 'solicitud_baja']);
    
    if (!estadosPermitidos.has(statusNormalizado)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El conductor debe estar Inactivo, Rechazado, Suspendido o en Solicitud de Baja.'
      });
    }
    
    // --- VALIDACIÓN DE RELACIONES ACTIVAS (Copiado de tu lógica original) ---
    const [asignaciones, rentas, siniestros] = await Promise.all([
        trx('asignaciones').where('conductor_id', id).where('activa', true).count('id as count').first(),
        trx('rentas').where('conductor_id', id).whereIn('estado', ['Pendiente', 'Vencida']).count('id as count').first(),
        trx('siniestros').where('conductor_id', id).whereNotIn('estado', ['Cerrado', 'Cancelado']).count('id as count').first()
    ]);
    
    const relacionesActivas = {
        asignaciones_activas: parseInt(asignaciones?.count || 0),
        rentas_pendientes: parseInt(rentas?.count || 0),
        siniestros_abiertos: parseInt(siniestros?.count || 0)
    };
    
    // Si hay deudas o siniestros, NO dejamos borrar
    if (relacionesActivas.rentas_pendientes > 0 || relacionesActivas.siniestros_abiertos > 0) {
        await trx.rollback();
        return res.status(400).json({
            success: false,
            error: 'No se puede eliminar: tiene rentas pendientes o siniestros abiertos.',
            relaciones: relacionesActivas
        });
    }
    
    // --- EJECUCIÓN DEL BORRADO ---

    // 1. Desactivar asignaciones históricas (Ahora sí es seguro hacerlo)
    // Nota: El 'setUserContext' del principio evitará que esto falle por el trigger
    await trx('asignaciones')
      .where('conductor_id', id)
      .update({ 
          activa: false, 
          fecha_fin: new Date(),
          updated_at: new Date()
      });
    
    // 2. Borrado lógico del conductor
    await trx(TABLES.CONDUCTORES)
      .where('id', id)
      .update({
        status: 'Eliminado',
        status_trabajo: 'inactivo',
        updated_at: new Date()
      });
    
    // 3. Desactivar usuario asociado (si existe)
    if (conductor.usuario_id) {
       await trx('usuarios')
           .where('id', conductor.usuario_id)
           .update({ 
               estado_cuenta: 'suspendido',
               updated_at: new Date()
           });
    }

    // 4. Registro final en auditoría
    await auditService.logCriticalChange({
       usuario_id: req.user.id,
       tipo_cambio: 'eliminacion_conductor',
       descripcion: `Conductor ${conductor.nombre_conductor} eliminado lógicamente`,
       datos_sensibles: { id, nombre: conductor.nombre_conductor },
       ip_address: auditService.getClientIp(req)
    });
    
    await trx.commit();
    res.json({ success: true, message: 'Conductor eliminado exitosamente' });
    
  } catch (error) {
    await trx.rollback();
    console.error("Error en deleteConductor:", error); // Log detallado para debug
    
    // Auditoría de error
    try {
        await auditService.logError({
            usuario_id: req.user?.id,
            nivel: 'critical',
            mensaje: `Error eliminando conductor ${req.params.id}: ${error.message}`,
            stack_trace: error.stack,
            ip_address: auditService.getClientIp(req),
            url: req.originalUrl,
            metodo_http: req.method
        });
    } catch(e) { /* Ignorar error de log */ }

    res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar el conductor',
        detalle: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// 2. NUEVA FUNCIÓN: GESTIONAR BAJA (Aprobar/Rechazar)
exports.gestionarBajaConductor = async (req, res) => {
    const { id } = req.params;
    const { accion } = req.body;

    // 1. SI ES APROBAR: Delegamos directo a deleteConductor (que ya está arreglado)
    // Lo ponemos al principio para no abrir transacciones innecesarias aquí
    if (accion === 'aprobar') {
        return exports.deleteConductor(req, res);
    }

    // 2. SI ES RECHAZAR: Necesitamos Transacción + Contexto para que no falle el Trigger
    const trx = await db.transaction();

    try {
        // --- 🛡️ BLINDAJE (LA SOLUCIÓN AL ERROR) ---
        if (!req.user || !req.user.id) {
            await trx.rollback();
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }
        // Esto evita el error: "invalid input syntax for type integer: «»"
        await auditService.setUserContext(trx, req.user);
        // ------------------------------------------

        // Validamos que el conductor existe
        const conductor = await trx(TABLES.CONDUCTORES).where('id', id).first();
        if (!conductor) {
            await trx.rollback();
            return res.status(404).json({ error: 'Conductor no encontrado' });
        }

        if (accion === 'rechazar') {
            let estadoRestaurado = 'Suspendido'; // Valor por defecto (seguridad)

            try {
                // 🔍 CONSULTA A critical_changes_log (Usamos trx para consistencia)
                const ultimoLog = await trx('critical_changes_log')
                    .where('tipo_cambio', 'solicitud_baja_conductor')
                    .whereRaw("datos_sensibles->>'conductor_id' = ?", [id])
                    .orderBy('id', 'desc')
                    .first();

                // Recuperamos el status_previo del JSON
                if (ultimoLog && ultimoLog.datos_sensibles) {
                    const datos = typeof ultimoLog.datos_sensibles === 'string' 
                        ? JSON.parse(ultimoLog.datos_sensibles) 
                        : ultimoLog.datos_sensibles;

                    if (datos.status_previo) {
                        estadoRestaurado = datos.status_previo;
                    }
                }
            } catch (error) {
                console.error('⚠️ No se pudo leer historial, usando default:', error);
            }

            // 📝 RESTAURAMOS EL ESTADO (Aquí era donde fallaba antes)
            await trx(TABLES.CONDUCTORES)
                .where('id', id)
                .update({ 
                    status: estadoRestaurado,
                    updated_at: new Date()
                });
            
            // Registramos el rechazo en auditoría también
            await auditService.logCriticalChange({
                usuario_id: req.user.id,
                tipo_cambio: 'rechazo_baja_conductor',
                descripcion: `Solicitud de baja rechazada para ${conductor.nombre_conductor}. Restaurado a ${estadoRestaurado}`,
                datos_sensibles: { id, estado_restaurado: estadoRestaurado },
                ip_address: auditService.getClientIp(req)
            });

            await trx.commit();
            
            return res.json({ 
                success: true, 
                message: `Solicitud rechazada. El conductor regresó al estado: ${estadoRestaurado}` 
            });
        }
        
        // Si la acción no es ni aprobar ni rechazar
        await trx.rollback();
        return res.status(400).json({ error: 'Acción no válida' });

    } catch (error) {
        await trx.rollback();
        console.error("Error en gestionarBajaConductor:", error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al procesar la solicitud',
            detalle: error.message 
        });
    }
};
// ========== ASIGNAR VEHICULO A CONDUCTOR ==========
exports.asignarVehiculo = async (req, res) => {
  const trx = await db.transaction();

  try {
    const { id } = req.params; // ID del conductor
    const { vehiculoId, rentaDiaria, abonoPoliza, fechaInicio, urlContrato } = req.body;

    await auditService.setUserContext(trx, req.user);

    const conductor = await trx('conductores')
      .where('id', id)
      .first();

    if (!conductor) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }

    const statusPermitidos = ['Aprobado', 'Activo', 'Inactivo'];
    if (!statusPermitidos.includes(conductor.status)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: `El conductor debe estar Aprobado, Activo o Inactivo para asignar un vehiculo. Status actual: ${conductor.status}`
      });
    }

    const vehiculo = await trx('vehiculos')
      .where('id', vehiculoId)
      .first();

    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Vehiculo no encontrado'
      });
    }

    const asignacionConductorActiva = await trx('asignaciones')
      .where('conductor_id', id)
      .where('activa', true)
      .first();

    const asignacionVehiculoActiva = await trx('asignaciones')
      .where('vehiculo_id', vehiculoId)
      .where('activa', true)
      .first();

    const vehiculoOcupadoPorOtro = asignacionVehiculoActiva && String(asignacionVehiculoActiva.conductor_id) !== String(id);
    if (vehiculo.estado !== 'Disponible' && vehiculoOcupadoPorOtro) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El vehiculo no esta disponible',
        estadoActual: vehiculo.estado
      });
    }

    await trx('asignaciones')
      .where('conductor_id', id)
      .where('activa', true)
      .update({
        activa: false,
        fecha_fin: new Date(),
        updated_at: new Date()
      });

    await trx('asignaciones')
      .where('vehiculo_id', vehiculoId)
      .where('activa', true)
      .update({
        activa: false,
        fecha_fin: new Date(),
        updated_at: new Date()
      });

    if (asignacionConductorActiva && String(asignacionConductorActiva.vehiculo_id) !== String(vehiculoId)) {
      await trx('vehiculos')
        .where('id', asignacionConductorActiva.vehiculo_id)
        .update({
          estado: 'Disponible',
          conductor_asignado_id: null,
          updated_at: new Date()
        });
    }

    if (asignacionVehiculoActiva && String(asignacionVehiculoActiva.conductor_id) !== String(id)) {
      await trx('conductores')
        .where('id', asignacionVehiculoActiva.conductor_id)
        .update({
          status: 'Inactivo',
          status_trabajo: 'inactivo',
          updated_at: new Date()
        });
    }

    const [nuevaAsignacion] = await trx('asignaciones')
      .insert({
        conductor_id: id,
        vehiculo_id: vehiculoId,
        fecha_inicio: fechaInicio || new Date(),
        renta_diaria: rentaDiaria || 400,
        abono_poliza_mantenimiento: abonoPoliza || 100,
        url_contrato_digital: urlContrato || null,
        activa: true,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    await trx('vehiculos')
      .where('id', vehiculoId)
      .update({
        estado: 'Asignado',
        conductor_asignado_id: id,
        updated_at: new Date()
      });

    await trx('conductores')
      .where('id', id)
      .update({
        status: 'Activo',
        status_trabajo: 'activo',
        updated_at: new Date()
      });

    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'asignacion_vehiculo_conductor',
      descripcion: `Vehiculo ${vehiculo.numero_vehiculo} asignado a conductor ${conductor.nombre_conductor}`,
      datos_sensibles: {
        conductor_id: id,
        vehiculo_id: vehiculoId,
        asignacion_id: nuevaAsignacion.id,
        renta_diaria: rentaDiaria,
        abono_poliza: abonoPoliza
      },
      ip_address: auditService.getClientIp(req)
    });

    await trx.commit();

    res.json({
      success: true,
      message: 'Vehiculo asignado exitosamente',
      asignacion: {
        id: nuevaAsignacion.id,
        conductor: conductor.nombre_conductor,
        vehiculo: vehiculo.numero_vehiculo,
        fechaInicio: nuevaAsignacion.fecha_inicio,
        rentaDiaria: nuevaAsignacion.renta_diaria,
        abonoPoliza: nuevaAsignacion.abono_poliza_mantenimiento
      }
    });

  } catch (error) {
    await trx.rollback();

    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error asignando vehiculo a conductor: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Error al asignar vehiculo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== DESASIGNAR VEHICULO DE CONDUCTOR ==========
exports.desasignarVehiculo = async (req, res) => {
  const trx = await db.transaction();

  try {
    const { id } = req.params; // ID del conductor

    await auditService.setUserContext(trx, req.user);

    const asignacion = await trx('asignaciones')
      .where('conductor_id', id)
      .where('activa', true)
      .first();

    if (!asignacion) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'El conductor no tiene vehiculo asignado'
      });
    }

    const [conductor, vehiculo] = await Promise.all([
      trx('conductores').where('id', id).first(),
      trx('vehiculos').where('id', asignacion.vehiculo_id).first()
    ]);

    await trx('asignaciones')
      .where('id', asignacion.id)
      .update({
        activa: false,
        fecha_fin: new Date(),
        updated_at: new Date()
      });

    await trx('vehiculos')
      .where('id', asignacion.vehiculo_id)
      .update({
        estado: 'Disponible',
        conductor_asignado_id: null,
        updated_at: new Date()
      });

    await trx('conductores')
      .where('id', id)
      .update({
        status: 'Inactivo',
        status_trabajo: 'inactivo',
        updated_at: new Date()
      });

    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'desasignacion_vehiculo_conductor',
      descripcion: `Vehiculo ${vehiculo.numero_vehiculo} desasignado de conductor ${conductor.nombre_conductor}`,
      datos_sensibles: {
        conductor_id: id,
        vehiculo_id: asignacion.vehiculo_id,
        asignacion_id: asignacion.id,
        fecha_fin: new Date()
      },
      ip_address: auditService.getClientIp(req)
    });

    await trx.commit();

    res.json({
      success: true,
      message: 'Vehiculo desasignado exitosamente'
    });

  } catch (error) {
    await trx.rollback();

    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error desasignando vehiculo de conductor: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    res.status(500).json({
      success: false,
      error: 'Error al desasignar vehiculo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== CAMBIAR STATUS DEL CONDUCTOR ==========
exports.cambiarStatus = async (req, res) => {
  // ... (Tu código sin cambios)
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { status, motivo } = req.body;
    
    await auditService.setUserContext(trx, req.user);
    
    const statusValidos = ['Pendiente', 'Aprobado', 'Rechazado', 'Suspendido'];
    if (!statusValidos.includes(status)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Status inválido',
        statusValidos
      });
    }
    
    const conductor = await trx('conductores')
      .where('id', id)
      .first();
    
    if (!conductor) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }
    
    const statusAnterior = conductor.status;
    
    // Actualizar status
    await trx('conductores')
      .where('id', id)
      .update({
        status,
        updated_at: new Date()
      });
    
    // Si es suspensión o rechazo, desactivar asignaciones
    if (status === 'Suspendido' || status === 'Rechazado') {
      await trx('asignaciones')
        .where('conductor_id', id)
        .where('activa', true)
        .update({
          activa: false,
          fecha_fin: new Date(),
          updated_at: new Date()
        });
      
      // Liberar vehículo si lo tenía
      await trx('vehiculos')
        .where('conductor_asignado_id', id)
        .update({
          estado: 'Disponible',
          conductor_asignado_id: null,
          updated_at: new Date()
        });
      
      // Suspender usuario si existe
      if (conductor.usuario_id) {
        await trx('usuarios')
          .where('id', conductor.usuario_id)
          .update({
            estado_cuenta: 'suspendido',
            updated_at: new Date()
          });
      }
    }
    
    // Si es aprobación, activar usuario
    if (status === 'Aprobado' && conductor.usuario_id) {
      await trx('usuarios')
        .where('id', conductor.usuario_id)
        .update({
          estado_cuenta: 'Activo',
          updated_at: new Date()
        });
    }
    
    // Registrar cambio crítico
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'cambio_status_conductor',
      descripcion: `Status de ${conductor.nombre_conductor} cambiado de ${statusAnterior} a ${status}`,
      datos_sensibles: {
        conductor_id: id,
        status_anterior: statusAnterior,
        status_nuevo: status,
        motivo
      },
      ip_address: auditService.getClientIp(req),
      requiere_revision: true
    });
    
    await trx.commit();
    
    res.json({
      success: true,
      message: `Status cambiado a ${status} exitosamente`
    });
    
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error cambiando status de conductor: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al cambiar status',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== OBTENER OPCIONES PARA FORMULARIOS ==========
exports.getOpcionesConductores = async (req, res) => {
  try {
    const opciones = {
      status: ['Pendiente', 'Aprobado', 'Rechazado', 'Suspendido'],
      statusTrabajo: ['activo', 'inactivo', 'ocupado'],
      verificacionAntecedentes: ['Pendiente', 'Aprobada', 'Rechazada', 'En Proceso'],
      
      // ✅ CORRECCIÓN: Categorías del Plan de Carrera Real
      categoria: [
        'Oro',          // Nivel inicial (Periodo de prueba)
        'Platino',      // Nivel intermedio
        'Diamante',     // Nivel avanzado
        'Socio Dueño'   // Nivel máximo (Con vehículo propio)
      ],
      
      tipoSocio: ['Empleado', 'Socio', 'Externo'],
      metodoRegistro: ['manual', 'telegram', 'whatsapp', 'web'],
      tipoVehiculo: ['Sedan', 'SUV', 'Pickup', 'Van', 'Hatchback', 'Compacto']
    };
    
    res.json({
      success: true,
      opciones
    });
    
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo opciones: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener opciones',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== OBTENER ESTADÍSTICAS DE CONDUCTORES ==========
exports.getEstadisticasConductores = async (req, res) => {
  // ... (Tu código sin cambios)
  try {
    const [estadisticas, top5Calificados, conMasRentas] = await Promise.all([
      // Estadísticas generales
      db('conductores')
        .select(
          db.raw('COUNT(*) as total'),
          db.raw("COUNT(CASE WHEN status = 'Aprobado' THEN 1 END) as aprobados"),
          db.raw("COUNT(CASE WHEN status = 'Pendiente' THEN 1 END) as pendientes"),
          db.raw("COUNT(CASE WHEN status = 'Rechazado' THEN 1 END) as rechazados"),
          db.raw("COUNT(CASE WHEN status = 'Suspendido' THEN 1 END) as suspendidos"),
          db.raw("COUNT(CASE WHEN status_trabajo = 'activo' THEN 1 END) as activos"),
          db.raw("COUNT(CASE WHEN bot_configurado = true THEN 1 END) as con_bot"),
          db.raw('AVG(calificacion_promedio) as calificacion_promedio_general')
        )
        .first(),
      
      // Top 5 mejor calificados
      db('conductores')
        .where('status', 'Aprobado')
        .whereNotNull('calificacion_promedio')
        .where('calificacion_promedio', '>', 0)
        .orderBy('calificacion_promedio', 'desc')
        .limit(5)
        .select('id', 'nombre_conductor', 'calificacion_promedio'),
      
      // Top 5 con más rentas pagadas
      db('conductores as c')
        .leftJoin('rentas as r', function() {
          this.on('c.id', '=', 'r.conductor_id')
              .andOn('r.estado', '=', db.raw("'Pagada'"))
        })
        .groupBy('c.id', 'c.nombre_conductor')
        .orderBy('total_rentas', 'desc')
        .limit(5)
        .select(
          'c.id',
          'c.nombre_conductor',
          db.raw('COUNT(r.id) as total_rentas'),
          db.raw('COALESCE(SUM(r.monto_total), 0) as monto_total_generado')
        )
    ]);
    
    // Conductores con vehículos asignados
    const conVehiculoAsignado = await db('asignaciones')
      .where('activa', true)
      .count('id as count')
      .first();
    
    res.json({
      success: true,
      estadisticas: {
        total: parseInt(estadisticas.total || 0),
        aprobados: parseInt(estadisticas.aprobados || 0),
        pendientes: parseInt(estadisticas.pendientes || 0),
        rechazados: parseInt(estadisticas.rechazados || 0),
        suspendidos: parseInt(estadisticas.suspendidos || 0),
        activos: parseInt(estadisticas.activos || 0),
        con_bot: parseInt(estadisticas.con_bot || 0),
        con_vehiculo: parseInt(conVehiculoAsignado?.count || 0),
        calificacion_promedio: parseFloat(estadisticas.calificacion_promedio_general || 0).toFixed(2)
      },
      rankings: {
        mejorCalificados: top5Calificados,
        masProductivos: conMasRentas
      }
    });
    
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo estadísticas de conductores: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== 🆕 OBTENER AMONESTACIONES DE UN CONDUCTOR ==========
exports.getAmonestaciones = async (req, res) => {
  // ... (Tu código sin cambios)
  try {
    const { id } = req.params;
    const conductorId = parseInt(id);
    
    if (isNaN(conductorId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de conductor inválido'
      });
    }
    
    // Verificar que el conductor existe
    const conductor = await db('conductores')
      .where('id', conductorId)
      .first();
    
    if (!conductor) {
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }
    
    // Obtener amonestaciones
    const amonestaciones = await db('amonestaciones_conductores as ac')
      .leftJoin('usuarios as u', 'ac.registrado_por_id', 'u.id')
      .where('ac.conductor_id', conductorId)
      .select(
        'ac.*',
        'u.nombre_completo as registrado_por_nombre_usuario',  // ✅ CORREGIDO
        'u.email as registrado_por_email'
      )
      .orderBy('ac.fecha', 'desc');
    
    // Mapear respuesta
    const amonestacionesMapeadas = amonestaciones.map(a => ({
      id: a.id,
      conductor_id: a.conductor_id,
      fecha: a.fecha,
      motivo: a.motivo,
      descripcion: a.descripcion,
      gravedad: a.gravedad,
      registrado_por: a.registrado_por_nombre || a.registrado_por_nombre_usuario,
      registrado_por_email: a.registrado_por_email,
      created_at: a.created_at
    }));
    
    res.json({
      success: true,
      conductor: {
        id: conductor.id,
        nombre: conductor.nombre_conductor,
        categoria: conductor.categoria
      },
      amonestaciones: amonestacionesMapeadas,
      total: amonestacionesMapeadas.length,
      limite_amonestaciones: 3
    });
    
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo amonestaciones del conductor ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener amonestaciones',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== 🆕 AGREGAR AMONESTACIÓN A CONDUCTOR ==========
exports.amonestar = async (req, res) => {
  // ... (Tu código sin cambios)
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { motivo, descripcion, gravedad } = req.body;
    
    if (!motivo || motivo.trim() === '') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El motivo de la amonestación es obligatorio'
      });
    }
    
    const gravedadValida = ['leve', 'moderada', 'grave'];
    const gravedadFinal = gravedad && gravedadValida.includes(gravedad) ? gravedad : 'leve';
    
    await auditService.setUserContext(trx, req.user);
    
    // Verificar que el conductor existe
    const conductor = await trx('conductores')
      .where('id', id)
      .first();
    
    if (!conductor) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }
    
    // Contar amonestaciones actuales
    const totalAmonestaciones = await trx('amonestaciones_conductores')
      .where('conductor_id', id)
      .count('id as count')
      .first();
    
    const total = parseInt(totalAmonestaciones?.count || 0);
    
    // Crear la amonestación
    const [nuevaAmonestacion] = await trx('amonestaciones_conductores')
      .insert({
        conductor_id: id,
        fecha: new Date(),
        motivo: motivo.trim(),
        descripcion: descripcion?.trim() || null,
        gravedad: gravedadFinal,
        registrado_por_id: req.user.id,
        registrado_por_nombre: req.user.nombre || req.user.email,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    // Si alcanza 3 amonestaciones, cambiar status a Suspendido
    if (total + 1 >= 3) {
      await trx('conductores')
        .where('id', id)
        .update({
          status: 'Suspendido',
          updated_at: new Date()
        });
      
      // Desactivar asignaciones activas
      await trx('asignaciones')
        .where('conductor_id', id)
        .where('activa', true)
        .update({
          activa: false,
          fecha_fin: new Date(),
          updated_at: new Date()
        });
      
      // Liberar vehículo
      await trx('vehiculos')
        .where('conductor_asignado_id', id)
        .update({
          estado: 'Disponible',
          conductor_asignado_id: null,
          updated_at: new Date()
        });
    }
    
    // Registrar cambio crítico
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'amonestacion_conductor',
      descripcion: `Amonestación ${gravedadFinal} registrada para ${conductor.nombre_conductor}: ${motivo}`,
      datos_sensibles: {
        conductor_id: id,
        amonestacion_id: nuevaAmonestacion.id,
        total_amonestaciones: total + 1,
        gravedad: gravedadFinal,
        suspendido: (total + 1 >= 3)
      },
      ip_address: auditService.getClientIp(req),
      requiere_revision: true
    });
    
    await trx.commit();
    
    res.status(201).json({
      success: true,
      message: total + 1 >= 3 
        ? 'Amonestación registrada. El conductor ha sido suspendido por alcanzar 3 amonestaciones.'
        : 'Amonestación registrada exitosamente',
      amonestacion: {
        id: nuevaAmonestacion.id,
        motivo: nuevaAmonestacion.motivo,
        gravedad: nuevaAmonestacion.gravedad,
        fecha: nuevaAmonestacion.fecha
      },
      total_amonestaciones: total + 1,
      suspendido: (total + 1 >= 3)
    });
    
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error amonestando conductor ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al registrar amonestación',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== 🆕 PROMOVER A SOCIO DUEÑO ==========
exports.promoverASocioDueno = async (req, res) => {
  // ... (Tu código sin cambios)
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    
    await auditService.setUserContext(trx, req.user);
    
    // Verificar conductor
    const conductor = await trx('conductores')
      .where('id', id)
      .first();
    
    if (!conductor) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }
    
    // Verificar que esté aprobado
    if (conductor.status !== 'Aprobado') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El conductor debe estar aprobado para ser promovido a Socio Dueño'
      });
    }
    
    // Verificar amonestaciones (no debe tener 3 o más)
    const totalAmonestaciones = await trx('amonestaciones_conductores')
      .where('conductor_id', id)
      .count('id as count')
      .first();
    
    const total = parseInt(totalAmonestaciones?.count || 0);
    
    if (total >= 3) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El conductor tiene 3 o más amonestaciones y no puede ser promovido'
      });
    }
    
    // Determinar siguiente categoría
const categoriaActual = conductor.categoria || 'Oro';
const mapaCategorias = {
  'B': 'Oro',
  'Oro': 'Platino',
  'Platino': 'Diamante',
  'Diamante': 'Socio Dueño',
  'Socio Dueño': 'Socio Dueño'
};

const nuevaCategoria = mapaCategorias[categoriaActual];

if (nuevaCategoria === categoriaActual) {
  await trx.rollback();
  return res.status(400).json({
    success: false,
    error: 'El conductor ya alcanzó la categoría máxima'
  });
}

// Actualizar categoría
const [conductorActualizado] = await trx('conductores')
  .where('id', id)
  .update({
    categoria: nuevaCategoria,
    fecha_ultimo_ascenso: new Date(),
    updated_at: new Date()
  })
  .returning('*');
    
    // OPCIONAL: Si tenía vehículo SA asignado, desasignarlo
    const asignacionActiva = await trx('asignaciones as a')
      .join('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .where('a.conductor_id', id)
      .where('a.activa', true)
      .where('v.tipo_socio', 'SA')
      .first();
    
    if (asignacionActiva) {
      await trx('asignaciones')
        .where('id', asignacionActiva.id)
        .update({
          activa: false,
          fecha_fin: new Date(),
          updated_at: new Date()
        });
      
      await trx('vehiculos')
        .where('id', asignacionActiva.vehiculo_id)
        .update({
          estado: 'Disponible',
          conductor_asignado_id: null,
          updated_at: new Date()
        });
    }
    
    // Registrar cambio crítico
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'promocion_socio_dueno',
      descripcion: `${conductor.nombre_conductor} promovido a Socio Dueño`,
      datos_sensibles: {
        conductor_id: id,
        categoria_anterior: conductor.categoria,
        categoria_nueva: 'Socio Dueño',
        vehiculo_sa_desasignado: !!asignacionActiva
      },
      ip_address: auditService.getClientIp(req),
      requiere_revision: true
    });
    
    await trx.commit();
    
    res.json({
      success: true,
      message: '¡Conductor promovido a Socio Dueño exitosamente!',
      conductor: {
        id: conductorActualizado.id,
        nombre: conductorActualizado.nombre_conductor,
        categoria: conductorActualizado.categoria,
        fecha_ultimo_ascenso: conductorActualizado.fecha_ultimo_ascenso
      },
      vehiculo_sa_desasignado: !!asignacionActiva
    });
    
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error promoviendo conductor ${req.params.id} a Socio Dueño: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al promover conductor',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== 🆕 AJUSTAR SALDO DE PÓLIZA MECÁNICA ==========
exports.ajustarPolizaMecanica = async (req, res) => {
  // ... (Tu código sin cambios)
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { monto, tipo_ajuste, motivo } = req.body;
    
    if (!monto || isNaN(parseFloat(monto))) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El monto del ajuste es obligatorio y debe ser numérico'
      });
    }
    
    const montoFinal = parseFloat(monto);
    
    if (montoFinal <= 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      });
    }
    
    const tiposValidos = ['descuento', 'recarga'];
    if (!tipo_ajuste || !tiposValidos.includes(tipo_ajuste)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Tipo de ajuste inválido. Debe ser "descuento" o "recarga"'
      });
    }
    
    await auditService.setUserContext(trx, req.user);
    
    // Verificar conductor
    const conductor = await trx('conductores')
      .where('id', id)
      .first();
    
    if (!conductor) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }
    
    const saldoActual = parseFloat(conductor.saldo_poliza_mecanica || 50000);
    let nuevoSaldo;
    
    if (tipo_ajuste === 'descuento') {
      nuevoSaldo = saldoActual - montoFinal;
      if (nuevoSaldo < 0) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          error: 'Saldo insuficiente en la póliza mecánica',
          saldo_actual: saldoActual,
          monto_solicitado: montoFinal
        });
      }
    } else {
      nuevoSaldo = saldoActual + montoFinal;
    }
    
    // Actualizar saldo
    await trx('conductores')
      .where('id', id)
      .update({
        saldo_poliza_mecanica: nuevoSaldo,
        updated_at: new Date()
      });
    
    // Registrar cambio crítico
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'ajuste_poliza_mecanica',
      descripcion: `Póliza mecánica ${tipo_ajuste === 'descuento' ? 'descontada' : 'recargada'} para ${conductor.nombre_conductor}: $${montoFinal.toFixed(2)}`,
      datos_sensibles: {
        conductor_id: id,
        tipo_ajuste,
        monto: montoFinal,
        saldo_anterior: saldoActual,
        saldo_nuevo: nuevoSaldo,
        motivo: motivo || 'Sin motivo especificado'
      },
      ip_address: auditService.getClientIp(req),
      requiere_revision: true
    });
    
    await trx.commit();
    
    res.json({
      success: true,
      message: `Póliza mecánica ${tipo_ajuste === 'descuento' ? 'descontada' : 'recargada'} exitosamente`,
      poliza: {
        saldo_anterior: saldoActual,
        monto_ajuste: montoFinal,
        tipo_ajuste,
        saldo_nuevo: nuevoSaldo
      }
    });
    
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error ajustando póliza mecánica del conductor ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al ajustar póliza mecánica',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// --- 👇 CAMBIO 3: AÑADIMOS LA NUEVA FUNCIÓN COMPLETA AQUÍ 👇 ---

/**
 * Crea una cuenta de acceso (usuario) para un conductor existente
 * POST /api/admin/conductores/:id/crear-acceso
 */
exports.crearAccesoConductor = async (req, res) => {
  const trx = await db.transaction();
  const { id } = req.params; // ID del Conductor

  try {
    // 1. Establecer contexto de auditoría
    await auditService.setUserContext(trx, req.user);

    // 2. Obtener el conductor
    const conductor = await trx(TABLES.CONDUCTORES).where('id', id).first();
    if (!conductor) {
      await trx.rollback();
      return res.status(404).json({ success: false, error: 'Conductor no encontrado' });
    }

    // 3. Verificar que no tenga ya una cuenta
    if (conductor.usuario_id) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'Este conductor ya tiene una cuenta de usuario vinculada.' });
    }

    // 4. Preparar y validar datos del nuevo usuario
    // Usar email del conductor o, si no existe, crear uno con el teléfono
    const email = (conductor.email || `${conductor.numero_telefono}@driver.automanager.com`).toLowerCase().trim();
    
    if (!email || email === '@driver.automanager.com') {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'El conductor no tiene un email o número de teléfono registrado para crear una cuenta.' });
    }

    // 5. Verificar que el email no esté en uso en la tabla USUARIOS
    const emailExistente = await trx(TABLES.USUARIOS).where('email', email).first();
    if (emailExistente) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: `El email '${email}' ya está en uso por otro usuario (ID: ${emailExistente.id}).` });
    }
    
    // 6. Generar contraseña temporal
    const passwordTemporal = generateTempPassword();
    const hashedPassword = await bcrypt.hash(passwordTemporal, 10);
    
    // 7. Crear el nuevo USUARIO
    const [nuevoUsuario] = await trx(TABLES.USUARIOS)
      .insert({
        name: conductor.nombre_conductor,
        email: email,
        password: hashedPassword,
        rol: 'conductor',
        estado: 'Activo',
        nombre_completo: conductor.nombre_conductor,
        fecha_registro: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // 8. Vincular el nuevo usuario al conductor
    await trx(TABLES.CONDUCTORES)
      .where('id', id)
      .update({
        usuario_id: nuevoUsuario.id,
        email: email, // Actualizamos el email del conductor por si no lo tenía
        updated_at: new Date()
      });

    // 9. Registrar en auditoría
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'creacion_acceso_conductor',
      descripcion: `Cuenta de acceso (login) creada para ${conductor.nombre_conductor}`,
      datos_sensibles: { 
        conductor_id: id, 
        nuevo_usuario_id: nuevoUsuario.id, 
        email_creado: email 
      },
      ip_address: auditService.getClientIp(req),
      requiere_revision: false // Es una acción administrativa normal
    });
    
    // 10. Confirmar transacción
    await trx.commit();

    // 11. Enviar respuesta exitosa al frontend
    res.status(201).json({
      success: true,
      message: 'Cuenta de acceso creada exitosamente.',
      email: email,
      password_temporal: passwordTemporal
    });

  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error creando acceso para conductor ${id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error al crear la cuenta de acceso',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


module.exports = exports;
