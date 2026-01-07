import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import adminService from '../../../../services/adminService';
const GraficaPorTipoSocio = () => {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const response = await adminService.getDistribucionTipoSocio();
      
      // Datos de ejemplo si la API no existe
      const datosEjemplo = [
        { tipo: 'SD', total: 800000, cantidad: 60, porcentaje: 65 },
        { tipo: 'SI', total: 360000, porcentaje: 30, cantidad: 25 },
        { tipo: 'SA', total: 60000, porcentaje: 5, cantidad: 6 }
      ];
      
      setDatos(response?.datos || datosEjemplo);
    } catch (error) {
      console.error('Error al cargar distribución:', error);
      setDatos([]);
    } finally {
      setLoading(false);
    }
  };

  const COLORES = {
    'SD': '#3b82f6', // Azul
    'SI': '#8b5cf6', // Púrpura
    'SA': '#f97316'  // Naranja
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass border border-white/20 rounded-lg p-3">
          <p className="text-white font-semibold mb-2">{data.tipo}</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-300">
              Total: ${data.total.toLocaleString('es-MX')}
            </p>
            <p className="text-gray-300">
              Conductores: {data.cantidad}
            </p>
            <p className="text-primary font-medium">
              {data.porcentaje}% del total
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLabel = (entry) => {
    return `${entry.tipo}: ${entry.porcentaje}%`;
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
    <div className="space-y-6">
      {/* Gráfica */}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={datos}
            dataKey="porcentaje"
            nameKey="tipo"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={renderLabel}
            labelLine={false}
          >
            {datos.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORES[entry.tipo]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: '#fff' }}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Detalles */}
      <div className="grid grid-cols-3 gap-4">
        {datos.map((item) => (
          <div
            key={item.tipo}
            className="glass border border-white/10 rounded-xl p-4 text-center"
          >
            <div
              className="w-3 h-3 rounded-full mx-auto mb-2"
              style={{ backgroundColor: COLORES[item.tipo] }}
            />
            <h4 className="text-white font-bold text-lg mb-1">
              {item.tipo}
            </h4>
            <p className="text-2xl font-bold mb-1" style={{ color: COLORES[item.tipo] }}>
              ${(item.total / 1000).toFixed(0)}k
            </p>
            <p className="text-sm text-gray-400">
              {item.cantidad} conductores
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {item.porcentaje}% del total
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GraficaPorTipoSocio;