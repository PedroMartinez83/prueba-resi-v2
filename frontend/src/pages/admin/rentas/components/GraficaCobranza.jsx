import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// ✅ COMPONENTE CON "DOS CUBETAS"
const GraficaCobranza = ({ datos = [], loading = false }) => {

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="glass border border-white/20 rounded-lg p-3">
          <p className="text-white font-semibold mb-2">{data.fecha}</p>
          <div className="space-y-1 text-sm">
            {/* 💼 Renta (Empresa) */}
            <p className="text-emerald-400 flex items-center justify-between gap-4">
              <span>💼 Renta Cobrada:</span>
              <span className="font-semibold">${data.cobrado_renta?.toLocaleString('es-MX') || 0}</span>
            </p>
            
            {/* 🛡️ Póliza (Conductor) */}
            <p className="text-purple-400 flex items-center justify-between gap-4">
              <span>🛡️ Póliza Ahorrada:</span>
              <span className="font-semibold">${data.cobrado_poliza?.toLocaleString('es-MX') || 0}</span>
            </p>
            
            {/* 📊 Esperado */}
            <p className="text-blue-400 flex items-center justify-between gap-4">
              <span>📊 Esperado (Renta):</span>
              <span className="font-semibold">${data.esperado?.toLocaleString('es-MX') || 0}</span>
            </p>
            
            {/* Diferencia */}
            {data.diferencia !== undefined && (
              <div className="pt-2 mt-2 border-t border-white/10">
                <p className={`flex items-center justify-between gap-4 ${
                  data.diferencia >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  <span>Diferencia:</span>
                  <span className="font-semibold">
                    ${Math.abs(data.diferencia).toLocaleString('es-MX')}
                    {data.diferencia >= 0 ? ' ↑' : ' ↓'}
                  </span>
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Cobranza: {data.porcentaje_cobranza}%
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!datos || datos.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-gray-400">No hay datos disponibles</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={datos}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        
        <XAxis
          dataKey="fecha"
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
          iconType="circle"
        />
        
        {/* 💼 LÍNEA VERDE - Renta Cobrada (Empresa) */}
        <Line
          type="monotone"
          dataKey="cobrado_renta"
          stroke="#10b981"
          strokeWidth={3}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="💼 Renta Cobrada (Empresa)"
        />
        
        {/* 🛡️ LÍNEA MORADA - Póliza Ahorrada (Conductor) */}
        <Line
          type="monotone"
          dataKey="cobrado_poliza"
          stroke="#a78bfa"
          strokeWidth={2}
          dot={{ fill: '#a78bfa', r: 3 }}
          activeDot={{ r: 5 }}
          name="🛡️ Póliza Ahorrada (Conductor)"
        />
        
        {/* 📊 LÍNEA AZUL PUNTEADA - Esperado (Solo Renta) */}
        <Line
          type="monotone"
          dataKey="esperado"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: '#3b82f6', r: 3 }}
          name="📊 Esperado (Renta)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default GraficaCobranza;