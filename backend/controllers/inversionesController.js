// backend/controllers/inversionesController.js
const postgresService = require('../services/postgresService');
const { TABLES, db } = postgresService;
const inversionesService = require('../services/inversionesService');


// Calcular según modelo SI_LEGADO
exports.calcularSILegado = async (req, res) => {
  try {
    console.log('🧮 Calculando inversión modelo SI Legado...');
    const calculos = inversionesService.calcularInversionSILegado(req.body);
    
    res.json({
      success: true,
      calculos,
      modelo: 'SI_LEGADO'
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Calcular según modelo AUTOMANAGER
exports.calcularAutoManager = async (req, res) => {
  try {
    console.log('🧮 Calculando inversión modelo AutoManager...');
    const calculos = await inversionesService.calcularInversionAutoManager(req.body);
    
    res.json({
      success: true,
      calculos,
      modelo: 'AUTOMANAGER'
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Obtener/Actualizar multiplicador del sistema
exports.gestionarMultiplicador = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const valor = await inversionesService.obtenerParametro('multiplicador_corrida');
      res.json({
        success: true,
        multiplicador: valor || 2.82
      });
    } else if (req.method === 'PUT') {
      const { nuevoValor } = req.body;
      // Necesitamos usar db desde el service
      const { db } = require('../services/postgresService');
      
      await db('parametros_sistema')
        .where('clave', 'multiplicador_corrida')
        .update({ 
          valor: nuevoValor,
          updated_at: new Date()
        });
      
      res.json({
        success: true,
        message: 'Multiplicador actualizado',
        nuevoValor
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ========== FUNCIONES DE CÁLCULO CORREGIDAS ==========
const calcularInversion = (datos) => {
  const {
    valor_factura = 0,
    polizas = 0,
    placas = 0,
    gps = 0,
    otros_gastos = 0,
    renta_diaria = 0,
    plazo_meses = 62,
    tasa_rendimiento = 1.56,
    modelo = 'SI_LEGADO'
  } = datos;

  console.log('📊 Calculando con datos:', datos);

  // Inversión inicial
  const inversion_inicial = parseFloat(valor_factura || 0) + 
                           parseFloat(polizas || 0) + 
                           parseFloat(placas || 0) + 
                           parseFloat(gps || 0) + 
                           parseFloat(otros_gastos || 0);

  // Si la inversión es 0 o inválida, retornar valores en 0
  if (!inversion_inicial || inversion_inicial <= 0 || isNaN(inversion_inicial)) {
    return {
      inversion: 0,
      total_corrida: 0,
      socio_inversionista_rendimiento: 0,
      retorno_inversion: 0,
      utilidad_inversionista: 0,
      pago_mensual_inversionista: 0,
      utilidad_empresa: 0,
      total_pagar_inversionista: 0
    };
  }

  // Total que generará el vehículo por rentas
  const total_corrida = parseFloat(renta_diaria || 400) * 30 * parseInt(plazo_meses);

  let rendimiento_inversionista;
  let total_pagar_inversionista;
  let pago_mensual_inversionista;
  let retorno_inversion;

  // ✅ CORRECCIÓN: Para modelo SI_LEGADO (62 meses)
  // ✅ CORRECCIÓN: Para modelo SI_LEGADO (solo si es explícitamente SI_LEGADO)
if (modelo === 'SI_LEGADO') {    // La tasa 1.56 significa que recupera su inversión × 1.56
    // Es decir, 56% de ganancia TOTAL, no mensual
    total_pagar_inversionista = inversion_inicial * parseFloat(tasa_rendimiento || 1.56);
    rendimiento_inversionista = total_pagar_inversionista - inversion_inicial;
    pago_mensual_inversionista = total_pagar_inversionista / parseInt(plazo_meses);
    retorno_inversion = 56; // 56% total
  } else {
    // Para otros modelos (si los hay)
    // Aquí podrías usar interés mensual si es necesario
    rendimiento_inversionista = inversion_inicial * (parseFloat(tasa_rendimiento) / 100) * parseInt(plazo_meses);
    total_pagar_inversionista = inversion_inicial + rendimiento_inversionista;
    pago_mensual_inversionista = total_pagar_inversionista / parseInt(plazo_meses);
    retorno_inversion = (rendimiento_inversionista / inversion_inicial) * 100;
  }

  // Utilidad de la empresa
  const utilidad_empresa = total_corrida - total_pagar_inversionista;

  console.log('📊 Cálculos realizados:', {
    inversion_inicial,
    total_corrida,
    total_pagar_inversionista,
    pago_mensual_inversionista,
    utilidad_empresa
  });

  return {
    inversion: inversion_inicial,
    total_corrida,
    socio_inversionista_rendimiento: rendimiento_inversionista,
    retorno_inversion,
    utilidad_inversionista: rendimiento_inversionista,
    pago_mensual_inversionista,
    utilidad_empresa,
    total_pagar_inversionista
  };
};

// ========== CALCULAR INVERSIÓN (SIN GUARDAR) ==========
exports.calcularInversion = async (req, res) => {
  try {
    console.log('🧮 Calculando inversión...');
    console.log('Datos recibidos:', req.body);
    
    const calculos = calcularInversion(req.body);
    
    res.json({
      success: true,
      calculos,
      mensaje: 'Cálculo realizado (no guardado)'
    });
  } catch (error) {
    console.error('❌ Error calculando inversión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al calcular inversión',
      message: error.message
    });
  }
};

// ========== CREAR INVERSIÓN PARA VEHÍCULO ==========
exports.crearInversionVehiculo = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    console.log('💰 Creando inversión para vehículo...');
    console.log('📊 Datos recibidos:', req.body);
    
    const {
      numero_de_serie_vehiculo,
      inversionista_id,
      valor_factura,
      polizas,
      placas,
      gps,
      otros_gastos,
      renta_diaria,
      plazo_meses,
      tasa_rendimiento,
      fecha_inicio,
      modelo_negocio // ✅ AGREGAR ESTE CAMPO
    } = req.body;

    // Verificar que el vehículo existe
    const vehiculo = await trx('vehiculos')
      .where('numero_de_serie_vehiculo', numero_de_serie_vehiculo)
      .first();

    if (!vehiculo) {
      throw new Error(`Vehículo no encontrado con número de serie: ${numero_de_serie_vehiculo}`);
    }

    console.log('✅ Vehículo encontrado:', vehiculo.numero_vehiculo);
    console.log('🏷️ Modelo de negocio:', modelo_negocio); // ✅ LOG

    // Calcular montos con la lógica corregida
    const calculos = calcularInversion({
      valor_factura,
      polizas,
      placas,
      gps,
      otros_gastos,
      renta_diaria,
      plazo_meses,
      tasa_rendimiento,
      modelo: modelo_negocio || 'SD' // ✅ USAR EL MODELO RECIBIDO
    });

    console.log('📊 Cálculos realizados:', calculos);

    // Validar que los cálculos no tengan NaN
    if (isNaN(calculos.inversion) || isNaN(calculos.pago_mensual_inversionista)) {
      throw new Error('Error en los cálculos: valores inválidos');
    }

    // Crear registro en inversiones_vehiculos
    const fecha_final = new Date(fecha_inicio);
    fecha_final.setMonth(fecha_final.getMonth() + parseInt(plazo_meses));

    const datosInversion = {
      numero_de_serie_vehiculo,
      vehiculo: `${vehiculo.marca} ${vehiculo.modelo}`,
      modelo: vehiculo.modelo,
      numero_vehiculo: vehiculo.numero_vehiculo,
      inversionista_id: inversionista_id || null,
      fecha_de_inicio: fecha_inicio,
      fecha_final: fecha_final,
      plazo_en_meses: parseInt(plazo_meses),
      valor_factura: parseFloat(valor_factura) || 0,
      polizas: parseFloat(polizas) || 0,
      placas_valor: parseFloat(placas) || 0,
      gps: parseFloat(gps) || 0,
      otros_gastos: parseFloat(otros_gastos) || 0,
      inversion: calculos.inversion,
      renta: parseFloat(renta_diaria) || 400,
      total_corrida: calculos.total_corrida,
      socio_inversionista_rendimiento: calculos.socio_inversionista_rendimiento,
      pago_mensual_inversionista: calculos.pago_mensual_inversionista,
      plazo_para_inversionistas: parseInt(plazo_meses),
      utilidad_inversionista: calculos.utilidad_inversionista,
      retorno_inversion: calculos.retorno_inversion,
      utilidad_empresa: calculos.utilidad_empresa,
      tasa_rendimiento: parseFloat(tasa_rendimiento) || 1.56,
      fecha_inicio_inversion: fecha_inicio,
      status_inversion: 'Activa',
      total_recuperado: 0,
      por_recuperar: calculos.total_pagar_inversionista,
      modelo_negocio: modelo_negocio || 'SD' // ✅ USAR EL MODELO RECIBIDO
    };

    const [inversion] = await trx('inversiones_vehiculos')
      .insert(datosInversion)
      .returning('*');

    console.log('✅ Inversión creada con ID:', inversion.id_inversion);
    console.log('✅ Modelo guardado:', inversion.modelo_negocio); // ✅ LOG

    // Si hay inversionista, generar registros de pagos mensuales
    if (inversionista_id) {
      console.log('📅 Generando calendario de pagos...');
      
      for (let mes = 1; mes <= plazo_meses; mes++) {
        const fecha_pago = new Date(fecha_inicio);
        fecha_pago.setMonth(fecha_pago.getMonth() + mes);
        
        await trx('pagos_inversionistas')
          .insert({
            inversion_id: inversion.id_inversion,
            inversionista_id: inversionista_id,
            mes_pago: mes,
            fecha_programada: fecha_pago,
            monto_capital: calculos.inversion / plazo_meses,
            monto_rendimiento: calculos.socio_inversionista_rendimiento / plazo_meses,
            monto_total: calculos.pago_mensual_inversionista,
            status: 'Pendiente'
          });
      }
      
      console.log(`✅ ${plazo_meses} pagos programados`);
    } else {
      console.log('⚠️ No se generaron pagos - No hay inversionista asignado');
    }

    await trx.commit();
    
    res.status(201).json({
      success: true,
      inversion: inversion,
      mensaje: inversionista_id 
        ? 'Inversión creada y pagos programados exitosamente'
        : 'Inversión creada exitosamente. Asigna un inversionista para generar calendario de pagos.'
    });
  } catch (error) {
    await trx.rollback();
    console.error('❌ Error creando inversión:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear inversión',
      message: error.message
    });
  }
};

// ========== OBTENER INVERSIONES DE UN VEHÍCULO ==========
exports.getInversionesByVehiculo = async (req, res) => {
  try {
    const { numero_serie } = req.params;
    console.log('🔍 Buscando inversiones para vehículo:', numero_serie);
    
    // Usar query builder de Knex (más seguro y compatible)
    const inversiones = await db('inversiones_vehiculos as iv')
      .leftJoin('inversionistas as i', 'iv.inversionista_id', 'i.id')
      .where('iv.numero_de_serie_vehiculo', numero_serie)
      .select(
        'iv.*',
        'i.nombre as inversionista_nombre',
        'i.email as inversionista_email'
      );
    
    console.log(`✅ Encontradas ${inversiones.length} inversiones para ${numero_serie}`);
    
    res.json({
      success: true,
      inversiones: inversiones
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo inversiones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener inversiones',
      message: error.message
    });
  }
};

// ========== OBTENER PAGOS DE UNA INVERSIÓN ==========
exports.getPagosInversion = async (req, res) => {
  try {
    const { id } = req.params;
    
    const pagos = await db('pagos_inversionistas')
      .where('inversion_id', id)
      .orderBy('mes_pago');
    
    res.json({
      success: true,
      pagos
    });
  } catch (error) {
    console.error('❌ Error obteniendo pagos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pagos'
    });
  }
};

// ========== REGISTRAR PAGO ==========
exports.registrarPago = async (req, res) => {
  try {
    const { id } = req.params;
    const { mes_pago, monto_pagado, fecha_pago_real, metodo_pago, referencia_pago } = req.body;
    
    const [pago] = await db('pagos_inversionistas')
      .where('inversion_id', id)
      .where('mes_pago', mes_pago)
      .update({
        monto_pagado,
        fecha_pago_real,
        status: 'Pagado',
        metodo_pago,
        referencia_pago,
        updated_at: new Date()
      })
      .returning('*');
    
    res.json({
      success: true,
      pago,
      mensaje: 'Pago registrado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error registrando pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar pago'
    });
  }
};

// ========== CREAR INVERSIÓN COMPLETA (NUEVO FLUJO) ==========
exports.crearInversionCompleta = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    console.log('💰 Creando inversión completa para vehículo...');
    const {
      numero_serie_vehiculo,
      inversionista_id,
      modelo_negocio,
      calculos,
      formData
    } = req.body;

    // Verificar que el vehículo existe
    const vehiculo = await trx('vehiculos')
      .where('numero_de_serie_vehiculo', numero_serie_vehiculo)
      .first();

    if (!vehiculo) {
      throw new Error('Vehículo no encontrado');
    }

    // Preparar datos según el modelo de negocio
    let datosInversion = {
      numero_de_serie_vehiculo,
      vehiculo: `${vehiculo.marca} ${vehiculo.modelo}`,
      modelo: vehiculo.modelo,
      numero_vehiculo: vehiculo.numero_vehiculo,
      inversionista_id,
      modelo_negocio,
      valor_factura: parseFloat(formData.valorFactura || 0),
      polizas: parseFloat(formData.costoPoliza || 0) * 2,
      placas_valor: parseFloat(formData.placas || 0),
      gps: parseFloat(formData.gps || 0),
      otros_gastos: parseFloat(formData.otrosGastos || 0),
      inversion: calculos.inversionTotal,
      fecha_inicio_inversion: new Date(),
      status_inversion: 'Activa',
      total_recuperado: 0
    };

    if (modelo_negocio === 'SI_LEGADO') {
      // Modelo SI Legado - flujos fijos con lógica correcta
      const inversionTotal = datosInversion.inversion;
      const totalAPagar = inversionTotal * 1.56; // Recupera 1.56x
      const pagoMensual = totalAPagar / 62; // En 62 meses
      
      datosInversion = {
        ...datosInversion,
        renta: 400,
        total_corrida: 400 * 30 * 62, // Lo que genera el vehículo
        pago_mensual_inversionista: pagoMensual,
        utilidad_empresa: (400 * 30 * 62) - totalAPagar,
        por_recuperar: totalAPagar
      };
    } else {
      // Modelo AutoManager - valores calculados
      datosInversion = {
        ...datosInversion,
        renta: parseFloat(formData.rentaDiaria || 400),
        total_corrida: calculos.corridaTotal,
        utilidad_empresa: calculos.utilidadTotal,
        por_recuperar: calculos.corridaTotal,
        plazo_en_meses: calculos.plazoEstimadoMeses
      };
    }

    // Insertar la inversión
    const [inversion] = await trx('inversiones_vehiculos')
      .insert(datosInversion)
      .returning('*');

    // Si es SI_LEGADO, crear los pagos mensuales
    if (modelo_negocio === 'SI_LEGADO' && inversionista_id) {
      const pagoMensual = datosInversion.pago_mensual_inversionista;
      
      for (let mes = 1; mes <= 62; mes++) {
        const fecha_pago = new Date();
        fecha_pago.setMonth(fecha_pago.getMonth() + mes);
        
        await trx('pagos_inversionistas')
          .insert({
            inversion_id: inversion.id_inversion,
            inversionista_id,
            mes_pago: mes,
            fecha_programada: fecha_pago,
            monto_total: pagoMensual,
            status: 'Pendiente'
          });
      }
    }

    await trx.commit();
    
    res.status(201).json({
      success: true,
      inversion,
      message: `Inversión creada exitosamente con modelo ${modelo_negocio}`
    });
  } catch (error) {
    await trx.rollback();
    console.error('❌ Error creando inversión completa:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear inversión',
      message: error.message
    });
  }
};