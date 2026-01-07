// backend/validators/conductorValidator.js
const Joi = require('joi');

// Esquema de validación para Conductor - ACTUALIZADO A SNAKE_CASE
const conductorSchema = Joi.object({
  // Información básica
  nombre_conductor: Joi.string()
    .min(3)
    .max(255)
    .required()
    .messages({
      'string.min': 'El nombre debe tener al menos 3 caracteres',
      'string.max': 'El nombre no puede exceder 255 caracteres',
      'any.required': 'El nombre del conductor es requerido'
    }),
  
  numero_telefono: Joi.string()
    .pattern(/^[0-9+\s\-()]{10,20}$/)
    .required()
    .messages({
      'string.pattern.base': 'El teléfono debe tener entre 10 y 20 caracteres',
      'any.required': 'El número de teléfono es requerido'
    }),
  
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      'any.required': 'El correo electrónico es obligatorio para crear la cuenta de acceso',
      'string.email': 'Debe ser un email válido'
    }),
  
  // Documentación
  numero_de_ine_ife: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  curp: Joi.string()
    .length(18)
    .uppercase()
    .optional()
    .allow(null, '')
    .messages({
      'string.length': 'CURP debe tener exactamente 18 caracteres'
    }),
  
  rfc: Joi.string()
    .min(12)
    .max(13)
    .uppercase()
    .trim()
    .required()
    .messages({
      'string.min': 'RFC debe tener al menos 12 caracteres',
      'string.max': 'RFC no puede exceder 13 caracteres',
      'any.required': 'El RFC es requerido'
    }),
  
  // Licencia
  licencia_conducir: Joi.string()
    .max(255)
    .trim()
    .required()
    .messages({
      'any.required': 'El número de licencia es requerido'
    }),
  
  licencia_vigencia: Joi.date()
    .required()
    .messages({
      'any.required': 'La fecha de vigencia de la licencia es requerida'
    }),
  
  licencia_vencimiento: Joi.date()
    .optional()
    .allow(null),
  
  // Estado y trabajo
  status: Joi.string()
    .valid('Pendiente', 'Aprobado', 'Activo', 'Inactivo', 'Rechazado', 'Suspendido')
    .default('Pendiente')
    .allow(null, ''),
  
  status_trabajo: Joi.string()
    .valid('activo', 'inactivo', 'ocupado', 'desconectado', 'conectado', 'en_servicio')
    .default('desconectado')
    .allow(null, ''),
  
  verificacion_antecedentes: Joi.string()
    .valid('pendiente', 'Pendiente', 'Aprobada', 'Rechazada', 'En Proceso')
    .default('pendiente')
    .allow(null, ''),
  
  // Categorización - ACTUALIZADO con categorías reales
  categoria: Joi.string()
    .valid('Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Socio Dueño', 'B', '')
    .optional()
    .allow(null, ''),
  
  tipo_socio: Joi.string()
    .valid('SD', 'SI', 'SA', 'EXTERNO', 'Empleado', 'Socio', 'Externo', '')
    .optional()
    .allow(null, ''),
  
  // Información de contacto y ubicación
  direccion_completa: Joi.string()
    .max(500)
    .optional()
    .allow(null, ''),
  
  contacto_emergencia: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  telefono_emergencia: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  ubicacion_actual: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  zona_trabajo: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  horario_preferido: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  estado_civil: Joi.string()
    .valid('Soltero', 'Casado', 'Divorciado', 'Viudo', 'Union Libre', '')
    .optional()
    .allow(null, ''),
  
  // Información personal
  fecha_nacimiento: Joi.date()
    .max('now')
    .optional()
    .allow(null)
    .messages({
      'date.max': 'La fecha de nacimiento no puede ser futura'
    }),
  
  // Métricas y estadísticas
  calificacion_promedio: Joi.number()
    .min(0)
    .max(5)
    .precision(2)
    .default(0)
    .allow(null),
  
  saldo_ganancias: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .allow(null),
  
  tasa_aceptacion: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .default(0)
    .allow(null),
  
  tasa_cancelacion: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .default(0)
    .allow(null),
  
  tasa_completacion: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .default(0)
    .allow(null),
  
  // Vehículo y capacidad
  tipo_vehiculo: Joi.string()
    .valid('Sedan', 'SUV', 'Pickup', 'Van', 'Hatchback', 'Compacto', '')
    .optional()
    .allow(null, ''),
  
  max_pasajeros: Joi.number()
    .integer()
    .min(1)
    .max(15)
    .default(4)
    .allow(null),
  
  // Integración con bots
  chat_id_telegram: Joi.string()
    .optional()
    .allow(null, ''),
  
  username_telegram: Joi.string()
    .optional()
    .allow(null, ''),
  
  bot_configurado: Joi.boolean()
    .default(false)
    .allow(null),
  
  primer_mensaje_bot: Joi.date()
    .optional()
    .allow(null),
  
  // Registro y tracking
  metodo_registro: Joi.string()
    .valid('manual', 'Manual', 'telegram', 'whatsapp', 'web', 'Portal_Solicitud')
    .default('Manual')
    .allow(null, ''),
  
  fecha_registro: Joi.date()
    .default(() => new Date())
    .allow(null),
  
  fecha_ingreso: Joi.date()
    .default(() => new Date())
    .allow(null),
  
  registrado_por: Joi.string()
    .optional()
    .allow(null, ''),
  
  // Actividad
  ultima_conexion: Joi.date()
    .optional()
    .allow(null),
  
  ultima_activacion: Joi.date()
    .optional()
    .allow(null),
  
  total_activaciones_hoy: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .allow(null),
  
  // Fechas importantes
  fecha_categorizacion: Joi.date()
    .optional()
    .allow(null),
  
  fecha_ultimo_ascenso: Joi.date()
    .optional()
    .allow(null),
  
  // Documentos URLs
  foto_frente_licencia_url: Joi.string()
    .uri()
    .optional()
    .allow(null, ''),
  
  foto_reverso_licencia_url: Joi.string()
    .uri()
    .optional()
    .allow(null, ''),
  
  fecha_foto_frente: Joi.date()
    .optional()
    .allow(null),
  
  fecha_foto_reverso: Joi.date()
    .optional()
    .allow(null),
  
  // URLs de documentos (para archivos subidos)
  url_licencia_frente: Joi.string()
    .uri()
    .optional()
    .allow(null, ''),
  
  url_licencia_reverso: Joi.string()
    .uri()
    .optional()
    .allow(null, ''),
  
  url_ine_frente: Joi.string()
    .uri()
    .optional()
    .allow(null, ''),
  
  url_ine_reverso: Joi.string()
    .uri()
    .optional()
    .allow(null, ''),
  
  // Seguro y vencimientos
  seguro_vehiculo_vencimiento: Joi.date()
    .optional()
    .allow(null),
  
  // Finanzas
  deposito: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .allow(null),
  
  // Pólizas y ahorro
  tipo_poliza: Joi.string()
    .valid('POLIZA_100', 'POLIZA_50', 'SIN_POLIZA')
    .default('POLIZA_100')
    .allow(null, ''),
  
  saldo_poliza_mecanica: Joi.number()
    .min(0)
    .precision(2)
    .default(50000)
    .allow(null),
  
  total_aportado_poliza: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .allow(null),
  
  saldo_billetera_digital: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .allow(null),
  
  saldo_ahorro_mantenimiento: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .allow(null),
  
  // Otros
  matricula: Joi.string()
    .optional()
    .allow(null, ''),
  
  observaciones: Joi.string()
    .max(1000)
    .optional()
    .allow(null, ''),
  
  usa_uniforme: Joi.boolean()
    .default(false)
    .allow(null),
  
  usuario_id: Joi.number()
    .integer()
    .optional()
    .allow(null),
  
  // Información socioeconómica (de solicitudes)
  tipo_vivienda: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  tiempo_renta_actual: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  experiencia_taxi: Joi.boolean()
    .optional()
    .allow(null),
  
  ultimo_empleo: Joi.string()
    .max(500)
    .optional()
    .allow(null, ''),
  
  tiene_responsabilidad_familiar: Joi.boolean()
    .optional()
    .allow(null),
  
  // Referencias familiares
  referencia_familiar_1_nombre: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  referencia_familiar_1_telefono: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  referencia_familiar_2_nombre: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  referencia_familiar_2_telefono: Joi.string()
    .max(255)
    .optional()
    .allow(null, ''),
  
  // Campos de archivo (se procesarán como multipart/form-data)
  ine_frente: Joi.any()
    .optional(),
  
  ine_reverso: Joi.any()
    .optional(),
  
  licencia_frente: Joi.any()
    .optional(),
  
  licencia_reverso: Joi.any()
    .optional(),
  
  comprobante_domicilio: Joi.any()
    .optional(),
  
  // Campo para crear usuario automáticamente
  crear_usuario: Joi.boolean()
    .optional(),
  
  password: Joi.when('crear_usuario', {
    is: true,
    then: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': 'La contraseña debe tener al menos 6 caracteres',
        'any.required': 'La contraseña es requerida cuando se crea un usuario'
      }),
    otherwise: Joi.optional()
  }),
  
  // IDs de Airtable (para compatibilidad)
  airtable_id: Joi.string()
    .optional()
    .allow(null, ''),
  
  // Timestamps (normalmente no se envían desde el frontend)
  created_at: Joi.date()
    .optional(),
  
  updated_at: Joi.date()
    .optional()
});

// Esquema para actualización (todos los campos son opcionales)
const conductorUpdateSchema = conductorSchema.fork(
  [
    'nombre_conductor',
    'numero_telefono',
    'email',
    'rfc',
    'licencia_conducir',
    'licencia_vigencia',
    'fecha_registro',
    'fecha_ingreso'
  ],
  (field) => field.optional()
);

// Función de validación
const validateConductor = (data, isUpdate = false) => {
  const schema = isUpdate ? conductorUpdateSchema : conductorSchema;
  return schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: true // Permitir campos desconocidos (para archivos multipart)
  });
};

// Validaciones específicas
const validateStatusChange = (data) => {
  return Joi.object({
    status: Joi.string()
      .valid('Pendiente', 'Aprobado', 'Activo', 'Inactivo', 'Rechazado', 'Suspendido')
      .required(),
    motivo: Joi.string()
      .max(255)
      .optional()
  }).validate(data);
};

const validateAsignacionVehiculo = (data) => {
  return Joi.object({
    vehiculoId: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'any.required': 'El ID del vehículo es requerido'
      }),
    rentaDiaria: Joi.number()
      .positive()
      .precision(2)
      .default(400)
      .messages({
        'number.positive': 'La renta diaria debe ser positiva'
      }),
    abonoPoliza: Joi.number()
      .min(0)
      .precision(2)
      .default(50),
    fechaInicio: Joi.date()
      .default(() => new Date()),
    urlContrato: Joi.string()
      .uri()
      .optional()
      .allow(null, '')
  }).validate(data);
};

const validateAmonestacion = (data) => {
  return Joi.object({
    motivo: Joi.string()
      .min(5)
      .max(255)
      .required()
      .messages({
        'string.min': 'El motivo debe tener al menos 5 caracteres',
        'any.required': 'El motivo de la amonestación es requerido'
      }),
    descripcion: Joi.string()
      .max(1000)
      .optional()
      .allow(null, ''),
    gravedad: Joi.string()
      .valid('leve', 'moderada', 'grave')
      .default('leve')
  }).validate(data);
};

const validateAjustePoliza = (data) => {
  return Joi.object({
    monto: Joi.number()
      .positive()
      .precision(2)
      .required()
      .messages({
        'number.positive': 'El monto debe ser positivo',
        'any.required': 'El monto es requerido'
      }),
    tipo_ajuste: Joi.string()
      .valid('descuento', 'recarga')
      .required()
      .messages({
        'any.required': 'El tipo de ajuste es requerido'
      }),
    motivo: Joi.string()
      .max(255)
      .optional()
  }).validate(data);
};

module.exports = {
  validateConductor,
  validateStatusChange,
  validateAsignacionVehiculo,
  validateAmonestacion,
  validateAjustePoliza,
  conductorSchema,
  conductorUpdateSchema
};
