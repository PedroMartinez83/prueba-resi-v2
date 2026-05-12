import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Home,
  CreditCard,
  FileText,
  TrendingUp,
  Download,
  Calendar,
  FileSpreadsheet,
  FileBarChart,
  AlertTriangle 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import RentasPDFReport from '../../../components/reportes/RentasPDFReport';
import RezagoPDFReport from '../../../components/reportes/RezagoPDFReport'; // <-- NUEVO
import adminService from '../../../services/adminService';

const Reportes = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [generando, setGenerando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [datosPDF, setDatosPDF] = useState(null); 
  const [conductores, setConductores] = useState([]);
  const [cargandoConductores, setCargandoConductores] = useState(false);
  
  // Estados para Rezago
  const [datosRezago, setDatosRezago] = useState([]);
  const [cargandoRezago, setCargandoRezago] = useState(false);

  const [filtros, setFiltros] = useState({
    tipo: 'diario',
    fecha_desde: new Date().toISOString().split('T')[0],
    fecha_hasta: new Date().toISOString().split('T')[0],
    conductor_id: ''
  });

  const navegarA = (ruta) => {
    navigate(`/admin/rentas/${ruta}`);
  };

  useEffect(() => {
    const tipoQuery = searchParams.get('tipo');
    if (tipoQuery && ['diario', 'periodo', 'conductor', 'rezago'].includes(tipoQuery)) {
      setFiltros((prev) => ({
        ...prev,
        tipo: tipoQuery
      }));
    }
  }, [searchParams]);

  // Cargar Conductores
  useEffect(() => {
    let isMounted = true;
    const cargarConductores = async () => {
      try {
        setCargandoConductores(true);
        const response = await adminService.getConductores();
        if (isMounted) {
          setConductores(response?.conductores || []);
        }
      } catch (error) {
        console.error('Error al cargar conductores:', error);
        if (isMounted) setConductores([]);
      } finally {
        if (isMounted) setCargandoConductores(false);
      }
    };
    cargarConductores();
    return () => { isMounted = false; };
  }, []);

  // Limpiar PDF al cambiar filtros
  useEffect(() => {
    setDatosPDF(null);
  }, [filtros]);

  // Cargar datos de Rezago cuando se selecciona esa pestaña
  const cargarReporteRezago = async () => {
    try {
      setCargandoRezago(true);
      const data = await adminService.getReporteRezago();

      const rezagos = (Array.isArray(data) ? data : [])
        .map((asignacion) => ({
          conductor: asignacion.conductor_nombre || 'Sin nombre',
          vehiculo: asignacion.vehiculo_placa || '-',
          dias_rezago: Number(asignacion.dias_rezago || 0),
          monto_adeudado: Number(asignacion.monto_adeudado || 0)
        }))
        .filter((item) => item.dias_rezago > 0)
        .sort((a, b) => (b.dias_rezago - a.dias_rezago) || (b.monto_adeudado - a.monto_adeudado));

      setDatosRezago(rezagos);
    } catch (error) {
      console.error("Error al cargar el reporte de rezago:", error);
    } finally {
      setCargandoRezago(false);
    }
  };

  // Efecto para disparar la carga de rezago automáticamente
  useEffect(() => {
    if (filtros.tipo === 'rezago') {
      cargarReporteRezago();
    }
  }, [filtros.tipo]);


  const parametrosReporte = useMemo(() => {
    const params = {
      fecha_registro_desde: filtros.fecha_desde,
      fecha_registro_hasta: ['periodo', 'conductor'].includes(filtros.tipo)
        ? filtros.fecha_hasta
        : filtros.fecha_desde,
      status: 'Confirmado'
    };
    if (filtros.conductor_id) params.conductor_id = filtros.conductor_id;
    return params;
  }, [filtros]);

  const nombreConductor = useMemo(() => {
    const conductor = conductores.find((item) => String(item.id) === String(filtros.conductor_id));
    return conductor?.nombre_conductor || '';
  }, [conductores, filtros.conductor_id]);

  const validarFiltrosConductor = () => {
    if (filtros.tipo === 'conductor' && !filtros.conductor_id) {
      alert('Selecciona un conductor para generar el reporte.');
      return false;
    }
    return true;
  };

  // EXPORTAR A EXCEL (Maneja tanto los normales como el de rezago)
  const generarReporteExcel = async () => {
    if (filtros.tipo === 'rezago') {
      // LÓGICA EXCEL PARA REZAGO
      if (datosRezago.length === 0) {
        alert('No hay datos de rezago para exportar.');
        return;
      }
      const datos = datosRezago.map((row) => ({
        'Conductor': row.conductor,
        'Vehículo': row.vehiculo,
        'Días con deuda': Number(row.dias_rezago || 0),
        'Monto Adeudado': Number(row.monto_adeudado || 0)
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(datos);
      const totalDias = datos.reduce((acc, item) => acc + Number(item['Días con deuda'] || 0), 0);
      const totalMonto = datos.reduce((acc, item) => acc + Number(item['Monto Adeudado'] || 0), 0);
      XLSX.utils.sheet_add_aoa(ws, [['TOTAL', '', totalDias, totalMonto]], { origin: -1 });

      for (let rowIndex = 1; rowIndex <= datos.length + 1; rowIndex++) {
        const cellDias = ws[XLSX.utils.encode_cell({ r: rowIndex, c: 2 })];
        if (cellDias && cellDias.t === 'n') {
          cellDias.z = '0';
        }

        const cellMonto = ws[XLSX.utils.encode_cell({ r: rowIndex, c: 3 })];
        if (cellMonto && cellMonto.t === 'n') {
          cellMonto.z = '$#,##0.00';
        }
      }

      ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Rezagos');
      XLSX.writeFile(wb, `Reporte_Rezago_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    // LÓGICA EXCEL PARA LOS DEMÁS REPORTES
    try {
      if (!validarFiltrosConductor()) return;
      setGenerando(true);
      
      const params = { ...parametrosReporte, limit: 10000 };
      const response = await adminService.getPagosRentas(params);
      const pagos = response.pagos;
      
      if (!pagos || pagos.length === 0) {
        alert('No hay datos para el periodo seleccionado');
        return;
      }

      const datos = buildVistaPreviaRows(pagos).map((row) => ({
        'Fecha de pago': row.fechaPago,
        'Dias cubiertos': row.diasCubiertos,
        Conductor: row.conductor,
        Vehiculo: row.vehiculo,
        'Total pagado': row.totalPagado
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(datos);
      ws['!cols'] = [ { wch: 14 }, { wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 14 } ];
      XLSX.utils.book_append_sheet(wb, ws, 'Pagos de Rentas');
      
      const nombreArchivo = filtros.tipo === 'diario'
        ? `reporte_diario_${filtros.fecha_desde}.xlsx`
        : filtros.tipo === 'conductor'
          ? `reporte_conductor_${nombreConductor || 'seleccionado'}_${filtros.fecha_desde}_al_${filtros.fecha_hasta}.xlsx`
          : `reporte_${filtros.fecha_desde}_al_${filtros.fecha_hasta}.xlsx`;
        
      XLSX.writeFile(wb, nombreArchivo);
      alert(`✅ Reporte generado: ${pagos.length} registro(s)`);
    } catch (error) {
      console.error('Error al generar reporte:', error);
      alert('❌ Error al generar el reporte. Verifica tu conexion.');
    } finally {
      setGenerando(false);
    }
  };

  const cargarVistaPrevia = async () => {
    if (filtros.tipo === 'rezago') {
      cargarReporteRezago();
      return;
    }

    try {
      if (!validarFiltrosConductor()) return;
      const params = { ...parametrosReporte, limit: 10 };
      const response = await adminService.getPagosRentas(params);
      setVistaPrevia(response.pagos);
    } catch (error) {
      console.error('Error cargando vista previa:', error);
      alert('❌ Error al cargar vista previa');
    }
  };

  const cargarDatosPDF = async () => {
    try {
      if (!validarFiltrosConductor()) return;
      setGenerando(true);
      const params = { ...parametrosReporte, limit: 10000 };
      const response = await adminService.getPagosRentas(params);
      const pagos = response.pagos;
      
      if (!pagos || pagos.length === 0) {
        alert('No hay datos para el periodo seleccionado');
        setGenerando(false);
        return;
      }
      setDatosPDF(pagos);
      setGenerando(false);
    } catch (error) {
      console.error('Error al cargar datos para PDF:', error);
      alert('❌ Error al cargar datos para el PDF');
      setGenerando(false);
    }
  };

  // Aquí añadimos 'Rezago' a las opciones
  const tiposReporte = [
    {
      id: 'diario',
      titulo: 'Reporte Diario',
      descripcion: 'Pagos de un dia especifico',
      icono: Calendar,
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'periodo',
      titulo: 'Reporte por Periodo',
      descripcion: 'Rango de fechas personalizado',
      icono: FileBarChart,
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'conductor',
      titulo: 'Por Conductor',
      descripcion: 'Pagos por rango de fechas y conductor',
      icono: FileSpreadsheet,
      color: 'from-emerald-500 to-teal-500'
    },
    {
      id: 'rezago',
      titulo: 'Reporte de Rezago',
      descripcion: 'Conductores con pagos atrasados',
      icono: AlertTriangle,
      color: 'from-red-500 to-orange-500'
    }
  ];

  // (Mantuve intactas tus funciones auxiliares de parseo de fechas para no alterar tu lógica)
  const getDiasCubiertosLabel = (pago) => {
    if (!pago) return '-';
    if (pago.dias_cubiertos) return pago.dias_cubiertos;
    if (pago.rango_inicio || pago.rango_fin) {
      return pago.rango_inicio && pago.rango_fin && pago.rango_inicio !== pago.rango_fin
        ? `${pago.rango_inicio} a ${pago.rango_fin}` : (pago.rango_inicio || pago.rango_fin);
    }
    if (pago.fecha_pago_fin) {
      return pago.fecha_pago && pago.fecha_pago !== pago.fecha_pago_fin
        ? `${pago.fecha_pago} a ${pago.fecha_pago_fin}` : pago.fecha_pago;
    }
    return pago.fecha_pago || '-';
  };

  const formatCurrency = (value) => {
    const numero = Number.parseFloat(value || 0);
    return `$${numero.toFixed(2)}`;
  };

  const parseLocalDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const str = String(value).trim();
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      let year = Number(slashMatch[3]);
      if (year < 100) year += 2000;
      return new Date(year, Number(slashMatch[2]) - 1, Number(slashMatch[1]));
    }
    const date = new Date(str);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const formatDiasCubiertosVistaPrevia = (pago) => {
    if (!pago) return '-';
    const inicioRaw = pago.rango_inicio || pago.fecha_pago;
    const finRaw = pago.rango_fin || pago.fecha_pago_fin || pago.fecha_pago;
    if (!inicioRaw) return '-';
    const inicioDate = parseLocalDate(inicioRaw);
    const finDate = finRaw ? parseLocalDate(finRaw) : null;
    if (!inicioDate || Number.isNaN(inicioDate.getTime())) return pago.dias_cubiertos || getDiasCubiertosLabel(pago);
    
    const inicioDia = inicioDate.getDate();
    const inicioMes = inicioDate.toLocaleDateString('es-MX', { month: 'long' }).replace('.', '').toLowerCase();
    const inicioAno = inicioDate.getFullYear();
    
    if (!finDate || Number.isNaN(finDate.getTime()) || inicioRaw === finRaw) return `${inicioDia} ${inicioMes} ${inicioAno}`;
    
    const finDia = finDate.getDate();
    const finDiaPadded = String(finDia).padStart(2, '0');
    const finMes = finDate.toLocaleDateString('es-MX', { month: 'long' }).replace('.', '').toLowerCase();
    const finAno = finDate.getFullYear();
    
    if (inicioMes === finMes && inicioAno === finAno) return `${inicioDia} al ${finDia} ${inicioMes} ${inicioAno}`;
    if (inicioAno === finAno) return `${inicioDia} ${inicioMes} al ${finDiaPadded} ${finMes} ${finAno}`;
    return `${inicioDia} ${inicioMes} ${inicioAno} al ${finDiaPadded} ${finMes} ${finAno}`;
  };

  const formatFechaPagoVistaPrevia = (pago) => {
    if (!pago) return '-';
    const fechaRaw = pago.created_at || pago.fecha_registro || pago.fecha_pago;
    if (!fechaRaw) return '-';
    const fechaDate = parseLocalDate(fechaRaw);
    if (!fechaDate || Number.isNaN(fechaDate.getTime())) return '-';
    return `${fechaDate.getDate()} ${fechaDate.toLocaleDateString('es-MX', { month: 'long' }).replace('.', '').toLowerCase()} ${fechaDate.getFullYear()}`;
  };

  const buildVistaPreviaRows = (pagos = []) =>
    pagos.map((pago) => ({
      id: pago.id,
      fechaPago: formatFechaPagoVistaPrevia(pago),
      diasCubiertos: formatDiasCubiertosVistaPrevia(pago),
      conductor: pago.nombre_conductor,
      vehiculo: pago.numero_vehiculo,
      totalPagado: formatCurrency(pago.monto_total),
      estado: pago.status
    }));

  const vistaPreviaRows = useMemo(() => buildVistaPreviaRows(vistaPrevia || []), [vistaPrevia]);
  const datosPdfRows = useMemo(() => buildVistaPreviaRows(datosPDF || []), [datosPDF]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Reportes</h1>
          <p className="text-gray-400">Genera y descarga reportes personalizados</p>
        </div>
        
        <div className="flex gap-2">
          <NavButton icon={Home} label="Dashboard" onClick={() => navegarA('')} />
          <NavButton icon={CreditCard} label="Pagos" onClick={() => navegarA('pagos')} />
          <NavButton icon={FileText} label="Reportes" active={true} onClick={() => navegarA('reportes')} />
          <NavButton icon={TrendingUp} label="Estadisticas" onClick={() => navegarA('estadisticas')} />
        </div>
      </div>

      {/* Tipos de Reporte (Ahora incluye 4) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {tiposReporte.map((tipo) => (
          <button
            key={tipo.id}
            onClick={() => setFiltros((prev) => ({
              ...prev,
              tipo: tipo.id,
              conductor_id: tipo.id === 'conductor' ? prev.conductor_id : ''
            }))}
            className={`glass border rounded-2xl p-6 text-left transition-all hover:scale-105 ${
              filtros.tipo === tipo.id ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-primary/30'
            }`}
          >
            <div className={`p-3 rounded-xl bg-gradient-to-br ${tipo.color} w-fit mb-4`}>
              <tipo.icono className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">{tipo.titulo}</h3>
            <p className="text-gray-400 text-sm">{tipo.descripcion}</p>
          </button>
        ))}
      </div>

      {/* Configuracion de Reporte */}
      <div className="glass border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Configuración</h2>
        
        {filtros.tipo !== 'rezago' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {filtros.tipo === 'diario' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Fecha</label>
                <input type="date" value={filtros.fecha_desde} onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })} className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50" />
              </div>
            )}

            {filtros.tipo === 'conductor' && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fecha Desde</label>
                  <input type="date" value={filtros.fecha_desde} onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })} className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fecha Hasta</label>
                  <input type="date" value={filtros.fecha_hasta} onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })} className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Conductor</label>
                  <select value={filtros.conductor_id} onChange={(e) => setFiltros({ ...filtros, conductor_id: e.target.value })} className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50" >
                    <option value="">{cargandoConductores ? 'Cargando conductores...' : 'Selecciona un conductor'}</option>
                    {conductores.map((conductor) => (
                      <option key={conductor.id} value={conductor.id}>{conductor.nombre_conductor}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            
            {filtros.tipo === 'periodo' && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fecha Desde</label>
                  <input type="date" value={filtros.fecha_desde} onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })} className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fecha Hasta</label>
                  <input type="date" value={filtros.fecha_hasta} onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })} className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50" />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mb-6 text-gray-400 text-sm flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Este reporte calcula automáticamente el atraso al día de hoy. No requiere filtros de fecha.
          </div>
        )}

        {/* Botones de Descarga */}
        <div className="flex gap-4">
          <button
            onClick={generarReporteExcel}
            disabled={generando || cargandoRezago}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            {generando ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Generando...</>
            ) : (
              <><Download className="h-5 w-5" />Descargar Excel</>
            )}
          </button>
          
{/* LÓGICA DE PDF SEGÚN LA PESTAÑA */}
          {filtros.tipo === 'rezago' ? (
             <PDFDownloadLink
               document={<RezagoPDFReport rows={datosRezago} />}
               fileName={`Reporte_Rezago_SASI_${new Date().toISOString().split('T')[0]}.pdf`}
               className="flex-1"
             >
               {({ loading }) => (
                 <button 
                   disabled={loading || cargandoRezago || datosRezago.length === 0} 
                   className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-xl transition-all shadow-lg"
                 >
                   {loading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Generando PDF...</> : <><Download className="h-5 w-5" />Descargar PDF</>}
                 </button>
               )}
             </PDFDownloadLink>
          ) : (
             datosPDF ? (
              <PDFDownloadLink
                document={<RentasPDFReport rows={datosPdfRows} filtros={filtros} />}
                fileName={filtros.tipo === 'diario' ? `reporte_diario_${filtros.fecha_desde}.pdf` : filtros.tipo === 'conductor' ? `reporte_conductor_${nombreConductor || 'seleccionado'}_${filtros.fecha_desde}_al_${filtros.fecha_hasta}.pdf` : `reporte_${filtros.fecha_desde}_al_${filtros.fecha_hasta}.pdf`}
                className="flex-1"
              >
                {({ loading }) => (
                  <button disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-xl transition-all shadow-lg">
                    {loading ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Generando PDF...</> : <><Download className="h-5 w-5" />Descargar PDF</>}
                  </button>
                )}
              </PDFDownloadLink>
            ) : (
              <button onClick={cargarDatosPDF} disabled={generando} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-xl transition-all">
                {generando ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>Cargando...</> : <><Download className="h-5 w-5" />Descargar PDF</>}
              </button>
            )
          )}
        </div>
      </div>

      {/* Vista Previa */}
      <div className="glass border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Vista Previa</h2>
          <button
            onClick={cargarVistaPrevia}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm transition-colors"
          >
            {filtros.tipo === 'rezago' ? 'Actualizar Datos' : 'Cargar Vista Previa'}
          </button>
        </div>
        
        {/* TABLA DE REZAGO */}
        {filtros.tipo === 'rezago' ? (
           cargandoRezago ? (
             <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div><p className="text-gray-400 mt-4">Calculando rezagos...</p></div>
           ) : datosRezago.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Conductor</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Vehículo</th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium">Días con deuda</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Monto Adeudado</th>
                  </tr>
                </thead>
                <tbody>
                  {datosRezago.map((row, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 text-white">{row.conductor}</td>
                      <td className="py-3 px-4 text-white">{row.vehiculo}</td>
                      <td className="py-3 px-4 text-center text-orange-400 font-bold">{row.dias_rezago}</td>
                      <td className="py-3 px-4 text-right text-orange-400 font-bold">{formatCurrency(row.monto_adeudado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
           ) : (
             <div className="text-center py-12">
               <AlertTriangle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
               <p className="text-gray-400 text-lg">¡Excelente! Todos los conductores están al día.</p>
             </div>
           )
        ) : (
          /* TABLA NORMAL (Diario, Periodo, Conductor) */
          vistaPrevia ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Fecha de pago</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Dias cubiertos</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Conductor</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Vehiculo</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Total pagado</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {vistaPreviaRows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 text-white">{row.fechaPago}</td>
                      <td className="py-3 px-4 text-white">{row.diasCubiertos}</td>
                      <td className="py-3 px-4 text-white">{row.conductor}</td>
                      <td className="py-3 px-4 text-white">{row.vehiculo}</td>
                      <td className="py-3 px-4 text-white text-right font-bold">{row.totalPagado}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${row.estado === 'Confirmado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {row.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-gray-400 text-sm">Mostrando primeros 10 registros.</p>
                <div className="text-sm text-gray-400">Dias cubiertos considera rangos registrados (domingos excluidos).</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Haz clic en "Cargar Vista Previa" para ver los datos</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${active ? 'bg-primary text-white' : 'glass border border-white/10 text-gray-400 hover:text-white hover:border-primary/30'}`}>
    <Icon className="h-4 w-4" />
    <span className="text-sm font-medium">{label}</span>
  </button>
);

// --- PLANTILLA PDF PARA REZAGO ---
const estilosPDF = StyleSheet.create({
  page: { padding: 30 },
  title: { fontSize: 18, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' },
  table: { display: 'flex', width: 'auto', borderStyle: 'solid', borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { margin: 'auto', flexDirection: 'row' },
  tableColHeader: { width: '25%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: '#f0f0f0' },
  tableCol: { width: '25%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0 },
  tableCellHeader: { margin: 5, fontSize: 12, fontWeight: 'bold' },
  tableCell: { margin: 5, fontSize: 10 }
});

export default Reportes;
