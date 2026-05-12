// frontend/src/pages/admin/Vehiculos.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, AlertCircle, Check, X, AlertTriangle, Calculator, LayoutGrid, List, Shield, Car } from 'lucide-react';
import adminService from '../../services/adminService';
import CalculadoraInversion from '../../components/inversiones/CalculadoraInversion';
import ModalInversionistas from '../../components/inversiones/ModalInversionistas';
import ModalDecisionVehiculo from '../../components/vehiculos/ModalDecisionVehiculo';
import VehiculosStats from '../../components/vehiculos/VehiculosStats';
import VehiculosSkeleton from '../../components/vehiculos/VehiculosSkeleton';
import VehiculosTable from '../../components/vehiculos/VehiculosTable';
import VehiculosGrid from '../../components/vehiculos/VehiculosGrid';
import VehiculoDrawer from '../../components/vehiculos/VehiculoDrawer';
import InventarioModal from '../../components/vehiculos/InventarioModal';
import { VehiculoFormProvider } from '../../contexts/VehiculoFormContext.jsx';
import { useAuth } from '../../contexts/AuthContext';
import PolizasModal from '../../components/vehiculos/PolizasModal.jsx';
import ModelosModal from '../../components/vehiculos/ModelosModal.jsx';

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
  const { user } = useAuth();
  const rolUsuario = (user?.rol || user?.role || '').toLowerCase();
  const puedeProcesarSolicitudesBaja = ['super_admin', 'direccion', 'gerente_ops'].includes(rolUsuario);

  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [textoBusqueda, setTextoBusqueda] = useState('');
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
  const [showPolizasModal, setShowPolizasModal] = useState(false);
  const [showModelosModal, setShowModelosModal] = useState(false);
  const [showInventarioModal, setShowInventarioModal] = useState(false);
  const [vehiculoInventario, setVehiculoInventario] = useState(null);
  const [inventarioSnapshotTipo, setInventarioSnapshotTipo] = useState('alta_inicial');
  
  
  // Estados para inversiones
  const [showCalculadora, setShowCalculadora] = useState(false);
  const [showModalInversionista, setShowModalInversionista] = useState(false);
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
    // 🚀 FIX: Verificamos si NO existen cálculos en general, 
    // porque ya no usamos la palabra 'modelo' para evitar que cambie tu combobox.
    if (requiereInversion && 
        datosInversion.valor_factura && 
        datosInversion.renta_diaria && 
        !calculosInversion) {
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
      
      // Verificamos que la respuesta exista antes de tratar de leerla
      if (response && response.opciones) {
        
        //  AQUÍ ESTÁ EL ARREGLO: Usamos "response" en lugar de "data"
        setOpcionesDinamicas({
          tipoSocio: response.opciones.tipoSocio || ['SD', 'SI', 'SA'],
          tipoVehiculo: response.opciones.tipoVehiculo || ['Sedan', 'SUV', 'Pickup'],
          tipoCombustible: response.opciones.tipoCombustible || ['Gasolina', 'Eléctrico'],
          color: response.opciones.color || ['Blanco', 'Negro', 'Gris'],
          estado: response.opciones.estado || ['Disponible', 'Rentado', 'Mantenimiento'],
          marcas: response.opciones.marcas || [],
          modelos: response.opciones.modelos || []
        });
      }
    } catch (error) {
      console.error('Error al cargar opciones:', error);
    } finally {
      setCargandoOpciones(false);
    }
  };

  // FUNCIÓN PARA EJECUTAR LA BÚSQUEDA
  const realizarBusqueda = () => {
    setSearchTerm(textoBusqueda); // Pasamos el texto temporal al filtro real
    setCurrentPage(1); // Regresamos a la primera página
  };

  // DETECTAR ENTER
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      realizarBusqueda();
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
    
    if (!vehiculoEdit && formData.NumeroSerie && !/^[A-Z0-9]{17}$/.test(String(formData.NumeroSerie).toUpperCase())) {
      errors.push('El VIN debe tener exactamente 17 caracteres alfanumericos');
    }

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
    // 1. Validación normal de la pestaña GENERAL y MANTENIMIENTO
    const errores = validarFormulario();
    if (errores.length > 0) {
      mostrarToast(errores[0], 'error');
      return;
    }
    const esEdicion = Boolean(vehiculoEdit);
    
    // ==============================================================
    // 🚨 NUEVO CADENERO: Validar la pestaña de INVERSIÓN (Obligatoria)
    // ==============================================================
    // Solo forzamos inversión en altas nuevas. En edición se permite actualizar
    // sin bloquear por campos financieros para evitar fricción operativa.
    if (!esEdicion) {
      // Verificamos que haya llenado los campos clave de la pestaña financiera
      if (!datosInversion.valor_factura || !datosInversion.renta_diaria) {
        mostrarToast('⚠️ Faltan datos financieros. Completa el Precio del Vehículo y la Renta Diaria en la pestaña de Inversión.', 'warning');
        return; // ¡Cortamos la ejecución!
      }

      // Verificamos que la calculadora sí exista en memoria (que no esté en blanco)
      if (!calculosInversion) {
        mostrarToast('⚠️ Faltan los cálculos financieros. Revisa la pestaña de Inversión.', 'warning');
        return; // ¡Cortamos la ejecución!
      }
    }
    // ==============================================================
    
    setGuardando(true);
    
    try {
      const datosVehiculo = {};
      Object.keys(formData).forEach(key => {
        const valor = formData[key];

        // ConductorAsignadoId se administra solo en flujos dedicados (asignar/cambiar).
        if (key === 'ConductorAsignadoId') {
          return;
        }

        // NumeroVehiculo es derivado/estable y no se edita por update manual.
        if (key === 'NumeroVehiculo' && vehiculoEdit) {
          return;
        }

        if (key === 'PolizaSeguroId' && (!valor || valor === null)) {
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

      // ==============================================================
      // 🎯 NUEVA LÓGICA: Agregar campos financieros para TODOS (SD, SA, SI)
      // ==============================================================
      if (requiereInversion && calculosInversion) {
        const tipoSocioActual = datosVehiculo.TipoSocio || formData.TipoSocio || 'SD';
        console.log(`✅ Procesando campos financieros generales para tipo: ${tipoSocioActual}`);

        // SIN IMPORTAR el tipo de socio, inyectamos los datos financieros al vehículo
        const corrida = calculosInversion.corridaTotal || calculosInversion.datosVehiculo?.corrida_total;
        datosVehiculo.total_corrida = parseFloat(corrida) || 0;

        const multiplicador = calculosInversion.multiplicadorUsado || calculosInversion.datosVehiculo?.tasa_rendimiento || calculosInversion.datosVehiculo?.multiplicador_usado;
        datosVehiculo.multiplicador_corrida = parseFloat(multiplicador) || 0;

        const plazo = calculosInversion.plazoDefinido || calculosInversion.datosVehiculo?.plazo_meses;
        datosVehiculo.plazo_corrida = parseInt(plazo, 10) || 0;

        const inversionTotal = calculosInversion.inversionTotal || calculosInversion.datosVehiculo?.inversion_total;
        datosVehiculo.precio_compra = parseFloat(inversionTotal) || 0;
        
        const rentaSugerida = calculosInversion.rentaDiaria || calculosInversion.datosVehiculo?.renta_diaria || datosInversion?.renta_diaria;
        datosVehiculo.renta_sugerida = parseFloat(rentaSugerida) || 0;
        
        
        console.log('✅ Campos Financieros agregados a datosVehiculo para TODOS:', {
          total_corrida: datosVehiculo.total_corrida,
          multiplicador_corrida: datosVehiculo.multiplicador_corrida,
          plazo_corrida: datosVehiculo.plazo_corrida,
          precio_compra: datosVehiculo.precio_compra, 
          renta_sugerida: datosVehiculo.renta_sugerida
        });
      }
      // ==============================================================

      // ==============================================================
      // 🛠️ FIX DEFINITIVO DEL NÚMERO DE VEHÍCULO
      // Lo construimos hasta el final para garantizar que ya tenemos el TipoSocio correcto
      // ==============================================================
      const tipoSocioFinal = datosVehiculo.TipoSocio || formData.TipoSocio || 'SD';
      const numeroUnidadLimpio = String(datosVehiculo.NumeroUnidad || formData.NumeroUnidad || '0').padStart(4, '0');
      
      datosVehiculo.TipoSocio = tipoSocioFinal;
      datosVehiculo.NumeroVehiculo = `${tipoSocioFinal}-${numeroUnidadLimpio}`;
      
      console.log('7️⃣ DATOS FINALES A ENVIAR AL BACKEND:', JSON.stringify(datosVehiculo, null, 2));
      // ==============================================================

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
            tasa_rendimiento: 2.82, // ✅ Fijo para SI_LEGADO
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

      if (!vehiculoEdit) {
        const vehiculoCreado = vehiculoResponse?.vehiculo || null;
        if (vehiculoCreado?.id) {
          setVehiculoInventario(vehiculoCreado);
          setShowInventarioModal(true);
          mostrarToast('Vehiculo creado. Completa su inventario inicial para dejarlo listo.', 'warning');
        }
      }

      await cargarVehiculos();
      
      // 2. 🧹 LIMPIEZA ABSOLUTA ANTES DE CERRAR
      setRequiereInversion(false);
      setInversionistaSeleccionado(null);
      setCalculosInversion(null); // Matamos el cuadro azul
      
      // Limpiamos los datos de inversión
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

      // Si tienes un estado "formData", asegúrate de limpiarlo aquí también. 
      // Algo como: setFormData(valoresIniciales);

      // 3. 🚪 CERRAR EL DRAWER AL FINAL
      cerrarDrawer();

    } catch (error) {
      console.error('❌ Error:', error);
      mostrarToast(error.message || 'Error al guardar el vehículo', 'error');
    } finally {
      setGuardando(false);
    }
  };

  // Función para aprobar o rechazar bajas
  const handleProcesarBaja = async (id, accion) => {
    // Confirmación opcional (ya la tienes en el hijo, pero por seguridad)
    // if (!window.confirm(`¿Confirmar ${accion.toUpperCase()}?`)) return;
    if (!puedeProcesarSolicitudesBaja) {
      mostrarToast('No tienes permisos para procesar solicitudes de baja', 'error');
      return;
    }

    try {
      await adminService.gestionarBajaVehiculo(id, accion);
      mostrarToast(`Solicitud ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} correctamente`, 'success');
      
      // Recargamos la lista para ver el cambio de estado
      await cargarVehiculos();
    } catch (error) {
      console.error('Error:', error);
      mostrarToast(error.message || 'Error al procesar la solicitud', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este vehículo?')) return;
    
    try {
      const response = await adminService.deleteVehiculo(id);
      mostrarToast(response?.message || 'Vehículo eliminado exitosamente', 'success');
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
      
      // 🚀 ¡BRAM! LE QUITAMOS EL IF. 
      // Limpieza OBLIGATORIA SIEMPRE que abres un nuevo formulario
      setDatosInversion({
        valor_factura: '',
        polizas: '',
        placas: '',
        gps: '',
        otros_gastos: '',
        renta_diaria: '',
        plazo_meses: 62,
        tasa_rendimiento: 2.82,
        fecha_inicio: new Date().toISOString().split('T')[0]
      });
      setRequiereInversion(false);
      setInversionistaSeleccionado(null);
      setCalculosInversion(null); // 💀 RIP Fantasma del cuadro azul
    }
    
    setShowDrawer(true);
  };

  const cerrarDrawer = () => {
    setShowDrawer(false);
    setVehiculoEdit(null);
    setGuardando(false);
    // 💡 También es buena práctica matarlo al cerrar, por si acaso le dieron a "Cancelar"
    setCalculosInversion(null);
    setRequiereInversion(false);
  };

  const abrirInventarioModal = (vehiculo, tipo = 'alta_inicial') => {
    if (!vehiculo?.id) {
      mostrarToast('No se pudo identificar el vehiculo', 'error');
      return;
    }
    const tiposPermitidos = new Set(['alta_inicial', 'entrega_conductor', 'devolucion_conductor']);
    const tipoNormalizado = tiposPermitidos.has(tipo) ? tipo : 'alta_inicial';
    setVehiculoInventario(vehiculo);
    setInventarioSnapshotTipo(tipoNormalizado);
    setShowInventarioModal(true);
  };

  const cerrarInventarioModal = () => {
    setShowInventarioModal(false);
    setVehiculoInventario(null);
    setInventarioSnapshotTipo('alta_inicial');
  };


  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

const vehiculosFiltrados = useMemo(() => {
    // PASO 1: FILTRADO (Buscador + Dropdown)
    const filtrados = vehiculos.filter(vehiculo => {
      const estado = vehiculo.Estado || vehiculo.estado;
      if (estado === 'Baja' && filterEstado !== 'Baja') return false;
      // Normalización
      const numeroVehiculo = (vehiculo.NumeroVehiculo || '').toString().toLowerCase();
      const marca = (vehiculo.Marca || '').toLowerCase();
      const modelo = (vehiculo.Modelo || '').toLowerCase();
      const placa = (vehiculo.Placa || '').toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      // Coincidencia Buscador
      const matchSearch = 
        numeroVehiculo.includes(searchLower) ||
        marca.includes(searchLower) ||
        modelo.includes(searchLower) ||
        placa.includes(searchLower);
      
      // Coincidencia Dropdown
      // Nota: Aquí permitimos que pasen las 'Solicitud_baja' si el filtro es 'todos'
      const pendienteInventario = !vehiculo.tiene_inventario_inicial;

      const matchFilter = 
        filterEstado === 'todos' ||
        (filterEstado === 'inventario_pendiente' && pendienteInventario) ||
        (filterEstado === 'problemas' && (vehiculo.Estado === 'Siniestro' || vehiculo.Estado === 'Baja')) ||
        vehiculo.Estado === filterEstado || 
        (filterEstado === 'todos' && vehiculo.Estado === 'Solicitud_baja'); // Aseguramos que se vean en "todos"

      return matchSearch && matchFilter;
    });

    // PASO 2: ORDENAMIENTO (Prioridad a Solicitudes)
    return filtrados.sort((a, b) => {
      const estadoA = a.Estado || a.estado;
      const estadoB = b.Estado || b.estado;

      const esSolicitudA = estadoA === 'Solicitud_baja';
      const esSolicitudB = estadoB === 'Solicitud_baja';

      // Si A es solicitud y B no -> A va primero (-1)
      if (esSolicitudA && !esSolicitudB) return -1;
      
      // Si A no es solicitud y B sí -> B va primero (1)
      if (!esSolicitudA && esSolicitudB) return 1;

      // Si ambos son iguales (ambos solicitud o ninguno), mantenemos el orden original (por ID o como venga)
      return 0; 
    });

  }, [vehiculos, searchTerm, filterEstado]);

  const estadisticas = useMemo(() => ({
    total: vehiculos.length,
    disponibles: vehiculos.filter(v => v.Estado === 'Disponible').length,
    rentados: vehiculos.filter(v => v.Estado === 'Rentado' || v.Estado === 'Asignado').length,
    mantenimiento: vehiculos.filter(v => v.Estado === 'Mantenimiento').length,
    problemas: vehiculos.filter(v => v.Estado === 'Siniestro' || v.Estado === 'Solicitud_baja').length,
    inventarioPendiente: vehiculos.filter((v) => !v.tiene_inventario_inicial).length,
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
        
        {/*  Contenedor de botones  */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">

          {/* NUEVO BOTÓN: Gestión de Modelos */}
          <button
            onClick={() => setShowModelosModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 border border-gray-600 transition-all duration-200 shadow-lg"
          >
            <Car className="w-5 h-5 text-green-400" />
            Catálogo de Modelos
          </button>
          
          {/* NUEVO BOTÓN: Pólizas */}
          <button
            onClick={() => setShowPolizasModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 border border-gray-600 transition-all duration-200 shadow-lg"
          >
            <Shield className="w-5 h-5 text-blue-400" /> {/* Asegúrate de importar Shield de lucide-react */}
            Gestión de Pólizas
          </button>

          {/* BOTÓN ORIGINAL: Agregar Vehículo */}
          <button
            onClick={() => abrirDrawer()} 
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-light text-white font-semibold rounded-lg hover:from-primary-light hover:to-primary transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Agregar Vehículo
          </button>
        </div>
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
          
          {/* 🟢 BARRA DE BÚSQUEDA MANUAL */}
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por número, marca, modelo o placa..."
                
                // 1. Usamos el estado temporal
                value={textoBusqueda} 
                onChange={(e) => setTextoBusqueda(e.target.value)}
                
                // 2. Detectamos el Enter
                onKeyDown={handleKeyDown} 
                
                className="w-full pl-10 pr-4 py-2 bg-dark/50 border border-primary/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            {/* 3. Botón de Buscar */}
            <button
              onClick={realizarBusqueda}
              className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-colors flex items-center gap-2 font-medium"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Buscar</span>
            </button>
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
          onProcesarBaja={handleProcesarBaja}
          onOpenInventario={abrirInventarioModal}
          puedeProcesarSolicitudesBaja={puedeProcesarSolicitudesBaja}
        />
      ) : (
        <VehiculosGrid
          vehiculos={paginatedVehiculos}
          onEdit={abrirDrawer}
          onDelete={handleDelete}
          onOpenInventario={abrirInventarioModal}
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
          plazoDefinido: resultado.datosVehiculo.plazo_meses,
          inversionTotal: resultado.calculos.inversionTotal || resultado.calculos.inversion_total || 0

        });
        
        setRequiereInversion(true);

        
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
    tipoSocio={formData?.TipoSocio}
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

      {showPolizasModal && (
        <PolizasModal 
          isOpen={showPolizasModal} 
          onClose={() => setShowPolizasModal(false)} 
        />
      )}

      {showModelosModal && (
        <ModelosModal 
          isOpen={showModelosModal} 
          onClose={() => {
            setShowModelosModal(false); // Cierra el modal
            
            //  LA MAGIA: Le decimos a la página que vuelva a descargar las opciones
            if (typeof cargarOpciones === 'function') {
              cargarOpciones(); 
            } else if (typeof cargarDatos === 'function') {
              cargarDatos(); // Usa esta si tu función principal se llama cargarDatos
            }
          }} 
        />
      )}

      {showInventarioModal && (
        <InventarioModal
          isOpen={showInventarioModal}
          onClose={cerrarInventarioModal}
          vehiculo={vehiculoInventario}
          notify={mostrarToast}
          onSaved={cargarVehiculos}
          initialSnapshotTipo={inventarioSnapshotTipo}
        />
      )}
      
    </div>
  );
};

export default Vehiculos;

