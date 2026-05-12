// backend/controllers/conductor/vehiculoController.js
const { db } = require('../../config/database');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const { resolveConductorId } = require('./conductorContextHelper');
const {
  getIntervaloMantenimientoKm,
  getSiguienteServicioKm,
  getUmbralAlertaKm,
  getEstadoPreventivo,
  getPreventiveMaintenanceAlert,
  buildRecordatorioRegistroKm,
  buildPreventivoAlertas
} = require('../../utils/mantenimientoPreventivo');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Sube archivo a Cloudinary usando stream
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {Object} options - Opciones de Cloudinary
 * @returns {Promise<Object>} Resultado de Cloudinary
 */
const uploadToCloudinary = (fileBuffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

let historialKmTableInitialized = false;
const CICLO_BLOQUEO_MANTENIMIENTO_KM = 10000;

const normalizarEstado = (estado) =>
  String(estado || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, '');

const esEstadoCancelado = (estado) => {
  const key = normalizarEstado(estado);
  return key === 'cancelado' || key === 'cancelada';
};

const calcularHitoMantenimiento = (kilometraje) => {
  const km = Math.max(Number(kilometraje || 0), 0);
  return Math.floor(km / CICLO_BLOQUEO_MANTENIMIENTO_KM) * CICLO_BLOQUEO_MANTENIMIENTO_KM;
};

const calcularProximoHitoDesdeServicio = (kilometrajeServicio, cicloKm = CICLO_BLOQUEO_MANTENIMIENTO_KM) => {
  const km = Math.max(Number(kilometrajeServicio || 0), 0);
  if (km <= 0) return 0;
  const hitoServicio = Math.ceil(km / cicloKm) * cicloKm;
  return hitoServicio + cicloKm;
};

const obtenerBloqueoRegistroKilometraje = async (dbClient, { vehiculoId, kilometrajeObjetivo }) => {
  const kmObjetivo = Math.max(Number(kilometrajeObjetivo || 0), 0);
  const hitoObjetivo = calcularHitoMantenimiento(kmObjetivo);
  const vehiculo = await dbClient('vehiculos')
    .select('proximo_mantenimiento')
    .where('id', vehiculoId)
    .first();

  const payloadBase = {
    bloqueado: false,
    ciclo_km: CICLO_BLOQUEO_MANTENIMIENTO_KM,
    kilometraje_objetivo: kmObjetivo,
    hito_objetivo_km: hitoObjetivo,
    hito_solicitado_km: 0,
    mensaje: ''
  };

  if (hitoObjetivo < CICLO_BLOQUEO_MANTENIMIENTO_KM) {
    return payloadBase;
  }

  let hitoSolicitado = 0;
  const proximoMantenimiento = Math.max(Number(vehiculo?.proximo_mantenimiento || 0), 0);
  if (proximoMantenimiento >= CICLO_BLOQUEO_MANTENIMIENTO_KM) {
    const hitoPrevio = Math.max(proximoMantenimiento - CICLO_BLOQUEO_MANTENIMIENTO_KM, 0);
    hitoSolicitado = Math.max(hitoSolicitado, calcularHitoMantenimiento(hitoPrevio));
  }

  const solicitudes = await dbClient('mantenimientos')
    .where({ vehiculo_id: vehiculoId })
    .select('id', 'estado', 'kilometraje_servicio', 'proximo_servicio_km')
    .orderBy('created_at', 'desc');

  hitoSolicitado = solicitudes.reduce((maxHito, solicitud) => {
    if (esEstadoCancelado(solicitud.estado)) return maxHito;

    let hitoPorProximo = 0;
    if (normalizarEstado(solicitud.estado) === 'completado') {
      const kmServicio = Math.max(Number(solicitud.kilometraje_servicio || 0), 0);
      const hitoPorServicio =
        kmServicio >= CICLO_BLOQUEO_MANTENIMIENTO_KM
          ? Math.ceil(kmServicio / CICLO_BLOQUEO_MANTENIMIENTO_KM) * CICLO_BLOQUEO_MANTENIMIENTO_KM
          : 0;

      const proximoKm = Math.max(Number(solicitud.proximo_servicio_km || 0), 0);
      if (proximoKm >= CICLO_BLOQUEO_MANTENIMIENTO_KM) {
        const hitoPrevio = Math.max(proximoKm - CICLO_BLOQUEO_MANTENIMIENTO_KM, 0);
        hitoPorProximo = calcularHitoMantenimiento(hitoPrevio);
      }

      const mejorHito = Math.max(hitoPorServicio, hitoPorProximo);
      return mejorHito > maxHito ? mejorHito : maxHito;
    }
    return maxHito;
  }, hitoSolicitado);

  const hitoLimite = hitoSolicitado + CICLO_BLOQUEO_MANTENIMIENTO_KM;
  const bloqueado = kmObjetivo > hitoLimite;

  return {
    ...payloadBase,
    bloqueado,
    hito_solicitado_km: hitoSolicitado,
    mensaje: bloqueado
      ? `Ya alcanzaste el hito de ${hitoObjetivo.toLocaleString('es-MX')} km. Debes solicitar mantenimiento para continuar registrando kilometraje.`
      : ''
  };
};

const ensureHistorialKmTable = async (dbClient) => {
  if (historialKmTableInitialized) return;

  await dbClient.raw(`
    CREATE TABLE IF NOT EXISTS historial_kilometraje_vehiculos (
      id SERIAL PRIMARY KEY,
      vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
      conductor_id INTEGER NOT NULL REFERENCES conductores(id) ON DELETE CASCADE,
      kilometraje_anterior INTEGER NOT NULL DEFAULT 0,
      kilometraje_actual INTEGER NOT NULL,
      fuente VARCHAR(40) NOT NULL DEFAULT 'portal_conductor',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await dbClient.raw(`
    CREATE INDEX IF NOT EXISTS idx_hist_km_vehiculo_created_at
    ON historial_kilometraje_vehiculos (vehiculo_id, created_at)
  `);

  await dbClient.raw(`
    CREATE INDEX IF NOT EXISTS idx_hist_km_conductor_created_at
    ON historial_kilometraje_vehiculos (conductor_id, created_at)
  `);

  historialKmTableInitialized = true;
};

const getHistorialKilometrajeConductor = async ({ conductorId, vehiculoId, limit = 10 }) => {
  const limitSafe = Math.max(parseInt(limit, 10) || 10, 1);
  try {
    await ensureHistorialKmTable(db);

    return await db('historial_kilometraje_vehiculos')
      .where({ conductor_id: conductorId, vehiculo_id: vehiculoId })
      .orderBy('created_at', 'desc')
      .limit(limitSafe)
      .select(
        'id',
        'kilometraje_anterior',
        'kilometraje_actual',
        'fuente',
        db.raw('COALESCE(created_at, updated_at) as fecha_registro')
      );
  } catch (error) {
    if (error?.code === '42P01') {
      return [];
    }
    throw error;
  }
};

const insertHistorialKilometraje = async (dbClient, payload) => {
  try {
    await ensureHistorialKmTable(dbClient);

    const [registro] = await dbClient('historial_kilometraje_vehiculos')
      .insert({
        ...payload,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning(['id', 'kilometraje_anterior', 'kilometraje_actual', 'fuente', 'created_at', 'updated_at']);

    return registro || null;
  } catch (error) {
    if (error?.code === '42P01') {
      return null;
    }
    throw error;
  }
};

// =====================================================
// OBTENER MI VEHÍCULO ASIGNADO
// =====================================================
const getMiVehiculo = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }

    // Obtener asignación activa del conductor
    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({
        success: false,
        message: 'No tienes un vehículo asignado actualmente'
      });
    }

    // Obtener datos completos del vehículo
    const vehiculo = await db('vehiculos')
      .where({ id: asignacion.vehiculo_id })
      .first();

    if (!vehiculo) {
      return res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado'
      });
    }

    // Obtener último mantenimiento realizado
    const ultimoMantenimiento = await db('mantenimientos')
      .where({ vehiculo_id: vehiculo.id, estado: 'Completado' })
      .orderBy('fecha_realizada', 'desc')
      .first();

    // Obtener próximo mantenimiento programado
    const proximoMantenimiento = await db('mantenimientos')
      .where({ vehiculo_id: vehiculo.id, estado: 'Programado' })
      .orderBy('fecha_programada', 'asc')
      .first();

    // Verificar si subió revisión hoy
    const hoy = new Date().toISOString().split('T')[0];
    const revisionHoy = await db('revisiones_diarias')
      .where({ conductor_id: conductorId })
      .whereRaw('DATE(fecha_revision) = ?', [hoy])
      .first();

    const historialKilometraje = await getHistorialKilometrajeConductor({
      conductorId,
      vehiculoId: vehiculo.id,
      limit: 12
    });

    const kmActual = Number(vehiculo.kilometraje_actual || 0);
    const intervaloKm = getIntervaloMantenimientoKm(vehiculo.tipo_socio);

    // 🔧 Recalcular proximo_mantenimiento a partir del último servicio completado
    if (ultimoMantenimiento) {
      const kmServicio = Number(ultimoMantenimiento.kilometraje_servicio || 0);
      const proximoDesdeUltimo = Number(ultimoMantenimiento.proximo_servicio_km || 0)
        || calcularProximoHitoDesdeServicio(kmServicio, intervaloKm);
      const proximoActual = Number(vehiculo.proximo_mantenimiento || 0);

      if (proximoDesdeUltimo > 0 && proximoDesdeUltimo > proximoActual) {
        await db('vehiculos')
          .where({ id: vehiculo.id })
          .update({
            proximo_mantenimiento: proximoDesdeUltimo,
            updated_at: db.fn.now()
          });
        vehiculo.proximo_mantenimiento = proximoDesdeUltimo;
      }
    }
    const siguienteServicioKm = getSiguienteServicioKm(kmActual, vehiculo.tipo_socio);
    const umbralAlertaKm = getUmbralAlertaKm(siguienteServicioKm, vehiculo.tipo_socio);
    const estadoPreventivo = getEstadoPreventivo({
      kilometrajeActual: kmActual,
      siguienteServicioKm,
      tipoSocio: vehiculo.tipo_socio
    });
    const sugerenciaPreventiva = getPreventiveMaintenanceAlert({
      modelo: vehiculo.modelo,
      kilometrajeActual: kmActual
    });
    const recordatorioRegistroKm = buildRecordatorioRegistroKm();
    const alertasPreventivo = buildPreventivoAlertas({
      kilometrajeActual: kmActual,
      siguienteServicioKm,
      tipoSocio: vehiculo.tipo_socio
    });
    const bloqueoRegistroKm = await obtenerBloqueoRegistroKilometraje(db, {
      vehiculoId: vehiculo.id,
      kilometrajeObjetivo: kmActual
    });

    res.json({
      success: true,
      vehiculo: {
        ...vehiculo,
        asignacion: {
          fecha_inicio: asignacion.fecha_inicio,
          fecha_fin: asignacion.fecha_fin,
          renta_diaria: asignacion.renta_diaria,
          abono_poliza: asignacion.abono_poliza_mantenimiento
        },
        ultimoMantenimiento,
        proximoMantenimiento,
        mantenimiento_preventivo: {
          intervalo_km: intervaloKm,
          siguiente_servicio_km: siguienteServicioKm,
          umbral_alerta_km: umbralAlertaKm,
          estado: estadoPreventivo,
        sugerencia: sugerenciaPreventiva
          ? {
              kilometraje_objetivo: Number(sugerenciaPreventiva.kilometraje_objetivo || 0),
              servicio: sugerenciaPreventiva.tipo_servicio || null,
              servicio_codigo: sugerenciaPreventiva.servicio_codigo || null,
              servicio_nivel: sugerenciaPreventiva.servicio_nivel || null,
              incluye_rotacion: Boolean(sugerenciaPreventiva.incluye_rotacion)
            }
          : null
      },
        alertas_preventivo: alertasPreventivo,
        bloqueo_registro_kilometraje: bloqueoRegistroKm,
        recordatorio_registro_km: recordatorioRegistroKm,
        historial_kilometraje: historialKilometraje,
        revisionHoyCompletada: !!revisionHoy
      }
    });

  } catch (error) {
    console.error('Error en getMiVehiculo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del vehículo',
      error: error.message
    });
  }
};

// =====================================================
// SUBIR REVISIÓN DIARIA (VIDEO + FOTOS)
// =====================================================
const subirRevisionDiaria = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const { comentarios, kilometraje } = req.body;

    // Validar que existan archivos
    if (!req.files || !req.files.video) {
      return res.status(400).json({
        success: false,
        message: 'El video de revisión es obligatorio'
      });
    }

    // Obtener vehículo asignado
    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      return res.status(404).json({
        success: false,
        message: 'No tienes vehículo asignado'
      });
    }

    // Verificar si ya subió revisión hoy
    const hoy = new Date().toISOString().split('T')[0];
    const revisionExistente = await db('revisiones_diarias')
      .where({ conductor_id: conductorId })
      .whereRaw('DATE(fecha_revision) = ?', [hoy])
      .first();

    if (revisionExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya subiste tu revisión diaria hoy'
      });
    }

    // 1. SUBIR VIDEO A CLOUDINARY
    console.log('Subiendo video a Cloudinary...');
    const videoFile = req.files.video[0];
    const videoResult = await uploadToCloudinary(videoFile.buffer, {
      resource_type: 'video',
      folder: 'revisiones_diarias',
      chunk_size: 6000000, // 6MB chunks
      eager: [
        { width: 640, height: 480, crop: 'limit', quality: 'auto' }
      ],
      eager_async: true
    });

    // 2. SUBIR FOTOS (si existen)
    let fotosUrls = [];
    if (req.files.fotos && req.files.fotos.length > 0) {
      console.log(`Subiendo ${req.files.fotos.length} fotos a Cloudinary...`);
      const uploadPromises = req.files.fotos.map(foto =>
        uploadToCloudinary(foto.buffer, {
          resource_type: 'image',
          folder: 'revisiones_diarias/fotos',
          transformation: [
            { width: 1200, crop: 'limit', quality: 'auto' }
          ]
        })
      );
      const fotosResults = await Promise.all(uploadPromises);
      fotosUrls = fotosResults.map(r => r.secure_url);
    }

    // 3. GUARDAR EN BASE DE DATOS
    const [nuevaRevision] = await db('revisiones_diarias')
      .insert({
        conductor_id: conductorId,
        vehiculo_id: asignacion.vehiculo_id,
        fecha_revision: db.fn.now(),
        video_url: videoResult.secure_url,
        fotos_urls: JSON.stringify(fotosUrls),
        comentarios: comentarios || null,
        kilometraje: kilometraje ? parseInt(kilometraje) : null,
        cloudinary_video_id: videoResult.public_id,
        created_at: db.fn.now()
      })
      .returning('*');

    // 4. ACTUALIZAR KILOMETRAJE DEL VEHICULO (si se proporciona)
    const kilometrajeNumerico = Number(kilometraje);
    const tieneKilometrajeValido = Number.isFinite(kilometrajeNumerico) && kilometrajeNumerico >= 0;
    let avisoKilometraje = null;

    if (tieneKilometrajeValido) {
      const vehiculoActual = await db('vehiculos')
        .select('id', 'kilometraje_actual')
        .where({ id: asignacion.vehiculo_id })
        .first();

      const kmActualVehiculo = Math.max(Number(vehiculoActual?.kilometraje_actual || 0), 0);
      if (kilometrajeNumerico < kmActualVehiculo) {
        avisoKilometraje = `No se actualizo kilometraje en revision diaria porque el valor enviado es menor al actual (${kmActualVehiculo.toLocaleString('es-MX')} km).`;
      } else {
        const bloqueoRegistroKm = await obtenerBloqueoRegistroKilometraje(db, {
          vehiculoId: asignacion.vehiculo_id,
          kilometrajeObjetivo: kilometrajeNumerico
        });

        if (bloqueoRegistroKm.bloqueado) {
          avisoKilometraje = bloqueoRegistroKm.mensaje;
        } else {
          await db('vehiculos')
            .where({ id: asignacion.vehiculo_id })
            .update({
              kilometraje_actual: parseInt(kilometrajeNumerico, 10),
              updated_at: db.fn.now()
            });

          await insertHistorialKilometraje(db, {
            conductor_id: conductorId,
            vehiculo_id: asignacion.vehiculo_id,
            kilometraje_anterior: kmActualVehiculo,
            kilometraje_actual: parseInt(kilometrajeNumerico, 10),
            fuente: 'revision_diaria'
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: avisoKilometraje
        ? `Revision diaria subida correctamente. ${avisoKilometraje}`
        : 'Revision diaria subida correctamente',
      revision: {
        id: nuevaRevision.id,
        fecha_revision: nuevaRevision.fecha_revision,
        video_url: nuevaRevision.video_url,
        fotos_count: fotosUrls.length
      },
      aviso_kilometraje: avisoKilometraje
    });

  } catch (error) {
    console.error('Error en subirRevisionDiaria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir revisión diaria',
      error: error.message
    });
  }
};

// =====================================================
// OBTENER HISTORIAL DE REVISIONES DIARIAS
// =====================================================
const getHistorialRevisiones = async (req, res) => {
  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }
    const limit = parseInt(req.query.limit) || 30;

    const revisiones = await db('revisiones_diarias')
      .where({ conductor_id: conductorId })
      .orderBy('fecha_revision', 'desc')
      .limit(limit)
      .select('*');

    // Parsear JSON de fotos_urls
    const revisionesConFotos = revisiones.map(rev => ({
      ...rev,
      fotos_urls: rev.fotos_urls ? JSON.parse(rev.fotos_urls) : []
    }));

    res.json({
      success: true,
      total: revisiones.length,
      revisiones: revisionesConFotos
    });

  } catch (error) {
    console.error('Error en getHistorialRevisiones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de revisiones',
      error: error.message
    });
  }
};

// =====================================================
// ACTUALIZAR KILOMETRAJE DEL VEHICULO
// =====================================================
const actualizarKilometraje = async (req, res) => {
  const trx = await db.transaction();

  try {
    const conductorId = await resolveConductorId(req.user);
    if (!conductorId) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'No se pudo identificar al conductor autenticado' });
    }

    const kilometrajeRaw = req.body?.kilometraje_actual ?? req.body?.kilometraje;
    const kmActual = Number(kilometrajeRaw);

    if (!Number.isFinite(kmActual) || kmActual < 0) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'kilometraje_actual debe ser un numero mayor o igual a 0'
      });
    }

    const asignacion = await trx('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    if (!asignacion) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'No tienes vehiculo asignado'
      });
    }

    const vehiculo = await trx('vehiculos')
      .select('id', 'numero_vehiculo', 'marca', 'modelo', 'tipo_socio', 'kilometraje_actual')
      .where({ id: asignacion.vehiculo_id })
      .first();

    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Vehiculo no encontrado'
      });
    }

    const kmAnterior = Math.max(Number(vehiculo.kilometraje_actual || 0), 0);
    if (kmActual < kmAnterior) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: `No puedes disminuir el kilometraje actual (${kmAnterior.toLocaleString('es-MX')} km)`
      });
    }

    const bloqueoRegistroKm = await obtenerBloqueoRegistroKilometraje(trx, {
      vehiculoId: vehiculo.id,
      kilometrajeObjetivo: kmActual
    });

    if (bloqueoRegistroKm.bloqueado) {
      await trx.rollback();
      return res.status(409).json({
        success: false,
        message: bloqueoRegistroKm.mensaje,
        bloqueo_registro_kilometraje: bloqueoRegistroKm
      });
    }

    const intervaloKm = getIntervaloMantenimientoKm(vehiculo.tipo_socio);
    const siguienteServicioKm = getSiguienteServicioKm(kmActual, vehiculo.tipo_socio);
    const umbralAlertaKm = getUmbralAlertaKm(siguienteServicioKm, vehiculo.tipo_socio);
    const estadoPreventivo = getEstadoPreventivo({
      kilometrajeActual: kmActual,
      siguienteServicioKm,
      tipoSocio: vehiculo.tipo_socio
    });

    const sugerencia = getPreventiveMaintenanceAlert({
      modelo: vehiculo.modelo,
      kilometrajeActual: kmActual
    });
    const recordatorioRegistroKm = buildRecordatorioRegistroKm();
    const alertasPreventivo = buildPreventivoAlertas({
      kilometrajeActual: kmActual,
      siguienteServicioKm,
      tipoSocio: vehiculo.tipo_socio
    });

    await trx('vehiculos')
      .where({ id: vehiculo.id })
      .update({
        kilometraje_actual: kmActual,
        proximo_mantenimiento: siguienteServicioKm,
        updated_at: db.fn.now()
      });

    const registroKilometraje = await insertHistorialKilometraje(trx, {
      conductor_id: conductorId,
      vehiculo_id: vehiculo.id,
      kilometraje_anterior: Number(vehiculo.kilometraje_actual || 0),
      kilometraje_actual: kmActual,
      fuente: 'portal_conductor'
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
        kilometraje_anterior: kmAnterior,
        kilometraje_actual: kmActual
      },
      registro_kilometraje: registroKilometraje
        ? {
            id: registroKilometraje.id,
            kilometraje_anterior: registroKilometraje.kilometraje_anterior,
            kilometraje_actual: registroKilometraje.kilometraje_actual,
            fuente: registroKilometraje.fuente,
            fecha_registro: registroKilometraje.created_at || registroKilometraje.updated_at || null
          }
        : null,
      mantenimiento_preventivo: {
        intervalo_km: intervaloKm,
        siguiente_servicio_km: siguienteServicioKm,
        umbral_alerta_km: umbralAlertaKm,
        estado: estadoPreventivo,
        sugerencia: sugerencia
          ? {
              kilometraje_objetivo: Number(sugerencia.kilometraje_objetivo || 0),
              servicio: sugerencia.tipo_servicio || null,
              servicio_codigo: sugerencia.servicio_codigo || null,
              servicio_nivel: sugerencia.servicio_nivel || null,
              incluye_rotacion: Boolean(sugerencia.incluye_rotacion)
          }
        : null
      },
      bloqueo_registro_kilometraje: {
        ...bloqueoRegistroKm,
        bloqueado: false,
        kilometraje_objetivo: kmActual
      },
      alertas_preventivo: alertasPreventivo,
      recordatorio_registro_km: recordatorioRegistroKm
    });
  } catch (error) {
    await trx.rollback();
    console.error('Error en actualizarKilometraje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar kilometraje',
      error: error.message
    });
  }
};

module.exports = {
  getMiVehiculo,
  subirRevisionDiaria,
  getHistorialRevisiones,
  actualizarKilometraje
};
