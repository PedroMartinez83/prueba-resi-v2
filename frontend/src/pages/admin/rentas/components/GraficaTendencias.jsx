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
import adminService from '../../../../services/adminService';
const GraficaTendencias = ({ meses = 12 }) => {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, [meses]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const response = await adminService.getTendenciaMensual({ meses });
      
      // Datos de ejemplo si la API no existe aún
      const datosEjemplo = [
        { mes: 'Ene', total_cobrado: 1250000, promedio: 41250 },
        { mes: 'Feb', total_cobrado: 1180000, promedio: 39333 },
        { mes: 'Mar', total_cobrado: 1290000, promedio: 42666 },
        { mes: 'Abr', total_cobrado: 1235000, promedio: 41166 },
        { mes: 'May', total_cobrado: 1310000, promedio: 43333 },
        { mes: 'Jun', total_cobrado: 1275000, promedio: 42500 },
        { mes: 'Jul', total_cobrado: 1305000, promedio: 43166 },
        { mes: 'Ago', total_cobrado: 1260000, promedio: 41666 },
        { mes: 'Sep', total_cobrado: 1285000, promedio: 42833 },
        { mes: 'Oct', total_cobrado: 1320000, promedio: 43666 },
        { mes: 'Nov', total_cobrado: 1295000, promedio: 43166 },
        { mes: 'Dic', total_cobrado: 1340000, promedio: 44333 }
      ];
      
      setDatos(response?.datos || datosEjemplo);
    } catch (error) {
      console.error('Error al cargar tendencias:', error);
      setDatos([]);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass border border-white/20 rounded-lg p-3">
          <p className="text-white font-semibold mb-2">{payload[0].payload.mes}</p>
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

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={datos}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="mes"
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
  );
};

export default GraficaTendencias;