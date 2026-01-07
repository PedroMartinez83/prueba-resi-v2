// frontend/src/components/vehiculos/VehiculosStats.jsx
import React from 'react';
import { Car, Check, UserCheck, Wrench, AlertTriangle } from 'lucide-react';

const VehiculosStats = ({ estadisticas, filterEstado, onFilterChange }) => {
  const stats = [
    {
      id: 'todos',
      label: 'Total Flota',
      value: estadisticas.total,
      subtitle: 'Vehículos activos',
      icon: Car,
      color: 'primary',
      borderColor: 'border-primary/20 hover:border-primary/40',
      borderActive: 'border-primary',
      bgIcon: 'bg-primary/20',
      bgActive: 'bg-primary/10',
      textColor: 'text-white',
      ringColor: 'ring-primary'
    },
    {
      id: 'Disponible',
      label: 'Disponibles',
      value: estadisticas.disponibles,
      subtitle: 'Listos para asignar',
      icon: Check,
      color: 'green',
      borderColor: 'border-green-500/20 hover:border-green-500/40',
      borderActive: 'border-green-500',
      bgIcon: 'bg-green-500/20',
      bgActive: 'bg-green-500/10',
      textColor: 'text-green-500',
      ringColor: 'ring-green-500'
    },
    {
      id: 'Rentado',
      label: 'En Servicio',
      value: estadisticas.rentados,
      subtitle: 'Generando ingresos',
      icon: UserCheck,
      color: 'blue',
      borderColor: 'border-blue-500/20 hover:border-blue-500/40',
      borderActive: 'border-blue-500',
      bgIcon: 'bg-blue-500/20',
      bgActive: 'bg-blue-500/10',
      textColor: 'text-blue-500',
      ringColor: 'ring-blue-500'
    },
    {
      id: 'Mantenimiento',
      label: 'Mantenimiento',
      value: estadisticas.mantenimiento,
      subtitle: 'En taller',
      icon: Wrench,
      color: 'yellow',
      borderColor: 'border-yellow-500/20 hover:border-yellow-500/40',
      borderActive: 'border-yellow-500',
      bgIcon: 'bg-yellow-500/20',
      bgActive: 'bg-yellow-500/10',
      textColor: 'text-yellow-500',
      ringColor: 'ring-yellow-500'
    },
    {
      id: 'problemas',
      label: 'Problemas',
      value: estadisticas.problemas,
      subtitle: 'Requieren atención',
      icon: AlertTriangle,
      color: 'red',
      borderColor: 'border-red-500/20 hover:border-red-500/40',
      borderActive: 'border-red-500',
      bgIcon: 'bg-red-500/20',
      bgActive: 'bg-red-500/10',
      textColor: 'text-red-500',
      ringColor: 'ring-red-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isActive = filterEstado === stat.id;
        
        return (
          <button
            key={stat.id}
            onClick={() => onFilterChange(stat.id)}
            className={`glass rounded-lg p-3 sm:p-4 border-2 transition-all text-left transform hover:scale-105 ${
              isActive 
                ? `${stat.borderActive} ${stat.bgActive} ring-2 ${stat.ringColor} ring-offset-2 ring-offset-dark shadow-lg` 
                : stat.borderColor
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs sm:text-sm">{stat.label}</p>
                <p className={`text-xl sm:text-2xl font-bold ${stat.textColor}`}>
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
              </div>
              <div className={`p-2 sm:p-3 ${stat.bgIcon} rounded-lg`}>
                <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${stat.textColor}`} />
              </div>
            </div>
            {isActive && (
              <div className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-gray-300">
                <Check className="w-3 h-3" />
                Filtro activo
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default VehiculosStats;