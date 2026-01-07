// frontend/src/pages/admin/Vehiculos.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, AlertCircle, Check, X, AlertTriangle, Calculator, LayoutGrid, List } from 'lucide-react';
import adminService from '../../services/adminService';
import CalculadoraInversion from '../../components/inversiones/CalculadoraInversion';
import ModalInversionistas from '../../components/inversiones/ModalInversionistas';
import ModalDecisionVehiculo from '../../components/vehiculos/ModalDecisionVehiculo';
import VehiculosStats from '../../components/vehiculos/VehiculosStats';
import VehiculosSkeleton from '../../components/vehiculos/VehiculosSkeleton';
import VehiculosTable from '../../components/vehiculos/VehiculosTable';
import VehiculosGrid from '../../components/vehiculos/VehiculosGrid';
import VehiculoDrawer from '../../components/vehiculos/VehiculoDrawer';
import { VehiculoFormProvider } from '../../contexts/VehiculoFormContext.jsx';

// Componente Toast
const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-yellow-500';
  const Icon = type === 'success' ? Check : type === 'error' ? X : AlertTriangle;

  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg ${bgColor} text-white shadow-lg animate-slide-in`}>
      <Icon className="w-5 h-5" />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const Vehiculos = () => {
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [showDrawer, setShowDrawer] = useState(false);
  const [vehiculoEdit, setVehiculoEdit] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [isFormValid, setIsFormValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    general: false,
    mantenimiento: false,
    seguro: false,
    inversion: false
  });
  const [pendienteAbrirDrawer, setPendienteAbrirDrawer] = useState(false);
  
  // Estados para inversiones
  const [showCalculadora, setShowCalculadora] = useState(false);
  const [showModalInversionista, setShowModalInversionista] = useState(false);
  const [showModalDecision, setShowModalDecision] = useState(false);
  const [requiereInversion, setRequiereInversion] = useState(false);
  const [inversionistaSeleccionado, setInversionistaSeleccionado] = useState(null);
  const [calculosInversion, setCalculosInversion] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 10;
  
  // Opciones dinámicas
  const [opcionesDinamicas, setOpcionesDinamicas] = useState({
    tipoSocio: ['SD', 'SI', 'SA'],
    tipoVehiculo: ['Sedan', 'SUV', 'Pickup', 'Van', 'Hatchback'],
    tipoCombustible: ['Gasolina', 'Eléctrico', 'Híbrido', 'Diesel'],
    color: ['Blanco', 'Negro', 'Gris', 'Rojo', 'Azul', 'Verde', 'Tinto'],
    estado: ['Disponible', 'Rentado', 'Mantenimiento', 'Baja', 'Siniestro', 'Asignado'],
    marcas: ['Nissan', 'BYD', 'Toyota', 'Honda', 'Mazda'],
    modelos: ['Versa', 'March', 'V-Drive', 'Dolphin Mini', 'Sentra']
  });
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    NumeroVehiculo: '',
    TipoSocio: 'SD',
    NumeroUnidad: '',
    Marca: '',
    Modelo: '',
    TipoVehiculo: 'Sedan',
    TipoCombustible: 'Gasolina',
    Año: new Date().getFullYear(),
    Placa: '',
    Color: 'Blanco',
    NumeroSerie: '',
    NumeroMotor: '',
    Estado: 'Disponible',
    KilometrajeActual: 0,
    ProximoMantenimiento: 0,
    IntervaloMantenimiento: 10000,
    FechaUltimoServicio: '',
    PolizaSeguro: '',
    PolizaVencimiento: '',
    MontoDeducible: 0,
    PolizaSeguroId: null,
    Observaciones: '',
    ConductorAsignadoId: null
  });

  const [datosInversion, setDatosInversion] = useState({
    valor_factura: '',
    polizas: '',
    placas: '',
    gps: '',
    otros_gastos: '',
    renta_diaria: '',
    plazo_meses: 62,
    tasa_rendimiento: 1.56,
    fecha_inicio: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
  // NO recalcular si calculosInversion ya tiene el campo modelo
  if (requiereInversion && 
      datosInversion.valor_factura && 
      datosInversion.renta_diaria && 
      !calculosInversion?.modelo) {
    calcularInversionAuto();
  }
}, [datosInversion, requiereInversion, calculosInversion]);

  // Validación en tiempo real con detección de errores por pestaña
  useEffect(() => {
    const validar = () => {
      const errors = {
        general: false,
        mantenimiento: false,
        seguro: false,
        inversion: false
      };

      let isValid = true;

      // Validaciones de la pestaña GENERAL
      if (!formData.TipoSocio || !formData.NumeroUnidad || !formData.Marca || 
          !formData.Modelo || !formData.Año || !formData.Placa || !formData.NumeroSerie) {
        errors.general = true;
        isValid = false;
      }

      const currentYear = new Date().getFullYear();
      if (formData.Año < 1990 || formData.Año > currentYear + 1) {
        errors.general = true;
        isValid = false;
      }

      // Validaciones de la pestaña MANTENIMIENTO
      if (formData.ProximoMantenimiento && formData.KilometrajeActual) {
        if (parseInt(formData.ProximoMantenimiento) < parseInt(formData.KilometrajeActual)) {
          errors.mantenimiento = true;
          isValid = false;
        }
      }

      setValidationErrors(errors);
      return isValid;
    };
    
    setIsFormValid(validar());
  }, [formData, requiereInversion, inversionistaSeleccionado]);

  // Abrir drawer cuando los datos de inversión estén listos
  useEffect(() => {
    if (pendienteAbrirDrawer && calculosInversion && requiereInversion) {
      abrirDrawer();
      setPendienteAbrirDrawer(false);
    }
  }, [pendienteAbrirDrawer, calculosInversion, requiereInversion]);

  const cargarDatos = async () => {
    await Promise.all([
      cargarVehiculos(),
      cargarOpciones()
    ]);
  };

  const cargarVehiculos = async () => {
    try {
      setLoading(true);
      const response = await adminService.getVehiculos();
      
      if (response && response.vehiculos && Array.isArray(response.vehiculos)) {
        setVehiculos(response.vehiculos);
      } else if (response && Array.isArray(response)) {
        setVehiculos(response);
      } else {
        setVehiculos([]);
      }
    } catch (error) {
      console.error('Error al cargar vehículos:', error);
      mostrarToast('Error al cargar vehículos', 'error');
      setVehiculos([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarOpciones = async () => {
    try {
      setCargandoOpciones(true);
      const response = await adminService.getOpcionesVehiculos();
      
      if (response && response.opciones) {
        setOpcionesDinamicas({
          tipoSocio: response.opciones.tipoSocio || ['SD', 'SI', 'SA'],
          tipoVehiculo: response.opciones.tipoVehiculo || ['Sedan', 'SUV', 'Pickup'],
          tipoCombustible: response.opciones.tipoCombustible || ['Gasolina', 'Eléctrico'],
          color: response.opciones.color || ['Blanco', 'Negro', 'Gris'],
          estado: response.opciones.estado || ['Disponible', 'Rentado', 'Mantenimiento'],
          marcas: response.opciones.marcas || ['Nissan', 'BYD'],
          modelos: response.opciones.modelos || ['Versa', 'March', 'V-Drive']
        });
      }
    } catch (error) {
      console.error('Error al cargar opciones:', error);
    } finally {
      setCargandoOpciones(false);
    }
  };

  const calcularInversionAuto = async () => {
  // NO recalcular si ya tenemos datos de la calculadora
  if (calculosInversion?.modelo) {
    console.log('⏭️ Saltando recálculo - ya hay datos de calculadora con modelo:', calculosInversion.modelo);
    return;
  }
  
  try {
    const response = await adminService.calcularInversion(datosInversion);
    if (response.success) {
      setCalculosInversion(response.calculos);
    }
  } catch (error) {
    console.error('Error calculando inversión:', error);
  }
};

  const mostrarToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const validarFormulario = () => {
    const errors = [];
    
    if (!formData.TipoSocio) errors.push('Tipo de socio es requerido');
    if (!formData.NumeroUnidad) errors.push('Número de unidad es requerido');
    if (!formData.Marca) errors.push('Marca es requerida');
    if (!formData.Modelo) errors.push('Modelo es requerido');
    if (!formData.Año) errors.push('Año es requerido');
    if (!formData.Placa) errors.push('Placa es requerida');
    if (!formData.NumeroSerie) errors.push('Número de serie es requerido');
    
    const currentYear = new Date().getFullYear();
    if (formData.Año < 1990 || formData.Año > currentYear + 1) {
      errors.push(`El año debe estar entre 1990 y ${currentYear + 1}`);
    }
    
    if (formData.ProximoMantenimiento && formData.KilometrajeActual) {
      if (parseInt(formData.ProximoMantenimiento) < parseInt(formData.KilometrajeActual)) {
        errors.push('El próximo mantenimiento debe ser mayor al kilometraje actual');
      }
    }
    
    return errors;
  };

  // ========== 🔧 FUNCIÓN handleSubmit MODIFICADA ==========
  const handleSubmit = async () => {
    const errores = validarFormulario();
    if (errores.length > 0) {
      mostrarToast(errores[0], 'error');
      return;
    }
    
    setGuardando(true);
    
    try {
      const datosVehiculo = {};
      Object.keys(formData).forEach(key => {
        const valor = formData[key];
        
        // NO enviar PolizaSeguroId ni ConductorAsignadoId si son null
        if ((key === 'PolizaSeguroId' || key === 'ConductorAsignadoId') && (!valor || valor === null)) {
          return;
        }
        
        if (valor !== '' && valor !== null && valor !== undefined) {
          if (['NumeroUnidad', 'Año', 'KilometrajeActual', 'ProximoMantenimiento', 'IntervaloMantenimiento'].includes(key)) {
            datosVehiculo[key] = parseInt(valor) || 0;
          } else if (key === 'MontoDeducible') {
            datosVehiculo[key] = parseFloat(valor) || 0;
          } else {
            datosVehiculo[key] = valor;
          }
        }
      });

      if (!datosVehiculo.NumeroVehiculo) {
        datosVehiculo.NumeroVehiculo = `${datosVehiculo.TipoSocio}-${String(datosVehiculo.NumeroUnidad).padStart(4, '0')}`;
      }

      // ========== 🔍 DEBUG COMPLETO - DIAGNÓSTICO ==========
      console.group('🔍 DIAGNÓSTICO COMPLETO - DATOS DE INVERSIÓN');
      console.log('1️⃣ requiereInversion:', requiereInversion);
      console.log('2️⃣ calculosInversion existe:', !!calculosInversion);
      console.log('3️⃣ calculosInversion completo:', JSON.stringify(calculosInversion, null, 2));
      
      if (calculosInversion) {
        console.log('📊 Estructura de calculosInversion:');
        console.log('   - modelo:', calculosInversion.modelo);
        console.log('   - corridaTotal:', calculosInversion.corridaTotal);
        console.log('   - multiplicadorUsado:', calculosInversion.multiplicadorUsado);
        console.log('   - plazoDefinido:', calculosInversion.plazoDefinido);
        console.log('   - datosVehiculo:', calculosInversion.datosVehiculo);
        console.log('   - Todas las keys:', Object.keys(calculosInversion));
      }
      
      console.log('4️⃣ Condición se cumple:', requiereInversion && calculosInversion);
      console.log('5️⃣ TipoSocio actual:', datosVehiculo.TipoSocio);
      console.log('6️⃣ datosVehiculo ANTES de agregar campos SD:', JSON.stringify(datosVehiculo, null, 2));
      console.groupEnd();
      // ========== FIN DEBUG ==========

      // 🎯 NUEVA LÓGICA: Agregar campos según el modelo de negocio
      if (requiereInversion && calculosInversion) {
        console.log('✅ ENTRÓ EN LA CONDICIÓN - Procesando modelo:', calculosInversion.modelo);
        
        console.log('📊 Datos de inversión disponibles:', {
          modelo: calculosInversion.modelo,
          calculos: calculosInversion
        });

        // 🚗 SI ES SOCIO DUEÑO (SD)
        if (calculosInversion.modelo === 'SD') {
          console.log('🚗 Guardando como Socio Dueño (SD)');
          
          datosVehiculo.TipoSocio = 'SD';
          datosVehiculo.total_corrida = parseFloat(calculosInversion.corridaTotal || calculosInversion.datosVehiculo?.corrida_total || 0);
          datosVehiculo.multiplicador_corrida = parseFloat(calculosInversion.multiplicadorUsado || calculosInversion.datosVehiculo?.tasa_rendimiento || 0);
          datosVehiculo.plazo_corrida = parseInt(calculosInversion.plazoDefinido || calculosInversion.datosVehiculo?.plazo_meses || 0);
          
          console.log('✅ Campos SD agregados:', {
            total_corrida: datosVehiculo.total_corrida,
            multiplicador_corrida: datosVehiculo.multiplicador_corrida,
            plazo_corrida: datosVehiculo.plazo_corrida
          });
        }
        
        // 🏢 SI ES SI_LEGADO
        if (calculosInversion.modelo === 'SI_LEGADO') {
          console.log('🏢 Guardando como SI Legado');
          datosVehiculo.TipoSocio = 'SI';
        }
      } else {
        console.log('❌ NO ENTRÓ EN LA CONDICIÓN porque:');
        console.log('   - requiereInversion es:', requiereInversion, '(debe ser true)');
        console.log('   - calculosInversion es:', calculosInversion, '(debe existir)');
      }

      console.log('7️⃣ datosVehiculo DESPUÉS de agregar campos SD:', JSON.stringify(datosVehiculo, null, 2));

      let vehiculoResponse;
      if (vehiculoEdit) {
        // ========== ACTUALIZAR VEHÍCULO ==========
        vehiculoResponse = await adminService.updateVehiculo(vehiculoEdit.id, datosVehiculo);
        mostrarToast('Vehículo actualizado exitosamente', 'success');
      } else {
        // ========== CREAR VEHÍCULO NUEVO ==========
        console.log('🚀 Creando vehículo con datos:', datosVehiculo);
        vehiculoResponse = await adminService.createVehiculo(datosVehiculo);
        console.log('✅ Vehículo creado:', vehiculoResponse);
        
        // 🎯 SOLO SI ES SI_LEGADO, crear registro en inversiones_vehiculos
        if (requiereInversion && calculosInversion?.modelo === 'SI_LEGADO' && vehiculoResponse.success) {
          console.log('📊 Creando inversión SI_LEGADO...');
          
          const datosInversionCompleta = {
            numero_de_serie_vehiculo: vehiculoResponse.vehiculo.NumeroDeSerieVehiculo || formData.NumeroSerie,
            inversionista_id: inversionistaSeleccionado?.id || null,
            modelo_negocio: 'SI_LEGADO',
            valor_factura: datosInversion.valor_factura,
            polizas: datosInversion.polizas,
            placas: datosInversion.placas,
            gps: datosInversion.gps,
            otros_gastos: datosInversion.otros_gastos,
            renta_diaria: 10400, // ✅ Fijo para SI_LEGADO
            plazo_meses: 62,     // ✅ Fijo para SI_LEGADO
            tasa_rendimiento: 1.56, // ✅ Fijo para SI_LEGADO
            fecha_inicio: datosInversion.fecha_inicio
          };
          
          console.log('📊 Datos de inversión a enviar:', datosInversionCompleta);
          
          try {
            const inversionResponse = await adminService.crearInversionVehiculo(datosInversionCompleta);
            console.log('✅ Inversión creada:', inversionResponse);
            
            if (inversionistaSeleccionado) {
              mostrarToast('Vehículo SI_LEGADO e inversión creados con inversionista asignado', 'success');
            } else {
              mostrarToast('Vehículo SI_LEGADO creado. Asigna un inversionista después.', 'success');
            }
          } catch (error) {
            console.error('❌ Error creando inversión:', error);
            mostrarToast('Vehículo creado pero falló la inversión: ' + error.message, 'warning');
          }
        } 
        // 🚗 SI ES SD, ya se guardó todo en vehiculos
        else if (calculosInversion?.modelo === 'SD') {
          console.log('✅ Vehículo SD creado exitosamente (corrida guardada en vehiculos)');
          mostrarToast('Vehículo Socio Dueño (SD) creado exitosamente', 'success');
        }
        // Sin inversión
        else {
          mostrarToast('Vehículo creado exitosamente', 'success');
        }
      }
      
      await cargarVehiculos();
      cerrarDrawer();

      // Resetear estados de inversión DESPUÉS de cerrar
      setRequiereInversion(false);
      setInversionistaSeleccionado(null);
      setCalculosInversion(null);
      setDatosInversion({
        valor_factura: '',
        polizas: '',
        placas: '',
        gps: '',
        otros_gastos: '',
        renta_diaria: '',
        plazo_meses: 62,
        tasa_rendimiento: 1.56,
        fecha_inicio: new Date().toISOString().split('T')[0]
      });
      
    } catch (error) {
      console.error('❌ Error:', error);
      mostrarToast(error.message || 'Error al guardar el vehículo', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este vehículo?')) return;
    
    try {
      await adminService.deleteVehiculo(id);
      mostrarToast('Vehículo eliminado exitosamente', 'success');
      cargarVehiculos();
    } catch (error) {
      console.error('Error:', error);
      mostrarToast(error.message || 'Error al eliminar el vehículo', 'error');
    }
  };

  const abrirDrawer = (vehiculo = null) => {
    if (vehiculo) {
      setVehiculoEdit(vehiculo);
      setFormData({
        NumeroVehiculo: vehiculo.NumeroVehiculo || '',
        TipoSocio: vehiculo.TipoSocio || 'SD',
        NumeroUnidad: vehiculo.NumeroUnidad || '',
        Marca: vehiculo.Marca || '',
        Modelo: vehiculo.Modelo || '',
        TipoVehiculo: vehiculo.TipoVehiculo || 'Sedan',
        TipoCombustible: vehiculo.TipoCombustible || 'Gasolina',
        Año: vehiculo.Año || new Date().getFullYear(),
        Placa: vehiculo.Placa || '',
        Color: vehiculo.Color || 'Blanco',
        NumeroSerie: vehiculo.NumeroSerie || '',
        NumeroMotor: vehiculo.NumeroMotor || '',
        Estado: vehiculo.Estado || 'Disponible',
        KilometrajeActual: vehiculo.KilometrajeActual || 0,
        ProximoMantenimiento: vehiculo.ProximoMantenimiento || 0,
        IntervaloMantenimiento: vehiculo.IntervaloMantenimiento || 10000,
        FechaUltimoServicio: vehiculo.FechaUltimoServicio || '',
        PolizaSeguro: vehiculo.PolizaSeguro || '',
        PolizaVencimiento: vehiculo.PolizaVencimiento || '',
        MontoDeducible: vehiculo.MontoDeducible || 0,
        PolizaSeguroId: vehiculo.PolizaSeguroId || null,
        Observaciones: vehiculo.Observaciones || '',
        ConductorAsignadoId: vehiculo.ConductorAsignadoId || null
      });
      setRequiereInversion(false);
    } else {
      setVehiculoEdit(null);
      setFormData({
        NumeroVehiculo: '',
        TipoSocio: 'SD',
        NumeroUnidad: '',
        Marca: '',
        Modelo: '',
        TipoVehiculo: 'Sedan',
        TipoCombustible: 'Gasolina',
        Año: new Date().getFullYear(),
        Placa: '',
        Color: 'Blanco',
        NumeroSerie: '',
        NumeroMotor: '',
        Estado: 'Disponible',
        KilometrajeActual: 0,
        ProximoMantenimiento: 0,
        IntervaloMantenimiento: 10000,
        FechaUltimoServicio: '',
        PolizaSeguro: '',
        PolizaVencimiento: '',
        MontoDeducible: 0,
        PolizaSeguroId: null,
        Observaciones: '',
        ConductorAsignadoId: null
      });
      
      if (!calculosInversion && !requiereInversion) {
        setDatosInversion({
          valor_factura: '',
          polizas: '',
          placas: '',
          gps: '',
          otros_gastos: '',
          renta_diaria: '',
          plazo_meses: 62,
          tasa_rendimiento: 1.56,
          fecha_inicio: new Date().toISOString().split('T')[0]
        });
        setRequiereInversion(false);
        setInversionistaSeleccionado(null);
        setCalculosInversion(null);
      }
    }
    setShowDrawer(true);
  };

  const cerrarDrawer = () => {
    setShowDrawer(false);
    setVehiculoEdit(null);
    setGuardando(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const vehiculosFiltrados = useMemo(() => {
    return vehiculos.filter(vehiculo => {
      const numeroVehiculo = (vehiculo.NumeroVehiculo || '').toString().toLowerCase();
      const marca = (vehiculo.Marca || '').toLowerCase();
      const modelo = (vehiculo.Modelo || '').toLowerCase();
      const placa = (vehiculo.Placa || '').toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      const matchSearch = 
        numeroVehiculo.includes(searchLower) ||
        marca.includes(searchLower) ||
        modelo.includes(searchLower) ||
        placa.includes(searchLower);
      
      const matchFilter = 
        filterEstado === 'todos' ||
        (filterEstado === 'problemas' && (vehiculo.Estado === 'Siniestro' || vehiculo.Estado === 'Baja')) ||
        (filterEstado === 'Rentado' && (vehiculo.Estado === 'Rentado' || vehiculo.Estado === 'Asignado')) ||
        vehiculo.Estado === filterEstado;
      
      return matchSearch && matchFilter;
    });
  }, [vehiculos, searchTerm, filterEstado]);

  const estadisticas = useMemo(() => ({
    total: vehiculos.length,
    disponibles: vehiculos.filter(v => v.Estado === 'Disponible').length,
    rentados: vehiculos.filter(v => v.Estado === 'Rentado' || v.Estado === 'Asignado').length,
    mantenimiento: vehiculos.filter(v => v.Estado === 'Mantenimiento').length,
    problemas: vehiculos.filter(v => v.Estado === 'Siniestro' || v.Estado === 'Baja').length,
  }), [vehiculos]);

  const totalPages = useMemo(() => {
    if (vehiculosFiltrados.length === 0) return 0;
    return Math.ceil(vehiculosFiltrados.length / ITEMS_PER_PAGE);
  }, [vehiculosFiltrados.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterEstado, viewMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const paginatedVehiculos = useMemo(() => {
    return vehiculosFiltrados.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [vehiculosFiltrados, startIndex]);

  // ========== VALOR DEL CONTEXTO ==========
  const contextValue = {
    formData,
    setFormData,
    datosInversion,
    setDatosInversion,
    requiereInversion,
    setRequiereInversion,
    inversionistaSeleccionado,
    setInversionistaSeleccionado,
    calculosInversion,
    setCalculosInversion,
    setShowCalculadora,
    setShowModalInversionista,
    opcionesDinamicas,
    guardando,
    vehiculo: vehiculoEdit,
    formatCurrency,
    isFormValid,
    validationErrors
  };

  if (loading || cargandoOpciones) {
    return <VehiculosSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Gestión de Vehículos</h1>
          <p className="text-sm sm:text-base text-gray-400">Administra tu flota vehicular</p>
        </div>
        <button
          onClick={() => setShowModalDecision(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-light text-white font-semibold rounded-lg hover:from-primary-light hover:to-primary transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Agregar Vehículo
        </button>
      </div>

      {/* Stats Cards */}
      <VehiculosStats 
        estadisticas={estadisticas} 
        filterEstado={filterEstado}
        onFilterChange={setFilterEstado}
      />

      {/* Search Bar */}
      <div className="glass rounded-lg p-3 sm:p-4 border border-primary/20">
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por número, marca, modelo o placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark/50 border border-primary/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-4 py-2 bg-dark/50 border border-primary/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="todos">Todos los estados</option>
              {opcionesDinamicas.estado.map(estado => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>

            {/* Toggle Vista */}
            <div className="flex items-center gap-1 bg-dark/50 border border-primary/20 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Vista de Lista"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'grid'
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Vista de Rejilla"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table or Grid View */}
      {vehiculosFiltrados.length === 0 ? (
        <div className="glass rounded-lg p-8 text-center border border-primary/20">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">
            {vehiculos.length === 0
              ? 'No hay vehículos registrados'
              : 'No se encontraron vehículos con los filtros aplicados'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <VehiculosTable
          vehiculos={paginatedVehiculos}
          onEdit={abrirDrawer}
          onDelete={handleDelete}
        />
      ) : (
        <VehiculosGrid
          vehiculos={paginatedVehiculos}
          onEdit={abrirDrawer}
          onDelete={handleDelete}
        />
      )}

      {totalPages > 1 && (
        <div className="glass mt-4 rounded-lg border border-primary/20 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-400">
            Mostrando {startIndex + 1} - {startIndex + paginatedVehiculos.length} de {vehiculosFiltrados.length} vehículos
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg border border-primary/30 text-sm text-white hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-300">Página {currentPage} de {totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg border border-primary/30 text-sm text-white hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ========== DRAWER CON CONTEXT PROVIDER ========== */}
      <VehiculoFormProvider value={contextValue}>
        <VehiculoDrawer
          isOpen={showDrawer}
          onClose={cerrarDrawer}
          onSubmit={handleSubmit}
        />
      </VehiculoFormProvider>

      {/* Modal de Decisión */}
      <ModalDecisionVehiculo
        isOpen={showModalDecision}
        onClose={() => setShowModalDecision(false)}
        onCalcularInversion={() => setShowCalculadora(true)}
        onAgregarManual={() => abrirDrawer()}
      />

      {/* Modales */}
      {showCalculadora && (
  <CalculadoraInversion
    isOpen={showCalculadora}
    onClose={(resultado) => {
      if (resultado?.usarDatos) {
        console.log('📊 Resultado completo de calculadora:', resultado);
        console.log('   - modelo:', resultado.modelo);
        console.log('   - datosVehiculo:', resultado.datosVehiculo);
        console.log('   - calculos:', resultado.calculos);
        
        setDatosInversion({
          valor_factura: resultado.datosVehiculo.valor_factura,
          polizas: resultado.datosVehiculo.polizas,
          placas: resultado.datosVehiculo.placas,
          gps: resultado.datosVehiculo.gps,
          otros_gastos: resultado.datosVehiculo.otros_gastos,
          renta_diaria: resultado.datosVehiculo.renta_diaria,
          plazo_meses: resultado.datosVehiculo.plazo_meses,
          tasa_rendimiento: resultado.datosVehiculo.tasa_rendimiento,
          fecha_inicio: new Date().toISOString().split('T')[0]
        });
        
        // ✅ AGREGAR EL CAMPO modelo A calculosInversion
        setCalculosInversion({
          ...resultado.calculos,
          modelo: resultado.modelo, // ✅ ESTO ES LO QUE FALTABA
          corridaTotal: resultado.calculos.corridaTotal || resultado.calculos.total_corrida,
          multiplicadorUsado: resultado.datosVehiculo.tasa_rendimiento,
          plazoDefinido: resultado.datosVehiculo.plazo_meses
        });
        
        setRequiereInversion(true);
        setPendienteAbrirDrawer(true);
        
        console.log('✅ Estados actualizados correctamente:', {
          requiereInversion: true,
          modelo: resultado.modelo,
          calculosInversion: {
            ...resultado.calculos,
            modelo: resultado.modelo
          }
        });
        
        mostrarToast('Datos de inversión cargados. Completa la información del vehículo.', 'success');
      }
      setShowCalculadora(false);
    }}
    datosIniciales={datosInversion}
  />
)}

      {showModalInversionista && (
        <ModalInversionistas
          isOpen={showModalInversionista}
          onClose={() => setShowModalInversionista(false)}
          onSelect={(inversionista) => {
            setInversionistaSeleccionado(inversionista);
            setDatosInversion({
              ...datosInversion,
              tasa_rendimiento: inversionista.tasa_rendimiento || 1.56
            });
            setShowModalInversionista(false);
          }}
        />
      )}
      
      {/* Footer */}
      <div className="glass rounded-lg border border-primary/20 p-4 text-center mt-8">
        <p className="text-sm text-gray-400">
          Desarrollado por{" "}
          <a 
            href="https://somoslazaro.marketing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-light transition-colors font-semibold"
          >
            somoslazaro.marketing
          </a>
        </p>
      </div>
    </div>
  );
};

export default Vehiculos;