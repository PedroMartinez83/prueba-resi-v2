// backend/controllers/conductor/perfilController.js
const { db } = require('../../config/database');
const bcrypt = require('bcrypt');

// =====================================================
// OBTENER MI PERFIL COMPLETO
// =====================================================
const getMiPerfil = async (req, res) => {
  try {
    const conductorId = req.user.conductorId;
    const userId = req.user.id;

    // Obtener datos del conductor
    const conductor = await db('conductores')
      .where({ id: conductorId })
      .first();

    if (!conductor) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    // Obtener datos del usuario (email)
    const usuario = await db('usuarios')
      .where({ id: userId })
      .select('email', 'created_at')
      .first();

    // Obtener vehículo asignado (si existe)
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

    res.json({
      success: true,
      perfil: {
        // Datos personales
        nombre_conductor: conductor.nombre_conductor,
        numero_telefono: conductor.numero_telefono,
        email: usuario.email,
        fecha_nacimiento: conductor.fecha_nacimiento,
        direccion: conductor.direccion,
        
        // Estado y categoría
        status: conductor.status,
        categoria: conductor.categoria,
        fecha_ingreso: conductor.fecha_ingreso,
        
        // Documentos
        url_ine_frente: conductor.url_ine_frente,
        url_ine_reverso: conductor.url_ine_reverso,
        url_licencia_frente: conductor.url_licencia_frente,
        url_licencia_reverso: conductor.url_licencia_reverso,
        url_comprobante_domicilio: conductor.url_comprobante_domicilio,
        fecha_vencimiento_licencia: conductor.fecha_vencimiento_licencia,
        
        // Finanzas
        tipo_poliza: conductor.tipo_poliza,
        saldo_poliza_mecanica: parseFloat(conductor.saldo_poliza_mecanica || 0),
        saldo_ahorro_mantenimiento: parseFloat(conductor.saldo_ahorro_mantenimiento || 0),
        
        // Vehículo asignado
        vehiculo_asignado: vehiculo
      }
    });

  } catch (error) {
    console.error('Error en getMiPerfil:', error);
    res.status(500).json({
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
    const conductorId = req.user.conductorId;
    const { numero_telefono, direccion } = req.body;

    // Validación básica
    if (!numero_telefono && !direccion) {
      return res.status(400).json({
        success: false,
        message: 'Debes proporcionar al menos un campo para actualizar'
      });
    }

    // Preparar datos a actualizar
    const datosActualizar = {
      updated_at: db.fn.now()
    };

    if (numero_telefono) {
      datosActualizar.numero_telefono = numero_telefono;
    }

    if (direccion) {
      datosActualizar.direccion = direccion;
    }

    // Actualizar conductor
    const updated = await db('conductores')
      .where({ id: conductorId })
      .update(datosActualizar);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Conductor no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Perfil actualizado correctamente'
    });

  } catch (error) {
    console.error('Error en actualizarPerfil:', error);
    res.status(500).json({
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

    // Validación
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

    // Obtener usuario
    const usuario = await db('usuarios')
      .where({ id: userId })
      .first();

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar contraseña actual
    const passwordValido = await bcrypt.compare(password_actual, usuario.password);
    
    if (!passwordValido) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(password_nueva, 10);

    // Actualizar contraseña
    await db('usuarios')
      .where({ id: userId })
      .update({
        password: hashedPassword,
        updated_at: db.fn.now()
      });

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });

  } catch (error) {
    console.error('Error en cambiarPassword:', error);
    res.status(500).json({
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