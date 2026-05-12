const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ACTIVE_NON_CANCELLED_STATES_SQL = `
  LOWER(TRIM(COALESCE(estado, ''))) NOT IN (
    'completado',
    'cancelado',
    'cancelada'
  )
`;

const NORMALIZED_TIPO_SQL = `
  TRIM(
    REGEXP_REPLACE(
      LOWER(
        TRANSLATE(
          COALESCE(tipo_servicio, ''),
          'ÁÀÂÄÃáàâäãÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñ',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNn'
        )
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  )
`;

const findActiveDuplicateMantenimiento = async (
  dbClient,
  {
    vehiculoId,
    tipoServicio,
    kilometrajeServicio,
    excludeId = null
  } = {}
) => {
  const vehiculoIdNum = Number(vehiculoId);
  const kmNum = Number(kilometrajeServicio);
  const tipoNorm = normalizeText(tipoServicio);

  if (!Number.isInteger(vehiculoIdNum) || vehiculoIdNum <= 0) return null;
  if (!Number.isFinite(kmNum) || kmNum <= 0) return null;
  if (!tipoNorm) return null;

  let query = dbClient('mantenimientos')
    .select('id', 'folio_servicio', 'estado', 'vehiculo_id', 'tipo_servicio', 'kilometraje_servicio', 'fecha_programada')
    .where('vehiculo_id', vehiculoIdNum)
    .andWhereRaw('COALESCE(kilometraje_servicio, 0) = ?', [kmNum])
    .andWhereRaw(`${NORMALIZED_TIPO_SQL} = ?`, [tipoNorm])
    .andWhereRaw(ACTIVE_NON_CANCELLED_STATES_SQL)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  if (excludeId != null) {
    query = query.whereNot('id', excludeId);
  }

  return query.first();
};

const findActiveDuplicateByVehiculoServicio = async (
  dbClient,
  {
    vehiculoId,
    tipoServicio,
    excludeId = null
  } = {}
) => {
  const vehiculoIdNum = Number(vehiculoId);
  const tipoNorm = normalizeText(tipoServicio);

  if (!Number.isInteger(vehiculoIdNum) || vehiculoIdNum <= 0) return null;
  if (!tipoNorm) return null;

  let query = dbClient('mantenimientos')
    .select('id', 'folio_servicio', 'estado', 'vehiculo_id', 'tipo_servicio', 'kilometraje_servicio', 'fecha_programada')
    .where('vehiculo_id', vehiculoIdNum)
    .andWhereRaw(`${NORMALIZED_TIPO_SQL} = ?`, [tipoNorm])
    .andWhereRaw(ACTIVE_NON_CANCELLED_STATES_SQL)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');

  if (excludeId != null) {
    query = query.whereNot('id', excludeId);
  }

  return query.first();
};

const findActiveSiblingsByKmServicio = async (
  dbClient,
  {
    mantenimientoId,
    vehiculoId,
    tipoServicio,
    kilometrajeServicio
  } = {}
) => {
  const idNum = Number(mantenimientoId);
  const vehiculoIdNum = Number(vehiculoId);
  const kmNum = Number(kilometrajeServicio);
  const tipoNorm = normalizeText(tipoServicio);

  if (!Number.isInteger(idNum) || idNum <= 0) return [];
  if (!Number.isInteger(vehiculoIdNum) || vehiculoIdNum <= 0) return [];
  if (!Number.isFinite(kmNum) || kmNum <= 0) return [];
  if (!tipoNorm) return [];

  return dbClient('mantenimientos')
    .select('id', 'folio_servicio', 'estado', 'observaciones')
    .where('vehiculo_id', vehiculoIdNum)
    .whereNot('id', idNum)
    .andWhereRaw('COALESCE(kilometraje_servicio, 0) = ?', [kmNum])
    .andWhereRaw('LOWER(TRIM(COALESCE(tipo_servicio, \'\'))) = ?', [tipoNorm])
    .andWhereRaw(ACTIVE_NON_CANCELLED_STATES_SQL)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc');
};

module.exports = {
  normalizeText,
  findActiveDuplicateByVehiculoServicio,
  findActiveDuplicateMantenimiento,
  findActiveSiblingsByKmServicio
};
