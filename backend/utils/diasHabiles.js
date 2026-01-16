/**
 * Calcula los días hábiles (sin domingos) de un mes específico
 * @param {Date} fecha - Fecha del mes a calcular (por defecto, el mes actual)
 * @returns {number} Cantidad de días hábiles (total de días - domingos)
 */
function calcularDiasHabilesMes(fecha = new Date()) {
  const ano = fecha.getFullYear();
  const mes = fecha.getMonth();
  
  // Obtener el último día del mes
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  
  // Contar los domingos (día 0 de la semana)
  let cantidadDomingos = 0;
  
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const fechaActual = new Date(ano, mes, dia);
    if (fechaActual.getDay() === 0) { // 0 = Domingo
      cantidadDomingos++;
    }
  }
  
  // Días hábiles = días totales - domingos
  return ultimoDia - cantidadDomingos;
}

/**
 * Calcula la proyección mensual de rentas
 * Fórmula: (NumConductores * MontoRentaDiaria) * DiasCobro
 * 
 * @param {number} numConductores - Cantidad de conductores activos
 * @param {number} montoRentaDiaria - Monto de renta diaria por conductor
 * @param {Date} fecha - Fecha del mes a proyectar (por defecto, mes actual)
 * @returns {number} Proyección mensual total
 */
function calcularProyeccionMensual(numConductores, montoRentaDiaria, fecha = new Date()) {
  const diasHabiles = calcularDiasHabilesMes(fecha);
  return (numConductores * montoRentaDiaria) * diasHabiles;
}

module.exports = {
  calcularDiasHabilesMes,
  calcularProyeccionMensual
};
