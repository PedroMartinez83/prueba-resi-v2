/**
 * Utilidades para calcular penalizaciones y finiquitos de contratos de inversión
 * Basado en las cláusulas legales (Sexta, Séptima y Octava).
 */

export const MOTIVOS_CANCELACION = {
  INCUMPLIMIENTO_EMPRESA: 'INCUMPLIMIENTO_EMPRESA',
  RETIRO_INVERSIONISTA: 'RETIRO_INVERSIONISTA',
  FUERZA_MAYOR: 'FUERZA_MAYOR'
};

/**
 * 🧠 FUNCIÓN CENTRAL: Calcula el "Capital Restante" (Amortización pura)
 * Lo que pidió auditoría: Separar el Capital del Rendimiento en cada pago.
 */
const calcularDeudaNetaReal = (contrato) => {
  const inversionInicial = parseFloat(contrato.monto_invertido || 0);
  const plazoMeses = parseInt(contrato.plazo_meses || 1, 10); 
  const totalPagado = parseFloat(contrato.total_pagado || 0);
  const totalContrato = parseFloat(contrato.monto_total_contrato || 0);

  // 1. DEDUCIR PAGOS REALIZADOS (El blindaje contra datos faltantes)
  let pagosRealizados = parseInt(contrato.pagos_realizados || 0, 10);
  
  const cuotaMensualEsperada = plazoMeses > 0 ? (totalContrato / plazoMeses) : 0;
  
  // 🛡️ Si la BD nos mandó un 0, pero SÍ hay dinero pagado, deducimos los meses matemáticamente
  if (pagosRealizados === 0 && cuotaMensualEsperada > 0 && totalPagado > 0) {
    pagosRealizados = Math.floor(totalPagado / cuotaMensualEsperada);
  }

  // 2. DESMENUZAMOS EL PAGO MENSUAL (La magia contable)
  // ¿De cada pago mensual, cuánto es estrictamente devolución de su capital?
  const porcionCapitalMensual = plazoMeses > 0 ? (inversionInicial / plazoMeses) : 0;

  // 3. ¿Cuánto capital puro le hemos devuelto en la historia del contrato?
  const capitalYaAmortizado = porcionCapitalMensual * pagosRealizados;

  // 4. ¿Cuánto de su dinero original nos falta por devolverle?
  const capitalRestante = inversionInicial - capitalYaAmortizado;

  // Devolvemos el capital restante protegiendo que nunca sea negativo
  return Math.max(0, capitalRestante);
};

/**
 * 🚀 FUNCIÓN MAESTRA (Esta es la que vas a usar en tu código)
 * @param {Object} contrato - El objeto completo del contrato
 * @param {String} motivo - Usar las constantes de MOTIVOS_CANCELACION
 * @returns {Number} El monto final exacto a liquidar
 */
export const calcularFiniquitoFinal = (contrato, motivo) => {
  if (!contrato) return 0;

  const inversionInicial = parseFloat(contrato.monto_invertido || 0);
  
  // 🔥 REGLA DE ORO: Olvidamos el 'saldo_pendiente' del futuro y calculamos la deuda real de hoy
  const deudaNetaReal = calcularDeudaNetaReal(contrato);
  
  let resultadoFinal = 0;

  switch (motivo) {
    case MOTIVOS_CANCELACION.INCUMPLIMIENTO_EMPRESA:
      // Deuda Neta + Penalización del 15% (A favor del inversionista)
      resultadoFinal = deudaNetaReal + (inversionInicial * 0.15);
      break;
      
    case MOTIVOS_CANCELACION.RETIRO_INVERSIONISTA:
      // Deuda Neta - Penalización del 20% (A favor de la empresa, se le descuenta al cliente)
      resultadoFinal = deudaNetaReal - (inversionInicial * 0.20);
      break;
      
    case MOTIVOS_CANCELACION.FUERZA_MAYOR:
      // Se lleva su deuda neta exacta, sin premios ni castigos
      resultadoFinal = deudaNetaReal;
      break;
      
    default:
      console.warn(`Motivo de cancelación desconocido: ${motivo}`);
      resultadoFinal = deudaNetaReal;
      break;
  }

  // 🛡️ MAGIA APLICADA: 
  // 1. Math.max(0, ...) evita que salga negativo (no le vamos a cobrar dinero de su bolsa)
  // 2. Math.round(...) redondea al peso cerrado sin centavos
  return Math.max(0, Math.round(resultadoFinal));
};