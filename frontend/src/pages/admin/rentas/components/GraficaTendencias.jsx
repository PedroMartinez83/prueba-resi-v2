import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, FileText } from 'lucide-react';
import adminService from '../../../../services/adminService';
const GraficaTendencias = ({ meses = 12 }) => {
  const [datos, setDatos] = useState([]);
  const [resumenPeriodo, setResumenPeriodo] = useState(null);
  const [resumenAnual, setResumenAnual] = useState(null);
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, [meses]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const response = await adminService.getTendenciaMensual({ meses });
      const datosRespuesta = response?.datos || [];
      setDatos(datosRespuesta);
      setResumenPeriodo(response?.resumen_periodo || response?.resumen_anual || null);
      setResumenAnual(response?.resumen_anual || null);
      if (datosRespuesta.length > 0) {
        setMesSeleccionado((prev) => {
          const existe = datosRespuesta.some((item) => item.mes === prev);
          return existe ? prev : datosRespuesta[datosRespuesta.length - 1].mes;
        });
      } else {
        setMesSeleccionado('');
      }
    } catch (error) {
      console.error('Error al cargar tendencias:', error);
      setDatos([]);
      setResumenPeriodo(null);
      setResumenAnual(null);
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) =>
    Number(valor || 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const exportarExcelMesSeleccionado = () => {
    const estadisticaMes = datos.find((item) => item.mes === mesSeleccionado);
    if (!estadisticaMes) {
      alert('No hay mes seleccionado para exportar.');
      return;
    }

    const rows = [{
      Mes: estadisticaMes.mes_label,
      'Total cobrado': Number(estadisticaMes.total_cobrado || 0),
      'Total renta': Number(estadisticaMes.total_renta || 0),
      'Total poliza': Number(estadisticaMes.total_poliza || 0),
      'Pagos confirmados': Number(estadisticaMes.total_pagos || 0),
      'Conductores activos': Number(estadisticaMes.conductores_activos || 0),
      'Promedio diario': Number(estadisticaMes.promedio_diario || 0)
    }];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Mes seleccionado');
    XLSX.writeFile(wb, `estadisticas_mes_${estadisticaMes.mes}.xlsx`);
  };

  const exportarExcelGeneral = () => {
    if (!datos.length) {
      alert('No hay datos para exportar.');
      return;
    }

    const rows = datos.map((item) => ({
      Mes: item.mes_label,
      'Total cobrado': Number(item.total_cobrado || 0),
      'Total renta': Number(item.total_renta || 0),
      'Total poliza': Number(item.total_poliza || 0),
      'Pagos confirmados': Number(item.total_pagos || 0),
      'Conductores activos': Number(item.conductores_activos || 0),
      'Promedio diario': Number(item.promedio_diario || 0)
    }));

    const wb = XLSX.utils.book_new();
    const wsDetalle = XLSX.utils.json_to_sheet(rows);
    wsDetalle['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Historico mensual');

    const resumenRows = [{
      Periodo: `Ultimos ${meses} meses`,
      'Total cobrado periodo': Number(resumenPeriodo?.total_cobrado || 0),
      'Total renta periodo': Number(resumenPeriodo?.total_renta || 0),
      'Total poliza periodo': Number(resumenPeriodo?.total_poliza || 0),
      'Mejor mes': resumenPeriodo?.mejor_mes || '-',
      'Total anual actual': Number(resumenAnual?.total_cobrado || 0)
    }];
    const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
    wsResumen['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    XLSX.writeFile(wb, `estadisticas_generales_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportarPdfMesSeleccionado = () => {
    const estadisticaMes = datos.find((item) => item.mes === mesSeleccionado);
    if (!estadisticaMes) {
      alert('No hay mes seleccionado para exportar.');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Estadisticas de Rentas - Mes Seleccionado', 14, 16);
    doc.setFontSize(11);
    doc.text(`Mes: ${estadisticaMes.mes_label}`, 14, 24);

    autoTable(doc, {
      startY: 30,
      head: [['Metrica', 'Valor']],
      body: [
        ['Total cobrado', formatearMoneda(estadisticaMes.total_cobrado)],
        ['Total renta', formatearMoneda(estadisticaMes.total_renta)],
        ['Total poliza', formatearMoneda(estadisticaMes.total_poliza)],
        ['Pagos confirmados', String(estadisticaMes.total_pagos || 0)],
        ['Conductores activos', String(estadisticaMes.conductores_activos || 0)],
        ['Promedio diario', formatearMoneda(estadisticaMes.promedio_diario)]
      ]
    });

    doc.save(`estadisticas_mes_${estadisticaMes.mes}.pdf`);
  };

  const exportarPdfGeneral = () => {
    if (!datos.length) {
      alert('No hay datos para exportar.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`Estadisticas Generales de Rentas - Ultimos ${meses} meses`, 14, 16);

    autoTable(doc, {
      startY: 22,
      head: [['Mes', 'Total cobrado', 'Total renta', 'Total poliza', 'Pagos', 'Conductores', 'Promedio diario']],
      body: datos.map((item) => [
        item.mes_label,
        formatearMoneda(item.total_cobrado),
        formatearMoneda(item.total_renta),
        formatearMoneda(item.total_poliza),
        String(item.total_pagos || 0),
        String(item.conductores_activos || 0),
        formatearMoneda(item.promedio_diario)
      ])
    });

    const y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 120;
    doc.setFontSize(11);
    doc.text(`Total cobrado periodo: ${formatearMoneda(resumenPeriodo?.total_cobrado)}`, 14, y);
    doc.text(`Total anual actual: ${formatearMoneda(resumenAnual?.total_cobrado)}`, 14, y + 7);

    doc.save(`estadisticas_generales_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass border border-white/20 rounded-lg p-3">
          <p className="text-white font-semibold mb-2">{payload[0].payload.mes_label || payload[0].payload.mes}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-400">
              Total: ${payload[0].value.toLocaleString('es-MX')}
            </p>
            {payload[0].payload.promedio && (
              <p className="text-gray-400">
                Promedio diario: ${payload[0].payload.promedio.toLocaleString('es-MX')}
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!datos.length) {
    return (
      <div className="h-96 flex items-center justify-center">
        <p className="text-gray-400">No hay datos disponibles</p>
      </div>
    );
  }

  const estadisticaMes = datos.find((item) => item.mes === mesSeleccionado) || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportarExcelMesSeleccionado}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Excel Mes
          </button>
          <button
            onClick={exportarPdfMesSeleccionado}
            className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            PDF Mes
          </button>
          <button
            onClick={exportarExcelGeneral}
            className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Excel General
          </button>
          <button
            onClick={exportarPdfGeneral}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            PDF General
          </button>
        </div>

        <select
          value={mesSeleccionado}
          onChange={(e) => setMesSeleccionado(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-primary"
        >
          {datos.map((item) => (
            <option key={item.mes} value={item.mes} className="text-black">
              {item.mes_label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/15 bg-white/5 p-3">
          <p className="text-xs text-gray-400">
            Total Cobrado {estadisticaMes ? `(${estadisticaMes.mes_label})` : '(Periodo)'}
          </p>
          <p className="text-lg font-bold text-white">
            ${Number(estadisticaMes?.total_cobrado ?? resumenPeriodo?.total_cobrado ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-white/15 bg-white/5 p-3">
          <p className="text-xs text-gray-400">Total Renta {estadisticaMes ? `(${estadisticaMes.mes_label})` : '(Periodo)'}</p>
          <p className="text-lg font-bold text-white">
            ${Number(estadisticaMes?.total_renta ?? resumenPeriodo?.total_renta ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border border-white/15 bg-white/5 p-3">
          <p className="text-xs text-gray-400">Total Poliza {estadisticaMes ? `(${estadisticaMes.mes_label})` : '(Periodo)'}</p>
          <p className="text-lg font-bold text-white">
            ${Number(estadisticaMes?.total_poliza ?? resumenPeriodo?.total_poliza ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={datos}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="mes_label"
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: '#fff' }}
            iconType="square"
          />
          <Bar
            dataKey="total_cobrado"
            fill="#6366f1"
            radius={[8, 8, 0, 0]}
            name="Total Cobrado"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GraficaTendencias;
