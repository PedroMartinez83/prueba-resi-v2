const INTERVALO_PREVENTIVO_KM = 10000;
const SCHEDULE_MAX_KM = 1000000;

const GENERIC_CONFIG_KEY = 'generico_10000km';
const BYD_DOLPHIN_MINI_KEY = 'byd_dolphin_mini';

const GENERIC_PATTERN = Object.freeze([
  {
    codigo: 'A',
    nivel: 'Basico',
    incluye_rotacion: false,
    servicio: 'Servicio A (Basico): cambio de aceite y filtro, inspeccion general de frenos/llantas/suspension/direccion, revision basica de aire acondicionado, niveles y lubricacion.'
  },
  {
    codigo: 'B',
    nivel: 'Intermedio',
    incluye_rotacion: false,
    servicio: 'Servicio B (Intermedio): cambio de aceite y filtro, inspeccion general de frenos/llantas/suspension/direccion, revision basica de aire acondicionado, niveles, lubricacion, filtro de aire, revision profunda de frenos, suspension y direccion.'
  },
  {
    codigo: 'A',
    nivel: 'Basico',
    incluye_rotacion: true,
    servicio: 'Servicio A (Basico) + rotacion de llantas: cambio de aceite y filtro, inspeccion general de frenos/llantas/suspension/direccion, revision basica de aire acondicionado, niveles, lubricacion y rotacion de llantas.'
  },
  {
    codigo: 'C',
    nivel: 'Mayor',
    incluye_rotacion: false,
    servicio: 'Servicio C (Mayor): cambio de aceite y filtro, inspeccion general de frenos/llantas/suspension/direccion, revision basica de aire acondicionado, niveles, lubricacion, filtro de aire, revision profunda de frenos, suspension y direccion, bujias, sistema de enfriamiento, bandas/mangueras y limpieza de admision.'
  },
  {
    codigo: 'A',
    nivel: 'Basico',
    incluye_rotacion: false,
    servicio: 'Servicio A (Basico): cambio de aceite y filtro, inspeccion general de frenos/llantas/suspension/direccion, revision basica de aire acondicionado, niveles y lubricacion.'
  },
  {
    codigo: 'B',
    nivel: 'Intermedio',
    incluye_rotacion: true,
    servicio: 'Servicio B (Intermedio) + rotacion de llantas: cambio de aceite y filtro, inspeccion general de frenos/llantas/suspension/direccion, revision basica de aire acondicionado, niveles, lubricacion, filtro de aire, revision profunda de frenos, suspension y direccion, rotacion de llantas, filtro de gasolina y revision de escape.'
  },
  {
    codigo: 'A',
    nivel: 'Basico',
    incluye_rotacion: false,
    servicio: 'Servicio A (Basico): cambio de aceite y filtro, inspeccion general de frenos/llantas/suspension/direccion, revision basica de aire acondicionado, niveles y lubricacion.'
  },
  {
    codigo: 'C',
    nivel: 'Mayor',
    incluye_rotacion: false,
    servicio: 'Servicio C (Mayor): cambio de aceite y filtro, inspeccion general de frenos/llantas/suspension/direccion, revision basica de aire acondicionado, niveles, lubricacion, filtro de aire, revision profunda de frenos, suspension y direccion, bujias, sistema de enfriamiento, bandas/mangueras, limpieza de admision, revision profunda de suspension y sistema electrico.'
  },
  {
    codigo: 'A',
    nivel: 'Basico',
    incluye_rotacion: true,
    servicio: 'Servicio A (Basico) + rotacion de llantas: cambio de aceite y filtro, inspeccion general de frenos/llantas/suspension/direccion, revision basica de aire acondicionado, niveles, lubricacion y rotacion de llantas.'
  },
  {
    codigo: 'D',
    nivel: 'Critico',
    incluye_rotacion: false,
    servicio: 'Servicio D (Critico): aceite CVT, transmision completa, anticongelante y revision estructural total.'
  }
]);

const BYD_DOLPHIN_MINI_PATTERN = Object.freeze([
  {
    codigo: 'S1',
    nivel: 'Inspeccion',
    incluye_rotacion: false,
    servicio: 'Servicio 1 BYD Dolphin Mini: inspeccion general de todo el vehiculo.',
    costo_estimado: 1535,
    mano_obra_horas: 1.8
  },
  {
    codigo: 'S2',
    nivel: 'Inspeccion',
    incluye_rotacion: false,
    servicio: 'Servicio 2 BYD Dolphin Mini: inspeccion general de todo el vehiculo.',
    costo_estimado: 1535,
    mano_obra_horas: 1.8
  },
  {
    codigo: 'S3',
    nivel: 'Intermedio',
    incluye_rotacion: false,
    servicio: 'Servicio 3 BYD Dolphin Mini: inspeccion general de todo el vehiculo, cambio de aceite de transmision + juntas y cambio de liquido de frenos.',
    costo_estimado: 3988,
    mano_obra_horas: 3.8
  },
  {
    codigo: 'S4',
    nivel: 'Inspeccion',
    incluye_rotacion: false,
    servicio: 'Servicio 4 BYD Dolphin Mini: inspeccion general de todo el vehiculo.',
    costo_estimado: 1535,
    mano_obra_horas: 1.8
  },
  {
    codigo: 'S5',
    nivel: 'Mayor',
    incluye_rotacion: false,
    servicio: 'Servicio 5 BYD Dolphin Mini: inspeccion general de todo el vehiculo, cambio de aceite de transmision + juntas, cambio de liquido de frenos y cambio de anticongelante de motor.',
    costo_estimado: 4959,
    mano_obra_horas: 4.4
  },
  {
    codigo: 'S6',
    nivel: 'Inspeccion',
    incluye_rotacion: false,
    servicio: 'Servicio 6 BYD Dolphin Mini: inspeccion general de todo el vehiculo.',
    costo_estimado: 1535,
    mano_obra_horas: 1.8
  },
  {
    codigo: 'S7',
    nivel: 'Intermedio',
    incluye_rotacion: false,
    servicio: 'Servicio 7 BYD Dolphin Mini: inspeccion general de todo el vehiculo, cambio de aceite de transmision + juntas y cambio de liquido de frenos.',
    costo_estimado: 3988,
    mano_obra_horas: 3.8
  },
  {
    codigo: 'S8',
    nivel: 'Inspeccion',
    incluye_rotacion: false,
    servicio: 'Servicio 8 BYD Dolphin Mini: inspeccion general de todo el vehiculo.',
    costo_estimado: 1535,
    mano_obra_horas: 1.8
  },
  {
    codigo: 'S9',
    nivel: 'Mayor',
    incluye_rotacion: false,
    servicio: 'Servicio 9 BYD Dolphin Mini: inspeccion general de todo el vehiculo, cambio de aceite de transmision + juntas, cambio de liquido de frenos y cambio de anticongelante de motor.',
    costo_estimado: 4959,
    mano_obra_horas: 4.4
  }
]);

const PREVENTIVE_SCHEDULE_CONFIGS = Object.freeze({
  [GENERIC_CONFIG_KEY]: {
    key: GENERIC_CONFIG_KEY,
    label: 'Tabla preventiva generica (cada 10,000 km)',
    start_km: 10000,
    interval_km: 10000,
    pattern: GENERIC_PATTERN
  },
  [BYD_DOLPHIN_MINI_KEY]: {
    key: BYD_DOLPHIN_MINI_KEY,
    label: 'Tabla preventiva BYD Dolphin Mini',
    start_km: 5000,
    interval_km: 20000,
    pattern: BYD_DOLPHIN_MINI_PATTERN
  }
});

const normalizeModelo = (modelo = '') => {
  if (modelo === null || modelo === undefined) return '';
  return modelo
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};
const isBydDolphinMini = (modelo = '') => {
  const normalized = normalizeModelo(modelo);
  if (!normalized) return false;
  const hasDolphinMini = normalized.includes('dolphin') && normalized.includes('mini');
  const hasBydDolphinMini = normalized.includes('byd') && hasDolphinMini;
  return hasBydDolphinMini || hasDolphinMini;
};

const getScheduleConfigForModel = (modelo) => {
  if (isBydDolphinMini(modelo)) return PREVENTIVE_SCHEDULE_CONFIGS[BYD_DOLPHIN_MINI_KEY];
  return PREVENTIVE_SCHEDULE_CONFIGS[GENERIC_CONFIG_KEY];
};

const getPatternIndexForMilestone = (milestoneKm, config) => {
  const startKm = Number(config?.start_km || 0);
  const intervalKm = Math.max(Number(config?.interval_km || INTERVALO_PREVENTIVO_KM), 1);
  const rawStep = Math.max(Math.round((Number(milestoneKm || startKm) - startKm) / intervalKm), 0);
  const size = Math.max(Array.isArray(config?.pattern) ? config.pattern.length : 0, 1);
  return rawStep % size;
};

const buildScheduleItem = (config, milestoneKm) => {
  const startKm = Number(config?.start_km || 0);
  const kmObjetivo = Math.max(Number(milestoneKm || 0), startKm);
  const pattern = Array.isArray(config?.pattern) ? config.pattern : [];
  const index = getPatternIndexForMilestone(kmObjetivo, config);
  const definition = pattern[index] || {};

  return {
    kilometraje: kmObjetivo,
    servicio: definition.servicio || null,
    servicio_codigo: definition.codigo || null,
    servicio_nivel: definition.nivel || null,
    incluye_rotacion: Boolean(definition.incluye_rotacion),
    costo_estimado: Number(definition.costo_estimado || 0) || null,
    mano_obra_horas: Number(definition.mano_obra_horas || 0) || null,
    esquema: config?.key || null
  };
};

const buildScheduleFromConfig = (config, maxKilometraje = SCHEDULE_MAX_KM) => {
  const startKm = Number(config?.start_km || 0);
  const intervalKm = Math.max(Number(config?.interval_km || INTERVALO_PREVENTIVO_KM), 1);
  const maxKm = Math.max(Number(maxKilometraje) || SCHEDULE_MAX_KM, startKm);
  const schedule = [];

  for (let km = startKm; km <= maxKm; km += intervalKm) {
    schedule.push(buildScheduleItem(config, km));
  }

  return schedule;
};

const schedules = {
  generic: buildScheduleFromConfig(PREVENTIVE_SCHEDULE_CONFIGS[GENERIC_CONFIG_KEY]),
  [GENERIC_CONFIG_KEY]: buildScheduleFromConfig(PREVENTIVE_SCHEDULE_CONFIGS[GENERIC_CONFIG_KEY]),
  [BYD_DOLPHIN_MINI_KEY]: buildScheduleFromConfig(PREVENTIVE_SCHEDULE_CONFIGS[BYD_DOLPHIN_MINI_KEY])
};

const getScheduleForModel = (modelo) => {
  const config = getScheduleConfigForModel(modelo);
  return schedules[config.key] || schedules.generic;
};

const getNextMilestoneKm = (kilometrajeActual, config) => {
  const kmActual = Math.max(Number(kilometrajeActual) || 0, 0);
  const startKm = Number(config?.start_km || 0);
  const intervalKm = Math.max(Number(config?.interval_km || INTERVALO_PREVENTIVO_KM), 1);

  if (kmActual <= startKm) return startKm;
  const steps = Math.ceil((kmActual - startKm) / intervalKm);
  return startKm + (steps * intervalKm);
};

const getPreviousMilestoneKm = (kilometrajeActual, config) => {
  const kmActual = Math.max(Number(kilometrajeActual) || 0, 0);
  const startKm = Number(config?.start_km || 0);
  const intervalKm = Math.max(Number(config?.interval_km || INTERVALO_PREVENTIVO_KM), 1);

  if (kmActual < startKm) return null;
  const steps = Math.floor((kmActual - startKm) / intervalKm);
  return startKm + (steps * intervalKm);
};

const mapServiceToContext = (service, kilometrajeActual) => ({
  kilometraje_objetivo: service.kilometraje,
  tipo_servicio: service.servicio,
  servicio_codigo: service.servicio_codigo || null,
  servicio_nivel: service.servicio_nivel || null,
  incluye_rotacion: Boolean(service.incluye_rotacion),
  costo_estimado: service.costo_estimado || null,
  mano_obra_horas: service.mano_obra_horas || null,
  esquema: service.esquema || null,
  diferencia_km: (Number(service.kilometraje) || 0) - (Number(kilometrajeActual) || 0),
  estado: (Number(service.kilometraje) || 0) >= (Number(kilometrajeActual) || 0) ? 'proximo' : 'vencido'
});

const getMaintenancePlanContext = ({ modelo, kilometrajeActual }) => {
  const config = getScheduleConfigForModel(modelo);
  const schedule = schedules[config.key] || schedules.generic;

  if (!schedule) return null;

  const kmActual = Number(kilometrajeActual) || 0;
  const proximoServicioKm = getNextMilestoneKm(kmActual, config);
  const proximoServicio = buildScheduleItem(config, proximoServicioKm);

  const ultimoServicioKm = getPreviousMilestoneKm(kmActual, config);
  const ultimoServicio = ultimoServicioKm != null
    ? buildScheduleItem(config, ultimoServicioKm)
    : null;

  return {
    modelo: normalizeModelo(modelo) || null,
    esquema: config.key,
    proximo_servicio: proximoServicio ? mapServiceToContext(proximoServicio, kmActual) : null,
    ultimo_servicio: ultimoServicio ? mapServiceToContext(ultimoServicio, kmActual) : null
  };
};

const findRelevantService = (schedule, kilometrajeActual, config) => {
  if (!Array.isArray(schedule) || kilometrajeActual == null || !config) return null;

  const kmActual = Number(kilometrajeActual) || 0;
  const threshold = 1000;

  const proximoServicioKm = getNextMilestoneKm(kmActual, config);
  const proximoServicio = buildScheduleItem(config, proximoServicioKm);

  const servicioPrevioKm = getPreviousMilestoneKm(kmActual, config);
  const servicioPrevio = servicioPrevioKm != null
    ? buildScheduleItem(config, servicioPrevioKm)
    : null;

  if (proximoServicio && (proximoServicio.kilometraje - kmActual) <= threshold) {
    const diferencia = proximoServicio.kilometraje - kmActual;
    return {
      kilometraje_objetivo: proximoServicio.kilometraje,
      tipo_servicio: proximoServicio.servicio,
      servicio_codigo: proximoServicio.servicio_codigo || null,
      servicio_nivel: proximoServicio.servicio_nivel || null,
      incluye_rotacion: Boolean(proximoServicio.incluye_rotacion),
      costo_estimado: proximoServicio.costo_estimado || null,
      mano_obra_horas: proximoServicio.mano_obra_horas || null,
      esquema: proximoServicio.esquema || null,
      diferencia_km: diferencia,
      estado: diferencia >= 0 ? 'proximo' : 'vencido'
    };
  }

  if (servicioPrevio && kmActual > servicioPrevio.kilometraje) {
    const diferencia = servicioPrevio.kilometraje - kmActual;
    return {
      kilometraje_objetivo: servicioPrevio.kilometraje,
      tipo_servicio: servicioPrevio.servicio,
      servicio_codigo: servicioPrevio.servicio_codigo || null,
      servicio_nivel: servicioPrevio.servicio_nivel || null,
      incluye_rotacion: Boolean(servicioPrevio.incluye_rotacion),
      costo_estimado: servicioPrevio.costo_estimado || null,
      mano_obra_horas: servicioPrevio.mano_obra_horas || null,
      esquema: servicioPrevio.esquema || null,
      diferencia_km: diferencia,
      estado: 'vencido'
    };
  }

  return null;
};

const getPreventiveMaintenanceAlert = ({ modelo, kilometrajeActual }) => {
  const config = getScheduleConfigForModel(modelo);
  const schedule = schedules[config.key] || schedules.generic;

  if (!schedule) return null;

  return findRelevantService(schedule, kilometrajeActual, config);
};

const ESTADOS_MANTENIMIENTO_CANONICOS = Object.freeze({
  PENDIENTE: 'Pendiente',
  PROGRAMADO: 'Programado',
  EN_PROCESO: 'En proceso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
  REPROGRAMADO: 'Reprogramado'
});

const ESTADOS_FINANCIEROS_CANONICOS = Object.freeze({
  CAPTURADO: 'capturado',
  VALIDADO_FINANZAS: 'validado_finanzas',
  PAGADO: 'pagado'
});

const ALIAS_ESTADOS_MANTENIMIENTO = Object.freeze({
  pendiente: ESTADOS_MANTENIMIENTO_CANONICOS.PENDIENTE,
  solicitado: ESTADOS_MANTENIMIENTO_CANONICOS.PENDIENTE,
  programado: ESTADOS_MANTENIMIENTO_CANONICOS.PROGRAMADO,
  agendado: ESTADOS_MANTENIMIENTO_CANONICOS.PROGRAMADO,
  enproceso: ESTADOS_MANTENIMIENTO_CANONICOS.EN_PROCESO,
  en_proceso: ESTADOS_MANTENIMIENTO_CANONICOS.EN_PROCESO,
  enprogreso: ESTADOS_MANTENIMIENTO_CANONICOS.EN_PROCESO,
  taller: ESTADOS_MANTENIMIENTO_CANONICOS.EN_PROCESO,
  terminado: ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO,
  completado: ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO,
  finalizado: ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO,
  cancelado: ESTADOS_MANTENIMIENTO_CANONICOS.CANCELADO,
  cancelada: ESTADOS_MANTENIMIENTO_CANONICOS.CANCELADO,
  reprogramado: ESTADOS_MANTENIMIENTO_CANONICOS.REPROGRAMADO,
  reprogramada: ESTADOS_MANTENIMIENTO_CANONICOS.REPROGRAMADO
});

const ALIAS_ESTADOS_FINANCIEROS = Object.freeze({
  pendiente: ESTADOS_FINANCIEROS_CANONICOS.CAPTURADO,
  capturado: ESTADOS_FINANCIEROS_CANONICOS.CAPTURADO,
  capturada: ESTADOS_FINANCIEROS_CANONICOS.CAPTURADO,
  distribuido: ESTADOS_FINANCIEROS_CANONICOS.VALIDADO_FINANZAS,
  validado: ESTADOS_FINANCIEROS_CANONICOS.VALIDADO_FINANZAS,
  validada: ESTADOS_FINANCIEROS_CANONICOS.VALIDADO_FINANZAS,
  validado_finanzas: ESTADOS_FINANCIEROS_CANONICOS.VALIDADO_FINANZAS,
  pagado: ESTADOS_FINANCIEROS_CANONICOS.PAGADO,
  pagada: ESTADOS_FINANCIEROS_CANONICOS.PAGADO
});

const normalizeLookupKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_');

const normalizeEstadoMantenimiento = (estado) => {
  const key = normalizeLookupKey(estado).replace(/-/g, '_');
  const compactKey = key.replace(/_/g, '');
  return ALIAS_ESTADOS_MANTENIMIENTO[key] || ALIAS_ESTADOS_MANTENIMIENTO[compactKey] || null;
};

const normalizeEstadoFinanciero = (estado) => {
  const key = normalizeLookupKey(estado).replace(/-/g, '_');
  const compactKey = key.replace(/_/g, '');
  return ALIAS_ESTADOS_FINANCIEROS[key] || ALIAS_ESTADOS_FINANCIEROS[compactKey] || null;
};

const mapDistribucionEstadoToFinanciero = (estadoDistribucion) =>
  normalizeEstadoFinanciero(estadoDistribucion) || ESTADOS_FINANCIEROS_CANONICOS.CAPTURADO;

const mapFinancieroToDistribucionEstado = (estadoFinanciero) => {
  const normalized = normalizeEstadoFinanciero(estadoFinanciero);

  if (normalized === ESTADOS_FINANCIEROS_CANONICOS.CAPTURADO) return 'pendiente';
  if (normalized === ESTADOS_FINANCIEROS_CANONICOS.VALIDADO_FINANZAS) return 'distribuido';
  if (normalized === ESTADOS_FINANCIEROS_CANONICOS.PAGADO) return 'pagado';
  return null;
};

const toEstadoOperativoSlug = (estado) => {
  const normalized = normalizeEstadoMantenimiento(estado);
  if (normalized === ESTADOS_MANTENIMIENTO_CANONICOS.PENDIENTE) return 'pendiente';
  if (normalized === ESTADOS_MANTENIMIENTO_CANONICOS.PROGRAMADO) return 'programado';
  if (normalized === ESTADOS_MANTENIMIENTO_CANONICOS.EN_PROCESO) return 'en_proceso';
  if (normalized === ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO) return 'terminado';
  if (normalized === ESTADOS_MANTENIMIENTO_CANONICOS.CANCELADO) return 'cancelado';
  if (normalized === ESTADOS_MANTENIMIENTO_CANONICOS.REPROGRAMADO) return 'reprogramado';
  return 'pendiente';
};

const getIntervaloMantenimientoKm = (tipoSocio) => {
  void tipoSocio;
  return INTERVALO_PREVENTIVO_KM;
};

const getSiguienteServicioKm = (kilometrajeActual, tipoSocio) => {
  const km = Math.max(Number(kilometrajeActual) || 0, 0);
  const intervalo = getIntervaloMantenimientoKm(tipoSocio);
  return Math.ceil(km / intervalo) * intervalo || intervalo;
};

const getUmbralAlertaKm = (siguienteServicioKm, tipoSocio) => {
  const intervalo = getIntervaloMantenimientoKm(tipoSocio);
  const buffer = Math.round(intervalo * 0.1);
  return Math.max((Number(siguienteServicioKm) || intervalo) - buffer, 0);
};

const getEstadoPreventivo = ({ kilometrajeActual, siguienteServicioKm, tipoSocio }) => {
  const km = Number(kilometrajeActual) || 0;
  const objetivo = Number(siguienteServicioKm) || getIntervaloMantenimientoKm(tipoSocio);
  const umbral = getUmbralAlertaKm(objetivo, tipoSocio);

  if (km >= objetivo) return 'vencido';
  if (km >= umbral) return 'alerta';
  return 'normal';
};

const DIAS_RECORDATORIO_KM = Object.freeze([2, 3, 5]); // martes, miercoles, viernes

const DAY_LABELS = Object.freeze({
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado'
});

const getDiaSemana = (dateInput = new Date()) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
};

const buildRecordatorioRegistroKm = (dateInput = new Date()) => {
  const dayNumber = getDiaSemana(dateInput);
  const esDiaRecordatorio = dayNumber != null && DIAS_RECORDATORIO_KM.includes(dayNumber);
  const diaSemana = dayNumber == null ? null : (DAY_LABELS[dayNumber] || null);

  return {
    mostrar: esDiaRecordatorio,
    dia_semana: diaSemana,
    dias_recordatorio: DIAS_RECORDATORIO_KM.map((d) => DAY_LABELS[d]),
    mensaje: esDiaRecordatorio
      ? 'Hoy corresponde recordatorio de captura de kilometraje.'
      : 'Captura tu kilometraje con regularidad para mantener el plan preventivo al dia.'
  };
};

const buildPreventivoAlertas = ({ kilometrajeActual, siguienteServicioKm, tipoSocio }) => {
  const kmActual = Math.max(Number(kilometrajeActual) || 0, 0);
  const objetivoKm = Number(siguienteServicioKm) || getSiguienteServicioKm(kmActual, tipoSocio);
  const umbralPreventivoKm = getUmbralAlertaKm(objetivoKm, tipoSocio);
  const kilometrosRestantes = objetivoKm - kmActual;

  const vencido = kmActual >= objetivoKm;
  const alertaPreventiva = !vencido && kmActual >= umbralPreventivoKm;
  const alertaCapacidadTaller = !vencido && kilometrosRestantes <= 1000;

  let nivel = 'normal';
  let mensaje = 'Sin alertas de mantenimiento por kilometraje.';

  if (vencido) {
    nivel = 'critica';
    mensaje = 'Mantenimiento vencido. Programa servicio inmediato.';
  } else if (alertaCapacidadTaller) {
    nivel = 'alta';
    mensaje = `Quedan ${Math.max(kilometrosRestantes, 0).toLocaleString('es-MX')} km para el servicio. Agenda tu cita para asegurar espacio en taller.`;
  } else if (alertaPreventiva) {
    nivel = 'media';
    mensaje = `Entraste en ventana preventiva. Servicio objetivo en ${objetivoKm.toLocaleString('es-MX')} km.`;
  }

  return {
    nivel,
    mensaje,
    kilometraje_actual: kmActual,
    siguiente_servicio_km: objetivoKm,
    umbral_preventivo_km: umbralPreventivoKm,
    kilometros_restantes: kilometrosRestantes,
    vencido,
    alerta_preventiva: alertaPreventiva,
    alerta_capacidad_taller: alertaCapacidadTaller
  };
};

module.exports = {
  getPreventiveMaintenanceAlert,
  getMaintenancePlanContext,
  schedules,
  ESTADOS_MANTENIMIENTO_CANONICOS,
  ESTADOS_FINANCIEROS_CANONICOS,
  normalizeEstadoMantenimiento,
  normalizeEstadoFinanciero,
  mapDistribucionEstadoToFinanciero,
  mapFinancieroToDistribucionEstado,
  toEstadoOperativoSlug,
  getIntervaloMantenimientoKm,
  getSiguienteServicioKm,
  getUmbralAlertaKm,
  getEstadoPreventivo,
  buildRecordatorioRegistroKm,
  buildPreventivoAlertas
};


