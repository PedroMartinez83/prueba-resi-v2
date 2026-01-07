// frontend/src/components/pagos/ModalRegistrarPago.jsx
import { useState, useEffect } from 'react';
import { X, DollarSign, CreditCard, Receipt, AlertCircle, CheckCircle, User, Calendar, Shield, Wrench } from 'lucide-react';
import api from '../../services/api';

const ModalRegistrarPago = ({ isOpen, onClose, conductor, onSuccess }) => {
  const fechaHoy = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    conductor_id: '',
    monto_renta: '',
    monto_extra: '',
    destino_extra: 'poliza', // 'poliza' o 'mantenimiento'
    metodo_pago: 'Transferencia',
    referencia: '',
    observaciones: '',
    fecha_pago: fechaHoy
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewDivision, setPreviewDivision] = useState(null);
  const [conductorInfo, setConductorInfo] = useState(null);

  // Auto-llenar conductor_id cuando se recibe el prop
  useEffect(() => {
    if (conductor) {
      const tipoPoliza = conductor.tipo_poliza || 'POLIZA_100';
      const rentaDiaria = parseFloat(conductor.renta_diaria || 400);
      const montoExtraDefault = tipoPoliza === 'AHORRO_50' ? 50 : 100;
      
      setConductorInfo({
        ...conductor,
        tipo_poliza: tipoPoliza
      });

      setFormData(prev => ({
        ...prev,
        conductor_id: conductor.id,
        monto_renta: rentaDiaria.toString(),
        monto_extra: montoExtraDefault.toString(),
        destino_extra: 'poliza' // Default a póliza
      }));

      calcularPreview(rentaDiaria, montoExtraDefault, 'poliza');
    }
  }, [conductor]);

  // Calcular preview de división
  const calcularPreview = (renta, extra, destino) => {
    const montoRenta = parseFloat(renta) || 0;
    const montoExtra = parseFloat(extra) || 0;
    const total = montoRenta + montoExtra;

    if (total > 0) {
      setPreviewDivision({
        total: total,
        para_renta: montoRenta,
        para_extra: montoExtra,
        destino_extra: destino,
        porcentaje_renta: montoRenta > 0 ? ((montoRenta / total) * 100).toFixed(1) : '0.0',
        porcentaje_extra: montoExtra > 0 ? ((montoExtra / total) * 100).toFixed(1) : '0.0'
      });
    } else {
      setPreviewDivision(null);
    }
  };

  // Actualizar preview cuando cambian los valores
  useEffect(() => {
    calcularPreview(formData.monto_renta, formData.monto_extra, formData.destino_extra);
  }, [formData.monto_renta, formData.monto_extra, formData.destino_extra]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const montoTotal = parseFloat(formData.monto_renta) + parseFloat(formData.monto_extra);

      const dataToSend = {
        conductor_id: parseInt(formData.conductor_id),
        monto_total: montoTotal,
        monto_renta: parseFloat(formData.monto_renta),
        monto_extra: parseFloat(formData.monto_extra),
        destino_extra: formData.destino_extra, // 'poliza' o 'mantenimiento'
        metodo_pago: formData.metodo_pago,
        referencia: formData.referencia || null,
        observaciones: formData.observaciones || null,
        fecha_pago: formData.fecha_pago || null
      };

      console.log('📤 Enviando pago:', dataToSend);

      const response = await api.post('/admin/pagos-rentas/registrar-manual', dataToSend);

      console.log('✅ Respuesta del servidor:', response.data);

      if (response.data.success) {
        onSuccess && onSuccess(response.data);
        handleClose();
      }
    } catch (err) {
      console.error('❌ Error registrando pago:', err);
      setError(err.response?.data?.error || 'Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      conductor_id: '',
      monto_renta: '',
      monto_extra: '',
      destino_extra: 'poliza',
      metodo_pago: 'Transferencia',
      referencia: '',
      observaciones: '',
      fecha_pago: new Date().toISOString().split('T')[0]
    });
    setError(null);
    setPreviewDivision(null);
    setConductorInfo(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass border border-primary/30 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-sm border-b border-primary/20 p-6 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-primary" />
                Registrar Pago Diario
              </h2>
              {conductorInfo && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-medium">{conductorInfo.nombre_conductor}</span>
                    </div>
                    <div className="text-gray-400">
                      Vehículo: <span className="text-white">{conductorInfo.numero_vehiculo || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      conductorInfo.tipo_poliza === 'AHORRO_50' 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}>
                      {conductorInfo.tipo_poliza === 'AHORRO_50' ? '💰 Ahorro $50' : '🛡️ Póliza $100'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Error</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Monto Renta */}
          <div>
            <label className="block text-white font-medium mb-2">
              💼 Monto Renta (Empresa) *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.monto_renta}
                onChange={(e) => setFormData({ ...formData, monto_renta: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="400.00"
              />
            </div>
            <p className="text-gray-400 text-xs mt-1">
              Ganancia que va para la empresa
            </p>
          </div>

          {/* Monto Extra y Destino */}
          <div className="space-y-3">
            <label className="block text-white font-medium">
              💰 Monto Extra (Conductor) *
            </label>
            
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.monto_extra}
                onChange={(e) => setFormData({ ...formData, monto_extra: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-lg font-semibold focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="50.00 o 100.00"
              />
            </div>

            {/* Selector de Destino */}
            <div className="grid grid-cols-2 gap-3">
              {/* Opción: Póliza */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, destino_extra: 'poliza' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.destino_extra === 'poliza'
                    ? 'bg-purple-500/20 border-purple-500 shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Shield className={`w-5 h-5 ${formData.destino_extra === 'poliza' ? 'text-purple-400' : 'text-gray-400'}`} />
                  <span className={`font-semibold ${formData.destino_extra === 'poliza' ? 'text-purple-400' : 'text-gray-400'}`}>
                    Póliza
                  </span>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Límite $50,000<br/>
                  NO se acumula
                </p>
              </button>

              {/* Opción: Mantenimiento */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, destino_extra: 'mantenimiento' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.destino_extra === 'mantenimiento'
                    ? 'bg-blue-500/20 border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'bg-white/5 border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Wrench className={`w-5 h-5 ${formData.destino_extra === 'mantenimiento' ? 'text-blue-400' : 'text-gray-400'}`} />
                  <span className={`font-semibold ${formData.destino_extra === 'mantenimiento' ? 'text-blue-400' : 'text-gray-400'}`}>
                    Mantenimiento
                  </span>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Ahorro conductor<br/>
                  SÍ se acumula
                </p>
              </button>
            </div>
          </div>

          {/* Preview de División */}
          {previewDivision && (
            <div className="glass border-2 border-primary/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-white">Sistema "Dos Cubetas"</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  previewDivision.destino_extra === 'poliza'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {previewDivision.destino_extra === 'poliza' ? '🛡️ PÓLIZA' : '🔧 MANTENIMIENTO'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Para Renta (Empresa) */}
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-1 flex items-center gap-1">
                    💼 Renta (Empresa)
                  </p>
                  <p className="text-2xl font-bold text-green-400">
                    ${previewDivision.para_renta.toFixed(2)}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {previewDivision.porcentaje_renta}% del total
                  </p>
                </div>

                {/* Para Extra (Conductor) */}
                <div className={`bg-gradient-to-br rounded-lg p-4 border ${
                  previewDivision.destino_extra === 'poliza'
                    ? 'from-purple-500/10 to-purple-600/10 border-purple-500/30'
                    : 'from-blue-500/10 to-blue-600/10 border-blue-500/30'
                }`}>
                  <p className="text-gray-300 text-sm mb-1 flex items-center gap-1">
                    {previewDivision.destino_extra === 'poliza' ? '🛡️ Póliza' : '🔧 Mantenimiento'}
                  </p>
                  <p className={`text-2xl font-bold ${
                    previewDivision.destino_extra === 'poliza' ? 'text-purple-400' : 'text-blue-400'
                  }`}>
                    ${previewDivision.para_extra.toFixed(2)}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {previewDivision.porcentaje_extra}% del total
                  </p>
                </div>
              </div>

              {/* Total */}
              <div className="mt-4 bg-primary/10 border border-primary/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-gray-300 text-sm font-medium">Monto Total a Pagar</p>
                  <p className="text-2xl font-bold text-primary">
                    ${previewDivision.total.toFixed(2)} MXN
                  </p>
                </div>
              </div>

              {/* Info según destino */}
              <div className={`mt-3 rounded-lg p-3 border ${
                previewDivision.destino_extra === 'poliza'
                  ? 'bg-purple-500/10 border-purple-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}>
                <p className={`text-sm flex items-center gap-2 ${
                  previewDivision.destino_extra === 'poliza' ? 'text-purple-400' : 'text-blue-400'
                }`}>
                  <CheckCircle className="w-4 h-4" />
                  {previewDivision.destino_extra === 'poliza'
                    ? `Se registrarán $${previewDivision.para_extra.toFixed(2)} como prima de seguro (límite global $50,000)`
                    : `Se sumarán $${previewDivision.para_extra.toFixed(2)} al ahorro de mantenimiento del conductor`
                  }
                </p>
              </div>
            </div>
          )}

          {/* Método de Pago */}
          <div>
            <label className="block text-white font-medium mb-2">
              Método de Pago *
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                required
                value={formData.metodo_pago}
                onChange={(e) => setFormData({ ...formData, metodo_pago: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
              >
                <option value="Transferencia" className="bg-gray-800">Transferencia</option>
                <option value="Efectivo" className="bg-gray-800">Efectivo</option>
                <option value="Tarjeta" className="bg-gray-800">Tarjeta</option>
                <option value="Stripe" className="bg-gray-800">Stripe</option>
              </select>
            </div>
          </div>
          
          {/* Fecha de Pago */}
          <div>
            <label className="block text-white font-medium mb-2">
              Fecha que cubre *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                required
                value={formData.fecha_pago}
                onChange={(e) => setFormData({ ...formData, fecha_pago: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
           {/* Referencia de Pago */}
          {['Transferencia', 'Tarjeta'].includes(formData.metodo_pago) && (
            <div>
              <label className="block text-white font-medium mb-2">
                Referencia de Pago {formData.metodo_pago === 'Transferencia' ? '(Folio/CLABE)' : '(Últimos dígitos)'}
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.referencia}
                  onChange={(e) => setFormData({ ...formData, referencia: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder={
                    formData.metodo_pago === 'Transferencia'
                      ? 'Número de referencia o folio de transferencia'
                      : 'Últimos 4 dígitos de la tarjeta'
                  }
                />
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-white font-medium mb-2">
              Observaciones
            </label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Notas adicionales sobre este pago..."
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-white/10 border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.monto_renta || !formData.monto_extra}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {loading ? '⏳ Registrando...' : '✅ Crear Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalRegistrarPago;
