import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '@/services/api';

const AsignarInversionModal = ({ vehiculo, onClose, onSuccess }) => {
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inversionistas, setInversionistas] = useState([]);
  
  const [formData, setFormData] = useState({
    // Paso 1: Tipo de inversión
    modelo_negocio: '',
    
    // Paso 2: Inversionista
    inversionista_id: '',
    
    // Paso 3: Términos
    monto_inversion: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    notas: ''
  });

  useEffect(() => {
    fetchInversionistas();
  }, []);

  const fetchInversionistas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/inversionistas`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInversionistas(data.inversionistas || []);
      }
    } catch (error) {
      console.error('Error cargando inversionistas:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Preparar datos según el tipo de inversión
      const payload = {
        inversionista_id: parseInt(formData.inversionista_id),
        modelo_negocio: formData.modelo_negocio,
        monto_inversion: parseFloat(formData.monto_inversion),
        fecha_inicio: formData.fecha_inicio,
        notas: formData.notas
      };

      // Si es SI_LEGADO, incluir el vehículo
      if (formData.modelo_negocio === 'SI_LEGADO') {
        payload.vehiculo_id = vehiculo.numero_de_serie_vehiculo;
        payload.tipo_inversion = 'vehiculo_especifico';
        payload.valor_factura = vehiculo.precio_compra || 0;
      } else {
        payload.tipo_inversion = 'pool_general';
      }

      const response = await fetch(`${API_BASE_URL}/admin/inversiones/crear-contrato`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear contrato');
      }

      const data = await response.json();
      alert('✅ Contrato creado exitosamente');
      onSuccess();
      onClose();

    } catch (error) {
      console.error('Error:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const puedeAvanzar = () => {
    if (paso === 1) return formData.modelo_negocio !== '';
    if (paso === 2) return formData.inversionista_id !== '';
    if (paso === 3) return formData.monto_inversion !== '';
    return false;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass rounded-2xl border border-white/10 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-white">Asignar Inversión Manualmente</h3>
            <p className="text-gray-400 text-sm mt-1">
              Vehículo #{vehiculo.numero_vehiculo} - {vehiculo.marca} {vehiculo.modelo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((num) => (
            <React.Fragment key={num}>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                paso >= num 
                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400' 
                  : 'border-gray-600 text-gray-600'
              }`}>
                {paso > num ? <Check className="w-5 h-5" /> : num}
              </div>
              {num < 3 && (
                <div className={`w-16 h-1 mx-2 rounded-full transition-all ${
                  paso > num ? 'bg-cyan-500' : 'bg-gray-600'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* PASO 1: Tipo de Inversión */}
        {paso === 1 && (
          <div className="space-y-4">
            <h4 className="text-xl font-bold text-white mb-4">
              Paso 1: ¿Cuál es el modelo de negocio?
            </h4>
            
            <div className="space-y-3">
              {/* SI_LEGADO */}
              <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                formData.modelo_negocio === 'SI_LEGADO'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}>
                <input
                  type="radio"
                  name="modelo_negocio"
                  value="SI_LEGADO"
                  checked={formData.modelo_negocio === 'SI_LEGADO'}
                  onChange={(e) => setFormData({ ...formData, modelo_negocio: e.target.value })}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                    formData.modelo_negocio === 'SI_LEGADO'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-400'
                  }`}>
                    {formData.modelo_negocio === 'SI_LEGADO' && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold">SI Legado (Contrato 1-a-1)</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Este vehículo fue comprado específicamente por un inversionista. 
                      Contrato exclusivo de $8,000/mes por 62 meses.
                    </p>
                  </div>
                </div>
              </label>

              {/* PLUS_60 */}
              <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                formData.modelo_negocio === 'PLUS_60'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}>
                <input
                  type="radio"
                  name="modelo_negocio"
                  value="PLUS_60"
                  checked={formData.modelo_negocio === 'PLUS_60'}
                  onChange={(e) => setFormData({ ...formData, modelo_negocio: e.target.value })}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                    formData.modelo_negocio === 'PLUS_60'
                      ? 'border-cyan-500 bg-cyan-500'
                      : 'border-gray-400'
                  }`}>
                    {formData.modelo_negocio === 'PLUS_60' && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold">PLUS 60 (Pool General)</p>
                    <p className="text-gray-400 text-sm mt-1">
                      El dinero vino del fondo común. 60 meses con 60% de utilidad.
                    </p>
                  </div>
                </div>
              </label>

              {/* SMART_40 */}
              <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                formData.modelo_negocio === 'SMART_40'
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}>
                <input
                  type="radio"
                  name="modelo_negocio"
                  value="SMART_40"
                  checked={formData.modelo_negocio === 'SMART_40'}
                  onChange={(e) => setFormData({ ...formData, modelo_negocio: e.target.value })}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                    formData.modelo_negocio === 'SMART_40'
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-400'
                  }`}>
                    {formData.modelo_negocio === 'SMART_40' && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold">SMART 40 (Pool General)</p>
                    <p className="text-gray-400 text-sm mt-1">
                      El dinero vino del fondo común. 40 meses con 40% de utilidad.
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* PASO 2: Inversionista */}
        {paso === 2 && (
          <div className="space-y-4">
            <h4 className="text-xl font-bold text-white mb-4">
              Paso 2: ¿Quién es el inversionista?
            </h4>
            
            <div>
              <label className="block text-gray-400 text-sm mb-2">Seleccionar Inversionista</label>
              <select
                value={formData.inversionista_id}
                onChange={(e) => setFormData({ ...formData, inversionista_id: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/30"
              >
                <option value="">-- Seleccionar --</option>
                {inversionistas.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.nombre} - {inv.email}
                  </option>
                ))}
              </select>
            </div>

            {formData.inversionista_id && (
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <p className="text-cyan-400 text-sm font-medium mb-2">
                  ℹ️ Información del Inversionista
                </p>
                <p className="text-gray-300 text-sm">
                  {inversionistas.find(i => i.id === parseInt(formData.inversionista_id))?.nombre}
                </p>
              </div>
            )}
          </div>
        )}

        {/* PASO 3: Términos */}
        {paso === 3 && (
          <div className="space-y-4">
            <h4 className="text-xl font-bold text-white mb-4">
              Paso 3: Términos del Contrato
            </h4>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Monto de Inversión *</label>
              <input
                type="number"
                value={formData.monto_inversion}
                onChange={(e) => setFormData({ ...formData, monto_inversion: e.target.value })}
                placeholder="Ej: 350000"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/30"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Fecha de Inicio</label>
              <input
                type="date"
                value={formData.fecha_inicio}
                onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/30"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Notas (Opcional)</label>
              <textarea
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Ej: Contrato heredado de sistema anterior..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/30 resize-none"
              />
            </div>

            {/* Resumen */}
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <p className="text-cyan-400 font-bold mb-3">📋 Resumen del Contrato</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Modelo:</span>
                  <span className="text-white font-medium">
                    {formData.modelo_negocio === 'SI_LEGADO' ? 'SI Legado' : 
                     formData.modelo_negocio === 'PLUS_60' ? 'PLUS 60' : 'SMART 40'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Vehículo:</span>
                  <span className="text-white font-medium">
                    {formData.modelo_negocio === 'SI_LEGADO' 
                      ? `#${vehiculo.numero_vehiculo} (${vehiculo.marca})`
                      : 'Pool General'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Inversión:</span>
                  <span className="text-white font-medium">
                    {formatCurrency(formData.monto_inversion)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
          <button
            onClick={() => paso > 1 ? setPaso(paso - 1) : onClose()}
            className="px-6 py-3 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            {paso === 1 ? 'Cancelar' : 'Anterior'}
          </button>

          {paso < 3 ? (
            <button
              onClick={() => setPaso(paso + 1)}
              disabled={!puedeAvanzar()}
              className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 ${
                puedeAvanzar()
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              Siguiente
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading || !puedeAvanzar()}
              className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 ${
                puedeAvanzar() && !loading
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/30'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Crear Contrato
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default AsignarInversionModal;
