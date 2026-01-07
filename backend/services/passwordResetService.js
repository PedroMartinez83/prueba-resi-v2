const { db } = require('../config/database');

const TABLE_NAME = 'password_reset_codes';

const ensureTable = async () => {
  const exists = await db.schema.hasTable(TABLE_NAME);
  if (!exists) {
    await db.schema.createTable(TABLE_NAME, (table) => {
      table.increments('id').primary();
      table.integer('usuario_id').references('id').inTable('usuarios').onDelete('CASCADE');
      table.string('email').notNullable();
      table.string('code').notNullable();
      table.timestamp('expires_at').notNullable();
      table.boolean('used').defaultTo(false);
      table.timestamps(true, true);
    });
  }
};

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const createResetCode = async ({ usuarioId, email, expiresInMinutes = 15 }) => {
  await ensureTable();

  const code = generateCode();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const [record] = await db(TABLE_NAME)
    .insert({
      usuario_id: usuarioId,
      email: email.toLowerCase(),
      code,
      expires_at: expiresAt,
      used: false
    })
    .returning('*');

  return record;
};

const findValidCode = async ({ email, code }) => {
  await ensureTable();

  const now = new Date();
  return db(TABLE_NAME)
    .where({ email: email.toLowerCase(), code, used: false })
    .andWhere('expires_at', '>', now)
    .orderBy('created_at', 'desc')
    .first();
};

const markCodeUsed = async (id) => {
  await ensureTable();
  return db(TABLE_NAME).where({ id }).update({ used: true, updated_at: new Date() });
};

module.exports = {
  createResetCode,
  findValidCode,
  markCodeUsed
};