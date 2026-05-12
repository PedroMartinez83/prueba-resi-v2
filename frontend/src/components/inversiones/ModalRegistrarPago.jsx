import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, X, Lock, UploadCloud, Layers, Landmark } from 'lucide-react';
import adminService from '../../services/adminService'; 

const ModalRegistrarPago = ({ isOpen, onClose, inversion, datosInversionista, onSuccess, pagoAEditar = null }) => {
  const [cargando, setCargando] = useState(false);
  const [formPago, setFormPago] = useState({
    monto_total: '',
    numero_cuota: '',
    fecha_pago_real: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' }),
    metodo_pago: 'Transferencia',
    referencia_pago: '',
    observaciones: ''
  });

  // 🚀 NUEVOS ESTADOS PARA PAGOS MÚLTIPLES
  const [esMultiPago, setEsMultiPago] = useState(false);
  const [cantidadMeses, setCantidadMeses] = useState(2);

  const [archivoComprobante, setArchivoComprobante] = useState(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  
  const esPagoRescision = !pagoAEditar && inversion && inversion.status === 'Rescindido';
  
  const resetFileStates = () => {
    setArchivoComprobante(null);
    if (previewUrl && !pagoAEditar?.comprobante_url) { 
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Resetear multipago
    setEsMultiPago(false);
    setCantidadMeses(2);
  };

  useEffect(() => {
    if (isOpen) {
      resetFileStates(); 
      if (pagoAEditar) {
        setFormPago({
          monto_total: pagoAEditar.monto_total,
          numero_cuota: pagoAEditar.numero_cuota,
          fecha_pago_real: pagoAEditar.fecha_pago_real ? pagoAEditar.fecha_pago_real.split('T')[0] : '',
          metodo_pago: pagoAEditar.metodo_pago || 'Transferencia',
          referencia_pago: pagoAEditar.referencia_pago || '',
          observaciones: pagoAEditar.observaciones || ''
        });
        if (pagoAEditar.comprobante_url) setPreviewUrl(pagoAEditar.comprobante_url);
      } else if (inversion) {
        const cuotasPagadas = parseInt(inversion.pagos_realizados || "0", 10);
        const cuotaVisual = cuotasPagadas + 1;

        if (esPagoRescision) {
          setFormPago({
            monto_total: inversion.monto_liquidacion_final || '',
            numero_cuota: cuotaVisual,
            fecha_pago_real: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' }),
            metodo_pago: 'Transferencia',
            referencia_pago: '',
            observaciones: 'Pago final por liquidación de contrato rescindido.'
          });
        } else {
          setFormPago({
            monto_total: inversion.pago_mensual_inversionista || inversion.pago_mensual || '',
            numero_cuota: cuotaVisual,
            fecha_pago_real: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' }),
            metodo_pago: 'Transferencia',
            referencia_pago: '',
            observaciones: ''
          });
        }
      }
    }
  }, [isOpen, inversion, pagoAEditar, esPagoRescision]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pagoAEditar && !archivoComprobante) {
      alert('⚠️ El comprobante de pago es obligatorio.');
      return;
    }
    setCargando(true);
    setSubiendoArchivo(true);

    try {
      let comprobanteFinalUrl = pagoAEditar ? pagoAEditar.comprobante_url : null;
      if (archivoComprobante) {
        const formData = new FormData();
        formData.append('file', archivoComprobante);
        formData.append('upload_preset', 'inversionistas_docs'); 
        formData.append('cloud_name', 'dvh2t0afl'); 
        
        const cloudinaryRes = await fetch('https://api.cloudinary.com/v1_1/dvh2t0afl/upload', {
          method: 'POST',
          body: formData
        });
        const cloudinaryData = await cloudinaryRes.json();
        if (!cloudinaryData.secure_url) throw new Error('No se pudo obtener la URL de Cloudinary');
        comprobanteFinalUrl = cloudinaryData.secure_url;
      }

      // 🚀 AGREGAMOS EL CAMPO DE MULTIPAGO
      const formFinal = {
        ...formPago,
        comprobante_url: comprobanteFinalUrl,
        meses_a_pagar: esMultiPago ? cantidadMeses : 1
      };
      
      if (pagoAEditar) {
        await adminService.actualizarPagoInversion(pagoAEditar.id, formFinal);
        alert('✅ Pago actualizado correctamente');
      } else {
        const idContrato = inversion.id_inversion || inversion.id;
        if (esPagoRescision) {
          await adminService.registrarPagoRescision(idContrato, formFinal);
          alert('✅ Liquidación saldada y comprobante guardado.');
        } else {
          await adminService.registrarPagoInversion(idContrato, formFinal);
          alert('✅ Pago(s) y comprobante registrados correctamente');
        }
      }

      resetFileStates(); 
      onSuccess(); 
      onClose(); 
    } catch (error) {
      alert(`❌ Hubo un problema: ${error.message}`);
    } finally {
      setCargando(false);
      setSubiendoArchivo(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50  flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-cyan-500/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        
        <div className={`p-6 border-b flex justify-between items-center ${esPagoRescision ? 'bg-orange-500/10 border-orange-500/20' : 'bg-cyan-500/10 border-cyan-500/20'}`}>
          <h3 className={`text-xl font-bold flex items-center gap-2 ${esPagoRescision ? 'text-orange-400' : 'text-cyan-400'}`}>
            <DollarSign className="w-6 h-6" />
            {pagoAEditar ? 'Editar Pago' : esPagoRescision ? 'Registrar Liquidación (Finiquito)' : 'Registrar Nuevo Pago'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-400 mb-1">
                Cuota Inicial (Numero de mes a pagar)<Lock className="w-3 h-3" />
              </label>
              <input
                type="number"
                value={formPago.numero_cuota}
                readOnly
                disabled
                className="w-full bg-black/20 border border-white/5 rounded-lg px-4 py-2 text-gray-500 cursor-not-allowed outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Monto Individual *</label>
              <input
                type="number"
                value={formPago.monto_total}
                disabled
                onChange={(e) => setFormPago({...formPago, monto_total: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                readOnly={esPagoRescision}
                required
              />
            </div>

            {/* 🚀 CHECKBOX PARA PAGOS MÚLTIPLES (Solo si es nuevo pago y no rescisión) */}
            {!pagoAEditar && !esPagoRescision && (
              <div className="col-span-2 mt-1">
                <label className="flex items-center gap-2 text-sm font-bold text-cyan-400 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={esMultiPago} 
                    onChange={e => setEsMultiPago(e.target.checked)} 
                    className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                  />
                  Registrar múltiples meses (Rellenar Historial)
                </label>
              </div>
            )}

            {/* 🚀 PANEL DE MULTIPAGO */}
            {esMultiPago && (
              <div className="col-span-2 grid grid-cols-2 gap-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl mt-2 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-1 flex items-center gap-1">
                    <Layers className="w-4 h-4" /> Cantidad de meses
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="60"
                    value={cantidadMeses}
                    onChange={(e) => setCantidadMeses(parseInt(e.target.value) || 2)}
                    onFocus={(e) => e.target.select()} // 🚀 LA MAGIA ESTÁ AQUÍ
                    className="w-full bg-black/30 border border-cyan-500/50 rounded-lg px-4 py-2 text-white focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Total a Descontar</label>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {formatCurrency(formPago.monto_total * cantidadMeses)}
                  </div>
                </div>
                <p className="col-span-2 text-xs text-cyan-200/70 mt-1 leading-relaxed">
                  Se insertarán <strong>{cantidadMeses} registros</strong> de {formatCurrency(formPago.monto_total)} usando el mismo ticket. Las cuotas irán de la <strong>#{formPago.numero_cuota}</strong> a la <strong>#{parseInt(formPago.numero_cuota) + cantidadMeses - 1}</strong>.
                </p>
              </div>
            )}
          </div>

          {/* 🏦 SECCIÓN DE DATOS BANCARIOS */}
            <div className="col-span-2 bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mt-2">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Landmark className="w-4 h-4" /> Datos de Destino (Inversionista)
              </h4>
              
              {/* Lo hacemos en 2 columnas para aprovechar el espacio horizontal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-500">Titular:</span>
                  <span className="text-white font-medium text-right">
                    {datosInversionista?.nombre_cuenta_banco || 'No especificado'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-500">Banco:</span>
                  <span className="text-white font-medium text-right">
                    {datosInversionista?.banco || 'No especificado'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 sm:border-none pb-2 sm:pb-0">
                  <span className="text-gray-500">Cuenta:</span>
                  <span className="text-white font-mono tracking-wider text-right">
                    {datosInversionista?.cuenta_bancaria || 'No especificado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CLABE:</span>
                  <span className="text-white font-mono tracking-wider text-right">
                    {datosInversionista?.clabe || 'No especificado'}
                  </span>
                </div>
              </div>
            </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Fecha de Pago</label>
              <input
                type="date" required
                value={formPago.fecha_pago_real}
                onChange={(e) => setFormPago({...formPago, fecha_pago_real: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none style-color-scheme-dark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Método</label>
              <select
                value={formPago.metodo_pago}
                onChange={(e) => setFormPago({...formPago, metodo_pago: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
              >
                <option value="Transferencia" className="bg-[#1a1a2e]">Transferencia</option>
                <option value="Depósito" className="bg-[#1a1a2e]">Depósito</option>
              </select>
            </div>
          </div>

          {/* 🖼️ CAMPO DE COMPROBANTE DINÁMICO */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Comprobante de Pago {!pagoAEditar && <span className="text-red-400">*</span>}
            </label>
            <div className="relative border-2 border-dashed border-white/20 rounded-lg p-3 hover:border-cyan-500/50 transition-colors bg-white/5 flex items-center justify-center">
              <input
                type="file"
                accept="image/*,.pdf"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                      setArchivoComprobante(file);
                      setPreviewUrl(URL.createObjectURL(file)); 
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="" 
              />
              <div className="flex items-center gap-2 text-sm text-gray-400">
                {/* Mostramos el ícono solo si no hay archivo seleccionado NI URL previa */}
                {!archivoComprobante && !previewUrl && <UploadCloud className="w-5 h-5 text-cyan-400" />}
                
                {(archivoComprobante || previewUrl) ? (
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded border border-white/10 overflow-hidden bg-black/40 flex-shrink-0">
                          {/* Si es un PDF no intentamos poner la imagen */}
                          {previewUrl?.includes('.pdf') ? (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-cyan-400">PDF</div>
                          ) : (
                              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          )}
                      </div>
                      <span className="text-emerald-400 font-medium truncate max-w-[140px]">
                          {archivoComprobante ? archivoComprobante.name : 'Comprobante guardado'}
                      </span>
                      {/* Botón para quitar la foto (si está editando, solo quita la foto temporal, al guardar se sobreescribirá) */}
                      <button 
                          type="button" 
                          onClick={(e) => {
                              e.preventDefault(); 
                              e.stopPropagation();
                              resetFileStates(); 
                          }}
                          className="p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 z-10 relative"
                      >
                          <X className="w-4 h-4" />
                      </button>
                  </div>
                ) : (
                  <span>{pagoAEditar ? 'Sube para reemplazar el actual' : 'Haz clic para subir imagen o PDF'}</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Referencia / Folio</label>
            <input
              type="text"
              value={formPago.referencia_pago}
              onChange={(e) => setFormPago({...formPago, referencia_pago: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
              placeholder="Opcional..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Observaciones</label>
            <textarea
              rows="2"
              value={formPago.observaciones}
              onChange={(e) => setFormPago({...formPago, observaciones: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none resize-none"
              placeholder="Notas sobre este pago..."
            ></textarea>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all font-medium disabled:opacity-50"
            >
              {subiendoArchivo ? 'Subiendo...' : cargando ? 'Guardando...' : pagoAEditar ? 'Guardar Cambios' : 'Confirmar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalRegistrarPago;