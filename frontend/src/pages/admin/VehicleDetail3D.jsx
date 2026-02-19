// frontend/src/pages/admin/VehicleDetail3D.jsx
import React, { useState, useEffect, useRef } from 'react';
import VehicleConductorPanel from '../../components/VehicleConductorPanel';
import { useParams, useNavigate } from 'react-router-dom';
import VehicleInvestmentPanel from '../../components/VehicleInvestmentPanel';
import EditableField from '../../components/EditableField';
import adminService from '../../services/adminService';
import AsignarConductorModal from '../../components/modales/AsignarConductorModal';
import ProgramarMantenimientoModal from '../../components/modales/ProgramarMantenimientoModal';
import VerContratoModal from '../../components/modales/VerContratoModal';
import CambiarConductorModal from '../../components/modales/CambiarConductorModal';
import ModalRegistrarPago from '../../components/pagos/ModalRegistrarPago';
import { GenerarPDFButton } from '../../components/reportes/VehiculoPDFReport';
import AsignarInversionModal from '../../components/inversiones/AsignarInversionModal';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';

import { 
  ArrowLeft, 
  Car, 
  Calendar, 
  Fuel, 
  User, 
  Wrench,
  ClipboardList,
  AlertTriangle,
  Edit, 
  Save, 
  X,
  AlertCircle,
  Shield,
  FileText,
  CheckCircle,
  UserPlus,
  Settings,
  Download
} from 'lucide-react';
import VehicleDisplay from '../../components/VehicleDisplay';

const VehicleDetail3D = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Estados principales
  const [vehiculo, setVehiculo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para PDF
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [loadingPDFData, setLoadingPDFData] = useState(false);
  const [historialData, setHistorialData] = useState(null);
  const [imagenesGraficos, setImagenesGraficos] = useState({
    recuperacion: null,
    distribucion: null,
    qrCode: null
  });
  
  // Estados para edición inline por sección
  const [editingSection, setEditingSection] = useState(null);
  const [sectionData, setSectionData] = useState({});
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  
  // Tab activo
  const [activeTab, setActiveTab] = useState('general');
  const [showAsignarConductorModal, setShowAsignarConductorModal] = useState(false);
  const [showMantenimientoModal, setShowMantenimientoModal] = useState(false);
  const [showContratoModal, setShowContratoModal] = useState(false);
  const [showCambiarConductorModal, setShowCambiarConductorModal] = useState(false);
  const [showAsignarInversionModal, setShowAsignarInversionModal] = useState(false);
  const [showRegistrarPagoModal, setShowRegistrarPagoModal] = useState(false);
  const [conductorParaPago, setConductorParaPago] = useState(null);

  
  // Opciones para los campos select
  const [opcionesVehiculo, setOpcionesVehiculo] = useState({
    marcas: ['Nissan', 'BYD', 'Otro'],
    modelos: [],
    colores: ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Tinto'],
    estados: ['Disponible', 'Rentado', 'Mantenimiento', 'Baja', 'Siniestro', 'Asignado'],
    tiposSocio: ['SD', 'SI', 'SA'],
    tiposVehiculo: ['Sedan', 'SUV', 'Pickup', 'Van', 'Hatchback', 'Compacto'],
    tiposCombustible: ['Gasolina', 'Diesel', 'Híbrido', 'Eléctrico']
  });
  
  // Verificar si es super_admin
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = user.rol === 'super_admin' || user.role === 'super_admin';


  // ========== CARGAR DATOS DEL HISTORIAL PARA PDF ==========
  const cargarDatosParaPDF = async () => {
    try {
      setLoadingPDFData(true);
      const data = await adminService.getHistorialVehiculoById(id);
      setHistorialData(data);
      setShowPDFModal(true);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cargar datos para el reporte. Por favor intenta nuevamente.');
    } finally {
      setLoadingPDFData(false);
    }
  };

  // Cargar vehículo
  useEffect(() => {
    const fetchVehiculo = async () => {
      try {
        const response = await adminService.getVehiculoById(id);
        
        if (response.success && response.vehiculo) {
          setVehiculo(response.vehiculo);
        } else if (response && !response.success) {
          setVehiculo(response);
        } else {
          throw new Error('Estructura de datos inesperada');
        }
        
      } catch (err) {
        console.error('Error detallado al cargar vehículo:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchVehiculo();
    }
  }, [id]);

  // Cargar opciones dinámicamente
  useEffect(() => {
    const cargarOpciones = async () => {
      try {
        const response = await adminService.getOpcionesVehiculos();
        if (response.success && response.opciones) {
          setOpcionesVehiculo(prev => ({
            ...prev,
            ...response.opciones
          }));
        }
      } catch (error) {
        console.warn('Usando opciones por defecto:', error);
      }
    };
    cargarOpciones();
  }, []);

  // ========== EDICIÓN INLINE POR SECCIÓN ==========
  const startEditingSection = (section) => {
    setEditingSection(section);
    setSectionData({...vehiculo});
    setValidationErrors({});
  };

  const cancelEditingSection = () => {
    setEditingSection(null);
    setSectionData({});
    setValidationErrors({});
  };

  const handleFieldChange = (field, value) => {
    setSectionData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateSection = (section) => {
    const errors = {};
    
    if (section === 'general') {
      if (!sectionData.TipoSocio) errors.TipoSocio = 'Requerido';
      if (!sectionData.NumeroUnidad) errors.NumeroUnidad = 'Requerido';
      if (!sectionData.Marca) errors.Marca = 'Requerido';
      if (!sectionData.Modelo) errors.Modelo = 'Requerido';
      if (!sectionData.Año) errors.Año = 'Requerido';
      if (!sectionData.Placa) errors.Placa = 'Requerido';
      
      const currentYear = new Date().getFullYear();
      if (sectionData.Año && (sectionData.Año < 2000 || sectionData.Año > currentYear + 1)) {
        errors.Año = `Debe estar entre 2000 y ${currentYear + 1}`;
      }
    }
    
    if (section === 'mantenimiento') {
      if (sectionData.ProximoMantenimiento && sectionData.KilometrajeActual) {
        if (parseInt(sectionData.ProximoMantenimiento) < parseInt(sectionData.KilometrajeActual)) {
          errors.ProximoMantenimiento = 'Debe ser mayor al kilometraje actual';
        }
      }
    }
    
    return errors;
  };

  const saveSectionChanges = async () => {
    const errors = validateSection(editingSection);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setSaving(true);
    
    try {
      const datosActualizados = {};
      
      Object.keys(sectionData).forEach(key => {
        if (sectionData[key] !== vehiculo[key] && 
            sectionData[key] !== undefined && 
            sectionData[key] !== null &&
            sectionData[key] !== '') {
          datosActualizados[key] = sectionData[key];
        }
      });
      
      if (Object.keys(datosActualizados).length === 0) {
        cancelEditingSection();
        setSaving(false);
        return;
      }
      
      const response = await adminService.updateVehiculo(vehiculo.id, datosActualizados);
      
      if (response.success) {
        setVehiculo(response.vehiculo);
        cancelEditingSection();
        alert(`✅ Sección actualizada exitosamente`);
      } else {
        throw new Error(response.error || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`❌ Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ========== ACCIONES CONTEXTUALES INTELIGENTES ==========
  const getContextualActions = () => {
    const kmActual = parseInt(vehiculo.KilometrajeActual || 0);
    const kmProximo = parseInt(vehiculo.ProximoMantenimiento || 0);
    const kmDiferencia = kmProximo - kmActual;
    
    const mantenimientoVencido = kmDiferencia < 0;
    const mantenimientoProximo = kmDiferencia >= 0 && kmDiferencia <= 1000;
    const requiereMantenimiento = mantenimientoVencido || mantenimientoProximo;
    
    const actions = [];

    if (requiereMantenimiento && vehiculo.Estado !== 'Mantenimiento') {
      actions.push({
        label: 'Enviar a Mantenimiento',
        icon: AlertTriangle,
        color: 'from-red-500 to-orange-600',
        urgent: true,
        onClick: () => setShowMantenimientoModal(true)
      });
    }
    
    if (vehiculo.Estado === 'Disponible') {
      if (!requiereMantenimiento) {
        actions.push({
          label: 'Asignar Conductor',
          icon: UserPlus,
          color: 'from-blue-500 to-cyan-600',
          primary: true,
          onClick: () => setShowAsignarConductorModal(true)
        });
      }
    }
    
    else if (vehiculo.Estado === 'Rentado' || vehiculo.Estado === 'Asignado') {
      actions.push({
        label: 'Reportar Siniestro',
        icon: AlertTriangle,
        color: 'from-red-500 to-orange-600',
        onClick: () => alert('Abrir modal de siniestros')
      });
      actions.push({
        label: 'Registrar Pago',
        icon: FileText,
        color: 'from-green-500 to-emerald-600',
        onClick: async () => {
          const conductorAsignado = vehiculo?.ConductorInfo;

          if (!conductorAsignado?.id) {
            alert('Asigna un conductor antes de registrar un pago.');
            return;
          }

          try {
            const siguientePago = await adminService.getSiguientePagoPendiente(conductorAsignado.id);

            if (siguientePago.success && !siguientePago.hay_pendiente) {
              alert('No hay pagos pendientes por registrar en este momento.');
              return;
            }

            if (siguientePago.success && siguientePago.siguiente_fecha_pendiente) {
              const fechaPendiente = new Date(`${siguientePago.siguiente_fecha_pendiente}T00:00:00`);
              const fechaActual = new Date(`${siguientePago.fecha_actual}T00:00:00`);
              if (fechaPendiente > fechaActual) {
                alert('No hay pagos pendientes por registrar en este momento.');
                return;
              }
            }
          } catch (error) {
            console.error('Error validando siguiente pago pendiente:', error);
            alert('No se pudo validar el siguiente pago pendiente. Intenta de nuevo.');
            return;
          }

          setConductorParaPago({
            id: conductorAsignado.id,
            nombre_conductor: conductorAsignado.nombre || conductorAsignado.nombre_conductor,
            numero_vehiculo: vehiculo?.NumeroVehiculo,
            renta_diaria: conductorAsignado.rentaDiaria,
            abono_poliza_mantenimiento: conductorAsignado.abonoPoliza,
            tipo_poliza: conductorAsignado.tipoPoliza
          });
          setShowRegistrarPagoModal(true);
        }
      });
    }
    
    else if (vehiculo.Estado === 'Mantenimiento') {
      actions.push({
        label: 'Marcar como Disponible',
        icon: CheckCircle,
        color: 'from-green-500 to-emerald-600',
        primary: true,
        onClick: async () => {
          if (confirm('¿Marcar este vehículo como Disponible?')) {
            try {
              await adminService.updateVehiculo(vehiculo.id, { Estado: 'Disponible' });
              setVehiculo({...vehiculo, Estado: 'Disponible'});
              alert('✅ Vehículo marcado como Disponible');
            } catch (error) {
              alert('❌ Error al actualizar estado');
            }
          }
        }
      });
    }
    
    // Acciones secundarias
    actions.push({
      label: 'Historial y pagos de rentas',
      icon: Calendar,
      color: 'from-purple-500 to-indigo-600',
      onClick: () => navigate(`/admin/vehiculos/${vehiculo.id}/historial`)
    });
    
    actions.push({
      label: 'Generar Reporte',
      icon: Download,
      color: 'from-gray-500 to-gray-700',
      onClick: cargarDatosParaPDF // ⬅️ AHORA CARGA DATOS PARA PDF
    });
    
    return actions;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const getStatusColor = (estado) => {
    const colors = {
      'Disponible': 'bg-green-100/80 text-green-800 border-green-200',
      'Rentado': 'bg-blue-100/80 text-blue-800 border-blue-200',
      'Mantenimiento': 'bg-yellow-100/80 text-yellow-800 border-yellow-200',
      'Baja': 'bg-red-100/80 text-red-800 border-red-200',
      'Siniestro': 'bg-red-100/80 text-red-800 border-red-200',
      'Asignado': 'bg-purple-100/80 text-purple-800 border-purple-200'
    };
    return colors[estado] || 'bg-gray-100/80 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (estado) => {
    switch (estado) {
      case 'Disponible': return <Car className="w-4 h-4" />;
      case 'Rentado': 
      case 'Asignado': return <User className="w-4 h-4" />;
      case 'Mantenimiento': return <Wrench className="w-4 h-4" />;
      case 'Baja': 
      case 'Siniestro': return <AlertTriangle className="w-4 h-4" />;
      default: return <Car className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-cyan-200 rounded-full animate-spin border-t-cyan-600"></div>
            <Car className="w-8 h-8 text-cyan-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-lg text-gray-600 font-medium">Cargando vehículo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/admin/vehiculos')}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-lg"
          >
            Volver a Vehículos
          </button>
        </div>
      </div>
    );
  }

  if (!vehiculo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
          <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vehículo no encontrado</h2>
          <button
            onClick={() => navigate('/admin/vehiculos')}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-3 rounded-lg"
          >
            Volver a Vehículos
          </button>
        </div>
      </div>
    );
  }

  const contextualActions = getContextualActions();

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="glass border-b border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin/vehiculos')}
                className="group flex items-center text-gray-400 hover:text-white mr-6 transition-all duration-200"
              >
                <div className="p-2 rounded-lg group-hover:bg-surface-secondary transition-colors duration-200">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </div>
                <span className="font-medium">Volver a Vehículos</span>
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg shadow-lg">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Vehículo #{vehiculo.NumeroVehiculo}
                  </h1>
                  <p className="text-sm text-gray-400">
                    {vehiculo.Marca} {vehiculo.Modelo} {vehiculo.Año}
                  </p>
                </div>
              </div>
            </div>
            
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium shadow-lg backdrop-blur-sm border ${getStatusColor(vehiculo.Estado)}`}>
              <div className="mr-2 p-1 rounded-full bg-white/20">
                {getStatusIcon(vehiculo.Estado)}
              </div>
              <span>{vehiculo.Estado}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal - Dashboard 3 columnas responsive */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
          {/* COLUMNA 1: EL ACTIVO */}
          <div className="xl:col-span-4 space-y-4 sm:space-y-6">
            <div className="glass rounded-2xl overflow-hidden border border-primary/20">
              <VehicleDisplay vehiculo={vehiculo} />
            </div>
            <VehicleInvestmentPanel 
  vehiculo={vehiculo} 
  onAsignarInversionClick={() => setShowAsignarInversionModal(true)}
/>          </div>

          {/* COLUMNA 2: LOS DATOS */}
          <div className="xl:col-span-4 space-y-4 sm:space-y-6">
            {/* TABS */}
            <div className="glass rounded-2xl p-4 border border-primary/20">
              <div className="flex space-x-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === 'general' 
                      ? 'bg-primary text-dark' 
                      : 'bg-surface-secondary text-gray-400 hover:text-white hover:bg-surface-secondary/80'
                  }`}>
                  <Car className="w-4 h-4 inline mr-2" />
                  General
                </button>
                <button
                  onClick={() => setActiveTab('tecnico')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === 'tecnico' 
                      ? 'bg-primary text-dark' 
                      : 'bg-surface-secondary text-gray-400 hover:text-white hover:bg-surface-secondary/80'
                  }`}>
                  <Wrench className="w-4 h-4 inline mr-2" />
                  Técnico
                </button>
                <button
                  onClick={() => setActiveTab('seguro')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === 'seguro' 
                      ? 'bg-primary text-dark' 
                      : 'bg-surface-secondary text-gray-400 hover:text-white hover:bg-surface-secondary/80'
                  }`}>
                  <Shield className="w-4 h-4 inline mr-2" />
                  Seguro
                </button>
                <button
                  onClick={() => setActiveTab('mantenimiento')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === 'mantenimiento' 
                      ? 'bg-primary text-dark' 
                      : 'bg-surface-secondary text-gray-400 hover:text-white hover:bg-surface-secondary/80'
                  }`}>
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Mantenimiento
                </button>
              </div>
            </div>

            {/* CONTENIDO POR TAB */}
            <div className="glass rounded-2xl p-6 border border-primary/20">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                  {activeTab === 'general' && 'Información General'}
                  {activeTab === 'tecnico' && 'Especificaciones Técnicas'}
                  {activeTab === 'seguro' && 'Información del Seguro'}
                  {activeTab === 'mantenimiento' && 'Información de Mantenimiento'}
                </h2>
                
                {isSuperAdmin && editingSection !== activeTab && (
                  <button
                    onClick={() => startEditingSection(activeTab)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-all border border-primary/30"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                )}
              </div>

              {/* Contenido del TAB GENERAL */}
              {activeTab === 'general' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <EditableField
                    label="Número de Vehículo"
                    value={editingSection === 'general' ? sectionData?.NumeroVehiculo : vehiculo.NumeroVehiculo}
                    onChange={(value) => handleFieldChange('NumeroVehiculo', value)}
                    type="text"
                    editing={editingSection === 'general'}
                    error={validationErrors.NumeroVehiculo}
                  />

                  <EditableField
                    label="Tipo Socio"
                    value={editingSection === 'general' ? sectionData?.TipoSocio : vehiculo.TipoSocio}
                    onChange={(value) => handleFieldChange('TipoSocio', value)}
                    type="select"
                    options={opcionesVehiculo.tiposSocio}
                    editing={editingSection === 'general'}
                    required={true}
                    error={validationErrors.TipoSocio}
                  />

                  <EditableField
                    label="Número de Unidad"
                    value={editingSection === 'general' ? sectionData?.NumeroUnidad : vehiculo.NumeroUnidad}
                    onChange={(value) => handleFieldChange('NumeroUnidad', value)}
                    type="number"
                    editing={editingSection === 'general'}
                    required={true}
                    error={validationErrors.NumeroUnidad}
                  />

                  <EditableField
                    label="Marca"
                    value={editingSection === 'general' ? sectionData?.Marca : vehiculo.Marca}
                    onChange={(value) => handleFieldChange('Marca', value)}
                    type="select"
                    options={opcionesVehiculo.marcas}
                    editing={editingSection === 'general'}
                    required={true}
                    error={validationErrors.Marca}
                  />

                  <EditableField
                    label="Modelo"
                    value={editingSection === 'general' ? sectionData?.Modelo : vehiculo.Modelo}
                    onChange={(value) => handleFieldChange('Modelo', value)}
                    type="text"
                    editing={editingSection === 'general'}
                    required={true}
                    error={validationErrors.Modelo}
                  />

                  <EditableField
                    label="Año"
                    value={editingSection === 'general' ? sectionData?.Año : vehiculo.Año}
                    onChange={(value) => handleFieldChange('Año', value)}
                    type="number"
                    editing={editingSection === 'general'}
                    required={true}
                    error={validationErrors.Año}
                  />

                  <EditableField
                    label="Color"
                    value={editingSection === 'general' ? sectionData?.Color : vehiculo.Color}
                    onChange={(value) => handleFieldChange('Color', value)}
                    type="select"
                    options={opcionesVehiculo.colores}
                    editing={editingSection === 'general'}
                  />

                  <EditableField
                    label="Placa"
                    value={editingSection === 'general' ? sectionData?.Placa : vehiculo.Placa}
                    onChange={(value) => handleFieldChange('Placa', value.toUpperCase())}
                    type="text"
                    editing={editingSection === 'general'}
                    required={true}
                    error={validationErrors.Placa}
                  />

                  <EditableField
                    label="Estado"
                    value={editingSection === 'general' ? sectionData?.Estado : vehiculo.Estado}
                    onChange={(value) => handleFieldChange('Estado', value)}
                    type="select"
                    options={opcionesVehiculo.estados}
                    editing={editingSection === 'general'}
                  />

                  <EditableField
                    label="Kilometraje Actual"
                    value={editingSection === 'general' ? sectionData?.KilometrajeActual : vehiculo.KilometrajeActual}
                    onChange={(value) => handleFieldChange('KilometrajeActual', value)}
                    type="number"
                    editing={editingSection === 'general'}
                  />

                  <div className="col-span-2">
                    <EditableField
                      label="Observaciones"
                      value={editingSection === 'general' ? sectionData?.Observaciones : vehiculo.Observaciones}
                      onChange={(value) => handleFieldChange('Observaciones', value)}
                      type="textarea"
                      editing={editingSection === 'general'}
                    />
                  </div>
                </div>
              )}

              {/* Contenido del TAB TÉCNICO */}
              {activeTab === 'tecnico' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <EditableField
                    label="Tipo de Vehículo"
                    value={editingSection === 'tecnico' ? sectionData?.TipoVehiculo : vehiculo.TipoVehiculo}
                    onChange={(value) => handleFieldChange('TipoVehiculo', value)}
                    type="select"
                    options={opcionesVehiculo.tiposVehiculo}
                    editing={editingSection === 'tecnico'}
                  />

                  <EditableField
                    label="Tipo de Combustible"
                    value={editingSection === 'tecnico' ? sectionData?.TipoCombustible : vehiculo.TipoCombustible}
                    onChange={(value) => handleFieldChange('TipoCombustible', value)}
                    type="select"
                    options={opcionesVehiculo.tiposCombustible}
                    editing={editingSection === 'tecnico'}
                  />

                  <EditableField
                    label="Número de Serie (VIN)"
                    value={editingSection === 'tecnico' ? sectionData?.NumeroSerie : vehiculo.NumeroSerie}
                    onChange={(value) => handleFieldChange('NumeroSerie', value.toUpperCase())}
                    type="text"
                    editing={editingSection === 'tecnico'}
                  />

                  <EditableField
                    label="Número de Motor"
                    value={editingSection === 'tecnico' ? sectionData?.NumeroMotor : vehiculo.NumeroMotor}
                    onChange={(value) => handleFieldChange('NumeroMotor', value.toUpperCase())}
                    type="text"
                    editing={editingSection === 'tecnico'}
                  />
                </div>
              )}

              {/* Contenido del TAB SEGURO */}
              {activeTab === 'seguro' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <EditableField
                    label="Póliza de Seguro"
                    value={editingSection === 'seguro' ? sectionData?.PolizaSeguro : vehiculo.PolizaSeguro}
                    onChange={(value) => handleFieldChange('PolizaSeguro', value)}
                    type="text"
                    editing={editingSection === 'seguro'}
                  />

                  <EditableField
                    label="Vencimiento de Póliza"
                    value={editingSection === 'seguro' ? (sectionData?.PolizaVencimiento ? formatDate(sectionData.PolizaVencimiento) : '') : (vehiculo.PolizaVencimiento ? formatDate(vehiculo.PolizaVencimiento) : '')}
                    onChange={(value) => handleFieldChange('PolizaVencimiento', value)}
                    type="date"
                    editing={editingSection === 'seguro'}
                  />

                  <EditableField
                    label="Monto Deducible"
                    value={editingSection === 'seguro' ? sectionData?.MontoDeducible : vehiculo.MontoDeducible}
                    onChange={(value) => handleFieldChange('MontoDeducible', value)}
                    type="number"
                    editing={editingSection === 'seguro'}
                  />

                  <EditableField
                    label="ID Póliza"
                    value={editingSection === 'seguro' ? sectionData?.PolizaSeguroId : vehiculo.PolizaSeguroId}
                    onChange={(value) => handleFieldChange('PolizaSeguroId', value)}
                    type="number"
                    editing={editingSection === 'seguro'}
                  />
                </div>
              )}

              {/* Contenido del TAB MANTENIMIENTO */}
              {activeTab === 'mantenimiento' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <EditableField
                    label="Próximo Mantenimiento (km)"
                    value={editingSection === 'mantenimiento' ? sectionData?.ProximoMantenimiento : vehiculo.ProximoMantenimiento}
                    onChange={(value) => handleFieldChange('ProximoMantenimiento', value)}
                    type="number"
                    editing={editingSection === 'mantenimiento'}
                    error={validationErrors.ProximoMantenimiento}
                  />

                  <EditableField
                    label="Intervalo (km)"
                    value={editingSection === 'mantenimiento' ? sectionData?.IntervaloMantenimiento : vehiculo.IntervaloMantenimiento}
                    onChange={(value) => handleFieldChange('IntervaloMantenimiento', value)}
                    type="number"
                    editing={editingSection === 'mantenimiento'}
                  />

                  <EditableField
                    label="Último Servicio"
                    value={editingSection === 'mantenimiento' ? (sectionData?.FechaUltimoServicio ? formatDate(sectionData.FechaUltimoServicio) : '') : (vehiculo.FechaUltimoServicio ? formatDate(vehiculo.FechaUltimoServicio) : '')}
                    onChange={(value) => handleFieldChange('FechaUltimoServicio', value)}
                    type="date"
                    editing={editingSection === 'mantenimiento'}
                  />

                  <EditableField
                    label="ID Conductor Asignado"
                    value={editingSection === 'mantenimiento' ? sectionData?.ConductorAsignadoId : vehiculo.ConductorAsignadoId}
                    onChange={(value) => handleFieldChange('ConductorAsignadoId', value)}
                    type="number"
                    editing={editingSection === 'mantenimiento'}
                  />
                </div>
              )}

              {/* Botones de acción inline */}
              {editingSection === activeTab && (
                <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-700">
                  <button
                    onClick={cancelEditingSection}
                    className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all text-sm sm:text-base"
                  >
                    <X className="w-4 h-4 inline mr-2" />
                    Cancelar
                  </button>
                  <button
                    onClick={saveSectionChanges}
                    disabled={saving}
                    className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 text-sm sm:text-base"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline mr-2" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 inline mr-2" />
                        Guardar
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA 3: LA ACCIÓN */}
          <div className="xl:col-span-4 space-y-4 sm:space-y-6">
            <VehicleConductorPanel 
              vehiculo={vehiculo} 
              onAsignarClick={() => setShowAsignarConductorModal(true)}
              onVerContratoClick={() => setShowContratoModal(true)}
              onCambiarConductorClick={() => setShowCambiarConductorModal(true)}
            />

            {/* ACCIONES CONTEXTUALES */}
            <div className="glass rounded-2xl p-4 sm:p-6 border border-primary/20">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">
                Siguiente Paso
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {contextualActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    disabled={action.label === 'Generar Reporte' && loadingPDFData}
                    className={`w-full bg-gradient-to-r ${action.color} text-white rounded-lg p-3 sm:p-4 hover:opacity-90 transition-all flex items-center gap-2 sm:gap-3 ${
                      action.urgent ? 'ring-2 ring-red-400 ring-offset-2 ring-offset-surface' : ''
                    } ${action.label === 'Generar Reporte' && loadingPDFData ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg flex-shrink-0">
                      {action.label === 'Generar Reporte' && loadingPDFData ? (
                        <div className="animate-spin h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <action.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-bold text-xs sm:text-sm truncate">
                        {action.label === 'Generar Reporte' && loadingPDFData ? 'Cargando datos...' : action.label}
                      </p>
                      {action.urgent && (
                        <p className="text-xs opacity-90">¡Acción requerida!</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========== MODAL PDF FUTURISTA ========== */}
        {showPDFModal && historialData && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl p-6 sm:p-8 max-w-md w-full border border-purple-500/30 shadow-2xl">
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Reporte Maestro del Vehículo
                  </h3>
                  <p className="text-gray-400">
                    {vehiculo.Marca} {vehiculo.Modelo} - #{vehiculo.NumeroVehiculo}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
                  <p className="text-white/80 text-sm">
                    El PDF incluye:
                  </p>
                  <ul className="text-left text-gray-400 text-sm mt-2 space-y-1">
                    <li>✓ Resumen ejecutivo con métricas</li>
                    <li>✓ Gráficos de recuperación de inversión</li>
                    <li>✓ Historial completo de pagos</li>
                    <li>✓ Mantenimientos y siniestros</li>
                    <li>✓ Información del inversionista</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <GenerarPDFButton 
                    data={historialData}
                    imagenesGraficos={imagenesGraficos}
                    onPrepareImages={async () => {
                      // Los gráficos se capturarán automáticamente
                      return imagenesGraficos;
                    }}
                  />
                  
                  <button
                    onClick={() => setShowPDFModal(false)}
                    className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all border border-white/20"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modales existentes */}
        <AsignarConductorModal
          isOpen={showAsignarConductorModal}
          onClose={() => setShowAsignarConductorModal(false)}
          vehiculo={vehiculo}
          onSuccess={async () => {
            const response = await adminService.getVehiculoById(id);
            if (response.success) {
              setVehiculo(response.vehiculo);
            }
            setShowAsignarConductorModal(false);
          }}
        />
        
        <ProgramarMantenimientoModal
          isOpen={showMantenimientoModal}
          onClose={() => setShowMantenimientoModal(false)}
          vehiculo={vehiculo}
          onSuccess={async () => {
            const response = await adminService.getVehiculoById(id);
            if (response.success) {
              setVehiculo(response.vehiculo);
            }
            setShowMantenimientoModal(false);
          }}
        />
        
        <VerContratoModal
          isOpen={showContratoModal}
          onClose={() => setShowContratoModal(false)}
          vehiculo={vehiculo}
        />

        <CambiarConductorModal
          isOpen={showCambiarConductorModal}
          onClose={() => setShowCambiarConductorModal(false)}
          vehiculo={vehiculo}
          onSuccess={async () => {
            const response = await adminService.getVehiculoById(id);
            if (response.success) {
              setVehiculo(response.vehiculo);
            }
            setShowCambiarConductorModal(false);
          }}
        />

        {showRegistrarPagoModal && (
          <ModalRegistrarPago
            isOpen={showRegistrarPagoModal}
            onClose={() => {
              setShowRegistrarPagoModal(false);
              setConductorParaPago(null);
            }}
            conductor={conductorParaPago}
            onSuccess={() => {
              setShowRegistrarPagoModal(false);
              setConductorParaPago(null);
            }}
          />
        )}
      </div>
      {/* Modal Asignar Inversión */}
      {showAsignarInversionModal && (
        <AsignarInversionModal
          vehiculo={vehiculo}
          onClose={() => setShowAsignarInversionModal(false)}
          onSuccess={async () => {
            const response = await adminService.getVehiculoById(id);
            if (response.success) {
              setVehiculo(response.vehiculo);
            }
            setShowAsignarInversionModal(false);
          }}
        />
      )}
    </div>

  );
};

export default VehicleDetail3D;
