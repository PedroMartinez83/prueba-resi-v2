// backend/controllers/inversionistasController.js
const postgresService = require('../services/postgresService');
const bcrypt = require('bcryptjs');
const { TABLES, db } = postgresService;

// ========== OBTENER TODOS LOS INVERSIONISTAS ==========
exports.getInversionistas = async (req, res) => {
  try {
    console.log('📋 Obteniendo inversionistas...');
    
    const query = `
      SELECT 
        i.*,
        COUNT(DISTINCT iv.id_inversion) as total_inversiones,
        SUM(iv.inversion) as monto_total_invertido,
        COUNT(DISTINCT CASE WHEN iv.status_inversion = 'Activa' THEN iv.id_inversion END) as inversiones_activas
      FROM inversionistas i
      LEFT JOIN inversiones_vehiculos iv ON i.id = iv.inversionista_id
      GROUP BY i.id
      ORDER BY i.nombre
    `;
    
    const result = await db.raw(query);
    const inversionistas = result.rows;
    
    res.json({
      success: true,
      inversionistas
    });
  } catch (error) {
    console.error('❌ Error obteniendo inversionistas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener inversionistas',
      message: error.message
    });
  }
};

// ========== OBTENER UN INVERSIONISTA POR ID ==========
exports.getInversionistaById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Buscando inversionista ID:', id);
    
    // Obtener datos del inversionista
    const inversionista = await postgresService.getById(TABLES.INVERSIONISTAS, id);
    
    if (!inversionista) {
      return res.status(404).json({
        success: false,
        error: 'Inversionista no encontrado'
      });
    }
    
    // Obtener sus inversiones con JOIN a vehículos
    const inversiones = await db('inversiones_vehiculos as iv')
      .leftJoin('vehiculos as v', 'iv.numero_de_serie_vehiculo', 'v.numero_de_serie_vehiculo')
      .select(
        'iv.*',
        'v.numero_vehiculo as vehiculo_numero',
        'v.marca',
        'v.modelo as modelo_vehiculo',
        'v.placa',
        db.raw(`(
          SELECT COUNT(*) 
          FROM pagos_inversionistas p 
          WHERE p.inversion_id = iv.id_inversion 
          AND p.status = 'Pagado'
        ) as pagos_realizados`)
      )
      .where('iv.inversionista_id', id)
      .orderBy('iv.fecha_de_inicio', 'desc');

    
    // Obtener pagos recientes
    const pagos = await db('pagos_inversionistas as p')
      .leftJoin('inversiones_vehiculos as iv', 'p.inversion_id', 'iv.id_inversion')
      .leftJoin('vehiculos as v', 'iv.numero_de_serie_vehiculo', 'v.numero_de_serie_vehiculo')
      .select(
        'p.*',
        'v.numero_vehiculo as vehiculo_numero'
      )
      .where('p.inversionista_id', id)
      .orderBy('p.mes_pago', 'asc')  // ✅ De 1 a 60
      .limit(12);
    
    res.json({
      success: true,
      inversionista,
      inversiones,
      pagos
    });
  } catch (error) {
    console.error('❌ Error obteniendo inversionista:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener inversionista',
      message: error.message
    });
  }
};

// ========== CREAR INVERSIONISTA ==========
exports.createInversionista = async (req, res) => {
  try {
    console.log('➕ Creando nuevo inversionista...');
    const {
      nombre,
      email,
      telefono,
      whatsapp,
      rfc,
      direccion,
      banco,
      cuenta_bancaria,
      clabe,
      tipo_inversionista,
      tasa_rendimiento,
      monto_minimo_inversion,
      password
    } = req.body;
    
    // Verificar si el email ya existe
    const existente = await db(TABLES.INVERSIONISTAS)
      .where('email', email)
      .first();
    
    if (existente) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un inversionista con ese email'
      });
    }
    
    // Hash del password si se proporciona
    let password_hash = null;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }
    
    const nuevoInversionista = await postgresService.create(TABLES.INVERSIONISTAS, {
      nombre,
      email,
      telefono,
      whatsapp: whatsapp || telefono,
      rfc,
      direccion,
      banco,
      cuenta_bancaria,
      clabe,
      tipo_inversionista: tipo_inversionista || 'Individual',
      tasa_rendimiento: tasa_rendimiento || 1.56,
      monto_minimo_inversion: monto_minimo_inversion || 50000,
      password_hash,
      status: 'Activo'
    });
    
    res.status(201).json({
      success: true,
      inversionista: nuevoInversionista,
      message: 'Inversionista creado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error creando inversionista:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear inversionista',
      message: error.message
    });
  }
};

// ========== ACTUALIZAR INVERSIONISTA ==========
exports.updateInversionista = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('✏️ Actualizando inversionista ID:', id);
    
    const datosActualizar = { ...req.body };
    
    // Si viene un password nuevo, hacer hash
    if (datosActualizar.password) {
      datosActualizar.password_hash = await bcrypt.hash(datosActualizar.password, 10);
      delete datosActualizar.password;
    }
    
    const inversionistaActualizado = await postgresService.update(
      TABLES.INVERSIONISTAS,
      id,
      datosActualizar
    );
    
    res.json({
      success: true,
      inversionista: inversionistaActualizado,
      message: 'Inversionista actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error actualizando inversionista:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar inversionista',
      message: error.message
    });
  }
};

// ========== DASHBOARD DEL INVERSIONISTA ==========
exports.getDashboardInversionista = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📊 Obteniendo dashboard para inversionista:', id);
    
    // Estadísticas generales usando Knex query builder
    const stats = await db('inversionistas as i')
      .leftJoin('inversiones_vehiculos as iv', 'i.id', 'iv.inversionista_id')
      .leftJoin('pagos_inversionistas as p', 'iv.id_inversion', 'p.inversion_id')
      .where('i.id', id)
      .groupBy('i.id')
      .select(
        db.raw('COUNT(DISTINCT iv.id_inversion) as contratos_activos'),
        db.raw('COALESCE(SUM(iv.inversion), 0) as total_invertido'),
        db.raw('COALESCE(SUM(iv.utilidad_inversionista), 0) as rendimiento_total_esperado'),
        db.raw(`COALESCE(SUM(CASE WHEN p.status = 'Pagado' THEN p.monto_pagado ELSE 0 END), 0) as total_cobrado`),
        db.raw(`COALESCE(SUM(CASE WHEN p.status = 'Pendiente' THEN p.monto_programado ELSE 0 END), 0) as total_por_cobrar`),
        db.raw(`COUNT(DISTINCT CASE WHEN p.status = 'Pendiente' AND p.fecha_programada < CURRENT_DATE THEN p.id END) as pagos_vencidos`)
      )
      .first();
    
    // Próximos pagos
    const proximosPagos = await db('pagos_inversionistas as p')
      .leftJoin('inversiones_vehiculos as iv', 'p.inversion_id', 'iv.id_inversion')
      .leftJoin('vehiculos as v', 'iv.numero_de_serie_vehiculo', 'v.numero_de_serie_vehiculo')
      .select(
        'p.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo'
      )
      .where('p.inversionista_id', id)
      .where('p.status', 'Pendiente')
      .orderBy('p.fecha_programada', 'asc')
      .limit(5);
    
    res.json({
      success: true,
      ...stats,
      proximos_pagos: proximosPagos
    });
  } catch (error) {
    console.error('❌ Error obteniendo dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener dashboard',
      message: error.message
    });
  }
};

// ========== OBTENER OPCIONES PARA FORMULARIOS ==========
exports.getOpcionesInversionistas = async (req, res) => {
  try {
    // Lista simple de inversionistas activos para selects
    const inversionistas = await db(TABLES.INVERSIONISTAS)
      .select('id', 'nombre', 'email', 'tasa_rendimiento')
      .where('status', 'Activo')
      .orderBy('nombre');
    
    res.json({
      success: true,
      inversionistas,
      tasas_rendimiento: [1.0, 1.25, 1.5, 1.56, 1.75, 2.0],
      tipos_inversionista: ['Individual', 'Empresa', 'Sociedad']
    });
  } catch (error) {
    console.error('❌ Error obteniendo opciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener opciones'
    });
  }
};

// ========== REGISTRO PÚBLICO DE INVERSIONISTA (PORTAL) ==========
exports.registroPublico = async (req, res) => {
  try {
    console.log('📝 Nueva solicitud de inversión desde portal público');
    
    const {
      nombre_completo,
      email,
      telefono,
      whatsapp,
      monto_intencion,
      plan_interes,
      experiencia_inversion,
      como_nos_conocio,
      mensaje
    } = req.body;
    
    // Validaciones básicas
    if (!nombre_completo || !email || !telefono) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, email y teléfono son requeridos'
      });
    }
    
    // Verificar si ya existe una solicitud con ese email
    const solicitudExistente = await db('solicitudes_inversion')
      .where('email', email)
      .where('status', 'Pendiente')
      .first();
    
    if (solicitudExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una solicitud pendiente con este email'
      });
    }
    
    // Crear solicitud
    const [nuevaSolicitud] = await db('solicitudes_inversion')
      .insert({
        nombre_completo,
        email,
        telefono,
        whatsapp: whatsapp || telefono,
        monto_intencion,
        plan_interes,
        experiencia_inversion,
        como_nos_conocio,
        mensaje,
        status: 'Pendiente',
        fecha_solicitud: db.fn.now()
      })
      .returning('*');
    
    console.log('✅ Solicitud creada:', nuevaSolicitud.id);
    
    res.status(201).json({
      success: true,
      solicitud: nuevaSolicitud,
      message: 'Solicitud enviada exitosamente. Te contactaremos pronto.'
    });
  } catch (error) {
    console.error('❌ Error en registro público:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar solicitud',
      error: error.message
    });
  }
};

// ========== OBTENER SOLICITUDES DE INVERSIÓN (ADMIN) ==========
exports.getSolicitudesInversion = async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = db('solicitudes_inversion as si')
      .select(
        'si.*',
        'u.name as revisor_nombre'
      )
      .leftJoin('usuarios as u', 'si.revisado_por', 'u.id')
      .orderBy('si.fecha_solicitud', 'desc');
    
    if (status) {
      query = query.where('si.status', status);
    }
    
    const solicitudes = await query;
    
    res.json({
      success: true,
      solicitudes
    });
  } catch (error) {
    console.error('❌ Error obteniendo solicitudes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener solicitudes',
      message: error.message
    });
  }
};

// ========== APROBAR SOLICITUD Y CREAR INVERSIONISTA ==========
exports.aprobarSolicitud = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { notas_revision } = req.body;
    const usuario_id = req.user?.id || 1; // Del middleware de auth
    
    console.log('✅ Aprobando solicitud:', id);
    
    // Obtener solicitud
    const solicitud = await trx('solicitudes_inversion')
      .where('id', id)
      .first();
    
    if (!solicitud) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }
    
    if (solicitud.status !== 'Pendiente') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'La solicitud ya fue procesada'
      });
    }
    
    // Crear inversionista con TODOS los campos
    const [nuevoInversionista] = await trx(TABLES.INVERSIONISTAS)
      .insert({
        nombre: solicitud.nombre_completo,
        email: solicitud.email,
        telefono: solicitud.telefono,
        whatsapp: solicitud.whatsapp || solicitud.telefono,
        monto_interes: solicitud.monto_intencion,
        plan_preferido: solicitud.plan_interes,
        como_nos_conocio: solicitud.como_nos_conocio,
        mensaje: solicitud.mensaje,
        status: 'Activo',
        tipo_inversionista: 'Individual'
      })
      .returning('*');
    
    // Actualizar solicitud
    await trx('solicitudes_inversion')
      .where('id', id)
      .update({
        status: 'Aprobada',
        fecha_respuesta: trx.fn.now(),
        revisado_por: usuario_id,
        notas_revision,
        inversionista_id: nuevoInversionista.id
      });
    
    await trx.commit();
    
    console.log('✅ Inversionista creado:', nuevoInversionista.id);
    
    res.json({
      success: true,
      inversionista: nuevoInversionista,
      inversionista_id: nuevoInversionista.id, // ✅ Para el frontend
      message: 'Solicitud aprobada e inversionista creado'
    });
  } catch (error) {
    await trx.rollback();
    console.error('❌ Error aprobando solicitud:', error);
    res.status(500).json({
      success: false,
      error: 'Error al aprobar solicitud',
      message: error.message
    });
  }
};

// ========== RECHAZAR SOLICITUD ==========
exports.rechazarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo_rechazo } = req.body;
    const usuario_id = req.user?.id || 1;
    
    console.log('❌ Rechazando solicitud:', id);
    
    const solicitud = await db('solicitudes_inversion')
      .where('id', id)
      .first();
    
    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }
    
    if (solicitud.status !== 'Pendiente') {
      return res.status(400).json({
        success: false,
        message: 'La solicitud ya fue procesada'
      });
    }
    
    await db('solicitudes_inversion')
      .where('id', id)
      .update({
        status: 'Rechazada',
        fecha_respuesta: db.fn.now(),
        revisado_por: usuario_id,
        motivo_rechazo
      });
    
    res.json({
      success: true,
      message: 'Solicitud rechazada'
    });
  } catch (error) {
    console.error('❌ Error rechazando solicitud:', error);
    res.status(500).json({
      success: false,
      error: 'Error al rechazar solicitud',
      message: error.message
    });
  }
};

// ========== GESTIÓN DE CONTRATOS ==========

/**
 * Crear un nuevo contrato de inversión
 */
exports.crearContrato = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const {
      inversionista_id,
      vehiculo_id,
      tipo_inversion,
      modelo_negocio,
      monto_inversion,
      fecha_inicio,
      notas
    } = req.body;

    console.log('📝 Creando contrato:', {
      inversionista_id,
      vehiculo_id,
      tipo_inversion,
      modelo_negocio,
      monto_inversion
    });

    // Validaciones
    if (!inversionista_id || !monto_inversion || !modelo_negocio) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos: inversionista_id, monto_inversion y modelo_negocio'
      });
    }

    // Verificar que el inversionista existe
    const inversionista = await trx('inversionistas')
      .where('id', inversionista_id)
      .first();

    if (!inversionista) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Inversionista no encontrado'
      });
    }

    // Configuración de planes
const planesConfig = {
  'SI_LEGADO': {
    plazo: 62,
    tasa_mensual: 0.027419
  },
  'PLUS_60': {
    plazo: 60,
    multiplicador: 1.60  // ✅ Cambiar de 1.71 a 1.60
  },
  'SMART_40': {
    plazo: 40,
    multiplicador: 1.40
  }
};

    const planConfig = planesConfig[modelo_negocio];
    
    if (!planConfig) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Plan de inversión no válido. Use: SI_LEGADO, PLUS_60 o SMART_40'
      });
    }

    // Calcular métricas financieras
    let pagoMensual = 0;
    let totalRecibir = 0;

    if (modelo_negocio === 'SI_LEGADO') {
      pagoMensual = monto_inversion * planConfig.tasa_mensual;
      totalRecibir = pagoMensual * planConfig.plazo;
    } else {
      totalRecibir = monto_inversion * planConfig.multiplicador;
      pagoMensual = totalRecibir / planConfig.plazo;
    }

    console.log('💰 Cálculos financieros:', {
      pagoMensual,
      totalRecibir,
      plazo: planConfig.plazo
    });

    // Obtener número de serie del vehículo si aplica
    let numeroSerieVehiculo = null;
    if (tipo_inversion === 'vehiculo_especifico' && vehiculo_id) {
const vehiculo = await trx('vehiculos')
  .where('numero_de_serie_vehiculo', vehiculo_id)
  .first();
      
      if (!vehiculo) {
        await trx.rollback();
        return res.status(404).json({
          success: false,
          message: 'Vehículo no encontrado'
        });
      }
      
      numeroSerieVehiculo = vehiculo.numero_de_serie_vehiculo;
      console.log('🚗 Vehículo seleccionado:', numeroSerieVehiculo);

   } else {
  // Para pool general, dejar NULL
  numeroSerieVehiculo = null;
  console.log('📦 Pool general: NULL (sin vehículo específico)');
}

    // Crear el contrato en la tabla inversiones_vehiculos
    const [nuevoContrato] = await trx('inversiones_vehiculos')
  .insert({
    numero_de_serie_vehiculo: numeroSerieVehiculo,
    inversionista_id: inversionista_id,
    inversion: parseFloat(monto_inversion),
    modelo_negocio: modelo_negocio,
    pago_mensual_inversionista: parseFloat(pagoMensual.toFixed(2)),
    utilidad_inversionista: parseFloat(totalRecibir.toFixed(2)),
    plazo_para_inversionistas: planConfig.plazo,
    fecha_de_inicio: fecha_inicio || new Date(),
    fecha_inicio_inversion: fecha_inicio || new Date(),
    status_inversion: 'Activa',
    tasa_rendimiento: inversionista.tasa_rendimiento || 1.56,
    valor_factura: req.body.valor_factura ? parseFloat(req.body.valor_factura) : null // ✅ AGREGAR
  })
  .returning('*');

    console.log('✅ Contrato creado:', nuevoContrato.id_inversion);

    // Generar calendario de pagos
    const calendarioPagos = [];
    const fechaInicio = new Date(fecha_inicio || new Date());

    for (let mes = 1; mes <= planConfig.plazo; mes++) {
      const fechaPago = new Date(fechaInicio);
      fechaPago.setMonth(fechaPago.getMonth() + mes);

      calendarioPagos.push({
        inversion_id: nuevoContrato.id_inversion,
        inversionista_id: inversionista_id,
        mes_pago: mes,
        fecha_programada: fechaPago,
        monto_programado: parseFloat(pagoMensual.toFixed(2)),
        status: 'Pendiente'
      });
    }

    // Insertar calendario de pagos
    await trx('pagos_inversionistas').insert(calendarioPagos);
    console.log(`📅 Calendario de ${calendarioPagos.length} pagos creado`);

    // Actualizar monto_total_invertido del inversionista
    await trx('inversionistas')
      .where('id', inversionista_id)
      .increment('monto_total_invertido', parseFloat(monto_inversion));

    console.log('💼 Monto total invertido actualizado');

    await trx.commit();

    res.status(201).json({
      success: true,
      message: 'Contrato creado exitosamente',
      contrato: {
        id: nuevoContrato.id_inversion,
        inversionista_id: nuevoContrato.inversionista_id,
        monto: nuevoContrato.inversion,
        pago_mensual: nuevoContrato.pago_mensual_inversionista,
        plazo: nuevoContrato.plazo_para_inversionistas,
        total_a_recibir: nuevoContrato.utilidad_inversionista,
        modelo_negocio: nuevoContrato.modelo_negocio,
        status: nuevoContrato.status_inversion
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error creando contrato:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el contrato',
      error: error.message
    });
  }
};

/**
 * Obtener vehículos disponibles para inversión
 */
exports.getVehiculosDisponibles = async (req, res) => {
  try {
    const vehiculos = await db('vehiculos')
      .whereIn('estado', ['Disponible', 'Mantenimiento'])
      .where(function() {
        this.where('propietario_tipo', 'AutoManager')
            .orWhereNull('propietario_tipo');
      })
      .select(
        'id',
        'numero_vehiculo',
        'numero_de_serie_vehiculo',
        'marca',
        'modelo',
        'año_del_vehiculo as ano',
        'estado',
        'tipo_vehiculo',
        'placa',
        'precio_compra'
      )
      .orderBy('numero_vehiculo', 'asc');

    console.log(`✅ ${vehiculos.length} vehículos disponibles encontrados para inversión`);

    res.json({
      success: true,
      vehiculos
    });

  } catch (error) {
    console.error('❌ Error obteniendo vehículos disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vehículos disponibles',
      error: error.message
    });
  }
};
// ========== VER DETALLE DE CONTRATO ==========
exports.getContratoDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📄 Obteniendo detalle de contrato:', id);
    
    // Obtener datos del contrato con JOIN
    const contrato = await db('inversiones_vehiculos as iv')
      .leftJoin('inversionistas as i', 'iv.inversionista_id', 'i.id')
      .leftJoin('vehiculos as v', 'iv.numero_de_serie_vehiculo', 'v.numero_de_serie_vehiculo')
      .select(
        'iv.*',
        'i.nombre as inversionista_nombre',
        'i.email as inversionista_email',
        'i.telefono as inversionista_telefono',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo as modelo_vehiculo',
        'v.placa',
        'v.año_del_vehiculo as ano_vehiculo'
      )
      .where('iv.id_inversion', id)
      .first();
    
    if (!contrato) {
      return res.status(404).json({
        success: false,
        message: 'Contrato no encontrado'
      });
    }
    
    // Obtener calendario completo de pagos
    const pagos = await db('pagos_inversionistas')
      .where('inversion_id', id)
      .orderBy('mes_pago', 'asc');
    
    // Calcular estadísticas
    const stats = {
      total_pagos: pagos.length,
      pagos_realizados: pagos.filter(p => p.status === 'Pagado').length,
      pagos_pendientes: pagos.filter(p => p.status === 'Pendiente').length,
      pagos_vencidos: pagos.filter(p => p.status === 'Vencido').length,
      monto_total_pagado: pagos
        .filter(p => p.status === 'Pagado')
        .reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0),
      monto_total_pendiente: pagos
        .filter(p => p.status === 'Pendiente')
        .reduce((sum, p) => sum + parseFloat(p.monto_programado || 0), 0)
    };
    
    res.json({
      success: true,
      contrato,
      pagos,
      stats
    });
  } catch (error) {
    console.error('❌ Error obteniendo contrato:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener contrato',
      message: error.message
    });
  }
};


// ========== REGISTRAR/MARCAR PAGO COMO PAGADO ==========
exports.marcarPagoPagado = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params; // ID del pago
    const usuario_id = req.user?.id || 1;
    
    console.log('💰 Marcando pago como pagado - ID:', id);
    
    // Verificar que el pago existe
    const pago = await trx('pagos_inversionistas')
      .where('id', id)
      .first();
    
    console.log('📋 Pago encontrado:', pago);
    
    if (!pago) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Pago no encontrado'
      });
    }
    
    // Verificar que no esté ya pagado
    if (pago.status === 'Pagado') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este pago ya fue marcado como pagado'
      });
    }
    
    console.log('💵 Actualizando pago con monto:', pago.monto_programado);
    
    // Actualizar el pago
    await trx('pagos_inversionistas')
      .where('id', id)
      .update({
        status: 'Pagado',
        monto_pagado: pago.monto_programado,
        fecha_pago_real: trx.fn.now()
      });
    
    // ✅ COMMIT - MUY IMPORTANTE
    await trx.commit();
    
    console.log('✅ Pago actualizado y commit realizado');
    
    // Obtener el pago actualizado DESPUÉS del commit
    const pagoActualizado = await db('pagos_inversionistas')
      .where('id', id)
      .first();
    
    console.log('📊 Pago después del commit:', pagoActualizado);
    
    res.json({
      success: true,
      message: 'Pago registrado exitosamente',
      pago: pagoActualizado
    });
    
  } catch (error) {
    await trx.rollback();
    console.error('❌ Error marcando pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar el pago',
      message: error.message
    });
  }
};
// ========== HUB DE INVERSIONES - LISTA DE CONTRATOS ==========
exports.getHubInversiones = async (req, res) => {
  try {
    const { plan, status, inversionista_id } = req.query;
    
    console.log('🏢 Obteniendo hub de inversiones');
    
    let query = db('inversiones_vehiculos as iv')
      .leftJoin('inversionistas as i', 'iv.inversionista_id', 'i.id')
      .leftJoin('vehiculos as v', 'iv.numero_de_serie_vehiculo', 'v.numero_de_serie_vehiculo')
      .select(
        'iv.*',
        'i.nombre as inversionista_nombre',
        'i.email as inversionista_email',
        'i.telefono as inversionista_telefono',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo as modelo_vehiculo',
        'v.placa',
        db.raw(`(
          SELECT COUNT(*) 
          FROM pagos_inversionistas p 
          WHERE p.inversion_id = iv.id_inversion 
          AND p.status = 'Pagado'
        ) as pagos_realizados`),
        db.raw(`(
          SELECT COUNT(*) 
          FROM pagos_inversionistas p 
          WHERE p.inversion_id = iv.id_inversion 
          AND p.status = 'Pendiente'
        ) as pagos_pendientes`),
        db.raw(`(
          SELECT SUM(monto_pagado) 
          FROM pagos_inversionistas p 
          WHERE p.inversion_id = iv.id_inversion 
          AND p.status = 'Pagado'
        ) as total_pagado`)
      );
    
    // Filtros opcionales
    if (plan) {
      query = query.where('iv.modelo_negocio', plan);
    }
    
    if (status) {
      query = query.where('iv.status_inversion', status);
    }
    
    if (inversionista_id) {
      query = query.where('iv.inversionista_id', inversionista_id);
    }
    
    const contratos = await query.orderBy('iv.fecha_de_inicio', 'desc');
    
    // Estadísticas generales
    const stats = await db('inversiones_vehiculos')
      .select(
        db.raw('COUNT(*) as total_contratos'),
        db.raw('SUM(inversion) as capital_total'),
        db.raw('SUM(utilidad_inversionista) as rendimiento_total'),
        db.raw(`COUNT(CASE WHEN status_inversion = 'Activa' THEN 1 END) as contratos_activos`),
        db.raw(`COUNT(CASE WHEN modelo_negocio = 'SI_LEGADO' THEN 1 END) as contratos_si_legado`),
        db.raw(`COUNT(CASE WHEN modelo_negocio = 'PLUS_60' THEN 1 END) as contratos_plus_60`),
        db.raw(`COUNT(CASE WHEN modelo_negocio = 'SMART_40' THEN 1 END) as contratos_smart_40`)
      )
      .first();
    
    res.json({
      success: true,
      contratos,
      stats
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo hub de inversiones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener contratos',
      message: error.message
    });
  }
};

// ========== VINCULAR INVERSIONISTA A INVERSIÓN EXISTENTE ==========
exports.vincularInversionista = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params; // ID de la inversión (id_inversion)
    const { inversionista_id } = req.body;
    const usuario_id = req.user?.id || 1;

    console.log('🔗 Vinculando inversionista a inversión:', id);

    // Verificar que la inversión existe
    const inversion = await trx('inversiones_vehiculos')
      .where('id_inversion', id)
      .first();

    if (!inversion) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Inversión no encontrada'
      });
    }

    // Verificar que no tenga ya un inversionista
    if (inversion.inversionista_id) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Esta inversión ya tiene un inversionista asignado'
      });
    }

    // Verificar que el inversionista existe
    const inversionista = await trx('inversionistas')
      .where('id', inversionista_id)
      .first();

    if (!inversionista) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Inversionista no encontrado'
      });
    }

    console.log('💼 Inversionista:', inversionista.nombre);
    console.log('💰 Inversión:', inversion.inversion);

    // Actualizar la inversión con el inversionista
    await trx('inversiones_vehiculos')
      .where('id_inversion', id)
      .update({
        inversionista_id: inversionista_id
      });

    // Actualizar monto_total_invertido del inversionista
    await trx('inversionistas')
      .where('id', inversionista_id)
      .increment('monto_total_invertido', parseFloat(inversion.inversion || 0));

    // Generar calendario de pagos si no existe
    const pagosExistentes = await trx('pagos_inversionistas')
      .where('inversion_id', id)
      .count('* as total');

    if (parseInt(pagosExistentes[0].total) === 0) {
      console.log('📅 Generando calendario de pagos...');

      const plazo = inversion.plazo_para_inversionistas || 62;
      const pagoMensual = parseFloat(inversion.pago_mensual_inversionista || 0);
      const fechaInicio = new Date(inversion.fecha_de_inicio || inversion.fecha_inicio_inversion || new Date());

      const calendarioPagos = [];
      for (let mes = 1; mes <= plazo; mes++) {
        const fechaPago = new Date(fechaInicio);
        fechaPago.setMonth(fechaPago.getMonth() + mes);

        calendarioPagos.push({
          inversion_id: id,
          inversionista_id: inversionista_id,
          mes_pago: mes,
          fecha_programada: fechaPago,
          monto_programado: pagoMensual,
          status: 'Pendiente'
        });
      }

      await trx('pagos_inversionistas').insert(calendarioPagos);
      console.log(`✅ ${calendarioPagos.length} pagos programados creados`);
    }

    await trx.commit();

    console.log('✅ Inversionista vinculado exitosamente');

    res.json({
      success: true,
      message: 'Inversionista vinculado exitosamente',
      inversion: {
        id: id,
        inversionista_id: inversionista_id,
        inversionista_nombre: inversionista.nombre
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error vinculando inversionista:', error);
    res.status(500).json({
      success: false,
      error: 'Error al vincular inversionista',
      message: error.message
    });
  }
};