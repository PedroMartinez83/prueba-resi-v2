const { db } = require('../../config/database');

// =================================================================
// 🧠 CEREBRO DE AURORA: PROCESADOR CENTRAL DE COMANDOS
// =================================================================

exports.procesarComando = async (req, res) => {
  try {
    const { comando, parametros } = req.body;
    const usuario = req.user; // Usuario autenticado (Admin)
    const terminoBusqueda = parametros?.query ? parametros.query.trim() : '';

    console.log(`🤖 Aurora Procesando: [${comando}] | Query: "${terminoBusqueda}" | User: ${usuario.email}`);

    // --- 1. SISTEMA DE PERMISOS (Seguridad) ---
    // Solo Super Admin puede ver dinero sensible o borrar cosas
    const esSuperAdmin = usuario.rol === 'super_admin';

    let respuesta = {
      tipo: 'texto',
      data: 'No entendí tu solicitud. Intenta ser más específico.'
    };

    // --- 2. SWITCH DE INTELIGENCIA ---
    switch (comando) {
      
      // ➤ CASO 1: BÚSQUEDA UNIVERSAL (El "Google" del sistema)
      case 'buscar_universal':
      case 'buscar_conductor': // Alias para compatibilidad
        respuesta = await motorDeBusquedaInteligente(terminoBusqueda);
        break;

      // ➤ CASO 2: REPORTE FINANCIERO RÁPIDO (Dos Cubetas)
      case 'ver_balance_global':
        if (!esSuperAdmin) {
          respuesta = { tipo: 'error', data: '⛔ Acceso denegado. Solo Super Admin puede ver balances globales.' };
          break;
        }
        respuesta = await obtenerBalanceGlobal();
        break;

      // ➤ CASO 3: ESTADO DE LA FLOTA (Operaciones)
      case 'estado_flota':
        respuesta = await obtenerEstadoOperativo();
        break;

      // ➤ CASO 4: LIMPIEZA AUTOMÁTICA (Mantenimiento de BD)
      case 'limpiar_solicitudes':
        if (!esSuperAdmin) {
          respuesta = { tipo: 'error', data: '⛔ Solo Super Admin puede ejecutar limpiezas.' };
          break;
        }
        respuesta = await ejecutarLimpieza(parametros.dias || 30);
        break;

      default:
        respuesta = { 
          tipo: 'texto', 
          data: `Lo siento, no reconozco el comando "${comando}". Mis capacidades actuales son: Buscar, Finanzas, Estado de Flota y Limpieza.` 
        };
    }

    res.json({
      success: true,
      aurora: respuesta
    });

  } catch (error) {
    console.error('🔥 Error Crítico en Aurora:', error);
    res.status(500).json({ 
      success: false, 
      mensaje: "Tuve un cortocircuito interno. Por favor revisa mis logs.",
      error_tecnico: error.message 
    });
  }
};

// =================================================================
// 🕵️‍♀️ MOTOR DE BÚSQUEDA INTELIGENTE (Anti-Errores Humanos)
// =================================================================
// Busca en Conductores, Vehículos, y Siniestros simultáneamente.
async function motorDeBusquedaInteligente(termino) {
  if (!termino || termino.length < 2) {
    return { tipo: 'texto', data: 'Por favor escribe al menos 2 letras para buscar.' };
  }

  const term = `%${termino}%`; // Comodines para SQL

  // 1. Buscar en CONDUCTORES (Nombre, Teléfono, Email)
  const conductor = await db('conductores as c')
    .leftJoin('asignaciones as a', function() {
      this.on('c.id', '=', 'a.conductor_id').andOn('a.activa', '=', db.raw('true'));
    })
    .leftJoin('vehiculos as v', 'a.vehiculo_id', 'v.id')
    .where('c.nombre_conductor', 'ilike', term)
    .orWhere('c.numero_telefono', 'ilike', term)
    .orWhere('c.email', 'ilike', term)
    .select(
      'c.id', 'c.nombre_conductor', 'c.numero_telefono', 'c.status', 'c.categoria',
      'v.poliza_mecanica as saldo_poliza_mecanica', 'v.numero_vehiculo', 'v.marca', 'v.modelo'
    )
    .first();

  if (conductor) {
    return {
      tipo: 'tarjeta_conductor',
      data: {
        id: conductor.id,
        nombre: conductor.nombre_conductor,
        telefono: conductor.numero_telefono,
        status: conductor.status,
        categoria: conductor.categoria || 'Sin categoría',
        vehiculo_asignado: conductor.numero_vehiculo ? `${conductor.numero_vehiculo} (${conductor.marca} ${conductor.modelo})` : 'Sin auto',
        saldo_poliza: parseFloat(conductor.saldo_poliza_mecanica || 0),
        hallazgo: 'Encontrado en base de datos de conductores'
      }
    };
  }

  // 2. Buscar en VEHÍCULOS (Placa, Número Económico, VIN, Marca)
  const vehiculo = await db('vehiculos as v')
    .leftJoin('asignaciones as a', function() {
      this.on('v.id', '=', 'a.vehiculo_id').andOn('a.activa', '=', db.raw('true'));
    })
    .leftJoin('conductores as c', 'a.conductor_id', 'c.id')
    .where('v.numero_vehiculo', 'ilike', term)
    .orWhere('v.placa', 'ilike', term)
    .orWhere('v.numero_de_serie_vehiculo', 'ilike', term)
    .orWhere(db.raw("CONCAT(v.marca, ' ', v.modelo) ILIKE ?", [term])) // Búsqueda compuesta "Nissan Versa"
    .select(
      'v.id', 'v.numero_vehiculo', 'v.marca', 'v.modelo', 'v.placa', 'v.estado',
      'c.nombre_conductor', 'c.id as conductor_id'
    )
    .first();

  if (vehiculo) {
    return {
      tipo: 'tarjeta_vehiculo', // Necesitarás renderizar esto en el frontend
      data: {
        id: vehiculo.id,
        titulo: `${vehiculo.marca} ${vehiculo.modelo}`,
        subtitulo: `Económico: ${vehiculo.numero_vehiculo} | Placa: ${vehiculo.placa}`,
        estado: vehiculo.estado,
        conductor_actual: vehiculo.nombre_conductor || 'Sin conductor asignado',
        conductor_id: vehiculo.conductor_id,
        hallazgo: 'Encontrado en inventario de vehículos'
      }
    };
  }

  // 3. Buscar en SINIESTROS (Folio)
  // Si el usuario escribe un número, intentamos ver si es un folio de siniestro
  if (!isNaN(termino)) {
    const siniestro = await db('siniestros')
      .where('folio_siniestro', parseInt(termino))
      .first();
    
    if (siniestro) {
      return {
        tipo: 'texto',
        data: `🚨 Encontré el Siniestro #${siniestro.folio_siniestro}. Estado: ${siniestro.estado}. Gravedad: ${siniestro.gravedad}. ¿Quieres ver los detalles?`,
        link: `/admin/siniestros/lista?search=${siniestro.folio_siniestro}`
      };
    }
  }

  return { 
    tipo: 'texto', 
    data: `Busqué "${termino}" en conductores, vehículos, placas y siniestros, pero no encontré nada. Intenta verificar la ortografía.` 
  };
}

// =================================================================
// 💰 ANÁLISIS FINANCIERO ("Dos Cubetas")
// =================================================================
async function obtenerBalanceGlobal() {
  // Resumen del mes actual
  const [finanzas] = await db('pagos_diarios')
    .where('status', 'Confirmado')
    .whereRaw("DATE_TRUNC('month', fecha_pago) = DATE_TRUNC('month', CURRENT_DATE)")
    .select(
      db.raw("COALESCE(SUM(monto_renta_pagado), 0) as empresa"),
      db.raw("COALESCE(SUM(monto_poliza_pagado), 0) as conductores")
    );
  
  // Morosidad
  const [deudores] = await db('conductores as c')
    .join('asignaciones as a', 'c.id', 'a.conductor_id')
    .where('a.activa', true)
    .whereNotExists(function() {
      this.select('*').from('pagos_diarios as p')
        .whereRaw('p.asignacion_id = a.id')
        .andWhereRaw("p.fecha_pago >= CURRENT_DATE - INTERVAL '2 days'");
    })
    .count('c.id as total');

  return {
    tipo: 'tarjeta_financiera',
    data: {
      cobrado_mes: parseFloat(finanzas?.empresa || 0),
      total_ahorrado_poliza: parseFloat(finanzas?.conductores || 0),
      proyeccion_mes: parseFloat(finanzas?.empresa || 0) * 1.2, // Estimado simple
      conductores_morosos: parseInt(deudores?.total || 0)
    }
  };
}

// =================================================================
// 🔧 ESTADO OPERATIVO (Mantenimiento y Siniestros)
// =================================================================
async function obtenerEstadoOperativo() {
  const [enTaller] = await db('mantenimientos').where('estado', 'En proceso').count('id as total');
  const [siniestrosActivos] = await db('siniestros').whereIn('estado', ['Reportado', 'En proceso']).count('id as total');
  const [solicitudesPendientes] = await db('solicitudes_conductor').where('estatus_solicitud', 'Pendiente').count('id as total');

  return {
    tipo: 'texto',
    data: `📊 **Estado de la Flota en Tiempo Real:**
    
    🛠️ **Taller:** ${enTaller.total} vehículos en reparación.
    🚨 **Siniestros:** ${siniestrosActivos.total} casos activos sin resolver.
    📝 **RH:** ${solicitudesPendientes.total} solicitudes de conductores esperando tu aprobación.
    
    ¿Quieres que te lleve a alguno de estos módulos?`
  };
}

// =================================================================
// 🧹 LIMPIEZA INTELIGENTE
// =================================================================
async function ejecutarLimpieza(dias) {
  const resultado = await db('solicitudes_conductor')
    .where('estatus_solicitud', 'Rechazado')
    .andWhereRaw(`updated_at < NOW() - INTERVAL '${dias} days'`)
    .delete();
  
  return { 
    tipo: 'texto', 
    data: `✅ Limpieza completada con éxito. Se eliminaron permanentemente ${resultado} solicitudes rechazadas con más de ${dias} días de antigüedad.` 
  };
}
