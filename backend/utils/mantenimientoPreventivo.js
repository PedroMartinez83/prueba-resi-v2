const schedules = {
  'v-drive': [
    { kilometraje: 10000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, inspección de frenos, revisión visual de suspensión.' },
    { kilometraje: 20000, servicio: 'Cambio de filtro de aire, inspección del sistema de escape, dirección, revisión de amortiguadores y alineación.' },
    { kilometraje: 30000, servicio: 'Cambio de filtro de cabina, limpieza del cuerpo de aceleración, inspección del sistema de refrigeración y transmisión.' },
    { kilometraje: 40000, servicio: 'Revisión de bujías, inspección del sistema de combustible, líneas de freno, rótulas y soportes.' },
    { kilometraje: 50000, servicio: 'Cambio de aceite y filtro, revisión completa de suspensión y sistema de frenos.' },
    { kilometraje: 60000, servicio: 'Cambio de líquido de frenos, revisión del sistema de escape, presión de aceite del motor.' },
    { kilometraje: 70000, servicio: 'Cambio de filtro de aire, revisión visual de suspensión, balanceo y alineación.' },
    { kilometraje: 80000, servicio: 'Cambio de filtro de cabina, inspección del sistema de combustible, frenos y suspensión.' },
    { kilometraje: 90000, servicio: 'Revisión de bujías, limpieza de cuerpo de aceleración, revisión de dirección.' },
    { kilometraje: 100000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, revisión general de suspensión y amortiguadores.' },
    { kilometraje: 105000, servicio: 'Inspección completa de frenos, suspensión, niveles de fluidos.' },
    { kilometraje: 110000, servicio: 'Revisión de sistema de escape, luces, refrigeración, rótulas y terminales.' },
    { kilometraje: 115000, servicio: 'Cambio de filtro de aire, revisión de transmisión, inspección de frenos.' },
    { kilometraje: 120000, servicio: 'Cambio de líquido de frenos, revisión de bujías, suspensión y limpieza del cuerpo de aceleración.' },
    { kilometraje: 125000, servicio: 'Revisión general: frenos, suspensión, niveles de fluidos.' },
    { kilometraje: 130000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, inspección del sistema de escape.' },
    { kilometraje: 135000, servicio: 'Revisión de suspensión, dirección y amortiguadores.' },
    { kilometraje: 140000, servicio: 'Cambio de filtro de aire, limpieza cuerpo de aceleración, revisión de bujías.' },
    { kilometraje: 145000, servicio: 'Inspección completa de frenos, cambio de líquido de frenos.' },
    { kilometraje: 150000, servicio: 'Cambio de aceite y filtro, revisión general de suspensión y transmisión.' },
    { kilometraje: 155000, servicio: 'Revisión visual de motor, limpieza de cuerpo de aceleración, revisión de presión de aceite.' },
    { kilometraje: 160000, servicio: 'Cambio de filtro de cabina, inspección de rótulas, soportes de motor.' },
    { kilometraje: 165000, servicio: 'Revisión de sistema de refrigeración, alineación y balanceo.' },
    { kilometraje: 170000, servicio: 'Cambio de aceite y filtro, revisión de amortiguadores, frenos, luces.' },
    { kilometraje: 175000, servicio: 'Revisión de dirección, suspensión, revisión general de tren motriz.' },
    { kilometraje: 180000, servicio: 'Cambio de filtro de aire, limpieza cuerpo de aceleración, revisión de bujías.' },
    { kilometraje: 185000, servicio: 'Cambio de líquido de frenos, inspección completa del sistema de frenos.' },
    { kilometraje: 190000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, revisión del sistema de escape.' },
    { kilometraje: 195000, servicio: 'Revisión de suspensión, terminales de dirección, rótulas, presión de aceite.' },
    { kilometraje: 200000, servicio: 'Revisión general de todos los sistemas críticos. Posible revisión mayor de motor.' },
    { kilometraje: 210000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, inspección de frenos, revisión visual de suspensión.' },
    { kilometraje: 220000, servicio: 'Cambio de filtro de aire, inspección del sistema de escape, dirección, revisión de amortiguadores y alineación.' },
    { kilometraje: 230000, servicio: 'Cambio de filtro de cabina, limpieza del cuerpo de aceleración, inspección del sistema de refrigeración y transmisión.' },
    { kilometraje: 240000, servicio: 'Revisión de bujías, inspección del sistema de combustible, líneas de freno, rótulas y soportes.' },
    { kilometraje: 250000, servicio: 'Cambio de aceite y filtro, revisión completa de suspensión y sistema de frenos.' },
    { kilometraje: 260000, servicio: 'Cambio de líquido de frenos, revisión del sistema de escape, presión de aceite del motor.' },
    { kilometraje: 270000, servicio: 'Cambio de filtro de aire, revisión visual de suspensión, balanceo y alineación.' },
    { kilometraje: 280000, servicio: 'Cambio de filtro de cabina, inspección del sistema de combustible, frenos y suspensión.' },
    { kilometraje: 290000, servicio: 'Revisión de bujías, limpieza de cuerpo de aceleración, revisión de dirección.' },
    { kilometraje: 300000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, revisión general de suspensión y amortiguadores.' },
    { kilometraje: 305000, servicio: 'Inspección completa de frenos, suspensión, niveles de fluidos.' },
    { kilometraje: 310000, servicio: 'Revisión de sistema de escape, luces, refrigeración, rótulas y terminales.' },
    { kilometraje: 315000, servicio: 'Cambio de filtro de aire, revisión de transmisión, inspección de frenos.' },
    { kilometraje: 320000, servicio: 'Cambio de líquido de frenos, revisión de bujías, suspensión y limpieza del cuerpo de aceleración.' },
    { kilometraje: 325000, servicio: 'Revisión general: frenos, suspensión, niveles de fluidos.' },
    { kilometraje: 330000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, inspección del sistema de escape.' },
    { kilometraje: 335000, servicio: 'Revisión de suspensión, dirección y amortiguadores.' },
    { kilometraje: 340000, servicio: 'Cambio de filtro de aire, limpieza cuerpo de aceleración, revisión de bujías.' },
    { kilometraje: 345000, servicio: 'Inspección completa de frenos, cambio de líquido de frenos.' },
    { kilometraje: 350000, servicio: 'Cambio de aceite y filtro, revisión general de suspensión y transmisión.' },
    { kilometraje: 355000, servicio: 'Revisión visual de motor, limpieza de cuerpo de aceleración, revisión de presión de aceite.' },
    { kilometraje: 360000, servicio: 'Cambio de filtro de cabina, inspección de rótulas, soportes de motor.' },
    { kilometraje: 365000, servicio: 'Revisión de sistema de refrigeración, alineación y balanceo.' },
    { kilometraje: 370000, servicio: 'Cambio de aceite y filtro, revisión de amortiguadores, frenos, luces.' },
    { kilometraje: 375000, servicio: 'Revisión de dirección, suspensión, revisión general de tren motriz.' },
    { kilometraje: 380000, servicio: 'Cambio de filtro de aire, limpieza cuerpo de aceleración, revisión de bujías.' },
    { kilometraje: 385000, servicio: 'Cambio de líquido de frenos, inspección completa del sistema de frenos.' },
    { kilometraje: 390000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, revisión del sistema de escape.' },
    { kilometraje: 395000, servicio: 'Revisión de suspensión, terminales de dirección, rótulas, presión de aceite.' },
    { kilometraje: 400000, servicio: 'Revisión general de todos los sistemas críticos. Posible revisión mayor de motor.' }
  ],
  'march': [
    { kilometraje: 5000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, inspección de frenos, revisión visual de suspensión.' },
    { kilometraje: 10000, servicio: 'Cambio de filtro de aire, inspección del sistema de escape, dirección, revisión de amortiguadores y alineación.' },
    { kilometraje: 15000, servicio: 'Cambio de filtro de cabina, limpieza del cuerpo de aceleración, inspección del sistema de refrigeración y transmisión.' },
    { kilometraje: 20000, servicio: 'Revisión de bujías, inspección del sistema de combustible, líneas de freno, rótulas y soportes.' },
    { kilometraje: 25000, servicio: 'Cambio de aceite y filtro, revisión completa de suspensión y sistema de frenos.' },
    { kilometraje: 30000, servicio: 'Cambio de líquido de frenos, revisión del sistema de escape, presión de aceite del motor.' },
    { kilometraje: 35000, servicio: 'Cambio de filtro de aire, revisión visual de suspensión, balanceo y alineación.' },
    { kilometraje: 45000, servicio: 'Cambio de filtro de cabina, inspección del sistema de combustible, frenos y suspensión.' },
    { kilometraje: 50000, servicio: 'Revisión de bujías, limpieza de cuerpo de aceleración, revisión de dirección.' },
    { kilometraje: 55000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, revisión general de suspensión y amortiguadores.' },
    { kilometraje: 60000, servicio: 'Inspección completa de frenos, suspensión, niveles de fluidos.' },
    { kilometraje: 65000, servicio: 'Revisión de sistema de escape, luces, refrigeración, rótulas y terminales.' },
    { kilometraje: 70000, servicio: 'Cambio de filtro de aire, revisión de transmisión, inspección de frenos.' },
    { kilometraje: 75000, servicio: 'Cambio de líquido de frenos, revisión de bujías, suspensión y limpieza del cuerpo de aceleración.' },
    { kilometraje: 80000, servicio: 'Revisión general: frenos, suspensión, niveles de fluidos.' },
    { kilometraje: 85000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, inspección del sistema de escape.' },
    { kilometraje: 90000, servicio: 'Revisión de suspensión, dirección y amortiguadores.' },
    { kilometraje: 95000, servicio: 'Cambio de filtro de aire, limpieza cuerpo de aceleración, revisión de bujías.' },
    { kilometraje: 100000, servicio: 'Inspección completa de frenos, cambio de líquido de frenos.' },
    { kilometraje: 105000, servicio: 'Cambio de aceite y filtro, revisión general de suspensión y transmisión.' },
    { kilometraje: 110000, servicio: 'Revisión visual de motor, limpieza de cuerpo de aceleración, revisión de presión de aceite.' },
    { kilometraje: 115000, servicio: 'Cambio de filtro de cabina, inspección de rótulas, soportes de motor.' },
    { kilometraje: 120000, servicio: 'Revisión de sistema de refrigeración, alineación y balanceo.' },
    { kilometraje: 125000, servicio: 'Cambio de aceite y filtro, revisión de amortiguadores, frenos, luces.' },
    { kilometraje: 130000, servicio: 'Revisión de dirección, suspensión, revisión general de tren motriz.' },
    { kilometraje: 135000, servicio: 'Cambio de filtro de aire, limpieza cuerpo de aceleración, revisión de bujías.' },
    { kilometraje: 140000, servicio: 'Cambio de líquido de frenos, inspección completa del sistema de frenos.' },
    { kilometraje: 145000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, revisión del sistema de escape.' },
    { kilometraje: 150000, servicio: 'Revisión de suspensión, terminales de dirección, rótulas, presión de aceite.' },
    { kilometraje: 155000, servicio: 'Revisión general de todos los sistemas críticos. Posible revisión mayor de motor.' },
    { kilometraje: 160000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, inspección de frenos, revisión visual de suspensión.' },
    { kilometraje: 165000, servicio: 'Cambio de filtro de aire, inspección del sistema de escape, dirección, revisión de amortiguadores y alineación.' },
    { kilometraje: 170000, servicio: 'Cambio de filtro de cabina, limpieza del cuerpo de aceleración, inspección del sistema de refrigeración y transmisión.' },
    { kilometraje: 175000, servicio: 'Revisión de bujías, inspección del sistema de combustible, líneas de freno, rótulas y soportes.' },
    { kilometraje: 180000, servicio: 'Cambio de aceite y filtro, revisión completa de suspensión y sistema de frenos.' },
    { kilometraje: 185000, servicio: 'Cambio de líquido de frenos, revisión del sistema de escape, presión de aceite del motor.' },
    { kilometraje: 190000, servicio: 'Cambio de filtro de aire, revisión visual de suspensión, balanceo y alineación.' },
    { kilometraje: 195000, servicio: 'Cambio de filtro de cabina, inspección del sistema de combustible, frenos y suspensión.' },
    { kilometraje: 200000, servicio: 'Revisión de bujías, limpieza de cuerpo de aceleración, revisión de dirección.' },
    { kilometraje: 205000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, revisión general de suspensión y amortiguadores.' },
    { kilometraje: 210000, servicio: 'Inspección completa de frenos, suspensión, niveles de fluidos.' },
    { kilometraje: 215000, servicio: 'Revisión de sistema de escape, luces, refrigeración, rótulas y terminales.' },
    { kilometraje: 220000, servicio: 'Cambio de filtro de aire, revisión de transmisión, inspección de frenos.' },
    { kilometraje: 225000, servicio: 'Cambio de líquido de frenos, revisión de bujías, suspensión y limpieza del cuerpo de aceleración.' },
    { kilometraje: 230000, servicio: 'Revisión general: frenos, suspensión, niveles de fluidos.' },
    { kilometraje: 235000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, inspección del sistema de escape.' },
    { kilometraje: 240000, servicio: 'Revisión de suspensión, dirección y amortiguadores.' },
    { kilometraje: 245000, servicio: 'Cambio de filtro de aire, limpieza cuerpo de aceleración, revisión de bujías.' },
    { kilometraje: 250000, servicio: 'Inspección completa de frenos, cambio de líquido de frenos.' },
    { kilometraje: 255000, servicio: 'Cambio de aceite y filtro, revisión general de suspensión y transmisión.' },
    { kilometraje: 260000, servicio: 'Revisión visual de motor, limpieza de cuerpo de aceleración, revisión de presión de aceite.' },
    { kilometraje: 265000, servicio: 'Cambio de filtro de cabina, inspección de rótulas, soportes de motor.' },
    { kilometraje: 270000, servicio: 'Revisión de sistema de refrigeración, alineación y balanceo.' },
    { kilometraje: 275000, servicio: 'Cambio de aceite y filtro, revisión de amortiguadores, frenos, luces.' },
    { kilometraje: 280000, servicio: 'Revisión de dirección, suspensión, revisión general de tren motriz.' },
    { kilometraje: 285000, servicio: 'Cambio de filtro de aire, limpieza cuerpo de aceleración, revisión de bujías.' },
    { kilometraje: 290000, servicio: 'Cambio de líquido de frenos, inspección completa del sistema de frenos.' },
    { kilometraje: 300000, servicio: 'Cambio de aceite y filtro, rotación de neumáticos, revisión del sistema de escape.' },
    { kilometraje: 305000, servicio: 'Revisión de suspensión, terminales de dirección, rótulas, presión de aceite.' },
    { kilometraje: 310000, servicio: 'Revisión general de todos los sistemas críticos. Posible revisión mayor de motor.' }
  ]
};

const normalizeModelo = (modelo = '') => modelo.toLowerCase().trim();

const getScheduleForModel = (modelo) => {
  const normalized = normalizeModelo(modelo);

  if (normalized.includes('v-drive') || normalized.includes('v drive')) {
    return schedules['v-drive'];
  }

  if (normalized.includes('march')) {
    return schedules.march;
  }

  return null;
};

const mapServiceToContext = (service, kilometrajeActual) => ({
  kilometraje_objetivo: service.kilometraje,
  tipo_servicio: service.servicio,
  diferencia_km: (Number(service.kilometraje) || 0) - (Number(kilometrajeActual) || 0),
  estado: (Number(service.kilometraje) || 0) >= (Number(kilometrajeActual) || 0) ? 'proximo' : 'vencido'
});

const getMaintenancePlanContext = ({ modelo, kilometrajeActual }) => {
  const schedule = getScheduleForModel(modelo);

  if (!schedule) return null;

  const kmActual = Number(kilometrajeActual) || 0;
  const sorted = [...schedule].sort((a, b) => a.kilometraje - b.kilometraje);

  const proximoServicio = sorted.find(item => item.kilometraje >= kmActual) || null;
  const ultimoServicio = [...sorted].reverse().find(item => item.kilometraje <= kmActual) || null;

  return {
    modelo: normalizeModelo(modelo) || null,
    proximo_servicio: proximoServicio ? mapServiceToContext(proximoServicio, kmActual) : null,
    ultimo_servicio: ultimoServicio ? mapServiceToContext(ultimoServicio, kmActual) : null
  };
};

const findRelevantService = (schedule, kilometrajeActual) => {
  if (!Array.isArray(schedule) || kilometrajeActual == null) return null;

  const kmActual = Number(kilometrajeActual) || 0;
  const sorted = [...schedule].sort((a, b) => a.kilometraje - b.kilometraje);
  const threshold = 1000;

  const proximoServicio = sorted.find(item => item.kilometraje >= kmActual);
  const servicioPrevio = [...sorted].reverse().find(item => item.kilometraje <= kmActual);

  if (proximoServicio && (proximoServicio.kilometraje - kmActual) <= threshold) {
    const diferencia = proximoServicio.kilometraje - kmActual;
    return {
      kilometraje_objetivo: proximoServicio.kilometraje,
      tipo_servicio: proximoServicio.servicio,
      diferencia_km: diferencia,
      estado: diferencia >= 0 ? 'proximo' : 'vencido'
    };
  }

  if (servicioPrevio && kmActual > servicioPrevio.kilometraje) {
    const diferencia = servicioPrevio.kilometraje - kmActual;
    return {
      kilometraje_objetivo: servicioPrevio.kilometraje,
      tipo_servicio: servicioPrevio.servicio,
      diferencia_km: diferencia,
      estado: 'vencido'
    };
  }

  return null;
};

const getPreventiveMaintenanceAlert = ({ modelo, kilometrajeActual }) => {
  const schedule = getScheduleForModel(modelo);

  if (!schedule) return null;

  return findRelevantService(schedule, kilometrajeActual);
};

module.exports = {
  getPreventiveMaintenanceAlert,
  getMaintenancePlanContext,
  schedules
};
