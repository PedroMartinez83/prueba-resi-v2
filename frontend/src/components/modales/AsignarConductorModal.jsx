// frontend/src/components/modales/AsignarConductorModal.jsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  User, 
  Phone, 
  Mail, 
  Calendar,
  DollarSign,
  Shield,
  Star,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';
import adminService from '../../services/adminService';

const AsignarConductorModal = ({ isOpen, onClose, vehiculo, onSuccess }) => {
  const [conductores, setConductores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConductor, setSelectedConductor] = useState(null);
  
  // Datos del formulario de asignación
  const [formData, setFormData] = useState({
    rentaDiaria: 400,
    abonoPoliza: 100,
    fechaInicio: new Date().toISOString().split('T')[0]
  });

  const [formErrors, setFormErrors] = useState({});

  // Cargar conductores disponibles
  useEffect(() => {
    if (isOpen) {
      cargarConductoresDisponibles();
      resetForm();
    }
  }, [isOpen]);

  const cargarConductoresDisponibles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getConductoresDisponibles();
      
      if (response.success) {
        setConductores(response.conductores || []);
      } else {
        throw new Error(response.error || 'Error al cargar conductores');
      }
    } catch (err) {
      console.error('Error cargando conductores:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedConductor(null);
    setSearchTerm('');
    setFormData({
      rentaDiaria: 400,
      abonoPoliza: 100,
      fechaInicio: new Date().toISOString().split('T')[0]
    });
    setFormErrors({});
  };

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose();
    }
  };

  const handleSelectConductor = (conductor) => {
    setSelectedConductor(conductor);
    setFormErrors({});
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!selectedConductor) {
      errors.conductor = 'Debe seleccionar un conductor';
    }
    
    if (!formData.rentaDiaria || formData.rentaDiaria < 0) {
      errors.rentaDiaria = 'Ingrese una renta válida';
    }
    
    if (!formData.abonoPoliza || formData.abonoPoliza < 0) {
      errors.abonoPoliza = 'Ingrese un abono válido';
    }
    
    if (!formData.fechaInicio) {
      errors.fechaInicio = 'Seleccione una fecha de inicio';
    }
    
    return errors;
  };

  const handleAsignar = async () => {
    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await adminService.asignarConductorAVehiculo(vehiculo.id, {
        conductorId: selectedConductor.id,
        rentaDiaria: parseFloat(formData.rentaDiaria),
        abonoPoliza: parseFloat(formData.abonoPoliza),
        fechaInicio: formData.fechaInicio
      });
      
      if (response.success) {
        if (onSuccess) {
          await onSuccess(response);
        }
        handleClose();
      } else {
        throw new Error(response.error || 'Error al asignar conductor');
      }
    } catch (err) {
      console.error('Error asignando conductor:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtrar conductores por búsqueda
  const conductoresFiltrados = conductores.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.nombre?.toLowerCase().includes(term) ||
      c.telefono?.includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.ine?.includes(term)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="glass rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-primary/20 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Asignar Conductor
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Columna Izquierda: Lista de Conductores */}
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Buscar Conductor
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, teléfono, email o INE..."
                    className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {formErrors.conductor && (
                <p className="text-red-400 text-sm mb-4">{formErrors.conductor}</p>
              )}

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : conductoresFiltrados.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">
                      {searchTerm ? 'No se encontraron conductores' : 'No hay conductores disponibles'}
                    </p>
                  </div>
                ) : (
                  conductoresFiltrados.map((conductor) => (
                    <button
                      key={conductor.id}
                      onClick={() => handleSelectConductor(conductor)}
                      className={`w-full text-left p-4 rounded-lg transition-all border ${
                        selectedConductor?.id === conductor.id
                          ? 'bg-primary/20 border-primary'
                          : 'bg-surface-secondary border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-white truncate">
                              {conductor.nombre}
                            </h3>
                            {conductor.calificacion > 0 && (
                              <div className="flex items-center gap-1 text-yellow-400">
                                <Star className="w-3 h-3 fill-current" />
                                <span className="text-xs font-medium">
                                  {conductor.calificacion.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            {conductor.telefono && (
                              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Phone className="w-3 h-3" />
                                {conductor.telefono}
                              </p>
                            )}
                            {conductor.email && (
                              <p className="text-xs text-gray-400 flex items-center gap-1.5 truncate">
                                <Mail className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{conductor.email}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        {selectedConductor?.id === conductor.id && (
                          <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Columna Derecha: Formulario de Asignación */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4">
                Datos de la Asignación
              </h3>

              {selectedConductor ? (
                <div className="space-y-4">
                  {/* Conductor Seleccionado */}
                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Conductor Seleccionado</p>
                    <p className="text-white font-bold">{selectedConductor.nombre}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>ID: #{selectedConductor.id}</span>
                      {selectedConductor.categoria && (
                        <span>Categoría: {selectedConductor.categoria}</span>
                      )}
                    </div>
                  </div>

                  {/* Renta Diaria */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Renta Diaria <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="number"
                        value={formData.rentaDiaria}
                        onChange={(e) => handleFormChange('rentaDiaria', e.target.value)}
                        min="0"
                        step="10"
                        className={`w-full pl-10 pr-4 py-2 bg-surface-secondary border rounded-lg text-white focus:outline-none focus:ring-2 ${
                          formErrors.rentaDiaria
                            ? 'border-red-500 focus:ring-red-500/50'
                            : 'border-gray-700 focus:ring-primary/50'
                        }`}
                      />
                    </div>
                    {formErrors.rentaDiaria && (
                      <p className="text-red-400 text-xs mt-1">{formErrors.rentaDiaria}</p>
                    )}
                  </div>

                  {/* Abono Póliza */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Abono Póliza/Mantenimiento <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="number"
                        value={formData.abonoPoliza}
                        onChange={(e) => handleFormChange('abonoPoliza', e.target.value)}
                        min="0"
                        step="10"
                        className={`w-full pl-10 pr-4 py-2 bg-surface-secondary border rounded-lg text-white focus:outline-none focus:ring-2 ${
                          formErrors.abonoPoliza
                            ? 'border-red-500 focus:ring-red-500/50'
                            : 'border-gray-700 focus:ring-primary/50'
                        }`}
                      />
                    </div>
                    {formErrors.abonoPoliza && (
                      <p className="text-red-400 text-xs mt-1">{formErrors.abonoPoliza}</p>
                    )}
                  </div>

                  {/* Fecha Inicio */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Fecha de Inicio <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="date"
                        value={formData.fechaInicio}
                        onChange={(e) => handleFormChange('fechaInicio', e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 bg-surface-secondary border rounded-lg text-white focus:outline-none focus:ring-2 ${
                          formErrors.fechaInicio
                            ? 'border-red-500 focus:ring-red-500/50'
                            : 'border-gray-700 focus:ring-primary/50'
                        }`}
                      />
                    </div>
                    {formErrors.fechaInicio && (
                      <p className="text-red-400 text-xs mt-1">{formErrors.fechaInicio}</p>
                    )}
                  </div>

                  {/* Total Diario */}
                  <div className="p-4 bg-gradient-to-r from-green-500/10 to-primary/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Total Diario</p>
                    <p className="text-2xl font-bold text-white">
                      ${(parseFloat(formData.rentaDiaria || 0) + parseFloat(formData.abonoPoliza || 0)).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Mensual estimado: ${((parseFloat(formData.rentaDiaria || 0) + parseFloat(formData.abonoPoliza || 0)) * 30).toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">
                    Selecciona un conductor de la lista para continuar
                  </p>
                </div>
              )}
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
            onClick={handleAsignar}
            disabled={saving || !selectedConductor}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-primary text-white rounded-lg hover:from-green-500 hover:to-primary-light transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Asignando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Asignar Conductor
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AsignarConductorModal;
