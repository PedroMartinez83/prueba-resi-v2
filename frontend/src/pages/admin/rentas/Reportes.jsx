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
  FileBarChart
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PDFDownloadLink } from '@react-pdf/renderer';
import RentasPDFReport from '../../../components/reportes/RentasPDFReport';
import adminService from '../../../services/adminService';

const Reportes = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [generando, setGenerando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [datosPDF, setDatosPDF] = useState(null); 
  const [conductores, setConductores] = useState([]);
  const [cargandoConductores, setCargandoConductores] = useState(false);
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
    if (tipoQuery && ['diario', 'periodo', 'conductor'].includes(tipoQuery)) {
      setFiltros((prev) => ({
        ...prev,
        tipo: tipoQuery
      }));
    }
  }, [searchParams]);

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
        if (isMounted) {
          setConductores([]);
        }
      } finally {
        if (isMounted) {
          setCargandoConductores(false);
        }
      }
    };

    cargarConductores();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setDatosPDF(null);
  }, [filtros]);

  const parametrosReporte = useMemo(() => {
    const params = {
      fecha_desde: filtros.fecha_desde,
      fecha_hasta: ['periodo', 'conductor'].includes(filtros.tipo)
        ? filtros.fecha_hasta
        : filtros.fecha_desde,
      status: 'Confirmado'
    };

    if (filtros.conductor_id) {
      params.conductor_id = filtros.conductor_id;
    }

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

  const generarReporteExcel = async () => {
    try {
      if (!validarFiltrosConductor()) {
        return;
      }

      setGenerando(true);
      
      // Obtener datos reales del backend
      const params = {
        ...parametrosReporte,
        limit: 10000
      };
      
      const response = await adminService.getPagosRentas(params);
      const pagos = response.pagos;
      
      if (!pagos || pagos.length === 0) {
        alert('No hay datos para el período seleccionado');
        return;
      }

      // Formatear datos para Excel
      const datos = pagos.map((pago, index) => ({
        Folio: String(pago.id).padStart(6, '0'),
        Fecha: new Date(pago.fecha_pago).toLocaleDateString('es-MX'),
        Conductor: pago.nombre_conductor,
        Vehículo: pago.numero_vehiculo,
        'Tipo Socio': pago.tipo_socio,
        'Renta Pagada': parseFloat(pago.monto_renta_pagado || 0),
        'Póliza Pagada': parseFloat(pago.monto_poliza_pagado || 0),
        Total: parseFloat(pago.monto_total),
        Método: pago.metodo_pago,
        Estado: pago.status,
        Observaciones: pago.observaciones || ''
      }));

      // Agregar fila de totales
      const totales = {
        Folio: '',
        Fecha: '',
        Conductor: '',
        Vehículo: '',
        'Tipo Socio': 'TOTAL:',
        'Renta Pagada': datos.reduce((sum, p) => sum + p['Renta Pagada'], 0),
        'Póliza Pagada': datos.reduce((sum, p) => sum + p['Póliza Pagada'], 0),
        Total: datos.reduce((sum, p) => sum + p.Total, 0),
        Método: '',
        Estado: '',
        Observaciones: ''
      };
      datos.push(totales);

      // Crear libro de Excel
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(datos);

      // Ajustar anchos de columna
      ws['!cols'] = [
        { wch: 10 }, // Folio
        { wch: 12 }, // Fecha
        { wch: 30 }, // Conductor
        { wch: 12 }, // Vehículo
        { wch: 12 }, // Tipo Socio
        { wch: 12 }, // Renta
        { wch: 12 }, // Póliza
        { wch: 12 }, // Total
        { wch: 14 }, // Método
        { wch: 12 }, // Estado
        { wch: 30 }  // Observaciones
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Pagos de Rentas');
      
      // Descargar archivo
      const nombreArchivo = filtros.tipo === 'diario'
        ? `reporte_diario_${filtros.fecha_desde}.xlsx`
        : filtros.tipo === 'conductor'
          ? `reporte_conductor_${nombreConductor || 'seleccionado'}_${filtros.fecha_desde}_al_${filtros.fecha_hasta}.xlsx`
          : `reporte_${filtros.fecha_desde}_al_${filtros.fecha_hasta}.xlsx`;
        
      XLSX.writeFile(wb, nombreArchivo);
      
      alert(`✅ Reporte generado: ${pagos.length} registro(s)`);
      
    } catch (error) {
      console.error('Error al generar reporte:', error);
      alert('❌ Error al generar el reporte. Verifica tu conexión.');
    } finally {
      setGenerando(false);
    }
  };

  const cargarVistaPrevia = async () => {
    try {
      if (!validarFiltrosConductor()) {
        return;
      }

      const params = {
        ...parametrosReporte,
        limit: 10
      };
      
      const response = await adminService.getPagosRentas(params);
      setVistaPrevia(response.pagos);
    } catch (error) {
      console.error('Error cargando vista previa:', error);
      alert('❌ Error al cargar vista previa');
    }
  };

  // ✅ PASO 3: Cargar datos para PDF elegante
  const cargarDatosPDF = async () => {
    try {
      if (!validarFiltrosConductor()) {
        return;
      }

      setGenerando(true);
      
      const params = {
        ...parametrosReporte,
        limit: 10000
      };
      
      const response = await adminService.getPagosRentas(params);
      const pagos = response.pagos;
      
      if (!pagos || pagos.length === 0) {
        alert('No hay datos para el período seleccionado');
        setGenerando(false);
        return;
      }

      // Guardar datos para el PDF
      setDatosPDF(pagos);
      setGenerando(false);
      
    } catch (error) {
      console.error('Error al cargar datos para PDF:', error);
      alert('❌ Error al cargar datos para el PDF');
      setGenerando(false);
    }
  };

  const tiposReporte = [
    {
      id: 'diario',
      titulo: 'Reporte Diario',
      descripcion: 'Pagos de un día específico',
      icono: Calendar,
      color: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'periodo',
      titulo: 'Reporte por Período',
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
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Reportes</h1>
          <p className="text-gray-400">Genera y descarga reportes personalizados</p>
        </div>
        
        {/* Navegación */}
        <div className="flex gap-2">
          <NavButton
            icon={Home}
            label="Dashboard"
            onClick={() => navegarA('')}
          />
          <NavButton
            icon={CreditCard}
            label="Pagos"
            onClick={() => navegarA('pagos')}
          />
          <NavButton
            icon={FileText}
            label="Reportes"
            active={true}
            onClick={() => navegarA('reportes')}
          />
          <NavButton
            icon={TrendingUp}
            label="Estadísticas"
            onClick={() => navegarA('estadisticas')}
          />
        </div>
      </div>

      {/* Tipos de Reporte */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiposReporte.map((tipo) => (
          <button
            key={tipo.id}
            onClick={() => setFiltros((prev) => ({
              ...prev,
              tipo: tipo.id,
              conductor_id: tipo.id === 'conductor' ? prev.conductor_id : ''
            }))}
            className={`glass border rounded-2xl p-6 text-left transition-all hover:scale-105 ${
              filtros.tipo === tipo.id
                ? 'border-primary bg-primary/10'
                : 'border-white/10 hover:border-primary/30'
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

      {/* Configuración de Reporte */}
      <div className="glass border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Configuración</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {filtros.tipo === 'diario' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Fecha</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
              />
            </div>
          )}

          {filtros.tipo === 'conductor' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Fecha Desde</label>
                <input
                  type="date"
                  value={filtros.fecha_desde}
                  onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Fecha Hasta</label>
                <input
                  type="date"
                  value={filtros.fecha_hasta}
                  onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Conductor</label>
                <select
                  value={filtros.conductor_id}
                  onChange={(e) => setFiltros({ ...filtros, conductor_id: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
                >
                  <option value="">
                    {cargandoConductores ? 'Cargando conductores...' : 'Selecciona un conductor'}
                  </option>
                  {conductores.map((conductor) => (
                    <option key={conductor.id} value={conductor.id}>
                      {conductor.nombre_conductor}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          
          {filtros.tipo === 'periodo' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Fecha Desde</label>
                <input
                  type="date"
                  value={filtros.fecha_desde}
                  onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Fecha Hasta</label>
                <input
                  type="date"
                  value={filtros.fecha_hasta}
                  onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
                />
              </div>
            </>
          )}
        </div>

        {/* Botones de Descarga */}
        <div className="flex gap-4">
          <button
            onClick={generarReporteExcel}
            disabled={generando}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            {generando ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generando...
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Descargar Excel
              </>
            )}
          </button>
          
          {/* ✅ PDF ELEGANTE CON @react-pdf/renderer */}
          {datosPDF ? (
            <PDFDownloadLink
              document={<RentasPDFReport data={datosPDF} filtros={filtros} />}
              fileName={
                filtros.tipo === 'diario'
                  ? `reporte_diario_${filtros.fecha_desde}.pdf`
                  : filtros.tipo === 'conductor'
                    ? `reporte_conductor_${nombreConductor || 'seleccionado'}_${filtros.fecha_desde}_al_${filtros.fecha_hasta}.pdf`
                    : `reporte_${filtros.fecha_desde}_al_${filtros.fecha_hasta}.pdf`
              }
              className="flex-1"
            >
              {({ loading }) => (
                <button
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      Descargar PDF
                    </>
                  )}
                </button>
              )}
            </PDFDownloadLink>
          ) : (
            <button
              onClick={cargarDatosPDF}
              disabled={generando}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl transition-all"
            >
              {generando ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Cargando...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Descargar PDF
                </>
              )}
            </button>
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
            Cargar Vista Previa
          </button>
        </div>
        
        {vistaPrevia ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Fecha</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Conductor</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Vehículo</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">💼 Renta</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">🛡️ Póliza</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Total</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {vistaPrevia.map((pago) => (
                  <tr key={pago.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white">
                      {new Date(pago.fecha_pago).toLocaleDateString('es-MX')}
                    </td>
                    <td className="py-3 px-4 text-white">{pago.nombre_conductor}</td>
                    <td className="py-3 px-4 text-white">{pago.numero_vehiculo}</td>
                    <td className="py-3 px-4 text-emerald-400 text-right font-medium">
                      ${parseFloat(pago.monto_renta_pagado || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-purple-400 text-right font-medium">
                      ${parseFloat(pago.monto_poliza_pagado || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-white text-right font-bold">
                      ${parseFloat(pago.monto_total).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        pago.status === 'Confirmado' 
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {pago.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-gray-400 text-sm">
                Mostrando primeros 10 registros. El reporte completo contendrá todos los datos.
              </p>
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-400">💼 Renta = Ganancia Empresa</span>
                <span className="text-purple-400">🛡️ Póliza = Ahorro Conductor</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              Haz clic en "Cargar Vista Previa" para ver los datos
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
      active
        ? 'bg-primary text-white'
        : 'glass border border-white/10 text-gray-400 hover:text-white hover:border-primary/30'
    }`}
  >
    <Icon className="h-4 w-4" />
    <span className="text-sm font-medium">{label}</span>
  </button>
);

export default Reportes;
