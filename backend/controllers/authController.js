const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findUserByEmail, create, update, getWithFilter, TABLES, findUserByVehiculo, db } = require('../services/postgresService');
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require('../utils/emailService');
const { createResetCode, findValidCode, markCodeUsed } = require('../services/passwordResetService');

// Configuración de expiración por inactividad (4 horas)
const INACTIVITY_LIMIT_MS = 4 * 60 * 60 * 1000;
const DEFAULT_JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';

const buildUserPayload = (user, conductorId) => ({
  id: user.id,
  email: user.email || user.name,
  name: user.nombre_completo,
  rol: user.rol || 'conductor',
  numeroVehiculo: user.numero_vehiculo,
  conductorId: conductorId || null
});

const signAuthToken = (user, conductorId) => {
  const payload = {
    ...buildUserPayload(user, conductorId),
    lastActivity: Date.now()
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: DEFAULT_JWT_EXPIRE
  });
};

// Función auxiliar para validar fechas
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar entrada
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario directamente en PostgreSQL con campos correctos
    const normalizedEmail = email.trim().toLowerCase();
    const user = await db('usuarios')
      .where('name', normalizedEmail)
      .orWhere('email', normalizedEmail)
      .first();
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña (campo en minúsculas en PostgreSQL)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    /// 🔥 OBTENER conductorId SI ES CONDUCTOR
let conductorId = null;
if (user.rol === 'conductor') {
  const conductor = await db('conductores')
    .where({ usuario_id: user.id })
    .first();
  
  if (!conductor) {
    return res.status(403).json({
      success: false,
      message: 'Usuario no vinculado a un conductor.'
    });
  }
  
  conductorId = conductor.id;
}

// Generar token JWT con conductorId
const token = signAuthToken(user, conductorId);
    // Responder con token y datos del usuario
   res.json({
  success: true,
  message: 'Login exitoso',
  token,
  user: {
    id: user.id,
    email: user.email || user.name,
    name: user.nombre_completo,
    rol: user.rol || 'conductor',
    numeroVehiculo: user.numero_vehiculo,
    conductorId: conductorId  // ✅ DEBE ESTAR AQUÍ
  }
});

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Registro (opcional, por si necesitas crear usuarios desde la app)
const register = async (req, res) => {
  try {
    const { email, password, nombre, rol } = req.body;

    // Validar entrada
    if (!email || !password || !nombre) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await db('usuarios')
      .where('name', email)
      .orWhere('email', email)
      .first();
      
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario en PostgreSQL con campos en minúsculas
    const [newUser] = await db('usuarios')
      .insert({
        name: email,
        email: email,
        password: hashedPassword,
        nombre_completo: nombre,
        rol: rol || 'conductor',
        estado: 'Activo',
        fecha_registro: new Date()
      })
      .returning('*');

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        id: newUser.id,
        email: newUser.name,
        name: newUser.nombre_completo,
        rol: newUser.rol
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verificar token (para chequear si el usuario sigue autenticado)
const verifyAuth = async (req, res) => {
  try {
    // Si llegamos aquí, el middleware ya verificó el token
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

// Cambio de contraseña
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validar entrada
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere la contraseña actual y la nueva'
      });
    }

    // Buscar usuario
    const user = await db('usuarios')
      .where('id', userId)
      .first();
    
    // Verificar contraseña actual
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña actual es incorrecta'
      });
    }

    // Encriptar nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar en PostgreSQL
    await db('usuarios')
      .where('id', userId)
      .update({
        password: hashedPassword,
        updated_at: new Date()
      });

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

// Solicitar código de recuperación
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'El email es requerido' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await db('usuarios')
      .where('name', normalizedEmail)
      .orWhere('email', normalizedEmail)
      .first();

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'Si el correo existe, se envió un código de verificación'
      });
    }

    const targetEmail = normalizedEmail;

    const resetRecord = await createResetCode({ usuarioId: user.id, email: targetEmail });
    await sendPasswordResetEmail({ email: targetEmail, code: resetRecord.code });

    return res.status(200).json({
      success: true,
      message: 'Código de verificación enviado al correo registrado'
    });
  } catch (error) {
    console.error('Error solicitando código de recuperación:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
};

// Validar código y cambiar contraseña
const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    if (!email || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await db('usuarios')
      .where('name', normalizedEmail)
      .orWhere('email', normalizedEmail)
      .first();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const validCode = await findValidCode({ email: normalizedEmail, code });

    if (!validCode) {
      return res.status(400).json({ success: false, message: 'Código inválido o expirado' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db('usuarios')
      .where('id', user.id)
      .update({ password: hashedPassword, updated_at: new Date() });

    await markCodeUsed(validCode.id);
    await sendPasswordChangedEmail({ email: user.email || user.name });

    return res.status(200).json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error reiniciando contraseña:', error);
    res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
};

// Obtener vehículos disponibles para registro
const getVehiculosDisponibles = async (req, res) => {
  try {
    const vehiculos = await db('vehiculos')
      .where('estado', 'Disponible')
      .orderBy('numero_vehiculo', 'asc');

    // Formatear respuesta para el frontend
    const vehiculosFormateados = vehiculos.map(vehiculo => ({
      id: vehiculo.id,
      numero: vehiculo.numero_vehiculo,
      placa: vehiculo.placa || 'Sin placa',
      estado: vehiculo.estado
    }));

    res.json({
      success: true,
      vehiculos: vehiculosFormateados
    });

  } catch (error) {
    console.error('Error obteniendo vehículos disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vehículos disponibles'
    });
  }
};

// Registro de conductor con selección de vehículo
const registrarConductor = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { email, password, nombre, telefono, numeroVehiculo } = req.body;

    // Validar entrada
    if (!email || !password || !nombre || !numeroVehiculo) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await trx('usuarios')
      .where('name', email)
      .orWhere('email', email)
      .first();
      
    if (existingUser) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Verificar que el vehículo esté disponible
    const vehiculo = await trx('vehiculos')
      .where('numero_vehiculo', numeroVehiculo)
      .where('estado', 'Disponible')
      .first();

    if (!vehiculo) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'El vehículo seleccionado no está disponible'
      });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const [newUser] = await trx('usuarios')
      .insert({
        name: email,
        email: email,
        password: hashedPassword,
        nombre_completo: nombre,
        rol: 'conductor',
        numero_vehiculo: numeroVehiculo,
        estado: 'Activo',
        fecha_registro: new Date()
      })
      .returning('*');

    // Crear registro en Conductores
    const [newConductor] = await trx('conductores')
      .insert({
        email: email,
        nombre_conductor: nombre,
        numero_telefono: telefono,
        status: 'Aprobado',
        status_trabajo: 'activo',
        usuario_id: newUser.id,
        vehiculo_id: vehiculo.id,
        fecha_registro: new Date()
      })
      .returning('*');

    // Actualizar vehículo como asignado
    await trx('vehiculos')
      .where('id', vehiculo.id)
      .update({
        estado: 'Rentado',
        conductor_id: newConductor.id,
        updated_at: new Date()
      });

    await trx.commit();

    console.log(`Conductor ${nombre} registrado con vehículo ${numeroVehiculo}`);

    res.status(201).json({
      success: true,
      message: 'Conductor registrado exitosamente',
      conductor: {
        id: newConductor.id,
        nombre: nombre,
        email: email,
        vehiculo: numeroVehiculo
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en registro de conductor:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verificar si un vehículo existe y si ya tiene usuario asociado
const verificarVehiculo = async (req, res) => {
  try {
    const { numeroVehiculo } = req.body;

    if (!numeroVehiculo) {
      return res.status(400).json({
        success: false,
        message: 'Número de vehículo es requerido'
      });
    }

    // Buscar el vehículo
    const vehiculo = await db('vehiculos')
      .where('numero_vehiculo', numeroVehiculo)
      .first();

    if (!vehiculo) {
      return res.status(404).json({
        success: false,
        message: 'Número de vehículo no encontrado'
      });
    }

    // Buscar conductor asociado
    const conductor = await db('conductores')
      .where('vehiculo_id', vehiculo.id)
      .first();

    // Buscar usuario asociado
    const usuario = await db('usuarios')
      .where('numero_vehiculo', numeroVehiculo)
      .first();

    const hasUser = !!usuario;

    res.json({
      success: true,
      vehiculo: {
        numero: numeroVehiculo,
        conductor: conductor ? conductor.nombre_conductor : 'Sin conductor',
        hasUser: hasUser
      },
      action: hasUser ? 'login' : 'register'
    });

  } catch (error) {
    console.error('Error verificando vehículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor'
    });
  }
};

// Registro de conductor socio con TODOS los campos obligatorios
const registrarPorVehiculo = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { 
      numeroVehiculo, 
      email, 
      password, 
      nombre, 
      telefono,
      tipoSocio,
      ineFile,
      fotoLicenciaFrente,
      licenciaVencimiento,
      seguroVencimiento
    } = req.body;

    // Validar TODOS los campos obligatorios
    if (!numeroVehiculo || !email || !password || !nombre || !telefono || 
        !tipoSocio || !ineFile || !fotoLicenciaFrente || 
        !licenciaVencimiento || !seguroVencimiento) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Todos los campos son obligatorios'
      });
    }

    // Validar formato de fechas
    if (!isValidDate(licenciaVencimiento) || !isValidDate(seguroVencimiento)) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Las fechas de vencimiento deben tener formato válido (YYYY-MM-DD)'
      });
    }

    // Validar que las fechas no sean pasadas
    const today = new Date();
    if (new Date(licenciaVencimiento) < today || new Date(seguroVencimiento) < today) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Las fechas de vencimiento no pueden ser pasadas'
      });
    }

    // Verificar que el vehículo existe
    const vehiculo = await trx('vehiculos')
      .where('numero_vehiculo', numeroVehiculo)
      .first();

    if (!vehiculo) {
      await trx.rollback();
      return res.status(404).json({
        success: false,
        message: 'Vehículo no encontrado'
      });
    }

    // Verificar que no existe usuario con este email
    const existingUser = await trx('usuarios')
      .where('name', email)
      .orWhere('email', email)
      .first();
      
    if (existingUser) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Verificar que no existe usuario con este vehículo
    const existingVehicleUser = await trx('usuarios')
      .where('numero_vehiculo', numeroVehiculo)
      .first();
      
    if (existingVehicleUser) {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este vehículo ya tiene un conductor asignado'
      });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario primero
    const [newUser] = await trx('usuarios')
      .insert({
        name: email,
        email: email,
        password: hashedPassword,
        rol: 'conductor',
        numero_vehiculo: numeroVehiculo,
        nombre_completo: nombre,
        estado: 'Activo',
        fecha_registro: new Date()
      })
      .returning('*');

    // Crear registro en Conductores
    const [newConductor] = await trx('conductores')
      .insert({
        email: email,
        nombre_conductor: nombre,
        numero_telefono: telefono,
        tipo_socio: tipoSocio,
        ine: ineFile,
        foto_frente_licencia: fotoLicenciaFrente,
        licencia_vencimiento: licenciaVencimiento,
        seguro_vehiculo_vencimiento: seguroVencimiento,
        status: 'Aprobado',
        status_trabajo: 'activo',
        usuario_id: newUser.id,
        vehiculo_id: vehiculo.id,
        fecha_registro: new Date()
      })
      .returning('*');

    // Actualizar vehículo como asignado
    await trx('vehiculos')
      .where('id', vehiculo.id)
      .update({
        estado: 'Rentado',
        conductor_id: newConductor.id,
        updated_at: new Date()
      });

    await trx.commit();

    console.log(`Conductor socio ${nombre} (${tipoSocio}) registrado con vehículo ${numeroVehiculo}`);

    res.status(201).json({
      success: true,
      message: 'Conductor socio registrado exitosamente',
      conductor: {
        id: newConductor.id,
        nombre: nombre,
        email: email,
        vehiculo: numeroVehiculo,
        tipoSocio: tipoSocio,
        telefono: telefono,
        licenciaVencimiento: licenciaVencimiento,
        seguroVencimiento: seguroVencimiento
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('Error en registro por vehículo:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  login,
  register,
  verifyAuth,
  changePassword,
   forgotPassword,
  resetPassword,
  getVehiculosDisponibles,
  registrarConductor,
  verificarVehiculo,
  registrarPorVehiculo
};
