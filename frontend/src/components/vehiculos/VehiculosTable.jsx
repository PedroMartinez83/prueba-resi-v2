// frontend/src/components/vehiculos/VehiculosTable.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Edit, Trash2, FileWarning, MoreVertical, AlertTriangle, Wrench, X, Check, ClipboardCheck } from 'lucide-react';

const VehiculosTable = ({
  vehiculos,
  onEdit,
  onDelete,
  onProcesarBaja,
  onOpenInventario,
  puedeProcesarSolicitudesBaja = false
}) => {
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(null);
  const rolConPermiso = Boolean(puedeProcesarSolicitudesBaja);

  const getEstadoColor = (estado) => {
    const colores = {
      'Disponible': 'text-green-400 bg-green-500/20',
      'Rentado': 'text-blue-400 bg-blue-500/20',
      'Asignado': 'text-blue-400 bg-blue-500/20',
      'Mantenimiento': 'text-yellow-400 bg-yellow-500/20',
      'Siniestro': 'text-red-400 bg-red-500/20',
      'Baja': 'text-gray-400 bg-gray-500/20'
    };
    return colores[estado] || 'text-gray-400 bg-gray-500/20';
  };

  // 🆕 MEJORA #3: Alertas de Mantenimiento
  const getAlertaMantenimiento = (vehiculo) => {
    const kmActual = vehiculo.KilometrajeActual || 0;
    const kmProximo = vehiculo.ProximoMantenimiento || 0;
    
    if (kmProximo === 0) return null;
    
    const diferencia = kmProximo - kmActual;
    
    // Mantenimiento vencido
    if (diferencia <= 0) {
      return {
        tipo: 'vencido',
        icono: AlertTriangle,
        color: 'text-red-500',
        bgColor: 'bg-red-500/20',
        mensaje: 'Mantenimiento vencido'
      };
    }
    
    // Alerta preventiva (≤1000 km)
    if (diferencia <= 1000) {
      return {
        tipo: 'preventivo',
        icono: Wrench,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/20',
        mensaje: `${diferencia} km para servicio`
      };
    }
    
    return null;
  };

  // 🆕 MEJORA #4: Función para procesar solicitud de baja
  const handleProcesarSolicitud = async (id, accion) => {
    if (!confirm(`¿Estás seguro de ${accion.toUpperCase()} esta solicitud de baja?`)) return;
    try {
        // Asumiendo que tienes una instancia de axios o fetch
        // await api.post(`/vehiculos/${id}/gestionar-baja`, { accion });
        // O llama a una función que te pasen por props
        onProcesarBaja(id, accion); // Suponiendo que pasas esta función desde el padre
    } catch {
        alert('Error al procesar');
    }
};

  // Cerrar menú al hacer click fuera
  React.useEffect(() => {
    const cerrar = () => setMenuAbierto(null);
    if (menuAbierto) {
      document.addEventListener('click', cerrar);
      return () => document.removeEventListener('click', cerrar);
    }
  }, [menuAbierto]);

  return (
    <div className="glass rounded-lg border border-primary/20 overflow-hidden">
      {/*   1. Cambiamos a overflow-auto, limitamos la altura y estilizamos la barra   */}
      <div className="overflow-auto max-h-[60vh] sidebar-scroll">
        
        {/*   2. Agregamos relative y un min-w para que las columnas no se apachurren   */}
        <table className="w-full min-w-[800px] relative">
          
          {/*   3. Quitamos el /50 del fondo y agregamos sticky top-0 z-10   */}
          <thead className="bg-surface-primary border-b border-primary/20 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">ID</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Vehículo</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Placa</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Conductor</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Estado</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Kilometraje</th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehiculos.map((vehiculo) => {  
              // Variable para saber si es una solicitud pendiente
              const status = vehiculo.Estado || vehiculo.estado || '';
              const esSolicitudPendiente = status === 'Solicitud_baja';
                
              const alerta = getAlertaMantenimiento(vehiculo);
              const IconoAlerta = alerta?.icono;  
                return (
                  <tr 
                    key={vehiculo.id} 
                    onClick={() => navigate(`/admin/vehiculos/${vehiculo.id}`)}
                    className={`border-b border-primary/10 transition-colors cursor-pointer ${
             esSolicitudPendiente ? 'bg-orange-500/10 hover:bg-orange-500/20' : 'hover:bg-primary/5'
          }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
                          {vehiculo.TipoSocio || 'SD'}
                        </span>
                        <span className="text-white font-mono text-sm">
                          {vehiculo.NumeroVehiculo || 'N/A'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          vehiculo.tiene_inventario_inicial
                            ? 'text-green-300 border-green-500/30 bg-green-500/10'
                            : 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10'
                        }`}>
                          {vehiculo.tiene_inventario_inicial ? 'Inv. inicial OK' : 'Inv. inicial pendiente'}
                        </span>
                        {vehiculo.inventario_alerta && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border text-orange-300 border-orange-500/30 bg-orange-500/10">
                            {vehiculo.inventario_alerta}
                          </span>
                        )}
                      </div>
                    </td>
                    
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Car className="w-6 h-6 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {vehiculo.Marca || 'Sin marca'} {vehiculo.Modelo || ''}
                          </p>
                          <p className="text-gray-400 text-sm truncate">
                            {vehiculo.Año ? `${vehiculo.Año}` : ''} 
                            {vehiculo.Color ? ` • ${vehiculo.Color}` : ''}
                            {vehiculo.TipoVehiculo ? ` • ${vehiculo.TipoVehiculo}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-3 px-4">
                      <span className="text-white font-mono text-sm">
                        {vehiculo.Placa || 'Sin placa'}
                      </span>
                    </td>
                    
                    <td className="py-3 px-4">
                      {vehiculo.ConductorInfo ? (
                        <div>
                          <span className="text-white text-sm">
                            {vehiculo.ConductorInfo.nombre}
                          </span>
                          <p className="text-gray-500 text-xs">
                            {vehiculo.ConductorInfo.telefono}
                          </p>
                        </div>
                      ) : vehiculo.Conductores && vehiculo.Conductores.length > 0 ? (
                        <div>
                          <span className="text-white text-sm">
                            {vehiculo.Conductores[0].nombre || vehiculo.Conductores[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-sm">Sin asignar</span>
                      )}
                    </td>
                    
                    <td className="py-3 px-4">
                      {esSolicitudPendiente ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          <AlertTriangle className="w-3 h-3" /> Solicitud Baja
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(vehiculo.Estado)}`}>
                          <div className="w-2 h-2 rounded-full bg-current"></div>
                          {vehiculo.Estado || 'Sin estado'}
                        </span>
                      )}
                    </td>
                    
                    {/* 🆕 Columna de Kilometraje con Alertas */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm">
                          {(vehiculo.KilometrajeActual || 0).toLocaleString()}
                        </span>
                        {alerta && (
                          <div 
                            className={`p-1 rounded ${alerta.bgColor} group relative`}
                            title={alerta.mensaje}
                          >
                            <IconoAlerta className={`w-4 h-4 ${alerta.color}`} />
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                              {alerta.mensaje}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>           
                    
            <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center">
              
              {/* CASO 1: ES UNA SOLICITUD PENDIENTE Y PUEDO APROBAR */}
              {esSolicitudPendiente && rolConPermiso ? (
                 <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                         e.stopPropagation();
                         e.preventDefault();
                        console.log('✅ Click en Aprobar');
                         handleProcesarSolicitud(vehiculo.id, 'aprobar'); // Necesitas definir esta función
                      }}
                      className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                      title="Aprobar Baja"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                         e.stopPropagation();
                          e.preventDefault();
                          console.log('❌ Click en Rechazar');
                         handleProcesarSolicitud(vehiculo.id, 'rechazar');
                      }}
                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      title="Rechazar (Regresar a Disponible)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                 </div>
              ) : (
              
                  /* CASO 2: VEHÍCULO NORMAL O MENU BLOQUEADO */
                  <div className="relative">
                    {/* Lógica de Bloqueo:
                        Se bloquea SI: (Es solicitud pendiente) Y (NO tengo permiso de jefe)
                    */}
                    {(() => {
                      const bloqueoPorSolicitud = esSolicitudPendiente && !rolConPermiso;

                      return (
                        <>
                          <button
                            disabled={bloqueoPorSolicitud} // 🔒 Deshabilita el click real
                            onClick={(e) => {
                              if (bloqueoPorSolicitud) return;
                              e.stopPropagation();
                              setMenuAbierto(menuAbierto === vehiculo.id ? null : vehiculo.id);
                            }}
                            // 🎨 Cambiamos el estilo visualmente si está bloqueado
                            className={`p-2 rounded-lg transition-colors ${
                              bloqueoPorSolicitud 
                                ? 'opacity-30 cursor-not-allowed text-gray-600' // Estilo bloqueado (oscuro y sin manita)
                                : 'hover:bg-gray-700 text-gray-400'             // Estilo normal
                            }`}
                            title={bloqueoPorSolicitud ? "Vehículo en proceso de baja - Acciones bloqueadas" : "Más acciones"}
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {/* Dropdown Menu (Solo se renderiza si no está bloqueado y está abierto) */}
                          {!bloqueoPorSolicitud && menuAbierto === vehiculo.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/admin/siniestros/vehiculo/${vehiculo.id}/historial`);
                                  setMenuAbierto(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-orange-400 hover:bg-gray-700 transition-colors flex items-center gap-2 first:rounded-t-lg"
                              >
                                <FileWarning className="w-4 h-4" />
                                Ver Siniestros
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenInventario?.(vehiculo);
                                  setMenuAbierto(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-cyan-300 hover:bg-gray-700 transition-colors flex items-center gap-2"
                              >
                                <ClipboardCheck className="w-4 h-4" />
                                Llenar inventario
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(vehiculo);
                                  setMenuAbierto(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-blue-400 hover:bg-gray-700 transition-colors flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Editar Vehículo
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(vehiculo.id);
                                  setMenuAbierto(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors flex items-center gap-2 last:rounded-b-lg border-t border-gray-700"
                              >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                      )}
                    </div>
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VehiculosTable;
