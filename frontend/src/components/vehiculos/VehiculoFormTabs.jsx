// frontend/src/components/vehiculos/VehiculoFormTabs.jsx
import React, { useState } from 'react';
import { 
  Car, Wrench, Shield, Calendar, DollarSign, 
  Calculator, TrendingUp, User, UserPlus, FileText,
  Settings, Download, AlertCircle
} from 'lucide-react';
import { useVehiculoForm } from '../../contexts/VehiculoFormContext.jsx';

const VehiculoFormTabs = () => {
  // ========== OBTENER TODO DEL CONTEXT (INCLUYENDO VALIDACIÓN) ==========
  const {
    vehiculo,
    formData,
    setFormData,
    guardando,
    opcionesDinamicas,
    datosInversion,
    setDatosInversion,
    requiereInversion,
    setRequiereInversion,
    inversionistaSeleccionado,
    setInversionistaSeleccionado,
    calculosInversion,
    setShowCalculadora,
    setShowModalInversionista,
    formatCurrency,
    isFormValid,
    validationErrors
  } = useVehiculoForm();

  const [activeTab, setActiveTab] = useState('general');

  // ========== HANDLERS PARA ACCIONES RÁPIDAS ==========
  
  const handleAsignarConductor = () => {
    console.log('🚀 Abrir modal de conductores disponibles');
    alert('Funcionalidad: Asignar Conductor\n\nSe abrirá modal con conductores disponibles (sin vehículo asignado)');
  };

  const handleVerContrato = () => {
    console.log('📄 Abrir modal de contrato');
    alert('Funcionalidad: Ver Contrato\n\nSe mostrará el contrato del conductor asignado al vehículo');
  };

  const handleAbrirMantenimiento = () => {
    console.log('🔧 Abrir modal de mantenimiento con datos del vehículo');
    alert(`Funcionalidad: Mantenimiento\n\nSe abrirá modal con datos pre-llenados:\n- Vehículo: ${formData.NumeroVehiculo}\n- Kilometraje: ${formData.KilometrajeActual} km`);
  };

  const handleGenerarReporte = () => {
    console.log('📊 Generar reporte inteligente del vehículo');
    alert(`Funcionalidad: Generar Reporte\n\nSe generará un reporte completo con:\n- Estado del vehículo\n- Historial de mantenimiento\n- Asignaciones\n- Inversión (si aplica)\n\nFormato: Excel descargable`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ========== TABS NAVIGATION CON INDICADORES DE ERROR ========== */}
      <div className="flex border-b border-primary/20 bg-surface-secondary/50 px-4 sm:px-6 overflow-x-auto">
        {/* TAB GENERAL */}
        <button
          onClick={() => setActiveTab('general')}
          className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            !isFormValid && validationErrors.general 
              ? 'text-red-400 border-b-2 border-red-400' 
              : activeTab === 'general' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Car className="w-4 h-4" />
          General
          {!isFormValid && validationErrors.general && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
        </button>

        {/* TAB TÉCNICO */}
        <button
          onClick={() => setActiveTab('tecnico')}
          className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'tecnico' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Técnico
        </button>

        {/* TAB SEGURO */}
        <button
          onClick={() => setActiveTab('seguro')}
          className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            !isFormValid && validationErrors.seguro 
              ? 'text-red-400 border-b-2 border-red-400' 
              : activeTab === 'seguro' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          Seguro
          {!isFormValid && validationErrors.seguro && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
        </button>

        {/* TAB MANTENIMIENTO */}
        <button
          onClick={() => setActiveTab('mantenimiento')}
          className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            !isFormValid && validationErrors.mantenimiento 
              ? 'text-red-400 border-b-2 border-red-400' 
              : activeTab === 'mantenimiento' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Mantenimiento
          {!isFormValid && validationErrors.mantenimiento && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
        </button>

        {/* TAB INVERSIÓN - AHORA SIEMPRE VISIBLE */}
        <button
          onClick={() => setActiveTab('inversion')}
          className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            !isFormValid && validationErrors.inversion 
              ? 'text-red-400 border-b-2 border-red-400' 
              : activeTab === 'inversion' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Inversión
          {!isFormValid && validationErrors.inversion && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ========== TAB GENERAL ========== */}
        {activeTab === 'general' && (
          <div className="space-y-4 sm:space-y-6">
            {/* ACCIONES RÁPIDAS - Solo en modo edición */}
            {vehiculo && (
              <div className="bg-gradient-to-br from-primary/10 to-surface-secondary/50 p-4 rounded-lg border border-primary/30 shadow-lg">
                <h3 className="font-semibold text-white mb-3 text-sm sm:text-base flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Acciones Rápidas
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={handleAsignarConductor}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all transform hover:scale-105 text-xs sm:text-sm font-medium shadow-md"
                    disabled={guardando}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {formData.ConductorAsignadoId ? 'Cambiar' : 'Asignar'} Conductor
                    </span>
                    <span className="sm:hidden">Conductor</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleVerContrato}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all transform hover:scale-105 text-xs sm:text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    disabled={guardando || !formData.ConductorAsignadoId}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Ver Contrato</span>
                    <span className="sm:hidden">Contrato</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleAbrirMantenimiento}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all transform hover:scale-105 text-xs sm:text-sm font-medium shadow-md"
                    disabled={guardando}
                  >
                    <Wrench className="w-4 h-4" />
                    <span className="hidden sm:inline">Mantenimiento</span>
                    <span className="sm:hidden">Taller</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleGenerarReporte}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all transform hover:scale-105 text-xs sm:text-sm font-medium shadow-md"
                    disabled={guardando}
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Generar Reporte</span>
                    <span className="sm:hidden">Reporte</span>
                  </button>
                </div>
                
                {formData.ConductorAsignadoId && (
                  <div className="mt-3 p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-xs text-blue-300 flex items-center gap-2">
                      <User className="w-3.5 h-3.5" />
                      Conductor asignado: <span className="font-bold">ID #{formData.ConductorAsignadoId}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Identificación del vehículo */}
            <div className="bg-surface-secondary/50 p-3 sm:p-4 rounded-lg space-y-4 border border-gray-700">
              <h3 className="font-semibold text-primary flex items-center gap-2 text-sm sm:text-base">
                <Car className="w-4 h-4 sm:w-5 sm:h-5" />
                Identificación del Vehículo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Número de Vehículo
                  </label>
                  <input
                    type="text"
                    value={formData.NumeroVehiculo || `${formData.TipoSocio}-${formData.NumeroUnidad}`}
                    onChange={(e) => setFormData({...formData, NumeroVehiculo: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="SD-0001"
                    disabled={guardando}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Tipo de Socio *
                  </label>
                  <select
                    value={formData.TipoSocio}
                    onChange={(e) => setFormData({...formData, TipoSocio: e.target.value})}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && !formData.TipoSocio
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    required
                    disabled={guardando}
                  >
                    {opcionesDinamicas.tipoSocio.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Número de Unidad *
                  </label>
                  <input
                    type="number"
                    value={formData.NumeroUnidad}
                    onChange={(e) => setFormData({...formData, NumeroUnidad: e.target.value})}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && !formData.NumeroUnidad
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    placeholder="1, 2, 3..."
                    required
                    disabled={guardando}
                  />
                  {!isFormValid && !formData.NumeroUnidad && (
                    <p className="text-red-400 text-xs mt-1">El número de unidad es requerido</p>
                  )}
                </div>
              </div>
            </div>

            {/* Información básica */}
            <div className="bg-surface-secondary/50 p-3 sm:p-4 rounded-lg space-y-4 border border-gray-700">
              <h3 className="font-semibold text-primary text-sm sm:text-base">Información Básica</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Marca *
                  </label>
                  <input
                    type="text"
                    value={formData.Marca}
                    onChange={(e) => setFormData({...formData, Marca: e.target.value})}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && !formData.Marca
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    required
                    disabled={guardando}
                    list="marcas-list"
                  />
                  <datalist id="marcas-list">
                    {opcionesDinamicas.marcas.map(marca => (
                      <option key={marca} value={marca} />
                    ))}
                  </datalist>
                  {!isFormValid && !formData.Marca && (
                    <p className="text-red-400 text-xs mt-1">La marca es requerida</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    value={formData.Modelo}
                    onChange={(e) => setFormData({...formData, Modelo: e.target.value})}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && !formData.Modelo
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    required
                    disabled={guardando}
                    list="modelos-list"
                  />
                  <datalist id="modelos-list">
                    {opcionesDinamicas.modelos.map(modelo => (
                      <option key={modelo} value={modelo} />
                    ))}
                  </datalist>
                  {!isFormValid && !formData.Modelo && (
                    <p className="text-red-400 text-xs mt-1">El modelo es requerido</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Año *
                  </label>
                  <input
                    type="number"
                    value={formData.Año}
                    onChange={(e) => setFormData({...formData, Año: e.target.value})}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && (!formData.Año || formData.Año < 1990 || formData.Año > new Date().getFullYear() + 1)
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    min="1990"
                    max={new Date().getFullYear() + 1}
                    required
                    disabled={guardando}
                  />
                  {!isFormValid && (!formData.Año || formData.Año < 1990 || formData.Año > new Date().getFullYear() + 1) && (
                    <p className="text-red-400 text-xs mt-1">Año inválido (1990-{new Date().getFullYear() + 1})</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Placa *
                  </label>
                  <input
                    type="text"
                    value={formData.Placa}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      if (value.length <= 10) {
                        setFormData({...formData, Placa: value});
                      }
                    }}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && !formData.Placa
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    placeholder="ABC-123-A"
                    required
                    disabled={guardando}
                  />
                  {!isFormValid && !formData.Placa && (
                    <p className="text-red-400 text-xs mt-1">La placa es requerida</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Color
                  </label>
                  <select
                    value={formData.Color}
                    onChange={(e) => setFormData({...formData, Color: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={guardando}
                  >
                    {opcionesDinamicas.color.map(color => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Estado *
                  </label>
                  <select
                    value={formData.Estado}
                    onChange={(e) => setFormData({...formData, Estado: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                    disabled={guardando}
                  >
                    {opcionesDinamicas.estado.map(estado => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={formData.Observaciones}
                  onChange={(e) => setFormData({...formData, Observaciones: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows="3"
                  placeholder="Notas adicionales..."
                  disabled={guardando}
                />
              </div>
            </div>
          </div>
        )}

        {/* ========== TAB TÉCNICO ========== */}
        {activeTab === 'tecnico' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-surface-secondary/50 p-3 sm:p-4 rounded-lg space-y-4 border border-gray-700">
              <h3 className="font-semibold text-primary flex items-center gap-2 text-sm sm:text-base">
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
                Especificaciones Técnicas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Tipo de Vehículo
                  </label>
                  <select
                    value={formData.TipoVehiculo}
                    onChange={(e) => setFormData({...formData, TipoVehiculo: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={guardando}
                  >
                    {opcionesDinamicas.tipoVehiculo.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Tipo de Combustible
                  </label>
                  <select
                    value={formData.TipoCombustible}
                    onChange={(e) => setFormData({...formData, TipoCombustible: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={guardando}
                  >
                    {opcionesDinamicas.tipoCombustible.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Número de Serie (VIN) *
                  </label>
                  <input
                    type="text"
                    value={formData.NumeroSerie}
                    onChange={(e) => setFormData({...formData, NumeroSerie: e.target.value.toUpperCase()})}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && !formData.NumeroSerie
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    placeholder="3N1CN7AP0FL123456"
                    required
                    disabled={guardando || vehiculo}
                  />
                  {!isFormValid && !formData.NumeroSerie && (
                    <p className="text-red-400 text-xs mt-1">El número de serie es requerido</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Número de Motor
                  </label>
                  <input
                    type="text"
                    value={formData.NumeroMotor}
                    onChange={(e) => setFormData({...formData, NumeroMotor: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="HR16DE123456"
                    disabled={guardando}
                    maxLength={30}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== TAB SEGURO ========== */}
        {activeTab === 'seguro' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-surface-secondary/50 p-3 sm:p-4 rounded-lg space-y-4 border border-gray-700">
              <h3 className="font-semibold text-primary flex items-center gap-2 text-sm sm:text-base">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                Información del Seguro
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Número de Póliza
                  </label>
                  <input
                    type="text"
                    value={formData.PolizaSeguro}
                    onChange={(e) => setFormData({...formData, PolizaSeguro: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="POL-2024-001"
                    disabled={guardando}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Vencimiento de Póliza
                  </label>
                  <input
                    type="date"
                    value={formData.PolizaVencimiento ? formData.PolizaVencimiento.split('T')[0] : ''}
                    onChange={(e) => setFormData({...formData, PolizaVencimiento: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={guardando}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Monto Deducible
                  </label>
                  <input
                    type="number"
                    value={formData.MontoDeducible}
                    onChange={(e) => setFormData({...formData, MontoDeducible: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    disabled={guardando}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    ID Póliza (Sistema)
                  </label>
                  <input
                    type="number"
                    value={formData.PolizaSeguroId || ''}
                    onChange={(e) => setFormData({...formData, PolizaSeguroId: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="ID interno"
                    disabled={guardando}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== TAB MANTENIMIENTO ========== */}
        {activeTab === 'mantenimiento' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-surface-secondary/50 p-3 sm:p-4 rounded-lg space-y-4 border border-gray-700">
              <h3 className="font-semibold text-primary flex items-center gap-2 text-sm sm:text-base">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                Información de Mantenimiento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Kilometraje Actual
                  </label>
                  <input
                    type="number"
                    value={formData.KilometrajeActual}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      if (value >= 0) {
                        setFormData({...formData, KilometrajeActual: value});
                      }
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    min="0"
                    disabled={guardando}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Próximo Mantenimiento (km)
                  </label>
                  <input
                    type="number"
                    value={formData.ProximoMantenimiento}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setFormData({...formData, ProximoMantenimiento: value});
                    }}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && formData.ProximoMantenimiento < formData.KilometrajeActual
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    min={formData.KilometrajeActual || 0}
                    disabled={guardando}
                  />
                  {!isFormValid && formData.ProximoMantenimiento && formData.ProximoMantenimiento < formData.KilometrajeActual && (
                    <p className="text-red-400 text-xs mt-1">Debe ser mayor al kilometraje actual</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Intervalo de Mantenimiento (km)
                  </label>
                  <input
                    type="number"
                    value={formData.IntervaloMantenimiento}
                    onChange={(e) => setFormData({...formData, IntervaloMantenimiento: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="10000"
                    min="1000"
                    step="1000"
                    disabled={guardando}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Fecha Último Servicio
                  </label>
                  <input
                    type="date"
                    value={formData.FechaUltimoServicio ? formData.FechaUltimoServicio.split('T')[0] : ''}
                    onChange={(e) => setFormData({...formData, FechaUltimoServicio: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    max={new Date().toISOString().split('T')[0]}
                    disabled={guardando}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== TAB INVERSIÓN - NUEVA LÓGICA ========== */}
        {activeTab === 'inversion' && (
          <div className="space-y-4 sm:space-y-6">
            {/* ========== MODO EDICIÓN - MOSTRAR DATOS EXISTENTES ========== */}
            {vehiculo && (
              <>
                {/* SI ES SOCIO DUEÑO (SD) */}
                {formData.TipoSocio === 'SD' && (
                  <div className="bg-surface-secondary/50 p-3 sm:p-4 rounded-lg space-y-4 border border-green-500/30">
                    <h3 className="font-semibold text-green-400 flex items-center gap-2 text-sm sm:text-base">
                      <Car className="w-4 h-4 sm:w-5 sm:h-5" />
                      Información de Corrida - Socio Dueño (SD)
                    </h3>
                    
                    {vehiculo.total_corrida ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-gray-400 text-xs mb-1">Corrida Total (Deuda)</p>
                            <p className="text-white font-bold text-lg">{formatCurrency(vehiculo.total_corrida)}</p>
                          </div>
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-gray-400 text-xs mb-1">Multiplicador</p>
                            <p className="text-green-400 font-bold text-lg">{vehiculo.multiplicador_corrida}x</p>
                          </div>
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-gray-400 text-xs mb-1">Plazo</p>
                            <p className="text-primary font-bold text-lg">{vehiculo.plazo_corrida} meses</p>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
                          <p className="text-green-300 text-sm">
                            ✓ Este vehículo tiene un plan de <strong>Socio Dueño (SD)</strong>. El conductor está pagando una corrida de{' '}
                            <strong>{formatCurrency(vehiculo.total_corrida)}</strong> en <strong>{vehiculo.plazo_corrida} meses</strong>{' '}
                            para quedarse con el vehículo.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-center">
                        <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                        <p className="text-yellow-300 text-sm">
                          Este vehículo SD fue creado antes de la implementación del sistema de corridas.
                          Los datos de inversión no están disponibles.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* SI ES SI_LEGADO O SI */}
                {(formData.TipoSocio === 'SI' || formData.TipoSocio === 'SA') && (
                  <div className="bg-surface-secondary/50 p-3 sm:p-4 rounded-lg space-y-4 border border-blue-500/30">
                    <h3 className="font-semibold text-blue-400 flex items-center gap-2 text-sm sm:text-base">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                      Información de Inversión - SI Legado
                    </h3>
                    
                    <div className="p-4 bg-gray-800/50 rounded-lg text-center">
                      <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm mb-3">
                        Este vehículo no tiene un plan de inversión asociado.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          alert('Funcionalidad: Asignar Inversión Manualmente\n\nSe abrirá un modal para vincular este vehículo con un inversionista y crear el plan de inversión.');
                        }}
                        className="px-4 py-2 bg-primary text-dark font-semibold rounded-lg hover:bg-primary-light transition-colors text-sm"
                      >
                        Asignar Inversión Manualmente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* ========== MODO CREACIÓN - FORMULARIO NORMAL ========== */}
            {!vehiculo && (
              <div className="bg-surface-secondary/50 p-3 sm:p-4 rounded-lg space-y-4 border border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-primary flex items-center gap-2 text-sm sm:text-base">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                    Información de Inversión
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiereInversion}
                      onChange={(e) => setRequiereInversion(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary"
                      disabled={guardando}
                    />
                    <span className="text-gray-300 text-xs sm:text-sm font-medium">¿Requiere inversión?</span>
                  </label>
                </div>

                {requiereInversion && (
                  <>
                    <div className="p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs sm:text-sm font-medium text-gray-300">
                          Inversionista *
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowModalInversionista(true)}
                          className="px-3 py-1 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors text-xs sm:text-sm"
                          disabled={guardando}
                        >
                          {inversionistaSeleccionado ? 'Cambiar' : 'Seleccionar'}
                        </button>
                      </div>
                      {inversionistaSeleccionado ? (
                        <div className="flex items-center gap-3 p-2 bg-gray-900/50 rounded">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/20 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{inversionistaSeleccionado.nombre}</p>
                            <p className="text-gray-400 text-xs">
                              Tasa: {inversionistaSeleccionado.tasa_rendimiento || datosInversion.tasa_rendimiento}%
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className={`p-3 rounded-lg border-2 border-dashed ${
                          !isFormValid && validationErrors.inversion
                            ? 'border-red-500 bg-red-500/5'
                            : 'border-gray-600'
                        }`}>
                          <p className="text-gray-500 italic text-xs sm:text-sm text-center">
                            {!isFormValid && validationErrors.inversion 
                              ? '⚠️ Debe seleccionar un inversionista' 
                              : 'No hay inversionista seleccionado'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                          Valor Factura *
                        </label>
                        <input
                          type="number"
                          value={datosInversion.valor_factura}
                          onChange={(e) => setDatosInversion({...datosInversion, valor_factura: e.target.value})}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="250000"
                          required={requiereInversion}
                          disabled={guardando}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                          Renta Diaria *
                        </label>
                        <input
                          type="number"
                          value={datosInversion.renta_diaria}
                          onChange={(e) => setDatosInversion({...datosInversion, renta_diaria: e.target.value})}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="400"
                          required={requiereInversion}
                          disabled={guardando}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                          Plazo (meses) *
                        </label>
                        <select
                          value={datosInversion.plazo_meses}
                          onChange={(e) => setDatosInversion({...datosInversion, plazo_meses: e.target.value})}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          required={requiereInversion}
                          disabled={guardando}
                        >
                          <option value="12">12 meses</option>
                          <option value="18">18 meses</option>
                          <option value="24">24 meses</option>
                          <option value="36">36 meses</option>
                          <option value="48">48 meses</option>
                          <option value="62">62 meses</option>
                          <option value="68">68 meses</option>
                        </select>
                      </div>
                    </div>

                    {calculosInversion && (
                      <div className="mt-4 p-3 sm:p-4 bg-gray-900/50 rounded-lg border border-primary/30">
                        <h4 className="font-semibold text-primary mb-3 flex items-center gap-2 text-xs sm:text-sm">
                          <TrendingUp className="w-4 h-4" />
                          Resumen de Inversión
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <p className="text-gray-400 text-xs">Inversión Inicial</p>
                            <p className="text-white font-semibold text-sm">{formatCurrency(calculosInversion.inversion)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Total Corrida</p>
                            <p className="text-white font-semibold text-sm">{formatCurrency(calculosInversion.total_corrida)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Rendimiento</p>
                            <p className="text-green-400 font-semibold text-sm">{formatCurrency(calculosInversion.socio_inversionista_rendimiento)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Utilidad</p>
                            <p className="text-primary font-semibold text-sm">{formatCurrency(calculosInversion.utilidad_empresa)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowCalculadora(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        disabled={guardando}
                      >
                        <Calculator className="w-4 h-4" />
                        Abrir Calculadora
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehiculoFormTabs;