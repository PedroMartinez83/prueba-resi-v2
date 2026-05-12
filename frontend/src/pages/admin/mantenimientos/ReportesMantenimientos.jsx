import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Calendar, Wrench, 
  Download, Filter, BarChart3, PieChart, FileText, ArrowLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // CAMBIO AQUI
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '@/services/api';
import { formatMaintenanceDate } from '@/utils/maintenanceDateFormat';

const ReportesMantenimientos = () => {
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    vehiculo_id: '',
    tipo: ''
  });

  const [reporteCostos, setReporteCostos] = useState(null);
  const [frecuencia, setFrecuencia] = useState([]);
  const [vehiculosMasCostosos, setVehiculosMasCostosos] = useState([]);
  const [vehiculosMenosCostosos, setVehiculosMenosCostosos] = useState([]);
  const [vehiculosMasCostososCompleto, setVehiculosMasCostososCompleto] = useState([]);
  const [vehiculosMenosCostososCompleto, setVehiculosMenosCostososCompleto] = useState([]);
  const [tabVehiculos, setTabVehiculos] = useState('mas');
  const [mostrarCompleto, setMostrarCompleto] = useState({ mas: false, menos: false });
  const [cargandoListadoCompleto, setCargandoListadoCompleto] = useState(false);
  const [mostrarTodosTipos, setMostrarTodosTipos] = useState(false);
  const [comparativa, setComparativa] = useState(null);
  const [talleres, setTalleres] = useState([]);
  const [errorCarga, setErrorCarga] = useState('');

  useEffect(() => {
    cargarReportes();
  }, []);

  const construirQueryString = (extras = {}) => {
    const params = new URLSearchParams();
    if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
    if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
    if (filtros.vehiculo_id) params.append('vehiculo_id', filtros.vehiculo_id);
    if (filtros.tipo) params.append('tipo', filtros.tipo);
    Object.entries(extras).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    return params.toString();
  };

  const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchJsonSeguro = async (url, headers, intentos = 3) => {
    let ultimoError = null;

    for (let intento = 1; intento <= intentos; intento += 1) {
      const response = await fetch(url, { headers });
      const refreshedToken = response.headers.get('x-refreshed-token');
      if (refreshedToken) {
        localStorage.setItem('token', refreshedToken);
        headers.Authorization = `Bearer ${refreshedToken}`;
      }
      const data = await response.json().catch(() => null);

      if (response.ok) return data;

      const error = new Error(data?.message || `Error HTTP ${response.status}`);
      error.status = response.status;
      ultimoError = error;

      // Reintento con backoff para evitar saturar rate-limit en /api/admin
      if (response.status === 429 && intento < intentos) {
        await esperar(500 * intento);
        continue;
      }

      throw error;
    }

    throw ultimoError || new Error('Error de red');
  };

  const obtenerVehiculosPorCosto = async ({ orden = 'desc', completo = false, limite = 10, headers }) => {
    const queryString = construirQueryString({
      orden,
      ...(completo ? { completo: true } : { limite })
    });
    return fetchJsonSeguro(`${API_BASE_URL}/admin/mantenimientos/reportes/vehiculos-costosos?${queryString}`, headers);
  };

  const cargarReportes = async () => {
    setLoading(true);
    setErrorCarga('');
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const queryString = construirQueryString();

      // Carga secuencial para no disparar demasiadas requests simultáneas (evita 429)
      const costos = await fetchJsonSeguro(`${API_BASE_URL}/admin/mantenimientos/reportes/costos?${queryString}`, headers);
      const freq = await fetchJsonSeguro(`${API_BASE_URL}/admin/mantenimientos/reportes/frecuencia?${queryString}`, headers);
      const vehiculosMas = await obtenerVehiculosPorCosto({ orden: 'desc', limite: 10, headers });
      const vehiculosMenos = await obtenerVehiculosPorCosto({ orden: 'asc', limite: 10, headers });
      const comp = await fetchJsonSeguro(`${API_BASE_URL}/admin/mantenimientos/reportes/comparativa?${queryString}`, headers);
      const tall = await fetchJsonSeguro(`${API_BASE_URL}/admin/mantenimientos/reportes/talleres?${queryString}`, headers);

      setReporteCostos(costos);
      setFrecuencia(freq);
      setVehiculosMasCostosos(Array.isArray(vehiculosMas) ? vehiculosMas : []);
      setVehiculosMenosCostosos(Array.isArray(vehiculosMenos) ? vehiculosMenos : []);
      setVehiculosMasCostososCompleto([]);
      setVehiculosMenosCostososCompleto([]);
      setMostrarCompleto({ mas: false, menos: false });
      setTabVehiculos('mas');
      setMostrarTodosTipos(false);
      setComparativa(comp);
      setTalleres(tall);

    } catch (error) {
      console.error('Error al cargar reportes:', error);
      setReporteCostos(null);
      setFrecuencia([]);
      setVehiculosMasCostosos([]);
      setVehiculosMenosCostosos([]);
      setVehiculosMasCostososCompleto([]);
      setVehiculosMenosCostososCompleto([]);
      setComparativa(null);
      setTalleres([]);
      setErrorCarga(
        error?.status === 401
          ? 'Tu sesión expiró o no está autorizada para esta sección. Cierra sesión e ingresa de nuevo.'
          : error?.status === 429
            ? 'Se excedió temporalmente el límite de peticiones. Espera unos segundos y vuelve a intentar.'
          : 'No se pudieron cargar los reportes en este momento.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = () => {
    cargarReportes();
  };

  const handleVerMasVehiculos = async (tipo) => {
    if (mostrarCompleto[tipo]) {
      setMostrarCompleto((prev) => ({ ...prev, [tipo]: false }));
      return;
    }

    const yaTieneListado = tipo === 'mas'
      ? vehiculosMasCostososCompleto.length > 0
      : vehiculosMenosCostososCompleto.length > 0;

    if (yaTieneListado) {
      setMostrarCompleto((prev) => ({ ...prev, [tipo]: true }));
      return;
    }

    try {
      setCargandoListadoCompleto(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const data = await obtenerVehiculosPorCosto({
        orden: tipo === 'mas' ? 'desc' : 'asc',
        completo: true,
        headers
      });

      if (tipo === 'mas') {
        setVehiculosMasCostososCompleto(Array.isArray(data) ? data : []);
      } else {
        setVehiculosMenosCostososCompleto(Array.isArray(data) ? data : []);
      }
      setMostrarCompleto((prev) => ({ ...prev, [tipo]: true }));
    } catch (error) {
      console.error('Error al cargar listado completo de vehiculos:', error);
    } finally {
      setCargandoListadoCompleto(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value || 0);
  };

  const formatDate = (date) => {
    return formatMaintenanceDate(date, { fallback: '-' });
  };

  // ========================================
// EXPORTAR A EXCEL (CSV)
// ========================================
const exportarExcel = async () => {
  if (!reporteCostos || (vehiculosMasCostosos.length === 0 && vehiculosMenosCostosos.length === 0)) {
    alert('No hay datos para exportar');
    return;
  }

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  const obtenerListadoExcel = async (tipo) => {
    const esMas = tipo === 'mas';
    const mostrarTodo = esMas ? mostrarCompleto.mas : mostrarCompleto.menos;
    const listadoTop = esMas ? vehiculosMasCostosos : vehiculosMenosCostosos;
    const listadoCompleto = esMas ? vehiculosMasCostososCompleto : vehiculosMenosCostososCompleto;

    if (!mostrarTodo) return listadoTop;
    if (listadoCompleto.length > 0) return listadoCompleto;

    const data = await obtenerVehiculosPorCosto({
      orden: esMas ? 'desc' : 'asc',
      completo: true,
      headers
    });

    return Array.isArray(data) ? data : [];
  };

  const [listadoMasExcel, listadoMenosExcel] = await Promise.all([
    obtenerListadoExcel('mas'),
    obtenerListadoExcel('menos')
  ]);

  const workbook = XLSX.utils.book_new();
  const rows = [];
  const merges = [];

  const addRow = (row) => {
    rows.push(row);
    return rows.length - 1;
  };

  const addSectionTitle = (title, endCol = 8) => {
    const rowIdx = addRow([title]);
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: endCol } });
    addRow([]);
  };

  addSectionTitle('REPORTE DE MANTENIMIENTOS');
  addRow(['Generado', formatDate(new Date())]);
  if (filtros.fecha_inicio && filtros.fecha_fin) {
    addRow(['Periodo', `${formatDate(filtros.fecha_inicio)} - ${formatDate(filtros.fecha_fin)}`]);
  }
  addRow([]);

  addSectionTitle('RESUMEN GENERAL');
  addRow(['Concepto', 'Valor']);
  const resumenStart = rows.length;
  addRow(['Total de Mantenimientos', Number(reporteCostos.resumen.total_mantenimientos || 0)]);
  addRow(['Costo Total Real', Number(reporteCostos.resumen.total_real || 0)]);
  addRow(['Costo Total Estimado', Number(reporteCostos.resumen.total_estimado || 0)]);
  addRow(['Promedio por Servicio', Number(reporteCostos.resumen.promedio_real || 0)]);
  addRow(['Costo Maximo', Number(reporteCostos.resumen.costo_maximo || 0)]);
  addRow(['Costo Minimo', Number(reporteCostos.resumen.costo_minimo || 0)]);
  const resumenEnd = rows.length - 1;
  addRow([]);

  addSectionTitle('DESGLOSE POR TIPO');
  addRow(['Tipo', 'Cantidad', 'Total']);
  const desgloseStart = rows.length;
  (reporteCostos.desglose_por_tipo || []).forEach((tipo) => {
    addRow([
      tipo.tipo_mantenimiento,
      Number(tipo.cantidad || 0),
      Number(tipo.total || 0)
    ]);
  });
  const desgloseEnd = rows.length - 1;
  addRow([]);

  const addVehiculosBlock = (titulo, listado) => {
    addSectionTitle(titulo);
    addRow(['#', 'ID Vehiculo', 'Marca', 'Modelo', 'Ano', 'Conductor', 'Mantenimientos', 'Costo Total', 'Promedio']);
    const start = rows.length;
    listado.forEach((v, index) => {
      addRow([
        index + 1,
        v.numero_vehiculo || 'N/A',
        v.marca || 'N/A',
        v.modelo || 'N/A',
        v.anio || 'N/A',
        v.nombre_conductor || 'Sin asignar',
        Number(v.total_mantenimientos || 0),
        Number(v.costo_total || 0),
        Number(v.costo_promedio || 0)
      ]);
    });
    const end = rows.length - 1;
    addRow([]);
    return { start, end };
  };

  const bloqueMas = addVehiculosBlock(
    mostrarCompleto.mas ? 'LISTADO COMPLETO VEHICULOS MAS COSTOSOS' : 'TOP 10 VEHICULOS MAS COSTOSOS',
    listadoMasExcel
  );

  const bloqueMenos = addVehiculosBlock(
    mostrarCompleto.menos ? 'LISTADO COMPLETO VEHICULOS MENOS COSTOSOS' : 'TOP 10 VEHICULOS MENOS COSTOSOS',
    listadoMenosExcel
  );

  let talleresStart = -1;
  let talleresEnd = -1;
  if (talleres.length > 0) {
    addSectionTitle('ANALISIS POR TALLER');
    addRow(['Taller', 'Servicios', 'Facturacion', 'Ticket Promedio', 'Completados']);
    talleresStart = rows.length;
    talleres.forEach((t) => {
      addRow([
        t.taller || 'N/A',
        Number(t.total_servicios || 0),
        Number(t.facturacion_total || 0),
        Number(t.ticket_promedio || 0),
        Number(t.completados || 0)
      ]);
    });
    talleresEnd = rows.length - 1;
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 6 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 10 },
    { wch: 32 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 }
  ];

  const applyCurrency = (rowStart, rowEnd, cols) => {
    if (rowStart < 0 || rowEnd < rowStart) return;
    for (let r = rowStart; r <= rowEnd; r += 1) {
      cols.forEach((c) => {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref] && typeof ws[ref].v === 'number') {
          ws[ref].z = '$#,##0.00';
        }
      });
    }
  };

  applyCurrency(resumenStart, resumenEnd, [1]);
  applyCurrency(desgloseStart, desgloseEnd, [2]);
  applyCurrency(bloqueMas.start, bloqueMas.end, [7, 8]);
  applyCurrency(bloqueMenos.start, bloqueMenos.end, [7, 8]);
  applyCurrency(talleresStart, talleresEnd, [2, 3]);

  XLSX.utils.book_append_sheet(workbook, ws, 'Reporte');

  const fecha = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `reporte_mantenimientos_${fecha}.xlsx`);
};

  // ========================================
// EXPORTAR A PDF
// ========================================
const exportarPDF = async () => {
  if (!reporteCostos || (vehiculosMasCostosos.length === 0 && vehiculosMenosCostosos.length === 0)) {
    alert('No hay datos para exportar');
    return;
  }

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  const obtenerListadoPDF = async (tipo) => {
    const esMas = tipo === 'mas';
    const mostrarTodo = esMas ? mostrarCompleto.mas : mostrarCompleto.menos;
    const listadoTop = esMas ? vehiculosMasCostosos : vehiculosMenosCostosos;
    const listadoCompleto = esMas ? vehiculosMasCostososCompleto : vehiculosMenosCostososCompleto;

    if (!mostrarTodo) return listadoTop;
    if (listadoCompleto.length > 0) return listadoCompleto;

    const data = await obtenerVehiculosPorCosto({
      orden: esMas ? 'desc' : 'asc',
      completo: true,
      headers
    });

    return Array.isArray(data) ? data : [];
  };

  const [listadoMasPDF, listadoMenosPDF] = await Promise.all([
    obtenerListadoPDF('mas'),
    obtenerListadoPDF('menos')
  ]);

  const doc = new jsPDF();
  let yPos = 20;

  // ENCABEZADO
  doc.setFontSize(20);
  doc.setTextColor(31, 41, 55);
  doc.text('REPORTE DE MANTENIMIENTOS', 105, yPos, { align: 'center' });

  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Generado: ${formatDate(new Date())}`, 105, yPos, { align: 'center' });

  if (filtros.fecha_inicio && filtros.fecha_fin) {
    yPos += 5;
    doc.text(`Periodo: ${formatDate(filtros.fecha_inicio)} - ${formatDate(filtros.fecha_fin)}`, 105, yPos, { align: 'center' });
  }

  yPos += 10;
  doc.setDrawColor(229, 231, 235);
  doc.line(20, yPos, 190, yPos);
  yPos += 10;

  // RESUMEN GENERAL
  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55);
  doc.text('RESUMEN GENERAL', 20, yPos);
  yPos += 8;

  const resumenData = [
    ['Total de Mantenimientos', reporteCostos.resumen.total_mantenimientos],
    ['Costo Total Real', formatCurrency(reporteCostos.resumen.total_real)],
    ['Costo Total Estimado', formatCurrency(reporteCostos.resumen.total_estimado)],
    ['Promedio por Servicio', formatCurrency(reporteCostos.resumen.promedio_real)],
    ['Costo Maximo', formatCurrency(reporteCostos.resumen.costo_maximo)],
    ['Costo Minimo', formatCurrency(reporteCostos.resumen.costo_minimo)]
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Concepto', 'Valor']],
    body: resumenData,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [55, 65, 81]
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    margin: { left: 20, right: 20 }
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // DESGLOSE POR TIPO
  if (reporteCostos.desglose_por_tipo && reporteCostos.desglose_por_tipo.length > 0) {
    doc.setFontSize(14);
    doc.text('DESGLOSE POR TIPO', 20, yPos);
    yPos += 8;

    const desgloseData = reporteCostos.desglose_por_tipo.map(tipo => [
      tipo.tipo_mantenimiento.charAt(0).toUpperCase() + tipo.tipo_mantenimiento.slice(1),
      tipo.cantidad,
      formatCurrency(tipo.total)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Tipo', 'Cantidad', 'Total']],
      body: desgloseData,
      theme: 'grid',
      headStyles: {
        fillColor: [168, 85, 247],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 20, right: 20 }
    });

    yPos = doc.lastAutoTable.finalY + 15;
  }

  const agregarTablaVehiculos = (titulo, vehiculos, color) => {
    if (!vehiculos.length) return;

    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text(titulo, 20, yPos);
    yPos += 8;

    const vehiculosData = vehiculos.map((v, i) => [
      i + 1,
      v.numero_vehiculo || 'N/A',
      `${v.marca || ''} ${v.modelo || ''} ${v.anio || ''}`.trim() || 'Sin datos',
      v.nombre_conductor || 'Sin asignar',
      v.total_mantenimientos,
      formatCurrency(v.costo_total)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'ID Vehiculo', 'Marca/Modelo/Ano', 'Conductor', 'Mant.', 'Costo Total']],
      body: vehiculosData,
      theme: 'striped',
      headStyles: {
        fillColor: color,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 45 },
        3: { cellWidth: 50 },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 20, right: 20 }
    });

    yPos = doc.lastAutoTable.finalY + 15;
  };

  agregarTablaVehiculos(
    mostrarCompleto.mas ? 'LISTADO COMPLETO VEHICULOS MAS COSTOSOS' : 'TOP 10 VEHICULOS MAS COSTOSOS',
    listadoMasPDF,
    [239, 68, 68]
  );

  agregarTablaVehiculos(
    mostrarCompleto.menos ? 'LISTADO COMPLETO VEHICULOS MENOS COSTOSOS' : 'TOP 10 VEHICULOS MENOS COSTOSOS',
    listadoMenosPDF,
    [16, 185, 129]
  );

  // ANALISIS POR TALLER
  if (talleres && talleres.length > 0) {
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('ANALISIS POR TALLER', 20, yPos);
    yPos += 8;

    const talleresData = talleres.map(t => [
      t.taller,
      t.total_servicios,
      formatCurrency(t.facturacion_total),
      formatCurrency(t.ticket_promedio),
      t.completados
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Taller', 'Servicios', 'Facturacion', 'Ticket Prom.', 'Completados']],
      body: talleresData,
      theme: 'striped',
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 25, halign: 'center' }
      },
      margin: { left: 20, right: 20 }
    });
  }

  // PIE DE PAGINA
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Pagina ${i} de ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
    doc.text(
      'Sistema de Gestion de Mantenimientos',
      20,
      290
    );
  }

  // Guardar
  doc.save(`reporte_mantenimientos_${new Date().toISOString().split('T')[0]}.pdf`);
};

  const hayDatosVehiculos = vehiculosMasCostosos.length > 0 || vehiculosMenosCostosos.length > 0;
  const desgloseAgrupado = Object.values(
    (reporteCostos?.desglose_por_tipo || []).reduce((acc, tipo) => {
      const descripcionOriginal = String(tipo?.tipo_mantenimiento || '').trim();
      const descripcion = descripcionOriginal || 'Sin especificar';
      const clave = descripcion
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!acc[clave]) {
        acc[clave] = {
          tipo_mantenimiento: descripcion,
          cantidad: 0,
          total: 0
        };
      }

      acc[clave].cantidad += Number(tipo?.cantidad || 0);
      acc[clave].total += Number(tipo?.total || 0);
      return acc;
    }, {})
  ).sort((a, b) => {
    if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
    return b.total - a.total;
  });
  const hayMasTipos = desgloseAgrupado.length > 6;
  const desgloseVisible = mostrarTodosTipos ? desgloseAgrupado : desgloseAgrupado.slice(0, 6);
  const vehiculosTabla = tabVehiculos === 'menos'
    ? (mostrarCompleto.menos ? vehiculosMenosCostososCompleto : vehiculosMenosCostosos)
    : (mostrarCompleto.mas ? vehiculosMasCostososCompleto : vehiculosMasCostosos);
  const textoTablaVehiculos = tabVehiculos === 'menos' ? 'Menos Costosos' : 'Más Costosos';
  const mostrandoListadoCompleto = tabVehiculos === 'menos' ? mostrarCompleto.menos : mostrarCompleto.mas;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Generando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-1 p-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-all"
            title="Regresar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Reportes de Mantenimientos</h1>
            <p className="text-sm sm:text-base text-gray-300 mt-1">Análisis detallado de costos y frecuencias</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full lg:w-auto">
          <button 
            onClick={exportarExcel}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/90 text-white rounded-lg hover:bg-emerald-500 transition-colors border border-emerald-300/20 w-full"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button 
            onClick={exportarPDF}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/90 text-white rounded-lg hover:bg-rose-500 transition-colors border border-rose-300/20 w-full"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={filtros.fecha_inicio}
              onChange={(e) => setFiltros({...filtros, fecha_inicio: e.target.value})}
              className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white focus:ring-2 focus:ring-cyan-400/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={filtros.fecha_fin}
              onChange={(e) => setFiltros({...filtros, fecha_fin: e.target.value})}
              className="w-full px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white focus:ring-2 focus:ring-cyan-400/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tipo
            </label>
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}
              style={{ colorScheme: 'dark' }}
              className="w-full px-3 py-2 border border-white/20 rounded-lg bg-slate-900/80 text-white focus:ring-2 focus:ring-cyan-400/40 focus:outline-none"
            >
              <option value="" style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>Todos</option>
              <option value="preventivo" style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>Preventivo</option>
              <option value="correctivo" style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>Correctivo</option>
              <option value="revision" style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }}>Revision</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFiltrar}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-400 hover:to-cyan-400 border border-cyan-300/20"
            >
              <Filter className="w-5 h-5" />
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* Resumen de Costos */}
      {errorCarga && (
        <div className="bg-rose-500/10 border border-rose-400/30 text-rose-100 px-4 py-3 rounded-lg">
          {errorCarga}
        </div>
      )}

      {reporteCostos?.resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-500/95 to-cyan-500/95 p-4 sm:p-6 rounded-lg shadow-lg border border-white/10 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Mantenimientos</p>
                <p className="text-2xl sm:text-3xl font-bold mt-2">{reporteCostos.resumen.total_mantenimientos}</p>
              </div>
              <Wrench className="w-9 h-9 sm:w-12 sm:h-12 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/95 to-teal-500/95 p-4 sm:p-6 rounded-lg shadow-lg border border-white/10 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Costo Total Real</p>
                <p className="text-xl sm:text-2xl font-bold mt-2">{formatCurrency(reporteCostos.resumen.total_real)}</p>
              </div>
              <DollarSign className="w-9 h-9 sm:w-12 sm:h-12 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-500/95 to-purple-500/95 p-4 sm:p-6 rounded-lg shadow-lg border border-white/10 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Promedio por Servicio</p>
                <p className="text-xl sm:text-2xl font-bold mt-2">{formatCurrency(reporteCostos.resumen.promedio_real)}</p>
              </div>
              <TrendingUp className="w-9 h-9 sm:w-12 sm:h-12 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500/95 to-orange-500/95 p-4 sm:p-6 rounded-lg shadow-lg border border-white/10 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Costo Máximo</p>
                <p className="text-xl sm:text-2xl font-bold mt-2">{formatCurrency(reporteCostos.resumen.costo_maximo)}</p>
              </div>
              <BarChart3 className="w-9 h-9 sm:w-12 sm:h-12 text-orange-200" />
            </div>
          </div>
        </div>
      )}

      {/* Desglose por Tipo */}
      {reporteCostos && desgloseAgrupado.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 sm:p-6 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-6 h-6 text-cyan-400" />
            Desglose por Tipo de Mantenimiento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {desgloseVisible.map((tipo, index) => (
              <div key={index} className="border border-white/10 bg-white/5 rounded-lg p-4">
                <h3 className="font-semibold text-white capitalize">{tipo.tipo_mantenimiento}</h3>
                <p className="text-sm text-gray-300">Cantidad: {tipo.cantidad}</p>
                <p className="text-lg font-bold text-emerald-400 mt-2">{formatCurrency(tipo.total)}</p>
              </div>
            ))}
          </div>
          {hayMasTipos && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setMostrarTodosTipos((prev) => !prev)}
                className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-all"
              >
                {mostrarTodosTipos ? 'Ver menos' : 'Ver mas'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top Vehiculos por Costo */}
      {hayDatosVehiculos && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              {mostrandoListadoCompleto ? 'Listado Completo' : 'Top 10'} Vehiculos {textoTablaVehiculos}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTabVehiculos('mas')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  tabVehiculos === 'mas'
                    ? 'bg-orange-500/20 border-orange-400/40 text-orange-200'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                Mas costosos
              </button>
              <button
                type="button"
                onClick={() => setTabVehiculos('menos')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  tabVehiculos === 'menos'
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                Menos costosos
              </button>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {vehiculosTabla.map((vehiculo, index) => (
              <div key={`vehiculo-mobile-${tabVehiculos}-${vehiculo.id}-${index}`} className="p-3 rounded-lg border border-white/10 bg-white/5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-400">#{index + 1} · {vehiculo.numero_vehiculo || 'N/A'}</p>
                    <p className="text-white font-semibold">{vehiculo.marca || 'N/A'} {vehiculo.modelo || 'N/A'}</p>
                    <p className="text-gray-400 text-xs">Año: {vehiculo.anio || 'N/A'}</p>
                    <p className="text-gray-300 text-xs">Conductor: {vehiculo.nombre_conductor || 'Sin asignar'}</p>
                  </div>
                  <span className="text-xs text-gray-300">{vehiculo.total_mantenimientos} serv.</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={`font-semibold ${tabVehiculos === 'menos' ? 'text-emerald-300' : 'text-orange-300'}`}>
                    {formatCurrency(vehiculo.costo_total)}
                  </span>
                  <span className="text-gray-300">Prom: {formatCurrency(vehiculo.costo_promedio)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-auto max-h-[60vh] sidebar-scroll border border-white/5 rounded-lg">
            <table className="w-full min-w-[1000px] relative mantenimiento-report-table">
              <thead className="bg-[#1a1a2e] sticky top-0 z-10 shadow-sm border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">#</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">ID Vehiculo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Marca/Modelo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Ano</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Conductor Asignado</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Mantenimientos</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Costo Total</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {vehiculosTabla.map((vehiculo, index) => (
                  <tr key={`${tabVehiculos}-${vehiculo.id}-${index}`} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-sm font-medium text-gray-200">{index + 1}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-bold text-cyan-400">{vehiculo.numero_vehiculo || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">
                      <div className="font-semibold">{vehiculo.marca || 'N/A'}</div>
                      <div className="text-xs text-gray-400">{vehiculo.modelo || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{vehiculo.anio || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {vehiculo.nombre_conductor || <span className="text-amber-300 italic">Sin asignar</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-200">{vehiculo.total_mantenimientos}</td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${tabVehiculos === 'menos' ? 'text-emerald-300' : 'text-orange-300'}`}>
                      {formatCurrency(vehiculo.costo_total)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">{formatCurrency(vehiculo.costo_promedio)}</td>
                  </tr>
                ))}
                {!vehiculosTabla.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                      No hay datos para mostrar en esta pestana.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => handleVerMasVehiculos(tabVehiculos)}
              disabled={cargandoListadoCompleto}
              className="px-4 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cargandoListadoCompleto ? 'Cargando...' : (mostrandoListadoCompleto ? 'Ver menos' : 'Ver mas')}
            </button>
          </div>
        </div>
      )}
      {comparativa && comparativa.estadisticas && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 sm:p-6 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-4">
            Análisis: Estimado vs Real
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="border border-blue-400/20 rounded-lg p-4 bg-blue-500/10">
              <p className="text-sm text-gray-300">Diferencia Promedio</p>
              <p className="text-2xl font-bold text-cyan-400">
                {formatCurrency(comparativa.estadisticas.diferencia_promedio)}
              </p>
            </div>
            <div className="border border-emerald-400/20 rounded-lg p-4 bg-emerald-500/10">
              <p className="text-sm text-gray-300">Dentro de Presupuesto</p>
              <p className="text-2xl font-bold text-emerald-300">
                {comparativa.estadisticas.dentro_presupuesto}
              </p>
            </div>
            <div className="border border-rose-400/20 rounded-lg p-4 bg-rose-500/10">
              <p className="text-sm text-gray-300">Sobrepasados</p>
              <p className="text-2xl font-bold text-rose-300">
                {comparativa.estadisticas.sobrepasados}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Análisis por Taller */}
      {talleres.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 sm:p-6 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-4">
            Análisis por Taller
          </h2>
          <div className="md:hidden space-y-3">
            {talleres.map((taller, index) => (
              <div key={`taller-mobile-${index}`} className="p-3 rounded-lg border border-white/10 bg-white/5">
                <p className="text-white font-semibold">{taller.taller}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <p className="text-gray-300">Servicios: <span className="text-white">{taller.total_servicios}</span></p>
                  <p className="text-gray-300 text-right">Completados: <span className="text-blue-300">{taller.completados}</span></p>
                  <p className="text-gray-300">Facturación: <span className="text-emerald-300">{formatCurrency(taller.facturacion_total)}</span></p>
                  <p className="text-gray-300 text-right">Ticket: <span className="text-white">{formatCurrency(taller.ticket_promedio)}</span></p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full mantenimiento-report-table">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Taller</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Servicios</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Facturación</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Ticket Promedio</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Completados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {talleres.map((taller, index) => (
                  <tr key={index} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-sm font-medium text-gray-200">{taller.taller}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-200">{taller.total_servicios}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-300">
                      {formatCurrency(taller.facturacion_total)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {formatCurrency(taller.ticket_promedio)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-blue-300">{taller.completados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportesMantenimientos;


