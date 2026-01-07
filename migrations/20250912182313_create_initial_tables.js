/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // ============================================
    // NIVEL 0: Tablas sin dependencias
    // ============================================
    
    .createTable('clientes', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.string('nombre_completo'); // QUITADO notNullable porque hay registros sin nombre
      table.string('telefono').unique();
      table.string('email').unique();
      table.string('url_ine_frente');
      table.string('url_ine_reverso');
      table.string('url_selfie');
      table.timestamp('fecha_registro');
      table.string('estado_cuenta').defaultTo('verificacion_pendiente');
      table.string('tipo_usuario').defaultTo('Pasajero');
      table.string('contacto_emergencia_nombre');
      table.string('contacto_emergencia_telefono');
      table.decimal('calificacion_promedio_pasajero', 3, 2).defaultTo(0);
      table.integer('total_viajes_como_pasajero').defaultTo(0);
      table.decimal('gasto_total_lifetime', 10, 2).defaultTo(0);
      table.string('whatsapp_number');
      table.string('userid_pasajero');
      table.string('colonia');
      table.string('uso_otras_plataformas'); // "uso de otras plataformas a la semana" en Airtable
      table.string('gasto_semanal');
      table.text('mejoras');
      table.timestamps(true, true);
    })
    
    .createTable('usuarios', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.string('name').notNullable();
      table.string('password').notNullable();
      table.string('rol').notNullable().defaultTo('conductor');
      table.string('estado').defaultTo('Activo');
      table.string('nombre_completo');
      table.timestamp('fecha_registro');
      // numero_vehiculo se manejará como relación, no como campo
      table.timestamps(true, true);
    })
    
    // ============================================
    // NIVEL 1: Tablas que dependen del Nivel 0
    // ============================================
    
    .createTable('conductores', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.string('nombre_conductor').notNullable();
      table.text('numero_telefono'); // Texto largo en Airtable
      table.string('email');
      table.string('matricula');
      table.string('status').defaultTo('Pendiente');
      table.string('ubicacion_actual');
      table.decimal('calificacion_promedio', 3, 2).defaultTo(0);
      table.timestamp('ultima_conexion');
      table.timestamp('licencia_vencimiento');
      table.timestamp('seguro_vehiculo_vencimiento');
      table.string('verificacion_antecedentes').defaultTo('pendiente');
      table.decimal('saldo_ganancias', 10, 2).defaultTo(0);
      table.decimal('tasa_aceptacion', 5, 2).defaultTo(0);
      table.decimal('tasa_cancelacion', 5, 2).defaultTo(0);
      table.decimal('tasa_completacion', 5, 2).defaultTo(0);
      table.string('tipo_vehiculo'); // economico, comfort, premium, SUV, van, eléctrico
      table.integer('max_pasajeros').defaultTo(4);
      table.string('chat_id_telegram').unique();
      table.string('username_telegram');
      table.string('metodo_registro').defaultTo('Manual');
      table.timestamp('fecha_registro');
      table.string('status_trabajo').defaultTo('desconectado');
      table.timestamp('ultima_activacion');
      table.integer('total_activaciones_hoy').defaultTo(0);
      table.string('registrado_por');
      table.boolean('bot_configurado').defaultTo(false);
      table.timestamp('primer_mensaje_bot');
      table.string('foto_frente_licencia_url');
      table.string('foto_reverso_licencia_url');
      table.timestamp('fecha_foto_frente');
      table.timestamp('fecha_foto_reverso');
      table.string('tipo_socio'); // SD, SI, SA
      table.string('rfc');
      table.text('direccion_completa');
      table.string('contacto_emergencia');
      table.string('categoria'); // Oro, Platino, Diamante
      table.string('numero_de_ine_ife');
      table.string('licencia_conducir');
      table.timestamp('licencia_vigencia');
      table.timestamp('fecha_ingreso');
      table.timestamp('fecha_categorizacion');
      table.text('observaciones');
      // Historial de viajes se manejará con relaciones
      // INE y foto_frente_licencia son archivos, URLs almacenadas arriba
      
      // Vinculación
      table.integer('usuario_id').unsigned().references('id').inTable('usuarios').onDelete('SET NULL');
      table.timestamps(true, true);
    })
    
    .createTable('vehiculos', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.string('numero_vehiculo').unique();
      table.string('tipo_socio'); // SD, SI, SA
      table.integer('numero_unidad');
      table.string('status').defaultTo('Activo');
      table.string('marca');
      table.string('modelo');
      table.string('tipo_vehiculo');
      table.string('tipo_combustible');
      table.integer('año');
      table.string('placa').unique();
      table.string('color');
      table.string('numero_serie').unique();
      table.string('estado').defaultTo('Disponible');
      table.integer('kilometraje_actual').defaultTo(0);
      table.integer('proximo_mantenimiento');
      table.integer('intervalo_mantenimiento').defaultTo(10000);
      table.timestamp('fecha_ultimo_servicio');
      table.string('poliza_seguro');
      table.timestamp('poliza_vencimiento');
      table.decimal('monto_deducible', 10, 2).defaultTo(0);
      table.text('observaciones');
      
      // Vinculación
      table.integer('conductor_asignado_id').unsigned().references('id').inTable('conductores').onDelete('SET NULL');
      table.timestamps(true, true);
    })

    // ============================================
    // NIVEL 2: Tablas de Eventos y Transacciones
    // ============================================
    
    .createTable('viajes', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.string('id_viaje').unique();
      table.string('status_viaje').defaultTo('Buscando conductor');
      table.decimal('costo_del_viaje', 10, 2);
      table.text('direccion_origen');
      table.text('direccion_destino');
      table.string('link_origen');
      table.string('link_destino');
      table.decimal('lat_origen', 10, 6);
      table.decimal('lon_origen', 10, 6);
      table.decimal('lat_destino', 10, 6);
      table.decimal('lon_destino', 10, 6);
      table.decimal('distancia_km', 8, 2);
      table.timestamp('timestamp_solicitud');
      table.timestamp('timestamp_conductor_asignado');
      table.string('hora_inicio_viaje'); // Texto en Airtable
      table.string('hora_finalizacion'); // "Hora de finalización" en Airtable
      table.string('fecha_registro'); // Texto en Airtable
      table.string('hora_registro'); // Texto en Airtable
      table.text('ruta_tiempo_real');
      table.string('ubicacion_pasajero');
      table.text('historial_estado_viajes');
      table.string('conductor_nombre');
      table.string('conductor_telefono');
      table.string('conductor_vehiculo');
      table.integer('conductores_notificados').defaultTo(0);
      table.string('lock_key');
      table.string('numero_whatsapp'); // "numero whatsapp" en Airtable
      table.string('idconversacionwhats');
      table.string('userid_pasajero'); // "userId pasajero" en Airtable
      // Campos adicionales de Airtable
      table.string('nombre'); // del pasajero
      table.string('numero'); // del pasajero
      table.string('numero_telefono'); // del pasajero
      table.string('conductor_asignado'); // texto
      table.string('matricula');
      table.string('conductores'); // texto
      table.string('mensaje'); // referencia a Mensaje
      
      // Vinculaciones
      table.integer('pasajero_id').unsigned().references('id').inTable('clientes').onDelete('CASCADE');
      table.integer('conductor_asignado_id').unsigned().references('id').inTable('conductores').onDelete('SET NULL');
      table.timestamps(true, true);
    })

    // ============================================
    // NIVEL 3: Tablas que dependen de las anteriores
    // ============================================
    
    .createTable('calificaciones', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.integer('rating_id'); // Autonumeración en Airtable
      table.string('tipo_calificacion').notNullable();
      table.integer('estrellas').notNullable();
      table.text('comentario');
      table.timestamp('fecha_creacion');
      
      // Vinculaciones
      table.integer('viaje_id').unsigned().references('id').inTable('viajes').onDelete('CASCADE');
      table.integer('cliente_id').unsigned().references('id').inTable('clientes').onDelete('CASCADE');
      table.integer('conductor_id').unsigned().references('id').inTable('conductores').onDelete('CASCADE');
      table.timestamps(true, true);
    })
    
    .createTable('registros_financieros', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.integer('transaccion_id'); // Autonumeración en Airtable
      table.string('tipo_transaccion').notNullable();
      table.decimal('monto', 10, 2).notNullable();
      table.decimal('comision_plataforma', 10, 2);
      table.decimal('ganancia_conductor', 10, 2);
      table.string('estado').defaultTo('completado');
      table.timestamp('fecha_creacion');
      
      // Vinculaciones
      table.integer('viaje_id').unsigned().references('id').inTable('viajes').onDelete('SET NULL');
      table.integer('usuario_id').unsigned().references('id').inTable('clientes').onDelete('SET NULL');
      table.integer('conductor_id').unsigned().references('id').inTable('conductores').onDelete('SET NULL');
      table.timestamps(true, true);
    })
    
    .createTable('rentas', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.integer('folio_renta'); // Autonumeración en Airtable
      table.decimal('monto_base', 10, 2);
      table.decimal('ajuste_refacciones', 10, 2);
      table.decimal('monto_total', 10, 2);
      table.timestamp('fecha_inicio');
      table.timestamp('fecha_vencimiento');
      table.timestamp('fecha_pago');
      table.string('estado').defaultTo('Pendiente');
      table.string('dias_retraso');
      table.string('metodo_pago');
      table.string('stripe_payment_id');
      table.integer('numero_semana');
      table.string('comprobante_url');
      table.string('tipo_socio'); // Campo de búsqueda en Airtable
      table.text('observaciones');
      
      // Vinculaciones
      table.integer('conductor_id').unsigned().references('id').inTable('conductores').onDelete('CASCADE');
      table.integer('vehiculo_id').unsigned().references('id').inTable('vehiculos').onDelete('CASCADE');
      table.timestamps(true, true);
    })
    
    .createTable('mantenimientos', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.integer('folio_servicio'); // Autonumeración en Airtable
      table.string('tipo_servicio');
      table.string('status'); // Todo, In progress, Done
      table.integer('kilometraje_servicio');
      table.timestamp('fecha_programada');
      table.timestamp('fecha_realizada');
      table.string('estado').defaultTo('Programado');
      table.text('servicios_realizados'); // Selección múltiple en Airtable
      table.text('refacciones');
      table.decimal('costo_mano_obra', 10, 2);
      table.decimal('costo_refacciones', 10, 2);
      table.decimal('costo_total', 10, 2);
      table.string('taller');
      table.string('mecanico');
      table.integer('proximo_servicio_km');
      table.text('observaciones');
      
      // Vinculación
      table.integer('vehiculo_id').unsigned().references('id').inTable('vehiculos').onDelete('CASCADE');
      table.timestamps(true, true);
    })
    
    .createTable('siniestros', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.integer('folio_siniestro'); // Autonumeración en Airtable
      table.timestamp('fecha_incidente');
      table.string('hora_incidente');
      table.text('ubicacion');
      table.string('tipo_siniestro');
      table.text('descripcion');
      table.string('numero_reporte');
      table.string('numero_siniestro');
      table.decimal('monto_deducible', 10, 2);
      table.decimal('costo_estimado', 10, 2);
      table.decimal('costo_final', 10, 2);
      table.string('estado').defaultTo('Reportado');
      table.text('fotos_urls');
      table.string('responsable_pago'); // Conductor, Empresa, Seguro
      table.timestamp('fecha_resolucion');
      table.text('observaciones');
      
      // Vinculaciones
      table.integer('conductor_id').unsigned().references('id').inTable('conductores').onDelete('SET NULL');
      table.integer('vehiculo_id').unsigned().references('id').inTable('vehiculos').onDelete('CASCADE');
      table.timestamps(true, true);
    })
    
    .createTable('rechazos', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.integer('id_rechazo'); // Autonumeración en Airtable
      table.timestamp('timestamp');
      
      // Vinculaciones
      table.integer('conductor_id').unsigned().references('id').inTable('conductores').onDelete('CASCADE');
      table.integer('viaje_id').unsigned().references('id').inTable('viajes').onDelete('CASCADE');
      table.timestamps(true, true);
    })
    
    .createTable('mensajes', function(table) {
      table.increments('id').primary();
      table.string('airtable_id').notNullable().unique();
      table.string('id_mensaje');
      table.string('chat_id');
      table.text('texto');
      table.string('tipo'); // Nuevo Viaje, Asignado, iniciar, Finalizar
      table.timestamp('timestamp');
      
      // Vinculación
      table.integer('viaje_id').unsigned().references('id').inTable('viajes').onDelete('SET NULL');
      table.timestamps(true, true);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Borramos en el orden inverso para no violar las restricciones de claves foráneas
  return knex.schema
    .dropTableIfExists('mensajes')
    .dropTableIfExists('rechazos')
    .dropTableIfExists('siniestros')
    .dropTableIfExists('mantenimientos')
    .dropTableIfExists('rentas')
    .dropTableIfExists('registros_financieros')
    .dropTableIfExists('calificaciones')
    .dropTableIfExists('viajes')
    .dropTableIfExists('vehiculos')
    .dropTableIfExists('conductores')
    .dropTableIfExists('usuarios')
    .dropTableIfExists('clientes');
};