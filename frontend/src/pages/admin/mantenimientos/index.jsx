import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Calendar,
  AlertTriangle,
  DollarSign,
  Clock,
  CheckCircle,
  Car,
  TrendingUp,
  FileText,
  Plus,
  BarChart3,
  Eye,
  Wallet,
  Table,
  XCircle,
  Info,
  Maximize2,
  X
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';
import adminService from '@/services/adminService';
import {
  formatMaintenanceDate,
  formatMaintenanceDateTime,
  formatMaintenanceTime,
  toMaintenanceDateInputValue,
  toMaintenanceTimeInputValue
} from '@/utils/maintenanceDateFormat';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const HALF_HOUR_SLOTS = (() => {
  const slots = [];
  for (let h = 9; h <= 18; h += 1) {
    const hh = String(h).padStart(2, '0');
    slots.push(`${hh}:00`);
    slots.push(`${hh}:30`);
  }
  return slots;
})();

const ALERTAS_CHUNK_SIZE = 12;
const PROXIMOS_CHUNK_SIZE = 10;
const MODAL_KM_PAGE_SIZE = 20;
const UMBRAL_ALERTA_KM = 1000;

const MantenimientosDashboard = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const [loading, setLoading] = useState(true);
  const [estadisticas, setEstadisticas] = useState(null);
  const [modalPorKilometraje, setModalPorKilometraje] = useState({
    open: false,
    loading: false,
    error: '',
    data: [],
    pagination: {
      page: 1,
      totalPages: 1,
      total: 0
    }
  });
  const [alertas, setAlertas] = useState(null);
  const [pendientesDistribucion, setPendientesDistribucion] = useState(0); // 
  const [serviciosModalAbierto, setServiciosModalAbierto] = useState(false);
  const [serviciosPreventivos, setServiciosPreventivos] = useState(null);
  const [serviciosTabActiva, setServiciosTabActiva] = useState('generico_10000km');
  const [cargandoServicios, setCargandoServicios] = useState(false);
  const [errorServicios, setErrorServicios] = useState('');
  const [modalDetalle, setModalDetalle] = useState({ open: false, data: null });
  const [tabVista, setTabVista] = useState('operativo');
  const [filtrosOperativo, setFiltrosOperativo] = useState({ search: '', umbral_km: 1000 });
  const [filtrosFinanciero, setFiltrosFinanciero] = useState({ estado_financiero: '', search: '' });
  const [vistaOperativa, setVistaOperativa] = useState({
    resumen: {},
    vehiculos: [],
    pagination: {}
  });
  const [vistaFinanciera, setVistaFinanciera] = useState({
    resumen: {},
    mantenimientos: [],
    pagination: {}
  });
  const [loadingOperativo, setLoadingOperativo] = useState(false);
  const [loadingFinanciero, setLoadingFinanciero] = useState(false);
  const [errorOperativo, setErrorOperativo] = useState('');
  const [errorFinanciero, setErrorFinanciero] = useState('');
  const [estadoFinancieroDraft, setEstadoFinancieroDraft] = useState({});
  const [updatingFinancieroId, setUpdatingFinancieroId] = useState(null);
  const [exportingOperativo, setExportingOperativo] = useState(false);
  const [modalReprogramar, setModalReprogramar] = useState({
    open: false,
    id: null,
    folio: null,
    vehiculo: '',
    tipo_servicio: '',
    fecha_programada: '',
    hora_programada: '09:00',
    forzar_horario_ocupado: false,
    loading: false
  });
  const [slotsReprogramacion, setSlotsReprogramacion] = useState([]);
  const [cargandoSlotsReprogramacion, setCargandoSlotsReprogramacion] = useState(false);
  const [limiteAlertasCriticas, setLimiteAlertasCriticas] = useState(ALERTAS_CHUNK_SIZE);
  const [limiteProximos, setLimiteProximos] = useState(PROXIMOS_CHUNK_SIZE);
  const [modalProximos30DiasOpen, setModalProximos30DiasOpen] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    cargarVistaOperativa();
    cargarVistaFinanciera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLimiteAlertasCriticas(ALERTAS_CHUNK_SIZE);
    setLimiteProximos(PROXIMOS_CHUNK_SIZE);
  }, [alertas]);

  useEffect(() => {
    let isMounted = true;

    const cargarDisponibilidadAgenda = async () => {
      if (!modalReprogramar.open || !modalReprogramar.fecha_programada) {
        if (isMounted) {
          setSlotsReprogramacion([]);
          setCargandoSlotsReprogramacion(false);
        }
        return;
      }

      try {
        if (isMounted) setCargandoSlotsReprogramacion(true);
        const response = await adminService.getDisponibilidadAgendaMantenimientos(
          modalReprogramar.fecha_programada,
          modalReprogramar.id
        );
        const slots = Array.isArray(response?.slots) ? response.slots : [];

        if (!isMounted) return;
        setSlotsReprogramacion(slots);

      } catch (error) {
        if (!isMounted) return;
        console.error('Error cargando disponibilidad para reprogramacion:', error);
        setSlotsReprogramacion([]);
      } finally {
        if (isMounted) setCargandoSlotsReprogramacion(false);
      }
    };

    cargarDisponibilidadAgenda();

    return () => {
      isMounted = false;
    };
  }, [modalReprogramar.open, modalReprogramar.fecha_programada, modalReprogramar.id]);

  useEffect(() => {
    const selectedSlot = slotsReprogramacion.find((slot) => slot.hora === modalReprogramar.hora_programada);
    if (!selectedSlot || selectedSlot.disponible) {
      setModalReprogramar((prev) => ({ ...prev, forzar_horario_ocupado: false }));
    }
  }, [slotsReprogramacion, modalReprogramar.hora_programada]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentRole = String(currentUser?.rol || currentUser?.role || '').toLowerCase();
      const canAccessDistribucionGastos = ['super_admin', 'finanzas', 'direccion'].includes(currentRole);
      
      if (!token) {
        console.error('No hay token de autenticación');
        setLoading(false);
        return;
      }
      
      console.log('Cargando datos de mantenimientos...');
      
      // Cargar estadísticas
      const resEstadisticas = await fetch(`${API_BASE_URL}/admin/mantenimientos/estadisticas`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response estadísticas:', resEstadisticas.status);
      
      if (!resEstadisticas.ok) {
        console.error('Error en estadísticas:', resEstadisticas.status);
        setEstadisticas({ 
          success: true, 
          estadisticas: {},
          top_vehiculos: [],
          top_vehiculos_menor: [],
          costos_mensuales: []
        });
      } else {
        const dataEstadisticas = await resEstadisticas.json();
        setEstadisticas(dataEstadisticas);
      }
      
      // Cargar alertas
      const resAlertas = await fetch(`${API_BASE_URL}/admin/mantenimientos/alertas`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('️ Response alertas:', resAlertas.status);
      
      if (!resAlertas.ok) {
        console.error('Error en alertas:', resAlertas.status);
        setAlertas({
          vencidos: [],
          urgentes: [],
          proximos: [],
          por_kilometraje: []
        });
      } else {
        const dataAlertas = await resAlertas.json();
        setAlertas(dataAlertas.alertas);
      }

      //  Cargar mantenimientos pendientes de distribución
      if (canAccessDistribucionGastos) {
        const resPendientes = await fetch(`${API_BASE_URL}/admin/mantenimientos/pendientes-distribucion`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (resPendientes.ok) {
          const dataPendientes = await resPendientes.json();
          setPendientesDistribucion(dataPendientes.total_pendientes || 0);
        } else {
          setPendientesDistribucion(0);
        }
      } else {
        setPendientesDistribucion(0);
      }
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setEstadisticas({ 
        success: true, 
        estadisticas: {},
        top_vehiculos: [],
        top_vehiculos_menor: [],
        costos_mensuales: []
      });
      setAlertas({
        vencidos: [],
        urgentes: [],
        proximos: [],
        por_kilometraje: []
      });
    } finally {
      setLoading(false);
    }
  };

  const cargarServiciosPreventivos = async () => {
    try {
      setCargandoServicios(true);
      setErrorServicios('');

      const token = localStorage.getItem('token');

      if (!token) {
        setErrorServicios('No hay token de autenticación');
        setCargandoServicios(false);
        return;
      }

      const resServicios = await fetch(`${API_BASE_URL}/admin/mantenimientos/servicios-preventivos`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!resServicios.ok) {
        throw new Error('No se pudieron cargar los servicios preventivos');
      }

      const dataServicios = await resServicios.json();
      const modelos = dataServicios.modelos || {};
      setServiciosPreventivos(modelos);
      if (Array.isArray(modelos.generico_10000km) && modelos.generico_10000km.length > 0) {
        setServiciosTabActiva('generico_10000km');
      } else {
        const primeraClave = Object.keys(modelos)[0] || 'generico_10000km';
        setServiciosTabActiva(primeraClave);
      }
    } catch (error) {
      console.error('Error al cargar servicios preventivos:', error);
      setErrorServicios(error.message || 'Error al obtener servicios preventivos');
    } finally {
      setCargandoServicios(false);
    }
  };

  const handleVerServicios = () => {
    setServiciosModalAbierto(true);
    if (!serviciosPreventivos) {
      cargarServiciosPreventivos();
    }
  };

  const handleCerrarServicios = () => {
    setServiciosModalAbierto(false);
  };

  const cargarVistaOperativa = async (filtros = filtrosOperativo, options = {}) => {
    const {
      page = 1,
      append = false
    } = options;

    try {
      setLoadingOperativo(true);
      setErrorOperativo('');
      const data = await adminService.getVehiculosProximosKilometraje({
        ...filtros,
        page,
        limit: 30,
        incluir_todos: true
      });
      const nextResumen = data?.resumen || {};
      const nextVehiculos = data?.vehiculos || [];
      const nextPagination = data?.pagination || {};

      setVistaOperativa((prev) => ({
        resumen: nextResumen,
        vehiculos: append ? [...(prev?.vehiculos || []), ...nextVehiculos] : nextVehiculos,
        pagination: nextPagination
      }));
    } catch (error) {
      console.error('Error cargando vehiculos proximos:', error);
      setErrorOperativo(error.message || 'No se pudo cargar el listado de proximos por kilometraje');
      setVistaOperativa({
        resumen: {},
        vehiculos: [],
        pagination: {}
      });
    } finally {
      setLoadingOperativo(false);
    }
  };

  const cargarVistaFinanciera = async (filtros = filtrosFinanciero) => {
    try {
      setLoadingFinanciero(true);
      setErrorFinanciero('');
      const data = await adminService.getFlujoFinancieroMantenimientos({
        ...filtros,
        page: 1,
        limit: 30
      });

      const rows = data?.mantenimientos || [];
      setVistaFinanciera({
        resumen: data?.resumen || {},
        mantenimientos: rows,
        pagination: data?.pagination || {}
      });
      setEstadoFinancieroDraft((prev) => {
        const next = { ...prev };
        rows.forEach((item) => {
          next[item.id] = item.estado_financiero || 'capturado';
        });
        return next;
      });
    } catch (error) {
      console.error('Error cargando flujo financiero:', error);
      setErrorFinanciero(error.message || 'No se pudo cargar el flujo financiero');
      setVistaFinanciera({
        resumen: {},
        mantenimientos: [],
        pagination: {}
      });
    } finally {
      setLoadingFinanciero(false);
    }
  };

  const actualizarEstadoFinanciero = async (mantenimientoId) => {
    const estadoNuevo = estadoFinancieroDraft[mantenimientoId];
    if (!estadoNuevo) return;

    try {
      setUpdatingFinancieroId(mantenimientoId);
      await adminService.actualizarEstadoFlujoFinanciero(mantenimientoId, estadoNuevo);
      await cargarVistaFinanciera();
    } catch (error) {
      console.error('Error actualizando flujo financiero:', error);
      alert(error.message || 'No se pudo actualizar el flujo financiero');
    } finally {
      setUpdatingFinancieroId(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDateTime = (value) => {
    return formatMaintenanceDateTime(value, { fallback: '-' });
  };

  const formatDateOnly = (value) => {
    return formatMaintenanceDate(value, { fallback: '-' });
  };

  const formatTimeOnly = (value) => {
    return formatMaintenanceTime(value, { fallback: '-' });
  };

  const handleVerMasOperativo = async () => {
    if (loadingOperativo) return;
    const currentPage = Number(vistaOperativa?.pagination?.page || 1);
    const totalPages = Number(vistaOperativa?.pagination?.totalPages || 1);
    if (currentPage >= totalPages) return;

    await cargarVistaOperativa(filtrosOperativo, {
      page: currentPage + 1,
      append: true
    });
  };

  const obtenerVehiculosReporteOperativo = async () => {
    const limit = 500;
    const umbral = Number(filtrosOperativo?.umbral_km || 1000);
    let page = 1;
    let totalPages = 1;
    const acumulado = [];

    while (page <= totalPages) {
      const data = await adminService.getVehiculosProximosKilometraje({
        incluir_todos: true,
        search: '',
        umbral_km: umbral,
        page,
        limit
      });

      const rows = Array.isArray(data?.vehiculos) ? data.vehiculos : [];
      const pagination = data?.pagination || {};

      acumulado.push(...rows);
      totalPages = Number(pagination.totalPages || 1);
      page += 1;
    }

    return acumulado;
  };

  const prepararFilasReporteOperativo = (rows = []) => {
    return rows.map((item) => {
      const kmActual = Number(item?.kilometraje_actual || 0);
      const hito = Number(item?.hito_objetivo_km || 0);
      const kmRestantes = Number(item?.km_restantes || 0);
      const estado = item?.estado_alerta || 'Proximo';

      return {
        vehiculo: item?.numero_vehiculo || '-',
        marca: item?.marca || '-',
        modelo: item?.modelo || '-',
        placa: item?.placa || '-',
        conductor: item?.nombre_conductor || 'Sin conductor activo',
        telefono: item?.conductor_telefono || '-',
        kmActual,
        hito,
        kmRestantes,
        diferencia: kmRestantes >= 0
          ? `Faltan ${kmRestantes.toLocaleString('es-MX')} km`
          : `Excedido por ${Math.abs(kmRestantes).toLocaleString('es-MX')} km`,
        estado
      };
    });
  };

  const exportarOperativoXls = async () => {
    try {
      setExportingOperativo(true);
      const rows = await obtenerVehiculosReporteOperativo();
      if (!rows.length) {
        alert('No hay vehiculos para exportar.');
        return;
      }

      const data = prepararFilasReporteOperativo(rows);
      const totalVencidos = data.filter((item) => item.estado === 'Vencido').length;
      const totalProximos = data.filter((item) => item.estado !== 'Vencido').length;
      const fechaGeneracion = new Date().toLocaleString('es-MX');
      const umbral = Number(filtrosOperativo?.umbral_km || 1000);

      const headers = [
        'Vehiculo',
        'Marca',
        'Modelo',
        'Placa',
        'Conductor',
        'Telefono',
        'KM Actual',
        'Hito Mantenimiento',
        'KM Restantes',
        'Diferencia',
        'Estado'
      ];

      const tableRows = data.map((item) => [
        item.vehiculo,
        item.marca,
        item.modelo,
        item.placa,
        item.conductor,
        item.telefono,
        item.kmActual,
        item.hito,
        item.kmRestantes,
        item.diferencia,
        item.estado
      ]);

      const aoa = [
        ['Reporte de Proximos KM - Flotilla Completa'],
        [`Generado: ${fechaGeneracion}`],
        [`Umbral utilizado: ${umbral.toLocaleString('es-MX')} km`],
        [`Total vehiculos: ${data.length} | Vencidos: ${totalVencidos} | Proximos: ${totalProximos}`],
        [],
        headers,
        ...tableRows
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(aoa);
      worksheet['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 24 },
        { wch: 12 }
      ];
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } }
      ];
      worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5, c: 10 } })
      };

      for (let rowIndex = 6; rowIndex < 6 + tableRows.length; rowIndex += 1) {
        const kmActualCell = XLSX.utils.encode_cell({ r: rowIndex, c: 6 });
        const hitoCell = XLSX.utils.encode_cell({ r: rowIndex, c: 7 });
        const kmRestantesCell = XLSX.utils.encode_cell({ r: rowIndex, c: 8 });
        if (worksheet[kmActualCell]) worksheet[kmActualCell].z = '#,##0';
        if (worksheet[hitoCell]) worksheet[hitoCell].z = '#,##0';
        if (worksheet[kmRestantesCell]) worksheet[kmRestantesCell].z = '#,##0';
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ProximosKM');

      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `reporte_proximos_km_${fecha}.xls`, { bookType: 'xls' });
    } catch (error) {
      console.error('Error al exportar reporte XLS de proximos KM:', error);
      alert(error?.message || 'No se pudo exportar el reporte XLS.');
    } finally {
      setExportingOperativo(false);
    }
  };

  const exportarOperativoPdf = async () => {
    try {
      setExportingOperativo(true);
      const rows = await obtenerVehiculosReporteOperativo();
      if (!rows.length) {
        alert('No hay vehiculos para exportar.');
        return;
      }

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const data = prepararFilasReporteOperativo(rows);
      const fecha = new Date().toLocaleString('es-MX');
      const umbral = Number(filtrosOperativo?.umbral_km || 1000);
      const totalVencidos = data.filter((item) => item.estado === 'Vencido').length;
      const totalProximos = data.filter((item) => item.estado !== 'Vencido').length;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 74, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('Reporte Proximos KM - Flotilla Completa', 28, 28);
      doc.setFontSize(9);
      doc.text(`Generado: ${fecha}`, 28, 44);
      doc.text(`Umbral: ${umbral.toLocaleString('es-MX')} km`, 28, 58);
      doc.text(`Total: ${data.length} | Vencidos: ${totalVencidos} | Proximos: ${totalProximos}`, 220, 58);
      doc.setTextColor(24, 24, 27);

      const body = data.map((item, index) => [
        index + 1,
        item.vehiculo,
        `${item.marca} ${item.modelo}`.trim(),
        item.conductor,
        item.kmActual.toLocaleString('es-MX'),
        item.hito.toLocaleString('es-MX'),
        item.diferencia,
        item.estado
      ]);

      autoTable(doc, {
        startY: 84,
        head: [['#', 'Vehiculo', 'Marca/Modelo', 'Conductor', 'KM Actual', 'Hito', 'Diferencia', 'Estado']],
        body,
        theme: 'striped',
        styles: {
          fontSize: 8,
          lineColor: [203, 213, 225],
          lineWidth: 0.1,
          cellPadding: 5,
          valign: 'middle'
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [248, 250, 252],
          fontStyle: 'bold',
          halign: 'center'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          1: { cellWidth: 62, halign: 'left' },
          2: { cellWidth: 88, halign: 'left' },
          3: { cellWidth: 120, halign: 'left' },
          4: { cellWidth: 64, halign: 'right' },
          5: { cellWidth: 64, halign: 'right' },
          6: { cellWidth: 110, halign: 'left' },
          7: { cellWidth: 56, halign: 'center' }
        },
        margin: { left: 20, right: 20, bottom: 28 },
        didDrawPage: (hookData) => {
          const pageSize = doc.internal.pageSize;
          const pageNumber = hookData.pageNumber;
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(
            `Pagina ${pageNumber}`,
            pageSize.getWidth() - 65,
            pageSize.getHeight() - 10
          );
          doc.text(
            'Auto Manager - Mantenimientos',
            20,
            pageSize.getHeight() - 10
          );
          if (hookData.pageNumber > 1) {
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageSize.getWidth(), 22, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.text('Reporte Proximos KM - Flotilla Completa', 20, 14);
            doc.setTextColor(24, 24, 27);
          }
        }
      });

      doc.save(`reporte_proximos_km_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Error al exportar reporte PDF de proximos KM:', error);
      alert(error?.message || 'No se pudo exportar el reporte PDF.');
    } finally {
      setExportingOperativo(false);
    }
  };

  const formatKilometrajeServicio = (value) => {
    const km = Number(value);
    if (!Number.isFinite(km) || km <= 0) return null;
    return `${km.toLocaleString('es-MX')} km`;
  };

  const getKilometrajeObjetivoServicio = (mantenimiento = {}) => {
    const value =
      mantenimiento?.hito_objetivo_km ??
      mantenimiento?.proximo_servicio_km ??
      mantenimiento?.kilometraje_servicio;
    return formatKilometrajeServicio(value);
  };

  const getKilometrajeActualVehiculo = (mantenimiento = {}) => {
    const value =
      mantenimiento?.kilometraje_actual ??
      mantenimiento?.km_actual_vehiculo ??
      mantenimiento?.kilometraje_actual_vehiculo;
    return formatKilometrajeServicio(value);
  };

  const parseServiciosEspeciales = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    }
    return String(value)
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const toDateInputValue = (value) => {
    return toMaintenanceDateInputValue(value, '');
  };

  const toTimeInputValue = (value) => {
    return toMaintenanceTimeInputValue(value, '09:00');
  };

  const getEstadoFinancieroLabel = (estado) => {
    const map = {
      capturado: 'Capturado',
      validado_finanzas: 'Validado por Finanzas',
      pagado: 'Pagado'
    };
    return map[estado] || 'Capturado';
  };

  const getBadgeEstadoOperativo = (estado) => {
    const classes = {
      Pendiente: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      Programado: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'En proceso': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      Completado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      Cancelado: 'bg-red-500/20 text-red-300 border-red-500/30',
      Reprogramado: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${classes[estado] || classes.Pendiente}`}>
        {estado || 'Pendiente'}
      </span>
    );
  };

  const getBadgeEstadoFinanciero = (estado) => {
    const classes = {
      capturado: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      validado_finanzas: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      pagado: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${classes[estado] || classes.capturado}`}>
        {getEstadoFinancieroLabel(estado)}
      </span>
    );
  };

  const cargarModalPorKilometraje = async ({ page = 1, append = false } = {}) => {
    try {
      setModalPorKilometraje((prev) => ({
        ...prev,
        open: true,
        loading: true,
        error: ''
      }));

      const data = await adminService.getVehiculosProximosKilometraje({
        page,
        limit: MODAL_KM_PAGE_SIZE,
        umbral_km: UMBRAL_ALERTA_KM,
        orden: 'km_desc'
      });

      const rows = Array.isArray(data?.vehiculos) ? data.vehiculos : [];
      const pagination = data?.pagination || { page: 1, totalPages: 1, total: rows.length };

      setModalPorKilometraje((prev) => ({
        ...prev,
        open: true,
        loading: false,
        error: '',
        data: (append ? [...prev.data, ...rows] : [...rows]).sort((a, b) => {
          const kmB = Number(b?.kilometraje_actual || 0);
          const kmA = Number(a?.kilometraje_actual || 0);
          if (kmB !== kmA) return kmB - kmA; // Descendente por KM actual

          // Desempate por numero de vehiculo (descendente)
          return String(b?.numero_vehiculo || '').localeCompare(
            String(a?.numero_vehiculo || ''),
            'es',
            { numeric: true, sensitivity: 'base' }
          );
        }),
        pagination: {
          page: Number(pagination.page || 1),
          totalPages: Number(pagination.totalPages || 1),
          total: Number(pagination.total || 0)
        }
      }));
    } catch (error) {
      console.error('Error cargando modal por kilometraje:', error);
      setModalPorKilometraje((prev) => ({
        ...prev,
        open: true,
        loading: false,
        error: error?.message || 'No se pudo cargar el listado por kilometraje'
      }));
    }
  };

  const handleAbrirModalPorKilometraje = () => {
    cargarModalPorKilometraje({ page: 1, append: false });
  };

  const handleVerMasModalPorKilometraje = () => {
    if (modalPorKilometraje.loading) return;
    const currentPage = Number(modalPorKilometraje.pagination?.page || 1);
    const totalPages = Number(modalPorKilometraje.pagination?.totalPages || 1);
    if (currentPage >= totalPages) return;
    cargarModalPorKilometraje({ page: currentPage + 1, append: true });
  };

  const handleCerrarModalPorKilometraje = () => {
    setModalPorKilometraje((prev) => ({ ...prev, open: false }));
  };

  //  MEJORA 1: Función para manejar clic en tarjetas (FILTROS INTELIGENTES)
  const handleMetricClick = (metricType) => {
    const filterMap = {
      'vencidos': '?estado=vencido',
      'urgentes': '?estado=urgente',
      'programados': '?estado=Programado',
      'en_proceso': '?estado=En proceso',
      'completados': '?estado=Completado',
      'gastos_pendientes': '/admin/mantenimientos/distribuir-gastos' //  Ruta directa
    };
    
    if (metricType === 'por_kilometraje') {
      handleAbrirModalPorKilometraje();
      return;
    }

    const filter = filterMap[metricType] || '';
    
    //  Si es gastos_pendientes, navegar directamente
    if (metricType === 'gastos_pendientes') {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentRole = String(currentUser?.rol || currentUser?.role || '').toLowerCase();
      const canAccessDistribucionGastos = ['super_admin', 'finanzas', 'direccion'].includes(currentRole);
      if (!canAccessDistribucionGastos) return;
      navigate(filter);
    } else {
      navigate(`/admin/mantenimientos/lista${filter}`);
    }
  };
  // Confirmar cita directamente
  const handleConfirmar = async (mantenimientoId, e, forzarHorarioOcupado = false) => {
    if (e?.stopPropagation) {
      e.stopPropagation(); // Evitar que abra el detalle del card si existe ese evento
    }

    if (!forzarHorarioOcupado && !window.confirm('¿Deseas aprobar esta cita y pasarla a estado "Programado"?')) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${mantenimientoId}/confirmar`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          forzar_horario_ocupado: Boolean(forzarHorarioOcupado)
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Cita confirmada exitosamente');
        await cargarDatos(); // Recargar para limpiar la alerta
        await cargarVistaOperativa();
      } else if (response.status === 409 && data?.puede_forzar && !forzarHorarioOcupado) {
        const deseaForzar = window.confirm(
          `${data.message}\n\n¿Deseas confirmar de todos modos con sobrecupo?`
        );
        if (deseaForzar) {
          await handleConfirmar(mantenimientoId, null, true);
        }
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error al confirmar:', error);
      alert('Error de conexión al confirmar la cita');
    } finally {
      setLoading(false);
    }
  };

  //  MEJORA 2: Funciones para acciones en alertas
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = String(user?.rol || user?.role || '').toLowerCase();
  const canReprogramar = [
    'super_admin',
    'direccion',
    'director',
    'gerente_ops',
    'finanzas',
    'jefe_taller',
    'compras'
  ].includes(userRole);
  const canEliminarCitas = [
    'super_admin',
    'direccion',
    'gerente',
    'gerente_ops'
  ].includes(userRole);
  const canAccessDistribucionGastos = ['super_admin', 'finanzas', 'direccion'].includes(userRole);

  const puedeEliminarCita = (item) => {
    const estadoCanonico = getEstadoCanonico(item?.estado);
    return ['pendiente', 'programado'].includes(estadoCanonico);
  };

  const handleReprogramar = (item, e) => {
    e.stopPropagation();
    if (!canReprogramar) return;

    setModalReprogramar({
      open: true,
      id: item.id,
      folio: item.folio_servicio,
      vehiculo: item.numero_vehiculo || '-',
      tipo_servicio: item.tipo_servicio || '-',
      fecha_programada: toDateInputValue(item.fecha_programada),
      hora_programada: toTimeInputValue(item.fecha_programada),
      forzar_horario_ocupado: false,
      loading: false
    });
  };

  const handleCerrarModalReprogramar = () => {
    setSlotsReprogramacion([]);
    setCargandoSlotsReprogramacion(false);
    setModalReprogramar({
      open: false,
      id: null,
      folio: null,
      vehiculo: '',
      tipo_servicio: '',
      fecha_programada: '',
      hora_programada: '09:00',
      forzar_horario_ocupado: false,
      loading: false
    });
  };
  const handleGuardarReprogramacion = async () => {
    if (!modalReprogramar.id || !modalReprogramar.fecha_programada || !modalReprogramar.hora_programada) {
      alert('Selecciona una fecha y hora válidas');
      return;
    }
    const fechaHoraReprogramada = new Date(`${modalReprogramar.fecha_programada}T${modalReprogramar.hora_programada}:00`);
    if (Number.isNaN(fechaHoraReprogramada.getTime())) {
      alert('Selecciona una fecha y hora válidas');
      return;
    }
    if (fechaHoraReprogramada < new Date()) {
      alert('La fecha y hora programadas no pueden estar en el pasado');
      return;
    }

    const slotSeleccionado = slotsReprogramacion.find((slot) => slot.hora === modalReprogramar.hora_programada);
    if (slotSeleccionado && !slotSeleccionado.disponible && !modalReprogramar.forzar_horario_ocupado) {
      alert('Ese bloque de 30 minutos ya está ocupado. Activa sobrecupo para continuar.');
      return;
    }

    try {
      setModalReprogramar((prev) => ({ ...prev, loading: true }));
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${modalReprogramar.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fecha_programada: modalReprogramar.fecha_programada,
          hora_programada: modalReprogramar.hora_programada,
          forzar_horario_ocupado: Boolean(modalReprogramar.forzar_horario_ocupado)
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'No se pudo reprogramar');
      }

      alert('Mantenimiento reprogramado correctamente');
      handleCerrarModalReprogramar();
      await cargarDatos();
      await cargarVistaOperativa();
    } catch (error) {
      console.error('Error reprogramando mantenimiento:', error);
      alert(` ${error.message || 'Error de conexión'}`);
      setModalReprogramar((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleVerVehiculo = (vehiculoId, e) => {
    if (e?.stopPropagation) {
      e.stopPropagation();
    }
    navigate(`/admin/vehiculos/${vehiculoId}`);
  };

  const handleAgendarMantenimiento = (vehiculoId, e) => {
    if (e?.stopPropagation) {
      e.stopPropagation();
    }
    navigate(`/admin/mantenimientos/programar?vehiculo_id=${vehiculoId}`);
  };

  const getEstadoCanonico = (estado) => {
    const key = String(estado || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\s]+/g, '');

    if (key === 'pendiente' || key === 'solicitado') return 'pendiente';
    if (key === 'programado' || key === 'agendado' || key === 'reprogramado' || key === 'reprogramada') return 'programado';
    if (key === 'enproceso' || key === 'taller' || key === 'enprogreso') return 'en_proceso';
    if (key === 'completado' || key === 'terminado' || key === 'finalizado') return 'completado';
    if (key === 'cancelado' || key === 'cancelada') return 'cancelado';
    return key;
  };

  const handleIniciarTallerDesdeAlerta = async (item, e) => {
    e.stopPropagation();
    if (!item?.id) return;

    if (!window.confirm(`¿Ingresar ${item.numero_vehiculo || 'vehículo'} a taller?`)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${item.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: 'En proceso' })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'No se pudo iniciar en taller');
      }

      alert('Mantenimiento cambiado a En proceso');
      await cargarDatos();
      await cargarVistaOperativa();
    } catch (error) {
      console.error('Error al iniciar mantenimiento desde alerta:', error);
      alert(` ${error.message || 'Error de conexión'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletarDesdeAlerta = (item, e) => {
    e.stopPropagation();
    if (!item?.id) return;
    navigate(`/admin/mantenimientos/${item.id}/completar`);
  };

  // FUNCIN PARA CANCELAR
  const handleCancelar = async (mantenimientoId, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Estás seguro de que deseas CANCELAR esta cita de mantenimiento?')) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${mantenimientoId}/cancelar`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        alert('Cita cancelada correctamente');
        await cargarDatos(); // Recargar el dashboard
        await cargarVistaOperativa();
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error al cancelar:', error);
      alert('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarCita = async (item, e) => {
    e.stopPropagation();

    if (!canEliminarCitas) {
      alert('No tienes permisos para eliminar citas');
      return;
    }

    if (!puedeEliminarCita(item)) {
      alert('Solo se pueden eliminar citas pendientes o programadas');
      return;
    }

    if (!window.confirm(`¿Eliminar la cita de mantenimiento #${String(item?.folio_servicio || 0).padStart(4, '0')}?`)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${item.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'No se pudo eliminar la cita');
      }

      await cargarDatos();
      await cargarVistaOperativa();
    } catch (error) {
      console.error('Error al eliminar cita de mantenimiento:', error);
      alert(` ${error.message || 'Error de conexión'}`);
    } finally {
      setLoading(false);
    }
  };

  // FUNCIN PARA ABRIR MODAL INFO
  const handleVerInfo = async (item, e) => {
    e.stopPropagation();
    if (!item?.id) {
      setModalDetalle({ open: true, data: item });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${item.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data?.success && data?.mantenimiento) {
        setModalDetalle({ open: true, data: data.mantenimiento });
        return;
      }

      setModalDetalle({ open: true, data: item });
    } catch (error) {
      console.error('Error cargando detalle de mantenimiento:', error);
      setModalDetalle({ open: true, data: item });
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center">
        <div className="text-white text-xl">Cargando datos...</div>
      </div>
    );
  }

  const stats = estadisticas?.estadisticas || {};
  
  //  MEJORA 3: Agrupar métricas por prioridad
  const alertMetrics = [
    {
      title: 'Vencidos/Cancelados',
      value: stats.vencidos || 0,
      icon: AlertTriangle,
      color: 'red',
      description: 'Requieren atención o historial',
      urgent: stats.vencidos > 0,
      filterKey: 'vencidos'
    },
    {
      title: 'Urgentes',
      value: stats.urgentes || 0,
      icon: Clock,
      color: 'yellow',
      description: 'Próximos 7 días',
      urgent: stats.urgentes > 0,
      filterKey: 'urgentes'
    },
    {
      title: 'Por Kilometraje',
      value: stats.por_kilometraje || 0,
      icon: Car,
      color: 'orange',
      description: 'Requieren servicio',
      urgent: stats.por_kilometraje > 0,
      filterKey: 'por_kilometraje'
    },
    //  NUEVA TARJETA: Gastos Pendientes
    ...(canAccessDistribucionGastos ? [{
      title: 'Distribución de Gastos',
      value: pendientesDistribucion,
      icon: Wallet,
      color: 'purple',
      description: 'Requieren distribución',
      urgent: pendientesDistribucion > 0,
      filterKey: 'gastos_pendientes'
    }] : [])
  ];

  const summaryMetrics = [
    {
      title: 'En Proceso',
      value: stats.en_proceso || 0,
      icon: Wrench,
      color: 'indigo',
      description: 'Actualmente en taller',
      filterKey: 'en_proceso'
    },
    {
      title: 'Programados',
      value: stats.programados || 0,
      icon: Calendar,
      color: 'blue',
      description: 'Pendientes de realizar',
      filterKey: 'programados'
    },
    {
      title: 'Completados Mes',
      value: stats.completados_mes || 0,
      icon: CheckCircle,
      color: 'green',
      description: 'Este mes',
      filterKey: 'completados'
    },
    {
      title: 'Costo Total Mes',
      value: formatCurrency(stats.costo_total_mes),
      icon: DollarSign,
      color: 'purple',
      description: 'Gastado este mes',
      filterKey: null
    },
    {
      title: 'Promedio Costo',
      value: formatCurrency(stats.promedio_costo),
      icon: TrendingUp,
      color: 'cyan',
      description: 'Por servicio',
      filterKey: null
    }
  ];

  const resumenOperativo = vistaOperativa?.resumen || {};
  const resumenFinanciero = vistaFinanciera?.resumen || {};
  const estadosFinancieros = ['capturado', 'validado_finanzas', 'pagado'];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
      green: 'from-green-500/20 to-green-600/20 border-green-500/30',
      red: 'from-red-500/20 to-red-600/20 border-red-500/30',
      purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
      yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
      indigo: 'from-indigo-500/20 to-indigo-600/20 border-indigo-500/30',
      orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
      cyan: 'from-cyan-500/20 to-cyan-600/20 border-cyan-500/30'
    };
    return colors[color] || colors.blue;
  };

  const getIconColor = (color) => {
    const colors = {
      blue: 'text-blue-400',
      green: 'text-green-400',
      red: 'text-red-400',
      purple: 'text-purple-400',
      yellow: 'text-yellow-400',
      indigo: 'text-indigo-400',
      orange: 'text-orange-400',
      cyan: 'text-cyan-400'
    };
    return colors[color] || colors.blue;
  };

  const getServiciosTabs = () => {
    const modelos = serviciosPreventivos || {};
    const tabs = [
      {
        key: 'generico_10000km',
        label: 'Generico (10,000 km)',
        title: 'Tabla preventiva generica (cada 10,000 km)',
        iconColor: 'text-amber-400'
      },
      {
        key: 'byd_dolphin_mini',
        label: 'BYD Dolphin Mini',
        title: 'Tabla preventiva BYD Dolphin Mini',
        iconColor: 'text-cyan-400'
      }
    ].filter((tab) => Array.isArray(modelos?.[tab.key]) && modelos[tab.key].length > 0);

    if (tabs.length > 0) return tabs;

    const primeraClave = Object.keys(modelos || {})[0];
    if (!primeraClave) return [];
    return [{
      key: primeraClave,
      label: primeraClave,
      title: `Tabla preventiva ${primeraClave}`,
      iconColor: 'text-amber-400'
    }];
  };

  const renderTablaServicios = (tabKey) => {
    const tabs = getServiciosTabs();
    const tab = tabs.find((item) => item.key === tabKey) || tabs[0];
    const serviciosBase = tab ? (serviciosPreventivos?.[tab.key] || []) : [];
    const servicios = [...serviciosBase].sort((a, b) => Number(a.kilometraje || 0) - Number(b.kilometraje || 0));
    const isBydDolphinMini = tab?.key === 'byd_dolphin_mini';
    const showCostoEstimado = !isBydDolphinMini && servicios.some((item) => item.costo_estimado != null);
    const showManoObraHoras = servicios.some((item) => item.mano_obra_horas != null);

    if (!servicios.length) {
      return (
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-sm">
          No hay servicios configurados.
        </div>
      );
    }

    return (
      <div className="bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Wrench className={`w-4 h-4 ${tab?.iconColor || 'text-amber-400'}`} />
            <h3 className="text-white font-semibold">{tab?.title || 'Tabla preventiva'}</h3>
          </div>
          <span className="text-xs text-gray-400">{servicios.length} servicios</span>
        </div>
        <div className="overflow-hidden border-t border-white/10">
          <table className="min-w-full text-sm text-left text-gray-200">
            <thead className="bg-white/5 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Kilometraje</th>
                <th className="px-4 py-3">Servicio</th>
                {showCostoEstimado && <th className="px-4 py-3">Costo Est.</th>}
                {showManoObraHoras && <th className="px-4 py-3">MO (hrs)</th>}
              </tr>
            </thead>
            <tbody>
              {servicios.map((servicio, index) => (
                <tr key={`${tab?.key || 'servicio'}-${servicio.kilometraje}-${index}`} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold text-white">
                    {Number(servicio.kilometraje || 0).toLocaleString()} km
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {servicio.servicio}
                  </td>
                  {showCostoEstimado && (
                    <td className="px-4 py-3 text-gray-300">
                      {servicio.costo_estimado != null
                        ? Number(servicio.costo_estimado).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
                        : '-'}
                    </td>
                  )}
                  {showManoObraHoras && (
                    <td className="px-4 py-3 text-gray-300">
                      {servicio.mano_obra_horas != null ? Number(servicio.mano_obra_horas).toLocaleString('es-MX') : '-'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // FUNCIN AUXILIAR PARA RENDERIZAR BOTONES SEGN EL ESTADO
const renderAcciones = (item, esSeccionVencidos) => {
    // CAMBIO: Usamos 'px-3' fijos y quitamos el grid para que el botón se ajuste al texto
    const btnBase = "w-full sm:w-auto px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 border shadow-sm whitespace-nowrap min-h-[38px]";
    
    return (
      // CAMBIO: Usamos 'flex flex-wrap' en lugar de 'grid'
      // 'justify-start' alineará los botones a la izquierda. Usa 'justify-center' si los quieres centrados.
      <div className="flex flex-wrap gap-2 mt-3">
        
        {/* 1. BOTN INFO */}
        <button
          onClick={(e) => handleVerInfo(item, e)}
          className={`${btnBase} bg-slate-700/50 hover:bg-slate-700 text-slate-200 border-slate-600`}
        >
          <Info className="w-3.5 h-3.5" />
          Info
        </button>

        {/* 2. BOTN REPROGRAMAR */}
        {canReprogramar && (
          <button
            onClick={(e) => handleReprogramar(item, e)}
            className={`${btnBase} bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Reprogramar
          </button>
        )}

        {/* 3. BOTN CANCELAR */}
        <button
          onClick={(e) => handleCancelar(item.id, e)}
          className={`${btnBase} bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30`}
        >
          <XCircle className="w-3.5 h-3.5" />
          Cancelar
        </button>

        {/* 4. BOTON PRINCIPAL: Aceptar siempre que NO este vencido */}
        {!esSeccionVencidos ? (
          <button
            onClick={(e) => {
              const estadoCanonico = getEstadoCanonico(item?.estado);
              if (estadoCanonico === 'en_proceso') {
                handleCompletarDesdeAlerta(item, e);
                return;
              }
              if (estadoCanonico === 'programado') {
                handleIniciarTallerDesdeAlerta(item, e);
                return;
              }
              handleConfirmar(item.id, e);
            }}
            className={`${btnBase} bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Aceptar
          </button>
        ) : (
           <button
            onClick={(e) => handleVerVehiculo(item.vehiculo_id, e)}
            className={`${btnBase} bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30`}
          >
            <Car className="w-3.5 h-3.5" />
            Ver Auto
          </button>
        )}
      </div>
    );
  };

  const totalAlertasCriticas = (alertas?.vencidos?.length || 0) + (alertas?.urgentes?.length || 0);
  const vencidosVisibles = (alertas?.vencidos || []).slice(0, limiteAlertasCriticas);
  const urgentesDisponibles = Math.max(limiteAlertasCriticas - vencidosVisibles.length, 0);
  const urgentesVisibles = (alertas?.urgentes || []).slice(0, urgentesDisponibles);
  const hayMasAlertasCriticas = totalAlertasCriticas > limiteAlertasCriticas;

  const proximosVisibles = (alertas?.proximos || []).slice(0, limiteProximos);
  const hayMasProximos = (alertas?.proximos?.length || 0) > limiteProximos;
  const proximosTodos = alertas?.proximos || [];

  const renderTarjetaProximo = (item, compact = true) => (
    <div
      key={item.id}
      onClick={() => navigate('/admin/mantenimientos/lista?estado=Programado')}
      className={`bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
          {item.dias_restantes}d
        </span>
        <p className="text-white text-sm font-semibold flex-1 truncate">
          {item.numero_vehiculo}
        </p>
      </div>
      <p className="text-gray-400 text-xs mb-1 break-words">
        {item.tipo_servicio}
      </p>
      {item.detalle_fuera_programacion && (
        <p className="text-amber-300 text-xs mb-1">
          Detalle especial: {item.detalle_fuera_programacion}
        </p>
      )}
      {item.servicio_especial && (
        <p className="text-purple-300 text-xs mb-1">
          Servicio especial: {item.servicio_especial}
        </p>
      )}
      {item.refacciones && (
        <p className="text-cyan-300 text-xs mb-1">
          Refacciones: {item.refacciones}
        </p>
      )}
      <p className="text-gray-500 text-xs">
        {formatMaintenanceDate(item.fecha_programada, { fallback: '-', month: 'short' })}
      </p>
      <p className="text-cyan-300 text-xs">
        {formatMaintenanceTime(item.fecha_programada, { fallback: '-' })}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#07425E] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">
               Mantenimientos
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Dashboard y gestión de servicios
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 w-full lg:w-auto">
            <button
              onClick={() => navigate('/admin/mantenimientos/lista')}
              className="px-3 sm:px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm rounded-lg backdrop-blur-sm border border-white/20 transition-all flex items-center justify-center gap-2 w-full"
            >
              <FileText className="w-4 h-4" />
              Ver mantenimientos
            </button>

            <button
              onClick={handleVerServicios}
              className="px-3 sm:px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm rounded-lg backdrop-blur-sm border border-white/20 transition-all flex items-center justify-center gap-2 w-full"
            >
              <Table className="w-4 h-4" />
              Ver tabla de servicios
            </button>

            <button
              onClick={() => navigate('/admin/mantenimientos/reportes')}
              className="px-3 sm:px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm rounded-lg backdrop-blur-sm border border-white/20 transition-all flex items-center justify-center gap-2 w-full"
            >
              <BarChart3 className="w-4 h-4" />
              Reportes
            </button>
            
            <button
              onClick={() => navigate('/admin/mantenimientos/programar')}
              className="px-3 sm:px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs sm:text-sm rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2 w-full"
            >
              <Plus className="w-4 h-4" />
              Programar Mantenimiento
            </button>
          </div>
        </div>


        {/*  MEJORA 3: GRUPO 1 - ALERTAS DE ACCIN (Ahora con 4 tarjetas) */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ️ Alertas de Acción
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {alertMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div
                  key={index}
                  onClick={() => metric.filterKey && handleMetricClick(metric.filterKey)}
                  className={`relative p-4 sm:p-5 rounded-xl backdrop-blur-sm border transition-all hover:scale-[1.02] cursor-pointer bg-gradient-to-br ${getColorClasses(metric.color)} ${
                    metric.urgent ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900' : ''
                  }`}
                >
                  {metric.urgent && (
                    <div className="absolute top-2 right-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-gray-400 text-xs sm:text-sm mb-1">{metric.title}</p>
                      <p className="text-2xl sm:text-3xl font-bold text-white">
                        {metric.value}
                      </p>
                    </div>
                    <div className={`p-2 sm:p-3 rounded-lg bg-white/5 ${getIconColor(metric.color)}`}>
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                  </div>
                  
                  <p className="text-gray-400 text-xs sm:text-sm">
                    {metric.description}
                  </p>
                  
                  {metric.filterKey && (
                    <p className="text-xs text-gray-500 mt-2">
                      Clic para {metric.filterKey === 'gastos_pendientes' ? 'distribuir' : 'ver detalles'} 
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/*  MEJORA 3: GRUPO 2 - MTRICAS DE RESUMEN (Más pequeñas) */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
             Métricas de Resumen
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            {summaryMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div
                  key={index}
                  onClick={() => metric.filterKey && handleMetricClick(metric.filterKey)}
                  className={`p-3 sm:p-4 rounded-xl backdrop-blur-sm border transition-all bg-gradient-to-br ${getColorClasses(metric.color)} ${
                    metric.filterKey ? 'hover:scale-105 cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-1.5 sm:p-2 rounded-lg bg-white/5 ${getIconColor(metric.color)}`}>
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </div>
                  
                  <p className="text-gray-400 text-xs mb-1">{metric.title}</p>
                  <p className="text-xl sm:text-2xl font-bold text-white mb-1">
                    {metric.value}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {metric.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          
          {/*  MEJORA 2: Alertas Críticas con BOTONES DE ACCIN */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-3 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                  Alertas Críticas
                </h2>
                <span className="px-2.5 py-1 bg-red-500/20 text-red-400 rounded-full text-xs sm:text-sm font-semibold">
                  {totalAlertasCriticas} alertas
                </span>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* Vencidos con BOTONES */}
                {vencidosVisibles.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-semibold">
                            VENCIDO
                          </span>
                          <span className="text-red-400 text-sm font-semibold">
                            {Math.floor(item.dias_vencido)} día(s) de retraso
                          </span>
                        </div>
                        
                        <p className="text-white font-semibold mb-1">
                          {item.numero_vehiculo} - {item.marca} {item.modelo}
                        </p>
                        <p className="text-gray-400 text-sm mb-1 break-words">
                          {item.tipo_servicio}
                        </p>
                        {item.detalle_fuera_programacion && (
                          <p className="text-amber-300 text-xs mb-1">
                            Detalle especial: {item.detalle_fuera_programacion}
                          </p>
                        )}
                        {item.servicio_especial && (
                          <p className="text-purple-300 text-xs mb-1">
                            Servicio especial: {item.servicio_especial}
                          </p>
                        )}
                        {item.refacciones && (
                          <p className="text-cyan-300 text-xs mb-1">
                            Refacciones: {item.refacciones}
                          </p>
                        )}
                        {item.nombre_conductor && (
                          <p className="text-gray-400 text-xs">
                            Conductor: {item.nombre_conductor}
                          </p>
                        )}
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-gray-400 text-xs">Programado:</p>
                        <p className="text-white text-sm">
                          {formatDateOnly(item.fecha_programada)}
                        </p>
                        <p className="text-cyan-300 text-xs">
                          {formatTimeOnly(item.fecha_programada)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Botones de acción estándar */}
                    {renderAcciones(item, true)} 
                  </div>
                ))}

                {/* Urgentes con BOTONES */}
                {urgentesVisibles.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/20 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-semibold">
                            URGENTE
                          </span>
                          <span className="text-yellow-400 text-sm font-semibold">
                            En {item.dias_restantes} día(s)
                          </span>
                        </div>
                        <p className="text-white font-semibold mb-1">
                          {item.numero_vehiculo} - {item.marca} {item.modelo}
                        </p>
                        <p className="text-gray-400 text-sm mb-1 break-words">
                          {item.tipo_servicio}
                        </p>
                        {item.detalle_fuera_programacion && (
                          <p className="text-amber-300 text-xs mb-1">
                            Detalle especial: {item.detalle_fuera_programacion}
                          </p>
                        )}
                        {item.servicio_especial && (
                          <p className="text-purple-300 text-xs mb-1">
                            Servicio especial: {item.servicio_especial}
                          </p>
                        )}
                        {item.refacciones && (
                          <p className="text-cyan-300 text-xs mb-1">
                            Refacciones: {item.refacciones}
                          </p>
                        )}
                        {item.nombre_conductor && (
                          <p className="text-gray-400 text-xs">
                            Conductor: {item.nombre_conductor}
                          </p>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-gray-400 text-xs">Programado:</p>
                        <p className="text-white text-sm">
                          {formatDateOnly(item.fecha_programada)}
                        </p>
                        <p className="text-cyan-300 text-xs">
                          {formatTimeOnly(item.fecha_programada)}
                        </p>
                      </div>
                    </div>
                    
                    {/*  BOTONES DE ACCIN */}
                    <div className="mt-1">
                        {renderAcciones(item, false)}
                    </div>
                  </div>
                ))}

                {hayMasAlertasCriticas && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setLimiteAlertasCriticas((prev) => prev + ALERTAS_CHUNK_SIZE)}
                      className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-all"
                    >
                      Ver mas alertas
                    </button>
                  </div>
                )}

                {totalAlertasCriticas === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
                    <p className="text-lg font-semibold text-white mb-2">
                      ¡Todo en orden!
                    </p>
                    <p className="text-sm">
                      No hay mantenimientos vencidos o urgentes
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Proximos 30 Dias */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-3 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Próximos 30 Días
                </h2>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold">
                    {alertas?.proximos?.length || 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalProximos30DiasOpen(true)}
                    className="px-3 py-1 rounded-lg border border-white/20 text-white text-xs hover:bg-white/10 transition-all inline-flex items-center gap-1"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Pantalla completa
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {proximosVisibles.map((item) => renderTarjetaProximo(item, true))}

                {hayMasProximos && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setLimiteProximos((prev) => prev + PROXIMOS_CHUNK_SIZE)}
                      className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-all"
                    >
                      Ver mas
                    </button>
                  </div>
                )}

                {!alertas?.proximos?.length && (
                  <div className="text-center py-8 text-gray-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No hay mantenimientos proximos</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vista Operativa y Flujo Financiero */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-3 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => setTabVista('operativo')}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all w-full ${
                  tabVista === 'operativo'
                    ? 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                Próximos KM
              </button>
              <button
                type="button"
                onClick={() => setTabVista('financiero')}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all w-full ${
                  tabVista === 'financiero'
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                Flujo Financiero
              </button>
            </div>
              <div className="text-xs text-gray-400 break-words">
                Vista de proximidad por kilometraje + flujo financiero conectados con APIs de mantenimiento.
              </div>
          </div>

          {tabVista === 'operativo' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Total vehiculos</p>
                  <p className="text-xl font-bold text-white">{resumenOperativo.total || 0}</p>
                </div>
                <div className="bg-white/5 border border-red-400/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Vencidos por KM</p>
                  <p className="text-xl font-bold text-red-300">{resumenOperativo.vencidos || 0}</p>
                </div>
                <div className="bg-white/5 border border-amber-400/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Proximos por KM</p>
                  <p className="text-xl font-bold text-amber-300">{resumenOperativo.proximos || 0}</p>
                </div>
                <div className="bg-white/5 border border-cyan-400/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Umbral activo</p>
                  <p className="text-xl font-bold text-cyan-300">
                    {(resumenOperativo.umbral_km || filtrosOperativo.umbral_km || 1000).toLocaleString()} km
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={filtrosOperativo.search}
                  onChange={(e) => setFiltrosOperativo((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Buscar por unidad, placa, marca, modelo o conductor"
                  className="md:col-span-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                />
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={filtrosOperativo.umbral_km}
                  onChange={(e) => setFiltrosOperativo((prev) => ({ ...prev, umbral_km: e.target.value }))}
                  placeholder="Umbral KM"
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                />
                <div className="grid grid-cols-2 md:flex gap-2">
                  <button
                    type="button"
                    onClick={() => cargarVistaOperativa()}
                    className="w-full md:flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-200 rounded-lg text-sm font-semibold"
                  >
                    Filtrar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reset = { search: '', umbral_km: 1000 };
                      setFiltrosOperativo(reset);
                      cargarVistaOperativa(reset);
                    }}
                    className="w-full px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-200 rounded-lg text-sm"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={exportarOperativoXls}
                  disabled={exportingOperativo}
                  className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {exportingOperativo ? 'Generando...' : 'Exportar Excel'}
                </button>
                <button
                  type="button"
                  onClick={exportarOperativoPdf}
                  disabled={exportingOperativo}
                  className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {exportingOperativo ? 'Generando...' : 'Exportar PDF'}
                </button>
              </div>

              {errorOperativo  && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  {errorOperativo}
                </div>
              )}

              <div className="md:hidden space-y-3">
                {loadingOperativo && vistaOperativa.vehiculos.length === 0 && (
                  <div className="p-4 rounded-lg border border-white/10 bg-white/5 text-center text-gray-400 text-sm">
                    Cargando vehiculos proximos por kilometraje...
                  </div>
                )}
                {!loadingOperativo && vistaOperativa.vehiculos.length === 0 && (
                  <div className="p-4 rounded-lg border border-white/10 bg-white/5 text-center text-gray-400 text-sm">
                    No hay vehiculos cercanos a mantenimiento con el umbral configurado.
                  </div>
                )}
                {!loadingOperativo && vistaOperativa.vehiculos.map((item) => (
                  <div key={`operativo-km-mobile-${item.vehiculo_id}`} className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-semibold">{item.numero_vehiculo || '-'}</p>
                        <p className="text-gray-400 text-xs">{item.marca || '-'} {item.modelo || '-'}</p>
                        <p className="text-gray-500 text-xs">{item.placa || '-'}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                          String(item.estado_alerta || '').toLowerCase() === 'vencido'
                            ? 'bg-red-500/20 text-red-300 border-red-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {item.estado_alerta || 'Proximo'}
                      </span>
                    </div>
                    <p className="text-gray-300 text-xs">
                      Conductor: {item.nombre_conductor || 'Sin conductor activo'} ({item.conductor_telefono || '-'})
                    </p>
                    <p className="text-white text-sm">
                      KM actual: {Number(item.kilometraje_actual || 0).toLocaleString()} km
                    </p>
                    <p className="text-gray-200 text-sm">
                      Hito: {Number(item.hito_objetivo_km || 0).toLocaleString()} km
                    </p>
                    <p className={`text-sm font-semibold ${Number(item.km_restantes || 0) >= 0 ? 'text-amber-300' : 'text-red-300'}`}>
                      {Number(item.km_restantes || 0) >= 0
                        ? `Faltan ${Number(item.km_restantes || 0).toLocaleString()} km`
                        : `Excedido por ${Math.abs(Number(item.km_restantes || 0)).toLocaleString()} km`}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => handleAgendarMantenimiento(item.vehiculo_id, e)}
                      className="w-full px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-200 rounded text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Agendar
                    </button>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-auto max-h-[60vh] sidebar-scroll border border-white/10 rounded-xl">
                <table className="w-full min-w-[1000px] relative">
                  <thead className="bg-[#1a1a2e] sticky top-0 z-10 shadow-sm border-b border-white/10">
                    <tr className="text-left text-xs uppercase text-gray-400">
                      <th className="px-4 py-3">Vehiculo</th>
                      <th className="px-4 py-3">Conductor</th>
                      <th className="px-4 py-3">KM Actual</th>
                      <th className="px-4 py-3">Hito Mantenimiento</th>
                      <th className="px-4 py-3">Diferencia</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingOperativo && vistaOperativa.vehiculos.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                          Cargando vehiculos proximos por kilometraje...
                        </td>
                      </tr>
                    )}
                    {!loadingOperativo && vistaOperativa.vehiculos.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                          No hay vehiculos cercanos a mantenimiento con el umbral configurado.
                        </td>
                      </tr>
                    )}
                    {vistaOperativa.vehiculos.map((item) => (
                      <tr key={`operativo-km-${item.vehiculo_id}`} className="border-t border-white/5">
                        <td className="px-4 py-3">
                          <p className="text-white font-semibold">{item.numero_vehiculo || '-'}</p>
                          <p className="text-gray-400 text-xs">{item.marca || '-'} {item.modelo || '-'}</p>
                          <p className="text-gray-500 text-xs">{item.placa || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-200">{item.nombre_conductor || 'Sin conductor activo'}</p>
                          <p className="text-gray-500 text-xs">{item.conductor_telefono || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-white font-semibold">
                          {Number(item.kilometraje_actual || 0).toLocaleString()} km
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {Number(item.hito_objetivo_km || 0).toLocaleString()} km
                        </td>
                        <td className="px-4 py-3">
                          {Number(item.km_restantes || 0) >= 0 ? (
                            <span className="text-amber-300 font-semibold">
                              Faltan {Number(item.km_restantes || 0).toLocaleString()} km
                            </span>
                          ) : (
                            <span className="text-red-300 font-semibold">
                              Excedido por {Math.abs(Number(item.km_restantes || 0)).toLocaleString()} km
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                              String(item.estado_alerta || '').toLowerCase() === 'vencido'
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {item.estado_alerta || 'Proximo'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(e) => handleAgendarMantenimiento(item.vehiculo_id, e)}
                              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-200 rounded text-xs font-semibold flex items-center gap-1"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              Agendar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {Number(vistaOperativa?.pagination?.page || 1) < Number(vistaOperativa?.pagination?.totalPages || 1) && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleVerMasOperativo}
                    disabled={loadingOperativo}
                    className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingOperativo ? 'Cargando...' : 'Ver mas vehiculos'}
                  </button>
                </div>
              )}
            </div>
          )}

          {tabVista === 'financiero' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Capturado</p>
                  <p className="text-xl font-bold text-white">{resumenFinanciero.capturado || 0}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Validado por Finanzas</p>
                  <p className="text-xl font-bold text-white">{resumenFinanciero.validado_finanzas || 0}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Pagado</p>
                  <p className="text-xl font-bold text-white">{resumenFinanciero.pagado || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={filtrosFinanciero.search}
                  onChange={(e) => setFiltrosFinanciero((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Buscar por unidad, folio, conductor o servicio"
                  className="md:col-span-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400"
                />
                <select
                  value={filtrosFinanciero.estado_financiero}
                  onChange={(e) => setFiltrosFinanciero((prev) => ({ ...prev, estado_financiero: e.target.value }))}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="">Todos los estados</option>
                  {estadosFinancieros.map((estado) => (
                    <option key={estado} value={estado} className="text-black">
                      {getEstadoFinancieroLabel(estado)}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 md:flex gap-2">
                  <button
                    type="button"
                    onClick={() => cargarVistaFinanciera()}
                    className="w-full md:flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 rounded-lg text-sm font-semibold"
                  >
                    Filtrar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reset = { estado_financiero: '', search: '' };
                      setFiltrosFinanciero(reset);
                      cargarVistaFinanciera(reset);
                    }}
                    className="w-full px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-200 rounded-lg text-sm"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {errorFinanciero && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  {errorFinanciero}
                </div>
              )}

              <div className="md:hidden space-y-3">
                {loadingFinanciero && (
                  <div className="p-4 rounded-lg border border-white/10 bg-white/5 text-center text-gray-400 text-sm">
                    Cargando flujo financiero...
                  </div>
                )}
                {!loadingFinanciero && vistaFinanciera.mantenimientos.length === 0 && (
                  <div className="p-4 rounded-lg border border-white/10 bg-white/5 text-center text-gray-400 text-sm">
                    No hay mantenimientos financieros para los filtros seleccionados.
                  </div>
                )}
                {!loadingFinanciero && vistaFinanciera.mantenimientos.map((item) => {
                  const draft = estadoFinancieroDraft[item.id] || item.estado_financiero || 'capturado';
                  const unchanged = draft === (item.estado_financiero || 'capturado');
                  return (
                    <div key={`financiero-mobile-${item.id}`} className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white font-semibold">#{String(item.folio_servicio || item.id).padStart(4, '0')}</p>
                        <p className="text-emerald-300 font-semibold text-sm">{formatCurrency(item.costo_total)}</p>
                      </div>
                      <p className="text-white text-sm">{item.numero_vehiculo || '-'} · {item.nombre_conductor || 'Sin conductor'}</p>
                      <p className="text-gray-200 text-sm">{item.tipo_servicio || '-'}</p>
                      <div className="flex flex-wrap gap-2">
                        {getBadgeEstadoOperativo(item.estado_operativo_label || item.estado)}
                        {getBadgeEstadoFinanciero(item.estado_financiero)}
                      </div>
                      <p className="text-gray-400 text-xs">Actualizado: {formatDateTime(item.updated_at)}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={draft}
                          onChange={(e) => setEstadoFinancieroDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs focus:outline-none focus:border-emerald-400"
                        >
                          {estadosFinancieros.map((estado) => (
                            <option key={estado} value={estado} className="text-black">
                              {getEstadoFinancieroLabel(estado)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={unchanged || updatingFinancieroId === item.id}
                          onClick={() => actualizarEstadoFinanciero(item.id)}
                          className="px-3 py-1.5 rounded text-xs font-semibold border bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/30 text-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updatingFinancieroId === item.id ? 'Guardando...' : 'Actualizar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto border border-white/10 rounded-xl">
                <table className="w-full min-w-[1000px]">
                  <thead className="bg-white/5">
                    <tr className="text-left text-xs uppercase text-gray-400">
                      <th className="px-4 py-3">Folio</th>
                      <th className="px-4 py-3">Vehiculo</th>
                      <th className="px-4 py-3">Servicio</th>
                      <th className="px-4 py-3">Estado Mant.</th>
                      <th className="px-4 py-3">Estado Financiero</th>
                      <th className="px-4 py-3">Costo</th>
                      <th className="px-4 py-3">Actualizado</th>
                      <th className="px-4 py-3 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingFinanciero && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                          Cargando flujo financiero...
                        </td>
                      </tr>
                    )}
                    {!loadingFinanciero && vistaFinanciera.mantenimientos.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                          No hay mantenimientos financieros para los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                    {!loadingFinanciero && vistaFinanciera.mantenimientos.map((item) => {
                      const draft = estadoFinancieroDraft[item.id] || item.estado_financiero || 'capturado';
                      const unchanged = draft === (item.estado_financiero || 'capturado');
                      return (
                        <tr key={`financiero-${item.id}`} className="border-t border-white/5">
                          <td className="px-4 py-3 text-white font-semibold">
                            #{String(item.folio_servicio || item.id).padStart(4, '0')}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white font-semibold">{item.numero_vehiculo || '-'}</p>
                            <p className="text-gray-500 text-xs">{item.nombre_conductor || 'Sin conductor'}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-200">{item.tipo_servicio || '-'}</td>
                          <td className="px-4 py-3">{getBadgeEstadoOperativo(item.estado_operativo_label || item.estado)}</td>
                          <td className="px-4 py-3">{getBadgeEstadoFinanciero(item.estado_financiero)}</td>
                          <td className="px-4 py-3 text-emerald-300 font-semibold">{formatCurrency(item.costo_total)}</td>
                          <td className="px-4 py-3 text-gray-300">{formatDateTime(item.updated_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <select
                                value={draft}
                                onChange={(e) => setEstadoFinancieroDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                className="px-2 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs focus:outline-none focus:border-emerald-400"
                              >
                                {estadosFinancieros.map((estado) => (
                                  <option key={estado} value={estado} className="text-black">
                                    {getEstadoFinancieroLabel(estado)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={unchanged || updatingFinancieroId === item.id}
                                onClick={() => actualizarEstadoFinanciero(item.id)}
                                className="px-3 py-1.5 rounded text-xs font-semibold border bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/30 text-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {updatingFinancieroId === item.id ? 'Guardando...' : 'Actualizar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {serviciosModalAbierto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-white/5">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Guía de mantenimientos preventivos</p>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Table className="w-5 h-5" /> Ver tabla de servicios
                  </h3>
                </div>
                <button
                  onClick={handleCerrarServicios}
                  className="px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/10 transition-all"
                >
                  Cerrar
                </button>
              </div>

              <div className="px-3 sm:px-6 py-4 sm:py-5 max-h-[70vh] overflow-y-auto space-y-4">
                {errorServicios && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                    {errorServicios}
                  </div>
                )}

                {cargandoServicios ? (
                  <p className="text-gray-300 text-sm">Cargando tabla de servicios...</p>
                ) : (
                  (() => {
                    const tabs = getServiciosTabs();
                    const tabSeleccionada = tabs.find((tab) => tab.key === serviciosTabActiva)?.key || tabs[0]?.key;
                    return (
                      <div className="grid grid-cols-1 gap-4">
                        {tabs.length > 1 && (
                          <div className="inline-flex w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 p-1">
                            {tabs.map((tab) => {
                              const activa = tab.key === tabSeleccionada;
                              return (
                                <button
                                  key={tab.key}
                                  type="button"
                                  onClick={() => setServiciosTabActiva(tab.key)}
                                  className={`px-3 py-2 text-xs sm:text-sm rounded-lg transition-all border ${
                                    activa
                                      ? 'bg-white/20 text-white border-white/30'
                                      : 'bg-transparent text-gray-300 border-transparent hover:bg-white/10'
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {renderTablaServicios(tabSeleccionada)}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )}

        {modalReprogramar.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-white/5">
                <div>
                  <h3 className="text-lg font-bold text-white">Reprogramar Mantenimiento</h3>
                  <p className="text-xs text-gray-400">
                    Folio #{String(modalReprogramar.folio || 0).padStart(4, '0')} · {modalReprogramar.vehiculo}
                  </p>
                </div>
                <button
                  onClick={handleCerrarModalReprogramar}
                  disabled={modalReprogramar.loading}
                  className="p-2 rounded-lg hover:bg-white/10 text-gray-300 disabled:opacity-60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <p className="text-xs text-gray-400">Servicio</p>
                  <p className="text-white font-semibold">{modalReprogramar.tipo_servicio}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nueva Fecha</label>
                    <input
                      type="date"
                      value={modalReprogramar.fecha_programada}
                      min={today}
                      onChange={(e) =>
                        setModalReprogramar((prev) => ({
                          ...prev,
                          fecha_programada: e.target.value,
                          hora_programada: ''
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white border border-white/20 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nueva Hora</label>
                    <select
                      value={modalReprogramar.hora_programada}
                      onChange={(e) => setModalReprogramar((prev) => ({ ...prev, hora_programada: e.target.value }))}
                      disabled={!modalReprogramar.fecha_programada || cargandoSlotsReprogramacion || modalReprogramar.loading}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-white/20 text-slate-900"
                    >
                      <option value="">
                        {modalReprogramar.fecha_programada ? 'Selecciona un horario' : 'Primero selecciona fecha'}
                      </option>
                      {(slotsReprogramacion.length > 0
                        ? slotsReprogramacion
                        : HALF_HOUR_SLOTS.map((hora) => ({ hora, disponible: true }))
                      ).map((slot) => (
                        <option key={slot.hora} value={slot.hora}>
                          {slot.hora}
                          {!slot.disponible ? ' - Ocupado' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Bloques de 30 minutos. Horarios ocupados se pueden forzar con advertencia.
                    </p>
                    {cargandoSlotsReprogramacion && (
                      <p className="text-xs text-cyan-300 mt-1">Cargando disponibilidad...</p>
                    )}
                  </div>
                </div>

                {(() => {
                  const selectedSlot = slotsReprogramacion.find((slot) => slot.hora === modalReprogramar.hora_programada);
                  if (!selectedSlot || selectedSlot.disponible) return null;
                  return (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                      <p className="text-amber-200 text-sm font-semibold">
                        El horario seleccionado ya esta ocupado.
                      </p>
                      <label className="mt-2 flex items-center gap-2 text-xs text-amber-100">
                        <input
                          type="checkbox"
                          checked={Boolean(modalReprogramar.forzar_horario_ocupado)}
                          onChange={(e) =>
                            setModalReprogramar((prev) => ({
                              ...prev,
                              forzar_horario_ocupado: e.target.checked
                            }))
                          }
                        />
                        Permitir sobrecupo y guardar de todos modos
                      </label>
                    </div>
                  );
                })()}

                <p className="text-xs text-gray-500">
                  Se validan permisos, horario, domingo y traslapes antes de guardar.
                </p>
              </div>

              <div className="flex justify-end gap-2 px-3 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-white/5">
                <button
                  onClick={handleCerrarModalReprogramar}
                  disabled={modalReprogramar.loading}
                  className="px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarReprogramacion}
                  disabled={modalReprogramar.loading}
                  className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-60"
                >
                  {modalReprogramar.loading ? 'Guardando...' : 'Guardar cambio'}
                </button>
              </div>
            </div>
          </div>
        )}
        {modalProximos30DiasOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 w-full max-w-6xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-white/5">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    Agenda de Próximos 30 Días
                  </h3>
                  <p className="text-xs text-gray-400">
                    {proximosTodos.length} mantenimientos programados
                  </p>
                </div>
                <button
                  onClick={() => setModalProximos30DiasOpen(false)}
                  className="px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/10 transition-all"
                >
                  Cerrar
                </button>
              </div>

              <div className="px-3 sm:px-6 py-4 sm:py-5 max-h-[75vh] overflow-y-auto">
                {proximosTodos.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No hay mantenimientos proximos</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-white/10 rounded-xl">
                    <table className="w-full min-w-[820px]">
                      <thead className="bg-white/5">
                        <tr className="text-left text-xs uppercase text-gray-400">
                          <th className="px-4 py-3">Días</th>
                          <th className="px-4 py-3">Vehículo</th>
                          <th className="px-4 py-3">Servicio</th>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proximosTodos.map((item) => (
                          <tr
                            key={`proximo-30-${item.id}`}
                            onClick={() => navigate('/admin/mantenimientos/lista?estado=Programado')}
                            className="border-t border-white/5 hover:bg-white/5 transition-all cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                                {item.dias_restantes}d
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-white font-semibold">{item.numero_vehiculo || '-'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-gray-200">{item.tipo_servicio || '-'}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              {formatMaintenanceDate(item.fecha_programada, { fallback: '-', month: 'short' })}
                            </td>
                            <td className="px-4 py-3 text-cyan-300 font-semibold">
                              {formatMaintenanceTime(item.fecha_programada, { fallback: '-' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {modalPorKilometraje.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-white/5">
                <div>
                  <h3 className="text-xl font-bold text-white">Vehiculos proximos por kilometraje</h3>
                  <p className="text-xs text-gray-400">
                    Umbral activo: {UMBRAL_ALERTA_KM.toLocaleString('es-MX')} km
                  </p>
                </div>
                <button
                  onClick={handleCerrarModalPorKilometraje}
                  className="px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/10 transition-all"
                >
                  Cerrar
                </button>
              </div>

              <div className="px-3 sm:px-6 py-4 sm:py-5 max-h-[70vh] overflow-y-auto">
                {modalPorKilometraje.error && (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                    {modalPorKilometraje.error}
                  </div>
                )}

                {modalPorKilometraje.loading && modalPorKilometraje.data.length === 0 ? (
                  <p className="text-gray-300 text-sm">Cargando listado...</p>
                ) : modalPorKilometraje.data.length === 0 ? (
                  <p className="text-gray-400 text-sm">No hay vehiculos dentro del umbral de kilometraje.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto border border-white/10 rounded-xl">
                      <table className="w-full min-w-[900px]">
                        <thead className="bg-white/5">
                          <tr className="text-left text-xs uppercase text-gray-400">
                            <th className="px-4 py-3">Vehiculo</th>
                            <th className="px-4 py-3">Conductor</th>
                            <th className="px-4 py-3">KM actual</th>
                            <th className="px-4 py-3">Proximo servicio</th>
                            <th className="px-4 py-3">Diferencia</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3 text-right">Accion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalPorKilometraje.data.map((item) => (
                            <tr key={`modal-km-${item.vehiculo_id}`} className="border-t border-white/5">
                              <td className="px-4 py-3">
                                <p className="text-white font-semibold">{item.numero_vehiculo || '-'}</p>
                                <p className="text-gray-400 text-xs">{item.marca || '-'} {item.modelo || '-'}</p>
                                <p className="text-gray-500 text-xs">{item.placa || '-'}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-gray-200">{item.nombre_conductor || 'Sin conductor activo'}</p>
                                <p className="text-gray-500 text-xs">{item.conductor_telefono || '-'}</p>
                              </td>
                              <td className="px-4 py-3 text-white font-semibold">
                                {Number(item.kilometraje_actual || 0).toLocaleString('es-MX')} km
                              </td>
                              <td className="px-4 py-3 text-gray-200">
                                {Number(item.hito_objetivo_km || 0).toLocaleString('es-MX')} km
                              </td>
                              <td className="px-4 py-3">
                                {Number(item.km_restantes || 0) >= 0 ? (
                                  <span className="text-amber-300 font-semibold">
                                    Faltan {Number(item.km_restantes || 0).toLocaleString('es-MX')} km
                                  </span>
                                ) : (
                                  <span className="text-red-300 font-semibold">
                                    Excedido por {Math.abs(Number(item.km_restantes || 0)).toLocaleString('es-MX')} km
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                                    String(item.estado_alerta || '').toLowerCase() === 'vencido'
                                      ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  }`}
                                >
                                  {item.estado_alerta || 'Proximo'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => handleAgendarMantenimiento(item.vehiculo_id, e)}
                                  className="px-3 py-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 text-xs font-semibold"
                                >
                                  Agendar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">
                        Mostrando {modalPorKilometraje.data.length} de {Number(modalPorKilometraje.pagination?.total || 0)} vehiculos
                      </p>
                      {Number(modalPorKilometraje.pagination?.page || 1) < Number(modalPorKilometraje.pagination?.totalPages || 1) && (
                        <button
                          type="button"
                          onClick={handleVerMasModalPorKilometraje}
                          disabled={modalPorKilometraje.loading}
                          className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {modalPorKilometraje.loading ? 'Cargando...' : 'Ver mas'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/*  MODAL DE INFORMACIN DETALLADA */}
        {modalDetalle.open && modalDetalle.data && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              
              {/* Header del Modal */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 sm:p-6 flex justify-between items-center border-b border-white/10 gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Info className="w-5 h-5 text-blue-400" />
                    Detalle de Cita #{String(modalDetalle.data.folio_servicio || '0').padStart(4, '0')}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Estado: <span className="text-white font-medium">{modalDetalle.data.estado}</span>
                  </p>
                </div>
                <button
                  onClick={() => setModalDetalle({ open: false, data: null })}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Contenido del Modal */}
              <div className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                
                {/* Info Vehículo */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Vehículo</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Unidad</p>
                      <p className="text-white font-medium text-lg">{modalDetalle.data.numero_vehiculo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Modelo</p>
                      <p className="text-white">{modalDetalle.data.marca} {modalDetalle.data.modelo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Placa</p>
                      <p className="text-white bg-black/30 px-2 py-1 rounded inline-block font-mono text-sm">
                        {modalDetalle.data.placa}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Info Servicio */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Servicio Programado</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Tipo de Servicio</p>
                      <p className="text-blue-400 font-medium text-lg">{modalDetalle.data.tipo_servicio}</p>
                    </div>
                    {getKilometrajeObjetivoServicio(modalDetalle.data) && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Kilometraje del servicio a realizar</p>
                        <p className="text-amber-300 font-semibold">
                          Servicio de {getKilometrajeObjetivoServicio(modalDetalle.data)}
                        </p>
                      </div>
                    )}
                    {getKilometrajeActualVehiculo(modalDetalle.data) && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Kilometraje actual del vehiculo</p>
                        <p className="text-emerald-300 font-semibold">
                          {getKilometrajeActualVehiculo(modalDetalle.data)}
                        </p>
                      </div>
                    )}
                    {parseServiciosEspeciales(modalDetalle.data.servicio_especial).length > 0 && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 mb-2">Servicios especiales</p>
                        <div className="flex flex-wrap gap-2">
                          {parseServiciosEspeciales(modalDetalle.data.servicio_especial).map((servicio, index) => (
                            <span
                              key={`${servicio}-${index}`}
                              className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 border border-cyan-400/30 text-cyan-200"
                            >
                              {servicio}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Fecha Programada</p>
                      <p className="text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatMaintenanceDate(modalDetalle.data.fecha_programada, {
                          fallback: '-',
                          month: 'long',
                          withWeekday: true
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Hora</p>
                      <p className="text-white flex items-center gap-2">
                         <Clock className="w-4 h-4 text-gray-400" />
                         {formatMaintenanceTime(modalDetalle.data.fecha_programada, { fallback: '-' })}
                      </p>
                    </div>
                     <div>
                      <p className="text-xs text-gray-500">Taller Asignado</p>
                     <p className="text-white">{modalDetalle.data.taller || 'No especificado'}</p>
                    </div>
                  </div>
                </div>

                {Array.isArray(modalDetalle.data.adjuntos_admin) && modalDetalle.data.adjuntos_admin.length > 0 && (
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Adjuntos del Admin
                    </h3>
                    <div className="space-y-2">
                      {modalDetalle.data.adjuntos_admin.map((adjunto, index) => (
                        <a
                          key={`${adjunto.url}-${index}`}
                          href={adjunto.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/20 transition-all text-sm"
                        >
                          {adjunto.original_name || `Adjunto ${index + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info Conductor */}
                {modalDetalle.data.nombre_conductor && (
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Conductor</h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">{modalDetalle.data.nombre_conductor}</p>
                        <p className="text-gray-400 text-sm">{modalDetalle.data.numero_telefono || 'Sin teléfono'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Modal */}
              <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
                <button
                  onClick={() => setModalDetalle({ open: false, data: null })}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default MantenimientosDashboard;








