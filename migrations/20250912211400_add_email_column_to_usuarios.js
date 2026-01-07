exports.up = function(knex) {
  return knex.schema.table('usuarios', function(table) {
    // Agregar columna email si no existe
    table.string('email', 255).nullable();
    
    // Agregar índice único para búsquedas rápidas
    table.index('email');
  })
  .then(() => {
    // Copiar datos existentes de 'name' a 'email'
    return knex.raw('UPDATE usuarios SET email = name WHERE email IS NULL');
  })
  .then(() => {
    // Hacer la columna NOT NULL después de poblarla
    return knex.schema.alterTable('usuarios', function(table) {
      table.string('email', 255).notNullable().alter();
    });
  });
};

exports.down = function(knex) {
  return knex.schema.table('usuarios', function(table) {
    table.dropIndex('email');
    table.dropColumn('email');
  });
};