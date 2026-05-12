// backend/validators/vehiculoValidator.js
const Joi = require('joi');
const NUMERO_MOTOR_PATTERN = /^[A-Za-z0-9\-./\s_]+$/;

const vehiculoSchemas = {
  create: Joi.object({
    TipoSocio: Joi.string().valid('SD', 'SI', 'SA').required(),
    NumeroUnidad: Joi.number().integer().positive().required(),
    Marca: Joi.string().max(50).required(),
    Modelo: Joi.string().max(50).required(),
    TipoVehiculo: Joi.string().valid('Sedan', 'SUV', 'Pickup', 'Van', 'Hatchback', 'Compacto').default('Sedan'),
    TipoCombustible: Joi.string().valid('Gasolina', 'Eléctrico', 'Híbrido', 'Diesel').default('Gasolina'),
    Año: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1).required(),
    Placa: Joi.string().pattern(/^[A-Z0-9-]+$/).max(10).required(),
    Color: Joi.string().max(30),
    NumeroSerie: Joi.string().alphanum().max(20),
    Estado: Joi.string().valid('Disponible', 'Rentado', 'Mantenimiento', 'Baja', 'Siniestro', 'Asignado').default('Disponible'),
    KilometrajeActual: Joi.number().integer().min(0).default(0),
    ProximoMantenimiento: Joi.number().integer().min(0),
    IntervaloMantenimiento: Joi.number().integer().min(1000).max(20000).default(5000),
    FechaUltimoServicio: Joi.date().iso().allow(null),
    PolizaSeguro: Joi.string().max(50),
    PolizaVencimiento: Joi.date().iso().min(new Date(new Date().setHours(0, 0, 0, 0))).allow(null, ''),
    MontoDeducible: Joi.number().min(0).default(0),
    Observaciones: Joi.string().max(500).allow('', null),
    NumeroMotor: Joi.string()
      .pattern(NUMERO_MOTOR_PATTERN)
      .max(30)
      .allow('', null),
    PolizaSeguroId: Joi.number().integer().positive().allow(null),
    ConductorAsignadoId: Joi.number().integer().positive().allow(null),
    precio_compra: Joi.number().min(0).allow(null, ''),
    renta_sugerida: Joi.number().min(0).allow(null, ''),
    total_corrida: Joi.number().min(0),
    multiplicador_corrida: Joi.number().min(0),
    plazo_corrida: Joi.number().integer().positive().max(120)
  }),
  
  update: Joi.object({
    TipoSocio: Joi.string().valid('SD', 'SI', 'SA'),
    NumeroUnidad: Joi.number().integer().positive(),
    Marca: Joi.string().max(50),
    Modelo: Joi.string().max(50),
    TipoVehiculo: Joi.string().valid('Sedan', 'SUV', 'Pickup', 'Van', 'Hatchback', 'Compacto'),
    TipoCombustible: Joi.string().valid('Gasolina', 'Eléctrico', 'Híbrido', 'Diesel'),
    Año: Joi.number().integer().min(2000).max(new Date().getFullYear() + 1),
    Placa: Joi.string().pattern(/^[A-Z0-9-]+$/).max(10),
    Color: Joi.string().max(30),
    NumeroSerie: Joi.string().alphanum().max(20),
    Estado: Joi.string().valid('Disponible', 'Rentado', 'Mantenimiento', 'Baja', 'Siniestro', 'Asignado'),
    KilometrajeActual: Joi.number().integer().min(0),
    ProximoMantenimiento: Joi.number().integer().min(0),
    IntervaloMantenimiento: Joi.number().integer().min(1000).max(20000),
    FechaUltimoServicio: Joi.date().iso().allow(null),
    PolizaSeguro: Joi.string().max(50),
    PolizaVencimiento: Joi.date().iso().allow(null),
    MontoDeducible: Joi.number().min(0),
    Observaciones: Joi.string().max(500).allow('', null),
    NumeroMotor: Joi.string()
      .pattern(NUMERO_MOTOR_PATTERN)
      .max(30)
      .allow('', null),
    PolizaSeguroId: Joi.number().integer().positive().allow(null),
    ConductorAsignadoId: Joi.number().integer().positive().allow(null),
    total_corrida: Joi.number().min(0),
    multiplicador_corrida: Joi.number().min(0),
    plazo_corrida: Joi.number().integer().positive().max(120)
  }).min(1), // Al menos un campo para actualizar
  
  asignarConductor: Joi.object({
    conductorId: Joi.number().integer().positive().required(),
    rentaDiaria: Joi.number().min(0).max(10000).default(400),
    abonoPoliza: Joi.number().min(0).max(1000).default(50),
    fechaInicio: Joi.date().iso().default(() => new Date()),
    urlContrato: Joi.string().uri().allow(null)
  })
};

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        errors
      });
    }
    
    req.body = value;
    next();
  };
};

module.exports = {
  vehiculoSchemas,
  validate
};
