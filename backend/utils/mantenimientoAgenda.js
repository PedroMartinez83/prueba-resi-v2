const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '');

const SLOT_MINUTES = 30;
const SLOT_MS = SLOT_MINUTES * 60 * 1000;

const ESTADOS_ACTIVOS_AGENDA = new Set([
  'pendiente',
  'urgente',
  'proximo',
  'programado',
  'enproceso',
  'reprogramado',
  'solicitado'
]);

const isEstadoActivoAgenda = (estado) => ESTADOS_ACTIVOS_AGENDA.has(normalizeText(estado));

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

const parseDateTime = (fecha, hora) => {
  const dateTime = new Date(`${fecha}T${hora}:00`);
  return Number.isNaN(dateTime.getTime()) ? null : dateTime;
};

const getDayBounds = (fecha) => {
  const start = new Date(`${fecha}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const formatHHmm = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const buildHalfHourSlots = ({ startHour = 9, endHour = 18, includeEndHalf = true } = {}) => {
  const slots = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    slots.push(`${String(hour).padStart(2, '0')}:30`);
  }
  if (!includeEndHalf) return slots.filter((slot) => slot !== `${String(endHour).padStart(2, '0')}:30`);
  return slots;
};

const findConflictingMantenimiento = async ({
  dbClient,
  fechaHoraProgramada,
  excludeId = null
}) => {
  const slotEnd = addMinutes(fechaHoraProgramada, SLOT_MINUTES);

  const candidatos = await dbClient('mantenimientos')
    .select('id', 'folio_servicio', 'estado', 'fecha_programada', 'tipo_servicio', 'vehiculo_id')
    .modify((queryBuilder) => {
      if (excludeId != null) {
        queryBuilder.whereNot('id', excludeId);
      }
    })
    .andWhere('fecha_programada', '<', slotEnd)
    .andWhere(dbClient.raw("fecha_programada + interval '30 minutes' > ?", [fechaHoraProgramada]))
    .orderBy('fecha_programada', 'asc');

  return candidatos.find((item) => isEstadoActivoAgenda(item.estado)) || null;
};

module.exports = {
  SLOT_MINUTES,
  SLOT_MS,
  isEstadoActivoAgenda,
  parseDateTime,
  getDayBounds,
  formatHHmm,
  buildHalfHourSlots,
  findConflictingMantenimiento
};
