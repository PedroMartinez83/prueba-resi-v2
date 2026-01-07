import React, { useState } from 'react';
import { 
  Car, 
  Fuel, 
  Calendar,
  MapPin,
  Gauge,
  Shield,
  AlertCircle,
  CheckCircle,
  Image
} from 'lucide-react';

const VehicleDisplay = ({ vehiculo }) => {
  const [imageError, setImageError] = useState(false);
  const tieneConductor = vehiculo?.ConductorInfo;

  // Función para obtener el color del vehículo
  const getVehicleColorHex = (color) => {
    const colorMap = {
      'Blanco': '#f8fafc',
      'Negro': '#1a1a1a', 
      'Gris': '#6b7280',
      'Rojo': '#dc2626',
      'Azul': '#1d4ed8',
      'Verde': '#059669',
      'Plata': '#e5e7eb',
      'Tinto': '#7f1d1d'
    };
    return colorMap[color] || '#6b7280';
  };

  // URL de imagen del vehículo
  const getVehicleImage = () => {
    if (imageError) {
      return null;
    }
    
    // Placeholder de alta calidad según el modelo
    const modelImages = {
      'Versa': 'https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=800&h=500&fit=crop',
      'March': 'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&h=500&fit=crop',
      'V-Drive': 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&h=500&fit=crop',
      'Dolphin Mini': 'https://images.unsplash.com/photo-1556189250-72ba954cfc2b?w=800&h=500&fit=crop'
    };
    
    return modelImages[vehiculo.Modelo] || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=500&fit=crop';
  };

  // Función para obtener el ícono del estado
  const getStatusIcon = (estado) => {
    switch (estado) {
      case 'Disponible': return <CheckCircle className="w-5 h-5" />;
      case 'Rentado': return <Car className="w-5 h-5" />;
      case 'Mantenimiento': return <AlertCircle className="w-5 h-5" />;
      case 'Siniestro': return <AlertCircle className="w-5 h-5" />;
      default: return <Car className="w-5 h-5" />;
    }
  };

  // Función para obtener el color del estado - TEMA OSCURO
  const getStatusColor = (estado) => {
    const colors = {
      'Disponible': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Rentado': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Mantenimiento': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Siniestro': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Baja': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      'Asignado': 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    return colors[estado] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="bg-surface-secondary rounded-xl overflow-hidden border border-gray-700">
      {/* Imagen del vehículo o placeholder */}
      <div className="relative h-48 sm:h-64 bg-gradient-to-br from-gray-800 to-gray-900">
        {!imageError && getVehicleImage() ? (
          <img 
            src={getVehicleImage()}
            alt={`${vehiculo.Marca} ${vehiculo.Modelo}`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          // Placeholder SVG elegante si no hay imagen
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Car className="w-16 h-16 sm:w-24 sm:h-24 text-gray-600 mx-auto mb-2" />
              <p className="text-white font-medium text-sm sm:text-base">{vehiculo.Marca} {vehiculo.Modelo}</p>
              <p className="text-gray-400 text-xs sm:text-sm">{vehiculo.Año}</p>
            </div>
          </div>
        )}
        
        {/* Overlay con gradiente */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
        
        {/* Badge de estado */}
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
          <div className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(vehiculo.Estado)} border backdrop-blur-sm`}>
            {getStatusIcon(vehiculo.Estado)}
            <span className="ml-1 sm:ml-2">{vehiculo.Estado}</span>
          </div>
        </div>
        
        {/* Información principal sobre la imagen */}
        <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4">
          <div className="glass rounded-lg p-2 sm:p-3 border border-primary/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-xl font-bold text-white truncate">
                  {vehiculo.Marca} {vehiculo.Modelo}
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 truncate">
                  Unidad #{vehiculo.NumeroUnidad} • {vehiculo.Año}
                </p>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Color</p>
                  <div className="flex items-center mt-1">
                    <div 
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white shadow-md flex-shrink-0"
                      style={{ backgroundColor: getVehicleColorHex(vehiculo.Color) }}
                    ></div>
                    <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-medium text-white truncate">{vehiculo.Color}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Información rápida */}
      <div className="p-3 sm:p-4 bg-surface">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <div className="text-center p-2 bg-surface-secondary rounded-lg border border-gray-700">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Placa</p>
            <p className="text-xs sm:text-sm font-bold text-white truncate">{vehiculo.Placa}</p>
          </div>
          <div className="text-center p-2 bg-surface-secondary rounded-lg border border-gray-700">
            <Fuel className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Combustible</p>
            <p className="text-xs sm:text-sm font-bold text-white truncate">{vehiculo.TipoCombustible}</p>
          </div>
          <div className="text-center p-2 bg-surface-secondary rounded-lg border border-gray-700">
            <Gauge className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Kilometraje</p>
            <p className="text-xs sm:text-sm font-bold text-white truncate">{(vehiculo.KilometrajeActual || 0).toLocaleString()}</p>
          </div>
          <div className="text-center p-2 bg-surface-secondary rounded-lg border border-gray-700">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Tipo</p>
            <p className="text-xs sm:text-sm font-bold text-white truncate">{vehiculo.TipoVehiculo}</p>
          </div>
        </div>
      </div>
      
      {/* Indicadores visuales adicionales */}
      {vehiculo.ProximoMantenimiento && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-surface">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-yellow-400">Próximo mantenimiento</p>
                <p className="text-xs text-yellow-400/80 truncate">
                  A los {vehiculo.ProximoMantenimiento.toLocaleString()} km
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleDisplay;