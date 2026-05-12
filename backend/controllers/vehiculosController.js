// backend/controllers/vehiculosController.js
const postgresService = require('../services/postgresService');
const auditService = require('../services/auditService');
const { getVehiculosEnumValues } = require('../utils/enumHelper');
const cloudinary = require('../config/cloudinary');

// Obtener db y TABLES
const { db, TABLES } = postgresService;
const INVENTARIO_SNAPSHOTS_TABLE = 'inventario_snapshots';
const INVENTARIO_TIPOS_VALIDOS = new Set(['alta_inicial', 'entrega_conductor', 'devolucion_conductor']);
const MAX_FOTOS_INVENTARIO = 4;

const construirNumeroVehiculoEstandar = (tipoSocio, numeroUnidad, idFallback) => {
  // 1. Forzamos a que siempre exista 'SD' si viene vacío, undefined o null
  const tipo = (tipoSocio && String(tipoSocio).trim() !== '') ? String(tipoSocio).trim().toUpperCase() : 'SD';
  
  // 2. Extraemos el número
  const unidadNumerica = parseInt(numeroUnidad, 10);
  const unidadFallback = parseInt(idFallback, 10);

  let unidadFinal = 0;
  if (!isNaN(unidadNumerica) && unidadNumerica > 0) {
    unidadFinal = unidadNumerica;
  } else if (!isNaN(unidadFallback) && unidadFallback > 0) {
    unidadFinal = unidadFallback;
  }

  // 3. Ensamblamos con los 4 ceros siempre
  return `${tipo}-${String(unidadFinal).padStart(4, '0')}`;
};

const obtenerNumeroVehiculoNormalizado = (record) => {
  const numeroActual = (record?.numero_vehiculo || '').toString().trim();
  const tipoSocio = record?.tipo_socio || 'SD';
  const numeroUnidad = record?.numero_unidad;
  const estandar = construirNumeroVehiculoEstandar(tipoSocio, numeroUnidad, record?.id);
  const unidadNumerica = parseInt(numeroUnidad, 10);

  if (Number.isInteger(unidadNumerica) && unidadNumerica > 0) {
    return estandar;
  }

  const matchEstandar = numeroActual.match(/^([A-Za-z]{2,})-(\d+)$/);
  if (matchEstandar) {
    return `${matchEstandar[1].toUpperCase()}-${String(parseInt(matchEstandar[2], 10)).padStart(4, '0')}`;
  }

  const matchSoloDigitos = numeroActual.match(/(\d+)/);
  if (matchSoloDigitos) {
    return `${(tipoSocio || 'SD').toString().trim()}-${String(parseInt(matchSoloDigitos[1], 10)).padStart(4, '0')}`;
  }

  return estandar;
};

// ========== MAPEO DE CAMPOS ==========
const mapearCamposVehiculo = (data) => {
  const mapeo = {
    'TipoSocio': 'tipo_socio',
    'tipo_socio': 'tipo_socio',
    'NumeroUnidad': 'numero_unidad',
    'numero_unidad': 'numero_unidad',
    'Marca': 'marca',
    'Modelo': 'modelo',
    'TipoVehiculo': 'tipo_vehiculo',
    'TipoCombustible': 'tipo_combustible',
    'Año': 'año_del_vehiculo',
    'Placa': 'placa',
    'Color': 'color',
    'NumeroSerie': 'numero_de_serie_vehiculo',
    'Estado': 'estado',
    'KilometrajeActual': 'kilometraje_actual',
    'ProximoMantenimiento': 'proximo_mantenimiento',
    'IntervaloMantenimiento': 'intervalo_mantenimiento',
    'FechaUltimoServicio': 'fecha_ultimo_servicio',
    'PolizaSeguro': 'poliza_seguro',
    'PolizaVencimiento': 'poliza_vencimiento',
    'MontoDeducible': 'monto_deducible',
    'Observaciones': 'observaciones',
    'NumeroVehiculo': 'numero_vehiculo',
    'numero_vehiculo': 'numero_vehiculo',
    'NumeroMotor': 'numero_motor',
    'ConductorAsignadoId': 'conductor_asignado_id',
    'PolizaSeguroId': 'poliza_seguro_id',
    // 🆕 NUEVOS CAMPOS PARA SOCIO DUEÑO (SD)
    'total_corrida': 'total_corrida',
    'multiplicador_corrida': 'multiplicador_corrida',
    'plazo_corrida': 'plazo_corrida'
  };
  const camposPermitidosPostgres = new Set(Object.values(mapeo));

  const resultado = {};
  for (const [key, value] of Object.entries(data)) {
    let campoPostgres = mapeo[key];

    // Permite payloads internos en snake_case solo si el campo está explícitamente aprobado.
    if (!campoPostgres && camposPermitidosPostgres.has(key)) {
      campoPostgres = key;
    }

    // Ignorar cualquier campo no reconocido para evitar mass assignment.
    if (!campoPostgres) {
      continue;
    }
    
    // NO incluir foreign keys si son null, 0, o undefined
    if ((campoPostgres === 'poliza_seguro_id' || campoPostgres === 'conductor_asignado_id') && 
        (!value || value === null || value === 0)) {
      continue;
    }
    
    if (value !== '' && value !== null && value !== undefined) {
      resultado[campoPostgres] = value;
    }
  }
  return resultado;
};

const mapearCamposRespuestaVehiculo = (record) => {
  if (!record) return null;
  
  return {
  id: record.id,
  TipoSocio: record.tipo_socio || 'SD',
  NumeroUnidad: record.numero_unidad,
  NumeroVehiculo: obtenerNumeroVehiculoNormalizado(record),
  Marca: record.marca,
  Modelo: record.modelo,
  TipoVehiculo: record.tipo_vehiculo,
  TipoCombustible: record.tipo_combustible,
  Año: record.año_del_vehiculo,
  Placa: record.placa,
  Color: record.color,
  NumeroSerie: record.numero_de_serie_vehiculo,
  NumeroDeSerieVehiculo: record.numero_de_serie_vehiculo, // 🆕 ALIAS para frontend
  Estado: record.estado || 'Disponible',
  KilometrajeActual: record.kilometraje_actual || 0,
  ProximoMantenimiento: record.proximo_mantenimiento || 0,
  IntervaloMantenimiento: record.intervalo_mantenimiento || 5000,
  FechaUltimoServicio: record.fecha_ultimo_servicio,
  PolizaSeguro: record.poliza_seguro,
  PolizaVencimiento: record.poliza_vencimiento,
  MontoDeducible: record.monto_deducible || 0,
  Observaciones: record.observaciones,
  NumeroMotor: record.numero_motor,
  ConductorAsignadoId: record.conductor_asignado_id,
  PolizaSeguroId: record.poliza_seguro_id,
  
  // 🆕 CAMPOS DE SOCIO DUEÑO (SD) - CONTRATO
  total_corrida: record.total_corrida || null,
  multiplicador_corrida: record.multiplicador_corrida || null,
  plazo_corrida: record.plazo_corrida || null,
  
  // 🆕 CAMPOS DE PROGRESO SD
  total_pagado_corrida: parseFloat(record.total_pagado_corrida || 0),
  saldo_pendiente_corrida: parseFloat(record.saldo_pendiente_corrida || 0),
  porcentaje_pagado: parseFloat(record.porcentaje_pagado || 0),
  fecha_inicio_corrida: record.fecha_inicio_corrida || null,
  tiene_inventario_inicial: Boolean(record.tiene_inventario_inicial),
  fecha_inventario_inicial: record.fecha_inventario_inicial || null,
  inventario_inicial_pendiente: !Boolean(record.tiene_inventario_inicial),
  
  Conductores: record.conductores || [],
  created_at: record.created_at,
  updated_at: record.updated_at
};
};

const parseVehiculoIdFromParams = (id) => {
  const vehiculoId = parseInt(id, 10);
  if (!Number.isInteger(vehiculoId) || vehiculoId <= 0) {
    return null;
  }
  return vehiculoId;
};

const parseSnapshotIdFromParams = (id) => {
  const snapshotId = parseInt(id, 10);
  if (!Number.isInteger(snapshotId) || snapshotId <= 0) {
    return null;
  }
  return snapshotId;
};

const normalizeJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  return value;
};

const normalizeDateField = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeNumberField = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
};

const sanitizeSnapshotTipo = (value) => {
  if (!value) return null;
  const tipo = String(value).trim().toLowerCase();
  return INVENTARIO_TIPOS_VALIDOS.has(tipo) ? tipo : null;
};

const normalizeEstado = (value, fallback = '') => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim();
};

const requiereInventarioInicialParaEstado = (estado) => {
  const estadoNormalizado = String(estado || '').trim().toLowerCase();
  return estadoNormalizado === 'asignado';
};

const getReqFilesAsArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
};

const gatherFotoFiles = (req) => {
  if (!req.files || typeof req.files !== 'object') return [];

  const fotos = [];
  const directKeys = ['fotos', 'fotos[]', 'foto', 'foto[]'];

  directKeys.forEach((key) => {
    fotos.push(...getReqFilesAsArray(req.files[key]));
  });

  Object.entries(req.files).forEach(([key, value]) => {
    const keyNormalized = String(key || '').toLowerCase();
    if (!keyNormalized.startsWith('foto')) return;
    if (directKeys.includes(key)) return;
    fotos.push(...getReqFilesAsArray(value));
  });

  const uniqueByPath = new Map();
  fotos.forEach((file) => {
    const dedupeKey = `${file?.name || ''}:${file?.tempFilePath || ''}:${file?.size || ''}`;
    uniqueByPath.set(dedupeKey, file);
  });

  return Array.from(uniqueByPath.values());
};

const uploadFileToCloudinary = async (file, options = {}) => {
  if (!file || !file.tempFilePath) {
    throw new Error('Archivo invalido para subir a Cloudinary');
  }

  const result = await cloudinary.uploader.upload(file.tempFilePath, options);
  return {
    url: result.secure_url,
    publicId: result.public_id
  };
};

const ensureVehiculoExists = async (trx, vehiculoId) => {
  const vehiculo = await trx(TABLES.VEHICULOS)
    .where('id', vehiculoId)
    .first();

  return vehiculo || null;
};

const mapSnapshotResponse = (record) => {
  if (!record) return null;

  return {
    id: record.id,
    vehiculo_id: record.vehiculo_id,
    asignacion_id: record.asignacion_id,
    conductor_id: record.conductor_id,
    snapshot_tipo: record.snapshot_tipo,
    snapshot_numero: record.snapshot_numero,
    estado: record.estado,
    fecha_evento: record.fecha_evento,
    kilometraje: record.kilometraje,
    observaciones: record.observaciones,
    fotos_urls_json: normalizeJsonField(record.fotos_urls_json, []),
    payload_json: normalizeJsonField(record.payload_json, {}),
    creado_por: record.creado_por,
    actualizado_por: record.actualizado_por,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
};

const flattenObjectForDiff = (input, prefix = '', output = {}) => {
  if (input === null || input === undefined) return output;

  if (Array.isArray(input)) {
    output[prefix || 'root'] = input;
    return output;
  }

  if (typeof input !== 'object') {
    output[prefix || 'root'] = input;
    return output;
  }

  Object.entries(input).forEach(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObjectForDiff(value, nextPrefix, output);
    } else {
      output[nextPrefix] = value;
    }
  });

  return output;
};

const buildInventarioInicialByVehiculo = async (vehiculoIds = []) => {
  const ids = (vehiculoIds || [])
    .map((id) => parseInt(id, 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (ids.length === 0) {
    return new Map();
  }

  const rows = await db(INVENTARIO_SNAPSHOTS_TABLE)
    .select('vehiculo_id')
    .min('fecha_evento as fecha_inventario_inicial')
    .min('created_at as created_at_inicial')
    .whereIn('vehiculo_id', ids)
    .where('snapshot_tipo', 'alta_inicial')
    .groupBy('vehiculo_id');

  const byVehiculo = new Map();
  rows.forEach((row) => {
    const vehiculoId = parseInt(row.vehiculo_id, 10);
    if (!Number.isInteger(vehiculoId) || vehiculoId <= 0) return;
    byVehiculo.set(vehiculoId, {
      tiene_inventario_inicial: true,
      fecha_inventario_inicial: row.fecha_inventario_inicial || row.created_at_inicial || null
    });
  });

  return byVehiculo;
};

const shouldSkipInventarioDiffKey = (key) => {
  const normalized = String(key || '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('firmas.')) return true;

  return [
    'reviso_nombre_mecanico',
    'recibe_nombre_arrendatario',
    'firma_mecanico_base64',
    'firma_arrendatario_base64'
  ].includes(normalized);
};

const buildInventarioSeguimientoByVehiculo = async (vehiculos = []) => {
  const vehiculoIds = vehiculos
    .map((v) => parseInt(v?.id, 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (vehiculoIds.length === 0) {
    return new Map();
  }

  const activeAsignacionByVehiculo = new Map();
  vehiculos.forEach((v) => {
    const vehiculoId = parseInt(v?.id, 10);
    if (!Number.isInteger(vehiculoId) || vehiculoId <= 0) return;
    const asignacionActivaId = parseInt(v?.asignacion_activa_id || v?.asignacion_id, 10);
    if (Number.isInteger(asignacionActivaId) && asignacionActivaId > 0) {
      activeAsignacionByVehiculo.set(vehiculoId, asignacionActivaId);
    }
  });

  const snapshots = await db(INVENTARIO_SNAPSHOTS_TABLE)
    .select('vehiculo_id', 'asignacion_id', 'snapshot_tipo')
    .whereIn('vehiculo_id', vehiculoIds)
    .where('estado', 'completado')
    .whereIn('snapshot_tipo', ['entrega_conductor', 'devolucion_conductor']);

  const hasByVehiculoTipo = new Set();
  const hasByVehiculoAsignacionTipo = new Set();
  snapshots.forEach((s) => {
    const vehiculoId = parseInt(s.vehiculo_id, 10);
    const asignacionId = parseInt(s.asignacion_id, 10);
    const tipo = String(s.snapshot_tipo || '').trim().toLowerCase();
    if (!Number.isInteger(vehiculoId) || !tipo) return;

    hasByVehiculoTipo.add(`${vehiculoId}:${tipo}`);
    if (Number.isInteger(asignacionId) && asignacionId > 0) {
      hasByVehiculoAsignacionTipo.add(`${vehiculoId}:${asignacionId}:${tipo}`);
    }
  });

  const asignacionesCerradas = await db('asignaciones')
    .select('id', 'vehiculo_id', 'fecha_fin', 'updated_at', 'created_at')
    .whereIn('vehiculo_id', vehiculoIds)
    .where('activa', false)
    .orderBy('vehiculo_id', 'asc')
    .orderByRaw('COALESCE(fecha_fin, updated_at, created_at) DESC')
    .orderBy('id', 'desc');

  const ultimaAsignacionCerradaByVehiculo = new Map();
  asignacionesCerradas.forEach((row) => {
    const vehiculoId = parseInt(row.vehiculo_id, 10);
    const asignacionId = parseInt(row.id, 10);
    if (!Number.isInteger(vehiculoId) || !Number.isInteger(asignacionId)) return;
    if (!ultimaAsignacionCerradaByVehiculo.has(vehiculoId)) {
      ultimaAsignacionCerradaByVehiculo.set(vehiculoId, asignacionId);
    }
  });

  const result = new Map();
  vehiculoIds.forEach((vehiculoId) => {
    const activeAsignacionId = activeAsignacionByVehiculo.get(vehiculoId) || null;
    const ultimaAsignacionCerradaId = ultimaAsignacionCerradaByVehiculo.get(vehiculoId) || null;

    const hasEntrega = activeAsignacionId
      ? hasByVehiculoAsignacionTipo.has(`${vehiculoId}:${activeAsignacionId}:entrega_conductor`) ||
        hasByVehiculoTipo.has(`${vehiculoId}:entrega_conductor`)
      : hasByVehiculoTipo.has(`${vehiculoId}:entrega_conductor`);

    const hasDevolucion = ultimaAsignacionCerradaId
      ? hasByVehiculoAsignacionTipo.has(`${vehiculoId}:${ultimaAsignacionCerradaId}:devolucion_conductor`) ||
        hasByVehiculoTipo.has(`${vehiculoId}:devolucion_conductor`)
      : hasByVehiculoTipo.has(`${vehiculoId}:devolucion_conductor`);

    const requiereInventarioEntrega = Boolean(activeAsignacionId) && !hasEntrega;
    const requiereInventarioDevolucion = !activeAsignacionId && Boolean(ultimaAsignacionCerradaId) && !hasDevolucion;

    let inventarioAlerta = null;
    if (requiereInventarioDevolucion) {
      inventarioAlerta = 'Pendiente inventario de devolucion';
    }

    result.set(vehiculoId, {
      asignacion_activa_id: activeAsignacionId,
      ultima_asignacion_cerrada_id: ultimaAsignacionCerradaId,
      tiene_inventario_entrega_actual: Boolean(hasEntrega),
      tiene_inventario_devolucion_ultima: Boolean(hasDevolucion),
      requiere_inventario_entrega: requiereInventarioEntrega,
      requiere_inventario_devolucion: requiereInventarioDevolucion,
      inventario_alerta: inventarioAlerta
    });
  });

  return result;
};

// ========== OBTENER TODOS LOS VEHÍCULOS ==========
exports.getVehiculos = async (req, res) => {
  try {
    const vehiculos = await db('vehiculos as v')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'))
      })
      
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')

      .select(
        'v.*',
        'a.id as asignacion_activa_id',
        'c.nombre_conductor',
        'c.numero_telefono as conductor_telefono',
        'a.renta_diaria',
        'a.abono_poliza_mantenimiento',
  
      )
      .orderBy('v.tipo_socio')
      .orderBy('v.numero_unidad');

    
    
    if (vehiculos.length === 0) {
      return res.json({
        success: true,
        vehiculos: [],
        message: 'No hay vehículos registrados en la base de datos'
      });
    }
    
    const inventarioSeguimientoByVehiculo = await buildInventarioSeguimientoByVehiculo(vehiculos);
    const inventarioInicialByVehiculo = await buildInventarioInicialByVehiculo(
      vehiculos.map((v) => v.id)
    );

    const vehiculosMapeados = vehiculos.map(v => {
      const vehiculoMapeado = mapearCamposRespuestaVehiculo(v);
      const inventarioSeguimiento = inventarioSeguimientoByVehiculo.get(parseInt(v.id, 10));
      const inventarioInicial = inventarioInicialByVehiculo.get(parseInt(v.id, 10));

      if (inventarioInicial?.tiene_inventario_inicial) {
        vehiculoMapeado.tiene_inventario_inicial = true;
        vehiculoMapeado.inventario_inicial_pendiente = false;
        if (!vehiculoMapeado.fecha_inventario_inicial) {
          vehiculoMapeado.fecha_inventario_inicial = inventarioInicial.fecha_inventario_inicial;
        }
      }

      if (inventarioSeguimiento) {
        vehiculoMapeado.requiere_inventario_entrega = inventarioSeguimiento.requiere_inventario_entrega;
        vehiculoMapeado.requiere_inventario_devolucion = inventarioSeguimiento.requiere_inventario_devolucion;
        vehiculoMapeado.inventario_alerta = inventarioSeguimiento.inventario_alerta;
      }
      
      if (v.nombre_conductor) {
        vehiculoMapeado.ConductorInfo = {
          nombre: v.nombre_conductor,
          telefono: v.conductor_telefono,
          rentaDiaria: parseFloat(v.renta_diaria || 0),
          abonoPoliza: parseFloat(v.abono_poliza_mantenimiento || 0)
        };
      }
      
      return vehiculoMapeado;
    });
    
    res.json({
      success: true,
      vehiculos: vehiculosMapeados
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo vehículos: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener vehículos',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== OBTENER UN VEHÍCULO POR ID ==========
exports.getVehiculoById = async (req, res) => {
  try {
    const { id } = req.params;
    const vehiculoId = parseInt(id);
    
    if (isNaN(vehiculoId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de vehículo inválido'
      });
    }
    
    const existeVehiculo = await db('vehiculos')
      .where('id', vehiculoId)
      .select('id', 'numero_vehiculo', 'tipo_socio', 'numero_unidad')
      .first();
    
    if (!existeVehiculo) {
      return res.status(404).json({ 
        success: false,
        error: `Vehículo con ID ${vehiculoId} no encontrado`
      });
    }
    
    const numeroVehiculoActual = (existeVehiculo.numero_vehiculo || '').trim();
    const numeroVehiculoInvalido = !numeroVehiculoActual ||
      numeroVehiculoActual.startsWith('-') ||
      !numeroVehiculoActual.includes('-');

    if (numeroVehiculoInvalido) {
      const tipoSocio = existeVehiculo.tipo_socio || 'SD';
      const numeroUnidad = existeVehiculo.numero_unidad || vehiculoId;
      const numeroCorregido = `${tipoSocio}-${String(numeroUnidad).padStart(4, '0')}`;

      try {
        const numeroEnUso = await db('vehiculos')
          .where('numero_vehiculo', numeroCorregido)
          .whereNot('id', vehiculoId)
          .first('id');

        if (!numeroEnUso) {
          await db('vehiculos')
            .where('id', vehiculoId)
            .update({
              numero_vehiculo: numeroCorregido,
              updated_at: new Date()
            });
        }
      } catch (errorCorreccion) {
        console.warn(
          `[vehiculos] No se pudo autocorregir numero_vehiculo del vehiculo ${vehiculoId}: ${errorCorreccion.message}`
        );
      }
    }
    
    const vehiculo = await db('vehiculos as v')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'))
      })
      .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
      .leftJoin('polizas_seguro as ps', 'v.poliza_seguro_id', 'ps.id')
      // ✅ Solo hacer JOIN con inversiones si NO es SD
.leftJoin('inversiones_vehiculos as iv', function() {
  this.on('v.numero_de_serie_vehiculo', '=', 'iv.numero_de_serie_vehiculo')
      .andOnNotIn('v.tipo_socio', ['SD', 'Socio Dueño']);
})      .leftJoin('inversionistas as i', 'iv.inversionista_id', 'i.id')
      .select(
        'v.*',
        'v.total_corrida as vehiculo_total_corrida',           // ✅ CORREGIDO: ALIAS ÚNICO
        'v.multiplicador_corrida as vehiculo_multiplicador',   // ✅ CORREGIDO: ALIAS ÚNICO
        'v.plazo_corrida as vehiculo_plazo',    
        'v.total_pagado_corrida',
        'v.saldo_pendiente_corrida',
        'v.porcentaje_pagado',
        'v.fecha_inicio_corrida',
        'a.id as asignacion_id',               // ✅ CORREGIDO: ALIAS ÚNICO
        'v.renta_sugerida',
        'a.id as asignacion_id',
        'a.fecha_inicio as fecha_asignacion',
        'a.fecha_fin as fecha_fin_asignacion',
        'a.renta_diaria',
        'a.abono_poliza_mantenimiento',
        'a.url_contrato_digital',
        'c.id as conductor_id',
        'c.nombre_conductor',
        'c.numero_telefono as conductor_telefono',
        'c.email as conductor_email',
        'c.status as conductor_status',
        'c.status_trabajo as conductor_status_trabajo',
        'c.direccion_completa as conductor_direccion',
        'c.fecha_nacimiento as conductor_fecha_nacimiento',
        'c.numero_de_ine_ife as conductor_ine',
        'c.licencia_conducir as conductor_licencia',
        'c.licencia_vigencia as conductor_licencia_vigencia',
        'c.curp as conductor_curp',
        'c.rfc as conductor_rfc',
        'c.categoria as conductor_categoria',
        'c.deposito as conductor_deposito',
        'c.calificacion_promedio as conductor_calificacion',
        'c.saldo_ganancias as conductor_saldo_ganancias',
        'ps.aseguradora as aseguradora_poliza',
        'ps.numero_poliza as numero_poliza_completo',
        'ps.fecha_vencimiento as poliza_fecha_vencimiento',
        'iv.id_inversion',
        'iv.valor_factura',
        'iv.inversion',
        'iv.total_corrida as inversion_total_corrida',  // ✅ CORREGIDO: ALIAS DIFERENTE
        'iv.total_recuperado',
        'iv.por_recuperar',
        'iv.utilidad_empresa',
        'iv.modelo_negocio',
        'iv.status_inversion',
        'iv.fecha_inicio_inversion',
        'i.nombre as inversionista_nombre',
        'i.email as inversionista_email',
        'i.telefono as inversionista_telefono',
        'i.tasa_rendimiento'
      )
      .where('v.id', vehiculoId)
      .first();
    
    if (!vehiculo) {
      return res.status(404).json({ 
        success: false,
        error: 'Error al obtener detalles del vehículo' 
      });
    }

    const numeroVehiculoFinal = obtenerNumeroVehiculoNormalizado(vehiculo);

    const vehiculoMapeado = {
      id: vehiculo.id,
      TipoSocio: vehiculo.tipo_socio || 'SD',
      NumeroUnidad: vehiculo.numero_unidad || vehiculo.id,
      NumeroVehiculo: numeroVehiculoFinal,
      Marca: vehiculo.marca || 'Sin especificar',
      Modelo: vehiculo.modelo || 'Sin especificar',
      Aseguradora: vehiculo.aseguradora_poliza || null,
      NumeroPolizaCompleto: vehiculo.numero_poliza_completo || null,
      PolizaFechaVencimiento: vehiculo.poliza_fecha_vencimiento || null,
      TipoVehiculo: vehiculo.tipo_vehiculo || 'Sedan',
      TipoCombustible: vehiculo.tipo_combustible || 'Gasolina',
      Año: vehiculo.año_del_vehiculo || new Date().getFullYear(),
      Placa: vehiculo.placa || 'Sin placa',
      Color: vehiculo.color || 'Sin especificar',
      NumeroSerie: vehiculo.numero_de_serie_vehiculo,
      Estado: vehiculo.estado || 'Disponible',
      KilometrajeActual: vehiculo.kilometraje_actual || 0,
      ProximoMantenimiento: vehiculo.proximo_mantenimiento || 0,
      IntervaloMantenimiento: vehiculo.intervalo_mantenimiento || 5000,
      FechaUltimoServicio: vehiculo.fecha_ultimo_servicio,
      PolizaSeguro: vehiculo.poliza_seguro,
      PolizaVencimiento: vehiculo.poliza_vencimiento,
      MontoDeducible: vehiculo.monto_deducible || 0,
      Observaciones: vehiculo.observaciones,
      NumeroMotor: vehiculo.numero_motor,
      // ✅ CORREGIDO: USAR LOS ALIAS CORRECTOS
      renta_sugerida: vehiculo.renta_sugerida || null,
      asignacion_activa_id: vehiculo.asignacion_id || null,
      total_corrida: vehiculo.vehiculo_total_corrida || null,
      multiplicador_corrida: vehiculo.vehiculo_multiplicador || null,
      plazo_corrida: vehiculo.vehiculo_plazo || null,
      total_pagado_corrida: vehiculo.total_pagado_corrida || 0,
      saldo_pendiente_corrida: vehiculo.saldo_pendiente_corrida || 0,
      porcentaje_pagado: vehiculo.porcentaje_pagado || 0,
      created_at: vehiculo.created_at,
      updated_at: vehiculo.updated_at
    };

    const inventarioInicialByVehiculo = await buildInventarioInicialByVehiculo([vehiculo.id]);
    const inventarioInicial = inventarioInicialByVehiculo.get(parseInt(vehiculo.id, 10));
    if (inventarioInicial?.tiene_inventario_inicial) {
      vehiculoMapeado.tiene_inventario_inicial = true;
      vehiculoMapeado.inventario_inicial_pendiente = false;
      if (!vehiculoMapeado.fecha_inventario_inicial) {
        vehiculoMapeado.fecha_inventario_inicial = inventarioInicial.fecha_inventario_inicial;
      }
    }

    const inventarioSeguimientoByVehiculo = await buildInventarioSeguimientoByVehiculo([{
      id: vehiculo.id,
      asignacion_id: vehiculo.asignacion_id
    }]);
    const inventarioSeguimiento = inventarioSeguimientoByVehiculo.get(parseInt(vehiculo.id, 10));
    if (inventarioSeguimiento) {
      vehiculoMapeado.requiere_inventario_entrega = inventarioSeguimiento.requiere_inventario_entrega;
      vehiculoMapeado.requiere_inventario_devolucion = inventarioSeguimiento.requiere_inventario_devolucion;
      vehiculoMapeado.inventario_alerta = inventarioSeguimiento.inventario_alerta;
    }
    
    if (vehiculo.conductor_id) {
      vehiculoMapeado.ConductorInfo = {
        id: vehiculo.conductor_id,
        nombre: vehiculo.nombre_conductor,
        telefono: vehiculo.conductor_telefono,
        email: vehiculo.conductor_email,
        status: vehiculo.conductor_status,
        statusTrabajo: vehiculo.conductor_status_trabajo,
        direccion: vehiculo.conductor_direccion,
        fechaNacimiento: vehiculo.conductor_fecha_nacimiento,
        ine: vehiculo.conductor_ine,
        licencia: vehiculo.conductor_licencia,
        licenciaVigencia: vehiculo.conductor_licencia_vigencia,
        curp: vehiculo.conductor_curp,
        rfc: vehiculo.conductor_rfc,
        categoria: vehiculo.conductor_categoria,
        deposito: parseFloat(vehiculo.conductor_deposito || 0),
        calificacion: parseFloat(vehiculo.conductor_calificacion || 0),
        saldoGanancias: parseFloat(vehiculo.conductor_saldo_ganancias || 0),
        fechaAsignacion: vehiculo.fecha_asignacion,
        fechaFinAsignacion: vehiculo.fecha_fin_asignacion,
        rentaDiaria: parseFloat(vehiculo.renta_diaria || 400),
        abonoPoliza: parseFloat(vehiculo.abono_poliza_mantenimiento || 100),
        urlContrato: vehiculo.url_contrato_digital,
        asignacionId: vehiculo.asignacion_id
      };
    } else {
      vehiculoMapeado.ConductorInfo = null;
    }
    
    if (vehiculo.id_inversion) {
      const totalRecuperado = parseFloat(vehiculo.total_recuperado || 0);
      const totalCorrida = parseFloat(vehiculo.inversion_total_corrida || 0);  // ✅ CORREGIDO: USAR ALIAS
      const porcentajeRecuperado = totalCorrida > 0 ? (totalRecuperado / totalCorrida * 100).toFixed(2) : 0;
      
      vehiculoMapeado.InversionInfo = {
        idInversion: vehiculo.id_inversion,
        valorFactura: parseFloat(vehiculo.valor_factura || 0),
        inversion: parseFloat(vehiculo.inversion || 0),
        totalCorrida: totalCorrida,
        totalRecuperado: totalRecuperado,
        porRecuperar: parseFloat(vehiculo.por_recuperar || 0),
        porcentajeRecuperado: parseFloat(porcentajeRecuperado),
        utilidadEmpresa: parseFloat(vehiculo.utilidad_empresa || 0),
        modeloNegocio: vehiculo.modelo_negocio || 'SD',
        statusInversion: vehiculo.status_inversion || 'Activa',
        fechaInicioInversion: vehiculo.fecha_inicio_inversion,
        inversionista: {
          nombre: vehiculo.inversionista_nombre,
          email: vehiculo.inversionista_email,
          telefono: vehiculo.inversionista_telefono,
          tasaRendimiento: parseFloat(vehiculo.tasa_rendimiento || 1.56)
        }
      };
    } else {
      vehiculoMapeado.InversionInfo = null;
    }
    
    res.json({
      success: true,
      vehiculo: vehiculoMapeado
    });
    
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo vehículo ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Error interno al obtener el vehículo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== CREAR VEHÍCULO CON AUDITORÍA ==========
exports.createVehiculo = async (req, res) => {
  const trx = await db.transaction();
  try {
    await auditService.setUserContext(trx, req.user);
    // 1. Mapeamos los datos (El mapeador podria estar forzando el 'SD')
    const datosPostgres = mapearCamposVehiculo(req.body);
    // =====================================================================
    // Forzar al backend a respetar el tipo de socio del formulario
    // =====================================================================
    const tipoReal = req.body.TipoSocio || req.body.tipo_socio;
    if (tipoReal) {
      datosPostgres.tipo_socio = tipoReal.substring(0, 2).toUpperCase();
    } else {
      datosPostgres.tipo_socio = datosPostgres.tipo_socio || 'SD';
    }
    datosPostgres.numero_unidad = req.body.NumeroUnidad || req.body.numero_unidad || datosPostgres.numero_unidad || 0;
    // 3. LOG DE CAMPOS FINANCIEROS
    if (datosPostgres.total_corrida || datosPostgres.multiplicador_corrida || datosPostgres.plazo_corrida) {
      console.log(`Vehiculo ${datosPostgres.tipo_socio} detectado con campos financieros`);
    }
    // 4. CONSTRUCCION DEL NUMERO DE VEHICULO
    datosPostgres.numero_vehiculo = construirNumeroVehiculoEstandar(
      datosPostgres.tipo_socio,
      datosPostgres.numero_unidad
    );
    // En alta nueva respetamos el estado solicitado (default: Disponible).
    const estadoSolicitado = normalizeEstado(datosPostgres.estado, 'Disponible');
    datosPostgres.estado = estadoSolicitado;
    console.log('Numero de vehiculo final a guardar:', datosPostgres.numero_vehiculo);
    // 5. Validamos campos requeridos
    const camposRequeridos = ['tipo_socio', 'marca', 'modelo', 'placa'];
    const camposFaltantes = camposRequeridos.filter(campo => !datosPostgres[campo]);
    if (camposFaltantes.length > 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos faltantes',
        camposFaltantes
      });
    }
    Object.keys(datosPostgres).forEach(key => {
      if (typeof datosPostgres[key] === 'string') {
        datosPostgres[key] = datosPostgres[key].trim().replace(/^["']|["']$/g, '');
      }
    });
    datosPostgres.created_at = new Date();
    datosPostgres.updated_at = new Date();
    // =====================================================================
    // INICIALIZAR CAMPOS FINANCIEROS (INVERSION Y SALDO)
    // =====================================================================
    // 1. Guardar la Inversion Total como Precio de Compra
    if (req.body.precio_compra !== undefined) {
      datosPostgres.precio_compra = parseFloat(req.body.precio_compra);
      console.log(`Precio de compra (Inversion Total) guardado: ${datosPostgres.precio_compra}`);
    }
    // 2. Guardar la renta sugerida
    if (req.body.renta_sugerida !== undefined) {
      datosPostgres.renta_sugerida = parseFloat(req.body.renta_sugerida);
      console.log(`Renta sugerida guardada: ${datosPostgres.renta_sugerida}`);
    }
    // 3. Saldo pendiente inicial
    if (datosPostgres.total_corrida && parseFloat(datosPostgres.total_corrida) > 0) {
      datosPostgres.saldo_pendiente_corrida = parseFloat(datosPostgres.total_corrida);
      console.log(`Saldo pendiente inicializado en: ${datosPostgres.saldo_pendiente_corrida}`);
    } else {
      datosPostgres.saldo_pendiente_corrida = 0;
    }
    // =====================================================================
    // INSERCION EN LA BASE DE DATOS
    // =====================================================================
    const [nuevoVehiculo] = await trx(TABLES.VEHICULOS)
      .insert(datosPostgres)
      .returning('*');
    console.log('Vehiculo creado en BD:', {
      id: nuevoVehiculo.id,
      numero_vehiculo: nuevoVehiculo.numero_vehiculo,
      tipo_socio: nuevoVehiculo.tipo_socio,
      total_corrida: nuevoVehiculo.total_corrida,
      multiplicador_corrida: nuevoVehiculo.multiplicador_corrida,
      plazo_corrida: nuevoVehiculo.plazo_corrida
    });
    await trx.commit();
    const responsePayload = {
      success: true,
      vehiculo: mapearCamposRespuestaVehiculo(nuevoVehiculo),
      message: 'Vehiculo creado exitosamente'
    };
    res.status(201).json(responsePayload);
  } catch (error) {
    await trx.rollback();
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error creando vehiculo: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    if (error.code === '23505') {
      const constraint = (error.constraint || '').toLowerCase();
      let mensaje = 'Ya existe un vehiculo con esa placa o numero de serie';
      if (constraint.includes('vehiculos_numero_vehiculo_unique')) {
        mensaje = 'Ya existe un vehiculo con ese numero de vehiculo';
      } else if (constraint.includes('placa')) {
        mensaje = 'Ya existe un vehiculo con esa placa';
      } else if (constraint.includes('serie')) {
        mensaje = 'Ya existe un vehiculo con ese numero de serie';
      }
      return res.status(400).json({
        success: false,
        error: mensaje
      });
    }
    res.status(500).json({ 
      success: false,
      error: 'Error al crear el vehiculo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// ========== ACTUALIZAR VEHICULO CON AUDITORIA ==========
exports.updateVehiculo = async (req, res) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    await auditService.setUserContext(trx, req.user);
    const vehiculoAnterior = await trx(TABLES.VEHICULOS)
      .where('id', id)
      .first();
    if (!vehiculoAnterior) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Vehiculo no encontrado'
      });
    }
    const datosPostgres = mapearCamposVehiculo(req.body);
    if (Object.prototype.hasOwnProperty.call(datosPostgres, 'estado')) {
      const estadoDestino = normalizeEstado(datosPostgres.estado, vehiculoAnterior.estado);
      if (requiereInventarioInicialParaEstado(estadoDestino) && !vehiculoAnterior.tiene_inventario_inicial) {
        await trx.rollback();
        return res.status(400).json({
          success: false,
          code: 'INVENTARIO_INICIAL_REQUERIDO_ESTADO',
          error: 'No se puede cambiar a Asignado sin inventario inicial completado.'
        });
      }
      datosPostgres.estado = estadoDestino;
    }
    // IMPORTANTE: NO regenerar numero_vehiculo en modo edicion
    delete datosPostgres.numero_vehiculo;
    Object.keys(datosPostgres).forEach(key => {
      if (typeof datosPostgres[key] === 'string') {
        datosPostgres[key] = datosPostgres[key].trim().replace(/^["']|["']$/g, '');
      }
    });
    datosPostgres.updated_at = new Date();
    const [vehiculoActualizado] = await trx(TABLES.VEHICULOS)
      .where('id', id)
      .update(datosPostgres)
      .returning('*');
    if (vehiculoAnterior.estado !== vehiculoActualizado.estado || 
        vehiculoAnterior.conductor_asignado_id !== vehiculoActualizado.conductor_asignado_id) {
      await auditService.logCriticalChange({
        usuario_id: req.user.id,
        tipo_cambio: 'cambio_estado_vehiculo',
        descripcion: `Vehiculo ${vehiculoActualizado.numero_vehiculo} cambio de estado`,
        datos_sensibles: {
          estado_anterior: vehiculoAnterior.estado,
          estado_nuevo: vehiculoActualizado.estado,
          conductor_anterior: vehiculoAnterior.conductor_asignado_id,
          conductor_nuevo: vehiculoActualizado.conductor_asignado_id
        },
        ip_address: auditService.getClientIp(req)
      });
    }
    await trx.commit();
    res.json({
      success: true,
      vehiculo: mapearCamposRespuestaVehiculo(vehiculoActualizado),
      message: 'Vehiculo actualizado exitosamente'
    });
  } catch (error) {
    await trx.rollback();
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error actualizando vehiculo ${req.params.id}: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Ya existe otro vehiculo con esa placa o numero de serie'
      });
    }
    res.status(500).json({ 
      success: false,
      error: 'Error al actualizar el vehiculo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// ========== ELIMINAR VEHICULO CON AUDITORIA ==========
// backend/controllers/vehiculosController.js
exports.deleteVehiculo = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;

    //  AQUÍ VALIDAMOS QUE ESTEMOS AUTENTICADOS Y OBTENEMOS EL ROL
    // Si req.user no existe, es porque el middleware de auth falló o no se usó en la ruta
    if (!req.user || !req.user.rol) {
        await trx.rollback();
        return res.status(401).json({ error: 'No autorizado. Rol no identificado.' });
    }

    const rol = (req.user.rol || '').toLowerCase(); // Extraemos el rol normalizado
    console.log(`[DELETE] Usuario ${req.user.id} con rol ${rol} intenta borrar vehículo ${id}`);
    await auditService.setUserContext(trx, req.user);

    // 1. Validar existencia
    const vehiculo = await trx('vehiculos').where('id', id).first();
    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    if (vehiculo.estado === 'Baja') {
      await trx.rollback();
      return res.status(400).json({ error: 'El vehículo ya se encuentra en estado Baja.' });
    }

    if (vehiculo.estado === 'Solicitud_baja') {
      await trx.rollback();
      return res.status(400).json({ error: 'El vehículo ya tiene una solicitud de baja pendiente.' });
    }

    // 2. Validar relaciones (Igual que antes)
    const relacionesCount = await trx.raw(`
      SELECT 
        (SELECT COUNT(*) FROM asignaciones WHERE vehiculo_id = ? AND activa = true) as asignaciones,
        (SELECT COUNT(*) FROM rentas WHERE vehiculo_id = ? AND estado = 'Pendiente') as rentas,
        (SELECT COUNT(*) FROM mantenimientos WHERE vehiculo_id = ? AND estado != 'Completado') as mantenimientos
    `, [id, id, id]);

    const counts = relacionesCount.rows[0];
    const numAsignaciones = parseInt(counts.asignaciones);
    const numRentas = parseInt(counts.rentas);
    const numMantenimientos = parseInt(counts.mantenimientos);

    if (numAsignaciones > 0 || numRentas > 0 || numMantenimientos > 0) {
      await trx.rollback();
      return res.status(400).json({ 
        error: `No se puede procesar: Tiene ${numAsignaciones} asignación, ${numRentas} rentas o ${numMantenimientos} mantenimientos activos.` 
      });
    }

    // 3. LÓGICA DE ROLES 🚦
    
    // Coordinador elimina directamente (Baja). Solo jefe_taller genera solicitud.
    const rolesSolicitudBaja = new Set(['jefe_taller']);

    if (rolesSolicitudBaja.has(rol)) {
        // CASO A: Jefe de Taller -> SOLICITUD
        await trx('vehiculos')
          .where('id', id)
          .update({
            estado: 'Solicitud_baja', 
            updated_at: new Date()
          });

        if (typeof auditService !== 'undefined') {
            await auditService.logCriticalChange({
              usuario_id: req.user.id,
              tipo_cambio: 'SOLICITUD_BAJA_VEHICULO',
              descripcion: `Solicitud de baja para vehículo ${vehiculo.placa || vehiculo.placas}`,
              datos_sensibles: { vehiculo_id: id, estado_nuevo: 'Solicitud_baja' },
              ip_address: req.ip 
            });
        }
        
        await trx.commit();
        // Mensaje específico para el frontend sepa que fue solicitud
        return res.json({ success: true, message: 'Solicitud de baja enviada para aprobacion.' });

    } else {
        // CASO B: Admin, Director, etc. -> BAJA DIRECTA
        await trx('vehiculos')
          .where('id', id)
          .update({
            estado: 'Baja',
            updated_at: new Date()
          });

        if (typeof auditService !== 'undefined') {
            await auditService.logCriticalChange({
              usuario_id: req.user.id,
              tipo_cambio: 'DELETE_VEHICULO_LOGICO',
              descripcion: `Vehículo ${vehiculo.placa || vehiculo.placas} dado de BAJA DIRECTA.`,
              datos_sensibles: { vehiculo_id: id, estado_nuevo: 'Baja' },
              ip_address: req.ip 
            });
        }

        await trx.commit();
        return res.json({ success: true, message: 'Vehículo dado de baja exitosamente.' });
    }

  } catch (error) {
    await trx.rollback();
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error procesando baja vehiculo ${req.params?.id}: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    console.error('Error al procesar baja:', error);
    res.status(500).json({
      error: 'Error interno',
      message: 'No fue posible procesar la baja del vehiculo.',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ========== PROCESAR SOLICITUD DE BAJA (APROBAR/RECHAZAR) ==========
exports.procesarSolicitudBaja = async (req, res) => {
  const trx = await db.transaction();
  try {
    if (!req.user || !req.user.rol) {
      await trx.rollback();
      return res.status(401).json({ error: 'No autorizado. Rol no identificado.' });
    }

    const { id } = req.params;
    const accion = (req.body?.accion || '').toLowerCase().trim(); // Esperamos 'aprobar' o 'rechazar'
    await auditService.setUserContext(trx, req.user);

    const vehiculo = await trx('vehiculos').where('id', id).first();
    
    if (!vehiculo || vehiculo.estado !== 'Solicitud_baja') {
      await trx.rollback();
      return res.status(400).json({ error: 'El vehículo no tiene una solicitud de baja pendiente.' });
    }

    let nuevoEstado = '';
    let mensaje = '';

    if (accion === 'aprobar') {
        nuevoEstado = 'Baja';
        mensaje = 'Solicitud APROBADA. Vehículo dado de baja.';
    } else if (accion === 'rechazar') {
        // Regresamos al estado seguro 'Disponible' (ya que deleteVehiculo verificó que no tenía asignaciones)
        nuevoEstado = 'Disponible'; 
        mensaje = 'Solicitud RECHAZADA. El vehículo vuelve a estar Disponible.';
    } else {
        await trx.rollback();
        return res.status(400).json({ error: 'Acción inválida' });
    }

    // Actualizamos
    await trx('vehiculos')
      .where('id', id)
      .update({
        estado: nuevoEstado,
        updated_at: new Date()
      });

    // Auditoría de la decisión
    if (typeof auditService !== 'undefined') {
        await auditService.logCriticalChange({
          usuario_id: req.user.id,
          tipo_cambio: accion === 'aprobar' ? 'APROBACION_BAJA' : 'RECHAZO_BAJA',
          descripcion: `Solicitud de baja ${accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA'} para ${vehiculo.placas}`,
          datos_sensibles: { vehiculo_id: id, decision: accion, estado_final: nuevoEstado },
          ip_address: req.ip 
        });
    }

    await trx.commit();
    res.json({ success: true, message: mensaje });

  } catch (error) {
    await trx.rollback();
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error procesando solicitud de baja vehiculo ${req.params?.id}: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    console.error('Error procesando solicitud:', error);
    res.status(500).json({
      error: 'Error interno',
      message: 'No fue posible procesar la solicitud de baja.',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// ========== OTRAS FUNCIONES ==========
exports.getOpcionesVehiculos = async (req, res) => {
  try {
    // 1. Consultamos la tabla real USANDO KNEX.JS 👈
    const vehiculos = await db('catalogo_vehiculos')
      .select('marca', 'modelo')
      .where('activo', true)
      .orderBy([{ column: 'marca', order: 'asc' }, { column: 'modelo', order: 'asc' }]);

    // 2. Preparamos nuestras variables vacías
    const marcasUnicas = new Set();
    const modelosUnicos = new Set();
    const catalogoDependiente = {}; 

    // 3. Llenamos las variables dinámicamente
    // 🚨 Nota: Knex ya devuelve el arreglo directo, así que le quitamos el ".rows" que traía antes
    vehiculos.forEach(fila => {
      marcasUnicas.add(fila.marca);
      modelosUnicos.add(fila.modelo);
      
      // Armamos el diccionario para los combos dependientes del Frontend
      if (!catalogoDependiente[fila.marca]) {
        catalogoDependiente[fila.marca] = [];
      }
      catalogoDependiente[fila.marca].push(fila.modelo);
    });

    // 4. Armamos la respuesta final
    const opciones = {
      tipoSocio: ['SD', 'SI', 'SA'],
      tipoVehiculo: ['Sedan', 'SUV', 'Pickup', 'Van', 'Hatchback', 'Compacto'],
      tipoCombustible: ['Gasolina', 'Eléctrico', 'Híbrido', 'Diésel'],
      color: ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Tinto'],
      estado: ['Disponible', 'Rentado', 'Mantenimiento', 'Baja', 'Siniestro', 'Asignado'],
      
      // Magia pura desde la base de datos:
      marcas: Array.from(marcasUnicas),
      modelos: Array.from(modelosUnicos),
      marcasModelos: catalogoDependiente 
    };
    
    res.json({
      success: true,
      opciones
    });

  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo opciones: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener opciones',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.createCatalogoVehiculo = async (req, res) => {
  try {
    const { marca, modelo } = req.body;

    // 1. Validación básica de seguridad
    if (!marca || !modelo) {
      return res.status(400).json({
        success: false,
        error: 'La marca y el modelo son obligatorios.'
      });
    }

    // 2. Inserción con Knex.js
    // Usamos returning para que nos devuelva el registro recién creado
    const [nuevoVehiculo] = await db('catalogo_vehiculos')
      .insert({
        marca: marca.trim(),
        modelo: modelo.trim(),
        activo: true
      })
      .returning(['id', 'marca', 'modelo']);

    // 3. Respuesta exitosa
    res.status(201).json({
      success: true,
      vehiculo: nuevoVehiculo,
      message: 'Modelo registrado exitosamente en el catálogo'
    });

  } catch (error) {
    // 4. Auditoría en caso de error
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error creando modelo en catálogo: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    // Validamos si es el error de llave duplicada para mandar un mensaje más limpio (opcional)
    const isDuplicate = error.message.includes('unique_marca_modelo') || error.code === '23505';

    res.status(isDuplicate ? 409 : 500).json({
      success: false,
      error: isDuplicate ? 'Este modelo ya existe para esta marca.' : 'Error al registrar el modelo en el catálogo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


exports.getEstadisticasVehiculos = async (req, res) => {
  try {
    const estadisticas = await db('vehiculos')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(CASE WHEN estado = 'Disponible' THEN 1 END) as disponibles"),
        db.raw("COUNT(CASE WHEN estado = 'Rentado' THEN 1 END) as rentados"),
        db.raw("COUNT(CASE WHEN estado = 'Mantenimiento' THEN 1 END) as en_mantenimiento"),
        db.raw("COUNT(CASE WHEN estado = 'Siniestro' THEN 1 END) as siniestrados"),
        db.raw("COUNT(CASE WHEN estado = 'Baja' THEN 1 END) as dados_baja"),
        db.raw("COUNT(CASE WHEN estado = 'Asignado' THEN 1 END) as asignados"),
        db.raw('AVG(kilometraje_actual) as kilometraje_promedio')
      )
      .first();
    
    const conductoresAsignados = await db('asignaciones')
      .where('activa', true)
      .count('id as count')
      .first();
    
    const stats = {
      total: parseInt(estadisticas.total || 0),
      disponibles: parseInt(estadisticas.disponibles || 0),
      rentados: parseInt(estadisticas.rentados || 0),
      en_mantenimiento: parseInt(estadisticas.en_mantenimiento || 0),
      siniestrados: parseInt(estadisticas.siniestrados || 0),
      dados_baja: parseInt(estadisticas.dados_baja || 0),
      asignados: parseInt(estadisticas.asignados || 0),
      kilometraje_promedio: Math.round(parseFloat(estadisticas.kilometraje_promedio || 0)),
      con_conductor: parseInt(conductoresAsignados?.count || 0)
    };
    
    res.json({
      success: true,
      estadisticas: stats
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo estadísticas: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.asignarConductor = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    const { conductorId, rentaDiaria, abonoPoliza, fechaInicio, urlContrato } = req.body;
    
    await auditService.setUserContext(trx, req.user);
    
    const vehiculo = await trx('vehiculos')
      .where('id', id)
      .first();
    
    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Vehículo no encontrado'
      });
    }
    
    const estadoVehiculo = String(vehiculo.estado || '').trim().toLowerCase();
    const estadosNoOperativos = new Set(['baja', 'solicitud_baja']);

    if (estadosNoOperativos.has(estadoVehiculo)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: `No se puede asignar conductor a un vehiculo en estado ${vehiculo.estado}`
      });
    }

    // Regla de negocio: sin inventario inicial completado no se permite asignar conductor
    const inventarioInicialCompletado = await trx(INVENTARIO_SNAPSHOTS_TABLE)
      .where({
        vehiculo_id: id,
        snapshot_tipo: 'alta_inicial',
        estado: 'completado'
      })
      .first();

    if (!inventarioInicialCompletado) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        code: 'INVENTARIO_INICIAL_REQUERIDO',
        error: 'No se puede asignar conductor sin inventario inicial completado. Primero llena y completa el inventario del vehiculo.'
      });
    }

    const conductor = await trx('conductores')
      .where('id', conductorId)
      .first();
    
    if (!conductor) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'Conductor no encontrado'
      });
    }

    const statusPermitidos = ['Aprobado', 'Activo', 'Inactivo'];
    if (!statusPermitidos.includes(conductor.status)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: `El conductor debe estar Aprobado, Activo o Inactivo para asignar un vehiculo. Status actual: ${conductor.status}`
      });
    }

    const asignacionVehiculoActiva = await trx('asignaciones')
      .where('vehiculo_id', id)
      .where('activa', true)
      .first();

    const asignacionConductorActiva = await trx('asignaciones')
      .where('conductor_id', conductorId)
      .where('activa', true)
      .first();

    await trx('asignaciones')
      .where('vehiculo_id', id)
      .where('activa', true)
      .update({
        activa: false,
        fecha_fin: new Date(),
        updated_at: new Date()
      });

    await trx('asignaciones')
      .where('conductor_id', conductorId)
      .where('activa', true)
      .update({
        activa: false,
        fecha_fin: new Date(),
        updated_at: new Date()
      });

    if (asignacionConductorActiva && String(asignacionConductorActiva.vehiculo_id) !== String(id)) {
      await trx('vehiculos')
        .where('id', asignacionConductorActiva.vehiculo_id)
        .update({
          estado: 'Disponible',
          conductor_asignado_id: null,
          updated_at: new Date()
        });
    }
    
// =========================================================
    // 🛡️ FIX ZONA HORARIA Y TIPO DE DATO INDESTRUCTIBLE
    // =========================================================
    let fechaSegura;
    
    if (!fechaInicio) {
      fechaSegura = new Date();
      fechaSegura.setHours(12, 0, 0, 0);
    } else {
      const fechaString = new Date(fechaInicio).toISOString().split('T')[0];
      fechaSegura = new Date(fechaString + 'T12:00:00');
    }

    const [nuevaAsignacion] = await trx('asignaciones')
      .insert({
        conductor_id: conductorId, // 👈 Variable correcta para Vehículos
        vehiculo_id: id,           // 👈 Variable correcta para Vehículos
        fecha_inicio: fechaSegura, 
        renta_diaria: rentaDiaria || 400,
        abono_poliza_mantenimiento: abonoPoliza || 100,
        url_contrato_digital: urlContrato || null,
        activa: true,
        updated_at: new Date()
      })
      .returning('*');
    
    // =========================================================
    // 🚀 FIX: ACTUALIZAR EL VEHÍCULO CON LA FECHA DEL MODAL
    // =========================================================
    await trx('vehiculos')
      .where('id', id)             // 👈 Variable correcta para Vehículos
      .update({
        estado: 'Asignado',
        conductor_asignado_id: conductorId,
        fecha_inicio_corrida: fechaSegura, 
        updated_at: new Date()
      });
    // =========================================================
    await trx('conductores')
      .where('id', conductorId)
      .update({
        status: 'Activo',
        status_trabajo: 'activo',
        updated_at: new Date()
      });

    if (asignacionVehiculoActiva && String(asignacionVehiculoActiva.conductor_id) !== String(conductorId)) {
      await trx('conductores')
        .where('id', asignacionVehiculoActiva.conductor_id)
        .update({
          status: 'Inactivo',
          status_trabajo: 'inactivo',
          updated_at: new Date()
        });
    }
    
    await auditService.logCriticalChange({
      usuario_id: req.user.id,
      tipo_cambio: 'asignacion_conductor',
      descripcion: `Conductor ${conductor.nombre_conductor} asignado a vehículo ${vehiculo.numero_vehiculo}`,
      datos_sensibles: {
        conductor_id: conductorId,
        vehiculo_id: id,
        renta_diaria: rentaDiaria,
        abono_poliza: abonoPoliza
      },
      ip_address: auditService.getClientIp(req)
    });
    
    await trx.commit();
    
    res.json({
      success: true,
      message: 'Conductor asignado exitosamente',
      asignacion: nuevaAsignacion
    });
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error asignando conductor: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al asignar conductor',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.desasignarConductor = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { id } = req.params;
    
    await auditService.setUserContext(trx, req.user);
    
    const asignacion = await trx('asignaciones')
      .where('vehiculo_id', id)
      .where('activa', true)
      .first();
    
    if (!asignacion) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        error: 'No hay asignación activa para este vehículo'
      });
    }
    
    await trx('asignaciones')
      .where('vehiculo_id', id)
      .where('activa', true)
      .update({
        activa: false,
        fecha_fin: new Date(),
        updated_at: new Date()
      });
    
    await trx('vehiculos')
      .where('id', id)
      .update({
        estado: 'Disponible',
        conductor_asignado_id: null,
        updated_at: new Date()
      });

    await trx('conductores')
      .where('id', asignacion.conductor_id)
      .update({
        status: 'Inactivo',
        status_trabajo: 'inactivo',
        updated_at: new Date()
      });
    
    await trx.commit();
    
    res.json({
      success: true,
      message: 'Conductor desasignado exitosamente'
    });
  } catch (error) {
    await trx.rollback();
    
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error desasignando conductor: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al desasignar conductor',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getPolizasSeguro = async (req, res) => {
  try {
    const polizas = await db('polizas_seguro')
      .select('id', 'numero_poliza', 'aseguradora', 'fecha_vencimiento')
      .orderBy('aseguradora', 'asc');
    
    res.json({
      success: true,
      polizas
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo pólizas: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener pólizas',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.createPolizaSeguro = async (req, res) => {
  try {
    // 1. Extraemos los datos que nos manda React en el body
    const { numero_poliza, aseguradora, fecha_vencimiento } = req.body;

    // 2. Validación básica (que no nos manden campos vacíos)
    if (!numero_poliza || !aseguradora || !fecha_vencimiento) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos (número de póliza, aseguradora y fecha de vencimiento) son obligatorios.'
      });
    }

    // 3. Insertamos en la base de datos
    // Usamos returning('*') o el arreglo de columnas para que Postgres nos devuelva el registro recién creado con su nuevo ID
    const [nuevaPoliza] = await db('polizas_seguro')
      .insert({
        numero_poliza,
        aseguradora,
        fecha_vencimiento
      })
      .returning(['id', 'numero_poliza', 'aseguradora', 'fecha_vencimiento']);

    // 4. Respondemos con éxito y mandamos la póliza creada
    res.status(201).json({
      success: true,
      poliza: nuevaPoliza,
      message: 'Póliza creada exitosamente'
    });

  } catch (error) {
    // 5. El mismo manejo de errores y auditoría que ya usas (¡impecable!)
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error creando póliza: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al crear la póliza de seguro',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
// ========== OBTENER VEHÍCULOS DISPONIBLES (SIN CONDUCTOR) ==========
exports.getVehiculosDisponibles = async (req, res) => {
  try {
    const vehiculos = await db('vehiculos as v')
      .leftJoin('asignaciones as a', function() {
        this.on('v.id', '=', 'a.vehiculo_id')
            .andOn('a.activa', '=', db.raw('true'))
      })
      .whereNull('a.id') // No tiene asignación activa
      .where('v.estado', 'Disponible')
      .select(
        'v.id',
        'v.numero_vehiculo',
        'v.numero_unidad',
        'v.marca',
        'v.modelo',
        'v.año_del_vehiculo as año',
        'v.placa',
        'v.color',
        'v.tipo_vehiculo',
        'v.tipo_socio',
        'v.estado',
        'v.kilometraje_actual',
        'v.renta_sugerida',
      )
      .orderBy('v.tipo_socio')
      .orderBy('v.numero_unidad');
    
    const vehiculosNormalizados = vehiculos.map(v => ({
      ...v,
      numero_vehiculo: obtenerNumeroVehiculoNormalizado(v)
    }));

    res.json({
      success: true,
      vehiculos: vehiculosNormalizados,
      total: vehiculosNormalizados.length
    });
    
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo vehículos disponibles: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Error al obtener vehículos disponibles',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getInventariosVehiculo = async (req, res) => {
  try {
    const vehiculoId = parseVehiculoIdFromParams(req.params.id);
    if (!vehiculoId) {
      return res.status(400).json({ success: false, error: 'ID de vehiculo invalido' });
    }

    const vehiculo = await db(TABLES.VEHICULOS)
      .where('id', vehiculoId)
      .select('id', 'numero_vehiculo', 'tipo_socio', 'numero_unidad', 'tiene_inventario_inicial', 'fecha_inventario_inicial')
      .first();

    if (!vehiculo) {
      return res.status(404).json({ success: false, error: 'Vehiculo no encontrado' });
    }

    const snapshots = await db(INVENTARIO_SNAPSHOTS_TABLE)
      .where('vehiculo_id', vehiculoId)
      .orderBy('snapshot_numero', 'asc')
      .orderBy('created_at', 'asc');

    const inventarioInicialByVehiculo = await buildInventarioInicialByVehiculo([vehiculoId]);
    const inventarioInicial = inventarioInicialByVehiculo.get(vehiculoId);
    const tieneInventarioInicial = Boolean(vehiculo.tiene_inventario_inicial) || Boolean(inventarioInicial?.tiene_inventario_inicial);
    const fechaInventarioInicial = vehiculo.fecha_inventario_inicial || inventarioInicial?.fecha_inventario_inicial || null;

    return res.json({
      success: true,
      vehiculo: {
        id: vehiculo.id,
        numero_vehiculo: obtenerNumeroVehiculoNormalizado(vehiculo),
        tipo_socio: vehiculo.tipo_socio,
        numero_unidad: vehiculo.numero_unidad,
        tiene_inventario_inicial: tieneInventarioInicial,
        fecha_inventario_inicial: fechaInventarioInicial
      },
      inventarios: snapshots.map(mapSnapshotResponse)
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo inventarios de vehiculo: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    return res.status(500).json({
      success: false,
      error: 'Error al obtener inventarios del vehiculo',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getInventarioVehiculoById = async (req, res) => {
  try {
    const vehiculoId = parseVehiculoIdFromParams(req.params.id);
    const snapshotId = parseSnapshotIdFromParams(req.params.snapshotId);

    if (!vehiculoId || !snapshotId) {
      return res.status(400).json({ success: false, error: 'Parametros invalidos' });
    }

    const snapshot = await db(INVENTARIO_SNAPSHOTS_TABLE)
      .where({
        id: snapshotId,
        vehiculo_id: vehiculoId
      })
      .first();

    if (!snapshot) {
      return res.status(404).json({ success: false, error: 'Inventario no encontrado' });
    }

    return res.json({
      success: true,
      inventario: mapSnapshotResponse(snapshot)
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error obteniendo inventario por id: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    return res.status(500).json({
      success: false,
      error: 'Error al obtener inventario',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.createInventarioVehiculo = async (req, res) => {
  const trx = await db.transaction();
  try {
    const vehiculoId = parseVehiculoIdFromParams(req.params.id);
    if (!vehiculoId) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'ID de vehiculo invalido' });
    }

    await auditService.setUserContext(trx, req.user);

    const vehiculo = await ensureVehiculoExists(trx, vehiculoId);
    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({ success: false, error: 'Vehiculo no encontrado' });
    }

    const snapshotTipo = sanitizeSnapshotTipo(req.body.snapshot_tipo);
    if (!snapshotTipo) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'snapshot_tipo invalido. Valores permitidos: alta_inicial, entrega_conductor, devolucion_conductor'
      });
    }

    let asignacionId = req.body.asignacion_id ? parseInt(req.body.asignacion_id, 10) : null;
    let conductorId = req.body.conductor_id ? parseInt(req.body.conductor_id, 10) : null;

    if (snapshotTipo === 'alta_inicial') {
      const existente = await trx(INVENTARIO_SNAPSHOTS_TABLE)
        .where({ vehiculo_id: vehiculoId, snapshot_tipo: 'alta_inicial' })
        .first();

      if (existente) {
        await trx.rollback();
        return res.status(409).json({
          success: false,
          error: 'Este vehiculo ya tiene inventario inicial registrado'
        });
      }
    }

    const [numeroAgg] = await trx(INVENTARIO_SNAPSHOTS_TABLE)
      .where({ vehiculo_id: vehiculoId, snapshot_tipo: snapshotTipo })
      .max('snapshot_numero as max_num');
    const snapshotNumero = (Number(numeroAgg?.max_num) || 0) + 1;

    const fotoFiles = gatherFotoFiles(req);
    if (fotoFiles.length === 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'Debe incluir al menos una foto en el inventario'
      });
    }

    if (fotoFiles.length > MAX_FOTOS_INVENTARIO) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: `Solo se permiten ${MAX_FOTOS_INVENTARIO} fotos por inventario`
      });
    }

    const uploadFotos = [];
    for (let i = 0; i < fotoFiles.length; i += 1) {
      const uploaded = await uploadFileToCloudinary(fotoFiles[i], {
        folder: 'automanager/inventarios/fotos',
        resource_type: 'image',
        public_id: `vehiculo_${vehiculoId}_${snapshotTipo}_${Date.now()}_${i + 1}`
      });
      uploadFotos.push(uploaded.url);
    }

    if ((snapshotTipo === 'entrega_conductor' || snapshotTipo === 'devolucion_conductor') && (!asignacionId || !conductorId)) {
      const asignacionActiva = await trx('asignaciones')
        .where('vehiculo_id', vehiculoId)
        .where('activa', true)
        .orderBy('id', 'desc')
        .first();

      if (asignacionActiva) {
        asignacionId = asignacionActiva.id;
        conductorId = asignacionActiva.conductor_id;
      }
    }

    const payloadJson = normalizeJsonField(req.body.payload_json, {});
    if (!payloadJson || typeof payloadJson !== 'object' || Object.keys(payloadJson).length === 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'payload_json no puede estar vacio'
      });
    }

    const fechaEvento = normalizeDateField(req.body.fecha_evento);
    if (!fechaEvento) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'fecha_evento es obligatoria'
      });
    }

    const kilometraje = normalizeNumberField(req.body.kilometraje);
    if (kilometraje === null || kilometraje < 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        error: 'kilometraje valido es obligatorio'
      });
    }

    const now = new Date();

    const [created] = await trx(INVENTARIO_SNAPSHOTS_TABLE)
      .insert({
        vehiculo_id: vehiculoId,
        asignacion_id: Number.isInteger(asignacionId) && asignacionId > 0 ? asignacionId : null,
        conductor_id: Number.isInteger(conductorId) && conductorId > 0 ? conductorId : null,
        snapshot_tipo: snapshotTipo,
        snapshot_numero: snapshotNumero,
        estado: 'completado',
        fecha_evento: fechaEvento,
        kilometraje,
        observaciones: req.body.observaciones || null,
        fotos_urls_json: JSON.stringify(uploadFotos),
        payload_json: JSON.stringify(payloadJson),
        creado_por: req.user?.id || null,
        actualizado_por: req.user?.id || null,
        created_at: now,
        updated_at: now
      })
      .returning('*');

    if (snapshotTipo === 'alta_inicial') {
      await trx(TABLES.VEHICULOS)
        .where('id', vehiculoId)
        .update({
          tiene_inventario_inicial: true,
          fecha_inventario_inicial: fechaEvento || now,
          updated_at: now
        });
    }

    await trx.commit();
    return res.status(201).json({
      success: true,
      message: 'Registro de inventario guardado correctamente',
      inventario: mapSnapshotResponse(created)
    });
  } catch (error) {
    await trx.rollback();

    if (error?.code === '23505' && String(error?.constraint || '').includes('uq_inventario_snapshots_alta_inicial')) {
      return res.status(409).json({
        success: false,
        error: 'Este vehiculo ya tiene inventario inicial registrado'
      });
    }

    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error creando inventario de vehiculo: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    return res.status(500).json({
      success: false,
      error: 'Error al crear inventario',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateInventarioVehiculo = async (req, res) => {
  try {
    const vehiculoId = parseVehiculoIdFromParams(req.params.id);
    const snapshotId = parseSnapshotIdFromParams(req.params.snapshotId);

    if (!vehiculoId || !snapshotId) {
      return res.status(400).json({ success: false, error: 'Parametros invalidos' });
    }
    return res.status(409).json({
      success: false,
      code: 'INVENTARIO_EDICION_NO_PERMITIDA',
      error: 'Los registros de inventario ya se guardan completos y no se pueden editar. Genera un nuevo registro.'
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error actualizando inventario de vehiculo: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    return res.status(500).json({
      success: false,
      error: 'Error al actualizar inventario',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.completarInventarioVehiculo = async (req, res) => {
  const trx = await db.transaction();
  try {
    const vehiculoId = parseVehiculoIdFromParams(req.params.id);
    const snapshotId = parseSnapshotIdFromParams(req.params.snapshotId);

    if (!vehiculoId || !snapshotId) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'Parametros invalidos' });
    }

    await auditService.setUserContext(trx, req.user);

    const snapshot = await trx(INVENTARIO_SNAPSHOTS_TABLE)
      .where({ id: snapshotId, vehiculo_id: vehiculoId })
      .first();

    if (!snapshot) {
      await trx.rollback();
      return res.status(404).json({ success: false, error: 'Inventario no encontrado' });
    }

    if (snapshot.estado === 'completado') {
      await trx.commit();
      return res.json({
        success: true,
        message: 'El registro de inventario ya estaba completado',
        inventario: mapSnapshotResponse(snapshot)
      });
    }

    const payload = normalizeJsonField(snapshot.payload_json, {});
    const fotos = normalizeJsonField(snapshot.fotos_urls_json, []);
    const kilometraje = normalizeNumberField(snapshot.kilometraje);
    const fechaEvento = snapshot.fecha_evento || new Date();

    if (!fechaEvento) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'fecha_evento es obligatoria para completar inventario' });
    }

    if (kilometraje === null || kilometraje < 0) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'kilometraje valido es obligatorio para completar inventario' });
    }

    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'payload_json no puede estar vacio al completar inventario' });
    }

    if (!Array.isArray(fotos) || fotos.length === 0) {
      await trx.rollback();
      return res.status(400).json({ success: false, error: 'Debe incluir al menos una foto en el inventario' });
    }

    const patch = {
      estado: 'completado',
      fecha_evento: fechaEvento,
      actualizado_por: req.user?.id || null,
      updated_at: new Date()
    };

    const [updated] = await trx(INVENTARIO_SNAPSHOTS_TABLE)
      .where({ id: snapshotId, vehiculo_id: vehiculoId })
      .update(patch)
      .returning('*');

    if (updated.snapshot_tipo === 'alta_inicial') {
      await trx(TABLES.VEHICULOS)
        .where('id', vehiculoId)
        .update({
          tiene_inventario_inicial: true,
          fecha_inventario_inicial: updated.fecha_evento || new Date(),
          updated_at: new Date()
        });
    }

    await trx.commit();
    return res.json({
      success: true,
      message: 'Inventario completado correctamente',
      inventario: mapSnapshotResponse(updated)
    });
  } catch (error) {
    await trx.rollback();
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error completando inventario de vehiculo: ${error.message}`,
      stack_trace: error.stack,
      contexto: req.body,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    return res.status(500).json({
      success: false,
      error: 'Error al completar inventario',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.compararInventariosVehiculo = async (req, res) => {
  try {
    const vehiculoId = parseVehiculoIdFromParams(req.params.id);
    if (!vehiculoId) {
      return res.status(400).json({ success: false, error: 'ID de vehiculo invalido' });
    }

    const snapshotAId = parseSnapshotIdFromParams(req.query.snapshot_a_id);
    const snapshotBId = parseSnapshotIdFromParams(req.query.snapshot_b_id);

    if (!snapshotAId || !snapshotBId) {
      return res.status(400).json({
        success: false,
        error: 'snapshot_a_id y snapshot_b_id son obligatorios'
      });
    }

    const snapshots = await db(INVENTARIO_SNAPSHOTS_TABLE)
      .where('vehiculo_id', vehiculoId)
      .whereIn('id', [snapshotAId, snapshotBId]);

    const snapA = snapshots.find((s) => s.id === snapshotAId);
    const snapB = snapshots.find((s) => s.id === snapshotBId);

    if (!snapA || !snapB) {
      return res.status(404).json({
        success: false,
        error: 'No se encontraron ambos inventarios para comparar'
      });
    }

    const payloadA = normalizeJsonField(snapA.payload_json, {});
    const payloadB = normalizeJsonField(snapB.payload_json, {});
    const flatA = flattenObjectForDiff(payloadA);
    const flatB = flattenObjectForDiff(payloadB);

    const keys = new Set([
      ...Object.keys(flatA),
      ...Object.keys(flatB),
      'kilometraje',
      'observaciones'
    ]);

    const cambios = [];
    for (const key of keys) {
      if (shouldSkipInventarioDiffKey(key)) {
        continue;
      }

      const oldVal = key === 'kilometraje'
        ? snapA.kilometraje
        : key === 'observaciones'
          ? snapA.observaciones
          : flatA[key];
      const newVal = key === 'kilometraje'
        ? snapB.kilometraje
        : key === 'observaciones'
          ? snapB.observaciones
          : flatB[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        cambios.push({
          campo: key,
          valor_anterior: oldVal ?? null,
          valor_nuevo: newVal ?? null
        });
      }
    }

    return res.json({
      success: true,
      snapshot_a: mapSnapshotResponse(snapA),
      snapshot_b: mapSnapshotResponse(snapB),
      total_cambios: cambios.length,
      cambios
    });
  } catch (error) {
    await auditService.logError({
      usuario_id: req.user?.id,
      nivel: 'error',
      mensaje: `Error comparando inventarios de vehiculo: ${error.message}`,
      stack_trace: error.stack,
      ip_address: auditService.getClientIp(req),
      url: req.originalUrl,
      metodo_http: req.method
    });

    return res.status(500).json({
      success: false,
      error: 'Error al comparar inventarios',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;




