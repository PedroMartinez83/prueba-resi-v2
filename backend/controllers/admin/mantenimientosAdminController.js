// backend/controllers/admin/mantenimientosAdminController.js

const { db } = require('../../config/database');
const path = require('path');
const cloudinary = require('../../config/cloudinary');
const {
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
  buildPreventivoAlertas,
  getMaintenancePlanContext
} = require('../../utils/mantenimientoPreventivo');
const {
  SERVICIOS_ESPECIALES_OPCIONES,
  TALLER_CATEGORIAS_OPCIONES
} = require('../../utils/mantenimientoCatalogo');
const {
  buildSolicitudMeta,
  appendMetaToObservaciones,
  extractMetaFromObservaciones,
  enrichMantenimientoWithMeta,
  getSolicitudCatalogo
} = require('../../utils/mantenimientoSolicitudMeta');
const {
  findActiveDuplicateByVehiculoServicio,
  findActiveSiblingsByKmServicio
} = require('../../utils/mantenimientoDuplicados');
const {
  SLOT_MINUTES,
  SLOT_MS,
  isEstadoActivoAgenda,
  getDayBounds,
  formatHHmm,
  buildHalfHourSlots,
  findConflictingMantenimiento
} = require('../../utils/mantenimientoAgenda');

const ROLES_EDICION_PROGRAMACION = new Set([
  'super_admin',
  'direccion',
  'director',
  'gerente_ops',
  'finanzas',
  'jefe_taller',
  'compras'
]);
const ROLES_DISTRIBUCION_GASTOS = new Set([
  'super_admin',
  'direccion',
  'director',
  'finanzas'
]);
const CAMPOS_EDICION_PROGRAMACION = new Set([
  'fecha_programada',
  'hora_programada',
  'tipo_servicio',
  'kilometraje_servicio',
  'proximo_servicio_km',
  'taller',
  'taller_otro_detalle'
]);
const UMBRAL_ALERTA_KM = 1000;
const ESTADOS_ALERTA_URGENTE = Object.freeze([
  'pendiente',
  'solicitado',
  'urgente'
]);

const normalizeEstadoKey = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[_\s]+/g, '');

const ESTADOS_OPERATIVOS_PROGRAMADOS = new Set(['programado', 'reprogramado', 'confirmado']);
const ESTADOS_NO_OPERATIVOS_UI = "('completado', 'cancelado', 'cancelada', 'en proceso', 'en_proceso')";
const ESTADOS_SQL_PROGRAMADOS = "('programado', 'programada', 'reprogramado', 'reprogramada', 'confirmado', 'confirmada')";
const ESTADOS_SQL_ALERTA = "('pendiente', 'solicitado', 'urgente')";

const deriveEstadoUI = (row = {}) => {
  const estadoCanonico = normalizeEstadoMantenimiento(row.estado) || row.estado;
  const estadoKey = normalizeEstadoKey(estadoCanonico);

  if (estadoKey === 'completado') return ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO;
  if (estadoKey === 'cancelado') return ESTADOS_MANTENIMIENTO_CANONICOS.CANCELADO;
  if (estadoKey === 'enproceso') return ESTADOS_MANTENIMIENTO_CANONICOS.EN_PROCESO;

  const fechaProgramada = row?.fecha_programada ? new Date(row.fecha_programada) : null;
  if (!fechaProgramada || Number.isNaN(fechaProgramada.getTime())) {
    return ESTADOS_MANTENIMIENTO_CANONICOS.PENDIENTE;
  }

  const now = new Date();
  if (ESTADOS_OPERATIVOS_PROGRAMADOS.has(estadoKey)) {
    // Programado/Reprogramado/Confirmado se mantiene como estado operativo
    // y no debe mutar a "Urgente" solo por cercania de fecha.
    if (fechaProgramada < now) return 'Vencido';
    return ESTADOS_MANTENIMIENTO_CANONICOS.PROGRAMADO;
  }

  if (fechaProgramada < now) return 'Vencido';
  if ((fechaProgramada.getTime() - now.getTime()) <= (7 * 24 * 60 * 60 * 1000)) return 'Urgente';
  return ESTADOS_MANTENIMIENTO_CANONICOS.PENDIENTE;
};

const applyEstadoUiFilter = (queryBuilder, estadoInput) => {
  const estadoKey = normalizeEstadoKey(estadoInput);

  if (estadoKey === 'vencido') {
    return queryBuilder
      .where('m.fecha_programada', '<', db.raw('NOW()'))
      .andWhereRaw(`LOWER(TRIM(COALESCE(m.estado, ''))) NOT IN ${ESTADOS_NO_OPERATIVOS_UI}`);
  }

  if (estadoKey === 'urgente') {
    return queryBuilder
      .whereBetween('m.fecha_programada', [
        db.raw('NOW()'),
        db.raw("NOW() + INTERVAL '7 days'")
      ])
      .andWhereRaw(`LOWER(TRIM(COALESCE(m.estado, ''))) IN ${ESTADOS_SQL_ALERTA}`);
  }

  if (estadoKey === 'programado') {
    return queryBuilder
      .whereRaw(`LOWER(TRIM(COALESCE(m.estado, ''))) IN ${ESTADOS_SQL_PROGRAMADOS}`);
  }

  if (estadoKey === 'enproceso') {
    return queryBuilder.whereRaw("LOWER(TRIM(COALESCE(m.estado, ''))) IN ('en proceso', 'en_proceso')");
  }

  if (estadoKey === 'completado') {
    return queryBuilder.whereRaw("LOWER(TRIM(COALESCE(m.estado, ''))) IN ('completado')");
  }

  if (estadoKey === 'cancelado') {
    return queryBuilder.whereRaw("LOWER(TRIM(COALESCE(m.estado, ''))) IN ('cancelado', 'cancelada')");
  }

  if (estadoKey === 'pendiente') {
    return queryBuilder
      .whereRaw("LOWER(TRIM(COALESCE(m.estado, ''))) IN ('pendiente', 'solicitado')")
      .andWhere(function() {
        this.whereNull('m.fecha_programada')
          .orWhere('m.fecha_programada', '>', db.raw("NOW() + INTERVAL '7 days'"));
      });
  }

  return queryBuilder;
};

const getUserRole = (req) => String(req.user?.rol || req.user?.role || '')
  .trim()
  .toLowerCase();

const resolveSiguienteServicioKmVehiculo = (vehiculo = {}) => {
  const kmActual = Math.max(Number(vehiculo.kilometraje_actual || 0), 0);
  const proximoMantenimiento = Number(vehiculo.proximo_mantenimiento || 0);
  if (proximoMantenimiento > 0) return proximoMantenimiento;
  return getSiguienteServicioKm(kmActual, vehiculo.tipo_socio);
};

const formatDatePart = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimePart = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const normalizeCatalogKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

const TALLER_CATEGORIAS_MAP = new Map(
  TALLER_CATEGORIAS_OPCIONES.map((categoria) => [normalizeCatalogKey(categoria), categoria])
);

const sanitizeShortText = (value, max = 140) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'si', 'yes', 'on'].includes(normalized);
  }
  return false;
};

const hasSobrecupoAutorizado = (observaciones, meta = {}) => {
  if (Boolean(meta?.sobrecupo_autorizado)) return true;
  return /sobrecupo autorizado/i.test(String(observaciones || ''));
};

const MAX_ADJUNTOS_ADMIN = 6;
const MAX_ADJUNTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ADJUNTO_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence'
]);

const buildRequestError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const asArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getAdjuntosAdminFiles = (req) => asArray(req?.files?.adjuntos_admin)
  .filter((file) => file && typeof file === 'object');

const uploadAdjuntoAdmin = async (file, index = 0) => {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  if (!ALLOWED_ADJUNTO_MIME_TYPES.has(mimetype)) {
    throw buildRequestError(400, 'Solo se permiten adjuntos JPG, PNG, WEBP, HEIC o PDF');
  }

  const fileSize = Number(file?.size || 0);
  if (fileSize <= 0) {
    throw buildRequestError(400, `El archivo "${file?.name || 'adjunto'}" esta vacio`);
  }
  if (fileSize > MAX_ADJUNTO_SIZE_BYTES) {
    throw buildRequestError(400, `El archivo "${file?.name || 'adjunto'}" supera el limite de 10MB`);
  }

  if (!file?.tempFilePath) {
    throw buildRequestError(400, `No se pudo procesar el archivo "${file?.name || 'adjunto'}"`);
  }

  const extension = path.extname(String(file?.name || '')).replace('.', '').toLowerCase();
  const resourceType = mimetype === 'application/pdf' ? 'raw' : 'image';
  const result = await cloudinary.uploader.upload(file.tempFilePath, {
    folder: 'automanager/mantenimientos/admin_adjuntos',
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    public_id: `adjunto-${Date.now()}-${index + 1}`
  });

  return {
    url: result.secure_url,
    original_name: String(file?.name || '').slice(0, 180) || null,
    public_id: result.public_id || null,
    resource_type: result.resource_type || resourceType,
    format: result.format || extension || null
  };
};

const uploadAdjuntosAdminFromRequest = async (req, { existing = [] } = {}) => {
  const current = Array.isArray(existing) ? existing : [];
  const files = getAdjuntosAdminFiles(req);

  if (!files.length) {
    return current;
  }

  if ((current.length + files.length) > MAX_ADJUNTOS_ADMIN) {
    throw buildRequestError(
      400,
      `Solo se permiten hasta ${MAX_ADJUNTOS_ADMIN} adjuntos por mantenimiento`
    );
  }

  const uploaded = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    // subida secuencial para evitar picos de memoria en multipart grandes
    // y mantener trazabilidad en caso de error
    // eslint-disable-next-line no-await-in-loop
    const item = await uploadAdjuntoAdmin(file, i);
    uploaded.push(item);
  }

  return [...current, ...uploaded];
};

const resolveTallerValue = ({
  taller,
  taller_otro_detalle,
  fallbackTaller = ''
}) => {
  const categoriaRaw = sanitizeShortText(taller, 80);
  const detalleOtroRaw = sanitizeShortText(taller_otro_detalle, 120);

  if (!categoriaRaw) {
    return {
      success: true,
      value: sanitizeShortText(fallbackTaller, 140) || null
    };
  }

  const categoriaNormalizada = normalizeCatalogKey(categoriaRaw);
  const categoriaCanonica = TALLER_CATEGORIAS_MAP.get(categoriaNormalizada);

  if (!categoriaCanonica) {
    // Compatibilidad con valores legacy guardados previamente
    return {
      success: true,
      value: categoriaRaw
    };
  }

  if (normalizeCatalogKey(categoriaCanonica) === normalizeCatalogKey('Otro')) {
    if (!detalleOtroRaw) {
      const fallback = sanitizeShortText(fallbackTaller, 140);
      if (fallback) {
        return {
          success: true,
          value: fallback
        };
      }
      return {
        success: false,
        message: 'Debes capturar la descripcion del taller cuando seleccionas "Otro"'
      };
    }
    return {
      success: true,
      value: `Otro: ${detalleOtroRaw}`
    };
  }

  return {
    success: true,
    value: categoriaCanonica
  };
};

const getServicioPreventivoSugerido = (modelo, kilometrajeActual) => {
  const plan = getMaintenancePlanContext({
    modelo,
    kilometrajeActual
  });
  const proximo = plan?.proximo_servicio;
  if (!proximo) return null;

  return {
    kilometraje: Number(proximo.kilometraje_objetivo || 0),
    servicio: proximo.tipo_servicio || null,
    servicio_codigo: proximo.servicio_codigo || null,
    servicio_nivel: proximo.servicio_nivel || null,
    incluye_rotacion: Boolean(proximo.incluye_rotacion),
    costo_estimado: proximo.costo_estimado || null,
    mano_obra_horas: proximo.mano_obra_horas || null,
    esquema: proximo.esquema || null
  };
};

const formatMantenimientoOperativo = (row) => ({
  ...enrichMantenimientoWithMeta(row),
  estado_operativo: toEstadoOperativoSlug(row.estado),
  estado_operativo_label: normalizeEstadoMantenimiento(row.estado) || row.estado
});

// ============================================
// OBTENER TODOS LOS MANTENIMIENTOS CON FILTROS
// ============================================
exports.getMantenimientos = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      estado,
      tipo_servicio,
      vehiculo_id,
      conductor_id,
      fecha_desde,
      fecha_hasta,
      search
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const requestedLimit = Math.max(parseInt(limit, 10) || 50, 1);
    const pageSize = Math.min(requestedLimit, 1000);
    const offset = (pageNumber - 1) * pageSize;

    // Query base
    let query = db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'v.tipo_socio',
        'v.kilometraje_actual as km_actual_vehiculo',
        'c.id as conductor_id',
        'c.nombre_conductor',
        'c.numero_telefono as conductor_telefono',
        'a.renta_diaria',
        db.raw(`
          CASE
            WHEN LOWER(TRIM(COALESCE(m.estado, ''))) IN ('completado', 'cancelado', 'cancelada') THEN 0
            WHEN COALESCE(m.proximo_servicio_km, 0) <= 0 THEN 0
            WHEN COALESCE(v.kilometraje_actual, 0) >= COALESCE(m.proximo_servicio_km, 0) THEN 1
            ELSE 0
          END as prioridad_km_vencido
        `),
        db.raw(`
          CASE
            WHEN LOWER(TRIM(COALESCE(m.estado, ''))) IN ('completado', 'cancelado', 'cancelada') THEN 0
            WHEN COALESCE(m.proximo_servicio_km, 0) <= 0 THEN 0
            ELSE GREATEST(COALESCE(v.kilometraje_actual, 0) - COALESCE(m.proximo_servicio_km, 0), 0)
          END as km_exceso_servicio
        `),
        db.raw(`
          CASE
            WHEN LOWER(TRIM(COALESCE(m.estado, ''))) IN ('completado') THEN 4
            WHEN LOWER(TRIM(COALESCE(m.estado, ''))) IN ('cancelado', 'cancelada') THEN 5
            WHEN LOWER(TRIM(COALESCE(m.estado, ''))) IN ('en proceso', 'en_proceso') THEN 3
            WHEN LOWER(TRIM(COALESCE(m.estado, ''))) IN ('programado', 'programada', 'reprogramado', 'reprogramada', 'confirmado', 'confirmada') THEN 2
            WHEN m.fecha_programada < NOW() THEN 0
            WHEN m.fecha_programada BETWEEN NOW() AND NOW() + INTERVAL '7 days' THEN 1
            ELSE 2
          END as prioridad_estado_ui
        `),
        db.raw(`
          CASE 
            WHEN m.estado = 'Completado' THEN 'Completado'
            WHEN m.fecha_programada < NOW() AND m.estado != 'Completado' THEN 'Vencido'
            WHEN m.fecha_programada BETWEEN NOW() AND NOW() + INTERVAL '7 days' THEN 'Urgente'
            WHEN m.fecha_programada BETWEEN NOW() + INTERVAL '8 days' AND NOW() + INTERVAL '30 days' THEN 'Próximo'
            ELSE 'Programado'
          END as status_real
        `),
        db.raw('DATE_PART(\'day\', NOW() - m.fecha_realizada) as dias_desde_ultimo_mant'),
        db.raw('(v.kilometraje_actual - m.kilometraje_servicio) as km_desde_ultimo_mant')
      )
      .leftJoin('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id');

    // Aplicar filtros
if (estado) {
      query = applyEstadoUiFilter(query, estado);
    }

    if (tipo_servicio) {
      query = query.where('m.tipo_servicio', tipo_servicio);
    }

    if (vehiculo_id) {
      query = query.where('m.vehiculo_id', vehiculo_id);
    }

    if (conductor_id) {
      query = query.where('c.id', conductor_id);
    }

    if (fecha_desde) {
      query = query.where('m.fecha_programada', '>=', fecha_desde);
    }

    if (fecha_hasta) {
      query = query.where('m.fecha_programada', '<=', fecha_hasta);
    }

    if (search) {
      query = query.where(function() {
        this.where('v.numero_vehiculo', 'ilike', `%${search}%`)
            .orWhere('c.nombre_conductor', 'ilike', `%${search}%`)
            .orWhere('m.tipo_servicio', 'ilike', `%${search}%`)
            .orWhere('m.taller', 'ilike', `%${search}%`);
      });
    }

    // Contar total (query separado sin los JOINS complejos)
    const totalCountQuery = db('mantenimientos as m')
      .leftJoin('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id');

    // Aplicar los mismos filtros al count
if (estado) {
      applyEstadoUiFilter(totalCountQuery, estado);
    }
    if (tipo_servicio) {
      totalCountQuery.where('m.tipo_servicio', tipo_servicio);
    }
    if (vehiculo_id) {
      totalCountQuery.where('m.vehiculo_id', vehiculo_id);
    }
    if (conductor_id) {
      totalCountQuery.where('c.id', conductor_id);
    }
    if (fecha_desde) {
      totalCountQuery.where('m.fecha_programada', '>=', fecha_desde);
    }
    if (fecha_hasta) {
      totalCountQuery.where('m.fecha_programada', '<=', fecha_hasta);
    }
    if (search) {
      totalCountQuery.where(function() {
        this.where('v.numero_vehiculo', 'ilike', `%${search}%`)
            .orWhere('c.nombre_conductor', 'ilike', `%${search}%`)
            .orWhere('m.tipo_servicio', 'ilike', `%${search}%`)
            .orWhere('m.taller', 'ilike', `%${search}%`);
      });
    }

    const totalResult = await totalCountQuery.count('m.id as count').first();
    const total = parseInt(totalResult.count);

    // Obtener registros paginados
    const mantenimientosRaw = await query
      .orderBy('prioridad_estado_ui', 'asc')
      .orderBy('prioridad_km_vencido', 'desc')
      .orderBy('km_exceso_servicio', 'desc')
      .orderBy('m.fecha_programada', 'asc')
      .limit(pageSize)
      .offset(offset);

    const mantenimientos = mantenimientosRaw.map((row) => {
      const formatted = formatMantenimientoOperativo(row);
      return {
        ...formatted,
        estado_ui: deriveEstadoUI(formatted)
      };
    });

    res.json({
      success: true,
      mantenimientos,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });

  } catch (error) {
    console.error('Error en getMantenimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mantenimientos',
      error: error.message
    });
  }
};

// ============================================
// ESTADÍSTICAS PARA DASHBOARD
// ============================================
exports.getEstadisticas = async (req, res) => {
  try {
    // 1. Totales básicos
    const totalesResult = await db('mantenimientos')
      .select(
        db.raw(`COUNT(*) FILTER (
          WHERE fecha_programada >= NOW()
          AND LOWER(TRIM(estado)) IN ('programado', 'programada', 'reprogramado', 'reprogramada', 'confirmado', 'confirmada')
        ) as programados`),
        db.raw("COUNT(*) FILTER (WHERE estado = 'Completado' AND DATE_TRUNC('month', fecha_realizada) = DATE_TRUNC('month', CURRENT_DATE)) as completados_mes"),
        db.raw(`COUNT(*) FILTER (
          WHERE (
            fecha_programada < NOW()
            AND LOWER(TRIM(estado)) NOT IN ('completado', 'cancelado', 'cancelada', 'en proceso', 'en_proceso')
          ) 
          OR estado = 'Cancelado'
        ) as vencidos`),
        db.raw(`COUNT(*) FILTER (
          WHERE (
            (
              fecha_programada BETWEEN NOW() AND NOW() + INTERVAL '7 days'
              AND LOWER(TRIM(COALESCE(estado, ''))) IN (${ESTADOS_ALERTA_URGENTE.map((estado) => `'${estado}'`).join(', ')})
            )
            OR LOWER(TRIM(COALESCE(estado, ''))) = 'urgente'
          )
          AND LOWER(TRIM(COALESCE(estado, ''))) NOT IN ('completado', 'cancelado', 'cancelada', 'en proceso', 'en_proceso')
        ) as urgentes`),
        db.raw("COUNT(*) FILTER (WHERE estado = 'En proceso') as en_proceso"),
        db.raw("COALESCE(SUM(costo_total) FILTER (WHERE DATE_TRUNC('month', fecha_realizada) = DATE_TRUNC('month', CURRENT_DATE)), 0) as costo_total_mes"),
        db.raw("COALESCE(AVG(costo_total) FILTER (WHERE estado = 'Completado'), 0) as promedio_costo")
      )
      .first();

    // 2. Vehículos que requieren mantenimiento por kilometraje
    const vehiculosParaAlertaKm = await db('vehiculos')
      .select('id', 'tipo_socio', 'kilometraje_actual', 'proximo_mantenimiento');

    const totalVehiculosPorKm = vehiculosParaAlertaKm.reduce((acumulado, vehiculo) => {
      const kmActual = Math.max(Number(vehiculo.kilometraje_actual || 0), 0);
      const siguienteServicioKm = resolveSiguienteServicioKmVehiculo(vehiculo);
      const alerta = buildPreventivoAlertas({
        kilometrajeActual: kmActual,
        siguienteServicioKm,
        tipoSocio: vehiculo.tipo_socio
      });

      const dentroUmbral = Number(alerta.kilometros_restantes || 0) <= UMBRAL_ALERTA_KM;
      return acumulado + ((alerta.vencido || dentroUmbral) ? 1 : 0);
    }, 0);

    // 3. Costos por tipo de servicio (top 5)
    const costosPorTipo = await db('mantenimientos')
      .select('tipo_servicio')
      .sum('costo_total as total')
      .count('* as cantidad')
      .where('estado', 'Completado')
      .whereNotNull('tipo_servicio')
      .groupBy('tipo_servicio')
      .orderBy('total', 'desc')
      .limit(5);

    // 4. Top 10 vehículos con más gastos
    const topVehiculos = await db('mantenimientos as m')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa'
      )
      .sum('m.costo_total as total_gastado')
      .count('m.id as total_mantenimientos')
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .where('m.estado', 'Completado')
      .groupBy('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa')
      .orderBy('total_gastado', 'desc')
      .limit(10);

    // 5. Top 10 vehículos con menor gasto (incluye 0)
    const topVehiculosMenor = await db('vehiculos as v')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa'
      )
      .leftJoin('mantenimientos as m', function() {
        this.on('v.id', '=', 'm.vehiculo_id')
          .andOn('m.estado', '=', db.raw('?', ['Completado']));
      })
      .groupBy('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa')
      .select(
        db.raw('COALESCE(SUM(m.costo_total), 0) as total_gastado'),
        db.raw('COUNT(m.id) as total_mantenimientos')
      )
      .orderBy('total_gastado', 'asc')
      .limit(10);

    // 5. Costos últimos 6 meses
    const costosUltimosMeses = await db('mantenimientos')
      .select(
        db.raw("TO_CHAR(fecha_realizada, 'Mon') as mes"),
        db.raw("TO_CHAR(fecha_realizada, 'YYYY-MM') as mes_year")
      )
      .sum('costo_total as total')
      .count('* as cantidad')
      .where('estado', 'Completado')
      .whereRaw("fecha_realizada >= NOW() - INTERVAL '6 months'")
      .groupBy('mes_year', 'mes')
      .orderBy('mes_year', 'asc');

    res.json({
      success: true,
      estadisticas: {
        programados: parseInt(totalesResult.programados) || 0,
        completados_mes: parseInt(totalesResult.completados_mes) || 0,
        vencidos: parseInt(totalesResult.vencidos) || 0,
        urgentes: parseInt(totalesResult.urgentes) || 0,
        en_proceso: parseInt(totalesResult.en_proceso) || 0,
        por_kilometraje: totalVehiculosPorKm,
        costo_total_mes: parseFloat(totalesResult.costo_total_mes) || 0,
        promedio_costo: parseFloat(totalesResult.promedio_costo) || 0
      },
      costos_por_tipo: costosPorTipo,
      top_vehiculos: topVehiculos,
      top_vehiculos_menor: topVehiculosMenor,
      costos_mensuales: costosUltimosMeses
    });

  } catch (error) {
    console.error('Error en getEstadisticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

// ============================================
// ALERTAS DE VENCIMIENTOS
// ============================================
exports.getAlertas = async (req, res) => {
  try {
    // Mantenimientos vencidos
const vencidos = await db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa', 'v.kilometraje_actual',
        'c.nombre_conductor', 'c.numero_telefono',
        db.raw('DATE_PART(\'day\', NOW() - m.fecha_programada) as dias_vencido')
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id').andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      
      // FILTROS ESTRICTOS
      .where('m.fecha_programada', '<', db.raw('NOW()'))
      .whereRaw("LOWER(TRIM(m.estado)) NOT IN ('completado', 'cancelado', 'cancelada', 'en proceso', 'en_proceso')")
      
      .orderBy('m.fecha_programada', 'asc');

    // Próximos 7 días
    const urgentes = await db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'v.kilometraje_actual',
        'c.nombre_conductor',
        'c.numero_telefono',
        db.raw('DATE_PART(\'day\', m.fecha_programada - NOW()) as dias_restantes')
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .where(function() {
        this.where(function() {
          this.whereBetween('m.fecha_programada', [db.raw('NOW()'), db.raw("NOW() + INTERVAL '7 days'")])
            .andWhereRaw(`LOWER(TRIM(COALESCE(m.estado, ''))) IN (${ESTADOS_ALERTA_URGENTE.map((estado) => `'${estado}'`).join(', ')})`);
        }).orWhereRaw("LOWER(TRIM(COALESCE(m.estado, ''))) = 'urgente'");
      })
      .andWhereRaw("LOWER(TRIM(COALESCE(m.estado, ''))) NOT IN ('completado', 'cancelado', 'cancelada', 'en proceso', 'en_proceso')")
      .orderBy('m.fecha_programada', 'asc');

    // Próximos 30 días
    const proximos = await db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.kilometraje_actual',
        'c.nombre_conductor',
        db.raw('DATE_PART(\'day\', m.fecha_programada - NOW()) as dias_restantes')
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      // Regla de negocio: este panel solo muestra mantenimientos Programados.
      // Se evalua por fecha (no hora) para no excluir citas del dia actual ya aceptadas.
      .whereRaw("LOWER(TRIM(m.estado)) IN ('programado', 'programada')")
      .andWhereRaw("m.fecha_programada::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'")
      .orderBy('m.fecha_programada', 'asc')
      .limit(20);

    // Vehículos que requieren por kilometraje
    // Vehiculos con alerta preventiva por kilometraje
    const vehiculosKilometraje = await db('vehiculos as v')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.tipo_socio',
        'v.kilometraje_actual',
        'v.proximo_mantenimiento',
        'c.nombre_conductor',
        'c.numero_telefono'
      )
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
          .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id');

    const porKilometraje = vehiculosKilometraje
      .map((vehiculo) => {
        const kmActual = Math.max(Number(vehiculo.kilometraje_actual || 0), 0);
        const siguienteServicioKm = resolveSiguienteServicioKmVehiculo(vehiculo);
        const alerta = buildPreventivoAlertas({
          kilometrajeActual: kmActual,
          siguienteServicioKm,
          tipoSocio: vehiculo.tipo_socio
        });
        const dentroUmbral = Number(alerta.kilometros_restantes || 0) <= UMBRAL_ALERTA_KM;

        if (!alerta.vencido && !dentroUmbral) {
          return null;
        }

        const prioridadAlerta = alerta.vencido ? 3 : 2;
        const nivelAlerta = alerta.vencido
          ? 'vencido'
          : 'umbral_1000';

        return {
          ...vehiculo,
          proximo_servicio_km: siguienteServicioKm,
          umbral_alerta_km: UMBRAL_ALERTA_KM,
          km_exceso: alerta.vencido ? Math.abs(Math.min(alerta.kilometros_restantes, 0)) : 0,
          km_restantes: alerta.kilometros_restantes,
          nivel_alerta: nivelAlerta,
          prioridad_alerta: prioridadAlerta,
          alerta_preventiva: alerta.alerta_preventiva,
          alerta_capacidad_taller: alerta.alerta_capacidad_taller,
          vencido: alerta.vencido,
          mensaje_alerta: alerta.mensaje
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.prioridad_alerta !== a.prioridad_alerta) return b.prioridad_alerta - a.prioridad_alerta;
        return Number(a.km_restantes || 0) - Number(b.km_restantes || 0);
      });

    res.json({
      success: true,
      alertas: {
        vencidos: vencidos.map((v) => {
          const enriched = enrichMantenimientoWithMeta(v);
          const estadoUi = deriveEstadoUI(enriched);
          return {
            ...enriched,
            estado_ui: estadoUi,
            dias_vencido: parseInt(v.dias_vencido) || 0
          };
        }),
        urgentes: urgentes.map((u) => {
          const enriched = enrichMantenimientoWithMeta(u);
          const estadoUi = deriveEstadoUI(enriched);
          return {
            ...enriched,
            estado_ui: estadoUi,
            dias_restantes: parseInt(u.dias_restantes) || 0
          };
        }),
        proximos: proximos.map((p) => {
          const enriched = enrichMantenimientoWithMeta(p);
          const estadoUi = deriveEstadoUI(enriched);
          return {
            ...enriched,
            estado_ui: estadoUi,
            dias_restantes: parseInt(p.dias_restantes) || 0
          };
        }),
        por_kilometraje: porKilometraje.map(pk => ({
          ...pk,
          km_exceso: parseInt(pk.km_exceso) || 0,
          km_restantes: parseInt(pk.km_restantes) || 0
        }))
      }
    });

  } catch (error) {
    console.error('Error en getAlertas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener alertas',
      error: error.message
    });
  }
};

// ============================================
// HISTORIAL POR VEHÍCULO
// ============================================
exports.getHistorialVehiculo = async (req, res) => {
  try {
    const { id } = req.params;

    const historial = await db('mantenimientos as m')
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'c.nombre_conductor',
        'c.numero_telefono'
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('m.vehiculo_id', '=', 'a.vehiculo_id')
            .andOn(db.raw('m.fecha_realizada BETWEEN a.fecha_inicio AND COALESCE(a.fecha_fin, NOW())'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .where('m.vehiculo_id', id)
      .orderBy('m.fecha_realizada', 'desc');

    const historialNormalizado = historial.map((item) => enrichMantenimientoWithMeta(item));

    // Estadísticas del vehículo
    const estadisticas = await db('mantenimientos')
      .select(
        db.raw('COUNT(*) as total_mantenimientos'),
        db.raw('COALESCE(SUM(costo_total), 0) as costo_total'),
        db.raw('COALESCE(AVG(costo_total), 0) as costo_promedio'),
        db.raw('COUNT(*) FILTER (WHERE estado = \'Completado\') as completados')
      )
      .where('vehiculo_id', id)
      .first();

    res.json({
      success: true,
      historial: historialNormalizado,
      estadisticas: {
        total_mantenimientos: parseInt(estadisticas.total_mantenimientos) || 0,
        costo_total: parseFloat(estadisticas.costo_total) || 0,
        costo_promedio: parseFloat(estadisticas.costo_promedio) || 0,
        completados: parseInt(estadisticas.completados) || 0
      }
    });

  } catch (error) {
    console.error('Error en getHistorialVehiculo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
    });
  }
};

// ============================================
// OBTENER UN MANTENIMIENTO POR ID
// ============================================
exports.getMantenimientoById = async (req, res) => {
  try {
    const { id } = req.params;

   const mantenimiento = await db('mantenimientos as m')
  .select(
    'm.*',
    'v.numero_vehiculo',
    'v.marca',
    'v.modelo',
    'v.placa',
    'v.kilometraje_actual',
    'c.id as conductor_id',           // ANADIDO
    'c.nombre_conductor',
    'c.numero_telefono',
    'c.tipo_poliza',                   // ANADIDO
    'c.saldo_poliza_mecanica',
    'c.saldo_ahorro_mantenimiento'    // ANADIDO
  )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .where('m.id', id)
      .first();

    if (!mantenimiento) {
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    // Alinear el hito mostrado en modal "Info" con la logica de "Proximos KM".
    // Ejemplo: 129,005 km -> hito 130,000 km.
    const kmActual = Math.max(Number(mantenimiento.kilometraje_actual || 0), 0);
    if (kmActual > 0) {
      const modulo = kmActual % 10000;
      const kmParaSiguiente = modulo === 0 ? 0 : 10000 - modulo;
      const hitoObjetivo = modulo === 0 ? kmActual : kmActual + kmParaSiguiente;
      mantenimiento.hito_objetivo_km = hitoObjetivo;
    }

    const mantenimientoFormateado = formatMantenimientoOperativo(mantenimiento);
    res.json({
      success: true,
      mantenimiento: {
        ...mantenimientoFormateado,
        estado_ui: deriveEstadoUI(mantenimientoFormateado)
      }
    });

  } catch (error) {
    console.error('Error en getMantenimientoById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// DISPONIBILIDAD DE AGENDA (ADMIN)
// ============================================
exports.getDisponibilidadAgenda = async (req, res) => {
  try {
    const fecha = String(req.query?.fecha || '').trim();
    const excludeIdRaw = req.query?.exclude_id;
    const excludeId = /^\d+$/.test(String(excludeIdRaw || '')) ? Number(excludeIdRaw) : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar una fecha valida con formato YYYY-MM-DD'
      });
    }

    const fechaCheck = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(fechaCheck.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Fecha invalida'
      });
    }

    const { start, end } = getDayBounds(fecha);
    const rows = await db('mantenimientos')
      .select('id', 'estado', 'fecha_programada')
      .where('fecha_programada', '>=', start)
      .andWhere('fecha_programada', '<', end)
      .modify((queryBuilder) => {
        if (excludeId != null) {
          queryBuilder.whereNot('id', excludeId);
        }
      });

    const citasActivas = rows.filter((item) => isEstadoActivoAgenda(item.estado));
    const horasOcupadas = citasActivas
      .map((item) => {
        const date = new Date(item.fecha_programada);
        if (Number.isNaN(date.getTime())) return null;
        return {
          id: item.id,
          estado: item.estado,
          hora: formatHHmm(date),
          timestamp: date.getTime()
        };
      })
      .filter(Boolean);

    const slots = buildHalfHourSlots({ startHour: 8, endHour: 15, includeEndHalf: false }).map((hora) => {
      const slotDate = new Date(`${fecha}T${hora}:00`);
      const slotTimestamp = Number.isNaN(slotDate.getTime()) ? null : slotDate.getTime();
      const conflicto = slotTimestamp == null
        ? null
        : horasOcupadas.find((ocupada) => Math.abs(ocupada.timestamp - slotTimestamp) < SLOT_MS);

      return {
        hora,
        disponible: !conflicto,
        cita_id: conflicto?.id || null,
        estado: conflicto?.estado || null
      };
    });

    return res.json({
      success: true,
      fecha,
      diferencia_minima_minutos: SLOT_MINUTES,
      slots
    });
  } catch (error) {
    console.error('Error en getDisponibilidadAgenda:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener disponibilidad de agenda',
      error: error.message
    });
  }
};

// ============================================
// CREAR/PROGRAMAR NUEVO MANTENIMIENTO
// ============================================
exports.createMantenimiento = async (req, res) => {
  try {
    const {
      vehiculo_id,
      tipo_servicio,
      fecha_programada,
      hora_programada,
      kilometraje_servicio,
      proximo_servicio_km,
      taller,
      taller_otro_detalle,
      observaciones,
      servicio_especial,
      monto_estimado,
      tipo_solicitud,
      causa_fuera_programacion,
      detalle_fuera_programacion
    } = req.body;
    const forzarHorarioOcupado = toBoolean(req.body?.forzar_horario_ocupado);

    // Validaciones básicas
    if (!vehiculo_id || !tipo_servicio || !fecha_programada || !hora_programada) {
      return res.status(400).json({
        success: false,
        message: 'vehiculo_id, tipo_servicio, fecha_programada y hora_programada son obligatorios'
      });
    }

    // Validar hora (HH:mm)
    const horaValida = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hora_programada);
    if (!horaValida) {
      return res.status(400).json({
        success: false,
        message: 'hora_programada debe tener el formato HH:mm'
      });
    }

    // Construir fecha y hora completa
      const fechaHoraProgramada = new Date(`${fecha_programada}T${hora_programada}:00`);    
      if (isNaN(fechaHoraProgramada.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Fecha u hora inválida'
      });
    }
    const ahora = new Date();
    if (fechaHoraProgramada < ahora) {
      return res.status(400).json({
        success: false,
        message: 'La fecha y hora programadas no pueden estar en el pasado'
      });
    }

    // Validar horario laboral (08:00 a 15:00) y solo lunes a viernes
const fechaCheckDia = new Date(`${fecha_programada}T12:00:00`);
    const diaSemana = fechaCheckDia.getDay();

    // 2. Bloquear SOLO Domingo (0). Permitir Lunes (1) a Sábado (6)
    if (diaSemana === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se pueden agendar mantenimientos los domingos. Horario disponible: Lunes a Sábado.'
      });
    }

    const horaInicio = fechaHoraProgramada.getHours();
    const horaFinSlot = new Date(fechaHoraProgramada.getTime() + 30 * 60 * 1000);
    const cierreDia = new Date(fechaHoraProgramada);
    cierreDia.setHours(15, 30, 0, 0);

    if (horaInicio < 8 || horaFinSlot > cierreDia) {
      return res.status(400).json({
        success: false,
        message: 'El horario de servicio es de 08:00 a 15:00 con bloques de 30 minutos'
      });
    }

    const traslape = await findConflictingMantenimiento({
      dbClient: db,
      fechaHoraProgramada
    });

    if (traslape && !forzarHorarioOcupado) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cita de mantenimiento en ese bloque de 30 minutos',
        puede_forzar: true,
        diferencia_minima_minutos: SLOT_MINUTES,
        conflicto: {
          cita_id: traslape.id,
          folio_servicio: traslape.folio_servicio || null,
          estado: traslape.estado || null
        }
      });
    }

    // Verificar que el vehículo existe
    const vehiculo = await db('vehiculos').where('id', vehiculo_id).first();
    if (!vehiculo) {
      return res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado'
      });
    }

    const servicioEspecial = sanitizeShortText(servicio_especial, 300);
    const adjuntosAdmin = await uploadAdjuntosAdminFromRequest(req);
    const solicitudMeta = buildSolicitudMeta({
      tipo_solicitud,
      causa_fuera_programacion,
      detalle_fuera_programacion: detalle_fuera_programacion || servicioEspecial,
      servicio_especial: servicioEspecial,
      adjuntos_admin: adjuntosAdmin,
      sobrecupo_autorizado: Boolean(traslape && forzarHorarioOcupado)
    });

    if (
      solicitudMeta.tipo_solicitud === 'fuera_programacion' &&
      !solicitudMeta.causa_fuera_programacion
    ) {
      return res.status(400).json({
        success: false,
        message: 'Debes indicar la causa cuando la solicitud es fuera de programacion',
        validos: ['falla_mecanica', 'negligencia_conductor', 'siniestro', 'otro']
      });
    }

    const tallerResolved = resolveTallerValue({
      taller,
      taller_otro_detalle
    });

    if (!tallerResolved.success) {
      return res.status(400).json({
        success: false,
        message: tallerResolved.message
      });
    }

    const notaSobrecupo = traslape && forzarHorarioOcupado
      ? `Sobrecupo autorizado por administrador. Conflicto detectado con folio #${traslape.folio_servicio || traslape.id}.`
      : null;

    const observacionesBase = [
      String(observaciones || '').trim(),
      servicioEspecial ? `Servicio especial solicitado: ${servicioEspecial}` : null,
      notaSobrecupo
    ]
      .filter(Boolean)
      .join('\n\n');
    const observacionesFinales = appendMetaToObservaciones(observacionesBase, solicitudMeta);

    const kilometrajeServicioFinal = Number(kilometraje_servicio || vehiculo.kilometraje_actual || 0);
    const tipoServicioFinal = String(tipo_servicio || '').trim();
    const duplicateActivo = await findActiveDuplicateByVehiculoServicio(db, {
      vehiculoId: vehiculo_id,
      tipoServicio: tipoServicioFinal
    });
    if (duplicateActivo) {
      return res.status(409).json({
        success: false,
        message: `Ya existe un mantenimiento activo del mismo servicio para este vehiculo (${duplicateActivo.folio_servicio ? `folio #${String(duplicateActivo.folio_servicio).padStart(4, '0')}` : `id ${duplicateActivo.id}`})`,
        duplicado: {
          id: duplicateActivo.id,
          folio_servicio: duplicateActivo.folio_servicio || null,
          estado: duplicateActivo.estado || null,
          fecha_programada: duplicateActivo.fecha_programada || null
        }
      });
    }

    // Generar folio
    const ultimoFolio = await db('mantenimientos')
      .max('folio_servicio as max_folio')
      .first();
    
    const nuevoFolio = (ultimoFolio.max_folio || 0) + 1;

    // Crear mantenimiento
    const [mantenimiento] = await db('mantenimientos')
      .insert({
        folio_servicio: nuevoFolio,
        vehiculo_id,
        tipo_servicio,
        fecha_programada: fechaHoraProgramada,
        kilometraje_servicio: kilometrajeServicioFinal,
        proximo_servicio_km: proximo_servicio_km || (kilometrajeServicioFinal) + getIntervaloMantenimientoKm(vehiculo.tipo_socio),
        estado: ESTADOS_MANTENIMIENTO_CANONICOS.PENDIENTE,
        status: 'Todo',
        taller: tallerResolved.value,
        observaciones: observacionesFinales || null,
        costo_mano_obra: 0,
        costo_refacciones: 0,
        costo_total: monto_estimado || 0,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Mantenimiento programado exitosamente',
      mantenimiento: formatMantenimientoOperativo(mantenimiento)
    });

  } catch (error) {
    console.error('Error en createMantenimiento:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error al programar mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// TOP VEHÍCULOS POR GASTO (MAYOR / MENOR)
// ============================================
exports.getTopVehiculosGasto = async (req, res) => {
  try {
    const orden = String(req.query?.orden || 'mayor').toLowerCase();
    const limitRaw = req.query?.limit;
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(parseInt(limitRaw, 10), 1) : null;

    let query;
    if (orden === 'menor') {
      query = db('vehiculos as v')
        .select('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa')
        .leftJoin('mantenimientos as m', function() {
          this.on('v.id', '=', 'm.vehiculo_id')
            .andOn('m.estado', '=', db.raw('?', ['Completado']));
        })
        .groupBy('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa')
        .select(
          db.raw('COALESCE(SUM(m.costo_total), 0) as total_gastado'),
          db.raw('COUNT(m.id) as total_mantenimientos')
        )
        .orderBy('total_gastado', 'asc');
    } else {
      query = db('mantenimientos as m')
        .select('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa')
        .sum('m.costo_total as total_gastado')
        .count('m.id as total_mantenimientos')
        .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
        .where('m.estado', 'Completado')
        .groupBy('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa')
        .orderBy('total_gastado', 'desc');
    }

    if (limit) {
      query = query.limit(limit);
    }

    const vehiculos = await query;

    res.json({
      success: true,
      orden: orden === 'menor' ? 'menor' : 'mayor',
      vehiculos
    });
  } catch (error) {
    console.error('Error en getTopVehiculosGasto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener top de vehículos por gasto',
      error: error.message
    });
  }
};

// ============================================
// ACTUALIZAR MANTENIMIENTO
// ============================================
exports.updateMantenimiento = async (req, res) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const forzarHorarioOcupado = toBoolean(updates.forzar_horario_ocupado);
    delete updates.forzar_horario_ocupado;
    const mantenimiento = await trx('mantenimientos').where('id', id).first();
    if (!mantenimiento) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }
    const userRole = getUserRole(req);
    const intentaEditarProgramacion = Object.keys(updates).some((field) =>
      CAMPOS_EDICION_PROGRAMACION.has(field)
    );
    if (intentaEditarProgramacion && !ROLES_EDICION_PROGRAMACION.has(userRole)) {
      await trx.rollback();
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar la programacion del mantenimiento',
        user_role: userRole
      });
    }
    const observacionesOriginal = extractMetaFromObservaciones(mantenimiento.observaciones);
    const metaObservaciones = observacionesOriginal.meta;
    let observacionesLimpias = updates.observaciones !== undefined
      ? String(updates.observaciones || '').trim()
      : (observacionesOriginal.observaciones_limpias || '');
    let notaSobrecupo = null;
    let actualizarMetaSobrecupo = false;

    if (updates.fecha_programada !== undefined || updates.hora_programada !== undefined) {
      const fechaActual = new Date(mantenimiento.fecha_programada);
      const datePartPattern = /^\d{4}-\d{2}-\d{2}$/;
      const timePartPattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      const fechaBase = (() => {
        if (updates.fecha_programada === undefined || updates.fecha_programada === null || updates.fecha_programada === '') {
          return formatDatePart(fechaActual);
        }
        const rawDate = String(updates.fecha_programada).trim();
        const candidate = rawDate.includes('T') ? rawDate.slice(0, 10) : rawDate;
        return datePartPattern.test(candidate) ? candidate : null;
      })();
      const horaBase = (() => {
        if (updates.hora_programada === undefined || updates.hora_programada === null || updates.hora_programada === '') {
          return formatTimePart(fechaActual);
        }
        const rawTime = String(updates.hora_programada).trim();
        return timePartPattern.test(rawTime) ? rawTime : null;
      })();
      if (!fechaBase || !horaBase) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: 'fecha_programada o hora_programada invalida'
        });
      }
      const fechaHoraProgramada = new Date(`${fechaBase}T${horaBase}:00`);
      if (Number.isNaN(fechaHoraProgramada.getTime())) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: 'Fecha u hora invalida'
        });
      }
      const ahora = new Date();
      if (fechaHoraProgramada < ahora) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: 'La fecha y hora programadas no pueden estar en el pasado'
        });
      }
      const diaSemana = new Date(`${fechaBase}T12:00:00`).getDay();
      if (diaSemana === 0) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: 'No se pueden agendar mantenimientos los domingos'
        });
      }
      const horaInicio = fechaHoraProgramada.getHours();
      const horaFinSlot = new Date(fechaHoraProgramada.getTime() + 30 * 60 * 1000);
      const cierreDia = new Date(fechaHoraProgramada);
      cierreDia.setHours(15, 30, 0, 0);
      if (horaInicio < 8 || horaFinSlot > cierreDia) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: 'El horario de servicio es de 08:00 a 15:00 con bloques de 30 minutos'
        });
      }
      const traslape = await findConflictingMantenimiento({
        dbClient: trx,
        fechaHoraProgramada,
        excludeId: id
      });
      if (traslape && !forzarHorarioOcupado) {
        await trx.rollback();
        return res.status(409).json({
          success: false,
          message: 'Ya existe una cita de mantenimiento en ese bloque de 30 minutos',
          puede_forzar: true,
          diferencia_minima_minutos: SLOT_MINUTES,
          conflicto: {
            cita_id: traslape.id,
            folio_servicio: traslape.folio_servicio || null,
            estado: traslape.estado || null
          }
        });
      }
      if (traslape && forzarHorarioOcupado) {
        notaSobrecupo = `Sobrecupo autorizado por administrador al reprogramar. Conflicto detectado con folio #${traslape.folio_servicio || traslape.id}.`;
        metaObservaciones.sobrecupo_autorizado = true;
        actualizarMetaSobrecupo = true;
      } else {
        metaObservaciones.sobrecupo_autorizado = false;
        actualizarMetaSobrecupo = true;
      }
      updates.fecha_programada = fechaHoraProgramada;
      delete updates.hora_programada;

      // Al reprogramar, normalizamos el flujo a Programado salvo estados terminales o en proceso.
      // Esto evita que un estado legado de alerta (ej. "Urgente") permanezca pegado tras mover fecha.
      if (updates.estado === undefined) {
        const estadoActual = normalizeEstadoMantenimiento(mantenimiento.estado);
        const debeConservarEstado =
          estadoActual === ESTADOS_MANTENIMIENTO_CANONICOS.EN_PROCESO ||
          estadoActual === ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO ||
          estadoActual === ESTADOS_MANTENIMIENTO_CANONICOS.CANCELADO;

        if (!debeConservarEstado) {
          updates.estado = ESTADOS_MANTENIMIENTO_CANONICOS.PROGRAMADO;
        }
      }
    }
    if (updates.taller !== undefined || updates.taller_otro_detalle !== undefined) {
      const tallerResolved = resolveTallerValue({
        taller: updates.taller,
        taller_otro_detalle: updates.taller_otro_detalle,
        fallbackTaller: mantenimiento.taller
      });

      if (!tallerResolved.success) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: tallerResolved.message
        });
      }

      updates.taller = tallerResolved.value;
      delete updates.taller_otro_detalle;
    }
    if (notaSobrecupo) {
      observacionesLimpias = [observacionesLimpias, notaSobrecupo].filter(Boolean).join('\n\n');
    }
    if (updates.observaciones !== undefined || notaSobrecupo || actualizarMetaSobrecupo) {
      updates.observaciones = appendMetaToObservaciones(observacionesLimpias, metaObservaciones);
    }
    if (mantenimiento.estado === ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO && updates.estado) {
      const siguienteEstado = normalizeEstadoMantenimiento(updates.estado);
      if (siguienteEstado && siguienteEstado !== ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: 'No se puede cambiar el estado de un mantenimiento completado'
        });
      }
    }
    if (updates.estado !== undefined) {
      const estadoNormalizado = normalizeEstadoMantenimiento(updates.estado);
      if (!estadoNormalizado) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          message: 'Estado de mantenimiento invalido',
          validos: Object.values(ESTADOS_MANTENIMIENTO_CANONICOS)
        });
      }
      updates.estado = estadoNormalizado;
    }
    if (
      updates.estado === ESTADOS_MANTENIMIENTO_CANONICOS.EN_PROCESO &&
      mantenimiento.estado !== ESTADOS_MANTENIMIENTO_CANONICOS.EN_PROCESO
    ) {
      const vehiculo = await trx('vehiculos')
        .where('id', mantenimiento.vehiculo_id)
        .first();
      updates.estado_vehiculo_previo = vehiculo.estado;
      await trx('vehiculos')
        .where('id', mantenimiento.vehiculo_id)
        .update({
          estado: 'Mantenimiento',
          updated_at: db.fn.now()
        });
    }
    updates.updated_at = db.fn.now();
    const [mantenimientoActualizado] = await trx('mantenimientos')
      .where('id', id)
      .update(updates)
      .returning('*');
    await trx.commit();
    res.json({
      success: true,
      message: 'Mantenimiento actualizado exitosamente',
      mantenimiento: formatMantenimientoOperativo(mantenimientoActualizado)
    });
  } catch (error) {
    await trx.rollback();
    console.error('Error en updateMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar mantenimiento',
      error: error.message
    });
  }
};
// ============================================
// COMPLETAR MANTENIMIENTO
// ============================================
exports.completarMantenimiento = async (req, res) => {
  const trx = await db.transaction();

  try {
    const { id } = req.params;
    const {
      fecha_realizada,
      kilometraje_servicio,
      proximo_servicio_km,
      servicios_realizados,
      refacciones,
      costo_mano_obra,
      costo_refacciones,
      costo_total,
      taller,
      taller_otro_detalle,
      mecanico,
      observaciones_final
    } = req.body;
    const kilometrajeServicioInput = kilometraje_servicio || req.body?.kilometraje_real;

    console.log('DEBUG completarMantenimiento - Datos recibidos:', {
      id,
      costo_total
    });

    // Verificar que existe
    const mantenimiento = await trx('mantenimientos').where('id', id).first();
    if (!mantenimiento) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    // Guardar costo del servicio. El impacto financiero se aplica posteriormente en distribucion.
    const costoFinal = Number(
      costo_total !== undefined && costo_total !== null && String(costo_total).trim() !== ''
        ? costo_total
        : ((parseFloat(costo_mano_obra) || 0) + (parseFloat(costo_refacciones) || 0))
    ) || 0;

    const observacionesPrevias = extractMetaFromObservaciones(mantenimiento.observaciones);
    const metaSolicitud = observacionesPrevias.meta;
    const adjuntosAdmin = await uploadAdjuntosAdminFromRequest(req, {
      existing: metaSolicitud.adjuntos_admin || []
    });
    const metaSolicitudActualizada = buildSolicitudMeta({
      ...metaSolicitud,
      adjuntos_admin: adjuntosAdmin
    });

    const tallerResolved = resolveTallerValue({
      taller,
      taller_otro_detalle,
      fallbackTaller: mantenimiento.taller
    });

    if (!tallerResolved.success) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: tallerResolved.message
      });
    }

    // Actualizar mantenimiento
    const baseObservaciones = observaciones_final !== undefined
      ? String(observaciones_final || '').trim()
      : (observacionesPrevias.observaciones_limpias || '');

    const [mantenimientoActualizado] = await trx('mantenimientos')
      .where('id', id)
      .update({
        fecha_realizada: fecha_realizada || db.fn.now(),
        kilometraje_servicio: kilometrajeServicioInput || mantenimiento.kilometraje_servicio,
        proximo_servicio_km: proximo_servicio_km || mantenimiento.proximo_servicio_km,
        servicios_realizados,
        refacciones,
        costo_mano_obra: costo_mano_obra || 0,
        costo_refacciones: costo_refacciones || 0,
        costo_total: costoFinal,
        taller: tallerResolved.value,
        mecanico,
        observaciones: appendMetaToObservaciones(baseObservaciones, metaSolicitudActualizada),
        estado: ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO,
        status: ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO,
        updated_at: db.fn.now()
      })
      .returning('*');

    const duplicadosActivos = await findActiveSiblingsByKmServicio(trx, {
      mantenimientoId: id,
      vehiculoId: mantenimiento.vehiculo_id,
      tipoServicio: mantenimientoActualizado.tipo_servicio || mantenimiento.tipo_servicio,
      kilometrajeServicio: kilometrajeServicioInput || mantenimiento.kilometraje_servicio
    });

    if (duplicadosActivos.length > 0) {
      for (const duplicado of duplicadosActivos) {
        const observacionesPreviasDuplicado = extractMetaFromObservaciones(duplicado.observaciones);
        const notaDuplicado = `Cancelado automaticamente por duplicado del servicio ya completado en folio #${String(
          mantenimientoActualizado.folio_servicio || mantenimientoActualizado.id
        ).padStart(4, '0')}.`;
        const observacionesConNota = [
          observacionesPreviasDuplicado.observaciones_limpias || '',
          notaDuplicado
        ]
          .filter(Boolean)
          .join('\n\n');

        // eslint-disable-next-line no-await-in-loop
        await trx('mantenimientos')
          .where('id', duplicado.id)
          .update({
            estado: ESTADOS_MANTENIMIENTO_CANONICOS.CANCELADO,
            observaciones: appendMetaToObservaciones(
              observacionesConNota,
              observacionesPreviasDuplicado.meta
            ),
            updated_at: db.fn.now()
          });
      }
    }

    const vehiculoActual = await trx('vehiculos')
      .where('id', mantenimiento.vehiculo_id)
      .first();

    const kmServicioFinal = Number(kilometrajeServicioInput || mantenimiento.kilometraje_servicio || 0);
    const intervaloKm = getIntervaloMantenimientoKm(vehiculoActual?.tipo_socio);
    const hitoServicio = kmServicioFinal > 0
      ? Math.ceil(kmServicioFinal / intervaloKm) * intervaloKm
      : 0;
    const proximoServicioKmFinal = Number(
      proximo_servicio_km || mantenimiento.proximo_servicio_km || 0
    ) || (hitoServicio > 0 ? hitoServicio + intervaloKm : 0);

    // Determinar el estado correcto del vehiculo
    let nuevoEstadoVehiculo = 'Disponible';

    // Si guardamos el estado previo, restaurarlo
    if (mantenimientoActualizado.estado_vehiculo_previo) {
      nuevoEstadoVehiculo = mantenimientoActualizado.estado_vehiculo_previo;
    } else {
      // Si no hay estado previo guardado, verificar si tiene asignacion activa
      const tieneAsignacion = await trx('asignaciones')
        .where('vehiculo_id', mantenimiento.vehiculo_id)
        .where('activa', true)
        .first();

      if (tieneAsignacion) {
        // Verificar si tiene renta activa
        const tieneRenta = await trx('rentas')
          .where('vehiculo_id', mantenimiento.vehiculo_id)
          .where('estado_renta', 'activa')
          .first();

        nuevoEstadoVehiculo = tieneRenta ? 'Rentado' : 'Asignado';
      }
    }

    // Actualizar vehiculo: kilometraje + estado correcto
    await trx('vehiculos')
      .where('id', mantenimiento.vehiculo_id)
      .update({
        kilometraje_actual: kilometrajeServicioInput || mantenimiento.kilometraje_servicio,
        proximo_mantenimiento: proximoServicioKmFinal || vehiculoActual?.proximo_mantenimiento || null,
        estado: nuevoEstadoVehiculo,
        updated_at: db.fn.now()
      });

    await trx.commit();

    res.json({
      success: true,
      message: `Mantenimiento completado. Vehiculo ahora en estado: ${nuevoEstadoVehiculo}`,
      mantenimiento: formatMantenimientoOperativo(mantenimientoActualizado),
      estado_vehiculo: nuevoEstadoVehiculo
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en completarMantenimiento:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error al completar mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// ELIMINAR MANTENIMIENTO
// ============================================
exports.deleteMantenimiento = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const existe = await db('mantenimientos').where('id', id).first();
    if (!existe) {
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    const vehiculo = existe.vehiculo_id
      ? await db('vehiculos')
          .where('id', existe.vehiculo_id)
          .select('numero_vehiculo', 'placa')
          .first()
      : null;

    const asignacionActiva = existe.vehiculo_id
      ? await db('asignaciones')
          .where('vehiculo_id', existe.vehiculo_id)
          .where('activa', true)
          .select('conductor_id')
          .first()
      : null;

    const conductor = asignacionActiva?.conductor_id
      ? await db('conductores')
          .where('id', asignacionActiva.conductor_id)
          .select('nombre_conductor', 'numero_telefono')
          .first()
      : null;

    const deletedSnapshot = {
      id: existe.id,
      folio_servicio: existe.folio_servicio || `#${String(existe.id).padStart(4, '0')}`,
      tipo_servicio: existe.tipo_servicio || 'No especificado',
      estado: existe.estado || 'No especificado',
      fecha_programada: existe.fecha_programada || null,
      hora_programada: existe.hora_programada || null,
      numero_vehiculo: vehiculo?.numero_vehiculo || null,
      placa: vehiculo?.placa || null,
      nombre_conductor: conductor?.nombre_conductor || null,
      numero_telefono: conductor?.numero_telefono || null
    };

    // Eliminar
    await db('mantenimientos').where('id', id).delete();

    res.json({
      success: true,
      message: 'Mantenimiento eliminado exitosamente',
      data: deletedSnapshot
    });

  } catch (error) {
    console.error('Error en deleteMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// OPCIONES PARA SELECTS (VEHÍCULOS, TIPOS, ETC)
// ============================================
exports.getOpciones = async (req, res) => {
  try {
    const solicitudCatalogo = getSolicitudCatalogo();

    // Vehículos disponibles con conductor asignado
    const vehiculos = await db('vehiculos as v')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'v.kilometraje_actual',
        'c.nombre_conductor',
        'c.id as conductor_id'
      )
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .whereIn('v.estado', ['Disponible', 'Asignado', 'Rentado'])
      .orderBy('v.numero_vehiculo', 'asc');

    // Tipos de servicio (valores únicos de la BD)
    const tiposServicio = [
      'Cambio de aceite',
      'Alineación y balanceo',
      'Revisión general',
      'Cambio de llantas',
      'Frenos',
      'Suspensión',
      'Verificación vehicular',
      'Limpieza profunda',
      'Reparación mecánica',
      'Reparación eléctrica',
      'Hojalatería y pintura',
      'Transmisión',
      'Sistema de enfriamiento',
      'Batería y sistema eléctrico',
      'Otros'
    ];

    // Talleres (valores únicos de la BD)
    const talleresResult = await db('mantenimientos')
      .distinct('taller')
      .whereNotNull('taller')
      .orderBy('taller', 'asc');

    const talleresHistoricos = talleresResult
      .map((t) => sanitizeShortText(t.taller, 140))
      .filter(Boolean);

    const talleres = Array.from(
      new Set([
        ...TALLER_CATEGORIAS_OPCIONES,
        ...talleresHistoricos
      ])
    );

    res.json({
      success: true,
      opciones: {
        vehiculos,
        tipos_servicio: tiposServicio,
        servicios_especiales: SERVICIOS_ESPECIALES_OPCIONES,
        tipos_solicitud: solicitudCatalogo.tipos_solicitud,
        causas_fuera_programacion: solicitudCatalogo.causas_fuera_programacion,
        categorias_taller: TALLER_CATEGORIAS_OPCIONES,
        talleres,
        estados: Object.values(ESTADOS_MANTENIMIENTO_CANONICOS)
      }
    });

  } catch (error) {
    console.error('Error en getOpciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener opciones',
      error: error.message
    });
  }
};

// ============================================
// SERVICIOS PREVENTIVOS POR MODELO
// ============================================
exports.getServiciosPreventivos = async (_req, res) => {
  try {
    const toServicioDto = (servicio) => ({
      kilometraje: servicio.kilometraje,
      servicio: servicio.servicio,
      servicio_codigo: servicio.servicio_codigo || null,
      servicio_nivel: servicio.servicio_nivel || null,
      incluye_rotacion: Boolean(servicio.incluye_rotacion),
      costo_estimado: servicio.costo_estimado || null,
      mano_obra_horas: servicio.mano_obra_horas || null,
      esquema: servicio.esquema || null
    });

    const serviciosGenericos = (schedules.generico_10000km || schedules.generic || []).map(toServicioDto);
    const serviciosBydDolphinMini = (schedules.byd_dolphin_mini || []).map(toServicioDto);

    const modelos = {
      generico_10000km: serviciosGenericos,
      byd_dolphin_mini: serviciosBydDolphinMini
    };

    res.json({
      success: true,
      modelos,
      tabla_generica: serviciosGenericos,
      tabla_byd_dolphin_mini: serviciosBydDolphinMini
    });
  } catch (error) {
    console.error('Error en getServiciosPreventivos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener servicios preventivos',
      error: error.message
    });
  }
};

// ========================================
// REPORTES Y ANÁLISIS
// ========================================

exports.getReporteCostos = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, vehiculo_id, tipo } = req.query;
    
    let query = db('mantenimientos')
      .select(
        db.raw(`
          COUNT(*) as total_mantenimientos,
          COALESCE(SUM(costo_total), 0) as total_estimado,
          COALESCE(SUM(CASE WHEN estado = 'Completado' THEN costo_total ELSE 0 END), 0) as total_real,
          COALESCE(AVG(costo_total), 0) as promedio_estimado,
          COALESCE(AVG(CASE WHEN estado = 'Completado' THEN costo_total END), 0) as promedio_real,
          COALESCE(MAX(CASE WHEN estado = 'Completado' THEN costo_total END), 0) as costo_maximo,
          COALESCE(MIN(CASE WHEN estado = 'Completado' AND costo_total > 0 THEN costo_total END), 0) as costo_minimo
        `)
      );

    if (fecha_inicio && fecha_fin) {
      query = query.whereBetween('fecha_programada', [fecha_inicio, fecha_fin]);
    }

    if (vehiculo_id) {
      query = query.where('vehiculo_id', vehiculo_id);
    }

    if (tipo) {
      query = query.where('tipo_servicio', tipo);
    }

    const resultado = await query.first();

    // Obtener desglose por tipo
    let queryDesglose = db('mantenimientos')
      .select('tipo_servicio')
      .count('* as cantidad')
      .sum('costo_total as total')
      .where('estado', 'Completado')
      .groupBy('tipo_servicio')
      .orderBy('total', 'desc');

    if (fecha_inicio && fecha_fin) {
      queryDesglose = queryDesglose.whereBetween('fecha_programada', [fecha_inicio, fecha_fin]);
    }

    const desgloseTipo = await queryDesglose;

    res.json({
      resumen: {
        total_mantenimientos: parseInt(resultado.total_mantenimientos) || 0,
        total_estimado: parseFloat(resultado.total_estimado) || 0,
        total_real: parseFloat(resultado.total_real) || 0,
        promedio_estimado: parseFloat(resultado.promedio_estimado) || 0,
        promedio_real: parseFloat(resultado.promedio_real) || 0,
        costo_maximo: parseFloat(resultado.costo_maximo) || 0,
        costo_minimo: parseFloat(resultado.costo_minimo) || 0
      },
      desglose_por_tipo: desgloseTipo.map(d => ({
        tipo_mantenimiento: d.tipo_servicio,
        cantidad: parseInt(d.cantidad),
        total: parseFloat(d.total) || 0
      }))
    });

  } catch (error) {
    console.error('Error en getReporteCostos:', error);
    res.status(500).json({ 
      message: 'Error al generar reporte de costos',
      error: error.message 
    });
  }
};

exports.getReporteFrecuencia = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let query = db('mantenimientos')
      .select(
        db.raw(`TO_CHAR(fecha_programada, 'YYYY-MM') as mes`),
        db.raw(`COUNT(*) as cantidad`),
        db.raw(`COALESCE(SUM(CASE WHEN estado = 'Completado' THEN costo_total ELSE 0 END), 0) as costo_total`),
        db.raw(`COUNT(CASE WHEN estado = 'Completado' THEN 1 END) as completados`),
        db.raw(`COUNT(CASE WHEN estado = 'Programado' THEN 1 END) as pendientes`),
        db.raw(`COUNT(CASE WHEN estado = 'En proceso' THEN 1 END) as en_proceso`)
      )
      .groupBy(db.raw(`TO_CHAR(fecha_programada, 'YYYY-MM')`))
      .orderBy(db.raw(`TO_CHAR(fecha_programada, 'YYYY-MM')`), 'desc')
      .limit(12);

    if (fecha_inicio && fecha_fin) {
      query = query.whereBetween('fecha_programada', [fecha_inicio, fecha_fin]);
    }

    const resultado = await query;

    res.json(resultado);

  } catch (error) {
    console.error('Error en getReporteFrecuencia:', error);
    res.status(500).json({ 
      message: 'Error al generar reporte de frecuencia',
      error: error.message 
    });
  }
};

exports.getVehiculosMasCostosos = async (req, res) => {
  try {
    const { limite, fecha_inicio, fecha_fin, orden = 'desc', completo = 'false' } = req.query;
    const ordenNormalizado = String(orden).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const incluirCompleto = String(completo).toLowerCase() === 'true';
    const limiteNumerico = parseInt(limite, 10);
    const limiteFinal = Number.isFinite(limiteNumerico) && limiteNumerico > 0 ? limiteNumerico : 10;
    const tieneFiltroFecha = Boolean(fecha_inicio && fecha_fin);
    const fechaFiltroSql = tieneFiltroFecha ? ' AND m.fecha_programada BETWEEN ? AND ?' : '';
    const fechaBindings = tieneFiltroFecha ? [fecha_inicio, fecha_fin] : [];

    let query = db('vehiculos as v')
      .leftJoin('mantenimientos as m', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.a\u00f1o_del_vehiculo as anio',
        'v.placa',
        'c.nombre_conductor', // AGREGADO: nombre del conductor
        db.raw(
          `COALESCE(COUNT(CASE WHEN m.estado = 'Completado'${fechaFiltroSql} THEN 1 END), 0) as total_mantenimientos`,
          fechaBindings
        ),
        db.raw(
          `COALESCE(SUM(CASE WHEN m.estado = 'Completado'${fechaFiltroSql} THEN m.costo_total ELSE 0 END), 0) as costo_total`,
          fechaBindings
        ),
        db.raw(
          `COALESCE(AVG(CASE WHEN m.estado = 'Completado'${fechaFiltroSql} THEN m.costo_total END), 0) as costo_promedio`,
          fechaBindings
        ),
        db.raw(
          `MAX(CASE WHEN m.estado = 'Completado'${fechaFiltroSql} THEN m.fecha_realizada END) as ultimo_mantenimiento`,
          fechaBindings
        )
      )
      .groupBy('v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.a\u00f1o_del_vehiculo', 'v.placa', 'c.nombre_conductor')
      .orderBy('costo_total', ordenNormalizado);

    if (!incluirCompleto) {
      query = query.limit(limiteFinal);
    }

    const resultado = await query;

    res.json(resultado.map(v => ({
      ...v,
      total_mantenimientos: parseInt(v.total_mantenimientos),
      costo_total: parseFloat(v.costo_total),
      costo_promedio: parseFloat(v.costo_promedio),
      nombre_conductor: v.nombre_conductor || 'Sin asignar' // Manejo de conductores no asignados
    })));

  } catch (error) {
    console.error('Error en getVehiculosMasCostosos:', error);
    res.status(500).json({ 
      message: 'Error al obtener vehículos más costosos',
      error: error.message 
    });
  }
};

exports.getConductoresPorGasto = async (req, res) => {
  try {
    const { limite, fecha_inicio, fecha_fin, orden = 'desc', completo = 'false' } = req.query;
    const ordenNormalizado = String(orden).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const incluirCompleto = String(completo).toLowerCase() === 'true';
    const limiteNumerico = parseInt(limite, 10);
    const limiteFinal = Number.isFinite(limiteNumerico) && limiteNumerico > 0 ? limiteNumerico : 10;
    const tieneFiltroFecha = Boolean(fecha_inicio && fecha_fin);
    const fechaFiltroSql = tieneFiltroFecha ? ' AND m.fecha_programada BETWEEN ? AND ?' : '';
    const fechaBindings = tieneFiltroFecha ? [fecha_inicio, fecha_fin] : [];

    let query = db('conductores as c')
      .leftJoin('asignaciones as a', function() {
        this.on('c.id', '=', 'a.conductor_id')
          .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .leftJoin('mantenimientos as m', 'm.vehiculo_id', 'v.id')
      .select(
        'c.id',
        'c.nombre_conductor',
        'c.numero_telefono',
        db.raw('MAX(v.numero_vehiculo) as numero_vehiculo'),
        db.raw(
          `COALESCE(COUNT(CASE WHEN m.estado = 'Completado'${fechaFiltroSql} THEN 1 END), 0) as total_mantenimientos`,
          fechaBindings
        ),
        db.raw(
          `COALESCE(SUM(CASE WHEN m.estado = 'Completado'${fechaFiltroSql} THEN m.costo_total ELSE 0 END), 0) as costo_total`,
          fechaBindings
        ),
        db.raw(
          `COALESCE(AVG(CASE WHEN m.estado = 'Completado'${fechaFiltroSql} THEN m.costo_total END), 0) as costo_promedio`,
          fechaBindings
        ),
        db.raw(
          `MAX(CASE WHEN m.estado = 'Completado'${fechaFiltroSql} THEN m.fecha_realizada END) as ultimo_mantenimiento`,
          fechaBindings
        )
      )
      .groupBy('c.id', 'c.nombre_conductor', 'c.numero_telefono')
      .orderBy('costo_total', ordenNormalizado);

    if (!incluirCompleto) {
      query = query.limit(limiteFinal);
    }

    const resultado = await query;

    res.json(resultado.map((item) => ({
      ...item,
      total_mantenimientos: parseInt(item.total_mantenimientos, 10) || 0,
      costo_total: parseFloat(item.costo_total) || 0,
      costo_promedio: parseFloat(item.costo_promedio) || 0,
      nombre_conductor: item.nombre_conductor || 'Sin asignar'
    })));
  } catch (error) {
    console.error('Error en getConductoresPorGasto:', error);
    res.status(500).json({
      message: 'Error al obtener conductores por gasto',
      error: error.message
    });
  }
};

exports.getComparativaEstimadoReal = async (req, res) => {
  try {
    const { vehiculo_id } = req.query;

    let query = db('mantenimientos')
      .select(
        'id',
        'tipo_servicio',
        'fecha_programada',
        'fecha_realizada',
        'costo_total',
        db.raw('0 as diferencia'),
        db.raw('0 as porcentaje_variacion')
      )
      .where('estado', 'Completado')
      .orderBy('fecha_realizada', 'desc')
      .limit(50);

    if (vehiculo_id) {
      query = query.where('vehiculo_id', vehiculo_id);
    }

    const resultado = await query;

    // Calcular estadísticas generales
    const estadisticas = await db('mantenimientos')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('0 as diferencia_promedio'),
        db.raw('0 as porcentaje_promedio'),
        db.raw('COUNT(*) as sobrepasados'),
        db.raw('0 as dentro_presupuesto')
      )
      .where('estado', 'Completado')
      .first();

    res.json({
      mantenimientos: resultado,
      estadisticas: {
        total: parseInt(estadisticas.total),
        diferencia_promedio: 0,
        porcentaje_promedio: 0,
        sobrepasados: 0,
        dentro_presupuesto: parseInt(estadisticas.total)
      }
    });

  } catch (error) {
    console.error('Error en getComparativaEstimadoReal:', error);
    res.status(500).json({ 
      message: 'Error al generar comparativa',
      error: error.message 
    });
  }
};

exports.getReportePorTaller = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let query = db('mantenimientos')
      .select(
        'taller',
        db.raw('COUNT(*) as total_servicios'),
        db.raw('COALESCE(SUM(CASE WHEN estado = \'Completado\' THEN costo_total ELSE 0 END), 0) as facturacion_total'),
        db.raw('COALESCE(AVG(CASE WHEN estado = \'Completado\' THEN costo_total END), 0) as ticket_promedio'),
        db.raw('COUNT(CASE WHEN estado = \'Completado\' THEN 1 END) as completados'),
        db.raw('MAX(fecha_realizada) as ultima_visita')
      )
      .whereNotNull('taller')
      .where('taller', '!=', '')
      .groupBy('taller')
      .orderBy('facturacion_total', 'desc');

    if (fecha_inicio && fecha_fin) {
      query = query.whereBetween('fecha_programada', [fecha_inicio, fecha_fin]);
    }

    const resultado = await query;

    res.json(resultado.map(t => ({
      ...t,
      total_servicios: parseInt(t.total_servicios),
      facturacion_total: parseFloat(t.facturacion_total),
      ticket_promedio: parseFloat(t.ticket_promedio),
      completados: parseInt(t.completados)
    })));

  } catch (error) {
    console.error('Error en getReportePorTaller:', error);
    res.status(500).json({ 
      message: 'Error al generar reporte por taller',
      error: error.message 
    });
  }
};
// ============================================
// DISTRIBUIR GASTO DE MANTENIMIENTO
// ============================================
exports.distribuirGastoMantenimiento = async (req, res) => {
  const role = getUserRole(req);
  if (!ROLES_DISTRIBUCION_GASTOS.has(role)) {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para distribuir gastos de mantenimiento'
    });
  }

  const trx = await db.transaction();
  
  try {
    const { id } = req.params; // mantenimiento_id
    const {
      pagado_fondo_mantenimiento = 0,
      pagado_poliza = 0,
      pagado_empresa = 0,
      pagado_conductor = 0,
      observaciones
    } = req.body;

    // 1. Verificar que el mantenimiento existe y está completado
    const mantenimiento = await trx('mantenimientos').where('id', id).first();
    
    if (!mantenimiento) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    if (mantenimiento.estado !== 'Completado') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden distribuir gastos de mantenimientos completados'
      });
    }

    // 2. Convertir a números y validar
    const fondoMant = parseFloat(pagado_fondo_mantenimiento) || 0;
    const poliza = parseFloat(pagado_poliza) || 0;
    const empresa = parseFloat(pagado_empresa) || 0;
    const conductor = parseFloat(pagado_conductor) || 0;
    const costoTotal = parseFloat(mantenimiento.costo_total) || 0;

    const sumaDistribucion = fondoMant + poliza + empresa + conductor;

    // 3. VALIDACION CRITICA: La suma debe ser igual al costo total
    if (Math.abs(sumaDistribucion - costoTotal) > 0.01) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: `La suma de la distribución ($${sumaDistribucion.toFixed(2)}) debe ser igual al costo total ($${costoTotal.toFixed(2)})`,
        datos: {
          costo_total: costoTotal,
          suma_distribucion: sumaDistribucion,
          diferencia: costoTotal - sumaDistribucion
        }
      });
    }

    // 4. Verificar si ya existe una distribución
    const distribucionExistente = await trx('distribucion_gastos_mantenimiento')
      .where('mantenimiento_id', id)
      .first();

    if (distribucionExistente) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este mantenimiento ya tiene una distribución de gastos',
        distribucion_existente: distribucionExistente
      });
    }

    // 5. Crear registro de distribución
    const [distribucion] = await trx('distribucion_gastos_mantenimiento')
      .insert({
        mantenimiento_id: id,
        costo_total: costoTotal,
        pagado_fondo_mantenimiento: fondoMant,
        pagado_poliza: poliza,
        pagado_empresa: empresa,
        pagado_conductor: conductor,
        distribuido_por: req.user?.id || null,
        fecha_distribucion: db.fn.now(),
        observaciones,
        estado: 'distribuido',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning('*');

    // 6. Si pago empresa -> Actualizar inversiones_vehiculos.otros_gastos
    if (empresa > 0) {
      const vehiculo = await trx('vehiculos')
        .where('id', mantenimiento.vehiculo_id)
        .first();

      if (vehiculo) {
        const inversion = await trx('inversiones_vehiculos')
          .where('numero_de_serie_vehiculo', vehiculo.numero_de_serie_vehiculo)
          .first();

        if (inversion) {
          await trx('inversiones_vehiculos')
            .where('id_inversion', inversion.id_inversion)
            .increment('otros_gastos', empresa);
        }
      }
    }

    // 6.5. Si pago poliza -> Descontar de saldo_poliza_mecanica del conductor
    let detallePoliza = null;

    if (poliza > 0) {
      console.log('DEBUG: Entrando a descuento de poliza, monto:', poliza);

      const asignacion = await trx('asignaciones')
        .where('vehiculo_id', mantenimiento.vehiculo_id)
        .where('activa', true)
        .first();

      if (asignacion?.conductor_id) {
        const conductorData = await trx('conductores')
          .where('id', asignacion.conductor_id)
          .first();

        if (!conductorData) {
          await trx.rollback();
          return res.status(400).json({
            success: false,
            message: 'No se encontro conductor activo para descontar la poliza mecanica'
          });
        }

        const saldoActual = parseFloat(conductorData.saldo_poliza_mecanica || 0);
        const nuevoSaldo = saldoActual - poliza;

        if (nuevoSaldo < 0) {
          await trx.rollback();
          return res.status(400).json({
            success: false,
            message: `Saldo insuficiente en póliza. Disponible: $${saldoActual.toFixed(2)}, Requerido: $${poliza.toFixed(2)}`,
            saldo_disponible: saldoActual
          });
        }

        await trx('conductores')
          .where('id', conductorData.id)
          .update({
            saldo_poliza_mecanica: nuevoSaldo,
            updated_at: db.fn.now()
          });

        detallePoliza = {
          id: conductorData.id,
          conductor: conductorData.nombre_conductor,
          saldo_previo: saldoActual,
          saldo_nuevo: nuevoSaldo,
          monto_descontado: poliza
        };
      }
    }

    // 6.6. Si pago fondo de mantenimiento -> Descontar de saldo_ahorro_mantenimiento
    let detalleFondo = null;

    if (fondoMant > 0) {
      console.log('DEBUG: Entrando a descuento de fondo de mantenimiento, monto:', fondoMant);
      
      const asignacion = await trx('asignaciones')
        .where('vehiculo_id', mantenimiento.vehiculo_id)
        .where('activa', true)
        .first();

      console.log('DEBUG: Asignacion encontrada:', asignacion);

      if (asignacion && asignacion.conductor_id) {
        const conductorData = await trx('conductores')
          .where('id', asignacion.conductor_id)
          .first();

        console.log('DEBUG: Conductor encontrado:', {
          id: conductorData?.id,
          nombre: conductorData?.nombre_conductor,
          saldo_ahorro_actual: conductorData?.saldo_ahorro_mantenimiento
        });

        if (conductorData) {
          const saldoActual = parseFloat(conductorData.saldo_ahorro_mantenimiento) || 0;
          const nuevoSaldo = saldoActual - fondoMant;

          console.log('DEBUG: Calculo fondo:', {
            saldoActual,
            montoDescontar: fondoMant,
            nuevoSaldo
          });

          // PERMITIR SALDO NEGATIVO (se convierte en deuda)
          await trx('conductores')
            .where('id', asignacion.conductor_id)
            .update({
              saldo_ahorro_mantenimiento: nuevoSaldo,
              updated_at: db.fn.now()
            });

          console.log('DEBUG: Descuento de fondo aplicado correctamente');

          detalleFondo = {
            id: conductorData.id,
            nombre: conductorData.nombre_conductor,
            saldo_previo: saldoActual,
            saldo_nuevo: nuevoSaldo,
            monto_descontado: fondoMant,
            deuda_generada: nuevoSaldo < 0 ? Math.abs(nuevoSaldo) : 0
          };

          if (nuevoSaldo < 0) {
            console.log('DEBUG: Se genero deuda en fondo de:', Math.abs(nuevoSaldo));
          }
        }
      }
    }

    // 7. Actualizar vehiculos.costo_total_mantenimientos
    await trx('vehiculos')
      .where('id', mantenimiento.vehiculo_id)
      .increment('costo_total_mantenimientos', costoTotal);

    await trx.commit();

    res.json({
      success: true,
      message: 'Distribución de gastos registrada exitosamente',
      distribucion,
      estado_financiero: mapDistribucionEstadoToFinanciero(distribucion?.estado),
      impactos: {
        fondo_mantenimiento: fondoMant > 0,
        poliza_seguro: poliza > 0,
        empresa_inversion: empresa > 0,
        deuda_conductor: conductor > 0
      },
      detalle_poliza: detallePoliza,
      detalle_fondo: detalleFondo  // ANADIDO
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en distribuirGastoMantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al distribuir gastos',
      error: error.message
    });
  }
};

// ============================================
// OBTENER MANTENIMIENTOS PENDIENTES DE DISTRIBUCION
// ============================================
exports.getMantenimientosPendientesDistribucion = async (req, res) => {
  const role = getUserRole(req);
  if (!ROLES_DISTRIBUCION_GASTOS.has(role)) {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para consultar pendientes de distribucion de gastos'
    });
  }

  try {
    const mantenimientos = await db('mantenimientos as m')
      .select(
        'm.id',
        'm.folio_servicio',
        'm.tipo_servicio',
        'm.fecha_realizada',
        'm.costo_total',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'c.nombre_conductor',
        db.raw('DATE_PART(\'day\', NOW() - m.fecha_realizada) as dias_desde_completado')
      )
      .join('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .leftJoin('distribucion_gastos_mantenimiento as d', 'm.id', 'd.mantenimiento_id')
      .where('m.estado', 'Completado')
      .whereNull('d.id') // No tiene distribución
      .orderBy('m.fecha_realizada', 'desc');

    res.json({
      success: true,
      total_pendientes: mantenimientos.length,
      mantenimientos: mantenimientos.map(m => ({
        ...m,
        dias_desde_completado: parseInt(m.dias_desde_completado) || 0,
        costo_total: parseFloat(m.costo_total) || 0
      }))
    });

  } catch (error) {
    console.error('Error en getMantenimientosPendientesDistribucion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mantenimientos pendientes',
      error: error.message
    });
  }
};

// ============================================
// CONFIRMAR MANTENIMIENTO (Pendiente -> Programado)
// ============================================

exports.confirmarMantenimiento = async (req, res) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const forzarHorarioOcupado = toBoolean(req.body?.forzar_horario_ocupado);

    // Buscar el mantenimiento
    const mantenimiento = await trx('mantenimientos').where('id', id).first();

    if (!mantenimiento) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    const estadoCanonico = normalizeEstadoMantenimiento(mantenimiento.estado);
    const observacionesMeta = extractMetaFromObservaciones(mantenimiento.observaciones);
    const sobrecupoAutorizado = hasSobrecupoAutorizado(
      mantenimiento.observaciones,
      observacionesMeta?.meta
    );
    const estadoRawKey = String(mantenimiento.estado || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_]+/g, '');

    const estadosConfirmablesRaw = new Set([
      'pendiente',
      'urgente',
      'proximo',
      'reprogramado',
      'reprogramada'
    ]);

    const esConfirmable =
      estadoCanonico === ESTADOS_MANTENIMIENTO_CANONICOS.PENDIENTE ||
      estadosConfirmablesRaw.has(estadoRawKey);

    if (estadoCanonico === ESTADOS_MANTENIMIENTO_CANONICOS.PROGRAMADO) {
      await trx.rollback();
      return res.json({
        success: true,
        message: 'El mantenimiento ya estaba en estado Programado'
      });
    }

    if (!esConfirmable) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: `No se puede confirmar un mantenimiento con estado: ${mantenimiento.estado}`
      });
    }

    const fechaHora = new Date(mantenimiento.fecha_programada);
    if (Number.isNaN(fechaHora.getTime())) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'La cita no tiene una fecha programada valida'
      });
    }
    const traslape = await findConflictingMantenimiento({
      dbClient: trx,
      fechaHoraProgramada: fechaHora,
      excludeId: id
    });

    if (traslape && !sobrecupoAutorizado && !forzarHorarioOcupado) {
      await trx.rollback();
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cita de mantenimiento en ese bloque de 30 minutos',
        puede_forzar: true,
        diferencia_minima_minutos: SLOT_MINUTES,
        conflicto: {
          cita_id: traslape.id,
          folio_servicio: traslape.folio_servicio || null,
          estado: traslape.estado || null
        }
      });
    }

    const updatesConfirmacion = {
      estado: ESTADOS_MANTENIMIENTO_CANONICOS.PROGRAMADO,
      updated_at: db.fn.now()
    };

    if (traslape && !sobrecupoAutorizado && forzarHorarioOcupado) {
      const notaSobrecupo = `Sobrecupo autorizado por administrador al confirmar. Conflicto detectado con folio #${traslape.folio_servicio || traslape.id}.`;
      const observacionesLimpias = observacionesMeta.observaciones_limpias || '';
      const observacionesFinales = [observacionesLimpias, notaSobrecupo]
        .filter(Boolean)
        .join('\n\n');
      updatesConfirmacion.observaciones = appendMetaToObservaciones(observacionesFinales, {
        ...observacionesMeta.meta,
        sobrecupo_autorizado: true
      });
    }

    // Actualizar estado
    await trx('mantenimientos')
      .where('id', id)
      .update(updatesConfirmacion);

    await trx.commit();

    res.json({
      success: true,
      message: 'Cita aprobada y programada exitosamente'
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error confirmando mantenimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al confirmar la cita',
      error: error.message
    });
  }
};

// ============================================
// CANCELAR MANTENIMIENTO
// ============================================
exports.cancelarMantenimiento = async (req, res) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;

    // Buscar el mantenimiento
    const mantenimiento = await trx('mantenimientos').where('id', id).first();

    if (!mantenimiento) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: 'Mantenimiento no encontrado' });
    }

    // Validar que no esté completado
    if (normalizeEstadoMantenimiento(mantenimiento.estado) === ESTADOS_MANTENIMIENTO_CANONICOS.COMPLETADO) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'No se puede cancelar un mantenimiento completado' });
    }

    // Actualizar estado a Cancelado
    await trx('mantenimientos')
      .where('id', id)
      .update({
        estado: ESTADOS_MANTENIMIENTO_CANONICOS.CANCELADO,
        updated_at: db.fn.now()
      });

    await trx.commit();

    res.json({
      success: true,
      message: 'Mantenimiento cancelado exitosamente'
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error cancelando mantenimiento:', error);
    res.status(500).json({ success: false, message: 'Error al cancelar', error: error.message });
  }
};

// ============================================
// CAPTURAR KILOMETRAJE Y CONTEXTO PREVENTIVO
// ============================================
exports.registrarKilometrajeVehiculo = async (req, res) => {
  const trx = await db.transaction();

  try {
    const { vehiculoId } = req.params;
    const { kilometraje_actual } = req.body;

    const kmActual = Number(kilometraje_actual);
    if (!Number.isFinite(kmActual) || kmActual < 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'kilometraje_actual debe ser un numero mayor o igual a 0'
      });
    }

    const vehiculo = await trx('vehiculos')
      .select('id', 'numero_vehiculo', 'marca', 'modelo', 'tipo_socio', 'kilometraje_actual', 'proximo_mantenimiento')
      .where('id', vehiculoId)
      .first();

    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Vehiculo no encontrado'
      });
    }

    const intervaloKm = getIntervaloMantenimientoKm(vehiculo.tipo_socio);
    const siguienteServicioKm = getSiguienteServicioKm(kmActual, vehiculo.tipo_socio);
    const umbralAlertaKm = getUmbralAlertaKm(siguienteServicioKm, vehiculo.tipo_socio);
    const estadoPreventivo = getEstadoPreventivo({
      kilometrajeActual: kmActual,
      siguienteServicioKm: siguienteServicioKm,
      tipoSocio: vehiculo.tipo_socio
    });
    const alertasPreventivo = buildPreventivoAlertas({
      kilometrajeActual: kmActual,
      siguienteServicioKm,
      tipoSocio: vehiculo.tipo_socio
    });
    const servicioSugerido = getServicioPreventivoSugerido(vehiculo.modelo, kmActual);

    await trx('vehiculos')
      .where('id', vehiculo.id)
      .update({
        kilometraje_actual: kmActual,
        proximo_mantenimiento: siguienteServicioKm,
        updated_at: db.fn.now()
      });

    await trx.commit();

    res.json({
      success: true,
      message: 'Kilometraje actualizado correctamente',
      vehiculo: {
        id: vehiculo.id,
        numero_vehiculo: vehiculo.numero_vehiculo,
        modelo: vehiculo.modelo,
        tipo_socio: vehiculo.tipo_socio,
        kilometraje_anterior: Number(vehiculo.kilometraje_actual || 0),
        kilometraje_actual: kmActual
      },
      mantenimiento_preventivo: {
        intervalo_km: intervaloKm,
        siguiente_servicio_km: siguienteServicioKm,
        umbral_alerta_km: umbralAlertaKm,
        estado: estadoPreventivo,
        sugerencia: servicioSugerido
          ? {
              kilometraje_objetivo: Number(servicioSugerido.kilometraje || 0),
              servicio: servicioSugerido.servicio || null,
              servicio_codigo: servicioSugerido.servicio_codigo || null,
              servicio_nivel: servicioSugerido.servicio_nivel || null,
              incluye_rotacion: Boolean(servicioSugerido.incluye_rotacion)
            }
          : null
      },
      alertas_preventivo: alertasPreventivo
    });
  } catch (error) {
    await trx.rollback();
    console.error('Error en registrarKilometrajeVehiculo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar kilometraje',
      error: error.message
    });
  }
};

// ============================================
// VEHICULOS PROXIMOS A MANTENIMIENTO (CADA 10,000 KM)
// ============================================
exports.getVehiculosProximosKilometraje = async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 50,
      umbral_km = 1000,
      orden = '',
      incluir_todos = 'false',
      incluir_cero_km = 'false'
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 50, 1);
    const offset = (pageNumber - 1) * pageSize;
    const umbralKm = Math.max(parseInt(umbral_km, 10) || 1000, 0);
    const ordenModo = String(orden || '').trim().toLowerCase();
    const incluirTodos = ['1', 'true', 'si', 'sí'].includes(String(incluir_todos || '').trim().toLowerCase());
    const incluirCeroKm = ['1', 'true', 'si', 'sí'].includes(String(incluir_cero_km || '').trim().toLowerCase());

    let query = db('vehiculos as v')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
          .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .select(
        'v.id as vehiculo_id',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'v.placa',
        'v.estado as estado_vehiculo',
        'v.kilometraje_actual',
        'c.id as conductor_id',
        'c.nombre_conductor',
        'c.numero_telefono as conductor_telefono'
      );

    if (search) {
      query = query.where(function() {
        this.where('v.numero_vehiculo', 'ilike', `%${search}%`)
          .orWhere('v.placa', 'ilike', `%${search}%`)
          .orWhere('v.marca', 'ilike', `%${search}%`)
          .orWhere('v.modelo', 'ilike', `%${search}%`)
          .orWhere('c.nombre_conductor', 'ilike', `%${search}%`)
          .orWhere('c.numero_telefono', 'ilike', `%${search}%`);
      });
    }

    const rows = await query.orderBy('v.numero_vehiculo', 'asc');

    const vehiculosProcesados = rows
      .map((item) => {
        const kmActual = Math.max(Number(item.kilometraje_actual || 0), 0);
        const modulo = kmActual % 10000;
        const kmParaSiguiente = modulo === 0
          ? (kmActual === 0 ? 10000 : 0)
          : 10000 - modulo;
        const kmDesdeUltimo = modulo;
        const hitoAnterior = kmActual - modulo;
        const hitoSiguiente = modulo === 0
          ? (kmActual > 0 ? kmActual : 10000)
          : kmActual + kmParaSiguiente;

        const cercaAntes = kmParaSiguiente <= umbralKm;
        const cercaDespues = hitoAnterior >= 10000 && modulo !== 0 && kmDesdeUltimo <= umbralKm;
        const dentroUmbral = cercaAntes || cercaDespues;

        const vencido = (kmActual > 0 && modulo === 0) || cercaDespues;
        const hitoObjetivo = vencido ? (hitoAnterior || 10000) : hitoSiguiente;
        const kmRestantes = vencido ? -(kmDesdeUltimo || 0) : kmParaSiguiente;

        return {
          ...item,
          kilometraje_actual: kmActual,
          hito_objetivo_km: hitoObjetivo,
          km_restantes: kmRestantes,
          umbral_km: umbralKm,
          dentro_umbral: dentroUmbral,
          estado_alerta: vencido ? 'Vencido' : 'Proximo',
          prioridad_alerta: vencido ? 2 : 1
        };
      })
      .filter((item) => {
        if (incluirTodos) return true;
        if (item.dentro_umbral) return true;
        return incluirCeroKm && Number(item.kilometraje_actual || 0) === 0;
      })
      .sort((a, b) => {
        if (ordenModo === 'km_desc') {
          const kmA = Number(a.kilometraje_actual || 0);
          const kmB = Number(b.kilometraje_actual || 0);
          if (kmB !== kmA) return kmB - kmA;
          return String(b.numero_vehiculo || '').localeCompare(
            String(a.numero_vehiculo || ''),
            'es',
            { numeric: true, sensitivity: 'base' }
          );
        }

        if (b.prioridad_alerta !== a.prioridad_alerta) {
          return b.prioridad_alerta - a.prioridad_alerta;
        }
        return Math.abs(a.km_restantes) - Math.abs(b.km_restantes);
      });

    const total = vehiculosProcesados.length;
    const paginated = vehiculosProcesados.slice(offset, offset + pageSize);
    const resumenBase = vehiculosProcesados.filter((v) => v.dentro_umbral);

    const resumen = {
      total,
      vencidos: resumenBase.filter((v) => v.estado_alerta === 'Vencido').length,
      proximos: resumenBase.filter((v) => v.estado_alerta === 'Proximo').length,
      umbral_km: umbralKm
    };

    res.json({
      success: true,
      resumen,
      vehiculos: paginated,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1
      }
    });
  } catch (error) {
    console.error('Error en getVehiculosProximosKilometraje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vehiculos proximos a mantenimiento',
      error: error.message
    });
  }
};

// ============================================
// LISTADO OPERATIVO DE MANTENIMIENTOS POR ESTADO
// ============================================
exports.getMantenimientosPorEstadoOperativo = async (req, res) => {
  try {
    const {
      estado,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 50, 1);
    const offset = (pageNumber - 1) * pageSize;

    const estadoCanonico = estado ? normalizeEstadoMantenimiento(estado) : null;
    if (estado && !estadoCanonico) {
      return res.status(400).json({
        success: false,
        message: 'Estado operativo invalido',
        validos: Object.values(ESTADOS_MANTENIMIENTO_CANONICOS)
      });
    }

    let baseQuery = db('mantenimientos as m')
      .leftJoin('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
          .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id');

    if (estadoCanonico) {
      baseQuery = baseQuery.where('m.estado', estadoCanonico);
    }

    if (search) {
      baseQuery = baseQuery.where(function() {
        this.where('v.numero_vehiculo', 'ilike', `%${search}%`)
          .orWhere('v.placa', 'ilike', `%${search}%`)
          .orWhere('c.nombre_conductor', 'ilike', `%${search}%`)
          .orWhere('m.tipo_servicio', 'ilike', `%${search}%`)
          .orWhereRaw("CAST(m.folio_servicio AS TEXT) ILIKE ?", [`%${search}%`]);
      });
    }

    const totalResult = await baseQuery
      .clone()
      .countDistinct('m.id as total')
      .first();
    const total = parseInt(totalResult?.total || 0, 10);

    const rows = await baseQuery
      .clone()
      .select(
        'm.*',
        'v.numero_vehiculo',
        'v.placa',
        'v.marca',
        'v.modelo',
        'v.tipo_socio',
        'v.kilometraje_actual as km_actual_vehiculo',
        'c.id as conductor_id',
        'c.nombre_conductor',
        'c.numero_telefono as conductor_telefono',
        db.raw(`
          CASE
            WHEN LOWER(TRIM(COALESCE(m.estado, ''))) IN ('completado', 'cancelado', 'cancelada') THEN 0
            WHEN COALESCE(m.proximo_servicio_km, 0) <= 0 THEN 0
            WHEN COALESCE(v.kilometraje_actual, 0) >= COALESCE(m.proximo_servicio_km, 0) THEN 1
            ELSE 0
          END as prioridad_km_vencido
        `),
        db.raw(`
          CASE
            WHEN LOWER(TRIM(COALESCE(m.estado, ''))) IN ('completado', 'cancelado', 'cancelada') THEN 0
            WHEN COALESCE(m.proximo_servicio_km, 0) <= 0 THEN 0
            ELSE GREATEST(COALESCE(v.kilometraje_actual, 0) - COALESCE(m.proximo_servicio_km, 0), 0)
          END as km_exceso_servicio
        `)
      )
      .orderBy('prioridad_km_vencido', 'desc')
      .orderBy('km_exceso_servicio', 'desc')
      .orderBy('m.fecha_programada', 'asc')
      .limit(pageSize)
      .offset(offset);

    const resumenRows = await db('mantenimientos as m')
      .select('m.estado')
      .count('m.id as total')
      .groupBy('m.estado');

    const resumen = {
      pendiente: 0,
      programado: 0,
      en_proceso: 0,
      terminado: 0,
      cancelado: 0,
      reprogramado: 0
    };

    resumenRows.forEach((row) => {
      const slug = toEstadoOperativoSlug(row.estado);
      const totalEstado = parseInt(row.total || 0, 10);
      resumen[slug] = (resumen[slug] || 0) + totalEstado;
    });

    res.json({
      success: true,
      filtros: {
        estado: estadoCanonico || null,
        search: search || null
      },
      resumen,
      mantenimientos: rows.map(formatMantenimientoOperativo),
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1
      }
    });
  } catch (error) {
    console.error('Error en getMantenimientosPorEstadoOperativo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vista operativa de mantenimientos',
      error: error.message
    });
  }
};

// ============================================
// VISTA DE FLUJO FINANCIERO DE MANTENIMIENTOS
// ============================================
exports.getFlujoFinancieroMantenimientos = async (req, res) => {
  try {
    const {
      estado_financiero,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(parseInt(limit, 10) || 50, 1);
    const offset = (pageNumber - 1) * pageSize;

    const estadoFinancieroNormalizado = estado_financiero
      ? normalizeEstadoFinanciero(estado_financiero)
      : null;

    if (estado_financiero && !estadoFinancieroNormalizado) {
      return res.status(400).json({
        success: false,
        message: 'Estado financiero invalido',
        validos: Object.values(ESTADOS_FINANCIEROS_CANONICOS)
      });
    }

    let baseQuery = db('mantenimientos as m')
      .leftJoin('vehiculos as v', 'm.vehiculo_id', 'v.id')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
          .andOn('a.activa', '=', db.raw('true'));
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .leftJoin('distribucion_gastos_mantenimiento as d', 'm.id', 'd.mantenimiento_id');

    if (search) {
      baseQuery = baseQuery.where(function() {
        this.where('v.numero_vehiculo', 'ilike', `%${search}%`)
          .orWhere('c.nombre_conductor', 'ilike', `%${search}%`)
          .orWhere('m.tipo_servicio', 'ilike', `%${search}%`)
          .orWhereRaw("CAST(m.folio_servicio AS TEXT) ILIKE ?", [`%${search}%`]);
      });
    }

    if (estadoFinancieroNormalizado === ESTADOS_FINANCIEROS_CANONICOS.CAPTURADO) {
      baseQuery = baseQuery.where(function() {
        this.whereNull('d.id')
          .orWhereRaw("LOWER(COALESCE(d.estado, '')) IN ('pendiente', 'capturado')");
      });
    }

    if (estadoFinancieroNormalizado === ESTADOS_FINANCIEROS_CANONICOS.VALIDADO_FINANZAS) {
      baseQuery = baseQuery.whereRaw("LOWER(COALESCE(d.estado, '')) IN ('distribuido', 'validado', 'validado_finanzas')");
    }

    if (estadoFinancieroNormalizado === ESTADOS_FINANCIEROS_CANONICOS.PAGADO) {
      baseQuery = baseQuery.whereRaw("LOWER(COALESCE(d.estado, '')) = 'pagado'");
    }

    const totalResult = await baseQuery
      .clone()
      .countDistinct('m.id as total')
      .first();
    const total = parseInt(totalResult?.total || 0, 10);

    const rows = await baseQuery
      .clone()
      .select(
        'm.id',
        'm.folio_servicio',
        'm.tipo_servicio',
        'm.estado',
        'm.costo_total',
        'm.fecha_programada',
        'm.fecha_realizada',
        'm.updated_at',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo',
        'c.id as conductor_id',
        'c.nombre_conductor',
        'd.id as distribucion_id',
        'd.estado as estado_distribucion',
        'd.fecha_distribucion'
      )
      .orderBy('m.updated_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const resumenRaw = await db('mantenimientos as m')
      .leftJoin('distribucion_gastos_mantenimiento as d', 'm.id', 'd.mantenimiento_id')
      .select(
        db.raw("COUNT(*) FILTER (WHERE d.id IS NULL OR LOWER(COALESCE(d.estado, '')) IN ('pendiente', 'capturado')) as capturado"),
        db.raw("COUNT(*) FILTER (WHERE LOWER(COALESCE(d.estado, '')) IN ('distribuido', 'validado', 'validado_finanzas')) as validado_finanzas"),
        db.raw("COUNT(*) FILTER (WHERE LOWER(COALESCE(d.estado, '')) = 'pagado') as pagado")
      )
      .first();

    const flujo = rows.map((row) => ({
      ...formatMantenimientoOperativo(row),
      estado_financiero: mapDistribucionEstadoToFinanciero(row.estado_distribucion)
    }));

    res.json({
      success: true,
      resumen: {
        capturado: parseInt(resumenRaw?.capturado || 0, 10),
        validado_finanzas: parseInt(resumenRaw?.validado_finanzas || 0, 10),
        pagado: parseInt(resumenRaw?.pagado || 0, 10)
      },
      mantenimientos: flujo,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1
      }
    });
  } catch (error) {
    console.error('Error en getFlujoFinancieroMantenimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el flujo financiero',
      error: error.message
    });
  }
};

// ============================================
// ACTUALIZAR ESTADO DEL FLUJO FINANCIERO
// ============================================
exports.actualizarEstadoFlujoFinanciero = async (req, res) => {
  const trx = await db.transaction();

  try {
    const { id } = req.params;
    const { estado_financiero } = req.body;

    const nuevoEstadoFinanciero = normalizeEstadoFinanciero(estado_financiero);
    if (!nuevoEstadoFinanciero) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'estado_financiero invalido',
        validos: Object.values(ESTADOS_FINANCIEROS_CANONICOS)
      });
    }

    const mantenimiento = await trx('mantenimientos')
      .where('id', id)
      .first();

    if (!mantenimiento) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Mantenimiento no encontrado'
      });
    }

    const distribucion = await trx('distribucion_gastos_mantenimiento')
      .where('mantenimiento_id', id)
      .first();

    const estadoActualFinanciero = mapDistribucionEstadoToFinanciero(distribucion?.estado);
    const ordenFlujo = {
      [ESTADOS_FINANCIEROS_CANONICOS.CAPTURADO]: 1,
      [ESTADOS_FINANCIEROS_CANONICOS.VALIDADO_FINANZAS]: 2,
      [ESTADOS_FINANCIEROS_CANONICOS.PAGADO]: 3
    };

    if (
      ordenFlujo[nuevoEstadoFinanciero] < ordenFlujo[estadoActualFinanciero]
    ) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se permite retroceder el estado financiero'
      });
    }

    if (nuevoEstadoFinanciero !== ESTADOS_FINANCIEROS_CANONICOS.CAPTURADO && !distribucion) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Para validar o pagar, primero debe existir una distribucion de gastos'
      });
    }

    if (distribucion) {
      const nuevoEstadoDistribucion = mapFinancieroToDistribucionEstado(nuevoEstadoFinanciero);
      await trx('distribucion_gastos_mantenimiento')
        .where('id', distribucion.id)
        .update({
          estado: nuevoEstadoDistribucion,
          updated_at: db.fn.now()
        });
    }

    await trx.commit();

    res.json({
      success: true,
      message: 'Estado financiero actualizado correctamente',
      mantenimiento_id: Number(id),
      estado_financiero_anterior: estadoActualFinanciero,
      estado_financiero_actual: nuevoEstadoFinanciero
    });
  } catch (error) {
    await trx.rollback();
    console.error('Error en actualizarEstadoFlujoFinanciero:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado financiero',
      error: error.message
    });
  }
};



