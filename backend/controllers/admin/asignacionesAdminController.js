// backend/controllers/admin/asignacionesAdminController.js

const { db } = require('../../config/database');
const cloudinary = require('../../config/cloudinary');

// ============================================
// OBTENER ASIGNACIÓN ACTIVA DE UN VEHÍCULO
// ============================================
exports.getAsignacionActiva = async (req, res) => {
  try {
    const { vehiculo_id } = req.params;

    const asignacion = await db('asignaciones as a')
      .select(
        'a.*',
        'c.nombre_conductor',
        'c.numero_telefono as conductor_telefono',
        'c.email as conductor_email',
        'v.numero_vehiculo',
        'v.marca',
        'v.modelo'
      )
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .join('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .where('a.vehiculo_id', vehiculo_id)
      .where('a.activa', true)
      .first();

    if (!asignacion) {
      return res.json({
        success: false,
        message: 'No hay asignación activa para este vehículo'
      });
    }

    res.json({
      success: true,
      asignacion
    });

  } catch (error) {
    console.error('Error en getAsignacionActiva:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener asignación',
      error: error.message
    });
  }
};

// ============================================
// SUBIR CONTRATO DIGITAL (CLOUDINARY)
// ============================================
exports.subirContrato = async (req, res) => {
  try {
    const { id } = req.params; // asignacion_id

    if (!req.files || !req.files.contrato) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo'
      });
    }

    const file = req.files.contrato;

    // Validar que sea PDF
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({
        success: false,
        message: 'Solo se permiten archivos PDF'
      });
    }

    // Subir a Cloudinary
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: 'contratos',
      resource_type: 'raw',
      public_id: `contrato_asignacion_${id}_${Date.now()}`
    });

    // Actualizar URL en la base de datos
    await db('asignaciones')
      .where('id', id)
      .update({
        url_contrato_digital: result.secure_url,
        updated_at: db.fn.now()
      });

    res.json({
      success: true,
      message: 'Contrato subido exitosamente',
      url: result.secure_url
    });

  } catch (error) {
    console.error('Error en subirContrato:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir contrato',
      error: error.message
    });
  }
};

// ============================================
// OBTENER CONDUCTORES PARA CAMBIO (CON PRIORIDAD)
// ============================================
exports.getConductoresDisponibles = async (req, res) => {
  try {
    // 1. Buscamos a los "Ocupados": 
    // Aquellos que tienen una asignación donde el campo 'activa' es explícitamente TRUE o 1
    const ocupados = await db('asignaciones')
      .where(function() {
        this.where('activa', true)
            .orWhere('activa', 1); // Por si la base de datos lo guarda como número
      })
      .pluck('conductor_id'); // Obtenemos solo la lista de sus IDs [2, 5, 9...]

    console.log('🚫 IDs de conductores que el sistema va a ocultar por tener carro activo:', ocupados);

    // 2. Traemos a los conductores disponibles:
    // - Que su status personal sea 'Activo'
    // - Y que su ID NO ESTÉ en la lista de los que tienen una asignación activa
    const disponibles = await db('conductores as c')
      .where('c.status', 'Activo')
      .whereNotIn('c.id', ocupados) // Aquí ocurre la magia del filtro
      .select(
        'c.id',
        'c.nombre_conductor',
        'c.numero_telefono',
        'c.email',
        'c.calificacion_promedio'
      )
      .orderBy('c.nombre_conductor', 'asc');

    // 3. Respuesta para el frontend
    res.json({
      success: true,
      conductores: disponibles.map(c => ({
        id: c.id,
        nombre: c.nombre_conductor,
        telefono: c.numero_telefono,
        email: c.email,
        calificacion: parseFloat(c.calificacion_promedio || 0)
      }))
    });

  } catch (error) {
    console.error('Error filtrando conductores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al filtrar conductores por asignación activa'
    });
  }
};
// ============================================
// CAMBIAR CONDUCTOR DE UN VEHÍCULO
// ============================================
exports.cambiarConductor = async (req, res) => {
  const trx = await db.transaction();

  try {
    const {
      vehiculo_id,
      conductor_actual_id,
      conductor_nuevo_id,
      renta_diaria,
      abono_poliza_mantenimiento,
      motivo
    } = req.body;

    // Validaciones
    if (!vehiculo_id || !conductor_nuevo_id || !renta_diaria) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'vehiculo_id, conductor_nuevo_id y renta_diaria son obligatorios'
      });
    }

    // 1. Cerrar asignación actual
    if (conductor_actual_id) {
      await trx('asignaciones')
        .where('vehiculo_id', vehiculo_id)
        .where('conductor_id', conductor_actual_id)
        .where('activa', true)
        .update({
          activa: false,
          fecha_fin: db.fn.now(),
          updated_at: db.fn.now()
        });
    }

    // 2. Crear nueva asignación
    const [nuevaAsignacion] = await trx('asignaciones')
      .insert({
        vehiculo_id,
        conductor_id: conductor_nuevo_id,
        fecha_inicio: db.fn.now(),
        renta_diaria,
        abono_poliza_mantenimiento: abono_poliza_mantenimiento || 100,
        activa: true,
        updated_at: db.fn.now()
      })
      .returning('*');

    // 3. Actualizar estado del vehículo
    await trx('vehiculos')
      .where('id', vehiculo_id)
      .update({
        estado: 'Asignado',
        conductor_asignado_id: conductor_nuevo_id,
        updated_at: db.fn.now()
      });

    await trx.commit();

    // Obtener datos completos de la nueva asignación
    const asignacionCompleta = await db('asignaciones as a')
      .select(
        'a.*',
        'c.nombre_conductor',
        'v.numero_vehiculo'
      )
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .join('vehiculos as v', 'a.vehiculo_id', 'v.id')
      .where('a.id', nuevaAsignacion.id)
      .first();

    res.json({
      success: true,
      message: 'Conductor cambiado exitosamente',
      asignacion: asignacionCompleta
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en cambiarConductor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar conductor',
      error: error.message
    });
  }
};

// ============================================
// OBTENER HISTORIAL COMPLETO DE UN VEHÍCULO (VERSIÓN DEFINITIVA)
// ============================================
exports.getHistorialVehiculo = async (req, res) => {
  try {
    const { vehiculo_id } = req.params;

    // ========== 1. DATOS DEL VEHÍCULO ==========
    const vehiculo = await db('vehiculos')
      .where('id', vehiculo_id)
      .first();

    if (!vehiculo) {
      return res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado'
      });
    }

    // ========== 2. DATOS DE INVERSIÓN ==========
    const inversion = await db('inversiones_vehiculos as iv')
      .select(
        'iv.*',
        'inv.nombre as inversionista_nombre',
        'inv.email as inversionista_email',
        'inv.telefono as inversionista_telefono',
        'inv.whatsapp as inversionista_whatsapp'
      )
      .leftJoin('inversionistas as inv', 'iv.inversionista_id', 'inv.id')
      .where('iv.numero_de_serie_vehiculo', vehiculo.numero_de_serie_vehiculo)
      .first();

    // ========== 3. PAGOS A INVERSIONISTAS ==========
    const pagosInversionista = inversion ? await db('pagos_inversionistas')
      .select('*')
      .where('inversion_id', inversion.id_inversion)
      .orderBy('fecha_programada', 'asc') : [];

    // ========== 4. PÓLIZA DE SEGURO ==========
    const poliza = vehiculo.poliza_seguro_id ? await db('polizas_seguro')
      .where('id', vehiculo.poliza_seguro_id)
      .first() : null;

    // ========== 5. HISTORIAL DE ASIGNACIONES ==========
    const asignaciones = await db('asignaciones as a')
      .select(
        'a.*',
        'c.nombre_conductor',
        'c.numero_telefono',
        'c.email as conductor_email',
        db.raw(`
          CASE 
            WHEN a.fecha_fin IS NULL THEN (CURRENT_DATE - a.fecha_inicio::date)
            ELSE (a.fecha_fin::date - a.fecha_inicio::date)
          END as dias_con_vehiculo
        `)
      )
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .where('a.vehiculo_id', vehiculo_id)
      .orderBy('a.fecha_inicio', 'desc');

    // ========== 6. HISTORIAL DE PAGOS DIARIOS ==========
    const pagos = await db('pagos_diarios as pd')
      .select(
        'pd.*',
        'c.nombre_conductor',
        'a.renta_diaria',
        'a.fecha_inicio as asignacion_inicio'
      )
      .join('asignaciones as a', 'pd.asignacion_id', 'a.id')
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .where('a.vehiculo_id', vehiculo_id)
      .orderBy('pd.fecha_pago', 'desc')
      .limit(200);

    // ========== 7. HISTORIAL DE MANTENIMIENTOS ==========
    const mantenimientos = await db('mantenimientos as m')
      .select(
        'm.*',
        db.raw(`
          COALESCE(
            jsonb_build_object(
              'pagado_fondo_mantenimiento', d.pagado_fondo_mantenimiento,
              'pagado_poliza', d.pagado_poliza,
              'pagado_empresa', d.pagado_empresa,
              'pagado_conductor', d.pagado_conductor
            ),
            jsonb_build_object(
              'pagado_fondo_mantenimiento', 0,
              'pagado_poliza', 0,
              'pagado_empresa', 0,
              'pagado_conductor', 0
            )
          ) as distribucion
        `)
      )
      .leftJoin('distribucion_gastos_mantenimiento as d', 'm.id', 'd.mantenimiento_id')
      .where('m.vehiculo_id', vehiculo_id)
      .orderBy([
        { column: 'fecha_realizada', order: 'desc', nulls: 'last' },
        { column: 'fecha_programada', order: 'desc' }
      ]);

    // ========== 8. HISTORIAL DE SINIESTROS ==========
    const siniestros = await db('siniestros as s')
      .select(
        's.*',
        'c.nombre_conductor'
      )
      .leftJoin('conductores as c', 's.conductor_id', 'c.id')
      .where('s.vehiculo_id', vehiculo_id)
      .orderBy('s.fecha_incidente', 'desc');

    // ========== 9. AMONESTACIONES (de todas las asignaciones) ==========
    const amonestaciones = await db('amonestaciones as am')
      .select(
        'am.*',
        'c.nombre_conductor',
        'a.fecha_inicio as asignacion_fecha'
      )
      .join('asignaciones as a', 'am.asignacion_id', 'a.id')
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .where('a.vehiculo_id', vehiculo_id)
      .orderBy('am.fecha', 'desc');

    // ========== 10. REVISIONES DEL VEHÍCULO ==========
    const revisiones = await db('revisiones as r')
      .select(
        'r.*',
        'c.nombre_conductor',
        'a.fecha_inicio as asignacion_fecha'
      )
      .join('asignaciones as a', 'r.asignacion_id', 'a.id')
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .where('a.vehiculo_id', vehiculo_id)
      .orderBy('r.fecha_programada', 'desc');

    // ========== 11. AUDITORÍA DE CAMBIOS ==========
    const auditoria = await db('auditoria_vehiculos')
      .select('*')
      .where('vehiculo_id', vehiculo_id)
      .orderBy('fecha_modificacion', 'desc')
      .limit(50); // Últimos 50 cambios

    // ========== 12. ESTADÍSTICAS CALCULADAS ==========
    
    // Financiero - Ingresos
    const totalRecaudado = pagos.reduce((sum, p) => sum + parseFloat(p.monto_total || 0), 0);
    const totalRecaudadoRenta = pagos.reduce((sum, p) => sum + parseFloat(p.monto_renta_pagado || 0), 0);
    const totalRecaudadoPoliza = pagos.reduce((sum, p) => sum + parseFloat(p.monto_poliza_pagado || 0), 0);

    // Financiero - Egresos
    const totalMantenimientos = mantenimientos.reduce((sum, m) => sum + parseFloat(m.costo_total || 0), 0);
    const totalPagadoInversionista = pagosInversionista.reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0);
    const costoAdquisicion = inversion ? parseFloat(inversion.inversion || 0) : 0;

    // Rentabilidad
    const rentabilidadNeta = totalRecaudado - totalMantenimientos - totalPagadoInversionista;
    const roiPorcentaje = costoAdquisicion > 0 ? ((rentabilidadNeta / costoAdquisicion) * 100) : 0;

    // Operacional
    const totalConductores = new Set(asignaciones.map(a => a.conductor_id)).size;
    const asignacionActiva = asignaciones.find(a => a.activa);
    const primeraAsignacion = asignaciones[asignaciones.length - 1];
    const diasOperando = primeraAsignacion 
      ? Math.floor((new Date() - new Date(primeraAsignacion.fecha_inicio)) / (1000 * 60 * 60 * 24))
      : 0;

    // Promedios
    const promedioRentaDiaria = asignacionActiva ? parseFloat(asignacionActiva.renta_diaria || 0) : 0;
    const promedioIngresoMensual = diasOperando > 0 ? (totalRecaudado / (diasOperando / 30)) : 0;

    // Disciplina
    const totalAmonestaciones = amonestaciones.length;
    const totalRevisiones = revisiones.length;
    const revisionesAprobadas = revisiones.filter(r => r.aprobada).length;

    // ========== RESPUESTA FINAL ==========
    res.json({
      success: true,
      
      // DATOS BÁSICOS
      vehiculo,
      
      // FINANZAS
      inversion,
      pagos_inversionista: pagosInversionista,
      
      // SEGURO Y DOCUMENTOS
      poliza,
      
      // OPERACIÓN
      asignaciones,
      asignacion_actual: asignacionActiva || null,
      pagos,
      
      // MANTENIMIENTO Y SINIESTROS
      mantenimientos,
      siniestros,
      
      // DISCIPLINA Y CALIDAD
      amonestaciones,
      revisiones,
      
      // AUDITORÍA
      auditoria,
      
      // ESTADÍSTICAS CONSOLIDADAS
      estadisticas: {
        // === FINANCIERO ===
        costo_adquisicion: costoAdquisicion,
        total_recaudado: totalRecaudado,
        total_recaudado_renta: totalRecaudadoRenta,
        total_recaudado_poliza: totalRecaudadoPoliza,
        total_mantenimientos: totalMantenimientos,
        total_pagado_inversionista: totalPagadoInversionista,
        rentabilidad_neta: rentabilidadNeta,
        roi_porcentaje: roiPorcentaje,
        
        // === INVERSIÓN ===
        inversion_activa: inversion?.status_inversion === 'Activa',
        modelo_negocio: inversion?.modelo_negocio || 'N/A',
        tasa_rendimiento: inversion?.tasa_rendimiento || 0,
        meses_inversionista_pagados: pagosInversionista.filter(p => p.status === 'Pagado').length,
        meses_inversionista_pendientes: pagosInversionista.filter(p => p.status === 'Pendiente').length,
        
        // === OPERACIONAL ===
        total_conductores: totalConductores,
        dias_operando: diasOperando,
        total_siniestros: siniestros.length,
        total_amonestaciones: totalAmonestaciones,
        total_revisiones: totalRevisiones,
        revisiones_aprobadas: revisionesAprobadas,
        
        // === PROMEDIOS ===
        promedio_renta_diaria: promedioRentaDiaria,
        promedio_ingreso_mensual: promedioIngresoMensual,
        promedio_abono_poliza: asignacionActiva ? parseFloat(asignacionActiva.abono_poliza_mantenimiento || 0) : 0,
        
        // === ESTADO ACTUAL ===
        conductor_actual: asignacionActiva ? asignacionActiva.nombre_conductor : 'Sin asignar',
        dias_con_conductor_actual: asignacionActiva ? asignacionActiva.dias_con_vehiculo : 0,
        ultimo_pago: pagos[0] ? pagos[0].fecha_pago : null,
        ultimo_mantenimiento: mantenimientos[0] ? mantenimientos[0].fecha_realizada : null
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
// OBTENER HISTORIAL COMPLETO POR NÚMERO DE SERIE (NUEVO)
// ============================================
exports.getHistorialVehiculoPorSerie = async (req, res) => {
  try {
    const { numero_serie } = req.params;

    // ========== 1. BUSCAR VEHÍCULO POR NÚMERO DE SERIE ==========
    const vehiculo = await db('vehiculos')
      .where('numero_de_serie_vehiculo', numero_serie)
      .first();

    if (!vehiculo) {
      return res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado'
      });
    }

    const vehiculo_id = vehiculo.id;

    // ========== 2. DATOS DE INVERSIÓN ==========
    const inversion = await db('inversiones_vehiculos as iv')
      .select(
        'iv.*',
        'inv.nombre as inversionista_nombre',
        'inv.email as inversionista_email',
        'inv.telefono as inversionista_telefono',
        'inv.whatsapp as inversionista_whatsapp'
      )
      .leftJoin('inversionistas as inv', 'iv.inversionista_id', 'inv.id')
      .where('iv.numero_de_serie_vehiculo', numero_serie)
      .first();

    // ========== 3. PAGOS A INVERSIONISTAS ==========
    const pagosInversionista = inversion ? await db('pagos_inversionistas')
      .select('*')
      .where('inversion_id', inversion.id_inversion)
      .orderBy('fecha_programada', 'asc') : [];

    // ========== 4. PÓLIZA DE SEGURO ==========
    const poliza = vehiculo.poliza_seguro_id ? await db('polizas_seguro')
      .where('id', vehiculo.poliza_seguro_id)
      .first() : null;

    // ========== 5. HISTORIAL DE ASIGNACIONES ==========
    const asignaciones = await db('asignaciones as a')
      .select(
        'a.*',
        'c.nombre_conductor',
        'c.numero_telefono',
        'c.email as conductor_email',
        db.raw(`
          CASE 
            WHEN a.fecha_fin IS NULL THEN (CURRENT_DATE - a.fecha_inicio::date)
            ELSE (a.fecha_fin::date - a.fecha_inicio::date)
          END as dias_con_vehiculo
        `)
      )
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .where('a.vehiculo_id', vehiculo_id)
      .orderBy('a.fecha_inicio', 'desc');

    // ========== 6. HISTORIAL DE PAGOS DIARIOS ==========
    const pagos = await db('pagos_diarios as pd')
      .select(
        'pd.*',
        'c.nombre_conductor',
        'a.renta_diaria',
        'a.fecha_inicio as asignacion_inicio'
      )
      .join('asignaciones as a', 'pd.asignacion_id', 'a.id')
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .where('a.vehiculo_id', vehiculo_id)
      .orderBy('pd.fecha_pago', 'desc')
      .limit(200);

    // ========== 7. HISTORIAL DE MANTENIMIENTOS ==========
    const mantenimientos = await db('mantenimientos as m')
      .select(
        'm.*',
        db.raw(`
          COALESCE(
            jsonb_build_object(
              'pagado_fondo_mantenimiento', d.pagado_fondo_mantenimiento,
              'pagado_poliza', d.pagado_poliza,
              'pagado_empresa', d.pagado_empresa,
              'pagado_conductor', d.pagado_conductor
            ),
            jsonb_build_object(
              'pagado_fondo_mantenimiento', 0,
              'pagado_poliza', 0,
              'pagado_empresa', 0,
              'pagado_conductor', 0
            )
          ) as distribucion
        `)
      )
      .leftJoin('distribucion_gastos_mantenimiento as d', 'm.id', 'd.mantenimiento_id')
      .where('m.vehiculo_id', vehiculo_id)
      .orderBy([
        { column: 'fecha_realizada', order: 'desc', nulls: 'last' },
        { column: 'fecha_programada', order: 'desc' }
      ]);

    // ========== 8. HISTORIAL DE SINIESTROS ==========
    const siniestros = await db('siniestros as s')
      .select(
        's.*',
        'c.nombre_conductor'
      )
      .leftJoin('conductores as c', 's.conductor_id', 'c.id')
      .where('s.vehiculo_id', vehiculo_id)
      .orderBy('s.fecha_incidente', 'desc');

    // ========== 9. AMONESTACIONES ==========
    const amonestaciones = await db('amonestaciones as am')
      .select(
        'am.*',
        'c.nombre_conductor',
        'a.fecha_inicio as asignacion_fecha'
      )
      .join('asignaciones as a', 'am.asignacion_id', 'a.id')
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .where('a.vehiculo_id', vehiculo_id)
      .orderBy('am.fecha', 'desc');

    // ========== 10. REVISIONES DEL VEHÍCULO ==========
    const revisiones = await db('revisiones as r')
      .select(
        'r.*',
        'c.nombre_conductor',
        'a.fecha_inicio as asignacion_fecha'
      )
      .join('asignaciones as a', 'r.asignacion_id', 'a.id')
      .join('conductores as c', 'a.conductor_id', 'c.id')
      .where('a.vehiculo_id', vehiculo_id)
      .orderBy('r.fecha_programada', 'desc');

    // ========== 11. AUDITORÍA DE CAMBIOS ==========
    const auditoria = await db('auditoria_vehiculos')
      .select('*')
      .where('vehiculo_id', vehiculo_id)
      .orderBy('fecha_modificacion', 'desc')
      .limit(50);

    // ========== 12. ESTADÍSTICAS CALCULADAS ==========
    
    // Financiero - Ingresos
    const totalRecaudado = pagos.reduce((sum, p) => sum + parseFloat(p.monto_total || 0), 0);
    const totalRecaudadoRenta = pagos.reduce((sum, p) => sum + parseFloat(p.monto_renta_pagado || 0), 0);
    const totalRecaudadoPoliza = pagos.reduce((sum, p) => sum + parseFloat(p.monto_poliza_pagado || 0), 0);

    // Financiero - Egresos
    const totalMantenimientos = mantenimientos.reduce((sum, m) => sum + parseFloat(m.costo_total || 0), 0);
    const totalPagadoInversionista = pagosInversionista.reduce((sum, p) => sum + parseFloat(p.monto_pagado || 0), 0);
    const costoAdquisicion = inversion ? parseFloat(inversion.inversion || 0) : 0;

    // Rentabilidad
    const rentabilidadNeta = totalRecaudado - totalMantenimientos - totalPagadoInversionista;
    const roiPorcentaje = costoAdquisicion > 0 ? ((rentabilidadNeta / costoAdquisicion) * 100) : 0;

    // Operacional
    const totalConductores = new Set(asignaciones.map(a => a.conductor_id)).size;
    const asignacionActiva = asignaciones.find(a => a.activa);
    const primeraAsignacion = asignaciones[asignaciones.length - 1];
    const diasOperando = primeraAsignacion 
      ? Math.floor((new Date() - new Date(primeraAsignacion.fecha_inicio)) / (1000 * 60 * 60 * 24))
      : 0;

    // Promedios
    const promedioRentaDiaria = asignacionActiva ? parseFloat(asignacionActiva.renta_diaria || 0) : 0;
    const promedioIngresoMensual = diasOperando > 0 ? (totalRecaudado / (diasOperando / 30)) : 0;

    // Disciplina
    const totalAmonestaciones = amonestaciones.length;
    const totalRevisiones = revisiones.length;
    const revisionesAprobadas = revisiones.filter(r => r.aprobada).length;

    // ========== RESPUESTA FINAL ==========
    res.json({
      success: true,
      
      // DATOS BÁSICOS
      vehiculo,
      
      // FINANZAS
      inversion,
      pagos_inversionista: pagosInversionista,
      
      // SEGURO Y DOCUMENTOS
      poliza,
      
      // OPERACIÓN
      asignaciones,
      asignacion_actual: asignacionActiva || null,
      pagos,
      
      // MANTENIMIENTO Y SINIESTROS
      mantenimientos,
      siniestros,
      
      // DISCIPLINA Y CALIDAD
      amonestaciones,
      revisiones,
      
      // AUDITORÍA
      auditoria,
      
      // ESTADÍSTICAS CONSOLIDADAS
      estadisticas: {
        // === FINANCIERO ===
        costo_adquisicion: costoAdquisicion,
        total_recaudado: totalRecaudado,
        total_recaudado_renta: totalRecaudadoRenta,
        total_recaudado_poliza: totalRecaudadoPoliza,
        total_mantenimientos: totalMantenimientos,
        total_pagado_inversionista: totalPagadoInversionista,
        rentabilidad_neta: rentabilidadNeta,
        roi_porcentaje: roiPorcentaje,
        
        // === INVERSIÓN ===
        inversion_activa: inversion?.status_inversion === 'Activa',
        modelo_negocio: inversion?.modelo_negocio || 'N/A',
        tasa_rendimiento: inversion?.tasa_rendimiento || 0,
        meses_inversionista_pagados: pagosInversionista.filter(p => p.status === 'Pagado').length,
        meses_inversionista_pendientes: pagosInversionista.filter(p => p.status === 'Pendiente').length,
        
        // === OPERACIONAL ===
        total_conductores: totalConductores,
        dias_operando: diasOperando,
        total_siniestros: siniestros.length,
        total_amonestaciones: totalAmonestaciones,
        total_revisiones: totalRevisiones,
        revisiones_aprobadas: revisionesAprobadas,
        
        // === PROMEDIOS ===
        promedio_renta_diaria: promedioRentaDiaria,
        promedio_ingreso_mensual: promedioIngresoMensual,
        promedio_abono_poliza: asignacionActiva ? parseFloat(asignacionActiva.abono_poliza_mantenimiento || 0) : 0,
        
        // === ESTADO ACTUAL ===
        conductor_actual: asignacionActiva ? asignacionActiva.nombre_conductor : 'Sin asignar',
        dias_con_conductor_actual: asignacionActiva ? asignacionActiva.dias_con_vehiculo : 0,
        ultimo_pago: pagos[0] ? pagos[0].fecha_pago : null,
        ultimo_mantenimiento: mantenimientos[0] ? mantenimientos[0].fecha_realizada : null
      }
    });

  } catch (error) {
    console.error('Error en getHistorialVehiculoPorSerie:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
    });
  }
};
