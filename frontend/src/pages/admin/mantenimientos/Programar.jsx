import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Car,
  Wrench,
  AlertCircle,
  Save,
  User,
  DollarSign,
  Gauge,
  Info
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const ProgramarMantenimiento = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehiculos, setVehiculos] = useState([]);
  const [tiposServicio, setTiposServicio] = useState([]);
  const [talleres, setTalleres] = useState([]);
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [desdeSiniestro, setDesdeSiniestro] = useState(false);
  const [siniestroInfo, setSiniestroInfo] = useState(null);
  
  const [formData, setFormData] = useState({
    vehiculo_id: '',
    tipo_servicio: '',
    fecha_programada: '',
    hora_programada: '09:00',
    kilometraje_servicio: '',
    proximo_servicio_km: '',
    taller: '',
    observaciones: '',
    monto_estimado: ''
  });
  const [errors, setErrors] = useState({});

  // 🔥 Cargar opciones primero
  useEffect(() => {
    cargarOpciones();
  }, []);

  // 🔥 Detectar si viene desde siniestro y cargar datos
useEffect(() => {
  console.log('🔍 Verificando location.state:', location.state);
  
  if (location.state && vehiculos.length > 0) {
    // Detectar por siniestro_id en lugar de desde_siniestro
    if (location.state.siniestro_id || location.state.tipo_servicio === 'Reparación por Siniestro') {
      console.log('✅ Detectado: Viene desde siniestro');
      console.log('📦 State recibido:', location.state);
      cargarDatosDesdeSiniestro(location.state);
    }
  }
}, [location.state, vehiculos]);

  useEffect(() => {
    if (formData.vehiculo_id && !desdeSiniestro) {
      cargarInfoVehiculo(formData.vehiculo_id);
    }
  }, [formData.vehiculo_id]);

  useEffect(() => {
    if (formData.kilometraje_servicio) {
      const proximoKm = parseInt(formData.kilometraje_servicio) + 5000;
      setFormData(prev => ({
        ...prev,
        proximo_servicio_km: proximoKm
      }));
    }
  }, [formData.kilometraje_servicio]);

  // 🔥 NUEVA FUNCIÓN: Cargar datos desde siniestro
const cargarDatosDesdeSiniestro = (state) => {
  console.log('🔄 Cargando datos desde siniestro...');
  
  setDesdeSiniestro(true);
  setSiniestroInfo({
    folio: state.siniestro_folio,
    id: state.siniestro_id
  });

  // 🔥 CONVERTIR STRINGS A NÚMEROS
  const kilometraje = state.kilometraje_servicio 
    ? parseInt(state.kilometraje_servicio) 
    : 0;

  // Pre-llenar formulario con datos del siniestro
  const vehiculoId = state.vehiculo_id ? String(state.vehiculo_id) : '';
  
  setFormData({
    vehiculo_id: vehiculoId,
    tipo_servicio: state.tipo_servicio || 'Reparación por Siniestro',
    fecha_programada: new Date().toISOString().split('T')[0],
    hora_programada: '09:00',
    kilometraje_servicio: kilometraje, // 🔥 COMO NÚMERO
    proximo_servicio_km: kilometraje ? kilometraje + 5000 : '',
    taller: state.taller || '',
    observaciones: state.observaciones || '',
    monto_estimado: state.costo_estimado || ''
  });

  console.log('📝 Datos pre-llenados con kilometraje:', kilometraje);

  // Cargar info completa del vehículo si está disponible
  if (state.vehiculo_info) {
    setVehiculoSeleccionado(state.vehiculo_info);
    console.log('✅ Vehículo pre-cargado:', state.vehiculo_info);
  } else if (vehiculoId) {
    // Si no viene vehiculo_info, buscar en la lista
    const vehiculo = vehiculos.find(v => v.id === parseInt(vehiculoId));
    if (vehiculo) {
      setVehiculoSeleccionado(vehiculo);
      console.log('✅ Vehículo encontrado en lista:', vehiculo);
    }
  }

  console.log('✅ Formulario pre-llenado con datos del siniestro');
};
  const cargarOpciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/opciones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setVehiculos(data.opciones.vehiculos);
        setTiposServicio(data.opciones.tipos_servicio);
        setTalleres(data.opciones.talleres);
        console.log('✅ Opciones cargadas:', data.opciones.vehiculos.length, 'vehículos');
      }
    } catch (error) {
      console.error('Error al cargar opciones:', error);
    }
  };

  const cargarInfoVehiculo = (vehiculoId) => {
    const vehiculo = vehiculos.find(v => v.id === parseInt(vehiculoId));
    if (vehiculo) {
      setVehiculoSeleccionado(vehiculo);
      setFormData(prev => ({
        ...prev,
        kilometraje_servicio: vehiculo.kilometraje_actual || ''
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validarFormulario = () => {
    const newErrors = {};

    if (!formData.vehiculo_id) {
      newErrors.vehiculo_id = 'Debes seleccionar un vehículo';
    }
    if (!formData.tipo_servicio) {
      newErrors.tipo_servicio = 'Debes seleccionar un tipo de servicio';
    }
    if (!formData.fecha_programada) {
      newErrors.fecha_programada = 'Debes seleccionar una fecha';
    } else {
      const fechaSeleccionada = new Date(formData.fecha_programada);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (fechaSeleccionada < hoy) {
        newErrors.fecha_programada = 'La fecha no puede ser anterior a hoy';
      }
      if (fechaSeleccionada.getDay() === 0 || fechaSeleccionada.getDay() === 6) {
        newErrors.fecha_programada = 'Solo se pueden agendar mantenimientos de lunes a viernes';
      }
    }
    if (!formData.hora_programada) {
      newErrors.hora_programada = 'Debes seleccionar una hora';
    } else {
      const [hora, minuto] = formData.hora_programada.split(':').map(Number);
      if (Number.isNaN(hora) || Number.isNaN(minuto)) {
        newErrors.hora_programada = 'Formato de hora inválido';
      } else {
        const inicioEnMinutos = hora * 60 + minuto;
        const finEnMinutos = inicioEnMinutos + 30;
        if (inicioEnMinutos < 540 || finEnMinutos > 1140) {
          newErrors.hora_programada = 'Horarios disponibles de 09:00 a 19:00 en bloques de 30 minutos';
        }
      }
    }
    if (!formData.kilometraje_servicio || formData.kilometraje_servicio <= 0) {
      newErrors.kilometraje_servicio = 'Debes ingresar el kilometraje';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validarFormulario()) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vehiculo_id: parseInt(formData.vehiculo_id),
          tipo_servicio: formData.tipo_servicio,
          fecha_programada: formData.fecha_programada,
          hora_programada: formData.hora_programada,
          kilometraje_servicio: parseInt(formData.kilometraje_servicio),
          proximo_servicio_km: parseInt(formData.proximo_servicio_km),
          taller: formData.taller,
          observaciones: formData.observaciones,
          monto_estimado: formData.monto_estimado ? parseFloat(formData.monto_estimado) : 0
        })
      });

      const data = await response.json();

      if (data.success) {
        if (desdeSiniestro) {
          alert(
            '✅ Mantenimiento programado exitosamente\n\n' +
            `🔧 Folio: #${data.mantenimiento.folio_servicio}\n` +
            `📋 Vinculado con Siniestro #${siniestroInfo.folio}`
          );
        } else {
          alert('✅ Mantenimiento programado exitosamente');
        }
        navigate('/admin/mantenimientos');
      } else {
        alert('❌ Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error al programar mantenimiento:', error);
      alert('❌ Error al programar el mantenimiento');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/admin/mantenimientos')}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Programar Mantenimiento
            </h1>
            <p className="text-gray-400">
              Agenda un nuevo servicio para un vehículo
            </p>
          </div>
        </div>

        {/* 🔥 Banner si viene desde siniestro */}
        {desdeSiniestro && siniestroInfo && (
          <div className="mb-6 bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-xl border border-orange-500/30 p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-semibold mb-1">
                  Mantenimiento vinculado a Siniestro
                </p>
                <p className="text-gray-300 text-sm">
                  Este mantenimiento se creará como resultado del <strong>Siniestro #{siniestroInfo.folio}</strong>
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Los datos del vehículo y observaciones se han cargado automáticamente
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          
          {/* Sección 1: Información del Vehículo */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Car className="w-6 h-6 text-blue-400" />
              Información del Vehículo
              {desdeSiniestro && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  Pre-cargado
                </span>
              )}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Vehículo *
                </label>
                <select
                  name="vehiculo_id"
                  value={formData.vehiculo_id}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border ${
                    errors.vehiculo_id ? 'border-red-500' :
                    desdeSiniestro ? 'border-green-500/50 bg-green-500/5' : 'border-white/20'
                  } rounded-lg text-slate-900 focus:outline-none focus:border-blue-500`}
                >
                  <option value="">Selecciona un vehículo</option>
                  {vehiculos.map(vehiculo => (
                    <option key={vehiculo.id} value={vehiculo.id}>
                      {vehiculo.numero_vehiculo} - {vehiculo.marca} {vehiculo.modelo}
                      {vehiculo.nombre_conductor && ` (${vehiculo.nombre_conductor})`}
                    </option>
                  ))}
                </select>
                {errors.vehiculo_id && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.vehiculo_id}
                  </p>
                )}
              </div>

              {vehiculoSeleccionado && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Conductor Asignado</p>
                    <p className="text-white text-sm font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      {vehiculoSeleccionado.nombre_conductor || vehiculoSeleccionado.ConductorInfo?.nombre || 'Sin asignar'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-1">Kilometraje Actual</p>
                    <p className="text-white text-sm font-semibold flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-purple-400" />
                      {vehiculoSeleccionado.kilometraje_actual?.toLocaleString() || '0'} km
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sección 2: Detalles del Servicio */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-purple-400" />
              Detalles del Servicio
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 block">
                  Tipo de Servicio *
                </label>
                <select
                  name="tipo_servicio"
                  value={formData.tipo_servicio}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-white border ${
                    errors.tipo_servicio ? 'border-red-500' :
                    desdeSiniestro && formData.tipo_servicio ? 'border-green-500/50 bg-green-500/5' : 'border-white/20'
                  } rounded-lg text-slate-900 focus:outline-none focus:border-blue-500`}
                >
                  <option value="">Selecciona el tipo de servicio</option>
                  {tiposServicio.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
                {errors.tipo_servicio && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.tipo_servicio}
                  </p>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Fecha Programada *
                </label>
                <input
                  type="date"
                  name="fecha_programada"
                  value={formData.fecha_programada}
                  onChange={handleChange}
                  min={today}
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    errors.fecha_programada ? 'border-red-500' : 'border-white/20'
                  } rounded-lg text-white focus:outline-none focus:border-blue-500`}
                />
                {errors.fecha_programada && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.fecha_programada}
                  </p>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Hora Programada *
                </label>
                <input
                  type="time"
                  name="hora_programada"
                  value={formData.hora_programada}
                  onChange={handleChange}
                  step="1800"
                  min="09:00"
                  max="19:00"
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    errors.hora_programada ? 'border-red-500' : 'border-white/20'
                  } rounded-lg text-white focus:outline-none focus:border-blue-500`}
                />
                {errors.hora_programada && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.hora_programada}
                  </p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Intervalos de 30 minutos (09:00 - 19:00), solo de lunes a viernes.
                </p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Taller
                </label>
                <input
                  type="text"
                  name="taller"
                  value={formData.taller}
                  onChange={handleChange}
                  placeholder="Nombre del taller"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Kilometraje al Servicio *
                </label>
                <input
                  type="number"
                  name="kilometraje_servicio"
                  value={formData.kilometraje_servicio}
                  onChange={handleChange}
                  placeholder="0"
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    errors.kilometraje_servicio ? 'border-red-500' : 
                    desdeSiniestro && formData.kilometraje_servicio ? 'border-green-500/50 bg-green-500/5' : 'border-white/20'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500`}
                />
                {errors.kilometraje_servicio && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.kilometraje_servicio}
                  </p>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Próximo Servicio (KM)
                </label>
                <input
                  type="number"
                  name="proximo_servicio_km"
                  value={formData.proximo_servicio_km}
                  onChange={handleChange}
                  placeholder="Auto-calculado"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Se calcula automáticamente (+5,000 km)
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 block">
                  Monto Estimado (opcional)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    name="monto_estimado"
                    value={formData.monto_estimado}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    className={`w-full pl-10 pr-4 py-3 bg-white/10 border ${
                      desdeSiniestro && formData.monto_estimado ? 'border-green-500/50 bg-green-500/5' : 'border-white/20'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500`}
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Costo aproximado del servicio (se actualizará al completar)
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-gray-400 text-sm mb-2 block">
                  Observaciones
                  {desdeSiniestro && formData.observaciones && (
                    <span className="ml-2 text-xs text-green-400">
                      (Cargadas desde siniestro)
                    </span>
                  )}
                </label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Detalles adicionales del servicio..."
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    desdeSiniestro && formData.observaciones ? 'border-green-500/50 bg-green-500/5' : 'border-white/20'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none`}
                />
              </div>
            </div>
          </div>

          {/* Resumen */}
          {formData.vehiculo_id && formData.tipo_servicio && formData.fecha_programada && (
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-400" />
                Resumen del Mantenimiento
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 mb-1">Vehículo:</p>
                  <p className="text-white font-semibold">
                    {vehiculoSeleccionado?.numero_vehiculo}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Servicio:</p>
                  <p className="text-white font-semibold">
                    {formData.tipo_servicio}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Fecha:</p>
                  <p className="text-white font-semibold">
                    {formatDate(formData.fecha_programada)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Hora:</p>
                  <p className="text-white font-semibold">
                    {formData.hora_programada}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Taller:</p>
                  <p className="text-white font-semibold">
                    {formData.taller || 'Por definir'}
                  </p>
                </div>
                {desdeSiniestro && (
                  <div className="col-span-2 pt-2 border-t border-white/10">
                    <p className="text-orange-400 text-xs flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Vinculado con Siniestro #{siniestroInfo?.folio}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/admin/mantenimientos')}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Programando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Programar Mantenimiento
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProgramarMantenimiento;
