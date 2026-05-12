import React, { useState, useMemo, useEffect } from 'react';
import { X, TrendingUp, DollarSign, Check, Briefcase, Send, Landmark, UploadCloud, FileImage, Loader2 } from 'lucide-react';
import inversionistaService from '../../services/inversionistaService'; // Ajusta tu ruta

const planesConfig = {
  PLUS_60: { 
    label: 'Plan Plus 60', 
    plazo: 53, 
    descripcion: 'Pool General. Rendimiento total del 60% sobre tu inversión.', 
    color: 'from-cyan-500 to-blue-500' 
  },
  SMART_40: { 
    label: 'Plan Smart 40', 
    plazo: 35, 
    descripcion: 'Pool General. Rendimiento total del 40% sobre tu inversión.', 
    color: 'from-purple-500 to-pink-500' 
  }
};

const ModalSolicitudInversion = ({ isOpen, onClose, onSubmit, loading }) => {
  const [formData, setFormData] = useState({
    modelo_negocio: 'PLUS_60',
    monto_inversion: '',
    comprobante_url: '' // 👈 Nuevo campo
  });

  // 🚀 Nuevos Estados
  const [bancoInfo, setBancoInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingBanco, setLoadingBanco] = useState(true);

  // 1️⃣ Cargar datos bancarios al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const cargarBanco = async () => {
        try {
          const res = await inversionistaService.getDatosBancarios();
          if (res.success) setBancoInfo(res.datos);
        } catch (error) {
          console.error("Error al cargar datos bancarios", error);
        } finally {
          setLoadingBanco(false);
        }
      };
      cargarBanco();
    } else {
      // Limpiar el form al cerrar
      setFormData({ modelo_negocio: 'PLUS_60', monto_inversion: '', comprobante_url: '' });
    }
  }, [isOpen]);

  // 2️⃣ Función para subir imagen a Cloudinary directo desde React
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen (JPG, PNG).');
      return;
    }

    setIsUploading(true);
    const data = new FormData();
    data.append('file', file);
    
    // 🚨 REEMPLAZA ESTOS DATOS CON LOS TUYOS DE CLOUDINARY 🚨
    data.append('upload_preset', 'inversionistas_docs'); 
    data.append('cloud_name', 'dvh2t0afl');

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/dvh2t0afl/image/upload`, {
        method: 'POST',
        body: data
      });

      const uploadedFile = await res.json();
      if (uploadedFile.secure_url) {
        setFormData(prev => ({ ...prev, comprobante_url: uploadedFile.secure_url }));
      } else {
        throw new Error('Error al subir a Cloudinary');
      }
    } catch (error) {
      alert('Hubo un error al subir la imagen. Intenta de nuevo.');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  const metricas = useMemo(() => {
    const monto = parseFloat(formData.monto_inversion) || 0;
    if (monto === 0) return { pagoMensual: 0, totalRecibir: 0, plazo: 0, roi: 0 };

    let pagoMensual = 0, totalRecibir = 0, plazo = 0;

    if (formData.modelo_negocio === 'PLUS_60') {
      plazo = 53; totalRecibir = monto * 1.60; pagoMensual = totalRecibir / plazo;
    } else if (formData.modelo_negocio === 'SMART_40') {
      plazo = 35; totalRecibir = monto * 1.40; pagoMensual = totalRecibir / plazo;
    }

    return { pagoMensual, totalRecibir, plazo, roi: (((totalRecibir - monto) / monto) * 100).toFixed(1) };
  }, [formData.monto_inversion, formData.modelo_negocio]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parseFloat(formData.monto_inversion) < 20000) {
      alert("El monto mínimo de inversión es de $20,000 MXN");
      return;
    }
    if (!formData.comprobante_url) {
      alert("Debes adjuntar el comprobante de pago para enviar la solicitud.");
      return;
    }
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        
        {/* HEADER */}
        <div className="sticky top-0 bg-[#1a1a2e] p-6 border-b border-white/10 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Briefcase className="w-7 h-7 text-emerald-400" /> Nueva Solicitud de Inversión
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-6 h-6" /></button>
        </div>

        {/* BODY */}
        <div className="p-6 flex-1">
          <form id="form-solicitud" onSubmit={handleSubmit} className="space-y-6">
            
            {/* GRID PRINCIPAL: 2 Columnas en escritorio */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* COLUMNA IZQUIERDA: Configuración y Simulador */}
              <div className="space-y-6">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-cyan-400" /> 1. Configura tu Plan
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Plan de Inversión *</label>
                      <select
                        value={formData.modelo_negocio}
                        onChange={(e) => setFormData({...formData, modelo_negocio: e.target.value})}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                      >
                        {Object.entries(planesConfig).map(([key, plan]) => (
                          <option key={key} value={key} className="bg-gray-800">{plan.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Monto a Invertir (MXN) *</label>
                      <input
                        type="number"
                        value={formData.monto_inversion}
                        onChange={(e) => setFormData({...formData, monto_inversion: e.target.value})}
                        placeholder="Ej. 50000" step="1000" min="20000" required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className={`rounded-2xl p-6 border border-white/10 bg-gradient-to-r ${planesConfig[formData.modelo_negocio]?.color} bg-opacity-5`}>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" /> Simulación del contrato
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-[#1a1a2e]/50 rounded-lg border border-white/5 text-center">
                      <p className="text-gray-400 text-xs">Mensual</p>
                      <p className="text-lg font-bold text-cyan-400">{formatCurrency(metricas.pagoMensual)}</p>
                    </div>
                    <div className="p-3 bg-[#1a1a2e]/50 rounded-lg border border-white/5 text-center">
                      <p className="text-gray-400 text-xs">Total</p>
                      <p className="text-lg font-bold text-green-400">{formatCurrency(metricas.totalRecibir)}</p>
                    </div>
                    <div className="p-3 bg-[#1a1a2e]/50 rounded-lg border border-white/5 text-center">
                      <p className="text-gray-400 text-xs">Plazo</p>
                      <p className="text-lg font-bold text-green-400">{(metricas.plazo)} meses</p>
                    </div>
                    <div className="p-3 bg-[#1a1a2e]/50 rounded-lg border border-white/5 text-center">
                      <p className="text-gray-400 text-xs">ROI (Retorno de Inversión)</p>
                      <p className="text-lg font-bold text-green-400">{(metricas.roi)}%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: Instrucciones y Comprobante */}
              <div className="space-y-6">
                
                {/* Instrucciones de Pago (Dinámicas) */}
                <div className="bg-emerald-500/5 rounded-2xl p-6 border border-emerald-500/20">
                  <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                    <Landmark className="w-5 h-5" /> 2. Instrucciones de Pago
                  </h3>
                  
                  {loadingBanco ? (
                    <div className="flex items-center gap-2 text-gray-400"><Loader2 className="w-4 h-4 animate-spin"/> Cargando cuentas...</div>
                  ) : bancoInfo ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-gray-400">Banco:</span>
                        <span className="text-white font-medium">{bancoInfo.banco}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-gray-400">Titular:</span>
                        <span className="text-white font-medium">{bancoInfo.titular}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-gray-400">Cuenta:</span>
                        <span className="text-white font-medium tracking-wider">{bancoInfo.cuenta}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-gray-400">CLABE:</span>
                        <span className="text-white font-medium tracking-wider">{bancoInfo.clabe}</span>
                      </div>
                      <p className="text-emerald-400 text-xs mt-2 bg-emerald-500/10 p-2 rounded">
                        ℹ️ {bancoInfo.instrucciones}
                      </p>
                    </div>
                  ) : (
                    <p className="text-red-400 text-sm">No se pudieron cargar los datos bancarios.</p>
                  )}
                </div>

                {/* Subida de Comprobante */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-cyan-400" /> 3. Subir Comprobante
                  </h3>
                  
                  {!formData.comprobante_url ? (
                    <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-cyan-500/50 transition-colors relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      {isUploading ? (
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                          <p className="text-gray-300 font-medium">Subiendo imagen...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <UploadCloud className="w-10 h-10 text-gray-500 mb-3" />
                          <p className="text-gray-300 font-medium">Haz clic o arrastra tu comprobante</p>
                          <p className="text-gray-500 text-xs mt-1">JPG, PNG (Máx 5MB)</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/20 p-2 rounded-lg">
                          <FileImage className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-emerald-400 font-medium">Comprobante cargado</p>
                          <a href={formData.comprobante_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:underline">Ver imagen</a>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setFormData({...formData, comprobante_url: ''})}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 p-6 border-t border-white/10 bg-[#1a1a2e] flex justify-end gap-4 z-10">
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-medium text-gray-300 hover:bg-white/5">Cancelar</button>
          <button
            type="submit" form="form-solicitud"
            disabled={loading || isUploading || !formData.comprobante_url || parseFloat(formData.monto_inversion) < 20000}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ModalSolicitudInversion;