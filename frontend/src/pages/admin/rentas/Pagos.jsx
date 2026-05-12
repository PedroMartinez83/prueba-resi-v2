import React, { useState, useEffect } from 'react';
import adminService from '../../../services/adminService';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import ModalRegistrarPago from '../../../components/pagos/ModalRegistrarPago';
import ModalDetalles from './components/ModalDetalles';
import { useAuth } from "../../../contexts/AuthContext";
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { 
  FileText, 
  Plus, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  Car,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Download,
  Search,
  TrendingUp,
  History,
  Ban,
  FileText as FileTextIcon, 
  CheckSquare,
  CheckCircle2
} from 'lucide-react';

const Rentas = () => {
  const TOLERANCIA_DIAS = 2;

  // Estados principales
  const [rentas, setRentas] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [opciones, setOpciones] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  // Nuevos estados para la Selección Múltiple
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [pagosSeleccionados, setPagosSeleccionados] = useState([]);

  // Función para encender/apagar el modo y limpiar
  const toggleModoSeleccion = () => {
    setModoSeleccion(!modoSeleccion);
    setPagosSeleccionados([]); // Limpiamos si el usuario se arrepiente y cancela
  };

  const togglePago = (id) => {
    setPagosSeleccionados(prev => 
      prev.includes(id) 
        ? prev.filter(pId => pId !== id) 
        : [...prev, id]
    );
  };

  // Función temporal (Solo para probar que atrapamos los IDs)
const handleAprobarMultiples = async () => {
    // 1. Doble confirmación de seguridad
    if (!window.confirm(`¿Estás seguro de que deseas APROBAR los ${pagosSeleccionados.length} pagos seleccionados? Esta acción actualizará los saldos de los vehículos automáticamente.`)) {
      return;
    }

    try {
      // 2. Llamada al Backend usando tu adminService
      // OJO: Asegúrate de tener importado adminService en la parte superior del archivo
      const response = await adminService.fetchWithAuth('/admin/pagos-rentas/masivo/confirmar', {
        method: 'POST',
        body: JSON.stringify({ pagosIds: pagosSeleccionados })
      });

      // 3. Manejo de la respuesta
      if (response && response.success) {
        toast.success(response.message); // Notificación de éxito
        setModoSeleccion(false);         // Apagamos los checkboxes
        setPagosSeleccionados([]);       // Limpiamos los IDs
        cargarDatos();                   // Recargamos la tabla para que se pinten de verde
      } else {
        toast.error(response?.message || 'Error desconocido al validar pagos.');
      }

    } catch (error) {
      console.error('Error validación masiva:', error);
      // Mostramos el mensaje de error exacto que nos lanza tu validación de fechas en Node
      toast.error(error.message || 'Ocurrió un error al conectar con el servidor.');
    }
  };

  
  // Estados de filtros
  const [filtros, setFiltros] = useState({
    status: '',
    conductor_id: '',
    vehiculo_id: '',
    metodo_pago: '',
    fecha_registro_desde: '',
    fecha_registro_hasta: '',
    busqueda: ''
  });
  
  // Estados de modales
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedRenta, setSelectedRenta] = useState(null);
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    cargarDatos();
  }, [filtros, currentPage]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const params = {
        ...filtros,
        page: currentPage,
        limit: itemsPerPage
      };
      
      // Limpiar parámetros vacíos
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) {
          delete params[key];
        }
      });
      
      // Remover filtros de búsqueda local (no van al backend)
      delete params.busqueda_vehiculo;
      
      const [pagosData, estadisticasData, opcionesData] = await Promise.all([
        adminService.getPagosRentas(params),
        adminService.getEstadisticasPagosRentas({ 
          fecha_desde: filtros.fecha_desde, 
          fecha_hasta: filtros.fecha_hasta 
        }),
        opciones ? Promise.resolve({ opciones }) : adminService.getOpcionesPagosRentas()
      ]);
      
      console.log('✅ Datos cargados:', {
        pagos: pagosData.pagos?.length,
        opciones: opcionesData.opciones?.conductores?.length
      });
      
      setRentas(pagosData.pagos || []);
      setEstadisticas(estadisticasData.estadisticas || {});
      setTotalPages(pagosData.pagination?.totalPages || 1);
      
      if (!opciones && opcionesData.opciones) {
        console.log('📋 Conductores disponibles:', opcionesData.opciones.conductores?.length);
        setOpciones(opcionesData.opciones);
      }
      
    } catch (error) {
      console.error('❌ Error cargando rentas:', error);
      alert('Error al cargar las rentas. Por favor, recarga la página.');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (key, value) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // 🆕 Función para ejecutar la búsqueda (Botón o Enter)
const realizarBusqueda = () => {
  setFiltros(prev => ({
    ...prev,
    busqueda: textoBusqueda // Pasamos el texto local al filtro real
  }));
  setCurrentPage(1); // Reseteamos a la página 1
};

// 🆕 Manejador de tecla Enter
const handleKeyDown = (e) => {
  if (e.key === 'Enter') {
    realizarBusqueda();
  }
};

  const limpiarFiltros = () => {
    setTextoBusqueda('');
    setFiltros({
      status: '',
      conductor_id: '',
      vehiculo_id: '',
      metodo_pago: '',
      fecha_desde: '',
      fecha_hasta: '',
      busqueda: ''
    });
    setCurrentPage(1);
  };


  const handleCreateRenta = () => {
    setSelectedRenta(null);
    setModalType('create');
    setShowModal(true);
  };

  const handleEditRenta = (renta) => {
    setSelectedRenta(renta);
    setModalType('edit');
    setShowModal(true);
  };

  const { user } = useAuth();

  const handleEliminarPago = async (id) => {
    // 1. Buscamos el pago completo
    const pago = rentas.find(r => r.id === id);
    if (!pago) return;

    // =====================================================================
    // 🛑 CANDADO DE SEGURIDAD (Validaciones de Integridad)
    // =====================================================================
    
    // Solo validamos si el pago que quieres borrar ya es "oficial" (Confirmado/Pagada)
    if (['Confirmado', 'Pagada'].includes(pago.status)) {

      // A. CANDADO DE PENDIENTES (NUEVO) 🔒
      // "Si hay CUALQUIER pago pendiente de este coche, no toques nada confirmado."
      const existePendiente = rentas.find(r => 
        r.asignacion_id === pago.asignacion_id && 
        r.status === 'Pendiente'
      );

      if (existePendiente) {
        const fechaPendiente = new Date(existePendiente.fecha_pago).toLocaleDateString('es-MX');
        alert(
          `⛔ ACCIÓN BLOQUEADA\n\n` +
          `No puedes eliminar pagos históricos mientras exista una solicitud PENDIENTE (del ${fechaPendiente}).\n\n` +
          `Primero debes Resolver (Validar o Rechazar) los pagos pendientes antes de modificar el historial.`
        );
        return; // 🚪 SE CIERRA LA PUERTA
      }

      // B. FRENO DE MANO (LIFO - El que ya tenías) 🛑
      // "No borres el pasado si hay futuro confirmado."
      const fechaPagoActual = new Date(pago.fecha_pago).toISOString().split('T')[0];

      const existePosteriorConfirmado = rentas.find(r => {
        if (r.asignacion_id !== pago.asignacion_id) return false;
        if (r.id === pago.id) return false;
        // Solo nos preocupan los confirmados futuros
        if (!['Confirmado', 'Pagada', 'Solicitud_borrado'].includes(r.status)) return false;

        const fechaR = new Date(r.fecha_pago).toISOString().split('T')[0];
        return fechaR > fechaPagoActual; 
      });

      if (existePosteriorConfirmado) {
        const fechaBloqueo = new Date(existePosteriorConfirmado.fecha_pago).toLocaleDateString('es-MX');
        alert(
          `⛔ OPERACIÓN DENEGADA (Orden Cronológico)\n\n` +
          `No puedes eliminar este registro porque existe un pago POSTERIOR confirmado (del ${fechaBloqueo}).\n\n` +
          `Debes eliminar los pagos en orden inverso: desde el más reciente hacia atrás.`
        );
        return; 
      }
    }
    // =====================================================================


// =====================================================================
    // 📝 LÓGICA DE INTERACCIÓN (PROMPTS)
    // =====================================================================
    let motivoBaja = '';
    const esAprobacion = pago.status === 'Solicitud_borrado';

    // --- CASO A: GERENTE (Siempre pide motivo) ---
    if (user?.rol === 'gerente_ops') {
       motivoBaja = window.prompt("📝 SOLICITUD DE BAJA\n\nComo Gerente, justifica esta eliminación:\nEscribe el motivo:");
       if (motivoBaja === null || motivoBaja.trim().length < 5) return;
    } 
    
    // --- CASO B: ADMIN / SUPER_ADMIN ---
    else {
       
       if (esAprobacion) {
           // 🟢 NUEVA LÓGICA: Si es una SOLICITUD, NO pedimos motivo.
           // Simplemente confirmamos la acción.
           const confirmar = window.confirm(
               `✅ APROBACIÓN DE BAJA\n\n` +
               `Estás a punto de aprobar la eliminación solicitada por Operaciones.\n` +
               `Observaciones actuales: "${pago.observaciones}"\n\n` +
               `¿Confirmar eliminación definitiva?`
           );
           
           if (!confirmar) return;
           
           // Enviamos vacío para que el backend use la lógica de "[✅ Solicitud Aprobada]"
           motivoBaja = ''; 

       } else {
           // 🔴 LÓGICA NORMAL: Si es un pago normal, pedimos motivo opcional
           motivoBaja = window.prompt("Escribe el motivo de la eliminación (Opcional):");
           if (motivoBaja === null) return; // Cancelar

           if (!window.confirm('⚠️ ¿Estás seguro de eliminar este pago permanentemente? Se revertirán los saldos.')) {
               return;
           }
       }
    }

    // =====================================================================
    // 🚀 PASO 3: EJECUCIÓN
    // =====================================================================
try {
      setLoadingAction(true);
      const response = await adminService.eliminarPagoRenta(id, motivoBaja);
      alert(response.message || '✅ Acción completada correctamente');
      await cargarDatos(); 
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || error.message;
      alert(`❌ Error: ${msg}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRestaurarPago = async (id) => {
    if (!window.confirm('¿Deseas cancelar la solicitud de baja y restaurar este pago como Confirmado?')) return;

    try {
      setLoadingAction(true);
      
      // Llamamos al servicio (necesitarás crear este endpoint o usar uno genérico de update)
      await adminService.cambiarStatusPago(id, 'Confirmado');
      
      alert('✅ Solicitud rechazada. El pago sigue activo.');
      cargarDatos(); // Recargar tabla
    } catch (error) {
      console.error(error);
      alert('Error al restaurar el pago');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleViewRenta = (renta) => {
    setSelectedRenta(renta);
    setModalType('view');
    setShowModal(true);
  };

  const handleVerHistorial = async (conductorId) => {
    try {
      setLoadingAction(true);
      const historial = await adminService.getHistorialPagosConductor(conductorId);
      setSelectedRenta(historial);
      setModalType('historial');
      setShowModal(true);
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      alert('Error al obtener el historial');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleValidarPago = async (pagoId) => {
      // 1. Buscamos el pago que queremos validar
      const pagoSeleccionado = rentas.find(p => p.id === pagoId);
      if (!pagoSeleccionado) return;

      // 2. 🛡️ VALIDACIÓN FIFO EN FRONTEND
      // Buscamos si hay algún pago del mismo conductor, que sea Pendiente y sea MAS VIEJO
      const existeAnteriorPendiente = rentas.find(p => {
          // Mismo conductor
          if (String(p.conductor_id) !== String(pagoSeleccionado.conductor_id)) return false;
          
          // Mismo pago (ignorar)
          if (p.id === pagoSeleccionado.id) return false;

          // Solo nos importan los pendientes
          if (p.status !== 'Pendiente') return false;

          // Comparar fechas: Si fechaP < fechaSel, hay uno más viejo pendiente
          const fechaP = new Date(p.fecha_pago).toISOString().split('T')[0];
          const fechaSel = new Date(pagoSeleccionado.fecha_pago).toISOString().split('T')[0];
          
          return fechaP < fechaSel;
      });

      if (existeAnteriorPendiente) {
          const fechaPendiente = new Date(existeAnteriorPendiente.fecha_pago).toLocaleDateString('es-MX');
          
          alert(
            `⚠️ ACCIÓN BLOQUEADA\n\n` +
            `Existe un pago ANTERIOR pendiente (del día ${fechaPendiente}) de este conductor.\n\n` +
            `Por seguridad, debes validar los pagos en orden cronológico: primero los más antiguos.`
          );
          return; // 🛑 Detenemos aquí
      }

      // 3. Confirmación Normal
      if (!window.confirm(`¿Confirmar pago del día ${new Date(pagoSeleccionado.fecha_pago).toLocaleDateString()}?`)) return;
      
      const observacionesViejas = pagoSeleccionado.observaciones || '';

      try {
        setLoadingAction(true);
        
        await adminService.validarPagoRenta(pagoId, {
          observaciones: observacionesViejas
        });

        await cargarDatos();
        alert('✅ Pago validado exitosamente');
        
      } catch (error) {
        console.error('Error validando pago:', error);
        // Capturamos el mensaje del backend por si acaso falló la validación local
        const mensaje = error.response?.data?.message || 'Error al validar el pago';
        alert(`❌ Error: ${mensaje}`);
      } finally {
        setLoadingAction(false);
      }
    };

const handleRechazarPago = async (pagoId) => {
    // 1. Buscamos el pago seleccionado
    const pagoSeleccionado = rentas.find(r => r.id === pagoId);
    if (!pagoSeleccionado) return; 

    // 2. 🛡️ VALIDACIÓN (Ahora solo mira los PENDIENTES)
    const existePosterior = rentas.find(p => {
        // A. Mismo conductor
        if (String(p.conductor_id) !== String(pagoSeleccionado.conductor_id)) return false;
        
        // B. Ignoramos el mismo pago
        if (p.id === pagoSeleccionado.id) return false;

        // 🟢 C. CRUCIAL: Solo nos importa si el pago futuro TAMBIÉN es PENDIENTE.
        // Si ya está confirmado, no estorba para rechazar este.
        if (p.status !== 'Pendiente') return false;

        // D. Comparación de Fechas
        const fechaP = new Date(p.fecha_pago).toISOString().split('T')[0];
        const fechaSel = new Date(pagoSeleccionado.fecha_pago).toISOString().split('T')[0];
        
        return fechaP > fechaSel;
    });

    if (existePosterior) {
        const fechaConflicto = new Date(existePosterior.fecha_pago).toLocaleDateString('es-MX');
        
        alert(
          `⚠️ ACCIÓN BLOQUEADA\n\n` +
          `Existe una solicitud PENDIENTE posterior (del día ${fechaConflicto}).\n\n` +
          `Para mantener el orden, debes rechazar primero la solicitud más reciente.`
        );
        return; 
    }

    // 3. 📝 FLUJO NORMAL
    const motivo = window.prompt('Motivo del rechazo:');
    if (!motivo) return; 
    
    try {
      setLoadingAction(true);
      await adminService.rechazarPagoRenta(pagoId, motivo);
      await cargarDatos();
      alert('✅ Pago rechazado correctamente');
    } catch (error) {
      console.error('Error rechazando pago:', error);
      const mensajeBackend = error.response?.data?.error || error.message || 'Error al procesar';
      alert(`❌ No se pudo rechazar:\n${mensajeBackend}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalType('');
    setSelectedRenta(null);
  };


  // 🚀 NUEVA LÓGICA PURA: Calcula días de atraso sin domingos
const calcularAtrasoReal = (fechaPago, fechaRegistro) => {
  if (!fechaPago || !fechaRegistro) return 'N/A';

  // Convertimos a fechas de JavaScript
  const start = new Date(fechaPago);
  const end = new Date(fechaRegistro);

  // Normalizamos a la medianoche (00:00:00) para que las horas no afecten el conteo
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  // Si pagó el mismo día o por adelantado, tiene 0 días de atraso
  if (end <= start) return 0;

  let diasAtraso = 0;
  let fechaActual = new Date(start);
  
  // Empezamos a revisar desde el día siguiente al que le tocaba
  fechaActual.setDate(fechaActual.getDate() + 1);

  // Avanzamos día por día hasta llegar al día en que realmente pagó
  while (fechaActual <= end) {
    // getDay() devuelve 0 para el Domingo. Solo contamos si NO es domingo (1 al 6).
    if (fechaActual.getDay() !== 0) {
      diasAtraso++;
    }
    // Pasamos al siguiente día
    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  return diasAtraso;
};

  // 1. La función es async porque llamaremos a tu adminService.getPagosRentas
const handleExportarExcel = async () => {
  
  try {
    // (Opcional) Aquí puedes poner un estado para mostrar un "Cargando Excel..."
    // setCargandoExcel(true);

    // 2. 🚀 Preparamos los filtros exactos para el Excel
    // Asumiendo que tienes un estado llamado 'filtros' donde guardas lo que el usuario buscó.
    // Si tus filtros se llaman diferente (ej. filtrosBusqueda), cámbialo aquí.
    const filtrosParaExcel = {
      ...filtros, // Clonamos los filtros actuales (fechas, status, etc.)
      limit: 100000, // 👈 EL TRUCO: Rompemos la paginación pidiendo un límite altísimo
      page: 1        // 👈 Siempre pedimos desde la página 1 para que traiga todo
    };

    // 3. 🌐 Llamamos a tu servicio
    const response = await adminService.getPagosRentas(filtrosParaExcel);

    // 4. Extraemos la data del servidor. 
    // OJO: Checa cómo viene tu response. A veces viene en response.data, response.pagos, o directo.
    const rentasCompletas = response.data || response.pagos || response;

    // 🛡️ Validación por si no hay nada
    if (!rentasCompletas || rentasCompletas.length === 0) {
      alert("No se encontraron datos con esos filtros para exportar.");
      return;
    }

    // 5. MAPEAMOS LOS DATOS (Tu lógica intacta)
    const datosExport = rentasCompletas.map(r => {
      const infoTolerancia = obtenerInfoTolerancia(getPagoFechaBase(r));
      const fechaBase = getPagoFechaBase(r);
      const fechaCorresp = obtenerFechaCorrespondiente(fechaBase);

      // 🚀 NUEVA LÓGICA: Rango de Fechas de Pago
      const fechaInicioStr = formatDate(r.fecha_pago);
      const fechaFinStr = r.fecha_pago_fin ? formatDate(r.fecha_pago_fin) : fechaInicioStr;
      
      const fechaPagoMostrar = fechaInicioStr !== fechaFinStr 
        ? `${fechaInicioStr} al ${fechaFinStr}` 
        : fechaInicioStr;

      return {
        'Folio': r.id,
        'Conductor': r.nombre_conductor || 'N/A',
        'Vehículo': r.numero_vehiculo || 'N/A',
        'Tipo Socio': r.tipo_socio || 'N/A',
        'Monto Renta': Number(r.monto_renta_pagado || 0),
        'Monto Póliza': Number(r.monto_poliza_pagado || 0),
        'Monto Total': Number(r.monto_total || 0),
        'Fecha Pago': formatDate(r.created_at),
        'Día que cubre': fechaPagoMostrar,
        'Días de Atraso (S/D)': Number(calcularAtrasoReal(r.fecha_pago, r.created_at)),
        'Método Pago': r.metodo_pago || 'N/A',
        'Estado': r.status || 'N/A',
        'Observaciones': r.observaciones || ''
      };
    });

    // 6. CREAMOS EL EXCEL Y DESCARGAMOS
    const hoja = XLSX.utils.json_to_sheet(datosExport);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Reporte de Rentas");

    const anchos = [
      { wch: 8 }, { wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 15 },
      { wch: 15 }, { wch: 12 }, { wch: 30 }
    ];
    hoja['!cols'] = anchos;

    const fechaHoy = new Date().toISOString().split('T')[0];
    XLSX.writeFile(libro, `Reporte_Rentas_${fechaHoy}.xlsx`);

  } catch (error) {
    console.error("Error al exportar a Excel:", error);
    alert("❌ Hubo un error al intentar descargar el reporte completo. Verifica tu conexión.");
  } finally {
    // setCargandoExcel(false);
  }
};

  const goToDashboard = () => {
    window.location.href = '/admin/rentas';
  };

  const getEstadoColor = (estado) => {
    const colores = {
      'Pendiente': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'Confirmado': 'bg-green-500/10 text-green-400 border-green-500/20',
      'Rechazado': 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    return colores[estado] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  };

  const getEstadoIcon = (estado) => {
    const iconos = {
      'Pendiente': Clock,
      'Confirmado': CheckCircle,
      'Rechazado': XCircle
    };
    const IconComponent = iconos[estado] || Clock;
    return <IconComponent className="w-4 h-4" />;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPagoRangoLabel = (pago) => {
    if (!pago) return null;
    if (pago.dias_cubiertos) return pago.dias_cubiertos;
    if (pago.rango_inicio || pago.rango_fin) {
      return pago.rango_inicio && pago.rango_fin && pago.rango_inicio !== pago.rango_fin
        ? `${pago.rango_inicio} a ${pago.rango_fin}`
        : (pago.rango_inicio || pago.rango_fin);
    }
    if (pago.fecha_pago_fin) {
      return pago.fecha_pago && pago.fecha_pago !== pago.fecha_pago_fin
        ? `${pago.fecha_pago} a ${pago.fecha_pago_fin}`
        : pago.fecha_pago;
    }
    return pago.fecha_pago || null;
  };

  const getPagoFechaBase = (pago) => (
    pago?.fecha_pago_fin || pago?.fecha_pago || null
  );

  const obtenerFechaCorrespondiente = (fechaPago) => {
    if (!fechaPago) return null;
    const fecha = new Date(fechaPago);
    if (Number.isNaN(fecha.getTime())) return null;

    // Si fuera domingo, considerar el sábado previo porque no se cobran rentas ese día
    if (fecha.getDay() === 0) {
      const ajustada = new Date(fecha);
      ajustada.setDate(ajustada.getDate() - 1);
      ajustada.setHours(0, 0, 0, 0);
      return ajustada;
    }

    fecha.setHours(0, 0, 0, 0);
    return fecha;
  };

  const contarDiasHabilesSinDomingos = (inicio, fin = new Date()) => {
    if (!inicio) return null;
    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);
    fechaInicio.setHours(0, 0, 0, 0);
    fechaFin.setHours(0, 0, 0, 0);

    let dias = 0;
    const cursor = new Date(fechaInicio);

    while (cursor < fechaFin) {
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() !== 0) {
        dias += 1;
      }
    }

    return dias;
  };

  const obtenerInfoTolerancia = (fechaPago) => {
    const fechaCorresponde = obtenerFechaCorrespondiente(fechaPago);
    if (!fechaCorresponde) {
      return {
        fechaCorresponde: null,
        diasHabilesTranscurridos: null,
        diasRestantesTolerancia: null,
        estadoTolerancia: 'Sin información'
      };
    }

    const diasHabilesTranscurridos = contarDiasHabilesSinDomingos(fechaCorresponde, new Date());
    const diasRestantesTolerancia = diasHabilesTranscurridos === null
      ? null
      : Math.max(0, TOLERANCIA_DIAS - diasHabilesTranscurridos);

    let estadoTolerancia = 'Al corriente';
    if (diasHabilesTranscurridos > TOLERANCIA_DIAS) {
      estadoTolerancia = 'Atrasado';
    } else if (diasHabilesTranscurridos > 0) {
      estadoTolerancia = 'En tolerancia';
    }

    return {
      fechaCorresponde,
      diasHabilesTranscurridos,
      diasRestantesTolerancia,
      estadoTolerancia
    };
  };

  const formatDiaCorrespondiente = (fecha) => {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
    });
  };

  // Función para formatear rangos (Versión Blindada contra Zonas Horarias) 
const formatRangoCubre = (fechaInicio, fechaFin) => {
  if (!fechaInicio) return 'Sin fecha';

  // 1. Helper para parsear fecha asegurando que sea mediodía (evita el -1 día)
  const parseFecha = (fecha) => {
    if (!fecha) return null;
    // Si la fecha es solo "YYYY-MM-DD", le pegamos la hora T12:00:00
    // Si ya trae hora (ISO string), la usamos tal cual
    const fechaSegura = fecha.includes('T') ? fecha : `${fecha}T12:00:00`;
    return new Date(fechaSegura);
  };

  const dInicio = parseFecha(fechaInicio);
  
  // Si no hay fechaFin, o es igual a inicio, usamos dInicio
  const dFin = fechaFin ? parseFecha(fechaFin) : dInicio;

  // 2. Helpers de formato
  const getDia = (d) => d.getDate();
  const getMes = (d) => d.toLocaleDateString('es-MX', { month: 'long' }).replace('.', '');
  const getAnio = (d) => d.getFullYear();

  // 3. Comparación: Usamos getTime() para ser exactos, o toDateString()
  // Si las fechas son idénticas (mismo día)
  if (dInicio.toDateString() === dFin.toDateString()) {
    return `${getDia(dInicio)} ${getMes(dInicio)} ${getAnio(dInicio)}`;
  }

  // 4. Lógica de Rangos
  // Mismo mes y año (Ej: 1 al 10 ene 2026)
  if (dInicio.getMonth() === dFin.getMonth() && dInicio.getFullYear() === dFin.getFullYear()) {
    return `${getDia(dInicio)} al ${getDia(dFin)} ${getMes(dInicio)} ${getAnio(dInicio)}`;
  }

  // Diferente mes o año (Ej: 31 ene al 2 feb 2026)
  return `${getDia(dInicio)} ${getMes(dInicio)} al ${getDia(dFin)} ${getMes(dFin)} ${getAnio(dFin)}`;
};

  // 🆕 Filtro de búsqueda mejorado
const rentasFiltradas = rentas.filter(renta => {
    if (renta.status === 'Eliminado') return false;
    return true;
  });

  // 🆕 Filtrar conductores para el dropdown
  const conductoresFiltrados = opciones?.conductores?.filter(conductor => {
    if (!filtros.busqueda_vehiculo) return true;
    const vehiculo = conductor.numero_vehiculo?.toLowerCase() || '';
    return vehiculo.includes(filtros.busqueda_vehiculo.toLowerCase());
  }) || [];

  if (loading && rentas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="large" message="Cargando pagos de rentas..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={goToDashboard}
            className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <FileText className="w-8 h-8" />
              Gestión de Rentas
            </h1>
            <p className="text-gray-400">Sistema de cobranza diaria de conductores</p>
          </div>
        </div>
        
<div className="flex flex-wrap items-center gap-2">
          
          {/* 🪄 1. BOTONES DINÁMICOS DE SELECCIÓN MÚLTIPLE */}
          {modoSeleccion ? (
            <>
              <button 
                onClick={toggleModoSeleccion} 
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAprobarMultiples} 
                disabled={pagosSeleccionados.length === 0} 
                className={`px-4 py-2 flex items-center gap-2 rounded-lg transition-colors text-sm font-medium ${
                  pagosSeleccionados.length > 0 
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/20' 
                    : 'bg-emerald-900/40 text-emerald-500/50 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                Aprobar {pagosSeleccionados.length} Pagos
              </button>
            </>
          ) : (
            <button 
              onClick={toggleModoSeleccion} 
              className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/40 text-indigo-400 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
            >
              <CheckSquare className="w-5 h-5" /> 
              Validación Múltiple
            </button>
          )}

          {/* 📊 2. TU BOTÓN EXPORTAR ORIGINAL */}
          <button
            onClick={handleExportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            disabled={rentas.length === 0}
          >
            <Download className="w-5 h-5" />
            Exportar Excel
          </button>
          
          {/* ➕ 3. TU BOTÓN CREAR ORIGINAL */}
          <button
            onClick={handleCreateRenta}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors text-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            Crear Pago Manual
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass rounded-lg p-4 border border-primary/20 hover:border-primary/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Pagos</p>
                <p className="text-2xl font-bold text-white">{estadisticas.total_pagos || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Conductores activos</p>
              </div>
              <FileText className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-yellow-500/20 hover:border-yellow-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-500">{estadisticas.pendientes || 0}</p>
                <p className="text-xs text-yellow-600 mt-1">
                  {formatCurrency(estadisticas.saldos_pendientes_total ?? estadisticas.saldos_pendientes)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-green-500/20 hover:border-green-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Confirmados</p>
                <p className="text-2xl font-bold text-green-500">{estadisticas.confirmados || 0}</p>
                <p className="text-xs text-green-600 mt-1">
                  <span>Total cobrado hoy: </span>
                  {formatCurrency(estadisticas.total_cobrado_hoy || 0)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-red-500/20 hover:border-red-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Rechazados</p>
                <p className="text-2xl font-bold text-red-500">{estadisticas.rechazados || 0}</p>
                <p className="text-xs text-red-600 mt-1">Requieren atención</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="glass rounded-lg p-4 border border-blue-500/20 hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Por Validar</p>
                <p className="text-lg font-bold text-blue-500">
                  {formatCurrency(estadisticas.saldos_pendientes_total ?? estadisticas.saldos_pendientes)}
                </p>
                <p className="text-xs text-blue-600 mt-1">Total pendiente</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros Mejorados */}
      <div className="glass rounded-lg p-4 border border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-white">Filtros de Búsqueda</h3>
          </div>
          <button
            onClick={limpiarFiltros}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Búsqueda rápida */}
            <div className="lg:col-span-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por conductor, vehículo o folio..."
                  value={textoBusqueda} // Usamos el estado local
                  onChange={(e) => setTextoBusqueda(e.target.value)} // Solo actualiza visualmente
                  onKeyDown={handleKeyDown} // Detecta el Enter
                  className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <button
                onClick={realizarBusqueda}
                className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg hover:bg-primary/30 transition-colors flex items-center gap-2 font-medium"
              >
                <Search className="w-4 h-4" />
                Buscar
              </button>
            </div>

          {/* Estado */}
          <select
            value={filtros.status}
            onChange={(e) => handleFiltroChange('status', e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="" className="bg-gray-800">Todos los estados</option>
            {opciones?.estados?.map(estado => (
              <option key={estado} value={estado} className="bg-gray-800">{estado}</option>
            ))}
          </select>

          {/* Método de pago */}
<select
            value={filtros.metodo_pago}
            onChange={(e) => handleFiltroChange('metodo_pago', e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="" className="bg-gray-800">Todos los métodos</option>
            
            {opciones?.metodos_pago
              //  AQUÍ FILTRAMOS LO QUE NO QUEREMOS VER
              ?.filter(metodo => metodo !== 'Tarjeta' && metodo !== 'Stripe') 
              .map(metodo => (
                <option key={metodo} value={metodo} className="bg-gray-800">{metodo}</option>
            ))}
          </select>

          {/* Conductor */}
          <select
            value={filtros.conductor_id}
            onChange={(e) => handleFiltroChange('conductor_id', e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="" className="bg-gray-800">
              Todos los conductores ({opciones?.conductores?.length || 0})
            </option>
            {conductoresFiltrados.map(conductor => (
              <option key={conductor.id} value={conductor.id} className="bg-gray-800">
                {conductor.nombre} 
                {conductor.numero_vehiculo && ` - ${conductor.numero_vehiculo}`}
                {!conductor.tiene_asignacion && ' (Sin vehículo)'}
              </option>
            ))}
          </select>

          {/* Vehículo */}
          <select
            value={filtros.vehiculo_id}
            onChange={(e) => handleFiltroChange('vehiculo_id', e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="" className="bg-gray-800">Todos los vehículos</option>
            {opciones?.vehiculos?.map(vehiculo => (
              <option key={vehiculo.id} value={vehiculo.id} className="bg-gray-800">
                {vehiculo.numero} - {vehiculo.tipo_socio}
              </option>
            ))}
          </select>

          {/* Fecha desde */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Desde (Registro)</label>
            <input
              type="date"
              value={filtros.fecha_registro_desde}
              onChange={(e) => handleFiltroChange('fecha_registro_desde', e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hasta (Registro)</label>
            <input
              type="date"
              value={filtros.fecha_registro_hasta}
              onChange={(e) => handleFiltroChange('fecha_registro_hasta', e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Rentas */}
      <div className="glass rounded-lg border border-primary/20 overflow-hidden">
        <div className="p-4 border-b border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-white">
              Pagos de Rentas ({rentasFiltradas.length})
            </h3>
          </div>
          <div className="text-sm text-gray-400">
            Página {currentPage} de {totalPages}
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-8">
            <LoadingSpinner message="Cargando rentas..." />
          </div>
        ) : rentasFiltradas.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No se encontraron pagos</p>
            <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
          </div>
        ) : (
          <>
            {/*  1. AGREGAMOS max-h-[60vh] y overflow-auto  */}
            <div className="overflow-auto max-h-[60vh] sidebar-scroll">
              
              {/*  2. Agregamos relative a la tabla  */}
              <table className="min-w-[1100px] w-full text-left relative">
                
                {/*  3. Agregamos sticky, top-0 y z-10 al thead  */}
                <thead className="bg-dark border-b border-primary/20 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {/* 🪄 NUEVA COLUMNA: Checkbox (Solo visible en modo selección) */}
                    {modoSeleccion && (
                      <th className="py-3 px-4 text-emerald-400 font-medium w-12 text-center">
                        <CheckSquare className="w-5 h-5 mx-auto" />
                      </th>
                    )}
                    
                    <th className="py-3 px-4 text-gray-400 font-medium">Folio</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Conductor</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Vehículo</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Tipo</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Monto</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Fecha</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Estado</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Método</th>
                    
                    {/* Ocultamos acciones si estamos seleccionando pagos */}
                      <th className="py-3 px-4 text-gray-400 font-medium text-center whitespace-nowrap">Acciones</th>              
                  </tr>
                </thead>
                <tbody>
                  {rentasFiltradas.map((renta) => {
                    const fechaBasePago = getPagoFechaBase(renta);
                    const fechaCorresponde = obtenerFechaCorrespondiente(fechaBasePago);
                    const fechaParaMostrar = fechaCorresponde || fechaBasePago;
                    const rangoObservaciones = getPagoRangoLabel(renta);
                    const puedeBorrar = renta.status === 'Confirmado' || renta.status === 'Rechazado';
                    
                    // 🪄 Verificamos si este pago está seleccionado
                    const estaSeleccionado = modoSeleccion && pagosSeleccionados.includes(renta.id);

                    return (
                      <tr 
                        key={renta.id} 
                        // 🪄 Fila resaltada en verde si está seleccionada
                        className={`border-b border-primary/10 transition-colors align-top ${
                          estaSeleccionado ? 'bg-emerald-900/20' : 'hover:bg-primary/5'
                        }`}
                      >
                        {/* 🪄 CELDA DEL CHECKBOX */}
                        {modoSeleccion && (
                          <td className="py-4 px-4 align-top text-center" onClick={(e) => e.stopPropagation()}>
                            {renta.status === 'Pendiente' ? (
                              <input 
                                type="checkbox" 
                                checked={estaSeleccionado}
                                onChange={() => togglePago(renta.id)}
                                className="w-5 h-5 rounded border-white/20 bg-gray-900/50 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                              />
                            ) : (
                              // Cuadrito deshabilitado para pagos que no son pendientes
                              <div title="Este pago no está pendiente" className="w-5 h-5 mx-auto rounded border border-white/10 bg-white/5 opacity-50 cursor-not-allowed"></div>
                            )}
                          </td>
                        )}

                        <td className="py-4 px-4 font-medium text-white align-top">
                          #{renta.id}
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-white/5 text-gray-300">
                              <User className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-white font-medium text-sm leading-tight">
                                {renta.nombre_conductor}
                              </p>
                              <p className="text-gray-500 text-xs">
                                {renta.numero_telefono}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 font-medium">{renta.numero_vehiculo}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/30">
                            {renta.tipo_socio}
                          </span>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-green-400" />
                              <p className="text-lg font-semibold text-green-300 leading-none">
                                {formatCurrency(renta.monto_total)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                                <span className="text-gray-400">Renta:</span>
                                <span className="font-medium text-white">{formatCurrency(renta.monto_renta_pagado)}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                                <span className="text-gray-400">Póliza:</span>
                                <span className="font-medium text-white">{formatCurrency(renta.monto_poliza_pagado)}</span>
                              </span>
                            </div>
                          </div>
                        </td>
<td className="py-4 px-4 align-top">
                          <div className="space-y-2">
                            {/* 1. Fecha de Creación */}
                            <div className="flex items-center gap-2 text-gray-200">
                              <Calendar className="w-4 h-4" />
                              <span className="font-medium whitespace-nowrap capitalize">
                                {formatDiaCorrespondiente(renta.created_at)}
                              </span>
                            </div>

                            {/* 2. Rango que Cubre */}
                            <p className="text-xs text-gray-500 capitalize mt-2">
                              Cubre: {formatRangoCubre(renta.fecha_pago, renta.fecha_pago_fin)}
                            </p>

                            {/* 3. 🆕 HORA DE PAGO */}
                            <div className="flex items-center gap-2 text-gray-400 text-xs mt-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span className="whitespace-nowrap">
                                Hora de pago: {renta.created_at ? new Date(renta.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getEstadoColor(renta.status)}`}>
                            {getEstadoIcon(renta.status)}
                            {renta.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-center gap-2 text-gray-300">
                            <CreditCard className="w-4 h-4" />
                            <span className="font-medium">{renta.metodo_pago}</span>
                          </div>
                        </td>
                        
                        {/* 🪄 CELDA DE ACCIONES (Comprobante siempre visible, lo demás se oculta al seleccionar) */}
                        <td className="py-4 px-4 align-top w-[1%]">
                          <div className="flex justify-center flex-wrap gap-1">
                            
                            {/* 📄 BOTÓN COMPROBANTE: Siempre visible si existe (para revisarlo antes de aprobar) */}
                            {renta.comprobante_url && (
                              <a
                                href={renta.comprobante_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-cyan-500/20 text-cyan-300 rounded hover:bg-cyan-500/30 transition-colors"
                                title="Ver comprobante"
                              >
                                <FileTextIcon className="w-4 h-4" />
                              </a>
                            )}

                            {/* 🚫 DEMÁS BOTONES: Se ocultan en Modo Selección */}
                            {!modoSeleccion && (
                              <>
                                <button
                                  onClick={() => handleViewRenta(renta)}
                                  className="p-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                                  title="Ver detalles"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleVerHistorial(renta.conductor_id)}
                                  className="p-2 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-colors"
                                  title="Ver historial"
                                >
                                  <History className="w-4 h-4" />
                                </button>

                                {/* GESTIÓN DE SOLICITUDES DE BORRADO */}
                                {renta.status === 'Solicitud_borrado' && (user.rol === 'super_admin' || user.rol === 'finanzas' || user.rol === 'direccion') && (
                                  <>
                                    <button
                                      onClick={() => handleEliminarPago(renta.id)} 
                                      className="p-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors animate-pulse shadow-lg shadow-red-900/50"
                                      title="🚨 APROBAR ELIMINACIÓN (Revisar motivo en observaciones)"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>

                                    <button
                                      onClick={() => handleRestaurarPago(renta.id)}
                                      className="p-2 bg-gray-600/50 text-gray-300 rounded hover:bg-gray-600 transition-colors border border-gray-500"
                                      title="Cancelar solicitud y mantener el pago"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </>
                                )}

                                {(renta.status === 'Pendiente' || renta.status === 'Confirmado' || renta.status === 'Pagada') && (
                                  <>
                                    {renta.status === 'Pendiente' && (
                                      <button
                                        onClick={() => handleValidarPago(renta.id)}
                                        className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                                        title="Validar pago"
                                        disabled={loadingAction}
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </button>
                                    )}
                                    
                                    {renta.status !== 'Confirmado' && (
                                      <button
                                        onClick={() => handleEditRenta(renta)}
                                        className="p-2 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors"
                                        title={renta.status === 'Pendiente' ? 'Editar pago pendiente' : 'Ajustar pago'}
                                        disabled={loadingAction}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                    )}
                                  </>
                                )}

                                <button
                                  onClick={() => handleEliminarPago(renta.id)}
                                  className={`p-2 rounded transition-colors ${
                                    puedeBorrar && user?.rol !== 'coordinador'
                                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                                      : 'bg-gray-500/10 text-gray-500 cursor-not-allowed opacity-50'
                                  }`}
                                  title={
                                    user?.rol === 'coordinador'
                                      ? "⛔ Los coordinadores no tienen permisos para eliminar registros"
                                      : puedeBorrar 
                                        ? "Eliminar registro" 
                                        : "Solo se pueden borrar pagos Confirmados o Rechazados"
                                  }
                                  disabled={loadingAction || !puedeBorrar || user?.rol === 'coordinador'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>

                                {renta.status === 'Pendiente' && (
                                  <button
                                    onClick={() => handleRechazarPago(renta.id)}
                                    className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                                    title="Rechazar"
                                    disabled={loadingAction}
                                  >
                                    <Ban className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-primary/20 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                
                <span className="text-gray-400">
                  Página {currentPage} de {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modales */}
      {showModal && (
        <>
          {modalType === 'view' && (
            <ModalDetalles
              pago={selectedRenta}
              onClose={handleCloseModal}
            />
          )}

          {modalType === 'historial' && (
            <ModalHistorial
              historial={selectedRenta}
              onClose={handleCloseModal}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          )}

          {(modalType === 'create' || modalType === 'edit') && (
            <ModalFormulario
              type={modalType}
              renta={selectedRenta}
              opciones={opciones}
              onClose={handleCloseModal}
              onSuccess={cargarDatos}
            />
          )}
        </>
      )}
    </div>
  );
};

// ========== MODAL HISTORIAL ==========
const ModalHistorial = ({ historial, onClose, formatCurrency, formatDate }) => {
  if (!historial || !historial.historial) {
    return null;
  }

  const { historial: pagos, resumen } = historial;
  
    const totalPagadoResumen = Number(
    resumen?.total_pagado ?? ((Number(resumen?.total_renta_pagada || 0)) + (Number(resumen?.total_poliza_acumulada || 0)))
  );

  const getPagoRangoLabel = (pago) => {
    if (!pago) return null;
    if (pago.dias_cubiertos) return pago.dias_cubiertos;
    if (pago.rango_inicio || pago.rango_fin) {
      return pago.rango_inicio && pago.rango_fin && pago.rango_inicio !== pago.rango_fin
        ? `${pago.rango_inicio} a ${pago.rango_fin}`
        : (pago.rango_inicio || pago.rango_fin);
    }
    if (pago.fecha_pago_fin) {
      return pago.fecha_pago && pago.fecha_pago !== pago.fecha_pago_fin
        ? `${pago.fecha_pago} a ${pago.fecha_pago_fin}`
        : pago.fecha_pago;
    }
    return pago.fecha_pago || null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-primary/30">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <History className="w-6 h-6 text-primary" />
              Historial de Pagos
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Resumen */} 
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="glass p-4 rounded-lg border border-blue-500/20">
              <p className="text-gray-400 text-sm">Total Pagos</p>
              <p className="text-2xl font-bold text-blue-400">{resumen.total_pagos}</p>
            </div>
            <div className="glass p-4 rounded-lg border border-green-500/20">
              <p className="text-gray-400 text-sm">Total Pagado</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(totalPagadoResumen)}</p>
            </div>
            <div className="glass p-4 rounded-lg border border-yellow-500/20">
              <p className="text-gray-400 text-sm">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-400">{resumen.pagos_pendientes}</p>
            </div>
          </div>

          {/* Lista de Pagos */}
          <div className="space-y-3">
            {pagos.map((pago) => (
              <div 
                key={pago.id}
                className="glass p-4 rounded-lg border border-primary/20 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 font-mono text-sm">#{pago.id}</span>
                      <span className="text-white font-medium">{formatDate(pago.fecha_pago)}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        pago.status === 'Confirmado' ? 'bg-green-500/20 text-green-400' :
                        pago.status === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {pago.status}
                      </span>
                      {pago.status === 'Confirmado' && pago.fecha_pago && (
                        <span className="text-xs text-green-300">
                          cubre {getPagoRangoLabel(pago) || formatDate(pago.fecha_pago)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="text-gray-400">Vehículo: <span className="text-white">{pago.numero_vehiculo}</span></span>
                      <span className="text-gray-400">Método: <span className="text-white">{pago.metodo_pago}</span></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(Number(pago.monto_total || 0) || (Number(pago.monto_renta_pagado || 0) + Number(pago.monto_poliza_pagado || 0)))}</p>
                    <p className="text-xs text-gray-500">${pago.monto_renta_pagado} + ${pago.monto_poliza_pagado}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== MODAL FORMULARIO ==========
const ModalFormulario = ({ type, renta, opciones, onClose, onSuccess }) => {
  const MONTO_POLIZA_FIJO = 100;
  const [selectedConductor, setSelectedConductor] = useState(null);
  const [loadingConductor, setLoadingConductor] = useState(false);
  const [busquedaConductor, setBusquedaConductor] = useState('');
  const [loadingSave, setLoadingSave] = useState(false);
  const [formData, setFormData] = useState({
    monto_renta_pagado: '',
    monto_poliza_pagado: MONTO_POLIZA_FIJO.toFixed(2),
    metodo_pago: '',
    observaciones: '',
    motivo_ajuste: ''
  });

  // Inicializar datos cuando es edición
  useEffect(() => {
    if (type === 'edit' && renta) {
      setFormData({
        monto_renta_pagado: renta.monto_renta_pagado || '',
        monto_poliza_pagado: MONTO_POLIZA_FIJO.toFixed(2),
        metodo_pago: renta.metodo_pago || '',
        observaciones: renta.observaciones || '',
        motivo_ajuste: ''
      });
    }
  }, [type, renta]);

  const statusPagoNormalizado = String(renta?.status || '').trim().toLowerCase();
  const esPagoConfirmado = ['confirmado', 'pagada'].includes(statusPagoNormalizado);

  const handleSaveEdit = async () => {
    if (!formData.monto_renta_pagado) {
      alert('Debes capturar el monto de renta');
      return;
    }

    const montoRentaNumero = parseFloat(formData.monto_renta_pagado);
    const montoPolizaNumero = parseFloat(formData.monto_poliza_pagado || 0);

    if (!Number.isFinite(montoRentaNumero) || !Number.isFinite(montoPolizaNumero)) {
      alert('Ingresa montos validos');
      return;
    }

    if (montoRentaNumero < 0 || montoPolizaNumero < 0) {
      alert('No se permiten montos negativos');
      return;
    }

    if (!esPagoConfirmado && !formData.metodo_pago) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }

    if (esPagoConfirmado) {
      const confirmacion = window.confirm(
        'Advertencia: esta edicion afecta directamente los montos del vehiculo en la base de datos.\n\n¿Deseas continuar?'
      );
      if (!confirmacion) {
        return;
      }
    }

    try {
      setLoadingSave(true);
      if (esPagoConfirmado) {
        await adminService.editarPagoRentaConfirmado(renta.id, {
          monto_renta_pagado: montoRentaNumero,
          motivo_ajuste: formData.motivo_ajuste?.trim() || ''
        });
      } else {
        await adminService.editarPagoRenta(renta.id, {
          monto_renta_pagado: montoRentaNumero,
          monto_poliza_pagado: montoPolizaNumero,
          metodo_pago: formData.metodo_pago,
          observaciones: formData.observaciones
        });
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error guardando pago:', error);
      const msg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Error al guardar los cambios';
      alert(`Error al guardar los cambios: ${msg}`);
    } finally {
      setLoadingSave(false);
    }
  };

  const montoRenta = parseFloat(formData.monto_renta_pagado || 0);
  const montoPoliza = parseFloat(formData.monto_poliza_pagado || 0);
  const montoTotal = montoRenta + montoPoliza;
  const esMontoRentaNegativo = Number.isFinite(montoRenta) && montoRenta < 0;

  if (type === 'edit') {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
        <div className="relative min-h-full flex items-center justify-center p-4 sm:p-6">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col border border-primary/30">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">
              {esPagoConfirmado ? 'Ajustar Pago Confirmado' : 'Editar Pago'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-6 pt-4">
            <div>
              <label className="block text-white font-medium mb-2">Conductor</label>
              <input
                type="text"
                value={renta?.nombre_conductor || ''}
                disabled
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white opacity-60"
              />
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Vehículo</label>
              <input
                type="text"
                value={renta?.numero_vehiculo || ''}
                disabled
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-medium mb-2">Monto Renta *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.monto_renta_pagado}
                  onChange={(e) => setFormData({ ...formData, monto_renta_pagado: e.target.value })}
                  className={`w-full px-4 py-2 bg-white/10 border rounded-lg text-white focus:ring-2 ${
                    esMontoRentaNegativo
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-white/20 focus:ring-primary'
                  }`}
                />
                {esMontoRentaNegativo && (
                  <p className="text-xs text-red-400 mt-1">No se admiten numeros negativos.</p>
                )}
              </div>
              <div>
                <label className="block text-white font-medium mb-2">Monto Poliza (Fijo)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monto_poliza_pagado}
                  disabled
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white opacity-70 cursor-not-allowed"
                />
                <p className="text-xs text-cyan-300 mt-1">
                  Monto fijo para todos: ${MONTO_POLIZA_FIJO.toFixed(2)}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Monto Total</label>
              <input
                type="text"
                value={montoTotal.toFixed(2)}
                disabled
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white opacity-70 cursor-not-allowed"
              />
              <p className="text-xs text-gray-300 mt-1">Se calcula automaticamente: renta + poliza fija.</p>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Comprobante del pago</label>
              {renta?.comprobante_url ? (
                <a
                  href={renta.comprobante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 transition-colors"
                >
                  Ver comprobante
                </a>
              ) : (
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm">
                  Este pago no tiene comprobante adjunto.
                </div>
              )}
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Metodo de Pago *</label>
              <select
                value={formData.metodo_pago}
                onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })}
                disabled={esPagoConfirmado}
                className={`w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary ${esPagoConfirmado ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <option value="" className="bg-gray-800">Seleccionar método...</option>
                {opciones?.metodos_pago?.map(metodo => (
                  <option key={metodo} value={metodo} className="bg-gray-800">{metodo}</option>
                ))}
              </select>
            </div>

            <div>
              {esPagoConfirmado ? (
                <>
                  <label className="block text-white font-medium mb-2">Motivo del ajuste (opcional)</label>
                  <textarea
                    value={formData.motivo_ajuste}
                    onChange={(e) => setFormData({ ...formData, motivo_ajuste: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary resize-none"
                    rows="3"
                    placeholder="Ej. Ajuste autorizado por diferencia detectada en validacion..."
                  />
                  <p className="text-xs text-yellow-300 mt-1">
                    Ajuste sensible: este cambio impacta saldos del vehiculo y queda auditado.
                  </p>
                </>
              ) : (
                <>
                  <label className="block text-white font-medium mb-2">Observaciones</label>
                  <textarea
                    value={formData.observaciones}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary resize-none"
                    rows="3"
                  />
                </>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={loadingSave}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50"
              >
                {loadingSave ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleConductorChange = async (conductorId) => {
      // 1. Si el usuario borra la selección manualmente
      if (!conductorId) {
        setSelectedConductor(null);
        return;
      }

      // 🟢 2. VALIDACIÓN ESTRICTA (BLOQUEO)
      try {
        const chequeo = await adminService.verificarPagosPendientes(conductorId);

        
        if (chequeo.existe) {
          // 🛑 AQUI CAMBIAMOS LA LÓGICA:
          // En lugar de confirm(), usamos alert() y cortamos el flujo.
          const formatFecha = new Date(chequeo.pago.fecha_pago).toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC' // Importante para que no salga un día antes
          });
          
          alert(
            `⛔ ACCIÓN DENEGADA\n\n` +
            `Este conductor ya tiene un pago PENDIENTE/SOLICITUD DE BORRADO esperando autorización por $${chequeo.pago.monto_total} (Fecha: ${formatFecha}\n\n` +
            `>> No puedes crear un pago manual nuevo.\n` +
            `>> Primero debes Validar o Rechazar la solicitud pendiente actual desde la sección de Pagos Pendientes.`
          );

          // 3. "Lo regresamos para atrás": Limpiamos la selección
          setSelectedConductor(null); 
          
          // Detenemos la función aquí. No se carga nada más.
          return; 
        }
      } catch (error) {
        console.error('⚠️ Error verificando historial:', error);
        // Si falla la conexión, decidimos si dejarlo pasar o bloquearlo. 
        // Por seguridad, mejor dejamos pasar solo si es error de red, pero aquí lo dejamos simple.
      }

      // 4. Carga normal de datos (Solo llega aquí si NO debe nada)
      try {
        setLoadingConductor(true);
        
        const response = await adminService.getConductorById(conductorId);
        const conductorCompleto = response.conductor;
        
        const asignacionActiva = conductorCompleto.asignaciones?.find(a => a.activa === true);
        
        if (!asignacionActiva) {
          alert('Este conductor no tiene una asignación activa. No puede registrar pagos.');
          setSelectedConductor(null);
          return;
        }
        
        setSelectedConductor({
          id: conductorCompleto.id,
          nombre_conductor: conductorCompleto.nombre_conductor,
          numero_vehiculo: asignacionActiva.numero_vehiculo || 'N/A',
          renta_diaria: parseFloat(asignacionActiva.renta_diaria || 400),
          abono_poliza_mantenimiento: parseFloat(asignacionActiva.abono_poliza_mantenimiento || 100)
        });
        
      } catch (error) {
        console.error('❌ Error cargando conductor:', error);
        alert('Error al cargar los datos del conductor.');
        setSelectedConductor(null);
      } finally {
        setLoadingConductor(false);
      }
    };

  // Filtrar conductores por búsqueda
  const conductoresFiltrados = opciones?.conductores?.filter(conductor => {
    if (!busquedaConductor) return true;
    const busqueda = busquedaConductor.toLowerCase();
    return (
      conductor.nombre?.toLowerCase().includes(busqueda) ||
      conductor.numero_vehiculo?.toLowerCase().includes(busqueda)
    );
  }) || [];

  return (
    <>
      {!selectedConductor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-primary/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Registrar Pago</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 🆕 Búsqueda de conductor */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Buscar Conductor
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o vehículo..."
                    value={busquedaConductor}
                    onChange={(e) => setBusquedaConductor(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white font-medium mb-3">
                  Seleccionar Conductor * ({conductoresFiltrados.length} disponibles)
                </label>
                <select
                  onChange={(e) => handleConductorChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary"
                  disabled={loadingConductor}
                  value={selectedConductor?.id || ''}
                >
                  <option value="" className="bg-gray-800">Seleccione un conductor...</option>
                  {conductoresFiltrados.map(conductor => (
                    <option key={conductor.id} value={conductor.id} className="bg-gray-800">
                      {conductor.nombre}
                      {conductor.numero_vehiculo && ` - ${conductor.numero_vehiculo}`}
                      {!conductor.tiene_asignacion && ' (Sin vehículo)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center py-6">
                <User className="w-16 h-16 mx-auto text-gray-500 mb-3" />
                <p className="text-gray-400 text-sm">Selecciona un conductor para continuar</p>
                <p className="text-gray-500 text-xs mt-2">
                  Puedes buscar por nombre o número de vehículo
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ModalRegistrarPago
          isOpen={true}
          onClose={() => {
            setSelectedConductor(null);
            onClose();
          }}
          conductor={selectedConductor}
          onSuccess={(response) => {
            console.log('✅ Pago registrado:', response);
            setSelectedConductor(null);
            onSuccess();
          }}
        />
      )}
    </>
  );
};

export default Rentas;

