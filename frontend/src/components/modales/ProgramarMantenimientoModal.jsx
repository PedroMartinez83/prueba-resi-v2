// frontend/src/components/modales/ProgramarMantenimientoModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X,
  Wrench,
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader,
  Gauge
} from 'lucide-react';
import adminService from '../../services/adminService';

const ProgramarMantenimientoModal = ({ isOpen, onClose, vehiculo, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Opciones para los selects
  const [opciones, setOpciones] = useState({
    tipos_servicio: [],
    talleres: []
  });
  
  // Datos del formulario
  const [formData, setFormData] = useState({
    tipo_servicio: '',
    fecha_programada: new Date().toISOString().split('T')[0],
    hora_programada: '09:00',
    kilometraje_servicio: vehiculo?.KilometrajeActual || 0,
    proximo_servicio_km: 0,
    taller: '',
    observaciones: '',
    monto_estimado: 0
  });

  const [formErrors, setFormErrors] = useState({});

  // Cargar opciones al abrir el modal
  useEffect(() => {
    if (isOpen) {
      cargarOpciones();
      resetForm();
    }
  }, [isOpen, vehiculo]);

  const cargarOpciones = async () => {
    try {
      setLoading(true);
      const response = await adminService.getOpcionesMantenimientos();
      
      if (response.success) {
        setOpciones(response.opciones || {
          tipos_servicio: [],
          talleres: []
        });
      }
    } catch (err) {
      console.error('Error cargando opciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    const kmActual = vehiculo?.KilometrajeActual || 0;
    setFormData({
      tipo_servicio: '',
      fecha_programada: new Date().toISOString().split('T')[0],
      hora_programada: '09:00',
      kilometraje_servicio: kmActual,
      proximo_servicio_km: kmActual + 5000,
      taller: '',
      observaciones: '',
      monto_estimado: 0
    });
    setFormErrors({});
    setError(null);
  };

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose();
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpiar error del campo
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.tipo_servicio) {
      errors.tipo_servicio = 'Seleccione un tipo de servicio';
    }
    
    if (!formData.fecha_programada) {
      errors.fecha_programada = 'Seleccione una fecha';
    } else {
      const fechaSeleccionada = new Date(formData.fecha_programada);
      if (fechaSeleccionada.getDay() === 0 || fechaSeleccionada.getDay() === 6) {
        errors.fecha_programada = 'Solo se puede agendar de lunes a viernes';
      }
    }

    if (!formData.hora_programada) {
      errors.hora_programada = 'Seleccione una hora';
    } else {
      const [hora, minuto] = formData.hora_programada.split(':').map(Number);
      if (Number.isNaN(hora) || Number.isNaN(minuto)) {
        errors.hora_programada = 'Formato de hora inválido';
      } else {
        const inicioEnMinutos = hora * 60 + minuto;
        const finEnMinutos = inicioEnMinutos + 30;
        if (inicioEnMinutos < 540 || finEnMinutos > 1140) {
          errors.hora_programada = 'Horarios disponibles de 09:00 a 19:00 en bloques de 30 minutos';
        }
      }
    }

    if (!formData.kilometraje_servicio || formData.kilometraje_servicio < 0) {
      errors.kilometraje_servicio = 'Ingrese un kilometraje válido';
    }
    
    if (!formData.proximo_servicio_km || formData.proximo_servicio_km <= formData.kilometraje_servicio) {
      errors.proximo_servicio_km = 'Debe ser mayor al kilometraje actual';
    }
    
    return errors;
  };

  const handleProgramar = async () => {
    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const datos = {
        vehiculo_id: vehiculo.id,
        tipo_servicio: formData.tipo_servicio,
        fecha_programada: formData.fecha_programada,
        hora_programada: formData.hora_programada,
        kilometraje_servicio: parseInt(formData.kilometraje_servicio),
        proximo_servicio_km: parseInt(formData.proximo_servicio_km),
        taller: formData.taller || null,
        observaciones: formData.observaciones || null,
        monto_estimado: parseFloat(formData.monto_estimado) || 0
      };
      
      const response = await adminService.programarMantenimiento(datos);
      
      if (response.success) {
        if (onSuccess) {
          await onSuccess(response);
        }
        handleClose();
      } else {
        throw new Error(response.error || 'Error al programar mantenimiento');
      }
    } catch (err) {
      console.error('Error programando mantenimiento:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="glass rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-primary/20 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Programar Mantenimiento
            </h2>
            <p className="text-sm text-gray-400">
              Vehículo: <span className="text-primary font-semibold">{vehiculo?.NumeroVehiculo}</span> - {vehiculo?.Marca} {vehiculo?.Modelo}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-2 hover:bg-surface-secondary rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Error</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Tipo de Servicio */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Tipo de Servicio <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <select
                  value={formData.tipo_servicio}
                  onChange={(e) => handleFormChange('tipo_servicio', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 ${
                    formErrors.tipo_servicio
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-gray-300 focus:ring-primary/50'
                  }`}
                >
                  <option value="">Seleccionar...</option>
                  {opciones.tipos_servicio.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
              {formErrors.tipo_servicio && (
                <p className="text-red-400 text-xs mt-1">{formErrors.tipo_servicio}</p>
              )}
            </div>

            {/* Fecha Programada */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Fecha Programada <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="date"
                  value={formData.fecha_programada}
                  onChange={(e) => handleFormChange('fecha_programada', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 ${
                    formErrors.fecha_programada
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-gray-300 focus:ring-primary/50'
                  }`}
                />
              </div>
              {formErrors.fecha_programada && (
                <p className="text-red-400 text-xs mt-1">{formErrors.fecha_programada}</p>
              )}
            </div>

            {/* Hora Programada */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Hora Programada <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="time"
                  value={formData.hora_programada}
                  onChange={(e) => handleFormChange('hora_programada', e.target.value)}
                  step="1800"
                  min="09:00"
                  max="19:00"
                  className={`w-full pl-10 pr-4 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 ${
                    formErrors.hora_programada
                      ? 'border-red-500 focus:ring-red-500/50'
                      : 'border-gray-300 focus:ring-primary/50'
                  }`}
                />
              </div>
              {formErrors.hora_programada && (
                <p className="text-red-400 text-xs mt-1">{formErrors.hora_programada}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">Agenda solo de lunes a viernes en bloques de 30 minutos (09:00 - 19:00).</p>
            </div>

            {/* Grid de 2 columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kilometraje Actual */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Kilometraje Actual <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    value={formData.kilometraje_servicio}
                    onChange={(e) => handleFormChange('kilometraje_servicio', e.target.value)}
                    min="0"
                    className={`w-full pl-10 pr-4 py-2 bg-surface-secondary border rounded-lg text-white focus:outline-none focus:ring-2 ${
                      formErrors.kilometraje_servicio
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-gray-700 focus:ring-primary/50'
                    }`}
                  />
                </div>
                {formErrors.kilometraje_servicio && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.kilometraje_servicio}</p>
                )}
              </div>

              {/* Próximo Servicio KM */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Próximo Servicio (km) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    value={formData.proximo_servicio_km}
                    onChange={(e) => handleFormChange('proximo_servicio_km', e.target.value)}
                    min="0"
                    className={`w-full pl-10 pr-4 py-2 bg-surface-secondary border rounded-lg text-white focus:outline-none focus:ring-2 ${
                      formErrors.proximo_servicio_km
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-gray-700 focus:ring-primary/50'
                    }`}
                  />
                </div>
                {formErrors.proximo_servicio_km && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.proximo_servicio_km}</p>
                )}
              </div>
            </div>

            {/* Taller */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Taller
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <select
                  value={formData.taller}
                  onChange={(e) => handleFormChange('taller', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Seleccionar taller (opcional)...</option>
                  {opciones.talleres.map((taller) => (
                    <option key={taller} value={taller}>{taller}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Monto Estimado */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Monto Estimado
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="number"
                  value={formData.monto_estimado}
                  onChange={(e) => handleFormChange('monto_estimado', e.target.value)}
                  min="0"
                  step="10"
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Observaciones
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => handleFormChange('observaciones', e.target.value)}
                  rows="3"
                  placeholder="Detalles adicionales del servicio..."
                  className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-700 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-surface-secondary border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-all disabled:opacity-50 font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleProgramar}
            disabled={saving || loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-500 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Programando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Programar Mantenimiento
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProgramarMantenimientoModal;
