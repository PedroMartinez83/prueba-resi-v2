// frontend/src/components/vehiculos/VehiculoFormTabs.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Car, Wrench, Shield, Calendar, DollarSign,
  Calculator, TrendingUp, User, FileText,
  Settings, Download, AlertCircle
} from 'lucide-react';
import { useVehiculoForm } from '../../contexts/VehiculoFormContext.jsx';
import adminService from '../../services/adminService';


const AutocompleteInput = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  required,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  const texto = (value || '').toString().trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    !texto || option.toLowerCase().includes(texto)
  );


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const selectOption = (option) => {
    onChange(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!filteredOptions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev <= 0 ? filteredOptions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && isOpen && highlightedIndex >= 0) {
      e.preventDefault();
      selectOption(filteredOptions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
      />

      {isOpen && !disabled && filteredOptions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-600 bg-gray-900 shadow-xl">
          {filteredOptions.map((option, index) => (
            <button
              key={option}
              type="button"
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                index === highlightedIndex
                  ? 'bg-primary/20 text-white'
                  : 'text-gray-200 hover:bg-gray-800'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(option);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
  //  AGREGA ESTOS DOS ESPIAS AQUÍ MISMO 
    // Estado para guardar la lista de pólizas
  const [listaPolizas, setListaPolizas] = useState([]);
  const [activeTab, setActiveTab] = useState('general');
  const { formData: vehiculoFormData } = useVehiculoForm();
  const [opcionesVehiculo, setOpcionesVehiculo] = useState({});
  

    // 📥 Cargar pólizas al iniciar
  useEffect(() => {
    // 1. Cargar Pólizas
    const cargarPolizasSeguro = async () => {
      try {
        const response = await adminService.getPolizasSeguro();
        if (response.success) {
          setListaPolizas(response.polizas || response.data || []); 
        }
      } catch (error) {
        console.error('❌ Error al cargar pólizas:', error);
      }
    };

    //  2. NUEVO: Cargar Opciones de Vehículos (Marcas y Modelos de la BD) 
    const cargarOpciones = async () => {
      try {
        const response = await adminService.getOpcionesVehiculos();
        if (response.success) {
          setOpcionesVehiculo(response.opciones); // Guardamos TODO lo que manda el backend
        }
      } catch (error) {
        console.error('❌ Error al cargar opciones de vehículos:', error);
      }
    };

    cargarPolizasSeguro();
    cargarOpciones(); // Llamamos a la nueva función
  }, []); // Se ejecuta una sola vez al cargar

  // ========== HANDLERS PARA ACCIONES RÁPIDAS ==========
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

  const numeroVehiculoGenerado = formData.NumeroUnidad
    ? `${formData.TipoSocio}-${String(formData.NumeroUnidad).padStart(4, '0')}`
    : (formData.NumeroVehiculo || '');
  const vinLength = (formData.NumeroSerie || '').length;
  const vinIncompleto = !vehiculo && vinLength > 0 && vinLength < 17;
  const vinInvalidoVisual = (!isFormValid && !formData.NumeroSerie) || vinIncompleto;

  //  LA MAGIA NUEVA CONECTADA A LA BD 
  // Extraemos las listas directamente del estado que vino de la base de datos
  const marcasCatalogo = opcionesVehiculo?.marcas || [];
  const modelosDisponibles = opcionesVehiculo?.marcasModelos?.[formData.Marca] || [];


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


        {/* TAB FINANCIERO (ANTES INVERSIÓN) */}
        <button
          onClick={() => setActiveTab('inversion')} // Dejamos el id 'inversion' para no romper otros estados, pero visualmente es Financiero
          className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            !isFormValid && validationErrors.inversion 
              ? 'text-red-400 border-b-2 border-red-400' 
              : activeTab === 'inversion' 
              ? 'text-primary border-b-2 border-primary' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Financiero
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
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
                <div className="order-3 sm:order-3">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Número de Vehículo
                  </label>
                  <input
                    type="text"
                    value={numeroVehiculoGenerado}
                    readOnly
                    className="w-full px-3 py-2 bg-gray-800/70 border border-gray-600 rounded-lg text-white text-sm focus:outline-none cursor-not-allowed"
                    placeholder="SD-0001"
                    disabled
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Se genera automaticamente y no se edita manualmente.
                  </p>
                </div>
                <div className="order-2 sm:order-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Tipo de Socio *
                  </label>
                  <select
                    value={formData.TipoSocio}
                    onChange={(e) => {
                      const nuevoTipo = e.target.value;
                      
                      // 1. Actualizamos el Tipo de Socio
                      setFormData({ ...formData, TipoSocio: nuevoTipo });

                      // 2. 🚨 CONECTAMOS DIRECTO A LA CALCULADORA 🚨
                      setDatosInversion(prev => {
                        // El nuevo piso dependiendo del socio
                        const minRequerido = nuevoTipo === 'SI' ? 62 : 12;
                        const plazoActual = prev.plazo_meses || 48;

                        // Si el plazo actual es menor al que exige el nuevo socio, lo subimos.
                        const nuevoPlazo = plazoActual < minRequerido ? minRequerido : plazoActual;

                        return { ...prev, plazo_meses: nuevoPlazo };
                      });
                    }}
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
                <div className="order-1 sm:order-1">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Número de Unidad *
                  </label>
                  <input
                    type="number"
                    value={formData.NumeroUnidad}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d{0,4}$/.test(value)) {
                        setFormData({...formData, NumeroUnidad: value});
                      }
                    }}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && !formData.NumeroUnidad
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    placeholder="1, 2, 3..."
                    min="0"
                    max="9999"
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
                {/* CAMPO MARCA */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Marca *
                  </label>
                  <select
                    value={formData.Marca}
                    onChange={(e) => {
                      // Al cambiar la marca, actualizamos y limpiamos el modelo
                      setFormData({
                        ...formData, 
                        Marca: e.target.value,
                        Modelo: '' // 👈 Limpiamos el modelo para no dejar inconsistencias
                      });
                    }}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      !isFormValid && !formData.Marca
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    required
                    disabled={guardando}
                  >
                    <option value="">Selecciona una marca</option>
                    {marcasCatalogo.map((marca, index) => (
                      <option key={`marca-${index}`} value={marca}>
                        {marca}
                      </option>
                    ))}
                  </select>
                  {!isFormValid && !formData.Marca && (
                    <p className="text-red-400 text-xs mt-1">La marca es requerida</p>
                  )}
                </div>

                {/* CAMPO MODELO */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Modelo *
                  </label>
                  <select
                    value={formData.Modelo}
                    onChange={(e) => setFormData({...formData, Modelo: e.target.value})}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 transition-opacity ${
                      !isFormValid && !formData.Modelo
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    } ${!formData.Marca ? 'opacity-50 cursor-not-allowed bg-gray-900' : ''}`}
                    required
                    disabled={guardando || !formData.Marca} // 👈 ¡AQUÍ ESTÁ EL CANDADO!
                  >
                    <option value="">
                      {!formData.Marca ? 'Selecciona primero una marca' : 'Selecciona un modelo'}
                    </option>
                    {modelosDisponibles.map((modelo, index) => (
                      <option key={`modelo-${index}`} value={modelo}>
                        {modelo}
                      </option>
                    ))}
                  </select>
                  {!isFormValid && !formData.Modelo && formData.Marca && (
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
                    onChange={(e) => {
                      const vin = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 17);
                      setFormData({...formData, NumeroSerie: vin});
                    }}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      vinInvalidoVisual
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    placeholder="3N1CN7AP0FL123456"
                    maxLength={17}
                    required
                    disabled={guardando || vehiculo}
                  />
                  {!isFormValid && !formData.NumeroSerie && (
                    <p className="text-red-400 text-xs mt-1">El número de serie es requerido</p>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className={`text-xs ${vinIncompleto ? 'text-yellow-400' : 'text-gray-400'}`}>
                      VIN: solo letras y números, exactamente 17 caracteres.
                    </p>
                    <span className={`text-xs ${
                      vinLength === 17 ? 'text-green-400' : vinLength > 0 ? 'text-yellow-400' : 'text-gray-500'
                    }`}>
                      {vinLength}/17
                    </span>
                  </div>
                  {vinIncompleto && (
                    <p className="text-yellow-400 text-xs mt-1">
                      El VIN está incompleto. Debe tener exactamente 17 caracteres.
                    </p>
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
                    value={formData.PolizaSeguro || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      // Usamos .toUpperCase() para convertir el texto
                      PolizaSeguro: e.target.value.toUpperCase() 
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                    placeholder="POL-2024-001"
                    disabled={guardando}
                  />
                </div>
                
                {/* 🚨 AQUÍ ESTÁ EL CAMPO VALIDADO (Vencimiento) */}
                <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Vencimiento de Póliza
                  </label>
                  <input
                    type="date"
                    value={formData.PolizaVencimiento ? formData.PolizaVencimiento.split('T')[0] : ''}
                    onChange={(e) => setFormData({...formData, PolizaVencimiento: e.target.value})}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 ${
                      /* FIX: Dependemos solo de la fecha, no de isFormValid */
                    formData.PolizaVencimiento && 
                      new Date(formData.PolizaVencimiento + 'T12:00:00') <= new Date().setHours(23,59,59,999)
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-600 focus:ring-primary'
                    }`}
                    disabled={guardando}
                  />
                  {/* FIX: Dependemos solo de la fecha, no de isFormValid */}
                  {formData.PolizaVencimiento && new Date(formData.PolizaVencimiento + 'T12:00:00') <= new Date().setHours(23,59,59,999) && (
                    <p className="text-red-400 text-xs mt-1">La póliza no puede vencer antes de mañana</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Monto Deducible
                  </label>
                  <input
                    type="number"
                    value={formData.MontoDeducible || ''}
                    onChange={(e) => setFormData({...formData, MontoDeducible: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    disabled={guardando}
                  />
                </div>
                {/* 🛡️ SELECTOR DE PÓLIZA INTELIGENTE */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Póliza de Seguro Asignada
                  </label>
                  <select
                    value={formData.PolizaSeguroId || ''}
                    onChange={(e) => {
                      // Si selecciona una póliza, la convertimos a número. Si elige "Sin póliza", mandamos null
                      const valor = e.target.value ? parseInt(e.target.value) : null;
                      setFormData({...formData, PolizaSeguroId: valor});
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={guardando}
                  >
                    <option value="">-- Sin póliza asignada --</option>
                    
                    {/* Iteramos sobre tu lista de pólizas */}
                    {listaPolizas.map((poliza) => (
                      <option key={poliza.id} value={poliza.id}>
                        {poliza.aseguradora} - {poliza.numero_poliza} (Vence: {new Date(poliza.fecha_vencimiento).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
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
                  {/* KILOMETRAJE ACTUAL */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Kilometraje Actual
                  </label>
                  <input
                    type="number"
                    value={formData.KilometrajeActual !== undefined ? formData.KilometrajeActual : 0}
                    onFocus={(e) => e.target.select()} /* 👈 Magia de selección */
                    onChange={(e) => {
                      // Limpiamos los ceros fantasma antes de convertir a número
                      const cleanValue = e.target.value.replace(/^0+(?=\d)/, '');
                      const value = parseInt(cleanValue) || 0;
                      if (value >= 0) {
                        setFormData({...formData, KilometrajeActual: value});
                      }
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    min="0"
                    disabled={guardando}
                  />
                </div>
                
                {/* PRÓXIMO MANTENIMIENTO */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Próximo Mantenimiento (km)
                  </label>
                  <input
                    type="number"
                    value={formData.ProximoMantenimiento !== undefined ? formData.ProximoMantenimiento : 0}
                    onFocus={(e) => e.target.select()} /* 👈 Magia de selección */
                    onChange={(e) => {
                      const cleanValue = e.target.value.replace(/^0+(?=\d)/, '');
                      const value = parseInt(cleanValue) || 0;
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
                  {!isFormValid && formData.ProximoMantenimiento > 0 && formData.ProximoMantenimiento < formData.KilometrajeActual && (
                    <p className="text-red-400 text-xs mt-1">Debe ser mayor al kilometraje actual</p>
                  )}
                </div>
                
                {/* INTERVALO DE MANTENIMIENTO */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">
                    Intervalo de Mantenimiento (km)
                  </label>
                  <input
                    type="number"
                    value={formData.IntervaloMantenimiento !== undefined ? formData.IntervaloMantenimiento : 0}
                    onFocus={(e) => e.target.select()} /* 👈 Magia de selección */
                    onChange={(e) => setFormData({
                      ...formData, 
                      IntervaloMantenimiento: e.target.value.replace(/^0+(?=\d)/, '')
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0"
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
{/* ========== TAB INVERSIÓN (RESTAURO DEL FLUJO CON CALCULADORA) ========== */}
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
                          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <p className="text-gray-400 text-[10px] sm:text-xs uppercase mb-1">Precio Compra</p>
                            <p className="text-white font-medium">{formatCurrency(vehiculo.precio_compra || 0)}</p>
                          </div>
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-gray-400 text-xs mb-1">Corrida Total (Deuda)</p>
                            <p className="text-white font-bold text-lg">{formatCurrency(vehiculo.total_corrida)}</p>
                          </div>
                          <div className="p-3 bg-gray-800/50 rounded-lg">
                            <p className="text-gray-400 text-xs mb-1">Multiplicador</p>
                            <p className="text-green-400 font-bold text-lg">{vehiculo.multiplicador_corrida}x</p>
                          </div>
                        </div>

                        {/* BARRA DE PROGRESO */}
                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-300">Avance de Recuperación</span>
                            <span className="text-primary font-bold">{vehiculo.porcentaje_pagado}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-3">
                            <div 
                              className="bg-gradient-to-r from-primary to-green-400 h-3 rounded-full transition-all duration-500" 
                              style={{ width: `${Math.min(100, parseFloat(vehiculo.porcentaje_pagado || 0))}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between mt-2 text-xs">
                            <span className="text-gray-400">Recuperado: <span className="text-white">{formatCurrency(vehiculo.total_pagado_corrida)}</span></span>
                            <span className="text-gray-400">Pendiente: <span className="text-white">{formatCurrency(vehiculo.saldo_pendiente_corrida)}</span></span>
                          </div>
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
            
            {/* ========== MODO CREACIÓN - FORMULARIO NORMAL CON CALCULADORA ========== */}
            {!vehiculo && (
              <div className="bg-surface-secondary/50 p-3 sm:p-4 rounded-lg space-y-4 border border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-700 pb-4">
                  <div>
                    <h3 className="font-semibold text-primary flex items-center gap-2 text-sm sm:text-base">
                      <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                      Datos Financieros
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Usa la calculadora para generar la Corrida Total o ingresa los datos manualmente.
                    </p>
                  </div>
                  
                  {/* BOTÓN MÁGICO PARA ABRIR LA CALCULADORA GIGANTE */}
                  <button
                    type="button"
                    onClick={() => setShowCalculadora(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-light text-dark font-semibold rounded-lg hover:shadow-lg hover:shadow-primary/20 transition-all transform hover:-translate-y-0.5 text-sm"
                    disabled={guardando}
                  >
                    <Calculator className="w-4 h-4" />
                    Abrir Calculadora Inteligente
                  </button>
                </div>
                {/* CAMPOS FINANCIEROS (Bloqueados - Solo se llenan vía Calculadora Inteligente) */}
                <div className="mt-6 p-4 rounded-xl bg-cyan-900/10 border border-cyan-500/20">
                  {/* Aviso Intuitivo */}
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-xl">🤖</span>
                    <div>
                      <h4 className="text-sm font-semibold text-cyan-400">Cálculo Inteligente Requerido</h4>
                      <p className="text-xs text-gray-400 mt-1">
                        Para garantizar proyecciones financieras exactas, estos valores se bloquean y se calculan automáticamente. Usa la <b>Calculadora Inteligente</b> para llenarlos.
                      </p>
                    </div>
                  </div>

                  {/* Inputs Bloqueados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pointer-events-none opacity-60">
                    <div>
                      <label className="block text-xs sm:text-sm text-gray-400 mb-1">Valor Factura *</label>
                      <input
                        type="text"
                        value={datosInversion.valor_factura ? `$${datosInversion.valor_factura}` : 'Pendiente...'}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm text-gray-400 mb-1">Multiplicador *</label>
                      <input
                        type="text"
                        value={datosInversion.tasa_rendimiento ? `${datosInversion.tasa_rendimiento}x` : 'Pendiente...'}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm text-gray-400 mb-1">Plazo (meses) *</label>
                      <input
                        type="text"
                        value={datosInversion.plazo_meses ? `${datosInversion.plazo_meses} meses` : 'Pendiente...'}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* Si ya hay cálculos desde la calculadora, mostramos un resumen bonito */}
                {calculosInversion && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl border border-primary/30 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 bg-primary/20 text-primary text-xs font-bold rounded-bl-lg">
                      DATOS IMPORTADOS
                    </div>
                    <h4 className="font-semibold text-white mb-4 flex items-center gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Resumen de Corrida Aprobada
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Inversión (Factura+Gastos)</p>
                        <p className="text-white font-semibold">{formatCurrency(calculosInversion.inversionTotal || calculosInversion.inversion)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Total Corrida (Deuda)</p>
                        <p className="text-green-400 font-bold text-lg">{formatCurrency(calculosInversion.corridaTotal || calculosInversion.total_corrida)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Multiplicador</p>
                        <p className="text-white font-semibold">{calculosInversion.multiplicadorUsado || datosInversion.tasa_rendimiento}x</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-1">Renta Sugerida</p>
                        <p className="text-orange-400 font-semibold">{formatCurrency(calculosInversion.rentaDiaria || datosInversion.renta_diaria)}/día</p>
                      </div>
                    </div>
                  </div>
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
