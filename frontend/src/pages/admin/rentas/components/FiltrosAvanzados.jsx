import React from 'react';
import { Filter, X, Search } from 'lucide-react';

const FiltrosAvanzados = ({ 
  filtros, 
  setFiltros, 
  opciones, 
  onBuscar, 
  onLimpiar 
}) => {
  
  const handleChange = (campo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      status: '',
      conductor_id: '',
      vehiculo_id: '',
      metodo_pago: '',
      fecha_desde: '',
      fecha_hasta: '',
      busqueda: ''
    });
    if (onLimpiar) onLimpiar();
  };

  const tienesFiltrosActivos = Object.values(filtros).some(v => v !== '');

  return (
    <div className="glass border border-white/10 rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <h3 className="text-white font-semibold">Filtros Avanzados</h3>
          {tienesFiltrosActivos && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
              Activos
            </span>
          )}
        </div>
        
        {tienesFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Búsqueda rápida */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por conductor, vehículo o folio..."
          value={filtros.busqueda || ''}
          onChange={(e) => handleChange('busqueda', e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Grid de filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estado */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Estado</label>
          <select
            value={filtros.status || ''}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
          >
            <option value="">Todos</option>
            {opciones?.estados?.map(estado => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>
        </div>

        {/* Conductor */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Conductor</label>
          <select
            value={filtros.conductor_id || ''}
            onChange={(e) => handleChange('conductor_id', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
          >
            <option value="">Todos</option>
            {opciones?.conductores?.map(conductor => (
              <option key={conductor.id} value={conductor.id}>
                {conductor.nombre_conductor}
              </option>
            ))}
          </select>
        </div>

        {/* Vehículo */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Vehículo</label>
          <select
            value={filtros.vehiculo_id || ''}
            onChange={(e) => handleChange('vehiculo_id', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
          >
            <option value="">Todos</option>
            {opciones?.vehiculos?.map(vehiculo => (
              <option key={vehiculo.id} value={vehiculo.id}>
                {vehiculo.numero_vehiculo}
              </option>
            ))}
          </select>
        </div>

        {/* Método de Pago */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Método de Pago</label>
          <select
            value={filtros.metodo_pago || ''}
            onChange={(e) => handleChange('metodo_pago', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
          >
            <option value="">Todos</option>
            {opciones?.metodos_pago?.map(metodo => (
              <option key={metodo} value={metodo}>{metodo}</option>
            ))}
          </select>
        </div>

        {/* Fecha Desde */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Fecha Desde</label>
          <input
            type="date"
            value={filtros.fecha_desde || ''}
            onChange={(e) => handleChange('fecha_desde', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Fecha Hasta */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Fecha Hasta</label>
          <input
            type="date"
            value={filtros.fecha_hasta || ''}
            onChange={(e) => handleChange('fecha_hasta', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Botón Buscar */}
        <div className="md:col-span-2 lg:col-span-2 flex items-end">
          <button
            onClick={onBuscar}
            className="w-full px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Search className="h-4 w-4" />
            Buscar
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltrosAvanzados;