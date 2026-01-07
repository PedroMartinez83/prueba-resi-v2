// frontend/src/components/vehiculos/VehiculosGrid.jsx
import React from 'react';
import { Car, Edit, Trash2, MapPin, Calendar, Gauge } from 'lucide-react';

const VehiculosGrid = ({ vehiculos, onEdit, onDelete }) => {
  const getEstadoBadge = (estado) => {
    const badges = {
      'Disponible': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Rentado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Asignado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Mantenimiento': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Siniestro': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Baja': 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return badges[estado] || badges['Disponible'];
  };

  const getTipoBadge = (tipo) => {
    const badges = {
      'SD': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'SI': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'SA': 'bg-green-500/20 text-green-400 border-green-500/30'
    };
    return badges[tipo] || badges['SD'];
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {vehiculos.map((vehiculo) => (
        <div
          key={vehiculo.id}
          className="glass rounded-xl border border-primary/20 overflow-hidden hover:border-primary/40 transition-all transform hover:scale-105"
        >
          {/* Header con Ícono y Estado */}
          <div className="p-4 bg-gradient-to-br from-primary/10 to-transparent border-b border-primary/10">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/20 rounded-lg">
                  <Car className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">
                    {vehiculo.NumeroVehiculo}
                  </h3>
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${getTipoBadge(vehiculo.TipoSocio)}`}>
                    {vehiculo.TipoSocio}
                  </span>
                </div>
              </div>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getEstadoBadge(vehiculo.Estado)}`}>
                {vehiculo.Estado}
              </span>
            </div>
          </div>

          {/* Información Principal */}
          <div className="p-4 space-y-3">
            <div>
              <p className="text-sm text-gray-400">Marca y Modelo</p>
              <p className="text-white font-semibold">
                {vehiculo.Marca} {vehiculo.Modelo} {vehiculo.Año}
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-gray-300">{vehiculo.Placa || 'Sin placa'}</span>
            </div>

            {vehiculo.KilometrajeActual > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Gauge className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">
                  {vehiculo.KilometrajeActual?.toLocaleString()} km
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-primary/10">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Calendar className="w-3 h-3" />
                <span>
                  {vehiculo.TipoVehiculo} • {vehiculo.TipoCombustible} • {vehiculo.Color}
                </span>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="p-3 bg-dark/30 border-t border-primary/10 flex gap-2">
            <button
              onClick={() => onEdit(vehiculo)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-all text-sm font-medium"
            >
              <Edit className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={() => onDelete(vehiculo.id)}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default VehiculosGrid;