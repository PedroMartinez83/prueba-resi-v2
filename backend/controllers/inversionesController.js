// backend/controllers/inversionesController.js
const postgresService = require('../services/postgresService');
const { TABLES, db } = postgresService;
const inversionesService = require('../services/inversionesService');
const { calcularFiniquitoFinal } = require('../utils/calculosLegales');


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

// ========== 1. LA CALCULADORA MAESTRA (PURA Y MATEMÁTICA) ==========
const calcularInversion = (datos) => {
  let {
    monto_inversion, 
    renta_diaria, // 👈 Ahora lo recibirá directamente del backend (BD)
    modelo = 'SI_LEGADO'
  } = datos;

  console.log(`📊 Calculando matemáticas para el plan: ${modelo} con inversión de $${monto_inversion}`);

  const capital_cliente = parseFloat(monto_inversion || 0);

  // 1. Regla de negocio: Mínimo $20,000
  if (capital_cliente < 20000) {
    throw new Error('El monto mínimo de inversión debe ser de $20,000 pesos.');
  }

  // 2. Variables a calcular
  let meses = 0;
  let pago_mensual = 0;
  let monto_total_contrato = 0;
  let multiplicador = 0;

  // 3. Reglas según el Plan
  switch (modelo.toUpperCase()) {
    case 'SI_LEGADO':
      meses = 62;
      multiplicador = 0; 
      pago_mensual = 8000; 
      monto_total_contrato = pago_mensual * meses; 
      break;
      
    case 'PLUS_60':
      meses = 53; 
      multiplicador = 1.60; 
      monto_total_contrato = capital_cliente * multiplicador; 
      pago_mensual = monto_total_contrato / meses; 
      break;
      
    case 'SMART_40':
      meses = 35; 
      multiplicador = 1.40; 
      monto_total_contrato = capital_cliente * multiplicador; 
      pago_mensual = monto_total_contrato / meses; 
      break;
      
    default:
      throw new Error('Plan de inversión no reconocido. Use SI_LEGADO, PLUS_60 o SMART_40');
  }

  // 4. Cálculos finales del Inversionista
  const ganancia_neta_inversionista = monto_total_contrato - capital_cliente; 

  // 5. 🏢 CÁLCULO DE LA EMPRESA CON LA RENTA REAL
  // Usamos la renta_diaria que viene de la BD. Si por alguna razón no hay, usamos 400 de colchón.
  const rentaReal = parseFloat(renta_diaria || 400); 
  const ingreso_total_empresa = (rentaReal * 26) * meses;
  const utilidad_estimada_empresa = ingreso_total_empresa - monto_total_contrato;

  return {
    monto_invertido: capital_cliente,
    monto_total_contrato: monto_total_contrato,
    pago_mensual: pago_mensual,
    utilidad_estimada_empresa: utilidad_estimada_empresa,
    plazo_meses: meses,
    renta_diaria_utilizada: rentaReal, // 👈 Lo regresamos para que el Frontend sepa qué número usó
    tasa_rendimiento: multiplicador, 
    rendimiento_puro: ganancia_neta_inversionista
  };
};

// ========== CALCULAR INVERSIÓN (ENDPOINT QUE CONSULTA LA BD) ==========
exports.calcularInversion = async (req, res) => {
  try {
    console.log('🧮 Simulando inversión desde el Frontend...');
    
    // 1. Extraemos los datos que manda el Frontend
    const { vehiculo_id, monto_inversion, modelo } = req.body;
    let renta_sugerida_vehiculo = req.body.renta_diaria || 400; // Valor por defecto

    // 2. 🕵️‍♂️ MAGIA: Si nos mandaron un ID de vehículo, vamos a la BD a sacar su renta real
    if (vehiculo_id) {
      // (Asegúrate de que 'db' esté importado en la parte de arriba de tu archivo)
      const vehiculo = await db('vehiculos').where('id', vehiculo_id).first();
      
      if (vehiculo && vehiculo.renta_sugerida) {
        renta_sugerida_vehiculo = parseFloat(vehiculo.renta_sugerida);
        console.log(`🚗 Vehículo encontrado. Usando renta sugerida: $${renta_sugerida_vehiculo}`);
      }
    }

    // 3. Preparamos los datos inyectando la renta real
    const datosParaCalcular = {
      ...req.body,
      renta_diaria: renta_sugerida_vehiculo
    };

    // 4. Pasamos los datos a nuestra función matemática
    const calculos = calcularInversion(datosParaCalcular);
    
    res.json({
      success: true,
      calculos,
      mensaje: 'Cálculo realizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error calculando inversión:', error);
    res.status(400).json({ 
      success: false,
      error: 'Error al calcular inversión',
      message: error.message
    });
  }
};

// ========== 2. EL CREADOR DE CONTRATOS (MODO TRANSACCIONAL) ==========
exports.crearInversionVehiculo = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    console.log('💰 Creando nuevo contrato en contratos_inversion...');
    
    // Recibimos los datos del frontend
    const {
      vehiculo_id,
      numero_serie_vehiculo,
      numero_de_serie_vehiculo,
      numero_vehiculo,
      inversionista_id, 
      monto_inversion, 
      renta_diaria, 
      plazo_meses, 
      tasa_rendimiento, 
      fecha_inicio, 
      modelo_negocio
    } = req.body;

    // 1. BUSCADOR TODOTERRENO DEL VEHÍCULO
    let vehiculo = null;

    if (vehiculo_id) {
      vehiculo = await trx('vehiculos').where('id', vehiculo_id).first();
    } else if (numero_serie_vehiculo || numero_de_serie_vehiculo) {
      const serie = numero_serie_vehiculo || numero_de_serie_vehiculo;
      vehiculo = await trx('vehiculos').where('numero_de_serie_vehiculo', serie).first();
    } else if (numero_vehiculo) {
      vehiculo = await trx('vehiculos').where('numero_vehiculo', numero_vehiculo).first();
    }

    // 🚨 REGLA DE NEGOCIO: SI_LEGADO requiere carro
    if (modelo_negocio === 'SI_LEGADO' && !vehiculo) {
      throw new Error('El modelo SI Legado requiere asignar un vehículo. Selecciona uno válido.');
    }

    // La renta diaria será la del carro de la BD, o la que mande el front, o 400 por defecto
    const rentaDiariaFinal = vehiculo?.renta_sugerida || renta_diaria || 400;

    // 2. CORRER LA CALCULADORA MAESTRA (¡Aquí ocurre la magia de los $8,000!)
    // *Asumo que tienes importada/declarada tu función calcularInversion arriba*
    const calculos = calcularInversion({
      monto_inversion, 
      renta_diaria: rentaDiariaFinal,
      modelo: modelo_negocio
    });

    console.log('🧮 Resultados de la calculadora (Revisa que diga 8000 en pago_mensual):', calculos);

    // 3. Preparar las fechas (Corregido para evitar el salto de zona horaria)
    let fechaInicioDB;
    if (fecha_inicio) {
      // Tomamos solo la parte de la fecha (YYYY-MM-DD) y le clavamos las 12 del mediodía
      const fechaLimpia = fecha_inicio.split('T')[0]; 
      fechaInicioDB = new Date(`${fechaLimpia}T12:00:00`);
    } else {
      fechaInicioDB = new Date();
    }
    
    const fechaFinDB = new Date(fechaInicioDB);
    fechaFinDB.setMonth(fechaFinDB.getMonth() + calculos.plazo_meses);

    // 4. Inserción en contratos_inversion
    const datosContrato = {
      inversionista_id: inversionista_id || null,
      vehiculo_id: vehiculo ? vehiculo.id : null,
      modelo_negocio: modelo_negocio || 'SI_LEGADO',
      monto_invertido: parseFloat(calculos.monto_invertido.toFixed(2)), 
      tasa_rendimiento: parseFloat(calculos.tasa_rendimiento || 0),
      monto_total_contrato: parseFloat(calculos.monto_total_contrato.toFixed(2)),
      pago_mensual: parseFloat(calculos.pago_mensual.toFixed(2)),
      plazo_meses: calculos.plazo_meses,
      utilidad_estimada_empresa: parseFloat(calculos.utilidad_estimada_empresa.toFixed(2)),
      
      // 🚨 ARRANCA LIMPIO: 0 pagado, todo pendiente
      total_pagado: 0,
      saldo_pendiente: parseFloat(calculos.monto_total_contrato.toFixed(2)),
      porcentaje_pagado: 0,
      
      fecha_inicio: fechaInicioDB,
      fecha_fin_estimada: fechaFinDB,
      status: 'Activa', 
      created_at: new Date(),
      updated_at: new Date()
    };

    const [nuevoContrato] = await trx('contratos_inversion')
      .insert(datosContrato)
      .returning('*');

    // ✂️ ELIMINAMOS EL PASO 5 (Generador de calendario) ✂️
    // La tabla pagos_inversionistas se llenará a medida que el admin registre pagos reales.

    // 5. Confirmamos la transacción
    await trx.commit();
    
    res.status(201).json({
      success: true,
      inversion: nuevoContrato,
      mensaje: '✅ Contrato creado exitosamente'
    });

  } catch (error) {
    await trx.rollback();
    console.error('❌ Error creando contrato:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear contrato de inversión',
      message: error.message
    });
  }
};

// ========== ELIMINAR CONTRATO (BORRADO LÓGICO) ==========
exports.eliminarInversion = async (req, res) => {
  const { id } = req.params; // ID del contrato

  try {
    // 1. Verificamos que el contrato exista
    const contrato = await db('contratos_inversion').where('id', id).first();

    if (!contrato) {
      return res.status(404).json({ success: false, message: 'El contrato especificado no existe.' });
    }

    if (contrato.status === 'Eliminado') {
      return res.status(400).json({ success: false, message: 'Este contrato ya se encuentra eliminado.' });
    }

    // 2. Ejecutamos el borrado lógico
    await db('contratos_inversion')
      .where('id', id)
      .update({
        status: 'Eliminado',
        updated_at: new Date()
      });

    // 3. Respondemos al cliente
    res.json({ 
      success: true, 
      message: '🗑️ Contrato eliminado correctamente.' 
    });

  } catch (error) {
    console.error('❌ Error al eliminar contrato:', error);
    res.status(500).json({ success: false, message: 'Error interno al intentar eliminar el contrato.' });
  }
};

exports.getInversionesByVehiculo = async (req, res) => {
  try {
    // 🚨 TRUCO NIVEL DIOS: Extraemos el primer parámetro de la URL
    const parametros = Object.values(req.params);
    const identificador = parametros.length > 0 ? parametros[0] : null;
    
    console.log('🔍 Buscando contratos para vehículo:', identificador);

    if (!identificador) {
      return res.status(400).json({ success: false, message: 'No se envió el identificador del vehículo' });
    }

    // 1. Buscamos el carro y ¡AQUÍ AGREGAMOS LOS CAMPOS NUEVOS! 
    const vehiculo = await db('vehiculos')
      .select(
        'id', 
        'porcentaje_pagado', 
        'saldo_pendiente_corrida', 
        'total_pagado_corrida'
      )
      .where('numero_de_serie_vehiculo', identificador)
      .orWhere('numero_vehiculo', identificador)
      .first();

    if (!vehiculo) {
      return res.json({ success: true, inversiones: [] });
    }

    // 2. Buscamos contratos asociados al vehiculo_id
    const inversiones = await db('contratos_inversion as c')
      .leftJoin('inversionistas as i', 'c.inversionista_id', 'i.id') 
      .where('c.vehiculo_id', vehiculo.id)
      .select(
        'c.*', 
        'i.nombre as inversionista_nombre',
        'i.email as inversionista_email'
      );

    // 3. El Traductor
    const inversionesFormateadas = inversiones.map((inv) => {
      return {
        ...inv,
        id_inversion: inv.id, 
        total_corrida: parseFloat(inv.monto_total_contrato || 0),
        total_recuperado: parseFloat(inv.total_pagado || 0),
        por_recuperar: parseFloat(inv.saldo_pendiente || 0),
        porcentaje_recuperado: parseFloat(inv.porcentaje_pagado || 0),
        
        monto_invertido: parseFloat(inv.monto_invertido || 0),
        monto_total_contrato: parseFloat(inv.monto_total_contrato || 0),
        total_pagado: parseFloat(inv.total_pagado || 0),
        saldo_pendiente: parseFloat(inv.saldo_pendiente || 0),
        porcentaje_pagado: parseFloat(inv.porcentaje_pagado || 0)
      };
    });
    
    //  AQUÍ MANDAMOS LOS DATOS DEL CARRO AL FRONTEND
    res.json({ 
      success: true, 
      vehiculo_stats: {
        porcentaje_pagado: parseFloat(vehiculo.porcentaje_pagado || 0),
        saldo_pendiente_corrida: parseFloat(vehiculo.saldo_pendiente_corrida || 0),
        total_pagado_corrida: parseFloat(vehiculo.total_pagado_corrida || 0)
      },
      inversiones: inversionesFormateadas 
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo contratos:', error);
    res.status(500).json({ success: false, error: 'Error interno', message: error.message });
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

// ========== REGISTRAR NUEVO PAGO (MODELO TRANSACCIONAL BLINDADO) ==========
exports.registrarPagoInversion = async (req, res) => {
  const { id } = req.params; // Este es el inversion_id
  const { 
    monto_total, 
    numero_cuota, 
    fecha_pago_real, 
    metodo_pago, 
    referencia_pago, 
    observaciones,
    comprobante_url,
    meses_a_pagar // 🚀 NUEVO: Cuántos meses vamos a registrar de golpe
  } = req.body;
  
  const adminId = req.user.id; 

  try {
    if (!monto_total || !numero_cuota || !fecha_pago_real) {
      return res.status(400).json({ 
        success: false, 
        message: 'El monto, número de cuota y fecha son obligatorios.' 
      });
    }

    const pagoBaseFloat = parseFloat(monto_total);
    // Asegurarnos de que sea al menos 1 mes
    const cantidadMeses = Math.max(1, parseInt(meses_a_pagar) || 1); 
    // Multiplicamos para descontar del contrato correctamente
    const pagoTotalTransaccion = pagoBaseFloat * cantidadMeses; 

    await db.transaction(async (trx) => {
      // A) Consultar contrato
      const contrato = await trx('contratos_inversion').where('id', id).first();
      if (!contrato) throw new Error('Contrato de inversión no encontrado.');

      // B.1) Buscar la última cuota real
      const ultimoPago = await trx('pagos_inversionistas')
        .where('inversion_id', id)
        .orderBy('numero_cuota', 'desc')
        .first();

      const cuotaInicial = ultimoPago ? (ultimoPago.numero_cuota + 1) : 1;

      // 🚀 B.2) PREPARAR EL BATCH DE PAGOS (1 o Múltiples)
      const pagosAInsertar = [];
      for (let i = 0; i < cantidadMeses; i++) {
        pagosAInsertar.push({
          inversion_id: id,
          numero_cuota: cuotaInicial + i, // Sucesión automática: 1, 2, 3...
          monto_total: pagoBaseFloat, // El monto individual
          fecha_pago_real: fecha_pago_real, // Mismo ticket y fecha para todos
          metodo_pago: metodo_pago || 'Transferencia',
          referencia_pago: referencia_pago || null,
          observaciones: observaciones ? `${observaciones} (Pago en bloque)` : 'Registro de historial en bloque',
          comprobante_url: comprobante_url || null,
          status: 'Completado', 
          created_by: adminId,
          created_at: new Date()
        });
      }

      // Insertamos todos los registros de un solo golpe
      const nuevosPagosArray = await trx('pagos_inversionistas')
        .insert(pagosAInsertar)
        .returning('*');

      // C) Matemáticas para actualizar el contrato (usamos el Total Transacción)
      const totalPagadoActual = parseFloat(contrato.total_pagado || 0);
      const saldoPendienteActual = parseFloat(contrato.saldo_pendiente || 0);
      const totalEsperado = totalPagadoActual + saldoPendienteActual;

      const nuevoTotalPagado = totalPagadoActual + pagoTotalTransaccion;
      const nuevoSaldoPendiente = Math.max(0, saldoPendienteActual - pagoTotalTransaccion);
      
      let nuevoPorcentaje = 0;
      if (totalEsperado > 0) {
        nuevoPorcentaje = (nuevoTotalPagado / totalEsperado) * 100;
      }

      // D) Actualizar contrato
      await trx('contratos_inversion')
        .where('id', id)
        .update({
          total_pagado: nuevoTotalPagado,
          saldo_pendiente: nuevoSaldoPendiente,
          porcentaje_pagado: parseFloat(nuevoPorcentaje.toFixed(2)),
          updated_at: new Date()
        });

      res.json({ 
        success: true, 
        message: `✅ ${cantidadMeses > 1 ? cantidadMeses + ' pagos registrados' : 'Pago registrado'} y contrato actualizado exitosamente.`,
        pagos: nuevosPagosArray
      });

    }); 

  } catch (error) {
    console.error('❌ Error guardando pago:', error);
    if (error.message === 'Contrato de inversión no encontrado.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error interno del servidor al procesar el pago.' });
  }
};

// ========== REGISTRAR PAGO DE LIQUIDACIÓN (FINIQUITO DE RESCISIÓN) ==========
exports.registrarPagoRescision = async (req, res) => {
  const { id } = req.params; // ID del contrato
  
  // 🚀 CAMBIO: Atrapamos los nombres exactos que manda tu formFinal del frontend
  const { 
    metodo_pago, 
    referencia_pago, 
    comprobante_url, 
    observaciones,
    numero_cuota,
    fecha_pago_real
  } = req.body; 

  try {
    await db.transaction(async (trx) => {
      
      const contrato = await trx('contratos_inversion').where('id', id).first();

      if (!contrato) throw new Error('El contrato no existe.');
      if (contrato.status !== 'Rescindido') throw new Error('El contrato no está rescindido.');

      const montoLiquidacion = parseFloat(contrato.monto_liquidacion_final || 0);

      if (montoLiquidacion <= 0) {
        throw new Error('El monto de liquidación es $0. No hay saldo por pagar para este finiquito.');
      }

      // 2. Registrar el recibo en el historial (Con los nombres de columna correctos)
      await trx('pagos_inversionistas').insert({
        inversion_id: id,
        monto_total: montoLiquidacion,
        numero_cuota: numero_cuota || 999, // Guardamos la cuota visual que calculaste
        metodo_pago: metodo_pago || 'Transferencia',
        referencia_pago: referencia_pago || null, // 👈 Alineado a tu BD
        comprobante_url: comprobante_url || null, // 👈 AQUÍ ESTABA EL ERROR (Faltaba _url)
        fecha_pago_real: fecha_pago_real || new Date(),
        status: 'Completado',
        observaciones: observaciones || 'Pago final de liquidación por rescisión.', // 👈 Alineado a tu modal
        created_at: new Date(),
        created_by: req.user.id // Asumiendo que tienes el ID del admin en el token
      });

      // 3. 🚀 Actualizar el contrato
      const totalPagadoActual = parseFloat(contrato.total_pagado || 0);
      const nuevoTotalPagado = totalPagadoActual + montoLiquidacion;

      await trx('contratos_inversion')
        .where('id', id)
        .update({
          total_pagado: nuevoTotalPagado,
          saldo_pendiente: 0,           
          porcentaje_pagado: 100.00,    
          updated_at: new Date()
        });

      // 4. Responder con éxito
      res.json({
        success: true,
        message: '💰 Pago de liquidación registrado. El contrato ha sido saldado al 100%.',
        monto_pagado: montoLiquidacion
      });

    }); 

  } catch (error) {
    console.error('❌ Error al registrar pago de rescisión:', error);
    if (error.message.includes('no existe') || error.message.includes('no está rescindido') || error.message.includes('es $0')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error interno al procesar el pago de liquidación.' });
  }
};

// ========== ELIMINAR PAGO (REVERSIÓN DE SALDOS Y VALIDACIÓN SECUENCIAL) ==========
exports.eliminarPagoInversion = async (req, res) => {
  const { id } = req.params; // ID del pago que se quiere borrar (de la tabla pagos_inversionistas)

  try {
    await db.transaction(async (trx) => {
      
      // 1. OBTENER DATOS DEL PAGO ANTES DE BORRARLO
      const pago = await trx('pagos_inversionistas').where('id', id).first();
      
      if (!pago) {
        throw new Error('El registro de pago no existe.');
      }

      const { inversion_id, monto_total, numero_cuota } = pago;

      // 🚨 2. VALIDACIÓN DE CONTINUIDAD (Solo borrar el último)
      // Buscamos si existe algún pago para este mismo contrato con un número de cuota mayor
      const pagoPosterior = await trx('pagos_inversionistas')
        .where('inversion_id', inversion_id)
        .where('numero_cuota', '>', numero_cuota)
        .first();

      if (pagoPosterior) {
        throw new Error(`No puedes eliminar este pago porque ya existen pagos posteriores (Cuota #${pagoPosterior.numero_cuota}). Debes eliminar los pagos en orden descendente.`);
      }

      // 3. CONSULTAR EL CONTRATO PARA REVERTIR
      const contrato = await trx('contratos_inversion').where('id', inversion_id).first();
      
      if (!contrato) {
        throw new Error('Contrato de inversión no encontrado.');
      }

      // 4. MATEMÁTICAS DE REVERSIÓN 🧮
      const montoARevertir = parseFloat(monto_total);
      const totalPagadoActual = parseFloat(contrato.total_pagado || 0);
      const saldoPendienteActual = parseFloat(contrato.saldo_pendiente || 0);

      // Restamos al pagado y aumentamos al pendiente
      const nuevoTotalPagado = Math.max(0, totalPagadoActual - montoARevertir);
      const nuevoSaldoPendiente = saldoPendienteActual + montoARevertir;

      // Recalcular porcentaje (Regla de 3)
      const totalEsperado = nuevoTotalPagado + nuevoSaldoPendiente;
      let nuevoPorcentaje = 0;
      if (totalEsperado > 0) {
        nuevoPorcentaje = (nuevoTotalPagado / totalEsperado) * 100;
      }

      // 5. ACTUALIZAR CONTRATO
      await trx('contratos_inversion')
        .where('id', inversion_id)
        .update({
          total_pagado: nuevoTotalPagado,
          saldo_pendiente: nuevoSaldoPendiente,
          porcentaje_pagado: parseFloat(nuevoPorcentaje.toFixed(2)),
          updated_at: new Date()
        });

      // 6. BORRADO FÍSICO DEL PAGO
      await trx('pagos_inversionistas').where('id', id).del();

      res.json({ 
        success: true, 
        message: `✅ Pago #${numero_cuota} eliminado y saldos revertidos correctamente.` 
      });

    }); // Fin de la transacción
    
  } catch (error) {
    console.error('❌ Error al eliminar pago:', error);
    
    // Errores controlados por nosotros
    const erroresControlados = [
      'El registro de pago no existe.',
      'Contrato de inversión no encontrado.'
    ];

    if (erroresControlados.includes(error.message) || error.message.includes('No puedes eliminar este pago')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: 'Error interno al intentar revertir el pago.' });
  }
};


// ========== ACTUALIZAR PAGO (CON AJUSTE DINÁMICO DE SALDOS) ==========
exports.actualizarPagoInversion = async (req, res) => {
  const { id } = req.params; // ID del pago en 'pagos_inversionistas'
  const { 
    monto_total, 
    fecha_pago_real, 
    metodo_pago, 
    referencia_pago, 
    observaciones,
    comprobante_url 
  } = req.body;

  try {
    // Iniciamos la transacción para proteger los datos
    await db.transaction(async (trx) => {
      
      // 1. OBTENER EL PAGO ORIGINAL ANTES DEL CAMBIO
      const pagoAnterior = await trx('pagos_inversionistas').where('id', id).first();
      
      if (!pagoAnterior) {
        throw new Error('El registro de pago no existe.');
      }

      // 2. MATEMÁTICAS DE LA DIFERENCIA (Solo si mandaron un monto nuevo)
      const montoAnteriorFloat = parseFloat(pagoAnterior.monto_total);
      const montoNuevoFloat = monto_total ? parseFloat(monto_total) : montoAnteriorFloat;
      
      // Si era 3000 y ahora es 3500 -> diferencia es +500
      // Si era 3000 y ahora es 2000 -> diferencia es -1000
      const diferencia = montoNuevoFloat - montoAnteriorFloat;

      // 3. ACTUALIZAR EL CONTRATO (Solo si el dinero cambió)
      if (diferencia !== 0) {
        const contrato = await trx('contratos_inversion')
          .where('id', pagoAnterior.inversion_id)
          .first();

        const totalPagadoActual = parseFloat(contrato.total_pagado || 0);
        const saldoPendienteActual = parseFloat(contrato.saldo_pendiente || 0);

        // Aplicamos la diferencia
        const nuevoTotalPagado = Math.max(0, totalPagadoActual + diferencia);
        const nuevoSaldoPendiente = Math.max(0, saldoPendienteActual - diferencia);

        // Recalculamos el porcentaje de la barra de progreso
        const totalEsperado = nuevoTotalPagado + nuevoSaldoPendiente;
        let nuevoPorcentaje = 0;
        if (totalEsperado > 0) {
          nuevoPorcentaje = (nuevoTotalPagado / totalEsperado) * 100;
        }

        await trx('contratos_inversion')
          .where('id', contrato.id)
          .update({
            total_pagado: nuevoTotalPagado,
            saldo_pendiente: nuevoSaldoPendiente,
            porcentaje_pagado: parseFloat(nuevoPorcentaje.toFixed(2)),
            updated_at: new Date()
          });
      }

      // 4. ACTUALIZAR LOS DATOS DEL PAGO
      const pagoActualizado = await trx('pagos_inversionistas')
        .where('id', id)
        .update({
          monto_total: montoNuevoFloat,
          fecha_pago_real: fecha_pago_real || pagoAnterior.fecha_pago_real,
          metodo_pago: metodo_pago || pagoAnterior.metodo_pago,
          referencia_pago: referencia_pago !== undefined ? referencia_pago : pagoAnterior.referencia_pago,
          observaciones: observaciones !== undefined ? observaciones : pagoAnterior.observaciones,
          comprobante_url: comprobante_url || pagoAnterior.comprobante_url,
          // No actualizamos el numero_cuota, ese es sagrado
        })
        .returning('*');

      res.json({ 
        success: true, 
        message: '✅ Pago actualizado y saldos ajustados correctamente.',
        pago: pagoActualizado[0]
      });

    }); // Fin de la transacción

  } catch (error) {
    console.error('❌ Error al actualizar pago:', error);
    if (error.message === 'El registro de pago no existe.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error interno al actualizar el pago.' });
  }
};

// ========== RESCINDIR / PAUSAR CONTRATO ==========
exports.rescindirContrato = async (req, res) => {
  const { id } = req.params; // ID del contrato en contratos_inversion
  
  // 🚀 1. Recibimos la nueva bandera 'esPausa' desde el frontend
  const { motivo, observaciones, esPausa } = req.body;

  // Validación básica
  if (!motivo) {
    return res.status(400).json({ success: false, message: 'El motivo es obligatorio.' });
  }

  try {
    // Usamos una transacción por si algo falla, no se guarde a medias
    await db.transaction(async (trx) => {
      
      // 2. Obtener el contrato actual
      const contrato = await trx('contratos_inversion').where('id', id).first();
      
      if (!contrato) {
        throw new Error('El contrato especificado no existe.');
      }

      if (contrato.status === 'Rescindido' || contrato.status === 'Finalizado') {
        throw new Error('Este contrato ya se encuentra inactivo o rescindido.');
      }

      // 3. Preparamos los datos a guardar dependiendo de la acción
      let datosActualizacion = {};
      let montoLiquidacion = null;

      if (esPausa) {
        // 🟠 LÓGICA DE PAUSA (Congelamos el contrato sin liquidar)
        datosActualizacion = {
          status: 'Pausado',
          motivo_rescision: null, // Lo dejamos limpio para cuando se reanude o se cancele de verdad
          monto_liquidacion_final: null,
          notas_rescision: observaciones || 'Contrato suspendido temporalmente por Fuerza Mayor',
          fecha_rescision: null, // No hay fecha final
          updated_at: new Date()
        };
      } else {
        // 🔴 LÓGICA DE RESCISIÓN DEFINITIVA (Tu código original)
        montoLiquidacion = calcularFiniquitoFinal(contrato, motivo);
        
        datosActualizacion = {
          status: 'Rescindido', 
          motivo_rescision: motivo, 
          monto_liquidacion_final: montoLiquidacion, 
          notas_rescision: observaciones || '', 
          fecha_rescision: new Date(),
          updated_at: new Date()
        };
      }

      // 4. Ejecutamos la actualización en la base de datos
      await trx('contratos_inversion')
        .where('id', id)
        .update(datosActualizacion);

      // 5. Respondemos al frontend
      res.json({ 
        success: true, 
        message: esPausa ? '⏸️ Contrato pausado exitosamente.' : '✅ Contrato rescindido legalmente.',
        montoFinal: montoLiquidacion 
      });

    }); // Fin de la transacción

  } catch (error) {
    console.error('❌ Error al procesar el contrato:', error);
    if (error.message.includes('no existe') || error.message.includes('ya se encuentra')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error interno al procesar el contrato.' });
  }
};

// ========== REANUDAR CONTRATO (QUITAR PAUSA) ==========
exports.reanudarContrato = async (req, res) => {
  const { id } = req.params; // ID del contrato

  try {
    // Usamos una transacción para mantener la base de datos segura
    await db.transaction(async (trx) => {
      
      // 1. Obtener el contrato para saber su plazo original
      const contrato = await trx('contratos_inversion').where('id', id).first();
      
      if (!contrato) {
        throw new Error('El contrato especificado no existe.');
      }

      if (contrato.status !== 'Pausado') {
        throw new Error('Este contrato no está pausado, por lo que no se puede reanudar.');
      }

      // 2. Contar cuántos pagos ya se le habían hecho antes de pausarlo
      // (Asumiendo que solo cuentan los 'Completado', si no, le puedes quitar ese .andWhere)
      const pagosResult = await trx('pagos_inversionistas')
        .where('inversion_id', id)
        .andWhere('status', 'Completado') 
        .count('* as total_pagos')
        .first();

      const pagosRealizados = parseInt(pagosResult.total_pagos || 0, 10);
      const plazoTotalMeses = parseInt(contrato.plazo_meses || 1, 10);
      
      // Calculamos cuántos meses le faltan (usamos Math.max para evitar números negativos raros)
      const mesesRestantes = Math.max(0, plazoTotalMeses - pagosRealizados);

      // 3. Crear las nuevas fechas
      const nuevaFechaInicio = new Date(); // Hoy
      
      const nuevaFechaFin = new Date(nuevaFechaInicio); // Copiamos la fecha de hoy
      nuevaFechaFin.setMonth(nuevaFechaFin.getMonth() + mesesRestantes); // Le sumamos los meses faltantes

      // 4. Actualizar el contrato tocando SOLO lo que pediste
      await trx('contratos_inversion')
        .where('id', id)
        .update({
          status: 'Activa',
          fecha_inicio: nuevaFechaInicio,
          fecha_fin_estimada: nuevaFechaFin,
          notas_rescision: null, // Limpiamos la nota de la pausa
          
          updated_at: new Date() // Actualizamos la fecha de modificación
        });

      // 5. Responder con éxito
      res.json({ 
        success: true, 
        message: '▶️ Contrato reanudado. Fechas recalibradas exitosamente.',
        detalles: {
          pagos_previos: pagosRealizados,
          meses_restantes: mesesRestantes,
          nueva_fecha_inicio: nuevaFechaInicio,
          nueva_fecha_fin: nuevaFechaFin
        }
      });

    }); // Fin transacción

  } catch (error) {
    console.error('❌ Error al reanudar contrato:', error);
    if (error.message.includes('no existe') || error.message.includes('no está pausado')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Error interno al intentar reanudar el contrato.' });
  }
};