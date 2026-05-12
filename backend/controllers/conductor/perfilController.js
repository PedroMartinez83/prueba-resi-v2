// backend/controllers/conductor/perfilController.js
const { db } = require('../../config/database');
const bcrypt = require('bcrypt');

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
        userId: parsePositiveInt(conductorByUser?.usuario_id) || tokenUserId
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
        userId: parsePositiveInt(conductorById?.usuario_id) || tokenUserId || null
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
        userId: parsePositiveInt(conductorByEmail?.usuario_id) || tokenUserId || null
      };
    }
  }

  return null;
};

// =====================================================
// OBTENER MI PERFIL COMPLETO
// =====================================================
const getMiPerfil = async (req, res) => {
  try {
    const context = await resolveConductorContext(req.user);
    const conductorId = context?.conductorId;
    const userId = context?.userId;

    if (!conductorId) {
      return res.status(400).json({
        success: false,
        message: 'No se pudo identificar al conductor autenticado'
      });
    }

    const conductor = await db('conductores')
      .where({ id: conductorId })
      .first();

    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    let usuario = null;
    if (userId) {
      usuario = await db('usuarios')
        .where({ id: userId })
        .select('email', 'created_at')
        .first();
    }

    const asignacion = await db('asignaciones')
      .where({ conductor_id: conductorId, activa: true })
      .first();

    let vehiculo = null;
    if (asignacion) {
      vehiculo = await db('vehiculos')
        .where({ id: asignacion.vehiculo_id })
        .select('numero_vehiculo', 'marca', 'modelo', 'placa')
        .first();
    }

    return res.json({
      success: true,
      perfil: {
        nombre_conductor: conductor.nombre_conductor,
        numero_telefono: conductor.numero_telefono,
        email: usuario?.email || conductor.email || null,
        fecha_nacimiento: conductor.fecha_nacimiento,
        direccion: conductor.direccion_completa || null,

        status: conductor.status,
        categoria: conductor.categoria,
        fecha_ingreso: conductor.fecha_ingreso,

        url_ine_frente: conductor.url_ine_frente,
        url_ine_reverso: conductor.url_ine_reverso,
        url_licencia_frente: conductor.url_licencia_frente,
        url_licencia_reverso: conductor.url_licencia_reverso,
        url_comprobante_domicilio: conductor.url_comprobante_domicilio,
        fecha_vencimiento_licencia: conductor.fecha_vencimiento_licencia,

        tipo_poliza: conductor.tipo_poliza,
        saldo_poliza_mecanica: parseFloat(conductor.saldo_poliza_mecanica || 0),
        saldo_ahorro_mantenimiento: parseFloat(conductor.saldo_ahorro_mantenimiento || 0),
        // 👇 2. AQUÍ CONECTAMOS LOS CABLES EXACTOS PARA EL FRONTEND
        saldo_poliza: parseFloat(conductor.saldo_poliza_mecanica || 0),
        vehiculo_actual: vehiculo ? vehiculo.numero_vehiculo : 'Sin vehículo asignado',

        vehiculo_asignado: vehiculo
      }
    });
  } catch (error) {
    console.error('Error en getMiPerfil:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfil',
      error: error.message
    });
  }
};

// =====================================================
// ACTUALIZAR PERFIL
// =====================================================
const actualizarPerfil = async (req, res) => {
  try {
    const context = await resolveConductorContext(req.user);
    const conductorId = context?.conductorId;
    const { numero_telefono, direccion } = req.body;

    if (!conductorId) {
      return res.status(400).json({
        success: false,
        message: 'No se pudo identificar al conductor autenticado'
      });
    }

    if (!numero_telefono && !direccion) {
      return res.status(400).json({
        success: false,
        message: 'Debes proporcionar al menos un campo para actualizar'
      });
    }

    const datosActualizar = {
      updated_at: db.fn.now()
    };

    if (numero_telefono) {
      datosActualizar.numero_telefono = numero_telefono;
    }

    if (direccion) {
      datosActualizar.direccion_completa = direccion;
    }

    const updated = await db('conductores')
      .where({ id: conductorId })
      .update(datosActualizar);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    return res.json({
      success: true,
      message: 'Perfil actualizado correctamente'
    });
  } catch (error) {
    console.error('Error en actualizarPerfil:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      error: error.message
    });
  }
};

// =====================================================
// CAMBIAR CONTRASEÑA
// =====================================================
const cambiarPassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password_actual, password_nueva } = req.body;

    if (!password_actual || !password_nueva) {
      return res.status(400).json({
        success: false,
        message: 'Debes proporcionar la contraseña actual y la nueva'
      });
    }

    if (password_nueva.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    const usuario = await db('usuarios')
      .where({ id: userId })
      .first();

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const passwordValido = await bcrypt.compare(password_actual, usuario.password);

    if (!passwordValido) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    const hashedPassword = await bcrypt.hash(password_nueva, 10);

    await db('usuarios')
      .where({ id: userId })
      .update({
        password: hashedPassword,
        updated_at: db.fn.now()
      });

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    console.error('Error en cambiarPassword:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña',
      error: error.message
    });
  }
};

module.exports = {
  getMiPerfil,
  actualizarPerfil,
  cambiarPassword
};
