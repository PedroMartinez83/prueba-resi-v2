exports.up = function(knex) {
  return knex.schema.table('mantenimientos', function(table) {
    table.string('estado_vehiculo_previo', 50);
  });
};

exports.down = function(knex) {
  return knex.schema.table('mantenimientos', function(table) {
    table.dropColumn('estado_vehiculo_previo');
  });
};