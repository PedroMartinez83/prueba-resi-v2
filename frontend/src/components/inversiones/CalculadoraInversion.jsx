import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Calculator, TrendingUp, DollarSign, Calendar, Info, 
  Building2, Car, Percent, RotateCcw, BarChart3, Sliders 
} from 'lucide-react';
import adminService from '../../services/adminService';

const CalculadoraInversion = ({ isOpen, onClose, datosIniciales = {} }) => {
  const [modeloNegocio, setModeloNegocio] = useState('SD'); // 🔄 Cambiado de 'AUTOMANAGER' a 'SD'
  const [multiplicadorSistema, setMultiplicadorSistema] = useState(2.82);
  
  const [formData, setFormData] = useState({
    valorFactura: '',
    costoPoliza: '',
    placas: '',
    gps: '',
    otrosGastos: '',
    rentaDiaria: '400',
    multiplicadorCustom: '2.82',
    utilidadPorcentaje: '182',
    plazoMeses: '48',
    ...datosIniciales
  });

  const [calculos, setCalculos] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [modoEdicion, setModoEdicion] = useState('multiplicador');

  // Cargar multiplicador del sistema
  useEffect(() => {
    if (isOpen) {
      adminService.getMultiplicadorSistema()
        .then(response => {
          if (response.success) {
            setMultiplicadorSistema(response.multiplicador);
            setFormData(prev => ({
              ...prev,
              multiplicadorCustom: response.multiplicador.toString(),
              utilidadPorcentaje: ((response.multiplicador - 1) * 100).toFixed(0)
            }));
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Sincronización bidireccional multiplicador ↔ utilidad
  const handleMultiplicadorChange = (valor) => {
    const multiplicador = parseFloat(valor) || 1;
    const utilidad = ((multiplicador - 1) * 100).toFixed(0);
    setFormData(prev => ({
      ...prev,
      multiplicadorCustom: valor,
      utilidadPorcentaje: utilidad
    }));
    setModoEdicion('multiplicador');
  };

  const handleUtilidadChange = (valor) => {
    const utilidadPct = parseFloat(valor) || 0;
    const multiplicador = (1 + (utilidadPct / 100)).toFixed(2);
    setFormData(prev => ({
      ...prev,
      utilidadPorcentaje: valor,
      multiplicadorCustom: multiplicador
    }));
    setModoEdicion('utilidad');
  };

  // Reset a valores del sistema
  const resetToSystemValues = () => {
    setFormData(prev => ({
      ...prev,
      multiplicadorCustom: multiplicadorSistema.toString(),
      utilidadPorcentaje: ((multiplicadorSistema - 1) * 100).toFixed(0)
    }));
  };

  // Calcular automáticamente
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.valorFactura || formData.costoPoliza) {
        calcularInversion();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [formData, modeloNegocio]);

  const calcularInversion = async () => {
    setCalculando(true);
    try {
      let response;
      
      if (modeloNegocio === 'SI_LEGADO') {
        response = await adminService.calcularInversionSILegado({
          valorFactura: formData.valorFactura,
          costoPoliza: formData.costoPoliza,
          placas: formData.placas,
          gps: formData.gps,
          otrosGastos: formData.otrosGastos
        });
      } else {
        const inversionTotal = 
          parseFloat(formData.valorFactura || 0) + 
          (parseFloat(formData.costoPoliza || 0) * 2) + 
          parseFloat(formData.placas || 0) + 
          parseFloat(formData.gps || 0) + 
          parseFloat(formData.otrosGastos || 0);

        const multiplicador = parseFloat(formData.multiplicadorCustom || 2.82);
        const corridaTotal = inversionTotal * multiplicador;
        const ingresoMensual = parseFloat(formData.rentaDiaria || 400) * 26;
        const plazoEstimadoMeses = Math.ceil(corridaTotal / ingresoMensual);
        const plazoDefinido = parseInt(formData.plazoMeses || 48);
        const pagoMensualRequerido = corridaTotal / plazoDefinido;

        response = {
          success: true,
          calculos: {
            inversionTotal,
            corridaTotal,
            ingresoMensual,
            plazoEstimadoMeses,
            plazoDefinido,
            pagoMensualRequerido,
            rentaDiaria: parseFloat(formData.rentaDiaria || 400),
            multiplicadorUsado: multiplicador,
            utilidadTotal: corridaTotal - inversionTotal,
            utilidadPorcentaje: ((multiplicador - 1) * 100).toFixed(2),
            modelo: 'SD' // 🔄 Cambiado de 'AUTOMANAGER' a 'SD'
          }
        };
      }
      
      if (response.success) {
        setCalculos(response.calculos);
      }
    } catch (error) {
      console.error('Error calculando:', error);
    } finally {
      setCalculando(false);
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

  const calcularPorcentajeGrafico = (valor, total) => {
    return Math.min(((valor / total) * 100), 100);
  };

  // 🔄 FUNCIÓN CORREGIDA - handleConfirmar
  const handleConfirmar = () => {
    if (calculos && onClose) {
      // 🎯 Determinar valores según el modelo de negocio
      let datosVehiculo;
      
      if (modeloNegocio === 'SI_LEGADO') {
        // ✅ SI_LEGADO: Valores FIJOS siempre
        datosVehiculo = {
          valor_factura: formData.valorFactura,
          polizas: formData.costoPoliza,
          placas: formData.placas,
          gps: formData.gps,
          otros_gastos: formData.otrosGastos,
          renta_diaria: 10400,           // ✅ FIJO: $10,400
          plazo_meses: 62,                // ✅ FIJO: 62 meses
          tasa_rendimiento: 1.56,         // ✅ FIJO: 1.56x
          inversion_total: calculos.inversionTotal,
          corrida_total: calculos.inversionTotal * 1.56,
          utilidad_total: calculos.utilidadMensual * 62,
          multiplicador_usado: 1.56
        };
      } else {
        // ✅ SD (Socio Dueño): Valores variables del formulario
        datosVehiculo = {
          valor_factura: formData.valorFactura,
          polizas: formData.costoPoliza,
          placas: formData.placas,
          gps: formData.gps,
          otros_gastos: formData.otrosGastos,
          renta_diaria: formData.rentaDiaria,
          plazo_meses: formData.plazoMeses,
          tasa_rendimiento: parseFloat(formData.multiplicadorCustom), // ✅ Multiplicador, no utilidad
          inversion_total: calculos.inversionTotal,
          corrida_total: calculos.corridaTotal,
          utilidad_total: calculos.utilidadTotal,
          multiplicador_usado: calculos.multiplicadorUsado
        };
      }

      onClose({
        usarDatos: true,
        modelo: modeloNegocio, // Enviará 'SI_LEGADO' o 'SD'
        datosVehiculo,
        calculos
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-dark glass rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-y-auto border border-primary/30">
        {/* Header */}
        <div className="sticky top-0 bg-dark/95 backdrop-blur-sm p-4 sm:p-6 border-b border-primary/20 z-10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-white">
                Calculadora de Inversión
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Selector de Modelo */}
        <div className="p-4 sm:p-6 border-b border-gray-700">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
            <label className="text-gray-400 font-medium text-sm sm:text-base">
              Modelo de Negocio:
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setModeloNegocio('SI_LEGADO')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm sm:text-base ${
                  modeloNegocio === 'SI_LEGADO' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">SI Legado</span>
                <span className="sm:hidden">Legado</span>
              </button>
              {/* 🔄 BOTÓN RENOMBRADO */}
              <button
                onClick={() => setModeloNegocio('SD')}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm sm:text-base ${
                  modeloNegocio === 'SD' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Car className="w-4 h-4" />
                <span className="hidden sm:inline">Socio Dueño (SD)</span>
                <span className="sm:hidden">SD</span>
              </button>
            </div>
          </div>
          
          {/* 🔄 INFO DEL MODELO ACTUALIZADA */}
          <div className="mt-3 sm:mt-4 p-3 bg-gray-800/50 rounded-lg">
            {modeloNegocio === 'SI_LEGADO' ? (
              <div className="text-xs sm:text-sm text-gray-400">
                <strong className="text-blue-400">Modelo SI Legado:</strong> (Modo informativo) 
                Calcula la utilidad fija de la empresa. Flujo fijo: $10,400/mes del conductor, 
                $8,000/mes al inversionista, $2,400/mes de utilidad.
              </div>
            ) : (
              <div className="text-xs sm:text-sm text-gray-400">
                <strong className="text-green-400">Modelo Socio Dueño (SD):</strong> (Modo interactivo) 
                Calcula la "Corrida" o deuda total del conductor. Todos los valores son editables 
                para simular diferentes escenarios.
              </div>
            )}
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          
          {/* COLUMNA IZQUIERDA - ENTRADA */}
          <div className="space-y-4 sm:space-y-6">
            
            {/* Costos de Inversión */}
            <div className="glass rounded-lg p-3 sm:p-4 border border-gray-700">
              <h3 className="font-semibold text-primary mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                Costos de Inversión
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                    Valor Factura
                  </label>
                  <input
                    type="number"
                    value={formData.valorFactura}
                    onChange={(e) => setFormData({...formData, valorFactura: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="250,000"
                  />
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                    Costo de Póliza (Anual)
                  </label>
                  <input
                    type="number"
                    value={formData.costoPoliza}
                    onChange={(e) => setFormData({...formData, costoPoliza: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="15,000"
                  />
                  {/* 🔄 Feedback inline SOLO para SD */}
                  {formData.costoPoliza && modeloNegocio === 'SD' && (
                    <div className="mt-1 text-xs text-primary">
                      💡 Calculado: {formatCurrency(parseFloat(formData.costoPoliza) * 2)} (x2 años)
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-400 mb-1">Placas</label>
                    <input
                      type="number"
                      value={formData.placas}
                      onChange={(e) => setFormData({...formData, placas: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="5,000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-400 mb-1">GPS</label>
                    <input
                      type="number"
                      value={formData.gps}
                      onChange={(e) => setFormData({...formData, gps: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="3,000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-400 mb-1">Otros</label>
                    <input
                      type="number"
                      value={formData.otrosGastos}
                      onChange={(e) => setFormData({...formData, otrosGastos: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="2,000"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 🔄 Secciones SOLO para SD (antes AUTOMANAGER) */}
            {modeloNegocio === 'SD' && (
              <>
                {/* Parámetros de Rentabilidad */}
                <div className="glass rounded-lg p-3 sm:p-4 border border-gray-700">
                  <h3 className="font-semibold text-primary mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                    <Percent className="w-4 h-4 sm:w-5 sm:h-5" />
                    Parámetros de Rentabilidad
                  </h3>
                  <div className="space-y-4">
                    
                    {/* Multiplicador/Utilidad */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs sm:text-sm text-gray-400">
                          {modoEdicion === 'multiplicador' ? 'Multiplicador' : '% Utilidad'}
                        </label>
                        <button
                          onClick={resetToSystemValues}
                          className="text-xs text-primary hover:text-primary-light flex items-center gap-1"
                          title="Restaurar valor del sistema"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      </div>

                      {/* Tabs */}
                      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
                        <button
                          onClick={() => setModoEdicion('multiplicador')}
                          className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                            modoEdicion === 'multiplicador' 
                              ? 'bg-primary text-dark font-semibold' 
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Multiplicador
                        </button>
                        <button
                          onClick={() => setModoEdicion('utilidad')}
                          className={`flex-1 px-2 py-1 rounded text-xs transition-colors ${
                            modoEdicion === 'utilidad' 
                              ? 'bg-primary text-dark font-semibold' 
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          % Utilidad
                        </button>
                      </div>

                      {/* Input según modo */}
                      {modoEdicion === 'multiplicador' ? (
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            min="1"
                            max="5"
                            value={formData.multiplicadorCustom}
                            onChange={(e) => handleMultiplicadorChange(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <input
                            type="range"
                            min="1"
                            max="5"
                            step="0.01"
                            value={formData.multiplicadorCustom}
                            onChange={(e) => handleMultiplicadorChange(e.target.value)}
                            className="w-full mt-2 accent-primary"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1.0x</span>
                            <span className="text-primary font-semibold">
                              {formData.multiplicadorCustom}x = {formData.utilidadPorcentaje}% utilidad
                            </span>
                            <span>5.0x</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="400"
                              value={formData.utilidadPorcentaje}
                              onChange={(e) => handleUtilidadChange(e.target.value)}
                              className="w-full px-3 py-2 pr-8 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="400"
                            value={formData.utilidadPorcentaje}
                            onChange={(e) => handleUtilidadChange(e.target.value)}
                            className="w-full mt-2 accent-primary"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0%</span>
                            <span className="text-primary font-semibold">
                              {formData.utilidadPorcentaje}% = {formData.multiplicadorCustom}x
                            </span>
                            <span>400%</span>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 bg-gray-800/50 p-2 rounded">
                        Sistema: {multiplicadorSistema}x ({((multiplicadorSistema - 1) * 100).toFixed(0)}%)
                      </div>
                    </div>
                    
                    {/* Plazo */}
                    <div>
                      <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                        Plazo de Recuperación
                      </label>
                      <input
                        type="number"
                        value={formData.plazoMeses}
                        onChange={(e) => setFormData({...formData, plazoMeses: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <input
                        type="range"
                        min="12"
                        max="90"
                        value={formData.plazoMeses}
                        onChange={(e) => setFormData({...formData, plazoMeses: e.target.value})}
                        className="w-full mt-2 accent-primary"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>12 meses</span>
                        <span className="text-primary font-semibold">{formData.plazoMeses} meses</span>
                        <span>90 meses</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Renta del Conductor */}
                <div className="glass rounded-lg p-3 sm:p-4 border border-gray-700">
                  <h3 className="font-semibold text-primary mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                    Renta del Conductor
                  </h3>
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-400 mb-1">
                      Renta Diaria
                    </label>
                    <input
                      type="number"
                      value={formData.rentaDiaria}
                      onChange={(e) => setFormData({...formData, rentaDiaria: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="400"
                    />
                    <div className="mt-2 p-2 bg-gray-800/50 rounded space-y-1 text-xs">
                      <div className="flex justify-between text-gray-400">
                        <span>Semanal (6 días):</span>
                        <span className="text-white font-semibold">
                          {formatCurrency(parseFloat(formData.rentaDiaria || 0) * 6)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Mensual (26 días):</span>
                        <span className="text-green-400 font-bold">
                          {formatCurrency(parseFloat(formData.rentaDiaria || 0) * 26)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* COLUMNA DERECHA - RESULTADOS */}
          <div className="space-y-4 sm:space-y-6">
            {calculos ? (
              <>
                {modeloNegocio === 'SI_LEGADO' ? (
                  // Resultados SI Legado
                  <div className="glass rounded-lg p-3 sm:p-4 border border-blue-500/30">
                    <h3 className="font-semibold text-blue-400 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                      Resultados - SI Legado
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                        <span className="text-xs sm:text-sm text-gray-400">Inversión Total:</span>
                        <span className="text-lg sm:text-xl font-bold text-white">
                          {formatCurrency(calculos.inversionTotal)}
                        </span>
                      </div>
                      
                      <div className="border-t border-gray-700 pt-3 space-y-2">
                        <p className="text-xs text-gray-500 mb-2">Flujo Mensual Fijo:</p>
                        
                        <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
                          <span className="text-xs sm:text-sm text-gray-400">Conductor:</span>
                          <span className="text-sm sm:text-lg font-bold text-green-400">
                            {formatCurrency(calculos.ingresoMensual)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
                          <span className="text-xs sm:text-sm text-gray-400">Inversionista:</span>
                          <span className="text-sm sm:text-lg font-bold text-yellow-400">
                            {formatCurrency(calculos.pagoInversionista)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-primary/20 rounded-lg border border-primary/30">
                          <span className="text-xs sm:text-sm text-gray-300 font-semibold">Utilidad:</span>
                          <span className="text-lg sm:text-2xl font-bold text-primary">
                            {formatCurrency(calculos.utilidadMensual)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // 🔄 Resultados SD (antes AutoManager)
                  <>
                    <div className="glass rounded-lg p-3 sm:p-4 border border-green-500/30">
                      <h3 className="font-semibold text-green-400 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                        Resultados - Socio Dueño (SD)
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                          <span className="text-xs sm:text-sm text-gray-400">Inversión Total:</span>
                          <span className="text-base sm:text-xl font-bold text-white">
                            {formatCurrency(calculos.inversionTotal)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                          <span className="text-xs sm:text-sm text-gray-400">
                            Corrida (Deuda del Conductor):
                          </span>
                          <span className="text-base sm:text-xl font-bold text-yellow-400">
                            {formatCurrency(calculos.corridaTotal)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-primary/20 rounded-lg border border-primary/30">
                          <span className="text-xs sm:text-sm text-gray-300 font-semibold">Utilidad Total:</span>
                          <span className="text-lg sm:text-2xl font-bold text-primary">
                            {formatCurrency(calculos.utilidadTotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Gráfico y Análisis - sin cambios */}
                    <div className="glass rounded-lg p-3 sm:p-4 border border-purple-500/30">
                      <h3 className="font-semibold text-purple-400 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                        <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                        Visualización de Rentabilidad
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Inversión Inicial</span>
                            <span className="font-semibold text-white">
                              {formatCurrency(calculos.inversionTotal)}
                            </span>
                          </div>
                          <div className="h-8 bg-gray-800 rounded-lg overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                              style={{ 
                                width: `${calcularPorcentajeGrafico(calculos.inversionTotal, calculos.corridaTotal)}%` 
                              }}
                            ></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Utilidad Total (+{calculos.utilidadPorcentaje}%)</span>
                            <span className="font-semibold text-primary">
                              {formatCurrency(calculos.utilidadTotal)}
                            </span>
                          </div>
                          <div className="h-8 bg-gray-800 rounded-lg overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-primary to-green-400 transition-all duration-500"
                              style={{ 
                                width: `${calcularPorcentajeGrafico(calculos.utilidadTotal, calculos.corridaTotal)}%` 
                              }}
                            ></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Corrida Total (Deuda del Conductor)</span>
                            <span className="font-semibold text-yellow-400">
                              {formatCurrency(calculos.corridaTotal)}
                            </span>
                          </div>
                          <div className="h-8 bg-gray-800 rounded-lg overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500"
                              style={{ width: '100%' }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Análisis de Escenarios */}
                    <div className="glass rounded-lg p-3 sm:p-4 border border-blue-500/30">
                      <h3 className="font-semibold text-blue-400 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                        <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
                        Análisis de Escenarios
                      </h3>
                      <div className="space-y-3">
                        <div className="p-2 sm:p-3 bg-gray-800/50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-2">
                            Con renta de {formatCurrency(calculos.rentaDiaria)}/día:
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                              <span className="text-gray-400">Plazo recuperación:</span>
                              <span className="font-bold text-blue-400">
                                {calculos.plazoEstimadoMeses} meses
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                              <span className="text-gray-400">Ingreso mensual:</span>
                              <span className="font-bold text-green-400">
                                {formatCurrency(calculos.ingresoMensual)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-2 sm:p-3 bg-gray-800/50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-2">
                            Para recuperar en {calculos.plazoDefinido} meses:
                          </p>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                              <span className="text-gray-400">Pago mensual:</span>
                              <span className="font-bold text-orange-400">
                                {formatCurrency(calculos.pagoMensualRequerido)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs sm:text-sm">
                              <span className="text-gray-400">Renta diaria:</span>
                              <span className="font-bold text-orange-400">
                                {formatCurrency(calculos.pagoMensualRequerido / 26)}/día
                              </span>
                            </div>
                          </div>
                        </div>

                        {calculos.ingresoMensual >= calculos.pagoMensualRequerido ? (
                          <div className="p-2 bg-green-900/30 border border-green-500/30 rounded text-xs text-green-400 flex items-start gap-2">
                            <span className="text-lg">✓</span>
                            <span>La renta actual es suficiente para el plazo deseado</span>
                          </div>
                        ) : (
                          <div className="p-2 bg-yellow-900/30 border border-yellow-500/30 rounded text-xs text-yellow-400 flex items-start gap-2">
                            <span className="text-lg">⚠</span>
                            <span>
                              Aumentar renta a {formatCurrency(calculos.pagoMensualRequerido / 26)}/día 
                              para cumplir {calculos.plazoDefinido} meses
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Info Card */}
                <div className="glass rounded-lg p-3 sm:p-4 border border-blue-500/30">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs sm:text-sm text-gray-400">
                      {modeloNegocio === 'SI_LEGADO' ? (
                        <p>
                          <strong>Modo Informativo:</strong> Modelo con flujos fijos establecidos contractualmente. 
                          No editables.
                        </p>
                      ) : (
                        <p>
                          <strong>Modo Simulación:</strong> Ajusta multiplicador, plazo y renta 
                          para encontrar el escenario óptimo de la "Corrida" (deuda del conductor). 
                          Los cambios se reflejan en tiempo real.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="glass rounded-lg p-6 sm:p-8 border border-gray-700 text-center">
                <Calculator className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-sm sm:text-base text-gray-400">
                  Ingresa los datos para ver los cálculos
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-dark/95 backdrop-blur-sm p-3 sm:p-4 border-t border-gray-700 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-between sm:items-center">
          <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-left">
            <span className={modeloNegocio === 'SI_LEGADO' ? 'text-blue-400' : 'text-green-400'}>
              {modeloNegocio === 'SI_LEGADO' ? 'SI Legado' : 'Socio Dueño (SD)'}
            </span>
            {calculos && modeloNegocio === 'SD' && (
              <span className="ml-2 sm:ml-3">
                | Utilidad: <span className="text-primary font-bold">{formatCurrency(calculos.utilidadTotal)}</span>
              </span>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors text-sm sm:text-base"
            >
              Cancelar
            </button>
            {calculos && (
              <button
                onClick={handleConfirmar}
                className="flex-1 sm:flex-none px-4 py-2 bg-primary text-dark font-semibold rounded-lg hover:bg-primary-light transition-colors text-sm sm:text-base"
              >
                ✓ Confirmar y Usar Cifras
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculadoraInversion;