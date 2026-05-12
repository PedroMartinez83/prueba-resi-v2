const META_PREFIX = '[[MANT_META]]';

const TIPOS_SOLICITUD_OPCIONES = [
  { value: 'preventivo_programado', label: 'Preventivo por kilometraje' },
  { value: 'fuera_programacion', label: 'Fuera de programacion (falla/negligencia)' }
];

const CAUSAS_FUERA_PROGRAMACION_OPCIONES = [
  { value: 'falla_mecanica', label: 'Falla mecanica' },
  { value: 'negligencia_conductor', label: 'Negligencia del conductor' },
  { value: 'siniestro', label: 'Siniestro' },
  { value: 'otro', label: 'Otro' }
];

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const sanitizeDetalle = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 400);

const sanitizeAttachmentValue = (value, max = 500) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);

const sanitizeAttachmentEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;

  const url = sanitizeAttachmentValue(entry.url);
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const originalName = sanitizeAttachmentValue(
    entry.original_name || entry.originalName || entry.nombre_original || entry.name,
    180
  );
  const publicId = sanitizeAttachmentValue(
    entry.public_id || entry.publicId || entry.cloudinary_public_id,
    220
  );
  const resourceType = sanitizeAttachmentValue(
    entry.resource_type || entry.resourceType,
    32
  ).toLowerCase();
  const format = sanitizeAttachmentValue(entry.format, 24).toLowerCase();

  return {
    url,
    original_name: originalName || null,
    public_id: publicId || null,
    resource_type: resourceType || null,
    format: format || null
  };
};

const normalizeAdjuntosAdmin = (value) => {
  if (!value) return [];
  const asArray = Array.isArray(value) ? value : [value];
  return asArray
    .map(sanitizeAttachmentEntry)
    .filter(Boolean)
    .slice(0, 10);
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'si', 'yes', 'on'].includes(normalized);
  }
  return false;
};

const normalizeTipoSolicitud = (value) => {
  const key = normalizeKey(value);
  if (!key) return 'preventivo_programado';

  if (['fuera_programacion', 'fuera_de_programacion', 'correctivo', 'extraordinario'].includes(key)) {
    return 'fuera_programacion';
  }
  return 'preventivo_programado';
};

const normalizeCausaFueraProgramacion = (value) => {
  const key = normalizeKey(value);
  if (!key) return null;

  if (['falla_mecanica', 'falla', 'mecanica'].includes(key)) return 'falla_mecanica';
  if (['negligencia', 'negligencia_conductor'].includes(key)) return 'negligencia_conductor';
  if (['siniestro'].includes(key)) return 'siniestro';
  if (['otro', 'otros'].includes(key)) return 'otro';

  return null;
};

const buildSolicitudMeta = ({
  tipo_solicitud,
  causa_fuera_programacion,
  detalle_fuera_programacion,
  servicio_especial,
  adjuntos_admin,
  sobrecupo_autorizado
}) => {
  const tipo = normalizeTipoSolicitud(tipo_solicitud);
  const isFueraProgramacion = tipo === 'fuera_programacion';
  const causa = isFueraProgramacion
    ? normalizeCausaFueraProgramacion(causa_fuera_programacion)
    : null;
  const detalle = isFueraProgramacion
    ? sanitizeDetalle(detalle_fuera_programacion)
    : '';
  const servicioEspecial = sanitizeDetalle(servicio_especial);
  const adjuntos = normalizeAdjuntosAdmin(adjuntos_admin);

  return {
    tipo_solicitud: tipo,
    causa_fuera_programacion: causa,
    detalle_fuera_programacion: detalle || null,
    servicio_especial: servicioEspecial || null,
    adjuntos_admin: adjuntos,
    sobrecupo_autorizado: normalizeBoolean(sobrecupo_autorizado)
  };
};

const encodeMetaLine = (meta) => `${META_PREFIX}${JSON.stringify(meta)}`;

const extractMetaFromObservaciones = (observaciones) => {
  const raw = String(observaciones || '');
  if (!raw) {
    return {
      observaciones_limpias: null,
      meta: buildSolicitudMeta({})
    };
  }

  const lines = raw.split(/\r?\n/);
  let parsedMeta = null;
  const keptLines = [];

  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed.startsWith(META_PREFIX)) {
      keptLines.push(line);
      continue;
    }

    const payload = trimmed.slice(META_PREFIX.length);
    try {
      const parsed = JSON.parse(payload);
      parsedMeta = buildSolicitudMeta(parsed || {});
    } catch (error) {
      keptLines.push(line);
    }
  }

  const clean = keptLines.join('\n').trim();

  return {
    observaciones_limpias: clean || null,
    meta: parsedMeta || buildSolicitudMeta({})
  };
};

const appendMetaToObservaciones = (observaciones, metaInput = {}) => {
  const clean = extractMetaFromObservaciones(observaciones).observaciones_limpias;
  const meta = buildSolicitudMeta(metaInput);
  const withMeta = [clean, encodeMetaLine(meta)].filter(Boolean).join('\n');
  return withMeta || null;
};

const enrichMantenimientoWithMeta = (record) => {
  if (!record) return record;
  const { observaciones_limpias, meta } = extractMetaFromObservaciones(record.observaciones);
  const servicioEspecialDirecto = sanitizeDetalle(record.servicio_especial);
  return {
    ...record,
    observaciones: observaciones_limpias,
    tipo_solicitud: meta.tipo_solicitud,
    causa_fuera_programacion: meta.causa_fuera_programacion,
    detalle_fuera_programacion: meta.detalle_fuera_programacion,
    servicio_especial: meta.servicio_especial || servicioEspecialDirecto || null,
    adjuntos_admin: meta.adjuntos_admin,
    sobrecupo_autorizado: Boolean(meta.sobrecupo_autorizado)
  };
};

const getSolicitudCatalogo = () => ({
  tipos_solicitud: TIPOS_SOLICITUD_OPCIONES,
  causas_fuera_programacion: CAUSAS_FUERA_PROGRAMACION_OPCIONES
});

module.exports = {
  TIPOS_SOLICITUD_OPCIONES,
  CAUSAS_FUERA_PROGRAMACION_OPCIONES,
  normalizeTipoSolicitud,
  normalizeCausaFueraProgramacion,
  buildSolicitudMeta,
  appendMetaToObservaciones,
  extractMetaFromObservaciones,
  enrichMantenimientoWithMeta,
  getSolicitudCatalogo
};
