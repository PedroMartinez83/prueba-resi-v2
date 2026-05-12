import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Save, X, Upload, AlertTriangle, MapPin, 
  Calendar, DollarSign, FileText, Camera,
  CheckCircle, XCircle, AlertCircle, Loader2,
  Gauge
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const SiniestrosRegistrar = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loadingOpciones, setLoadingOpciones] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState({});
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  
  const [opciones, setOpciones] = useState({
    vehiculos: [],
    conductores: [],
    estados: [],
    gravedades: [],
    clasificaciones: [],
    tipos_siniestro: []
  });

  const [formData, setFormData] = useState({
    vehiculo_id: '',
    conductor_id: '',
    fecha_incidente: '',
    hora_incidente: '',
    ubicacion: '',
    tipo_siniestro: '',
    clasificacion: '',
    descripcion: '',
    gravedad: 'Leve',
    kilometraje_actual: '',
    costo_estimado: '',
    involucro_terceros: false,
    involucro_seguro: false,
    poliza_seguro: '',
    aseguradora: '',
    observaciones: ''
  });

  const [fotos, setFotos] = useState([]);

  useEffect(() => {
    cargarOpciones();
  }, []);

  const cargarOpciones = async () => {
    try {
      setLoadingOpciones(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/siniestros/opciones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Opciones cargadas:', {
          total_vehiculos: data.opciones.vehiculos?.length || 0,
          total_conductores: data.opciones.conductores?.length || 0,
          primeros_3_conductores: data.opciones.conductores?.slice(0, 3)
        });
        setOpciones(data.opciones);
      } else {
        console.error('❌ Error en respuesta de opciones:', data);
      }
    } catch (error) {
      console.error('❌ Error al cargar opciones:', error);
    } finally {
      setLoadingOpciones(false);
    }
  };

  const handleVehiculoChange = async (vehiculoId) => {
    if (!vehiculoId) {
      setVehiculoSeleccionado(null);
      setFormData(prev => ({
        ...prev,
        vehiculo_id: '',
        conductor_id: '',
        kilometraje_actual: '',
        poliza_seguro: '',
        aseguradora: ''
      }));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/vehiculos/${vehiculoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success && data.vehiculo) {
        const vehiculo = data.vehiculo;
        setVehiculoSeleccionado(vehiculo);

        const conductorId = vehiculo.ConductorInfo?.id || '';
        
        setFormData(prev => ({
          ...prev,
          vehiculo_id: vehiculoId,
          conductor_id: conductorId ? String(conductorId) : '',
          kilometraje_actual: vehiculo.kilometraje || '',
          poliza_seguro: vehiculo.NumeroPolizaCompleto || vehiculo.PolizaSeguro || '',
          aseguradora: vehiculo.Aseguradora || ''
        }));

        if (conductorId || vehiculo.NumeroPolizaCompleto || vehiculo.PolizaSeguro) {
          console.log('✅ Datos autocompletados:', {
            conductor_id_final: conductorId ? String(conductorId) : '',
            conductor_nombre: vehiculo.ConductorInfo?.nombre || 'Sin asignar',
            kilometraje: vehiculo.kilometraje || 'N/A',
            poliza: vehiculo.NumeroPolizaCompleto || vehiculo.PolizaSeguro || 'Sin póliza',
            aseguradora: vehiculo.Aseguradora || 'Sin aseguradora'
          });
        }
      }
    } catch (error) {
      console.error('❌ Error al obtener detalles del vehículo:', error);
      setFormData(prev => ({ ...prev, vehiculo_id: vehiculoId }));
    }
  };

  const validateField = (name, value) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'vehiculo_id':
        if (!value) newErrors.vehiculo_id = 'Vehículo es requerido';
        else delete newErrors.vehiculo_id;
        break;
      case 'fecha_incidente':
        if (!value) newErrors.fecha_incidente = 'Fecha es requerida';
        else if (new Date(value) > new Date()) {
          newErrors.fecha_incidente = 'La fecha no puede ser futura';
        } else delete newErrors.fecha_incidente;
        break;
      case 'tipo_siniestro':
        if (!value) newErrors.tipo_siniestro = 'Tipo es requerido';
        else delete newErrors.tipo_siniestro;
        break;
      case 'costo_estimado':
        if (value && value < 0) {
          newErrors.costo_estimado = 'El costo no puede ser negativo';
        } else delete newErrors.costo_estimado;
        break;
      case 'kilometraje_actual':
        if (value && value < 0) {
          newErrors.kilometraje_actual = 'El kilometraje no puede ser negativo';
        } else delete newErrors.kilometraje_actual;
        break;
      default:
        break;
    }

    setErrors(newErrors);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    validateField(name, newValue);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFotosChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    const filesArray = Array.from(files);
    
    if (fotos.length + filesArray.length > 10) {
      alert('⚠️ Máximo 10 fotos permitidas');
      return;
    }

    const validFiles = filesArray.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`❌ ${file.name} no es una imagen válida`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`❌ ${file.name} es muy grande (máx 10MB)`);
        return false;
      }
      return true;
    });

    const newFotos = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB'
    }));

    setFotos(prev => [...prev, ...newFotos]);
  };

  const eliminarFoto = (index) => {
    URL.revokeObjectURL(fotos[index].preview);
    setFotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalErrors = {};
    if (!formData.vehiculo_id) finalErrors.vehiculo_id = 'Requerido';
    if (!formData.fecha_incidente) finalErrors.fecha_incidente = 'Requerido';
    if (!formData.tipo_siniestro) finalErrors.tipo_siniestro = 'Requerido';

    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);
      alert('⚠️ Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const token = localStorage.getItem('token');
      const hayFotos = fotos.length > 0;
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      let response;

      if (!hayFotos) {
        console.log('📄 Enviando como JSON (sin fotos)');
        
        const dataToSend = { ...formData };
        if (!dataToSend.conductor_id || dataToSend.conductor_id === '') {
          delete dataToSend.conductor_id;
        }
        
        if (dataToSend.costo_estimado) {
          dataToSend.costo_estimado = parseFloat(dataToSend.costo_estimado);
        }
        if (dataToSend.kilometraje_actual) {
          dataToSend.kilometraje_actual = parseInt(dataToSend.kilometraje_actual);
        }

        console.log('📤 Datos JSON:', dataToSend);

        response = await fetch(`${API_BASE_URL}/admin/siniestros`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dataToSend)
        });

      } else {
        console.log('📦 Enviando como FormData (con', fotos.length, 'fotos)');
        
        const formDataToSend = new FormData();

        Object.entries(formData).forEach(([key, value]) => {
          if (key === 'conductor_id' && (!value || value === '')) {
            return;
          }
          formDataToSend.append(key, value || '');
        });

        fotos.forEach((foto, index) => {
          console.log(`📸 Agregando foto ${index + 1}:`, foto.file.name, `(${foto.size})`);
          formDataToSend.append('fotos', foto.file);
        });

        console.log('📋 FormData completo:');
        for (let [key, value] of formDataToSend.entries()) {
          if (key === 'fotos') {
            console.log(`  ${key}:`, value.name, value.size);
          } else {
            console.log(`  ${key}:`, value);
          }
        }

        response = await fetch(`${API_BASE_URL}/admin/siniestros`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formDataToSend
        });
      }

      console.log('📥 Response status:', response.status);

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();
      console.log('📦 Response data:', data);

      if (data.success) {
        const nuevoSiniestro = data.siniestro;
        const numeroVehiculoConfirmacion =
          vehiculoSeleccionado?.numero_vehiculo ||
          vehiculoSeleccionado?.NumeroVehiculo ||
          opciones.vehiculos.find(v => String(v.id) === String(formData.vehiculo_id))?.numero_vehiculo ||
          'N/A';
        
        fotos.forEach(foto => URL.revokeObjectURL(foto.preview));
        
        setTimeout(() => {
          const crearMantenimiento = window.confirm(
            '✅ Siniestro registrado exitosamente\n\n' +
            `📋 Folio: #${nuevoSiniestro.folio_siniestro}\n` +
            `🚗 Vehículo: ${numeroVehiculoConfirmacion}\n` +
            (hayFotos ? `📸 Fotos subidas: ${fotos.length}\n` : '') +
            '\n🔧 ¿Deseas crear la Orden de Mantenimiento (reparación) ahora?\n\n' +
            '• SÍ → Programar mantenimiento con datos pre-llenados\n' +
            '• NO → Ir a lista de siniestros'
          );
          
          if (crearMantenimiento) {
            const datosParaMantenimiento = {
              vehiculo_id: nuevoSiniestro.vehiculo_id,
              conductor_id: nuevoSiniestro.conductor_id || null,
              siniestro_id: nuevoSiniestro.id,
              siniestro_folio: nuevoSiniestro.folio_siniestro,
              tipo_servicio: 'Reparación por Siniestro',
              kilometraje_servicio: formData.kilometraje_actual || 0,
              observaciones: `Reparación por Siniestro #${nuevoSiniestro.folio_siniestro}: ${formData.descripcion || 'Reparación necesaria'}`,
              costo_estimado: formData.costo_estimado || 0,
              vehiculo_info: vehiculoSeleccionado
            };
            
            console.log('🚀 Navegando a mantenimiento con datos:', datosParaMantenimiento);
            
            navigate('/admin/mantenimientos/programar', {
              state: datosParaMantenimiento
            });
          } else {
            navigate('/admin/siniestros/lista');
          }
        }, 500);
      } else {
        alert('❌ ' + (data.message || 'Error al registrar siniestro'));
        setUploadProgress(0);
      }
    } catch (error) {
      console.error('❌ Error completo:', error);
      alert('❌ Error al registrar siniestro: ' + error.message);
      setUploadProgress(0);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      {loadingOpciones ? (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm p-12 rounded-xl border border-white/10 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-400 mb-4" />
            <p className="text-gray-400">Cargando formulario...</p>
          </div>
        </div>
      ) : (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            Registrar Nuevo Siniestro
          </h1>
          <p className="text-gray-400 mt-1">Complete la información del incidente con el mayor detalle posible</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Información del Incidente
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Vehículo <span className="text-red-500">*</span>
                </label>
                <select
                  name="vehiculo_id"
                  value={formData.vehiculo_id}
                  onChange={(e) => handleVehiculoChange(e.target.value)}
                  className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500 ${
                    errors.vehiculo_id ? 'border-red-500' : ''
                  }`}
                >
                  <option value="" className="bg-slate-800">Seleccionar vehículo</option>
                  {opciones.vehiculos.map(v => (
                    <option key={v.id} value={v.id} className="bg-slate-800">
                      {v.numero_vehiculo} - {v.marca} {v.modelo} ({v.placa})
                    </option>
                  ))}
                </select>
                {errors.vehiculo_id && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {errors.vehiculo_id}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Conductor 
                  {formData.conductor_id && vehiculoSeleccionado?.ConductorInfo && (
                    <span className="text-green-600 text-xs ml-2">
                      ✓ autocompletado: {vehiculoSeleccionado.ConductorInfo.nombre}
                    </span>
                  )}
                </label>
                <select
                  name="conductor_id"
                  value={formData.conductor_id || ''}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500 ${
                    formData.conductor_id && vehiculoSeleccionado?.ConductorInfo ? 'border-green-300 bg-green-500/10' : ''
                  }`}
                >
                  <option value="" className="bg-slate-800">Sin conductor / Desconocido</option>
                  {opciones.conductores.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-800">
                      {c.nombre_conductor}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Fecha del Incidente <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="fecha_incidente"
                  value={formData.fecha_incidente}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500 ${
                    errors.fecha_incidente ? 'border-red-500' : ''
                  }`}
                />
                {errors.fecha_incidente && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {errors.fecha_incidente}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Hora del Incidente
                </label>
                <input
                  type="time"
                  name="hora_incidente"
                  value={formData.hora_incidente}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  Kilometraje Actual
                  {vehiculoSeleccionado?.kilometraje && (
                    <span className="text-green-600 text-xs">
                      ✓ autocompletado: {vehiculoSeleccionado.kilometraje.toLocaleString()} km
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  name="kilometraje_actual"
                  value={formData.kilometraje_actual}
                  onChange={handleChange}
                  placeholder="Ej: 45000"
                  min="0"
                  className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 ${
                    vehiculoSeleccionado?.kilometraje ? 'border-green-300 bg-green-500/10' : ''
                  } ${errors.kilometraje_actual ? 'border-red-500' : ''}`}
                />
                {errors.kilometraje_actual && (
                  <p className="text-red-500 text-xs mt-1">{errors.kilometraje_actual}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  💡 Necesario para crear la orden de mantenimiento
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  <MapPin className="inline w-4 h-4 mr-1" />
                  Ubicación
                </label>
                <input
                  type="text"
                  name="ubicacion"
                  value={formData.ubicacion}
                  onChange={handleChange}
                  placeholder="Calle, colonia, ciudad..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">Clasificación del Siniestro</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tipo de Siniestro <span className="text-red-500">*</span>
                </label>
                <select
                  name="tipo_siniestro"
                  value={formData.tipo_siniestro}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500 ${
                    errors.tipo_siniestro ? 'border-red-500' : ''
                  }`}
                >
                  <option value="" className="bg-slate-800">Seleccionar</option>
                  {opciones.tipos_siniestro.map(tipo => (
                    <option key={tipo} value={tipo} className="bg-slate-800">{tipo}</option>
                  ))}
                </select>
                {errors.tipo_siniestro && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {errors.tipo_siniestro}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Clasificación
                </label>
                <select
                  name="clasificacion"
                  value={formData.clasificacion}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" className="bg-slate-800">Seleccionar</option>
                  {opciones.clasificaciones.map(clas => (
                    <option key={clas} value={clas} className="bg-slate-800">{clas}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Gravedad <span className="text-red-500">*</span>
                </label>
                <select
                  name="gravedad"
                  value={formData.gravedad}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  {opciones.gravedades.map(grav => (
                    <option key={grav} value={grav} className="bg-slate-800">{grav}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Descripción del Incidente
              </label>
              <textarea
                name="descripcion"
                value={formData.descripcion}
                onChange={handleChange}
                rows="4"
                placeholder="Describe detalladamente lo sucedido: ¿qué pasó?, ¿cómo sucedió?, ¿quién estaba involucrado?..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Información Financiera y Seguro
            </h2>

            {(vehiculoSeleccionado?.NumeroPolizaCompleto || vehiculoSeleccionado?.PolizaSeguro) && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg backdrop-blur-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-300 mb-1">
                      Información de seguro del vehículo
                    </p>
                    <div className="text-sm text-blue-200 space-y-1">
                      <p>📋 <strong>Póliza:</strong> {vehiculoSeleccionado.NumeroPolizaCompleto || vehiculoSeleccionado.PolizaSeguro}</p>
                      {vehiculoSeleccionado.Aseguradora && (
                        <p>🏢 <strong>Aseguradora:</strong> {vehiculoSeleccionado.Aseguradora}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Costo Estimado
                </label>
                <input
                  type="number"
                  name="costo_estimado"
                  value={formData.costo_estimado}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 ${
                    errors.costo_estimado ? 'border-red-500' : ''
                  }`}
                />
                {errors.costo_estimado && (
                  <p className="text-red-500 text-xs mt-1">{errors.costo_estimado}</p>
                )}
              </div>

              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="involucro_terceros"
                    checked={formData.involucro_terceros}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-white">Involucró terceros</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="involucro_seguro"
                    checked={formData.involucro_seguro}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-white">Involucró seguro</span>
                </label>
              </div>

              {formData.involucro_seguro && (
                <>
                  <div className="md:col-span-2 border-t border-white/10 pt-4 mt-2">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                      Detalles del Seguro para este Siniestro
                      {(vehiculoSeleccionado?.NumeroPolizaCompleto || vehiculoSeleccionado?.PolizaSeguro) && (
                        <span className="text-green-600 text-xs">(datos del vehículo cargados)</span>
                      )}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Póliza de Seguro
                        </label>
                        <input
                          type="text"
                          name="poliza_seguro"
                          value={formData.poliza_seguro || ''}
                          onChange={handleChange}
                          placeholder="Número de póliza"
                          className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 ${
                            (vehiculoSeleccionado?.NumeroPolizaCompleto || vehiculoSeleccionado?.PolizaSeguro) ? 'border-green-300 bg-green-500/10' : ''
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Aseguradora
                        </label>
                        <input
                          type="text"
                          name="aseguradora"
                          value={formData.aseguradora || ''}
                          onChange={handleChange}
                          placeholder="Nombre de la aseguradora"
                          className={`w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 ${
                            vehiculoSeleccionado?.Aseguradora ? 'border-green-300 bg-green-500/10' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-purple-600" />
              Fotos del Incidente
              <span className="text-sm font-normal text-gray-400">
                ({fotos.length}/10)
              </span>
            </h2>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="fotos"
                accept="image/*"
                multiple
                onChange={handleFotosChange}
                className="hidden"
              />
              <label
                htmlFor="fotos"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className={`p-4 rounded-full mb-3 ${
                  dragActive ? 'bg-blue-500/20' : 'bg-white/10'
                }`}>
                  <Upload className={`w-8 h-8 ${
                    dragActive ? 'text-blue-400' : 'text-gray-400'
                  }`} />
                </div>
                <span className="text-base font-medium text-white mb-1">
                  {dragActive ? '¡Suelta las fotos aquí!' : 'Arrastra fotos aquí o haz clic para seleccionar'}
                </span>
                <span className="text-sm text-gray-400">
                  JPG, PNG, WebP - Máximo 10 fotos de 10MB cada una
                </span>
              </label>
            </div>

            {fotos.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Fotos seleccionadas ({fotos.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {fotos.map((foto, index) => (
                    <div key={index} className="relative group">
                      <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-white/20">
                        <img
                          src={foto.preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => eliminarFoto(index)}
                          className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-700"
                          title="Eliminar foto"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-gray-300 truncate">
                        {foto.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {foto.size}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" />
              Observaciones Adicionales
            </h2>
            <textarea
              name="observaciones"
              value={formData.observaciones}
              onChange={handleChange}
              rows="4"
              placeholder="Información adicional relevante: condiciones climáticas, testigos, daños no visibles en fotos, etc."
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            ></textarea>
          </div>

          {loading && uploadProgress > 0 && (
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">
                  {fotos.length > 0 ? `Subiendo ${fotos.length} foto(s)...` : 'Registrando siniestro...'}
                </span>
                <span className="text-sm font-bold text-blue-400">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex gap-4 justify-end sticky bottom-4 bg-slate-900/95 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-white/20">
            <button
              type="button"
              onClick={() => navigate('/admin/siniestros/lista')}
              disabled={loading}
              className="px-6 py-2.5 border-2 border-white/20 rounded-lg text-white font-medium hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || Object.keys(errors).length > 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Registrar Siniestro
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      )}
    </div>
  );
};

export default SiniestrosRegistrar;
