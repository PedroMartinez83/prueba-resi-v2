const { db } = require('./postgresService');

class InversionesService {
  // Obtener parámetros del sistema
  async obtenerParametro(clave) {
    const param = await db('parametros_sistema')
      .where('clave', clave)
      .first();
    return param ? parseFloat(param.valor) : null;
  }


  // Calcular inversión para modelo SI_LEGADO
  calcularInversionSILegado(datos) {
    const { valorFactura, costoPoliza, placas, gps, otrosGastos } = datos;
    
    const inversionTotal = 
      parseFloat(valorFactura || 0) + 
      (parseFloat(costoPoliza || 0) * 3) + 
      parseFloat(placas || 0) + 
      parseFloat(gps || 0) + 
      parseFloat(otrosGastos || 0);

    return {
      inversionTotal,
      ingresoMensual: 10400, // Fijo: $400 x 26 días
      pagoInversionista: 8000, // Fijo mensual
      utilidadMensual: 2400, // Fijo: 10400 - 8000
      modelo: 'SI_LEGADO'
    };
  }

  // Calcular inversión para modelo AUTOMANAGER
  async calcularInversionAutoManager(datos) {
    const { 
      valorFactura, 
      costoPoliza, 
      placas, 
      gps, 
      otrosGastos, 
      rentaDiaria = 400 
    } = datos;

    // Obtener multiplicador del sistema
    const multiplicador = await this.obtenerParametro('multiplicador_corrida') || 2.82;
    
    const inversionTotal = 
      parseFloat(valorFactura || 0) + 
      (parseFloat(costoPoliza || 0) * 3) + 
      parseFloat(placas || 0) + 
      parseFloat(gps || 0) + 
      parseFloat(otrosGastos || 0);

    const corridaTotal = inversionTotal * multiplicador;
    const ingresoMensual = parseFloat(rentaDiaria) * 26;
    const plazoEstimadoMeses = corridaTotal / ingresoMensual;

    return {
      inversionTotal,
      corridaTotal,
      ingresoMensual,
      plazoEstimadoMeses: Math.ceil(plazoEstimadoMeses),
      rentaDiaria: parseFloat(rentaDiaria),
      multiplicadorUsado: multiplicador,
      modelo: 'AUTOMANAGER'
    };
  }

  // Guardar inversión en la base de datos
  async guardarInversion(datosInversion) {
    const inversion = await db('inversiones_vehiculos')
      .insert({
        ...datosInversion,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    return inversion[0];
  }

  // Obtener inversión por número de serie
  async obtenerInversionPorSerie(numeroSerie) {
    return await db('inversiones_vehiculos')
      .where('numero_de_serie_vehiculo', numeroSerie)
      .first();
  }

  // Actualizar recuperación de inversión
  async actualizarRecuperacion(inversionId, montoPago) {
    const inversion = await db('inversiones_vehiculos')
      .where('id_inversion', inversionId)
      .first();

    if (!inversion) {
      throw new Error('Inversión no encontrada');
    }

    const nuevoTotalRecuperado = parseFloat(inversion.total_recuperado || 0) + parseFloat(montoPago);
    const nuevoPorRecuperar = parseFloat(inversion.total_corrida) - nuevoTotalRecuperado;

    await db('inversiones_vehiculos')
      .where('id_inversion', inversionId)
      .update({
        total_recuperado: nuevoTotalRecuperado,
        por_recuperar: nuevoPorRecuperar,
        updated_at: new Date()
      });

    return {
      totalRecuperado: nuevoTotalRecuperado,
      porRecuperar: nuevoPorRecuperar,
      porcentajeRecuperado: (nuevoTotalRecuperado / parseFloat(inversion.total_corrida)) * 100
    };
  }
}

module.exports = new InversionesService();