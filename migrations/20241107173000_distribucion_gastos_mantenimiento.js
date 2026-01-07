/**
 * Migración: Sistema de Distribución de Gastos de Mantenimiento
 * Fecha: 7 Nov 2024
 * 
 * Propósito:
 * - Crear tabla para registrar cómo se distribuyen los gastos de mantenimiento
 * - Agregar campo en vehículos para rastrear costo total de mantenimientos
 * 
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 1. Crear tabla de distribución de gastos
    .createTable('distribucion_gastos_mantenimiento', function(table) {
      table.increments('id').primary();
      
      // Relación con mantenimiento
      table.integer('mantenimiento_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('mantenimientos')
        .onDelete('CASCADE');
      
      // Costo total (debe coincidir con mantenimientos.costo_total)
      table.decimal('costo_total', 12, 2).notNullable();
      
      // ============================================
      // Distribución del gasto
      // ============================================
      table.decimal('pagado_fondo_mantenimiento', 12, 2).defaultTo(0).notNullable();
      table.decimal('pagado_poliza', 12, 2).defaultTo(0).notNullable();
      table.decimal('pagado_empresa', 12, 2).defaultTo(0).notNullable();
      table.decimal('pagado_conductor', 12, 2).defaultTo(0).notNullable();
      
      // ============================================
      // Control y auditoría
      // ============================================
      table.integer('distribuido_por')
        .unsigned()
        .references('id')
        .inTable('usuarios')
        .onDelete('SET NULL');
      
      table.timestamp('fecha_distribucion').defaultTo(knex.fn.now());
      table.text('observaciones');
      table.string('estado', 20).defaultTo('pendiente').notNullable(); // 'pendiente', 'distribuido'
      
      // Timestamps automáticos
      table.timestamps(true, true);
      
      // ============================================
      // Índices para optimizar consultas
      // ============================================
      table.index('mantenimiento_id');
      table.index('estado');
      table.index('fecha_distribucion');
    })
    
    // 2. Agregar campo a vehículos
    .table('vehiculos', function(table) {
      table.decimal('costo_total_mantenimientos', 12, 2).defaultTo(0).notNullable();
      table.index('costo_total_mantenimientos');
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    // Eliminar en orden inverso
    .table('vehiculos', function(table) {
      table.dropIndex('costo_total_mantenimientos');
      table.dropColumn('costo_total_mantenimientos');
    })
    .dropTableIfExists('distribucion_gastos_mantenimiento');
};