// frontend/src/components/VehicleConductorPanel.jsx
import React from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign,
  Shield,
  CreditCard,
  MapPin,
  FileText,
  UserX,
  Clock,
  UserPlus
} from 'lucide-react';

const VehicleConductorPanel = ({ 
  vehiculo, 
  onAsignarClick,
  onVerContratoClick,    // 🆕 Nueva prop
  onCambiarConductorClick // 🆕 Nueva prop
}) => {
  // Verificar si hay conductor asignado
  const conductor = vehiculo?.ConductorInfo;
  
  // Si no hay conductor, mostrar panel vacío
  if (!conductor) {
    return (
      <div className="glass rounded-2xl p-4 sm:p-6 border border-primary/20">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            Conductor Asignado
          </h2>
          <div className="p-2 bg-surface-secondary rounded-lg">
            <UserX className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        
        <div className="text-center py-8 sm:py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-surface-secondary rounded-full mb-4">
            <User className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
          </div>
          <p className="text-white font-medium mb-2 text-sm sm:text-base">Sin conductor asignado</p>
          <p className="text-xs sm:text-sm text-gray-400">
            Este vehículo está disponible para asignación
          </p>
          <button 
            onClick={onAsignarClick}
            className="mt-4 sm:mt-6 px-4 sm:px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-lg font-medium text-sm sm:text-base"
          >
            Asignar Conductor
          </button>
        </div>
      </div>
    );
  }
  
  // Formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return 'No especificada';
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Calcular días asignado
  const calcularDiasAsignado = () => {
    if (!conductor.fechaAsignacion) return 0;
    const inicio = new Date(conductor.fechaAsignacion);
    const hoy = new Date();
    const diferencia = hoy - inicio;
    return Math.floor(diferencia / (1000 * 60 * 60 * 24));
  };
  
  const diasAsignado = calcularDiasAsignado();
  
  return (
    <div className="glass rounded-2xl overflow-hidden border border-primary/20">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-white mb-1 truncate">
              Conductor Asignado
            </h2>
            <p className="text-cyan-100 text-xs sm:text-sm truncate">
              Información del conductor actual
            </p>
          </div>
          <div className="p-2 sm:p-3 bg-white/20 rounded-lg backdrop-blur-sm flex-shrink-0 ml-3">
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        </div>
      </div>
      
      {/* Información principal del conductor */}
      <div className="p-4 sm:p-6">
        {/* Nombre y estado */}
        <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 truncate">
              {conductor.nombre || 'Sin nombre'}
            </h3>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                conductor.estado === 'Activo' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : conductor.estado === 'Inactivo'
                  ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  conductor.estado === 'Activo' 
                    ? 'bg-green-400' 
                    : conductor.estado === 'Inactivo'
                    ? 'bg-gray-400'
                    : 'bg-red-400'
                }`}></div>
                {conductor.estado || 'Activo'}
              </span>
              {diasAsignado > 0 && (
                <span className="text-xs sm:text-sm text-gray-400 truncate">
                  • {diasAsignado} días
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400 mb-1">ID</p>
            <p className="text-sm sm:text-lg font-bold text-white">#{conductor.id}</p>
          </div>
        </div>
        
        {/* Grid de información de contacto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center p-3 bg-surface-secondary rounded-lg min-w-0">
            <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 mr-3 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400">Teléfono</p>
              <p className="text-xs sm:text-sm font-medium text-white truncate">
                {conductor.telefono || 'No registrado'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-surface-secondary rounded-lg min-w-0">
            <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 mr-3 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400">Email</p>
              <p className="text-xs sm:text-sm font-medium text-white truncate">
                {conductor.email || 'No registrado'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-surface-secondary rounded-lg min-w-0">
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 mr-3 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400">INE</p>
              <p className="text-xs sm:text-sm font-medium text-white truncate">
                {conductor.ine || 'No registrado'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-surface-secondary rounded-lg min-w-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 mr-3 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400">Licencia</p>
              <p className="text-xs sm:text-sm font-medium text-white truncate">
                {conductor.licencia || 'No registrada'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Dirección */}
        {conductor.direccion && (
          <div className="mb-4 sm:mb-6 p-3 bg-surface-secondary rounded-lg">
            <div className="flex items-start min-w-0">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-1">Dirección</p>
                <p className="text-xs sm:text-sm font-medium text-white break-words">
                  {conductor.direccion}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Separador */}
        <div className="border-t border-gray-700 my-4 sm:my-6"></div>
        
        {/* Información financiera */}
        <div className="space-y-3 sm:space-y-4">
          <h4 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider">
            Información de Renta
          </h4>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl p-3 sm:p-4 border border-emerald-500/30">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Diario</span>
              </div>
              <p className="text-xs text-emerald-400 mb-1">Renta Diaria</p>
              <p className="text-lg sm:text-2xl font-bold text-emerald-300 truncate">
                ${conductor.rentaDiaria?.toFixed(2) || '400.00'}
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-3 sm:p-4 border border-blue-500/30">
              <div className="flex items-center justify-between mb-2">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">Diario</span>
              </div>
              <p className="text-xs text-blue-400 mb-1">Abono Póliza</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-300 truncate">
                ${conductor.abonoPoliza?.toFixed(2) || '100.00'}
              </p>
            </div>
          </div>
          
          {/* Total diario */}
          <div className="bg-gradient-to-r from-surface-secondary to-gray-800 rounded-xl p-3 sm:p-4 border border-gray-700">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Diario</p>
                <p className="text-xl sm:text-3xl font-bold text-white truncate">
                  ${((conductor.rentaDiaria || 400) + (conductor.abonoPoliza || 100)).toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-1 truncate">Mensual estimado</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-300 truncate">
                  ${(((conductor.rentaDiaria || 400) + (conductor.abonoPoliza || 100)) * 30).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Fechas de asignación */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-surface-secondary rounded-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center min-w-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mr-2 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Fecha de asignación</p>
                <p className="text-xs sm:text-sm font-medium text-white truncate">
                  {formatearFecha(conductor.fechaAsignacion)}
                </p>
              </div>
            </div>
            {conductor.fechaFinAsignacion && (
              <div className="flex items-center min-w-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mr-2 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">Fecha de fin</p>
                  <p className="text-xs sm:text-sm font-medium text-white truncate">
                    {formatearFecha(conductor.fechaFinAsignacion)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 🆕 BOTONES FUNCIONALES */}
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button 
            onClick={onVerContratoClick}
            className="flex-1 px-3 sm:px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-lg font-medium text-sm sm:text-base flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Ver Contrato
          </button>
          <button 
            onClick={onCambiarConductorClick}
            className="flex-1 px-3 sm:px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-lg font-medium text-sm sm:text-base flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Cambiar Conductor
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleConductorPanel;
