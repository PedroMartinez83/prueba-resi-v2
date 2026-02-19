// backend/controllers/vehiculosController.js
const postgresService = require('../services/postgresService');
const auditService = require('../services/auditService');
const { getVehiculosEnumValues } = require('../utils/enumHelper');

// Obtener db y TABLES
const { db, TABLES } = postgresService;

const construirNumeroVehiculoEstandar = (tipoSocio, numeroUnidad, idFallback) => {
  const tipo = (tipoSocio || 'SD').toString().trim() || 'SD';
  const unidadNumerica = parseInt(numeroUnidad, 10);
  const unidadFallback = parseInt(idFallback, 10);

  const unidadFinal = Number.isInteger(unidadNumerica) && unidadNumerica > 0
    ? unidadNumerica
    : (Number.isInteger(unidadFallback) && unidadFallback > 0 ? unidadFallback : 0);

  return `${tipo}-${String(unidadFinal).padStart(4, '0')}`;
};

const obtenerNumeroVehiculoNormalizado = (record) => {
  const numeroActual = (record?.numero_vehiculo || '').toString().trim();
  const tipoSocio = record?.tipo_socio || 'SD';
  const numeroUnidad = record?.numero_unidad;
  const estandar = construirNumeroVehiculoEstandar(tipoSocio, numeroUnidad, record?.id);
  const unidadNumerica = parseInt(numeroUnidad, 10);

  if (Number.isInteger(unidadNumerica) && unidadNumerica > 0) {
    return estandar;
  }

  const matchEstandar = numeroActual.match(/^([A-Za-z]{2,})-(\d+)$/);
  if (matchEstandar) {
    return `${matchEstandar[1].toUpperCase()}-${String(parseInt(matchEstandar[2], 10)).padStart(4, '0')}`;
  }

  const matchSoloDigitos = numeroActual.match(/(\d+)/);
  if (matchSoloDigitos) {
    return `${(tipoSocio || 'SD').toString().trim()}-${String(parseInt(matchSoloDigitos[1], 10)).padStart(4, '0')}`;
  }

  return estandar;
};

// ========== MAPEO DE CAMPOS ==========
const mapearCamposVehiculo = (data) => {
  const mapeo = {
    'TipoSocio': 'tipo_socio',
    'NumeroUnidad': 'numero_unidad',
    'Marca': 'marca',
    'Modelo': 'modelo',
    'TipoVehiculo': 'tipo_vehiculo',
    'TipoCombustible': 'tipo_combustible',
    'Año': 'año_del_vehiculo',
    'Placa': 'placa',
    'Color': 'color',
    'NumeroSerie': 'numero_de_serie_vehiculo',
    'Estado': 'estado',
    'KilometrajeActual': 'kilometraje_actual',
    'ProximoMantenimiento': 'proximo_mantenimiento',
    'IntervaloMantenimiento': 'intervalo_mantenimiento',
    'FechaUltimoServicio': 'fecha_ultimo_servicio',
    'PolizaSeguro': 'poliza_seguro',
    'PolizaVencimiento': 'poliza_vencimiento',
    'MontoDeducible': 'monto_deducible',
    'Observaciones': 'observaciones',
    'NumeroVehiculo': 'numero_vehiculo',
    'NumeroMotor': 'numero_motor',
    'ConductorAsignadoId': 'conductor_asignado_id',
    'PolizaSeguroId': 'poliza_seguro_id',
    // 🆕 NUEVOS CAMPOS PARA SOCIO DUEÑO (SD)
    'total_corrida': 'total_corrida',
    'multiplicador_corrida': 'multiplicador_corrida',
    'plazo_corrida': 'plazo_corrida'
  };

  const resultado = {};
  for (const [key, value] of Object.entries(data)) {
    const campoPostgres = mapeo[key] || key.toLowerCase();
    
    // NO incluir foreign keys si son null, 0, o undefined
    if ((campoPostgres === 'poliza_seguro_id' || campoPostgres === 'conductor_asignado_id') && 
        (!value || value === null || value === 0)) {
      continue;
    }
    
    if (value !== '' && value !== null && value !== undefined) {
      resultado[campoPostgres] = value;
    }
  }
  return resultado;
};

const mapearCamposRespuestaVehiculo = (record) => {
  if (!record) return null;
  
  return {
  id: record.id,
  TipoSocio: record.tipo_socio || 'SD',
  NumeroUnidad: record.numero_unidad,
  NumeroVehiculo: obtenerNumeroVehiculoNormalizado(record),
  Marca: record.marca,
  Modelo: record.modelo,
  TipoVehiculo: record.tipo_vehiculo,
  TipoCombustible: record.tipo_combustible,
  Año: record.año_del_vehiculo,
  Placa: record.placa,
  Color: record.color,
  NumeroSerie: record.numero_de_serie_vehiculo,
  NumeroDeSerieVehiculo: record.numero_de_serie_vehiculo, // 🆕 ALIAS para frontend
  Estado: record.estado || 'Disponible',
  KilometrajeActual: record.kilometraje_actual || 0,
  ProximoMantenimiento: record.proximo_mantenimiento || 0,
  IntervaloMantenimiento: record.intervalo_mantenimiento || 5000,
  FechaUltimoServicio: record.fecha_ultimo_servicio,
  PolizaSeguro: record.poliza_seguro,
  PolizaVencimiento: record.poliza_vencimiento,
  MontoDeducible: record.monto_deducible || 0,
  Observaciones: record.observaciones,
  NumeroMotor: record.numero_motor,
  ConductorAsignadoId: record.conductor_asignado_id,
  PolizaSeguroId: record.poliza_seguro_id,
  
  // 🆕 CAMPOS DE SOCIO DUEÑO (SD) - CONTRATO
  total_corrida: record.total_corrida || null,
  multiplicador_corrida: record.multiplicador_corrida || null,
  plazo_corrida: record.plazo_corrida || null,
  
  // 🆕 CAMPOS DE PROGRESO SD
  total_pagado_corrida: parseFloat(record.total_pagado_corrida || 0),
  saldo_pendiente_corrida: parseFloat(record.saldo_pendiente_corrida || 0),
  porcentaje_pagado: parseFloat(record.porcentaje_pagado || 0),
  fecha_inicio_corrida: record.fecha_inicio_corrida || null,
  
  Conductores: record.conductores || [],
  created_at: record.created_at,
  updated_at: record.updated_at
};
};

// ========== OBTENER TODOS LOS VEHÍCULOS ==========
exports.getVehiculos = async (req, res) => {
  try {
    const vehiculos = await db('vehiculos as v')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'))
      })
      
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')

      .select(
        'v.*',
        'c.nombre_conductor',
        'c.numero_telefono as conductor_telefono',
        'a.renta_diaria',
        'a.abono_poliza_mantenimiento'
      )
      .orderBy('v.tipo_socio')
      .orderBy('v.numero_unidad');

    
    
    if (vehiculos.length === 0) {
      return res.json({
        success: true,
        vehiculos: [],
        message: 'No hay vehículos registrados en la base de datos'
      });
    }
    
    const vehiculosMapeados = vehiculos.map(v => {
      const vehiculoMapeado = mapearCamposRespuestaVehiculo(v);
      
      if (v.nombre_conductor) {
        vehiculoMapeado.ConductorInfo = {
          nombre: v.nombre_conductor,
          telefono: v.conductor_telefono,
          rentaDiaria: parseFloat(v.renta_diaria || 0),
          abonoPoliza: parseFloat(v.abono_poliza_mantenimiento || 0)
        };
      }
      
      return vehiculoMapeado;
    });
    
    res.json({
      success: true,
      vehiculos: vehiculosMapeados
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo vehículos: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener vehículos',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== OBTENER UN VEHÍCULO POR ID ==========
exports.getVehiculoById = async (req, res) => {
  try {
    const { id } = req.params;
    const vehiculoId = parseInt(id);
    
    if (isNaN(vehiculoId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de vehículo inválido'
      });
    }
    
    const existeVehiculo = await db('vehiculos')
      .where('id', vehiculoId)
      .select('id', 'numero_vehiculo', 'tipo_socio', 'numero_unidad')
      .first();
    
    if (!existeVehiculo) {
      return res.status(404).json({ 
        success: false,
        error: `Vehículo con ID ${vehiculoId} no encontrado`
      });
    }
    
    const numeroVehiculoActual = (existeVehiculo.numero_vehiculo || '').trim();
    const numeroVehiculoInvalido = !numeroVehiculoActual ||
      numeroVehiculoActual.startsWith('-') ||
      !numeroVehiculoActual.includes('-');

    if (numeroVehiculoInvalido) {
      const tipoSocio = existeVehiculo.tipo_socio || 'SD';
      const numeroUnidad = existeVehiculo.numero_unidad || vehiculoId;
      const numeroCorregido = `${tipoSocio}-${String(numeroUnidad).padStart(4, '0')}`;

      try {
        const numeroEnUso = await db('vehiculos')
          .where('numero_vehiculo', numeroCorregido)
          .whereNot('id', vehiculoId)
          .first('id');

        if (!numeroEnUso) {
          await db('vehiculos')
            .where('id', vehiculoId)
            .update({
              numero_vehiculo: numeroCorregido,
              updated_at: new Date()
            });
        }
      } catch (errorCorreccion) {
        console.warn(
          `[vehiculos] No se pudo autocorregir numero_vehiculo del vehiculo ${vehiculoId}: ${errorCorreccion.message}`
        );
      }
    }
    
    const vehiculo = await db('vehiculos as v')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'))
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .leftJoin('polizas_seguro as ps', 'v.poliza_seguro_id', 'ps.id')
      // ✅ Solo hacer JOIN con inversiones si NO es SD
.leftJoin('inversiones_vehiculos as iv', function() {
  this.on('v.numero_de_serie_vehiculo', '=', 'iv.numero_de_serie_vehiculo')
      .andOnNotIn('v.tipo_socio', ['SD', 'Socio Dueño']);
})      .leftJoin('inversionistas as i', 'iv.inversionista_id', 'i.id')
      .select(
        'v.*',
        'v.total_corrida as vehiculo_total_corrida',           // ✅ CORREGIDO: ALIAS ÚNICO
        'v.multiplicador_corrida as vehiculo_multiplicador',   // ✅ CORREGIDO: ALIAS ÚNICO
        'v.plazo_corrida as vehiculo_plazo',    
        'v.total_pagado_corrida',
  'v.saldo_pendiente_corrida',
  'v.porcentaje_pagado',
  'v.fecha_inicio_corrida',
  'a.id as asignacion_id',               // ✅ CORREGIDO: ALIAS ÚNICO
        'a.id as asignacion_id',
        'a.fecha_inicio as fecha_asignacion',
        'a.fecha_fin as fecha_fin_asignacion',
        'a.renta_diaria',
        'a.abono_poliza_mantenimiento',
        'a.url_contrato_digital',
        'c.id as conductor_id',
        'c.nombre_conductor',
        'c.numero_telefono as conductor_telefono',
        'c.email as conductor_email',
        'c.status as conductor_status',
        'c.status_trabajo as conductor_status_trabajo',
        'c.direccion_completa as conductor_direccion',
        'c.fecha_nacimiento as conductor_fecha_nacimiento',
        'c.numero_de_ine_ife as conductor_ine',
        'c.licencia_conducir as conductor_licencia',
        'c.licencia_vigencia as conductor_licencia_vigencia',
        'c.curp as conductor_curp',
        'c.rfc as conductor_rfc',
        'c.categoria as conductor_categoria',
        'c.deposito as conductor_deposito',
        'c.calificacion_promedio as conductor_calificacion',
        'c.saldo_ganancias as conductor_saldo_ganancias',
        'ps.aseguradora as aseguradora_poliza',
        'ps.numero_poliza as numero_poliza_completo',
        'ps.fecha_vencimiento as poliza_fecha_vencimiento',
        'iv.id_inversion',
        'iv.valor_factura',
        'iv.inversion',
        'iv.total_corrida as inversion_total_corrida',  // ✅ CORREGIDO: ALIAS DIFERENTE
        'iv.total_recuperado',
        'iv.por_recuperar',
        'iv.utilidad_empresa',
        'iv.modelo_negocio',
        'iv.status_inversion',
        'iv.fecha_inicio_inversion',
        'i.nombre as inversionista_nombre',
        'i.email as inversionista_email',
        'i.telefono as inversionista_telefono',
        'i.tasa_rendimiento'
      )
      .where('v.id', vehiculoId)
      .first();
    
    if (!vehiculo) {
      return res.status(404).json({ 
        success: false,
        error: 'Error al obtener detalles del vehículo' 
      });
    }

    const numeroVehiculoFinal = obtenerNumeroVehiculoNormalizado(vehiculo);

    const vehiculoMapeado = {
      id: vehiculo.id,
      TipoSocio: vehiculo.tipo_socio || 'SD',
      NumeroUnidad: vehiculo.numero_unidad || vehiculo.id,
      NumeroVehiculo: numeroVehiculoFinal,
      Marca: vehiculo.marca || 'Sin especificar',
      Modelo: vehiculo.modelo || 'Sin especificar',
      Aseguradora: vehiculo.aseguradora_poliza || null,
      NumeroPolizaCompleto: vehiculo.numero_poliza_completo || null,
      PolizaFechaVencimiento: vehiculo.poliza_fecha_vencimiento || null,
      TipoVehiculo: vehiculo.tipo_vehiculo || 'Sedan',
      TipoCombustible: vehiculo.tipo_combustible || 'Gasolina',
      Año: vehiculo.año_del_vehiculo || new Date().getFullYear(),
      Placa: vehiculo.placa || 'Sin placa',
      Color: vehiculo.color || 'Sin especificar',
      NumeroSerie: vehiculo.numero_de_serie_vehiculo,
      Estado: vehiculo.estado || 'Disponible',
      KilometrajeActual: vehiculo.kilometraje_actual || 0,
      ProximoMantenimiento: vehiculo.proximo_mantenimiento || 0,
      IntervaloMantenimiento: vehiculo.intervalo_mantenimiento || 5000,
      FechaUltimoServicio: vehiculo.fecha_ultimo_servicio,
      PolizaSeguro: vehiculo.poliza_seguro,
      PolizaVencimiento: vehiculo.poliza_vencimiento,
      MontoDeducible: vehiculo.monto_deducible || 0,
      Observaciones: vehiculo.observaciones,
      NumeroMotor: vehiculo.numero_motor,
      // ✅ CORREGIDO: USAR LOS ALIAS CORRECTOS
      total_corrida: vehiculo.vehiculo_total_corrida || null,
      multiplicador_corrida: vehiculo.vehiculo_multiplicador || null,
      plazo_corrida: vehiculo.vehiculo_plazo || null,
      created_at: vehiculo.created_at,
      updated_at: vehiculo.updated_at
    };
    
    if (vehiculo.conductor_id) {
      vehiculoMapeado.ConductorInfo = {
        id: vehiculo.conductor_id,
        nombre: vehiculo.nombre_conductor,
        telefono: vehiculo.conductor_telefono,
        email: vehiculo.conductor_email,
        status: vehiculo.conductor_status,
        statusTrabajo: vehiculo.conductor_status_trabajo,
        direccion: vehiculo.conductor_direccion,
        fechaNacimiento: vehiculo.conductor_fecha_nacimiento,
        ine: vehiculo.conductor_ine,
        licencia: vehiculo.conductor_licencia,
        licenciaVigencia: vehiculo.conductor_licencia_vigencia,
        curp: vehiculo.conductor_curp,
        rfc: vehiculo.conductor_rfc,
        categoria: vehiculo.conductor_categoria,
        deposito: parseFloat(vehiculo.conductor_deposito || 0),
        calificacion: parseFloat(vehiculo.conductor_calificacion || 0),
        saldoGanancias: parseFloat(vehiculo.conductor_saldo_ganancias || 0),
        fechaAsignacion: vehiculo.fecha_asignacion,
        fechaFinAsignacion: vehiculo.fecha_fin_asignacion,
        rentaDiaria: parseFloat(vehiculo.renta_diaria || 400),
        abonoPoliza: parseFloat(vehiculo.abono_poliza_mantenimiento || 100),
        urlContrato: vehiculo.url_contrato_digital,
        asignacionId: vehiculo.asignacion_id
      };
    } else {
      vehiculoMapeado.ConductorInfo = null;
    }
    
    if (vehiculo.id_inversion) {
      const totalRecuperado = parseFloat(vehiculo.total_recuperado || 0);
      const totalCorrida = parseFloat(vehiculo.inversion_total_corrida || 0);  // ✅ CORREGIDO: USAR ALIAS
      const porcentajeRecuperado = totalCorrida > 0 ? (totalRecuperado / totalCorrida * 100).toFixed(2) : 0;
      
      vehiculoMapeado.InversionInfo = {
        idInversion: vehiculo.id_inversion,
        valorFactura: parseFloat(vehiculo.valor_factura || 0),
        inversion: parseFloat(vehiculo.inversion || 0),
        totalCorrida: totalCorrida,
        totalRecuperado: totalRecuperado,
        porRecuperar: parseFloat(vehiculo.por_recuperar || 0),
        porcentajeRecuperado: parseFloat(porcentajeRecuperado),
        utilidadEmpresa: parseFloat(vehiculo.utilidad_empresa || 0),
        modeloNegocio: vehiculo.modelo_negocio || 'SD',
        statusInversion: vehiculo.status_inversion || 'Activa',
        fechaInicioInversion: vehiculo.fecha_inicio_inversion,
        inversionista: {
          nombre: vehiculo.inversionista_nombre,
          email: vehiculo.inversionista_email,
          telefono: vehiculo.inversionista_telefono,
          tasaRendimiento: parseFloat(vehiculo.tasa_rendimiento || 1.56)
        }
      };
    } else {
      vehiculoMapeado.InversionInfo = null;
    }
    
    res.json({
      success: true,
      vehiculo: vehiculoMapeado
    });
    
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo vehículo ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error interno al obtener el vehículo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== CREAR VEHÍCULO CON AUDITORÍA ==========
exports.createVehiculo = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    await auditService.setUserContext(trx, req.user);
    
    const datosPostgres = mapearCamposVehiculo(req.body);
    console.log('🔍 Datos mapeados que se insertarán:', datosPostgres);
    
    // 🆕 LOG DE CAMPOS SD
    if (datosPostgres.total_corrida || datosPostgres.multiplicador_corrida || datosPostgres.plazo_corrida) {
      console.log('🚗 Vehículo SD detectado con campos:', {
        total_corrida: datosPostgres.total_corrida,
        multiplicador_corrida: datosPostgres.multiplicador_corrida,
        plazo_corrida: datosPostgres.plazo_corrida
      });
    }
    
    if (datosPostgres.tipo_socio && datosPostgres.numero_unidad) {
      datosPostgres.numero_vehiculo = construirNumeroVehiculoEstandar(
        datosPostgres.tipo_socio,
        datosPostgres.numero_unidad
      );
    }
    
    const camposRequeridos = ['tipo_socio', 'numero_unidad', 'marca', 'modelo', 'placa'];
    const camposFaltantes = camposRequeridos.filter(campo => !datosPostgres[campo]);
    
    if (camposFaltantes.length > 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos faltantes',
        camposFaltantes
      });
    }
    
    Object.keys(datosPostgres).forEach(key => {
      if (typeof datosPostgres[key] === 'string') {
        datosPostgres[key] = datosPostgres[key].trim().replace(/^["']|["']$/g, '');
      }
    });
    
    datosPostgres.created_at = new Date();
    datosPostgres.updated_at = new Date();
    
    const [nuevoVehiculo] = await trx(TABLES.VEHICULOS)
      .insert(datosPostgres)
      .returning('*');
    
    console.log('✅ Vehículo creado en BD:', {
      id: nuevoVehiculo.id,
      numero_vehiculo: nuevoVehiculo.numero_vehiculo,
      tipo_socio: nuevoVehiculo.tipo_socio,
      total_corrida: nuevoVehiculo.total_corrida,
      multiplicador_corrida: nuevoVehiculo.multiplicador_corrida,
      plazo_corrida: nuevoVehiculo.plazo_corrida
    });
    
    await trx.commit();
    
    res.status(201).json({
      success: true,
      vehiculo: mapearCamposRespuestaVehiculo(nuevoVehiculo),
      message: 'Vehículo creado exitosamente'
    });
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error creando vehículo: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    if (error.code === '23505') {
      const constraint = (error.constraint || '').toLowerCase();
      let mensaje = 'Ya existe un vehículo con esa placa o número de serie';

      if (constraint.includes('vehiculos_numero_vehiculo_unique')) {
        mensaje = 'Ya existe un vehículo con ese número de vehículo';
      } else if (constraint.includes('placa')) {
        mensaje = 'Ya existe un vehículo con esa placa';
      } else if (constraint.includes('serie')) {
        mensaje = 'Ya existe un vehículo con ese número de serie';
      }

      return res.status(400).json({
        success: false,
        error: mensaje
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error al crear el vehículo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== ACTUALIZAR VEHÍCULO CON AUDITORÍA ==========
exports.updateVehiculo = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    
    await auditService.setUserContext(trx, req.user);
    
    const vehiculoAnterior = await trx(TABLES.VEHICULOS)
      .where('id', id)
      .first();
    
    if (!vehiculoAnterior) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Vehículo no encontrado'
      });
    }
    
    const datosPostgres = mapearCamposVehiculo(req.body);
    
    // ⚠️ IMPORTANTE: NO regenerar numero_vehiculo en modo edición
    // Si se intenta cambiar, mantener el original
    delete datosPostgres.numero_vehiculo;
    
    Object.keys(datosPostgres).forEach(key => {
      if (typeof datosPostgres[key] === 'string') {
        datosPostgres[key] = datosPostgres[key].trim().replace(/^["']|["']$/g, '');
      }
    });
    
    datosPostgres.updated_at = new Date();
    
    const [vehiculoActualizado] = await trx(TABLES.VEHICULOS)
      .where('id', id)
      .update(datosPostgres)
      .returning('*');
    
    if (vehiculoAnterior.estado !== vehiculoActualizado.estado || 
        vehiculoAnterior.conductor_asignado_id !== vehiculoActualizado.conductor_asignado_id) {
      
      await auditService.logCriticalChange({
        usuario_id: req.user.id,
        tipo_cambio: 'cambio_estado_vehiculo',
        descripcion: `Vehículo ${vehiculoActualizado.numero_vehiculo} cambió de estado`,
        datos_sensibles: {
          estado_anterior: vehiculoAnterior.estado,
          estado_nuevo: vehiculoActualizado.estado,
          conductor_anterior: vehiculoAnterior.conductor_asignado_id,
          conductor_nuevo: vehiculoActualizado.conductor_asignado_id
        },
        ip_address: auditService.getClientIp(req)
      });
    }
    
    await trx.commit();
    
    res.json({
      success: true,
      vehiculo: mapearCamposRespuestaVehiculo(vehiculoActualizado),
      message: 'Vehículo actualizado exitosamente'
    });
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error actualizando vehículo ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe otro vehículo con esa placa o número de serie'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error al actualizar el vehículo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== ELIMINAR VEHÍCULO CON AUDITORÍA ==========
// backend/controllers/vehiculosController.js
exports.deleteVehiculo = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;

    // 👇 AQUÍ VALIDAMOS QUE ESTEMOS AUTENTICADOS Y OBTENEMOS EL ROL
    // Si req.user no existe, es porque el middleware de auth falló o no se usó en la ruta
    if (!req.user || !req.user.rol) {
        await trx.rollback();
        return res.status(401).json({ error: 'No autorizado. Rol no identificado.' });
    }

    const rol = (req.user.rol || '').toLowerCase(); // Extraemos el rol normalizado
    console.log(`[DELETE] Usuario ${req.user.id} con rol ${rol} intenta borrar vehículo ${id}`);
    await auditService.setUserContext(trx, req.user);

    // 1. Validar existencia
    const vehiculo = await trx('vehiculos').where('id', id).first();
    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    if (vehiculo.estado === 'Baja') {
      await trx.rollback();
      return res.status(400).json({ error: 'El vehículo ya se encuentra en estado Baja.' });
    }

    if (vehiculo.estado === 'Solicitud_baja') {
      await trx.rollback();
      return res.status(400).json({ error: 'El vehículo ya tiene una solicitud de baja pendiente.' });
    }

    // 2. Validar relaciones (Igual que antes)
    const relacionesCount = await trx.raw(`
      SELECT 
        (SELECT COUNT(*) FROM asignaciones WHERE vehiculo_id = ? AND activa = true) as asignaciones,
        (SELECT COUNT(*) FROM rentas WHERE vehiculo_id = ? AND estado = 'Pendiente') as rentas,
        (SELECT COUNT(*) FROM mantenimientos WHERE vehiculo_id = ? AND estado != 'Completado') as mantenimientos
    `, [id, id, id]);

    const counts = relacionesCount.rows[0];
    const numAsignaciones = parseInt(counts.asignaciones);
    const numRentas = parseInt(counts.rentas);
    const numMantenimientos = parseInt(counts.mantenimientos);

    if (numAsignaciones > 0 || numRentas > 0 || numMantenimientos > 0) {
      await trx.rollback();
      return res.status(400).json({ 
        error: `No se puede procesar: Tiene ${numAsignaciones} asignación, ${numRentas} rentas o ${numMantenimientos} mantenimientos activos.` 
      });
    }

    // 3. LÓGICA DE ROLES 🚦
    
    // Coordinador elimina directamente (Baja). Solo jefe_taller genera solicitud.
    const rolesSolicitudBaja = new Set(['jefe_taller']);

    if (rolesSolicitudBaja.has(rol)) {
        // CASO A: Jefe de Taller -> SOLICITUD
        await trx('vehiculos')
          .where('id', id)
          .update({
            estado: 'Solicitud_baja', 
            updated_at: new Date()
          });

        if (typeof auditService !== 'undefined') {
            await auditService.logCriticalChange({
              usuario_id: req.user.id,
              tipo_cambio: 'SOLICITUD_BAJA_VEHICULO',
              descripcion: `Solicitud de baja para vehículo ${vehiculo.placa || vehiculo.placas}`,
              datos_sensibles: { vehiculo_id: id, estado_nuevo: 'Solicitud_baja' },
              ip_address: req.ip 
            });
        }
        
        await trx.commit();
        // Mensaje específico para el frontend sepa que fue solicitud
        return res.json({ success: true, message: 'Solicitud de baja enviada para aprobacion.' });

    } else {
        // CASO B: Admin, Director, etc. -> BAJA DIRECTA
        await trx('vehiculos')
          .where('id', id)
          .update({
            estado: 'Baja',
            updated_at: new Date()
          });

        if (typeof auditService !== 'undefined') {
            await auditService.logCriticalChange({
              usuario_id: req.user.id,
              tipo_cambio: 'DELETE_VEHICULO_LOGICO',
              descripcion: `Vehículo ${vehiculo.placa || vehiculo.placas} dado de BAJA DIRECTA.`,
              datos_sensibles: { vehiculo_id: id, estado_nuevo: 'Baja' },
              ip_address: req.ip 
            });
        }

        await trx.commit();
        return res.json({ success: true, message: 'Vehículo dado de baja exitosamente.' });
    }

  } catch (error) {
    await trx.rollback();
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error procesando baja vehiculo ${req.params?.id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    console.error('Error al procesar baja:', error);
    res.status(500).json({
      error: 'Error interno',
      message: 'No fue posible procesar la baja del vehiculo.',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== PROCESAR SOLICITUD DE BAJA (APROBAR/RECHAZAR) ==========
exports.procesarSolicitudBaja = async (req, res) => {
  const trx = await db.transaction();
  try {
    if (!req.user || !req.user.rol) {
      await trx.rollback();
      return res.status(401).json({ error: 'No autorizado. Rol no identificado.' });
    }

    const { id } = req.params;
    const accion = (req.body?.accion || '').toLowerCase().trim(); // Esperamos 'aprobar' o 'rechazar'
    await auditService.setUserContext(trx, req.user);

    const vehiculo = await trx('vehiculos').where('id', id).first();
    
    if (!vehiculo || vehiculo.estado !== 'Solicitud_baja') {
      await trx.rollback();
      return res.status(400).json({ error: 'El vehículo no tiene una solicitud de baja pendiente.' });
    }

    let nuevoEstado = '';
    let mensaje = '';

    if (accion === 'aprobar') {
        nuevoEstado = 'Baja';
        mensaje = 'Solicitud APROBADA. Vehículo dado de baja.';
    } else if (accion === 'rechazar') {
        // Regresamos al estado seguro 'Disponible' (ya que deleteVehiculo verificó que no tenía asignaciones)
        nuevoEstado = 'Disponible'; 
        mensaje = 'Solicitud RECHAZADA. El vehículo vuelve a estar Disponible.';
    } else {
        await trx.rollback();
        return res.status(400).json({ error: 'Acción inválida' });
    }

    // Actualizamos
    await trx('vehiculos')
      .where('id', id)
      .update({
        estado: nuevoEstado,
        updated_at: new Date()
      });

    // Auditoría de la decisión
    if (typeof auditService !== 'undefined') {
        await auditService.logCriticalChange({
          usuario_id: req.user.id,
          tipo_cambio: accion === 'aprobar' ? 'APROBACION_BAJA' : 'RECHAZO_BAJA',
          descripcion: `Solicitud de baja ${accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA'} para ${vehiculo.placas}`,
          datos_sensibles: { vehiculo_id: id, decision: accion, estado_final: nuevoEstado },
          ip_address: req.ip 
        });
    }

    await trx.commit();
    res.json({ success: true, message: mensaje });

  } catch (error) {
    await trx.rollback();
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error procesando solicitud de baja vehiculo ${req.params?.id}: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    console.error('Error procesando solicitud:', error);
    res.status(500).json({
      error: 'Error interno',
      message: 'No fue posible procesar la solicitud de baja.',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// ========== OTRAS FUNCIONES ==========
exports.getOpcionesVehiculos = async (req, res) => {
  try {
    const opciones = {
      tipoSocio: ['SD', 'SI', 'SA'],
      tipoVehiculo: ['Sedan', 'SUV', 'Pickup', 'Van', 'Hatchback', 'Compacto'],
      tipoCombustible: ['Gasolina', 'Eléctrico', 'Híbrido', 'Diesel'],
      color: ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Tinto'],
      estado: ['Disponible', 'Rentado', 'Mantenimiento', 'Baja', 'Siniestro', 'Asignado'],
      marcas: ['Nissan', 'BYD', 'Toyota', 'Honda', 'Mazda', 'Volkswagen'],
      modelos: ['Versa', 'March', 'V-Drive', 'Dolphin Mini', 'Sentra', 'Altima']
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

exports.getEstadisticasVehiculos = async (req, res) => {
  try {
    const estadisticas = await db('vehiculos')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(CASE WHEN estado = 'Disponible' THEN 1 END) as disponibles"),
        db.raw("COUNT(CASE WHEN estado = 'Rentado' THEN 1 END) as rentados"),
        db.raw("COUNT(CASE WHEN estado = 'Mantenimiento' THEN 1 END) as en_mantenimiento"),
        db.raw("COUNT(CASE WHEN estado = 'Siniestro' THEN 1 END) as siniestrados"),
        db.raw("COUNT(CASE WHEN estado = 'Baja' THEN 1 END) as dados_baja"),
        db.raw("COUNT(CASE WHEN estado = 'Asignado' THEN 1 END) as asignados"),
        db.raw('AVG(kilometraje_actual) as kilometraje_promedio')
      )
      .first();
    
    const conductoresAsignados = await db('asignaciones')
      .where('activa', true)
      .count('id as count')
      .first();
    
    const stats = {
      total: parseInt(estadisticas.total || 0),
      disponibles: parseInt(estadisticas.disponibles || 0),
      rentados: parseInt(estadisticas.rentados || 0),
      en_mantenimiento: parseInt(estadisticas.en_mantenimiento || 0),
      siniestrados: parseInt(estadisticas.siniestrados || 0),
      dados_baja: parseInt(estadisticas.dados_baja || 0),
      asignados: parseInt(estadisticas.asignados || 0),
      kilometraje_promedio: Math.round(parseFloat(estadisticas.kilometraje_promedio || 0)),
      con_conductor: parseInt(conductoresAsignados?.count || 0)
    };
    
    res.json({
      success: true,
      estadisticas: stats
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo estadísticas: ${error.message}`,
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

exports.asignarConductor = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { conductorId, rentaDiaria, abonoPoliza, fechaInicio, urlContrato } = req.body;
    
    await auditService.setUserContext(trx, req.user);
    
    const vehiculo = await trx('vehiculos')
      .where('id', id)
      .first();
    
    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Vehículo no encontrado'
      });
    }
    
    const conductor = await trx('conductores')
      .where('id', conductorId)
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

    const asignacionVehiculoActiva = await trx('asignaciones')
      .where('vehiculo_id', id)
      .where('activa', true)
      .first();

    const asignacionConductorActiva = await trx('asignaciones')
      .where('conductor_id', conductorId)
      .where('activa', true)
      .first();

    await trx('asignaciones')
      .where('vehiculo_id', id)
      .where('activa', true)
      .update({
        activa: false,
        fecha_fin: new Date(),
        updated_at: new Date()
      });

    await trx('asignaciones')
      .where('conductor_id', conductorId)
      .where('activa', true)
      .update({
        activa: false,
        fecha_fin: new Date(),
        updated_at: new Date()
      });

    if (asignacionConductorActiva && String(asignacionConductorActiva.vehiculo_id) !== String(id)) {
      await trx('vehiculos')
        .where('id', asignacionConductorActiva.vehiculo_id)
        .update({
          estado: 'Disponible',
          conductor_asignado_id: null,
          updated_at: new Date()
        });
    }
    
    const [nuevaAsignacion] = await trx('asignaciones')
      .insert({
        conductor_id: conductorId,
        vehiculo_id: id,
        fecha_inicio: fechaInicio || new Date(),
        renta_diaria: rentaDiaria || 400,
        abono_poliza_mantenimiento: abonoPoliza || 100,
        url_contrato_digital: urlContrato || null,
        activa: true,
        updated_at: new Date()
      })
      .returning('*');
    
    await trx('vehiculos')
      .where('id', id)
      .update({
        estado: 'Asignado',
        conductor_asignado_id: conductorId,
        updated_at: new Date()
      });

    await trx('conductores')
      .where('id', conductorId)
      .update({
        status: 'Activo',
        status_trabajo: 'activo',
        updated_at: new Date()
      });

    if (asignacionVehiculoActiva && String(asignacionVehiculoActiva.conductor_id) !== String(conductorId)) {
      await trx('conductores')
        .where('id', asignacionVehiculoActiva.conductor_id)
        .update({
          status: 'Inactivo',
          status_trabajo: 'inactivo',
          updated_at: new Date()
        });
    }
    
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'asignacion_conductor',
      descripcion: `Conductor ${conductor.nombre_conductor} asignado a vehículo ${vehiculo.numero_vehiculo}`,
      datos_sensibles: {
        conductor_id: conductorId,
        vehiculo_id: id,
        renta_diaria: rentaDiaria,
        abono_poliza: abonoPoliza
      },
      ip_address: auditService.getClientIp(req)
    });
    
    await trx.commit();
    
    res.json({
      success: true,
      message: 'Conductor asignado exitosamente',
      asignacion: nuevaAsignacion
    });
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error asignando conductor: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al asignar conductor',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.desasignarConductor = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    
    await auditService.setUserContext(trx, req.user);
    
    const asignacion = await trx('asignaciones')
      .where('vehiculo_id', id)
      .where('activa', true)
      .first();
    
    if (!asignacion) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'No hay asignación activa para este vehículo'
      });
    }
    
    await trx('asignaciones')
      .where('vehiculo_id', id)
      .where('activa', true)
      .update({
        activa: false,
        fecha_fin: new Date(),
        updated_at: new Date()
      });
    
    await trx('vehiculos')
      .where('id', id)
      .update({
        estado: 'Disponible',
        conductor_asignado_id: null,
        updated_at: new Date()
      });

    await trx('conductores')
      .where('id', asignacion.conductor_id)
      .update({
        status: 'Inactivo',
        status_trabajo: 'inactivo',
        updated_at: new Date()
      });
    
    await trx.commit();
    
    res.json({
      success: true,
      message: 'Conductor desasignado exitosamente'
    });
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error desasignando conductor: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al desasignar conductor',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getPolizasSeguro = async (req, res) => {
  try {
    const polizas = await db('polizas_seguro')
      .select('id', 'numero_poliza', 'aseguradora', 'fecha_vencimiento')
      .orderBy('aseguradora', 'asc');
    
    res.json({
      success: true,
      polizas
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo pólizas: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener pólizas',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// ========== OBTENER VEHÍCULOS DISPONIBLES (SIN CONDUCTOR) ==========
exports.getVehiculosDisponibles = async (req, res) => {
  try {
    const vehiculos = await db('vehiculos as v')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'))
      })
      .whereNull('a.id') // No tiene asignación activa
      .where('v.estado', 'Disponible')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.numero_unidad',
        'v.marca',
        'v.modelo',
        'v.año_del_vehiculo as año',
        'v.placa',
        'v.color',
        'v.tipo_vehiculo',
        'v.tipo_socio',
        'v.estado',
        'v.kilometraje_actual'
      )
      .orderBy('v.tipo_socio')
      .orderBy('v.numero_unidad');
    
    const vehiculosNormalizados = vehiculos.map(v => ({
      ...v,
      numero_vehiculo: obtenerNumeroVehiculoNormalizado(v)
    }));

    res.json({
      success: true,
      vehiculos: vehiculosNormalizados,
      total: vehiculosNormalizados.length
    });
    
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo vehículos disponibles: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener vehículos disponibles',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
module.exports = exports;
