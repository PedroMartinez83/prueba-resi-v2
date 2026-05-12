import React, { useState, useEffect } from 'react';
// 🚀 CAMBIO: Importamos nuevos íconos necesarios
import { AlertTriangle, X, Info, FileText, PauseCircle, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import adminService from '../../services/adminService'; 
import { calcularFiniquitoFinal, MOTIVOS_CANCELACION } from '../../pages/admin/rentas/utils/calculosLegales'; 

const ModalRescision = ({ isOpen, onClose, contrato, onSuccess }) => {
  const [cargando, setCargando] = useState(false);
  const [formRescision, setFormRescision] = useState({
    motivo: MOTIVOS_CANCELACION.FUERZA_MAYOR,
    observaciones: ''
  });
  
  const [esPausa, setEsPausa] = useState(false);
  const [montoSugerido, setMontoSugerido] = useState(0);
  // 🚀 CAMBIO: Estado para controlar si mostramos u ocultamos los detalles
  const [mostrarDetalles, setMostrarDetalles] = useState(false);

  useEffect(() => {
    if (formRescision.motivo !== MOTIVOS_CANCELACION.FUERZA_MAYOR) {
      setEsPausa(false);
    }

    if (isOpen && contrato && formRescision.motivo) {
      if (esPausa) {
        setMontoSugerido(0);
      } else {
        const calculo = calcularFiniquitoFinal(contrato, formRescision.motivo);
        setMontoSugerido(calculo);
      }
    }
  }, [isOpen, contrato, formRescision.motivo, esPausa]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const accionTexto = esPausa ? 'PAUSAR' : 'RESCINDIR';
    if (!window.confirm(`⚠️ ESTÁS A PUNTO DE ${accionTexto} ESTE CONTRATO.\n\n¿Estás seguro de ${accionTexto.toLowerCase()} este contrato por ${formRescision.motivo}?\n\nEsta acción NO se puede deshacer.`)) {
      return;
    }
    setCargando(true);
    try {
      const payload = { ...formRescision, esPausa: esPausa };
      await adminService.rescindirContrato(contrato.id || contrato.id_inversion, payload);
      if (esPausa) {
        alert(`⏸️ Contrato PAUSADO exitosamente.`);
      } else {
        // Redondeamos para el mensaje
        alert(`✅ Contrato rescindido legalmente.\nMonto final a liquidar guardado: $${Math.round(montoSugerido).toLocaleString('en-US')}`);
      }
      onSuccess(); 
      onClose(); 
    } catch (error) {
      alert(`❌ Hubo un problema: ${error.message}`);
    } finally {
      setCargando(false);
    }
  };

  const opcionesMotivo = [
    { value: MOTIVOS_CANCELACION.INCUMPLIMIENTO_EMPRESA, label: 'Incumplimiento de la Empresa (Penalización 15% a favor del cliente)' },
    { value: MOTIVOS_CANCELACION.RETIRO_INVERSIONISTA, label: 'Retiro del Inversionista (Penalización 20% a favor de la empresa)' },
    { value: MOTIVOS_CANCELACION.FUERZA_MAYOR, label: 'Fuerza Mayor / Caso Fortuito (Sin penalizaciones)' }
  ];

  if (!isOpen || !contrato) return null;

  // =========================================================================
  // 🧮 🚀 LÓGICA REPLICADA SOLO PARA VISUALIZACIÓN DEL DESGLOSE EN UI
  // Esta lógica debe ser idéntica a calculosLegales.js para consistencia visual.
  // =========================================================================
  const inversionInicial = parseFloat(contrato.monto_invertido || 0);
  const totalContrato = parseFloat(contrato.monto_total_contrato || 0);
  const plazoMeses = parseInt(contrato.plazo_meses || 1, 10);
  const totalPagadoBD = parseFloat(contrato.total_pagado || 0);

  // 1. Deducimos meses pagados matemáticamente (igual que el backend/util)
  const cuotaMensualEsperada = plazoMeses > 0 ? (totalContrato / plazoMeses) : 0;
  let pagosRealizados = parseInt(contrato.pagos_realizados || 0, 10);
  
  // Blindaje si pagos_realizados viene en 0
  if (pagosRealizados === 0 && cuotaMensualEsperada > 0 && totalPagadoBD > 0) {
    pagosRealizados = Math.floor(totalPagadoBD / cuotaMensualEsperada);
  }

  // 2. Cálculo de Amortización Contable
  const porcionCapitalMensual = plazoMeses > 0 ? (inversionInicial / plazoMeses) : 0;
  const capitalAmortizado = porcionCapitalMensual * pagosRealizados;
  
  // La Deuda Neta Real al día de hoy (sin intereses futuros)
  const deudaNeta = Math.max(0, inversionInicial - capitalAmortizado);

  // 3. Cálculo visual de penalizaciones
  let montoPenalizacion = 0;
  let porcentajePenalizacion = 0;
  let esPenalizacionNegativa = false; // Descuento para el cliente

  if (formRescision.motivo === MOTIVOS_CANCELACION.INCUMPLIMIENTO_EMPRESA) {
    porcentajePenalizacion = 15;
    montoPenalizacion = inversionInicial * 0.15;
  } else if (formRescision.motivo === MOTIVOS_CANCELACION.RETIRO_INVERSIONISTA) {
    porcentajePenalizacion = 20;
    esPenalizacionNegativa = true;
    montoPenalizacion = inversionInicial * 0.20;
  }
  // =========================================================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className={`border ${esPausa ? 'border-orange-500/50' : 'border-red-500/50'} bg-[#1a1a2e] rounded-2xl w-full max-w-2xl overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.15)] transition-colors duration-300`}>
        
        {/* HEADER DINÁMICO */}
        <div className={`p-6 border-b flex justify-between items-center ${esPausa ? 'bg-orange-500/10 border-orange-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <h3 className={`text-xl font-bold flex items-center gap-2 ${esPausa ? 'text-orange-400' : 'text-red-400'}`}>
            {esPausa ? <PauseCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            {esPausa ? 'Pausar Contrato' : 'Rescindir Contrato Legalmente'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* INFO DEL CONTRATO */}
          <div className="bg-black/30 p-4 rounded-lg border border-white/5 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Resumen de Inversión</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Capital Inicial</p>
                <p className="text-lg font-semibold text-white">
                  ${Math.round(inversionInicial).toLocaleString('en-US')}
                </p>
              </div>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Retorno Total Pactado</p>
                <p className="text-lg font-semibold text-cyan-400">
                  ${Math.round(totalContrato).toLocaleString('en-US')}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-gray-400">Plazo: <span className="text-gray-200">{plazoMeses} meses</span></span>
              {/* Usamos pagosRealizados que deducimos arriba */}
              <span className="text-xs text-gray-400">Pagos detectados: <span className="text-gray-200">{pagosRealizados} meses</span></span>
            </div>
          </div>

          {/* SELECTOR DE MOTIVO LEGAL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Motivo Legal <span className="text-red-400">*</span></label>
            <select
              value={formRescision.motivo}
              onChange={(e) => setFormRescision({...formRescision, motivo: e.target.value})}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:border-cyan-500 outline-none appearance-none"
              required
            >
              {opcionesMotivo.map(opcion => (
                <option key={opcion.value} value={opcion.value} className="bg-[#1a1a2e]">
                  {opcion.label}
                </option>
              ))}
            </select>
          </div>

          {/* 🚀 EL CHECKBOX DE PAUSA */}
          {formRescision.motivo === MOTIVOS_CANCELACION.FUERZA_MAYOR && (
            <div className={`p-4 rounded-lg border transition-colors cursor-pointer ${esPausa ? 'bg-orange-500/20 border-orange-500/50' : 'bg-white/5 border-white/10 hover:border-orange-500/30'}`} onClick={() => setEsPausa(!esPausa)}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={esPausa}
                  onChange={(e) => setEsPausa(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-orange-500 bg-gray-700 border-gray-600 rounded"
                />
                <div>
                  <p className="text-sm font-bold text-orange-400 flex items-center gap-2">
                    Suspender Temporalmente (Pausar)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    El contrato cambiará a estatus "Pausado" sin calcular liquidación. Los campos de rescisión quedarán en blanco para retomarlo después.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* 🚀 CALCULADORA EN VIVO Y DESGLOSE (REEMPLAZADO TOTALMENTE) */}
          {!esPausa && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg overflow-hidden transition-all">
              {/* Tarjeta Principal Interactiva */}
              <div className="p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-300 mb-1">Cálculo Automático de Liquidación (Amortización)</p>
                  <p className="text-xs text-blue-400/70 mb-2">Total neto separando capital de rendimiento contable.</p>
                  
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-3xl font-bold text-white">
                      ${Math.round(montoSugerido).toLocaleString('en-US')}
                    </div>
                    {/* Botón para alternar detalles */}
                    <button
                      type="button"
                      onClick={() => setMostrarDetalles(!mostrarDetalles)}
                      className="flex items-center gap-1.5 text-xs text-blue-200 bg-blue-500/20 hover:bg-blue-500/30 px-3 py-2 rounded-full transition-colors font-medium border border-blue-500/30"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      {mostrarDetalles ? 'Ocultar desglose' : 'Ver desglose'}
                      {mostrarDetalles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 🧐 ACORDEÓN DE DETALLES MATEMÁTICOS (Condicional) */}
              {mostrarDetalles && (
                <div className="border-t border-blue-500/20 bg-black/40 p-4 space-y-3 font-mono text-xs transition-all duration-300">
                  
                  <div className="flex justify-between text-gray-400">
                    <span>Capital Inicial Original</span>
                    <span className="text-gray-100">${Math.round(inversionInicial).toLocaleString('en-US')}</span>
                  </div>
                  
                  <div className="flex justify-between text-red-400">
                    <span>(-) Retorno de Capital aplicado ({pagosRealizados} meses * ${Math.round(porcionCapitalMensual).toLocaleString('en-US')}/mes)</span>
                    <span className="font-bold">-${Math.round(capitalAmortizado).toLocaleString('en-US')}</span>
                  </div>

                  <div className="h-px w-full bg-white/10 my-1"></div>
                  
                  <div className="flex justify-between font-bold text-gray-200 text-sm bg-white/5 p-1 rounded">
                    <span>(=) Capital Restante (Deuda Neta Real)</span>
                    <span>${Math.round(deudaNeta).toLocaleString('en-US')}</span>
                  </div>

                  {/* Mostramos la penalización solo si NO es Fuerza Mayor */}
                  {formRescision.motivo !== MOTIVOS_CANCELACION.FUERZA_MAYOR && (
                    <div className={`flex justify-between mt-2 p-1 rounded ${esPenalizacionNegativa ? 'text-red-400 bg-red-500/5' : 'text-green-400 bg-green-500/5'}`}>
                      <span className="flex items-center gap-1">
                        {esPenalizacionNegativa ? <ChevronDown className="w-3 h-3"/> : <ChevronUp className="w-3 h-3"/>}
                        {esPenalizacionNegativa ? '(-) Penalización al Inversionista' : '(+) Penalización de la Empresa'} ({porcentajePenalizacion}% s/Capital)
                      </span>
                      <span className="font-bold">
                        {esPenalizacionNegativa ? '-' : '+'}${Math.round(montoPenalizacion).toLocaleString('en-US')}
                      </span>
                    </div>
                  )}

                  <div className="h-px w-full bg-blue-500/30 my-1"></div>
                  
                  <div className="flex justify-between font-bold text-blue-300 text-sm bg-blue-500/10 p-1 rounded border border-blue-500/20">
                    <span>TOTAL NETO A LIQUIDAR</span>
                    <span className="text-white text-lg">${Math.round(montoSugerido).toLocaleString('en-US')}</span>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* OBSERVACIONES */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <FileText className="w-4 h-4" /> Notas u Observaciones (Opcional)
            </label>
            <textarea
              rows="3"
              value={formRescision.observaciones}
              onChange={(e) => setFormRescision({...formRescision, observaciones: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none resize-none focus:border-cyan-500/50"
              placeholder="Ej. El contrato queda suspendido temporalmente hasta nuevo aviso..."
            ></textarea>
          </div>

          {/* BOTONES */}
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className={`flex-1 py-3 px-4 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex justify-center items-center gap-2 ${esPausa ? 'bg-orange-600 hover:bg-orange-500' : 'bg-red-600 hover:bg-red-500'}`}
            >
              {cargando ? 'Procesando...' : (
                <>
                  {esPausa ? <PauseCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} 
                  {esPausa ? 'Ejecutar Pausa' : 'Ejecutar Rescisión'}
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ModalRescision;