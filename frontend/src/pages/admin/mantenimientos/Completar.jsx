import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Wrench,
  Calendar,
  User,
  FileText,
  Save,
  Package,
  Paperclip
} from 'lucide-react';
import { API_BASE_URL } from '@/services/api';
import { formatMaintenanceDate } from '@/utils/maintenanceDateFormat';

const MAX_ADMIN_ADJUNTOS = 6;
const MAX_ADMIN_ADJUNTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ADMIN_ADJUNTO_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence'
]);

const CompletarMantenimiento = () => {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mantenimiento, setMantenimiento] = useState(null);
  const [formData, setFormData] = useState({
  fecha_realizada: new Date().toISOString().split('T')[0],
  kilometraje_real: '',
  servicios_realizados: '',
  refacciones: '',
  costo_mano_obra: '',
  costo_refacciones: '',
  mecanico: '',
  observaciones_final: '',
  metodo_distribucion: ''  // ← AÑADIDO
});
  const [errors, setErrors] = useState({});
  const [adjuntosAdmin, setAdjuntosAdmin] = useState([]);

  useEffect(() => {
    cargarMantenimiento();
  }, []);

  useEffect(() => {
    // Auto-calcular costo total
    const costoManoObra = parseFloat(formData.costo_mano_obra) || 0;
    const costoRefacciones = parseFloat(formData.costo_refacciones) || 0;
    const total = costoManoObra + costoRefacciones;
    // No actualizar formData aquí, solo mostrar el total
  }, [formData.costo_mano_obra, formData.costo_refacciones]);

  const cargarMantenimiento = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Extraer el ID correctamente de la URL
      const pathParts = window.location.pathname.split('/');
      const idIndex = pathParts.indexOf('mantenimientos') + 1;
      const id = pathParts[idIndex];
      
      if (!id || isNaN(id)) {
        alert('❌ ID de mantenimiento inválido');
        window.location.href = '/admin/mantenimientos';
        return;
      }
      
      const payload = new FormData();
      payload.append('fecha_realizada', formData.fecha_realizada || '');
      payload.append('kilometraje_real', String(parseInt(formData.kilometraje_real, 10)));
      payload.append('servicios_realizados', formData.servicios_realizados || '');
      payload.append('refacciones', formData.refacciones || '');
      payload.append('costo_mano_obra', String(parseFloat(formData.costo_mano_obra) || 0));
      payload.append('costo_refacciones', String(parseFloat(formData.costo_refacciones) || 0));
      payload.append('costo_total', String(calcularTotal()));
      payload.append('mecanico', formData.mecanico || '');
      payload.append('observaciones_final', formData.observaciones_final || '');
      payload.append('metodo_distribucion', formData.metodo_distribucion || '');
      payload.append('conductor_id', mantenimiento.conductor_id ? String(mantenimiento.conductor_id) : '');
      adjuntosAdmin.forEach((file) => payload.append('adjuntos_admin', file));

      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${id}/completar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: payload
      });

      const data = await response.json();
      if (data.success) {
        setMantenimiento(data.mantenimiento);
        setFormData(prev => ({
          ...prev,
          kilometraje_real: data.mantenimiento.kilometraje_servicio || ''
        }));
      } else {
        alert('❌ Error al cargar mantenimiento');
        window.location.href = '/admin/mantenimientos';
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al cargar mantenimiento');
    } finally {
      setLoading(false);
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

    const handleAdjuntosChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const merged = [...adjuntosAdmin, ...files];
    if (merged.length > MAX_ADMIN_ADJUNTOS) {
      setErrors((prev) => ({
        ...prev,
        adjuntos_admin: `Solo puedes adjuntar hasta ${MAX_ADMIN_ADJUNTOS} archivos`
      }));
      event.target.value = '';
      return;
    }

    for (const file of files) {
      const mime = String(file.type || '').toLowerCase();
      if (!ALLOWED_ADMIN_ADJUNTO_MIME_TYPES.has(mime)) {
        setErrors((prev) => ({
          ...prev,
          adjuntos_admin: 'Solo se permiten archivos JPG, PNG, WEBP, HEIC o PDF'
        }));
        event.target.value = '';
        return;
      }
      if (file.size > MAX_ADMIN_ADJUNTO_SIZE_BYTES) {
        setErrors((prev) => ({
          ...prev,
          adjuntos_admin: `El archivo "${file.name}" supera el limite de 10MB`
        }));
        event.target.value = '';
        return;
      }
    }

    setAdjuntosAdmin(merged);
    setErrors((prev) => ({ ...prev, adjuntos_admin: '' }));
    event.target.value = '';
  };

  const removeAdjunto = (index) => {
    setAdjuntosAdmin((prev) => prev.filter((_, i) => i !== index));
  };
const validarFormulario = () => {
    const newErrors = {};

    if (!formData.fecha_realizada) {
      newErrors.fecha_realizada = 'La fecha es obligatoria';
    }
    if (!formData.kilometraje_real || formData.kilometraje_real <= 0) {
      newErrors.kilometraje_real = 'El kilometraje es obligatorio';
    }
    if (!formData.servicios_realizados || formData.servicios_realizados.trim() === '') {
      newErrors.servicios_realizados = 'Debes especificar los servicios realizados';
    }
    if (!formData.costo_mano_obra || parseFloat(formData.costo_mano_obra) < 0) {
      newErrors.costo_mano_obra = 'El costo debe ser mayor o igual a 0';
    }
    if (!formData.costo_refacciones || parseFloat(formData.costo_refacciones) < 0) {
      newErrors.costo_refacciones = 'El costo debe ser mayor o igual a 0';
    }
    if (!formData.metodo_distribucion) {
  newErrors.metodo_distribucion = 'Debes seleccionar un método de pago';
}

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validarFormulario()) {
      return;
    }

    try {
      setGuardando(true);
      const token = localStorage.getItem('token');
      const id = mantenimiento.id;

      const payload = new FormData();
      payload.append('fecha_realizada', formData.fecha_realizada || '');
      payload.append('kilometraje_real', String(parseInt(formData.kilometraje_real, 10)));
      payload.append('servicios_realizados', formData.servicios_realizados || '');
      payload.append('refacciones', formData.refacciones || '');
      payload.append('costo_mano_obra', String(parseFloat(formData.costo_mano_obra) || 0));
      payload.append('costo_refacciones', String(parseFloat(formData.costo_refacciones) || 0));
      payload.append('costo_total', String(calcularTotal()));
      payload.append('mecanico', formData.mecanico || '');
      payload.append('observaciones_final', formData.observaciones_final || '');
      payload.append('metodo_distribucion', formData.metodo_distribucion || '');
      payload.append('conductor_id', mantenimiento.conductor_id ? String(mantenimiento.conductor_id) : '');
      adjuntosAdmin.forEach((file) => payload.append('adjuntos_admin', file));

      const response = await fetch(`${API_BASE_URL}/admin/mantenimientos/${id}/completar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: payload
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Mantenimiento completado exitosamente');
        window.location.href = '/admin/mantenimientos';
      } else {
        alert('❌ Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al completar el mantenimiento');
    } finally {
      setGuardando(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (date) =>
    formatMaintenanceDate(date, { fallback: '-', month: 'long' });

  const calcularTotal = () => {
    const costoManoObra = parseFloat(formData.costo_mano_obra) || 0;
    const costoRefacciones = parseFloat(formData.costo_refacciones) || 0;
    return costoManoObra + costoRefacciones;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07425E] flex items-center justify-center">
        <div className="text-white text-xl">Cargando datos...</div>
      </div>
    );
  }

  if (!mantenimiento) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#07425E] p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => window.location.href = '/admin/mantenimientos'}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <CheckCircle className="w-10 h-10 text-green-400" />
              Completar Mantenimiento
            </h1>
            <p className="text-gray-400">
              Folio #{String(mantenimiento.folio_servicio).padStart(4, '0')} - {mantenimiento.tipo_servicio}
            </p>
          </div>
        </div>

        {/* Info del Mantenimiento Programado */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6 mb-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Información Original
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-400 mb-1">Vehículo:</p>
              <p className="text-white font-semibold">
                {mantenimiento.numero_vehiculo}
              </p>
              <p className="text-gray-400 text-xs">
                {mantenimiento.marca} {mantenimiento.modelo}
              </p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Conductor:</p>
              <p className="text-white font-semibold">
                {mantenimiento.nombre_conductor || 'Sin asignar'}
              </p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">Fecha Programada:</p>
              <p className="text-white font-semibold">
                {formatDate(mantenimiento.fecha_programada)}
              </p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">KM Programado:</p>
              <p className="text-white font-semibold">
                {mantenimiento.kilometraje_servicio?.toLocaleString() || '0'} km
              </p>
            </div>
            {mantenimiento.taller && (
              <div>
                <p className="text-gray-400 mb-1">Taller:</p>
                <p className="text-white font-semibold">
                  {mantenimiento.taller}
                </p>
              </div>
            )}
            {mantenimiento.observaciones && (
              <div className="md:col-span-3">
                <p className="text-gray-400 mb-1">Observaciones Iniciales:</p>
                <p className="text-white text-sm">
                  {mantenimiento.observaciones}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          
          {/* Sección 1: Fecha y Kilometraje Real */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              Datos del Servicio Realizado
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Fecha Realizada *
                </label>
                <input
                  type="date"
                  name="fecha_realizada"
                  value={formData.fecha_realizada}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    errors.fecha_realizada ? 'border-red-500' : 'border-white/20'
                  } rounded-lg text-white focus:outline-none focus:border-blue-500`}
                />
                {errors.fecha_realizada && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.fecha_realizada}
                  </p>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Kilometraje Real *
                </label>
                <input
                  type="number"
                  name="kilometraje_real"
                  value={formData.kilometraje_real}
                  onChange={handleChange}
                  placeholder="0"
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    errors.kilometraje_real ? 'border-red-500' : 'border-white/20'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500`}
                />
                {errors.kilometraje_real && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.kilometraje_real}
                  </p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Kilometraje del vehículo al momento del servicio
                </p>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Mecánico
                </label>
                <input
                  type="text"
                  name="mecanico"
                  value={formData.mecanico}
                  onChange={handleChange}
                  placeholder="Nombre del mecánico"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Servicios y Refacciones */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-purple-400" />
              Servicios y Refacciones
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Servicios Realizados *
                </label>
                <textarea
                  name="servicios_realizados"
                  value={formData.servicios_realizados}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Ej: Cambio de aceite y filtro, revisión de frenos, ajuste de dirección..."
                  className={`w-full px-4 py-3 bg-white/10 border ${
                    errors.servicios_realizados ? 'border-red-500' : 'border-white/20'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none`}
                />
                {errors.servicios_realizados && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.servicios_realizados}
                  </p>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Refacciones Utilizadas
                </label>
                <textarea
                  name="refacciones"
                  value={formData.refacciones}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Ej: Aceite 10W-40 (4 litros), Filtro de aceite, Balatas delanteras..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Sección 3: Costos */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-400" />
              Costos del Servicio
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Costo Mano de Obra *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    name="costo_mano_obra"
                    value={formData.costo_mano_obra}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    className={`w-full pl-10 pr-4 py-3 bg-white/10 border ${
                      errors.costo_mano_obra ? 'border-red-500' : 'border-white/20'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500`}
                  />
                </div>
                {errors.costo_mano_obra && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.costo_mano_obra}
                  </p>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">
                  Costo Refacciones *
                </label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    name="costo_refacciones"
                    value={formData.costo_refacciones}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    className={`w-full pl-10 pr-4 py-3 bg-white/10 border ${
                      errors.costo_refacciones ? 'border-red-500' : 'border-white/20'
                    } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500`}
                  />
                </div>
                {errors.costo_refacciones && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.costo_refacciones}
                  </p>
                )}
              </div>

              {/* Total */}
              <div className="md:col-span-2 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-semibold">Costo Total:</span>
                  <span className="text-3xl font-bold text-white">
                    {formatCurrency(calcularTotal())}
                  </span>
                </div>
              </div>
            </div>
          </div>
 {/* ⭐ AQUÍ EMPIEZA LA NUEVA SECCIÓN 4 ⭐ */}
          {/* Sección 4: Distribución de Costos */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-primary/30 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-primary" />
              Distribución de Costos
            </h2>
            
            <div className="mb-4">
              <p className="text-gray-400 text-sm">Costo Total a Distribuir:</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(calcularTotal())}
              </p>
            </div>

            {/* Mostrar el Saldo de Póliza (si aplica) */}
            {mantenimiento.conductor_id && mantenimiento.tipo_poliza && (
              <div className="mb-4 bg-gray-800/50 p-4 rounded-lg border border-white/10">
                <p className="text-gray-400 text-xs mb-1">
                  Conductor: {mantenimiento.nombre_conductor}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">Saldo Póliza Mecánica:</span>
                  <span className={`font-bold text-lg ${
                    (mantenimiento.saldo_poliza_mecanica || 0) >= calcularTotal()
                      ? 'text-green-400'
                      : 'text-yellow-400'
                  }`}>
                    {formatCurrency(mantenimiento.saldo_poliza_mecanica || 0)}
                  </span>
                </div>
                {(mantenimiento.saldo_poliza_mecanica || 0) < calcularTotal() && (
                  <p className="text-yellow-400 text-xs mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Saldo insuficiente para cubrir el costo total
                  </p>
                )}
              </div>
            )}

            {/* Selector de Método de Pago */}
            <div>
              <label className="text-gray-400 text-sm mb-2 block">
                ¿Cómo se cubre este costo? *
              </label>
              <select
                name="metodo_distribucion"
                value={formData.metodo_distribucion}
                onChange={handleChange}
                required
                className={`w-full px-4 py-3 bg-white/10 border ${
                  errors.metodo_distribucion ? 'border-red-500' : 'border-white/20'
                } rounded-lg text-white focus:outline-none focus:border-blue-500`}
              >
                <option value="">Seleccionar método de pago...</option>
                {mantenimiento.conductor_id && mantenimiento.tipo_poliza && (
                  <option value="poliza">💳 Descontar de Póliza del Conductor</option>
                )}
                <option value="empresa">🏢 Pagar por Empresa (Inversión)</option>
                <option value="conductor">💰 Añadir como Deuda al Conductor</option>
                <option value="fondo">💚 Fondo de Mantenimiento</option>
              </select>
              {errors.metodo_distribucion && (
                <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.metodo_distribucion}
                </p>
              )}
              
              {/* Descripción del método seleccionado */}
              {formData.metodo_distribucion && (
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-300 text-sm">
                    {formData.metodo_distribucion === 'poliza' && 
                      '💳 Se descontará del saldo de póliza mecánica del conductor asignado'}
                    {formData.metodo_distribucion === 'empresa' && 
                      '🏢 Se añadirá como gasto a la inversión del vehículo'}
                    {formData.metodo_distribucion === 'conductor' && 
                      '💰 Se creará una deuda pendiente al conductor'}
                    {formData.metodo_distribucion === 'fondo' && 
                      '💚 Se descontará del fondo general de mantenimiento'}
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Observaciones Finales */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-yellow-400" />
              Observaciones Finales
            </h2>
            <textarea
              name="observaciones_final"
              value={formData.observaciones_final}
              onChange={handleChange}
              rows="4"
              placeholder="Notas adicionales, recomendaciones, próximos servicios sugeridos..."
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Paperclip className="w-6 h-6 text-cyan-400" />
              Adjuntos de Servicio (Opcional)
            </h2>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,application/pdf"
              multiple
              onChange={handleAdjuntosChange}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:bg-cyan-500/20 file:text-cyan-200 hover:file:bg-cyan-500/30"
            />
            <p className="text-gray-500 text-xs mt-1">
              Hasta {MAX_ADMIN_ADJUNTOS} archivos. Maximo 10MB por archivo.
            </p>
            {errors.adjuntos_admin && (
              <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.adjuntos_admin}
              </p>
            )}
            {adjuntosAdmin.length > 0 && (
              <div className="mt-3 space-y-1">
                {adjuntosAdmin.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded bg-white/5 border border-white/10 px-3 py-2 text-xs"
                  >
                    <span className="text-gray-200 truncate pr-3">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAdjunto(index)}
                      className="text-red-300 hover:text-red-200"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => window.location.href = '/admin/mantenimientos'}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={guardando}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {guardando ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Completando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Completar Mantenimiento
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CompletarMantenimiento;
