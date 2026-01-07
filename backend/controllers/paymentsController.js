const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { 
  getById, 
  update, 
  getWithFilter,
  TABLES,
  findConductorByUserId
} = require('../services/postgresService');

// Crear intención de pago
const createPaymentIntent = async (req, res) => {
  try {
    const { amount, conductorId, rentaId, descripcion, payAll } = req.body;

    const conductor = await getWithFilter(
      TABLES.CONDUCTORES,
      `{NumeroVehiculo} = '${req.user.numeroVehiculo}'`
    );

    if (conductor.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }

    const conductorInfo = conductor[0];
    const conductorIdFinal = conductorInfo.id || conductorId;

    const rentasPendientes = await getWithFilter(
      TABLES.RENTAS,
      `AND(FIND('${conductorIdFinal}', ARRAYJOIN({ConductorID})), OR({Estado} = 'Pendiente', {Estado} = 'Vencida', {Estado} = 'EnTolerancia'))`,
      [{field: "FechaVencimiento", direction: "asc"}]
    );

    if (rentasPendientes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay rentas pendientes para pagar'
      });
    }

    let rentaIds = [];
    let montoFinal = 0;
    let rentaIdFinal = rentaId;

    if (payAll) {
      rentaIds = rentasPendientes.map((renta) => renta.id);
      montoFinal = rentasPendientes.reduce((sum, renta) => {
        const monto = renta.MontoTotal || renta.MontoBase || 0;
        return sum + parseFloat(monto);
      }, 0);
      rentaIdFinal = 'bulk';
    } else {
      if (!rentaIdFinal) {
        return res.status(400).json({
          success: false,
          error: 'Falta el identificador de la renta a pagar'
        });
      }

      const rentaSeleccionada = rentasPendientes.find((renta) => renta.id === rentaIdFinal);
      if (!rentaSeleccionada) {
        return res.status(404).json({
          success: false,
          error: 'Renta no encontrada o ya pagada'
        });
      }

      const rentaMasAntigua = rentasPendientes[0];
      if (rentaMasAntigua?.id && rentaMasAntigua.id !== rentaIdFinal) {
        return res.status(400).json({
          success: false,
          error: `Debes pagar primero la renta con vencimiento ${rentaMasAntigua.FechaVencimiento}`
        });
      }

      montoFinal = parseFloat(rentaSeleccionada.MontoTotal || rentaSeleccionada.MontoBase || amount || 0);
      rentaIds = [rentaIdFinal];
    }

    if (isNaN(montoFinal) || montoFinal <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El monto debe ser un número válido mayor a 0'
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(montoFinal * 100), // Stripe usa centavos
      currency: 'mxn',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        conductorId: conductorIdFinal.toString(),
        rentaId: rentaIdFinal.toString(),
        rentaIds: rentaIds.join(','),
        descripcion: descripcion || 'Pago de renta vehicular',
        sistema: 'auto-manager',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`Payment Intent creado: ${paymentIntent.id} por $${montoFinal} MXN - Conductor: ${conductorIdFinal}, Renta: ${rentaIdFinal}`);

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: montoFinal,
      rentaIds
    });

  } catch (error) {
    console.error('Error creando payment intent:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando solicitud de pago'
    });
  }
};

// Confirmar pago exitoso y actualizar PostgreSQL
const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'paymentIntentId es requerido'
      });
    }

    // Obtener detalles del pago de Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      const { conductorId, rentaId, rentaIds: rentaIdsRaw } = paymentIntent.metadata;
      const rentaIds = rentaIdsRaw ? rentaIdsRaw.split(',').filter(Boolean) : [];
      
      try {
        const rentasParaActualizar = rentaIds.length > 0 ? rentaIds : [rentaId];

        for (const rentaParaActualizar of rentasParaActualizar) {
          await update(TABLES.RENTAS, rentaParaActualizar, {
            Estado: 'Pagada',                    // ✅ Campo correcto
            FechaPago: new Date().toISOString().split('T')[0], // ✅ Solo fecha, formato YYYY-MM-DD
            StripePaymentID: paymentIntent.id,   // ✅ Campo correcto
            MontoTotal: paymentIntent.amount / 100, // ✅ Campo correcto
            MetodoPago: 'Tarjeta'                // ✅ Campo correcto
          });
        }

        console.log(`Rentas ${rentasParaActualizar.join(', ')} actualizadas como pagadas en PostgreSQL`);
      } catch (airtableError) {
        console.error('Error actualizando PostgreSQL:', airtableError);
        // No fallar el endpoint, el pago ya fue procesado exitosamente
      }

      res.json({
        success: true,
        message: 'Pago confirmado exitosamente',
        paymentDetails: {
          id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          status: paymentIntent.status,
          conductorId: conductorId,
          rentaIds: rentaIds.length > 0 ? rentaIds : [rentaId],
          fechaPago: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'El pago no fue exitoso',
        status: paymentIntent.status
      });
    }

  } catch (error) {
    console.error('Error confirmando pago:', error);
    res.status(500).json({
      success: false,
      error: 'Error confirmando pago'
    });
  }
};

// Webhook de Stripe para automatización completa
const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Webhook recibido: ${event.type} - ID: ${event.id}`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log(`Pago exitoso automático: ${paymentIntent.id} por $${paymentIntent.amount / 100} MXN`);
        
        const { conductorId, rentaId } = paymentIntent.metadata;
        
        if (conductorId && rentaId) {
          try {
            // ✅ WEBHOOK CON CAMPOS CORREGIDOS
            await update(TABLES.RENTAS, rentaId, {
              Estado: 'Pagada',
              FechaPago: new Date().toISOString().split('T')[0],
              StripePaymentID: paymentIntent.id,
              MontoTotal: paymentIntent.amount / 100,
              MetodoPago: 'Tarjeta',
              Observaciones: `Pagado automáticamente vía webhook - ${new Date().toISOString()}`
            });

            console.log(`Webhook: Renta ${rentaId} del conductor ${conductorId} actualizada automáticamente`);
            
          } catch (updateError) {
            console.error('Error en webhook actualizando PostgreSQL:', updateError);
          }
        } else {
          console.log('Webhook sin metadata completa - no se puede procesar automáticamente');
        }
        break;
        
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        const failureReason = failedPayment.last_payment_error?.message || 'Razón desconocida';
        console.log(`Pago fallido: ${failedPayment.id} - Razón: ${failureReason}`);
        break;
        
      case 'payment_intent.canceled':
        const canceledPayment = event.data.object;
        console.log(`Pago cancelado: ${canceledPayment.id}`);
        break;
        
      default:
        console.log(`Evento no manejado: ${event.type}`);
    }
  } catch (processingError) {
    console.error('Error procesando webhook:', processingError);
  }

  res.status(200).json({received: true, eventType: event.type});
};

// Obtener historial de pagos de un conductor
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Buscar conductor por número de vehículo del usuario
    const conductor = await getWithFilter(
      TABLES.CONDUCTORES,
      `{NumeroVehiculo} = '${req.user.numeroVehiculo}'`
    );

    if (conductor.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    const conductorInfo = conductor[0];

    // ✅ FILTRO CORREGIDO - Usar ID del conductor de PostgreSQL
    const rentas = await getWithFilter(
      TABLES.RENTAS,
      `AND(FIND('${conductorInfo.id}', ARRAYJOIN({ConductorID})), {Estado} = 'Pagada')`,
      [{field: "FechaPago", direction: "desc"}]
    );

    const payments = rentas.map(renta => ({
      id: renta.id,
      monto: renta.MontoTotal || renta.MontoBase,      // ✅ Campos corregidos
      fecha: renta.FechaPago,                          // ✅ Campo correcto
      stripeId: renta.StripePaymentID,                 // ✅ Campo correcto
      concepto: 'Renta vehicular diaria',
      periodo: renta.NumeroSemana ? `Semana ${renta.NumeroSemana}` : 'No especificado',
      metodoPago: renta.MetodoPago || 'No especificado'
    }));

    res.json({
      success: true,
      total: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + (p.monto || 0), 0),
      payments
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de pagos'
    });
  }
};

// Obtener rentas pendientes de pago
const getPendingPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Buscar conductor por número de vehículo del usuario
    const conductor = await getWithFilter(
      TABLES.CONDUCTORES,
      `{NumeroVehiculo} = '${req.user.numeroVehiculo}'`
    );

    if (conductor.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    const conductorInfo = conductor[0];

    // ✅ FILTRO CORREGIDO - Buscar rentas pendientes
    const rentasPendientes = await getWithFilter(
      TABLES.RENTAS,
      `AND(FIND('${conductorInfo.id}', ARRAYJOIN({ConductorID})), OR({Estado} = 'Pendiente', {Estado} = 'Vencida', {Estado} = 'EnTolerancia'))`,
      [{field: "FechaVencimiento", direction: "asc"}]
    );

    const pending = rentasPendientes.map(renta => {
      const hoy = new Date();
      const vencimiento = new Date(renta.FechaVencimiento);
      const diasRetraso = Math.max(0, Math.floor((hoy - vencimiento) / (1000 * 60 * 60 * 24)));
      
      return {
        id: renta.id,
        folio: renta.FolioRenta,
        monto: renta.MontoTotal || renta.MontoBase,
        fechaVencimiento: renta.FechaVencimiento,
        concepto: 'Renta vehicular diaria',
        periodo: renta.NumeroSemana ? `Semana ${renta.NumeroSemana}` : 'No especificado',
        estado: renta.Estado,
        diasRetraso: diasRetraso,
        esVencida: diasRetraso > 0,
        enTolerancia: diasRetraso <= 2 && diasRetraso > 0
      };
    });

    // Ordenar: vencidas primero, luego por fecha
    pending.sort((a, b) => {
      if (a.esVencida && !b.esVencida) return -1;
      if (!a.esVencida && b.esVencida) return 1;
      return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento);
    });

    res.json({
      success: true,
      conductor: {
        nombre: conductorInfo.nombre_conductor,
        vehiculo: req.user.numeroVehiculo,
        tipoSocio: conductorInfo.TipoSocio
      },
      conductorId: conductorInfo.id,
      total: pending.length,
      totalAmount: pending.reduce((sum, payment) => sum + (payment.monto || 0), 0),
      pendientes: pending.filter(p => !p.esVencida).length,
      vencidas: pending.filter(p => p.esVencida && !p.enTolerancia).length,
      enTolerancia: pending.filter(p => p.enTolerancia).length,
      pendingPayments: pending
    });

  } catch (error) {
    console.error('Error obteniendo pagos pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pagos pendientes'
    });
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  stripeWebhook,
  getPaymentHistory,
  getPendingPayments
};
