import { useState, useEffect } from 'react';
import { X, User, UserPlus, DollarSign, AlertCircle, CheckCircle, Search } from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const mapConductorContrato = (conductor = {}) => ({
  id: conductor.id,
  nombre: conductor.nombre || '',
  telefono: conductor.telefono || '',
  email: conductor.email || '',
  calificacion: Number(conductor.calificacion || 0),
  tiene_asignacion: Boolean(conductor.tiene_asignacion),
  vehiculo_asignado_numero: conductor.vehiculo_asignado_numero || null
});

const CambiarConductorModal = ({ isOpen, onClose, vehiculo, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [conductoresDisponibles, setConductoresDisponibles] = useState([]);
  const [estadisticas, setEstadisticas] = useState({ total: 0, disponibles: 0, ocupados: 0 });
  const [asignacionActual, setAsignacionActual] = useState(null);
  const [conductorSeleccionado, setConductorSeleccionado] = useState(null);
  const [rentaDiaria, setRentaDiaria] = useState(400);
  const [abonoPoliza, setAbonoPoliza] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (isOpen && vehiculo) {
      cargarDatos();
    }
  }, [isOpen, vehiculo]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Cargar asignación actual
      const resAsignacion = await fetch(
        `${API_BASE_URL}/admin/asignaciones/activa/${vehiculo.id}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const dataAsignacion = await resAsignacion.json();
      if (dataAsignacion.success) {
        setAsignacionActual(dataAsignacion.asignacion);
        setRentaDiaria(parseFloat(dataAsignacion.asignacion.renta_diaria) || 400);
        setAbonoPoliza(parseFloat(dataAsignacion.asignacion.abono_poliza_mantenimiento) || 100);
      }

      // Cargar conductores con prioridad
      const resConductores = await fetch(
        `${API_BASE_URL}/admin/asignaciones/conductores-disponibles`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const dataConductores = await resConductores.json();
      if (dataConductores.success) {
        const conductoresNormalizados = (dataConductores.conductores || [])
          .map(mapConductorContrato)
          .filter((conductor) => conductor.id != null);
        setConductoresDisponibles(conductoresNormalizados);
        setEstadisticas(
          dataConductores.estadisticas || {
            total: conductoresNormalizados.length,
            disponibles: conductoresNormalizados.filter(c => !c.tiene_asignacion).length,
            ocupados: conductoresNormalizados.filter(c => c.tiene_asignacion).length
          }
        );
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarConductor = async () => {
    if (!conductorSeleccionado) {
      alert('❌ Selecciona un conductor');
      return;
    }

    if (!rentaDiaria || rentaDiaria < 0) {
      alert('❌ La renta diaria debe ser mayor a 0');
      return;
    }

    // Advertencia si el conductor ya está ocupado
    if (conductorSeleccionado.tiene_asignacion) {
      if (!confirm(`⚠️ ADVERTENCIA: ${conductorSeleccionado.nombre} ya está asignado al vehículo ${conductorSeleccionado.vehiculo_asignado_numero}.\n\n¿Deseas reasignarlo a este vehículo de todas formas?`)) {
        return;
      }
    }

    if (!confirm(`¿Cambiar conductor a ${conductorSeleccionado.nombre}?`)) {
      return;
    }

    try {
      setGuardando(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${API_BASE_URL}/admin/asignaciones/cambiar-conductor`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vehiculo_id: vehiculo.id,
            conductor_actual_id: asignacionActual?.conductor_id,
            conductor_nuevo_id: conductorSeleccionado.id,
            renta_diaria: parseFloat(rentaDiaria),
            abono_poliza_mantenimiento: parseFloat(abonoPoliza)
          })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        alert('✅ Conductor cambiado exitosamente');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        alert('❌ Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al cambiar conductor');
    } finally {
      setGuardando(false);
    }
  };

  const conductoresFiltrados = conductoresDisponibles.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.nombre || '').toLowerCase().includes(term) ||
      (c.telefono || '').includes(searchTerm)
    );
  });

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/20 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-red-600 p-4 sm:p-6 flex justify-between items-center rounded-t-xl">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
              <UserPlus className="w-6 h-6" />
              Cambiar Conductor
            </h2>
            <p className="text-orange-100 text-sm">
              Vehículo {vehiculo?.NumeroVehiculo || vehiculo?.numero_vehiculo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-all"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-400">Cargando información...</p>
            </div>
          ) : (
            <>
              {/* Conductor Actual */}
              {asignacionActual && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-400" />
                    Conductor Actual
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-gray-400 text-sm">Nombre</p>
                      <p className="text-white font-semibold">{asignacionActual.nombre_conductor}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Desde</p>
                      <p className="text-white">{formatDate(asignacionActual.fecha_inicio)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Renta Actual</p>
                      <p className="text-white font-bold">${parseFloat(asignacionActual.renta_diaria).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Búsqueda */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Buscar Conductor</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nombre o teléfono..."
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Lista de Conductores con Indicadores */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold">
                    Conductores ({conductoresFiltrados.length})
                  </h3>
                  {estadisticas.total > 0 && (
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        <span className="text-gray-400">Disponible ({estadisticas.disponibles})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <span className="text-gray-400">Ocupado ({estadisticas.ocupados})</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {conductoresFiltrados.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-400">No se encontraron conductores</p>
                    </div>
                  ) : (
                    conductoresFiltrados.map((conductor) => {
                      const estaDisponible = !conductor.tiene_asignacion;
                      
                      return (
                        <button
                          key={conductor.id}
                          onClick={() => setConductorSeleccionado(conductor)}
                          className={`w-full p-4 rounded-lg border transition-all text-left ${
                            conductorSeleccionado?.id === conductor.id
                              ? 'bg-orange-500/20 border-orange-500/50 ring-2 ring-orange-500/50'
                              : estaDisponible
                              ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                              : 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-white font-semibold">{conductor.nombre || 'Sin nombre'}</p>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  estaDisponible 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {estaDisponible ? 'Disponible' : 'Ocupado'}
                                </span>
                              </div>
                              <p className="text-gray-400 text-sm">{conductor.telefono || 'Sin teléfono'}</p>
                              {!estaDisponible && conductor.vehiculo_asignado_numero && (
                                <p className="text-yellow-400 text-xs mt-1">
                                  📍 Asignado a: {conductor.vehiculo_asignado_numero}
                                </p>
                              )}
                            </div>
                            {conductorSeleccionado?.id === conductor.id && (
                              <CheckCircle className="w-6 h-6 text-orange-400" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Configuración de Renta */}
              {conductorSeleccionado && (
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    Configuración de Renta
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 text-sm mb-2 block">Renta Diaria</label>
                      <input
                        type="number"
                        value={rentaDiaria}
                        onChange={(e) => setRentaDiaria(e.target.value)}
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm mb-2 block">Abono Póliza/Mant.</label>
                      <input
                        type="number"
                        value={abonoPoliza}
                        onChange={(e) => setAbonoPoliza(e.target.value)}
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-green-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-green-400 text-sm">
                      <strong>Total Diario:</strong> ${(parseFloat(rentaDiaria) + parseFloat(abonoPoliza)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCambiarConductor}
                  disabled={!conductorSeleccionado || guardando}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {guardando ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      Cambiando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Cambiar Conductor
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CambiarConductorModal;
