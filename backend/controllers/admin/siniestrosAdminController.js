const { db } = require('../../config/database');

// ============================================
// OBTENER TODOS LOS SINIESTROS CON FILTROS
// ============================================
exports.getSiniestros = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      estado,
      gravedad,
      clasificacion,
      vehiculo_id,
      conductor_id,
      fecha_desde,
      fecha_hasta,
      search
    } = req.query;

    const offset = (page - 1) * limit;

    let query = db('siniestros as s')
      .select(
        's.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'c.nombre_conductor',
        'c.numero_telefono',
        db.raw('DATE_PART(\'day\', NOW() - s.fecha_incidente) as dias_desde_incidente')
      )
      .leftJoin('vehiculos as v', 's.vehiculo_id', 'v.id')
      .leftJoin('conductores as c', 's.conductor_id', 'c.id');

    // Aplicar filtros
    if (estado) query = query.where('s.estado', estado);
    if (gravedad) query = query.where('s.gravedad', gravedad);
    if (clasificacion) query = query.where('s.clasificacion', clasificacion);
    if (vehiculo_id) query = query.where('s.vehiculo_id', vehiculo_id);
    if (conductor_id) query = query.where('s.conductor_id', conductor_id);
    if (fecha_desde) query = query.where('s.fecha_incidente', '>=', fecha_desde);
    if (fecha_hasta) query = query.where('s.fecha_incidente', '<=', fecha_hasta);

    if (search) {
      query = query.where(function() {
        this.where('v.numero_vehiculo', 'ilike', `%${search}%`)
            .orWhere('c.nombre_conductor', 'ilike', `%${search}%`)
            .orWhere('s.numero_reporte', 'ilike', `%${search}%`)
            .orWhere('s.ubicacion', 'ilike', `%${search}%`);
      });
    }

    // Contar total
    const totalCountQuery = db('siniestros as s')
      .leftJoin('vehiculos as v', 's.vehiculo_id', 'v.id')
      .leftJoin('conductores as c', 's.conductor_id', 'c.id');

    if (estado) totalCountQuery.where('s.estado', estado);
    if (gravedad) totalCountQuery.where('s.gravedad', gravedad);
    if (clasificacion) totalCountQuery.where('s.clasificacion', clasificacion);
    if (vehiculo_id) totalCountQuery.where('s.vehiculo_id', vehiculo_id);
    if (conductor_id) totalCountQuery.where('s.conductor_id', conductor_id);
    if (fecha_desde) totalCountQuery.where('s.fecha_incidente', '>=', fecha_desde);
    if (fecha_hasta) totalCountQuery.where('s.fecha_incidente', '<=', fecha_hasta);
    if (search) {
      totalCountQuery.where(function() {
        this.where('v.numero_vehiculo', 'ilike', `%${search}%`)
            .orWhere('c.nombre_conductor', 'ilike', `%${search}%`)
            .orWhere('s.numero_reporte', 'ilike', `%${search}%`);
      });
    }

    const totalResult = await totalCountQuery.count('s.id as count').first();
    const total = parseInt(totalResult.count);

    // Obtener registros paginados
    const siniestros = await query
      .orderBy('s.fecha_incidente', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      siniestros,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error en getSiniestros:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener siniestros',
      error: error.message
    });
  }
};

// ============================================
// ESTADÍSTICAS PARA DASHBOARD
// ============================================
exports.getEstadisticas = async (req, res) => {
  try {
    const totalesResult = await db('siniestros')
      .select(
        db.raw("COUNT(*) as total_siniestros"),
        db.raw("COUNT(*) FILTER (WHERE estado = 'Reportado') as reportados"),
        db.raw("COUNT(*) FILTER (WHERE estado = 'En proceso') as en_proceso"),
        db.raw("COUNT(*) FILTER (WHERE estado = 'Resuelto') as resueltos"),
        db.raw("COUNT(*) FILTER (WHERE gravedad = 'Grave') as graves"),
        db.raw("COUNT(*) FILTER (WHERE gravedad = 'Total') as totales"),
        db.raw("COALESCE(SUM(costo_final), 0) as costo_total"),
        db.raw("COALESCE(AVG(costo_final), 0) as promedio_costo"),
        db.raw("COALESCE(AVG(dias_fuera_servicio), 0) as promedio_dias_fuera")
      )
      .first();

    // Siniestros por clasificación
    const porClasificacion = await db('siniestros')
      .select('clasificacion')
      .count('* as cantidad')
      .sum('costo_final as total_costo')
      .groupBy('clasificacion')
      .orderBy('cantidad', 'desc');

    // Top vehículos con más siniestros (CON CONDUCTOR)
    const topVehiculos = await db('siniestros as s')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'c.nombre_conductor'
      )
      .count('s.id as total_siniestros')
      .sum('s.costo_final as total_costo')
      .join('vehiculos as v', 's.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .groupBy('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa', 'c.nombre_conductor')
      .orderBy('total_siniestros', 'desc')
      .limit(10);

    // Siniestros últimos 6 meses
    const costosUltimosMeses = await db('siniestros')
      .select(
        db.raw("TO_CHAR(fecha_incidente, 'Mon') as mes"),
        db.raw("TO_CHAR(fecha_incidente, 'YYYY-MM') as mes_year")
      )
      .count('* as cantidad')
      .sum('costo_final as total')
      .whereRaw("fecha_incidente >= NOW() - INTERVAL '6 months'")
      .groupBy('mes_year', 'mes')
      .orderBy('mes_year', 'asc');

    res.json({
      success: true,
      estadisticas: {
        total_siniestros: parseInt(totalesResult.total_siniestros) || 0,
        reportados: parseInt(totalesResult.reportados) || 0,
        en_proceso: parseInt(totalesResult.en_proceso) || 0,
        resueltos: parseInt(totalesResult.resueltos) || 0,
        graves: parseInt(totalesResult.graves) || 0,
        totales: parseInt(totalesResult.totales) || 0,
        costo_total: parseFloat(totalesResult.costo_total) || 0,
        promedio_costo: parseFloat(totalesResult.promedio_costo) || 0,
        promedio_dias_fuera: parseFloat(totalesResult.promedio_dias_fuera) || 0
      },
      por_clasificacion: porClasificacion,
      top_vehiculos: topVehiculos,
      costos_mensuales: costosUltimosMeses
    });

  } catch (error) {
    console.error('Error en getEstadisticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

// ============================================
// OBTENER UN SINIESTRO POR ID
// ============================================
exports.getSiniestroById = async (req, res) => {
  try {
    const { id } = req.params;

    const siniestro = await db('siniestros as s')
      .select(
        's.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'v.año_del_vehiculo',
        'c.nombre_conductor',
        'c.numero_telefono',
        'c.email'
      )
      .leftJoin('vehiculos as v', 's.vehiculo_id', 'v.id')
      .leftJoin('conductores as c', 's.conductor_id', 'c.id')
      .where('s.id', id)
      .first();

    if (!siniestro) {
      return res.status(404).json({
        success: false,
        message: 'Siniestro no encontrado'
      });
    }

    res.json({
      success: true,
      siniestro
    });

  } catch (error) {
    console.error('Error en getSiniestroById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener siniestro',
      error: error.message
    });
  }
};

// ============================================
// CREAR NUEVO SINIESTRO - VERSIÓN HÍBRIDA (JSON + FORMDATA)
// ============================================
exports.createSiniestro = async (req, res) => {
  try {
    console.log('🔍 === CREANDO SINIESTRO ===');
    console.log('📥 Content-Type:', req.get('Content-Type'));
    console.log('📥 Body recibido:', req.body);
    console.log('📸 Archivos recibidos:', req.files ? req.files.length : 0);

    const {
      vehiculo_id,
      conductor_id,
      fecha_incidente,
      hora_incidente,
      ubicacion,
      tipo_siniestro,
      clasificacion,
      descripcion,
      gravedad,
      costo_estimado,
      involucro_terceros,
      involucro_seguro,
      poliza_seguro,
      aseguradora,
      observaciones,
      reportado_por
    } = req.body;

    // Validaciones básicas
    if (!vehiculo_id || !fecha_incidente || !tipo_siniestro) {
      return res.status(400).json({
        success: false,
        message: 'vehiculo_id, fecha_incidente y tipo_siniestro son obligatorios'
      });
    }

    // Generar folio
    const ultimoFolio = await db('siniestros')
      .max('folio_siniestro as max_folio')
      .first();
    
    const nuevoFolio = (ultimoFolio.max_folio || 0) + 1;

    // 🔥 Procesar fotos SOLO si vienen archivos
    let fotos_urls = '';
    
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log('📸 Procesando', req.files.length, 'fotos con Cloudinary');
      
      const cloudinary = require('../../middleware/uploadSiniestrosMiddleware').cloudinary;
      
      const uploadPromises = req.files.map(async (file) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'automanager/siniestros/fotos',
              transformation: [{ width: 1920, height: 1920, crop: 'limit', quality: 'auto' }],
              public_id: `siniestro-${Date.now()}-${Math.random().toString(36).substring(7)}`
            },
            (error, result) => {
              if (error) {
                console.error('❌ Error subiendo a Cloudinary:', error);
                reject(error);
              } else {
                console.log('✅ Foto subida:', result.secure_url);
                resolve(result.secure_url);
              }
            }
          );
          
          uploadStream.end(file.buffer);
        });
      });
      
      try {
        const urls = await Promise.all(uploadPromises);
        fotos_urls = urls.join(',');
        console.log('✅ Todas las fotos subidas correctamente');
      } catch (error) {
        console.error('❌ Error al subir fotos:', error);
        return res.status(500).json({
          success: false,
          message: 'Error al subir fotos a Cloudinary',
          error: error.message
        });
      }
    } else {
      console.log('📄 Sin fotos - Creando siniestro solo con datos');
    }

    // CONVERTIR VALORES VACÍOS A NULL O VALORES POR DEFECTO
    const siniestroData = {
      folio_siniestro: nuevoFolio,
      vehiculo_id: parseInt(vehiculo_id),
      conductor_id: conductor_id && conductor_id !== '' ? parseInt(conductor_id) : null,
      fecha_incidente,
      hora_incidente: hora_incidente || null,
      ubicacion: ubicacion || null,
      tipo_siniestro,
      clasificacion: clasificacion || 'Choque',
      descripcion: descripcion || null,
      gravedad: gravedad || 'Leve',
      costo_estimado: costo_estimado && costo_estimado !== '' ? parseFloat(costo_estimado) : 0,
      costo_final: 0,
      estado: 'Reportado',
      fotos_urls,
      involucro_terceros: involucro_terceros === 'true' || involucro_terceros === true,
      involucro_seguro: involucro_seguro === 'true' || involucro_seguro === true,
      poliza_seguro: poliza_seguro || null,
      aseguradora: aseguradora || null,
      observaciones: observaciones || null,
      reportado_por: reportado_por || 'Admin',
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    };

    console.log('💾 Datos a insertar:', siniestroData);

    // Crear siniestro
    const [siniestro] = await db('siniestros')
      .insert(siniestroData)
      .returning('*');

    console.log('✅ Siniestro creado exitosamente:', siniestro.id);

    res.status(201).json({
      success: true,
      message: 'Siniestro registrado exitosamente',
      siniestro
    });

  } catch (error) {
    console.error('❌ Error en createSiniestro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar siniestro',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ============================================
// ACTUALIZAR SINIESTRO
// ============================================
exports.updateSiniestro = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existe = await db('siniestros').where('id', id).first();
    if (!existe) {
      return res.status(404).json({
        success: false,
        message: 'Siniestro no encontrado'
      });
    }

    updates.updated_at = db.fn.now();
    
    const [siniestro] = await db('siniestros')
      .where('id', id)
      .update(updates)
      .returning('*');

    res.json({
      success: true,
      message: 'Siniestro actualizado exitosamente',
      siniestro
    });

  } catch (error) {
    console.error('Error en updateSiniestro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar siniestro',
      error: error.message
    });
  }
};

// ============================================
// ELIMINAR SINIESTRO
// ============================================
exports.deleteSiniestro = async (req, res) => {
  try {
    const { id } = req.params;

    const existe = await db('siniestros').where('id', id).first();
    if (!existe) {
      return res.status(404).json({
        success: false,
        message: 'Siniestro no encontrado'
      });
    }

    await db('siniestros').where('id', id).delete();

    res.json({
      success: true,
      message: 'Siniestro eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteSiniestro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar siniestro',
      error: error.message
    });
  }
};

// ============================================
// HISTORIAL POR VEHÍCULO
// ============================================
exports.getHistorialVehiculo = async (req, res) => {
  try {
    const { id } = req.params;

    const historial = await db('siniestros as s')
      .select(
        's.*',
        'c.nombre_conductor',
        'c.numero_telefono'
      )
      .leftJoin('conductores as c', 's.conductor_id', 'c.id')
      .where('s.vehiculo_id', id)
      .orderBy('s.fecha_incidente', 'desc');

    const estadisticas = await db('siniestros')
      .select(
        db.raw('COUNT(*) as total_siniestros'),
        db.raw('COALESCE(SUM(costo_final), 0) as costo_total'),
        db.raw('COUNT(*) FILTER (WHERE gravedad = \'Grave\') as siniestros_graves')
      )
      .where('vehiculo_id', id)
      .first();

    res.json({
      success: true,
      historial,
      estadisticas: {
        total_siniestros: parseInt(estadisticas.total_siniestros) || 0,
        costo_total: parseFloat(estadisticas.costo_total) || 0,
        siniestros_graves: parseInt(estadisticas.siniestros_graves) || 0
      }
    });

  } catch (error) {
    console.error('Error en getHistorialVehiculo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
    });
  }
};

// ============================================
// HISTORIAL POR CONDUCTOR
// ============================================
exports.getHistorialConductor = async (req, res) => {
  try {
    const { id } = req.params;

    const historial = await db('siniestros as s')
      .select(
        's.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa'
      )
      .leftJoin('vehiculos as v', 's.vehiculo_id', 'v.id')
      .where('s.conductor_id', id)
      .orderBy('s.fecha_incidente', 'desc');

    const estadisticas = await db('siniestros')
      .select(
        db.raw('COUNT(*) as total_siniestros'),
        db.raw('COALESCE(SUM(costo_final), 0) as costo_total'),
        db.raw('COUNT(*) FILTER (WHERE responsable_pago = \'Conductor\') as pagados_por_conductor')
      )
      .where('conductor_id', id)
      .first();

    res.json({
      success: true,
      historial,
      estadisticas: {
        total_siniestros: parseInt(estadisticas.total_siniestros) || 0,
        costo_total: parseFloat(estadisticas.costo_total) || 0,
        pagados_por_conductor: parseInt(estadisticas.pagados_por_conductor) || 0
      }
    });

  } catch (error) {
    console.error('Error en getHistorialConductor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
    });
  }
};

// ============================================
// OPCIONES PARA SELECTS
// ============================================
exports.getOpciones = async (req, res) => {
  try {
    console.log('🔍 === INICIANDO getOpciones ===');
    
    // Obtener vehículos
    const vehiculos = await db('vehiculos as v')
      .select('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa')
      .orderBy('v.numero_vehiculo', 'asc');

    console.log('✅ Vehículos obtenidos:', vehiculos.length);

    // Obtener conductores
    let conductores = [];
    try {
      console.log('🔍 Consultando conductores...');
      conductores = await db('conductores')
        .select('id', 'nombre_conductor', 'numero_telefono', 'status')
        .orderBy('nombre_conductor', 'asc');
      
      console.log('✅ Conductores obtenidos:', conductores.length);
    } catch (errorConductores) {
      console.error('❌ ERROR obteniendo conductores:', errorConductores);
      conductores = [];
    }

    const respuesta = {
      success: true,
      opciones: {
        vehiculos,
        conductores,
        estados: ['Reportado', 'En revisión', 'En proceso', 'Esperando seguro', 'Resuelto', 'Cancelado'],
        gravedades: ['Leve', 'Moderado', 'Grave', 'Total'],
        clasificaciones: ['Choque', 'Robo', 'Vandalismo', 'Falla mecánica', 'Daño por clima', 'Otro'],
        tipos_siniestro: ['Choque frontal', 'Choque trasero', 'Choque lateral', 'Volcadura', 'Atropello', 'Robo total', 'Robo parcial', 'Daños por inundación', 'Incendio', 'Cristales', 'Otro']
      }
    };

    res.json(respuesta);

  } catch (error) {
    console.error('❌ ERROR GENERAL en getOpciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener opciones',
      error: error.message
    });
  }
};

// ============================================
// VINCULAR SINIESTRO CON MANTENIMIENTO
// ============================================
exports.vincularMantenimiento = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const {
      fecha_programada,
      taller,
      observaciones_adicionales,
      monto_estimado
    } = req.body;

    const siniestro = await trx('siniestros').where('id', id).first();
    
    if (!siniestro) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Siniestro no encontrado'
      });
    }

    if (siniestro.mantenimiento_id) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este siniestro ya tiene un mantenimiento vinculado',
        mantenimiento_id: siniestro.mantenimiento_id
      });
    }

    const vehiculo = await trx('vehiculos').where('id', siniestro.vehiculo_id).first();
    
    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado'
      });
    }

    const ultimoFolio = await trx('mantenimientos')
      .max('folio_servicio as max_folio')
      .first();
    
    const nuevoFolio = (ultimoFolio.max_folio || 0) + 1;

    const [mantenimiento] = await trx('mantenimientos')
      .insert({
        folio_servicio: nuevoFolio,
        vehiculo_id: siniestro.vehiculo_id,
        tipo_servicio: 'Reparación por siniestro',
        fecha_programada: fecha_programada || db.fn.now(),
        kilometraje_servicio: vehiculo.kilometraje_actual,
        proximo_servicio_km: vehiculo.kilometraje_actual + 10000,
        estado: 'Programado',
        status: 'Todo',
        taller: taller || 'Por definir',
        observaciones: `Siniestro #${siniestro.folio_siniestro} - ${siniestro.descripcion || ''}\n${observaciones_adicionales || ''}`,
        costo_total: monto_estimado || siniestro.costo_estimado || 0,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    await trx('siniestros')
      .where('id', id)
      .update({
        mantenimiento_id: mantenimiento.id,
        estado: 'En proceso',
        updated_at: db.fn.now()
      });

    await trx.commit();

    res.status(201).json({
      success: true,
      message: 'Orden de mantenimiento creada y vinculada exitosamente',
      mantenimiento,
      siniestro_actualizado: {
        id: siniestro.id,
        folio_siniestro: siniestro.folio_siniestro,
        estado: 'En proceso',
        mantenimiento_id: mantenimiento.id
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en vincularMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al vincular mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// DISTRIBUIR GASTO DE SINIESTRO
// ============================================
exports.distribuirGastoSiniestro = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const {
      pagado_por_poliza = 0,
      pagado_por_empresa = 0,
      pagado_por_conductor = 0,
      pagado_por_seguro = 0,
      observaciones
    } = req.body;

    const siniestro = await trx('siniestros').where('id', id).first();
    
    if (!siniestro) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Siniestro no encontrado'
      });
    }

    if (siniestro.estado === 'Reportado') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'El siniestro debe estar en proceso para distribuir gastos'
      });
    }

    const poliza = parseFloat(pagado_por_poliza) || 0;
    const empresa = parseFloat(pagado_por_empresa) || 0;
    const conductor = parseFloat(pagado_por_conductor) || 0;
    const seguro = parseFloat(pagado_por_seguro) || 0;
    const costoTotal = parseFloat(siniestro.costo_final) || 0;

    if (costoTotal === 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'El siniestro debe tener un costo_final mayor a 0'
      });
    }

    const sumaDistribucion = poliza + empresa + conductor + seguro;

    if (Math.abs(sumaDistribucion - costoTotal) > 0.01) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: `La suma de la distribución ($${sumaDistribucion.toFixed(2)}) debe ser igual al costo final ($${costoTotal.toFixed(2)})`,
        datos: {
          costo_final: costoTotal,
          suma_distribucion: sumaDistribucion,
          diferencia: costoTotal - sumaDistribucion
        }
      });
    }

    const yaDistribuido = (siniestro.pagado_por_poliza || 0) + 
                         (siniestro.pagado_por_empresa || 0) + 
                         (siniestro.pagado_por_conductor || 0) + 
                         (siniestro.pagado_por_seguro || 0);

    if (yaDistribuido > 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este siniestro ya tiene una distribución de gastos'
      });
    }

    let detallePoliza = null;

    if (poliza > 0 && siniestro.vehiculo_id) {
      const vehiculoData = await trx('vehiculos')
        .where('id', siniestro.vehiculo_id)
        .first();

      if (vehiculoData) {
        const saldoActual = parseFloat(vehiculoData.poliza_mecanica || 0);
        const nuevoSaldo = saldoActual - poliza;

        if (nuevoSaldo < 0) {
          await trx.rollback();
          return res.status(400).json({
            success: false,
            message: `Saldo insuficiente en póliza. Disponible: $${saldoActual.toFixed(2)}, Requerido: $${poliza.toFixed(2)}`,
            saldo_disponible: saldoActual
          });
        }

        await trx('vehiculos')
          .where('id', siniestro.vehiculo_id)
          .update({
            poliza_mecanica: nuevoSaldo,
            updated_at: db.fn.now()
          });

        detallePoliza = {
          vehiculo_id: vehiculoData.id,
          vehiculo: vehiculoData.numero_vehiculo,
          saldo_previo: saldoActual,
          saldo_nuevo: nuevoSaldo,
          monto_descontado: poliza
        };
      }
    }

    if (empresa > 0) {
      const vehiculo = await trx('vehiculos')
        .where('id', siniestro.vehiculo_id)
        .first();

      if (vehiculo) {
        const inversion = await trx('inversiones_vehiculos')
          .where('numero_de_serie_vehiculo', vehiculo.numero_de_serie_vehiculo)
          .first();

        if (inversion) {
          await trx('inversiones_vehiculos')
            .where('id_inversion', inversion.id_inversion)
            .increment('otros_gastos', empresa);
        }
      }
    }

    const [siniestroActualizado] = await trx('siniestros')
      .where('id', id)
      .update({
        pagado_por_poliza: poliza,
        pagado_por_empresa: empresa,
        pagado_por_conductor: conductor,
        pagado_por_seguro: seguro,
        estado: 'Resuelto',
        fecha_resolucion: db.fn.now(),
        observaciones: observaciones || siniestro.observaciones,
        updated_at: db.fn.now()
      })
      .returning('*');

    await trx.commit();

    res.json({
      success: true,
      message: 'Distribución de gastos registrada exitosamente. Siniestro marcado como Resuelto.',
      siniestro: siniestroActualizado,
      impactos: {
        poliza_mecanica: poliza > 0,
        empresa_inversion: empresa > 0,
        deuda_conductor: conductor > 0,
        seguro_vehiculo: seguro > 0
      },
      detalle_poliza: detallePoliza
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en distribuirGastoSiniestro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al distribuir gastos del siniestro',
      error: error.message
    });
  }
};

module.exports = exports;
