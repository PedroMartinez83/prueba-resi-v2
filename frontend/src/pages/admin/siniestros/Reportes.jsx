import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Calendar, AlertTriangle, 
  Download, Filter, FileText, Car
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_BASE_URL } from '@/services/api';

const ReportesSiniestros = () => {
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    gravedad: '',
    clasificacion: ''
  });

  const [estadisticas, setEstadisticas] = useState(null);
  const [porClasificacion, setPorClasificacion] = useState([]);
  const [topVehiculos, setTopVehiculos] = useState([]);
  const [costosMensuales, setCostosMensuales] = useState([]);

  useEffect(() => {
    cargarReportes();
  }, []);

  const cargarReportes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const params = new URLSearchParams();
      if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
      if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
      if (filtros.gravedad) params.append('gravedad', filtros.gravedad);
      if (filtros.clasificacion) params.append('clasificacion', filtros.clasificacion);

      const queryString = params.toString();

      const response = await fetch(`${API_BASE_URL}/admin/siniestros/estadisticas?${queryString}`, { headers });
      const data = await response.json();

      if (data.success) {
        setEstadisticas(data.estadisticas);
        setPorClasificacion(data.por_clasificacion || []);
        setTopVehiculos(data.top_vehiculos || []);
        setCostosMensuales(data.costos_mensuales || []);
      }
    } catch (error) {
      console.error('Error al cargar reportes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = () => {
    cargarReportes();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-MX');
  };

  // ========================================
  // EXPORTAR A EXCEL (CSV)
  // ========================================
  const exportarExcel = () => {
    if (!estadisticas || topVehiculos.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    let csv = 'REPORTE DE SINIESTROS\n\n';
    
    // Resumen
    csv += 'RESUMEN GENERAL\n';
    csv += `Total Siniestros,${estadisticas.total_siniestros}\n`;
    csv += `Reportados,${estadisticas.reportados}\n`;
    csv += `En Proceso,${estadisticas.en_proceso}\n`;
    csv += `Resueltos,${estadisticas.resueltos}\n`;
    csv += `Graves,${estadisticas.graves}\n`;
    csv += `Perdidas Totales,${estadisticas.totales}\n`;
    csv += `Costo Total,${estadisticas.costo_total}\n`;
    csv += `Costo Promedio,${estadisticas.promedio_costo}\n`;
    csv += `Dias Fuera Servicio (Promedio),${estadisticas.promedio_dias_fuera}\n\n`;

    // Clasificación
    if (porClasificacion.length > 0) {
      csv += 'SINIESTROS POR CLASIFICACION\n';
      csv += 'Clasificacion,Cantidad,Costo Total\n';
      porClasificacion.forEach(c => {
        csv += `${c.clasificacion},${c.cantidad},${c.total_costo || 0}\n`;
      });
      csv += '\n';
    }

   // Vehículos más afectados
csv += 'TOP 10 VEHICULOS MAS AFECTADOS\n';
csv += 'Posicion,ID Vehiculo,Marca,Modelo,Conductor,Siniestros,Costo Total\n';
topVehiculos.forEach((v, i) => {
  const conductor = v.nombre_conductor || 'Sin asignar';
  csv += `${i + 1},${v.numero_vehiculo},${v.marca},${v.modelo},${conductor},${v.total_siniestros},${v.total_costo}\n`;
});

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_siniestros_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ========================================
  // EXPORTAR A PDF
  // ========================================
  const exportarPDF = () => {
    if (!estadisticas || topVehiculos.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const doc = new jsPDF();
    let yPos = 20;

    // ENCABEZADO
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55);
    doc.text('REPORTE DE SINIESTROS', 105, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generado: ${formatDate(new Date())}`, 105, yPos, { align: 'center' });
    
    if (filtros.fecha_inicio && filtros.fecha_fin) {
      yPos += 5;
      doc.text(`Período: ${formatDate(filtros.fecha_inicio)} - ${formatDate(filtros.fecha_fin)}`, 105, yPos, { align: 'center' });
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
      ['Total de Siniestros', estadisticas.total_siniestros],
      ['Reportados', estadisticas.reportados],
      ['En Proceso', estadisticas.en_proceso],
      ['Resueltos', estadisticas.resueltos],
      ['Siniestros Graves', estadisticas.graves],
      ['Pérdidas Totales', estadisticas.totales],
      ['Costo Total', formatCurrency(estadisticas.costo_total)],
      ['Costo Promedio', formatCurrency(estadisticas.promedio_costo)],
      ['Días Fuera (Promedio)', estadisticas.promedio_dias_fuera.toFixed(1) + ' días']
    ];

    autoTable(doc, {      startY: yPos,
      head: [['Concepto', 'Valor']],
      body: resumenData,
      theme: 'grid',
      headStyles: { 
        fillColor: [239, 68, 68],
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

    // DESGLOSE POR CLASIFICACIÓN
    if (porClasificacion && porClasificacion.length > 0) {
      doc.setFontSize(14);
      doc.text('SINIESTROS POR CLASIFICACION', 20, yPos);
      yPos += 8;

      const desgloseData = porClasificacion.map(c => [
        c.clasificacion || 'Sin clasificar',
        c.cantidad,
        formatCurrency(c.total_costo || 0)
      ]);

      autoTable(doc, {        startY: yPos,
        head: [['Clasificación', 'Cantidad', 'Costo Total']],
        body: desgloseData,
        theme: 'grid',
        headStyles: { 
          fillColor: [245, 158, 11],
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

   // TOP 10 VEHÍCULOS
if (yPos > 250) {
  doc.addPage();
  yPos = 20;
}

doc.setFontSize(14);
doc.text('TOP 10 VEHICULOS MAS AFECTADOS', 20, yPos);
yPos += 8;

const vehiculosData = topVehiculos.slice(0, 10).map((v, i) => [
  i + 1,
  v.numero_vehiculo || 'N/A',
  `${v.marca} ${v.modelo}`,
  v.nombre_conductor || 'Sin asignar', // ✅ AGREGADO
  v.total_siniestros,
  formatCurrency(v.total_costo || 0)
]);

autoTable(doc, {  startY: yPos,
  head: [['#', 'ID', 'Vehículo', 'Conductor', 'Siniestros', 'Costo']], // ✅ ACTUALIZADO
  body: vehiculosData,
  theme: 'striped',
  headStyles: { 
    fillColor: [220, 38, 38],
    textColor: 255,
    fontStyle: 'bold',
    fontSize: 9
  },
  bodyStyles: { fontSize: 8 },
  columnStyles: {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 22, halign: 'center' },
    2: { cellWidth: 40 },
    3: { cellWidth: 45 }, // ✅ CONDUCTOR
    4: { cellWidth: 20, halign: 'center' },
    5: { cellWidth: 30, halign: 'right' }
  },
  margin: { left: 20, right: 20 }
});

    // PIE DE PÁGINA
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Página ${i} de ${pageCount}`,
        105,
        290,
        { align: 'center' }
      );
      doc.text(
        'Sistema de Gestión de Siniestros',
        20,
        290
      );
    }

    // Guardar
    doc.save(`reporte_siniestros_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Generando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes de Siniestros</h1>
          <p className="text-gray-600 mt-1">Análisis detallado de costos y frecuencias</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Excel
          </button>
          <button 
            onClick={exportarPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <FileText className="w-5 h-5" />
            PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={filtros.fecha_inicio}
              onChange={(e) => setFiltros({...filtros, fecha_inicio: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={filtros.fecha_fin}
              onChange={(e) => setFiltros({...filtros, fecha_fin: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gravedad
            </label>
            <select
              value={filtros.gravedad}
              onChange={(e) => setFiltros({...filtros, gravedad: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="">Todas</option>
              <option value="Leve">Leve</option>
              <option value="Moderado">Moderado</option>
              <option value="Grave">Grave</option>
              <option value="Total">Total</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFiltrar}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Filter className="w-5 h-5" />
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* Resumen de Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Total Siniestros</p>
                <p className="text-3xl font-bold mt-2">{estadisticas.total_siniestros}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Siniestros Graves</p>
                <p className="text-3xl font-bold mt-2">{estadisticas.graves}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-orange-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Costo Total</p>
                <p className="text-2xl font-bold mt-2">{formatCurrency(estadisticas.costo_total)}</p>
              </div>
              <DollarSign className="w-12 h-12 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Días Fuera (Promedio)</p>
                <p className="text-3xl font-bold mt-2">{estadisticas.promedio_dias_fuera.toFixed(1)}</p>
              </div>
              <Calendar className="w-12 h-12 text-purple-200" />
            </div>
          </div>
        </div>
      )}

      {/* Desglose por Clasificación */}
      {porClasificacion.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Siniestros por Clasificación
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {porClasificacion.map((item, index) => (
              <div key={index} className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 capitalize">{item.clasificacion || 'Sin clasificar'}</h3>
                <p className="text-sm text-gray-600">Cantidad: {item.cantidad}</p>
                <p className="text-lg font-bold text-red-600 mt-2">{formatCurrency(item.total_costo || 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

     {/* Top 10 Vehículos */}
{topVehiculos.length > 0 && (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
      <Car className="w-6 h-6 text-red-600" />
      Top 10 Vehículos Más Afectados
    </h2>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">#</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">ID Vehículo</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Vehículo</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Conductor Asignado</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Siniestros</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Costo Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {topVehiculos.map((vehiculo, index) => (
            <tr key={vehiculo.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{index + 1}</td>
              <td className="px-4 py-3 text-sm">
                <span className="font-bold text-blue-600">{vehiculo.numero_vehiculo}</span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {vehiculo.marca} {vehiculo.modelo}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                {vehiculo.nombre_conductor || (
                  <span className="text-orange-600 italic">Sin asignar</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-right">
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                  {vehiculo.total_siniestros}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                {formatCurrency(vehiculo.total_costo || 0)}
              </td>
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

export default ReportesSiniestros;
