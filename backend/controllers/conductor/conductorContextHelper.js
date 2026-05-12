// backend/controllers/conductor/conductorContextHelper.js
const { db } = require('../../config/database');

const parsePositiveInt = (value) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeEmail = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const resolveConductorContext = async (user = {}) => {
  const tokenUserId = parsePositiveInt(user.id);

  if (tokenUserId) {
    const conductorByUser = await db('conductores')
      .where({ usuario_id: tokenUserId })
      .select('id', 'usuario_id')
      .orderBy('id', 'desc')
      .first();

    const conductorId = parsePositiveInt(conductorByUser?.id);
    if (conductorId) {
      return {
        conductorId,
        userId: parsePositiveInt(conductorByUser?.usuario_id) || tokenUserId,
        source: 'usuario_id'
      };
    }
  }

  const tokenConductorId = parsePositiveInt(user.conductorId);
  if (tokenConductorId) {
    const conductorById = await db('conductores')
      .where({ id: tokenConductorId })
      .select('id', 'usuario_id')
      .first();

    const conductorId = parsePositiveInt(conductorById?.id);
    if (conductorId) {
      return {
        conductorId,
        userId: parsePositiveInt(conductorById?.usuario_id) || tokenUserId || null,
        source: 'conductor_id_token'
      };
    }
  }

  const emailCandidates = [normalizeEmail(user.email), normalizeEmail(user.name)].filter(Boolean);
  if (emailCandidates.length > 0) {
    const conductorByEmail = await db('conductores as c')
      .leftJoin('usuarios as u', 'u.id', 'c.usuario_id')
      .where((qb) => {
        qb.whereIn('u.email', emailCandidates)
          .orWhereIn('u.name', emailCandidates)
          .orWhereIn('c.email', emailCandidates);
      })
      .select('c.id', 'c.usuario_id')
      .orderBy('c.id', 'desc')
      .first();

    const conductorId = parsePositiveInt(conductorByEmail?.id);
    if (conductorId) {
      return {
        conductorId,
        userId: parsePositiveInt(conductorByEmail?.usuario_id) || tokenUserId || null,
        source: 'email_fallback'
      };
    }
  }

  return null;
};

const resolveConductorId = async (user = {}) => {
  const context = await resolveConductorContext(user);
  return context?.conductorId || null;
};

module.exports = {
  resolveConductorContext,
  resolveConductorId
};
